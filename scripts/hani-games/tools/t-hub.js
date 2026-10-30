const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await (await b.newContext({ viewport: { width: 390, height: 1500 }, deviceScaleFactor: 1 })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('https://boostmind-b052c.web.app/hani-games/?v=' + Date.now(), { waitUntil: 'networkidle' }); await new Promise(r => setTimeout(r, 2500));
  await p.evaluate(() => document.querySelector('#games, .games, h2') && window.scrollTo(0, document.body.scrollHeight * .45)); await new Promise(r => setTimeout(r, 800)); await p.screenshot({ path: process.argv[2], fullPage: true });
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
})();
