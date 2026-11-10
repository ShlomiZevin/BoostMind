// a player on phones: start screen, the whole tutorial with real taps, level 1 played to the end card, level 2 lost
// -> shots/<phone>-*.png.   python -m http.server 8731 (in public/); node tools/t1-play.js
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8731/rosenblum-games/drill/?solo=1';
const PHONES = [['se', 320, 568], ['s360', 360, 640], ['p390', 390, 844], ['p412', 412, 915]];
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const only = process.argv[2];
  for (const [name, w, h] of PHONES.filter((p) => !only || p[0] === only)) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/t\.js|404|favicon/.test(m.text())) errs.push(m.text()); });
    await p.goto(URL); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${name}-1start.png` });
    const fits = await p.evaluate(() => [...document.querySelectorAll('#start > *')].filter((e) => !e.hidden && e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return [e.id || e.className, Math.round(r.bottom)]; }).filter(([, b]) => b > innerHeight));
    await p.tap('#bPlay', { force: true }); await p.waitForTimeout(500);
    // the tutorial: next / the try-it taps
    for (let k = 0; k < 20; k++) {
      const st = await p.evaluate(() => DRILL.state.tut); if (st < 0) break;
      if (k === 1 || st === 7) await p.screenshot({ path: `${OUT}/${name}-2tut${st}.png` });
      const next = await p.$('#tNext');
      if (next) { await next.tap({ force: true }); await p.waitForTimeout(300); continue; }
      if (st === 6) { await p.tap('.ord[data-o=stop]'); await p.waitForTimeout(900); continue; }
      const pt = await p.evaluate(() => { const w = DRILL.walkers[0]; return DRILL.toScreen(w.x, w.y - 16); });
      await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(900);
      if (st === 8) await p.screenshot({ path: `${OUT}/${name}-2tut8.png` });
    }
    await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${name}-3intro.png` });
    await p.tap('#bGo', { force: true }); await p.waitForTimeout(800);
    await p.evaluate(() => DRILL.tick(26)); await p.waitForTimeout(200);
    await p.screenshot({ path: `${OUT}/${name}-4play.png` });
    // a real tap on a walker with stop, then release it
    const pt = await p.evaluate(() => { const w = DRILL.walkers.find((w) => w.st === 'walk' && !w.ramp); return w && { id: w.id, ...DRILL.toScreen(w.x, w.y - 16) }; });
    let tapped = 'none';
    if (pt) { await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(100); tapped = await p.evaluate((id) => DRILL.walkers.find((w) => w.id === id).st, pt.id); await p.touchscreen.tap(pt.x, pt.y); }
    await p.evaluate(() => { for (let k = 0; k < 300 && !DRILL.state.over; k++) DRILL.tick(1); }); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${name}-5end.png` });
    const endFits = await p.evaluate(() => { const r = document.querySelector('#end .card').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    const s = await p.evaluate(() => DRILL.state);
    // level 2 with no orders = a loss
    await p.evaluate(() => DRILL.start(1)); await p.evaluate(() => { for (let k = 0; k < 300 && !DRILL.state.over; k++) DRILL.tick(1); }); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/${name}-6lose.png` });
    const bar = await p.evaluate(() => [...document.querySelectorAll('.ord:not(.off)')].map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }).join(' '));
    console.log(name, 'start overflow:', JSON.stringify(fits), '| tap->', tapped, '| L1', s.saved + '/' + s.quota, '| end card fits', endFits, '| orders', bar, errs.length ? 'ERR ' + errs.join(' / ') : '');
  }
  await b.close();
})();
