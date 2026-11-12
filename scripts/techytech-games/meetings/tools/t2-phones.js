// phone sizes with touch: each app opens, nothing overflows, the board is the biggest thing on screen
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/';
const BASE = (process.env.BASE || 'http://localhost:5321') + '/techytech-games/meetings/?solo=1';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  for (const [name, vp] of [['se', { width: 320, height: 568 }], ['small', { width: 360, height: 640 }], ['iphone', { width: 390, height: 844 }], ['tall', { width: 412, height: 915 }], ['desk', { width: 1280, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: name !== 'desk', isMobile: name !== 'desk' }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE); await p.waitForTimeout(900);
    await p.evaluate(() => ['zoomba', 'meetly', 'teamz'].forEach((m) => localStorage.setItem('shlomiverse:meetings:tut-' + m, '1')));
    const hubBad = await p.evaluate(() => [...document.querySelectorAll('.app, #foot .chip, #logoT')].filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.top < -1; }).length);
    await p.screenshot({ path: OUT + 'p-' + name + '-hub.png' });
    const out = [];
    for (const m of ['zoomba', 'meetly', 'teamz']) {
      if (name === 'desk') await p.click('.app[data-mode=' + m + ']'); else await p.tap('.app[data-mode=' + m + ']');
      await p.waitForTimeout(700);
      const r = await p.evaluate((m) => {
        const el = m === 'zoomba' ? document.getElementById('zb') : m === 'meetly' ? document.getElementById('mgrid') : null;
        let bx; if (el) { const q = el.getBoundingClientRect(); bx = { w: q.width, h: q.height, top: q.top, bottom: q.bottom, left: q.left, right: q.right }; }
        else { const c = document.getElementById('cv').getBoundingClientRect(), t = MEET.tz; bx = { w: t.cell * t.C, h: t.cell * t.R, top: c.top + t.oy, bottom: c.top + t.oy + t.cell * t.R, left: c.left + t.ox, right: c.left + t.ox + t.cell * t.C }; }
        if (m === 'meetly') { const tiles = [...document.querySelectorAll('.mt')].map((e) => e.getBoundingClientRect()); bx.bottom = Math.max(...tiles.map((t) => t.bottom)); bx.top = Math.min(...tiles.map((t) => t.top)); bx.h = bx.bottom - bx.top; }
        const st = document.getElementById('strip').getBoundingClientRect().top, hud = document.getElementById('hud').getBoundingClientRect().bottom;
        const body = document.body.getBoundingClientRect();
        return { share: Math.round(bx.w * bx.h / (body.width * innerHeight) * 100), over: bx.bottom > st + 1 || bx.top < hud - 1 || bx.left < body.left - 1 || bx.right > body.right + 1 };
      }, m);
      out.push(m + ' ' + r.share + '%' + (r.over ? ' OVERFLOW' : ''));
      await p.screenshot({ path: OUT + 'p-' + name + '-' + m + '.png' });
      await p.click('#bHome'); await p.waitForTimeout(300);
    }
    console.log(name, vp.width + 'x' + vp.height, '| hub off-screen:', hubBad, '|', out.join(' | '), errs.length ? 'ERR ' + errs.join('/') : '');
    await ctx.close();
  }
  await b.close();
})();
