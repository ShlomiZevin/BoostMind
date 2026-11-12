// Shlomiverse Online - the page side. A game in the verse's frame never opens a socket or touches Firebase: it posts
// {verse:'net', op, ...} (game-frame.js: window.VerseNet) and this module - loaded only when a game asks - holds the
// connection, the identity (the verse's sign-in: uid + the fan's nick / photo, never the Google name), the rooms and
// the ONE shared lobby (play with a friend = a 4-letter code + "הזמינו"; find an opponent = a waiting screen that just
// keeps waiting until someone comes, with a cancel button - his decision 2026-11-12, no bot, no automatic switch).
// The transport is behind a seam: ./rtdb.js now, ./ws.js (a Cloud Run relay) if a game becomes a hit - same object.
// API + protocol: ./README.md. Online matches never go on the daily records.
import { st, needFan, signedIn } from '../state.js';
import { sheet, toast, esc } from '../ui.js';

const AWAY_MS = 20e3;   // a player whose connection dropped this long has left (the game shows "X left - you win")
const SEND_PER_S = 20;  // the page throttles messages (the rules can't count per second)
const MAX_LEN = 2000;   // one message / move, JSON
const W = {
  friendT: 'שחקו עם חבר', friendSub: 'שלחו לחבר את הקוד או את הקישור. כשהוא נכנס – המשחק מתחיל.',
  invite: 'הזמינו', copy: 'העתקה', copied: 'הקוד הועתק', waitingFriend: 'מחכים שהחבר יצטרף…',
  haveCode: 'קיבלתם קוד מחבר?', codePh: 'הקלידו קוד', joinBtn: 'הצטרפו',
  quickBtn: 'מצאו יריב', quickT: 'מחפשים יריב…', quickSub: 'ממשיכים לחפש עד שמישהו מגיע. אפשר לבטל מתי שרוצים.',
  playing: (n) => (n <= 1 ? 'רק אתם כאן כרגע' : n === 2 ? 'עוד שחקן אחד כאן עכשיו' : `${n} שחקנים כאן עכשיו`),
  joining: 'מצטרפים לחדר…', cancel: 'ביטול', here: (n) => `${n} כאן!`, starting: 'המשחק מתחיל…',
  shareText: (title, code) => `בואו לשחק איתי ב"${title}" בשלומיוורס! קוד החדר: ${code}`,
  errGone: 'החדר הזה כבר לא קיים', errFull: 'החדר כבר מלא', errEnded: 'המשחק בחדר הזה נגמר', errClosed: 'המשחק המקוון סגור כרגע – נסו שוב מאוחר יותר',
  errNet: 'אין חיבור – נסו שוב', errCode: 'הקוד צריך להיות 4 אותיות',
};

let S = null;   // the open game's session: { g, frame, q, t, rid, ... }
let transport = null;

// player.js routes every {verse:'net'} message of the open game here
export function netMessage(e, ctx) {
  const d = e.data;
  if (!S || S.frame !== ctx.frame) { close(); S = { g: ctx.g, frame: ctx.frame, q: ctx.q || {}, el: ctx.el, rid: null, key: '', round: 0, started: 0, sent: [], away: {}, gone: new Set(), last: {}, claimed: new Set() }; }
  const reply = (ok, val) => post({ re: d.id, ok, val });
  Promise.resolve().then(() => op(d)).then((v) => reply(true, v), (err) => reply(false, (err && err.code) || String(err && err.message || err)));
}
export function close() {
  if (!S) return;
  const s = S; S = null;
  s.sheet && s.sheet.close('away');
  s.unwatch && s.unwatch();
  s.stopQuick && s.stopQuick();
  s.presence && s.presence();
  Object.values(s.away).forEach(clearTimeout);
  if (transport && s.rid) { transport.unqueue(s.g.id + (s.key ? ':' + s.key : '')).catch(() => {}); transport.leave(s.rid, s.host, s.code).catch(() => {}); }
}

const post = (m) => { try { S && S.frame.contentWindow && S.frame.contentWindow.postMessage({ verse: 'net', ...m }, '*'); } catch (e) {} };
const emit = (ev, data) => post({ ev, data });
const me = () => ({ nick: String(st.fan?.nick || 'שחקן').slice(0, 24), ...(st.fan?.photo && String(st.fan.photo).length <= 600 ? { photo: st.fan.photo } : {}) });
const key = (k) => (typeof k === 'string' && /^[a-z0-9-]{1,20}$/.test(k) ? k : '');   // a game with several online modes (apps): rooms + the quick slot per key
const labelOf = (l) => (l && typeof l === 'object' ? { title: String(l.title || '').slice(0, 40), sub: String(l.sub || '').slice(0, 140) } : null);   // a mode's name on the lobby sheets
const gameKey = () => S.g.id + (S.key ? ':' + S.key : '');
const err = (code) => Object.assign(new Error(code), { code });

async function net() {
  if (!(await needFan('play'))) throw err('signin');
  if (!transport || transport.uid !== st.user.uid) {
    const { open } = await import('./rtdb.js');
    transport = await open();
  }
  return transport;
}

async function op(d) {
  switch (d.op) {
    case 'hello': {
      const q = S.q;
      if (signedIn()) presence().catch(() => {});
      if (q.room && !S.inviteDone) { S.inviteDone = true; setTimeout(() => join(q.room).catch(() => {}), 300); }
      return { available: true, signedIn: signedIn(), me: st.user ? st.user.uid : null, invite: q.room ? String(q.room).toUpperCase() : null, flags: { online: q.online === '1' || !!q.room } };
    }
    case 'host': S.key = key(d.key); S.label = labelOf(d.label); return host();
    case 'join': return join(d.code);
    case 'quick': S.key = key(d.key); S.label = labelOf(d.label); return quick();
    case 'lobby': S.key = key(d.key); return lobby(d.label);
    case 'claim': return claim(d.key);
    case 'cancel': return cancel();
    case 'leave': return leave();
    case 'send': return send(d.data, d.to);
    case 'move': return move(d.m);
    case 'state': return setState(d.state);
    case 'turn': return setTurn(d.to);
    case 'pass': return pass(d.to);
    case 'end': return end(d.result);
    case 'rematch': return rematch();
    default: throw err('bad_op');
  }
}

// ---------- presence: "N playing now" ----------
async function presence() {
  if (S.presence) return;
  const t = await net(), s = S;
  if (!s) return;
  s.presence = t.presence(s.g.id, (n) => { s.count = n; emit('count', n); paintCount(); });
}

// ---------- the lobby (one look for every game) ----------
let cssDone = false;
function css() {
  if (cssDone) return; cssDone = true;
  const el = document.createElement('style');
  el.textContent = `.vn{padding:6px 20px 22px;text-align:center;color:#fff}
.vn h2{font-size:1.45rem;margin:4px 0 6px;font-weight:800}.vn p{margin:0 0 12px;opacity:.82;line-height:1.45;font-size:.98rem}
.vn-code{display:flex;justify-content:center;gap:10px;margin:14px 0 6px;direction:ltr;cursor:pointer}
.vn-code b{width:58px;height:70px;border-radius:16px;background:#fff;color:#17161a;font-size:2.4rem;font-weight:900;display:grid;place-items:center;box-shadow:0 6px 18px #0006}
.vn-mode{display:inline-block;font-size:.85rem;font-weight:800;background:rgba(255,106,31,.18);color:#ffb38a;border-radius:99px;padding:3px 12px;margin-top:2px}
.vn-hint{font-size:.82rem;opacity:.6;margin-bottom:14px}
.vn .vx-btn{margin-top:10px}
.vn-wait{display:flex;align-items:center;justify-content:center;gap:10px;margin:16px 0 4px;font-weight:700}
.vn-dot{width:18px;height:18px;border-radius:50%;border:3px solid #fff3;border-top-color:var(--vx-accent,#ff6a1f);animation:vnspin .8s linear infinite;flex:none}
@keyframes vnspin{to{transform:rotate(360deg)}}
.vn-count{display:inline-flex;align-items:center;gap:8px;font-size:.92rem;opacity:.85;margin:4px 0 6px}.vn-count i{width:9px;height:9px;border-radius:50%;background:#3ddc84;box-shadow:0 0 0 4px #3ddc8433}
.vn-join{display:flex;gap:8px;margin-top:8px}.vn-join input:placeholder-shown{letter-spacing:normal;font-weight:600}
.vn-join input{flex:1;min-width:0;text-align:center;letter-spacing:.3em;font-weight:800;text-transform:uppercase;direction:ltr;height:50px}
.vn-join .vx-btn{margin:0;height:50px}
.vn-sep{margin:18px 0 4px;font-size:.9rem;opacity:.7}
.vn-faces{display:flex;justify-content:center;gap:16px;margin:12px 0}.vn-faces span{display:flex;flex-direction:column;align-items:center;gap:6px;font-weight:700}
.vn-faces img,.vn-faces em{width:64px;height:64px;border-radius:50%;object-fit:cover;background:#fff2;display:grid;place-items:center;font-style:normal;font-size:1.6rem}
.vn-x{background:none;border:0;color:#fff;opacity:.75;font:inherit;font-weight:700;padding:12px;margin-top:4px;cursor:pointer;text-decoration:underline}`;
  document.head.append(el);
}
function openSheet(html, onCancel) {
  css();
  if (S.sheet) { const old = S.sheet; S.sheet = null; old.close('replace'); }
  const h = sheet(`<div class="vn">${html}</div>`, { cls: 'vn-sheet', onClose: (why) => { if (S && S.sheet === h) { S.sheet = null; if (why !== 'done' && why !== 'replace' && why !== 'away') onCancel && onCancel(); } } });
  // the verse's full screen = the browser's full screen on the game's layer: the sheet must be inside it to show
  const fs = document.fullscreenElement;
  if (fs && fs !== document.body) { const back = h.el.previousElementSibling; fs.append(back, h.el); }
  S.sheet = h;
  h.el.addEventListener('click', (e) => { if (e.target.closest('[data-vn-x]')) h.close('x'); });
  return h;
}
const countRow = () => `<div class="vn-count" data-vn-count><i></i><span>${esc(W.playing(S.count || 1))}</span></div>`;
function paintCount() { const c = S && S.sheet && S.sheet.el.querySelector('[data-vn-count] span'); if (c) c.textContent = W.playing(S.count || 1); }
const joinRow = () => `<div class="vn-sep">${esc(W.haveCode)}</div><form class="vn-join" data-vn-join><input class="vx-field" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="${esc(W.codePh)}"><button class="vx-btn white">${esc(W.joinBtn)}</button></form>`;
function bindJoin(h) {
  const f = h.el.querySelector('[data-vn-join]');
  if (!f) return;
  f.onsubmit = (e) => {
    e.preventDefault();
    const code = f.querySelector('input').value.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) { toast(W.errCode); return; }
    join(code).catch(() => {});
  };
}
function fail(code) {
  const m = { gone: W.errGone, full: W.errFull, ended: W.errEnded, closed: W.errClosed, signin: null, cancel: null }[code];
  if (m === undefined) toast(W.errNet); else if (m) toast(m, 3200);
}

async function lobby(label) {
  const L = labelOf(label);
  S.label = L;   // the friend / quick screens opened from here keep the mode's name
  if (!(await needFan('play'))) throw err('signin');
  presence().catch(() => {});
  const h = openSheet(`<h2>${esc((L && L.title) || S.g.title || '')}</h2>${L && L.sub ? `<p>${esc(L.sub)}</p>` : ''}${countRow()}
    <button class="vx-btn main block" data-vn-friend>${esc(W.friendT)}</button>
    <button class="vx-btn glass block" data-vn-quick>${esc(W.quickBtn)}</button>
    ${joinRow()}<button class="vn-x" data-vn-x>${esc(W.cancel)}</button>`, () => emit('closed', { why: 'cancel' }));
  bindJoin(h);
  h.el.querySelector('[data-vn-friend]').onclick = () => host().catch(() => {});
  h.el.querySelector('[data-vn-quick]').onclick = () => quick().catch(() => {});
  return true;
}

async function host() {
  const t = await net();
  if (!(await t.isOpen())) { fail('closed'); throw err('closed'); }
  await leaveRoom();
  presence().catch(() => {});
  const { rid, code } = await t.createRoom({ game: gameKey(), mode: 'friend', max: 2, me: me() });
  Object.assign(S, { rid, code, host: true, mode: 'friend' });
  watch();
  const url = `${location.origin}/play/${S.g.id}?room=${code}`;
  const h = openSheet(`${S.label && S.label.title ? `<div class="vn-mode">${esc(S.label.title)}</div>` : ''}<h2>${esc(W.friendT)}</h2><p>${esc(W.friendSub)}</p>
    <div class="vn-code" data-vn-copy title="${esc(W.copy)}">${[...code].map((c) => `<b>${c}</b>`).join('')}</div>
    <div class="vn-hint">${esc(W.copy)} ↑</div>
    <button class="vx-btn main block" data-vn-share>${esc(W.invite)}</button>
    <div class="vn-wait" data-vn-wait><span class="vn-dot"></span><span>${esc(W.waitingFriend)}</span></div>
    ${joinRow()}<button class="vn-x" data-vn-x>${esc(W.cancel)}</button>`, () => cancel());
  bindJoin(h);
  h.el.querySelector('[data-vn-copy]').onclick = () => { navigator.clipboard?.writeText(code).then(() => toast(W.copied), () => {}); };
  h.el.querySelector('[data-vn-share]').onclick = () => {
    const text = W.shareText(S.g.title || '', code);
    if (navigator.share) navigator.share({ title: S.g.title, text, url }).catch(() => {});
    else { navigator.clipboard?.writeText(`${text}\n${url}`); toast(W.copied); }
  };
  return { code, url };
}

async function join(code) {
  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { fail('gone'); throw err('gone'); }
  const t = await net();
  const s = S;
  openSheet(`<h2>${esc(W.joining)}</h2><div class="vn-wait"><span class="vn-dot"></span><span>${esc(code)}</span></div><button class="vn-x" data-vn-x>${esc(W.cancel)}</button>`, () => cancel());
  try {
    const rid = await t.codeRoom(code);
    if (!rid) throw err('gone');
    if (S !== s) throw err('cancel');
    if (S.rid === rid) return { code };
    await leaveRoom();
    const room = await t.joinRoom(rid, me());
    Object.assign(S, { rid, code, host: room.host === t.uid, mode: 'friend' });
    watch();
    return { code };
  } catch (e) {
    if (S === s && S.sheet) S.sheet.close('done');
    fail(e.code); emit('closed', { why: e.code || 'error' });
    throw e;
  }
}

async function quick() {
  const t = await net();
  if (!(await t.isOpen())) { fail('closed'); throw err('closed'); }
  await leaveRoom();
  presence().catch(() => {});
  const s = S;
  openSheet(`${S.label && S.label.title ? `<div class="vn-mode">${esc(S.label.title)}</div>` : ''}<h2>${esc(W.quickT)}</h2><p>${esc(W.quickSub)}</p><div class="vn-wait"><span class="vn-dot"></span></div>${countRow()}
    <button class="vx-btn glass block" data-vn-x>${esc(W.cancel)}</button>`, () => cancel());
  try {
    const q = await t.quick(gameKey(), me());
    if (S !== s || !S.sheet) { q.stop(); await t.unqueue(gameKey()); await t.leave(q.rid, q.host, ''); throw err('cancel'); }
    Object.assign(S, { rid: q.rid, code: '', host: q.host, mode: 'quick', stopQuick: q.stop });
    watch();
    return { waiting: q.host };
  } catch (e) {
    if (S === s && S.sheet) S.sheet.close('done');
    if (e.code !== 'cancel') { fail(e.code); emit('closed', { why: e.code || 'error' }); }
    throw e;
  }
}

async function cancel() {
  if (!S) return;
  S.sheet && S.sheet.close('done');
  await leaveRoom();
  emit('closed', { why: 'cancel' });
}
async function leave() { if (S) { S.sheet && S.sheet.close('done'); await leaveRoom(); } return true; }
async function leaveRoom() {
  if (!S || !S.rid) return;
  const { rid, host, code } = S;
  S.unwatch && S.unwatch(); S.unwatch = null;
  S.stopQuick && S.stopQuick(); S.stopQuick = null;
  Object.values(S.away).forEach(clearTimeout); S.away = {};
  Object.assign(S, { rid: null, code: '', host: false, room: null, started: 0, round: 0, gone: new Set(), last: {}, claimed: new Set() });
  await transport.unqueue(gameKey()).catch(() => {});
  await transport.leave(rid, host, code).catch(() => {});
}

// ---------- one room, live ----------
function watch() {
  const s = S, t = transport;
  s.unwatch && s.unwatch();
  s.unwatch = t.watch(s.rid, {
    room: (v) => { if (S === s) onRoom(v); },
    move: (m) => { if (S === s && m && m.r === s.round && s.started === s.round) { let x; try { x = JSON.parse(m.m); } catch (e) { return; } emit('move', { m: x, by: m.by }); } },
    msg: (m) => {
      if (S !== s || !m || m.from === t.uid || (m.to && m.to !== t.uid)) return;
      let x; try { x = JSON.parse(m.d); } catch (e) { return; }
      if (x && x.__pass !== undefined) { if (s.host && s.room && s.room.turn === m.from) setTurn(x.__pass || null).catch(() => {}); return; }
      emit('msg', { data: x, from: m.from });
    },
    error: () => {},
  });
}
const list = (room) => Object.entries(room.players || {}).map(([id, p]) => ({ id, nick: p.nick, photo: p.photo || null, seat: p.seat, on: p.on !== false, left: !!p.left, again: p.again || 0 }))
  .sort((a, b) => a.seat - b.seat);
function onRoom(room) {
  const s = S, t = transport;
  if (!room || room.status === 'closed') {   // the host closed it (left) - or the sweep took it
    if (s.started && !s.host) { const h = s.room && s.room.host; if (h && !s.gone.has(h)) { s.gone.add(h); emit('left', { id: h }); } }
    else if (!s.started && s.sheet) { s.sheet.close('done'); fail('gone'); emit('closed', { why: 'gone' }); }
    s.unwatch && s.unwatch(); s.unwatch = null;
    Object.assign(s, { rid: null, code: '', host: false, room: null, started: 0, round: 0, gone: new Set(), last: {}, claimed: new Set() });   // a fresh start for the next room
    return;
  }
  const prev = s.room || {};
  s.room = room;
  const ps = list(room), active = ps.filter((p) => !p.left);
  // who is here / away / gone
  for (const p of ps) {
    if (p.id === t.uid) continue;
    const was = s.last[p.id];
    if (p.left && !s.gone.has(p.id)) { s.gone.add(p.id); clearTimeout(s.away[p.id]); if (s.started) emit('left', { id: p.id }); }
    else if (!p.left && was && was.on && !p.on) {
      emit('away', { id: p.id });
      s.away[p.id] = setTimeout(() => { if (S === s && !s.gone.has(p.id)) { s.gone.add(p.id); emit('left', { id: p.id }); } }, AWAY_MS);
    } else if (!p.left && was && !was.on && p.on && !s.gone.has(p.id)) { clearTimeout(s.away[p.id]); emit('back', { id: p.id }); }
    if (!p.left && p.again && p.again === room.round && (!was || was.again !== p.again)) emit('rematch', { by: p.id });
    s.last[p.id] = p;
  }
  if (JSON.stringify(prev.players || {}) !== JSON.stringify(room.players || {})) emit('players', ps.filter((p) => !p.left));
  // race claims (who was first), to everyone - the claimer too
  if (s.started) for (const [k, by] of Object.entries(room.claims || {})) if (!(prev.claims || {})[k] || (prev.round !== room.round)) { if (!s.claimed.has(room.round + '|' + k)) { s.claimed.add(room.round + '|' + k); emit('claim', { key: k, by }); } }
  // the lobby: someone came
  if (room.status === 'wait' && s.sheet) {
    const other = active.find((p) => p.id !== t.uid);
    const w = s.sheet.el.querySelector('[data-vn-wait] span:last-child');
    if (other && w) w.textContent = W.here(other.nick);
  }
  // the host starts when the room is full (and again after everyone asked for a rematch)
  if (s.host && !s.starting) {
    const full = active.length >= room.max && active.every((p) => p.on);
    const again = room.status === 'done' && active.length >= room.max && active.every((p) => p.again === room.round);
    if ((room.status === 'wait' && full) || again) {
      s.starting = true;
      s.stopQuick && s.stopQuick(); s.stopQuick = null;
      const round = (room.round || 0) + 1;
      // who goes first: random the first time, then the other player than last round's first
      const first = round === 1 ? active[Math.floor(Math.random() * active.length)].id : (active.find((p) => p.id !== room.first) || active[0]).id;
      t.setRoom(s.rid, { status: 'play', round, seed: Math.floor(Math.random() * 2 ** 31), turn: first, turnAt: t.serverTime(), first,
        ...(round > 1 ? { moves: null, msgs: null, claims: null } : {}) }).catch(() => {}).finally(() => { s.starting = false; });
    }
  }
  // start (and every rematch)
  if (room.status === 'play' && room.round > s.started) {
    s.started = s.round = room.round;
    s.sheet && s.sheet.close('done');
    emit('start', info(room, active));
  } else if (room.status === 'play' && (room.turn !== prev.turn || room.turnAt !== prev.turnAt)) emit('turn', { turn: room.turn || null, turnAt: room.turnAt || 0, now: t.now() });
  if (room.state !== prev.state && room.state != null && s.started) { let x; try { x = JSON.parse(room.state); } catch (e) { x = null; } emit('state', x); }
  if (room.status === 'done' && prev.status === 'play') emit('end', {});
}
function info(room, active) {
  const t = transport;
  return { room: S.rid, code: S.code || '', mode: room.mode, key: String(room.game || '').split(':')[1] || '', host: room.host === t.uid, hostId: room.host, me: t.uid, round: room.round, seed: room.seed || 0,
    turn: room.turn || null, turnAt: room.turnAt || 0, now: t.now(), players: active.map(({ id, nick, photo, seat }) => ({ id, nick, photo, seat })) };
}

// ---------- the game's ops in a match ----------
function inMatch() { if (!S || !S.rid || !S.started) throw err('no_match'); return transport; }
function throttle() { const n = Date.now(); S.sent = S.sent.filter((x) => n - x < 1000); if (S.sent.length >= SEND_PER_S) throw err('slow_down'); S.sent.push(n); }
function json(x) { const j = JSON.stringify(x === undefined ? null : x); if (j.length > MAX_LEN) throw err('too_big'); return j; }
async function send(data, to) { const t = inMatch(); throttle(); await t.send(S.rid, json(data), to || null); return true; }
async function move(m) {
  const t = inMatch(); throttle();
  if (S.room.turn !== t.uid) throw err('not_your_turn');
  await t.move(S.rid, json(m), S.round); return true;
}
async function setState(state) {
  const t = inMatch(); if (!S.host) throw err('host_only'); throttle();
  const j = JSON.stringify(state === undefined ? null : state); if (j.length > 8000) throw err('too_big');
  await t.setRoom(S.rid, { state: j }); return true;
}
async function setTurn(to) {
  const t = inMatch(); if (!S.host) throw err('host_only');
  const active = list(S.room).filter((p) => !p.left);
  if (!to) { const i = active.findIndex((p) => p.id === S.room.turn); to = active[(i + 1) % active.length].id; }
  await t.setRoom(S.rid, { turn: to, turnAt: t.serverTime() }); return true;
}
// a guest hands the turn on through the host (only the host writes `turn`); the host does it directly
async function pass(to) { const t = inMatch(); if (S.host) return setTurn(to); if (S.room.turn !== t.uid) throw err('not_your_turn'); await t.send(S.rid, json({ __pass: to || 0 }), S.room.host); return true; }
async function claim(k) {
  const t = inMatch();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(k))) throw err('bad_key');
  return t.claim(S.rid, String(k));
}
async function end() { const t = inMatch(); if (S.host && S.room.status === 'play') await t.setRoom(S.rid, { status: 'done' }); return true; }
async function rematch() {
  const t = inMatch();
  const active = list(S.room).filter((p) => !p.left && !S.gone.has(p.id));
  if (active.length < S.room.max) throw err('alone');
  await t.setMe(S.rid, { again: S.room.round }); return true;
}
