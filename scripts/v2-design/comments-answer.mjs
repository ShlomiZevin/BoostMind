// The comments sheet: the residents in the video answer back (his ask 2026-11-22: "make it clear that when you comment - even without
// a tag - the residents in the video answer back; design it"; and when a video goes up everyone in it has already commented).
// Concept prompts = what the sheet is for and what is on it, never how it looks (his rule). gpt-image-2.6-sunburst, MEDIUM, 1024x1536.
//   node scripts/v2-design/comments-answer.mjs <current screenshot.png> [--sheet]
// -> Documents/shlomiverse-v2-design/comments/answer-1..3.jpg + answer-mockups.jpg (the sheet, labelled A, B, C)
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
const PROMPT = `A phone screen (390px wide, Hebrew, right-to-left; spell every Hebrew word exactly as given here) of the Shlomiverse app: the COMMENTS sheet that opens over a video. The attached "current-screen" is this sheet today, inside the app's own look (keep the app's top bar, bottom tab bar and its dark + orange brand).
What this sheet is for: in the Shlomiverse the people in the videos are residents of a real world - and they read the comments under their videos and answer back themselves, whoever comments, with or without tagging them. The visitor must understand this at a glance, before writing anything - it is the reason to comment here and not on Instagram.
The video: "ההנהלה יורדת לפרטים" with three residents in it - Amir, Ofer and Daniel (their real faces are attached: "amir", "ofer", "daniel"; names in Hebrew: אמיר, עופר, דניאל).
What is on the sheet:
- That the residents of this video are here, reading, and answer (their faces, and a line saying it: "אמיר, עופר ודניאל קוראים את התגובות ועונים").
- The comments, newest first: Ofer's own comment from when the video went up ("אני דווקא רוצה לאתגר: מי ביקש פרטים? אנחנו מסונכרנים על הכיוון."), a visitor "דנה" who wrote "עופר מה אתה מהנהן לכל דבר" and Ofer's answer under it ("דנה, אני לא מהנהן לכל דבר. אני דווקא מאתגר, ובמקרה הזה הגעתי לאותה מסקנה כמו אמיר."), and a visitor "יוסי" who just wrote "אמיר אתה בכלל יודע מה זה מוצר?" - under it, Amir is writing his answer right now ("אמיר מקליד…"). A resident's comment must be told apart from a visitor's at once.
- The box to write a comment ("כתבו לאמיר, עופר ודניאל…") with the visitor's own small picture and a send button.`;
const files = [];
const SHEET_ONLY = process.argv.includes('--sheet');
if (SHEET_ONLY) for (let i = 1; i <= 3; i++) files.push(path.join(OUT, `answer-${i}.jpg`));
for (let i = 1; i <= (SHEET_ONLY ? 0 : 3); i++) {
  const f = new FormData();
  f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', PROMPT); f.append('size', '1024x1536');
  f.append('quality', 'medium'); f.append('n', '1'); f.append('output_format', 'jpeg');
  f.append('image[]', blob(process.argv[2], 'image/png'), 'current-screen.png');
  for (const c of ['amir', 'ofer', 'daniel']) f.append('image[]', blob(FACES + c + '.jpg', 'image/jpeg'), c + '.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', i, res.status, j.error?.message); continue; }
  const p = path.join(OUT, `answer-${i}.jpg`);
  fs.writeFileSync(p, Buffer.from(j.data[0].b64_json, 'base64'));
  files.push(p); console.log('ok', p);
}
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const W = 700, H = 1050, PAD = 30, TOP = 140;
const c = createCanvas(PAD + files.length * (W + PAD), TOP + H + PAD), x = c.getContext('2d');
x.fillStyle = '#18181c'; x.fillRect(0, 0, c.width, c.height);
x.fillStyle = '#fff'; x.font = 'bold 34px Arial'; x.fillText('Comments - the residents answer back (gpt-image-2.6-sunburst, medium)', PAD, 52);
for (let i = 0; i < files.length; i++) {
  const im = await loadImage(fs.readFileSync(files[i]));
  const left = PAD + i * (W + PAD);
  x.drawImage(im, left, TOP, W, H);
  x.fillStyle = '#ff6a1f'; x.fillRect(left, TOP - 56, 70, 44); x.fillStyle = '#fff'; x.font = 'bold 30px Arial'; x.fillText('ABC'[i], left + 24, TOP - 22);
}
fs.writeFileSync(path.join(OUT, 'answer-mockups.jpg'), c.toBuffer('image/jpeg', 90));
console.log('sheet', path.join(OUT, 'answer-mockups.jpg'));
