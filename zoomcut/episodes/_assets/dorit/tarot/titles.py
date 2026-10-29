# Cut each tarot card out of its mint sheet, then write its Hebrew title / number on the card (HTML -> transparent PNG).
#   .venv/Scripts/python episodes/_assets/dorit/tarot/titles.py      (then: node .../shoot.mjs)
import json, pathlib, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
here = pathlib.Path(__file__).parent
root = here.parents[3]
py = root / ".venv/Scripts/python.exe"

CARDS = {  # file: (top cartouche, bottom title, AI tag)
    "bibi-b": ("XI", "הצדק • נתניהו ♎", True),
    "gadi-a": ("IV", "מלך השוורים • גדי ♉", True),
    "bennett-b": ("IV", "הקיסר • בנט ♈", True),
    "lapid-b": ("XIII", "העקרב • לפיד ♏", True),
    "pundit": ("0", "השוטה • הפרשן", False),
    "conjunction": ("XVII", "הצמידות ♄ + ♆", False),
    "venus": ("℞", "נוגה בנסיגה", False),
    "farewell": ("VI", "שש החרבות • פרידה", False),
    "clash": ("VII", "המרכבה • התנגשות", False),
    "tower": ("XVI", "המגדל • ממשלה", False),
    "wheel": ("X", "גלגל המזל", False),
    "israel": ("♉", "ישראל • 14.5.1948", False),
    "sevenswords": ("7", "שבע החרבות", False),
    "fourcups": ("4", "ארבעה גביעים", False),
}
(here / "cut").mkdir(exist_ok=True)
(here / "html").mkdir(exist_ok=True)
jobs = []
for k, (num, title, ai) in CARDS.items():
    cut = here / "cut" / f"{k}.png"
    w, h = json.loads(subprocess.check_output([str(py), str(root / "tools/cutout_logo.py"), str(here / f"{k}.jpg"), str(cut)]).decode().replace("(", "[").replace(")", "]"))
    tag = '<div class="ai">תמונת AI</div>' if ai else ""
    html = f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@900&family=Heebo:wght@700&display=swap" rel="stylesheet">
<style>html,body{{margin:0;width:{w}px;height:{h}px;background:transparent;overflow:hidden}}
img{{position:absolute;inset:0;width:{w}px;height:{h}px}}
.t{{position:absolute;left:{w*0.095:.0f}px;right:{w*0.095:.0f}px;top:{h*0.885:.0f}px;height:{h*0.073:.0f}px;background:#f4ebd0;border:3px solid #3b2a1a;
border-radius:6px;display:flex;align-items:center;justify-content:center;font:900 {h*0.042:.0f}px 'Frank Ruhl Libre',serif;color:#2a1a0e;white-space:nowrap}}
.n{{position:absolute;left:{w*0.38:.0f}px;right:{w*0.38:.0f}px;top:{h*0.012:.0f}px;height:{h*0.036:.0f}px;background:#f4ebd0;border:3px solid #3b2a1a;
border-radius:6px;display:flex;align-items:center;justify-content:center;font:900 {h*0.028:.0f}px 'Frank Ruhl Libre',serif;color:#2a1a0e;direction:ltr}}
.ai{{position:absolute;left:{w*0.08:.0f}px;top:{h*0.065:.0f}px;font:700 {h*0.018:.0f}px Heebo;color:#fff;background:rgba(0,0,0,.55);padding:2px 10px;border-radius:5px}}
</style></head><body><img src="../cut/{k}.png"><div class="n">{num}</div><div class="t">{title}</div>{tag}</body></html>"""
    (here / "html" / f"{k}.html").write_text(html, encoding="utf-8")
    jobs.append({"html": str(here / "html" / f"{k}.html"), "out": str(here / "final" / f"{k}.png"), "w": w, "h": h})
(here / "final").mkdir(exist_ok=True)
(here / "jobs.json").write_text(json.dumps(jobs), encoding="utf-8")
print(len(jobs), "cards ready to shoot")
