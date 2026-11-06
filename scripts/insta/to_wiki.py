"""A prepared reel (reel.py) -> the Shlomiverse, under its character(s), at its own Instagram date - through versePublish.

  python scripts/insta/to_wiki.py <media-id> <character-id>[,<character-id>...] [--title "..."] [--teaser "..."] [--dry]

Uploads web.mp4 + poster.jpg (versePublish op=uploadUrl, then PUT), then op=video {id ig-<media-id>, cast, date, t,
archive, ig, transcript, onScreen - the burned-in text, the joke of the 'אף אחד:' memes}: the site and the chat have it at once, no build / push / deploy (since 2026-11-05 the video
list is Firestore catalogVideos). archive: the 'latest' rows skip it - old reels are history (his ask 2026-10-31).
Terra (on the server) writes the title / teaser unless --title / --teaser is given (his own words: always pass them).
--dry: op=video with dryRun - prints the record, uploads and writes nothing.
Also records the reel in scripts/wiki/reels.json - our own import record (the duplicate check), not the site.
The key is read from Secret Manager at run time; never print or save it.
"""
import argparse, json, os, shutil, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/versePublish'
load = lambda p, d=None: json.load(open(p, encoding='utf8')) if os.path.exists(p) else d

ap = argparse.ArgumentParser()
ap.add_argument('mid'); ap.add_argument('cast')
ap.add_argument('--title'); ap.add_argument('--teaser'); ap.add_argument('--dry', action='store_true')
a = ap.parse_args()
mid, cast = a.mid, a.cast.split(',')
d = os.path.join(HERE, 'work', mid)
m = next(x for x in load(os.path.join(HERE, 'work', 'media.json')) if x['id'] == mid)
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'wiki'))
from canon import characters as _chars   # the database - the only copy of the characters since 2026-11-06
_have = {x['id'] for x in _chars()[0]}
for c in cast:
    if c not in _have:
        raise SystemExit(f'no character "{c}" in the Shlomiverse - create it first (content.mjs put / the studio)')

KEY = subprocess.run([shutil.which('gcloud'), 'secrets', 'versions', 'access', 'latest', '--secret=VERSE_PUBLISH_KEY',
                      '--project', 'boostmind-b052c'], capture_output=True, text=True, check=True).stdout.strip()

def call(body):
    req = urllib.request.Request(API, json.dumps(body, ensure_ascii=False).encode('utf8'),
                                 {'content-type': 'application/json', 'authorization': 'Key ' + KEY})
    try:
        return json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e:
        raise SystemExit(f'versePublish {body["op"]}: {e.code} {e.read().decode("utf8", "replace")[:400]}')

def upload(kind, path, ctype):
    uri = call({'op': 'uploadUrl', 'id': rid, 'kind': kind, 'contentType': ctype})['uri']
    req = urllib.request.Request(uri, open(path, 'rb').read(), {'content-type': ctype}, method='PUT')
    urllib.request.urlopen(req, timeout=300).read()

rid = 'ig-' + mid
who = load(os.path.join(d, 'who.json'), {})
words = [g for g in load(os.path.join(d, 'words.json'), []) if not g.get('doubt')]
transcript = ' '.join(g['text'].strip() for g in words)
video = {'op': 'video', 'id': rid, 'cast': cast, 'date': m['timestamp'][:10], 't': m['timestamp'][:19],
         'archive': True, 'ig': m['permalink'], 'transcript': transcript,
         'onScreen': (who.get('on_screen_text') or '').replace('\n', ' ').strip()}
if a.title: video['title'] = a.title
if a.teaser: video['teaser'] = a.teaser
if a.dry:
    print(json.dumps(call({**video, 'dryRun': True}), ensure_ascii=False, indent=1))
    sys.exit()

upload('video', os.path.join(d, 'web.mp4'), 'video/mp4')
upload('poster', os.path.join(d, 'poster.jpg'), 'image/jpeg')
out = call(video)
if not out.get('ok'):
    raise SystemExit(f'versePublish video: {out}')
if out.get('castBy') in ('ai', 'none'):  # his rule: every video has a character - fix with op=video {id, cast}
    print(f'!! cast by {out["castBy"]}: {(out.get("video") or {}).get("cast")} - check it')
title = (out.get('video') or {}).get('title') or a.title or who.get('title_he', rid)

entry = {'id': rid, 'ig': mid, 'permalink': m['permalink'], 'date': m['timestamp'], 'likes': m.get('like_count'),
         'cast': cast, 'on_screen': (who.get('on_screen_text') or '').replace('\n', ' '),
         'transcript': transcript, 'title': title, 'via': 'versePublish'}
p = os.path.join(ROOT, 'scripts', 'wiki', 'reels.json')
reels = [r for r in load(p, []) if r['id'] != rid] + [entry]
reels.sort(key=lambda r: r['date'], reverse=True)
with open(p, 'w', encoding='utf8') as f:
    json.dump(reels, f, ensure_ascii=False, indent=1)

sp = os.path.join(HERE, 'state.json')
state = load(sp, {})
state[mid] = {**state.get(mid, {}), 'status': 'on-wiki', 'cast': cast, 'wiki_id': rid}
with open(sp, 'w', encoding='utf8') as f:
    json.dump(state, f, ensure_ascii=False, indent=1)
print(f'{rid} -> live ({", ".join(cast)}), {m["timestamp"][:10]}: {title} - {out.get("url")}')
