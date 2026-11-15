// the look of round 8: tutorial shows first, card with Hani, red glowing 3-2-1 on the door glass, green go, failure banner with her face
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/', BASE = process.env.BASE || 'http://localhost:5302/hani-games';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const [name, w, h] of [['iphone', 390, 844], ['se', 375, 667]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { localStorage.setItem('t-ignore', '1'); localStorage.setItem('hani-games:shabbat-door:tut', '1'); });   // an old player: the new tutorial must still show
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/shabbat-door/?solo=1'); await sleep(1200);
    await p.click('#playBtn', { force: true }); await sleep(700);
    const tutOn = await p.evaluate(() => SHABBAT_DOOR.tut.on);
    await p.screenshot({ path: OUT + `l-${name}-tut.png` });
    await p.evaluate(() => SHABBAT_DOOR.tut.end()); await sleep(900);
    await p.screenshot({ path: OUT + `l-${name}-card.png` });
    await sleep(800); await p.click('#lvlGo', { force: true }); await sleep(1300);
    await p.screenshot({ path: OUT + `l-${name}-count.png` });
    await sleep(1900); await p.screenshot({ path: OUT + `l-${name}-go.png` });
    // move on red -> failure banner
    await p.evaluate(() => { const G = SHABBAT_DOOR; let k = 0; while (G.green && k++ < 600) G.tick(1 / 60); G.tick(0.5); G.tap(); G.tick(0.05); });
    await sleep(250); await p.screenshot({ path: OUT + `l-${name}-fail.png` });
    const ctl = await p.evaluate(() => { const r = document.getElementById('walkBtn').getBoundingClientRect(); return { btnBottom: Math.round(r.bottom), vh: innerHeight }; });
    console.log(name, 'tutorial shows:', tutOn, ctl, 'errors:', errs.length ? errs : 'none');
    await ctx.close();
  }
  await b.close();
})();
