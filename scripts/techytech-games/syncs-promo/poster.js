// The Syncs poster v3 (1080x1920) - his note 22 Nov 2026 on v2: "still bad, a mess, crowded, things on top of each
// other - it should be a LIGHT story poster". So: no phone, no callouts, nothing overlaps. One column with air:
// Techy-Tech מציגה -> the big Syncs icon + name -> one headline -> the meeting's real faces row (crisp app crop) -> CTA.
// node poster.js
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const d = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, f)).toString('base64');
const bg = d('look/bg-tall.png'), faces = d('look/poster-faces.png'), icon = 'data:image/png;base64,' + fs.readFileSync('C:/workspace/BoostMind/public/verse/art/syncs-icon.png').toString('base64');
const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@500;700;800;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#07060a;font-family:Heebo}
.c{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center}</style></head><body>
<div style="position:absolute;inset:0;background:url(${bg}) center/cover"></div>
<div style="position:absolute;inset:0;background:radial-gradient(ellipse 70% 55% at 50% 45%,rgba(7,6,10,.7),rgba(7,6,10,.15))"></div>
<div class="c" style="top:250px"><div style="display:flex;align-items:center;gap:20px;direction:ltr">
  <span dir="rtl" style="font:700 34px/1 Heebo;color:#ffb27a">מציגה</span>
  <span style="font:800 46px/1 Heebo;color:#6fa8f0;letter-spacing:-3px">&lt;/&gt;</span>
  <span style="display:flex;flex-direction:column"><b style="font:800 34px/1.05 Heebo;color:#fff">Techy-Tech</b><small style="font:500 13px/1.3 Heebo;color:#8fa1b8;letter-spacing:3.3px">ENTERPRISE SOLUTIONS</small></span></div></div>
<div class="c" style="top:400px">
  <img src="${icon}" style="width:250px;height:250px;border-radius:58px;filter:drop-shadow(0 0 70px rgba(252,114,17,.7))">
  <div style="font:900 150px/1 Heebo;color:#fff;letter-spacing:-5px;margin-top:34px">Syncs</div>
  <div style="font:500 34px/1 Heebo;color:#ffb27a;letter-spacing:3px;margin-top:6px">Let’s circle back</div>
</div>
<div class="c" dir="rtl" style="top:1010px;font:900 76px/1.12 Heebo;color:#fff;text-align:center;text-shadow:0 8px 30px rgba(0,0,0,.8)">פגישות חכמות,<br><span style="color:#ff9a4a">מההתחלה ועד הסוף</span></div>
<div class="c" style="top:1250px"><div style="padding:18px;border-radius:36px;background:rgba(14,13,18,.85);border:2px solid rgba(255,140,60,.35);box-shadow:0 30px 60px rgba(0,0,0,.6)">
  <img src="${faces}" style="width:760px;display:block;border-radius:22px"></div></div>
<div class="c" dir="rtl" style="top:1650px"><div style="background:#fc7211;color:#fff;font:900 56px/1 Heebo;padding:22px 64px;border-radius:999px;box-shadow:0 0 50px rgba(252,114,17,.6)">עכשיו בשלומיוורס</div></div>
</body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(__dirname, 'out', 'syncs-poster.jpg'), type: 'jpeg', quality: 92 });
  await b.close();
})();
