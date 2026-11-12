// plays all three apps like a player (real mouse/keys): every tutorial, a real round each, the end screen
// run: python -m http.server 5321 (in public/)  then  node t1-play.js
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/'; require('fs').mkdirSync(OUT, { recursive: true });
const BASE = (process.env.BASE || 'http://localhost:5321') + '/techytech-games/meetings/?solo=1';
const W = (p, ms) => p.waitForTimeout(ms);
async function stepTo(p, waiting) {  // press "next" until the tutorial waits for a real action
  for (let i = 0; i < 15; i++) { const w = await p.evaluate(() => MEET.G.tut && MEET.G.tut.waiting); if (w === waiting) return true; await p.keyboard.press('Space'); await W(p, 250); }
  return false;
}
async function finishTut(p) { for (let i = 0; i < 15; i++) { if (!(await p.evaluate(() => MEET.G.tut))) return; await p.keyboard.press('Space'); await W(p, 250); } }
async function drawPath(p, cells) {  // drag through cells on the Teamz canvas
  const g = await p.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return { x: r.left + MEET.tz.ox, y: r.top + MEET.tz.oy, c: MEET.tz.cell }; });
  const at = (q) => [g.x + (q[0] + .5) * g.c, g.y + (q[1] + .5) * g.c];
  await p.mouse.move(...at(cells[0])); await p.mouse.down();
  for (const q of cells.slice(1)) await p.mouse.move(...at(q), { steps: 3 });
  await p.mouse.up();
}
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/404|Failed to load/.test(m.text()) && errs.push(m.text()));
  await p.goto(BASE); await W(p, 1200);
  await p.screenshot({ path: OUT + 'hub.png' });
  const res = {};

  // ---- Zoomba ----
  await p.click('.app[data-mode=zoomba]'); await W(p, 500);
  res.zTut = await stepTo(p, 'merge');
  await p.screenshot({ path: OUT + 'z-tut.png' });
  // a real swipe (mouse drag) upwards on the board
  const zb = await p.evaluate(() => { const r = document.getElementById('zb').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await p.mouse.move(zb[0], zb[1] + 60); await p.mouse.down(); await p.mouse.move(zb[0], zb[1] - 40, { steps: 5 }); await p.mouse.up(); await W(p, 1200);
  res.zMerged = await p.evaluate(() => !MEET.G.tut || MEET.G.tut.i > 2);
  await finishTut(p); await W(p, 400);
  res.zReal = await p.evaluate(() => MEET.G.mode === 'zoomba' && !MEET.G.tut && MEET.zb.tiles.length === 2);
  // bot: prefer moves in a corner strategy until the board locks
  for (let i = 0; i < 900; i++) {
    const st = await p.evaluate(() => MEET.G.over);
    if (st) break;
    for (const k of ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp']) { const moved = await p.evaluate((k) => MEET.zb.move({ ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U' }[k]), k); if (moved) break; }
    await W(p, 150);
    if (i === 40) await p.screenshot({ path: OUT + 'z-play.png' });
  }
  await W(p, 1200);
  res.zEnd = await p.evaluate(() => ({ over: MEET.G.over, score: MEET.G.score, best: MEET.zb.best, endShown: !document.getElementById('end').hidden, moves: MEET.zb.moves }));
  await p.screenshot({ path: OUT + 'z-end.png' });
  await p.click('#bMenu'); await W(p, 400);

  // ---- Meetly ----
  await p.click('.app[data-mode=meetly]'); await W(p, 500);
  res.mTut = await stepTo(p, 'found');
  await p.screenshot({ path: OUT + 'm-tut.png' });
  let t = await p.evaluate(() => { const r = MEET.mt.targetEl().getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await p.mouse.click(t[0], t[1]); await W(p, 1200);
  await finishTut(p); await W(p, 500);
  for (let i = 0; i < 7; i++) {
    if (i === 2) {  // one wrong tap on purpose
      const w = await p.evaluate(() => { const els = [...document.querySelectorAll('.mt')]; const e = els.find((x) => x !== MEET.mt.targetEl()); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      const before = await p.evaluate(() => MEET.G.time); await p.mouse.click(w[0], w[1]); await W(p, 150); res.mWrong = before - (await p.evaluate(() => MEET.G.time)) > 2.5;
    }
    if (i === 5) await p.screenshot({ path: OUT + 'm-play.png' });
    t = await p.evaluate(() => { const r = MEET.mt.targetEl().getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, MEET.mt.task]; });
    await p.mouse.click(t[0], t[1]); await W(p, 1000);
  }
  res.mRounds = await p.evaluate(() => MEET.mt.round);
  await p.evaluate(() => { MEET.G.time = .3; }); await W(p, 1500);
  res.mEnd = await p.evaluate(() => ({ over: MEET.G.over, score: MEET.G.score, endShown: !document.getElementById('end').hidden }));
  await p.screenshot({ path: OUT + 'm-end.png' });
  await p.click('#bMenu'); await W(p, 400);

  // ---- Teamz ----
  await p.click('.app[data-mode=teamz]'); await W(p, 500);
  res.tTut = await stepTo(p, 'connect');
  await p.screenshot({ path: OUT + 't-tut.png' });
  await drawPath(p, [[0, 0], [1, 0], [2, 0], [3, 0]]); await W(p, 1200);
  res.tTut2 = await stepTo(p, 'level');
  // a wrong try first: connect Ronit straight (leaves cells empty) - must NOT finish
  await drawPath(p, [[0, 1], [1, 1], [2, 1], [3, 1]]); await drawPath(p, [[0, 2], [0, 3]]); await W(p, 400);
  res.tNotYet = await p.evaluate(() => !MEET.tz.done);
  await drawPath(p, [[0, 2], [1, 2], [2, 2], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3]]); await W(p, 1200);
  await finishTut(p); await W(p, 500);
  for (let lv = 0; lv < 3; lv++) {
    const sols = await p.evaluate(() => MEET.tz.pairs.map((x) => x.sol));
    for (const s of sols) await drawPath(p, s);
    if (lv === 1) await p.screenshot({ path: OUT + 't-play.png' });
    await W(p, 1600);
  }
  res.tLevels = await p.evaluate(() => MEET.tz.level);
  await p.evaluate(() => { MEET.G.time = .3; }); await W(p, 1500);
  res.tEnd = await p.evaluate(() => ({ over: MEET.G.over, score: MEET.G.score, endShown: !document.getElementById('end').hidden }));
  await p.screenshot({ path: OUT + 't-end.png' });
  console.log(JSON.stringify(res, null, 1));
  console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
  await b.close();
})();
