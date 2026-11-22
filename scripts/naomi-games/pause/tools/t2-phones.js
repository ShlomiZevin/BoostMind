// phones: start / tutorial card / play / end report at 4 upright phones, a landscape phone, desktop and inside the verse frame
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', 'shots', 'phones'); fs.mkdirSync(OUT, { recursive: true });
const SIZES = [['320x568', 320, 568, 1], ['360x640', 360, 640, 1], ['390x844', 390, 844, 1], ['412x915', 412, 915, 1], ['land', 844, 390, 1], ['desk', 1280, 800, 0], ['frame', 390, 380, 1]];
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const bad = [];
  for (const [name, w, h, touch] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, screen: name === 'frame' ? { width: 390, height: 844 } : { width: w, height: h }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
    await ctx.addInitScript((inVerse) => { try { localStorage.setItem('t-ignore', '1'); localStorage.setItem('shlomiverse:pause:tut', '1'); } catch (e) {} if (inVerse) document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('in-verse')); }, name === 'frame');
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:5311/naomi-games/pause/'); await p.waitForTimeout(1500);
    const check = async (screen) => {
      const r = await p.evaluate((screen) => {
        const out = [], vw = innerWidth, vh = innerHeight;
        if (document.documentElement.scrollWidth > vw + 1 || document.documentElement.scrollHeight > vh + 1) out.push('page scrolls');
        const scr = screen ? document.getElementById(screen) : document;
        scr.querySelectorAll('button, a').forEach((el) => {
          const s = getComputedStyle(el); if (s.display === 'none' || el.offsetParent === null) return;
          const q = el.getBoundingClientRect(); if (!q.width) return;
          if (q.left < -1 || q.right > vw + 1 || q.top < -1 || q.bottom > vh + 1) out.push('off screen: ' + (el.id || el.textContent.trim().slice(0, 14)));
          if (q.height < 40) out.push('small: ' + (el.id || el.textContent.trim().slice(0, 14)) + ' ' + Math.round(q.height));
        });
        const pn = scr.querySelector && scr.querySelector('.panel'); if (pn) { const q = pn.getBoundingClientRect(); if (q.top < -1 || q.bottom > vh + 1) out.push('panel cut ' + Math.round(q.top) + '..' + Math.round(q.bottom)); }
        return out;
      }, screen);
      if (r.length) bad.push(name + ' ' + (screen || 'play') + ': ' + r.join(', '));
    };
    await p.screenshot({ path: `${OUT}/${name}-start.png` }); await check('start');
    if (name === 'land') { await ctx.close(); continue; }
    // play, fast-forwarded into day 3 with a slicing bot, then frozen for the shot
    await p.evaluate(() => { PAUSE.manual = true; PAUSE.start(); for (let i = 0; i < 60 * 33; i++) { PAUSE.tick(1 / 60); for (const c of PAUSE.G.cards) if (c.state === 'fly' && c.type === 'harm' && c.y < PAUSE.L.line + 90) PAUSE.slice(c.id); } });
    await p.waitForTimeout(100); await p.screenshot({ path: `${OUT}/${name}-play.png` }); await check(null);
    const fieldShare = await p.evaluate(() => { const L = PAUSE.L; return ((L.stripT - L.line) / innerHeight); });
    if (fieldShare < .5) bad.push(name + ': play field only ' + Math.round(fieldShare * 100) + '% of the height');
    await p.evaluate(() => { for (let i = 0; i < 60 * 120 && PAUSE.G.mode === 'play'; i++) { PAUSE.tick(1 / 60); for (const c of PAUSE.G.cards) if (c.state === 'fly' && (c.type === 'harm' || c.type === 'nu') && c.y < PAUSE.L.line + 90) PAUSE.slice(c.id); } PAUSE.manual = false; });
    await p.waitForTimeout(1400); await p.screenshot({ path: `${OUT}/${name}-over.png` }); await check('over');
    // the tutorial card
    await p.evaluate(() => { localStorage.removeItem('shlomiverse:pause:tut'); PAUSE.menu(); }); await p.click('#howBtn', { force: true }); await p.waitForTimeout(500);
    await p.keyboard.press('Space'); await p.keyboard.press('Space'); await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/${name}-tut3.png` });
    const tc = await p.evaluate(() => { const q = document.getElementById('tutCard').getBoundingClientRect(); return [q.top, q.bottom, innerHeight]; });
    if (tc[0] < 0 || tc[1] > tc[2]) bad.push(name + ': tutorial card cut');
    if (errs.length) bad.push(name + ' errors: ' + errs.join(' / '));
    await ctx.close();
  }
  console.log(bad.length ? bad.join('\n') : 'all clean');
  await b.close();
})();
