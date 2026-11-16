// Shlomiverse home, round 2 - the FEED (Shlomi's comments on plan home-first-screen, 2026-11-16): he liked B (a feed like
// TikTok) - videos, games and talking to the character in one feed; commenting on a video, to everyone or to the character, and
// the character answers; a tutorial on the first visit that shows what can be done (in the games too); maybe the top and bottom
// bars see-through ("not sure"); keep today's single full-screen hero that you scroll from; every good thing reachable as a
// button; A's wide video was wrong - the videos are vertical. Phone only (his rule).
//   node scripts/v2-design/home-feed.mjs <dir with live.png + posters> [only-key ...]  ->  Documents/shlomiverse-v2-design/home-feed/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/home-feed';
fs.mkdirSync(OUT, { recursive: true });
const IN = process.argv[2];
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const LIVE = img(path.join(IN, 'live.png'), 'live.png', 'image/png');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/icon-512.png', 'logo.png', 'image/png');
const poster = (id) => img(path.join(IN, `${id}.jpg`), `${id}.jpg`);
const face = (id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `face-${id}.jpg`);

const SYSTEM = `A phone app screen mockup, flat full-screen screenshot (no device frame, no hand), 9:16, phone only.
App: "שלומיוורס" (Hebrew, right-to-left UI) - a comedy universe of characters from short comedy videos, treated as real people.
The home screen is a vertical FEED, like the short-video apps the visitors come from: one item fills the whole screen, swipe up
for the next. Items are the characters' vertical videos, their games, and invitations to talk to a character.
Style from the FIRST attached image (today's app): near-black, warm orange #ff6a1f as the only accent, white bold Hebrew, dim grey
secondary text, thin line icons, rounded pills, the planet logo (attached) small at the top. Videos use the attached posters
exactly as they are (vertical phone videos with burned-in Hebrew subtitles) - full-bleed, never cropped to a wide frame.
Characters appear as round portrait photos (the attached faces). No hearts, no emoji. All Hebrew right-aligned, spelled exactly.`;

// the action column (the left edge in an RTL app), the same on every video
const RAIL = `On the LEFT edge, a column of round buttons, each with a tiny label under it: the round face of the character with
a small orange "+" ("לעקוב"), a speech bubble "דברו איתה", a comment icon with "128", a game controller "המשחק שלה", a share arrow.`;

const JOBS = [
  ['1-feed-glass', [LIVE, LOGO, poster('savta-1'), face('savta')], `${SYSTEM}
THE FIRST SCREEN, see-through version: the video (poster "savta-1") fills the ENTIRE screen edge to edge, behind everything.
The top bar and the bottom navigation float over it as dark frosted-glass strips (semi-transparent, the video visible through them):
top - the small logo, a search icon, a bell, an orange "כניסה" pill; under it three small tabs "בשבילך" (selected, underlined
orange), "סרטונים", "משחקים". Bottom navigation: בית, דמויות, סרטונים, קהילה, צ'אט.
${RAIL}
Over the bottom of the video: "סבתא" in bold with a small round face, the title "לולה עלתה על המטפלת", a small
"מושתק - הקישו לסאונד" pill. Just above the bottom navigation a small hint with an up-arrow: "החליקו לעוד".`],
  ['2-feed-solid', [LIVE, LOGO, poster('savta-1'), face('savta')], `${SYSTEM}
THE FIRST SCREEN, solid-bars version: an opaque near-black top bar (the small logo, a search field "חיפוש", a bell, an orange
"כניסה" pill) and an opaque bottom navigation (בית, דמויות, סרטונים, קהילה, צ'אט). Between them the video (poster "savta-1")
fills all the space, with rounded top corners, already playing, muted.
${RAIL}
Over the bottom of the video: "סבתא" in bold with a small round face, the title "לולה עלתה על המטפלת", a small
"מושתק - הקישו לסאונד" pill, and a thin orange progress line along the video's bottom edge.`],
  ['3-tutorial', [LIVE, LOGO, poster('savta-1'), face('savta')], `${SYSTEM}
THE FIRST VISIT ONLY - a short tutorial over the feed (the same see-through screen as the feed: poster "savta-1" full-bleed,
glass bars, the left column of buttons: the face with "+", "דברו איתה", comments "128", "המשחק שלה", share).
The whole screen is dimmed except three spotlighted spots, each with an orange numbered bubble and a short white line:
1. on the comment button: "תגיבו - וסבתא עונה לכם"
2. on the "דברו איתה" button: "או דברו איתה ישר"
3. on a big up-arrow in the middle of the screen: "החליקו למעלה לסרטון הבא, למשחקים ולדמויות"
At the bottom centre an orange pill button "הבנתי, בואו נתחיל" and a small "1/3" step counter.`],
  ['4-comments', [LIVE, LOGO, poster('savta-1'), face('savta')], `${SYSTEM}
THE COMMENTS on a video: a bottom sheet rising over the feed (the video "savta-1" visible and dimmed above it, about 35% of the
screen). Sheet title "128 תגובות". Two tabs at the top of the sheet: "לכולם" and "לסבתא" (selected).
Three comments, each with a small round avatar (a plain initial letter for viewers), a name, the text, and "השב":
- "נועה": "סבתא, מאיפה מגיעים הרמזים האלה?"
  and, indented right under it as a reply, with the round face of Savta, her name "סבתא", an orange badge "הדמות ענתה":
  "מאיפה? מחמישים שנה של שכנים, מאמי. אחרי זה כבר אין לך צורך במצלמות."
- "דור": "לולה גאונה"
- "מיכל": "אני עם אברם, זו סתם מטפלת"
At the bottom of the sheet a text field with the hint "כתבו לסבתא..." and an orange send arrow.`],
  ['5-game-in-feed', [LIVE, LOGO, img(path.join(IN, 'game.jpg'), 'game.jpg'), face('hani')], `${SYSTEM}
A GAME as an item in the feed (the screen after swiping up from a video): the attached game art "game.jpg" EXACTLY (an
illustrated woman in a long dark dress holding a paper bag in front of glass hospital doors) fills the screen, glass bars over it.
A small orange chip "משחק", the title "דלת של שבת", the line "של חני פרידמן" with her small round face, and a very big orange
button in the lower third "לשחק עכשיו" with a play icon. Under the button a dim line "חצי דקה ללמוד, אין צורך בהרשמה".
The left column of round buttons here: Hani's face with "+", "דברו איתה", a trophy "שיאים", share.
Just above the bottom navigation a small hint with an up-arrow: "החליקו לעוד".`],
];
const only = process.argv.slice(3);
for (const [key, images, prompt] of JOBS) {
  if (only.length && !only.includes(key)) continue;
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-flare'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}
