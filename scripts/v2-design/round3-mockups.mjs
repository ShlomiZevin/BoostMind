// Mockups for round 3 - the profile ("ספרו לנו עליכם") inside Miriam, Demokratovich and Yotam, from his notes on plan cz-sim-r2
// (2026-11-07: up to 3 characters but with a search; "also ask what would you like to do here"; the birthday in free words, an
// LLM turns it into a date; free answers in the simulation too; "מה סיפרתם לנו" on the "אני" page - yes) and his rule the same day:
// "everything you add - make the image first, so it turns out nicely". Brief = what the screen holds; a real screenshot = the look.
//   node scripts/v2-design/round3-mockups.mjs <which> [n]  ->  scratchpad stills/r3-<which>-<n>.jpg
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const SP = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/';
const S = SP + 'stills/', SHOT = SP + 'c4/';
const [which = 'visit', n = '1'] = process.argv.slice(2);
const PHONE = `A crisp, realistic phone UI mockup (one 390px-wide phone screen, rendered large and sharp, no phone frame) of a Hebrew right-to-left
mobile website, "שלומיוורס" (the Shlomiverse) - a comedy universe of characters played by one comedian. The FIRST attached image is a real screenshot of
this exact site: keep its whole look - the top bar, the dark UI, the orange accent, the rounded cards and buttons, the typography.
All text in Hebrew, correctly spelled; in right-to-left "forward" arrows point LEFT. No emoji. Show only the screen, no explanation text.`;
const FLOW = `${PHONE}
It is a step of a short journey: the scene picture at the top, the character's cream speech bubble, the answers as orange-outlined buttons,
and a text box pinned to the bottom of the screen.`;
const JOB = {
  visit: { refs: [SHOT + '1-miriam-1.png', S + 'faces8.png'], prompt: `${FLOW}
The screen: check-in with Miriam, the confused check-in clerk (the scene picture at the top is her at her counter). Her bubble: "את מי באתם לבקר?".
Under it a SEARCH field with a magnifier icon: "חיפוש דמות" (the site has 80+ characters). Under the field the characters as round portraits with
names: the SECOND attached image is the exact grid to use - copy it exactly, the same faces with the same names in the same places (never move a name to
another face), 2 rows of 4. Two of them are picked (an orange ring and a small check), and the picked ones also show as small chips with an x in a row
above the grid: "נבחרו 2 מתוך 3". Pinned to the bottom: an orange "המשך" button and a small "דלגו" link.` },
  source: { refs: [SHOT + '1-miriam-2.png'], prompt: `${FLOW}
The screen: check-in with Miriam (the scene picture at the top is her at her counter). Her bubble, a small line first "אהההה... רגע, אני רושמת." then in
bold "מאיפה טסתם אלינו?". Answers as five orange-outlined buttons, each with a small simple line icon: "טיקטוק", "אינסטגרם", "יוטיוב", "חבר שלח לי",
"משהו אחר". Pinned to the bottom: the text box "או כתבו למרים משהו" with a send button, and a small "דלגו".` },
  wish: { refs: [SHOT + '1-miriam-3.png'], prompt: `${FLOW}
The screen: check-in with Miriam (the scene picture at the top is her at her counter). Her bubble: "ומה הייתם רוצים לעשות כאן? אני רושמת הכל, גם אם אני
לא מבינה." No answer buttons this time - instead, just above the bottom, a bigger rounded text box (two lines high) with the placeholder
"למשל: לדבר עם חני, לראות את כל הסדרה של טקי־טק..." and an orange send button. Three small suggestion chips above the box that fill it with one tap:
"לראות סרטונים", "לדבר עם דמות", "לשחק". A small "דלגו" link.` },
  bday: { refs: [SHOT + '3-booth-2.png'], prompt: `${FLOW}
The screen: passport control at Rabbi Demokratovich's booth (the scene picture at the top is him in his booth). His bubble, a small grey line first
"הדרכון חסר שדה אחד, ואין דרכון בלי תאריך לידה." then in bold "תאריך לידה, לצורך הדרכון?". The visitor answers in their own words: pinned to the bottom
a text box with the placeholder "כתבו איך שנוח לכם: 3 במרץ, 3.3, ט״ו בשבט..." and an orange send button, and a small "מעדיפים לא לומר". Above the box,
as if just answered: the visitor's own small bubble "ט״ו באב, 1994" and under it a tidy confirmation chip with a small check: "נרשם: 22 באוגוסט 1994"
and a tiny "לא נכון? כתבו שוב" link.` },
  simfree: { refs: [SHOT + 's2-q.png'], prompt: `${PHONE}
The screen: question 4 of 7 of the simulation test "באיזו סימולציה אתם חיים?", run by Yotam, the Shlomiverse's System Architect (his small round face and
name at the top with a progress bar "4 מתוך 7"). His short reaction line in grey, then the question in bold: "הבוקר שלכם נפתח ב...". Four answer buttons
as in the screenshot: "צלצול של בית הספר", "מסדר בוקר", "ישיבת צוות שאף אחד לא ביקש", "ילדים שצועקים מהחדר". Under them a fifth, different row: a
slim text box "או כתבו תשובה משלכם" with a small send arrow pointing LEFT. A small "לתוצאה" link at the bottom.` },
  me: { refs: [SHOT + '7-home-citizen.png', S + 'faces3.png'], prompt: `${PHONE}
The screen: the visitor's own page "אני" on the site. Near the top their name "דנה" with a round photo and the small passport chip "אזרח/ית #0042".
Then a card titled "מה סיפרתם לנו" with a small grey line "מרים, הרב דמוקרטוביץ׳ ויותם רשמו. אפשר לשנות הכל." and a tidy list of rows, each row a
small line icon, a label, the answer, and a small "שינוי" link on the left:
"הדמויות שבאתם לבקר" - three small round faces EXACTLY from the second attached image with their names;
"מאיפה הגעתם" - "טיקטוק"; "יום הולדת" - "22 באוגוסט"; "התראות" - an orange on/off switch, on; "העולם שמצחיק אתכם" - "טקי־טק";
"מה הייתם רוצים לעשות כאן" - "לדבר עם חני".
One row is empty and inviting: "שלב בחיים" - "עוד לא סיפרתם" with "להוסיף". Keep it calm and readable.` },
  learned: { refs: [SP + 'bs-phone-list.png'], prompt: `A crisp, realistic phone UI mockup (one 390px-wide phone screen, rendered large and sharp, no phone frame) of the owner's
private dashboard "מאחורי הקלעים" of a Hebrew right-to-left website (the first attached image is a real screenshot of it: keep its look - dark, orange
accent, rounded cards, the tab bar at the bottom). All text in Hebrew, correctly spelled. No emoji.
The screen: a new section "מה למדנו" - what the visitors told the characters. From top: a row of 3 small number cards "212 סיפרו משהו",
"64% הסכימו להתראות", "9 ימי הולדת השבוע". Then a card "הדמויות שבאו לבקר" - a horizontal bar chart with small round faces: חני 48, יותם 31,
הרב דמוקרטוביץ׳ 22, מרים 17, איילת 12. A card "מאיפה מגיעים" - a simple bar list: טיקטוק 61%, אינסטגרם 22%, חבר שלח לי 11%, יוטיוב 6%.
A card "שלב בחיים" - a small bar list (בית ספר, צבא או שירות, לימודים, עבודה, הורים). A card "מה הם רוצים לעשות כאן" - three short quotes in
grey bubbles. A card "ימי הולדת השבוע" - two rows, a name and a date, with a button "לשלוח ברכה".` },
};
const job = JOB[which];
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', job.prompt); form.append('size', '1024x1536'); form.append('quality', 'medium'); form.append('output_format', 'jpeg');
for (const r of job.refs) form.append('image[]', new Blob([fs.readFileSync(r)], { type: /png$/.test(r) ? 'image/png' : 'image/jpeg' }), r.split('/').pop());
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', which, j.error?.message); process.exit(1); }
fs.writeFileSync(S + `r3-${which}-${n}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', which, n);
