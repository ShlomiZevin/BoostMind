// The editor and the export must place everything the same: random cases through geometry.js and
// pipeline/layer_geometry.py, any difference over 0.01 px fails.   node tools/geometry_parity.mjs
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitBox, backdropBox, imageBox, keyAt } from '../render/src/layers/geometry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (a, b) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const cases = [];
for (let i = 0; i < 400; i++) {
  const asset = { w: pick([720, 1080, 1920, 540]), h: pick([1280, 1920, 1080, 960]), framing: Math.random() < 0.8 ? { cx: r(0.3, 0.7), top: Math.random() < 0.8 ? r(0.1, 0.5) : undefined, cy: r(0.3, 0.6), fh: r(0.1, 0.4) } : undefined };
  const box = { x: r(0, 500), y: r(0, 900), w: r(100, 1080), h: r(100, 1600) };
  const p = { fit: pick(['cover', 'face', 'contain', undefined]), zoom: Math.random() < 0.5 ? r(0.5, 2) : undefined, x: Math.random() < 0.5 ? r(-0.3, 0.3) : undefined,
    y: Math.random() < 0.5 ? r(-0.3, 0.3) : undefined, head: Math.random() < 0.5 ? pick([0.06, 0.09, 0.12]) : undefined };
  const img = { w: pick([1536, 1024, 2048]), h: pick([1024, 1536, 1152]) };
  const bp = { x: r(-0.5, 0.5), y: r(-0.5, 0.5), zoom: r(0.3, 2) };
  const view = Math.random() < 0.7 ? { x0: r(0, 200), y0: r(0, 200), w: r(100, 900), h: r(100, 1200) } : undefined;
  const ib = { x: r(0, 1080), y: r(0, 1920), w: Math.random() < 0.8 ? r(100, 1080) : undefined, h: Math.random() < 0.3 ? r(100, 1000) : undefined, anchor: pick(['c', undefined]) };
  const keys = [[0, r(0, 1)], [r(0.1, 1), r(0, 1)], [r(1, 3), r(0, 1)]];
  const t = r(-0.5, 4);
  cases.push({ asset, box, p, img, bp, view, ib, keys, t });
}
const js = cases.map((c) => {
  const f = fitBox(c.asset, c.box, c.p);
  const b = backdropBox(c.img, f.width, f.height, c.bp, c.view);
  const i = imageBox(c.img, c.ib);
  return [f.left, f.top, f.width, f.height, b.left, b.top, b.width, b.height, i.x, i.y, i.w, i.h, keyAt(c.keys, c.t)];
});
const strip = (o) => JSON.parse(JSON.stringify(o));  // (undefined -> missing, as Python sees it)
const py = JSON.parse(execFileSync(path.join(ROOT, '.venv', 'Scripts', 'python.exe'), ['-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(ROOT)})
from pipeline.layer_geometry import fit_box, backdrop_box, image_box, key_at
out = []
for c in json.load(sys.stdin):
    f = fit_box(c["asset"], c["box"], c["p"])
    v = c.get("view")
    b = backdrop_box(c["img"], f[2], f[3], c["bp"], (v["x0"], v["y0"], v["w"], v["h"]) if v else None)
    i = image_box(c["img"], c["ib"])
    out.append([*f, *b, *i, key_at(c["keys"], c["t"])])
print(json.dumps(out))
`], { input: JSON.stringify(strip(cases)) }).toString());
let bad = 0;
js.forEach((row, k) => row.forEach((v, j) => { if (Math.abs(v - py[k][j]) > 0.01) { if (bad++ < 5) console.log('differs', k, j, v, py[k][j], JSON.stringify(cases[k])); } }));
console.log(bad ? `✖ ${bad} values differ` : `✔ geometry: editor and export agree on ${cases.length} random cases`);
process.exit(bad ? 1 : 0);
