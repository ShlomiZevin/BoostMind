// The export's door to render/src/layers/version.js (the socials' / the Shlomiverse's version of a video, project.split):
//   node tools/version.mjs <project.json> verse            -> the whole video, without the socials-only layers
//   node tools/version.mjs <project.json> social           -> up to the split + the socials' own ending
//   node tools/version.mjs <project.json> window <a> <b>   -> frames [a, b) as a project of their own
// The project goes out on stdout. pipeline/export_layers.py runs it, so the files get what the editor shows.
import fs from 'node:fs';
import { versionOf, windowOf } from '../render/src/layers/version.js';

const [file, what, a, b] = process.argv.slice(2);
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
process.stdout.write(JSON.stringify(what === 'window' ? windowOf(p, +a, +b) : versionOf(p, what)));
