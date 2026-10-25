"""Merge the JSON block of a SOL answer into copy.json (new keys added, existing hand edits kept unless --force)."""
import json, os, re, sys
from canon import HERE, load_json
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'work', 'copy-answer.md')
force = '--force' in sys.argv
ans = json.loads(re.search(r'```json\s*(.*?)```', open(src, encoding='utf8').read(), re.S).group(1))
path = os.path.join(HERE, 'copy.json')
copy = load_json(path, {})
for sect, items in ans.items():
    cur = copy.setdefault(sect, {})
    for k, v in items.items():
        if force or k not in cur:
            cur[k] = v
with open(path, 'w', encoding='utf8') as f:
    json.dump(copy, f, ensure_ascii=False, indent=1)
print('copy.json:', {k: len(v) for k, v in copy.items()})
