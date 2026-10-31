"""Step 5: map each parsed food name to a database entry (embeddings + fuzzy fallback).

Every food contributes several search strings (name_th, name_en, aliases). A food's
score is the best score over its strings. Order of attempts:
  1. exact match on a normalised string        -> confidence 1.0
  2. BGE-M3 cosine similarity (Thai/English share one space)
  3. rapidfuzz, only when the embedding result is weak, to rescue typos/spelling variants
Several candidates are returned (top_k) so later steps can show runners-up.
"""
import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np
from rapidfuzz import fuzz

from src import config
from src.db import connect, display_name
from src.textutil import normalize

CACHE_DIR = config.ROOT / "data" / "processed"


# Thresholds, chosen with calibrate_matcher.py on data/eval/match_queries.csv (83 queries, ~6,900-food
# table: Thai DoH foods plus generic USDA foods). No threshold separates good from bad perfectly:
# foods we lack but that sit near one we have (fried fish vs fried chicken), and a short name that
# embeds near a related one ('olive oil' vs 'vegetable oil'), score as high as correct matches. At
# these values the top result is right for 58 of 64 known foods, none of the 19 unknown foods is
# accepted without a flag (8 are rejected, 11 flagged uncertain) and 1 wrong match gets through
# unflagged. Re-run the script whenever the food table or model changes.
LOW = 0.68       # embedding confidence below this -> no_match (lowest real food seen: 0.71)
HIGH = 0.80      # below this (but >= LOW) -> uncertain
MARGIN = 0.08    # top-1 minus top-2 below this -> uncertain even if confident
FUZZY_MIN = 0.85  # fuzzy only wins if the strings are nearly identical
# Ordering helpers. The embedding score alone cannot tell "Yogurt, Greek, plain" from "Yogurt, Greek,
# fruit", and prefers a short seed name over the entry that contains the query's exact words. So
# candidates are ranked by score plus these small bonuses. The two word bonuses count as evidence
# and are added to the reported confidence (a food literally containing the query's words is a better
# match than its cosine says: 'apple' vs 'Apples, raw'); the plain-variant preference only reorders.
PLAIN_BONUS = 0.04      # the unflavoured variant ('..., plain', '..., regular') when the query names none
WORDS_BONUS = 0.05      # the entry contains every word of the query ('caesar dressing')
HEAD_BONUS = 0.05       # ...and the entry's first part is just those words ('Apples, raw' for 'apple')
DERIVED_PENALTY = 0.10   # entry is a processed form of the query ('Oil, avocado' for 'avocado')
DERIVED_HEADS = "oil flour juice cookies cake candies soup sauce syrup extract powder pie crackers"
PLAIN_WORDS = re.compile(r"(?<!\w)(plain|regular)(?!\w)")


@dataclass(frozen=True)
class Match:
    food_id: int
    name: str            # display name (English if available)
    kind: str            # 'ingredient' | 'combo'
    confidence: float    # 0..1
    method: str          # 'exact' | 'embedding' | 'fuzzy'
    matched_text: str    # which name/alias produced the score
    name_th: str | None = None   # Thai name, when the food has one (labels in data files use it)
    dish: bool = False   # a whole prepared dish (combo or 'dishes' group), not a single ingredient


class Embedder(Protocol):
    def encode(self, texts: list[str]) -> np.ndarray:
        """Return an (n, d) array of L2-normalised vectors."""


class BGEEmbedder:
    """BAAI/bge-m3 via sentence-transformers, loaded on first use."""

    def __init__(self, model_name: str = config.EMBEDDING_MODEL):
        self.model_name = model_name
        self._model = None

    def encode(self, texts: list[str]) -> np.ndarray:
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name)
        return self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)


def _words(text: str) -> frozenset[str]:
    """Words of a name with a crude plural strip, so 'apple' meets 'Apples'."""
    return frozenset(w[:-1] if len(w) > 3 and w.endswith("s") else w for w in re.findall(r"\w+", text))


_DERIVED = _words(DERIVED_HEADS)


def _family(m: Match) -> str:
    """First comma-separated part of the matched name: 'Yogurt, Greek, plain' -> 'yogurt'."""
    return normalize(m.matched_text.split(",")[0])


def classify(matches: list[Match], low: float = LOW, high: float = HIGH,
             margin: float = MARGIN) -> str:
    """'ok' | 'uncertain' | 'no_match' for the result of Matcher.match().

    Exact matches are always ok; a fuzzy match already needed near-identical spelling.
    Embedding cosine is not well calibrated, so besides the score we look at the gap to
    the runner-up: two foods scoring alike means the model is guessing between them.
    """
    if not matches:
        return "no_match"
    top = matches[0]
    if top.method in ("exact", "fuzzy"):
        return "ok"
    if top.confidence < low:
        return "no_match"
    # A runner-up from the same food family ("Yogurt, Greek, plain, nonfat" vs "..., whole milk")
    # is a variant of the same thing, not a competing guess, so only other families count.
    rivals = [m for m in matches[1:] if _family(m) != _family(top)]
    gap = top.confidence - rivals[0].confidence if rivals else 1.0
    return "uncertain" if top.confidence < high or gap < margin else "ok"


class Matcher:
    def __init__(self, db_path: Path = config.DB_PATH, embedder: Embedder | None = None,
                 cache_dir: Path | None = CACHE_DIR):
        self.embedder = embedder or BGEEmbedder()
        self.cache_dir = cache_dir
        self._foods: dict[int, tuple[str, str, str | None, bool]] = {}   # id -> (display name, kind, Thai name, is dish)
        self._texts: list[str] = []                    # original search strings
        self._norm: list[str] = []                     # normalised, parallel to _texts
        self._owner: list[int] = []                    # food id per string
        self._load(db_path)
        self._exact = {n: i for i, n in enumerate(self._norm)}   # normalised text -> index
        self._vectors: np.ndarray | None = None
        self._bonus = np.array([PLAIN_BONUS if PLAIN_WORDS.search(n) else 0.0 for n in self._norm],
                               dtype=np.float32)
        self._words = [_words(n) for n in self._norm]
        self._heads = [_words(n.split(",")[0]) for n in self._norm]

    def _load(self, db_path: Path) -> None:
        from contextlib import closing
        with closing(connect(db_path)) as conn:
            for r in conn.execute("SELECT id, name_th, name_en, kind, food_group FROM foods"):
                self._foods[r["id"]] = (display_name(r), r["kind"], r["name_th"],
                                       r["kind"] == "combo" or r["food_group"] == "dishes")
                for text in (r["name_th"], r["name_en"]):
                    self._add(text, r["id"])
            for r in conn.execute("SELECT food_id, alias FROM food_aliases"):
                self._add(r["alias"], r["food_id"])

    def _add(self, text: str | None, food_id: int) -> None:
        if text and normalize(text) not in self._norm:
            self._texts.append(text)
            self._norm.append(normalize(text))
            self._owner.append(food_id)

    # --- embeddings (computed lazily, cached on disk) ---------------------------------

    def _embeddings(self) -> np.ndarray:
        if self._vectors is None:
            self._vectors = self._load_or_build_vectors()
        return self._vectors

    def _load_or_build_vectors(self) -> np.ndarray:
        path = None
        if self.cache_dir is not None:
            key = f"{getattr(self.embedder, 'model_name', type(self.embedder).__name__)}\n"
            key += "\n".join(self._texts)
            digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]
            path = self.cache_dir / f"embeddings_{digest}.npy"
            if path.exists():
                return np.load(path)
        vectors = np.asarray(self.embedder.encode(self._texts), dtype=np.float32)
        if path is not None:
            path.parent.mkdir(parents=True, exist_ok=True)
            for old in path.parent.glob("embeddings_*.npy"):
                old.unlink()
            np.save(path, vectors)
        return vectors

    # --- matching ---------------------------------------------------------------------

    def _make(self, idx: int, score: float, method: str) -> Match:
        name, kind, name_th, dish = self._foods[self._owner[idx]]
        return Match(self._owner[idx], name, kind, round(float(score), 4), method,
                     self._texts[idx], name_th, dish)

    def _best_per_food(self, scores: np.ndarray) -> list[int]:
        """Indices of each food's best string, sorted by score descending."""
        best: dict[int, int] = {}
        for idx, food_id in enumerate(self._owner):
            if food_id not in best or scores[idx] > scores[best[food_id]]:
                best[food_id] = idx
        return sorted(best.values(), key=lambda i: -scores[i])

    def _word_bonus(self, q: str) -> np.ndarray:
        """Bonus per search string for containing all the query's words (and for being just them)."""
        qw = _words(q)
        out = np.zeros(len(self._norm), dtype=np.float32)
        if len(qw) == 0:
            return out
        for i, (words, head) in enumerate(zip(self._words, self._heads)):
            if qw <= words:
                out[i] = WORDS_BONUS + (HEAD_BONUS if head == qw else 0.0)
            if head & _DERIVED and not head & qw:       # 'Oil, avocado' is not an avocado
                out[i] -= DERIVED_PENALTY
        return out

    def match(self, query: str, top_k: int = 3) -> list[Match]:
        q = normalize(query)
        if not q:
            return []
        if q in self._exact:
            return [self._make(self._exact[q], 1.0, "exact")]

        sims = self._embeddings() @ np.asarray(
            self.embedder.encode([query])[0], dtype=np.float32)
        sims = np.clip(sims + self._word_bonus(q), 0.0, 1.0)
        results = [self._make(i, sims[i], "embedding")
                   for i in self._best_per_food(sims + self._bonus)[:top_k]]

        if results[0].confidence < LOW:
            fuzzy = np.array([fuzz.ratio(q, n) / 100 for n in self._norm])
            top = self._best_per_food(fuzzy)[0]
            if fuzzy[top] >= FUZZY_MIN:
                best = self._make(top, fuzzy[top], "fuzzy")
                results = [best] + [m for m in results if m.food_id != best.food_id]
        return results[:top_k]
