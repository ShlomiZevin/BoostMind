// Every online screen at 320x568, 390x844, 412x915 and desktop (1280x800), inside the verse's frame AND in full screen:
// the hub, the lobby chooser, the friend code sheet, the quick waiting sheet, Callio's menu / board / end, and each race's
// board + HUD. Writes shots/os-<size>-<screen>.png and a measure line per screen (board share, overflow) - READ them.
const L = require('./net-lib');
const { chromium, BASE, GAME, OUT, W, until, makePlayer, removePlayer, phone } = L;
const F = (ph, fn, arg) => ph.fr.evaluate(fn, arg);
const SIZES = (process.env.SIZES || '320x568,390x844,412x915,1280x800').split(',').map((s) => { const [w, h] = s.split('x').map(Number); return { width: w, height: h }; });
const measure = (ph, id) => F(ph, (id) => {
  const el = document.getElementById(id); if (!el || el.hidden) return null;
  const items = id === 'mgrid' ? [...el.children] : [el]; const rs = items.map((e) => e.getBoundingClientRect());
  const b = { top: Math.min(...rs.map((r) => r.top)), bottom: Math.max(...rs.map((r) => r.bottom)), left: Math.min(...rs.map((r) => r.left)), right: Math.max(...rs.map((r) => r.right)) };
  const hud = document.getElementById('hud').getBoundingClientRect(), strip = document.getElementById('strip').getBoundingClientRect(), body = document.body.getBoundingClientRect();
  const hudOver = [...document.querySelectorAll('#hud > *, #hudMid > *:not([hidden]), #clHud > *')].some((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > hud.right + 1 || r.left < hud.left - 1); });
  return { share: Math.round((b.right - b.left) * (b.bottom - b.top) / (body.width * innerHeight) * 100), overlap: b.top < hud.bottom - 1 || b.bottom > strip.top + 1, hudOverflow: hudOver };
}, id);
(async () => {
  L.browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  const pa = await makePlayer('דנה בדיקה'), pb = await makePlayer('יוסי בדיקה');
  try {
    for (const vp of SIZES) {
      const tag = vp.width + 'x' + vp.height, shot = (ph, n) => ph.p.screenshot({ path: OUT + 'os-' + tag + '-' + n + '.png' });
      const A = await phone(pa, `${BASE}/play/${GAME}?online=1`, vp), B = await phone(pb, `${BASE}/play/${GAME}?online=1`);
      await W(800); await shot(A, 'hub');
      // lobby chooser (Meetly's "אונליין")
      await A.fr.tap('[data-onl="meetly"]', { force: true }); await until(() => A.p.evaluate(() => !!document.querySelector('.vn-sheet.open')), 8000); await W(500);
      await shot(A, 'lobby'); await A.p.click('.vn-sheet [data-vn-x]', { force: true }); await W(800);
      // Callio menu, friend code, board, end
      await A.fr.tap('#appCallio .go', { force: true }); await W(600); await shot(A, 'callio-menu');
      await A.fr.tap('#clFriend', { force: true });
      const code = await until(() => A.p.evaluate(() => { const b = [...document.querySelectorAll('.vn-code b')]; return b.length === 4 ? b.map((x) => x.textContent).join('') : null; }), 10000);
      await W(500); await shot(A, 'friend-code');
      await F(B, (c) => VerseNet.join(c), code);
      await until(() => F(A, () => CALLIO.phase === 'play'), 15000); await W(900);
      await shot(A, 'callio-board'); console.log(tag, 'callio', JSON.stringify(await measure(A, 'clBoard')));
      // flip two on whoever's turn to show faces
      const who = (await F(A, () => VerseNet.myTurn())) ? A : B;
      await who.fr.tap('#clBoard .cc[data-i="0"]', { force: true }); await W(350); await who.fr.tap('#clBoard .cc[data-i="1"]', { force: true }); await W(500);
      await shot(A, 'callio-flip');
      await F(B, () => document.getElementById('bHome').click()); await until(() => F(A, () => !document.getElementById('end').hidden), 10000); await W(600);
      await shot(A, 'callio-left');
      await F(A, () => document.getElementById('bMenu').click()); await W(600);
      // quick waiting
      await F(A, () => document.getElementById('clQuick').click()); await until(() => A.p.evaluate(() => !!document.querySelector('.vn-sheet.open')), 8000); await W(600);
      await shot(A, 'quick-wait'); await A.p.click('.vn-sheet [data-vn-x]', { force: true }); await W(800);
      await F(A, () => document.getElementById('bHome').click()); await W(500);
      // the races
      for (const [key, id] of [['meetly', 'mgrid'], ['teamz', 'cv'], ['zoomba', 'zb']]) {
        const r = await F(A, (k) => VerseNet.host(k, vsLabel(k)), key);
        await W(600);
        if (key === 'meetly') await shot(A, 'race-code');
        await F(B, (c) => VerseNet.join(c), r.code);
        const ok = await until(async () => (await F(A, (k) => VS.active === k && !document.getElementById('play').hidden, key)) && (await F(B, (k) => VS.active === k && MEET.G.mode === k, key)), 15000);
        if (!ok) console.log('NO START', key, JSON.stringify(await F(A, () => ({ vs: VS.active, mode: MEET.G.mode, room: VerseNet.room }))), JSON.stringify(await F(B, () => ({ vs: VS.active, mode: MEET.G.mode, room: VerseNet.room }))), JSON.stringify(r));
        await W(1200);
        if (key === 'teamz') await F(B, () => { const t = MEET.tz; t.paths[0] = t.pairs[0].sol.slice(); t.up(); });
        if (key === 'zoomba') await F(B, () => { MEET.zb.best = 7; VS.zMoved([{ lv: 7 }]); });
        await W(900);
        await shot(A, 'race-' + key);
        console.log(tag, key, ok ? 'started' : 'NO START', JSON.stringify(await measure(A, id === 'cv' ? 'cv' : id)));
        if (key === 'zoomba') {   // B's board locks: both end cards
          await F(B, () => VS.zLost()); await until(() => F(A, () => !document.getElementById('end').hidden), 8000); await W(900);
          await shot(A, 'race-end-win'); await shot(B, 'race-end-lose');
        }
        await F(A, () => { document.getElementById('end').hidden = true; document.getElementById('bHome').click(); }); await W(1200);
        if (key !== 'zoomba') { await until(() => F(B, () => !document.getElementById('end').hidden), 8000); await W(700); await shot(B, 'race-left-' + key); }
        await F(B, () => { document.getElementById('end').hidden = true; document.getElementById('bHome').click(); }); await W(500);
      }
      // full screen (the verse's own): Callio's board under the pill
      await A.ctx.close(); await B.ctx.close();
    }
  } catch (e) { console.log('ERROR', e.message); }
  finally { console.log(L.errs.length ? 'page errors: ' + L.errs.join(' | ') : 'no page errors'); await removePlayer(pa); await removePlayer(pb); await L.browser.close(); }
})();
