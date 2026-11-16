// smoke: open, start screen, start a game (no tutorial), let Daniel bounce, aim a vague panel, screenshots
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/';
const BASE = (process.env.BASE || 'http://localhost:5331') + '/techytech-games/not-the-question/?solo=1';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE); await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + 's-start.png' });
  await p.evaluate(() => localStorage.setItem('shlomiverse:not-the-question:tut', '1'));
  await p.tap('#playB', { force: true }); await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + 's-play1.png' });
  console.log(JSON.stringify(await p.evaluate(() => NTQ.ring(0))));
  // aim at the vague panel
  const r = await p.evaluate(() => NTQ.ring()); const v = r.panels.find((x) => x.kind === 'vague');
  await p.evaluate((k) => NTQ.aim(k), v.s0); await p.waitForTimeout(1500);
  console.log(JSON.stringify(await p.evaluate(() => NTQ.state)));
  await p.screenshot({ path: OUT + 's-play2.png' });
  const r1 = await p.evaluate(() => NTQ.ring()); const c = r1.panels.find((x) => x.kind === 'clear');
  await p.evaluate((k) => NTQ.aim(k), c.s0); await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + 's-reject.png' });
  console.log(JSON.stringify(await p.evaluate(() => NTQ.state)));
  console.log('errors:', errs.join(' | ') || 'none');
  await b.close();
})();
