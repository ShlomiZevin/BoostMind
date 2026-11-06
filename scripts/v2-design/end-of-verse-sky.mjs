// The "end of the verse" picture without its planet (his ask, 2026-11-04: "make it the Shlomiverse planet, like you see
// the Shlomiverse from far, more in the middle"): GPT Image 2.5 (OpenAI direct, MEDIUM) clears the sky of the old
// word-less planet; the page puts the real logo planet (/verse/logo-512.png) small and far, in the middle, over it.
//   node scripts/v2-design/end-of-verse-sky.mjs <out.jpg>   (from the current end-of-verse.jpg)
import fs from 'node:fs';

const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const SRC = 'C:/workspace/BoostMind/v2/site/verse/end-of-verse.jpg';
const OUT = process.argv[2];
if (!OUT) { console.log('usage: node end-of-verse-sky.mjs <out.jpg>'); process.exit(1); }

const prompt = `Edit the attached picture. Remove the glowing orange ringed planet at the top completely, and fill its place
with the same deep near-black space and the same faint scattered stars and soft orange nebula dust as the rest of the sky,
so the whole sky is continuous and empty, with no planet, no glow and no bright object anywhere. Keep EVERYTHING else
exactly as it is: the rocky ledge and cliff edge on the left, the crooked blank wooden sign post, the orange traffic cone,
the composition, the colours, the light and the style. No text, no letters.`;

const form = new FormData();
form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1536x1024');
form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
form.append('image[]', new Blob([fs.readFileSync(SRC)], { type: 'image/jpeg' }), 'scene.jpg');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
const buf = Buffer.from(j.data[0].b64_json, 'base64');
fs.writeFileSync(OUT, buf);
console.log('ok', buf.length, j.usage ? JSON.stringify(j.usage) : '');
