const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file:///' + path.join(__dirname, 'ig.html').split(path.sep).join('/')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(__dirname, 'out', 'not-a-cog-instagram-story.jpg'), type: 'jpeg', quality: 93 });
  await b.close();
})();
