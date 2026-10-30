import hashlib

import numpy as np
import pytest

from src.db import seed_db
from src.matcher import EMBEDDING_WEAK, BGEEmbedder, Matcher, normalize


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
    assert (top.name, top.method, top.confidence) == ("หมูปิ้ง", "exact", 1.0)


def test_exact_match_on_combo(db_path):
    m = Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
    [top] = m.match("cheese mashed potato with gravy sauce")
    assert top.kind == "combo" and top.name == "มันบดชีสราดเกรวี่"


def test_embedding_ranks_similar_spelling_first_and_returns_top_k(db_path):
    m = Matcher(db_path, BigramEmbedder(), cache_dir=None)
    results = m.match("mashed potatos", top_k=3)
    assert results[0].name == "มันฝรั่งบด" and results[0].method == "embedding"
    assert len(results) == 3
    assert len({r.food_id for r in results}) == 3          # one entry per food
    assert [r.confidence for r in results] == sorted((r.confidence for r in results), reverse=True)


def test_fuzzy_rescues_typo_when_embedding_is_weak(db_path):
    m = Matcher(db_path, HashEmbedder(), cache_dir=None)
    top = m.match("ไข่ตม")[0]                                # missing tone mark
    assert (top.name, top.method) == ("ไข่ต้ม", "fuzzy")


def test_nonsense_is_not_fuzzy_matched(db_path):
    m = Matcher(db_path, HashEmbedder(), cache_dir=None)
    top = m.match("zzqxv")[0]
    assert top.method == "embedding" and top.confidence < EMBEDDING_WEAK


def test_blank_query_returns_nothing(db_path):
    assert Matcher(db_path, ExplodingEmbedder(), cache_dir=None).match("   ") == []


def test_embedding_cache_is_written_and_reused(db_path, tmp_path):
    first = Matcher(db_path, BigramEmbedder(), cache_dir=tmp_path)
    first.match("zzz")
    assert len(list(tmp_path.glob("embeddings_*.npy"))) == 1
    second = Matcher(db_path, ExplodingEmbedder(), cache_dir=tmp_path)
    second._embeddings()                                    # loaded from disk, no encode call


# --- real BGE-M3 model: run with `pytest -m slow` -------------------------------------

@pytest.fixture(scope="module")
def real(db_path, tmp_path_factory):
    return Matcher(db_path, BGEEmbedder(), cache_dir=tmp_path_factory.mktemp("cache"))


@pytest.mark.slow
@pytest.mark.parametrize("query, expected", [
    ("หมูปิ้ง", "หมูปิ้ง"),
    ("ข้าวเหนียวหมูปิ้ง", "ข้าวเหนียวหมูปิ้ง"),
    ("cheese mashed potato with gravy sauce", "มันบดชีสราดเกรวี่"),
    ("boiled egg", "ไข่ต้ม"),
    ("ไข่ต้ม", "ไข่ต้ม"),
    ("แตงกวา", "แตงกวา"),
    ("grilled chicken salad", "สลัดอกไก่"),
    ("ไก่ย่างอก", "อกไก่ย่าง"),
])
def test_real_model_finds_the_right_food(real, query, expected):
    assert real.match(query)[0].name == expected


@pytest.mark.slow
def test_real_model_scores_nonsense_low(real):
    assert real.match("รถแทรกเตอร์")[0].confidence < EMBEDDING_WEAK + 0.1
