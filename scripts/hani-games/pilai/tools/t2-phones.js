// phone test: several phone sizes, real touch taps (tap, not click), checks nothing overflows the screen or hides under Hani's strip
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  for (const [name, vp] of [['se', { width: 320, height: 568 }], ['small', { width: 360, height: 640 }], ['iphone', { width: 390, height: 844 }], ['tall', { width: 412, height: 915 }], ['land', { width: 844, height: 390 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto((process.env.BASE || 'http://localhost:5301') + '/pilai/'); await p.waitForTimeout(1200);
    await p.evaluate(() => localStorage.setItem('hani-games:pilai:tut', '1'));
    await p.tap('#playBtn', { force: true }); await p.waitForTimeout(900);
    const bad = await p.evaluate(() => {
      const strip = document.getElementById('strip').getBoundingClientRect().top, hud = document.getElementById('hud').getBoundingClientRect().bottom, out = [];
      for (const el of document.querySelectorAll('#chain .card, #chain .slot, #hand .card, #ask')) { const r = el.getBoundingClientRect(); if (r.bottom > strip + 1 || r.top < hud - 1 || r.left < -1 || r.right > innerWidth + 1) out.push((el.className || el.id) + ' ' + Math.round(r.top) + '-' + Math.round(r.bottom)); }
      return out;
    });
    await p.screenshot({ path: OUT + 'm-' + name + '.png' });
    // play one story by real taps
    for (let k = 0; k < 3; k++) { const sel = await p.evaluate(() => { const want = PILAI.placed + 1; const c = [...document.querySelectorAll('#hand .card')].findIndex((e) => +e.dataset.i === want); return c + 1; }); await p.tap(`#hand .card:nth-child(${sel})`); await p.waitForTimeout(700); }
    await p.waitForTimeout(900);
    const nb = await p.evaluate(() => { const n = document.getElementById('nextBtn'), r = n.getBoundingClientRect(); return !n.hidden && r.bottom <= document.getElementById('strip').getBoundingClientRect().top; });
    await p.screenshot({ path: OUT + 'm-' + name + '-done.png' });
    await p.tap('#nextBtn'); await p.waitForTimeout(500);
    const si = await p.evaluate(() => PILAI.si);
    console.log(name, vp.width + 'x' + vp.height, '| overflow:', bad.length ? bad.join(', ') : 'none', '| next button visible:', nb, '| story 2:', si === 1, errs.length ? 'ERR ' + errs.join('/') : '');
    await ctx.close();
  }
  await b.close();
})();
