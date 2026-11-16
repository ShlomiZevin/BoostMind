// the clean poster he posts himself (1080x1920): the game's painted hero with its words set on it - no viewer chrome
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const hero = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, '../../../public/techytech-games/not-the-question/assets/hero.jpg')).toString('base64');
const card = (t, st) => `<div style="${st};text-align:center;border-radius:24px;box-shadow:0 12px 30px rgba(0,0,0,.4);white-space:nowrap">${t}</div>`;
const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@700;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#1d2b4a}</style></head><body>
<div style="position:absolute;left:-60px;top:-60px;width:1200px;height:2040px;background:url(${hero}) center bottom/cover;filter:blur(28px) brightness(.8)"></div>
<img src="${hero}" style="position:absolute;left:0;top:0;width:1080px;height:1620px;-webkit-mask-image:linear-gradient(#000 85%,transparent)">
<div style="position:absolute;left:0;right:0;top:1500px;height:160px;background:linear-gradient(transparent,rgba(29,43,74,.0))"></div>
<div style="position:absolute;left:0;right:0;top:1270px;display:flex;flex-direction:column;align-items:center;gap:24px" dir="rtl">
${card('משחק חדש בשלומיוורס!', 'background:#ffd23f;color:#14142b;font:900 66px/1.1 Rubik;padding:16px 40px;border:5px solid #fff')}
${card('ענית ברור? <span style="color:#e0202f">זאת לא השאלה.</span>', 'background:#fff;color:#14142b;font:900 52px/1.15 Rubik;padding:16px 34px;transform:rotate(-2deg);border:6px solid #e0202f')}
${card('בהירות זה באג. עמימות זה פיצ\'ר.', 'background:#5b2bd6;color:#fff;font:700 44px/1.2 Rubik;padding:16px 32px;border:5px solid #fff')}
</div></body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, 'not-the-question-poster.jpg'), type: 'jpeg', quality: 92 });
  await b.close();
})();
