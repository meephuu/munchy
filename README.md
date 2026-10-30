# Munchy

Estimate calories and macros from a dish name plus a bit of detail.

```
ข้าวเหนียวหมูปิ้ง 5 ไม้                       -> kcal, protein, fat, carbs
สลัดอกไก่ ใส่แตงกวา มะเขือเทศ ไข่ต้ม 1 ฟอง
cheese mashed potato with gravy sauce
```

## Pipeline
text -> **parser** (items + qty + unit) -> **matcher** (food DB entry) -> **nutrition** (grams -> totals)

## Setup (Windows)
```powershell
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python check_setup.py
```

## Layout
```
data/        raw + processed nutrition data, foods.db
src/
  config.py    settings from .env
  db.py        schema + seed data
  parser.py    text -> structured items
  matcher.py   food name -> DB entry
  nutrition.py portions -> totals
cli.py       command-line entry point
tests/
```
