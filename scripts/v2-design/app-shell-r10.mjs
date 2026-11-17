// The videos feed's playback controls, again (Shlomi, 2026-11-17: "the video solution is terrible - floating buttons in the middle
// of the video, and in the clean mode you see the next video below; maybe a PLAY STRIP below the dark description, with everything").
// Two screens: full mode with a play strip in the layout, and the clean mode done right. gpt-image-2.6-sunburst.
//   node scripts/v2-design/app-shell-r10.mjs <refs dir>
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r10';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const ref = (k, n) => [new Blob([fs.readFileSync(path.join(process.argv[2], k))], { type: 'image/png' }), n];
const BASE = `Design for a PHONE app (a web app that must feel exactly like a native app). One flat full-screen phone screenshot, portrait,
no device frame. Hebrew right-to-left; spell all Hebrew exactly as given. Dark theme, orange #ff6a1f accent. The attached
"current-full" is the videos feed today (full mode); "current-clean-bad" is today's clean mode, which the owner hates (round buttons
floating in the middle of the video, the next video's content showing under the current one).`;
const JOBS = [
  ['1-full-strip', `${BASE}
THIS SCREEN: the FULL mode of the videos feed, as in "current-full" (top bar, the video, the round action column on its side, the dark
description card with the title, "בכיכוב" chips and the follow / talk buttons, the bottom tab bar), with ONE addition that is part of
the layout, not floating on the video: a slim PLAY STRIP right under the video picture (between the video and the dark description
card): play/pause on the right, a thin orange progress bar with the time "0:24 / 1:12", the sound toggle, and at the left end a small
"clean view" button (expand icon). Clean, compact, one line, the same dark surface family as the card. Nothing floats over the video
except its own subtitles and the action column.`],
  ['2-clean', `${BASE}
THIS SCREEN: the CLEAN mode: the same video now fills the whole screen edge to edge, top to bottom, exactly one video (NO part of the
next video showing). Nothing over the picture except, at the very bottom, a slim translucent version of the same PLAY STRIP (play/pause,
the thin progress bar with time, sound, and at its left end a "back to full view" button (shrink icon) and a "full screen" button), and
just above it a small quiet up-chevron with "החליקו לסרטון הבא" that fades after a moment. Swipe up = next video, still clean.`],
];
for (const [key, prompt] of JOBS) {
  const f = new FormData();
  f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', prompt); f.append('size', '1024x1536');
  f.append('quality', 'high'); f.append('n', '1'); f.append('output_format', 'jpeg');
  f.append('image[]', ...ref('vfeed2.png', 'current-full.png')); f.append('image[]', ...ref('clean-now.png', 'current-clean-bad.png'));
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}
