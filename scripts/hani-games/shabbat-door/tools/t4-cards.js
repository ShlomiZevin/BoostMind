// screenshots of the level cards: the first one, and the one after Reb Shmulik's roll; 390 and 320 wide
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/', BASE = process.env.BASE || 'http://localhost:5302/hani-games';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  for (const [n, vp] of [['iphone', { width: 390, height: 844 }], ['se', { width: 320, height: 568 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { localStorage.setItem('t-ignore', '1'); localStorage.setItem('hani-games:shabbat-door:tut', '1'); });
    const p = await ctx.newPage(); await p.goto(BASE + '/shabbat-door/?solo=1'); await sleep(1200);
    await p.click('#playBtn', { force: true }); await sleep(900); await p.screenshot({ path: OUT + `k-${n}-1.png` });
    await p.evaluate(() => { const G = SHABBAT_DOOR; let k = 0; while (G.si < 4 && k++ < 60 * 300) { G.hold(G.green && G.timeLeft > 0.4); G.tick(1 / 60); } G.hold(false); });
    await sleep(1200); await p.screenshot({ path: OUT + `k-${n}-5.png` });
    await ctx.close();
  }
  await b.close();
})();
