"""Run this after installing dependencies to confirm the environment works."""
import importlib
import sys

PACKAGES = ["pydantic", "dotenv", "sentence_transformers", "numpy", "rapidfuzz", "pandas", "pytest"]

print(f"Python {sys.version.split()[0]}")
if sys.version_info < (3, 10):
    print("  ! Python 3.10+ recommended")

ok = True
for name in PACKAGES:
    try:
        mod = importlib.import_module(name)
        print(f"  OK  {name} {getattr(mod, '__version__', '')}")
    except ImportError as e:
        ok = False
        print(f"  MISSING  {name} ({e})")

from src import config  # noqa: E402

print(f"  .env loaded, DB path: {config.DB_PATH}")
print("\nAll good - ready for step 2." if ok else "\nFix the missing packages above, then re-run.")
