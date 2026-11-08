// Shlomiverse: ציפציף, the residents' own X - round 3 with the real brand (his picks 2026-11-08: the name ציפציף + the
// planet-bird logo, the news channel חרדות as one of the accounts; residents react to real news AND to חרדות). Round 2:
// feed2.mjs. The Shlomiverse's residents' X, round 2 (his note 2026-11-08 on round 1: "all are bad - we want X, like Twitter, not a
// news channel - the feed where the people are reacting to stuff"; then: news is an option - the verse's own חדשות channel
// is one account that posts parodied real news / fake news, and the residents react to it). Same setup as feed.mjs; the
// header shows only the parent planet logo, so the name stays open.
//   node scripts/v2-design/feed2.mjs [only-key ...]   ->  Documents/shlomiverse-v2-design/feed2/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'feed3');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const WIKI = 'C:/workspace/BoostMind/public/wiki';
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const HOME_REF = img(`${DESIGN}/next-plan/ref-home.png`, 'home.png', 'image/png');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png', 'image/png');
const ICON = img(`${DESIGN}/feed-logos/tziftzif-icon.png`, 'tziftzif.png', 'image/png');
const NEWS = img(`${DESIGN}/news-logos/charadot-avatar.png`, 'charadot.png', 'image/png');
const face = (id) => img(`${WIKI}/img/c/${id}.jpg`, `${id}.jpg`);

const SYSTEM = `A mobile app screen, flat full-screen screenshot (no device frame, no hand). Hebrew, right-to-left.
WHAT IT IS: a social network exactly in the spirit of X / Twitter - a TIMELINE OF PEOPLE POSTING. Short text posts, one under
the other, each by a person: round profile photo, bold name, a grey @handle and the time, the post text, sometimes a photo or a
quoted post inside, and under each post a row of small actions with counts (reply, quote, a "stamp" reaction, share). Replies
hang under a post with a thin thread line. It must feel like scrolling a busy, alive X feed - people talking, joking, arguing.
WHO POSTS: the residents of "שלומיוורס" - a comedy creator's universe of people he plays, treated as REAL people. The attached
portrait photos are them; each face goes with its own name only. Visitors don't write posts, they only reply.
THE BRAND: this network is called "ציפציף" (Hebrew, exactly צ-י-פ-צ-י-ף); its logo is the attached glowing planet-bird speech
bubble (image 2) - in the top bar show that mark small + the word "ציפציף" in white bold Hebrew. The news channel account
"חרדות" uses the attached red-siren news logo (image 3) as its round avatar.
RIGHT-TO-LEFT LAYOUT: every profile photo sits on the RIGHT of its post, names and text right-aligned, the action row mirrored.
There is NO compose / post button anywhere (visitors only reply).
LOOK: the attached first image is the site this lives in (dark, near-black, warm orange #ff6a1f as the one accent, the
glowing planet logo). Clean, dense like X, NOT cards with big padding; thin separator lines between posts. One Hebrew sans.
No emoji. All Hebrew short and correctly spelled, right-aligned.`;

const J = (key, size, faces, prompt) => [key, size, [HOME_REF, ICON, NEWS, ...faces.map((f) => face(f[0]))], `${SYSTEM}
THE FACES, in the order attached after the two logos: ${faces.map((f, i) => `photo ${i + 1} = ${f[1]}`).join(', ')}.
${prompt}`];
const JOBS = [
  J('Y1-timeline', '1024x1536', [['hani', 'חני @hani'], ['yotam', 'יותם @yotam_ceo'], ['osnat', 'אסנת @osnat_hr'], ['avram', 'אברם @avram']], `
SCREEN: the main timeline. Top bar: the ציפציף mark + word in the middle, a search icon; under it two tabs "בשבילך" (selected,
orange underline) and "במעקב". Posts, top to bottom:
1. חרדות (the siren news logo as avatar, a small red "שידור חי" tag) @charadot · 12 דק׳: "מבזק: משרד האוצר הודיע שהמע״מ יעלה רק
   על דברים שאנשים צריכים. האם זה הסוף? הישארו איתנו." - 214 replies.
2. Hani (photo 1) QUOTE-POSTS it: "אז אצלנו לא יעלה כלום. אנחנו לא צריכים כלום, יש לנו את השם." with the חרדות post shown
   small inside hers as a quoted box.
3. Yotam (photo 2) · 40 דק׳ reacting to a REAL news link: "אצלנו לא מפטרים. אצלנו עושים התאמה ארגונית." with a link card inside
   the post: source "גלובס", headline "חברת הטכנולוגיה מצמצמת 2,000 משרות". Under it, threaded: Osnat (photo 3) "@yotam_ceo אז
   אפשר להחזיר את הקפה למטבחון?"
4. Avram (photo 4) · שעה: "חני מבקשת שאפסיק לכתוב פה. אז זה הפוסט האחרון שלי." and a small grey "עוד 2 פוסטים של אברם".
Bottom: the site's 5-item navigation bar.`),

  J('Y2-timeline-media', '1024x1536', [['rosenblum', 'המורה רוזנבלום @rosenblum'], ['demokratovich', 'הרב דמוקרטוביץ @demokratovich'], ['genz', 'הג׳ן זי @genz'], ['hani', 'חני @hani']], `
SCREEN: the same timeline further down - posts with media. Top bar: the ציפציף mark + word. Then a row of round faces "מי כותב עכשיו" with orange rings (photos
1-4), like stories. Posts:
1. Rosenblum (photo 1) · 8 דק׳: "מישהו כתב על הלוח ׳רוזנבלום מלך׳. אני רוצה לדעת מי. ולתת לו 100." with a PHOTO in the post:
   a classroom blackboard with chalk scribbles.
2. Rabbi Demokratovich (photo 2) · 25 דק׳: "הודעה רשמית: ההצבעה על שעון חורף תתקיים בשעון קיץ." - a poll inside the post with two
   options "בעד" 61% / "נגד" 39% and "1,204 הצבעות".
3. The Gen Z guy (photo 3) replying to the rabbi: "@demokratovich אפשר להצביע בסטורי?" and under it, threaded, the rabbi again:
   "לא. רק בטופס 17, בשלושה עותקים."
4. Hani (photo 4) · שעה: "מי שלקח את העגלה מהלובי, תחזיר. יש בה ילד."
Bottom: the navigation bar.`),

  J('Y3-post-open', '1024x1536', [['yotam', 'יותם @yotam_ceo'], ['osnat', 'אסנת @osnat_hr'], ['vova', 'וובה @vova'], ['daniel', 'דניאל @daniel']], `
SCREEN: one post opened, with its whole conversation. Top: a back arrow and "פוסט". The post big: Yotam (photo 1) "גייסנו 4 מיליון.
מחר נבין למה." with the date and full counts (88 תגובות, 12 ציטוטים, 430 חותמות). Then the replies, X style, each with a
thin thread line: Osnat (photo 2) "אז אפשר להחזיר את הקפה למטבחון?"; Vova (photo 3) "4 מיליון זה 3 מיליון אחרי מס. ואחרי דניאל
זה 2."; Daniel (photo 4) "@vova ראיתי."; then two VISITOR replies with generic grey avatars and names ("נועה", "איתי 92"); one
of them tags "@yotam_ceo" and under it Yotam answers him in person. Bottom: a reply bar "להגיב ליותם..." with an orange send button.`),

  J('Y4-profile', '1024x1536', [['hani', 'חני @hani']], `
SCREEN: a resident's profile, X style. A wide cover photo on top (a warm, busy family kitchen), the round profile photo (photo 1)
overlapping it, an orange "לעקוב" button and a bell. Name "חני", @hani, a one-line bio "אמא. בני ברק. לא עונה בשבת.", a line
"עוקבים 3,812 · עוקבת אחרי 6". Tabs: "פוסטים" (selected), "תגובות", "סרטונים", "משחקים". Her posts below in the timeline style:
one plain text post, one reply she wrote to Avram (shown with the quoted line), and a post with a short vertical video of hers
(a play icon, "סרטון חדש") - her new video announced as a post.`),
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
