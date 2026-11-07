// Mockups for the phone top bar and the status sheet's passport card (his note 2026-11-07: "top bar alignment terrible - use
// the image model to design"; "the to-your-passport link looks terrible, its arrow is the wrong way for RTL").
// Brief = what it is and what it holds (feedback_concept_prompts), his current screen as the brand reference.
//   node scripts/v2-design/topbar-mockups.mjs <which> <n>   which = bar | card   ->  scratchpad stills/mk-<which>-<n>.jpg
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const S = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/stills/';
const [which = 'bar', n = '1'] = process.argv.slice(2);
const REF = 'C:/Users/shazbak/.claude/uploads/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/7e9a91b3-image.png';
const BRIEF = {
  bar: `Design the TOP BAR of a Hebrew (right-to-left) mobile website, shown as a crisp phone UI mockup: the top ~22% of a 390px-wide phone
screen, rendered large and sharp, with a bit of the page under it. The site is "שלומיוורס" (the Shlomiverse) - a comedy universe of characters
played by one comedian; the attached screenshot is its current look (dark UI, orange accent, the glowing orange ringed-planet logo with the word
"שלומיוורס" on the ring) and its current top bar, which is badly aligned.
The bar holds, for a signed-in visitor: the logo (home), a search button, the visitor's status chip (an icon + the word "אזרח" - it opens their
status), a notifications bell with an unread dot, and their profile picture (opens their menu). On a phone, right-to-left: the logo sits at the
right. Make it calm, aligned and balanced - one height, one rhythm, clearly tappable, nothing glued together, nothing glowing too much.
All text in Hebrew, correctly spelled. Show only the bar's design, no explanation text.`,
  card: `Design ONE element of a Hebrew (right-to-left) mobile website, shown as a crisp phone UI mockup on the bottom part of a dark bottom
sheet: the button that opens the visitor's PASSPORT. The site is "שלומיוורס" (the Shlomiverse), a comedy universe; the attached screenshot is its
current look (dark UI, orange accent) and, at its bottom, the current version of this element, which looks bad and has its arrow pointing the wrong
way. The visitor is a citizen of the Shlomiverse with citizen number 0002, and this element opens their passport (a real-looking passport data page
with their details). It shows: "הדרכון שלכם", the number 0002, and that tapping opens it; it may show a small passport picture. In right-to-left,
"forward" points LEFT. It must look clearly tappable, premium and simple, matching the dark sheet above it. Text in Hebrew, correctly spelled.
Show only the design, no explanation text.`,
};
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', BRIEF[which]); form.append('size', '1024x1536'); form.append('quality', 'medium'); form.append('output_format', 'jpeg');
form.append('image[]', new Blob([fs.readFileSync(REF)], { type: 'image/png' }), 'current.png');
const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
const j = await r.json();
if (!r.ok) { console.log('FAILED', j.error?.message); process.exit(1); }
fs.writeFileSync(S + `mk-${which}-${n}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', which, n);
