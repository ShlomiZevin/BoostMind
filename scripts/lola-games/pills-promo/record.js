// the promo recording: one mode of the pills game played by a bot that drags / taps / swipes like a player (a finger
// ring shows each touch), filmed frame by frame on the browser's virtual clock (1080x1920, steady 30 fps) + a log of
// every sound the game played (which buffer of PILLS.audio.buf).
//   (python -m http.server 8765 in public/)   FRAMES=frames-box node record.js box 20 [sortLevel]
//   -> <FRAMES>/f00000.jpg ..., <FRAMES>sounds.json, <FRAMES>events.json
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const MODE = process.argv[2] || 'box', SECS = +(process.argv[3] || 20), LEVEL = +(process.argv[4] || 1), FPS = 30;
const NAME = process.env.FRAMES || 'frames-' + MODE, OUT = path.join(__dirname, NAME);
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 8 / 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    try { for (const m of ['box', 'sort', 'tray']) localStorage.setItem('shlomiverse:pills:tut-' + m, '1'); } catch (e) {}
    window.__snd = []; window.__t = 0;
    const st = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) {
      try { const B = window.PILLS && PILLS.audio.buf; if (B) for (const [n, l] of Object.entries(B)) { const i = l.indexOf(this.buffer); if (i >= 0) { __snd.push([__t, n, i]); break; } } } catch (e) {}
      return st.apply(this, a);
    };
  });
  await p.goto('http://localhost:8765/lola-games/pills/?solo=1&notrack=1', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(p);
  const shot = async (i) => { const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, clip: { x: 0, y: 0, width: 405, height: 720, scale: 8 / 3 } }); fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(r.data, 'base64')); };
  const advance = () => new Promise((res) => { cdp.once('Emulation.virtualTimeBudgetExpired', res); cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 1000 / FPS }); });
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
  await p.evaluate(([MODE, LEVEL]) => {
    const P = PILLS, cv = document.querySelector('canvas'); window.__ev = [];
    const fin = document.createElement('div');
    fin.style.cssText = 'position:fixed;z-index:99;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;border:6px solid #fff;background:rgba(255,210,63,.55);box-shadow:0 0 0 3px rgba(60,20,90,.35);pointer-events:none;opacity:0';
    document.documentElement.appendChild(fin);
    let finT = 9, held = false, job = null, wait = 0, plan = null, started = false;
    const C = () => cv.getBoundingClientRect();
    const show = (x, y) => { const r = C(); fin.style.left = r.left + x + 'px'; fin.style.top = r.top + y + 'px'; finT = 0; };
    // a job = a list of [frames, fn] steps, run one per frame
    const run = () => { if (!job) return false; const s = job[0]; s[1](s.k = (s.k || 0)); if (++s.k >= s[0]) job.shift(); if (!job.length) job = null; return true; };
    const lerp = (a, b, u) => a + (b - a) * u, ease = (u) => u * u * (3 - 2 * u);
    function boxMove() {
      const B = P.box; let best = null;
      for (let i = 0; i < 3; i++) { const pc = B.tray[i]; if (!pc) continue;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) if (B.fits(pc, x, y)) {
          const w = B.wouldClear(pc, x, y), sc = (w.rows.length + w.cols.length) * 100 + y * 3 + pc.cells.length * 2 - Math.abs(x - 3) * .2 + Math.random() * 2;
          if (!best || sc > best.sc) best = { i, x, y, sc, pc };
        } }
      if (!best) return null;
      const c = B.cell, pc = best.pc, r = B.pieceRect(best.i), x0 = r.x + r.w / 2, y0 = r.y + r.h / 2;
      const dx = B.bx + best.x * c + pc.w * c / 2, dy = B.by + best.y * c + pc.h * c / 2, x1 = dx, y1 = dy + c * 1.6 + pc.h * c / 2 - c / 2;
      const N = 16;
      return [[1, () => { B.down(x0, y0); show(x0, y0); held = true; __ev.push([__t, 'pick', pc.med]); }],
        [N, (k) => { const u = ease((k + 1) / N); const X = lerp(x0, x1, u), Y = lerp(y0, y1, u); B.move(X, Y); show(X, Y); }],
        [3, (k) => { B.move(x1, y1); show(x1, y1); }],
        [1, () => { B.up(); held = false; __ev.push([__t, 'place', pc.med]); }], [10, () => {}]];
    }
    function sortPlan() {   // the solver, with the path (the game's sortSolvable only says yes/no)
      const S = P.sort, CAP = 4, start = S.b.map((x) => x.slice());
      const done = (s) => s.every((b) => !b.length || (b.length === CAP && b.every((x) => x === b[0])));
      const key = (s) => s.map((b) => b.join(',')).join('|'); const seen = new Set();
      const stack = [[start, []]];
      while (stack.length) {
        const [s, path] = stack.pop(); if (done(s)) return path;
        const k = key(s); if (seen.has(k)) continue; seen.add(k);
        const opts = [];
        for (let i = 0; i < s.length; i++) { const a = s[i]; if (!a.length) continue; const top = a[a.length - 1];
          if (a.length === CAP && a.every((x) => x === top)) continue;
          for (let j = 0; j < s.length; j++) { if (i === j) continue; const b = s[j];
            if (b.length >= CAP || (b.length && b[b.length - 1] !== top)) continue;
            if (!b.length && a.every((x) => x === top)) continue;
            const t = s.map((x) => x.slice()); t[j].push(t[i].pop());
            opts.push([(b.length ? 10 : 0) + (b.length && b.every((x) => x === top) ? 5 : 0), t, [i, j]]); } }
        opts.sort((a, b) => a[0] - b[0]); for (const [, t, m] of opts) stack.push([t, [...path, m]]);
      }
      return [];
    }
    function sortMove() {
      const S = P.sort; if (!plan || !plan.length) plan = sortPlan(); const m = plan.shift(); if (!m) return null;
      const at = (i) => [S.pos[i].x + S.bw / 2, S.pos[i].y + S.bh * .45];
      const [ax, ay] = at(m[0]), [bx, by] = at(m[1]);
      return [[1, () => { S.down(ax, ay); show(ax, ay); }], [9, () => {}], [1, () => { S.down(bx, by); show(bx, by); __ev.push([__t, 'move', m.join('>')]); }], [9, () => {}]];
    }
    function trayMove() {
      const T = P.tray, ord = T.order.filter((o) => o.n > 0).map((o) => o.id); let best = null;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) { const X = x + dx, Y = y + dy; if (X > 6 || Y > 7) continue;
        const a = T.g[y][x]; T.g[y][x] = T.g[Y][X]; T.g[Y][X] = a; const ms = T.findMatches(); T.g[Y][X] = T.g[y][x]; T.g[y][x] = a;
        if (!ms.length) continue;
        const flat = ms.flat ? JSON.stringify(ms) : ''; const sc = ms.length * 10 + ord.reduce((s, id) => s + (flat.split('"' + id + '"').length - 1) * 8, 0) + y + Math.random() * 3;
        if (!best || sc > best.sc) best = { x, y, X, Y, sc }; }
      if (!best) return null;
      const c = T.c, cx = (x) => T.x0 + x * c + c / 2, cy = (y) => T.y0 + y * c + c / 2;
      const x0 = cx(best.x), y0 = cy(best.y), x1 = cx(best.X), y1 = cy(best.Y);
      return [[1, () => { T.down(x0, y0); show(x0, y0); }], [6, (k) => { const u = (k + 1) / 6; const X = lerp(x0, x1, u), Y = lerp(y0, y1, u); T.move(X, Y); show(X, Y); }],
        [1, () => { T.up(); __ev.push([__t, 'swap', best.x + ',' + best.y]); }], [6, () => {}]];
    }
    window.__start = () => { P.startMode(MODE); if (MODE === 'sort' && LEVEL > 1) { P.sort.level = LEVEL; P.sort.load(); } if (MODE === 'tray' && LEVEL > 1) { P.tray.level = LEVEL; P.tray.load(); } started = true; };
    window.__bot = (t) => {
      __t = t;
      finT += 1 / 30; const k = Math.min(1, finT / 0.5); fin.style.opacity = held ? '1' : finT < 0.5 ? String(1 - k * k) : '0'; fin.style.transform = `scale(${held ? 0.85 : 0.7 + k * 0.5})`;
      if (started) { P.G.lastInput = 1e15; P.hint.h = null; P.hint.forced = false; }   // a player is touching: no idle hint hand
      if (!started || P.G.over) return;
      if (run()) return;
      if (wait > 0) { wait--; return; }
      if (P.G.busy || (P.tray.busy && MODE === 'tray') || (MODE === 'sort' && P.sort.fly)) return;
      job = MODE === 'box' ? boxMove() : MODE === 'sort' ? sortMove() : trayMove();
      if (MODE === 'sort' && !job) plan = null;
    };
  }, [MODE, LEVEL]);
  const N0 = Math.round(0.4 * FPS);
  for (let i = 0; i < SECS * FPS; i++) {
    const t = i / FPS;
    if (i === N0) await p.evaluate(() => __start());
    await p.evaluate((t) => __bot(t), t);
    await advance(); await shot(i);
    if (i % 300 === 0) process.stdout.write(`${t.toFixed(0)}s `);
  }
  const res = await p.evaluate(() => ({ snd: __snd, ev: __ev, score: PILLS.G.score, over: PILLS.G.over }));
  fs.writeFileSync(path.join(__dirname, NAME + 'sounds.json'), JSON.stringify(res.snd));
  fs.writeFileSync(path.join(__dirname, NAME + 'events.json'), JSON.stringify(res.ev));
  console.log('\n', JSON.stringify({ score: res.score, over: res.over, snd: res.snd.length, ev: res.ev.slice(0, 40).map((e) => e[0].toFixed(1) + ' ' + e[1] + ' ' + e[2]).join(', ') }), errs.length ? 'ERRORS ' + errs.join(' / ') : 'no errors');
  await b.close();
})();
