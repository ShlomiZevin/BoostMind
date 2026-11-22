// The invitation to comment, OUTSIDE the comments (his note 2026-11-22: "the strip inside the comments is heavy - I want users to
// know it outside the comments, to encourage them to leave one"): on the video screen, the residents in the video answer comments.
// Concept prompts = what it is for and what is on it, never how it looks (his rule). gpt-image-2.6-sunburst, MEDIUM, 1024x1536.
//   node scripts/v2-design/comments-invite.mjs <current player screenshot.png> [--sheet]
// -> Documents/shlomiverse-v2-design/comments/invite-1..3.jpg + invite-mockups.jpg (the sheet, labelled A, B, C)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/workspace/BoostMind/techietech-api/package.json');
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/comments';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const blob = (p, type) => new Blob([fs.readFileSync(p)], { type });
const FACES = 'C:/workspace/BoostMind/public/wiki/img/c/';
const PROMPT = `A phone screen (390px wide, Hebrew, right-to-left; spell every Hebrew word exactly as given here) of the Shlomiverse app: the VIDEO screen, while a video plays. The attached "current-screen" is this screen today, in the app's own look (keep the app's top bar, bottom tab bar, the video, its side buttons - comments "תגובות", sticker, save, share, download - the title and the cast row "בכיכוב").
What is new on this screen: in the Shlomiverse the people in the videos are residents of a real world, and they read the comments under their videos and answer back themselves - whoever writes, with or without tagging them. Today nobody knows this until they open the comments. The screen must make the visitor know it while they watch, and make them want to write a comment - without covering the video or getting in the way of watching.
The video: "ההנהלה יורדת לפרטים" with three residents - Amir, Ofer and Daniel (their real faces are attached: "amir", "ofer", "daniel"; in Hebrew: אמיר, עופר, דניאל). What it says, in these words: "אמיר, עופר ודניאל עונים לתגובות". Under the video there is already one real answer to show it is true: Ofer answered a visitor named דנה ("דנה, אני לא מהנהן לכל דבר. אני דווקא מאתגר").`;
const files = [];
const SHEET_ONLY = process.argv.includes('--sheet');
if (SHEET_ONLY) for (let i = 1; i <= 3; i++) files.push(path.join(OUT, `invite-${i}.jpg`));
for (let i = 1; i <= (SHEET_ONLY ? 0 : 3); i++) {
  const f = new FormData();
  f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', PROMPT); f.append('size', '1024x1536');
  f.append('quality', 'medium'); f.append('n', '1'); f.append('output_format', 'jpeg');
  f.append('image[]', blob(process.argv[2], 'image/png'), 'current-screen.png');
  for (const c of ['amir', 'ofer', 'daniel']) f.append('image[]', blob(FACES + c + '.jpg', 'image/jpeg'), c + '.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', i, res.status, j.error?.message); continue; }
  const p = path.join(OUT, `invite-${i}.jpg`);
  fs.writeFileSync(p, Buffer.from(j.data[0].b64_json, 'base64'));
  files.push(p); console.log('ok', p);
}
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const W = 700, H = 1050, PAD = 30, TOP = 140;
const c = createCanvas(PAD + files.length * (W + PAD), TOP + H + PAD), x = c.getContext('2d');
x.fillStyle = '#18181c'; x.fillRect(0, 0, c.width, c.height);
x.fillStyle = '#fff'; x.font = 'bold 34px Arial'; x.fillText('The video screen: the residents answer comments (gpt-image-2.6-sunburst, medium)', PAD, 52);
for (let i = 0; i < files.length; i++) {
  const im = await loadImage(fs.readFileSync(files[i]));
  const left = PAD + i * (W + PAD);
  x.drawImage(im, left, TOP, W, H);
  x.fillStyle = '#ff6a1f'; x.fillRect(left, TOP - 56, 70, 44); x.fillStyle = '#fff'; x.font = 'bold 30px Arial'; x.fillText('ABC'[i], left + 24, TOP - 22);
}
fs.writeFileSync(path.join(OUT, 'invite-mockups.jpg'), c.toBuffer('image/jpeg', 90));
console.log('sheet', path.join(OUT, 'invite-mockups.jpg'));
