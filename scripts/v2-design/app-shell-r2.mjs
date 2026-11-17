// The app shell, round 2 of his notes (Shlomi, 2026-11-17, plan app-shell "very very good version" + 13 notes): the bars as
// their own slightly different strips (top AND bottom - "everything is black, not clear where the bottom menu starts"), smaller
// tab icons with air, the unselected tabs grey, a קהילה tab (6 tabs), the simulation card as a thin strip, a character's short
// card from a video instead of leaving it, a heads-up before leaving the video for the chat, the chat's faces strip slimmer and
// collapsible + an RTL send button with our own icon, the videos tab feed/grid switch with the archive. Brief = WHAT (his rule).
// gpt-image-2.6-sunburst, high.  node scripts/v2-design/app-shell-r2.mjs <refs dir> [only-key ...]
//   -> Documents/shlomiverse-v2-design/app-shell/r2/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r2';
fs.mkdirSync(OUT, { recursive: true });
const IN = process.argv[2];
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const ref = (k) => img(path.join(IN, `${k}.png`), `current-${k}.png`);
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png');
const ICONS = img('C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/tab-icons-preview.jpg', 'tab-icons.jpg', 'image/jpeg');
const face = (id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `face-${id}.jpg`, 'image/jpeg');

const SHELL = `Design for a PHONE app (a web app that must feel exactly like a native mobile app). One flat full-screen phone screenshot,
portrait, no device frame, no hand. Hebrew, right-to-left (start = right). Spell all Hebrew exactly as given.
THE PRODUCT: "שלומיוורס" - a comedy universe: a comedian plays dozens of characters (men, women, young, old, tech people, teachers,
grandmas...) in short vertical comedy videos; the app treats them as real people - watch their videos, chat with them, play games.
Dark theme, warm orange #ff6a1f as the single accent, the attached logo. The attached screenshot(s) "current-..." show the app
as it is now - keep its content and style, change only what this brief asks.
THE APP SHELL (same on every screen) - the owner's notes on it:
- The TOP BAR and the BOTTOM TAB BAR must read as their own strips, slightly different from the page area (today everything is
  the same black and you can't tell where the page ends and the bars begin). Design that difference: a tone a little lighter than
  the page, a hairline edge towards the page, maybe a soft shadow - calm and premium, not loud.
- BOTTOM TAB BAR, SIX tabs, right to left: "בית", "סרטונים", "משחקים", "צ'אט", "דמויות", "קהילה". Each tab = a small icon above a short
  label. Use the attached icon set ("tab-icons") as the icon style; קהילה = a small group of different people in the same style.
  The icons smaller than today, with clear air between the icons and the bar's top edge (today they feel pressed against it).
  The SELECTED tab in full colour with its orange label and a short orange line on the bar's top edge; the UNSELECTED tabs much
  quieter - greyed, desaturated, almost no colour - so the selected one is obvious at a glance.
- TOP BAR: the logo small on the right, search and bell icons, an orange "כניסה" pill.`;

const JOBS = [
  ['1-home', [ref('home'), LOGO, ICONS], `${SHELL}

THIS SCREEN: the HOME tab ("בית" selected). Keep the home as in "current-home" (the big logo card, the line, the question box
"שאלו משהו, או @ לדמות", the row "מי עונה?" with faces, the counts pill). ONE change inside the page: the purple simulation card
("בואו לבדוק באיזו סימולציה אתם חיים?" with Yotam's face and the "לסיווג" button) becomes a THIN one-line strip (about a third of its
height today): small face, one short line "באיזו סימולציה אתם חיים?", a small "לסיווג" button.`],
  ['2-character-card', [ref('videos'), LOGO, face('yotam')], `${SHELL}

THIS SCREEN: the VIDEOS tab ("סרטונים" selected) - the vertical video feed as in "current-videos". The visitor tapped a character in
the video's cast row, and INSTEAD OF LEAVING the video a short card slides up from the bottom (a bottom sheet above the tab bar, the
video dimmed and paused behind it, a small grab handle): the character's face (the attached Yotam face), name "יותם", one line
"System Architect של החיים. מתכנן כל דבר, כולל הפסקות", two small facts ("12 סרטונים", "3 משחקים"), and two buttons: the main one
"לדבר עם יותם" and a secondary "לדף של יותם". A small "x" to close and go on watching. Clearly a quick look, not a new page.`],
  ['3-leave-heads-up', [ref('videos'), LOGO, face('yotam')], `${SHELL}

THIS SCREEN: the VIDEOS tab ("סרטונים" selected), the feed as in "current-videos". The visitor tapped "לדבר" on a video. Before
leaving the video, a small calm heads-up card slides up from the bottom above the tab bar (the video paused and dimmed behind it):
Yotam's small face, "עוברים לצ'אט עם יותם", a short line "הסרטון יחכה לכם בדיוק איפה שעצרתם", the main button "לצ'אט" and a quiet
"להישאר בסרטון". Friendly, one glance, not an alarm.`],
  ['4-chat', [ref('chat'), LOGO, face('yotam'), face('savta'), face('ayelet'), face('genz')], `${SHELL}

THIS SCREEN: the CHAT tab ("צ'אט" selected) with Yotam, as in "current-chat", with three changes:
1. The row of characters at the top takes far less height: a slim strip of small round faces (Yotam selected with an orange ring,
   then the attached faces), names hidden or tiny, and a small chevron to collapse the strip to just the current character's face +
   name in one line (show it OPEN here, slim).
2. Under the strip, a small chip "חזרה לסרטון" with a tiny video thumbnail - the visitor came here from a video and can go straight
   back to it.
3. The message box: right to left - the field on the right with "כתבו ליותם...", the SEND button on the LEFT end. The send button
   is our own icon, not the usual paper-plane: design a small, friendly, brand icon for "send" that fits the logo's orange planet
   world (for example a little orange comet / planet with a motion trail pointing left).
The conversation: the visitor asked "יותם, מה אתה עושה בחיים?" and Yotam answered "אני System Architect של החיים. כרגע אני מארכט את
ארוחת הצהריים שלי, ויש בעיה בסקיילינג.". The line "נשארו 3 שאלות לתיירים" under the box.`],
  ['5-videos-grid', [ref('videos'), ref('archive'), LOGO], `${SHELL}

THIS SCREEN: the VIDEOS tab ("סרטונים" selected) in its GRID view. At the top of the page a small two-way switch: "פיד" | "רשת"
(רשת selected) - the same switch the games tab has, so the visitor picks a vertical feed or a grid. Below: a grid of vertical
video thumbnails (2 or 3 per row) with a title line each, from the screenshot's videos. Near the top, one wide calm card that leads
to the archive of older videos: "הארכיון" - "כל הסרטונים הישנים, לפי תאריך" with a small arrow (see "current-archive").`],
  ['6-community', [ref('community'), LOGO, ICONS], `${SHELL}

THIS SCREEN: the new COMMUNITY tab ("קהילה" selected) - the page in "current-community" (its cards: a personal video from a
character, a sticker of the moment, ideas, the stickers of everyone, requests, "משהו לא עובד?" for bugs) under the shell. Keep its
content, make it read clearly as a tab of the app: the title "הקהילה", a short line "בקשות, רעיונות, סרטון אישי ובאגים", the cards.`],
];
const only = process.argv.slice(3);
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
