// The app shell, round 5 (Shlomi, 2026-11-17): the chat's "questions left" line nicer ("a strip or some background, or smaller"),
// the current character feeling LIVE (green dot - "in the preview design it looked good"), "החלף" instead of "החלפת דמות", a smaller
// send icon closer to the field. Brief = WHAT. gpt-image-2.6-sunburst.  node scripts/v2-design/app-shell-r5.mjs <refs dir>
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r5';
fs.mkdirSync(OUT, { recursive: true });
const IN = process.argv[2];
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const prompt = `Design for a PHONE app (a web app that must feel exactly like a native app). One flat full-screen phone screenshot, portrait,
no device frame. Hebrew, right-to-left. Spell all Hebrew exactly as given. Dark theme, orange #ff6a1f accent. THIS SCREEN: the chat tab
exactly as in the attached "current-chat" (keep the top bar, the bottom tab bar, the header line and the send icon's art), with four
refinements:
1. The current character (Yotam) feels LIVE: a small green online dot on his face in the header line and before his status line
   ("ה-System Architect של החיים"), his face in full colour, a subtle live feel - like a contact who is online right now.
2. The header's button reads just "החלף" with a small down chevron (short).
3. The send icon (the orange planet with streaks) a bit smaller, sitting close to the message field (a small even gap).
4. The line about how many questions are left becomes a small, nicer element right under the message field: a slim rounded pill
   with a soft dark background, a tiny icon, "נשארו 3 שאלות" and a small orange link "הרשמה = בלי הגבלה" - calm, not shouting.
A short conversation: the visitor asked "יותם, מה אתה עושה בחיים?" and Yotam answered "אני System Architect של החיים.".`;
const form = new FormData();
form.append('model', 'gpt-image-2.6-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
form.append('quality', 'high'); form.append('n', '1'); form.append('output_format', 'jpeg');
form.append('image[]', ...img(path.join(IN, 'chat3.png'), 'current-chat.png'));
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(OUT, '1-chat.jpg'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok');
