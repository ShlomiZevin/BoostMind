// play test: tutorial (every step, the try-it steps by real drags), then a real game until he walks out -> ../shots/
//   python -m http.server 5302 (in BoostMind/public); node scripts/yaniv-games/millimeters/tools/t1-play.js [BASE]
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const BASE = process.argv[2] || process.env.BASE || 'http://localhost:5302/yaniv-games';
const OUT = path.join(__dirname, '..', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);
// drag the handle from its place to angle `to` (degrees) in `ms`
async function bend(p, to, ms = 900) {
  await p.waitForFunction(() => MILLI.cur.back <= 0 && MILLI.cur.flinch <= 0, null, { timeout: 5000 }).catch(() => {});
  const g = await p.evaluate(() => ({ L: MILLI.L, a: MILLI.cur.a }));
  const pt = (a) => ({ x: g.L.PX + Math.cos(-a * Math.PI / 180) * g.L.R, y: g.L.PY + Math.sin(-a * Math.PI / 180) * g.L.R });
  const s = pt(g.a); await p.mouse.move(s.x, s.y); await p.mouse.down();
  const n = Math.max(4, Math.round(ms / 30));
  for (let i = 1; i <= n; i++) { const q = pt(g.a + (to - g.a) * i / n); await p.mouse.move(q.x, q.y); await wait(p, 30); }
  return async () => p.mouse.up();
}
const zone = (p) => p.evaluate(() => MILLI.zoneC());
// stay on the moving green: follow its centre with the held finger
async function follow(p, ms) {
  const g = await p.evaluate(() => MILLI.L), t0 = Date.now();
  while (Date.now() - t0 < ms) { const a = await zone(p); await p.mouse.move(g.PX + Math.cos(-a * Math.PI / 180) * g.R, g.PY + Math.sin(-a * Math.PI / 180) * g.R); await wait(p, 40); if (await p.evaluate(() => MILLI.cur.back > 0)) break; }
}
async function doRep(p, hold = 3600) { const up = await bend(p, await zone(p), 1100); await follow(p, hold); await up(); await wait(p, 700); }
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['wide', { width: 1280, height: 760 }]]) {
    const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: 1 })).newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/t\.js|404/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE + '/millimeters/?solo=1' + (BASE.startsWith('https') ? '&notrack=1' : '')); await wait(p, 1500);
    await p.screenshot({ path: `${OUT}/${name}-start.png` });
    await p.click('#playBtn', { force: true }); await wait(p, 900);
    for (let i = 0; i < 4; i++) { await p.screenshot({ path: `${OUT}/${name}-tut${i + 1}.png` }); await p.keyboard.press('Space'); await wait(p, 300); }
    await p.screenshot({ path: `${OUT}/${name}-tut5.png` });
    let up = await bend(p, await zone(p), 1000); await wait(p, 200); await p.screenshot({ path: `${OUT}/${name}-tut5-in.png` });
    await p.keyboard.press('Space'); await wait(p, 300); await follow(p, 4000); await up(); await wait(p, 300);
    await p.screenshot({ path: `${OUT}/${name}-tut6-done.png` }); await wait(p, 700);
    await p.keyboard.press('Space'); await wait(p, 300);
    up = await bend(p, 79, 500); await up(); await wait(p, 400); await p.screenshot({ path: `${OUT}/${name}-tut7-over.png` });
    for (let i = 0; i < 3; i++) { await p.keyboard.press('Space'); await wait(p, 400); }
    const st = await p.evaluate(() => MILLI.state); await wait(p, 2500);
    await p.screenshot({ path: `${OUT}/${name}-play.png` });
    // a careful player: three sessions clean
    for (let s = 0; s < 3; s++) { for (let r = 0; r < 3; r++) await doRep(p); await wait(p, 2200); if (s === 0) await p.screenshot({ path: `${OUT}/${name}-sess2.png` }); }
    const mid = await p.evaluate(() => ({ s: MILLI.sessions, pain: Math.round(MILLI.pain), ex: MILLI.cur.ex }));
    await p.screenshot({ path: `${OUT}/${name}-mid.png` });
    // then rough: overshoot until he walks out
    for (let i = 0; i < 20 && (await p.evaluate(() => MILLI.state)) === 'play'; i++) { const u = await bend(p, 115, 200); await u(); await wait(p, 700); if (i === 0) await p.screenshot({ path: `${OUT}/${name}-scream.png` }); }
    await wait(p, 2500); await p.screenshot({ path: `${OUT}/${name}-over.png` });
    const end = await p.evaluate(() => ({ state: MILLI.state, s: MILLI.sessions, reps: MILLI.reps }));
    console.log(name, '| after tutorial:', st, '| mid:', JSON.stringify(mid), '| end:', JSON.stringify(end), errs.length ? 'ERRORS ' + errs.join(' / ') : 'no errors');
  }
  await b.close();
})();
