// Shlomiverse home, round 5 (Shlomi, 2026-11-16): drop the feed ("not working, and we're losing the chat - people do use the
// chat"); a home built from the things that keep visitors longest, very ordered, easy to read, distinct sections, little room for
// the logo, a top bar and a bottom tab bar that stay on every screen (an APP, not a site - his note). Try other image models.
// The data (new visitors, 14 days, median time on site after doing X): sign in 297 s, finish a game 261 s, open a character
// 189 s, the simulation test 184 s, start a game 173 s, watch a video 169 s, chat 124-128 s (the most used first tap: 29%).
// The brief says WHAT, the model designs the look (his rule).
//   node scripts/v2-design/home-r5.mjs <dir with posters> [only-key ...]  ->  Documents/shlomiverse-v2-design/home-r5/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/home-r5';
fs.mkdirSync(OUT, { recursive: true });
const IN = process.argv[2];
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/jpeg') => [new Blob([fs.readFileSync(file)], { type }), name];
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png', 'image/png');
const FACE_IDS = ['yotam', 'hani', 'savta', 'demokratovich', 'rosenblum', 'amir'];
const FACES = FACE_IDS.map((id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `face-${id}.jpg`));
const ART = [img(path.join(IN, 'game.jpg'), 'game-shabbat-door.jpg'), img(path.join(IN, 'adam-1.jpg'), 'video-adam.jpg'), img(path.join(IN, 'savta-1.jpg'), 'video-savta.jpg')];

const BRIEF = `Design the HOME SCREEN of a phone web app, as a world-class product designer would for a top consumer app.
Deliver one flat, full-screen phone screenshot, 9:16, no device frame, no hand. Hebrew, right-to-left.

THE PRODUCT: "שלומיוורס" - a comedy universe. A comedian plays dozens of characters in short comedy videos; the app treats the
characters as real people. Visitors arrive on their phone from TikTok / Instagram. It is an APP (a web app), not a website.

WHAT THE HOME MUST DO: show at once, in a very ordered way, the few things that keep people longest, so a newcomer sees right
away that there is a lot here and taps one of them within seconds. In order of how much people use / stay with them:
1. Talk to the characters - the most used thing. Each character answers in character. A question box ("שאלו משהו, או @ לדמות")
   and the characters' faces (attached: "יותם", "חני פרידמן", "סבתא", "הרב דמוקרטוביץ", "המורה רוזנבלום", "אמיר").
2. Games - people who play stay the longest. One featured game (attached art "game-shabbat-door": "דלת של שבת") and a hint of more.
3. Videos - the newest (attached posters: "video-adam" - "אדם עושה אול הנדס אחרי הגיוס", "video-savta" - "לולה עלתה על המטפלת").
4. "אתם חיים בסימולציה?" - a short test that keeps people long.
5. The characters' stories (round faces with rings).
Plus, always on every screen: a slim TOP bar (the attached logo SMALL - it must not take space - a search icon, a bell, an orange
"כניסה" button) and a BOTTOM tab bar: בית (selected), דמויות, סרטונים, משחקים, צ'אט.

MUST: very clean and ordered, distinct sections that are easy to tell apart, easy to read, big touch targets, obvious what is a
button. A dark theme with warm orange #ff6a1f as the single accent. Use the attached pictures as they are. No emoji, no hearts.
Spell all Hebrew exactly as given. Show the first screen only (what is visible before scrolling) - the rest may be cut at the
bottom edge, above the tab bar.`;

const JOBS = [
  ['A-doors', 'gpt-image-2.6-sunburst', `${BRIEF}

DIRECTION: everything above the fold - all five are visible on the first screen as clear, ordered doors of different sizes
(the most used biggest). You decide the layout and the look.`],
  ['B-talk-first', 'gpt-image-2.6-sunburst', `${BRIEF}

DIRECTION: talk first - the conversation with the characters is the hero of the screen, and right under it the other sections as
tidy compact rows, so the newcomer sees both "I can talk to them" and "there is much more". You decide the layout and the look.`],
  ['C-designer', 'gpt-image-2.6-sunburst', `${BRIEF}

DIRECTION: your own best idea for the most ordered, easiest-to-read home that gets a tap within three seconds. You decide.`],
  ['D-talk-first-chatgpt', 'chatgpt-image-latest', `${BRIEF}

DIRECTION: talk first - the conversation with the characters is the hero of the screen, and right under it the other sections as
tidy compact rows, so the newcomer sees both "I can talk to them" and "there is much more". You decide the layout and the look.`],
];
const only = process.argv.slice(3);
for (const [key, model, prompt] of JOBS) {
  if (only.length && !only.includes(key)) continue;
  const form = new FormData();
  form.append('model', model); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'high'); form.append('n', '1');
  if (!model.startsWith('chatgpt')) form.append('output_format', 'jpeg');
  for (const [blob, name] of [LOGO, ...FACES, ...ART]) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, model, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key, model);
}
