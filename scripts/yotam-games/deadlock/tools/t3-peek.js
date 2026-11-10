// screenshot: a teammate leans out of the window after a move, at a phone size -> ../shots/peek-<w>.png
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), OUT = path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [w, h] of [[390, 844], [360, 640]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); p.on('response', (r) => { if (r.status() >= 400) console.log('404', r.url()); });
    await p.goto('http://localhost:5310/yotam-games/deadlock/?solo=1'); await p.evaluate(() => localStorage.setItem('shlomiverse:deadlock:tut', '1'));
    await p.reload(); await p.waitForTimeout(1200); await p.tap('#playBtn', { force: true }); await p.waitForTimeout(800);
    // a real drag of the first car the solver moves
    const mv = await p.evaluate(() => DEADLOCK.solve()), pc = (await p.evaluate(() => DEADLOCK.pieces))[mv.i];
    const a = await p.evaluate(([r, c]) => DEADLOCK.cell(r, c), [pc.r, pc.c]), d = (mv.to - pc.pos) * a.size;
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    for (let k = 1; k <= 8; k++) await p.mouse.move(a.x + (pc.h ? d * k / 8 : 0), a.y + (pc.h ? 0 : d * k / 8));
    await p.mouse.up(); await p.waitForTimeout(7600);
    console.log(w, JSON.stringify(await p.evaluate(() => DEADLOCK.peeks)));
    await p.screenshot({ path: `${OUT}/peek-${w}.png` });
    await ctx.close();
  }
  await b.close();
})();
