// The Syncs poster v2 (1080x1920) - his note 22 Nov 2026: "the poster is terrible". Now a real launch ad: the backdrop
// full-bleed (no dead black bottom), Techy-Tech presents -> the Syncs lockup -> ONE benefit headline (the product video's),
// the real app on a STRAIGHT phone with its whole screen, the famous moment ("אמיר שם את דניאל על השתק") lifted out of
// the screen as a big callout, and the CTA pill. Less text, nothing cut.  node poster.js
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const d = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, f)).toString('base64');
const bg = d('look/bg-tall.png'), scr = d('look/poster-screen.png'), icon = 'data:image/png;base64,' + fs.readFileSync('C:/workspace/BoostMind/public/verse/art/syncs-icon.png').toString('base64');
const SW = 420, SH = Math.round(SW * 1688 / 780), PT = 640;     // the phone's screen, its top
const k = SW / 780, PILL = { x: 168, y: 1068, w: 447, h: 64 }, Z = 1.32 / k;  // the mute pill on the 780px screen, callout zoom
const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@500;700;800;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#07060a;font-family:Heebo}
.c{position:absolute;left:0;right:0;display:flex;justify-content:center}
.phone{padding:14px;border-radius:62px;background:#0d0d11;border:3px solid #5a4a42;box-shadow:0 0 120px rgba(252,114,17,.45),0 50px 80px rgba(0,0,0,.8)}
.scr{width:${SW}px;height:${SH}px;border-radius:48px;background:url(${scr}) 0 0/${SW}px auto}
.call{position:absolute;left:0;right:0;top:${PT + 17 + PILL.y * k - 30}px;display:flex;justify-content:center}
.call>div{display:flex;align-items:center;gap:20px;direction:rtl;background:#2a1216;border:3px solid #fc7211;border-radius:999px;padding:20px 44px;
  font:800 46px/1 Heebo;color:#fff;box-shadow:0 0 60px rgba(252,114,17,.75),0 30px 50px rgba(0,0,0,.8);transform:rotate(-3deg)}
</style></head><body>
<div style="position:absolute;inset:0;background:url(${bg}) center/cover"></div>
<div style="position:absolute;left:0;top:0;width:1080px;height:640px;background:radial-gradient(ellipse at 50% 40%,rgba(7,6,10,.75),transparent 70%)"></div>
<div class="c" style="top:150px;flex-direction:column;align-items:center">
  <div style="display:flex;align-items:center;gap:22px;direction:ltr">
    <span dir="rtl" style="font:800 36px/1 Heebo;color:#ffb27a;margin-right:6px">מציגה</span>
    <span style="font:800 50px/1 Heebo;color:#6fa8f0;letter-spacing:-3px">&lt;/&gt;</span>
    <span style="display:flex;flex-direction:column"><b style="font:800 36px/1.05 Heebo;color:#fff">Techy-Tech</b><small style="font:500 14px/1.3 Heebo;color:#8fa1b8;letter-spacing:3.5px">ENTERPRISE SOLUTIONS</small></span></div>
  <div style="display:flex;align-items:center;gap:26px;direction:ltr;margin-top:44px"><img src="${icon}" style="width:124px;height:124px;border-radius:28px;filter:drop-shadow(0 0 40px rgba(252,114,17,.75))">
    <div><div style="font:900 104px/0.9 Heebo;color:#fff;letter-spacing:-3px">Syncs</div><div style="font:500 28px/1.3 Heebo;color:#ffb27a;letter-spacing:2px">Let’s circle back</div></div></div>
  <div dir="rtl" style="font:900 66px/1.08 Heebo;color:#fff;margin-top:40px;text-align:center;text-shadow:0 10px 30px rgba(0,0,0,.8)">פגישות חכמות,<br><span style="color:#ff9a4a">מההתחלה ועד הסוף</span></div>
</div>
<div class="c" style="top:${PT}px"><div class="phone"><div class="scr"></div></div></div>
<div style="position:absolute;left:0;top:1440px;width:1080px;height:480px;background:linear-gradient(transparent,rgba(7,6,10,.92) 45%)"></div>
<div class="call"><div><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff5a6a" stroke-width="2.2" stroke-linecap="round"><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.8"/><path d="M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 11.4 5.4M12 18v3"/><path d="M3 3l18 18"/></svg>אמיר שם את דניאל על השתק</div></div>
<div class="c" dir="rtl" style="top:1625px"><div style="background:#fc7211;color:#fff;font:900 58px/1 Heebo;padding:22px 66px;border-radius:999px;box-shadow:0 0 50px rgba(252,114,17,.6)">עכשיו בשלומיוורס</div></div>
</body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(__dirname, 'out', 'syncs-poster.jpg'), type: 'jpeg', quality: 92 });
  await b.close();
})();
