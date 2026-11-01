// Shlomiverse v2: the community / contact design (Shlomi, 2026-11-01: "an easy contact for businesses and viewers, a place
// to suggest what's next in the Shlomiverse, super convenient and shareable, a community that's involved - design it
// with the OpenAI image models, make it super cool and inviting"). GPT Image 2.5 sunburst, OpenAI direct, MEDIUM, with the
// approved tap screen + today's home hero as the style reference and the real logo.
//   node scripts/v2-design/community.mjs [only-key ...]   ->  Documents/shlomiverse-v2-design/community/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'community');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const WIKI = 'C:/workspace/BoostMind/public/wiki';
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const STYLE_REF = img(`${DESIGN}/2-tap.jpg`, 'style.jpg');
const HOME_REF = img(process.argv.find((a) => a.endsWith('.png')) || `${DESIGN}/phase1/E-bell.jpg`, 'home.png', 'image/png');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/icon-512.png', 'logo.png', 'image/png');
const face = (id) => img(`${WIKI}/img/c/${id}.jpg`, `${id}.jpg`);

const SYSTEM = `A premium app screen mockup, flat full-screen screenshot (no device frame, no hand).
App: "שלומיוורס" (Hebrew, right-to-left UI) - Shlomi Zevin's comedy universe, where his characters are treated as real people.
FOLLOW THE ATTACHED STYLE REFERENCES EXACTLY (the first two images are the approved design system):
- Background: deep near-black #0b0b0e with a warm orange glow, frosted dark glass cards, 1px faint white borders, 28px corners.
- One accent only: warm orange #ff6a1f for the ONE main action and for orange rings around faces. White text, dim grey secondary.
- The logo is the attached glowing orange planet with "שלומיוורס" written on its ring (use it as is, never redraw the word).
- Characters appear as round portrait photos (the attached faces) - real people, the heart of the brand.
- Type: one elegant Hebrew sans (Heebo-like), big bold titles, generous spacing. A boutique streaming app, calm and warm,
  inviting and a bit playful - NOT TikTok, NOT a corporate form. No hearts, no emoji anywhere. All Hebrew text right-aligned
  and correctly spelled.`;

const JOBS = [
  ['G-community-phone', '1024x1536', [STYLE_REF, HOME_REF, LOGO, face('yotam'), face('hani'), face('rosenblum'), face('demokratovich')], `${SYSTEM}
PHONE SCREEN "THE SHLOMIVERSE IS YOURS" - the community page, 9:16. Top: the small logo at the right, a round profile photo at
the top LEFT. A warm hero band: big title "השלומיוורס שלכם", dim line "מה יקרה אחר כך? אתם מחליטים איתנו.".
Section 1 "מה הלאה בשלומיוורס?": a stack of 3 idea cards from viewers, each: small viewer avatar + name, the idea in one line
(e.g. "חני ויותם באותה פגישת צוות", "הרב דמוקרטוביץ עונה על שאלות בלייב", "פרק שבו רוזנבלום מלמד את וובה"), a tiny face of
the character it is about, and a glass "+1" pill with a count (the vote, shown with a tiny orange planet, never a heart) and a
small share icon. Above the list a big orange pill "הציעו רעיון".
Section 2: two side-by-side glass tiles: "בקשה מדמות" (ask a character something) and "בקשת סרטון" (request a video), each
with a fine line icon.
Section 3 at the bottom: a wide frosted card with a subtle gradient: "לעסקים ושיתופי פעולה", line "פרסום עם הדמויות, אירועים,
תוכן ממותג", and a glass pill "דברו איתנו".
Bottom navigation bar with 4 items: בית, דמויות, סרטונים, צ'אט.`],

  ['H-idea-sheet-phone', '1024x1536', [STYLE_REF, HOME_REF, LOGO, face('hani'), face('yotam'), face('vova'), face('savta')], `${SYSTEM}
PHONE SCREEN "SUGGEST AN IDEA" - a tall frosted bottom sheet over the dimmed community page. Top: grab handle, the small logo,
big title "יש לכם רעיון לשלומיוורס?". Four glass choice chips in a row, the first selected in orange: "פרק חדש",
"דמות חדשה", "מפגש בין דמויות", "משהו אחר". A large frosted text area with a typed idea: "חני נתקעת במעלית עם הסבתא של
לולה". Under it "על מי זה?" with a horizontal row of round character faces (the attached faces), two of them selected with an
orange ring. Then a full-width orange pill "לשלוח לשלומי". Under it a small dim line "הרעיונות הכי אהובים מגיעים לשלומי
ראשונים". On the side a tiny preview of what comes next: a small share card "הרעיון שלכם עלה - תנו לחברים להצביע" with a
WhatsApp pill.`],

  ['I-business-desktop', '1536x1024', [STYLE_REF, HOME_REF, LOGO, face('yotam'), face('hani'), face('ayelet'), face('nahor'), face('rosenblum')], `${SYSTEM}
DESKTOP PAGE "WORK WITH THE SHLOMIVERSE" (businesses), 16:10. Top bar: logo + wordmark at the right, nav links, a round profile
photo at the left. Left/right split hero: on the right a big title "הדמויות של שלומי, אצלכם", dim line "פרסום עם דמויות
שהקהל כבר מכיר, אירועים והופעות, תוכן ממותג", three small glass stat chips ("+40K עוקבים בטיקטוק", "60+ דמויות",
"140+ סרטונים"), and a row of 5 round character faces with orange rings (the attached faces). On the left a clean frosted
form card: "ספרו לנו", fields "שם", "חברה", "אימייל", "מה תרצו לעשות?" (a text area), chips "פרסום", "אירוע", "תוכן ממותג",
"אחר", and a full orange pill "שליחה". Under the form a small line with an envelope icon: "או ישר למייל" and a mail address.
At the bottom a slim footer: logo, social icons with names (TikTok, Instagram, YouTube, X, Facebook), links "הקהילה",
"צרו קשר", "לעסקים".`],

  ['J-home-entry-desktop', '1536x1024', [STYLE_REF, HOME_REF, LOGO, face('yotam'), face('hani'), face('savta')], `${SYSTEM}
DESKTOP - THE HOME PAGE, SCROLLED to below the hero (the hero with the glowing logo and the drifting wall of faces is visible
only at the very top edge). Show where the community lives on the home page: a wide inviting band "מה הלאה בשלומיוורס?"
with three horizontally laid idea cards from viewers (avatar, one-line idea, a tiny character face, a "+1" pill with a small
orange planet and a count), and on the band's side a big orange pill "הציעו רעיון" plus a dim link "לכל הרעיונות". Under it a
row of two smaller glass cards: "שאלו דמות" and "לעסקים ושיתופי פעולה". At the bottom of the page a compact footer (short,
not tall): the logo, social icons each with its name (TikTok, Instagram, YouTube, X, Facebook), and links "הקהילה", "צרו קשר",
"לעסקים", "שלומי זוין".`],
];

const only = process.argv.slice(2).filter((a) => !a.endsWith('.png'));
for (const [key, size, images, prompt] of JOBS) {
  if (only.length && !only.includes(key)) continue;
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', size);
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}
