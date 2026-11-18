// the clean story poster he posts himself (1080x1920): the tall painted park (GPT, from the game's cover) + the game's title art
// + his line as a speech bubble + how-to-play card. Bottom ~260 px clear for Instagram.
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const d = (f, t) => `data:image/${t};base64,` + fs.readFileSync(path.join(__dirname, f)).toString('base64');
const bg = d('tall.png', 'png'), title = d('../../../public/night-guy-games/garden/assets/title.png', 'png');
const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@700;800;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#120a26;font-family:Rubik}
.stack{position:absolute;left:0;right:0;top:1250px;display:flex;flex-direction:column;align-items:center;gap:30px}
.bub{position:relative;background:#fff;color:#1a1030;font-weight:900;font-size:62px;line-height:1.12;text-align:center;padding:26px 50px;border-radius:60px;border:8px solid #1a1030;box-shadow:0 18px 40px #000b;transform:rotate(-2deg)}
.tail{position:absolute;top:-70px;left:170px;width:110px;height:80px}
.card{background:linear-gradient(180deg,#5a2aa8,#2e1366);color:#fff;font-weight:800;font-size:50px;line-height:1.22;text-align:center;padding:22px 46px;border-radius:40px;border:6px solid #ffc94a;box-shadow:0 16px 40px #000b,0 0 40px #8a4dff66;transform:rotate(1.5deg)}
.card b{color:#ffc94a;font-weight:900}
.tag{background:#ffc94a;color:#1a1030;font-weight:900;font-size:40px;padding:10px 34px;border-radius:999px;box-shadow:0 10px 24px #0009}</style></head><body>
<div style="position:absolute;left:-60px;top:-60px;width:1200px;height:2040px;background:url(${bg}) center bottom/cover;filter:blur(30px) brightness(.5)"></div>
<img src="${bg}" style="position:absolute;left:0;top:110px;width:1080px;height:1620px;-webkit-mask-image:linear-gradient(transparent 0,#000 6%,#000 84%,transparent)">
<img src="${title}" style="position:absolute;left:230px;top:84px;width:620px;filter:drop-shadow(0 14px 30px #000c)">
<div dir="rtl" style="position:absolute;left:0;right:0;top:26px;display:flex;justify-content:center"><div class="tag">משחק חדש בשלומיוורס</div></div>
<div class="stack" dir="rtl">
  <div class="bub"><svg class="tail" viewBox="0 0 110 80"><path d="M20 78 L70 4 L84 78 Z" fill="#fff" stroke="#1a1030" stroke-width="8" stroke-linejoin="round"/><rect x="10" y="74" width="90" height="12" fill="#fff"/></svg>סליחה, אפשר<br>לשאול אותך משהו?</div>
  <div class="card">סגרו שטחים ושיחות<br>לפני שהסיפור מגיע <b>לחלק המוזר.</b></div>
</div></body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, 'garden-poster.jpg'), type: 'jpeg', quality: 92 });
  await b.close();
})();
