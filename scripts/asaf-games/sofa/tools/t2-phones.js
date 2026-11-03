// phone sizes: the start screen, a round with Asaf up, and the end screen fit with nothing cut -> ../shots/
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), OUT = path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [w, h] of [[320, 568], [360, 640], [412, 915]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(process.argv[2] || 'http://localhost:5303/sofa/'); await p.waitForTimeout(1200);
    const over = await p.evaluate(() => { const s = document.getElementById('start'); return [...s.children].some((c) => { const r = c.getBoundingClientRect(); return r.top < 0 || r.bottom > innerHeight; }); });
    await p.screenshot({ path: `${OUT}/p${w}-start.png` });
    await p.evaluate(() => { try { localStorage.setItem('shlomiverse:sofa:tut', '1'); } catch (e) {} ; SOFA.startGame(); });
    await p.waitForTimeout(1500); await p.evaluate(() => { SOFA.spawn('asaf', SOFA.SPOTS[4], 9); SOFA.spawn('good', SOFA.SPOTS[8], 9); });
    await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/p${w}-play.png` });
    console.log(`${w}x${h}`, over ? 'START OVERFLOWS' : 'start fits', errs.length ? errs.join(' / ') : 'no errors');
    await p.close();
  }
  await b.close();
})();
