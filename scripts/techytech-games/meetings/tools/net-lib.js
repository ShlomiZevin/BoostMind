// shared by the online tests (t4-online.js, t5-races.js): players (emulator or live), phones (two browser contexts)
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const LIVE = !!process.env.LIVE;
const BASE = process.env.BASE || (LIVE ? 'https://shlomiverse.com' : 'http://localhost:5050');
const GAME = 'techytech-games-meetings';
const OUT = path.join(__dirname, '..', 'shots') + '/'; fs.mkdirSync(OUT, { recursive: true });
const RTDB = LIVE ? 'https://boostmind-b052c-default-rtdb.europe-west1.firebasedatabase.app' : 'http://127.0.0.1:9000';
const NS = LIVE ? '' : '?ns=boostmind-b052c-default-rtdb';
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const res = {}; const errs = [];
const ok = (k, v) => { res[k] = v; console.log((v === true || (v && v.ok !== false && v !== false) ? 'ok  ' : 'FAIL') + ' ' + k + (v === true ? '' : ' ' + JSON.stringify(v))); };
async function until(fn, ms = 15000, step = 200) { const t = Date.now(); for (;;) { let v; try { v = await fn(); } catch (e) { v = null; } if (v) return v; if (Date.now() - t > ms) return null; await W(step); } }

// ---------- players ----------
const KEY = LIVE ? 'AIzaSyB90ncysHNU-fqHfe9dEudVR2sweXQGM90' : 'local-key';
const AUTH = LIVE ? 'https://identitytoolkit.googleapis.com/v1' : 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = LIVE ? 'https://firestore.googleapis.com/v1/projects/boostmind-b052c/databases/(default)/documents' : 'http://127.0.0.1:8080/v1/projects/demo-shlomiverse/databases/(default)/documents';
const gtoken = () => execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
async function makePlayer(nick) {
  let uid, signin;
  if (!LIVE) {
    const email = 'net' + Date.now() + Math.floor(Math.random() * 1e4) + '@test.local', password = 'pass1234';
    const r = await (await fetch(`${AUTH}/accounts:signUp?key=${KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) })).json();
    uid = r.localId; signin = { email, password };
  } else {
    // the verse's own email-code sign-in, without a mailbox: the code's record is written with the admin token (the same
    // hash verse.js emailCode writes), then the `verse` function's emailIn op hands back a custom token
    const crypto = require('crypto');
    const email = 'nettest-' + Date.now() + '-' + Math.floor(Math.random() * 1e4) + '@test.shlomiverse.com', code = String(Math.floor(1e5 + Math.random() * 9e5));
    const id = crypto.createHash('sha256').update(email).digest('hex').slice(0, 40), h = crypto.createHash('sha256').update(email + '|' + code).digest('hex');
    const H = { 'content-type': 'application/json', authorization: 'Bearer ' + gtoken() };
    const w = await fetch(`${FS}/emailCodes/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { h: { stringValue: h }, tries: { integerValue: '0' }, exp: { timestampValue: new Date(Date.now() + 600e3).toISOString() } } }) });
    if (!w.ok) throw new Error('code doc ' + w.status);
    const r = await (await fetch('https://europe-west1-boostmind-b052c.cloudfunctions.net/verse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: { op: 'emailIn', email, code } }) })).json();
    if (!r.result || !r.result.token) throw new Error('emailIn ' + JSON.stringify(r).slice(0, 200));
    const token = r.result.token;
    uid = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).uid;
    signin = { token };
  }
  // the verse needs a fan record with a name (state.js signedIn)
  const doc = { fields: { nick: { stringValue: nick }, follows: { arrayValue: {} }, test: { booleanValue: true } } };
  const h = { 'content-type': 'application/json', authorization: 'Bearer ' + (LIVE ? gtoken() : 'owner') };
  const r = await fetch(`${FS}/fans/${uid}`, { method: 'PATCH', headers: h, body: JSON.stringify(doc) });
  if (!r.ok) throw new Error('fan doc ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return { uid, nick, signin };
}
async function idToken(p) {   // the player's own token (for the rules checks), from the signed-in page
  return p.evaluate(async () => { const m = await import('/verse/fb.js'); return m.auth.currentUser.getIdToken(); });
}
async function removePlayer(pl) {
  if (!LIVE) return;
  const h = { authorization: 'Bearer ' + gtoken() };
  await fetch(`${FS}/fans/${pl.uid}`, { method: 'DELETE', headers: h }).catch(() => {});
  await fetch(`https://identitytoolkit.googleapis.com/v1/projects/boostmind-b052c/accounts:delete`, { method: 'POST', headers: { ...h, 'content-type': 'application/json', 'x-goog-user-project': 'boostmind-b052c' }, body: JSON.stringify({ localId: pl.uid }) }).catch(() => {});
}

// ---------- phones ----------
const L = { browser: null };
async function phone(pl, url, vp = { width: 390, height: 844 }, extra = {}) {   // extra: more context options (recordVideo for the trailer)
  const ctx = await L.browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: UA, ...extra });
  await ctx.addInitScript(() => { try { localStorage.setItem('t-ignore', '1'); } catch (e) {} });  // tests never count in the stats (t.js notrack)
  if (!LIVE) {   // the local wiki data has no games: add this one (on the local origin)
    await ctx.route('**/wiki/data/wiki.json*', async (route) => {
      const r = await route.fetch(); const d = await r.json();
      d.games = [{ id: GAME, url: BASE + '/techytech-games/meetings/', title: 'אז אנחנו מסונכרנים', tagline: '', chars: ['amir'], img: BASE + '/techytech-games/meetings/cover.jpg', site: 'techytech-games', date: '2026-11-12' }, ...(d.games || [])];
      route.fulfill({ response: r, json: d });
    });
  }
  const p = await ctx.newPage(); const t0 = Date.now();   // t0 = the start of this page's video
  p.on('pageerror', (e) => errs.push(pl.nick + ': ' + e.message));
  if (process.env.DEBUG) p.on('console', (m) => { if (!/track|React|\[verse\]/.test(m.text())) console.log('  [' + pl.nick + ' ' + m.type() + '] ' + m.text().slice(0, 300)); });
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => { try { localStorage.setItem('shlomiverse:meetings:tut-callio', '1'); localStorage.setItem('vx-cookie', '1'); } catch (e) {} });
  await until(() => p.evaluate(() => !!window.HOOK && !!window.HOOK.openGame), 20000);
  await p.evaluate(async (s) => {
    const m = await import('/verse/fb.js');
    if (s.token) await m.A.signInWithCustomToken(m.auth, s.token); else await m.A.signInWithEmailAndPassword(m.auth, s.email, s.password);
  }, pl.signin);
  await W(1500);
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  const fr = await until(() => p.frames().find((f) => f.url().includes('/techytech-games/meetings/')), 25000);
  if (!fr) throw new Error(pl.nick + ': no game frame');
  await until(() => fr.evaluate(() => !!window.CALLIO), 20000);
  await fr.evaluate(() => localStorage.setItem('shlomiverse:meetings:tut-callio', '1'));
  return { ctx, p, fr, pl, t0 };
}
const C = (ph, fn, arg) => ph.fr.evaluate(fn, arg);
const state = (ph) => C(ph, () => ({ phase: CALLIO.phase, online: CALLIO.online, me: CALLIO.me, turn: VerseNet.turn, round: VerseNet.round, host: CALLIO.m && CALLIO.m.host,
  deck: CALLIO.deck, pub: CALLIO.pub && { scores: CALLIO.pub.scores, matched: Object.keys(CALLIO.pub.matched).length, over: CALLIO.pub.over, winner: CALLIO.pub.winner },
  endShown: !document.getElementById('end').hidden, endTitle: document.getElementById('endTitle').textContent }));
async function openCallio(ph) {
  await until(() => C(ph, () => !document.getElementById('appCallio').hidden), 10000);
  await ph.fr.tap('#appCallio .go', { force: true });
  await until(() => C(ph, () => CALLIO.phase === 'menu' && !document.getElementById('clMenu').hidden), 8000);
}
async function tapCard(ph, i) { await ph.fr.tap(`#clBoard .cc[data-i="${i}"]`, { force: true }); }


module.exports = Object.assign(L, { chromium, fs, path, LIVE, BASE, GAME, OUT, RTDB, NS, UA, W, res, errs, ok, until, makePlayer, idToken, removePlayer, phone, C, state, openCallio, tapCard, gtoken });
