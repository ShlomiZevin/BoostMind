// The citizenship invitation mail's hero picture (stage 4, scene by Terra): Miriam at the check-in counter, Rabbi Demokratovich
// behind her in his border booth with the stamp raised - the journey's two stills in one frame, their real portraits as references.
//   node scripts/v2-design/citizen-mail-hero.mjs  ->  scratchpad stills/mail-hero.jpg (then to public/verse/art/citizen-mail.jpg)
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const S = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/stills/';
const ref = (f) => [new Blob([fs.readFileSync(f)], { type: 'image/jpeg' }), f.split('/').pop()];
const imgs = [ref(S + 'p-miriam.jpg'), ref(S + 'p-demokratovich.jpg'), ref('C:/workspace/BoostMind/public/verse/art/citizen-checkin.jpg')];
const prompt = `A wide cinematic comedy still in the same style, light and art direction as the third attached image (warm lamp light, wood, dark
background, a busy colourful little airport terminal). In front: Miriam - EXACTLY the woman in the first attached portrait (spiky grey hair, heavy dark
eyebrows, thin glasses, purple eyeshadow, overdrawn pink lipstick, yellow shirt, black cardigan) - sits behind a small, messy check-in counter, holding a
boarding pass and staring at her computer screen as if it refuses to cooperate. Behind her, seen through a glass window, Rabbi Demokratovich - EXACTLY the man
in the second attached portrait (long grey beard, black kippah, glasses, black suit) - sits in a passport-control booth, very serious, a big rubber stamp
raised in his hand, ready. Both faces clearly visible and recognisable. Any planet logo is a plain glowing orange ringed planet with NO letters on it.
Absolutely no text, letters or signs anywhere in the picture.`;
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', prompt); form.append('size', '1536x1024'); form.append('quality', 'medium'); form.append('output_format', 'jpeg');
for (const [b, n] of imgs) form.append('image[]', b, n);
const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
const j = await r.json();
if (!r.ok) { console.log('FAILED', j.error?.message); process.exit(1); }
fs.writeFileSync(S + 'mail-hero.jpg', Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok');
