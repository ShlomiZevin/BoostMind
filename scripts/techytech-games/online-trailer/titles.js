// the trailer's words as transparent 1080x1920 PNGs (Chrome lays out the Hebrew): the logo's lettering (Heebo 900, warm white
// #fdf6ef + orange #fc7211 glow) for the big lines, app-coloured pills for the gameplay labels, a subtitle for Yaniv.
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path');
const W = 'color:#fdf6ef;text-shadow:0 0 30px rgba(252,114,17,.55),0 0 80px rgba(252,114,17,.35),0 6px 18px rgba(0,0,0,.7)';
const O = 'color:#fc7211;text-shadow:0 0 30px rgba(252,114,17,.8),0 0 90px rgba(252,114,17,.5),0 6px 18px rgba(0,0,0,.7)';
const big = (html, top, size) => `<div style="position:absolute;left:40px;right:40px;top:${top}px;text-align:center;font:900 ${size}px/1.15 Heebo">${html}</div>`;
const pill = (t, bg) => `<div style="position:absolute;left:0;right:0;top:150px;display:flex;justify-content:center"><div style="background:${bg};color:#fff;font:900 70px Heebo;padding:22px 54px;border-radius:999px;border:6px solid #fff;box-shadow:0 12px 40px rgba(0,0,0,.5)">${t}</div></div>`;
const T = {
  alone: big(`<span style="${W}">בטקי-טק יש דבר אחד<br>שלא נגמר.</span>`, 800, 90),
  online: big(`<span style="${O};font-size:200px">פגישות<br>בזום.</span>`, 640, 200),
  friends: big(`<span style="${W}">עם חברים.</span>`, 1080, 130),
  l0: pill('Zoomba — ממזגים עד החלטה.', '#2f6bff'), l1: pill('Meetly — מי הרים יד?', '#16a34a'), l2: pill('Teamz — מיישרים קו עם כולם.', '#7c3aed'),
  l3: pill('Callio — זיכרון מול חבר.', '#f05a28'), l4: pill('מזמינים חבר עם קוד.', '#fc7211'),
  team: big(`<span style="${W}">תזמינו את<br>כל הצוות לשיחה.</span>`, 780, 112),
  ysub: `<div style="position:absolute;left:40px;right:40px;top:1450px;text-align:center;font:900 78px/1.2 Heebo;color:#fff;-webkit-text-stroke:3px #000;paint-order:stroke fill;text-shadow:0 6px 16px rgba(0,0,0,.8)">אני גם בכלל לא מבין<br>למה אתה מעלה אותי לשיחה!</div>`,
  ysub2: `<div style="position:absolute;left:40px;right:40px;top:1450px;text-align:center;font:900 78px/1.2 Heebo;color:#fff;-webkit-text-stroke:3px #000;paint-order:stroke fill;text-shadow:0 6px 16px rgba(0,0,0,.8)">מה זה קשור אליי?</div>`,
  ysub3: `<div style="position:absolute;left:40px;right:40px;top:1450px;text-align:center;font:900 78px/1.2 Heebo;color:#fff;-webkit-text-stroke:3px #000;paint-order:stroke fill;text-shadow:0 6px 16px rgba(0,0,0,.8)">בגלל הזומים שלך<br>אני נראה ככה.</div>`,
  invite: big(`<span style="${O};font-size:150px">תזמינו חבר.</span>`, 1290, 150),
  noyaniv: big(`<span style="${W};font-size:76px">(רק לא את יניב.)</span>`, 1480, 76),
};
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [k, h] of Object.entries(T)) {
    await p.setContent(`<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@900&display=swap" rel="stylesheet"><style>html,body{margin:0;background:transparent}</style></head><body>${h}</body></html>`);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(__dirname, 't', k + '.png'), omitBackground: true });
  }
  await b.close();
})();
