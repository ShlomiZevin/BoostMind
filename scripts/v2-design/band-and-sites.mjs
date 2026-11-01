// Round 2 (2026-11-01, his notes on the phone): the home's community band "doesn't look good" (a card inside a card, a
// huge button, an empty dashed box, two stacked promo cards), and the sites page grouped "Hani and the rest" was lazy -
// group by subject and put effort in. GPT Image 2.5 (OpenAI direct, MEDIUM); the live screenshots as the reference.
//   node scripts/v2-design/band-and-sites.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/golive/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'golive');
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const STYLE_REF = img(`${DESIGN}/2-tap.jpg`, 'style.jpg');

const SYSTEM = `A premium mobile web screen mockup, flat full-screen phone screenshot (no device frame), 390px wide, 9:16.
App: "שלומיוורס" (Hebrew, right-to-left) - the home of a comedy universe of characters. KEEP the app's top bar and bottom
tab bar exactly as in the attached current screenshot. Style: near-black #0b0b0e, warm orange glow, frosted dark glass,
1px faint borders, 18-24px corners, ONE accent orange #ff6a1f used sparingly, white text, dim grey secondary text, line
icons, no emoji, Heebo-like Hebrew sans, generous but not wasteful spacing - mobile first, nothing nested more than one
level, no card inside a card. All Hebrew right-aligned and correctly spelled.`;

const SITES = `Topics and their sites (each site: its share picture, name, one line):
"חנויות": אופנת חני (מטפחות ובגדים צנועים), שפע עד (חוברת ההנחות), מאפיית ברכת השפע (עיגוליות וגלגליות), YOTAMVERSE (החולצות של יותם), אבי בלונים ואירועים (קשתות בלונים).
"משחקים": המשחקייה של חני (משחקים כשרים למהדרין) with 5 small game covers inside its card.
"רוחניות ותחזיות": איילת השחר (תקשור, אנרגיה, תודעה), דורית מרקורי (התחזית לבחירות).
"קהילה ודת": קהילת שערי בג״ץ (שאל את הרב, תרומות).
"עסקים והייטק": Techy-Tech (האתר של טקי-טק), HINDSIGHT VIP (הקבוצה הסגורה של נהור).
"ספרים, משפחה ותרבות": Homo Useless (הספר של יובל), משפחת פרידמן (עץ המשפחה של חני).`;

const JOBS = [
  ['U-band', [img(`${OUT}/band1.png`, 'band-now.png', 'image/png'), STYLE_REF], `${SYSTEM}
REDESIGN this home section (the attached screenshot is the current, messy one). Content, top to bottom:
1) A section title "מה הלאה בשלומיוורס?" with the dim line "רעיונות של הצופים לפרקים, לדמויות ולמפגשים" and a dim
   "לכל הרעיונות ←" link on the left of the title row (same rhythm as other home sections - no wrapping box).
2) Since there are no ideas yet: ONE inviting compact prompt row instead of an empty dashed box - a glass row with a small
   lightbulb line icon, the text "יש לכם רעיון לפרק הבא?" and a compact orange pill button "הציעו רעיון" (normal size, not huge).
3) Two compact side-by-side tiles (each half width): "שאלו דמות" with 3 small overlapping round character faces and a
   tiny "לשאול עכשיו ←", and "לעסקים" with the small glowing planet logo and "שיתופי פעולה ←". Short titles, one line each.
Show a bit of the section above and below for context.`],
  ['V-sites-topics', [img(`${OUT}/m-sites-1.png`, 'sites-now.png', 'image/png'), STYLE_REF], `${SYSTEM}
REDESIGN the page "האתרים של הדמויות" (the attached screenshot is the current one: a 2-column grid grouped by owner - he
called it lazy). New page, top to bottom: the title "האתרים של הדמויות", a dim intro line "אתרים, חנויות, קבוצות וטפסים
שאפשר למלא, אם זה באמת מה שרוצים.", then a horizontally scrolling row of TOPIC CHIPS (each with a small line icon: bag,
gamepad, sparkles/moon, synagogue/community, briefcase, book) to jump to a topic. Then the topics as sections, each with
its icon + title + count, and its sites as cards: a section with ONE site shows a single wide horizontal card (picture on
the right ~40%, name + line + the owner's small round face + "לאתר ↗" on the left) so there are never half-empty rows;
sections with several sites use 2-column cards with the share picture on top. Show the top of the page with the chips,
the "חנויות" section, and the start of "משחקים". ${SITES}`],
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
