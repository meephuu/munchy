"""text -> parse -> match -> calculate. Shared by the CLI now and the FastAPI endpoint later."""
from pathlib import Path
from typing import Callable

from src import config
from src.matcher import Matcher, classify
from src.nutrition import Estimate, calculate
from src.parse_cache import cached_parse
from src.parser import ParsedItem


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
        candidates = matcher.match(item.food)
        status = classify(candidates)
        if status == "no_match":
            unmatched.append(item)
            continue
        top = candidates[0]
        if status == "uncertain":
            others = ", ".join(m.name for m in candidates[1:])
            warnings.append(f"uncertain match: '{item.food}' -> {top.name} ({top.confidence:.2f})"
                            + (f"; other candidates: {others}" if others else ""))
        pairs.append((item, top))

    est = calculate(pairs, db_path)
    est.unmatched = unmatched
    est.warnings = warnings + [
        f"no match found for '{i.food}': not counted, so the totals are incomplete"
        for i in unmatched]
    return est
