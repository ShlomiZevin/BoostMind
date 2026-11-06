// The Shlomiverse app icon (home screen, push): the orange ringed planet from the approved mockups, on near-black.
//   node scripts/v2-design/icon.mjs <out.png>
import fs from 'node:fs';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const out = process.argv[2] || 'icon.png';
const variant = process.argv[3] || 'planet';
const WORD = `The Hebrew word "שלומיוורס" (right-to-left, spelled exactly ש-ל-ו-מ-י-ו-ו-ר-ס, every letter correct) in a bold, clean, rounded
Hebrew sans: the first part "שלומי" in white and the second part "וורס" in the same warm orange #ff6a1f.`;
const LAYOUT = {
  planet: 'The planet fills about 58% of the icon, perfectly centered. No text, no letters.',
  arc: `The planet is centered and fills about 46% of the icon. ${WORD} The word curves in an arc around the lower half of the planet, like a badge, big and legible. No other text.`,
  wrap: `The planet is centered and fills about 70% of the icon. ${WORD} The word IS the planet's ring: the letters are written
along the tilted elliptical ring and wrap around the planet - the front part of the word passes in front of the planet's
body and the ring continues behind it, like text printed on Saturn's ring, following its curve and perspective. Big, bold,
legible. No other text.`,
  below: `The planet sits in the upper middle and fills about 42% of the icon. ${WORD} The word is written straight under the planet, big and legible, centered. No other text.`,
}[variant];
const form = new FormData();
form.append('model', 'gpt-image-2.5-sunburst');
form.append('prompt', `An iPhone app icon, full square, edge to edge (iOS rounds the corners itself, so no rounded corners and no border).
Background: deep near-black #0b0b0e with a very soft warm glow in the middle.
Centered: the logo from the attached app screen (top left of it) - a ringed planet drawn as bold rounded line art: a circle
with a tilted elliptical ring crossing it, glowing warm orange #ff6a1f with a soft neon halo, as in
the icon. ${LAYOUT} Minimal, premium, crisp. No stars, no other objects.`);
form.append('size', '1024x1024'); form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'png');
form.append('image[]', new Blob([fs.readFileSync('C:/Users/shazbak/Documents/shlomiverse-v2-design/2-tap.jpg')], { type: 'image/jpeg' }), 'style.jpg');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', out);
