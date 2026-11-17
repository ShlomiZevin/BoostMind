// The games feed made the same kind of page as the videos feed (Shlomi, 2026-11-17: "games also can have several persons... maybe
// already on the feed we should have the comments and everything, as we have in video. The flow should make sense. No two types of
// pages for video and games"). Brief = WHAT. gpt-image-2.6-sunburst.  node scripts/v2-design/app-shell-r6.mjs <refs dir>
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r6';
fs.mkdirSync(OUT, { recursive: true });
const IN = process.argv[2];
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const prompt = `Design for a PHONE app (a web app that must feel exactly like a native app). One flat full-screen phone screenshot, portrait,
no device frame. Hebrew, right-to-left. Spell all Hebrew exactly as given. Dark theme, orange #ff6a1f accent.
The app has a VIDEOS feed (attached "current-videos-feed") and a GAMES feed (attached "current-games-feed"). The owner wants them to be
the SAME KIND of page - same structure, same controls, so the app feels like one system. THIS SCREEN: the GAMES tab feed ("משחקים"
selected), one game per screen, redesigned to mirror the videos feed: the game's art big at the top (as now), on its side the same
round action column as the videos feed - "תגובות" (with a count), "שיאים" (today's records), "שמירה", "שיתוף"; under the art the
game title "דלת של שבת" and its one line "שבת בבית החולים ואין לחם משנה!", a "בכיכוב:" row with chips of the characters in the game
(face + name: "חני פרידמן", "יוסף", "הרב דמוקרטוביץ"), and one big clear orange "לשחק" button - the single way into the game. Keep
the top bar (with its feed/grid selector) and the bottom tab bar exactly as in the screenshots.`;
const form = new FormData();
form.append('model', 'gpt-image-2.6-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
form.append('quality', 'high'); form.append('n', '1'); form.append('output_format', 'jpeg');
form.append('image[]', ...img(path.join(IN, 'vfeed2.png'), 'current-videos-feed.png'));
form.append('image[]', ...img(path.join(IN, 'gfeed.png'), 'current-games-feed.png'));
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(OUT, '1-games-feed.jpg'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok');
