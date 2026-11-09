// The export's door to render/src/layers/view.js: a dialogue project (the "What we see" strip, a background per clip)
// as the plain layers the editor draws - pipeline/export_layers.py runs it first, so both draw the same frames.
//   node tools/flatten_view.mjs <project.json>   -> the flattened project on stdout
import fs from 'node:fs';
import { flatten } from '../render/src/layers/view.js';

process.stdout.write(JSON.stringify(flatten(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')))));
