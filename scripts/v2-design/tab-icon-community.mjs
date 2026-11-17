// The "קהילה" tab icon (Shlomi, 2026-11-17: "we are missing the קהילה tab - requests, bugs, personal video requests"): the sixth
// tab, in exactly the style of the set (the sheet attached as the style reference). A varied little crowd, no religious dress
// (his rule). Transparent, gpt-image-2.6-sunburst.
//   node scripts/v2-design/tab-icon-community.mjs  ->  Documents/shlomiverse-v2-design/app-shell/tab-icon-community.png
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const SHEET = [new Blob([fs.readFileSync(path.join(OUT, 'tab-icons-sheet.png'))], { type: 'image/png' }), 'style-set.png'];

const prompt = `ONE app tab-bar icon for the "community" tab, in EXACTLY the same style as the attached icon set (same glossy 3D
material, the same small glowing orange planet with its ring underneath, same light from the top-left, same size and weight).
The icon: a small orange megaphone / speech-bubble shape with a heart-free "plus" spark, held up by a tiny crowd of three simple
cartoon heads of different kinds of people (a woman with a bun, a young guy in a cap, an older man with glasses) - the idea "the
community: requests and ideas". No hats of religious kind, no kippah, no beards, no text. Readable at 24px: simple silhouette.
Centred, transparent background, no ground shadow, no frame.`;

const f = new FormData();
f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', prompt); f.append('size', '1024x1024');
f.append('quality', 'high'); f.append('background', 'transparent'); f.append('output_format', 'png'); f.append('image[]', SHEET[0], SHEET[1]);
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(OUT, 'tab-icon-community.png'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok');
