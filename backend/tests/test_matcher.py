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


# --- search() for a search box ----------------------------------------------------------

def test_search_finds_names_containing_the_query_shortest_first(db_path):
    m = Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
    hits = m.search("chick", semantic=False)
    names = [x.name for x in hits]
    assert "grilled chicken breast" in names and "boiled chicken breast" in names
    texts = [x.matched_text.lower() for x in hits]                 # the name or alias that matched
    assert all("chick" in t for t in texts)
    assert texts == sorted(texts, key=lambda t: (not t.startswith("chick"), len(t)))   # starts-with first, then short


def test_search_works_in_thai_too(db_path):
    m = Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
    assert "boiled egg" in [x.name for x in m.search("ไข่", semantic=False)]


def test_search_matches_word_prefixes_in_any_order(db_path):
    m = Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
    assert "grilled chicken breast" in [x.name for x in m.search("breast chick", semantic=False)]


def test_search_never_offers_a_combo_and_gives_one_entry_per_food(db_path):
    m = Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
    hits = m.search("sticky rice", semantic=False)
    assert all(x.kind != "combo" for x in hits)
    assert "steamed sticky rice" in [x.name for x in hits]
    assert len({x.food_id for x in hits}) == len(hits)


def test_search_needs_two_characters_and_respects_the_limit(db_path):
    m = Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
    assert m.search("e", semantic=False) == [] and m.search("   ", semantic=False) == []
    assert len(m.search("e", limit=3, semantic=False)) == 0
    assert len(m.search("ch", limit=3, semantic=False)) == 3


def test_search_tops_up_with_similar_foods_but_not_unrelated_ones(db_path):
    m = Matcher(db_path, BigramEmbedder(), cache_dir=None)
    hits = m.search("mashed potatos", limit=5)                      # typo: no name contains it
    assert hits and hits[0].name == "mashed potato" and hits[0].method == "embedding"
    assert m.search("zzzzqq", limit=5) == []                          # nothing is similar enough


def test_search_lexical_hits_come_before_embedding_hits_without_repeats(db_path):
    m = Matcher(db_path, BigramEmbedder(), cache_dir=None)
    hits = m.search("egg", limit=8)
    methods = [x.method for x in hits]
    assert methods == sorted(methods, key=lambda s: s != "lexical")
    assert len({x.food_id for x in hits}) == len(hits)


def test_search_puts_whole_word_matches_before_longer_words_that_merely_start_with_the_query(db_path, tmp_path):
    import shutil
    from contextlib import closing
    from src.db import connect
    path = tmp_path / "foods.db"
    shutil.copy(db_path, path)
    with closing(connect(path)) as conn, conn:
        for name in ("eggplant", "eggnog", "egg, hen, raw", "scrambled egg"):
            conn.execute("INSERT INTO foods (name_en, kcal_100g, protein_100g, fat_100g, carbs_100g, "
                         "default_serving_g, source) VALUES (?, 100, 1, 1, 1, 50, 'test')", (name,))
    names = [x.name for x in Matcher(path, ExplodingEmbedder(), cache_dir=None).search("egg", semantic=False)]
    whole = [names.index(n) for n in ("egg, hen, raw", "scrambled egg", "boiled egg")]
    longer = [names.index(n) for n in ("eggplant", "eggnog")]
    assert max(whole) < min(longer)
    assert names.index("egg, hen, raw") < names.index("scrambled egg")      # whole word at the start beats later


def test_search_ranks_an_exact_name_first(db_path):
    m = Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
    assert m.search("boiled egg", semantic=False)[0].name == "boiled egg"
