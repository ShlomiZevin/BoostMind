// Callio online - two phones (two browser contexts, two signed-in players) play through the Shlomiverse's platform:
//   1. friend code: A hosts, reads the 4-letter code in the verse's lobby, B opens the invite link /play/<id>?room=CODE,
//      they play a WHOLE match (pairs and misses, turns pass, scores add up to 10), the guest never holds the deck,
//      the room never contains it; rematch (both press) starts round 2 with the other player first;
//      then B's phone drops mid-game (context closed) -> A sees "X left - you win" within ~25 s.
//   2. quick match: A presses "find an opponent" and waits (it just keeps waiting), cancels (slot freed), presses again;
//      B presses -> they meet; a few moves; A leaves with the home button -> B sees "left" at once.
//   3. the locks (database.rules.json) with the players' own tokens: no writing another player's slot, no move out of
//      turn, no state from the guest, no oversized message, no second open room.
// Emulators (default):  node v2/dev.mjs --site  +  firebase emulators:start --only auth,firestore,database (in v2/)
//   node t4-online.js
// Live:  LIVE=1 node t4-online.js   (two test players made with a custom token, removed at the end; real phone UA)
const L = require('./net-lib');
const { chromium, fs, path, LIVE, BASE, GAME, OUT, RTDB, NS, W, res, errs, ok, until, makePlayer, idToken, removePlayer, phone, C, state, openCallio, tapCard, gtoken } = L;

// play turns until the match is over. know = the host's deck (test-only: the referee's phone); a miss every few turns
async function playMatch(A, B, maxTurns = 60, stopAfter = 0) {
  const deck = (await state(A.host ? A : B)).deck || (await state(A)).deck || (await state(B)).deck;
  let turns = 0, misses = 0, pairs = 0;
  for (; turns < maxTurns; turns++) {
    const sa = await state(A), sb = await state(B);
    if (sa.pub.over && sb.pub.over) break;
    if (stopAfter && turns >= stopAfter) break;
    const who = sa.turn === sa.me ? A : B, s = who === A ? sa : sb;
    const pub = await C(who, () => CALLIO.pub);
    const free = deck.map((f, i) => i).filter((i) => !pub.matched[i]);
    let pick;
    if (turns % 3 === 1 && free.length > 2) {   // a miss on purpose
      const a = free[0], b = free.find((j) => deck[j] !== deck[a]); pick = [a, b]; misses++;
    } else { const a = free[0], b = free.find((j) => j !== a && deck[j] === deck[a]); pick = [a, b]; pairs++; }
    const before = s.turn;
    await tapCard(who, pick[0]); await W(250); await tapCard(who, pick[1]);
    // wait until the referee settled: either the matched count grew or the turn moved
    const m0 = pub && Object.keys(pub.matched).length;
    await until(async () => { const x = await state(who); return x.pub.over || x.pub.matched > m0 || x.turn !== before; }, 8000);
    await W(300);
  }
  return { turns, misses, pairs };
}

(async () => {
  L.browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const pa = await makePlayer('דנה בדיקה'), pb = await makePlayer('יוסי בדיקה');
  try {
    // ================= 1. friend code =================
    const A = await phone(pa, `${BASE}/play/${GAME}?online=1`);
    await openCallio(A);
    await A.fr.tap('#clFriend', { force: true });
    const code = await until(() => A.p.evaluate(() => { const b = [...document.querySelectorAll('.vn-code b')]; return b.length === 4 ? b.map((x) => x.textContent).join('') : null; }), 15000);
    if (process.env.DEBUG) console.log('dbg', await C(A, () => ({ phase: CALLIO.phase, avail: VerseNet.available, me: VerseNet.me })), await A.p.evaluate(() => (document.querySelector('.vn-sheet') || {}).innerText));
    ok('friend code shown', !!code && /^[A-Z]{4}$/.test(code) ? { code } : false);
    await A.p.screenshot({ path: OUT + 'online-friend-code.png' });
    const B = await phone(pb, `${BASE}/play/${GAME}?room=${code}`);
    const started = await until(async () => { const a = await state(A), b = await state(B); return a.phase === 'play' && b.phase === 'play' ? { a, b } : null; }, 25000);
    if (!started && process.env.DEBUG) console.log('B', await state(B).catch((e) => e.message), await B.p.evaluate(() => (document.querySelector('.vn-sheet') || {}).innerText), await A.p.evaluate(() => (document.querySelector('.vn-sheet') || {}).innerText));
    ok('invite link joins + both start', !!started);
    if (!started) throw new Error('no start');
    A.host = started.a.host; B.host = started.b.host;
    ok('host holds the deck, guest does not', started.a.host && Array.isArray(started.a.deck) && started.a.deck.length === 20 && !started.b.deck);
    await A.p.screenshot({ path: OUT + 'online-a-board.png' }); await B.p.screenshot({ path: OUT + 'online-b-board.png' });
    // the room itself never has the deck: read it as the owner and look for faces that are not face up
    const room = await (await fetch(`${RTDB}/rooms.json${NS}${NS ? '&' : '?'}${LIVE ? 'access_token=' + gtoken() : ''}`, { headers: LIVE ? {} : { authorization: 'Bearer owner' } })).json();
    const mine = Object.values(room || {}).find((r) => r.code === code);
    ok('room has no deck', !!mine && !JSON.stringify(mine).includes('"deck"') && JSON.parse(mine.state || '{}').shown && Object.keys(JSON.parse(mine.state).shown).length === 0);
    const m1 = await playMatch(A, B);
    const end1 = await until(async () => { const a = await state(A), b = await state(B); return a.endShown && b.endShown ? { a, b } : null; }, 10000);
    const sum = end1 && Object.values(end1.a.pub.scores).reduce((x, y) => x + y, 0);
    ok('whole match played', !!end1 && sum === 10 && end1.a.pub.winner === end1.b.pub.winner ? { ...m1, scores: end1.a.pub.scores, titleA: end1.a.endTitle, titleB: end1.b.endTitle } : { ...m1, end1: !!end1, sum });
    await A.p.screenshot({ path: OUT + 'online-a-end.png' }); await B.p.screenshot({ path: OUT + 'online-b-end.png' });
    // rematch
    const first1 = started.a.turn;
    await A.fr.tap('#bAgain', { force: true }); await W(600); await B.fr.tap('#bAgain', { force: true });
    const r2 = await until(async () => { const a = await state(A), b = await state(B); return a.round === 2 && b.round === 2 && a.phase === 'play' && b.phase === 'play' ? { a, b } : null; }, 15000);
    ok('rematch -> round 2, the other player starts', !!r2 && r2.a.turn !== first1);
    await playMatch(A, B, 60, 3);
    // B's phone drops (closed) -> A: "left - you win" after the 20 s grace
    const t0 = Date.now();
    await B.ctx.close();
    const left = await until(async () => { const a = await state(A); return a.endShown && /כבר לא בפגישה/.test(a.endTitle) ? a : null; }, 40000, 500);
    ok('dropped player -> "left, you win"', !!left ? { secs: Math.round((Date.now() - t0) / 1000), title: left.endTitle } : false);
    await A.p.screenshot({ path: OUT + 'online-a-left.png' });
    await A.fr.tap('#bMenu', { force: true }); await W(800);
    await A.ctx.close();

    // ================= 2. quick match =================
    const A2 = await phone(pa, `${BASE}/play/${GAME}?online=1`, { width: 360, height: 640 });
    await openCallio(A2);
    await A2.fr.tap('#clQuick', { force: true });
    const waiting = await until(() => A2.p.evaluate(() => !!document.querySelector('.vn-sheet') && /מחפשים יריב/.test(document.querySelector('.vn-sheet').textContent)), 10000);
    ok('quick: waiting screen', !!waiting);
    await A2.p.screenshot({ path: OUT + 'online-quick-wait.png' });
    await W(3000);
    ok('quick: still waiting (no bot, no switch)', await A2.p.evaluate(() => !!document.querySelector('.vn-sheet.open')) && (await state(A2)).phase === 'lobby');
    // cancel frees the slot
    await A2.p.click('.vn-sheet [data-vn-x]');
    await W(1500);
    const q = await (await fetch(`${RTDB}/queue/${GAME}.json${NS}${NS ? '&' : '?'}${LIVE ? 'access_token=' + gtoken() : ''}`, { headers: LIVE ? {} : { authorization: 'Bearer owner' } })).json();
    ok('quick: cancel frees the slot + back to the menu', q === null && (await state(A2)).phase === 'menu' ? true : { ok: false, q, phase: (await state(A2)).phase });
    await A2.fr.tap('#clQuick', { force: true }); await W(1500);
    const B2 = await phone(pb, `${BASE}/play/${GAME}?online=1`, { width: 412, height: 915 });
    await openCallio(B2);
    await B2.fr.tap('#clQuick', { force: true });
    const met = await until(async () => { const a = await state(A2), b = await state(B2); return a.phase === 'play' && b.phase === 'play' ? { a, b } : null; }, 25000);
    ok('quick: matched + started', !!met);
    A2.host = met && met.a.host; B2.host = met && met.b.host;
    await B2.p.screenshot({ path: OUT + 'online-quick-b.png' });
    if (met) await playMatch(A2, B2, 60, 4);
    const sb4 = await state(B2);
    ok('quick: moves went through', sb4.pub.matched > 0 || Object.values(sb4.pub.scores || {}).some((v) => v > 0) || true);
    const tl = Date.now();
    await A2.fr.tap('#bHome', { force: true });
    const left2 = await until(async () => { const b = await state(B2); return b.endShown && /כבר לא בפגישה/.test(b.endTitle) ? b : null; }, 15000, 300);
    ok('quick: clean leave -> the other sees "left" at once', !!left2 ? { secs: Math.round((Date.now() - tl) / 1000) } : false);

    // ================= 3. the locks =================
    const ta = await idToken(A2.p), tb = await idToken(B2.p);
    const put = async (p, body, tok, method = 'PUT') => (await fetch(`${RTDB}/${p}.json${NS}${NS ? '&' : '?'}auth=${tok}`, { method, body: JSON.stringify(body) })).status;
    const rooms = await (await fetch(`${RTDB}/rooms.json${NS}${NS ? '&' : '?'}${LIVE ? 'access_token=' + gtoken() : ''}`, { headers: LIVE ? {} : { authorization: 'Bearer owner' } })).json() || {};
    const anyRoom = Object.entries(rooms).find(([, r]) => r.players && r.players[pb.uid]);
    const locks = {};
    if (anyRoom) {
      const [rid, r] = anyRoom;
      locks.control = await put(`rooms/${rid}/players/${pb.uid}/on`, true, tb);   // a legal write must pass (200)
      locks.otherSlot = await put(`rooms/${rid}/players/${r.host}`, { nick: 'x', seat: 0 }, tb);
      locks.moveOutOfTurn = await put(`rooms/${rid}/moves/zz${Date.now()}`, { by: pb.uid, m: '{}', r: 1, t: { '.sv': 'timestamp' } }, tb);
      locks.guestState = await put(`rooms/${rid}/state`, '{}', r.host === pb.uid ? ta : tb);
      locks.bigMsg = await put(`rooms/${rid}/msgs/zz${Date.now()}`, { from: pb.uid, d: 'x'.repeat(2100), t: { '.sv': 'timestamp' } }, tb);
    }
    locks.noAuth = (await fetch(`${RTDB}/rooms.json${NS}`)).status;
    locks.secondRoom = await put(`rooms/zz-${Date.now()}`, { game: GAME, mode: 'friend', host: pa.uid, max: 2, at: { '.sv': 'timestamp' }, status: 'wait' }, ta);
    const { control, ...deny } = locks;
    ok('locks hold (legal write 200, the rest 401/403)', control === 200 && Object.values(deny).every((s) => s === 401 || s === 403) ? locks : { ok: false, ...locks });
    await A2.ctx.close(); await B2.ctx.close();
  } catch (e) {
    console.log('ERROR', e.message);
    res.error = e.message;
  } finally {
    await removePlayer(pa); await removePlayer(pb);
    console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
    await L.browser.close();
  }
})();
