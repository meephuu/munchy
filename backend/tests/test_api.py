import pytest
from fastapi.testclient import TestClient
from google.genai import errors as genai_errors

from src.api import app, get_estimator
from src.db import seed_db
from src.matcher import Matcher
from src.nutrition import CalcError
from src.parser import ParsedItem, ParseError
from src.pipeline import estimate
from tests.test_matcher import ExplodingEmbedder
from tests.test_pipeline import I1, I2, PARSED, StubMatcher, candidate


@pytest.fixture(scope="module")
def db_path(tmp_path_factory):
    path = tmp_path_factory.mktemp("db") / "foods.db"
    seed_db(path)
    return path


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def use(estimator):
    app.dependency_overrides[get_estimator] = lambda: estimator


def real_pipeline(db_path, parsed=PARSED, matcher=None):
    """The real pipeline with a fake parser and an offline matcher."""
    matcher = matcher or Matcher(db_path, ExplodingEmbedder(), cache_dir=None)
    return lambda text, use_cache: estimate(text, parse_fn=lambda t: parsed[t], matcher=matcher,
                                            db_path=db_path)


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_estimate_returns_totals_lines_and_assumptions(client, db_path):
    use(real_pipeline(db_path))
    r = client.post("/estimate", json={"text": I1})
    assert r.status_code == 200
    body = r.json()
    assert body["totals"] == {"kcal": 527.1, "protein_g": 33.4, "fat_g": 25.9, "carbs_g": 40.8}
    assert [l["name"] for l in body["lines"]] == ["steamed sticky rice", "grilled pork skewer"]
    assert body["lines"][1]["grams"] == 150 and body["lines"][1]["part_of"] == "sticky rice with grilled pork skewers"
    assert body["matches"] == [{"input": "ข้าวเหนียวหมูปิ้ง", "input_en": None, "implied_for": None, "qty": 5, "unit": "ไม้",
                                "matched_food": "sticky rice with grilled pork skewers", "method": "exact", "confidence": 1.0}]
    assert any("sticky rice" in a for a in body["assumptions"])
    assert body["warnings"] == [] and body["unmatched"] == [] and body["complete"] is True


def test_each_line_carries_per_100g_values_that_rebuild_its_numbers(client, db_path):
    use(real_pipeline(db_path))
    body = client.post("/estimate", json={"text": I1}).json()
    pork = body["lines"][1]                                    # 150 g of grilled pork skewer
    assert pork["per_100g"] == {"kcal": 250.0, "protein_g": 20.0, "fat_g": 17.0, "carbs_g": 5.0}
    for line in body["lines"]:
        scale = line["grams"] / 100
        assert line["kcal"] == pytest.approx(line["per_100g"]["kcal"] * scale, abs=0.2)
        assert line["protein_g"] == pytest.approx(line["per_100g"]["protein_g"] * scale, abs=0.2)


def test_salad_with_extras(client, db_path):
    use(real_pipeline(db_path))
    body = client.post("/estimate", json={"text": I2}).json()
    assert body["totals"]["kcal"] == 397.8 and len(body["lines"]) == 6


def test_unmatched_item_gives_a_partial_but_successful_response(client, db_path):
    canned = {"เบียร์": [candidate(db_path, "เนย", 0.57)]}
    parsed = {"x": [ParsedItem(food="ข้าวสวย", qty=1, unit="จาน"), ParsedItem(food="เบียร์")]}
    use(real_pipeline(db_path, parsed, StubMatcher(db_path, canned)))
    r = client.post("/estimate", json={"text": "x"})
    assert r.status_code == 200
    body = r.json()
    assert body["complete"] is False and body["unmatched"] == ["เบียร์"]
    assert any("incomplete" in w for w in body["warnings"])
    assert [l["name"] for l in body["lines"]] == ["steamed white rice"]


def test_use_cache_flag_is_passed_through(client):
    seen = []

    def spy(text, use_cache):
        seen.append(use_cache)
        raise ParseError("stop here")

    use(spy)
    client.post("/estimate", json={"text": "x"})
    client.post("/estimate", json={"text": "x", "use_cache": False})
    assert seen == [True, False]


@pytest.mark.parametrize("payload", [{}, {"text": ""}, {"text": "   "}, {"text": "x" * 501},
                                     {"text": 5}])
def test_invalid_requests_are_rejected_before_the_pipeline_runs(client, payload):
    def boom(text, use_cache):
        raise AssertionError("pipeline must not run")

    use(boom)
    assert client.post("/estimate", json=payload).status_code == 422


@pytest.mark.parametrize("error, status", [
    (ParseError("bad output"), 422),
    (CalcError("no components"), 500),
    (RuntimeError("GEMINI_API_KEY is empty"), 503),
    (genai_errors.ServerError(503, {"error": {"message": "overloaded"}}), 502),
])
def test_pipeline_errors_map_to_http_statuses(client, error, status):
    def fail(text, use_cache):
        raise error

    use(fail)
    r = client.post("/estimate", json={"text": "x"})
    assert r.status_code == status and r.json()["detail"]


def test_api_errors_do_not_leak_provider_details(client):
    def fail(text, use_cache):
        raise genai_errors.ServerError(503, {"error": {"message": "secret internal detail"}})

    use(fail)
    assert "secret" not in client.post("/estimate", json={"text": "x"}).text


def test_cors_allows_the_frontend_origin_only(client):
    ok = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert ok.headers["access-control-allow-origin"] == "http://localhost:3000"
    other = client.get("/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in other.headers
