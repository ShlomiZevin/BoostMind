// The Syncs STORY video's words (straight corporate launch, like the product page: Heebo, white + the Syncs orange) as
// transparent 1080x1920 PNGs in ts/. Instagram safe zones: nothing above y 250 or below y 1660.  node story-titles.js
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const ICON = 'data:image/png;base64,' + fs.readFileSync('C:/workspace/BoostMind/public/verse/art/syncs-icon.png').toString('base64');
const head = (eyebrow, title) => `<div style="position:absolute;left:0;right:0;top:262px;text-align:center">
  <div style="font:800 34px/1 Heebo;color:#ff8a3d;letter-spacing:6px;direction:ltr">${eyebrow}</div>
  <div style="font:900 80px/1.1 Heebo;color:#fff;margin-top:18px;text-shadow:0 10px 30px rgba(0,0,0,.6);white-space:nowrap">${title}</div></div>`;
const lockup = (top, size) => `<div style="position:absolute;left:0;right:0;top:${top}px;display:flex;flex-direction:column;align-items:center">
  <img src="${ICON}" style="width:${size}px;height:${size}px;border-radius:${size * 0.23}px;filter:drop-shadow(0 0 70px rgba(252,114,17,.8)) drop-shadow(0 20px 30px rgba(0,0,0,.5))">
  <div style="font:900 ${size * 0.62}px/1 Heebo;color:#fff;direction:ltr;margin-top:${size * 0.12}px;letter-spacing:-2px">Syncs</div>
  <div style="font:500 ${size * 0.17}px/1 Heebo;color:#ffb27a;direction:ltr;margin-top:${size * 0.08}px;letter-spacing:2px">Let’s circle back</div></div>`;
const by = (top) => `<div style="position:absolute;left:0;right:0;top:${top}px;text-align:center;font:700 36px/1 Heebo;color:rgba(255,255,255,.75);direction:ltr;letter-spacing:4px">SYNCS BY TECHY-TECH</div>`;
const T = {
  // v3 (his note, 21 Nov): a REAL launch presented by Techy-Tech - never "the Shlomiverse's Zoom", no daily limit
  s0: `<div style="position:absolute;left:0;right:0;top:440px;text-align:center;font:800 54px/1 Heebo;color:#ffb27a;letter-spacing:2px">טקי-טק מציגה</div>` + lockup(560, 330) + by(1240),
  s0h: `<div style="position:absolute;left:0;right:0;top:1330px;text-align:center;font:900 66px/1.1 Heebo;color:#fff">פגישות שמובילות לעשייה.</div>`,
  f1: head('FEATURE 01', 'פגישות עם צוות טקי-טק'),
  f2: head('FEATURE 02', 'ניהול דיון באמצעות AI'),
  f3: head('FEATURE 03', 'טייטל אישי מאמיר'),
  f4: head('FEATURE 04', 'סיכום ו-Action items'),
  end: lockup(420, 300) + `<div style="position:absolute;left:0;right:0;top:1040px;text-align:center;font:900 84px/1.1 Heebo;color:#fff">היכנסו לפגישה<br>עם צוות ההנהלה.</div>`,
  now: `<div style="position:absolute;left:0;right:0;top:1290px;display:flex;justify-content:center"><div style="background:#fc7211;color:#fff;font:900 62px/1 Heebo;padding:26px 60px;border-radius:999px;box-shadow:0 0 50px rgba(252,114,17,.6),0 16px 30px rgba(0,0,0,.5)">עכשיו בשלומיוורס</div></div>` + by(1480),
};
(async () => {
  fs.mkdirSync(path.join(__dirname, 'ts'), { recursive: true });
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [k, h] of Object.entries(T)) {
    await p.setContent(`<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@500;700;800;900&display=swap" rel="stylesheet"><style>html,body{margin:0;background:transparent}</style></head><body>${h}</body></html>`);
    await p.evaluate(() => document.fonts.ready); await p.evaluate(() => Promise.all([...document.images].map((i) => i.complete || new Promise((r) => { i.onload = i.onerror = r; }))));
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(__dirname, 'ts', k + '.png'), omitBackground: true });
  }
  await b.close();
})();
