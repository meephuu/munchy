"""The three reference inputs, end to end (parser faked unless marked live)."""
import pytest

from cli import format_estimate, main
from src import config
from src.db import seed_db
from src.matcher import BGEEmbedder, Matcher
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


# --- CLI ------------------------------------------------------------------------------

def test_cli_prints_breakdown_totals_and_assumptions(run, capsys):
    assert main([I1], estimate_fn=run) == 0
    out = capsys.readouterr().out
    assert "ข้าวเหนียวหมูปิ้ง 5 ไม้" in out
    assert "หมูปิ้ง [ข้าวเหนียวหมูปิ้ง]: 150 g" in out
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
