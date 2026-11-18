// every park (night 1-4): the props, nobody inside a prop, girls walking, a trapped girl bouncing. node t3-arenas.js [url]
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8771/night-guy-games/garden/?solo=1&notrack=1';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [w, h] of [[390, 844], [320, 568]]) {
    const pg = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript(() => localStorage.setItem('shlomiverse:garden:tut', '1'));
    await pg.goto(URL); await sleep(1000);
    await pg.click('#playBtn', { force: true }); await sleep(600);
    for (let n = 1; n <= 4; n++) {
      await pg.evaluate((n) => window.GARDEN.nightForTest(n), n);
      await sleep(5000);
      const info = await pg.evaluate(() => { const s = window.GARDEN; return { props: s.props.length, pct: s.pct }; });
      // girls walk for a while (fast-forward), none may stand inside a prop
      await pg.evaluate(() => { const s = window.GARDEN; s.holdForTest(); for (let i = 0; i < 4; i++) s.girlForTest(3 + i * 3, 8 + i * 3, ['phone', 'shake', 'dog', 'laptop'][i], 1.3); s.tick(1 / 30, 300); s.holdForTest(); });
      const bad = await pg.evaluate(() => { const s = window.GARDEN; return s.girls.filter((g) => s.blockAt(Math.round(g.x), Math.round(g.y)) && g.state !== 'flee').length; });
      if (bad) fail(`night ${n}: ${bad} girl(s) inside a prop`);
      if (n === 1) { await pg.evaluate(() => window.GARDEN.trapForTest()); await pg.evaluate(() => window.GARDEN.tick(1 / 60, 50)); await sleep(150); await pg.screenshot({ path: path.join(OUT, `a-${w}-trapped.png`) }); const st = await pg.evaluate(() => window.GARDEN.girls.map((g) => g.state)); if (!st.includes('stuck')) fail('no trapped girl: ' + st); }
      await sleep(300);
      await pg.screenshot({ path: path.join(OUT, `a-${w}-night${n}.png`) });
      console.log(w, 'night', n, JSON.stringify(info));
      if (info.props < 6) fail(`night ${n}: only ${info.props} props`);
    }
    if (errs.length) fail('errors ' + errs.join(' | '));
    await pg.close();
  }
  console.log(process.exitCode ? 'DONE with failures' : 'ALL OK');
  await br.close();
})();
