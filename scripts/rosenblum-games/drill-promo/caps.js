// the promo captions as transparent 1080x1920 PNGs (Chrome lays out the Hebrew; the game's own Rubik + its HUD colours)
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const CAPS = JSON.parse(fs.readFileSync(path.join(__dirname, process.env.CAPS_FILE || 'caps.json'), 'utf8'));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [i, t] of CAPS.entries()) {
    await p.setContent(`<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@900&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:transparent}.c{position:absolute;left:30px;right:30px;top:${process.env.CAP_TOP || 985}px;height:150px;border-radius:44px;
background:#1b2a4a;border:6px solid #fff;box-shadow:6px 10px 0 #0a102278;display:flex;align-items:center;justify-content:center;
font:900 76px Rubik;color:#ffd23f;box-sizing:border-box}</style></head><body><div class="c">${t}</div></body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(__dirname, `${process.env.PREFIX || 'cap'}${i}.png`), omitBackground: true });
  }
  await b.close();
})();
