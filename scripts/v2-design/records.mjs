// Round 6 (2026-11-03, his plan ask): a DAILY RECORD per game, as a platform feature - on the home, on the game page,
// and a moment when a player makes the record. Players must be signed in to play. GPT Image 2.5 (OpenAI direct,
// MEDIUM); the live home and game page as references. Planning only - nothing built from these yet.
//   node scripts/v2-design/records.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/records/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/records';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const HOME = img(`${OUT}/home-now.png`, 'home-now.png'), GAME = img(`${OUT}/game-now.png`, 'game-page-now.png');

const SYSTEM = `A premium mobile web screen mockup, flat full-screen phone screenshot (no device frame), 390px wide, 9:16.
App: "שלומיוורס" (Hebrew, right-to-left), a comedy universe of characters with videos and short games. Style: exactly
the attached screenshots - near-black, glass, ONE accent orange #ff6a1f, white text, line icons, no emoji, Hebrew
sans, all Hebrew right-aligned and correctly spelled.`;

const WHAT = `What we are building: DAILY RECORDS for the characters' games. Every game has a score (e.g. Yaniv's
"מילימטרים" counts treatments, Hani's "פילאי פלואים" counts stars, Asaf's "מה אני אגיד לך?" counts points). Each day
starts fresh. Players are signed in, so every score has a person: the nickname they chose on the site (big, e.g.
"צופה מהספה", "דניאלה הגדולה") and their Google first name (small, e.g. "דניאלה"), with their round photo or initial.
The jobs: a visitor sees at a glance who holds today's record in each game and wants to beat it; a player who made
the record feels famous for the day; a player always knows their own place.`;

const JOBS = [
  ['R-home', [HOME, GAME], `${SYSTEM}
${WHAT}
Design the HOME screen section "שיאי היום" (today's records), placed right under the attached "משחקים חדשים" row:
a short dim line ("כל יום מתחילים מחדש"), then one compact card per game showing the game's cover thumbnail and name,
today's record holder (photo, nickname big, first name small), the score with its unit, and a small "לשבור את השיא"
action. The top holder of the day should feel celebrated (a subtle crown or glow), not childish.`],
  ['R-table', [GAME, HOME], `${SYSTEM}
${WHAT}
Design the RECORDS SHEET on a game's page: the attached game page has a rail beside the game (לייק, תגובות, שמירה,
שיתוף); a new rail button "שיאים" opens a bottom sheet over the page: the game's name, "שיאי היום" with a clear table
of the top 10 (place, photo, nickname, first name small, score), places 1-3 highlighted, and the signed-in player's
own row pinned at the bottom ("את/ה במקום 14 · 9 טיפולים") with "עוד ניסיון" button.`],
  ['R-moment', [GAME, HOME], `${SYSTEM}
${WHAT}
Design the MOMENT a player breaks today's record, shown by the platform over the game page right after the game
ends: a celebratory but classy card - "שיא יומי חדש!", the player's photo and nickname big, the score, "עקפת את
<previous holder nickname>", and two buttons "לטבלת השיאים" and "לשתף". Behind it the game page dimmed.`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, images, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
