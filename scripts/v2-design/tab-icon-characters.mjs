// The "דמויות" tab icon, redrawn (Shlomi, 2026-11-16): the first set's faces were a bearded man in a black hat + a man in glasses -
// "it looks like a Haredi site; I have many different characters, don't use only Jewish". A mixed group, no religious dress, in the
// same style as the rest of the set (the sheet is attached as the style reference). Transparent, gpt-image-2.6-sunburst.
//   node scripts/v2-design/tab-icon-characters.mjs  ->  Documents/shlomiverse-v2-design/app-shell/tab-icon-characters.png
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const SHEET = [new Blob([fs.readFileSync(path.join(OUT, 'tab-icons-sheet.png'))], { type: 'image/png' }), 'style-set.png'];

const prompt = `ONE app tab-bar icon for the "characters" tab, in EXACTLY the same style as the attached icon set (same glossy 3D
material, the same small glowing orange planet with its ring underneath, same light from the top-left, same size and weight).
The icon: THREE little cartoon character faces grouped together on the planet, clearly DIFFERENT kinds of people from a comedy
universe of many characters: a young woman with a high ponytail and big earrings, a tech guy in a hoodie with big headphones around
his neck, and a cheerful grandma with curly white hair and red glasses. All three laughing. No hats, no kippah, no beards, no
religious clothing, no text. Readable at 28px. Centred, transparent background, no ground shadow, no frame.`;

const f = new FormData();
f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', prompt); f.append('size', '1024x1024');
f.append('quality', 'high'); f.append('background', 'transparent'); f.append('output_format', 'png'); f.append('image[]', SHEET[0], SHEET[1]);
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(OUT, 'tab-icon-characters.png'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok');
