# Three stories promoting המשחקייה של חני (1080x1920, an Instagram and a TikTok version each):
#   1 the four games   2 ניסי ניסים! on a phone   3 Hani playing with the kids (Leonardo, hani-phone.jpg) + the rules
# Nothing important above y 240 or below the link box (the apps' bars). Rendered by the tarot shoot.mjs, one per call.
#   python stories.py && (each jobs-*.json through shoot.mjs)
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/')
PUB = 'C:/workspace/BoostMind/public/hani-games'
PROMO = 'C:/Users/shazbak/Downloads/hani-friedman/promo'

HEAD = '''<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Suez+One&family=Heebo:wght@500;700;800;900&display=swap');
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:1080px; height:1920px; overflow:hidden; font-family:Heebo, sans-serif; }
.suez { font-family:'Suez One', serif; font-weight:400; }
.link { position:absolute; left:110px; right:110px; height:150px; border:4px dashed __LC__; border-radius:30px;
  display:flex; align-items:center; justify-content:center; gap:22px; font-weight:900; font-size:52px; color:__LC__; }
.link svg { width:44px; height:44px; }
</style></head><body>'''
DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v15M5 12l7 7 7-7"/></svg>'
UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V5M5 12l7-7 7 7"/></svg>'

def link(kind, top, color):
    words, arrow = ('הקישור כאן', DOWN) if kind == 'instagram' else ('הלינק בביו', UP)
    return f'<div class="link" style="top:{top}px">{arrow}<span>{words}</span>{arrow}</div>', color

STORIES = {}

# 1 - the four games: navy page, the covers as a tilted 2x2 of framed cards, the seal stamped in the middle
covers = ''.join(f'<div class="card" style="transform:rotate({r}deg)"><img src="{PUB}/{g}/cover.jpg"></div>'
                 for g, r in [('nisei-nissim', -2.5), ('ketoret', 2), ('gan-run', 1.5), ('shekel-tov', -2)])
STORIES['games'] = ('''
<style>
body { background:#1d2a4d; color:#f5efe2; }
.kick { position:absolute; top:262px; left:0; right:0; text-align:center; font-weight:800; font-size:34px; color:#c8962e; letter-spacing:1px; }
.t { position:absolute; top:312px; left:0; right:0; text-align:center; font-size:118px; line-height:1.05; color:#f5efe2; }
.s { position:absolute; top:452px; left:0; right:0; text-align:center; font-weight:700; font-size:40px; color:#d9d2c0; }
.grid { position:absolute; top:560px; left:60px; right:60px; display:grid; grid-template-columns:1fr 1fr; gap:34px 30px; }
.card { background:#f5efe2; padding:12px; border-radius:22px; box-shadow:0 14px 34px rgba(0,0,0,0.35); }
.card img { display:block; width:100%; border-radius:14px; }
.seal { position:absolute; top:806px; left:50%; width:230px; margin-left:-115px; filter:drop-shadow(0 10px 22px rgba(0,0,0,0.45)); transform:rotate(-8deg); }
.rules { position:absolute; top:1330px; left:0; right:0; text-align:center; font-weight:800; font-size:38px; color:#f5efe2; }
.rules b { color:#c8962e; padding:0 12px; }
</style>
<div class="kick">בשעה טובה ומוצלחת · חדש באתר</div>
<div class="t suez">המשחקייה של חני</div>
<div class="s">ארבעה משחקים כשרים למהדרין לכל המשפחה</div>
<div class="grid">''' + covers + f'''</div>
<img class="seal" src="{PROMO}/seal.png">
<div class="rules">ניגונים בלבד<b>·</b>בלי פרסומות<b>·</b>שומר שבת</div>
''', 1470, '#f5efe2')

# 2 - ניסי ניסים! on a phone, with Hani's line in a speech bubble
STORIES['nisei'] = (f'''
<style>
body {{ background:#2a1446; color:#fff; }}
.kick {{ position:absolute; top:262px; left:0; right:0; text-align:center; font-weight:800; font-size:34px; color:#ffc94d; }}
.t {{ position:absolute; top:304px; left:0; right:0; text-align:center; font-size:136px; line-height:1.05; color:#fff; }}
.s {{ position:absolute; top:470px; left:90px; right:90px; text-align:center; font-weight:700; font-size:40px; line-height:1.35; color:#e7dcf5; }}
.phone {{ position:absolute; top:640px; left:120px; width:440px; height:782px; background:#0d0d12; border-radius:64px; padding:16px;
  box-shadow:0 26px 60px rgba(0,0,0,0.5); transform:rotate(-5deg); }}
.phone img {{ display:block; width:100%; height:100%; object-fit:cover; border-radius:50px; }}
.bubble {{ position:absolute; top:760px; right:70px; width:430px; background:#fff; color:#2a1446; border-radius:40px; padding:30px 34px;
  font-weight:900; font-size:44px; line-height:1.25; box-shadow:0 16px 40px rgba(0,0,0,0.35); transform:rotate(3deg); }}
.bubble::after {{ content:''; position:absolute; bottom:-30px; right:300px; border:22px solid transparent; border-top:34px solid #fff; border-bottom:0; }}
.who {{ position:absolute; top:1120px; right:96px; width:380px; text-align:center; font-weight:800; font-size:34px; color:#ffc94d; }}
.who span {{ display:block; font-weight:500; font-size:28px; color:#e7dcf5; margin-top:6px; }}
</style>
<div class="kick">המשחקייה של חני · משחק חדש</div>
<div class="t suez">ניסי ניסים!</div>
<div class="s">הבית קורס, השרת נופל, הפלאפון מצלצל –<br>וחני אומרת ״ברוך השם״</div>
<div class="phone"><img src="{PROMO}/nisei-nissim-c.png"></div>
<div class="bubble">וואו! איזו השגחה פרטית! באמת, בכל רגע ורגע!</div>
<div class="who">חני פרידמן<span>מחזיקה את הבית, השרת ותשעה ילדים</span></div>
''', 1470, '#ffffff')

# 3 - Hani playing with the kids, the rules over the photo
pills = ''.join(f'<span>{p}</span>' for p in ['ניגונים בלבד', 'בלי פרסומות', "בלי צ'אט", 'שומר שבת'])
STORIES['kosher'] = (f'''
<style>
body {{ background:#f5efe2; color:#1d2a4d; }}
.photo {{ position:absolute; top:0; left:0; width:1080px; height:1620px; object-fit:cover; object-position:50% 30%; }}
.panel {{ position:absolute; top:236px; left:60px; right:60px; background:#f5efe2; border-radius:34px; padding:30px 34px 32px; text-align:center;
  box-shadow:0 16px 40px rgba(29,42,77,0.25); }}
.panel .t {{ font-size:74px; line-height:1.12; color:#1d2a4d; }}
.panel .s {{ font-weight:700; font-size:38px; color:#7a5626; margin-top:10px; }}
.pills {{ position:absolute; top:1110px; left:70px; right:70px; display:grid; grid-template-columns:1fr 1fr; gap:22px; }}
.pills span {{ background:#f5efe2; color:#1d2a4d; border-radius:60px; padding:18px 0; text-align:center; font-weight:900; font-size:44px;
  box-shadow:0 10px 26px rgba(0,0,0,0.3); }}
.name {{ position:absolute; top:1344px; left:0; right:0; text-align:center; font-size:64px; color:#fff; text-shadow:0 4px 18px rgba(0,0,0,0.6); }}
.foot {{ position:absolute; top:1620px; left:0; right:0; height:300px; background:#1d2a4d; }}
</style>
<img class="photo" src="{HERE}/hani-phone.jpg">
<div class="panel"><div class="t suez">סוף סוף משחקים<br>שאפשר לתת לילדים</div><div class="s">כשר למהדרין, בלי לחשוש</div></div>
<div class="pills">{pills}</div>
<div class="name suez">המשחקייה של חני</div>
<div class="foot"></div>
''', 1470, '#ffffff')

jobs = []
for name, (body, top, color) in STORIES.items():
    for kind in ('instagram', 'tiktok'):
        box, c = link(kind, top, color)
        html = HEAD.replace('__LC__', c) + body + box + '</body></html>'
        f = f'{HERE}/story-{name}-{kind}.html'
        open(f, 'w', encoding='utf-8').write(html)
        out = f'{HERE}/hani-games-{name}-{kind}.jpg'
        json.dump([{'html': f, 'out': out, 'w': 1080, 'h': 1920}], open(f'{HERE}/jobs-{name}-{kind}.json', 'w'))
        jobs.append(f'{HERE}/jobs-{name}-{kind}.json')
print('\n'.join(jobs))
