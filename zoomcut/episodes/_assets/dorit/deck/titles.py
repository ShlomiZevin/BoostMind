# "טארוט מרקורי" - Dorit's own printed deck: cut each card out, write her title / brand on it, and make the card back.
#   .venv/Scripts/python episodes/_assets/dorit/deck/titles.py && node episodes/_assets/dorit/tarot/shoot.mjs episodes/_assets/dorit/deck/jobs.json
import json, pathlib, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
here = pathlib.Path(__file__).parent
root = here.parents[3]
py = root / ".venv/Scripts/python.exe"
LOGO = (here.parent / "video/logo.png").as_uri()
FONTS = '<link href="https://fonts.googleapis.com/css2?family=Secular+One&family=Heebo:wght@500;800&display=swap" rel="stylesheet">'
CARDS = {"fourcups-b": ("fourcups", "ארבעה גביעים"), "sevenswords-b": ("sevenswords", "שבע החרבות"), "wheel-b": ("wheel", "גלגל המזל")}
for d in ("cut", "html", "final"):
    (here / d).mkdir(exist_ok=True)
jobs = []
for src, (name, title) in CARDS.items():
    cut = here / "cut" / f"{name}.png"
    w, h = json.loads(subprocess.check_output([str(py), str(root / "tools/cutout_logo.py"), str(here / f"{src}.jpg"), str(cut)]).decode().replace("(", "[").replace(")", "]"))
    html = f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">{FONTS}
<style>html,body{{margin:0;width:{w}px;height:{h}px;background:transparent;overflow:hidden}}
img.c{{position:absolute;inset:0;width:{w}px;height:{h}px}}
.t{{position:absolute;left:{w*0.2:.0f}px;right:{w*0.2:.0f}px;top:{h*0.872:.0f}px;height:{h*0.092:.0f}px;background:#fff3c4;border:4px solid #4a148c;border-radius:10px;
display:flex;align-items:center;justify-content:center;font:400 {h*0.04:.0f}px 'Secular One';color:#4a148c;white-space:nowrap}}
.n{{position:absolute;left:{w*0.3:.0f}px;right:{w*0.3:.0f}px;top:{h*0.012:.0f}px;height:{h*0.037:.0f}px;background:#fff3c4;border:3px solid #4a148c;border-radius:8px;
display:flex;align-items:center;justify-content:center;font:400 {h*0.024:.0f}px 'Secular One';color:#4a148c;white-space:nowrap}}
.l{{position:absolute;left:{w*0.045:.0f}px;bottom:{h*0.022:.0f}px;width:{w*0.12:.0f}px}}
.cp{{position:absolute;right:{w*0.06:.0f}px;bottom:{h*0.03:.0f}px;font:500 {h*0.011:.0f}px Heebo;color:#fff3c4}}
</style></head><body><img class="c" src="../cut/{name}.png"><div class="n">טארוט מרקורי</div><div class="t">{title}</div>
<img class="l" src="{LOGO}"><div class="cp">© ד. מרקורי</div></body></html>"""
    (here / "html" / f"{name}.html").write_text(html, encoding="utf-8")
    jobs.append({"html": str(here / "html" / f"{name}.html"), "out": str(here / "final" / f"{name}.png"), "w": w, "h": h, "scale": 1})
# the back of every card: same size as the fronts
w, h = 925, 1532
back = f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">{FONTS}
<style>html,body{{margin:0;width:{w}px;height:{h}px;background:transparent;overflow:hidden}}
.b{{position:absolute;inset:6px;border-radius:28px;background-color:#3a0b6b;border:14px solid #f2c230;
background-image:radial-gradient(circle,#ffde6b 0 3px,transparent 4px),radial-gradient(circle,#fff 0 2px,transparent 3px);background-size:90px 90px,60px 60px;background-position:0 0,30px 40px;
display:flex;flex-direction:column;align-items:center;justify-content:center}}
.b:before{{content:'';position:absolute;inset:24px;border:4px solid #f2c230;border-radius:16px}}
img{{width:560px}} .t{{font:400 104px 'Secular One';color:#ffde6b;margin-top:30px}} .s{{font:800 44px Heebo;color:#fff3c4;margin-top:6px}}
</style></head><body><div class="b"><img src="{LOGO}"><div class="t">טארוט מרקורי</div><div class="s">המהדורה המדעית</div></div></body></html>"""
(here / "html" / "back.html").write_text(back, encoding="utf-8")
jobs.append({"html": str(here / "html" / "back.html"), "out": str(here / "final" / "back.png"), "w": w, "h": h, "scale": 1})
(here / "jobs.json").write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")
print(len(jobs), "pages")
