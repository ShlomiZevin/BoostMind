// Three ways to watch in the videos feed (Shlomi, 2026-11-17): "the full version with all the tiles; a more naked version where you
// still scroll, can pause/play, and it's clear you can scroll; and the detached version". One sheet. gpt-image-2.6-sunburst.
//   node scripts/v2-design/app-shell-r9.mjs <refs dir>
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r9';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const prompt = `Design for a PHONE app. One flat image, landscape: a design SHEET of THREE phone screens side by side, each with a big number
1-3 above it and a short Hebrew caption under it. Hebrew right-to-left, spell exactly as given. Dark theme, orange #ff6a1f accent.
All three show the SAME vertical comedy video from the attached "current-videos-feed" in the app's videos feed:
1. "מלא" - the feed exactly as in the screenshot: top bar, the round action column, title, "בכיכוב" chips, follow / talk buttons,
   bottom tab bar. In its bottom-left corner a small round "expand" button.
2. "נקי" - the SAME feed, still scrolling video after video, but almost nothing on top of the video: no bars, no column, no title. Only:
   a thin progress line at the very bottom, a small play/pause state (a big soft pause symbol shown briefly in the centre - tap = pause
   / play), a clear but quiet hint that you can swipe to the next video (the top edge of the next video peeking at the bottom with a
   small up-chevron and "החליקו לסרטון הבא" that fades after a moment), and two small faint round buttons in one top corner: "shrink"
   (back to full) and "detach" (real full screen).
3. "מסך מלא" - the video alone, detached in the phone's native full-screen player with its own controls (scrubber, play), landscape-
   ready, no app UI.`;
const f = new FormData();
f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', prompt); f.append('size', '1536x1024');
f.append('quality', 'high'); f.append('n', '1'); f.append('output_format', 'jpeg');
f.append('image[]', new Blob([fs.readFileSync(path.join(process.argv[2], 'vfeed2.png'))], { type: 'image/png' }), 'current-videos-feed.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(OUT, '1-watch-modes.jpg'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok');
