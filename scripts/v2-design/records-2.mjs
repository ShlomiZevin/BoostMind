// שיאי היום, round 2 (2026-11-09, his notes): the home's records cards are "ugly" and crowded (game, crown, initial, name,
// town, score, unit, button - all stacked), the 8th card can't be reached on desktop, and he asks for a page of its own.
// Also: the desktop rows scroll with a grey browser scrollbar he doesn't like, and "מה הלאה" looks stretched on desktop.
// GPT Image 2.5 (OpenAI direct, MEDIUM, the design key); the live screenshots as the reference. Round 1 = records.mjs.
//   node scripts/v2-design/records-2.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/records/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'records');
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const NOW = (f) => [new Blob([fs.readFileSync(path.join(OUT, f))], { type: f.endsWith('.jpg') ? 'image/jpeg' : 'image/png' }), f];

const APP = `App: "שלומיוורס" (Hebrew, right-to-left) - the home of a comedy universe of recurring characters; visitors watch
their videos, chat with them and play short browser games starring them. KEEP the app's own visual language exactly as in the
attached current screenshot (its top bar, near-black background, its orange accent, its fonts, glass cards, line icons) - this
is a redesign of one part, not a new brand. No emoji. All Hebrew right-aligned and correctly spelled.`;

const DATA = `The data ("שיאי היום" = today's records - the board resets every day): 8 games, each with its cover art (painted
cartoon art, like in the screenshot) and title: פקי-טק, שמעת על הקורקינט שלי?, פילאי פלואים, הטיסה פנימה, מה אני אגיד לך?,
מילימטרים, 4:20 – רצים לגן!, הסטיקר של חני. For each game today: the leader (a nickname like "מהקומה של אברם" or "משה", their
small round profile photo, sometimes only an initial), their score with its unit (4770 נקודות, 20 מאזינים, 17 כוכבים, 1530
נקודות), the 2nd and 3rd places (nickname + score), how many people played today (e.g. 23 שיחקו היום), and - when the visitor
already played - the visitor's own place today ("אתם במקום 4"). Jobs: see at a glance who leads each game today, feel "I can
beat that", start playing in one tap, and get to the full board.`;

const JOBS = [
  ['R1-home-phone', ['now-phone-records.png'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
REDESIGN the home page section "שיאי היום" (the attached screenshot is the current one: tall cards with everything stacked -
he called them ugly). It must read in one glance and show more than two games without feeling crowded, and lead to a page of
its own ("לכל השיאים ←" on the title row). ${DATA}
Show the section title row and the new section, with a bit of the sections above and below for context.`],
  ['R2-home-phone-b', ['now-phone-records.png'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
REDESIGN the home page section "שיאי היום" - a DIFFERENT idea from a row of tall cards: think of it as a live scoreboard of
the day that makes people want to compete, compact, with the leaders' faces. It leads to a page of its own ("לכל השיאים ←").
${DATA}
Show the section title row and the new section, with a bit of the sections above and below for context.`],
  ['R3-page-phone', ['now-phone-records.png'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
DESIGN a new page of its own: "שיאי היום" (address /records) - the full board of today's records for every game in the verse.
Top: the title, a dim line "כל יום מתחילים מחדש · מתאפס בחצות", and a small live line like "112 שחקנים היום". Then every
game, readable and calm: the game's art and title, today's top 3 with faces and scores, how many played, the visitor's own
place when they played, and a clear "לשבור את השיא" action. ${DATA}
Show the top of the page and the first three games.`],
  ['R4-home-desktop', ['now-desk-records.png'], `A desktop web page mockup, flat browser viewport screenshot (no browser chrome), 1536x1024. ${APP}
REDESIGN the home page section "שיאי היום" for a wide desktop screen (the attached screenshot is the current one: 7 tall
cards in a row, the 8th cut off at the edge with no way to reach it - he cannot scroll sideways with a mouse). On desktop every
game must be reachable with a mouse (clear round arrow buttons on the row's sides, or a layout that fits all 8), no grey
browser scrollbar anywhere, and a "לכל השיאים ←" link to the page of its own. ${DATA}
Show the top bar, the section, and the top of the next section.`],
  ['R5-next-desktop', ['now-desk-next.png', 'now-desk-sites.png'], `A desktop web page mockup, flat browser viewport screenshot (no browser chrome), 1536x1024. ${APP}
REDESIGN for a wide desktop screen two home sections that look stretched and empty there today (the attached screenshots):
1) "מה הלאה בשלומיוורס?" ("פה עושים יותר מלצפות") - the things a visitor can do: סטיקר מהרגע (עצרו פריים, כתבו מה שבא לכם
ושלחו בוואטסאפ - with a sticker of a character), הסטיקרים של כולם (stickers other visitors made, straight to WhatsApp), דברו
איתם (every character answers in its own voice), עקבו אחריהם (what's new with them reaches you), סטוריז (today's stories, with
a character's face), משחקים (short, free, one tap), האתרים שלהם (shops and services). Today they are full-width rows with a
lot of empty dark space between an icon on the right and a picture on the left. Make them a balanced desktop layout where each
item has presence (a picture or the character), nothing a mile apart.
2) Below it, the start of "האתרים של הדמויות" - a horizontal row of site cards: on desktop no grey browser scrollbar; round
arrow buttons on the sides to move the row, and the cards fully visible.`],
  // round 2b: R1/R2 put 4 cards across a phone (too small), R4 kept the crowded card - the home in R3's language (the page)
  ['R6-home-phone-rows', ['now-phone-records.png', 'R3-page-phone.jpg'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
REDESIGN the home page section "שיאי היום" as a SHORT PREVIEW of the page of its own (the second attached image is that page,
approved - use its look). On the home only the leaders: one slim row per game - the game's small square art, its title, the
leader's round face + nickname + score with its unit, and a small play arrow; 4 games shown, then a full-width "לכל 8 השיאים ←"
button to the page. Rows are easy to read at phone size (big enough text), calm, nothing stacked inside a row. ${DATA}
Show the section title row and the section, with a bit of the sections above and below for context.`],
  ['R7-home-desktop-rows', ['now-desk-records.png', 'R3-page-phone.jpg'], `A desktop web page mockup, flat browser viewport screenshot (no browser chrome), 1536x1024. ${APP}
REDESIGN the home page section "שיאי היום" for a wide desktop screen as a preview of the page of its own (the second attached
image is that page on a phone, approved - use its look): ALL 8 games fit without any sideways scrolling - two columns of 4 slim
rows; each row: the game's small art, its title, the leader's round face + nickname + score with its unit, the 2nd place small
and dim, and a "לשחק" pill. A "לכל השיאים ←" link on the title row. No grey browser scrollbar anywhere. ${DATA}
Show the top bar, the section, and the top of the next section.`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, refs, prompt]) => {
  const desk = key.includes('desktop');
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', desk ? '1536x1024' : '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const f of refs) { const [blob, name] = NOW(f); form.append('image[]', blob, name); }
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
