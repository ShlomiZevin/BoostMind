// The export's camera curve: render/ui/fx.js (the editor's own code) evaluated for every frame.
//   node tools/fx_curve.mjs <spec.json>     spec: { fx, frames, fps, out }  -> out: [{z, dx, dy, rot, flash, light, black}, ...]
import fs from 'node:fs';
import { fxCurve } from '../render/ui/fx.js';

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.writeFileSync(spec.out, JSON.stringify(fxCurve(spec.fx, spec.frames, spec.fps || 30)));
console.log(`fx curve ${spec.frames} frames`);
