// Round 4 (2026-11-03, his ask): games per character are becoming part of the Shlomiverse - Hani's playhouse first, now
// Yaniv's, more to come. Where they live on the site: the home, a games place of their own, every character's page.
// GPT Image 2.5 (OpenAI direct, MEDIUM); the live screenshots as the reference.
//   node scripts/v2-design/games.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/golive/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'golive');
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const BAND = img(`${OUT}/g-band-now.png`, 'home-now.png'), CHAR = img(`${OUT}/g-char-now.png`, 'games-now.png');

const SYSTEM = `A premium mobile web screen mockup, flat full-screen phone screenshot (no device frame), 390px wide, 9:16.
App: "שלומיוורס" (Hebrew, right-to-left) - the home of a comedy universe of characters (real-looking people, each with
videos, stories, their own sites and now their OWN GAMES). Style: exactly the attached screenshots - near-black #0b0b0e,
warm orange glow, 1px faint borders, 18-24px corners, ONE accent orange #ff6a1f used sparingly, white text, dim grey
secondary text, line icons, no emoji, Heebo-like Hebrew sans, mobile first, no card inside a card, the bottom bar
"בית / דמויות / סרטונים / קהילה / צ'אט". All Hebrew right-aligned and correctly spelled.`;

const GAMES = `What we have: short browser games that star the characters, played on the phone in one tap, free. Today:
Hani (a Haredi mother of many, glasses, black snood) has 6 games in "המשחקייה של חני" (e.g. "4:20 - רצים לגן!",
"ניסי ניסים!", "פילאי פלואים", "שקל טוב"), and Yaniv (a broken guy with a back problem) has his first game
"מילימטרים". More characters will get games. Each game has a wide 1.91:1 illustrated cover (like the attached ones),
a short name, one line, and belongs to a character (their round face).`;

const JOBS = [
  ['G-home', [BAND, CHAR], `${SYSTEM}
${GAMES}
Design how GAMES appear on the HOME screen, in the flow of the home (the attached first screenshot is the home's
"what you can do here" section: sticker hero, the stickers pack, chat, follow, then small tiles stories / "משחקי חני" /
sites). Show the home scrolled to a new games row of its own, between the "what you can do" section and "סרטונים
אחרונים": a row title "משחקים" with a dim "כל המשחקים ←" link, then a horizontally swipeable row of game cards (cover,
name, the character's small round face), the newest first, with a small "חדש" tag on the newest. Above it, the end of
the "what you can do" section where the small tile now reads "משחקים" (not only Hani's).`],
  ['G-page', [CHAR, BAND], `${SYSTEM}
${GAMES}
Design the dedicated GAMES PAGE of the site ("המשחקים של השלומיוורס"): a short header with one dim line ("משחקים קצרים
עם הדמויות. נכנסים ומשחקים."), then a row of character filter chips with round faces ("כולם", "חני", "יניב"), then a
big featured card for the newest game (wide cover, name, line, the character's face and name, an orange pill
"לשחק"), then the rest grouped by character: a small heading with the character's face and name ("המשחקייה של חני",
"המשחקים של יניב"), and their games as 2-column cards (cover, name, one dim line).`],
  ['G-char', [CHAR, BAND], `${SYSTEM}
${GAMES}
Design the GAMES section on a CHARACTER'S PAGE (Hani's): the attached second screenshot is today's version (a plain
2-column grid titled "משחקים"). Make it feel like her playhouse inside her page and make playing obvious: section
title "המשחקים של חני" with a dim count, the newest as one wide card with an orange "לשחק" pill, the rest as a
horizontally swipeable row of smaller cards; keep it short so the videos below are still reached quickly.`],
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
