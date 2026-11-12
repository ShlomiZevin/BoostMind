// The three apps' online versus modes - two phones each, through the verse's lobby ("אונליין ←" on the app card -> play
// with a friend -> the code -> the invite link):
//   Meetly race: identical grids on both phones; both tap the target at once -> exactly ONE winner (server claim);
//                a wrong tap locks for 1.5 s; played to the end (first to 4); rematch -> round 2.
//   Teamz race:  identical boards; B's progress shows on A as "x/y"; A solves first -> A takes the board; to 3; then B's
//                phone drops -> A sees "left".
//   Zoomba duel: a merge to 6+ on A puts Daniel on B's board with the warning; 8+ = Itay; A's top meeting + score in
//                B's HUD; B's board locks -> B loses, A wins.
// Same setup as t4-online.js (emulators by default, LIVE=1 for the live site).
const L = require('./net-lib');
const { chromium, BASE, GAME, OUT, W, res, errs, ok, until, makePlayer, removePlayer, phone } = L;
const F = (ph, fn, arg) => ph.fr.evaluate(fn, arg);
const same = (x, y) => JSON.stringify(Object.entries(x).sort()) === JSON.stringify(Object.entries(y).sort());
const vs = (ph) => F(ph, () => ({ active: VS.active, over: VS.over, wins: VS.wins, me: VS.me, round: VerseNet.round, endShown: !document.getElementById('end').hidden, endTitle: document.getElementById('endTitle').textContent, hud: document.getElementById('clHud').textContent }));

async function pair(pa, pb, key, vpB) {
  const A = await phone(pa, `${BASE}/play/${GAME}?online=1`);
  await until(() => F(A, (k) => !document.querySelector(`[data-onl="${k}"]`).hidden, key), 10000);
  await A.fr.tap(`[data-onl="${key}"]`, { force: true });
  await until(() => A.p.evaluate(() => !!document.querySelector('.vn-sheet [data-vn-friend]')), 10000);
  await A.p.screenshot({ path: OUT + 'race-' + key + '-lobby.png' });
  await W(400);
  if (process.env.DEBUG) console.log('sheets', await A.p.evaluate(() => [...document.querySelectorAll('.vx-sheet')].map((e) => e.className + ' :: ' + e.innerText.slice(0, 80).split(String.fromCharCode(10)).join(' '))));
  await A.p.click('.vn-sheet [data-vn-friend]', { force: true, timeout: 8000 });
  const code = await until(() => A.p.evaluate(() => { const b = [...document.querySelectorAll('.vn-code b')]; return b.length === 4 ? b.map((x) => x.textContent).join('') : null; }), 15000);
  const B = await phone(pb, `${BASE}/play/${GAME}?room=${code}`, vpB);
  const go = await until(async () => { const a = await vs(A), b = await vs(B); return a.active === key && b.active === key ? { a, b } : null; }, 25000);
  ok(key + ': friend code -> both in the race', !!go ? { code } : false);
  if (!go) throw new Error(key + ' no start');
  await W(800);
  return { A, B };
}

(async () => {
  L.browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const pa = await makePlayer('דנה בדיקה'), pb = await makePlayer('יוסי בדיקה');
  try {
    let A, B;
    if (!process.env.SKIP_MEETLY) {
    // ================= Meetly race =================
    ({ A, B } = await pair(pa, pb, 'meetly'));
    const grid = (ph) => F(ph, () => MEET.mt.cells.map((c) => c.f + '|' + c.n).join(','));
    ok('meetly: the same grid on both phones', (await grid(A)) === (await grid(B)));
    // both tap the target at the same moment -> one winner
    const tgt = (ph) => F(ph, () => [...document.getElementById('mgrid').children].indexOf(MEET.mt.targetEl()));
    const ia = await tgt(A), ib = await tgt(B);
    await Promise.all([A.fr.tap(`#mgrid .mt[data-i="${ia}"]`, { force: true }), B.fr.tap(`#mgrid .mt[data-i="${ib}"]`, { force: true })]);
    const r1 = await until(async () => { const a = await vs(A), b = await vs(B); const s = (x) => Object.values(x.wins).reduce((p, q) => p + q, 0); return s(a) === 1 && s(b) === 1 ? { a, b } : null; }, 8000);
    ok('meetly: a simultaneous tap has exactly one winner, agreed by both', !!r1 && same(r1.a.wins, r1.b.wins) ? r1.a.wins : false);
    await A.p.screenshot({ path: OUT + 'race-meetly-a.png' });
    await W(1500);
    // a wrong tap locks for 1.5 s
    const wrongI = await F(B, () => MEET.mt.cells.findIndex((c) => !c.target));
    await B.fr.tap(`#mgrid .mt[data-i="${wrongI}"]`, { force: true });
    const locked = await F(B, () => document.getElementById('mgrid').classList.contains('locked') && VS.lock > Date.now());
    await W(1700);
    ok('meetly: wrong tap locks 1.5 s, then unlocks', locked && !(await F(B, () => document.getElementById('mgrid').classList.contains('locked'))));
    // play on, alternating who finds it, to the end
    for (let i = 0; i < 10; i++) {
      const a = await vs(A); if (a.over) break;
      const who = i % 3 === 2 ? B : A;
      const idx = await tgt(who);
      const before = Object.values(a.wins).reduce((p, q) => p + q, 0);
      await who.fr.tap(`#mgrid .mt[data-i="${idx}"]`, { force: true });
      await until(async () => { const x = await vs(A); return x.over || Object.values(x.wins).reduce((p, q) => p + q, 0) > before; }, 6000);
      await W(1500);
    }
    const mEnd = await until(async () => { const a = await vs(A), b = await vs(B); return a.endShown && b.endShown ? { a, b } : null; }, 8000);
    ok('meetly: played to the end (first to 4)', !!mEnd && Math.max(...Object.values(mEnd.a.wins)) === 4 && same(mEnd.a.wins, mEnd.b.wins) ? { wins: mEnd.a.wins, a: mEnd.a.endTitle, b: mEnd.b.endTitle } : false);
    await A.p.screenshot({ path: OUT + 'race-meetly-end.png' });
    await A.fr.tap('#bAgain', { force: true }); await W(500); await B.fr.tap('#bAgain', { force: true });
    const re = await until(async () => { const a = await vs(A), b = await vs(B); return a.round === 2 && b.round === 2 && !a.over && !b.over && !a.endShown ? true : null; }, 15000);
    ok('meetly: rematch -> round 2', !!re);
    await A.ctx.close(); await B.ctx.close();
    }

    // ================= Teamz race =================
    ({ A, B } = await pair(pa, pb, 'teamz', { width: 360, height: 640 }));
    const board = (ph) => F(ph, () => JSON.stringify(MEET.tz.pairs.map((p) => [p.a, p.b, p.face])));
    ok('teamz: the same board on both phones (different phone sizes)', (await board(A)) === (await board(B)));
    // B connects one pair -> A sees B's progress
    await F(B, () => { const t = MEET.tz; t.paths[0] = t.pairs[0].sol.slice(); t.up(); });
    const prog = await until(async () => { const a = await vs(A); return /1\/\d+/.test(a.hud) ? a.hud : null; }, 6000);
    ok('teamz: the opponent\'s progress shows live', !!prog ? prog : false);
    await A.p.screenshot({ path: OUT + 'race-teamz-a.png' });
    for (let lv = 0; lv < 3; lv++) {
      await F(A, () => { const t = MEET.tz; t.paths = t.pairs.map((p) => p.sol.slice()); t.check(); });
      await until(async () => { const a = await vs(A); return a.over || (a.wins[a.me] || 0) > lv; }, 6000);
      await W(1800);
    }
    const tEnd = await until(async () => { const a = await vs(A), b = await vs(B); return a.endShown && b.endShown ? { a, b } : null; }, 8000);
    ok('teamz: A wins 3 boards first', !!tEnd && tEnd.a.wins[tEnd.a.me] === 3 && /ניצחתם/.test(tEnd.a.endTitle) && /הפסדתם/.test(tEnd.b.endTitle) ? tEnd.a.wins : false);
    // rematch, then B drops mid-race
    await A.fr.tap('#bAgain', { force: true }); await W(500); await B.fr.tap('#bAgain', { force: true });
    await until(async () => { const a = await vs(A); return a.round === 2 && !a.over ? true : null; }, 15000);
    const t0 = Date.now(); await B.ctx.close();
    const left = await until(async () => { const a = await vs(A); return a.endShown && /כבר לא בפגישה/.test(a.endTitle) ? a : null; }, 40000, 500);
    ok('teamz: dropped player -> "left"', !!left ? { secs: Math.round((Date.now() - t0) / 1000) } : false);
    await A.ctx.close();

    // ================= Zoomba duel =================
    ({ A, B } = await pair(pa, pb, 'zoomba', { width: 320, height: 568 }));
    const d0 = await F(B, () => MEET.zb.tiles.filter((t) => t.kind === 'daniel').length);
    await F(A, () => { MEET.zb.best = 6; VS.zMoved([{ lv: 6 }]); });
    const got = await until(async () => { const d = await F(B, () => ({ n: MEET.zb.tiles.filter((t) => t.kind === 'daniel').length, flash: document.getElementById('flash').textContent, hud: document.getElementById('clHud').textContent })); return d.n > d0 ? d : null; }, 6000);
    ok('zoomba: a 6+ merge sends Daniel with the warning + the top meeting in the HUD', !!got && /שלח לך את דניאל/.test(got.flash) && (got.hud.includes(await F(A, () => MEET.ZL[6].he)) || /רמה 6/.test(got.hud)) ? got : false);
    await B.p.screenshot({ path: OUT + 'race-zoomba-b-320.png' });
    const i0 = await F(B, () => MEET.zb.tiles.filter((t) => t.kind === 'itay').length);
    await F(A, () => VS.zMoved([{ lv: 8 }]));
    ok('zoomba: 8+ sends Itay', !!(await until(async () => (await F(B, () => MEET.zb.tiles.filter((t) => t.kind === 'itay').length)) > i0, 6000)));
    await F(B, () => VS.zLost());
    const zEnd = await until(async () => { const a = await vs(A), b = await vs(B); return a.endShown && b.endShown ? { a, b } : null; }, 8000);
    ok('zoomba: the board that locks first loses', !!zEnd && /ניצחתם/.test(zEnd.a.endTitle) && /הפסדתם/.test(zEnd.b.endTitle) ? { a: zEnd.a.endTitle, b: zEnd.b.endTitle } : false);
    await A.p.screenshot({ path: OUT + 'race-zoomba-end.png' });
    // a clean leave from the end screen's menu
    await A.ctx.close(); await B.ctx.close();
  } catch (e) { console.log('ERROR', e.message); res.error = e.message; }
  finally {
    await removePlayer(pa); await removePlayer(pb);
    console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
    await L.browser.close();
  }
})();
