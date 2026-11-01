"""A prepared reel (reel.py) -> the Shlomiverse wiki, under its character(s), at its own Instagram date.

  python scripts/insta/to_wiki.py <media-id> <character-id>[,<character-id>...]

Copies web.mp4 + poster.jpg to public/wiki/v/ig-<media-id>.mp4/.jpg and adds the reel to scripts/wiki/reels.json
(archive: the wiki home / links page 'latest' rows skip it - these are history, his ask 2026-10-31). Then:
copy (Terra title / teaser), build.py, then `node scripts/wiki/push.cjs` (live in seconds, no deploy) - see the skill.
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
load = lambda p, d=None: json.load(open(p, encoding='utf8')) if os.path.exists(p) else d

mid, cast = sys.argv[1], sys.argv[2].split(',')
d = os.path.join(HERE, 'work', mid)
m = next(x for x in load(os.path.join(HERE, 'work', 'media.json')) if x['id'] == mid)
for c in cast:
    if not os.path.exists(os.path.join(ROOT, 'zoomcut', 'characters', c, 'character.json')):
        raise SystemExit(f'no character "{c}" in zoomcut/characters - create it first')

rid = 'ig-' + mid
dst = os.path.join(ROOT, 'public', 'wiki', 'v')
shutil.copyfile(os.path.join(d, 'web.mp4'), os.path.join(dst, rid + '.mp4'))
shutil.copyfile(os.path.join(d, 'poster.jpg'), os.path.join(dst, rid + '.jpg'))

who = load(os.path.join(d, 'who.json'), {})
words = [g for g in load(os.path.join(d, 'words.json'), []) if not g.get('doubt')]
entry = {'id': rid, 'ig': mid, 'permalink': m['permalink'], 'date': m['timestamp'], 'likes': m.get('like_count'),
         'cast': cast, 'on_screen': (who.get('on_screen_text') or '').replace('\n', ' '),
         'transcript': ' '.join(g['text'] for g in words), 'title': who.get('title_he', rid)}
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
print(f'{rid} -> wiki ({", ".join(cast)}), {m["timestamp"][:10]}')
