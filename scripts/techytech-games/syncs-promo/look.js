const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path');
const [url, name, waits] = [process.argv[2], process.argv[3], (process.argv[4] || '3000').split(',').map(Number)];
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  let t = 0;
  for (const [i, w] of waits.entries()) { await p.waitForTimeout(w - t); t = w; await p.screenshot({ path: path.join(__dirname, 'look', `${name}-${i}.png`) }); }
  if (process.argv[5]) { const txt = await p.evaluate(() => document.body.innerText); require('fs').writeFileSync(path.join(__dirname, 'look', name + '.txt'), txt); }
  await b.close();
})();
