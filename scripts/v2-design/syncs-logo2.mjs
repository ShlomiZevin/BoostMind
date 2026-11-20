// Syncs logo, round 2 (his note 2026-11-20): G (the camera inside sync arrows) is the best of round 1, but the name must be on it,
// plus a silly tagline; and try the Shlomiverse's orange. Edits of g-call.jpg - one plain sentence each ("tell them what to
// paint, not how it looks"). GPT Image 2.6, MEDIUM, 1024x1024, the design key. Output + one labelled sheet in .../syncs/.
//   node scripts/v2-design/syncs-logo2.mjs
import fs from 'node:fs';
import path from 'node:path';
const DIR = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/syncs';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const PRICE = { text: 5, image: 8, out: 30 };
const JOBS = [
  { name: 'h-orange.jpg', model: 'gpt-image-2.6-sunburst', prompt: 'Keep this app icon, make it in a warm orange instead of purple, and write the name "Syncs" big and clearly readable next to it, with the tagline "Syncing People" under the name.' },
  { name: 'i-orange.jpg', model: 'gpt-image-2.6-flare', prompt: 'Keep this app icon, make it in a warm orange instead of purple, and write the name "Syncs" big and clearly readable under it, with the tagline "Let\'s circle back" under the name.' },
  { name: 'j-original.jpg', model: 'gpt-image-2.6-sunburst', prompt: 'Keep this app icon exactly, and write the name "Syncs" big and clearly readable next to it, with the tagline "Syncing People" under the name.' },
];
let total = 0;
for (const j of JOBS) {
  const f = new FormData();
  f.append('model', j.model); f.append('prompt', j.prompt); f.append('size', '1024x1024'); f.append('quality', 'medium');
  f.append('image[]', new Blob([fs.readFileSync(path.join(DIR, 'g-call.jpg'))], { type: 'image/jpeg' }), 'g-call.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
  const r = await res.json();
  if (!res.ok) { console.error(j.name, res.status, JSON.stringify(r).slice(0, 300)); continue; }
  const u = r.usage || {}, d = u.input_tokens_details || {};
  const usd = ((d.text_tokens || 0) * PRICE.text + (d.image_tokens || 0) * PRICE.image + (u.output_tokens || 0) * PRICE.out) / 1e6;
  total += usd;
  fs.writeFileSync(path.join(DIR, j.name), Buffer.from(r.data[0].b64_json, 'base64'));
  console.log('made', j.name, '$' + usd.toFixed(3));
}
console.log('total $' + total.toFixed(3));
