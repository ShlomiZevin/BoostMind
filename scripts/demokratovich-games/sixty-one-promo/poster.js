// the clean story poster he posts himself (1080x1920): the game's own start picture (rabbi + tower in the court-synagogue)
// + the game's title art + his ruling as a speech bubble + how-to-play card. Bottom ~260 px clear for Instagram.
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const A = '../../../public/demokratovich-games/sixty-one/assets/';
const d = (f, t) => `data:image/${t};base64,` + fs.readFileSync(path.join(__dirname, f)).toString('base64');
const bg = d(A + 'start-bg.jpg', 'jpeg'), title = d(A + 'title.webp', 'webp');
const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@700;800;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#2a1708;font-family:Rubik}
.stack{position:absolute;left:0;right:0;top:1318px;display:flex;flex-direction:column;align-items:center;gap:22px}
.bub{position:relative;background:#fff;color:#16213f;font-weight:900;font-size:56px;line-height:1.12;text-align:center;padding:24px 48px;border-radius:60px;border:8px solid #16213f;box-shadow:0 18px 40px #000b;transform:rotate(-2deg)}
.tail{position:absolute;top:-70px;right:330px;width:110px;height:80px}
.card{background:linear-gradient(180deg,#22336b,#121c3d);color:#fff;font-weight:800;font-size:50px;line-height:1.22;text-align:center;padding:22px 46px;border-radius:40px;border:6px solid #f2c14e;box-shadow:0 16px 40px #000b;transform:rotate(1.5deg)}
.card b{color:#f2c14e;font-weight:900}
.tag{background:#f2c14e;color:#16213f;font-weight:900;font-size:40px;padding:10px 34px;border-radius:999px;box-shadow:0 10px 24px #0009}</style></head><body>
<div style="position:absolute;left:-60px;top:-60px;width:1200px;height:2040px;background:url(${bg}) center bottom/cover;filter:blur(30px) brightness(.5)"></div>
<img src="${bg}" style="position:absolute;left:0;top:40px;width:1080px;height:1620px;-webkit-mask-image:linear-gradient(transparent 0,#000 4%,#000 86%,transparent)">
<img src="${title}" style="position:absolute;left:250px;top:100px;width:580px;filter:drop-shadow(0 14px 30px #000c)">
<div dir="rtl" style="position:absolute;left:0;right:0;top:26px;display:flex;justify-content:center"><div class="tag">משחק חדש בשלומיוורס</div></div>
<div class="stack" dir="rtl">
  <div class="bub"><svg class="tail" viewBox="0 0 110 80"><path d="M90 78 L40 4 L26 78 Z" fill="#fff" stroke="#16213f" stroke-width="8" stroke-linejoin="round"/><rect x="10" y="74" width="90" height="12" fill="#fff"/></svg>אין רוב אלא במפלגה<br>על גבי מפלגה.</div>
  <div class="card">עורמים מפלגות למגדל עד <b>61 מנדטים.</b><br>סקר הרבנית? המגדל רועד.</div>
</div></body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, 'sixty-one-poster.jpg'), type: 'jpeg', quality: 92 });
  await b.close();
})();
