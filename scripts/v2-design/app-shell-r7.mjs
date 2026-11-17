// The way out of a game in full screen (Shlomi, 2026-11-17: "the back button takes too much space - suggest something; the
// mechanics are good"). Three options on one sheet. gpt-image-2.6-sunburst.  node scripts/v2-design/app-shell-r7.mjs <refs dir>
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r7';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const prompt = `Design for a PHONE app. One flat image, landscape: a design SHEET of THREE phone screens side by side, each with a big
clear number 1-3 above it and a short Hebrew caption under it. Each screen shows the same game playing in full screen (the attached
"current-game" - a game inside the app, full screen, no app bars). The owner wants a way OUT of the game back to the games feed that
takes NO space and doesn't push the game down (today a "חזרה" pill sits on top). Three options:
1. a small round frosted button, icon only (a thin chevron), 32px, floating over the game's top corner (right side, RTL) - caption
   "כפתור עגול קטן";
2. a thin grab handle at the very top centre (like a sheet handle) with a tiny hint "החליקו למטה לסגירה" that fades after a moment -
   swipe down closes - caption "החלקה למטה";
3. nothing visible; on the first time only a soft hint "חזרה - החלקה מהצד או כפתור החזרה של הטלפון" fades in and out - caption
   "בלי כפתור".
Hebrew right-to-left, spell exactly as given. Dark theme, orange #ff6a1f accent.`;
const f = new FormData();
f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', prompt); f.append('size', '1536x1024');
f.append('quality', 'high'); f.append('n', '1'); f.append('output_format', 'jpeg');
f.append('image[]', new Blob([fs.readFileSync(path.join(process.argv[2], 'gplay.png'))], { type: 'image/png' }), 'current-game.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(OUT, '1-game-exit-options.jpg'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok');
