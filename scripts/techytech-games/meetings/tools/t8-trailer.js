// Trailer footage for "online play is here": REAL online matches on the live site between two phones named שירה and
// עומר (temporary players, removed at the end), recorded with Playwright at 780x1688 (a 390x844 phone at 2x), the game in
// the verse's full screen. Each scene is cut out of the page video with ffmpeg by its time marks -> one mp4 per clip:
//   invite.mp4        the friend-code sheet (4 letters + "הזמינו"), then the friend joining and the match starting
//   zoomba-duel.mp4   a real merge to level 6 on שירה's board sends Daniel onto עומר's board, with the warning (עומר's view)
//   zoomba-sender.mp4 the same moment from שירה's side
//   meetly-race.mp4   both tap the target, שירה is first
//   teamz-race.mp4    שירה draws the lines and takes the board
//   callio.mp4        a flip and a pair
//   win.mp4           the win screen ("ניצחתם!")
//   LIVE=1 node t8-trailer.js [out dir]
const L = require('./net-lib');
const { chromium, BASE, GAME, W, until, makePlayer, removePlayer, phone } = L;
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const OUTDIR = process.argv[2] || 'C:/workspace/BoostMind/scripts/techytech-games/online-trailer/vid';
fs.mkdirSync(OUTDIR, { recursive: true });
const F = (ph, fn, arg) => ph.fr.evaluate(fn, arg);
// Playwright's recordVideo ignores the 2x density (a 390x844 picture in a 780x1688 canvas), so the frames come from the
// browser's own screencast at device pixels (780x1688), each with its time; a clip = the frames between two marks
const REC = {};
async function rec(ph) {
  ph.frames = []; ph.cdp = await ph.ctx.newCDPSession(ph.p);
  ph.cdp.on('Page.screencastFrame', (f) => { ph.frames.push({ t: f.metadata.timestamp * 1000, buf: Buffer.from(f.data, 'base64') }); ph.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await ph.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
}
const marks = [];   // { name, ph, a, b } in epoch ms
const mark = () => Date.now();
// every picture the game shows, loaded before the camera rolls (no tile filling in on camera)
const PICS = [...Array(24)].map((_, i) => 'crowd-' + String(i + 1).padStart(2, '0')).concat([1, 2, 3, 4, 5, 6, 7, 8].map((i) => 'crowd-0' + i + '-talk'),
  ['amir', 'ofer', 'ronit', 'gilad', 'itay', 'yaniv', 'daniel', 'daniel-hand', 'daniel-try', 'itay-leave', 'yaniv-mouse', 'asleep', 'noone', 'amir-talk', 'ofer-talk', 'ronit-talk', 'gilad-talk', 'yotam', 'osnat', 'tzvika', 'vova', 'erez', 'ido', 'lior', 'rami', 'yoav', 'camoff']);
const preload = (ph) => ph.fr.evaluate((pics) => Promise.all(pics.map((n) => new Promise((ok) => { const i = new Image(); i.onload = i.onerror = ok; i.src = 'assets/' + n + '.webp'; }))), PICS);

async function full(ph) {   // the verse's full screen: the game fills the phone
  await ph.p.click('[data-full]', { force: true }).catch(() => {});
  await W(700);
}
async function pairUp(pa, pb, key, label) {
  const A = await phone(pa, `${BASE}/play/${GAME}`, undefined, REC), B = await phone(pb, `${BASE}/play/${GAME}`, undefined, REC);
  await full(A); await full(B);
  await Promise.all([preload(A), preload(B)]); await Promise.all([rec(A), rec(B)]);
  const r = await F(A, ([k, lb]) => VerseNet.host(k, lb), [key, label]);
  await W(1600);
  return { A, B, code: r.code };
}
async function joinB(B, code, A, key) {
  await F(B, (c) => VerseNet.join(c), code);
  await until(async () => (await F(A, (k) => VS.active === k || (k === 'callio' && CALLIO.phase === 'play'), key)) && (await F(B, (k) => VS.active === k || (k === 'callio' && CALLIO.phase === 'play'), key)), 20000);
}
async function close(...phs) { for (const ph of phs) { await ph.cdp.send('Page.stopScreencast').catch(() => {}); await ph.ctx.close(); } }

(async () => {
  L.browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const pa = await makePlayer('שירה'), pb = await makePlayer('עומר');
  const out = [];
  try {
    // ---------- invite + Meetly race + win ----------
    let { A, B, code } = await pairUp(pa, pb, 'meetly', { title: 'Meetly אונליין' });
    // the invite: open the friend sheet the way a player does (the lobby -> "שחקו עם חבר") so the sheet is on screen
    let a0 = mark();
    await W(2200);   // the code + "הזמינו" on screen
    await F(B, (c) => VerseNet.join(c), code);
    await until(() => F(A, () => VS.active === 'meetly'), 20000);
    await W(1800);
    marks.push({ name: 'invite', ph: A, a: a0 - 300, b: mark() });
    // Meetly: both tap the target, שירה a moment first
    await W(800);
    const tgt = (ph) => F(ph, () => [...document.getElementById('mgrid').children].indexOf(MEET.mt.targetEl()));
    a0 = mark();
    await W(900);
    const ia = await tgt(A), ib = await tgt(B);
    await A.fr.tap(`#mgrid .mt[data-i="${ia}"]`, { force: true }); await W(120); await B.fr.tap(`#mgrid .mt[data-i="${ib}"]`, { force: true });
    await W(1900);
    marks.push({ name: 'meetly-race', ph: A, a: a0, b: mark() });
    // play on to the end so שירה wins (4 rounds) -> the win screen
    for (let i = 0; i < 8; i++) {
      const s = await F(A, () => ({ over: VS.over })); if (s.over) break;
      await W(400);
      const idx = await tgt(A);
      await A.fr.tap(`#mgrid .mt[data-i="${idx}"]`, { force: true });
      await W(1700);
    }
    await until(() => F(A, () => !document.getElementById('end').hidden), 8000);
    const w0 = mark(); await W(3000);
    marks.push({ name: 'win', ph: A, a: w0 - 200, b: mark() });
    await close(A, B);

    // ---------- Teamz race ----------
    ({ A, B, code } = await pairUp(pa, pb, 'teamz', { title: 'Teamz אונליין' }));
    await joinB(B, code, A, 'teamz'); await W(1500);
    const g = await F(A, () => { const r = document.getElementById('cv').getBoundingClientRect(), t = MEET.tz; return { x: r.left + t.ox, y: r.top + t.oy, c: t.cell, sols: t.pairs.map((p) => p.sol) }; });
    const fr = A.p.frames().find((f) => f === A.fr) && A.fr;
    const box = await A.p.evaluate(() => { const r = document.querySelector('.vg-game iframe').getBoundingClientRect(); return { x: r.left, y: r.top }; });
    // most of the board is already connected; שירה draws the last three lines on camera and takes it
    const keep = g.sols.length - 3;
    await F(A, (n) => { const t = MEET.tz; for (let i = 0; i < n; i++) t.paths[i] = t.pairs[i].sol.slice(); t.up(); }, keep);
    await F(B, () => { const t = MEET.tz; t.paths[0] = t.pairs[0].sol.slice(); t.paths[1] = t.pairs[1].sol.slice(); t.up(); });
    await W(900);
    const t0 = mark();
    await W(500);
    for (const sol of g.sols.slice(keep)) {
      const at = (q) => [box.x + g.x + (q[0] + .5) * g.c, box.y + g.y + (q[1] + .5) * g.c];
      await A.p.mouse.move(...at(sol[0])); await A.p.mouse.down();
      for (const q of sol.slice(1)) await A.p.mouse.move(...at(q), { steps: 4 });
      await A.p.mouse.up(); await W(250);
    }
    await W(1700);
    marks.push({ name: 'teamz-race', ph: A, a: t0, b: mark() });
    await close(A, B);

    // ---------- Zoomba duel ----------
    ({ A, B, code } = await pairUp(pa, pb, 'zoomba', { title: 'Zoomba אונליין' }));
    await joinB(B, code, A, 'zoomba'); await W(1200);
    // שירה's board: two "תמונת מצב" (level 5) meetings side by side + a few small ones; one real swipe merges them into level 6
    await F(A, () => { const z = MEET.zb; [...z.tiles].forEach((t) => z.remove(t)); z.add(3, 2, 5); z.add(3, 3, 5); z.add(0, 0, 1); z.add(0, 2, 2); z.add(1, 0, 3); z.add(1, 1, 1); z.add(1, 3, 4); z.add(2, 0, 2); z.add(2, 2, 3); z.add(3, 0, 4); z.best = 5; MEET.G.score = 412; document.querySelector('#score span').textContent = 412; VS.hud(); });
    await F(B, () => { const z = MEET.zb; [...z.tiles].forEach((t) => z.remove(t)); z.add(0, 1, 2); z.add(0, 3, 1); z.add(1, 2, 3); z.add(2, 0, 1); z.add(2, 3, 4); z.add(3, 1, 2); z.add(3, 2, 5); z.best = 5; MEET.G.score = 356; VS.hud(); });
    await W(900);
    const s0 = mark(), r0 = mark();
    await W(700);
    await F(A, () => MEET.zb.move('R'));
    await W(2600);
    marks.push({ name: 'zoomba-sender', ph: A, a: s0, b: mark() });
    marks.push({ name: 'zoomba-duel', ph: B, a: r0, b: mark() });
    await close(A, B);

    // ---------- Callio ----------
    ({ A, B, code } = await pairUp(pa, pb, 'callio', null));
    await joinB(B, code, A, 'callio'); await W(1500);
    const host = (await F(A, () => CALLIO.m.host)) ? A : B;
    const deck = await F(host, () => CALLIO.deck);
    const mover = (await F(A, () => VerseNet.myTurn())) ? A : B;
    const c0 = mark();
    await W(700);
    const a1 = 5, b1 = deck.findIndex((f, i) => i !== a1 && f === deck[a1]);
    await mover.fr.tap(`#clBoard .cc[data-i="${a1}"]`, { force: true }); await W(700);
    await mover.fr.tap(`#clBoard .cc[data-i="${b1}"]`, { force: true }); await W(2200);
    marks.push({ name: 'callio', ph: mover, a: c0, b: mark() });
    await close(A, B);
  } catch (e) { console.log('ERROR', e.message); }
  finally {
    await removePlayer(pa); await removePlayer(pb);
    await L.browser.close();
  }
  // each clip: its screencast frames between the marks, each held for its real time, as a 30 fps mp4
  const os = require('os');
  for (const m of marks) {
    const fr = (m.ph.frames || []).filter((f) => f.t >= m.a - 40 && f.t <= m.b);
    if (fr.length < 5) { console.log('few frames for', m.name, fr.length); continue; }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-')), list = [];
    const nm = (k) => path.join(dir, String(k).padStart(5, '0') + '.jpg').split(path.sep).join('/');
    fr.forEach((f, k) => { fs.writeFileSync(nm(k), f.buf); const d = ((fr[k + 1] ? fr[k + 1].t : m.b) - f.t) / 1000; list.push(`file '${nm(k)}'`, `duration ${Math.max(0.001, d).toFixed(4)}`); });
    list.push(`file '${nm(fr.length - 1)}'`);
    fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n'));
    const o = path.join(OUTDIR, m.name + '.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'scale=780:1688:force_original_aspect_ratio=decrease,pad=780:1688:(ow-iw)/2:(oh-ih)/2', '-r', '30', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', o]);
    fs.rmSync(dir, { recursive: true, force: true });
    out.push(o + '  (' + fr.length + ' frames)');
  }
  console.log(out.join('\n'));
  console.log(L.errs.length ? 'page errors: ' + L.errs.join(' | ') : 'no page errors');
})();
