// headless check of round 2: node sim2.js [level] [order]  - gives the order to the first pair that walks, logs the outcome
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const LV = +(process.argv[2] || 2), ORD = process.argv[3] || 'stairs', PX = +(process.argv[4] || 60);
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 405, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5310/rosenblum-games/drill/?solo=1', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const r = await p.evaluate(({ LV, ORD, PX }) => {
    const D = DRILL; D.start(LV); const log = []; let t = 0, given = null;
    while (t < 220 && !D.state.over) {
      D.tick(0.1); t += 0.1;
      const ws = D.walkers;
      for (const m of ws) if (m.mis === 'warn' || m.mis === 'run') { if (D.tap(m.id)) log.push([+t.toFixed(1), 'catch', m.id]); }
      if (given === null) { const w = ws.find((w) => w.kind === 'pair' && w.st === 'walk' && w.x > D.X(+(PX))); if (w) { D.order(ORD); if (D.tap(w.id)) { given = w.id; window.__y0 = w.y; log.push([+t.toFixed(1), ORD, w.id, Math.round(w.x), Math.round(w.y)]); } } }
      if (given !== null && !window.__g2) { const g = ws.find((w) => w.id === given); if (g && g.st === 'walk' && !g.armed && g.y > window.__y0 + 50) { D.order(ORD); if (D.tap(g.id)) { window.__g2 = 1; log.push([+t.toFixed(1), ORD + '2', g.id, Math.round(g.x), Math.round(g.y)]); } } }
      if (Math.round(t * 10) % 50 === 0) log.push([+t.toFixed(1), D.state.saved, D.state.lost, ws.filter((w) => w.st === 'stairs' || w.st === 'build').length]);
    }
    return { t, state: D.state, log, last: D.walkers.find((w) => w.kind === 'shahar') };
  }, { LV, ORD, PX });
  console.log(JSON.stringify(r.state), 'shahar', r.last && r.last.st, 't', r.t.toFixed(1));
  console.log(r.log.map((l) => l.join(' ')).join(' | '));
  if (errs.length) console.log('ERR', errs);
  await b.close();
})();
