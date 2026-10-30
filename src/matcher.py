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
from src.db import connect

CACHE_DIR = config.ROOT / "data" / "processed"

# Starting guesses, to be tuned on real failures in step 13.
EMBEDDING_WEAK = 0.55   # below this the embedding match is not trusted on its own
FUZZY_MIN = 0.85        # fuzzy only wins if the strings are nearly identical


@dataclass(frozen=True)
class Match:
    food_id: int
    name: str            # display name (Thai if available)
    kind: str            # 'ingredient' | 'combo'
    confidence: float    # 0..1
    method: str          # 'exact' | 'embedding' | 'fuzzy'
    matched_text: str    # which name/alias produced the score


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


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().casefold())


class Matcher:
    def __init__(self, db_path: Path = config.DB_PATH, embedder: Embedder | None = None,
                 cache_dir: Path | None = CACHE_DIR):
        self.embedder = embedder or BGEEmbedder()
        self.cache_dir = cache_dir
        self._foods: dict[int, tuple[str, str]] = {}   # id -> (display name, kind)
        self._texts: list[str] = []                    # original search strings
        self._norm: list[str] = []                     # normalised, parallel to _texts
        self._owner: list[int] = []                    # food id per string
        self._load(db_path)
        self._exact = {n: i for i, n in enumerate(self._norm)}   # normalised text -> index
        self._vectors: np.ndarray | None = None

    def _load(self, db_path: Path) -> None:
        from contextlib import closing
        with closing(connect(db_path)) as conn:
            for r in conn.execute("SELECT id, name_th, name_en, kind FROM foods"):
                self._foods[r["id"]] = (r["name_th"] or r["name_en"], r["kind"])
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
        name, kind = self._foods[self._owner[idx]]
        return Match(self._owner[idx], name, kind, round(float(score), 4), method, self._texts[idx])

    def _best_per_food(self, scores: np.ndarray) -> list[int]:
        """Indices of each food's best string, sorted by score descending."""
        best: dict[int, int] = {}
        for idx, food_id in enumerate(self._owner):
            if food_id not in best or scores[idx] > scores[best[food_id]]:
                best[food_id] = idx
        return sorted(best.values(), key=lambda i: -scores[i])

    def match(self, query: str, top_k: int = 3) -> list[Match]:
        q = normalize(query)
        if not q:
            return []
        if q in self._exact:
            return [self._make(self._exact[q], 1.0, "exact")]

        sims = self._embeddings() @ np.asarray(
            self.embedder.encode([query])[0], dtype=np.float32)
        results = [self._make(i, sims[i], "embedding")
                   for i in self._best_per_food(sims)[:top_k]]

        if results[0].confidence < EMBEDDING_WEAK:
            fuzzy = np.array([fuzz.ratio(q, n) / 100 for n in self._norm])
            top = self._best_per_food(fuzzy)[0]
            if fuzzy[top] >= FUZZY_MIN:
                best = self._make(top, fuzzy[top], "fuzzy")
                results = [best] + [m for m in results if m.food_id != best.food_id]
        return results[:top_k]
