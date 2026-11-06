// Round 5 (2026-11-03, his note on the game page): the buttons floating over the game were unclear - "I'm clicking on it
// and I don't understand how to bring back the menu ... With a video it's super clear ... I need to see the profile and
// everything. Maybe we need a frame for it, and you can remove the frame." GPT Image 2.5 (OpenAI direct, MEDIUM); the
// live video page and today's game page as the references.
//   node scripts/v2-design/game-frame.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/gameframe/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/gameframe';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const VIDEO = img(`${OUT}/video-now.png`, 'video-page.png'), GAME = img(`${OUT}/game-now.png`, 'game-page-now.png');

const SYSTEM = `A premium mobile web screen mockup, flat full-screen phone screenshot (no device frame), 390px wide, 9:16.
App: "שלומיוורס" (Hebrew, right-to-left), a comedy universe of characters. Style: exactly the attached screenshots -
near-black, glass round buttons, ONE accent orange #ff6a1f, white text, line icons, no emoji, Hebrew sans, all Hebrew
right-aligned and correctly spelled.`;

const WHAT = `What this screen is: a short browser GAME that stars a character (here "מילימטרים", Yaniv's game - a
physiotherapy game; the game's own screen is the second attached screenshot's inner content: a cover picture, a line,
a big green "לטיפול" button). The game must work on the phone and takes every tap inside its area.
It has to feel like the attached VIDEO page (first screenshot): the character's round face + name + "לעקוב" pill and the
logo at the top, a vertical rail of round glass buttons with a label under each, a glass card at the bottom with the
title. On a game the rail is: "לייק" (the logo's planet icon), "תגובות" (with a count), "שמירה", "שיתוף".
The problem today (second screenshot): those buttons float OVER the game, fade away, and nobody understands how to
bring them back. Fix it with a FRAME: the game sits inside a frame, and the profile, the buttons and the title stay
visible around it the whole time - nothing covers the game. One clear labelled control removes the frame (the game
fills the phone) and an equally clear labelled control brings it back.`;

const JOBS = [
  ['F-framed', [VIDEO, GAME], `${SYSTEM}
${WHAT}
Show the FRAMED state: the top row (face, name, follow, logo), the game as a tall rounded panel taking most of the
screen, the actions always visible and never over the game (choose the clearest place: a row under the game, or a
slim rail beside it), the title "מילימטרים" with one dim line, and a clearly labelled control "מסך מלא" with an icon.`],
  ['F-full', [VIDEO, GAME], `${SYSTEM}
${WHAT}
Show the FULL-SCREEN state after "מסך מלא": the game fills the phone edge to edge; the only thing left is ONE small but
obvious labelled pill at a top corner (the character's tiny face + "יציאה ממסך מלא" or similar) that brings the frame
back. It must be impossible to miss and must not hide the game's own buttons.`],
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
