// A new Hani game -> a story from Hani on the Shlomiverse (his question, 2026-11-02: "how will it look?"). Two concepts
// of the full-screen story, GPT Image 2.5 (OpenAI direct, MEDIUM); a real game cover + Hani's portrait as references.
//   node scripts/v2-design/game-story.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/golive/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'golive');
const ROOT = 'C:/workspace/BoostMind/public';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const REFS = [img(`${DESIGN}/2-tap.jpg`, 'app-style.jpg'), img(`${ROOT}/hani-games/gan-run/cover.jpg`, 'game-cover.jpg'), img(`${ROOT}/wiki/img/c/hani.jpg`, 'hani.jpg')];

const WHAT = `A flat full-screen phone screenshot (no device frame), 9:16, of a STORY in the Hebrew (right-to-left) web app
"שלומיוורס" - a comedy universe whose characters post short stories between videos, like Instagram stories. The app's
style is in the first attached screenshot (near-black, warm orange accent #ff6a1f, frosted glass, Heebo-like Hebrew sans,
no emoji). This story is posted by the character "חני פרידמן" (her portrait attached) and announces a NEW GAME on her kosher
games site "המשחקייה של חני": the game "4:20 – רצים לגן!" (its cover art attached - landscape 4:3, use it whole, not
cropped beyond recognition), tagline "השעה 4:20, ומלכי מחכה בגן בבני ברק – רכבת קלה או שני אוטובוסים?".
What the story must carry: the story progress bars at the top; the poster's round portrait, name "חני פרידמן", "לפני 5 דק׳",
a "עוקבים" pill and a close X; a small label that this is a new game; the game's cover and title; one line in Hani's own
voice; one clear call-to-action button "לשחק עכשיו" that opens the game; the people who watch can still tap to the next
story. All Hebrew right-aligned and correctly spelled.`;

const JOBS = [
  ['W-game-story-a', `${WHAT}
Hani's line: "ברוך השם, משחק חדש! מי מגיע ראשון לגן?"`],
  ['W-game-story-b', `${WHAT}
Hani's line: "תגידו לי אתם - רכבת או אוטובוס? משחק חדש בבית!"
Make this concept clearly different from an obvious centered card: think about how the game itself could fill the story.`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of REFS) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
