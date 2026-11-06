// The art at the top of the sign-up sheet inside Instagram's browser (2026-11-06, mockup conversion/S1-email.jpg, his
// note: "it should be Miriam, not Yudit"): Miriam - her real portrait - behind the counter of the Shlomiverse's residency
// office. GPT Image 2.6 flare, MEDIUM. Out: public/verse/art/miriam-counter.jpg (+ v2/site copy).
// Redone 2026-11-06 from her fixed portrait (late fifties, slim, a smoker's skin, glasses, very heavy makeup, no beard).
import fs from 'node:fs';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare');
form.append('prompt', `A wide illustration for the top of a sign-up window: the counter of the Shlomiverse's residency office (the attached
mockup shows the scene - keep its warm lamp, the wooden counter, the passport with the Shlomiverse planet logo, the
rubber stamp, the sign "מחלקת תושבות וקליטה", the Shlomiverse banner). The clerk behind the counter is MIRIAM - exactly
the woman in the attached portrait photo, the same face and age: late fifties, slim, a smoker's lined skin with a few
spots, heavy dark eyebrows, thin rectangular glasses, purple eyeshadow and smudged liner, overdrawn pink lipstick, the
spiky grey wig, yellow shirt and black cardigan, a name tag "מרים". Clean-shaven. She looks dazed and lost, mid-sentence
(she never stops talking), peering at a screen she can't quite open.
Photographic-illustration style like the mockup. Hebrew spelled exactly. No other text. Leave the bottom 15% calm (a sheet
continues below it).`);
form.append('size', '1536x1024'); form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
form.append('image[]', new Blob([fs.readFileSync('C:/workspace/BoostMind/zoomcut/characters/miriam/portrait.jpg')], { type: 'image/jpeg' }), 'miriam-portrait.jpg');
form.append('image[]', new Blob([fs.readFileSync('C:/Users/shazbak/Documents/shlomiverse-v2-design/conversion/S1-email.jpg')], { type: 'image/jpeg' }), 'scene-mockup.jpg');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync('C:/Users/shazbak/Documents/shlomiverse-v2-design/conversion/miriam-counter-raw.jpg', Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', JSON.stringify(j.usage));
