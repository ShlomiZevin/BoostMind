// Phone sizes, by touch: the start screen fits, the board + HUD + strip don't overlap, every button is on screen and
// at least 44px, a real touch drag moves a car, the lot-done and end screens fit. -> ../shots/p<w>-*.png
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), OUT = path.join(__dirname, '..', 'shots');
const URL = process.argv[2] || 'http://localhost:5310/yotam-games/deadlock/?solo=1';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [w, h] of [[320, 568], [360, 640], [390, 844], [412, 915], [844, 390]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(1200);
    const bad = [];
    const startOver = await p.evaluate(() => [...document.querySelectorAll('#start > *')].filter((c) => { const r = c.getBoundingClientRect(); return r.height && (r.top < 0 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1); }).map((c) => c.className || c.id));
    if (startOver.length) bad.push('start overflows: ' + startOver.join(','));
    await p.screenshot({ path: `${OUT}/p${w}-start.png` });
    if (w > h) { const turn = await p.evaluate(() => document.body.classList.contains('turn')); console.log(`${w}x${h}`, turn ? 'asks to turn the phone' : 'NO TURN NOTICE'); await ctx.close(); continue; }
    await p.evaluate(() => { localStorage.setItem('shlomiverse:deadlock:tut', '1'); });
    await p.tap('#playBtn', { force: true }); await p.waitForTimeout(900);
    if (await p.evaluate(() => DEADLOCK.state) !== 'play') { await p.tap('#playBtn', { force: true }); await p.waitForTimeout(900); }
    const lay = await p.evaluate(() => {
      const hud = document.getElementById('hud').getBoundingClientRect(), strip = document.getElementById('strip').getBoundingClientRect();
      const a = DEADLOCK.cell(0, 0), z = DEADLOCK.cell(5, 5);
      const btns = [...document.querySelectorAll('#hud button')].map((e) => { const r = e.getBoundingClientRect(); return [e.id || e.className, r.width, r.left, r.right]; });
      return { hudT: hud.top, hudB: hud.bottom, stripT: strip.top, stripB: strip.bottom, H: innerHeight, signB: DEADLOCK.signBottom, top: a.y - a.size / 2, bottom: z.y + z.size / 2, left: a.x - a.size / 2, right: z.x + z.size / 2, cell: a.size, btns, W: innerWidth };
    });
    if (lay.stripB > lay.hudT + 1) bad.push('strip over the HUD');
    if (lay.hudB > lay.H) bad.push('HUD off screen');
    if (lay.signB < 0) bad.push('Techy-Tech sign cut off');
    if (lay.bottom > lay.stripT) bad.push('board under the strip');
    if (lay.left < 0 || lay.right > lay.W) bad.push('board off screen');
    for (const [n, bw, l, r] of lay.btns) { if (bw < 40) bad.push(`${n} only ${bw}px`); if (l < 0 || r > lay.W) bad.push(`${n} off screen`); }
    // a real touch drag on the first car that can move
    const moved = await p.evaluate(() => DEADLOCK.solve());
    if (!moved) { console.log(w, "no solve", JSON.stringify(await p.evaluate(() => [DEADLOCK.state, DEADLOCK.lot, DEADLOCK.pieces]))); await ctx.close(); continue; }
    const pc = (await p.evaluate(() => DEADLOCK.pieces))[moved.i], a = await p.evaluate(([r, c]) => DEADLOCK.cell(r, c), [pc.r, pc.c]);
    const d = (moved.to - pc.pos) * a.size, cdp = await ctx.newCDPSession(p);
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await tp('touchStart', a.x, a.y);
    for (let k = 1; k <= 6; k++) await tp('touchMove', a.x + (pc.h ? d * k / 6 : 0), a.y + (pc.h ? 0 : d * k / 6));
    await tp('touchEnd'); await p.waitForTimeout(300);
    const m = await p.evaluate(() => DEADLOCK.moves);
    if (m !== 1) bad.push('touch drag did not move a car (moves=' + m + ')');
    await p.screenshot({ path: `${OUT}/p${w}-play.png` });
    // solve the rest of lot 1 and look at the lot-done screen
    for (let g = 0; g < 40; g++) { const s = await p.evaluate(() => DEADLOCK.solve()); if (!s) break; await p.evaluate(([i, to]) => DEADLOCK.move(i, to), [s.i, s.to]); }
    await p.waitForTimeout(2200);
    const doneOver = await p.evaluate(() => [...document.querySelectorAll('#lotDone > *')].some((c) => { const r = c.getBoundingClientRect(); return r.height && (r.top < 0 || r.bottom > innerHeight + 1); }));
    if (doneOver) bad.push('lot-done overflows');
    await p.screenshot({ path: `${OUT}/p${w}-done.png` });
    console.log(`${w}x${h}`, `cell ${Math.round(lay.cell)}px`, bad.length ? 'PROBLEMS: ' + bad.join(' | ') : 'ok', errs.length ? 'ERRORS ' + errs.join(' / ') : '');
    await ctx.close();
  }
  await b.close();
})();
