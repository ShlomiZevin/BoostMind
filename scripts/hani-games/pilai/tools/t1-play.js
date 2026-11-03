// play test: start, the whole tutorial, then all 6 stories (one wrong tap in the first), game over -> pilai/shots/
//   python -m http.server 5301 (in C:/workspace/hani-games); node pilai/tools/t1-play.js
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);
// tap the hand card that comes next (or, with wrong=true, one that doesn't)
const tapNext = (p, wrong) => p.evaluate((w) => { const want = PILAI.placed + 1; const c = [...document.querySelectorAll('#hand .card')].find((e) => w ? +e.dataset.i !== want : +e.dataset.i === want); if (c) c.click(); return !!c; }, wrong);
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const [name, vp] of [['phone', { width: 390, height: 780 }], ['wide', { width: 1280, height: 760 }]]) {
    const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: name === 'phone' })).newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/t\.js|404/.test(m.text())) errs.push(m.text()); });
    await p.goto('http://localhost:5301/pilai/'); await wait(p, 1500);
    await p.screenshot({ path: `${OUT}/${name}-start.png` });
    await p.click('#playBtn', { force: true }); await wait(p, 800);
    await p.screenshot({ path: `${OUT}/${name}-tut1.png` });
    await p.keyboard.press('Space'); await wait(p, 300); await p.screenshot({ path: `${OUT}/${name}-tut2.png` });
    await p.keyboard.press('Space'); await wait(p, 300); await p.screenshot({ path: `${OUT}/${name}-tut3.png` });
    await tapNext(p); await wait(p, 700);
    await p.keyboard.press('Space'); await wait(p, 300);
    await p.keyboard.press('Space'); await wait(p, 300);
    await tapNext(p); await wait(p, 700); await tapNext(p); await wait(p, 1400);
    await p.screenshot({ path: `${OUT}/${name}-tut-done.png` });
    await p.keyboard.press('Space'); await wait(p, 300); await p.keyboard.press('Space'); await wait(p, 800);
    const st = await p.evaluate(() => PILAI.state);
    await p.screenshot({ path: `${OUT}/${name}-play.png` });
    for (let s = 0; s < 6; s++) {
      if (s === 0) { await tapNext(p, true); await wait(p, 300); await p.screenshot({ path: `${OUT}/${name}-wrong.png` }); }
      await tapNext(p); await wait(p, 650);
      if (s === 0) await p.screenshot({ path: `${OUT}/${name}-one.png` });
      await tapNext(p); await wait(p, 650); await tapNext(p); await wait(p, 1300);
      if (s === 0) await p.screenshot({ path: `${OUT}/${name}-story-done.png` });
      await p.click('#nextBtn'); await wait(p, 500);
    }
    await wait(p, 500); await p.screenshot({ path: `${OUT}/${name}-over.png` });
    const r = await p.evaluate(() => ({ state: PILAI.state, stars: PILAI.stars }));
    console.log(name, '| after tutorial:', st, '| end:', JSON.stringify(r), errs.length ? 'ERRORS ' + errs.join(' / ') : 'no errors');
  }
  await b.close();
})();
