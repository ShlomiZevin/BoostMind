// Conversion round (2026-11-06, his ask): tourist -> resident -> citizen (תייר / תושב / אזרח), the ask after 3 videos,
// sign-up inside Instagram's browser (email + code), the chat wall that stops mid-story, and Backstage's own home-screen
// icon. GPT Image 2.6 (OpenAI direct, MEDIUM); the live site's screenshots as references; Terra's copy.
// Briefs say WHAT we build, never how it looks (his rule) - the screenshots only say which site the screen lives in.
//   node scripts/v2-design/conversion.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/conversion/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/conversion';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const HOME = img(`${OUT}/home-now.png`, 'live-home.png'), VIDEO = img(`${OUT}/video-now.png`, 'live-video-page.png');
const CHAR = img(`${OUT}/char-now.png`, 'live-character-page.png');
const ICON = img('C:/workspace/BoostMind/public/verse/icon-512.png', 'shlomiverse-app-icon.png');

const SCREEN = `A mobile web screen mockup, flat full-screen phone screenshot (no device frame), 9:16. It lives inside the attached
live website "שלומיוורס" (Hebrew, right-to-left) - it must feel like part of that same site. All Hebrew right-aligned and
spelled exactly as given. No emoji.`;

const WORLD = `What the Shlomiverse is: a parallel universe of comedy characters that the comedian Shlomi plays, presented as
real people with their own lives, videos, games, stories and a chat where you talk to each of them. His audience keeps
writing "we live in a simulation". We are adding STATUS inside the universe: everyone arrives as a tourist (תייר), signing
up makes you a resident (תושב), and residents can later go through a citizenship journey and become citizens (אזרח) - a
check-in with Miriam, a border booth with Rabbi Demokratovich, a stamp, a flight into the verse. The status must make the
visitor feel they are entering a real world with its own bureaucracy and belonging, not filling in a website form.`;

const LADDER_COPY = `Hebrew copy (use exactly): title "המעמד שלכם בשלומיוורס", sub "כרגע אתם תיירים. אפשר להסדיר תושבות בלי לעמוד
בתור לשום משרד." Three statuses, the current one marked as "you are here":
1) "תייר" - "ביקור קצר, עד שהדמויות מתחילות לשאול מי אתם." - "3 שאלות בצ'אט", "צפייה בסרטונים", "משחקים בלי טבלת שיאים".
2) "תושב" - "יש לכם כתובת כאן. הדמויות כבר יודעות איך לפנות אליכם." - "הצ'אט ממשיך, בשם שלכם", "סטיקרים ושמירת סרטונים",
"מעקבים, תגובות ושיאים".
3) "אזרח" with a "בקרוב" mark - "צ'ק־אין אצל מרים, ביקורת אצל הרב דמוקרטוביץ, וטיסה פנימה." - "מסע אזרחות ותעודת זהות",
"מספר אזרח שהדמויות מכירות", "תג 'אזרח מייסד' ל־1,000 הראשונים".
Main button "להפוך לתושבים".`;

const JOBS = [
  ['L1-ladder', 'gpt-image-2.6-sunburst', [HOME, CHAR, ICON], `${SCREEN}
${WORLD}
Design the STATUS window: the visitor tapped the small status mark "תייר" at the top of the home page, and a window rises
showing where they stand in the universe and the path from tourist to resident to citizen. The moment: a tourist realises
there is a place for them here. ${LADDER_COPY}`],
  ['L2-ladder', 'gpt-image-2.6-flare', [HOME, CHAR, ICON], `${SCREEN}
${WORLD}
Design the STATUS window, thought of as the universe's own official status record of this visitor - opened by tapping
the small status mark "תייר" at the top of the home page. It shows their current status and the two above it, and one
action to move up. ${LADDER_COPY}`],
  ['C-chip', 'gpt-image-2.6-sunburst', [HOME, ICON], `${SCREEN}
${WORLD}
Design the HOME PAGE exactly as the attached live home, with one addition in the top bar: a small status mark that reads
"תייר", next to the sign-in button, inviting a tap without shouting. Everything else stays as in the live home.`],
  ['A-3videos', 'gpt-image-2.6-flare', [VIDEO, HOME], `${SCREEN}
${WORLD}
Design the ASK that rises from the bottom after a tourist finished watching their THIRD video (the video page, attached,
is behind it, its video ended). It shows the faces of the three characters they just watched (Hani, Yotam, Rabbi
Rosenblum - take faces from the attached pages) - the people they already met. Hebrew copy (use exactly): title "ויזת
התייר שלכם כבר מרגישה בבית", line "הגיע הזמן שגם הדמויות יכירו אתכם בשם.", main button "להסדיר תושבות", quiet link
"לא עכשיו". It must feel like a warm step into the world, never like a paywall.`],
  ['S1-email', 'gpt-image-2.6-sunburst', [HOME, ICON], `${SCREEN}
${WORLD}
Design the SIGN-UP window inside Instagram's built-in browser (Google sign-in does not work there, so it is email + a
one-time code). Step 1 of 2. Hebrew copy (use exactly): title "הנפקת תושבות", line "משאירים מייל, מקבלים קוד, ונכנסים
כתושבים.", an email field with placeholder "כתובת המייל שלכם", button "שלחו קוד", small print "קוד חד־פעמי. בלי סיסמה."
The phone keyboard is open below. It should feel like the counter where the universe issues your residency.`],
  ['S2-code', 'gpt-image-2.6-sunburst', [HOME, ICON], `${SCREEN}
${WORLD}
Design step 2 of the SIGN-UP window inside Instagram's browser: entering the one-time code that was emailed. Hebrew copy
(use exactly): title "התושבות כמעט מוכנה", line "שלחנו קוד ל־dana@gmail.com", six boxes for the digits (three filled),
button "אשרו תושבות", link "לא הגיע? שלחו שוב". Numeric keyboard open below.`],
  ['W-wall', 'gpt-image-2.6-flare', [CHAR, HOME], `${SCREEN}
${WORLD}
Design the CHAT with Hani (the character on the attached character page): a tourist asked three questions and got great
answers. On the fourth, Hani starts telling something juicy and stops mid-sentence: her bubble reads "אתמול מצאתי בפרודקשן
פונקציה בשם doNotTouch_final_FINAL. עשיתי git blame, ומי שכתב אותה זה האחרון שהייתם מצפים לו. זה היה—". Right under her
bubble, inside the conversation, a small card: "חני מוכנה להמשיך. קודם היא צריכה לדעת מי אתם." with the button "להפוך
לתושבים". The earlier answers are visible above. The moment: curiosity, not a wall.`],
  ['B1-icon', 'gpt-image-2.6-sunburst', [ICON], `An iPhone home-screen app icon, full square, edge to edge (iOS rounds the corners, so no rounded corners, no border).
What it is: "Backstage" - the private admin app of the Shlomiverse, only its owner Shlomi uses it (stats, conversations,
people, stories). It must be instantly recognisable as the Shlomiverse (the attached icon is the Shlomiverse's real app
icon - keep its planet logo) yet clearly a different app: the backstage of it. Include the English word "BACKSTAGE",
spelled exactly, legible at icon size. Nothing else written.`],
  ['B2-icon', 'gpt-image-2.6-flare', [ICON], `An iPhone home-screen app icon, full square, edge to edge (iOS rounds the corners, so no rounded corners, no border).
What it is: the private admin app of the Shlomiverse, called in Hebrew "מאחורי הקלעים" - only its owner uses it (stats,
conversations, people, stories). It must be instantly recognisable as the Shlomiverse (the attached icon is its real app
icon - keep its planet logo) yet clearly a different app: behind the scenes of it. Include the Hebrew words "מאחורי
הקלעים", spelled exactly, legible at icon size. Nothing else written.`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, model, images, prompt]) => {
  const form = new FormData();
  form.append('model', model); form.append('prompt', prompt);
  form.append('size', key.startsWith('B') ? '1024x1024' : '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', key.startsWith('B') ? 'png' : 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.${key.startsWith('B') ? 'png' : 'jpg'}`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key, JSON.stringify(j.usage || {}));
}));
