// Shlomiverse as an APP, stage 3 (plan app-shell phase 6): the דמויות tab - one screen with a segmented control
// "דמויות" / "סדרות" / "אתרים" (today's characters, series and sites pages, reached in place). Same shell brief as
// app-shell.mjs; brief = WHAT the screen does (his rule), the model designs the look. A varied group of faces (his rule: never
// only religious faces). gpt-image-2.6-sunburst, high, 1024x1536, the design key (scripts/design.env - read here, never printed).
//   node scripts/v2-design/app-characters.mjs   ->  Documents/shlomiverse-v2-design/app-shell/5-characters-tab.jpg
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png', 'image/png');
const SHELL = img(path.join(OUT, '1-home-shell.jpg'), 'shell-style.jpg');
const face = (id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `face-${id}.jpg`);

const APP = `Design for a PHONE app (a web app that must feel exactly like a native mobile app). Deliver one flat full-screen phone
screenshot, portrait, no device frame, no hand. Hebrew, right-to-left (start = right).
THE PRODUCT: "שלומיוורס" - a comedy universe: a comedian plays dozens of characters in short vertical comedy videos; the app treats
the characters as real people - you watch their videos, chat with them (they answer in character), play games about them.
THE APP SHELL, the same on EVERY screen (this is the heart of the brief):
- a TOP BAR like a real app's: the attached logo small on the right, then compact icon buttons (search, notifications bell) and the
  account (an orange "כניסה" pill for visitors). Slim, solid, calm.
- a BOTTOM TAB BAR like a real app's (think of the best native apps): five tabs, each an icon above a short label, the active one
  clearly highlighted in orange: "בית", "סרטונים", "משחקים", "צ'אט", "דמויות" (right to left in that order). It must be obvious at a
  glance that these are tabs you can move between. Safe-area padding at the bottom.
Brand: the attached logo, a dark theme, warm orange #ff6a1f as the single accent. Faces are the attached portraits. No emoji, no
hearts, no likes. Spell all Hebrew exactly as given. Everything a button must look tappable; nothing important may sit unreadable
on top of busy video content.`;

const JOBS = [
  ['5-characters-tab', [LOGO, SHELL, face('yotam'), face('savta'), face('ayelet'), face('genz'), face('dorit'), face('rosenblum')], `${APP}
The attached "shell-style" screenshot is the app's home screen with this shell already designed: use the SAME top bar and the SAME
bottom tab bar (same look, same tab icons), only with "דמויות" as the active tab.

THIS SCREEN: the CHARACTERS tab ("דמויות" active) - where you find everyone in the universe. Under the top bar, a segmented control
with three parts that switch the list in place: "דמויות" (selected), "סדרות", "אתרים". Under it a search field to filter by name
("חיפוש דמות"). Then the characters themselves, the main thing on the screen - each one tappable (opens that character's page), with
the face (the six attached portraits), the name and one short line:
"יותם" - "ה-System Architect של החיים";
"סבתא" - "היא חושבת שאני לא יודעת";
"איילת השחר" - "התודעה כבר בחרה בך";
"הקופאית (Gen Z)" - "רגע, היא פיזית דיברה";
"דורית מרקורי" - "השמיים כבר החליטו";
"המורה רוזנבלום" - "תנסה לחשוב, למדתם את זה".
It should be clear there are many more below (87 characters - "87 דמויות"). Faces first: the people are the stars.`],
];
const only = process.argv.slice(2);
for (const [key, images, prompt] of JOBS) {
  if (only.length && !only.includes(key)) continue;
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'high'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}
