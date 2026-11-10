// the promo recording, v15+: plays a level with its own 💡 solution (scripts/rosenblum-games/drill/tools/solutions.js)
// the way a player would - the finger taps the job's button, then the student - and catches every toilets runner.
// Filmed frame by frame on the browser's virtual clock (1080x1920, steady 30 fps) + a log of every sound.
// BUDGET = virtual ms per frame: the game runs ~3x under the virtual clock, (the game steps per frame, so BUDGET barely matters - keep the default)
//   BUDGET=17 FRAMES=frames-l3 node recordsol.js <seconds> <level>   -> frames-l3/f00000.jpg ..., frames-l3sounds.json, frames-l3events.json
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const SOL = require('../drill/tools/solutions.js');
const SECS = +(process.argv[2] || 30), LV = +(process.argv[3] || 3), FPS = 30;
const NAME = process.env.FRAMES || 'frames-l' + LV, OUT = path.join(__dirname, NAME);
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 8 / 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('shlomiverse:drill:tut', '1'); } catch (e) {} });
  await p.goto('http://localhost:5310/rosenblum-games/drill/?solo=1', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p);
  const shot = async (i) => { const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, clip: { x: 0, y: 0, width: 405, height: 720, scale: 8 / 3 } }); fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(r.data, 'base64')); };
  const advance = () => new Promise((res) => { cdp.once('Emulation.virtualTimeBudgetExpired', res); cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: +(process.env.BUDGET || 1000 / FPS) }); });
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
  await p.evaluate(([sol, hold]) => {
    const D = DRILL; window.__snd = []; window.__ev = [];
    const fin = document.createElement('div');
    fin.style.cssText = 'position:fixed;z-index:99;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:6px solid #fff;background:rgba(255,210,63,.55);box-shadow:0 0 0 3px rgba(27,42,74,.35);pointer-events:none;opacity:0';
    document.documentElement.appendChild(fin);
    let finT = 9, logN = 0, t0 = -1, armed = null, armT = 0;
    const todo = sol.map((s) => ({ ...s }));
    const show = (x, y) => { fin.style.left = x + 'px'; fin.style.top = y + 'px'; finT = 0; };
    const at = (w) => { const s = D.toScreen(w.x, w.y - 14); show(s.x, s.y); };
    const pick = (ws, who) => {
      if (who === 'first') return ws.filter((w) => w.st === 'walk').sort((a, b) => a.id - b.id)[0];
      if (who.first !== undefined) return ws.filter((w) => w.st === 'walk' && Math.abs(w.y - D.F[who.first]) < 3).sort((a, b) => a.id - b.id)[0];
      const y = D.F[who.f]; return ws.filter((w) => w.st === 'walk' && Math.abs(w.y - y) < 3 && Math.abs(w.x - D.X(who.x)) < 6).sort((a, b) => a.id - b.id)[0];
    };
    window.__bot = (t) => {
      const log = D.sndLog; while (logN < log.length) __snd.push([t, log[logN++]]);
      finT += 1 / 30; const k = Math.min(1, finT / 0.6); fin.style.opacity = finT < 0.6 ? String(1 - k * k) : '0'; fin.style.transform = `scale(${0.7 + k * 0.5})`;
      if (D.state.mode !== 'play' || D.state.over) return;
      if (t0 < 0) t0 = t;
      const ws = D.walkers;
      const run = ws.find((m) => m.mis === 'run' || m.mis === 'warn');
      if (run && finT > 0.4) { at(run); if (D.tap(run.id)) __ev.push([t, 'catch', run.id]); return; }
      if (hold) {   // Reut levels: hold the class while her column passes, release when it is gone
        const bl = ws.find((w) => w.st === 'block');
        if (D.state.reut && !bl && finT > 0.4) { const y = D.F[hold.f]; const w = ws.filter((w) => w.st === 'walk' && Math.abs(w.y - y) < 3 && Math.abs(w.x - D.X(hold.x)) < 60).sort((a, b) => Math.abs(a.x - D.X(hold.x)) - Math.abs(b.x - D.X(hold.x)))[0]; if (w) { at(w); D.order('stop'); D.tap(w.id); __ev.push([t, 'hold', w.id]); return; } }
        if (!D.state.reut && bl && finT > 0.4) { at(bl); D.tap(bl.id); __ev.push([t, 'release', bl.id]); return; }
      }
      const s = todo.find((s) => !s.done); if (!s || t - t0 < s.at) return;
      // the job's button is picked BEFORE its student arrives (the game is fast - a player waits armed, finger ready)
      if (armed !== s) { if (finT < 0.3) return; const btn = document.querySelector(`.ord[data-o="${s.o}"]`); if (btn) { const r = btn.getBoundingClientRect(); show(r.left + r.width / 2, r.top + r.height / 2); } D.order(s.o); armed = s; armT = t; __ev.push([t, 'pick', s.o]); return; }
      if (t - armT < 0.25) return;
      const w = pick(ws.filter((w) => ['walk', 'block'].includes(w.st)), s.who); if (!w) return;
      if (D.state.sel !== s.o) D.order(s.o);
      at(w); if (D.tap(w.id)) { s.done = true; __ev.push([t, s.o, w.id]); }
    };
  }, [SOL[LV] || [], (SOL.hold || {})[LV] || null]);
  const N0 = Math.round(0.3 * FPS);
  for (let i = 0; i < SECS * FPS; i++) {
    const t = i / FPS;
    if (i === N0) await p.evaluate((LV) => DRILL.start(LV), LV);
    await p.evaluate((t) => __bot(t), t);
    await advance(); await shot(i);
    if (i % 300 === 0) process.stdout.write(`${t.toFixed(0)}s `);
  }
  const res = await p.evaluate(() => ({ snd: __snd, ev: __ev, state: DRILL.state, shahar: (DRILL.walkers.find((w) => w.kind === 'shahar') || {}).st }));
  fs.writeFileSync(path.join(__dirname, NAME + 'sounds.json'), JSON.stringify(res.snd));
  fs.writeFileSync(path.join(__dirname, NAME + 'events.json'), JSON.stringify(res.ev));
  console.log('\n', JSON.stringify({ saved: res.state.saved, lost: res.state.lost, quota: res.state.quota, over: res.state.over, shahar: res.shahar, ev: res.ev.map((e) => e[0].toFixed(1) + ' ' + e[1]).join(', ') }), errs.length ? 'ERRORS ' + errs.join(' / ') : 'no errors');
  await b.close();
})();
