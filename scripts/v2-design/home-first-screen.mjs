// Shlomiverse home - a new FIRST SCREEN on the phone (Shlomi, 2026-11-16: "suggest a new homepage with a design from OpenAI").
// The data (14 days, 1,665 new visitors landing home): 30% tap nothing and leave in ~17 s; a video or a game as the first tap
// keeps them ~170 s, but only 7% find one first - neither is on today's first screen (the big logo, the chat box, the
// simulation band, the faces row; the cookie sheet over the bottom). So: something to watch + one-tap doors above the fold.
// GPT Image, OpenAI direct (design key), today's live home screenshot as the style reference.
//   node scripts/v2-design/home-first-screen.mjs <dir with live.png + posters> [only-key ...]  ->  Documents/shlomiverse-v2-design/home-first-screen/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'home-first-screen');
fs.mkdirSync(OUT, { recursive: true });
const IN = process.argv[2];
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const LIVE = img(path.join(IN, 'live.png'), 'live.png', 'image/png');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/icon-512.png', 'logo.png', 'image/png');
const poster = (id) => img(path.join(IN, `${id}.jpg`), `${id}.jpg`);
const face = (id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `face-${id}.jpg`);

const SYSTEM = `A phone app screen mockup, flat full-screen screenshot (no device frame, no hand), 9:16.
App: "שלומיוורס" (Hebrew, right-to-left UI) - a comedy universe of characters from short comedy videos, treated as real people.
Visitors arrive from TikTok and Instagram, a few seconds after watching one of the videos.
The FIRST attached image is a screenshot of today's app: keep its style exactly - near-black background, dark rounded cards with
a faint 1px border, warm orange #ff6a1f as the only accent, white bold Hebrew titles, dim grey secondary lines, thin orange line
icons, and the same bottom navigation (בית, דמויות, סרטונים, קהילה, צ'אט). The logo is the attached planet logo, small, in the
top bar only (with a search icon and an orange "כניסה" button). Video frames use the attached video posters exactly as they are
(they are vertical phone videos with burned-in Hebrew subtitles). Characters appear as round portrait photos (the attached faces).
No hearts, no emoji, no cookie banner. All Hebrew right-aligned and spelled exactly as given.`;

const JOBS = [
  ['A-video-doors', [LIVE, LOGO, poster('haredit-5-dialogue'), face('hani'), face('yotam'), face('savta'), face('demokratovich')], `${SYSTEM}
THE HOME SCREEN, first screen only. What a newcomer gets at once, top to bottom:
1. The slim top bar.
2. A video already playing, muted, as the main element (about half the screen, rounded corners): the attached poster of Hani
   ("haredit-5-dialogue"), a small "מושתק - הקישו לסאונד" pill with a speaker-off icon, a thin orange progress line at its
   bottom edge, and over its lower part the title "חני באה להחזיר שבעה שקלים ועשרים" with a small round face of Hani and "חני פרידמן".
3. Right under it, three big equal buttons in one row, each a dark card with a large orange line icon and one word:
   "סרטונים" (play icon), "משחקים" (game controller icon), "דברו עם דמות" (speech bubble icon).
4. Peeking at the bottom, cut by the bottom navigation: the title "הסטוריז של הדמויות" and the top of a row of round faces
   with orange rings (the attached faces), so it is clear the page goes on.`],
  ['B-feed', [LIVE, LOGO, poster('savta-1'), face('savta'), face('hani'), face('yotam')], `${SYSTEM}
THE HOME SCREEN as a full-screen vertical video feed, the way the visitor watches on TikTok - the first screen IS a video:
the attached poster ("savta-1") fills the whole screen between the top bar and the bottom navigation, already playing, muted.
- At the top, over the video, three pill tabs: "סרטונים" (selected, orange), "משחקים", "צ'אט".
- On the LEFT edge (the RTL app's action column), stacked: the round face of the character with a small orange "+" (follow),
  a speech-bubble button labelled "דברו איתה", a share button.
- Over the bottom of the video: the title "לולה עלתה על המטפלת", under it "סבתא · לולה · אברם" in dim grey, and a small
  "מושתק - הקישו לסאונד" pill.
- Just above the bottom navigation, a small centred hint with an up-arrow: "החליקו לסרטון הבא".`],
  ['C-stories-cards', [LIVE, LOGO, poster('adam-1'), img(path.join(IN, 'game.jpg'), 'game.jpg'), face('yotam'), face('hani'), face('savta'), face('demokratovich'), face('rosenblum')], `${SYSTEM}
THE HOME SCREEN, first screen only, built from three things to tap, top to bottom:
1. The slim top bar.
2. A row of round faces with orange story rings right under it (the attached face-*.jpg photos, each used once and unchanged, names
   under them: "יותם", "חני פרידמן", "סבתא", "הרב דמוקרטוביץ", "המורה רוזנבלום") - the characters' stories.
3. A large card "עכשיו בשלומיוורס": the attached poster ("adam-1") playing muted inside it, the title "אדם עושה אול הנדס
   אחרי הגיוס" and an orange play button. It takes about 40% of the screen.
4. Two cards side by side under it: a game card whose picture is the attached image "game.jpg" EXACTLY (an illustrated
   woman in a long dark dress holding a paper bag, in front of glass hospital doors - NOT the logo), the title "דלת של שבת"
   and an orange "לשחק" button; and a chat card with three small overlapping faces, the title "דברו עם דמות" and the line "כל דמות עונה לכם".`],
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
  console.log('ok', key, j.usage ? JSON.stringify(j.usage) : '');
}
