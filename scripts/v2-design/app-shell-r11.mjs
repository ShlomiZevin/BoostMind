// The videos feed's final layout (Shlomi, 2026-11-17): controls are a FIXED frame (the social rail + the play strip at the bottom),
// only the video + a slimmer description scroll; the description = title + "בכיכוב" only (follow / talk move into the character's
// card). gpt-image-2.6-sunburst.  node scripts/v2-design/app-shell-r11.mjs <refs dir>
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r11';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const prompt = `Design for a PHONE app (a web app that must feel exactly like a native app). One flat full-screen phone screenshot, portrait,
no device frame. Hebrew right-to-left; spell all Hebrew exactly as given. Dark theme, orange #ff6a1f accent. THIS SCREEN: the videos
feed, based on the attached "current" but with the final layout:
- top bar (as now: logo, search, the feed/grid selector, bell, the account) and the bottom tab bar (as now) - fixed;
- the video picture, big - taller than today because the description below is slimmer;
- under it a SLIM description: the title "ההנהלה יורדת לפרטים, דניאל עולה על העצבים" (max 2 lines) and one row "בכיכוב:" with character
  chips (face + name: "אמיר", "עופר", "דניאל"). NO follow button and NO talk button any more;
- on the video's side the round social column with labels and counts ("תגובות 12", "סטיקר", "שמירה", "שיתוף", "הורדה"), placed LOW,
  ending just above the description, even gaps;
- at the very bottom of the feed, right above the tab bar, a full-width slim PLAY STRIP (laid out left to right: pause button, "0:24 /
  1:12", a long orange progress line, a small orange round mute icon, a small "clean view" button).
Calm, balanced, much more room for the video.`;
const f = new FormData();
f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', prompt); f.append('size', '1024x1536');
f.append('quality', 'high'); f.append('n', '1'); f.append('output_format', 'jpeg');
f.append('image[]', new Blob([fs.readFileSync(path.join(process.argv[2], 'vfeed2.png'))], { type: 'image/png' }), 'current.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(OUT, '1-feed-final.jpg'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok');
