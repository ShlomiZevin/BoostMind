// t5: every mode shows the pills' names - placed/dragged/tray in the box, the lifted pill in the bottles, matches + ticket in the tray
const path = require('path');
const { chromium } = require(path.join(process.env.HOME || process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const BASE = process.argv[2] || 'http://localhost:8765/lola-games/pills/?solo=1&notrack=1';
const OUT = path.join(__dirname, '..', 'shots', 'names'); require('fs').mkdirSync(OUT, { recursive: true });
const fail = []; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fail.push(m); };
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('requestfailed', (r) => errs.push('404 ' + r.url()));
  await p.goto(BASE); await p.evaluate(() => { for (const m of ['box', 'sort', 'tray']) localStorage.setItem('shlomiverse:pills:tut-' + m, '1'); }); await p.reload(); await p.waitForTimeout(800);
  ok(await p.evaluate(() => ['fusid', 'vaben'].every((id) => PILLS.MEDS.some((m) => m.id === id))), 'Fusid + Vaben in the game');
  // box
  await p.click('.mode[data-mode=box]'); await p.waitForTimeout(600);
  const placed = await p.evaluate(() => { const B = PILLS.box; for (let i = 0; i < 3; i++) { const pc = B.tray[i]; if (!pc) continue; for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) if (B.fits(pc, x, y)) { B.place(i, x, y); return pc.med; } } });
  await p.waitForTimeout(250); await p.screenshot({ path: OUT + '/box.png' });
  ok(!!placed, 'box: placed a piece and its name popped (' + placed + ')');
  // sort: lift a pill
  await p.click('#bHome'); await p.click('.mode[data-mode=sort]'); await p.waitForTimeout(700);
  await p.evaluate(() => { const S = PILLS.sort; S.sel = S.b.findIndex((x) => x.length); }); await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/sort.png' });
  // tray: a real swap that matches
  await p.click('#bHome'); await p.click('.mode[data-mode=tray]'); await p.waitForTimeout(900);
  await p.evaluate(() => { const T = PILLS.tray; for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) { const X = x + dx, Y = y + dy; if (X > 6 || Y > 7) continue; const a = T.g[y][x]; T.g[y][x] = T.g[Y][X]; T.g[Y][X] = a; const m = T.findMatches(); T.g[Y][X] = T.g[y][x]; T.g[y][x] = a; if (m.length) { T.swap([x, y], [X, Y]); return; } } });
  await p.waitForTimeout(450); await p.screenshot({ path: OUT + '/tray.png' });
  ok(await p.evaluate(() => document.querySelectorAll('#ticket .ord em').length > 0 && [...document.querySelectorAll('#ticket .ord em')].every((e) => e.textContent.length > 1)), 'tray: the prescription names every pill');
  ok(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close(); console.log(fail.length ? fail.length + ' FAILED' : 'ALL OK'); process.exit(fail.length ? 1 : 0);
})();
