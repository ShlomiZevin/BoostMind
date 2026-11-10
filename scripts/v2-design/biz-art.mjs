// The business strip's picture (2026-11-10, mockup B1/B2): three of the verse's characters holding an orange box "המותג שלכם כאן",
// pointing at it - transparent background, so it sits on the strip. Their real portraits as references. GPT Image 2.5, design key.
//   node scripts/v2-design/biz-art.mjs  ->  public/verse/art/biz-brand.png (+ the design folder)
import fs from 'node:fs';
import path from 'node:path';
const D = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/band';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const form = new FormData();
form.append('model', 'gpt-image-2.5-sunburst');
form.append('prompt', `A photo-real promotional cut-out of THREE people from the attached portraits, standing close together from the chest up, looking
happy and excited: the first (attached image 1, the man with the black bob wig, glasses and galaxy shirt) in the middle holds up a big blank
ORANGE cardboard box with the Hebrew words "המותג שלכם כאן" printed on its front in bold black letters (spelled exactly, right to left); the
second (image 2, the bald man with glasses, plaid shirt) and the third (image 3, the religious woman with a dark headscarf and glasses) point at
the box from both sides. Keep each face exactly like its portrait. Warm orange rim light. TRANSPARENT background, nothing behind them, no
text other than on the box, no logo, no frame.`);
form.append('size', '1536x1024'); form.append('quality', 'medium'); form.append('n', '1');
form.append('background', 'transparent'); form.append('output_format', 'png');
for (const f of ['ref-yotam.jpg', 'ref-avram.jpg', 'ref-hani.jpg']) form.append('image[]', new Blob([fs.readFileSync(path.join(D, f))], { type: 'image/jpeg' }), f);
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(D, 'biz-brand.png'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok');
