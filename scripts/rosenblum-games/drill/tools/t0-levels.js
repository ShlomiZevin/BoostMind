// every level: a screenshot at 18s, what happens with NO orders (should fail from level 2 on), and the scripted
// solution (must pass) -> shots/levels-*.png + a table.   python -m http.server 8731 (in public/); node tools/t0-levels.js
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8731/rosenblum-games/drill/?solo=1';
// a solution = list of [when, order, which]: which = 'first' | 'last' | 'shahar' | {x, f} (the walker nearest that spot
// on that floor) - checked every 0.1s until it can be given.
const SOL = require('./solutions.js');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1200);
  const n = await p.evaluate(() => DRILL.levels.length);
  const only = process.argv[2] ? [+process.argv[2]] : [...Array(n).keys()];
  for (const i of only) {
    // 1. no orders
    await p.evaluate((i) => DRILL.start(i), i);
    await p.evaluate(() => DRILL.tick(18)); await p.screenshot({ path: `${OUT}/levels-${i + 1}.png` });
    const none = await p.evaluate(() => { for (let k = 0; k < 400 && !DRILL.state.over; k++) DRILL.tick(1); const s = DRILL.state; return { saved: s.saved, lost: s.lost, quota: s.quota, t: Math.round(s.timeLeft), why: DRILL.walkers.filter((w) => w.st === 'lost').map((w) => w.why).join(',') }; });
    // 2. the solution
    await p.evaluate((i) => DRILL.start(i), i);
    const sol = SOL[i] || []; sol.hold = (SOL.hold || {})[i];
    const res = await p.evaluate(([sol, hold]) => { sol.hold = hold;
      const todo = sol.map((s) => ({ ...s })); const log = [];
      for (let k = 0; k < 4000 && !DRILL.state.over; k++) {
        const t = k * 0.1;
        for (const s of todo) if (!s.done && t >= s.at) {
          const ws = DRILL.walkers.filter((w) => ['walk', 'block'].includes(w.st));
          let w = null;
          if (s.who === 'first') w = ws.filter((w) => w.st === 'walk').sort((a, b) => a.id - b.id)[0];
          else if (s.who === 'shahar') w = ws.find((w) => w.kind === 'shahar');
          else if (s.who === 'blocker') w = ws.find((w) => w.st === 'block');
          else if (typeof s.who === 'number') w = ws.find((w) => w.id === s.who);
          else { const y = DRILL.F[s.who.f]; w = ws.filter((w) => w.st === 'walk' && Math.abs(w.y - y) < 3 && Math.abs(w.x - DRILL.X(s.who.x)) < 6).sort((a, b) => a.id - b.id)[0]; }
          if (!w) continue;
          if (s.o) DRILL.order(s.o);
          if (DRILL.tap(w.id) || s.o === undefined) { s.done = true; log.push(t.toFixed(1) + ' ' + (s.o || 'release') + ' #' + w.id); }
        }
        if (sol.hold) {
          const ws = DRILL.walkers, bl = ws.find((w) => w.st === 'block');
          if (DRILL.state.reut && !bl) { const y = DRILL.F[sol.hold.f]; const w = ws.filter((w) => w.st === 'walk' && Math.abs(w.y - y) < 3 && Math.abs(w.x - DRILL.X(sol.hold.x)) < 60).sort((a, b) => Math.abs(a.x - DRILL.X(sol.hold.x)) - Math.abs(b.x - DRILL.X(sol.hold.x)))[0]; if (w) { DRILL.order('stop'); DRILL.tap(w.id); } }
          if (!DRILL.state.reut && bl && !DRILL.walkers.some((w) => w.st === 'walk' && Math.abs(w.y - DRILL.F[3]) < 3 && w.x > 0 && false)) DRILL.tap(bl.id);
        }
                DRILL.tick(0.1);
      }
      const st = DRILL.state;
      return { saved: st.saved, quota: st.quota, t: Math.round(st.timeLeft), log: log.join(' | '), why: DRILL.walkers.filter((w) => w.st === 'lost').map((w) => w.kind[0] + ':' + w.why).join(','), shaharLast: null };
    }, [sol, sol.hold]);
    await p.screenshot({ path: `${OUT}/levels-${i + 1}-end.png` });
    console.log(`L${i + 1} none: ${none.saved}/${none.quota} lost[${none.why}]  | solved: ${res.saved}/${res.quota} t=${res.t} ${res.saved >= res.quota ? 'PASS' : 'FAIL'} lost[${res.why}]\n     ${res.log}`);
  }
  if (errs.length) console.log('ERRORS', errs);
  await b.close();
})();
