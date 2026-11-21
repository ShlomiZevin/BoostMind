// The Syncs teaser's words as transparent 1080x1920 PNGs (t/*.png). v2 (his notes, 21 Nov 2026: "not connected, not
// rhythmic, like pasting - should be fast, a corporate demo / tutorial"): a clean, bright corporate product-demo look
// (Heebo, dark ink on a light page, the Syncs orange); the clip labels = an incoming Syncs notification (its real icon);
// the punchline = clean subtitles.  node titles.js
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const ICON = 'data:image/png;base64,' + fs.readFileSync('C:/workspace/BoostMind/public/verse/art/syncs-icon.png').toString('base64');
const INK = '#16162a', OR = '#fc7211';
// an incoming Syncs notification over the phone
const toast = (line) => `<div style="position:absolute;left:0;right:0;top:120px;display:flex;justify-content:center">
  <div style="display:flex;align-items:center;gap:24px;background:#fff;border-radius:40px;padding:20px 40px 20px 26px;max-width:960px;
    box-shadow:0 20px 50px rgba(30,20,10,.28),0 2px 0 rgba(0,0,0,.04)">
    <img src="${ICON}" style="width:120px;height:120px;border-radius:28px">
    <div style="text-align:right"><div style="font:800 38px/1 Heebo;color:${OR};direction:ltr;text-align:right;letter-spacing:.5px">Syncs · עכשיו</div>
      <div style="font:800 54px/1.15 Heebo;color:${INK};margin-top:8px;max-width:720px">${line}</div></div></div></div>`;
const sub = (t) => `<div style="position:absolute;left:40px;right:40px;top:1500px;text-align:center;font:900 78px/1.2 Heebo;color:#fff;
  -webkit-text-stroke:10px #000;paint-order:stroke fill;text-shadow:0 8px 18px rgba(0,0,0,.8)">${t}</div>`;
const lockup = (top, size, tag) => `<div style="position:absolute;left:0;right:0;top:${top}px;display:flex;flex-direction:column;align-items:center">
  <img src="${ICON}" style="width:${size}px;height:${size}px;border-radius:${size * 0.23}px;box-shadow:0 30px 60px rgba(252,114,17,.35)">
  <div style="font:900 ${size * 0.6}px/1 Heebo;color:${INK};direction:ltr;margin-top:${size * 0.12}px;letter-spacing:-3px">Syncs</div>
  ${tag ? `<div style="font:700 ${size * 0.17}px/1 Heebo;color:${OR};direction:ltr;margin-top:${size * 0.06}px;letter-spacing:3px">BY TECHY-TECH</div>` : ''}</div>`;
const big = (top, html, size = 120) => `<div style="position:absolute;left:0;right:0;top:${top}px;text-align:center;font:900 ${size}px/1.1 Heebo;color:${INK}">${html}</div>`;
const pill = (top, t) => `<div style="position:absolute;left:0;right:0;top:${top}px;display:flex;justify-content:center"><div style="background:${OR};color:#fff;
  font:900 66px/1 Heebo;padding:28px 64px;border-radius:999px;box-shadow:0 20px 40px rgba(252,114,17,.4)">${t}</div></div>`;
const T = {
  q: big(760, `לא<br><span style="color:${OR}">מסונכרנים?</span>`, 150),
  logo: lockup(520, 360, true) + big(1260, 'הזום החדש של טקי-טק', 72),
  l1: toast('אמיר העניק לך טייטל'),
  l2: toast('גם המקרר על האג׳נדה.'),
  l3: toast('היוגורט הוגדר כהזדמנות אסטרטגית.'),
  l4: toast('גלעד: מה הביזנס?'),
  l5: toast('אמיר השתיק את דניאל'),
  l6: toast('הפגישה הסתיימה מחוסר ביזנס.'),
  l7: toast('אמיר מסכם: Action items'),
  end: lockup(380, 280, false) + big(960, 'נמשיך להסתנכרן.', 104),
  now: pill(1170, 'עכשיו בשלומיוורס'),
  punch: sub('אפשר להתקדם<br>בלי להתקדם פורמלי.'),
};
(async () => {
  const dir = path.join(__dirname, 't'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [k, h] of Object.entries(T)) {
    await p.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@700;800;900&display=swap" rel="stylesheet"><style>html,body{margin:0;background:transparent}body>div{direction:rtl}</style></head><body>${h}</body></html>`);
    await p.evaluate(() => document.fonts.ready); await p.evaluate(() => Promise.all([...document.images].map((i) => i.complete || new Promise((r) => { i.onload = i.onerror = r; }))));
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(dir, k + '.png'), omitBackground: true });
  }
  await b.close();
})();
