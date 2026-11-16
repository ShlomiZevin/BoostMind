// Shlomiverse /new, round 3 (Shlomi, 2026-11-16, on his iPhone: "a complete mess - you cannot see anything, what's a button,
// what's a video?"; comments must open inside the new screen, not the old video page; nothing else on the site may change).
// The lesson: no buttons laid over the video. The video stays clean in its own frame; the actions live in their own solid area,
// with words, and the characters of the video are a clear row. Phone only.
//   node scripts/v2-design/home-feed-r3.mjs <dir with live.png + posters> [only-key ...]  ->  Documents/shlomiverse-v2-design/home-feed-r3/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/home-feed-r3';
fs.mkdirSync(OUT, { recursive: true });
const IN = process.argv[2];
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const LIVE = img(path.join(IN, 'live.png'), 'live.png', 'image/png');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/icon-512.png', 'logo.png', 'image/png');
const poster = (id) => img(path.join(IN, `${id}.jpg`), `${id}.jpg`);
const face = (id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `face-${id}.jpg`);

const SYSTEM = `A phone app screen mockup, flat full-screen screenshot (no device frame, no hand), 9:16, phone only.
App: "שלומיוורס" (Hebrew, right-to-left UI) - a comedy universe of characters from short comedy videos.
The screen is a vertical feed: one video per screen, swipe up for the next. CLARITY IS THE WHOLE POINT: the video is clean,
NOTHING is drawn over the video picture itself (no buttons, no text, no icons on it). Every button is a clear solid button with
a word on it, in its own area outside the video. Style from the FIRST attached image (today's app): near-black background,
warm orange #ff6a1f as the only accent, white bold Hebrew, dim grey secondary text, rounded dark cards with a faint 1px border.
The video frame shows the attached poster exactly as it is (a vertical phone video with burned-in Hebrew subtitles), with
rounded corners. Characters are round portrait photos (the attached faces). No hearts, no emoji. All Hebrew right-aligned,
spelled exactly as given.`;

const TOP = `At the very top a slim row: the small planet logo (attached) on the right, and three tabs centred:
"סרטונים" (selected, orange pill), "משחקים", "צ'אט". No search field. At the bottom the app's navigation bar: בית, דמויות, סרטונים, קהילה, צ'אט.`;

const JOBS = [
  ['A-frame-bar', [LIVE, LOGO, poster('haredit-5-dialogue'), face('hani'), face('osnat'), face('yotam')], `${SYSTEM}
${TOP}
Under the tabs, the video in a rounded frame, about 62% of the screen height, centred, with a small "הקישו לסאונד" pill BELOW
its bottom-left corner (outside the picture) and a thin orange progress line along its bottom edge.
Under the video, on the dark background:
- the title in bold: "חני באה להחזיר שבעה שקלים ועשרים";
- a row "בסרטון:" followed by three round faces with their names under them: "חני פרידמן", "אסנת", "יותם";
- a row of three equal solid buttons: an orange one "לדבר עם הדמויות" (speech bubble icon), a dark one "תגובות 12" (comment
  icon), a dark one "משחקים" (controller icon). A small share icon at the end of the title line.`],
  ['B-faces-talk', [LIVE, LOGO, poster('haredit-5-dialogue'), face('hani'), face('osnat'), face('yotam')], `${SYSTEM}
${TOP}
Under the tabs, the video in a rounded frame, about 58% of the screen height, centred.
Under the video, a dark card holding everything you can do with this video:
- first line: the title "חני באה להחזיר שבעה שקלים ועשרים" in bold, and on the left a small share icon;
- "דברו איתם:" followed by three pill buttons, each a round face + a name: "חני", "אסנת", "יותם" - tapping one opens a chat with
  that character;
- a full-width dark button with a comment icon: "12 תגובות · כתבו לכולם או לאחת הדמויות";
- a slim link "משחקים עם חני ←" on its own line.`],
  ['C-comments-in-feed', [LIVE, LOGO, poster('haredit-5-dialogue'), face('hani'), face('osnat'), face('yotam')], `${SYSTEM}
THE COMMENTS, opened inside the feed: the video (attached poster) is still visible at the top, small (about 30% of the screen),
paused. Below it a bottom sheet fills the rest. Sheet title "12 תגובות" with a close X.
Three comments, each with a small round avatar (plain initial letter for viewers), a name, the text and "השב":
- "נועה": "חני, למה דווקא שבעה עשרים?" and, indented under it as a reply with Hani's round face, the name "חני פרידמן" and a
  small orange tag "הדמות ענתה": "כי עשרים אגורות זה עשרים אגורות, מאמי. ככה מתחילים חובות."
- "דור": "אסנת בסבלנות של מלאך"
- "מיכל": "יותם פשוט נעלם באמצע"
At the bottom of the sheet: a row "למי?" with pills "לכולם" (selected, orange), then three pills each with a small face and a
name "חני", "אסנת", "יותם"; under it a text field with the hint "כתבו תגובה..." and an orange send button.`],
];
const only = process.argv.slice(3);
for (const [key, images, prompt] of JOBS) {
  if (only.length && !only.includes(key)) continue;
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}
