// Shlomiverse chat: the two cards that live inside a reply - the request to Shlomi the guide prepares (the visitor
// approves it) and the sign-in a character asks for, in their own voice, when the day's free questions are used.
// He: "show me how the suggestion box looks - if it's ugly use OpenAI models to design it" / "design it to be cool
// with the chat". GPT Image 2.5 (OpenAI direct, MEDIUM), the current screenshots as the reference.
//   node scripts/v2-design/chat-cards.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/golive/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'golive');
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const STYLE_REF = img(`${DESIGN}/2-tap.jpg`, 'style.jpg');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png', 'image/png');
const CARD_NOW = img(`${OUT}/card.png`, 'request-now.png', 'image/png');
const QUOTA_NOW = img(`${OUT}/quota.png`, 'signin-now.png', 'image/png');
const HANI = img('C:/workspace/BoostMind/public/wiki/img/c/hani.jpg', 'hani.jpg');

const SYSTEM = `A premium mobile chat screen mockup, flat full-screen phone screenshot (no device frame, no hand), 9:16.
App: "שלומיוורס" (Hebrew, right-to-left) - visitors chat with the characters of a comedy universe.
KEEP THE CHAT EXACTLY AS IN THE ATTACHED CURRENT SCREENSHOT (its header with the round faces strip, the bubbles, the composer
at the bottom, colours, fonts) - redesign ONLY the card described below so it feels like a native part of the chat, not a
web form pasted in: lighter, warmer, part of the message bubble, one clear action. Style system (also in the style reference):
near-black #0b0b0e with a warm orange glow, frosted dark glass, 1px faint borders, 18-24px corners, ONE accent orange
#ff6a1f, white text, dim grey secondary text, line icons, no emoji, Heebo-like Hebrew sans. All Hebrew right-aligned and
correctly spelled.`;

const JOBS = [
  ['Q-request-card', [CARD_NOW, STYLE_REF, LOGO], `${SYSTEM}
THE CARD: inside the guide's reply bubble (the guide's avatar is the attached orange planet logo). The guide wrote
"זה הנוסח שיגיע לשלומי. אפשר לשנות לפני האישור." and under it a REQUEST TICKET to Shlomi - think of a small elegant
note / envelope / ticket stub, not a form: a tiny label line with a small envelope line icon "פנייה לשלומי · מחפשים סרטון",
the request text itself shown as a quoted message (editable, with a small pencil icon at its corner, no visible input box
until tapped): "אני מחפש/ת סרטון של חני בחתונה של הבן שלה. אם יש סרטון כזה, אשמח שיופיע בשלומיוורס.", one slim optional
line "איך לחזור אליכם (לא חובה)" as an underline field, and one orange pill button "אשרו ושלחו לשלומי" with a small send
icon. A tiny dim line under it: "מגיע ישר לשלומי, בלי הבטחה למענה." Compact - the whole card about a third of the screen.`],
  ['R-signin-in-chat', [QUOTA_NOW, STYLE_REF, HANI], `${SYSTEM}
THE CARD: the visitor is chatting with the character חני (the attached round portrait is her avatar in the header and on
her bubble). The visitor asked "ומה עם שרולי?" and Hani answers IN HER OWN VOICE in her bubble: "אוי, אני באמצע לשים
חלה בתנור. תתחברו רגע עם Google ונמשיך לדבר, יש לי עוד הרבה לספר." Right under her text, attached to the same bubble, a
small elegant SIGN-IN CARD that feels like part of her message: a white pill button with the Google "G" logo and
"המשך עם Google", and next to/under it a tiny dim line "חינם · 10 שאלות ביום". Maybe a subtle orange glow edge. No big
box, no form - one tap. The previous messages above are a normal short chat with Hani.`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, images, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); return; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key, j.usage ? JSON.stringify(j.usage) : '');
}));
