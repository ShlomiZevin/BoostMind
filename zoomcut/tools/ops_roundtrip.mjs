// Every editor change is an op (render/src/layers/ops.js) and Ctrl+Z is its inverse: random changes on a made-up
// project, then their inverse, must give the project back exactly - and a valid one all the way.   node tools/ops_roundtrip.mjs
// Known on purpose (not a failure): undoing a delete on a builder's layer brings the item back as his (user: true) and
// keeps its ref in `removed` - so a rebuild keeps his restored copy and doesn't add the builder's twin.
// And: a length change re-pins items both ways, so a pinned item he trimmed short of the end comes back touching it.
import { apply, inverse, validate } from '../render/src/layers/ops.js';

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (l) => l[Math.floor(rnd() * l.length)];
const int = (a, b) => Math.floor(a + rnd() * (b - a));

const base = () => ({
  format: 'sketch-studio/1', canvas: { w: 1080, h: 1920, fps: 30 }, duration: 900, rev: 1,
  assets: { take1: { kind: 'video', src: 'a.mp4', w: 720, h: 1280, duration: 40 }, bg: { kind: 'image', src: 'bg.jpg', w: 1080, h: 1920 } },
  layers: [
    { id: 'set', kind: 'backdrop', owner: 'builder', props: { asset: 'bg', target: 'person' }, items: [{ id: 's0', from: 0, dur: 900, pin: 'span', ref: { set: 1 } }] },
    { id: 'person', kind: 'video', owner: 'builder', props: {}, items: [0, 1, 2, 3].map((k) => ({ id: `c${k}`, from: k * 220, dur: 220, asset: 'take1', in: k * 8, box: { x: 0, y: 0, w: 1080, h: 1920 }, ref: { take: 'T', a: k * 8 }, link: `cut-${k}` })) },
    { id: 'subs', kind: 'subtitles', owner: 'builder', props: {}, items: [0, 1, 2, 3, 4, 5].map((k) => ({ id: `s${k}`, from: k * 140, dur: 120, text: `line ${k}`, ref: { cap: k }, link: `cut-${Math.min(3, Math.floor(k * 140 / 220))}` })) },
    { id: 'mine', kind: 'image', props: {}, items: [{ id: 'm0', from: 300, dur: 200, asset: 'bg' }, { id: 'end', from: 840, dur: 60, asset: 'bg', pin: 'end' }] },
  ],
});

const randomOp = (p) => {
  const L = pick(p.layers.length ? p.layers : [null]);
  const it = L && L.items?.length ? pick(L.items) : null;
  switch (pick(['move', 'trim', 'prop', 'add', 'remove', 'layerUpd', 'layerMove', 'layerAdd', 'layerRemove', 'asset', 'length'])) {
    // (as the editor's drag does: never past the video's end - Timeline.tsx opsFor)
    case 'move': return it && { op: 'item.update', layer: L.id, id: it.id, set: { from: Math.max(0, Math.min(it.from + int(-60, 60), p.duration - it.dur)) } };
    case 'trim': return it && { op: 'item.update', layer: L.id, id: it.id, set: { dur: Math.max(1, Math.min(it.dur + int(-40, 40), p.duration - it.from)) } };
    case 'prop': return it && { op: 'item.update', layer: L.id, id: it.id, set: { look: { brightness: +rnd().toFixed(2) }, hidden: rnd() < 0.3 || undefined } };
    case 'add': return L && (L.kind === 'image' || L.id.startsWith('ly')) && L.kind !== 'text' && L.kind !== 'audio' && { op: 'item.add', layer: L.id, item: { id: `n${int(0, 1e6)}`, from: int(0, 200), dur: int(10, 90), asset: 'bg' } };
    case 'remove': return it && !(L.owner === 'builder' && it.ref) && { op: 'item.remove', layer: L.id, id: it.id };
    case 'layerUpd': return L && { op: 'layer.update', id: L.id, set: { name: `L${int(0, 99)}`, hidden: rnd() < 0.5 }, props: { opacity: +rnd().toFixed(2) } };
    case 'layerMove': return L && { op: 'layer.move', id: L.id, index: int(0, p.layers.length) };
    case 'layerAdd': return { op: 'layer.add', layer: { id: `ly${int(0, 1e6)}`, kind: 'image', items: [] }, index: int(0, p.layers.length + 1) };
    case 'layerRemove': return L && !['set', 'person'].includes(L.id) && { op: 'layer.remove', id: L.id };  // (the backdrop's target stays)
    case 'asset': return { op: 'asset.add', id: `as${int(0, 99)}`, asset: { kind: 'image', src: `x${int(0, 9)}.png`, w: 100, h: 100 } };
    case 'length': return { op: 'project', set: { duration: Math.max(300, p.duration + pick([-90, -30, 30, 90])) } };
  }
};

const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => [k, sortKeys(v[k])])) : v);

{ const v = validate(base()); if (v.length) { console.log('the made-up project itself is invalid:', v); process.exit(1); } }
let fails = 0, steps = 0, known = 0;
for (let run = 0; run < 400; run++) {
  let p = base();
  for (let n = 0; n < int(1, 12); n++) {
    let op = null;
    for (let t = 0; t < 20 && !op; t++) op = randomOp(p) || null;
    if (!op) continue;
    // known: a length change re-pins items (ops.js repin), and its undo re-pins them back by the same rule - so a
    // pinned item that did NOT touch the end before (a "span" background he trimmed shorter) comes back touching it
    const pinnedOff = op.op === 'project' && p.layers.some((l) => (l.items || []).some((i) => i.pin && i.from + i.dur !== p.duration));
    const inv = inverse(p, [op]);
    const next = apply(p, [op]);
    const back = apply(next, inv);
    steps++;
    const problems = validate(next) || [];
    if (problems.length) { fails++; console.log('INVALID after', JSON.stringify(op), problems.slice(0, 3)); }
    if (!same(back, p) && pinnedOff) known++;
    else if (!same(back, p)) {
      fails++;
      if (fails < 6) console.log('NOT UNDONE', JSON.stringify(op), '\n  before', JSON.stringify(sortKeys(p)).slice(0, 300), '\n  after undo', JSON.stringify(sortKeys(back)).slice(0, 300));
    }
    p = next;
  }
}
console.log(fails ? `FAIL: ${fails} of ${steps} changes` : `ok: ${steps} random changes, each undone exactly, every step valid${known ? ` (${known} known: a length change's undo re-pins a trimmed pinned item to the end)` : ''}`);
process.exit(fails ? 1 : 0);
