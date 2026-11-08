// Shlomiverse: the residents' own X - a news feed where they react to the day's real news and to what happens in the verse
// (his idea 2026-11-08: "my own X/Twitter for the characters, where they react to day-to-day stuff"). Mockups for the plan
// in Backstage → תוכניות. GPT Image 2.5 sunburst, OpenAI direct (design key), MEDIUM, today's home + the approved tap
// screen as the style reference, the real logo and real portraits.
//   node scripts/v2-design/feed.mjs [only-key ...]   ->  Documents/shlomiverse-v2-design/feed/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'feed');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const WIKI = 'C:/workspace/BoostMind/public/wiki';
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const STYLE_REF = img(`${DESIGN}/2-tap.jpg`, 'style.jpg');
const HOME_REF = img(`${DESIGN}/next-plan/ref-home.png`, 'home.png', 'image/png');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png', 'image/png');
const face = (id) => img(`${WIKI}/img/c/${id}.jpg`, `${id}.jpg`);

const SYSTEM = `A premium app screen mockup, flat full-screen screenshot (no device frame, no hand).
App: "שלומיוורס" (Hebrew, right-to-left UI) - Shlomi Zevin's comedy universe, where his characters are treated as REAL people
(residents of a parallel universe). FOLLOW THE ATTACHED STYLE REFERENCES (the first two images are the live design system):
near-black background with a warm orange glow, frosted dark glass cards, faint 1px borders, rounded corners, ONE accent -
warm orange #ff6a1f - for the one main action and the rings around faces. White text, dim grey secondary. The logo is the
attached glowing orange planet with its name on the ring (use it as is). Residents appear as round portrait photos (the
attached faces) - real people. One Hebrew sans (Heebo-like). Calm, boutique, warm, a bit playful. No hearts, no emoji. All
Hebrew right-aligned, short and correctly spelled.`;

const WHAT = `THE PRODUCT ON THIS SCREEN: "חדשוורס" - the verse's own news network / social feed. Every day real news arrives
(a headline from a real news site, with the source name and time) and the residents react in their own voice: short posts,
replies to each other, quoting each other, small feuds. The verse's own happenings are news too (a new video, a broken game
record, a new citizen). Visitors read; signed-in residents reply and can tag a resident with @ who then answers in person.
There are no like counts; the reaction is the resident's catchphrase "stamp".`;

const J = (key, size, faces, prompt) => [key, size, [STYLE_REF, HOME_REF, LOGO, ...faces.map(face)], prompt];
const JOBS = [
  J('F1-feed-by-story', '1024x1536', ['hani', 'avram', 'daniel', 'news-anchor'], `${SYSTEM}\n${WHAT}
PHONE SCREEN, CONCEPT A - "ORGANISED BY STORY". Top: the small planet logo + the feed's name "חדשוורס" and a thin live line
"עכשיו בוורס". A row of 3 filter chips: "הכול", "חדשות מהעולם", "קורה בוורס" (the first selected).
The feed is a list of STORIES: each story starts with the real headline as a crisp news card (source "ynet" + "לפני 40 דק׳",
headline "מחר: מחיר הדלק עולה ב־30 אגורות"), and under it, joined by a thin line, the residents' reactions stacked like a
mini-conversation: Hani's post (her face, name "חני", line "אצלנו ממילא הולכים ברגל. עם עגלה."), then
Avram replying to her ("אמרתי לך שהעגלה זה העתיד"), then a dim "עוד 3 תגובות". Then the next story card begins - a
verse event: "קורה בוורס" tag, a small vertical video thumbnail, "סרטון חדש: דניאל מנסה לפטר את ה־AI" with Daniel's face.
Bottom: the site's navigation bar.`),

  J('F2-feed-by-people', '1024x1536', ['hani', 'yotam', 'osnat', 'demokratovich', 'news-anchor'], `${SYSTEM}\n${WHAT}
PHONE SCREEN, CONCEPT B - "A TIMELINE OF PEOPLE". Top: a horizontal row of round faces "מי מדבר היום" (the attached faces,
orange ring on those who posted in the last hour). Then a classic timeline, one post per card: the resident's face and name
on the right, the time, the post text big and readable. Post 1: Rabbi Demokratovich "הודעה רשמית: הגבול ייסגר ב־16:00
לצורך הצבעה האם הגבול קיים." Post 2: Yotam QUOTING a real headline (a small embedded news card "גלובס · ענקית הטכנולוגיה
מפטרת 2,000 עובדים") with his line "אצלנו לא מפטרים. אצלנו עושים התאמה ארגונית." Post 3: Osnat replying to Yotam.
Each post ends with small glass actions: reply, the catchphrase stamp (a small orange planet), share. Visitors never write posts (only
replies), so there is no compose button; at the bottom a slim glass bar "להגיב בשם שלכם · כניסה".`),

  J('F3-thread', '1024x1536', ['hani', 'avram', 'rosenblum'], `${SYSTEM}\n${WHAT}
PHONE SCREEN - ONE STORY OPENED (the thread). Top: back arrow and "חדשוורס". The real headline card at the top (source
"N12", time, headline "משרד החינוך: שבוע לימודים של ארבעה ימים"). Under it the residents' thread: Rosenblum the teacher
("ארבעה ימים? אני לא מספיק לכעוס בחמישה."), Hani ("ומה אני עושה איתם ביום שישי?"), Avram replying to Hani.
Then a divider "תגובות התושבים" (the site's visitors) with two visitor replies (small generic avatars and nicknames); one of
them tags "@חני" and right under it Hani's own answer, marked with her face and a small orange line connecting it.
Bottom: a frosted reply box "כתבו תגובה, או @ לתושב" with an orange send button.`),

  J('F4-resident-page', '1024x1536', ['hani'], `${SYSTEM}\n${WHAT}
PHONE SCREEN - A RESIDENT'S PAGE, the "חדשוורס" tab. Top: Hani's big round portrait, name "חני", one dim line about her
("בני ברק"), a follow pill (orange) and a bell. Tabs: "פוסטים" (selected), "סרטונים", "משחקים", "סטיקרים".
Her posts, newest first: two text posts reacting to headlines (each with a tiny embedded headline card and source), and one
"קורה בוורס" post announcing her new game record ("מישהו שבר לי את השיא בחנוכיה. אני יודעת מי אתה.").`),

  J('F5-home-entry', '1024x1536', ['hani', 'yotam', 'demokratovich', 'news-anchor', 'vova'], `${SYSTEM}\n${WHAT}
PHONE SCREEN - THE HOME PAGE, scrolled just below the hero (the hero's glowing logo is only at the very top edge). A new
band "מה קורה בוורס עכשיו": a short live strip - the newest 3 posts as compact glass cards side by side that scroll
sideways (face, name, one line, time). EXACTLY these three, nothing else: Hani "חני" - "מחר הדלק עולה? אצלנו ממילא
הולכים ברגל."; Yotam "יותם" - "אצלנו לא מפטרים. עושים התאמה."; the news anchor "מגיש החדשות" - "ערב טוב. הפרטים: נתניהו.".
The word "וורס" is spelled exactly ו-ו-ר-ס. with a small pulsing orange dot "חי" and a link "לחדשוורס". Under it the existing
home content continues (a row "סרטונים אחרונים" with vertical video posters). Bottom: the navigation bar with 5 items.`),

  J('F6-backstage-board', '1536x1024', ['hani', 'yotam', 'rosenblum', 'news-anchor', 'osnat'], `${SYSTEM}
DESKTOP ADMIN SCREEN - the creator's private "Backstage" (dark, same design system, denser). Page "חדשוורס · היום".
Top right: a big switch "יום שקט" (silence the whole feed today) with a dim line "נכבה אוטומטית ביום פיגוע או אסון", and a
status chip "הבוקר: יום רגיל · 5 טיוטות". The main area: today's drafted posts as rows, each: the real headline it reacts to
(source + time), the resident's face and name, the drafted post text, and three buttons: an orange "לפרסם", "לערוך",
"לדלג". On the left a narrow column "הסיפור של היום" - a vertical timeline morning / noon / evening with the residents who
post in each window, and a small cost line "היום: 18¢".`),

  // the sub-brand mark next to the planet (Terra's three concepts; the lettering will be set in code - the image only shows the idea)
  ['L1-logo-ring-ticker', '1024x1024', [LOGO], `A logo design sheet on a near-black background. The attached glowing orange planet logo is the parent brand.
Design its sub-brand mark for the verse's own news network "חדשוורס": the same planet, whose ring stretches out to the left
and turns into a thin news ticker line with three small glowing update dots. Next to it the word "חדשוורס" in bold modern
Hebrew letters (white, with "וורס" in orange, like the parent wordmark). Show it large in the centre, and below it small: an
app-icon version (rounded square) and a one-line horizontal version. Clean vector look, glow like the parent. No other text.`],
  ['L2-logo-stamp', '1024x1024', [LOGO], `A logo design sheet on a near-black background. The attached glowing orange planet logo is the parent brand.
Design its sub-brand mark for the verse's own news network "חדשוורס" as an OFFICIAL SEAL: a round broadcast-authority stamp,
a small planet with its orbit ring in the centre, a ring of fine ticks around it, like the seal of a state broadcaster in a
parallel universe. Next to it the word "חדשוורס" in bold modern Hebrew letters (white, "וורס" in orange). Show it large in the
centre, and below it small: an app-icon version and a one-line horizontal version. Clean vector look. No other text.`],
  ['L3-logo-bubble-orbit', '1024x1024', [LOGO], `A logo design sheet on a near-black background. The attached glowing orange planet logo is the parent brand.
Design its sub-brand mark for the verse's own news network "חדשוורס": a rounded speech bubble crossed by the thin orange orbit
ring of a planet, so the bubble itself becomes the planet. The bubble dark charcoal with a soft rim light, the ring glowing
orange. Next to it the word "חדשוורס" in bold modern Hebrew letters (white, "וורס" in orange). Show it large in the centre,
and below it small: an app-icon version and a one-line horizontal version. Clean vector look. No other text.`],
  ['L4-logo-versia', '1024x1024', [LOGO], `A logo design sheet on a near-black background. The attached glowing orange planet logo is the parent brand.
Design its sub-brand mark for the verse's own news network, the alternative name "ורסיה" (a "version" of reality): the planet's
ring forms the letters' underline and continues as a thin live ticker. The word "ורסיה" in bold modern Hebrew letters, white
with the ring in orange. Show it large in the centre, and below it small: an app-icon version and a one-line horizontal
version. Clean vector look, glow like the parent. No other text.`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, size, images, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', size);
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) return console.log('FAILED', key, res.status, j.error?.message);
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
