// stop inside the doorway on purpose: when the light turns red the door must NOT wait - she is disqualified
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/', BASE = process.env.BASE || 'http://localhost:5302/hani-games';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { localStorage.setItem('t-ignore', '1'); localStorage.setItem('hani-games:shabbat-door:tut', '1'); });
  const p = await ctx.newPage(); await p.goto(BASE + '/shabbat-door/?solo=1'); await sleep(1200);
  await p.click('#playBtn', { force: true }); await sleep(1400); await p.evaluate(() => SHABBAT_DOOR.cardGo()); await sleep(3200);
  // walk (with pauses against פסיעה גסה) until she stands just inside the doorway, then wait for red
  const r = await p.evaluate(() => { const G = SHABBAT_DOOR; let k = 0, rest = 0;
    let last = -9; while (G.z < G.doorZ - 0.04 && k++ < 60 * 60) { if (G.introWait) G.cardGo(); if (G.green && G.timeLeft > 0.3 && G.gasa < 0.5 && G.simT - last > 0.32) { last = G.simT; G.tap(); } G.tick(1 / 60); }
    return { z: +G.z.toFixed(3), green: G.green }; });
  console.log('standing in the doorway', r);
  await sleep(300); await p.screenshot({ path: OUT + 'd-inside.png' });
  let m = 0, open = 1; for (let t = 0; t < 120 && !m; t++) { await sleep(100); ({ m, open } = await p.evaluate(() => ({ m: SHABBAT_DOOR.mistakes, open: SHABBAT_DOOR.doorOpen }))); }
  await sleep(200); await p.screenshot({ path: OUT + 'd-out.png' });
  await sleep(900); const after = await p.evaluate(() => ({ open: +SHABBAT_DOOR.doorOpen.toFixed(2), green: SHABBAT_DOOR.green }));
  console.log('disqualified:', m === 1, '| door after (red => must be closed):', after);
  await b.close();
})();
