// a trapped girl never leaves his ground (30 s), a walking girl never flashes the standing pose. node t4-smooth.js [url]
const path = require('path');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8771/night-guy-games/garden/?solo=1&notrack=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const pg = await br.newPage({ viewport: { width: 390, height: 844 } });
  await pg.addInitScript(() => localStorage.setItem('shlomiverse:garden:tut', '1'));
  await pg.goto(URL); await sleep(900); await pg.click('#playBtn', { force: true }); await sleep(5200);
  const r = await pg.evaluate(() => {
    const s = window.GARDEN; s.clearForTest(); s.holdForTest(); s.trapForTest();
    const g = s.girls[0]; let out = 0;
    for (let i = 0; i < 1800; i++) { s.tick(1 / 60); s.holdForTest(); if (!s.owned(Math.round(g.x), Math.round(g.y))) out++; }
    const state = g.state;
    s.clearForTest(); s.girlForTest(2, 6, 'phone', 1.3); const w = s.girls[0]; let stops = 0, moves = 0;
    for (let i = 0; i < 600; i++) { s.tick(1 / 60); s.holdForTest(); if (w.moving) moves++; else if (moves > 5) stops++; }
    return { out, state, stops, moves };
  });
  console.log(JSON.stringify(r));
  console.log(r.out === 0 && r.stops < 6 ? 'ALL OK' : 'FAIL');
  await br.close();
})();
