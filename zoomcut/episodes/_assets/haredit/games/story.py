# The launch story for /hani-games/ (1080x1920): Pnina's final project at the seminary went live. Two versions -
# Instagram (an empty dashed box for the link sticker) and TikTok (the link is in the bio). Renders: shoot.mjs, one per call.
import sys
D = 'file:///C:/workspace/BoostMind'
ARROW = '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#1d2a4d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v15M5 12l7 7 7-7"/></svg>'
UP = '<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#1d2a4d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V5M5 12l7-7 7 7"/></svg>'
SEAL = open('public/hani-games/index.html', encoding='utf-8').read().split('<svg class="seal"')[1].split('</svg>')[0]
T = """<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Suez+One&family=Frank+Ruhl+Libre:wght@700;900&family=Heebo:wght@500;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box} body{margin:0;width:1080px;height:1920px;background:#f5efe2;font-family:Heebo;color:#22223a;position:relative;overflow:hidden}
.bsd{position:absolute;top:250px;right:64px;font-family:'Frank Ruhl Libre';font-weight:700;font-size:30px}
.top{position:absolute;top:290px;left:0;right:0;text-align:center}
.k{font-family:'Frank Ruhl Libre';font-weight:900;font-size:44px;color:#c8962e;margin:0}
h1{font-family:'Suez One';font-weight:400;font-size:150px;line-height:1;color:#1d2a4d;margin:6px 0 0}
.name{display:flex;align-items:center;justify-content:center;gap:26px;margin-top:22px}
.name b{font-family:'Suez One';font-weight:400;font-size:74px;color:#1d2a4d}
.name svg{width:132px;height:132px}
.sub{font-size:38px;font-weight:700;margin:10px 0 0}
.covers{position:absolute;top:765px;left:56px;right:56px;display:grid;grid-template-columns:1fr 1fr;gap:28px}
.covers img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:22px;border:2px solid #1d2a4d}
.grad{position:absolute;top:1135px;left:70px;right:70px;text-align:center;border-top:2px solid rgba(29,42,77,.25);border-bottom:2px solid rgba(29,42,77,.25);padding:26px 10px}
.grad p{margin:0;font-size:38px;font-weight:700;line-height:1.35}
.grad b{font-family:'Frank Ruhl Libre';font-weight:900;font-size:46px;color:#1d2a4d}
.q{position:absolute;top:1335px;left:90px;right:90px;text-align:center}
.q p{margin:0;font-family:'Frank Ruhl Libre';font-weight:900;font-size:40px;color:#1d2a4d;line-height:1.3}
.q span{display:block;font-size:28px;font-weight:700;margin-top:8px;color:#5b5b70}
.box{position:absolute;top:1495px;left:150px;right:150px;height:120px;border:4px dashed #1d2a4d;border-radius:28px;display:flex;align-items:center;justify-content:center;gap:18px;font-size:46px;font-weight:900;color:#1d2a4d;background:rgba(255,255,255,.55)}
</style></head><body>
<div class="bsd">בס״ד</div>
<div class="top">
  <p class="k">בשעה טובה ומוצלחת</p>
  <h1>עלה לאוויר!</h1>
  <div class="name"><svg viewBox="0 0 120 120"__SEAL__</svg><b>המשחקייה של חני</b></div>
  <p class="sub">משחקים כשרים למהדרין · בלי פרסומות · שומר שבת</p>
</div>
<div class="covers"><img src="__D__/public/hani-games/nisei-nissim/cover.jpg"><img src="__D__/public/hani-games/ketoret/cover.jpg"></div>
<div class="grad"><p>פרויקט הגמר של <b>פנינה ברגר</b>, בוגרת מסלול<br>הכשרת מפתחות בסמינר בית יעקב, לגיסתה חני</p></div>
<div class="q"><p>״עברתי על כל שורת קוד. נקי, יסודי,<br>והשרת יציב ברוך השם.״</p><span>חני פרידמן · מפתחת Backend</span></div>
__BOX__
</body></html>"""
for name, box in [('instagram', f'<div class="box">{ARROW}הקישור כאן{ARROW}</div>'), ('tiktok', f'<div class="box">הלינק בביו{UP}</div>')]:
    html = T.replace('__SEAL__', SEAL.split('>', 1)[1] if False else SEAL[SEAL.index('>'):] ).replace('__D__', D).replace('__BOX__', box)
    open(f'{sys.argv[1]}/story-{name}.html', 'w', encoding='utf-8').write(html)
print('ok')
