# dorit-1 as a LIVE: the live screen (top bar, pinned comment, bottom bar - one transparent 1080x1920 picture per viewer
# count), the viewers' comments and the heart bursts. HTML shot with headless Chrome (tarot/shoot.mjs).
#   .venv/Scripts/python episodes/_assets/dorit/live/make.py && node episodes/_assets/dorit/tarot/shoot.mjs episodes/_assets/dorit/live/jobs.json
import json, pathlib, sys
sys.stdout.reconfigure(encoding="utf-8")
here = pathlib.Path(__file__).parent
SELFIE = (here.parent / "selfie.jpg").as_uri()
FONTS = '<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@500;700;800;900&display=swap" rel="stylesheet">'
jobs = []


def page(name, w, h, body, css):
    (here / "html").mkdir(exist_ok=True)
    f = here / "html" / f"{name}.html"
    f.write_text(f'<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">{FONTS}<style>html,body{{margin:0;width:{w}px;height:{h}px;'
                 f'background:transparent;overflow:hidden;font-family:Heebo}}*{{box-sizing:border-box}}{css}</style></head><body>{body}</body></html>',
                 encoding="utf-8")
    jobs.append({"html": str(f), "out": str(here / f"{name}.png"), "w": w, "h": h})


SCREEN = """
.top{position:absolute;top:250px;right:28px;left:28px;height:84px;display:flex;align-items:center;gap:12px}
.host{display:flex;align-items:center;gap:12px;background:rgba(0,0,0,.42);border-radius:42px;padding:6px 6px 6px 18px;height:84px}
.host img{width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #ff2e88}
.host .n{color:#fff;font:800 30px Heebo;line-height:1.05}.host .n small{display:block;font:500 22px Heebo;color:#ffd6f3}
.host .f{background:#ff2e88;color:#fff;font:800 26px Heebo;border-radius:30px;padding:10px 18px;margin-right:6px}
.live{background:#ff1744;color:#fff;font:900 28px Heebo;border-radius:10px;padding:8px 14px;letter-spacing:1px}
.sp{flex:1}
.view{background:rgba(0,0,0,.42);color:#fff;font:700 28px Heebo;border-radius:30px;padding:12px 20px;direction:ltr}
.x{color:#fff;font:500 46px Heebo;width:56px;text-align:center}
.pin{position:absolute;top:350px;right:28px;max-width:760px;background:rgba(0,0,0,.5);border-radius:22px;padding:14px 22px;color:#fff;font:700 28px Heebo;line-height:1.3}
.pin b{color:#ffd54a}
.bot{position:absolute;top:1540px;left:28px;right:28px;height:84px;display:flex;align-items:center;gap:18px}
.in{flex:1;height:76px;border-radius:40px;background:rgba(0,0,0,.42);color:rgba(255,255,255,.75);font:500 30px Heebo;display:flex;align-items:center;padding:0 30px}
.ic{width:76px;height:76px;border-radius:50%;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-size:40px}
"""
for k, n in enumerate(("1,204", "2,317", "3,862")):
    page(f"screen{k + 1}", 1080, 1920,
         f'<div class="top"><div class="host"><img src="{SELFIE}"><div class="n">דורית מרקורי<small>🔮 אסטרולוגית בכירה</small></div><div class="f">+ עקבו</div></div>'
         f'<div class="live">LIVE</div><div class="sp"></div><div class="view">👁 {n}</div><div class="x">×</div></div>'
         '<div class="pin">📌 <b>דורית מרקורי:</b> מפת לידה אישית + הספר שלי בחינם 👈 הלינק בביו</div>'
         '<div class="bot"><div class="in">הוסיפו תגובה...</div><div class="ic">🎁</div><div class="ic">❤️</div><div class="ic">↗️</div></div>', SCREEN)

COMMENT = """
.c{position:absolute;top:10px;right:10px;display:flex;align-items:flex-start;gap:14px;background:rgba(0,0,0,.45);border-radius:26px;padding:12px 18px 14px 26px;max-width:740px}
.a{flex:none;width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font:900 30px Heebo}
.u{color:#ffd6f3;font:800 25px Heebo}.t{color:#fff;font:700 33px Heebo;line-height:1.2}
"""
COMMENTS = [("שרית_מרעננה", "ש", "#e91e63", "❤️❤️❤️ דורית מלכה!!"),
            ("אבי.כהן", "א", "#3f51b5", "מה זה צמידות?? 😳"),
            ("מיכל 🌸", "מ", "#9c27b0", "רגע... גדי זה מזל?? 😂"),
            ("רונן_ת", "ר", "#009688", "ומה עם ליברמן??? 🤔"),
            ("לימור", "ל", "#ff9800", "תעשי לי קלף!! אני עקרב ♏"),
            ("אורנה מרמת השרון", "א", "#795548", "אמרת את זה בפברואר!! יש הקלטה 👏")]
for k, (u, i, col, t) in enumerate(COMMENTS):
    page(f"comment{k + 1}", 780, 150, f'<div class="c"><div class="a" style="background:{col}">{i}</div><div><div class="u">{u}</div><div class="t">{t}</div></div></div>', COMMENT)

HEARTS = ".h{position:absolute;font-size:var(--s);line-height:1}"
for k, hs in enumerate(([("❤️", 70, 60, 330), ("💖", 52, 10, 220), ("💜", 60, 80, 120), ("🧡", 44, 30, 20)],
                        [("💖", 66, 40, 320), ("❤️", 54, 90, 200), ("💛", 46, 20, 110), ("❤️", 58, 70, 10)],
                        [("💜", 64, 20, 330), ("❤️", 72, 70, 210), ("💖", 48, 30, 100), ("💙", 50, 90, 15)])):
    page(f"hearts{k + 1}", 200, 420, "".join(f'<div class="h" style="--s:{s}px;left:{x}px;top:{y}px">{e}</div>' for e, s, x, y in hs), HEARTS)

(here / "jobs.json").write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")
print(len(jobs), "pages")
