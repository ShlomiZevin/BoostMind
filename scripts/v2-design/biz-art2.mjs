// The business strip's picture, round 2 (his note 2026-11-10: holding "המותג שלכם כאן" is weird and not engaging; make it clear the
// advertising is ON THE SITE and IN DEDICATED VIDEOS). A media-kit style composite: a phone playing a dedicated video (the character
// presenting a product, tagged "בשיתוף") in front of a laptop with the site and a "ממומן" banner. GPT Image 2.5, design key.
//   node scripts/v2-design/biz-art2.mjs  ->  Documents/shlomiverse-v2-design/band/biz-media*.png
import fs from 'node:fs';
import path from 'node:path';
const D = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/band';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const BASE = `A polished advertising media-kit visual, photo-real, 3:2, dark background (#111014) with a warm orange glow, everything
sharp and premium. No real brand names or logos. Any Hebrew must be spelled exactly and read right to left.`;
const JOBS = [
  ['biz-media-a', `${BASE} In front: a modern smartphone, slightly tilted, playing a vertical comedy video - the man from attached image 1 (black bob wig,
glasses, galaxy-print shirt) enthusiastically presents a steaming takeaway coffee cup to the camera, mid-joke; a small white pill at the top
of the video says "בשיתוף". Behind it, a laptop showing a dark website (the comedy site) with a wide orange sponsored banner across the page
marked with a tiny "ממומן" label. The phone overlaps the laptop. Leave the RIGHT third of the picture as calm dark space (text goes there).`],
  ['biz-media-b', `${BASE} A behind-the-scenes shot of filming a dedicated sponsored video: the man from attached image 1 (black bob wig, glasses,
galaxy-print shirt) and the woman from attached image 2 (dark headscarf, glasses) laughing on a small set with a ring light, holding a
product package with a blank orange label towards a phone on a tripod; the phone screen shows them in a vertical frame with a small "בשיתוף"
pill. Leave the RIGHT third calm and dark (text goes there).`],
];
await Promise.all(JOBS.map(async ([key, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1536x1024'); form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'png');
  for (const f of ['ref-yotam.jpg', 'ref-hani.jpg']) form.append('image[]', new Blob([fs.readFileSync(path.join(D, f))], { type: 'image/jpeg' }), f);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(D, `${key}.png`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
