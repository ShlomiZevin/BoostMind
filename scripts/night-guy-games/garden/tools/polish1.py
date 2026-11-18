# polish round 1: arenas + props + walk frames (edits game.js in place)
import os
p = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'public', 'night-guy-games', 'garden', 'game.js')
s = open(p, encoding='utf-8').read()
def rep(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)

rep("""img('map', 'assets/map.jpg');
for (const p of ['walk', 'talk', 'caught']) img('guy-' + p, `assets/guy-${p}.webp`);
for (const k of UNLOCK) for (const v of ['walk', 'run']) img(`girl-${k}-${v}`, `assets/girl-${k}-${v}.webp`);""",
"""for (const p of ['talk', 'caught']) img('guy-' + p, `assets/guy-${p}.webp`);
// walk cycles: f = toward us, b = away, s = to the right (flipped for left); 1 = stride, 2 = passing
const FR = ['f1', 'f2', 'b1', 'b2', 's1', 's2'];
const ANIMS = ['guy', ...UNLOCK.map((k) => k + '-walk'), ...UNLOCK.map((k) => k + '-run')];
for (const a of ANIMS) for (const f of FR) img(`${a}-${f}`, `assets/anim/${a}-${f}.webp`);
const FEET = { guy: 0.5, 'dog-walk': 0.557, 'dog-run': 0.617, 'shake-walk': 0.547, 'shake-run': 0.547, 'phone-walk': 0.526, 'phone-run': 0.58, 'laptop-walk': 0.538, 'laptop-run': 0.552 };
// the parks: one per night, in turn
const ARENAS = [
  { id: 'park', name: 'הגינה הציבורית', props: [['tree', 3], ['bench', 3], ['bin', 2], ['lamp', 3], ['bush', 3], ['fountain', 1]] },
  { id: 'playground', name: 'גן השעשועים', props: [['slide', 1], ['swings', 1], ['sandbox', 1], ['seesaw', 1], ['horse', 2], ['dome', 1], ['bench', 2], ['bin', 2], ['lamp', 2]] },
  { id: 'botanic', name: 'הגן הבוטני', props: [['pond', 2], ['statue', 2], ['pot', 3], ['topiary', 3], ['birdbath', 2], ['glamp', 3]] },
  { id: 'beach', name: 'טיילת החוף', props: [['palm', 4], ['tower', 1], ['icecream', 1], ['umbrella', 2], ['bluebin', 2], ['blamp', 3], ['bench', 1]] },
];
// footprint (tiles it blocks) and how wide it is drawn; light = a lamp
const PROP = {
  bench: { w: 2, h: 1, dw: 2.3 }, bin: { w: 1, h: 1, dw: 0.95 }, lamp: { w: 1, h: 1, dw: 0.75, light: 1 }, tree: { w: 2, h: 1, dw: 2.7 }, bush: { w: 1, h: 1, dw: 1.4 }, fountain: { w: 2, h: 2, dw: 2.7 },
  slide: { w: 2, h: 2, dw: 2.7 }, swings: { w: 3, h: 1, dw: 3.3 }, sandbox: { w: 2, h: 2, dw: 2.5 }, seesaw: { w: 3, h: 1, dw: 3.1 }, horse: { w: 1, h: 1, dw: 1.3 }, dome: { w: 2, h: 2, dw: 2.7 },
  pond: { w: 2, h: 2, dw: 2.8 }, statue: { w: 1, h: 1, dw: 1.35 }, pot: { w: 1, h: 1, dw: 1.25 }, topiary: { w: 1, h: 1, dw: 1.45 }, birdbath: { w: 1, h: 1, dw: 1.15 }, glamp: { w: 1, h: 1, dw: 0.75, light: 1 },
  palm: { w: 1, h: 1, dw: 2.0 }, tower: { w: 2, h: 2, dw: 2.5 }, icecream: { w: 1, h: 1, dw: 1.5 }, umbrella: { w: 2, h: 1, dw: 2.3 }, bluebin: { w: 1, h: 1, dw: 0.95 }, blamp: { w: 1, h: 1, dw: 0.75, light: 1 },
  house: { w: 2, h: 2, dw: 3.7 },
};
for (const a of ARENAS) img('ground-' + a.id, `assets/ground-${a.id}.jpg`);
for (const k of Object.keys(PROP)) img('prop-' + k, `assets/props/${k}.webp`);""")
rep("const HOUSE = { u: 0.885, v: 0.15 };            // the house's door in map.jpg (0..1)\n", "")
rep("'warn', 'night', 'over', 'tick', 'go', 'start', 'park', 'trail', 'music'];", "'warn', 'night', 'over', 'tick', 'go', 'start', 'park', 'trail', 'music', 'bump-1', 'bump-2'];")
rep("function mapRect() { const im = IMG.map,", "function mapRect() { const im = IMG['ground-' + arena().id],")

a = s.index("// ───────────────────────── the park grid ─────────────────────────")
b = s.index("// close the loop:")
s = s[:a] + open(os.path.join(os.path.dirname(__file__), 'polish-grid.js'), encoding='utf-8').read() + "\n" + s[b:]
open(p, 'w', encoding='utf-8').write(s)
print('ok')
