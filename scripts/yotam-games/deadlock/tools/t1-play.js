// Plays דדלוק like a player: the tutorial with real taps / drags, then all 5 lots (each move = a real mouse drag,
// the move picked by the game's own solver), one wrong move and a rollback on lot 1, and the end screen. -> ../shots/
//   node tools/t1-play.js [url]   (serve public/ on 5310 first)
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), fs = require('fs'), OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const URL = process.argv[2] || 'http://localhost:5310/yotam-games/deadlock/?solo=1';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(URL); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/1-start.png` });
  const G = (k) => p.evaluate((k) => window.DEADLOCK[k], k);
  // drag car i to position `to` along its length with the mouse
  async function drag(i, to) {
    const pc = (await G('pieces'))[i];
    const a = await p.evaluate(([r, c]) => DEADLOCK.cell(r, c), [pc.r, pc.c]);
    const d = (to - pc.pos) * a.size;
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    for (let k = 1; k <= 6; k++) await p.mouse.move(a.x + (pc.h ? d * k / 6 : 0), a.y + (pc.h ? 0 : d * k / 6));
    await p.mouse.up(); await p.waitForTimeout(80);
  }
  async function tap(i) { const pc = (await G('pieces'))[i]; const a = await p.evaluate(([r, c]) => DEADLOCK.cell(r, c), [pc.r, pc.c]); await p.mouse.click(a.x, a.y); }

  // tutorial
  await p.click('#playBtn', { force: true }); await p.waitForTimeout(500);
  const steps = [];
  for (let k = 0; k < 12 && (await G('tut')) >= 0; k++) {
    const i = await G('tut'); steps.push(i);
    if (i === 0) await p.screenshot({ path: `${OUT}/2-tut0.png` });
    if (i === 2) { await tap(1); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/3-tut-tap.png` }); }
    if (i === 3) { await drag(1, 3); await p.waitForTimeout(300); }
    if (i === 4) { await drag(0, 4); await p.waitForTimeout(2000); await p.screenshot({ path: `${OUT}/4-tut-win.png` }); }
    if (i === 6) await p.screenshot({ path: `${OUT}/5-tut-hint.png` });
    await p.keyboard.press('Space'); await p.waitForTimeout(250);
  }
  console.log('tutorial steps seen:', steps.join(','), '-> state', await G('state'));
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/6-lot1.png` });

  for (let lot = 0; lot < 5; lot++) {
    await p.waitForFunction((l) => DEADLOCK.state === 'play' && DEADLOCK.lot === l, lot, { timeout: 8000 });
    if (lot === 0) {   // a tap on a teammate, a hint, a rollback
      await tap(1); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/7-tap-mate.png` });
      await p.click('#hintBtn'); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/8-hint.png` });
      await p.click('#resetBtn'); await p.waitForTimeout(200);
    }
    if (lot === 2) await p.screenshot({ path: `${OUT}/9-lot3.png` });
    let guard = 0;
    while ((await G('state')) === 'play' && (await G('lot')) === lot && guard++ < 80) {
      const s = await p.evaluate(() => DEADLOCK.solve());
      if (!s) break;
      await drag(s.i, s.to);
      if (s.i === 0 && s.to === 4) break;
    }
    await p.waitForTimeout(2200);
    const r = (await G('results'))[lot];
    console.log(`lot ${lot + 1}: ${r ? r.moves + ' moves, opt ' + r.opt : 'NOT SOLVED'}`);
    if (lot === 0) await p.screenshot({ path: `${OUT}/10-lot-done.png` });
    if (lot < 4) { await p.click('#nextBtn'); await p.waitForTimeout(300); }
  }
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/11-over.png` });
  console.log('end state', await G('state'), '| best', await p.evaluate(() => localStorage.getItem('shlomiverse:deadlock:best')));
  console.log(errs.length ? 'ERRORS: ' + errs.join(' / ') : 'no errors');
  await b.close();
})();
