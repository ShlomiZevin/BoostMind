// Round 3 (2026-11-02, his notes on the phone): visitors don't know what they can do on the site ("they know it from the
// marketing, not on the website") - put it in the home's "מה הלאה בשלומיוורס" band, which held only ideas; and the
// sign-in window that opens from "סטיקר מהרגע" didn't show the sticker as a benefit ("it has to be as a benefit").
// GPT Image 2.5 (OpenAI direct, MEDIUM); the live screenshots as the reference.
//   node scripts/v2-design/can-do.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/golive/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'golive');
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const STYLE_REF = img(`${DESIGN}/2-tap.jpg`, 'style.jpg');

const SYSTEM = `A premium mobile web screen mockup, flat full-screen phone screenshot (no device frame), 390px wide, 9:16.
App: "שלומיוורס" (Hebrew, right-to-left) - the home of a comedy universe of characters (real-looking people, each with
videos, stories and their own sites). Style: near-black #0b0b0e, warm orange glow, frosted dark glass, 1px faint borders,
18-24px corners, ONE accent orange #ff6a1f used sparingly, white text, dim grey secondary text, line icons, no emoji,
Heebo-like Hebrew sans, mobile first, nothing nested more than one level, no card inside a card. All Hebrew right-aligned
and correctly spelled.`;

// what a visitor can actually do here (each one is a real feature, one tap away)
const CAN_DO = `The things a first-time visitor can do here (each tile opens it):
- "סטיקר מהרגע" - pause any video on a funny moment and turn it into a WhatsApp sticker with a line on it (the most fun
  thing on the site; show a tiny example sticker: a cut-out face with a white sticker border and a Hebrew line).
- "לדבר עם הדמויות" - every character answers in a chat, in their own voice.
- "לעקוב אחרי דמות" - get their new videos and stories (bell icon).
- "סטוריז" - the characters' stories, like Instagram (the round faces).
- "המשחקים של חני" - games.
- "האתרים של הדמויות" - their shops, companies and services.
- "להציע רעיון" - an idea for the next episode; others vote, the best reach Shlomi.`;

const JOBS = [
  ['X-cando-a', [img(`${OUT}/band2-now.png`, 'band-now.png', 'image/png'), STYLE_REF], `${SYSTEM}
REDESIGN this home section (the attached screenshot is the current one: only ideas, an empty box, two promo cards).
It must now first tell a newcomer WHAT THEY CAN DO in the Shlomiverse, then invite ideas. The section keeps the title
"מה הלאה בשלומיוורס?". ${CAN_DO}
Design the "what you can do" part so it is scannable in two seconds on a phone and clearly tappable - a compact, lively
layout where the sticker one is the hero, the rest smaller. Then the ideas part, compact (a row "יש לכם רעיון לפרק הבא?"
with an orange pill "הציעו רעיון"). Business cooperation shrinks to one small dim link at the bottom.`],
  ['X-cando-b', [img(`${OUT}/band2-now.png`, 'band-now.png', 'image/png'), STYLE_REF], `${SYSTEM}
REDESIGN this home section (the attached screenshot is the current one). A different idea from a grid: a horizontally
swipeable row of tall "what you can do here" cards, each with a real-looking visual (a sticker being made from a video
frame, a chat bubble from a character, a story ring, a game cover, a shop page), a short Hebrew title and one dim line,
like a mini onboarding the visitor swipes through. Section title "מה הלאה בשלומיוורס?" with a dim line "כל מה שאפשר
לעשות כאן". ${CAN_DO}
Under the row, compact: "יש לכם רעיון לפרק הבא?" with an orange pill "הציעו רעיון", and one small dim link "לעסקים ושיתופי
פעולה".`],
  ['Y-signin-sticker', [img(`${OUT}/signin-now.png`, 'signin-now.png', 'image/png'), STYLE_REF], `${SYSTEM}
REDESIGN this bottom sheet (attached: the current one). It opens when a visitor presses "סטיקר מהרגע" on a video, and
asks them to sign in with Google first. Today it ignores what they pressed (generic "follow / notifications / save"), so
it doesn't feel like a benefit. The new sheet must make THE STICKER the reward: at the top, the actual video moment they
paused on, already shown as a sticker (the frame cut into a rounded shape with a thick white sticker border, slightly
tilted, the character's catchphrase on it), the title "הסטיקר שלכם מחכה", one dim line "רגע אחד עם Google, והוא
אצלכם בוואטסאפ", then 2-3 small benefit rows (each with a line icon): "מכינים סטיקרים מכל רגע בכל סרטון", "שומרים
את כל הסטיקרים שלכם במקום אחד", "הדמויות יכירו אתכם בשם". Then the white "כניסה עם Google" button and the dim "בלי
סיסמאות. בלי ספאם.". A drag handle on top (it slides down to close). The paused video stays visible, dimmed, above the
sheet.`],
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
  console.log('ok', key);
}));
