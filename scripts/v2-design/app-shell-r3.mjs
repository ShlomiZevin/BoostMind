// The app shell, round 3 of his notes (Shlomi, 2026-11-17): "the back-to-video button in the chat looks ugly - design it", "the
// chat's send button is terrible - show me suggestions". Brief = WHAT (his rule). gpt-image-2.6-sunburst, high.
//   node scripts/v2-design/app-shell-r3.mjs <current chat screenshot> [only-key ...]  ->  Documents/shlomiverse-v2-design/app-shell/r3/
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r3';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const img = (file, name, type = 'image/png') => [new Blob([fs.readFileSync(file)], { type }), name];
const CHAT = img(process.argv[2], 'current-chat.png');
const LOGO = img('C:/workspace/BoostMind/v2/site/verse/logo-512.png', 'logo.png');
const face = (id) => img(`C:/workspace/BoostMind/public/wiki/img/c/${id}.jpg`, `face-${id}.jpg`, 'image/jpeg');

const BASE = `Design for a PHONE app (a web app that must feel like a native app). Hebrew, right-to-left (start = right). Spell all Hebrew
exactly as given. Dark theme, warm orange #ff6a1f as the single accent, the attached logo (a glowing orange planet with a ring).
The product: "שלומיוורס" - a comedy universe of many characters you can watch, chat with and play with. The attached
"current-chat" is the chat screen as built now.`;

const JOBS = [
  ['1-back-to-video', [CHAT, LOGO, face('yotam')], `${BASE}
One flat full-screen phone screenshot, portrait, no device frame. THIS SCREEN: the chat tab as in "current-chat", talking with
Yotam (attached face), after the visitor left a video to chat. The owner finds the "חזרה לסרטון" pill ugly - design a better way
back to the video: it sits under the row of faces, slim, clearly a way BACK to the paused video (the video's small thumbnail, the
video title "זאת לא השאלה", where it stopped "0:24", and "חזרה לסרטון"), elegant and calm, part of the app's look - not a loud
button and not a chat message. Below it the conversation (the visitor asked "יותם, מה אתה עושה בחיים?", Yotam answered "אני System
Architect של החיים.") and the message box at the bottom. Keep the top bar and the bottom tab bar as in "current-chat".`],
  ['2-send-options', [CHAT, LOGO], `${BASE}
One flat image, portrait, on the app's dark background: a design SHEET of SIX different options for the chat's SEND button, so the
owner can pick one. Each option is shown in place: the same message-box row as in "current-chat" (right to left: the field
"כתבו ליותם..." on the right, the send button on the LEFT end), stacked one under the other, each row with a big clear number
1-6 next to it. Make the six genuinely different, all on-brand, all instantly readable as "send" and all pointing LEFT (the
direction of sending in Hebrew):
1. a clean round orange button with a simple bold arrow pointing left;
2. a rounded-square orange button with a minimal paper-plane drawn in our own rounder style, pointing left;
3. the logo's little planet with a short motion streak, small and clean (not a big blob);
4. a text button "שליחה" in a pill with a small arrow;
5. an orange circle with a speech-bubble tail and an arrow inside it;
6. a sleek orange chevron/arrowhead shape that is itself the button.
No other text besides the numbers, the field placeholder and option 4's word.`],
];
const only = process.argv.slice(3);
for (const [key, images, prompt] of JOBS) {
  if (only.length && !only.includes(key)) continue;
  const form = new FormData();
  form.append('model', 'gpt-image-2.6-sunburst'); form.append('prompt', prompt); form.append('size', '1024x1536');
  form.append('quality', 'high'); form.append('n', '1'); form.append('output_format', 'jpeg');
  for (const [blob, name] of images) form.append('image[]', blob, name);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}
