// Shlomiverse v2: "סרטון אישי" - a personal video request on the community page (Shlomi, 2026-11-12: a viewer asked through
// "בקשת סרטון" for a Yotam video for her husband's birthday; "add in קהילה a request for a personal video - choose a character,
// the date of the event, what the event is, then the details"). GPT Image, OpenAI direct (design key), with today's live
// community page as the style reference.
//   node scripts/v2-design/personal-video.mjs <live-tiles.png> [only-key ...]  ->  Documents/shlomiverse-v2-design/personal-video/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'personal-video');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const LIVE = img(process.argv[2], 'live.png', 'image/png');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/icon-512.png', 'logo.png', 'image/png');
const face = (id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `${id}.jpg`);
const FACES = ['yotam', 'hani', 'savta', 'demokratovich', 'rosenblum'].filter((id) => fs.existsSync(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`)).map(face);

const SYSTEM = `A phone app screen mockup, flat full-screen screenshot (no device frame, no hand), 9:16.
App: "שלומיוורס" (Hebrew, right-to-left UI) - a comedy universe where the characters are treated as real people.
The FIRST attached image is a screenshot of the live app: match it exactly - near-black background, dark rounded cards with a faint
1px border, warm orange #ff6a1f as the only accent, white bold Hebrew titles, dim grey secondary lines, thin orange line icons,
the bottom navigation (בית, דמויות, סרטונים, קהילה, צ'אט). Characters appear as round portrait photos (the attached faces).
No hearts, no emoji. All Hebrew right-aligned and spelled exactly as given.`;

const JOBS = [
  ['A-tiles', [LIVE, LOGO, ...FACES.slice(0, 2)], `${SYSTEM}
THE COMMUNITY PAGE, the tiles area (as in the screenshot), now with FOUR tiles in a 2x2 grid of equal cards:
"שאלו דמות" / "כל דמות עונה בצ׳אט" (speech-bubble icon), "בקשת סרטון" / "יש רעיון לסרטון? ספרו לנו" (play icon),
a NEW tile "סרטון אישי" / "לאירוע שראוי לתיעוד" - it is a viewer's way to ask a character for a short personal video for
someone they love (a birthday, a wedding); make it the most inviting of the four, with a small round face of a character
peeking in, and "משהו לא עובד?" / "ספרו לנו ונתקן" (bug icon). Above them the sticker cards as in the screenshot, under them
the business card.`],
  ['B-sheet', [LIVE, LOGO, ...FACES], `${SYSTEM}
A tall bottom sheet over the dimmed community page: the form "בקשה לסרטון אישי", sub-line "יום הולדת, חתונה או אירוע אחר".
What the viewer does here: picks which character will star in the video, gives the date of the event and what the event is,
and writes as much as they can about the person it is for. Fields, top to bottom:
1. "איזו דמות תרצו בסרטון?" - the characters as round faces (the attached faces) that can be picked, one picked (Yotam).
2. "תאריך האירוע" - a date field.
3. "מה חוגגים?" - a one-line field with the hint "למשל: יום הולדת 40 לאבא".
4. A large text area with this hint inside it, in full: "תכתבו כמה שיותר פרטים: מידע, טריוויה, וכמה שיותר אישי. כמה שיותר
ג'וס ורכילות (ואפשר גם רעל :) ) על הבן אדם שזה נועד עבורו."
5. A small dim line: "השלומיוורס יעשה מאמץ לשלוח. לא התחייבות."
6. A full-width orange button "שולחים לשלומיוורס".`],
  ['C-sheet', [LIVE, LOGO, ...FACES], `${SYSTEM}
A full-screen page (not a sheet) for asking the Shlomiverse for a personal video for someone - a birthday, a wedding, an
anniversary. The viewer picks the character who will star in it, sets the date of the event, says what the event is, and then
writes everything about the person it is for. Title "בקשה לסרטון אישי", sub-line "יום הולדת, חתונה או אירוע אחר".
The character choice: "איזו דמות תרצו בסרטון?" with the attached faces, Yotam picked. Then "תאריך האירוע" and "מה חוגגים?"
(hint "למשל: יום הולדת 40 לאבא") side by side. Then the biggest element on the page, a text area whose hint reads in full:
"תכתבו כמה שיותר פרטים: מידע, טריוויה, וכמה שיותר אישי. כמה שיותר ג'וס ורכילות (ואפשר גם רעל :) ) על הבן אדם שזה נועד עבורו."
Under it a dim line "השלומיוורס יעשה מאמץ לשלוח. לא התחייבות." and the orange button "שולחים לשלומיוורס".`],
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
