// The next plan's mockups (2026-11-06, his ask: "a plan with mockups - where people see the quiz, where they see the
// citizenship, email the existing residents only after all"). GPT Image 2.6 sunburst / flare, MEDIUM; the live site and the
// characters' real portraits as references; Terra's copy. Briefs say WHAT the screen is for, the screenshots say which site.
//   node scripts/v2-design/next-plan.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/next-plan/img/
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/next-plan';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const ref = (f, type = f.endsWith('.png') ? 'image/png' : 'image/jpeg') => [new Blob([fs.readFileSync(`${DIR}/${f}`)], { type }), f];
const HOME = ref('ref-home.png'), CARD = ref('ref-card.png'), CHAT = ref('ref-chat.jpg');
const MIRIAM = ref('ref-miriam.jpg'), DEMO = ref('ref-demokratovich.jpg'), HANI = ref('ref-hani.jpg'), YOTAM = ref('ref-yotam.jpg'), ROSEN = ref('ref-rosenblum.jpg');

const SCREEN = `A mobile web screen mockup, flat full-screen phone screenshot (no device frame), 9:16. It lives inside the attached
live website "שלומיוורס" (Hebrew, right-to-left) and must feel part of it. Every Hebrew word right-aligned and spelled exactly
as given. The name "שלומיוורס" always in two colours: "שלומי" white, "וורס" orange. No emoji.`;
const WORLD = `The Shlomiverse: a parallel universe of comedy characters played by the comedian Shlomi, presented as real people.
His audience keeps writing "we live in a simulation". Visitors have a status: tourist (תייר, no account), resident (תושב,
signed up), citizen (אזרח, went through the citizenship journey).`;
const QUIZ = `${WORLD} NEW: the test "אתם חיים בסימולציה?" - like the silly magazine quizzes of the 90s, but an AI agent asks the
questions (each one follows your last answer), the AI gives your score, and the result is WHICH simulation you live in - one of
the verse's worlds and its characters. The score shows at once; the full result after becoming a resident.`;
const CITIZEN = `${WORLD} NEW: the citizenship journey, for residents only - a boarding pass to the Shlomiverse, check-in with
Miriam (a confused clerk who never stops talking and understands nothing; she asks you questions as an AI agent, not a form, you
can skip), border control in a booth with Rabbi Demokratovich (his faith is democracy and the Supreme Court, he talks like the
Talmud), a stamp, a citizen number, a flight in, and a Shlomiverse ID card.`;

const ALIGN = `Layout precision matters: every element on one clean right-aligned grid with equal side margins, text and buttons
lined up exactly, nothing crooked or overlapping.`;

const JOBS = [
  ['Q1-home', 'gpt-image-2.6-sunburst', [HOME, YOTAM], `${SCREEN}\n${QUIZ}\n${ALIGN}\nDesign the HOME PAGE for a tourist exactly as the
attached live home, with ONE new band right under the hero's question box that invites to the test. In the band: Yotam's face
(the attached portrait - Techy-Tech's "System Architect of life") in a small round frame at the right, title "אתם חיים בסימולציה?",
line "יותם מריץ בדיקה. כל תשובה שלכם משנה את השאלה הבאה.", button "התחילו להיבדק". Make the band intriguing - a small glitch in
reality - without breaking the page.`],
  ['Q2-intro', 'gpt-image-2.6-flare', [HOME, YOTAM], `${SCREEN}\n${QUIZ}\n${ALIGN}\nDesign the TEST's OPENING screen (full page),
hosted by Yotam (exactly the man in the attached portrait), who runs the check like a system test at Techy-Tech: his portrait
at the top with a small "בבדיקה" status light, title "יותם מריץ בדיקת מערכת", line "כמה שאלות עליכם. כל אחת יודעת מה עניתם
קודם.", main button "תבדקו אותי" (first letter ת - tav, spelled exactly), small line "כשלוש דקות, תלוי כמה המציאות משתפת פעולה." It should feel like entering a
strange lab that tests whether you are real.`],
  ['Q3-question', 'gpt-image-2.6-sunburst', [HOME], `${SCREEN}\n${QUIZ}\nDesign ONE QUESTION of the test (question 3 of about 7, a progress
mark): the AI agent asks "כשאתם שומעים 'בואו נחשוב מחוץ לקופסה', מה קורה?" and four big tappable answers: "אני מחפש קופסה לצאת
ממנה", "אני כבר בקופסה, עם קבלה", "אני מציע ישיבה על הקופסה", "טקי-טק אמר שזה בטיפול". Quick, playful, one thumb.`],
  ['Q4-score', 'gpt-image-2.6-flare', [HOME, CARD], `${SCREEN}\n${QUIZ}\nDesign the screen right AFTER the test for a tourist: the score shown
big - "הציון שלכם: 17" - and the full result hidden, waiting (blurred / sealed): line "התוצאה המלאה כבר יודעת בדיוק איפה אתם
חיים.", main button "מסדירים תושבות ורואים הכול". Curiosity at its peak.`],
  ['Q5-result', 'gpt-image-2.6-sunburst', [HOME, YOTAM, HANI], `${SCREEN}\n${QUIZ}\nDesign the FULL RESULT screen (after becoming a resident):
"17" and the verdict "אתם חיים בסימולציה של טקי-טק", the line "הכול אצלכם בטיפול, רק אף אחד לא יודע אצל מי.", the faces of that
world's people (take Yotam from the attached portrait; the rest of the Techy-Tech team as small faces), main button "פגשו את
השכנים לסימולציה" and a share button "שתפו את התוצאה".`],
  ['Q6-share', 'gpt-image-2.6-flare', [YOTAM], `A tall 9:16 share card for an Instagram story / WhatsApp, designed as a finished graphic (no
phone UI). ${QUIZ} It is the result a person shares: big "17", "יצאתי 17 במבחן המציאות.", "אני חי בסימולציה של טקי-טק", the
question to friends "באיזו סימולציה אתם חיים?", Yotam's face (attached portrait) as the world's face, and at the bottom the
"שלומיוורס" wordmark (שלומי white, וורס orange) and shlomiverse.com/simulation. Hebrew spelled exactly.`],
  ['Q7-chat', 'gpt-image-2.6-sunburst', [CHAT, HANI], `${SCREEN}\n${QUIZ}\n${ALIGN}\nDesign the CHAT with Hani (attached portrait; the
attached chat screenshot shows the chat's look) - CALM and uncluttered: the chat's own header, exactly two earlier messages - the visitor "חני, את מאמינה שאנחנו חיים בסימולציה?" and Hani "בעזרת השם הכול לטובה, אבל יש כמה רמזים." - then Hani's bubble "תגידו, עשיתם כבר את מבחן הסימולציה? יש לי תחושה שאתם תוצאה מעניינת." and right under it ONE
small card inside the conversation with the title "אתם חיים בסימולציה?" and the button "למבחן המציאות", then the message box.
Lots of breathing room, no extra decorations, no status bar or breadcrumbs, no English words.`],
  ['C1-banner', 'gpt-image-2.6-flare', [HOME, MIRIAM, DEMO], `${SCREEN}\n${CITIZEN}\n${ALIGN}\nDesign the HOME PAGE of a RESIDENT (signed
in - the top shows their face and a "תושב" status chip) with a banner at the top of their page that invites to the journey:
title "התושבות הוסדרה. נא להתאזרח.", line "מרים מחכה בצ׳ק־אין. דמוקרטוביץ עם החותמת.", button "למסע האזרחות". In the banner
Miriam (exactly the woman in the attached portrait) at a check-in counter with a small speech bubble "זוהרה, רגע, זה לא נותן."
and Rabbi Demokratovich (the attached portrait) holding a stamp; a boarding pass peeks out of the banner.`],
  ['C2-boarding', 'gpt-image-2.6-sunburst', [HOME], `${SCREEN}\n${CITIZEN}\nDesign the BOARDING PASS screen - the first step of the journey:
a real-looking boarding pass titled "כרטיס עלייה לשלומיוורס" with the passenger's name "דנה", fields "מאיפה: העולם שאתם מכירים",
"לאן: שלומיוורס, פנים הארץ", "שער: ג׳, ליד המכונה שלא עובדת", "מושב: 17א׳, חלון למציאות חלופית", a barcode, and a button
"לצ׳ק-אין אצל מרים". Step 1 of 4 shown.`],
  ['C3-miriam', 'gpt-image-2.6-flare', [MIRIAM, HOME], `${SCREEN}\n${CITIZEN}\nDesign the CHECK-IN with Miriam (exactly the woman in the
attached portrait: late fifties, slim, a smoker's lined skin, heavy dark eyebrows, thin glasses, purple eyeshadow, overdrawn pink
lipstick, spiky grey wig, yellow shirt, black cardigan) behind an airport check-in counter at the top; under her, her chat
bubbles: "רגע, אתם באתם להתאזרח או רק לרגע, כי גם לרגע צריך למלא משהו, אבל אל תדאגו, אני כבר מסתדרת עם זה, בערך." and "אז אתם
מוכנים להגיד מי אתם, או שניתן למערכת לנחש?", three quick answers "אנחנו מוכנים", "תנו למערכת לנחש", "אפשר את השאלה הבאה", a
small "דלגו" and a text box. Step 2 of 4.`],
  ['C4-booth', 'gpt-image-2.6-sunburst', [DEMO, HOME], `${SCREEN}\n${CITIZEN}\nDesign BORDER CONTROL: Rabbi Demokratovich (exactly the man in
the attached portrait - long grey beard, black kippah, glasses, black suit) sitting in a passport-control booth with a glass
window, a sign "ביקורת גבולות" and a stamp at hand; his speech bubble: "תנו רבנן: המבקש להיכנס בשערי שלומיוורס, יקבל עליו עול
דמוקרטיה, משפט וערעור תוך שבעה ימי עסקים." and three answers to tap: "מקבלים עלינו", "ובלבד שיש בג״ץ", "אפשר לעיין בפרוטוקול?".
Step 3 of 4.`],
  ['C5-stamp', 'gpt-image-2.6-flare', [DEMO], `${SCREEN}\n${CITIZEN}\nDesign the STAMP MOMENT: a Shlomiverse passport page being stamped
(a big fresh ink stamp with the planet logo), title "החותמת התקבלה", "מספר האזרח שלכם: 0075", "אזרח מייסד · 75 מתוך 1,000 הראשונים",
and a button "טסים פנימה" (the flight into the verse comes next). Step 4 of 4. A moment of arrival.`],
  ['C6-id', 'gpt-image-2.6-sunburst', [HOME], `A tall 9:16 SHAREABLE ID CARD graphic (no phone UI) - the Shlomiverse citizen card a new citizen
shares in a story. ${CITIZEN} On it: title "תעודת זהות שלומיוורסית", a photo placeholder of the person (a smiling woman named דנה),
"מספר אזרח: 0075", "מחלקה: ענייני מציאות חלופית", "סיווג: חשודים שיודעים יותר מדי", "מעמד: אזרח מייסד", "בסימולציה של: טקי-טק",
an official stamp, the "שלומיוורס" wordmark (שלומי white, וורס orange) and shlomiverse.com. Hebrew spelled exactly.`],
  ['E1-email', 'gpt-image-2.6-flare', [HOME, MIRIAM, DEMO], `A mockup of an EMAIL as seen in the Gmail app on a phone (9:16), from
"השלומיוורס". ${CITIZEN} It goes to existing residents only after the journey is live. Subject line "התושבות שלכם אושרה. הגיע
הזמן לאזרחות.", the email body in the Shlomiverse look: the faces of Miriam and Rabbi Demokratovich (attached portraits), the line
"אתם כבר בבית בשלומיוורס. עכשיו נשאר רק לעבור את מרים, דמוקרטוביץ והחותמת.", a button "צאו למסע האזרחות", a small unsubscribe
line. Hebrew right-to-left, spelled exactly.`],
];

const only = process.argv.slice(2);
fs.mkdirSync(`${DIR}/img`, { recursive: true });
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, model, images, prompt]) => {
  const form = new FormData();
  form.append('model', model); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(DIR, 'img', `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  const u = j.usage || {}, d = u.input_tokens_details || {};
  console.log('ok', key, '$' + (((d.text_tokens || 0) * 5 + (d.image_tokens || 0) * 8 + (u.output_tokens || 0) * 30) / 1e6).toFixed(3));
}));
