// The citizenship stamp's passport (his note 2026-11-07: "make it with an image model, like a real passport; the number a small
// stamp that doesn't hide the logo"): a real-looking Shlomiverse passport cover, the logo in gold foil. The stamp is drawn over it
// in the page (the citizen number is live).
//   node scripts/v2-design/citizen-passport.mjs [n]  ->  scratchpad stills/passport-<n>.jpg (then to v2/site/verse/art/citizen-passport.jpg)
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const S = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/stills/';
const n = process.argv[2] || '1';
const prompt = `A photograph of a real, closed national passport booklet, seen straight from above, filling the whole frame edge to edge (the
booklet's edges just inside the frame, on a plain near-black background). Deep navy-blue grained leatherette cover, slightly worn corners, the subtle
soft sheen of a real passport under a warm lamp. Centred in the upper half: the attached logo - a glowing ringed planet with the Hebrew word on its ring -
stamped into the cover in shiny GOLD FOIL, embossed, exactly that logo's shape and lettering (no orange, all gold). Above the logo, in gold foil, the
Hebrew word "דרכון" in a classic serif. Below the logo, in smaller gold foil letters: "PASSPORT". At the bottom centre the small gold biometric e-passport
chip symbol. Nothing else written. The lower-left quarter of the cover stays plain (a rubber stamp will be added there later). Photorealistic, sharp.`;
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', prompt); form.append('size', '1024x1536'); form.append('quality', 'high'); form.append('output_format', 'jpeg');
form.append('image[]', new Blob([fs.readFileSync('C:/workspace/BoostMind/public/verse/logo-512.png')], { type: 'image/png' }), 'logo.png');
const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
const j = await r.json();
if (!r.ok) { console.log('FAILED', j.error?.message); process.exit(1); }
fs.mkdirSync(S, { recursive: true });
fs.writeFileSync(S + `passport-${n}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', S + `passport-${n}.jpg`);
