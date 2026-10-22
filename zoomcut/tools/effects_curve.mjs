// The export's film-effect curve for a layered project: render/src/layers/effect_curve.js (the editor's own code)
// evaluated for every frame of a range.   node tools/effects_curve.mjs <spec.json>   spec: { project, f0, f1, out }
import fs from 'node:fs';
import { effectCurve } from '../render/src/layers/effect_curve.js';

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.writeFileSync(spec.out, JSON.stringify(effectCurve(spec.project, Math.max(0, spec.f0), spec.f1).map((s, i, a) => s)));
