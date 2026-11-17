// The video's sticker button as the one home for stickers (Shlomi, 2026-11-17: the fans' stickers gallery doesn't belong in the
// comments; "in stickers you can either create or see community stickers - design it, it should be very clear"). Two screens.
// gpt-image-2.6-sunburst.  node scripts/v2-design/app-shell-r8.mjs <refs dir>
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/app-shell/r8';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const FEED = [new Blob([fs.readFileSync(path.join(process.argv[2], 'vfeed2.png'))], { type: 'image/png' }), 'current-videos-feed.png'];
const STK = [new Blob([fs.readFileSync('C:/workspace/BoostMind/public/wiki/img/c/yotam.jpg')], { type: 'image/jpeg' }), 'face.jpg'];
const BASE = `Design for a PHONE app (a web app that must feel exactly like a native app). One flat full-screen phone screenshot, portrait,
no device frame. Hebrew, right-to-left. Spell all Hebrew exactly as given. Dark theme, orange #ff6a1f accent. Keep the top bar and the
bottom tab bar as in "current-videos-feed". The product lets visitors make a STICKER from a moment of a comedy video (a cut-out of the
character's face with a funny caption, white die-cut border, illustrated sticker look) and see the stickers other visitors made, and
"stamp" (like) them.`;
const JOBS = [
  ['1-sticker-sheet', `${BASE}
THIS SCREEN: the videos feed as in "current-videos-feed"; the visitor tapped the video's "סטיקר" button and a bottom sheet slid up
above the tab bar (the video paused and dimmed behind it, a grab handle). The sheet makes TWO choices very clear, as two big cards
side by side: (1) "ליצור סטיקר" - "מהרגע הזה בסרטון" with a small preview of a sticker being cut out (an orange scissors/sparkle
icon), the main action; (2) "הסטיקרים מהסרטון" - "12 סטיקרים שצופים יצרו" with a small fan of three real-looking stickers. Short,
calm, no other buttons besides a small x.`],
  ['2-sticker-gallery', `${BASE}
THIS SCREEN: the visitor chose "הסטיקרים מהסרטון". A tall bottom sheet (above the tab bar) titled "הסטיקרים מהסרטון" with a back chevron
to the two choices and "12" count. A grid of stickers (2 per row) made by visitors from this video - each a die-cut sticker of the
character (the attached face) with a short funny Hebrew caption, the maker's small name under it ("נועה", "דני", "מאיה") and a stamp
button with a count ("חותמת 23") - the stamped ones in orange. At the bottom of the sheet a sticky orange button "ליצור סטיקר משלי".`],
];
for (const [key, prompt] of JOBS) {
  const f = new FormData();
  f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', prompt); f.append('size', '1024x1536');
  f.append('quality', 'high'); f.append('n', '1'); f.append('output_format', 'jpeg');
  f.append('image[]', FEED[0], FEED[1]); f.append('image[]', STK[0], STK[1]);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', key, res.status, j.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(j.data[0].b64_json, 'base64'));
  console.log('ok', key);
}
