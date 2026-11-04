"""Loads settings from .env so every module reads config from one place."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
# Tried once when the main model is overloaded or rate-limited (503 / 429); blank = no fallback.
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-flash-lite-latest")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
DB_PATH = ROOT / os.getenv("DB_PATH", "data/foods.db")
CACHE_PATH = ROOT / os.getenv("CACHE_PATH", "data/cache.db")
# Origins allowed to call the API from a browser (the Next.js frontend), comma-separated.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
