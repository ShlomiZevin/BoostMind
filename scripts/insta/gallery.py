"""His whole Instagram as one list for the archive page (shlomiverse.com/archive/) - every post's cover, date, likes,
comments, caption, and whether it's already in the verse. No AI, no cost; Instagram's own key (read-only).

  zoomcut/.venv/Scripts/python scripts/insta/gallery.py            # refresh the numbers + covers of new posts, upload
  zoomcut/.venv/Scripts/python scripts/insta/gallery.py --no-list  # use work/media.json as is (no Instagram call)

Writes gs://shlomiverse-media/insta/list.json and the covers gs://shlomiverse-media/insta/t/<ig id>.jpg (320 px, once
each - Instagram's cover links expire, ours don't). Views / shares: Instagram refuses them to this key (no insights
permission) - not in the list.
"""
import io, json, os, re, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
WORK = os.path.join(HERE, 'work')
THUMBS = os.path.join(WORK, 'thumbs')
BUCKET = 'gs://shlomiverse-media/insta'
load = lambda p, d=None: json.load(open(p, encoding='utf8')) if os.path.exists(p) else d
GC = 'gcloud.cmd' if os.name == 'nt' else 'gcloud'

if '--no-list' not in sys.argv:
    subprocess.run(['node', os.path.join(HERE, 'list.mjs')], check=True, cwd=ROOT)
media = load(os.path.join(WORK, 'media.json'))
os.makedirs(THUMBS, exist_ok=True)


def thumb(m):
    p = os.path.join(THUMBS, m['id'] + '.jpg')
    if os.path.exists(p):
        return False
    url = m.get('thumbnail_url') or m.get('media_url')
    if not url and m.get('media_type') == 'IMAGE':
        env = dict(l.rstrip('\n').split('=', 1) for l in open(os.path.join(ROOT, 'zoomcut', '.env'), encoding='utf8') if '=' in l and not l.startswith('#'))
        url = json.load(urllib.request.urlopen(f"https://graph.instagram.com/v23.0/{m['id']}?fields=media_url&access_token={env['IG_TOKEN'].strip(chr(34))}", timeout=60)).get('media_url')
    if not url:
        return False
    im = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=60).read())).convert('RGB')
    im.thumbnail((320, 568))
    im.save(p, 'JPEG', quality=72, optimize=True, progressive=True)
    return True


def safe(m):
    try:
        return thumb(m)
    except Exception as e:
        print('no cover', m['id'], e)
        return False


with ThreadPoolExecutor(12) as ex:
    made = sum(1 for ok in ex.map(safe, media) if ok)
print('new covers:', made)

# what is already in the verse: imported reels (reels.json) and reels the editor already made (state: twin -> episode)
reels = {r['ig']: r for r in load(os.path.join(ROOT, 'scripts', 'wiki', 'reels.json'), [])}
state = load(os.path.join(HERE, 'state.json'), {})
chars = {}
try:
    out = os.path.join(WORK, 'chars.json')
    subprocess.run(['node', os.path.join(ROOT, 'scripts', 'verse', 'content.mjs'), 'list', 'character', '--out', out],
                   check=True, cwd=ROOT, capture_output=True)
    L = load(out)
    chars = {c['id']: c.get('name') for c in (L if isinstance(L, list) else L.get('items', L.get('records', [])))}
except Exception as e:
    print('no character names:', e)

items = []
for m in media:
    r, st = reels.get(m['id']), state.get(m['id'], {})
    vid = r['id'] if r else (st.get('episode') if st.get('status') == 'twin' else None)
    cast = (r or {}).get('cast') or st.get('cast') or []
    items.append({'id': m['id'], 'd': m['timestamp'][:10], 'l': m.get('like_count') or 0, 'c': m.get('comments_count') or 0,
                  'cap': (m.get('caption') or '').strip()[:400], 'p': m['permalink'].rstrip('/').split('/')[-1],
                  'h': list(dict.fromkeys(re.findall(r'#(\w+)', m.get('caption') or ''))),   # from the FULL caption
                  'k': 'v' if m.get('media_type') == 'VIDEO' else 'i',
                  't': os.path.exists(os.path.join(THUMBS, m['id'] + '.jpg')),
                  **({'v': vid, 'who': [chars.get(c, c) for c in cast]} if vid else {})})
doc = {'updated': max(m['timestamp'] for m in media)[:10], 'n': len(items), 'items': items}
with open(os.path.join(WORK, 'archive.json'), 'w', encoding='utf8') as f:
    json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))

subprocess.run([GC, 'storage', 'rsync', THUMBS, BUCKET + '/t', '--cache-control=public,max-age=31536000,immutable', ], check=True)
subprocess.run([GC, 'storage', 'cp', os.path.join(WORK, 'archive.json'), BUCKET + '/list.json',
                '--cache-control=public,max-age=300', '--content-type=application/json', ], check=True)
# the home's archive strip (the 2.0 session's, commit e1031f1) reads this tiny file: per year the most-liked video with a cover
best = {}
for i in items:
    if i['k'] == 'v' and i['t'] and (i['d'][:4] not in best or i['l'] > best[i['d'][:4]]['l']):
        best[i['d'][:4]] = i
strip = {'n': len(items), 'from': min(best), 'covers': [{'id': best[y]['id'], 'y': y} for y in sorted(best)],
         'updated': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(timespec='seconds')}
with open(os.path.join(WORK, 'strip.json'), 'w', encoding='utf8') as f:
    json.dump(strip, f, ensure_ascii=False, separators=(',', ':'))
subprocess.run([GC, 'storage', 'cp', os.path.join(WORK, 'strip.json'), BUCKET + '/strip.json',
                '--cache-control=no-cache, max-age=0', '--content-type=application/json'], check=True)
print(f"list.json: {len(items)} posts, {sum(1 for i in items if i.get('v'))} in the verse; covers {sum(1 for i in items if i['t'])}")
