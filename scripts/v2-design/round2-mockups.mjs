// Mockups for round 2 of the citizenship + simulation plan (his note on plan open-cz-sim: "use the three not only to make people
// laugh - learn real things about the visitor: which characters they love (who did you come to visit?) and what helps us later").
// Brief = what the screen is and what it holds (feedback_concept_prompts); a real screenshot of the flow as the brand reference.
//   node scripts/v2-design/round2-mockups.mjs <which> [n]   which = visit | bday | push | result  ->  scratchpad stills/r2-<which>-<n>.jpg
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const SP = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/scratchpad/';
const S = SP + 'stills/', SHOT = SP + 'c4/';
const [which = 'visit', n = '1'] = process.argv.slice(2);
const FACES = [['hani', 'חני'], ['yotam', 'יותם'], ['demokratovich', 'הרב דמוקרטוביץ'], ['rosenblum', 'המורה רוזנבלום'], ['nahor', 'נהור'], ['yudit', 'יודית'], ['vova', 'וובה'], ['ayelet', 'איילת']];
const face = async (id) => Buffer.from(await (await fetch(`https://storage.googleapis.com/shlomiverse-media/wiki/img/c/${id}.jpg`)).arrayBuffer());
const COMMON = `A crisp, realistic phone UI mockup (one 390px-wide phone screen, rendered large and sharp, no phone frame) of a Hebrew right-to-left
mobile website, "שלומיוורס" (the Shlomiverse) - a comedy universe of characters played by one comedian. The FIRST attached image is a real screenshot of
this exact flow: keep its whole look - the top bar, the dark UI, the orange accent, the scene picture at the top, the cream speech bubble, the orange-outlined
answer buttons, the text box pinned to the bottom of the screen. All text in Hebrew, correctly spelled; in right-to-left "forward" arrows point LEFT.
Show only the screen, no explanation text.`;
const JOB = {
  visit: { refs: [SHOT + '1-miriam-1.png', S + 'faces8.png'], prompt: `${COMMON}
The screen: check-in for the flight into the Shlomiverse with Miriam, the confused check-in clerk (the scene picture at the top is her at her counter).
Her bubble asks: "את מי באתם לבקר?" (who did you come to visit?). Instead of text answers, the answers are the characters themselves: the SECOND attached image is the exact
grid to use - 8 round portraits in 2 rows of 4, each with its name under it: copy it exactly, the same faces with the same names in the same places
(never move a name to another face). The visitor taps up to 3 - two of them are shown picked (an orange ring and a small check). A small line under the
grid: "אפשר לבחור עד 3". At the bottom of the screen, pinned: an orange "המשך" button and a small "דלגו" link.` },
  bday: { refs: [SHOT + '3-booth-1.png'], prompt: `${COMMON}
The screen: passport control at Rabbi Demokratovich's booth (the scene picture at the top is him in his booth). His bubble, small grey line first: "הדרכון
חסר שדה אחד, ואין דרכון בלי תאריך לידה." then in bold: "תאריך לידה, לצורך הדרכון?". Under it a simple, friendly date picker for day and month (two
rounded wheels or selects, "יום" and "חודש") and an optional year ("שנה, לא חובה"), then an orange "הנה" button. A small grey note: "הדמויות יאחלו לכם
מזל טוב ביום ההולדת". Pinned to the bottom: a small "מעדיפים לא לומר" link.` },
  push: { refs: [SHOT + '3-booth-1.png'], prompt: `${COMMON}
The screen: passport control at Rabbi Demokratovich's booth (the scene picture at the top is him in his booth). His bubble, small grey line first: "אזרח
מחויב להתעדכן בפסיקות." then in bold: "האם אתה מסכים לקבל צווים מהשלטונות?". Two answer buttons side by side: "מסכים/ה" and "לא מסכים/ה". Under them a
small grey line explaining honestly: "צווים = התראה כשדמות שבחרתם מעלה משהו חדש". Pinned to the bottom of the screen: the text box "או כתבו לרב משהו".` },
  result: { refs: [SHOT + 's7-full-pic.png', SHOT + 's5-score.png', S + 'faces3.png', 'C:/workspace/BoostMind/v2/site/verse/art/passport-icon.png'], prompt: `A crisp, realistic phone UI mockup (one 390px-wide phone screen, rendered large and sharp, no phone frame) of a Hebrew right-to-left
mobile website, "שלומיוורס" (the Shlomiverse). The attached screenshots are its simulation test today: the first is the result a resident sees (a picture of
the characters of their simulation together, the score, the simulation's name), the second is what a visitor who is not signed in sees (the score, the rest
locked). Design the RESULT screen of "באיזו סימולציה אתם חיים?" as THE SHLOMIVERSE'S OFFICIAL CLASSIFICATION, signed by Yotam (the System Architect):
at the top a compact classification certificate - "הסיווג שלכם בשלומיוורס", the score 78 as a big number with "מתוך 100", the classification name
"נודניק בכיתה המשפחתית", a small official seal with the Shlomiverse planet and a signature "יותם, ארכיטקט המערכת"; then the picture of their simulation
(keep the people from the first screenshot); then "הדמויות של הסימולציה שלכם" - the 3 round faces with their names EXACTLY as in the third attached image (same faces, same names) and one orange
button "עקבו אחרי שלושתם"; then a card for the next step: "השלב הבא: אזרחות" with the fourth attached image (the Shlomiverse's own navy passport with
the gold planet logo - not any real country's passport) and "מרים מחכה בצ׳ק־אין", and a small arrow pointing LEFT (forward in Hebrew). Keep the site's look (dark, orange accent). All text
in Hebrew, correctly spelled. Show only the screen.` },
};
const job = JOB[which];
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', job.prompt); form.append('size', '1024x1536'); form.append('quality', 'medium'); form.append('output_format', 'jpeg');
for (const r of job.refs) {
  const isFile = r.includes('/');
  form.append('image[]', new Blob([isFile ? fs.readFileSync(r) : await face(r)], { type: /png$/.test(r) ? 'image/png' : 'image/jpeg' }), isFile ? r.split('/').pop() : r + '.jpg');
}
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', which, j.error?.message); process.exit(1); }
fs.writeFileSync(S + `r2-${which}-${n}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', which, n);
