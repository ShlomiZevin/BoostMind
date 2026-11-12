// real solo gameplay of the meetings game for the trailer, one recording per app (Playwright video, 780x1688), a finger
// ring on every touch. Writes solo/<app>.webm + solo/marks.json (when the play starts in each video, seconds).
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'solo'); const W = (p, ms) => p.waitForTimeout(ms);
const URL = 'https://shlomiverse.com/techytech-games/meetings/?solo=1&notrack=1';
const RING = () => { const f = document.createElement('div'); f.style.cssText = 'position:fixed;z-index:99999;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:5px solid #fff;background:rgba(255,210,63,.55);box-shadow:0 0 0 3px rgba(40,20,90,.35);pointer-events:none;opacity:0;transition:opacity .25s';
  document.documentElement.appendChild(f); let up;
  const mv = (e) => { f.style.left = e.clientX + 'px'; f.style.top = e.clientY + 'px'; };
  addEventListener('pointerdown', (e) => { mv(e); f.style.opacity = 1; clearTimeout(up); }, true); addEventListener('pointermove', mv, true);
  addEventListener('pointerup', () => { up = setTimeout(() => f.style.opacity = 0, 150); }, true); };
async function drawPath(p, cells) {
  const g = await p.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return { x: r.left + MEET.tz.ox, y: r.top + MEET.tz.oy, c: MEET.tz.cell }; });
  const at = (q) => [g.x + (q[0] + .5) * g.c, g.y + (q[1] + .5) * g.c];
  await p.mouse.move(...at(cells[0])); await p.mouse.down();
  for (const q of cells.slice(1)) await p.mouse.move(...at(q), { steps: 6 });
  await p.mouse.up();
}
const marks = {};
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const app of ['zoomba', 'meetly', 'teamz']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, recordVideo: { dir: OUT + '/' + app, size: { width: 780, height: 1688 } } });
    await ctx.addInitScript(() => { try { for (const m of ['zoomba', 'meetly', 'teamz', 'callio']) localStorage.setItem('shlomiverse:meetings:tut-' + m, '1'); } catch (e) {} });
    await ctx.addInitScript(RING);
    const p = await ctx.newPage(); const t0 = Date.now();
    await p.goto(URL); await W(p, 2500);
    const sec = () => (Date.now() - t0) / 1000;
    marks[app + '_hub'] = sec();
    const ar = await p.evaluate((a) => { const r = document.querySelector(`.app[data-mode=${a}]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, app);
    await p.mouse.move(ar[0], ar[1]); await W(p, 300); await p.mouse.down(); await W(p, 120); await p.mouse.up(); await W(p, 700);
    for (let i = 0; i < 15; i++) { if (!(await p.evaluate(() => MEET.G.tut))) break; await p.keyboard.press('Space'); await W(p, 250); }
    await W(p, 500); marks[app] = sec();
    if (app === 'zoomba') {
      const zb = await p.evaluate(() => { const r = document.getElementById('zb').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
      const sw = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
      for (let i = 0; i < 40; i++) {
        if (await p.evaluate(() => MEET.G.over)) break;
        const d = await p.evaluate(() => { for (const d of 'DLRU') { const s = JSON.stringify(MEET.zb.tiles.map((t) => [t.x, t.y, t.v])); if (MEET.zb.canMove ? MEET.zb.canMove(d) : true) return d; } return 'D'; });
        const [dx, dy] = sw[d]; const L = zb[2] * .3;
        await p.mouse.move(zb[0] - dx * L / 2, zb[1] - dy * L / 2); await p.mouse.down(); await p.mouse.move(zb[0] + dx * L / 2, zb[1] + dy * L / 2, { steps: 5 }); await p.mouse.up();
        await W(p, 380);
      }
    } else if (app === 'meetly') {
      for (let i = 0; i < 9; i++) {
        const t = await p.evaluate(() => { const r = MEET.mt.targetEl().getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
        await W(p, 700); await p.mouse.move(t[0], t[1], { steps: 8 }); await p.mouse.down(); await W(p, 100); await p.mouse.up(); await W(p, 900);
      }
    } else {
      for (let lv = 0; lv < 3; lv++) {
        const sols = await p.evaluate(() => MEET.tz.pairs.map((x) => x.sol));
        for (const s of sols) { await drawPath(p, s); await W(p, 250); }
        await W(p, 1800);
      }
    }
    marks[app + '_end'] = sec();
    await ctx.close();
  }
  fs.writeFileSync(OUT + '/marks.json', JSON.stringify(marks, null, 1)); console.log(marks);
  await b.close();
})();
