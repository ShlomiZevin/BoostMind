// the round's first seconds with no tutorial: the lone red card + finger demo, a harmful landing (his thought), a pink landing, a busy moment
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'); const OUT = path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('t-ignore', '1'); localStorage.setItem('shlomiverse:pause:tut', '1'); } catch (e) {} });
  const p = await ctx.newPage(); await p.goto('http://localhost:5311/naomi-games/pause/'); await p.waitForTimeout(1500);
  await p.evaluate(() => { PAUSE.manual = true; PAUSE.start(); PAUSE.tick(1 / 60, 60 * 2.1); PAUSE.manual = false; });
  await p.waitForTimeout(450); await p.evaluate(() => { PAUSE.manual = true; }); await p.screenshot({ path: `${OUT}/c1-demo.png` });
  await p.evaluate(() => { PAUSE.tick(1 / 60, 60 * 1.6); }); await p.screenshot({ path: `${OUT}/c2-harm-landed.png` });
  await p.evaluate(() => { PAUSE.tick(1 / 60, 60 * 2.9); }); await p.screenshot({ path: `${OUT}/c3-bond-landed.png` });
  await p.evaluate(() => { for (let i = 0; i < 60 * 30; i++) { PAUSE.tick(1 / 60); for (const c of PAUSE.G.cards) if (c.state === 'fly' && c.type === 'harm' && c.y < PAUSE.L.line + 60) PAUSE.slice(c.id); } });
  await p.screenshot({ path: `${OUT}/c4-busy.png` });
  await b.close();
})();
