// the promo recording: the real game (level 2, "בירידה אין שירותים") played by a bot that taps like a player, filmed
// frame by frame on the browser's virtual clock (1080x1920, steady 30 fps) + a log of every sound it played
//   node record.js [seconds] [level]   -> frames/f00000.jpg ..., framessounds.json
// the plan (checked with sim.js): pick עצור! and tap the lead pair before the toilets, tap every troublemaker,
// the column turns and goes down; Shahar comes in last
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const SECS = +(process.argv[2] || 70), LV = +(process.argv[3] || 1), FPS = 30;
const NAME = process.env.FRAMES || 'frames', OUT = path.join(__dirname, NAME);
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
  const advance = () => new Promise((res) => { cdp.once('Emulation.virtualTimeBudgetExpired', res); cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 1000 / FPS }); });
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
  await p.evaluate(() => {
    const D = DRILL; window.__snd = []; window.__t = 0; window.__ev = [];
    const fin = document.createElement('div');
    fin.style.cssText = 'position:fixed;z-index:99;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:6px solid #fff;background:rgba(255,210,63,.55);box-shadow:0 0 0 3px rgba(27,42,74,.35);pointer-events:none;opacity:0';
    document.documentElement.appendChild(fin);
    let finT = 9, blocked = null, armedAt = 0, logN = 0;
    const show = (x, y) => { fin.style.left = x + 'px'; fin.style.top = y + 'px'; finT = 0; };
    const tapW = (w) => { const s = D.toScreen(w.x, w.y - 14); show(s.x, s.y); return D.tap(w.id); };
    window.__bot = (t) => {
      __t = t;
      const log = D.sndLog; while (logN < log.length) { const e = log[logN++]; __snd.push([t, typeof e === 'string' ? e : (e.name || e.n || e[0])]); }
      finT += 1 / 30; const k = Math.min(1, finT / 0.6); fin.style.opacity = finT < 0.6 ? String(1 - k * k) : '0'; fin.style.transform = `scale(${0.7 + k * 0.5})`;
      if (D.state.mode !== 'play' || D.state.over) return;
      const ws = D.walkers;
      const mis = ws.find((w) => w.mis && (w.st === 'walk' || w.st === 'dash'));
      if (mis && finT > 0.35) { if (tapW(mis)) __ev.push([t, 'mis', mis.id]); return; }
      if (blocked === null) {
        const lead = ws.find((w) => w.kind === 'pair' && w.st === 'walk' && w.y > 150 && w.y < 260 && w.d === 1 && w.x > 200);
        if (lead && !armedAt) { const btn = document.querySelector('.ord[data-o="stop"]'); const r = btn.getBoundingClientRect(); show(r.left + r.width / 2, r.top + r.height / 2); D.order('stop'); armedAt = t; __ev.push([t, 'pick-stop']); return; }
        if (lead && lead.x > 270 && t - armedAt > 0.5) { if (tapW(lead)) { blocked = lead.id; __ev.push([t, 'stop', lead.id]); } }
      }
    };
  });
  const N0 = Math.round(0.5 * FPS);
  for (let i = 0; i < SECS * FPS; i++) {
    const t = i / FPS;
    if (i === N0) await p.evaluate((LV) => DRILL.start(LV), LV);
    await p.evaluate((t) => __bot(t), t);
    await advance(); await shot(i);
    if (i % 300 === 0) process.stdout.write(`${t.toFixed(0)}s `);
  }
  const res = await p.evaluate(() => ({ snd: __snd, ev: __ev, state: DRILL.state, shahar: DRILL.walkers.find((w) => w.kind === 'shahar'), raw: DRILL.sndLog.slice(0, 3) }));
  fs.writeFileSync(path.join(__dirname, NAME + 'sounds.json'), JSON.stringify(res.snd));
  fs.writeFileSync(path.join(__dirname, NAME + 'events.json'), JSON.stringify(res.ev));
  console.log('\n', JSON.stringify({ state: res.state, shahar: res.shahar && res.shahar.st, snd: res.snd.length, raw: res.raw, ev: res.ev }), errs.length ? 'ERRORS ' + errs.join(' / ') : 'no errors');
  await b.close();
})();
