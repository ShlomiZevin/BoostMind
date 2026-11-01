// The Shlomiverse's link preview picture (1200x630, what WhatsApp / Facebook / X show when a link is shared): the planet
// logo over two tilted walls of the characters' real portraits, like the site's hero. Needs the local site (node v2/dev.mjs).
//   node scripts/v2-design/og.mjs   ->  v2/site/verse/og.jpg
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('C:/workspace/BoostMind/zoomcut/render/package.json');
const puppeteer = require('puppeteer-core');
const W = JSON.parse(fs.readFileSync('C:/workspace/BoostMind/public/wiki/data/wiki.json', 'utf8'));
const skip = new Set(['omer-koli', 'oded', 'yotam-zamri', 'bennett', 'naor-zion', 'alex-daniel']); // his hero list
const faces = W.characters.filter((c) => c.img && !skip.has(c.id)).slice(0, 36).map((c) => `http://localhost:5050/wiki/${c.img}`);
const col = (list) => `<div class="col">${list.map((s) => `<div class="t"><img src="${s}"></div>`).join('')}</div>`;
const cols = [0, 1, 2, 3, 4, 5].map((i) => faces.filter((_, j) => j % 6 === i));
const html = `<!doctype html><html dir="rtl"><head><meta charset="utf8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@500;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #0b0b0e; font-family: Heebo, sans-serif; position: relative; perspective: 1100px; }
  .wall { position: absolute; top: -25%; bottom: -25%; width: 40%; display: flex; gap: 14px; opacity: .55; }
  .wall.r { right: -4%; transform: rotateY(-32deg); transform-origin: right center; -webkit-mask-image: linear-gradient(to left, #000 40%, transparent 98%); }
  .wall.l { left: -4%; transform: rotateY(32deg); transform-origin: left center; -webkit-mask-image: linear-gradient(to right, #000 40%, transparent 98%); }
  .col { flex: 1; display: flex; flex-direction: column; gap: 14px; }
  .col:nth-child(2) { margin-top: -90px; } .col:nth-child(3) { margin-top: -40px; }
  .t { aspect-ratio: 4 / 5; border-radius: 16px; overflow: hidden; }
  .t img { width: 100%; height: 100%; object-fit: cover; }
  .glow { position: absolute; inset: 0; background: radial-gradient(ellipse 46% 64% at 50% 50%, rgba(11, 11, 14, .94), rgba(11, 11, 14, .6) 62%, transparent 88%); }
  .mid { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .mid img { width: 470px; margin-top: -26px; }
  .mid p { color: rgba(255, 255, 255, .9); font-size: 30px; font-weight: 800; margin-top: 0; letter-spacing: -.01em; padding: 6px 22px; border-radius: 99px; background: rgba(11, 11, 14, .72); }
</style></head><body>
<div class="wall r">${cols.slice(0, 3).map(col).join('')}</div><div class="wall l">${cols.slice(3).map(col).join('')}</div>
<div class="glow"></div>
<div class="mid"><img src="http://localhost:5050/verse/logo-512.png"><p>כל הדמויות. כל הסרטונים. ואפשר לדבר עם כולן.</p></div>
</body></html>`;
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage();
await p.setViewport({ width: 1200, height: 630 });
await p.setContent(html, { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: 'C:/workspace/BoostMind/v2/site/verse/og.jpg', type: 'jpeg', quality: 86 });
await b.close();
console.log('ok', fs.statSync('C:/workspace/BoostMind/v2/site/verse/og.jpg').size);
