# add a voice line for every question in game.js STAGES (+ the tutorial and the Daniel-ring fallback) to lines.json
import io, json, re
ROOT = r'c:\workspace\BoostMind'
g = io.open(ROOT + r'\public\techytech-games\not-the-question\game.js', encoding='utf-8').read()
stages = g[g.index('const STAGES = ['):g.index('const STAGE_NAMES_MORE')]
L = json.load(io.open(ROOT + r'\scripts\techytech-games\not-the-question\tools\lines.json', encoding='utf-8'))
L = [l for l in L if not l['id'].startswith('q-')]
n = 0
for m in re.finditer(r"\{ who: '(\w+)', q: '([^']+)'", stages):
    who, q = m.group(1), m.group(2)
    if who == 'daniel':
        continue
    n += 1
    L.append({'id': f'q-{n}', 'who': who, 'text': q, 'q': q})
L.append({'id': 'q-ask', 'who': 'amir', 'text': 'אז מה אתה מציע?', 'q': 'אז מה אתה מציע?'})
io.open(ROOT + r'\scripts\techytech-games\not-the-question\tools\lines.json', 'w', encoding='utf-8').write(json.dumps(L, ensure_ascii=False, indent=1))
print(n, 'questions')
