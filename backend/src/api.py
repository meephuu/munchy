"""Step 14: HTTP API around the pipeline.

Run:  uvicorn src.api:app --reload      (docs at http://127.0.0.1:8000/docs)
The future Next.js frontend calls POST /estimate. The embedding model is loaded once at
startup and shared by all requests.
"""
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai import errors as genai_errors
from pydantic import BaseModel, Field, field_validator

from src import config
from src.matcher import Matcher
from src.nutrition import CalcError, Estimate
from src.parser import ParseError
from src.pipeline import estimate as run_pipeline

Estimator = Callable[[str, bool], Estimate]


class EstimateRequest(BaseModel):
    text: str = Field(description="Dish and details, Thai or English, e.g. 'ข้าวเหนียวหมูปิ้ง 5 ไม้'",
                      max_length=500)
    use_cache: bool = Field(default=True, description="Reuse a cached LLM parse of the same text")

    @field_validator("text")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be empty")
        return v


class Totals(BaseModel):
    kcal: float
    protein_g: float
    fat_g: float
    carbs_g: float


class LineOut(Totals):
    name: str
    grams: float
    from_input: str
    part_of: str | None = Field(description="Combo dish this line is a component of, if any")
    assumptions: list[str]


class MatchOut(BaseModel):
    input: str
    input_en: str | None = Field(description="English name of the input, if the parser gave one")
    implied_for: str | None = Field(description="Dish this item was added for when it was not in the input")
    qty: float | None
    unit: str | None
    matched_food: str
    method: str = Field(description="exact | embedding | fuzzy")
    confidence: float


class EstimateOut(BaseModel):
    input: str
    totals: Totals
    lines: list[LineOut]
    matches: list[MatchOut]
    assumptions: list[str]
    warnings: list[str]
    unmatched: list[str] = Field(description="Inputs left out of the totals (no usable match)")
    complete: bool = Field(description="False if any input was left out, i.e. totals are partial")


def _r(x: float) -> float:
    return round(x, 1)


def to_response(text: str, est: Estimate) -> EstimateOut:
    return EstimateOut(
        input=text,
        totals=Totals(kcal=_r(est.kcal), protein_g=_r(est.protein), fat_g=_r(est.fat), carbs_g=_r(est.carbs)),
        lines=[LineOut(name=l.name, grams=_r(l.grams), kcal=_r(l.kcal), protein_g=_r(l.protein),
                       fat_g=_r(l.fat), carbs_g=_r(l.carbs), from_input=l.item_text,
                       part_of=l.via_combo, assumptions=l.assumptions) for l in est.lines],
        matches=[MatchOut(input=i.food, input_en=i.food_en, implied_for=i.implied_for, qty=i.qty, unit=i.unit, matched_food=m.name,
                          method=m.method, confidence=m.confidence) for i, m in est.matches],
        assumptions=est.assumptions,
        warnings=est.warnings,
        unmatched=[i.label for i in est.unmatched],
        complete=not est.unmatched,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the embedding model once, before the first request needs it.
    matcher = Matcher(config.DB_PATH)
    matcher._embeddings()
    app.state.matcher = matcher
    yield


app = FastAPI(title="Munchy", version="0.1.0", lifespan=lifespan,
              description="Estimate calories and macros from a free-text meal description.")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["GET", "POST"],
                   allow_headers=["*"])


def get_estimator() -> Estimator:
    """Dependency so tests can swap the pipeline for a fake."""
    def estimator(text: str, use_cache: bool) -> Estimate:
        return run_pipeline(text, matcher=app.state.matcher, db_path=config.DB_PATH,
                            use_cache=use_cache)
    return estimator


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/estimate", response_model=EstimateOut)
def estimate(req: EstimateRequest, estimator: Estimator = Depends(get_estimator)) -> EstimateOut:
    try:
        est = estimator(req.text, req.use_cache)
    except ParseError as e:
        raise HTTPException(422, f"Could not understand the input: {e}") from e
    except CalcError as e:
        raise HTTPException(500, f"Could not calculate: {e}") from e
    except genai_errors.APIError as e:
        raise HTTPException(502, "The language-model service failed; try again shortly.") from e
    except RuntimeError as e:                       # e.g. missing API key: a server setup problem
        raise HTTPException(503, f"Service not configured: {e}") from e
    return to_response(req.text, est)
