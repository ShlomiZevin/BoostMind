// The character sites on the Shlomiverse home (2026-11-01): the bio now points to shlomiverse.com instead of /links/,
// and only /links/ listed every character's own site. He: "maybe we need another panel on the Shlomiverse for the links"
// / "use OpenAI to design it". GPT Image 2.5 (OpenAI direct, MEDIUM), the current home + the links page as references.
//   node scripts/v2-design/sites-panel.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/golive/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'golive');
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const HOME = img(`${OUT}/home-series.png`, 'home-now.png', 'image/png');
const LINKS = img(`${OUT}/links-sites.png`, 'sites-list-now.png', 'image/png');
const STYLE_REF = img(`${DESIGN}/2-tap.jpg`, 'style.jpg');

const SITES = `Techy-Tech (האתר של טקי-טק), איילת השחר (תקשור · אנרגיה · תודעה), קהילת שערי בג"ץ (שאל את הרב · תרומות),
המשחקייה של חני (משחקים כשרים למהדרין), אופנת חני (מטפחות ובגדים צנועים), שפע עד (חוברת ההנחות), מאפיית ברכת השפע,
משפחת פרידמן (עץ המשפחה של חני), HINDSIGHT VIP (הקבוצה הסגורה של נהור), דורית מרקורי (התחזית לבחירות), אבי בלונים ואירועים,
Homo Useless (הספר של יובל), YOTAMVERSE (החולצות של יותם)`;

const SYSTEM = `A premium mobile web screen mockup, flat full-screen phone screenshot (no device frame), 9:16.
App: "שלומיוורס" (Hebrew, right-to-left) - the wiki of a comedy universe: characters, videos, and each character's OWN
real-looking website. FOLLOW THE FIRST ATTACHED SCREENSHOT (the current home: its top bar, bottom tab bar, cards, colours,
fonts) exactly; the second attachment is the old list of the characters' sites with their real icons/logos - reuse those
icons. Style: near-black, warm orange glow, frosted dark glass cards, 1px faint borders, 18-24px corners, ONE accent
orange #ff6a1f, white text, dim grey secondary, line icons, no emoji. Hebrew right-aligned, correctly spelled.`;

const JOBS = [
  ['S-sites-home', `${SYSTEM}
A NEW SECTION on the home, in the same rhythm as the other sections ("סרטונים אחרונים", "הכירו את הדמויות", "הסדרות"):
section title "האתרים של הדמויות" with a dim line under it "כל דמות והאתר שלה. הכול אמיתי, כמובן." and a dim link "כל
האתרים ←" at the left. Below it a HORIZONTAL SWIPE ROW of site cards (2.3 cards visible, the next one peeking): each card
is a tall glass tile, the site's logo/icon big and round at the top (from the reference list), the site's bold name, one
dim line about it, the character's small round face in a corner, and a small "לאתר ↗" chip. The cards: ${SITES}.
Show the section with the "הסדרות" cards partly visible above it and the bottom tab bar.`],
  ['T-sites-page', `${SYSTEM}
A NEW PAGE "האתרים של הדמויות" (opened from "כל האתרים ←" on the home), with the app's top bar and bottom tab bar. A short
dim intro line "כל דמות בשלומיוורס מנהלת את העסק שלה. הנה כולם." then a 2-COLUMN GRID of compact glass tiles: the site's
logo/icon (from the reference), bold name, one dim line, and the owner's small round face; tiles grouped under small dim
headers by world: "טקי-טק", "העולם החרדי" (Hani's sites, שערי בג"ץ), "הרוחניים" (איילת השחר, דורית מרקורי), "עוד" (the rest).
Sites: ${SITES}.`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of [HOME, LINKS, STYLE_REF]) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
