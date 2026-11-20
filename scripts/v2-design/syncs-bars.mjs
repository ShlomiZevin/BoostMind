// Syncs' bars (his note round 4: "a professional real meeting app - design the TOP BAR (live / recorded) and the RECORDED-MEETING
// BOTTOM BAR with GPT Image first, 2-3 concepts on one labelled sheet, then build to the strongest").
// Concept prompts = what each bar is for and what is on it, never how it looks (his rule). gpt-image-2.6-sunburst, MEDIUM, 1024x1536.
//   node scripts/v2-design/syncs-bars.mjs <current screenshot.png>
// -> Documents/shlomiverse-v2-design/syncs/bars-1..3.jpg + bars-mockups.jpg (the sheet, labelled)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/workspace/BoostMind/techietech-api/package.json');
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/syncs';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const blob = (p, type) => new Blob([fs.readFileSync(p)], { type });
const PROMPT = `A UI component sheet for a PHONE meeting app called Syncs, made by the company Techy-Tech (its logo is attached as "syncs-logo"; its tagline is "Let's circle back"). The app is in Hebrew, right-to-left; spell every Hebrew word exactly as given here. One portrait canvas with three parts stacked, each drawn as it appears on a 390px-wide phone screen, each with a small English caption above it:
1) "TOP BAR - LIVE": the app bar while you are in a live meeting. What is on it: the app (its icon, "Syncs", "Let's circle back"), the meeting's state - live ("בשידור חי"), how long the meeting has been running ("12:04"), how many are on the call ("6"), and the way out of the meeting ("יציאה"). Under it, for context, the row of the participants' video tiles as in the attached current screen.
2) "TOP BAR - RECORDED": the same app bar while a recorded meeting is being played back: its state - a recording ("הקלטה"), the recording's time, how many were on the call ("6"), and the way out ("יציאה"). The tiles row under it again.
3) "BOTTOM BAR - PLAYBACK": the bottom bar of a recorded meeting being played: that this is a recording of a meeting ("הקלטה של ישיבה"), how far it has played ("01:12 / 01:24") and its progress, and a way to play it again from the start.
The attached "current-screen" is the app today; its owner wants these bars to be those of a professional, real meeting app.`;
const files = [];
const SHEET_ONLY = process.argv.includes('--sheet');   // the sheet again from the concepts already made
if (SHEET_ONLY) for (let i = 1; i <= 3; i++) files.push(path.join(OUT, `bars-${i}.jpg`));
for (let i = 1; i <= (SHEET_ONLY ? 0 : 3); i++) {
  const f = new FormData();
  f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', PROMPT); f.append('size', '1024x1536');
  f.append('quality', 'medium'); f.append('n', '1'); f.append('output_format', 'jpeg');
  f.append('image[]', blob(process.argv[2], 'image/png'), 'current-screen.png');
  f.append('image[]', blob('C:/workspace/BoostMind/v2/site/verse/art/syncs-icon.png', 'image/png'), 'syncs-logo.png');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', i, res.status, j.error?.message); continue; }
  const p = path.join(OUT, `bars-${i}.jpg`);
  fs.writeFileSync(p, Buffer.from(j.data[0].b64_json, 'base64'));
  files.push(p); console.log('ok', p);
}
// the sheet: the concepts side by side, each labelled; PICK = the one the app is built to (concept 2: the bar + tiles in one panel,
// the state pill with its own icon, the playback panel with the recording's label, its time, the progress, play again apart)
const PICK = 2;
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const W = 700, H = 1050, PAD = 30, TOP = 140;
const c = createCanvas(PAD + files.length * (W + PAD), TOP + H + PAD), x = c.getContext('2d');
x.fillStyle = '#18181c'; x.fillRect(0, 0, c.width, c.height);
x.fillStyle = '#fff'; x.font = 'bold 34px Arial'; x.fillText('Syncs - bars concepts (top bar live / recorded, playback bar) - gpt-image-2.6-sunburst, medium', PAD, 52);
for (let i = 0; i < files.length; i++) {
  const im = await loadImage(fs.readFileSync(files[i]));
  const left = PAD + i * (W + PAD);
  x.drawImage(im, left, TOP, W, H);
  x.fillStyle = '#ff6a1f'; x.fillRect(left, TOP - 56, 150, 44); x.fillStyle = '#fff'; x.font = 'bold 28px Arial'; x.fillText(`Concept ${i + 1}`, left + 10, TOP - 24);
  if (i === PICK - 1) { x.strokeStyle = '#ff6a1f'; x.lineWidth = 6; x.strokeRect(left - 3, TOP - 3, W + 6, H + 6); x.fillStyle = '#ffb27a'; x.font = 'bold 26px Arial'; x.fillText('<- picked, built to this', left + 170, TOP - 24); }
}
fs.writeFileSync(path.join(OUT, 'bars-mockups.jpg'), c.toBuffer('image/jpeg', 90));
console.log('sheet', path.join(OUT, 'bars-mockups.jpg'));
