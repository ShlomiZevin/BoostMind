// Home notice board (Shlomi, 2026-11-19): a "לוח מודעות" on the home that rotates notices from inside the world by itself;
// the first notice = the police ask the public's help to find פסיכופת גינה (night-guy). gpt-image-2.6-sunburst, design key.
//   node scripts/v2-design/board.mjs <refs dir> [1|2]     refs: home.png (the home at 390), night-guy.jpg (his portrait)
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/board';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const R = process.argv[2], only = process.argv[3];
const img = (f) => new Blob([fs.readFileSync(path.join(R, f))], { type: f.endsWith('.png') ? 'image/png' : 'image/jpeg' });
const P = fs.readFileSync(path.join(R, 'prompts.txt'), 'utf8').split('\n=====\n');   // Hebrew through a file

const JOBS = [
  { name: '1-board.jpg', refs: ['home.png', 'night-guy.jpg'], prompt: P[0] },
  { name: '2-police.jpg', refs: ['night-guy.jpg', 'home.png'], prompt: P[1] },
  // round 2 (his pick 2026-11-19: board A + notice 1): the notice itself, full frame (it goes up as the notice's picture), and the cork
  { name: '3-notice-police.jpg', refs: ['crop1.png', 'night-guy.jpg'], prompt: P[2] },
  { name: '4-cork.jpg', refs: [], prompt: P[3], size: '1024x1024', gen: true },
];
for (const j of JOBS) {
  if (only && !j.name.startsWith(only)) continue;
  const f = new FormData();
  f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', j.prompt); f.append('size', j.size || '1536x1024');
  f.append('quality', 'high'); f.append('n', '1'); f.append('output_format', 'jpeg');
  for (const file of j.refs) f.append('image[]', img(file), file);
  const body = j.gen ? JSON.stringify({ model: 'gpt-image-2.6-sunburst', prompt: j.prompt, size: j.size, quality: 'medium', n: 1, output_format: 'jpeg' }) : f;
  const res = await fetch(`https://api.openai.com/v1/images/${j.gen ? 'generations' : 'edits'}`, { method: 'POST', headers: { authorization: `Bearer ${OAI}`, ...(j.gen ? { 'content-type': 'application/json' } : {}) }, body });
  const r = await res.json();
  if (!res.ok) { console.log(j.name, 'FAILED', res.status, r.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, j.name), Buffer.from(r.data[0].b64_json, 'base64'));
  console.log(j.name, 'ok');
}
