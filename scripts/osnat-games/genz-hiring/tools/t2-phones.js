// every phone size by touch: start, a busy floor (4 seated + lobby), the tutorial card, the end screen.
// asserts: nothing off screen, HUD text not clipped, stations + laugh on screen and not covering desks -> ../shots/
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), OUT = path.join(__dirname, '..', 'shots');
const URL = process.argv[2] || 'http://localhost:5310/osnat-games/not-a-cog/?solo=1';
const SIZES = [[320, 568], [360, 640], [390, 844], [412, 915], [768, 1024], [1280, 800], [844, 390]];
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let bad = 0;
  for (const [w, h] of SIZES) {
    const touch = w < 900 || h < 500;
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 900 });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(1200);
    const probs = [];
    const offscreen = (sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent || getComputedStyle(e).position === 'fixed').filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.top < -1 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1); }).map((e) => e.id || e.className || e.tagName), sel);
    const landscapePhone = w > h && h < 520;
    if (landscapePhone) { const turn = await p.evaluate(() => document.body.classList.contains('turn')); if (!turn) probs.push('landscape phone: no turn screen'); await p.screenshot({ path: `${OUT}/p${w}x${h}-turn.png` }); console.log(`${w}x${h}`, probs.join('; ') || 'turn screen ok'); bad += probs.length; await p.close(); continue; }
    probs.push(...(await offscreen('#start > *')).map((x) => 'start: ' + x));
    await p.screenshot({ path: `${OUT}/p${w}-start.png` });
    // busy floor on day 5 (all stations): four seated with 3 demands, two in the lobby
    await p.evaluate(() => { try { localStorage.setItem('shlomiverse:not-a-cog:tut', '1'); } catch (e) {} NOTACOG.startGame(); });
    await p.waitForTimeout(300);
    await p.evaluate(() => {
      const N = NOTACOG; for (let d = 2; d <= 5; d++) { /* jump to day 5 */ }
      window.__jump = true;
    });
    // play to day 5 quickly through the hook: finish days
    for (let k = 0; k < 4; k++) await p.evaluate(() => { const N = NOTACOG; N.cands.length = 0; N.desks.forEach((d) => d.c = null); while (N.hires < N.goal) { N.spawn({ p: { id: 'c1', f: true }, want: ['matcha'] }); const c = N.cands[N.cands.length - 1]; c.st = 'ready'; c.desk = N.desks[0]; N.desks[0].c = c; N.queueTask({ type: 'desk', desk: N.desks[0] }); N.osnat.x = N.desks[0].x + N.desks[0].w * .36; N.osnat.y = N.desks[0].y + N.desks[0].h * .5 + 6 * N.U; N.osnat.task = N.osnat.queue.shift(); N.osnat.queue.length = 0; window.__step && 0; break; } }).then(() => p.waitForTimeout(150));
    await p.evaluate(() => NOTACOG.forceDay(5));
    await p.waitForTimeout(3200);
    await p.evaluate(() => {
      const N = NOTACOG, P = ['c1', 'c2', 'c3', 'c4'];
      N.cands.length = 0; N.desks.forEach((d) => d.c = null);
      N.desks.forEach((d, i) => { N.spawn({ p: { id: P[i], f: i % 2 === 0 }, want: i === 3 ? ['matcha'] : ['charger', 'title', 'headphones'].slice(0, 3 - (i % 2)) }); const c = N.cands[N.cands.length - 1]; c.desk = d; d.c = c; c.x = d.x; c.y = d.y; c.st = i === 3 ? 'ready' : 'want'; c.bat = [0.9, 0.45, 0.15, 0.7][i]; c.thought = i === 1 ? 'רגע... היא מדברת אליי פיזית?' : ''; c.thoughtT = 9; });
      N.spawn({ p: { id: 'c5', f: true }, want: ['dog'] }); N.spawn({ p: { id: 'c6', f: false }, want: ['ring'] });
      N.cands.slice(-2).forEach((c) => { c.x = c.sx; c.y = c.sy; c.st = 'lobby'; });
      N.osnat.hands.push('matcha', 'dog'); N.freeze = true;
    });
    await p.waitForTimeout(400);
    probs.push(...(await offscreen('#hud, #hud > *, #bar, .st, #laughBtn, #strip')).map((x) => 'play: ' + x));
    const clip = await p.evaluate(() => [...document.querySelectorAll('#hud .box')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.id));
    if (clip.length) probs.push('HUD clipped: ' + clip.join(','));
    // pixel checks from the hook: bubbles inside the play area, not under the strip, laugh button not over a desk, lobby on screen
    const geo = await p.evaluate(() => {
      const N = NOTACOG, U = N.U, P = N.P, out = [];
      const strip = document.getElementById('strip').getBoundingClientRect(), lb = document.getElementById('laughBtn').getBoundingClientRect();
      N.desks.forEach((d, i) => {
        const bubbleTop = d.y + d.h * 0.3 - 172 * U - (46 + 16 + 13 + 12) * U;
        if (bubbleTop < strip.bottom - 2) out.push(`desk${i} bubble under the strip (${Math.round(bubbleTop)} < ${Math.round(strip.bottom)})`);
        if (d.x - d.w / 2 < 0 || d.x + d.w / 2 > innerWidth) out.push(`desk${i} off screen`);
        if (lb.right > d.x - d.w / 2 && lb.left < d.x + d.w / 2 && lb.bottom > d.y - d.h / 2 && lb.top < d.y + d.h / 2) out.push(`laugh button over desk${i}`);
      });
      N.cands.filter((c) => c.st === 'lobby').forEach((c, i) => { if (c.x + 40 * U > innerWidth || c.x - 40 * U < 0) out.push('lobby ' + i + ' off screen'); });
      return out;
    });
    probs.push(...geo);
    await p.screenshot({ path: `${OUT}/p${w}-play.png` });
    // the tutorial card: on screen, buttons reachable
    await p.evaluate(() => { document.getElementById('howBtn').click(); });
    await p.waitForTimeout(500);
    for (let i = 0; i < 3; i++) { probs.push(...(await offscreen('#tutCard, #tutNext')).map((x) => `tut${i + 1}: ` + x)); await p.click('#tutNext', { force: true }); await p.waitForTimeout(350); }
    await p.screenshot({ path: `${OUT}/p${w}-tut.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    // the end screen
    await p.evaluate(() => NOTACOG.endNow());
    await p.waitForTimeout(1500);
    probs.push(...(await offscreen('#over > *')).map((x) => 'over: ' + x));
    await p.screenshot({ path: `${OUT}/p${w}-over.png` });
    if (errs.length) probs.push('errors: ' + errs.join(' / '));
    console.log(`${w}x${h}`, probs.length ? 'PROBLEMS: ' + probs.join('; ') : 'ok');
    bad += probs.length; await p.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
