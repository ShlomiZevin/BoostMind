// The yogurt meeting's wrap-up, drawn by the app's own share page (/syncs/m/...) with meeting 2's real data swapped in,
// recorded at 2x while it scrolls slowly through the wrap-up.  node recap.js -> rec/recap.mp4
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), cast = require('./cast.js');
const html = fs.readFileSync(path.join(__dirname, 'look', 'share-demo.html'), 'utf8')
  .replace(/(<script id="s-data" type="application\/json">)[\s\S]*?(<\/script>)/, (_, a, b) => a + fs.readFileSync(path.join(__dirname, 'm2-share.json'), 'utf8').replace(/</g, '\u003c') + b);
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.route('https://shlomiverse.com/syncs/m/yogurt', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await p.goto('https://shlomiverse.com/syncs/m/yogurt', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const stop = await cast.start(p, path.join(__dirname, 'rec', 'recap'));
  await p.waitForTimeout(1800);
  for (let k = 0; k < 40; k++) { await p.evaluate(() => (document.querySelector('#mt-log') || document.scrollingElement).scrollBy({ top: 14 })); await p.waitForTimeout(60); }
  await p.waitForTimeout(1500);
  for (let k = 0; k < 40; k++) { await p.evaluate(() => (document.querySelector('#mt-log') || document.scrollingElement).scrollBy({ top: 14 })); await p.waitForTimeout(60); }
  await p.waitForTimeout(1500);
  console.log(await stop()); await b.close();
})();
