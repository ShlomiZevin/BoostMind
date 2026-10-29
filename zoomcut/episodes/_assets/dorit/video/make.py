# Dorit's graphics for dorit-1, as HTML pages shot with headless Chrome (one browser, in turn):
#   .venv/Scripts/python episodes/_assets/dorit/video/make.py && node episodes/_assets/dorit/tarot/shoot.mjs episodes/_assets/dorit/video/jobs.json
# Her own look: purple + gold + hot pink, Secular One / Suez One, marker handwriting (Amatic SC), tarot cards, post-its.
import json, math, pathlib, sys
sys.stdout.reconfigure(encoding="utf-8")
here = pathlib.Path(__file__).parent
A = here.parent.as_posix()
STORY_DIR = pathlib.Path(r"C:\Users\shazbak\Downloads\דורית-בחירות")
FONTS = ('<link href="https://fonts.googleapis.com/css2?family=Secular+One&family=Suez+One&family=Amatic+SC:wght@700'
         '&family=Frank+Ruhl+Libre:wght@900&family=Heebo:wght@500;800;900&family=Rubik:wght@900&display=swap" rel="stylesheet">')
STARS = ("background-color:#2a0b45;background-image:radial-gradient(circle at 20% 30%,rgba(255,215,90,.9) 0 2px,transparent 3px),"
         "radial-gradient(circle at 70% 60%,rgba(255,255,255,.8) 0 1.5px,transparent 2.5px),radial-gradient(circle at 45% 80%,rgba(255,215,90,.7) 0 2px,transparent 3px);"
         "background-size:140px 140px,90px 90px,200px 200px;")
jobs = []


def page(name, w, h, body, css, out=None, bg="transparent"):
    html = (f'<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">{FONTS}<style>'
            f'html,body{{margin:0;width:{w}px;height:{h}px;background:{bg};overflow:hidden}}*{{box-sizing:border-box}}{css}</style></head>'
            f'<body>{body}</body></html>')
    (here / "html").mkdir(exist_ok=True)
    f = here / "html" / f"{name}.html"
    f.write_text(html, encoding="utf-8")
    jobs.append({"html": str(f), "out": str(out or here / f"{name}.png"), "w": w, "h": h})


# 1. the wall map - this video's chart on the board of her studio (behind her). 2x of the board (553x480 on the frame)
W, H = 1106, 960
cx, cy, R = 553, 520, 360
sect = []
for i in range(12):  # house i+1 spans 180+30i .. 210+30i degrees (counter-clockwise, y up); house 10 = top-left of the top
    a0 = math.radians(180 + 30 * i)
    x1, y1 = cx + R * math.cos(a0), cy - R * math.sin(a0)
    sect.append(f'<line x1="{cx}" y1="{cy}" x2="{x1:.0f}" y2="{y1:.0f}" stroke="#333" stroke-width="2"/>')
    am = math.radians(195 + 30 * i)
    tx, ty = cx + (R - 40) * math.cos(am), cy - (R - 40) * math.sin(am)
    sect.append(f'<text x="{tx:.0f}" y="{ty + 10:.0f}" font-size="30" text-anchor="middle" fill="#555" font-family="Heebo">{i + 1}</text>')
h10 = [math.radians(a) for a in (90, 120)]
wedge = (f'M{cx},{cy} L{cx + R * math.cos(h10[0]):.0f},{cy - R * math.sin(h10[0]):.0f} '
         f'A{R},{R} 0 0,0 {cx + R * math.cos(h10[1]):.0f},{cy - R * math.sin(h10[1]):.0f} Z')
glyph = lambda a, r, s, size=54, color="#1a1a6e": (f'<text x="{cx + r * math.cos(math.radians(a)):.0f}" y="{cy - r * math.sin(math.radians(a)) + size * .35:.0f}" '
                                                   f'font-size="{size}" text-anchor="middle" fill="{color}" font-family="Segoe UI Symbol">{s}</text>')
svg = (f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
       f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="#fffdf6" stroke="#222" stroke-width="4"/>'
       f'<path d="{wedge}" fill="rgba(255,60,60,.18)"/>'
       f'<circle cx="{cx}" cy="{cy}" r="{R - 80}" fill="none" stroke="#222" stroke-width="2"/>'
       f'<circle cx="{cx}" cy="{cy}" r="110" fill="#fffdf6" stroke="#222" stroke-width="2"/>' + "".join(sect) +
       glyph(100, 200, "♄") + glyph(110, 205, "♆", 54, "#0b5cad") + glyph(45, 200, "♀", 50, "#c2185b") +
       glyph(52, 150, "℞", 34, "#c2185b") + glyph(210, 200, "♉", 50, "#7a4b00") + glyph(330, 200, "♑", 50, "#2e7d32") +
       glyph(270, 210, "♈", 44, "#b71c1c") + glyph(250, 200, "♏", 44, "#4a148c") +
       # her red marker on top
       f'<ellipse cx="{cx - 40}" cy="{cy - 205}" rx="95" ry="70" fill="none" stroke="#e00" stroke-width="9" transform="rotate(-8 {cx - 40} {cy - 205})"/>'
       f'<ellipse cx="{cx - 36}" cy="{cy - 202}" rx="105" ry="76" fill="none" stroke="#e00" stroke-width="5" transform="rotate(-4 {cx - 36} {cy - 202})"/>'
       f'<path d="M{cx + 330},{cy - 360} C{cx + 230},{cy - 330} {cx + 150},{cy - 290} {cx + 75},{cy - 230}" fill="none" stroke="#e00" stroke-width="8"/>'
       f'<path d="M{cx + 75},{cy - 230} l30,-2 M{cx + 75},{cy - 230} l8,-28" stroke="#e00" stroke-width="8"/>'
       f'<path d="M{cx + 180},{cy - 120} q30,20 70,10" fill="none" stroke="#e00" stroke-width="6"/>'
       f'<line x1="{cx - 230}" y1="{cy + 60}" x2="{cx - 150}" y2="{cy + 140}" stroke="#e00" stroke-width="8"/>'
       f'<line x1="{cx - 150}" y1="{cy + 60}" x2="{cx - 230}" y2="{cy + 140}" stroke="#e00" stroke-width="8"/>'
       '</svg>')
page("wallmap", W, H,
     f'<div class="b">{svg}<div class="t">מפת השמיים – בחירות 2026</div>'
     '<div class="m m1">בית השלטון!!!</div><div class="m m2">בית 8 = סוף</div><div class="m m3">שור ⚡ גדי</div>'
     '<div class="m m4">טלה + עקרב = ✗</div><div class="sig">© כל הזכויות שמורות לדורית מרקורי. אין להעתיק!</div></div>',
     ".b{position:absolute;inset:0;background:#f8f6ef}svg{position:absolute;inset:0}"
     ".t{position:absolute;top:10px;left:0;right:0;text-align:center;font:900 64px 'Secular One';color:#4a148c}"
     ".m{position:absolute;font:700 60px 'Amatic SC';color:#e00;white-space:nowrap}"
     ".m1{top:105px;right:30px;transform:rotate(-6deg)}.m2{top:420px;right:20px;transform:rotate(4deg);font-size:54px}"
     ".m3{bottom:120px;left:30px;color:#1a1a6e;font-size:52px}.m4{bottom:70px;right:40px;font-size:52px}"
     ".sig{position:absolute;bottom:12px;left:0;right:0;text-align:center;font:500 22px Heebo;color:#666}",
     bg="#f8f6ef")

# 2. stamps / badges (her own "effort")
page("rare", 760, 560,
     '<div class="s"><div class="a">אירוע נדיר!!!</div><div class="b">פעם במאות שנים*</div></div><div class="f">*בערך כל 36 שנה</div>',
     ".s{position:absolute;left:30px;top:20px;width:700px;height:440px;background:#ffd400;clip-path:polygon(50% 0,61% 13%,77% 4%,80% 21%,98% 22%,90% 38%,100% 52%,88% 63%,94% 81%,76% 80%,68% 98%,54% 86%,40% 100%,32% 82%,13% 88%,15% 68%,0 56%,11% 42%,3% 24%,22% 21%,24% 3%,39% 13%);"
     "display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-7deg)}"
     ".a{font:900 92px 'Secular One';color:#d50000;-webkit-text-stroke:3px #4a0000}.b{font:900 50px 'Secular One';color:#4a148c}"
     ".f{position:absolute;bottom:14px;left:0;right:0;text-align:center;font:500 30px Heebo;color:#fff;text-shadow:0 0 6px #000,0 0 3px #000}")
STAMP = (".st{position:absolute;inset:30px;display:flex;align-items:center;justify-content:center;border:14px solid COLOR;border-radius:26px;"
         "font:900 SIZEpx 'Suez One';color:COLOR;transform:rotate(-10deg);opacity:.92;"
         "-webkit-mask-image:radial-gradient(circle at 30% 40%,#000 60%,rgba(0,0,0,.75) 61%,#000 63%);}"
         ".st:after{content:'';position:absolute;inset:10px;border:4px solid COLOR;border-radius:16px}")
page("done", 640, 340, '<div class="st">סיים.</div>', STAMP.replace("COLOR", "#d50000").replace("SIZE", "170"))
page("clear", 820, 320, '<div class="st">חד־משמעית</div>', STAMP.replace("COLOR", "#6a1b9a").replace("SIZE", "140"))

# 3. post-its in her handwriting
POST = (".p{position:absolute;inset:26px;background:#fff176;box-shadow:6px 8px 0 rgba(0,0,0,.25);transform:rotate(ROTdeg);"
        "display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 SIZEpx 'Amatic SC';color:#1a1a6e;line-height:1.05;text-align:center}"
        ".p b{color:#d50000}.p .g{font-family:'Segoe UI Symbol';font-size:.8em}.p:before{content:'';position:absolute;top:-18px;left:38%;width:130px;height:40px;background:rgba(255,255,255,.6);transform:rotate(-4deg)}")
page("gadi", 620, 520, '<div class="p">השם גדי<br>= מזל גדי<br>= שבתאי!<br><b>מדעי.</b></div>', POST.replace("ROT", "4").replace("SIZE", "88"))
page("again", 620, 520, '<div class="p">בחירות<br><b>6? 7? 8?</b><br>(יש הקלטה)</div>', POST.replace("ROT", "-5").replace("SIZE", "100"))

# 4. Bennett + Lapid - the marriage she won't approve
T = f"file:///{A}/tarot/final"
page("lovers", 1000, 900,
     f'<img class="c1" src="{T}/bennett-b.png"><img class="c2" src="{T}/lapid-b.png">'
     '<svg class="x" viewBox="0 0 1000 900"><path d="M140,170 L860,760 M860,150 L150,770" stroke="#e00" stroke-width="34" stroke-linecap="round"/></svg>'
     '<div class="st">לא מאושר<small>אפילו לא בקפריסין</small></div>',
     ".c1,.c2{position:absolute;top:40px;height:780px}.c1{right:40px;transform:rotate(6deg)}.c2{left:40px;transform:rotate(-6deg)}"
     ".x{position:absolute;inset:0;opacity:.9}"
     ".st{position:absolute;left:150px;right:150px;bottom:40px;background:#fff;border:10px solid #d50000;border-radius:18px;transform:rotate(-4deg);"
     "text-align:center;font:900 92px 'Suez One';color:#d50000;line-height:1.05;padding:10px 0}.st small{display:block;font-size:46px;color:#4a148c}")

# 4b. her red marker X (over a card she rejects) and her book, as a 3D book (she shows it to the camera)
page("x", 600, 600, '<svg viewBox="0 0 600 600"><path d="M90,110 L510,500 M500,90 L100,510" stroke="#e00" stroke-width="44" stroke-linecap="round" fill="none"/></svg>',
     "svg{position:absolute;inset:0}")
page("book", 700, 900,
     f'<div class="w"><div class="b"><div class="bk"></div><div class="pg"></div><div class="sp">דורית מרקורי</div><div class="fr"></div></div></div>'
     '<div class="tag">רב מכר*</div>',
     ".w{position:absolute;inset:0;perspective:1600px;display:flex;align-items:center;justify-content:center}"
     ".b{position:relative;width:440px;height:660px;transform-style:preserve-3d;transform:rotateY(26deg) rotateX(4deg)}"
     f".fr{{position:absolute;inset:0;background:url({A}/book/cover.jpg) center/cover;border-radius:10px 3px 3px 10px;transform:translateZ(30px);box-shadow:inset -10px 0 16px rgba(0,0,0,.35)}}"
     ".pg{position:absolute;top:8px;bottom:8px;right:100%;width:58px;margin-right:-29px;transform:rotateY(-90deg);background:repeating-linear-gradient(90deg,#fffdf3 0 3px,#e2d7bb 3px 4px)}"
     ".sp{position:absolute;top:0;bottom:0;left:100%;width:60px;margin-left:-30px;transform:rotateY(90deg);background:#6c2bb3}"
     ".bk{position:absolute;inset:0;background:#3a1366;transform:translateZ(-30px)}"
     ".tag{position:absolute;bottom:20px;left:40px;background:#ffe600;color:#d50000;font:900 54px Rubik;padding:6px 22px;border:5px solid #d50000;transform:rotate(-8deg)}")

# 5. polaroid (mid-video) and the end card + stories
SELFIE = f"file:///{A}/tarot/selfie-a.jpg"
LOGO = f"file:///{A}/video/logo.png"
page("polaroid", 460, 600,
     f'<div class="pl"><img src="{SELFIE}"><div class="c">האתר שלי באוויר!!<br><b>הלינק בביו</b></div></div><div class="tape"></div>',
     ".pl{position:absolute;left:30px;top:40px;width:400px;background:#fff;padding:18px 18px 10px;transform:rotate(-5deg);box-shadow:4px 6px 0 rgba(0,0,0,.3)}"
     ".pl img{width:100%;display:block}.c{text-align:center;font:900 40px 'Secular One';color:#4a148c;line-height:1.15;padding-top:8px}.c b{color:#d50000}"
     ".tape{position:absolute;top:22px;left:170px;width:130px;height:44px;background:rgba(255,236,150,.85);transform:rotate(-8deg)}")

CARD_CSS = (f"body{{{STARS}font-family:'Secular One';color:#fff}}"
            ".c{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly}"
            ".logo{width:210px}.n{font:900 108px 'Suez One';color:#ffd54a;line-height:1;-webkit-text-stroke:2px #6b3d00}"
            ".r{font-size:42px;color:#f3e5ff;margin-top:6px}.pl{width:600px;background:#fff;padding:20px 20px 16px;transform:rotate(-4deg)}"
            ".pl img{width:100%;display:block}.pc{color:#4a148c;text-align:center;font-size:40px;padding-top:10px}"
            ".q{font:400 64px 'Secular One';color:#fff;text-align:center;line-height:1.05;padding:0 60px}.q b{color:#ffd54a}"
            ".cta{margin-top:30px;background:#ff2e88;border:5px solid #ffd54a;border-radius:20px;padding:20px 50px;text-align:center;font-size:66px;line-height:1.1}"
            ".cta small{display:block;font-size:44px;color:#fff3b0;margin-top:6px}"
            ".box{width:760px;height:150px;border:6px dashed #ffd54a;border-radius:24px;display:flex;align-items:center;justify-content:center;font:900 54px Heebo;color:#ffd54a}")
page("poster", 1080, 1920,
     f'<div class="c" style="top:110px;bottom:130px"><img class="logo" src="{LOGO}"><div class="n">דורית מרקורי</div>'
     '<div class="r">אסטרולוגית ונומרולוגית בכירה • 30 שנה</div>'
     f'<div class="pl"><img src="{SELFIE}"><div class="pc">״זה אסטרולוגיה בסיסית, חבר׳ה.״</div></div>'
     '<div class="q">התחזית שלי: <b>בחירות נוספות.</b><br>יש הקלטה.</div>'
     '<div class="cta">מה שבתאי מתכנן לך?<small>מפת לידה אישית • הלינק בביו</small></div></div>',
     CARD_CSS, out=here / "poster.jpg")
for kind, box in (("instagram", "👇 להזמנת מפת לידה 👇"), ("tiktok", "🔗 הלינק בביו ⬆️")):
    page(f"story-{kind}", 1080, 1920,
         f'<div class="c" style="top:250px;bottom:300px"><img class="logo" style="width:190px" src="{LOGO}"><div class="n" style="font-size:112px">דורית מרקורי</div>'
         '<div class="r" style="font-size:38px">אסטרולוגית ונומרולוגית בכירה</div>'
         f'<div class="pl" style="width:520px"><img src="{SELFIE}"><div class="pc" style="font-size:34px">התחזית לבחירות 2026</div></div>'
         '<div class="q" style="font-size:58px">שבתאי ונפטון בבית העשירי.<br><b>אף אחד לא ירכיב ממשלה.</b></div>'
         f'<div class="box">{box}</div></div>',
         CARD_CSS, out=STORY_DIR / f"dorit-1-story-{kind}.jpg")

for j in jobs:
    pathlib.Path(j["out"]).parent.mkdir(parents=True, exist_ok=True)
(here / "jobs.json").write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")
print(len(jobs), "pages")
