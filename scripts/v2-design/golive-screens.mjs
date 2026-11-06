// Shlomiverse v2 after go-live: the name screen on desktop (he said "super ugly", a full-width button on an empty page)
// and the /links/ makeover (his bio link in the v2 look). Designed with GPT Image 2.5 (OpenAI direct, MEDIUM).
//   node scripts/v2-design/golive-screens.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/golive/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'golive');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const WIKI = 'C:/workspace/BoostMind/public/wiki';
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const STYLE_REF = img(`${DESIGN}/2-tap.jpg`, 'style.jpg');
const NICK_REF = img(`${DESIGN}/phase1/B-nickname.jpg`, 'nickname-phone.jpg');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png', 'image/png');
const face = (id) => img(`${WIKI}/img/c/${id}.jpg`, `${id}.jpg`);
const SHLOMI = img('C:/workspace/BoostMind/public/links/shlomi.jpg', 'shlomi.jpg');
const LINKS_NOW = img(process.argv.find((a) => a.endsWith('links-live.png')) || `${OUT}/links-live.png`, 'links-now.png', 'image/png');

const SYSTEM = `A premium web app screen mockup, flat full-screen screenshot (no device frame, no hand).
App: "שלומיוורס" (Hebrew, right-to-left UI) - a comedy universe of characters played by one creator.
FOLLOW THE ATTACHED STYLE REFERENCES EXACTLY (the approved design system):
- Background near-black #0b0b0e with a soft warm orange glow, frosted dark glass cards with 1px faint white borders, 22-28px corners.
- One accent: warm orange #ff6a1f for the one main action. White text, dim grey secondary text.
- The logo is the attached glowing orange planet with "שלומיוורס" on its ring (use it as is, never redraw or respell the word).
- Characters appear as the attached round portrait photos. Line icons, no emoji. Heebo-like Hebrew sans, bold titles.
- All Hebrew text right-aligned and correctly spelled. Calm, premium, cinematic - not a form on an empty page.`;

const JOBS = [
  ['N-name-desktop', '1536x1024', [STYLE_REF, NICK_REF, LOGO, face('yotam'), face('hani'), face('rosenblum'), face('osnat')], `${SYSTEM}
DESKTOP "CHOOSE YOUR NAME" SCREEN (right after Google sign-in), 16:10. The second reference is the approved PHONE version of
this screen - make the desktop version of it. Behind everything: a soft, dark, blurred wall of character portrait tiles
(the attached faces, dimmed to 15-25%), with the orange glow at the top. In the center ONE frosted glass card, about 520px
wide, everything inside it:
the logo (small, glowing) at the top, title "איך יקראו לכם בשלומיוורס?", dim line "ככה הדמויות יכירו אתכם. אפשר לשנות אחר כך.",
a big round avatar placeholder with a small orange camera button on its edge, two small pill buttons "העלאת תמונה" and
"התמונה מ-Google", a large rounded text field with an orange focus border containing "שלומי", a row of three suggestion
chips "מאחורי רוזנבלום", "בחדר של יניב", "מהלובי של גלעד", and at the bottom of the card one orange pill button
"נכנסים לשלומיוורס" the width of the card (NOT the width of the screen). Under the card a tiny dim line "אנשים אמיתיים. יקום מקביל."`],

  ['O-links-desktop', '1536x1024', [STYLE_REF, LINKS_NOW, LOGO, SHLOMI, face('hani'), face('yotam'), face('ayelet')], `${SYSTEM}
DESKTOP "LINK IN BIO" PAGE of the creator, 16:10. The second reference is the CURRENT page (its content stays, its look is
outdated - redesign it in the style system). Use the attached creator photo for him.
Layout: the orange glow on top, a slim top bar with the small logo at the right and a round profile button at the left.
A centered column about 1100px wide, two columns on desktop:
RIGHT column (narrower): a glass profile card - his round photo with an orange ring, name "שלומי זוין", dim line
"מערכונים קומיים קצרים", a row of 5 round social buttons (TikTok, Instagram, YouTube, Facebook, X line icons), and two
buttons "WhatsApp" and "מייל" under a small title "שיתופי פעולה".
LEFT column (wider): first a big glowing card "שלומיוורס" with the attached logo, a row of overlapping round character faces,
the line "כל הדמויות. כל הסרטונים. ואפשר לדבר עם כולן." and an orange button "לשלומיוורס"; then a spotlight card
"עכשיו בשלומיוורס · המשחקייה של חני" with Hani's photo and a row of small game thumbnails; then "סרטונים אחרונים" -
3 vertical video posters in a row with titles; then "האתרים של הדמויות" - a 2-column grid of compact glass tiles, each with a
small square icon, a bold name and a dim one-line description (Techy-Tech, איילת השחר, קהילת שערי בג"צ, שפע עד, המשחקייה של חני,
דורית מרקורי, Homo Useless, החנות של יותם). Every tile clearly clickable (border + small arrow).`],

  ['P-links-phone', '1024x1536', [STYLE_REF, LINKS_NOW, LOGO, SHLOMI, face('hani'), face('yotam')], `${SYSTEM}
PHONE "LINK IN BIO" PAGE of the creator, 9:16. The second reference is the CURRENT page (keep its content and order, redesign
its look in the style system). Use the attached creator photo for him. Top: his round photo with an orange ring, "שלומי זוין",
"מערכונים קומיים קצרים", 5 round social line-icon buttons. Then the big glowing "שלומיוורס" card with the attached logo, faces
row and an orange "לשלומיוורס" button. Then the "עכשיו בשלומיוורס · המשחקייה של חני" spotlight card. Then "שיתופי פעולה" with
WhatsApp and מייל buttons. Then the start of "סרטונים אחרונים" with 3 vertical posters. Clean spacing, every card the same glass.`],
];

const only = process.argv.slice(2).filter((a) => !a.endsWith('.png'));
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, size, images, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', size);
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
