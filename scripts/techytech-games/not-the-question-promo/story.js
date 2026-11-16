// the story = the game's own start screen look (his pick): the painted hero + the two menu cards he loved, at 1080x1920
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const hero = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, '../../../public/techytech-games/not-the-question/assets/hero.jpg')).toString('base64');
const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#0b1a3a;font-family:Rubik}
.pitch{position:absolute;left:0;right:0;top:1150px;display:flex;flex-direction:column;align-items:center;gap:26px}
.pq{background:#fff;color:#14142b;font-weight:900;font-size:64px;line-height:1.1;text-align:center;padding:22px 58px 28px;border-radius:52px;border:13px solid #e0202f;transform:rotate(-3deg);box-shadow:0 26px 60px #000a,0 0 0 10px #fff}
.pq b{display:block;color:#e0202f;font-size:1.45em;line-height:1.05;white-space:nowrap}
.ph{background:linear-gradient(180deg,#7b3cf0,#4b1fb8);color:#fff;font-weight:900;font-size:54px;line-height:1.2;text-align:center;padding:20px 50px;border-radius:44px;border:10px solid #fff;box-shadow:0 20px 50px #0009;transform:rotate(1.5deg)}
.ph i{font-style:normal;color:#7ff3ff;text-shadow:0 0 24px #7ff3ffaa;filter:blur(1px);letter-spacing:1px}</style></head><body>
<div style="position:absolute;left:-60px;top:-60px;width:1200px;height:2040px;background:url(${hero}) center bottom/cover;filter:blur(30px) brightness(.55)"></div>
<img src="${hero}" style="position:absolute;left:0;top:0;width:1080px;height:1620px;-webkit-mask-image:linear-gradient(#000 80%,transparent)">
<div class="pitch" dir="rtl"><div class="pq">ענית ברור?<b>זאת לא השאלה.</b></div><div class="ph">רק תשובות <i>מעורפלות</i><br>מורידות למטה לפרטים</div></div>
</body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, 'not-the-question-story.jpg'), type: 'jpeg', quality: 92 });
  await b.close();
})();
