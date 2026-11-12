// Shlomiverse Online - the transport on Firebase Realtime Database (instance boostmind-b052c-default-rtdb, europe-west1).
// The ONLY file that knows the transport: net/index.js (rooms, lobby, the game's ops) talks to the object open() returns,
// and a Cloud Run relay later (net/ws.js) returns the same object. The locks are database.rules.json (repo root):
// signed-in only, own player slot only, moves only on your turn, size caps, one open room per user, the kill switch
// /net/open. Rooms are short-lived: the game deletes its own, verseNetSweep (techietech-api/net.js) the rest.
import { LOCAL, auth } from '../fb.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.4.0';
const URL_LIVE = 'https://boostmind-b052c-default-rtdb.europe-west1.firebasedatabase.app';
const CODE_ABC = 'BCDFGHJKLMNPQRSTVWXZ';   // no vowels (no words), no I/O/U/Y look-alikes: 20^4 = 160,000 codes
const STALE = 45e3;
// NB a transaction's first call gets the SDK's guess (null when nothing is cached): returning undefined for null would abort
// without asking the server - so the null case writes (or deletes) and the server re-runs it with the real value.                         // a quick-match slot whose waiter stopped beating is free again

let D = null, db = null, offset = 0;
async function sdk() {
  if (db) return;
  const { getApp } = await import(`${SDK}/firebase-app.js`);   // the same module fb.js loaded = the same app and sign-in
  D = await import(`${SDK}/firebase-database.js`);
  db = D.getDatabase(getApp(), LOCAL ? 'http://127.0.0.1:9000?ns=boostmind-b052c-default-rtdb' : URL_LIVE);
  if (LOCAL) { try { D.connectDatabaseEmulator(db, '127.0.0.1', 9000); } catch (e) { /* already */ } }
  D.onValue(D.ref(db, '.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });
}
const r = (p) => (p ? D.ref(db, p) : D.ref(db));
const val = async (p) => (await D.get(r(p))).val();
const now = () => Date.now() + offset;

export async function open() {
  await sdk();
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) throw Object.assign(new Error('signin'), { code: 'signin' });
  const meRef = (rid) => r(`rooms/${rid}/players/${uid}`);
  const discon = new Set();   // onDisconnect handlers we registered (cancelled on a clean leave)
  const onDis = (ref) => { const o = D.onDisconnect(ref); discon.add(o); return o; };

  const t = {
    kind: 'rtdb', uid, now,
    async isOpen() { try { return (await val('net/open')) === true; } catch (e) { return false; } },

    // a new room: frees my old one first (one open room per user), reserves a code, writes the room + hosting together
    async createRoom({ game, mode, max = 2, me }) {
      const old = await val(`hosting/${uid}`).catch(() => null);
      if (old) {
        const o = await val(`rooms/${old}`).catch(() => null);
        if (o && o.host === uid) { if (o.code) await D.remove(r(`codes/${o.code}`)).catch(() => {}); await D.remove(r(`rooms/${old}`)).catch(() => {}); }
      }
      const rid = D.push(r('rooms')).key;
      let code = '';
      if (mode === 'friend') {
        for (let i = 0; i < 12 && !code; i++) {
          const c = [...Array(4)].map(() => CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]).join('');
          const res = await D.runTransaction(r(`codes/${c}`), (cur) => (cur ? undefined : { room: rid, uid }), { applyLocally: false }).catch(() => null);
          if (res && res.committed) code = c;
        }
        if (!code) throw Object.assign(new Error('code'), { code: 'busy' });
      }
      const room = { game, mode, host: uid, max, at: D.serverTimestamp(), status: 'wait', code, round: 0,
        seats: { 0: uid }, players: { [uid]: { ...me, seat: 0, on: true } } };
      await D.update(r(''), { [`rooms/${rid}`]: room, [`hosting/${uid}`]: rid });
      onDis(r(`rooms/${rid}/players/${uid}/on`)).set(false);
      return { rid, code };
    },

    // join by room id (quick match / invite): takes the first free seat
    async joinRoom(rid, me) {
      const room = await val(`rooms/${rid}`);
      if (!room) throw Object.assign(new Error('gone'), { code: 'gone' });
      if (room.players && room.players[uid] && !room.players[uid].left) {   // already in (a reload, a second tap)
        await D.update(meRef(rid), { on: true });
        onDis(r(`rooms/${rid}/players/${uid}/on`)).set(false);
        return room;
      }
      const h = room.players && room.players[room.host];
      if (room.status === 'wait' && (!h || h.on === false || h.left)) throw Object.assign(new Error('gone'), { code: 'gone' });   // the host already went
      if (room.status !== 'wait') throw Object.assign(new Error('ended'), { code: room.status === 'play' ? 'full' : 'ended' });
      for (let s = 1; s < room.max; s++) {
        const res = await D.runTransaction(r(`rooms/${rid}/seats/${s}`), (cur) => (cur ? undefined : uid), { applyLocally: false }).catch(() => null);
        if (!res || !res.committed) continue;
        await D.set(meRef(rid), { ...me, seat: s, on: true });
        onDis(r(`rooms/${rid}/players/${uid}/on`)).set(false);
        return room;
      }
      throw Object.assign(new Error('full'), { code: 'full' });
    },
    async codeRoom(code) { const c = await val(`codes/${String(code).toUpperCase()}`); return c ? c.room : null; },

    // quick match: ONE waiting slot per game, taken in one transaction. Empty / stale -> my room waits in it;
    // someone waiting -> I clear it and join their room.
    async quick(game, me) {
      for (let tries = 0; tries < 6; tries++) {
        const mine = await t.createRoom({ game, mode: 'quick', max: 2, me });
        let took = null;
        const res = await D.runTransaction(r(`queue/${game}`), (cur) => {
          took = null;
          if (cur && cur.uid !== uid && now() - (cur.t || 0) < STALE) { took = cur; return null; }
          return { uid, room: mine.rid, t: now() };
        }, { applyLocally: false });
        if (!res.committed) continue;
        if (!took) {   // I wait: my slot goes when I go, and beats while I wait
          const slot = r(`queue/${game}`);
          const od = onDis(slot); od.remove();
          const beat = setInterval(() => {
            D.runTransaction(slot, (cur) => (cur === null ? null : cur.uid === uid ? { ...cur, t: now() } : undefined), { applyLocally: false }).catch(() => {});
          }, 15e3);
          return { rid: mine.rid, host: true, stop: () => { clearInterval(beat); od.cancel().catch(() => {}); discon.delete(od); } };
        }
        await t.closeRoom(mine.rid, '');   // not needed: someone was waiting
        try { const room = await t.joinRoom(took.room, me); if (room) return { rid: took.room, host: false, stop() {} }; } catch (e) { /* stale room: try again */ }
      }
      throw Object.assign(new Error('busy'), { code: 'busy' });
    },
    async unqueue(game) {
      await D.runTransaction(r(`queue/${game}`), (cur) => (!cur || cur.uid === uid ? null : undefined), { applyLocally: false }).catch(() => {});
    },

    // everything about one room, live
    watch(rid, h) {
      const offs = [];
      // the room's own fields in one listener (status / round / seed / turn arrive together, never half a restart);
      // moves and messages one by one, in order. The SDK sends only what changed over the wire.
      offs.push(D.onValue(r(`rooms/${rid}`), (s) => h.room(s.val()), () => h.error && h.error()));
      offs.push(D.onChildAdded(r(`rooms/${rid}/moves`), (s) => h.move(s.val())));
      offs.push(D.onChildAdded(r(`rooms/${rid}/msgs`), (s) => h.msg(s.val())));
      // a network switch: the SDK reconnects by itself; say I am here again and re-arm "gone" for the next drop
      let first = true;
      offs.push(D.onValue(r('.info/connected'), (s) => {
        if (!s.val()) return;
        if (first) { first = false; return; }
        D.update(meRef(rid), { on: true }).catch(() => {});
        D.onDisconnect(r(`rooms/${rid}/players/${uid}/on`)).set(false);
      }));
      return () => offs.forEach((u) => u());
    },
    // a race: the FIRST player to claim a key wins it (a transaction on the server - arrival order, not who is host)
    async claim(rid, key) {
      const res = await D.runTransaction(r(`rooms/${rid}/claims/${key}`), (cur) => (cur ? undefined : uid), { applyLocally: false });
      return res.snapshot.val();
    },
    setRoom: (rid, patch) => D.update(r(`rooms/${rid}`), patch),            // host only (rules)
    setMe: (rid, patch) => D.update(meRef(rid), patch),
    move: (rid, m, round) => D.set(D.push(r(`rooms/${rid}/moves`)), { by: uid, m, r: round, t: D.serverTimestamp() }),
    send: (rid, d, to) => D.set(D.push(r(`rooms/${rid}/msgs`)), { from: uid, d, t: D.serverTimestamp(), ...(to ? { to } : {}) }),
    serverTime: () => D.serverTimestamp(),

    // leaving: guests mark themselves gone, a host closes the room (its code and hosting with it)
    async leave(rid, isHost, code) {
      discon.forEach((o) => o.cancel().catch(() => {})); discon.clear();
      if (isHost) return t.closeRoom(rid, code);
      await D.update(meRef(rid), { left: true, on: false }).catch(() => {});
    },
    async closeRoom(rid, code) {
      await D.update(r(`rooms/${rid}`), { status: 'closed' }).catch(() => {});
      if (code) await D.remove(r(`codes/${code}`)).catch(() => {});
      await D.remove(r(`hosting/${uid}`)).catch(() => {});
      setTimeout(() => D.remove(r(`rooms/${rid}`)).catch(() => {}), 4000);   // the others read "closed" first
    },

    // "N playing now": everyone signed in with this game open
    presence(game, onCount) {
      const mine = r(`online/${game}/${uid}`);
      D.set(mine, true).catch(() => {});
      const od = D.onDisconnect(mine); od.remove();
      const off = D.onValue(r(`online/${game}`), (s) => onCount(s.size || 0), () => {});
      return () => { off(); od.cancel().catch(() => {}); D.remove(mine).catch(() => {}); };
    },
  };
  return t;
}
