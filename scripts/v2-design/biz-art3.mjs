// The business strip's pictures, round 3 (his notes 2026-11-10: "בשיתוף" is a silly word - "המותג שלכם"; no stand-up comics, he
// doesn't do stand-up; the video frame must be strong). (1) a device scene with PURE GREEN screens, filled afterwards with real frames by
// scripts/v2-design/biz-fill.py; (2) picture B with its phone pill rewritten (a masked edit, nothing else changes). GPT Image 2.5, design key.
//   node scripts/v2-design/biz-art3.mjs [only ...]  ->  Documents/shlomiverse-v2-design/band/
import fs from 'node:fs';
import path from 'node:path';
const D = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/band';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const only = process.argv.slice(2);
async function run(key, prompt, files, mask) {
  if (only.length && !only.includes(key)) return;
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1536x1024'); form.append('quality', 'high'); form.append('n', '1'); form.append('output_format', 'png');
  for (const f of files) form.append('image[]', new Blob([fs.readFileSync(path.join(D, f))], { type: 'image/png' }), f);
  if (mask) form.append('mask', new Blob([fs.readFileSync(path.join(D, mask))], { type: 'image/png' }), mask);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(D, `${key}.png`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}
const SCENE = `A premium, photo-real advertising media-kit scene, 3:2, dark warm studio background (#111014) with a soft orange glow and bokeh lights:
an open modern laptop on a dark wooden desk, slightly angled, and a modern smartphone standing upright on a small stand IN FRONT AND TO THE LEFT of the
laptop - the phone must NOT cover any part of the laptop screen. BOTH SCREENS ARE A SOLID, FLAT, PURE CHROMA GREEN (#00FF00), perfectly uniform edge to
edge, no reflections, no glare, no UI, no text. Sharp clean device edges. Keep the RIGHT third of the picture calm and dark (text goes there). No logos.`;
await Promise.all([
  run('scene-green-1', SCENE, ['biz-media-a.png']),
  run('scene-green-2', SCENE + ' A slightly lower camera angle, the laptop a little more to the centre.', ['biz-media-a.png']),
  run('biz-media-b2', 'Rewrite ONLY the small orange pill label on the phone screen so it reads "המותג שלכם" in white bold Hebrew letters (right to left, spelled exactly). Keep its orange pill shape and place (it may be a little wider). Change nothing else.', ['biz-media-b.png'], 'mask-b.png'),
]);
