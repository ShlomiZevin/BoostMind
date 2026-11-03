// phones by touch: start screen, tutorial card, a real rep by touch drag, at five sizes; checks nothing overflows -> ../shots/
//   node scripts/yaniv-games/millimeters/tools/t2-phones.js [BASE]
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const BASE = process.argv[2] || process.env.BASE || 'http://localhost:5302/yaniv-games';
const OUT = path.join(__dirname, '..', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const SIZES = { se: [320, 568], small: [360, 640], iphone: [390, 844], tall: [412, 915], land: [844, 390] };
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [name, [w, h]] of Object.entries(SIZES)) {
    const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/millimeters/'); await p.waitForTimeout(1200);
    const over = await p.evaluate(() => [...document.querySelectorAll('#start > *')].filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.top < -1; }).map((e) => e.id || e.className));
    await p.screenshot({ path: `${OUT}/ph-${name}-start.png` });
    if (name === 'land') { console.log(name, 'start overflow:', over.join(',') || 'none', '| turn overlay:', await p.evaluate(() => document.body.classList.contains('turn'))); await c.close(); continue; }
    await p.tap('#playBtn', { force: true }); await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/ph-${name}-tut.png` });
    await p.evaluate(() => document.getElementById('tutSkip').click()); await p.waitForTimeout(2600);
    // one rep by touch: drag the handle into the green and hold
    const g = await p.evaluate(() => ({ L: MILLI.L, z: MILLI.zoneC() }));
    const pt = (a) => ({ x: g.L.PX + Math.cos(-a * Math.PI / 180) * g.L.R, y: g.L.PY + Math.sin(-a * Math.PI / 180) * g.L.R });
    const cdp = await c.newCDPSession(p); const touch = (type, q) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: q ? [{ x: q.x, y: q.y }] : [] });
    await touch('touchStart', pt(0));
    for (let i = 1; i <= 30; i++) { await touch('touchMove', pt(g.z * i / 30)); await p.waitForTimeout(30); }
    await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/ph-${name}-play.png` });
    await p.waitForTimeout(1400); await touch('touchEnd'); await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({ reps: MILLI.reps, pain: Math.round(MILLI.pain), handle: MILLI.handlePos(0), H: innerHeight, W: innerWidth, chip: document.getElementById('chip').getBoundingClientRect().top }));
    const fits = r.handle.y < r.chip - 10 && r.handle.x < r.W;
    console.log(name, 'start overflow:', over.join(',') || 'none', '| rep by touch:', r.reps === 1 ? 'yes' : 'NO (' + r.reps + ')', '| handle above chip:', fits, errs.length ? 'ERRORS ' + errs.join(' / ') : '');
    await c.close();
  }
  await b.close();
})();
