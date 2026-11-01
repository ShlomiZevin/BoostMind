"""The Instagram -> Shlomiverse progress page: what is running, what it cost, what waits for him (his ask, 2026-11-01:
"a simple html page where you show me process and costs").

  python scripts/insta/progress.py ["what is running now"]    -> scripts/insta/work/progress.html (refreshes itself)

Re-run after every step (the session does); the page reloads every 15 s. Costs come from scripts/insta/work/spend.json
(every paid step is logged there) - nothing here is estimated."""
import json, os, sys, html, datetime
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
W = os.path.join(HERE, 'work')
load = lambda p, d=None: json.load(open(p, encoding='utf8')) if os.path.exists(p) else d
esc = html.escape

status_p = os.path.join(W, 'progress-status.json')
st_now = load(status_p, {})
if len(sys.argv) > 1:
    st_now = {'now': sys.argv[1], 'at': datetime.datetime.now().strftime('%H:%M')}
    json.dump(st_now, open(status_p, 'w', encoding='utf8'), ensure_ascii=False)

spend = load(os.path.join(W, 'spend.json'), {'entries': []})['entries']
state = load(os.path.join(HERE, 'state.json'), {})
media = load(os.path.join(W, 'media.json'), [])
covers = load(os.path.join(W, 'covers.json'), {})
wiki = load(os.path.join(ROOT, 'public', 'wiki', 'data', 'wiki.json'), {})
chars = wiki.get('characters', []); chars = chars if isinstance(chars, list) else list(chars.values())
vids = wiki.get('videos', []); vids = vids if isinstance(vids, list) else list(vids.values())
names = {c['id']: c['name'] for c in chars}

total = sum(e['usd'] for e in spend)
today = datetime.date.today().isoformat()
today_usd = sum(e['usd'] for e in spend if e.get('date') == today)

def kind(what):
    w = what.lower()
    for k, keys in [('Reel prep (download, words, who, subtitles)', ['prep']), ('Portraits', ['portrait']),
                    ('Wiki copy (Terra)', ['copy', 'cards']), ('Chat tests', ['chat', 'speed']), ('Cover tagging', ['cover'])]:
        if any(x in w for x in keys):
            return k
    return 'Other / earlier'
by = defaultdict(float)
for e in spend:
    by[kind(e['what'])] += e['usd']

reels = [m for m in media if m.get('media_product_type') == 'REELS' and m['timestamp'] < '2026-10-17']
labels = {'live': 'on the wiki', 'on-wiki': 'on the wiki', 'no-file': 'no file (licensed music)', 'twin': 'already in the editor',
          'skip': 'one-time, skipped', 'asked': 'waiting for your answer'}
cnt = Counter(labels.get(state.get(m['id'], {}).get('status'), 'not yet') for m in reels)
year = [m for m in reels if m['timestamp'] >= '2025-11-01']
ycnt = Counter(labels.get(state.get(m['id'], {}).get('status'), 'not yet') for m in year)
year_todo = [m for m in year if m['id'] not in state]
tagged = sum(1 for m in year_todo if m['id'] in covers)
who = Counter()
for m in year_todo:
    for i in (covers.get(m['id'], {}).get('ids') or [])[:1]:
        who[i] += 1
newish = sum(1 for m in year_todo if covers.get(m['id']) and not covers[m['id']].get('ids'))
asked = [(mid, s) for mid, s in state.items() if s.get('status') == 'asked']

def bar(n, of):
    pct = 0 if not of else round(100 * n / of)
    return f'<div class="bar"><span style="width:{pct}%"></span></div><div class="small">{n} / {of} ({pct}%)</div>'

rows = ''.join(f'<tr><td>{esc(e.get("date", ""))}</td><td>{esc(e["what"])}</td><td class="n">${e["usd"]:.3f}</td></tr>'
               for e in reversed(spend[-40:]))
kinds = ''.join(f'<tr><td>{esc(k)}</td><td class="n">${v:.2f}</td></tr>' for k, v in sorted(by.items(), key=lambda x: -x[1]))
stat = lambda c: ''.join(f'<tr><td>{esc(k)}</td><td class="n">{v}</td></tr>' for k, v in c.most_common())
whos = ''.join(f'<tr><td>{esc(names.get(k, k))}</td><td class="n">{v}</td></tr>' for k, v in who.most_common(15))
asks = ''.join(f'<li>{esc(s.get("asked_in", ""))} - #{s.get("ask_no", "")} <span class="small">({mid})</span></li>' for mid, s in asked) or '<li>nothing</li>'

page = f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="15">
<title>Instagram to Shlomiverse - progress</title>
<style>
body {{ font: 15px/1.45 system-ui, Segoe UI, sans-serif; margin: 0; background: #f5f6f8; color: #1d2433; }}
header {{ background: #1d2433; color: #fff; padding: 18px 28px; }}
header h1 {{ margin: 0; font-size: 20px; font-weight: 600; }}
.now {{ margin-top: 6px; color: #b9c3d6; }}
main {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 16px; padding: 20px 28px; }}
section {{ background: #fff; border-radius: 10px; padding: 16px 18px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }}
h2 {{ font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #6b7487; margin: 0 0 10px; }}
.big {{ font-size: 34px; font-weight: 700; }} .small {{ font-size: 12px; color: #6b7487; }}
table {{ width: 100%; border-collapse: collapse; }} td {{ padding: 4px 0; border-bottom: 1px solid #eef0f3; vertical-align: top; }}
td.n {{ text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-left: 12px; }}
.bar {{ height: 8px; background: #eef0f3; border-radius: 4px; overflow: hidden; margin: 8px 0 2px; }}
.bar span {{ display: block; height: 100%; background: #3b6fd8; }}
.wide {{ grid-column: 1 / -1; }} ul {{ margin: 0; padding-left: 18px; }}
.note {{ background: #fff6e0; border-radius: 8px; padding: 8px 12px; font-size: 13px; }}
</style></head><body>
<header><h1>Instagram to Shlomiverse</h1>
<div class="now">Now: {esc(st_now.get("now", "idle"))}{(" - since " + esc(st_now["at"])) if st_now.get("at") else ""}</div></header>
<main>
<section><h2>Spent so far</h2><div class="big">${total:.2f}</div><div class="small">today ${today_usd:.2f} - every paid step is logged</div>
<table style="margin-top:10px">{kinds}</table></section>
<section><h2>The wiki (local build)</h2><div class="big">{len(vids)}</div><div class="small">videos - {len(chars)} characters</div>
<p class="note">Local changes wait for the joint push (your call): nothing new goes live until then.</p></section>
<section><h2>Waiting for you (Telegram)</h2><ul>{asks}</ul></section>
<section><h2>Last year (Nov 2025 - Oct 16, 2026): {len(year)} reels</h2><table>{stat(ycnt)}</table>
<div class="small" style="margin-top:8px">Cover tagging of the ones not done yet:</div>{bar(tagged, len(year_todo))}</section>
<section><h2>Who the covers show (last year, not done yet)</h2><table>{whos}</table>
<div class="small">+ {newish} look like someone new / unclear</div></section>
<section><h2>All reels before Oct 17: {len(reels)}</h2><table>{stat(cnt)}</table></section>
<section class="wide"><h2>Cost log (newest first)</h2><table>{rows}</table></section>
</main></body></html>'''
open(os.path.join(W, 'progress.html'), 'w', encoding='utf8').write(page)
print('progress.html', f'${total:.2f}')
