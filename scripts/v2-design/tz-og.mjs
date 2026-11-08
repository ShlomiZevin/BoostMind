// ציפציפ's share picture (1200x630) - what WhatsApp / Facebook / X show for the site's address (his note 2026-11-08: "nice
// social links"): the logo, its line and a row of the residents' faces with the verse's orange rings, on the dark glow.
//   node scripts/v2-design/tz-og.mjs   ->  public/tziftzif/img/og.png
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('../../zoomcut/render/node_modules/puppeteer-core');
const ROOT = 'C:/workspace/BoostMind';
const b64 = (f) => `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(f).toString('base64')}`;
const faces = ['hani', 'yotam', 'demokratovich', 'rosenblum', 'osnat', 'genz', 'vova'].map((id) => b64(`${ROOT}/public/wiki/img/c/${id}.jpg`));
const logo = b64(`${ROOT}/public/tziftzif/img/logo-dark.png`);
const news = b64(`${ROOT}/public/charadot/img/avatar.png`);

const html = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@500;800&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;background:radial-gradient(ellipse 70% 80% at 50% 115%,rgba(255,122,31,.28),transparent 60%),#0b0b0e;font-family:Heebo,sans-serif;direction:rtl;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;overflow:hidden}
.logo{width:560px}.line{font-size:44px;font-weight:800;letter-spacing:-.01em}.line i{font-style:normal;color:#ff7a1f}
.faces{display:flex;gap:14px;margin-top:10px}.faces img{width:96px;height:96px;border-radius:50%;object-fit:cover;object-position:top;border:4px solid #ff7a1f;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.faces img.n{border-color:#e3101b}</style></head><body>
<img class="logo" src="${logo}"><div class="line">מה מצייצים <i>בשלומיוורס</i></div>
<div class="faces">${faces.slice(0, 3).map((f) => `<img src="${f}">`).join('')}<img class="n" src="${news}">${faces.slice(3).map((f) => `<img src="${f}">`).join('')}</div></body></html>`;

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(async () => { await document.fonts.load('800 40px Heebo', 'מה'); await document.fonts.ready; });
await page.screenshot({ path: `${ROOT}/public/tziftzif/img/og.png` });
await browser.close();
console.log('ok');
