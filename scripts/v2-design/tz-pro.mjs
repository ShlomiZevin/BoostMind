// ציפציפ on the phone, the professional pass (his notes 2026-11-08 on his iPhone screenshot: "the top wastes too much space -
// very thin, maybe one line, the main is the main area"; "the bottom looks broken"; "make it professional - design it with
// an image if you need"). Mockups of the whole phone frame - the thin top, a real bottom, the write button - with his real
// screenshot as the content and the approved logo. GPT Image 2.5 sunburst, OpenAI direct (design key), MEDIUM.
//   node scripts/v2-design/tz-pro.mjs [only-key ...]   ->  Documents/shlomiverse-v2-design/tz-pro/
import fs from 'node:fs';
import path from 'node:path';

const DESIGN = 'C:/Users/shazbak/Documents/shlomiverse-v2-design';
const OUT = path.join(DESIGN, 'tz-pro');
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const SHOT = img('C:/Users/shazbak/.claude/uploads/5f240506-33a9-4e79-a763-3de17b4e6a82/47a75cd5-image.png', 'today.png');
const LOGO = img(`${DESIGN}/tz-logo/V-horizontal.png`, 'logo.png');
const APPROVED = img(`${DESIGN}/feed3/Y1-timeline.jpg`, 'approved.jpg', 'image/jpeg');

const BASE = `A pixel-perfect iPhone app screen (full screen, no device frame, no hand) of "ציפציפ" - a social network exactly like X / Twitter,
Hebrew, right-to-left. Image 1 is TODAY's screen on his phone - keep its content (the posts, the ח24 news card with its photo)
but make the frame PROFESSIONAL, at the level of the real X app: dense, calm, precise spacing, crisp 1px separators, SF-like
proportions. Image 2 is the approved logo (the orange planet-bird + the word "ציפציפ", the second half orange) - use it exactly.
Image 3 is the approved look of the timeline (dark, RTL, avatars on the right). Near-black #0b0b0e, one accent orange #ff7a1f.
THE FRAME (what this design is about):
- THE TOP IS ONE THIN LINE, about 44px under the iPhone status bar: the small logo, the two tabs "בשבילך" / "במעקב", and a
  search icon - all in that one line. Nothing else above the posts; the timeline is the main area.
- THE BOTTOM is finished, not broken: a slim iOS tab bar with 4 icons and tiny labels ("בית", "ח24", "התראות", "אני"), the home
  icon orange, sitting above the home indicator; the round orange write button (a feather/pen) floats just above the tab bar
  at the LEFT edge, never over text.
All Hebrew short and correctly spelled, right-aligned. No emoji.`;

const JOBS = [
  ['P1-tabs-center', `${BASE}
VARIANT: the one-line top has the logo at the RIGHT, the two tabs as a compact segmented control in the CENTRE (the active tab
orange-filled), the search icon at the LEFT. Below it, show the timeline: the ח24 post with its news card (photo, red "ח24 ·
פוליטיקה", the headline), then the start of a resident's post. The tab bar at the bottom.`],
  ['P2-tabs-underline', `${BASE}
VARIANT: the one-line top has the logo mark small in the CENTRE, the tabs "בשבילך" and "במעקב" as plain words at the right side
with a thin orange underline under the active one (all inside the same 44px line), the search icon at the LEFT, a small round
profile photo at the far RIGHT. Below it the timeline as in image 1. The tab bar at the bottom.`],
];

const only = process.argv.slice(2);
await Promise.all(JOBS.filter(([key]) => !only.length || only.includes(key)).map(async ([key, prompt]) => {
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const im of [SHOT, LOGO, APPROVED]) form.append('image[]', ...im);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) return console.log('FAILED', key, res.status, j.error?.message);
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}));
