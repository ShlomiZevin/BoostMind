// The residents' mail hero (his ask, 2026-11-07: "one mail for the simulation and the citizenship - use the Shlomiverse passport
// image there"): the passport we made for the journey, as a wide photo for the top of the mail.
//   node scripts/v2-design/mail-passport.mjs <n> [open|closed]  ->  scratchpad mail2/hero-<which>-<n>.jpg
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const S = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/mail2/';
const ART = 'C:/workspace/BoostMind/v2/site/verse/art/';
const n = process.argv[2] || '1';
const which = process.argv[3] || 'open';
// his note 2026-11-07: the first one was "closed and open at once - a broken image". ONE passport, a real object: open on its
// visa spread, or closed on its own. The stamp has no date - the day the mail goes out is printed on it then.
const PROMPTS = {
  open: `The first attached image is the Shlomiverse passport's navy cover (gold ringed planet logo, Hebrew word "שלומיוורס" on its ring). The second
is one of its inner visa pages. Make a WIDE landscape photograph (3:2) for the top of an email: ONE passport lying OPEN on a dark walnut desk of a
border-control booth, seen from slightly above, physically correct - two facing inner pages joined at the central gutter, the navy cover visible only
as a thin edge around the open pages. Both pages are the visa paper of the second image (cream guilloche, the faint logo watermark). On the RIGHT page
(a Hebrew passport opens right to left, so this is the first page): a fresh round violet-blue rubber ENTRY stamp - ring text "כניסה" at the top, the
small ringed planet in the middle, a tiny plane at the bottom, and NO date and no numbers anywhere in the stamp - and under it a blue ink signature.
The left page is empty. A heavy rubber stamp and an ink pad at the top edge of the frame, soft focus; a warm desk lamp from the upper left. Dark,
warm, cinematic, shallow depth of field. No other text, no people, no hands.`,
  closed: `The first attached image is the Shlomiverse passport. Make a WIDE landscape photograph (3:2) for the top of an email: this SAME passport,
CLOSED, lying alone on a dark walnut desk of a border-control booth, slightly angled, exactly as in the image (navy grained cover, the gold-foil logo
with the Hebrew word "שלומיוורס" on its ring, the gold word "דרכון" above, "PASSPORT" below, the chip symbol, spine on the RIGHT). A heavy rubber stamp
and an ink pad beside it, soft focus; a warm desk lamp from the upper left catching the gold foil. Dark, warm, cinematic, shallow depth of field.
The gold letters readable and unmirrored. No other text, no people, no hands.`,
};
const prompt = PROMPTS[which];
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', prompt); form.append('size', '1536x1024'); form.append('quality', 'high'); form.append('output_format', 'jpeg');
for (const p of which === 'open' ? [ART + 'citizen-passport.jpg', ART + 'citizen-visa.jpg'] : [ART + 'citizen-passport.jpg']) form.append('image[]', new Blob([fs.readFileSync(p)], { type: 'image/jpeg' }), p.split('/').pop());
const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
const j = await r.json();
if (!r.ok) { console.log('FAILED', j.error?.message); process.exit(1); }
fs.mkdirSync(S, { recursive: true });
fs.writeFileSync(S + `hero-${which}-${n}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', S + `hero-${which}-${n}.jpg`);
