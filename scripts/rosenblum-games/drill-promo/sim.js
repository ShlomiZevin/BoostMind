// headless check of the promo bot's plan on a level (no frames): node sim.js [level]
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const LV = +(process.argv[2] || 1);
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 405, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5310/rosenblum-games/drill/?solo=1', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const r = await p.evaluate(async (LV) => {
    const D = DRILL; D.start(LV); const log = []; let t = 0, blocked = null;
    while (t < 200 && !D.state.over) {
      D.tick(0.1); t += 0.1;
      const ws = D.walkers;
      for (const w of ws) if (w.mis && (w.st === 'walk' || w.st === 'dash')) { D.tap(w.id); log.push([+t.toFixed(1), 'mis', w.id, w.mis]); }
      if (blocked === null) {
        const lead = ws.find((w) => w.kind === 'pair' && w.st === 'walk' && w.y > 150 && w.y < 260 && w.x > 270 && w.d === 1);
        if (lead) { D.order('stop'); if (D.tap(lead.id)) { blocked = lead.id; log.push([+t.toFixed(1), 'stop', lead.id, Math.round(lead.x), Math.round(lead.y)]); } }
      }
      if (Math.round(t * 10) % 50 === 0) log.push([+t.toFixed(1), 'st', D.state.saved, D.state.lost]);
    }
    const sh = D.walkers.find((w) => w.kind === 'shahar');
    return { t, state: D.state, shahar: sh, log, ws0: null };
  }, LV);
  console.log(JSON.stringify(r.state), 'shahar', JSON.stringify(r.shahar), 't', r.t.toFixed(1));
  console.log(r.log.map((l) => l.join(' ')).join(' | '));
  if (errs.length) console.log('ERR', errs);
  await b.close();
})();
