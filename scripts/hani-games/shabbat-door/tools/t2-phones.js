// phone sizes with touch: start screen fits, HUD / door light / controls on screen and apart, a sensor mistake on purpose
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/', BASE = process.env.BASE || 'http://localhost:5302/hani-games';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  for (const [name, vp] of [['se', { width: 320, height: 568 }], ['small', { width: 360, height: 640 }], ['iphone', { width: 390, height: 844 }], ['tall', { width: 412, height: 915 }], ['desk', { width: 1280, height: 800 }], ['land', { width: 844, height: 390 }]]) {
    const touch = name !== 'desk';
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => { localStorage.setItem('t-ignore', '1'); localStorage.setItem('hani-games:shabbat-door:tut', '1'); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + '/shabbat-door/?solo=1'); await sleep(1300);
    const startFit = await p.evaluate(() => [...document.querySelectorAll('#start > *')].every((e) => { const r = e.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1; }));
    await p.screenshot({ path: OUT + `p-${name}-start.png` });
    if (name === 'land') { console.log(name, 'turn notice:', await p.evaluate(() => document.body.classList.contains('turn'))); await ctx.close(); continue; }
    if (touch) await p.tap('#playBtn', { force: true }); else await p.click('#playBtn', { force: true });
    await sleep(1200);
    const lay = await p.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect();
      const hud = r('hud'), w = r('walkBtn'), f = r('fastBtn'), strip = r('strip'), st = r('stage');
      const gap = w.left - f.right;
      return { hudBottom: Math.round(hud.bottom), controlsAboveStrip: w.bottom <= strip.top && f.bottom <= strip.top, gap: Math.round(gap), walk: Math.round(w.width), fieldShare: Math.round(st.height / innerHeight * 100), over: document.documentElement.scrollWidth > innerWidth };
    });
    await sleep(1500); await p.screenshot({ path: OUT + `p-${name}-play.png` });
    // walk straight into the closed door on purpose: a mistake
    await p.evaluate(() => SHABBAT_DOOR.hold(true));
    let m = 0; for (let t = 0; t < 80 && !m; t++) { await sleep(100); m = await p.evaluate(() => SHABBAT_DOOR.mistakes); }
    await sleep(250); await p.screenshot({ path: OUT + `p-${name}-oops.png` }); await p.evaluate(() => SHABBAT_DOOR.hold(false));
    console.log(name, vp.width + 'x' + vp.height, JSON.stringify(lay), 'startFits', startFit, 'mistake', m, errs.length ? 'ERR ' + errs : '');
    await ctx.close();
  }
  await b.close();
})();
