// A lighter, TikTok-like videos feed to compare (Shlomi, 2026-11-17: "maybe a lighter design for the video section, less heavy -
// the dark card with transparency or smaller font, maybe no background at all, just text with some shadow"). Two variants side by
// side. gpt-image-2.6-sunburst.  node scripts/v2-design/app-shell-r12.mjs <refs dir>
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r12';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const prompt = `Design for a PHONE app. One flat image, landscape: TWO phone screens side by side, a big number above each ("A", "B") and a
short Hebrew caption under each. Hebrew right-to-left, spell exactly as given. The attached "current" is the app's videos feed with
a heavy dark description card. Both screens show the SAME feed made LIGHTER, closer to a TikTok/Reels feel: the video fills the
whole area between the app's top bar and bottom tab bar (both kept as in "current"), and everything else sits ON the video:
- the round social column on the side with labels and counts ("תגובות 12", "סטיקר", "שמירה", "שיתוף", "הורדה"), lighter (thin
  translucent circles, white icons with a soft shadow);
- at the bottom over the video: the title "ההנהלה יורדת לפרטים, דניאל עולה על העצבים" and "בכיכוב:" with small character chips
  ("אמיר", "עופר", "דניאל");
- under them a slim play strip (left to right: pause, "0:24 / 1:12", a thin orange line, a small orange mute, a clean-view icon).
A: the text sits on a soft dark gradient that fades up from the bottom of the video (no box), smaller white text.
B: no background at all - white text with a soft drop shadow straight on the video, translucent frosted chips, the play strip as a
thin line only. Caption A "גרדיאנט עדין", caption B "טקסט עם צל".`;
const f = new FormData();
f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', prompt); f.append('size', '1536x1024');
f.append('quality', 'high'); f.append('n', '1'); f.append('output_format', 'jpeg');
f.append('image[]', new Blob([fs.readFileSync(path.join(process.argv[2], 'vfeed2.png'))], { type: 'image/png' }), 'current.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
const j = await res.json();
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(OUT, '1-lighter-feed.jpg'), Buffer.from(j.data[0].b64_json, 'base64'));
console.log('ok');
