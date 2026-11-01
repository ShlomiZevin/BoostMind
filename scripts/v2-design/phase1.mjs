// Shlomiverse v2, phase 1 design: accounts + push + the video page. GPT Image 2.5 sunburst on OpenAI direct, MEDIUM
// 1024x1536, with the approved tap screen as the style reference so every screen speaks the same language.
//   node scripts/v2-design/phase1.mjs [only-key ...]
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'phase1');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const WIKI = 'C:/workspace/BoostMind/public/wiki';
const img = (file, name) => [new Blob([fs.readFileSync(file)], { type: 'image/jpeg' }), name];
const STYLE_REF = img(`${DESIGN}/2-tap.jpg`, 'style.jpg');
const YOTAM_FRAME = img(`${WIKI}/v/ig-18084396485173275.jpg`, 'yotam-frame.jpg');
const face = (id) => img(`${WIKI}/img/c/${id}.jpg`, `${id}.jpg`);

// The one design system every screen follows (the approved mockups, written down).
const SYSTEM = `A premium iPhone app screen mockup, flat full-screen screenshot (no device frame, no hand), 9:16 portrait.
App: "השלומיוורס" (Hebrew, right-to-left UI) - a comedy universe where the characters are real people.
FOLLOW THE ATTACHED STYLE REFERENCE (the first image) EXACTLY - it is the approved design system:
- Background: deep near-black #0b0b0e with a soft warm vignette, or the video itself dimmed behind frosted glass.
- One accent only: warm orange #ff6a1f, used for the ONE primary action on the screen and for the orange ring around a
  character's face. Everything else white text on frosted glass.
- Surfaces: frosted dark glass, 1px faint white border, 28px rounded corners on cards and sheets, round buttons with fine
  line icons. Primary buttons are full orange pills, secondary buttons are glass pills.
- Wordmark: an orange ringed-planet logo + "השלומיוורס" in bold white Hebrew; small and quiet.
- Type: one elegant Hebrew sans (Heebo-like), big bold titles, small dim grey secondary lines. Generous spacing, calm.
- It must NOT look like TikTok or Instagram: a boutique streaming app. No hearts, no like counts, no emoji anywhere.
All text in Hebrew, right-aligned, correctly spelled.`;

const JOBS = [
  ['A-signin', [STYLE_REF, YOTAM_FRAME], `${SYSTEM}
SCREEN "SIGN IN TO FOLLOW": the viewer tapped "עוקבים" on Yotam's video while signed out. Behind: the attached Yotam video
frame (black bob wig, glasses, colourful t-shirt), filling the screen, dimmed and softly blurred. From the bottom a tall
frosted-glass sheet has risen (top 40% of the screen still shows the video). On the sheet, top centre: Yotam's round face
with an orange ring, and a big title "רוצה לדעת מה קורה ליותם?". Under it three short rows, each with a fine line icon:
"עוקבים אחרי הדמויות שאוהבים", "התראה כשמשהו קורה להן", "שומרים סרטונים לאחר כך".
Then one big white pill button with the Google "G" logo: "כניסה עם Google". Under it a tiny dim line: "בלי סיסמאות. בלי ספאם.".
A small grab handle at the top of the sheet.`],

  ['B-nickname', [STYLE_REF], `${SYSTEM}
SCREEN "FIRST SIGN-IN - YOUR NAME IN THE VERSE": full screen, near-black with a warm glow at the top. Small wordmark at the
top. Big title: "איך יקראו לך בשלומיוורס?" and a dim line under it: "ככה הדמויות יכירו אותך. אפשר לשנות אחר כך.".
A large round avatar in the middle (a soft generic person silhouette in glass) with a small glass toggle under it:
"להשתמש בתמונה מגוגל". Then a big frosted text field with the typed nickname "דנה מרמת גן" and a blinking caret.
Under the field, three small glass suggestion chips: "המעריצה מס' 1", "דנה_בסימולציה", "שכנה של חני".
At the bottom, a full-width orange pill: "נכנסים לשלומיוורס".`],

  ['C-push-optin', [STYLE_REF, YOTAM_FRAME], `${SYSTEM}
SCREEN "FOLLOWING - TURN ON NOTIFICATIONS": the viewer just followed Yotam. Behind: the attached Yotam frame, dimmed and
blurred. Centre: a frosted-glass card. Top of the card: Yotam's round face with an orange ring and a small orange check
badge, and the line "עכשיו את עוקבת אחרי יותם". Then a big title: "שיודיע לך כשקורה לו משהו?". Then a preview of a real
iPhone notification as a small glass banner inside the card: the app icon (orange ringed planet on black), "השלומיוורס",
"יותם העלה סרטון חדש: יותם מסביר רשתות נוירונים". Then a full-width orange pill "להפעיל התראות" and under it a plain
dim text link "אולי אחר כך".`],

  ['D-homescreen-guide', [STYLE_REF], `${SYSTEM}
SCREEN "ADD THE SHLOMIVERSE TO YOUR HOME SCREEN" (an iPhone guide with pictures): near-black page. Top: wordmark, then a
big title "השלומיוורס על המסך הראשי" and a dim line "שלושה צעדים, ואז התראות כשמשהו קורה לדמויות".
Three numbered frosted cards stacked vertically, each with a big orange step number and a small clear picture:
1. "לוחצים על כפתור השיתוף" - picture: the bottom bar of iPhone Safari with the square-and-arrow-up share icon circled in orange.
2. "בוחרים 'הוספה למסך הבית'" - picture: the iOS share sheet list with the row "הוספה למסך הבית" (plus-in-square icon) highlighted in orange.
3. "פותחים מהאייקון ומפעילים התראות" - picture: an iPhone home screen grid with a new app icon (orange ringed planet on black)
   labelled "שלומיוורס", with a small orange arrow pointing at it.
At the bottom a glass pill "הבנתי" and a dim line "עובד באייפון מגרסה 16.4".`],

  ['E-bell', [STYLE_REF, face('yotam'), face('hani'), face('demokratovich')], `${SYSTEM}
SCREEN "NOTIFICATIONS CENTRE" (the in-site bell): near-black page. Header: title "מה קרה בשלומיוורס" on the right, a round
glass bell button with an orange dot on the left. A row of small glass filter chips: "הכול" (selected, white), "סרטונים",
"תגובות", "סטיקרים".
Section label "היום": notification rows, each a frosted card with the character's round face (use the attached faces:
Yotam = glasses and black bob wig; Hani = religious woman in a head covering; Demokratovich = man in a suit), bold name,
one line, a time, and on unread rows a small orange dot:
- Yotam: "העלה סרטון חדש: יותם מסביר רשתות נוירונים" with a small vertical video thumbnail on the left, "לפני 12 דק'".
- Hani: "יש לה משחק חדש בבית" , "לפני שעה".
Section label "השבוע":
- Demokratovich: "העלה סרטון חדש: הבחירות בוועד הבית" with a thumbnail, "יום ג'".
- A row with the wordmark planet: "ברוכה הבאה לשלומיוורס, דנה", "יום ב'".
Quiet bottom navigation bar in glass with 4 line icons and tiny labels: "הבית", "דמויות", "צ'אט", "אני".`],

  ['F-lockscreen', [STYLE_REF, face('yotam')], `${SYSTEM}
SCREEN "WHAT A PUSH LOOKS LIKE": a real iPhone lock screen (not the app), dark warm wallpaper, big clock "21:04" and date
"שבת, 31 באוקטובר" in Hebrew. Two stacked iOS notification banners in frosted glass:
1. app icon = orange ringed planet on black, app name "שלומיוורס", "עכשיו", bold title "יותם העלה סרטון חדש",
   body "יותם מסביר רשתות נוירונים. פרק 4 בטקי-טק", with Yotam's small round face (attached) as the notification image.
2. same app icon, "לפני שעה", title "חני", body "יש לי משחק חדש בבית, בואו לשחק".
Standard iOS flashlight and camera buttons at the bottom.`],
];

const only = process.argv.slice(2);
for (const [key, images, prompt] of JOBS) {
  if (only.length && !only.includes(key)) continue;
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log(key, 'FAILED', res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log(key, 'ok', j.usage ? `in ${j.usage.input_tokens} out ${j.usage.output_tokens}` : '');
}
