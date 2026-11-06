// Shlomiverse v2: "מאחורי הקלעים" (/backstage/), Shlomi's own page - the messages that reached him, the ideas wall, comments
// and stickers to keep clean, characters' stories, new-video notices. He said the old one looked "like a broken tool":
// designed here first with GPT Image 2.5 (OpenAI direct, MEDIUM), the same system as the site.
//   node scripts/v2-design/backstage.mjs [only-key ...] [home.png]  ->  Documents/shlomiverse-v2-design/backstage/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'backstage');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const WIKI = 'C:/workspace/BoostMind/public/wiki';
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const STYLE_REF = img(`${DESIGN}/2-tap.jpg`, 'style.jpg');
const COMMUNITY_REF = img(`${DESIGN}/community/I-business-desktop.jpg`, 'business.jpg');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/icon-512.png', 'logo.png', 'image/png');
const face = (id) => img(`${WIKI}/img/c/${id}.jpg`, `${id}.jpg`);

const SYSTEM = `A premium web app screen mockup, flat full-screen screenshot (no device frame, no hand).
App: "שלומיוורס" (Hebrew, right-to-left UI). This screen is the creator's private back office, called "מאחורי הקלעים".
FOLLOW THE ATTACHED STYLE REFERENCES EXACTLY (the first two images are the approved design system of the public site):
- Background near-black #0b0b0e with a soft warm orange glow, frosted dark glass cards with 1px faint white borders, 22-28px corners.
- One accent: warm orange #ff6a1f for the one main action and for counts/badges. White text, dim grey secondary text.
- The logo is the attached glowing orange planet with "שלומיוורס" on its ring (use it as is, never redraw the word).
- Characters appear as round portrait photos (the attached faces) with an orange ring.
- Type: Heebo-like Hebrew sans, bold titles, generous spacing. Calm, premium, clear - a beautiful creator studio like a
  boutique SaaS dashboard, NOT a broken admin panel. Line icons, no emoji. All Hebrew text right-aligned and correctly spelled.`;

const JOBS = [
  ['K-overview-desktop', '1536x1024', [STYLE_REF, COMMUNITY_REF, LOGO, face('yotam'), face('hani'), face('rosenblum')], `${SYSTEM}
DESKTOP "OVERVIEW" SCREEN, 16:10. A slim sidebar on the RIGHT: the logo at the top with "מאחורי הקלעים" under it, then nav items
with line icons and small orange count badges: "סקירה" (selected, highlighted), "פניות" (3), "רעיונות" (12), "תגובות",
"סטיקרים", "סטורי של דמות", "סרטון חדש"; at the bottom two quiet links "הנתונים" and "לאתר".
Main area: title "בוקר טוב, שלומי" and a dim line "מה קרה בשלומיוורס מאז הפעם הקודמת".
A row of 4 glass stat cards: "רשומים 1,284" (+37 השבוע), "פניות פתוחות 3", "רעיונות חדשים 12", "תגובות היום 46".
Below, two columns: right column card "צריך את תשומת הלב שלך" with 3 rows - a business message (orange tag "עסקים", "קפה
לנדוור · דנה כהן", one line of text, small pills "מייל" "וואטסאפ"), a video request (tag "בקשת סרטון") and a bug report
(red tag "משהו לא עובד"). Left column card "פעילות אחרונה": a feed of small rows with tiny avatars - "יותם ענה לתגובה",
"סטיקר חדש: זה בסדר, זה בסדר", "+1 לרעיון: חני ויותם באותה פגישה". At the top-left two buttons: orange "סטורי חדש" and glass
"להודיע על סרטון".`],

  ['L-inbox-phone', '1024x1536', [STYLE_REF, COMMUNITY_REF, LOGO], `${SYSTEM}
PHONE "INBOX" SCREEN, 9:16. Top bar: small logo at the right, title "פניות", a round search button at the left.
A row of filter chips: "הכל 3" (selected, orange), "עסקים 1", "בקשות סרטון 1", "משהו לא עובד 1", "פניות".
Then message cards, each a frosted glass card with a thin colored strip on its right edge by type (orange business, white
video request, red bug): a small round avatar with initials, the name and a dim time ("לפני 5 דק'"), the type tag, 2 lines
of the message, and a row of contact pills with icons: "מייל", "וואטסאפ", "התקשרות" - and on the left a round check button
"טופל". The bug card also shows a tiny dim monospace line with the page address and device. A bottom tab bar with 5 line
icons and labels: "סקירה", "פניות" (selected, with an orange badge 3), "רעיונות", "תוכן", "סטורי".`],
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
