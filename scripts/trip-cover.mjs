/**
 * trip-cover.mjs
 *
 * Generates a cover photograph for a trip card in the Trip Planner library,
 * through Leonardo. Same call shape as workout-app/server/marketing.js.
 *
 * Usage:
 *   node scripts/trip-cover.mjs --prompt "…" --out c:/path/cover.jpg
 *   node scripts/trip-cover.mjs --prompt "…" --model gpt-image-2 --ratio 1:1
 *
 * Models and prices (MARKETING.md §Leonardo):
 *   nano-banana-2   $0.058  cheap workhorse for photography  ← default
 *   gemini-image-2
 *   gpt-image-2             2:3 only
 *
 * The library card is 16:9 and none of the models emit that, so a square is
 * generated and centre-cropped. Cropping a square to 16:9 keeps the middle
 * band, which is where a landscape's subject sits anyway.
 *
 * Key source: aspect/aspect-agent-server/.env (MARKETING.md §4).
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import sharp from 'file:///c:/workspace/trip-planner/node_modules/sharp/lib/index.js';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : dflt;
};
const die = (m) => { console.error('✖ ' + m); process.exit(1); };

const PROMPT = arg('prompt');
const OUT = arg('out');
const MODEL = arg('model', 'nano-banana-2');
const RATIO = arg('ratio', '1:1');
const CROP = arg('crop', '16:9');
if (!PROMPT) die('--prompt is required');
if (!OUT) die('--out is required');

const KEY_FILE = arg('env-file', 'C:/workspace/aspect/aspect-agent-server/.env');
const readEnvFile = (path) => {
  if (!path || !existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
};
const KEY = readEnvFile(KEY_FILE).LEONARDO_API_KEY || process.env.LEONARDO_API_KEY;
if (!KEY) die('LEONARDO_API_KEY missing. Checked ' + KEY_FILE);

const MODELS = {
  'gpt-image-2':    { '2:3': [1024, 1536] },
  'gemini-image-2': { '9:16': [1536, 2752], '1:1': [1024, 1024], '2:3': [1024, 1536] },
  'nano-banana-2':  { '9:16': [768, 1376], '1:1': [1024, 1024], '2:3': [1024, 1536] },
};
const sizes = MODELS[MODEL] || die('unknown model: ' + MODEL);
const [w, h] = sizes[RATIO] || sizes[Object.keys(sizes)[0]];

const H = {
  authorization: 'Bearer ' + KEY,
  'content-type': 'application/json',
  accept: 'application/json',
};

console.log(`\n▸ model: ${MODEL}  ${w}×${h}`);
console.log(`▸ prompt: ${PROMPT.slice(0, 110)}…\n`);

const q = await (await fetch('https://cloud.leonardo.ai/api/rest/v2/generations', {
  method: 'POST',
  headers: H,
  body: JSON.stringify({
    public: false,
    model: MODEL,
    parameters: { prompt: PROMPT, quantity: 1, width: w, height: h, prompt_enhance: 'OFF' },
  }),
})).json();

if (!q.generate) die('queue failed: ' + JSON.stringify(q).slice(0, 300));
const id = q.generate.generationId;
console.log(`▸ queued ${id}  ($${q.generate.cost?.amount ?? '?'})`);

let url = null;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 2500));
  const g = await (await fetch(
    'https://cloud.leonardo.ai/api/rest/v1/generations/' + id, { headers: H })).json();
  const p = g.generations_by_pk;
  if (!p) continue;
  if (p.status === 'COMPLETE') { url = p.generated_images?.[0]?.url; break; }
  if (p.status === 'FAILED') die('generation failed: ' + id);
  if (i % 4 === 0) process.stdout.write('.');
}
if (!url) die('timed out waiting for ' + id);

const raw = Buffer.from(await (await fetch(url)).arrayBuffer());
const [cw, ch] = CROP.split(':').map(Number);
const meta = await sharp(raw).metadata();
const target = Math.round((meta.width * ch) / cw);

const out = await sharp(raw)
  .extract({
    left: 0,
    top: Math.max(0, Math.round((meta.height - target) / 2)),
    width: meta.width,
    height: Math.min(meta.height, target),
  })
  .jpeg({ quality: 86 })
  .toBuffer();

writeFileSync(OUT, out);
console.log(`\n✓ ${OUT} — ${meta.width}×${Math.min(meta.height, target)}, ${(out.length / 1024) | 0} kB`);
console.log(`  source: ${url}\n`);
