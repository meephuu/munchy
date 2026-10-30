"""Loads settings from .env so every module reads config from one place."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
DB_PATH = ROOT / os.getenv("DB_PATH", "data/foods.db")
CACHE_PATH = ROOT / os.getenv("CACHE_PATH", "data/cache.db")
