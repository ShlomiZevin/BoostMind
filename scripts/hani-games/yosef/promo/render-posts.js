// screenshot each .post (1080x1350) and .story (1080x1920) in promo/posts.html -> out/post-N.jpg, out/story-N.jpg
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await (await b.newContext({ viewport: { width: 1200, height: 2000 }, deviceScaleFactor: 1 })).newPage();
  await p.goto('http://localhost:5301/yosef/promo/posts.html'); await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
  for (const k of ['post', 'story']) {
    const n = await p.locator('.' + k).count();
    for (let i = 0; i < n; i++) await p.locator('.' + k).nth(i).screenshot({ path: path.join(__dirname, 'out', `${k}-${i + 1}.jpg`), type: 'jpeg', quality: 92 });
    console.log(n, k);
  }
  await b.close();
})();
