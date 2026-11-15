// the clean poster he posts himself (1080x1920): the story picture with its words set on it - no viewer chrome
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const bg = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, 'shabbat-story.jpg')).toString('base64');
const card = (t, st) => `<div style="${st};text-align:center;border-radius:22px;box-shadow:0 10px 26px rgba(0,0,0,.35);white-space:nowrap">${t}</div>`;
const html = `<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@700;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden}</style></head><body style="background:url(${bg}) 0 0/1080px 1920px">
<div style="position:absolute;right:34px;width:410px;top:1150px;display:flex;flex-direction:column;align-items:center;gap:22px">
${card('משחק חדש<br>במשחקייה!', 'background:#ffd23f;color:#14142b;font:900 64px/1.12 Rubik;padding:14px 30px')}
${card('שבת בבית החולים,<br>אין לחם משנה.<br>7 דלתות למוציא.', 'background:#1b2a52;color:#fff;font:700 40px/1.3 Rubik;padding:18px 28px')}
${card('ירוק – הולכים.<br>אדום – קופאים.', 'background:#e0202f;color:#fff;font:900 46px/1.25 Rubik;padding:16px 30px')}
</div></body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, 'shabbat-door-poster.jpg'), type: 'jpeg', quality: 92 });
  await b.close();
})();
