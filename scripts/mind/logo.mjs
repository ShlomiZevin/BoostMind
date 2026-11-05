// The logo of "המוח השני" in the Shlomiverse logo's family (his ask, 2026-11-04: "I like the Shlomiverse logo, do
// something similar, transparent"). GPT Image 2.5 edits with public/verse/logo-512.png as the style reference.
//   node scripts/mind/logo.mjs <out-dir>   -> logo-1.png .. logo-3.png (transparent)
import fs from 'node:fs';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const prompt = `A logo in EXACTLY the style of the attached logo (same rendering, same neon glow, same bold Hebrew lettering on the
ring, same composition and proportions), for a sister brand. Changes:
- The planet becomes a BRAIN-PLANET: the same dark glossy sphere with a glowing neon rim, but its surface shows the
  soft folds of a brain (subtle, elegant, still reads as a planet), with a few tiny glowing points connected by thin
  light lines on it, like thoughts.
- The colour: electric blue neon (#3b82f6 to #60a5fa) instead of orange for the rim, the ring and the glow.
- The ring carries the Hebrew words "המוח השני" (exactly these letters, right-to-left, spelled ה-מ-ו-ח space ה-ש-נ-י)
  in the same heavy font: "המוח" in white, "השני" in electric blue - like the attached logo's two-colour word.
- Fully transparent background, nothing else in the picture, no extra text.`;
const form = new FormData();
form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1024');
form.append('quality', 'high'); form.append('n', '3'); form.append('background', 'transparent'); form.append('output_format', 'png');
form.append('image[]', new Blob([fs.readFileSync('C:/workspace/BoostMind/public/verse/logo-512.png')], { type: 'image/png' }), 'shlomiverse-logo.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
j.data.forEach((d, i) => fs.writeFileSync(`${out}/logo-${i + 1}.png`, Buffer.from(d.b64_json, 'base64')));
console.log('ok', j.data.length);
