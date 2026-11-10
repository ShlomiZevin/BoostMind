// הארכיון for everyone signed in (2026-11-10, his ask): his ~1,315 Instagram posts, newest first with month/year headers he sees
// while scrolling, the caption on every post (readable, searchable), search by words / hashtags / dates, ask to bring a post
// into the verse with a note. Plus where it lives on the home (for his review before building). GPT Image 2.5, the design key.
//   node scripts/v2-design/archive.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/archive/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/archive';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const REF = (f) => [new Blob([fs.readFileSync(path.join(OUT, f))], { type: 'image/png' }), f];

const APP = `App: "שלומיוורס" (Hebrew, right-to-left) - the home of a comedy universe of recurring characters (short vertical comedy
videos, chats with the characters, games). KEEP the app's own visual language exactly as in the attached screenshots (near-black
background, its orange accent, Heebo, glass cards, line icons, rounded pills) - this is one page of the same app, not a new
brand. No emoji. Every Hebrew word right-aligned, correctly spelled; numbers and dates in Hebrew style (נובמבר 2026, 9.11.2026).`;

const PAGE = `THE PAGE "הארכיון" - every Instagram post Shlomi ever made (1,315 posts since 2019), for signed-in residents. Jobs: find an
old video you remember fast - mostly by WHEN it was (he remembers videos by their time) and by words from its caption or a
hashtag; see what each post is; ask for one to be brought into the Shlomiverse (with a short note what you remember); watch the
ones already in the verse. Data per post: a vertical cover picture, date (e.g. 24.8.2024), likes (3.4K), comments (250), the
caption (Hebrew, a few lines, often ends with hashtags like #הייטק #שלומיוורס), whether it is already in the Shlomiverse (then
which characters, e.g. "אברם"), how many residents asked for it ("12 ביקשו") and whether I asked.
MUST HAVE: newest first; the month and year as big section headers ("אוגוסט 2024") that stay pinned at the top while scrolling
through that month, plus a way to jump straight to a year/month (a compact timeline); a search field that finds words in
captions, hashtags and dates ("2023", "אוגוסט"), with a row of popular hashtags as chips; the START OF THE CAPTION readable on
every post (2-3 lines under or on the cover), with its date; a clear "לבקש" (ask to bring it) action on posts not in the verse,
and a "בשלומיוורס" mark + "לצפייה" on posts already in it.`;

const JOBS = [
  ['A1-page-phone', ['now-phone-archive.png', 'now-phone-home.png'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
${PAGE} Show the top (title, one line about the page, search, hashtag chips, the timeline) and the first month section with its
pinned header and posts in two columns, captions readable.`],
  ['A2-page-phone-scroll', ['now-phone-archive.png', 'A1-page-phone.jpg'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
${PAGE} The SAME page as the second attached image (keep its look exactly), scrolled deep into the past: the pinned month header
"מרץ 2022" at the top, posts of March 2022 under it, and the next section header "פברואר 2022" coming up; a small floating year
scrubber on the side shows where you are (2022). One post shows it is already in the Shlomiverse.`],
  ['A3-post-sheet', ['now-phone-archive.png', 'A1-page-phone.jpg'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
${PAGE} The SAME page (second attached image) with ONE post opened as a bottom sheet over it: the cover bigger, the date and
month, likes and comments, the FULL caption with its hashtags as tappable tags, "לצפייה באינסטגרם", and the ask: a short text
field "מה אתם זוכרים מהסרטון? (לא חובה)" and a big orange "לבקש שיעלה לשלומיוורס" button, with "12 תושבים כבר ביקשו".`],
  ['A4-page-desktop', ['now-desk-archive.png', 'now-desk-home.png'], `A desktop web page mockup, flat browser viewport screenshot (no browser chrome), 1536x1024. ${APP}
${PAGE} On desktop: the timeline of years and months as a sticky column on the RIGHT side (Hebrew reads right to left), the
search and hashtag chips on top, the month sections with pinned headers and posts in 5 columns, each with its caption start.`],
  ['H1-home-phone-row', ['now-phone-home.png'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
A NEW home section that invites signed-in residents into "הארכיון" - all 1,315 old Instagram videos of Shlomi since 2019, which
they can browse by time and ask to bring into the Shlomiverse. Idea 1: a section titled "מהארכיון" with a horizontal row of old
covers, each with its year ("2021"), a line "1,315 סרטונים מ-2019 · בקשו מה יעלה לשלומיוורס", and a "לארכיון" button. For a
visitor who is not signed in it says "לתושבים בלבד" with a lock. Show it between the home's sections, with a bit above and below.`],
  ['H2-home-phone-card', ['now-phone-home.png'], `A mobile web screen mockup, flat phone screenshot (no device frame), 390px wide, 9:16. ${APP}
A NEW home section that invites signed-in residents into "הארכיון" - all 1,315 old Instagram videos of Shlomi since 2019, which
they can browse by time and ask to bring into the Shlomiverse. Idea 2: ONE wide feature card like a time machine - a collage of
old covers fanned by year (2019 ... 2025), a big title "הארכיון", "1,315 סרטונים שעוד לא כולם בשלומיוורס. מצאו את הישנים
ובקשו שיעלו.", and an orange "לחזור בזמן" button; for a visitor not signed in, a small "לתושבים בלבד" note. Show it between
the home's sections, with a bit above and below.`],
];

const only = process.argv.slice(2);
const run = async ([key, refs, prompt]) => {
  const desk = key.includes('desktop');
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', desk ? '1536x1024' : '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const f of refs) { const [blob, name] = REF(f); form.append('image[]', blob, name); }
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
};
// A1 first (A2/A3 use it as the reference), then the rest together
const jobs = JOBS.filter(([key]) => !only.length || only.includes(key));
const first = jobs.find(([k]) => k === 'A1-page-phone');
if (first) await run(first);
await Promise.all(jobs.filter((j) => j !== first).map(run));
