"""text -> parse -> match -> calculate. Shared by the CLI now and the FastAPI endpoint later."""
from pathlib import Path
from typing import Callable

from src import config, parser
from src.matcher import Matcher
from src.nutrition import Estimate, calculate
from src.parser import ParsedItem


def estimate(text: str, *, parse_fn: Callable[[str], list[ParsedItem]] | None = None,
             matcher: Matcher | None = None, db_path: Path = config.DB_PATH) -> Estimate:
    """Run the whole pipeline. parse_fn / matcher can be injected (tests, or a long-lived
    server that wants to load the embedding model only once)."""
    items = (parse_fn or parser.parse)(text)
    matcher = matcher or Matcher(db_path)
    pairs = []
    for item in items:
        candidates = matcher.match(item.food)
        if candidates:                  # weak/unknown matches are flagged in step 9
            pairs.append((item, candidates[0]))
    return calculate(pairs, db_path)
