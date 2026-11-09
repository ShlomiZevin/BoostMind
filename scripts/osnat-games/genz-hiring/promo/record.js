// the promo recording: the real game, played by a bot that taps like a player, filmed frame by frame on the browser's
// virtual clock (sharp 1080x1920, steady 30 fps) + a log of every sound it played (mixed back by mix.py)
//   node record.js [seconds] [day]   -> frames/f00000.jpg ..., sounds.json
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const SECS = +(process.argv[2] || 40), DAY = +(process.argv[3] || 0), FPS = 30;
const OUT = path.join(__dirname, process.env.FRAMES || 'frames'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:5310/osnat-games/not-a-cog/?solo=1';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 8 / 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('shlomiverse:not-a-cog:tut', '1'); } catch (e) {} });
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p);
  const shot = async (i) => { const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, clip: { x: 0, y: 0, width: 405, height: 720, scale: 8 / 3 } }); fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(r.data, 'base64')); };
  const advance = () => new Promise((res) => { cdp.once('Emulation.virtualTimeBudgetExpired', res); cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 1000 / FPS }); });
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
  // the bot + the finger + the sound log, inside the page
  await p.evaluate(([DAY, REACT]) => {
    const N = NOTACOG; window.__snd = []; window.__t = 0;
    const push = N.sndLog.push.bind(N.sndLog); N.sndLog.push = (n) => { __snd.push([__t, n]); return push(n); };
    const fin = document.createElement('div');
    fin.style.cssText = 'position:fixed;z-index:99;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:6px solid #fff;background:rgba(255,210,63,.55);box-shadow:0 0 0 3px rgba(27,42,74,.35);pointer-events:none;opacity:0';
    document.documentElement.appendChild(fin);
    let finT = 9;
    const tapAt = (x, y, el) => {
      fin.style.left = x + 'px'; fin.style.top = y + 'px'; finT = 0;
      const ev = { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true };
      (el || document.elementFromPoint(x, y) || document.getElementById('cv')).dispatchEvent(new PointerEvent('pointerdown', ev));
    };
    const cvL = () => document.getElementById('cv').getBoundingClientRect().left;
    let next = 0.6;
    window.__bot = (t) => {
      __t = t;
      finT += 1 / 30; const k = Math.min(1, finT / 0.6); fin.style.opacity = finT < 0.6 ? String(1 - k * k) : '0'; fin.style.transform = `scale(${0.7 + k * 0.5})`;
      if (N.state !== 'play' || t < next) return;
      next = t + (+REACT || (0.55 + Math.random() * 0.35));
      const o = N.osnat; if (o.queue.length + (o.task ? 1 : 0) > 1) return;
      const L = cvL(), U = N.U;
      const lob = N.cands.filter((c) => c.st === 'lobby' && !c.fetch), free = N.desks.filter((d) => !d.c && !d.res);
      const seated = N.desks.filter((d) => d.c && (d.c.st === 'want' || d.c.st === 'ready')).sort((a, b) => a.c.bat - b.c.bat);
      if (N.laughCool <= 0 && seated.filter((d) => d.c.bat < 0.3).length >= 2) { const lb = document.getElementById('laughBtn').getBoundingClientRect(); return tapAt(lb.left + lb.width / 2, lb.top + lb.height / 2, document.getElementById('laughBtn')); }
      const ready = seated.find((d) => d.c.st === 'ready');
      if (ready) return tapAt(L + ready.x, ready.y);
      const want = seated.find((d) => d.c.st === 'want');
      if (want) {
        const need = want.c.want.filter((w) => !want.c.got.includes(w));
        const carry = o.hands.concat(o.queue.filter((q) => q.type === 'pick').map((q) => q.id)).concat(o.task && o.task.type === 'pick' ? [o.task.id] : []);
        const missing = need.filter((n) => !carry.includes(n));
        if (missing.length && carry.length < 2) { const btn = document.querySelector(`.st[data-id="${missing[0]}"]`); if (btn) { const r = btn.getBoundingClientRect(); return tapAt(r.left + r.width / 2, r.top + r.height / 2, btn); } }
        if (need.some((n) => carry.includes(n))) return tapAt(L + want.x, want.y);
        if (carry.length >= 2 && !o.task) o.hands.length = 0;
      }
      if (lob.length && free.length) { const c = lob[0]; return tapAt(L + c.x, c.y - 60 * U); }
    };
    window.__start = () => { if (DAY) { N.startGame(); N.forceDay(DAY); } else N.startGame(); };
  }, [DAY, process.env.REACT || 0]);
  const N0 = Math.round(1.5 * FPS);   // the start screen first
  for (let i = 0; i < SECS * FPS; i++) {
    const t = i / FPS;
    if (i === N0) await p.evaluate((D) => { document.getElementById('playBtn').click(); if (D) NOTACOG.forceDay(D); }, DAY);
    await p.evaluate((t) => __bot(t), t);
    await advance(); await shot(i);
    if (i % 150 === 0) process.stdout.write(`${t.toFixed(0)}s `);
  }
  const res = await p.evaluate(() => ({ snd: __snd, day: NOTACOG.day, hires: NOTACOG.hires, ghosts: NOTACOG.ghosts, score: NOTACOG.score, state: NOTACOG.state }));
  fs.writeFileSync(path.join(__dirname, (process.env.FRAMES || '') + 'sounds.json'), JSON.stringify(res.snd));
  console.log('\n', JSON.stringify({ ...res, snd: res.snd.length }), errs.length ? 'ERRORS ' + errs.join(' / ') : 'no errors');
  await b.close();
})();
