// Shlomi's ONE admin page (2026-11-01): Backstage + the stats page merged into a powerful admin tool - status, dashboard,
// stats with drill-down, who registered when, the conversations in a convenient reader, and asking the data questions.
// He: "make it all very clear and very easy to understand ... a really admin, super powerful tool". GPT Image 2.5, MEDIUM.
//   node scripts/v2-design/admin.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/admin/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'admin');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const STYLE = img(`${DESIGN}/2-tap.jpg`, 'style.jpg');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png', 'image/png');
const FACES = ['hani', 'yotam', 'rosenblum'].map((id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `${id}.jpg`));

const SYSTEM = `A premium admin dashboard app screen mockup, flat full-screen screenshot (no device frame).
App: "מאחורי הקלעים" - the private admin of "שלומיוורס" (Hebrew, right-to-left), a comedy universe site where visitors
watch videos and chat with AI characters. Style (see the style reference): near-black #0b0b0e, frosted dark glass cards,
1px faint borders, 16-20px corners, ONE accent orange #ff6a1f, green for "up", white text, dim grey labels, line icons,
no emoji, Heebo-like Hebrew sans, tabular numbers. Clear and easy: big numbers with a small trend, short labels, nothing
cramped. The small glowing planet logo (attached) top right. Round character portraits (attached) where characters
appear. All Hebrew right-aligned and correctly spelled. Tabs at the bottom on a phone: סקירה, שיחות, נתונים, אנשים, עוד.`;

const JOBS = [
  ['A-overview-phone', '1024x1536', `${SYSTEM}
PHONE, the OVERVIEW tab. Top: "ערב טוב, שלומי" and a date range switch (היום · 7 ימים · 30 ימים). A 2x3 grid of KPI cards,
each a big number + a tiny sparkline + "+12% מאתמול": מבקרים 1,240 · נרשמו 37 · שיחות 305 · הודעות לדמויות 612 · צפיות
בסרטונים 880 · עלות הצ'אט $7.40. Then a card "צריך את תשומת הלב שלך" with 3 rows (a new request, a comment to check, an idea),
each with an arrow. Then "מה קורה עכשיו" - a live feed of 4 rows: a face + "מישהו מדבר עם חני", "נרשם/ה: dana@...", time.
Then a bar chart card "מבקרים ביום" (14 bars). Everything tappable for drill-down (small chevrons).`],
  ['B-conversations-phone', '1024x1536', `${SYSTEM}
PHONE, the CONVERSATIONS tab - a convenient reader. Top: a search field "חיפוש בשיחות", then filter chips: הכול · מסומנות
בכוכב · ארוכות · היום, and a row of small round character faces to filter by character (with counts). Then a list of
conversation rows like an inbox: the character's round face, the visitor's first question in bold one line ("חני, מה
מבשלים לשבת?"), a dim second line with the start of the answer, on the left the time, the number of messages and a small
star outline (one row has a filled orange star). Signed-in visitors show a tiny "רשום/ה" pill with their name. Bottom
half: one conversation OPEN as a sheet sliding up, showing chat bubbles exactly like a messaging app (visitor bubbles
orange, character bubbles dark with her face), a star button and "סמנו כמצחיק" at the top of the sheet.`],
  ['C-people-phone', '1024x1536', `${SYSTEM}
PHONE, the PEOPLE tab. Top: three numbers "רשומים 30 · השבוע +12 · היום +3", then a small bar chart "הרשמות ביום" (30 days).
Then a search field and chips: הכול · שלומיוורס · מהאתרים · היום. Then a list of people: avatar or initials, name, email
in dim LTR, "נרשם/ה 1.11.2026, 17:10", tiny pills of where they came from (שלומיוורס / איילת השחר). Bottom half: ONE PERSON
opened as a sheet: big avatar, name, email, "נרשם/ה 1.11.2026 17:10 · נראה/תה לאחרונה לפני 3 דק'", 4 small stats
(שיחות 6 · תגובות 2 · רעיונות 1 · פניות 0), then their timeline: "שאל/ה את חני..." , "הגיב/ה על סרטון...", each with time.`],
  ['D-data-desktop', '1536x1024', `${SYSTEM}
DESKTOP 16:10, the DATA tab (stats + drill-down + asking questions). Right: a vertical sidebar with the logo and tabs
(סקירה, שיחות, נתונים, אנשים, פניות, תוכן, פרסום). Main area top: a big "שאלו את הנתונים" box with a sparkle icon:
"כמה אנשים נרשמו מטיקטוק השבוע?" and under it an answer card "23 נרשמו מטיקטוק השבוע - 61% מכל ההרשמות" with a tiny table.
Under it a toolbar: a date range picker, "מדד: מבקרים ▾", "לפי: מקור ▾". Then a large line+bar chart "מבקרים ביום" (30 days)
where one day is selected and a drill-down panel at the side shows that day: מקורות (TikTok 48%, Instagram 30%, ישיר 22%),
דמויות מובילות with small faces, סרטונים מובילים. Under the chart 3 cards: מקורות התנועה (horizontal bars), דמויות (faces +
bars), מכשירים (טלפון 86% / מחשב 14%).`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, size, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', size);
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of [STYLE, LOGO, ...FACES]) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
