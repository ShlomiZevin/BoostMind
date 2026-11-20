// The Syncs teaser's words as transparent 1080x1920 PNGs (t/*.png), in the approved Techy-Tech trailer look: logo-style
// word art (Rubik 900, glossy gradient, thick outline, white outer outline, solid 3D edge); the clip labels = an incoming
// Syncs notification (its real icon); the punchline = clean subtitles.  node titles.js
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const ICON = 'data:image/png;base64,' + fs.readFileSync('C:/workspace/BoostMind/public/verse/art/syncs-icon.png').toString('base64');
function logo(html, { size, top, g, c, d, rot = 0 }) {
  const lay = (st) => `<span style="position:absolute;left:0;right:0;top:0;${st}">${html}</span>`;
  return `<div style="position:absolute;left:0;right:0;top:${top}px;text-align:center;transform:rotate(${rot}deg)">
  <div style="position:relative;display:inline-block;font:900 ${size}px/1.08 Rubik;white-space:nowrap">
    ${lay(`-webkit-text-stroke:${size * 0.26}px #fff;color:#fff;filter:drop-shadow(0 ${size * 0.09}px 0 ${d}) drop-shadow(0 18px 30px rgba(0,0,0,.55))`)}
    ${lay(`-webkit-text-stroke:${size * 0.14}px ${c};color:${c}`)}
    <span style="position:relative;background:${g};-webkit-background-clip:text;background-clip:text;color:transparent">${html}</span>
  </div></div>`;
}
const BLUE = { g: 'linear-gradient(180deg,#ffffff 0%,#e3f0ff 48%,#a9cfff 52%,#d8ebff 100%)', c: '#1f4fd8', d: '#0d2a80' };
const ORANGE = { g: 'linear-gradient(180deg,#fff3dc 0%,#ffc069 48%,#ff8a1f 52%,#ffb04a 100%)', c: '#c2410c', d: '#5a1a04' };
const GREEN = { g: 'linear-gradient(180deg,#f4ffe0 0%,#b9f55a 48%,#5fd43a 52%,#a6ee61 100%)', c: '#0f7a3a', d: '#064020' };
// an incoming Syncs notification over the phone
const toast = (line) => `<div style="position:absolute;left:0;right:0;top:96px;display:flex;justify-content:center">
  <div style="display:flex;align-items:center;gap:26px;background:rgba(255,255,255,.97);border-radius:46px;padding:22px 40px 22px 30px;max-width:960px;
    box-shadow:0 18px 50px rgba(0,0,0,.45),inset 0 -6px 0 rgba(0,0,0,.08);border:4px solid #fc7211">
    <img src="${ICON}" style="width:140px;height:140px;border-radius:32px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.3))">
    <div style="text-align:right"><div style="font:900 50px/1.05 Rubik;color:#fc7211;direction:ltr;text-align:right">Syncs</div>
      <div style="font:800 54px/1.15 Rubik;color:#1b1b2e;margin-top:6px;max-width:700px">${line}</div></div></div></div>`;
const sub = (t) => `<div style="position:absolute;left:40px;right:40px;top:1500px;text-align:center;font:900 78px/1.2 Rubik;color:#fff;
  -webkit-text-stroke:10px #000;paint-order:stroke fill;text-shadow:0 8px 18px rgba(0,0,0,.8)">${t}</div>`;
const brand = (top, size) => `<div style="position:absolute;left:0;right:0;top:${top}px;display:flex;flex-direction:column;align-items:center">
  <img src="${ICON}" style="width:${size}px;height:${size}px;border-radius:${size * 0.23}px;filter:drop-shadow(0 0 60px rgba(252,114,17,.75)) drop-shadow(0 20px 30px rgba(0,0,0,.5))">
  <div style="font:900 ${size * 0.62}px/1 Rubik;color:#fff;direction:ltr;margin-top:${size * 0.14}px;text-shadow:0 10px 30px rgba(0,0,0,.6);letter-spacing:-2px">Syncs</div>
  <div style="font:700 ${size * 0.2}px/1 Rubik;color:#ffb27a;direction:ltr;margin-top:${size * 0.08}px;letter-spacing:1px">Let’s circle back</div></div>`;
const T = {
  present: logo('טקי-טק מציגה', { size: 96, top: 700, ...BLUE }) + logo('הזום של השלומיוורס', { size: 92, top: 860, rot: -3, ...ORANGE }),
  logo: brand(560, 380),
  l1: toast('אמיר העניק לך טייטל'),
  l2: toast('גם המקרר על האג׳נדה.'),
  l3: toast('היוגורט הוגדר כהזדמנות אסטרטגית.'),
  l4: toast('גלעד: מה הביזנס?'),
  l5: toast('אמיר השתיק את דניאל'),
  l6: toast('הפגישה הסתיימה מחוסר ביזנס.'),
  l7: toast('אמיר מסכם: Action items'),
  end: brand(330, 300) + logo('נמשיך להסתנכרן.', { size: 120, top: 1150, rot: -3, ...ORANGE }),
  now: logo('עכשיו בשלומיוורס', { size: 104, top: 1390, ...GREEN }),
  punch: sub('אפשר להתקדם<br>בלי להתקדם פורמלי.'),
};
(async () => {
  fs.mkdirSync(path.join(__dirname, 't'), { recursive: true });
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [k, h] of Object.entries(T)) {
    await p.setContent(`<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@700;800;900&display=swap" rel="stylesheet"><style>html,body{margin:0;background:transparent}</style></head><body>${h}</body></html>`);
    await p.evaluate(() => document.fonts.ready); await p.evaluate(() => Promise.all([...document.images].map((i) => i.complete || new Promise((r) => { i.onload = i.onerror = r; }))));
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(__dirname, 't', k + '.png'), omitBackground: true });
  }
  await b.close();
})();
