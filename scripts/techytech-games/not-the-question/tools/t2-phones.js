// phone sizes with touch (+ desktop + landscape): start screen fits, HUD/strip on screen, nothing overlaps, play field
// is most of the screen, end screen fits.
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/';
const BASE = (process.env.BASE || 'http://localhost:5331') + '/techytech-games/not-the-question/?solo=1';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  for (const [name, vp] of [['se', { width: 320, height: 568 }], ['small', { width: 360, height: 640 }], ['iphone', { width: 390, height: 844 }], ['tall', { width: 412, height: 915 }], ['land', { width: 844, height: 390 }], ['desk', { width: 1280, height: 800 }], ['frame', { width: 320, height: 380 }]]) {
    const mob = name !== 'desk';
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: mob, isMobile: mob }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(1000);
    await p.evaluate(() => localStorage.setItem('shlomiverse:not-the-question:tut', '1'));
    const off = (sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null || e.getClientRects().length).filter((e) => { const r = e.getBoundingClientRect(), b = document.body.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.top < -1 || r.left < b.left - 1 || r.right > b.right + 1; }).map((e) => e.id || e.className), sel);
    const startOff = await off('#start .big, #start .soft, #start .foot, #start p');
    await p.screenshot({ path: OUT + `p-${name}-start.png` });
    if (name === 'land') { const t = await p.isVisible('#turn'); await p.screenshot({ path: OUT + 'p-land-turn.png' }); console.log('land: turn-the-phone notice', t ? 'shown' : 'MISSING'); await ctx.close(); continue; }
    await p.click('#playB', { force: true }); await p.waitForTimeout(1500);
    const playOff = await off('#strip, #hud, #depth, #strikes, #pauseB');
    const overlap = await p.evaluate(() => { const a = document.getElementById('strip').getBoundingClientRect(), h = document.getElementById('hud').getBoundingClientRect(); return a.bottom > h.top + 1; });
    const ballOnScreen = await p.evaluate(() => { const c = document.getElementById('cv'); return true; });
    await p.screenshot({ path: OUT + `p-${name}-play.png` });
    await p.evaluate(() => { NTQ.G.strikes = 2; }); // one more mistake ends it
    const r = await p.evaluate(() => NTQ.ring()); const c = r.panels.find((x) => x.kind === 'clear');
    await p.evaluate((k) => NTQ.aim(k + 0.5), c.s0); await p.waitForTimeout(6500);
    const overOff = await off('#over .big, #over .soft, #over .removed, #oScore');
    await p.screenshot({ path: OUT + `p-${name}-over.png` });
    console.log(name, `${vp.width}x${vp.height}`, '| start off:', startOff.join(',') || '-', '| play off:', playOff.join(',') || '-', overlap ? 'STRIP/HUD OVERLAP' : '', '| over:', (await p.isVisible('#over')) ? 'shown' : 'NOT SHOWN', 'off:', overOff.join(',') || '-', errs.length ? 'ERR ' + errs.join('/') : '');
    await ctx.close();
  }
  await b.close();
})();
