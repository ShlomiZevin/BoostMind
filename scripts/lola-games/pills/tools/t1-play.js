// t1: play every mode as a phone, by touch - the tutorial with real drags/taps, then real rounds through the hook.
//   node t1-play.js [baseUrl]   (python -m http.server 8765 in public/)
const path = require('path');
const { chromium } = require(path.join(process.env.HOME || process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const BASE = process.argv[2] || 'http://localhost:8765/lola-games/pills/?solo=1';
const OUT = path.join(__dirname, '..', 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
const fail = []; const ok = (c, m) => { if (!c) { fail.push(m); console.log('FAIL', m); } else console.log('ok  ', m); };

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('response', (r) => r.status() >= 400 && !/hero\.jpg|title\.png|favicon/.test(r.url()) && errs.push(r.status() + ' ' + r.url()));
  await p.goto(BASE); await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '/01-start.png' });
  const cvBox = async () => p.locator('#cv').boundingBox();
  const drag = async (x0, y0, x1, y1) => { const c = await cvBox(); await p.mouse.move(c.x + x0, c.y + y0); await p.mouse.down(); for (let i = 1; i <= 12; i++) await p.mouse.move(c.x + x0 + (x1 - x0) * i / 12, c.y + y0 + (y1 - y0) * i / 12); await p.mouse.up(); };
  const tap = async (x, y) => { const c = await cvBox(); await p.mouse.click(c.x + x, c.y + y); };
  const next = async (n) => { for (let i = 0; i < n; i++) { await p.click('#tutNext'); await p.waitForTimeout(320); } };
  const step = () => p.evaluate(() => PILLS.G.tut && PILLS.G.tut.i);

  // ---- box tutorial ----
  await p.click('.mode[data-mode=box]'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/02-box-tut.png' });
  await next(5); ok(await step() === 5, 'box tutorial reaches the try step');
  await p.screenshot({ path: OUT + '/03-box-try.png' });
  // drag the capsule so its left cell lands on column 3 of the last row
  const t = await p.evaluate(() => { const b = PILLS.box, r = b.pieceRect(0), pc = b.tray[0]; return { r, cell: b.cell, bx: b.bx, by: b.by, R: 8, w: pc.w, h: pc.h }; });
  const tx = t.bx + 3 * t.cell + t.w * t.cell / 2, ty = t.by + 7 * t.cell + t.cell / 2; // where the piece centre must be
  await drag(t.r.x + t.r.w / 2, t.r.y + t.r.h / 2, tx, ty + t.cell * 1.6);
  await p.waitForTimeout(1300);
  ok(await step() === 6, 'box: the capsule closed the row (step ' + await step() + ')');
  await next(3); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !PILLS.G.tut && PILLS.G.mode === 'box'), 'box: real game started after tutorial');
  await p.waitForTimeout(6200); await p.screenshot({ path: OUT + '/03b-box-hint.png' });
  { const r = await p.evaluate(() => PILLS.box.pieceRect(0) || PILLS.box.pieceRect(1)); const c = await cvBox(); await p.mouse.move(c.x + r.x + r.w / 2, c.y + r.y + r.h / 2); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(c.x + r.x + r.w / 2 - i * 8, c.y + r.y + r.h / 2 - i * 30); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '/03c-box-drag.png' }); await p.mouse.up(); await p.waitForTimeout(400); }
  // play a real round with a greedy bot
  const placed = await p.evaluate(async () => {
    const b = PILLS.box; let n = 0;
    for (let k = 0; k < 400 && !PILLS.G.over; k++) {
      while (PILLS.G.busy && !PILLS.G.over) await new Promise((r) => setTimeout(r, 30));
      if (PILLS.G.over) break;
      let best = null;
      b.tray.forEach((pc, i) => { if (!pc) return; for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) if (b.fits(pc, x, y)) { const w = b.wouldClear(pc, x, y); const sc = (w.rows.length + w.cols.length) * 100 + y * 2 + Math.random(); if (!best || sc > best.sc) best = { i, x, y, sc }; } });
      if (!best) break; b.place(best.i, best.x, best.y); n++;
      await new Promise((r) => setTimeout(r, 15));
    }
    return n;
  });
  await p.waitForTimeout(400); await p.screenshot({ path: OUT + '/04-box-play.png' });
  await p.waitForTimeout(1500);
  const sc = await p.evaluate(() => PILLS.G.score);
  ok(placed > 15 && sc > 0, 'box: bot placed ' + placed + ' pieces, score ' + sc);
  ok(await p.isVisible('#end'), 'box: end screen after the box jams');
  await p.screenshot({ path: OUT + '/05-box-end.png' });
  await p.click('#bMenu'); await p.waitForTimeout(300);

  // ---- sort tutorial ----
  await p.click('.mode[data-mode=sort]'); await p.waitForTimeout(500);
  await next(4); ok(await step() === 4, 'sort tutorial reaches try step');
  const pos = await p.evaluate(() => ({ pos: PILLS.sort.pos, bw: PILLS.sort.bw, bh: PILLS.sort.bh }));
  const bt = (i) => tap(pos.pos[i].x + pos.bw / 2, pos.pos[i].y + pos.bh / 2);
  await bt(0); await p.waitForTimeout(150); await bt(2); await p.waitForTimeout(1200);
  ok(await step() === 5, 'sort: a move to an empty bottle counted');
  await p.screenshot({ path: OUT + '/06-sort-tut.png' });
  // solve: [w,a,w] [a,w,a,w] [a] [] -> a solution by taps
  const solve = [[1, 3], [1, 2], [0, 3], [0, 2], [1, 3], [1, 2], [0, 3]];
  for (const [a, c] of solve) { await bt(a); await p.waitForTimeout(120); await bt(c); await p.waitForTimeout(400); }
  await p.waitForTimeout(1300);
  const st = await p.evaluate(() => ({ b: PILLS.sort.b, i: PILLS.G.tut && PILLS.G.tut.i }));
  ok(st.i === 6, 'sort: tutorial solved by taps ' + JSON.stringify(st));
  await next(2); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/07-sort-level1.png' });
  // every level of the day is solvable (levels 1..10)
  const lv = await p.evaluate(() => { const r = []; for (let l = 1; l <= 10; l++) { const t0 = performance.now(); const b = PILLS.sortLevel(l, Math.random); r.push([l, !!b, b ? b.length : 0, Math.round(performance.now() - t0)]); } return r; });
  ok(lv.every((x) => x[1]), 'sort: levels 1-10 generate solvable ' + JSON.stringify(lv));
  await p.evaluate(() => { PILLS.sort.level = 8; PILLS.sort.load(); }); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/08-sort-level8.png' });
  await p.evaluate(() => { const s = PILLS.sort; s.sel = 2; }); await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/08b-sort-sel.png' });
  await p.click('#bHome'); await p.waitForTimeout(300);

  // ---- tray tutorial ----
  await p.click('.mode[data-mode=tray]'); await p.waitForTimeout(500);
  await next(3); ok(await step() === 3, 'tray tutorial reaches try step');
  await p.screenshot({ path: OUT + '/09-tray-try.png' });
  const tr = await p.evaluate(() => ({ x0: PILLS.tray.x0, y0: PILLS.tray.y0, c: PILLS.tray.c }));
  await drag(tr.x0 + 4.5 * tr.c, tr.y0 + 4.5 * tr.c, tr.x0 + 4.5 * tr.c, tr.y0 + 5.5 * tr.c);
  await p.waitForTimeout(1500);
  ok(await step() === 4, 'tray: the swipe made a match (step ' + await step() + ')');
  await next(3); await p.waitForTimeout(600);
  ok(await p.evaluate(() => !PILLS.G.tut && PILLS.G.mode === 'tray'), 'tray: real game started');
  // bot: random valid swaps until win or out of moves
  const tres = await p.evaluate(async () => {
    const t = PILLS.tray; let swaps = 0;
    for (let k = 0; k < 60 && !PILLS.G.over && t.level === 1; k++) {
      while ((t.busy || PILLS.G.busy) && !PILLS.G.over) await new Promise((r) => setTimeout(r, 30));
      if (PILLS.G.over || t.level > 1) break;
      const mv = []; for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) { const X = x + dx, Y = y + dy; if (X >= 7 || Y >= 8) continue; const a = t.g[y][x]; t.g[y][x] = t.g[Y][X]; t.g[Y][X] = a; const m = t.findMatches(); const good = m.some((g) => g.cells.some(([cx, cy]) => t.order.some((o) => o.id === t.g[cy][cx].m && o.n > 0))); if (m.length) mv.push({ a: [x, y], b: [X, Y], good }); t.g[Y][X] = t.g[y][x]; t.g[y][x] = a; }
      const g = mv.filter((m) => m.good), m = (g.length ? g : mv)[Math.floor(Math.random() * (g.length || mv.length))];
      if (!m) break; await t.swap(m.a, m.b); swaps++;
    }
    await new Promise((r) => setTimeout(r, 2200));
    return { swaps, level: t.level, over: PILLS.G.over, score: PILLS.G.score, order: t.order };
  });
  ok(tres.swaps >= 1 && (tres.level > 1 || tres.over), 'tray: bot played to a result ' + JSON.stringify(tres));
  await p.screenshot({ path: OUT + '/10-tray-play.png' });
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log(fail.length ? fail.length + ' FAILED' : 'ALL OK');
  process.exit(fail.length ? 1 : 0);
})();
