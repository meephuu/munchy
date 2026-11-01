import hashlib

import numpy as np
import pytest

from src.db import seed_db
from src.matcher import HIGH, LOW, MARGIN, BGEEmbedder, Match, Matcher, classify, normalize


class BigramEmbedder:
    """Fake embedder: similar spellings -> similar vectors. No model download."""
    model_name = "fake"
    dim = 512

    def encode(self, texts):
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for row, text in enumerate(texts):
            t = normalize(text)
            for a, b in zip(t, t[1:]):
                out[row, int(hashlib.md5((a + b).encode()).hexdigest(), 16) % self.dim] += 1
        return out / np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-9)


class HashEmbedder:
    """Fake embedder: every string gets an unrelated random vector (nothing is similar)."""
    dim = 512

    def encode(self, texts):
        out = np.stack([np.random.default_rng(int(hashlib.md5(t.encode()).hexdigest(), 16) % 2**32)
                        .standard_normal(self.dim) for t in texts]).astype(np.float32)
        return out / np.linalg.norm(out, axis=1, keepdims=True)


class ExplodingEmbedder:
    model_name = "fake"

    def encode(self, texts):
        raise AssertionError("embedder must not be used for exact matches")


@pytest.fixture(scope="module")
def db_path(tmp_path_factory):
    path = tmp_path_factory.mktemp("db") / "foods.db"
    seed_db(path)
    return path


def test_exact_match_by_alias_skips_the_embedder(db_path):
    m = Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
    [top] = m.match("  Pork  Skewer ")
    assert (top.name, top.method, top.confidence) == ("grilled pork skewer", "exact", 1.0)


def test_exact_match_on_combo(db_path):
    m = Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
    [top] = m.match("cheese mashed potato with gravy sauce")
    assert top.kind == "combo" and top.name == "cheesy mashed potato with gravy"


def test_embedding_ranks_similar_spelling_first_and_returns_top_k(db_path):
    m = Matcher(db_path, BigramEmbedder(), cache_dir=None)
    results = m.match("mashed potatos", top_k=3)
    assert results[0].name == "mashed potato" and results[0].method == "embedding"
    assert len(results) == 3
    assert len({r.food_id for r in results}) == 3          # one entry per food
    assert [r.confidence for r in results] == sorted((r.confidence for r in results), reverse=True)


def test_fuzzy_rescues_typo_when_embedding_is_weak(db_path):
    m = Matcher(db_path, HashEmbedder(), cache_dir=None)
    top = m.match("ไข่ตม")[0]                                # missing tone mark
    assert (top.name, top.method) == ("boiled egg", "fuzzy")


def test_nonsense_is_not_fuzzy_matched(db_path):
    m = Matcher(db_path, HashEmbedder(), cache_dir=None)
    top = m.match("zzqxv")[0]
    assert top.method == "embedding" and top.confidence < LOW


def test_blank_query_returns_nothing(db_path):
    assert Matcher(db_path, ExplodingEmbedder(), cache_dir=None).match("   ") == []


def test_embedding_cache_is_written_and_reused(db_path, tmp_path):
    first = Matcher(db_path, BigramEmbedder(), cache_dir=tmp_path)
    first.match("zzz")
    assert len(list(tmp_path.glob("embeddings_*.npy"))) == 1
    second = Matcher(db_path, ExplodingEmbedder(), cache_dir=tmp_path)
    second._embeddings()                                    # loaded from disk, no encode call


# --- classify() -----------------------------------------------------------------------

def m(conf, method="embedding", food_id=1, text=None):
    return Match(food_id, f"food{food_id}", "ingredient", conf, method, text or f"text{food_id}")


def test_classify_exact_and_fuzzy_are_always_ok():
    assert classify([m(1.0, "exact")]) == "ok"
    assert classify([m(0.88, "fuzzy"), m(0.88, food_id=2)]) == "ok"


def test_classify_empty_is_no_match():
    assert classify([]) == "no_match"


def test_classify_thresholds():
    assert classify([m(LOW - 0.01), m(0.1, food_id=2)]) == "no_match"
    assert classify([m(LOW), m(0.1, food_id=2)]) == "uncertain"
    assert classify([m(HIGH - 0.01), m(0.1, food_id=2)]) == "uncertain"
    assert classify([m(HIGH), m(0.1, food_id=2)]) == "ok"


def test_classify_close_runner_up_makes_a_confident_match_uncertain():
    assert classify([m(0.95), m(0.95 - MARGIN + 0.01, food_id=2)]) == "uncertain"
    assert classify([m(0.95), m(0.95 - MARGIN - 0.01, food_id=2)]) == "ok"


def test_classify_close_runner_up_of_the_same_family_is_not_a_rival():
    top = m(0.90, text="Yogurt, Greek, plain, nonfat")
    variant = m(0.89, food_id=2, text="Yogurt, Greek, plain, whole milk")
    other = m(0.89, food_id=3, text="Yoghurt drink")
    assert classify([top, variant]) == "ok"                  # same first word group: just a variant
    assert classify([top, variant, other]) == "uncertain"    # a different food is still a rival


def test_classify_single_candidate_has_no_gap_penalty():
    assert classify([m(0.95)]) == "ok"


# --- real BGE-M3 model: run with `pytest -m slow` -------------------------------------

@pytest.fixture(scope="module")
def real(db_path, tmp_path_factory):
    return Matcher(db_path, BGEEmbedder(), cache_dir=tmp_path_factory.mktemp("cache"))


@pytest.mark.slow
@pytest.mark.parametrize("query, expected", [
    ("หมูปิ้ง", "grilled pork skewer"),
    ("ข้าวเหนียวหมูปิ้ง", "sticky rice with grilled pork skewers"),
    ("cheese mashed potato with gravy sauce", "cheesy mashed potato with gravy"),
    ("boiled egg", "boiled egg"),
    ("ไข่ต้ม", "boiled egg"),
    ("แตงกวา", "cucumber"),
    ("grilled chicken salad", "chicken breast salad"),
    ("ไก่ย่างอก", "grilled chicken breast"),
])
def test_real_model_finds_the_right_food(real, query, expected):
    assert real.match(query)[0].name == expected


@pytest.mark.slow
@pytest.mark.parametrize("query, status", [
    ("egg boiled", "ok"),                  # clear match
    ("ไข่ตม", "uncertain"),                # typo: right food, but a shaky score
    ("เบียร์", "no_match"),                # not in the table
    ("รถแทรกเตอร์", "no_match"),            # nonsense
])
def test_real_model_classification(real, query, status):
    assert classify(real.match(query)) == status
