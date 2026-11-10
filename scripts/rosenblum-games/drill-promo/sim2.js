// headless check of round 2: node sim2.js [level] [order]  - gives the order to the first pair that walks, logs the outcome
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const LV = +(process.argv[2] || 3), ORD = process.argv[3] || 'stairs';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 405, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5310/rosenblum-games/drill/?solo=1', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const r = await p.evaluate(({ LV, ORD }) => {
    const D = DRILL; D.start(LV); const log = []; let t = 0, given = null;
    while (t < 220 && !D.state.over) {
      D.tick(0.1); t += 0.1;
      const ws = D.walkers;
      if (given === null) { const w = ws.find((w) => w.kind === 'pair' && w.st === 'walk'); if (w) { D.order(ORD); if (D.tap(w.id)) { given = w.id; log.push([+t.toFixed(1), ORD, w.id, Math.round(w.x), Math.round(w.y)]); } } }
      if (Math.round(t * 10) % 50 === 0) log.push([+t.toFixed(1), D.state.saved, D.state.lost, ws.filter((w) => w.st === 'stairs' || w.st === 'build').length]);
    }
    return { t, state: D.state, log, last: D.walkers.find((w) => w.kind === 'shahar') };
  }, { LV, ORD });
  console.log(JSON.stringify(r.state), 'shahar', r.last && r.last.st, 't', r.t.toFixed(1));
  console.log(r.log.map((l) => l.join(' ')).join(' | '));
  if (errs.length) console.log('ERR', errs);
  await b.close();
})();
