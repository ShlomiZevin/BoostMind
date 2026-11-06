// The "end of the verse" picture with the Shlomiverse planet painted INTO the sky, far behind (his note, 2026-11-04: the
// logo laid over the picture "looks like you just put a blur image there" - it has to feel farther behind).
// GPT Image 2.5 (OpenAI direct, MEDIUM): the cleared sky (end-of-verse-sky.mjs) + the logo planet as the reference.
//   node scripts/v2-design/end-of-verse-planet.mjs <sky.jpg> <out.jpg>
import fs from 'node:fs';

const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const LOGO = 'C:/workspace/BoostMind/v2/site/verse/logo-512.png';
const [SKY, OUT] = process.argv.slice(2);
if (!SKY || !OUT) { console.log('usage: node end-of-verse-planet.mjs <sky.jpg> <out.jpg>'); process.exit(1); }

const prompt = `Edit the FIRST attached picture (a dark space scene with a rocky cliff edge, a blank wooden sign and an orange
traffic cone). Paint into its sky the planet from the SECOND attached image - the brand's glowing orange ringed planet with
the Hebrew word "שלומיוורס" written on its ring, letters and colours exactly as in that image ("שלומי" white, "וורס"
orange). Place it horizontally centred in the frame, in the upper third, SMALL - about 9% of the frame's width - and very
FAR AWAY, deep behind everything: it belongs to the scene, not pasted on top. Atmospheric depth: a thin veil of the
scene's dark orange nebula dust and haze drifts IN FRONT of the planet and softens it, its contrast and saturation are
lower than the foreground, its orange glow bleeds softly into the surrounding dust, a few tiny stars sit in front of its
edge, and its warm light very faintly rims the cliff and the sign. Keep EVERYTHING else exactly as it is: the cliff, the
sign, the cone, the composition, the colours, the style, the empty dark lower middle. No other text anywhere.`;

const form = new FormData();
form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1536x1024');
form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
form.append('image[]', new Blob([fs.readFileSync(SKY)], { type: 'image/jpeg' }), 'scene.jpg');
form.append('image[]', new Blob([fs.readFileSync(LOGO)], { type: 'image/png' }), 'planet.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
const buf = Buffer.from(j.data[0].b64_json, 'base64');
fs.writeFileSync(OUT, buf);
console.log('ok', buf.length);
