"""text -> parse -> match -> calculate. Shared by the CLI now and the FastAPI endpoint later."""
from pathlib import Path
from typing import Callable

from src import config
from src.matcher import Match, Matcher, classify
from src.nutrition import Estimate, calculate
from src.parse_cache import cached_decompose, cached_parse
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


# A count in one of these units means "this many plates of the dish", so it scales every part
SERVING_WORDS = {"จาน", "ชาม", "ที่", "plate", "plates", "bowl", "bowls", "serving", "servings",
                 "portion", "portions"}


def _database_has_the_dish(candidates: list[Match], status: str) -> bool:
    """True if the DB knows this prepared dish well enough to use it as one item. A shaky
    embedding match, or a match to a single ingredient ('caesar salad' -> 'caesar dressing'),
    does not count: then the dish is rebuilt from the parser's typical parts instead."""
    if status == "no_match":
        return False
    top = candidates[0]
    return top.dish and (top.method != "embedding" or status == "ok")


def _worth_splitting(candidates: list[Match], status: str) -> bool:
    """Ask for typical parts unless the DB already has a clean answer: an exact/fuzzy hit on any
    food (the user named it as we have it), or a confident embedding hit on a whole dish."""
    if status != "no_match" and candidates[0].method != "embedding":
        return False
    return not _database_has_the_dish(candidates, status)


def _split_into_parts(item: ParsedItem) -> tuple[list[ParsedItem], list[str]]:
    """The parts of an unknown dish as items, plus any notes about what was not applied."""
    scale = item.qty if item.qty and (item.unit is None or item.unit.casefold() in SERVING_WORDS) else None
    notes = [f"no database entry for '{item.label}': estimated from its typical parts "
             f"({', '.join(item.components)})"]
    if (item.qty or item.unit) and scale is None:
        amount = " ".join(x for x in (f"{item.qty:g}" if item.qty else None, item.unit) if x)
        notes.append(f"the amount '{amount}' for '{item.label}' could not be split "
                     "over its parts, so each part uses a default serving")
    parts = [ParsedItem(food=c, food_en=c, qty=scale, implied_for=item.label) for c in item.components]
    return parts, notes


def estimate(text: str, *, parse_fn: Callable[[str], list[ParsedItem]] | None = None,
             matcher: Matcher | None = None, db_path: Path = config.DB_PATH,
             use_cache: bool = True,
             decompose_fn: Callable[[str], list[str]] | None = None) -> Estimate:
    """Run the whole pipeline. parse_fn / matcher can be injected (tests, or a long-lived
    server that wants to load the embedding model only once). By default the LLM parse
    goes through the parse cache; use_cache=False always calls the LLM.

    Weak matches are never hidden: 'uncertain' ones are counted but warned about, and
    'no_match' items are left out of the totals with a warning that the totals are partial.
    A dish the database does not know is replaced by its typical parts (a second, cached LLM
    call that only names foods, never amounts); every such part is reported as an assumption.
    decompose_fn defaults to that LLM call, but only when parse_fn is not injected, so tests
    that fake the parser never reach the network.
    """
    if decompose_fn is None and parse_fn is None:
        decompose_fn = lambda dish: cached_decompose(dish, use_cache=use_cache)
    items = parse_fn(text) if parse_fn else cached_parse(text, use_cache=use_cache)
    matcher = matcher or Matcher(db_path)
    matched: list[tuple[ParsedItem, Match, str, list[Match]]] = []   # item, top, status, candidates
    warnings, unmatched, notes = [], [], []

    queue = list(items)
    while queue:
        item = queue.pop(0)
        candidates, status = _best_candidates(matcher, item)
        if item.implied_for is None and _worth_splitting(candidates, status):
            if not item.components and decompose_fn is not None:
                try:
                    item = item.model_copy(update={"components": decompose_fn(item.label)})
                except Exception as e:      # quota, network, bad output: keep going without parts
                    warnings.append(f"could not look up the typical parts of '{item.label}': {e}")
        if item.components and _worth_splitting(candidates, status):
            parts, split_notes = _split_into_parts(item)
            queue = parts + queue                       # the parts are matched like any item
            notes += split_notes
            continue
        if status == "no_match":
            unmatched.append(item)
        else:
            matched.append((item, candidates[0], status, candidates))

    # What the user named beats a typical part, and a food is only counted once as a part.
    stated = {m.food_id for i, m, _, _ in matched if not i.implied_for}
    pairs, seen_parts = [], set()
    for item, top, status, candidates in matched:
        if item.implied_for:
            if top.food_id in stated or top.food_id in seen_parts:
                notes.append(f"did not add {top.name} as part of {item.implied_for}: "
                             "it is already in the meal")
                continue
            seen_parts.add(top.food_id)
        if status == "uncertain":
            others = ", ".join(m.name for m in candidates[1:])
            warnings.append(f"uncertain match: '{item.label}' -> {top.name} ({top.confidence:.2f})"
                            + (f"; other candidates: {others}" if others else ""))
        pairs.append((item, top))

    est = calculate(pairs, db_path)
    est.unmatched = unmatched
    est.notes += notes
    est.warnings = warnings + [
        f"no match found for '{i.label}': not counted, so the totals are incomplete"
        for i in unmatched]
    return est
