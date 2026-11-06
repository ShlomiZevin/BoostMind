// Backstage's own home-screen icon (2026-11-06, his pick): only the director's chair from conversion/B1-icon.png -
// the chair that says BACKSTAGE, no planet. GPT Image 2.6 sunburst, MEDIUM, B1 as the reference.
//   node scripts/v2-design/backstage-icon.mjs  ->  Documents/shlomiverse-v2-design/conversion/B3-chair.png
import fs from 'node:fs';
const DIR = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/conversion';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const form = new FormData();
form.append('model', 'gpt-image-2.6-sunburst');
form.append('prompt', `An iPhone home-screen app icon, full square, edge to edge (iOS rounds the corners, so no rounded corners, no border).
Take ONLY the director's chair from the attached image - the same chair, the same "BACKSTAGE" on its backrest, the same
light - and make it the whole icon: the chair alone, centered, big, filling most of the square, legible at icon size.
Remove the planet logo, the spotlight and the cases. "BACKSTAGE" spelled exactly. Nothing else written.`);
form.append('size', '1024x1024'); form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'png');
form.append('image[]', new Blob([fs.readFileSync(`${DIR}/B1-icon.png`)], { type: 'image/png' }), 'b1.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(`${DIR}/B3-chair.png`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', JSON.stringify(j.usage));
