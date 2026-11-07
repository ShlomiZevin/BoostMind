// Mockups for round 4 - his notes from testing the whole journey (2026-11-07): the top bar ("something I don't like"), the
// simulation screen ("stuff on a screen, no brain"; options vs writing; the reaction belongs to the last answer), Yotam's
// classifying screen without the spinning logo ("childish - we are a serious immersive site"), a calm loader instead of the
// clipped spinning logo, Miriam thinking, the bottom box on every question, the passport on one screen, the end of the
// simulation (home / passport / profile), the cannon's heat on the ship. His rule: the image first, then build.
//   node scripts/v2-design/round4-mockups.mjs <which> [n]  ->  scratchpad stills/r4-<which>-<n>.jpg
import fs from 'node:fs';
const KEY = fs.readFileSync('C:/workspace/BoostMind/scripts/design.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY=')).slice(15).trim();
const SP = 'C:/Users/shazbak/AppData/Local/Temp/claude/c--workspace-BoostMind/2b909074-3c8a-43f4-bdbb-2f2d5ceb7904/';
const S = SP + 'scratchpad/stills/', HIS = SP + 'images/', LIVE = SP + 'scratchpad/live/', ART = 'C:/workspace/BoostMind/v2/site/verse/art/';
const [which = 'topbar-a', n = '1'] = process.argv.slice(2);
const PHONE = `A crisp, realistic phone UI mockup (one 390px-wide phone screen, rendered large and sharp, no phone frame) of a Hebrew right-to-left
mobile website, "שלומיוורס" (the Shlomiverse) - a comedy universe of characters played by one comedian, built as a SERIOUS, immersive, cinematic site
(think a premium streaming service, not a kids' game). The FIRST attached image is a real screenshot of this exact site: keep its look - the dark UI,
the orange accent, the typography. Restrained: glow only where it means something, never a neon halo around buttons.
All text in Hebrew, correctly spelled; in right-to-left "forward" arrows point LEFT. No emoji. Show only the screen, no explanation text.`;
const BAR = `Pinned to the very bottom: ONE writing bar used on every question - a single rounded field and a send button of exactly the same height,
side by side, the field with a small pencil icon and the placeholder in it; it looks unmistakably like a chat input ("write anything"), clearly
different from the answer buttons above, which look like tappable choices.`;
const JOB = {
  'topbar-a': { refs: [HIS + '19.png'], prompt: `${PHONE}
Show the TOP of the home page, focus on a redesigned top bar (the current one, in the screenshot, has the orange planet logo at BOTH ends - the
site logo on the right and the visitor's profile picture on the left is the same logo - and four boxes of different shapes). The new bar, right to left:
the planet logo "שלומיוורס" (smaller, calmer glow), a search field "חיפוש", a bell, and the visitor's OWN round photo (a smiling man in his 30s) with a
tiny passport badge on its corner (a small dark-blue passport with a gold planet) instead of a separate "אזרח" box. All items share one height and one
calm style. Under the bar, the start of the home page: a row of round story rings with faces, and a wide video card.` },
  'topbar-b': { refs: [HIS + '19.png'], prompt: `${PHONE}
Show the TOP of the home page, focus on a redesigned top bar. Right to left: the planet logo "שלומיוורס", then a slim search icon button only (the
field opens on tap), then on the left one combined "you" pill: the visitor's own round photo (a smiling man in his 30s) + the word "אזרח" + the
citizen number "#0003" in small grey, and a bell inside the same pill. Minimal, quiet, thin borders, one height. Under the bar, the start of the
home page: a row of round story rings with faces, and a wide video card.` },
  'simq-a': { refs: [HIS + '20.png'], prompt: `${PHONE}
The simulation test "באיזו סימולציה אתם חיים?" run by Yotam, the Shlomiverse's System Architect, redesigned as a real CONVERSATION with a frame:
At the top a slim header card: Yotam's small round face, "יותם · בדיקת מערכת", and 7 small station dots (2 done in orange, the third glowing as current)
with the label "שלב 3 מתוך 7".
Then the thread, top to bottom: Yotam's earlier question in a grey bubble (faded) "כשאתם מתעוררים, מה הדבר הראשון שמפעיל אתכם?"; the visitor's
answer as their own orange bubble on the other side "מבט קטן וחזרה למיטה"; Yotam's reaction to THAT answer as his bubble right under it, in italic
grey "מבט קטן זה רק boot sequence שנכשל."; and then the new question, bigger, in a bright bubble: "מה מחכה לכם אחרי שהשעון סוף סוף ניצח?".
The answers as 4 compact choice chips in a 2x2 grid (each a tappable card with a small radio circle): "צלצול של בית הספר", "בסיס, משמרת או שירות",
"הרצאה שכבר התחילה", "ישיבת צוות שאף אחד לא ביקש".
${BAR} placeholder "או כתבו ליותם תשובה משלכם".` },
  'simq-b': { refs: [HIS + '20.png'], prompt: `${PHONE}
The simulation test run by Yotam, the Shlomiverse's System Architect, redesigned with a clear structure, like a diagnostic console:
Top: a header "בדיקת מערכת · 3/7" with a thin segmented progress bar (7 segments) and Yotam's round face.
Middle: a dark "terminal-like" card holding the exchange: a small grey line "התשובה הקודמת: מבט קטן וחזרה למיטה" with a tiny check, under it Yotam's
reaction in his speech bubble with his face "מבט קטן זה רק boot sequence שנכשל.", then a divider, then the new question large and bold:
"מה מחכה לכם אחרי שהשעון סוף סוף ניצח?".
Below: the 4 answers as full-width choice rows with a letter in a small circle (א, ב, ג, ד): "צלצול של בית הספר", "בסיס, משמרת או שירות",
"הרצאה שכבר התחילה", "ישיבת צוות שאף אחד לא ביקש".
${BAR} placeholder "או כתבו ליותם תשובה משלכם".` },
  classify: { refs: [HIS + '21.png'], prompt: `${PHONE}
A full-screen moment of the simulation test: "יותם מסווג אתכם" - Yotam is classifying the visitor, consulting six characters. Keep the SAME six real
faces from the attached screenshot in a circle. NO logo in the middle, nothing spins: in the centre a calm, thin, slowly drawn orange ring like a
radar sweep / scan line, and one face is lit (brighter, a thin orange ring, slightly larger) as if being asked right now, the others dimmed.
Under the circle: the title "יותם מסווג אתכם" and a grey line that changes "שואל את השכן המציק...". Cinematic, quiet, dark, serious.` },
  loader: { refs: [HIS + '17.png'], prompt: `${PHONE}
The site's loading screen (shown for a second or two while a page loads), redesigned: NOT a spinning logo. A dark, deep space background with very
faint stars; in the centre the "שלומיוורס" planet logo, small, still, softly breathing glow (no hard edges, no square cut-out, the glow fades into
the dark), and under it a very thin orange line drawing itself like a progress line, and a tiny grey caption "נכנסים לשלומיוורס". Calm, cinematic.
The top bar of the site stays as in the screenshot.` },
  think: { refs: [HIS + '23.png'], prompt: `${PHONE}
Check-in with Miriam, the confused check-in clerk (keep the scene picture at the top exactly, her at her counter). Miriam is THINKING after the
visitor answered: instead of an empty bubble with three dots, her cream speech bubble holds a short line of hers in italic with a small animated
typing caret: "רגע, המחשב של משרד הפנים חושב..." and a tiny keyboard icon. The picture of her has a subtle hint of motion (her hands on the
keyboard, a soft light change). The visitor's answer just above in their own small orange bubble "טיקטוק". The answer buttons are not shown yet.
${BAR} placeholder "כתבו למרים משהו".` },
  input: { refs: [HIS + '24.png'], prompt: `${PHONE}
Check-in with Miriam (keep the scene picture at the top exactly). Her bubble: "סרטונים, טוב, זה מסודר." then bold "ומה הייתם רוצים לעשות כאן?".
The suggestions are clear CHOICE buttons (one tap = chosen and sent): three outlined buttons "לדבר עם יותם", "לראות עוד סרטונים של חני פרידמן",
"לשבור שיא באחד המשחקים" - all the same style, none highlighted. A small grey label above them "בחרו, או כתבו בעצמכם למטה".
${BAR} placeholder "או כתבו למרים מה שבא לכם". Under the bar the two small links "דלגו" and "דלגו על הכול". The field is empty and clean - no line,
no scrollbar on its edge.` },
  passport: { refs: [LIVE + 'cz-passport-390.png'], prompt: `${PHONE}
The end of the citizenship journey: "הדרכון שלכם" on ONE screen, no scrolling. One passport ID page (data page, light paper with fine guilloche lines,
the photo on the right side, the fields: name "דנה", nationality "השלומיוורס", passport no. "0003", issued "07.11.26", expiry "עד שהמציאות
תשתנה") with the round dark-blue border-control stamp "ביקורת הגבולות · השלומיוורס · כניסה ENTRY · 07.11.2026" pressed at an angle over its lower
corner, overlapping the edge, with Rabbi Demokratovich's signature next to it. No second page. Under it a small clear row about the simulation:
an icon and "עוד לא סווגתם · 3 דקות עם יותם, ותקבלו תעודת סיווג בדרכון" with a small arrow. Then the orange "לדף הבית" button (no neon halo),
and a quiet "שתפו את הדרכון". Everything fits one phone screen.` },
  simend: { refs: [LIVE + 'sim-result-full-390.png'], prompt: `${PHONE}
The end of the simulation test: the classification certificate (keep it as in the screenshot - the score, the classification name, Yotam's signature),
smaller so the actions fit on the screen. Under it, clear next steps: a large orange "לדף הבית" button (main, no neon halo), then two equal outlined
buttons side by side "הדרכון שלי" (with a small passport icon) and "הפרופיל שלי" (with a small person icon), and a quiet text link
"שתפו את הסימולציה". Above the buttons, the three characters with "עקבו אחרי שלושתם" as a small row.` },
  crop: { refs: [LIVE + 'me-page-390.png'], prompt: `${PHONE}
A bottom sheet over the visitor's "אני" page: choosing the profile picture's frame after picking a photo. Title "מה יופיע בתמונה". The chosen photo
(the orange "שלומיוורס" planet logo on dark, as an example of a wide image) fills the sheet, with a ROUND frame cut-out over it (the outside dimmed) -
the whole planet with its ring fits INSIDE the circle, nothing cut at the sides. A zoom slider under it (a small minus and plus magnifier),
a grey hint "גררו והגדילו עד שזה נראה טוב", and a live small round preview of how it will look in the top bar. Buttons: orange "שמירה" (no halo)
and "ביטול".` },
  heat: { refs: [HIS + '26.png', ART + 'fly-ship.webp'], prompt: `A crisp game screenshot mockup (vertical phone game, dark space background with orange dust, rendered large and sharp) of a white spaceship
with the orange "שלומיוורס" logo (the SECOND attached image is the exact ship) shooting upward. NO arc or gauge under the ship. Instead the heat
shows ON the ship: its two cannon barrels glow from orange to hot red at the tips, with a faint heat shimmer and a little grey smoke trailing, as
if overheated; a small orange star pickup nearby. Show two small panels side by side: left "יורה" - barrels slightly warm; right "התחמם" - barrels red
with smoke and no shots. Hebrew labels correctly spelled. No other text.` },
};
const job = JOB[which];
if (!job) { console.log('no such mockup', which); process.exit(1); }
const form = new FormData();
form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', job.prompt); form.append('size', which === 'heat' ? '1536x1024' : '1024x1536'); form.append('quality', 'medium'); form.append('output_format', 'jpeg');
for (const r of job.refs) form.append('image[]', new Blob([fs.readFileSync(r)], { type: /png$/.test(r) ? 'image/png' : /webp$/.test(r) ? 'image/webp' : 'image/jpeg' }), r.split('/').pop());
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', which, j.error?.message); process.exit(1); }
fs.writeFileSync(S + `r4-${which}-${n}.jpg`, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok', which, n);
