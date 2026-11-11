// t2: every screen on 4 upright phones + a landscape - nothing overflows, every button is on screen and tappable.
const path = require('path');
const { chromium } = require(path.join(process.env.HOME || process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const BASE = process.argv[2] || 'http://localhost:8765/lola-games/pills/?solo=1';
const OUT = path.join(__dirname, '..', 'shots', 'phones'); require('fs').mkdirSync(OUT, { recursive: true });
const SIZES = [[320, 568], [360, 640], [390, 844], [412, 915], [844, 390]];
const fail = []; const ok = (c, m) => { if (!c) { fail.push(m); console.log('FAIL', m); } };

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  for (const [w, h] of SIZES) {
    const tag = w + 'x' + h;
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await p.goto(BASE); await p.evaluate(() => { for (const m of ['box', 'sort', 'tray']) localStorage.setItem('shlomiverse:pills:tut-' + m, '1'); }); await p.reload(); await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/${tag}-start.png` });
    if (w > h) { ok(await p.isVisible('#rotate'), tag + ' landscape phone asks to turn'); await p.close(); continue; }
    // every visible button inside the viewport and the top element at its centre
    const check = async (sel, name) => {
      const r = await p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { r: [r.left, r.top, r.right, r.bottom], hit: !!top && (top === e || e.contains(top)) }; }), sel);
      for (const x of r) { ok(x.r[0] >= -1 && x.r[1] >= -1 && x.r[2] <= w + 1 && x.r[3] <= h + 1, `${tag} ${name} on screen ${x.r.map(Math.round)}`); ok(x.hit, `${tag} ${name} tappable`); }
    };
    await check('.mode', 'mode card'); await check('.mode .how', '? button'); await check('#bSound', 'sound');
    for (const mode of ['box', 'sort', 'tray']) {
      await p.click(`.mode[data-mode=${mode}]`); await p.waitForTimeout(700);
      if (mode === 'sort') await p.evaluate(() => { PILLS.sort.level = 8; PILLS.sort.load(); });
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${OUT}/${tag}-${mode}.png` });
      await check('#hud .pb', mode + ' hud button');
      const g = await p.evaluate((mode) => {
        const st = document.querySelector('#stage').getBoundingClientRect(), M = PILLS[mode];
        let rect;
        if (mode === 'box') rect = [M.bx - 10, M.by - M.hh - 10, M.bx + M.cell * 7 + 10, M.trayY + M.trayH];
        if (mode === 'sort') { const xs = M.pos.map((q) => q.x), ys = M.pos.map((q) => q.y); rect = [Math.min(...xs), Math.min(...ys) - M.bh * .2, Math.max(...xs) + M.bw, Math.max(...ys) + M.bh * 1.05]; }
        if (mode === 'tray') rect = [M.x0 - 12, M.y0 - 12, M.x0 + M.c * 7 + 12, M.y0 + M.c * 8 + 12];
        return { st: [st.width, st.height], rect,  minBtn: mode === 'box' ? M.cell : mode === 'sort' ? M.bw : M.c, doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
      }, mode);
      ok(g.rect[0] >= -1 && g.rect[1] >= -1 && g.rect[2] <= g.st[0] + 1 && g.rect[3] <= g.st[1] + 1, `${tag} ${mode} play area inside the stage ${g.rect.map(Math.round)} / ${g.st.map(Math.round)}`);
      ok(g.st[1] - g.rect[3] < 70 || g.rect[2] - g.rect[0] > g.st[0] - 70, `${tag} ${mode} play area fills the width or reaches the bottom (${Math.round(g.st[1] - g.rect[3])}px left)`);
      // the bulb in the bubble: on screen, tappable, and it brings the hand
      await p.waitForTimeout(2800);
      await check('#bHint', mode + ' bulb');
      await p.click('#bHint'); await p.waitForTimeout(900);
      ok(await p.evaluate(() => !!PILLS.hint.h), `${tag} ${mode} bulb shows the hand`);
      ok(g.minBtn >= (mode === 'box' ? 26 : 30), `${tag} ${mode} cells big enough to tap (${Math.round(g.minBtn)})`);
      ok(g.doc[0] <= w + 1 && g.doc[1] <= h + 1, `${tag} ${mode} no page scroll ${g.doc}`);
      await p.click('#bHome'); await p.waitForTimeout(300);
    }
    await p.close();
  }
  await b.close();
  console.log(fail.length ? fail.length + ' FAILED' : 'ALL OK');
  process.exit(fail.length ? 1 : 0);
})();
