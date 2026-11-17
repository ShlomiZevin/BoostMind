// The app shell, round 4 of his notes (Shlomi, 2026-11-17): "the feed / site (grid) choosing is the main problem - it takes a
// whole line - show me options", the chat's characters strip (slim line with the current character + a status; expanding opens a
// second slim strip to choose; clear open/close), the videos grid's archive strip slimmer + a search hint, and the send button
// drawn EXACTLY as option 3 he picked ("nothing like the image you showed me"). Brief = WHAT (his rule). gpt-image-2.6-sunburst.
//   node scripts/v2-design/app-shell-r4.mjs <refs dir> [only-key ...]  ->  Documents/shlomiverse-v2-design/app-shell/r4/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r4';
fs.mkdirSync(OUT, { recursive: true });
const IN = process.argv[2];
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const ref = (k) => img(path.join(IN, `${k}.png`), `current-${k}.png`);
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png');
const face = (id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `face-${id}.jpg`, 'image/jpeg');
const OPT3 = img('C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r3/opt3-crop.png', 'chosen-send-icon.png');

const BASE = `Design for a PHONE app (a web app that must feel exactly like a native app). Hebrew, right-to-left (start = right). Spell
all Hebrew exactly as given. Dark theme, warm orange #ff6a1f as the single accent, the attached logo. The product: "שלומיוורס" - a
comedy universe of many characters (men, women, young, old) you can watch, chat with and play with. Keep the app's top bar and
bottom tab bar exactly as in the attached "current-..." screenshot(s).`;

const JOBS = [
  ['1-switch-options', [ref('vfeed'), ref('vgrid'), LOGO], `${BASE}
One flat image, portrait: a design SHEET of FOUR options, side by side in a 2x2 grid, each a phone screen top half (top bar + the
start of the videos feed as in "current-vfeed"), each with a big clear number 1-4 in its corner. The problem: the videos tab can
show a vertical FEED or a GRID of all videos ("current-vgrid"); today the switch between them takes a whole extra row under the
top bar, which wastes space. Four genuinely different ways that take NO extra row and cover nothing important of the video:
1. a small feed/grid toggle icon INSIDE the top bar itself (next to search and the bell) - one icon that flips between the two;
2. a tiny frosted floating pill (two small icons) over the top corner of the video, that fades away after a moment and comes back on tap;
3. the bottom tab itself: the "סרטונים" tab shows a small two-dot indicator, tapping it again flips feed/grid (show a tiny tooltip
   "עוד הקשה = רשת");
4. a small grid button as one more round button at the top of the video's own action column (with the comments / sticker / save
   column on the side of the video), labelled "כל הסרטונים".`],
  ['2a-chat-collapsed', [ref('chat2'), LOGO, face('yotam')], `${BASE}
One flat full-screen phone screenshot, portrait. THIS SCREEN: the chat tab talking with Yotam (attached face), as in "current-chat2",
with the top of the chat redesigned: the characters strip is COLLAPSED into ONE slim line: Yotam's small face, his name "יותם", a
short live status under it in small grey text ("מתכנן את ארוחת הצהריים"), and at the end a clear button "החלפת דמות" with a small
chevron pointing DOWN - obviously "open to choose someone else". Under it the slim way back to the video (thumbnail, "0:24", the
title "זאת לא השאלה", "חזרה לסרטון"), then the conversation and the message box.`],
  ['2b-chat-expanded', [ref('chat2'), LOGO, face('yotam'), face('savta'), face('ayelet'), face('genz'), face('dorit')], `${BASE}
One flat full-screen phone screenshot, portrait. THE SAME chat screen as the previous design (the slim line: Yotam's face, "יותם",
status "מתכנן את ארוחת הצהריים"), now EXPANDED: tapping "החלפת דמות" opened a SECOND slim strip right under that line, the same
slim height, a horizontally scrolling row of small round faces to choose from (the attached faces: יותם selected with an orange
ring, סבתא, איילת, ג'ן זי, דורית), each with a tiny name. The button in the line now reads "סגירה" with a chevron pointing UP - so
open and close are unmistakable. Below: the way back to the video, the conversation, the message box.`],
  ['3-videos-grid', [ref('vgrid'), LOGO], `${BASE}
One flat full-screen phone screenshot, portrait. THIS SCREEN: the videos tab in its GRID view as in "current-vgrid", with two changes
at the top of the grid: (a) a slim one-line search hint row: a small chat icon and "מחפשים סרטון? תשאלו בצ'אט, הוא ימצא לכם" (tappable,
opens the chat); (b) the archive card becomes a SLIM one-line strip: "לא מצאתם? בארכיון המלא יש גם סרטונים שעוד לא בשלומיוורס" with a
small arrow. Both slim and calm, then the grid of video thumbnails (title on the picture). No extra switch row at the top.`],
  ['4-send-icon', [OPT3], `ONE app icon, isolated: EXACTLY the attached "chosen-send-icon" - the same thin glowing orange neon line drawing of a
planet with a tilted ring, and three short orange motion streaks on its right side (so it flies to the LEFT), the same proportions,
line weight and soft orange glow. Clean and crisp, centred, filling most of the frame, transparent background, no other elements,
no text, no box behind it.`],
];
const only = process.argv.slice(3);
for (const [key, images, prompt] of JOBS) {
  if (only.length && !only.includes(key)) continue;
  const icon = key === '4-send-icon';
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-sunburst'); form.append('prompt', prompt); form.append('size', icon ? '1024x1024' : key.startsWith('1-') ? '1536x1024' : '1024x1536');
  form.append('quality', 'high'); form.append('n', '1'); form.append('output_format', icon ? 'png' : 'jpeg');
  if (icon) form.append('background', 'transparent');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.${icon ? 'png' : 'jpg'}`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}
