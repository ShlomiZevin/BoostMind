// Home strips (Shlomi, 2026-11-18): (1) push the "drop" videos - the socials lose the reception before the end, the full broadcast
// continues only in the verse; (2) KSA (Ronen Kaplan's AI-strategy firm, /ksa/) in the sponsored slot instead of the bakery.
// gpt-image-2.6-sunburst, design key.  node scripts/v2-design/live-strip.mjs <refs dir> [1|2]
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/live-strip';
fs.mkdirSync(OUT, { recursive: true });
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY');
const R = process.argv[2], only = process.argv[3];
const img = (f, n) => new Blob([fs.readFileSync(path.join(R, f))], { type: f.endsWith('.png') ? 'image/png' : 'image/jpeg' });

const JOBS = [
  { name: '1-drop-strip.jpg', refs: [['home.png', 'home.png'], ['frame.jpg', 'frame.jpg'], ['errbox.jpg', 'errbox.jpg']], prompt: `Design for a PHONE app, dark UI, Hebrew right-to-left (spell every Hebrew word exactly as given). One flat image, landscape: TWO phone screens side by side, a big "A" and "B" above them and a short Hebrew caption under each.
Attached: "home.png" = the app's current home screen (top bar with the logo, the hero card: planet logo, the line, the question box, a thin purple strip "באיזו סימולציה אתם חיים?", "מי עונה?" faces, the bottom tab bar). "frame.jpg" = a frame from the video (a Zoom-call comedy video, "טקי-טק | היועץ החיצוני"). "errbox.jpg" = the card the video shows on social networks when the reception drops: a dark box with a glowing orange edge, the planet logo, a no-signal icon (bars with an x) and "בעיית קליטה".
Both screens = the same home screen, with a NEW strip that invites to watch the full broadcast of that video. The visual language of the strip comes from errbox.jpg: dark, a thin glowing orange edge, the small no-signal icon, a subtle glitch/scanline on the thumbnail. Words in the strip: the title "השידור ממשיך בשלומיוורס", the line "ראיתם ברשתות? כאן השידור המלא.", the video name "טקי-טק | היועץ החיצוני", the button "לצפייה המלאה" (orange). Everything else on the home stays exactly as in home.png.
A: the strip REPLACES the thin purple simulation strip under the question box - the same height (about 56 px on a 390 px phone), one line: a small rounded thumbnail of frame.jpg on the right with the no-signal icon over it, the title, a small orange button "לצפייה". Caption: "פס דק במקום פס הסימולציה".
B: a card at the TOP of the home, right under the top bar, above the planet logo (the hero moves down a bit): a 16:9-ish thumbnail of frame.jpg with a glitch band and a small "בעיית קליטה" chip, beside it the title, the video name and the line, and the orange button "לצפייה המלאה". About 110 px tall. Caption: "כרטיס בראש הדף".` },
  { name: '2-ksa-ad.jpg', refs: [['home.png', 'home.png'], ['logo.png', 'ksa-logo.png'], ['ronen.jpg', 'ronen.jpg']], prompt: `Design for a PHONE app, dark UI, Hebrew right-to-left (spell every Hebrew word exactly as given). One flat image, landscape: on the right a phone screen, on the left a big close-up of the ad card and under it the same ad as a wide desktop strip (about 7:1).
The app already has a "sponsored" slot on its home screen: a label row above the card - on the right "בחסות KSA", on the left a small grey pill with an info icon "ממומן" - and the sponsor's own picture as a rounded card (3:1 on phones). It is an ad from INSIDE the app's fictional world (like an ad for a bakery from the world). The phone screen = the home screen as in "home.png", scrolled a little so the slot shows right under the hero card.
The new sponsor: KSA - KAPLAN STRATEGIC AI GROUP, an over-serious AI-strategy consulting firm. Its look: deep navy #0E1B2E, ivory #F7F3EC, muted gold #C9A96E, elegant serif headline, thin gold rules, lots of air - premium and corporate (logo attached as ksa-logo.png; founder photo attached as ronen.jpg - keep his face exactly).
The ad card: the KSA logo, the founder photo cut out on the side, the headline "טרנספורמציה. אבל עם מסגרת.", the small line "רונן קפלן ו־KSA מלווים ארגונים בדרך לטרנספורמציית AI.", a slim gold-outlined button "לאתר KSA". Quietly funny because it is so serious (a tiny framework diagram of thin gold lines in the background is welcome). No other text.` },
];
for (const j of JOBS) {
  if (only && !j.name.startsWith(only)) continue;
  const f = new FormData();
  f.append('model', 'gpt-image-2.6-sunburst'); f.append('prompt', j.prompt); f.append('size', '1536x1024');
  f.append('quality', 'high'); f.append('n', '1'); f.append('output_format', 'jpeg');
  for (const [file, as] of j.refs) f.append('image[]', img(file), as);
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f });
  const r = await res.json();
  if (!res.ok) { console.log(j.name, 'FAILED', res.status, r.error?.message); continue; }
  fs.writeFileSync(path.join(OUT, j.name), Buffer.from(r.data[0].b64_json, 'base64'));
  console.log(j.name, 'ok');
}
