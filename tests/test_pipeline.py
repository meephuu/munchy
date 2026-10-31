"""The three reference inputs, end to end (parser faked unless marked live)."""
from contextlib import closing

import pytest

from cli import format_estimate, main
from src import config
from src.db import connect, display_name, seed_db
from src.matcher import BGEEmbedder, Match, Matcher
from src.nutrition import CalcError
from src.parser import ParsedItem, ParseError
from src.pipeline import estimate
from tests.test_matcher import ExplodingEmbedder

I1 = "ข้าวเหนียวหมูปิ้ง 5 ไม้"
I2 = "สลัดอกไก่ ใส่แตงกวา มะเขือเทศ ไข่ต้ม 1 ฟอง"
I3 = "cheese mashed potato with gravy sauce"

# What Gemini returned for these inputs in the live parser tests.
PARSED = {
    I1: [ParsedItem(food="ข้าวเหนียวหมูปิ้ง", qty=5, unit="ไม้")],
    I2: [ParsedItem(food="สลัดอกไก่"), ParsedItem(food="แตงกวา"), ParsedItem(food="มะเขือเทศ"),
         ParsedItem(food="ไข่ต้ม", qty=1, unit="ฟอง")],
    I3: [ParsedItem(food="cheese mashed potato with gravy sauce")],
}


@pytest.fixture(scope="module")
def db_path(tmp_path_factory):
    path = tmp_path_factory.mktemp("db") / "foods.db"
    seed_db(path)
    return path


@pytest.fixture(scope="module")
def run(db_path):
    """estimate() with a fake parser and a matcher that proves exact matches need no model."""
    matcher = Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
    return lambda text: estimate(text, parse_fn=lambda t: PARSED[t], matcher=matcher, db_path=db_path)


def test_input1_total(run):
    est = run(I1)
    assert est.kcal == pytest.approx(527.1)
    assert est.protein == pytest.approx(33.42)
    assert est.fat == pytest.approx(25.86)
    assert est.carbs == pytest.approx(40.8)
    assert any("sticky rice" in a for a in est.assumptions)


def test_input2_total(run):
    est = run(I2)
    assert est.kcal == pytest.approx(397.8)
    assert len(est.lines) == 6
    assert any("default dressing" in a for a in est.assumptions)


def test_input3_total(run):
    est = run(I3)
    assert est.kcal == pytest.approx(265.1)
    assert len(est.assumptions) == 3


# --- weak matches (step 9) ------------------------------------------------------------

class StubMatcher:
    """Returns canned candidates so the pipeline's handling of each status is tested."""

    def __init__(self, db_path, canned):
        self._real = Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
        self._canned = canned

    def match(self, query, top_k=3):
        return self._canned.get(query) or self._real.match(query, top_k)


def candidate(db_path, name, conf, method="embedding"):
    return Match(*_food(db_path, name), conf, method, name)


def _food(db_path, name):
    with closing(connect(db_path)) as conn:
        r = conn.execute("SELECT * FROM foods WHERE name_th = ?", (name,)).fetchone()
    return r["id"], display_name(r), r["kind"]


def run_with(db_path, canned, items):
    return estimate("x", parse_fn=lambda t: items, matcher=StubMatcher(db_path, canned),
                    db_path=db_path)


def test_unmatched_item_is_left_out_and_reported(db_path):
    canned = {"เบียร์": [candidate(db_path, "เนย", 0.57), candidate(db_path, "นมสด", 0.57)]}
    est = run_with(db_path, canned, [ParsedItem(food="ข้าวสวย", qty=1, unit="จาน"),
                                     ParsedItem(food="เบียร์")])
    assert [l.name for l in est.lines] == ["steamed white rice"]          # butter is NOT counted
    assert [i.food for i in est.unmatched] == ["เบียร์"]
    assert any("เบียร์" in w and "incomplete" in w for w in est.warnings)


def test_uncertain_item_is_counted_with_a_warning_listing_alternatives(db_path):
    canned = {"ไข่ตม": [candidate(db_path, "ไข่ต้ม", 0.71), candidate(db_path, "ไข่ดาว", 0.67),
                        candidate(db_path, "ไข่เจียว", 0.61)]}
    est = run_with(db_path, canned, [ParsedItem(food="ไข่ตม", qty=1, unit="ฟอง")])
    assert [l.name for l in est.lines] == ["boiled egg"]
    assert est.unmatched == []
    [warning] = est.warnings
    assert "ไข่ตม" in warning and "0.71" in warning and "fried egg" in warning


def test_confident_matches_produce_no_warnings(run):
    assert run(I1).warnings == [] and run(I2).warnings == [] and run(I3).warnings == []


# --- CLI ------------------------------------------------------------------------------

def test_cli_prints_warnings_section(db_path, capsys):
    canned = {"ไข่ตม": [candidate(db_path, "ไข่ต้ม", 0.71), candidate(db_path, "ไข่ดาว", 0.67)]}
    est = run_with(db_path, canned, [ParsedItem(food="ไข่ตม")])
    assert main(["x"], estimate_fn=lambda t: est) == 0
    out = capsys.readouterr().out
    assert "Warnings" in out and "! uncertain match: 'ไข่ตม'" in out


def test_cli_exits_1_when_nothing_matches(db_path, capsys):
    canned = {"เบียร์": [candidate(db_path, "เนย", 0.57)]}
    est = run_with(db_path, canned, [ParsedItem(food="เบียร์")])
    assert main(["เบียร์"], estimate_fn=lambda t: est) == 1
    captured = capsys.readouterr()
    assert captured.out == "" and "Nothing could be matched" in captured.err

def test_cli_prints_breakdown_totals_and_assumptions(run, capsys):
    assert main([I1], estimate_fn=run) == 0
    out = capsys.readouterr().out
    assert "ข้าวเหนียวหมูปิ้ง 5 ไม้" in out
    assert "grilled pork skewer [sticky rice with grilled pork skewers]: 150 g" in out
    assert "Total: 527 kcal" in out
    assert "Assumptions" in out and "sticky rice" in out


def test_cli_joins_unquoted_words(run, capsys):
    assert main(["cheese", "mashed", "potato", "with", "gravy", "sauce"], estimate_fn=run) == 0
    assert "Total: 265 kcal" in capsys.readouterr().out


@pytest.mark.parametrize("error", [ParseError("bad json"), CalcError("no components"),
                                   RuntimeError("GEMINI_API_KEY is empty")])
def test_cli_reports_errors_without_traceback(error, capsys):
    def boom(text):
        raise error

    assert main(["x"], estimate_fn=boom) == 1
    captured = capsys.readouterr()
    assert captured.out == "" and str(error) in captured.err


def test_cli_tells_you_to_seed_when_db_is_missing(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "missing.db")
    assert main(["x"]) == 1
    assert "python -m src.db --seed" in capsys.readouterr().err


# --- real Gemini end to end: run with `pytest -m live` --------------------------------

@pytest.mark.live
@pytest.mark.skipif(not config.GEMINI_API_KEY, reason="no GEMINI_API_KEY in .env")
@pytest.mark.parametrize("text, kcal", [(I1, 527.1), (I2, 397.8), (I3, 265.1)])
def test_live_full_pipeline(db_path, tmp_path, text, kcal):
    est = estimate(text, matcher=Matcher(db_path, BGEEmbedder(), cache_dir=tmp_path),
                   db_path=db_path)
    assert est.kcal == pytest.approx(kcal)


# --- English names --------------------------------------------------------------------

def test_warnings_use_the_english_name_when_the_parser_gave_one(db_path):
    canned = {"เบียร์": [candidate(db_path, "เนย", 0.57)], "beer": [candidate(db_path, "เนย", 0.57)]}
    est = run_with(db_path, canned, [ParsedItem(food="เบียร์", food_en="beer")])
    assert any("'beer'" in w and "incomplete" in w for w in est.warnings)


def test_english_name_is_tried_when_the_original_does_not_match_cleanly(db_path):
    canned = {"ไข่ตม": [candidate(db_path, "ไข่ดาว", 0.60)],
              "boiled egg": [candidate(db_path, "ไข่ต้ม", 1.0, method="exact")]}
    est = run_with(db_path, canned, [ParsedItem(food="ไข่ตม", food_en="boiled egg", qty=1, unit="ฟอง")])
    assert [l.name for l in est.lines] == ["boiled egg"] and est.warnings == []


def test_english_name_does_not_override_a_clean_match(db_path):
    canned = {"ไข่ต้ม": [candidate(db_path, "ไข่ต้ม", 1.0, method="exact")],
              "egg": [candidate(db_path, "ไข่ดาว", 1.0, method="exact")]}
    est = run_with(db_path, canned, [ParsedItem(food="ไข่ต้ม", food_en="egg")])
    assert [l.name for l in est.lines] == ["boiled egg"]
