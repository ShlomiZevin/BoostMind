const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('t-ignore', '1'));
  const p = await ctx.newPage();
  await p.goto('https://shlomiverse.com/hani-games/?x=' + Date.now()); await sleep(3500);
  const card = await p.evaluate(() => [...document.querySelectorAll('a')].some((a) => /shabbat-door/.test(a.href) && /דלת של שבת/.test(a.textContent)));
  await p.screenshot({ path: __dirname + '/../shots/live-hub.png', fullPage: true });
  await p.goto('https://shlomiverse.com/hani-games/shabbat-door/'); await sleep(5000);
  console.log('hub card:', card, '| game page ->', p.url());
  await p.screenshot({ path: __dirname + '/../shots/live-play.png' });
  await b.close();
})();
