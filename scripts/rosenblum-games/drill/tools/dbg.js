const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:8731/rosenblum-games/drill/?solo=1'); await p.waitForTimeout(1000);
  const out = await p.evaluate(() => { DRILL.start(1); DRILL.tick(1); DRILL.order('guide'); DRILL.tick(6); const g = DRILL.walkers.find((w) => w.st === 'walk' && Math.abs(w.y - DRILL.F[1]) < 3); if (g) DRILL.tap(g.id); DRILL.order('bridge'); DRILL.tap(0); const log = [];
    for (let k = 0; k < 60; k++) { DRILL.tick(0.5); const w = DRILL.walkers[0]; log.push(k + ' ' + w.st + ' ' + w.x.toFixed(0) + ',' + w.y.toFixed(0) + ' ' + w.armed + ' ' + (w.why || '')); } return log.join('\n'); });
  console.log(out); await b.close();
})();
