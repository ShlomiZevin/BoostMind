// His pick for the residents' mail (plan mail-cz-sim, 2026-11-07): top C - "a perfect picture, only the passport looks like a left-to-right
// book, not right-to-left - a recurring problem in the pictures". The same picture, only the book turned into a Hebrew one.
//   node scripts/v2-design/mail-hero-fix.mjs <n>  ->  scratchpad mail2/top-c-fix-<n>.jpg
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const S = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/mail2/';
const n = process.argv[2] || '1';
const prompt = `The first attached image is a finished photograph. Reproduce it EXACTLY - the same composition, Miriam on the phone, Rabbi Demokratovich in his
booth stamping, the mountain of forms and boarding passes, the light, every detail - with ONE correction to the passport in the foreground:
it is a HEBREW passport, which is bound on its RIGHT side. So its SPINE (the rounded bound edge, with the hinge crease running down the cover near it)
must be on the RIGHT edge of the cover, and the visible edge of the stacked pages must show along the LEFT and bottom edges - the opposite of now.
The second attached image is the passport's cover for reference (spine on the right). The gold letters "דרכון", the ringed planet with the Hebrew word
"שלומיוורס" on its ring and "PASSPORT" stay exactly as they are, readable and unmirrored. Change nothing else in the picture.`;
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', prompt); form.append('size', '1536x1024'); form.append('quality', 'high'); form.append('output_format', 'jpeg');
for (const p of [S + 'top-c.jpg', 'C:/workspace/BoostMind/v2/site/verse/art/citizen-passport.jpg']) form.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/jpeg' }), p.split('/').pop());
const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
const j = await r.json();
if (!r.ok) { console.log('FAILED', j.error?.message); process.exit(1); }
fs.writeFileSync(S + `top-c-fix-${n}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', n);
