"""text -> parse -> match -> calculate. Shared by the CLI now and the FastAPI endpoint later."""
from pathlib import Path
from typing import Callable

from src import config
from src.matcher import Match, Matcher, classify
from src.nutrition import Estimate, calculate
from src.parse_cache import cached_parse
from src.parser import ParsedItem


_RANK = {"ok": 2, "uncertain": 1, "no_match": 0}


def _best_candidates(matcher: Matcher, item: ParsedItem) -> tuple[list[Match], str]:
    """Match the name as written; if that is not a clean match, also try the English name
    the parser gave and keep whichever result is better (status first, then confidence)."""
    best = matcher.match(item.food)
    status = classify(best)
    if status != "ok" and item.food_en and item.food_en != item.food:
        alt = matcher.match(item.food_en)
        alt_status = classify(alt)
        top = lambda c: c[0].confidence if c else 0.0
        if (_RANK[alt_status], top(alt)) > (_RANK[status], top(best)):
            return alt, alt_status
    return best, status


def estimate(text: str, *, parse_fn: Callable[[str], list[ParsedItem]] | None = None,
             matcher: Matcher | None = None, db_path: Path = config.DB_PATH,
             use_cache: bool = True) -> Estimate:
    """Run the whole pipeline. parse_fn / matcher can be injected (tests, or a long-lived
    server that wants to load the embedding model only once). By default the LLM parse
    goes through the parse cache; use_cache=False always calls the LLM.

    Weak matches are never hidden: 'uncertain' ones are counted but warned about, and
    'no_match' items are left out of the totals with a warning that the totals are partial.
    """
    items = parse_fn(text) if parse_fn else cached_parse(text, use_cache=use_cache)
    matcher = matcher or Matcher(db_path)
    pairs, warnings, unmatched = [], [], []
    for item in items:
        candidates, status = _best_candidates(matcher, item)
        if status == "no_match":
            unmatched.append(item)
            continue
        top = candidates[0]
        if status == "uncertain":
            others = ", ".join(m.name for m in candidates[1:])
            warnings.append(f"uncertain match: '{item.label}' -> {top.name} ({top.confidence:.2f})"
                            + (f"; other candidates: {others}" if others else ""))
        pairs.append((item, top))

    est = calculate(pairs, db_path)
    est.unmatched = unmatched
    est.warnings = warnings + [
        f"no match found for '{i.label}': not counted, so the totals are incomplete"
        for i in unmatched]
    return est
