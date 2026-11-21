// The Syncs poster (1080x1920, Instagram safe zones): the GPT keynote backdrop, the real app on a phone at its most famous
// moment ("אמיר שם את דניאל על השתק"), the Syncs lockup, Terra's headline + sub line, "עכשיו בשלומיוורס".  node poster.js
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const d = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, f)).toString('base64');
const bg = d('look/bg-tall.png'), scr = d('look/poster-screen.png'), icon = 'data:image/png;base64,' + fs.readFileSync('C:/workspace/BoostMind/public/verse/art/syncs-icon.png').toString('base64');
const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@500;700;800;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#07060a;font-family:Heebo}
.c{position:absolute;left:0;right:0;display:flex;justify-content:center}
.phone{width:600px;height:880px;border-radius:64px;background:#0e0e12;border:3px solid #6e5a50;padding:16px;box-shadow:0 0 90px rgba(252,114,17,.35),0 40px 60px rgba(0,0,0,.7);transform:rotate(-3deg)}
.scr{width:600px;height:880px;border-radius:50px;background:url(${scr}) 0 0/600px auto;overflow:hidden}
</style></head><body>
<div style="position:absolute;left:0;top:-80px;width:1080px;height:1620px;background:url(${bg}) center/cover"></div>
<div style="position:absolute;left:0;top:1440px;width:1080px;height:480px;background:linear-gradient(transparent,#07060a 60%)"></div>
<div class="c" style="top:262px;flex-direction:column;align-items:center">
  <div dir="rtl" style="font:800 40px/1 Heebo;color:#ffb27a;letter-spacing:2px;margin-bottom:22px">טקי-טק מציגה</div>
  <div style="display:flex;align-items:center;gap:22px;direction:ltr"><img src="${icon}" style="width:96px;height:96px;border-radius:22px;filter:drop-shadow(0 0 30px rgba(252,114,17,.7))">
    <div><div style="font:900 74px/0.95 Heebo;color:#fff;letter-spacing:-2px">Syncs</div><div style="font:500 24px/1.2 Heebo;color:#ffb27a;letter-spacing:2px">Let’s circle back</div></div></div>
  <div dir="rtl" style="font:900 70px/1.05 Heebo;color:#fff;margin-top:26px;text-shadow:0 10px 30px rgba(0,0,0,.7);white-space:nowrap">פגישות שמובילות לעשייה.</div>
</div>
<div class="c" style="top:590px"><div class="phone"><div class="scr"></div></div></div>
<div class="c" dir="rtl" style="top:1500px;flex-direction:column;align-items:center;gap:18px">
  <div style="font:800 52px/1.1 Heebo;color:#fff;white-space:nowrap">דיון בניהול AI. משימות ברורות.</div>
  <div style="background:#fc7211;color:#fff;font:900 50px/1 Heebo;padding:16px 52px;border-radius:999px;box-shadow:0 0 40px rgba(252,114,17,.55)">עכשיו בשלומיוורס</div>
</div>
</body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(__dirname, 'out', 'syncs-poster.jpg'), type: 'jpeg', quality: 92 });
  await b.close();
})();
