// Round 7 (2026-11-03, his ask): "save the Shlomiverse to the home screen with our icon - I want people to know how to
// do it ... a pop-up: want to know how to save it as an app? Do it nicely, not a patch." GPT Image 2.5 (OpenAI direct,
// MEDIUM); the live home, video page and today's /install guide as references.
//   node scripts/v2-design/install.mjs [only-key ...]  ->  Documents/shlomiverse-v2-design/install/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/install';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const HOME = img(`${OUT}/home-now.png`, 'home-now.png'), VIDEO = img(`${OUT}/video-now.png`, 'video-page.png'), GUIDE = img(`${OUT}/install-now.png`, 'install-guide-now.png');
const ICON = img('C:/workspace/BoostMind/public/verse/icon-512.png', 'app-icon.png');

const SYSTEM = `A premium mobile web screen mockup, flat full-screen phone screenshot (no device frame), 390px wide, 9:16.
App: "שלומיוורס" (Hebrew, right-to-left), a comedy universe of characters with videos, games and stories. Match the
attached screenshots' world (dark, one orange accent #ff6a1f, glass, Hebrew sans). All Hebrew right-aligned and correctly
spelled. No emoji. The attached app icon is the real home-screen icon - show it exactly as it is.`;

const WHAT = `What we are building: the Shlomiverse is a website that can live on the phone's home screen with its own
icon (the attached one) and open full screen like an app; on iPhone that is also the only way to get notifications when
a character posts. Most visitors don't know this is possible or how. The person reading has just enjoyed something (a
video ended / a game finished) - the right moment to offer, never on arrival. It must feel like a gift from the
Shlomiverse, not a nag: one clear yes, one gentle "not now".`;

const JOBS = [
  ['I-invite', [VIDEO, ICON, HOME], `${SYSTEM}
${WHAT}
Design the INVITE that rises over the page right after a video ended: what you get (opens from the home screen like an
app, full screen, notifications when your characters post) shown with the real icon on a home screen, a short title in
Hebrew ("השלומיוורס כאפליקציה על המסך"), one line, a main button "תראו לי איך" and a quiet "לא עכשיו".`],
  ['I-chrome', [GUIDE, ICON, HOME], `${SYSTEM}
${WHAT}
Design the GUIDED STEPS on an iPhone in CHROME, where the share button is at the right end of the address bar at the TOP
of the screen (outside the page): the page dims, a big friendly animated-looking arrow at the top edge points up-right to
where that button is, and a card shows the steps one by one - 1. "לוחצים על כפתור השיתוף למעלה" (with a drawing of
Chrome's address bar and its share icon circled), 2. "בוחרים 'הוספה למסך הבית'", 3. the icon on the home screen. A step
counter and "הבא" / "הבנתי".`],
  ['I-inapp', [GUIDE, ICON, HOME], `${SYSTEM}
${WHAT}
Design the case where the visitor came from Instagram / TikTok and is inside the app's built-in browser, which cannot add
to the home screen: the page dims, an arrow at the top-right corner points to the app's "⋯" menu, and a card says first
open the Shlomiverse in the phone's browser - 1. "לוחצים על ⋯ למעלה", 2. "בוחרים 'פתיחה בדפדפן'", 3. "שם: הוספה למסך
הבית". Friendly and clear, the same look as the others.`],
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
