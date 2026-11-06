"""Merge the JSON block of a SOL answer: videos into copy.json; characters' and worlds' fan copy straight onto their
records in the database (their only copy since 2026-11-06). New ones added, existing hand edits kept unless --force."""
import json, os, re, sys
from canon import HERE, load_json, characters, verse
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'work', 'copy-answer.md')
force = '--force' in sys.argv
ans = json.loads(re.search(r'```json\s*(.*?)```', open(src, encoding='utf8').read(), re.S).group(1))
path = os.path.join(HERE, 'copy.json')
copy = load_json(path, {})
chars, worlds = characters()
have = {c['id']: c for c in chars}
by = 'merge_copy.py'
for cid, v in (ans.pop('characters', None) or {}).items():
    if cid in have and (force or not have[cid].get('bio')):
        verse({'op': 'put', 'kind': 'character', 'id': cid, 'by': by, **{k: v[k] for k in ('tagline', 'bio', 'ask') if v.get(k)}})
        print('character copy ->', cid)
for key, v in (ans.pop('worlds', None) or {}).items():
    w = worlds.get(key)
    if w and (force or not w.get('blurb')):
        verse({'op': 'put', 'kind': 'series', 'id': w['id'], 'by': by, **{k: v[k] for k in ('title', 'blurb') if v.get(k)}})
        print('world copy ->', w['id'])
for sect, items in ans.items():
    cur = copy.setdefault(sect, {})
    for k, v in items.items():
        if force or k not in cur:
            cur[k] = v
with open(path, 'w', encoding='utf8') as f:
    json.dump(copy, f, ensure_ascii=False, indent=1)
print('copy.json:', {k: len(v) for k, v in copy.items()})
