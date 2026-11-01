"""Small text helpers shared by the matcher and the parse cache."""
import re


def normalize(text: str) -> str:
    """Trim, collapse whitespace and case-fold, so trivially different spellings compare equal."""
    return re.sub(r"\s+", " ", text.strip().casefold())
