// ישיבת זום · טקי-טק - /meeting (his idea 2026-11-20; plan meeting-design - his picks: 2א the picker "מי בישיבה?", 3ב the live
// screen: the tiles on top and the whole conversation below as rows, written word by word as it streams; from 3ג the speaker's
// tile lit and the cue pill "גלעד קטע את אמיר"; 4א the raised hand; 4ב "מבטל השתקה…"; the end redone in 3ב's style with
// Amir's wrap-up (summary + action items) and share / a new meeting / talk to the one who ended it).
// The engine is the server's (techietech-api/meeting.js through verseMeeting, meeting-fn.js): this page only plays its events in
// order. Hidden for now: no link anywhere, and the server answers only the owner - anyone else gets the end of the verse.
// When it opens to residents: one meeting a day (the server's count) - the used day shows "the meeting room is booked".
import { T } from './copy.js';
import { I, esc, toast, track, abs, loader } from './ui.js';
import { st, onState } from './state.js';
import { LOCAL } from './fb.js';

const M_ = () => T.meet;
const API = LOCAL ? '/api/verseMeeting' : 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseMeeting';
const TEAM = ['amir', 'ofer', 'daniel', 'ronit', 'gilad', 'yaniv'];
const HOST = 'amir';
const FEM = new Set(['ronit']);
const PIC = (id) => (typeof C !== 'undefined' && C[id] && C[id].img ? abs(C[id].img) : `https://storage.googleapis.com/shlomiverse-media/wiki/img/c/${id}.jpg`);
const NAME = (id) => (id === 'user' ? M_().you : (typeof C !== 'undefined' && C[id] && C[id].name) || id);
const ROLE = (id) => M_().role[id] || '';
const WHO = (id) => (id === 'user' ? M_().guest : NAME(id));   // in Amir's wrap-up the guest is "האורח"
const HAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11.5V4a1.5 1.5 0 0 1 3 0v7.5"/><path d="M14 11.5V5.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3.3 15.4a1.6 1.6 0 0 1 2.5-2L8 15.5V8.5a1.5 1.5 0 0 1 3 0"/></svg>';
const LEAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14"/><path d="M9 16.5 4.5 12 9 7.5M4.5 12H15"/></svg>';
const PHONE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 14.5c4.7-4.2 12.3-4.2 17 0l-1.8 2.4a1.2 1.2 0 0 1-1.5.3l-2.6-1.4a1.2 1.2 0 0 1-.6-1v-1.6a12 12 0 0 0-4 0v1.6a1.2 1.2 0 0 1-.6 1l-2.6 1.4a1.2 1.2 0 0 1-1.5-.3z"/></svg>';
const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
const BOX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/></svg>';
// Techy-Tech's own mark (its site's logo: "</> Techy-Tech", the greetings carry the same)
const TT = '<span class="mt-tt" dir="ltr"><span class="m">&lt;/&gt;</span><b>Techy-Tech</b></span>';

// ---------- the page ----------
let S = null;          // the screen's state; null = not on the page
let unsubState = null;
// main.js draws the page's box (with the loader) and loads this file only on /meeting - then mountMeeting() fills it
export function mountMeeting() {
  if (!document.querySelector('link[href="/verse/meeting.css"]')) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/verse/meeting.css' }));
  S = null;
  boot();
}
async function token() { return st.user ? st.user.getIdToken().catch(() => '') : ''; }
async function api(body, signal) {
  const tok = await token();
  return fetch(API, { method: 'POST', signal, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body) });
}
const here = () => location.pathname.replace(/\/$/, '') === '/meeting';
function root() { return document.getElementById('mt'); }

// who is this: the page waits for Firebase, then asks the server (owner only for now) - nothing on the page tells it exists
async function boot() {
  if (!here()) return;
  if (!st.ready) { if (!unsubState) unsubState = onState(() => { if (st.ready && here() && root() && !S) { unsubState(); unsubState = null; boot(); } }); return; }
  if (!st.user) return window.showNotFound();
  let r = null;
  try { r = await api({ op: 'peek' }); } catch (e) { r = null; }
  if (!here() || !root()) return;
  if (!r || !r.ok) return window.showNotFound();
  const p = await r.json().catch(() => ({}));
  document.title = `${M_().title} · ${M_().brand} · שלומיוורס`;
  S = { owner: !!p.owner, booked: !!p.booked };
  watchFit();
  if (S.booked) booked(); else pick();
}
addEventListener('vx-route', () => { if (!here() && S) { S.abort?.abort(); S = null; unwatchFit(); } });

// ---------- the phone: the page lies exactly between the bars; while typing, exactly what the keyboard leaves ----------
const vv = window.visualViewport;
function fit() {
  const el = root();
  if (!el) return;
  const kb = document.documentElement.classList.contains('kb') && vv;
  el.classList.toggle('kb', !!kb);
  if (kb) { el.style.top = vv.offsetTop + 'px'; el.style.height = vv.height + 'px'; el.style.bottom = 'auto'; }
  else if (el.style.height) el.style.top = el.style.height = el.style.bottom = '';
  if (kb && S && S.stick) toEnd();
}
let fitOn = false;
function watchFit() { if (fitOn) return; fitOn = true; vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit); addEventListener('focusin', later); addEventListener('focusout', later); }
function unwatchFit() { fitOn = false; vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit); removeEventListener('focusin', later); removeEventListener('focusout', later); }
function later() { setTimeout(fit, 60); setTimeout(fit, 350); }

const head = (extra = '') => `<header class="mt-head"><span class="mt-ttl">${esc(M_().title)}<i>·</i>${esc(M_().brand)}</span>${extra}${TT}</header>`;

// ---------- the room is booked (a resident's one meeting of the day was used) ----------
function booked() {
  const el = root(); if (!el) return;
  el.className = 'mt mt-booked';
  el.innerHTML = `${head()}<div class="mt-bk"><div class="mt-bk-faces">${['ronit', HOST, 'ofer'].map((id) => `<img src="${esc(PIC(id))}" alt="">`).join('')}</div>
    <h1>${esc(M_().bookedTitle)}</h1><p>${esc(M_().bookedLine)}</p>
    <button class="mt-btn ghost" data-talk="${HOST}">${esc(M_().bookedTalk)}</button></div>`;
  el.querySelector('[data-talk]').onclick = () => talk(HOST);
}
function talk(id) { track('meeting', 'talk:' + id); window.nav('/chat?with=' + id); }

// ---------- 2א: who is in the meeting ----------
function pick() {
  const el = root(); if (!el) return;
  const was = new Set(S.room || []);
  el.className = 'mt mt-pick';
  el.innerHTML = `${head()}<div class="mt-pk"><h1>${esc(M_().pickTitle)}</h1><p class="mt-pk-sub">${esc(M_().pickSub)}</p>
    <div class="mt-pk-list">${TEAM.map((id) => {
      const host = id === HOST;
      return `<label class="mt-pk-row${host ? ' host' : ''}"><img src="${esc(PIC(id))}" alt=""><span class="mt-pk-who"><b>${esc(NAME(id))}</b><small>${esc(ROLE(id))}</small></span>
        <span class="mt-pk-what">${esc(M_().bring[id])}</span>${host ? '' : `<input type="checkbox" value="${id}"${was.has(id) ? ' checked' : ''}><span class="mt-pk-box">${I.check}</span>`}</label>`;
    }).join('')}</div></div>
    <div class="mt-foot"><button class="mt-btn go" id="mt-go">${esc(M_().start)}</button></div>`;
  el.querySelector('#mt-go').onclick = () => {
    const room = [...el.querySelectorAll('.mt-pk-row input:checked')].map((i) => i.value);
    track('meeting', 'start:' + room.join(','));
    live([HOST, ...TEAM.filter((id) => id !== HOST && room.includes(id))]);
  };
}

// ---------- 3ב: the meeting ----------
function live(room) {
  const el = root(); if (!el) return;
  Object.assign(S, { room, everyone: room.slice(), id: null, ended: false, streaming: null, queue: [], playing: false, row: null, speaking: null, typing: null,
    hand: false, handSent: false, pending: null, floor: false, stick: true, t0: Date.now(), recap: null, ender: null, abort: new AbortController() });
  el.className = 'mt mt-live';
  el.innerHTML = `${head('<span class="mt-dot" aria-hidden="true"></span>')}
    <div class="mt-tiles" id="mt-tiles" data-n="${room.length + 1}" style="--n:${room.length + 1}">${room.map(tile).join('')}<div class="mt-tile me" data-id="user"><span class="mt-me">${esc(M_().you)}</span><span class="mt-me-hand">${HAND}</span></div></div>
    <div class="mt-stage"><div class="mt-handbar" id="mt-handbar" hidden>${HAND}<span></span></div><div class="mt-cue" id="mt-cue" hidden></div>
      <div class="mt-log" id="mt-log"><div class="mt-sys">${esc(M_().starting)}</div></div><button class="mt-new" id="mt-new" hidden>${esc(M_().newer)}</button></div>
    <form class="mt-box" id="mt-box" autocomplete="off"><input id="mt-in" enterkeyhint="send" maxlength="600" placeholder="${esc(M_().placeholder)}" aria-label="${esc(M_().placeholder)}">
      <button type="button" class="mt-hand" id="mt-hand" aria-label="${esc(M_().handLabel)}">${HAND}</button><button class="mt-send" id="mt-send" aria-label="${esc(M_().sendLabel)}">${I.send}</button></form>`;
  const log = el.querySelector('#mt-log'), inp = el.querySelector('#mt-in');
  log.addEventListener('scroll', () => { S.stick = log.scrollHeight - log.scrollTop - log.clientHeight < 60; if (S.stick) el.querySelector('#mt-new').hidden = true; }, { passive: true });
  el.querySelector('#mt-new').onclick = () => { S.stick = true; toEnd(true); };
  inp.addEventListener('input', () => { el.querySelector('#mt-box').classList.toggle('has', !!inp.value.trim()); if (inp.value.trim()) raise(); });
  el.querySelector('#mt-hand').onclick = () => { raise(); inp.focus(); };
  el.querySelector('#mt-box').onsubmit = (e) => { e.preventDefault(); const t = inp.value.trim(); if (!t || S.ended || S.pending) return; inp.value = ''; el.querySelector('#mt-box').classList.remove('has'); say(t); };
  stream({ op: 'start', room });
}
const tile = (id) => `<div class="mt-tile" data-id="${id}"><img src="${esc(PIC(id))}" alt=""><span class="mt-un">${esc(M_().unmuting(FEM.has(id)))}</span><span class="mt-nm"><b>${esc(NAME(id))}</b><small>${esc(ROLE(id))}</small></span></div>`;
const tiles = () => [...(root()?.querySelectorAll('.mt-tile') || [])];

// the server's stream: one event a line of ndjson; they play in order (playback paces the words)
async function stream(body) {
  const me = S, gen = me.gen = (me.gen || 0) + 1;   // a 'floor' of an older round, still playing, never gives the floor back
  let res;
  const p = (async () => {
    try {
      res = await api(body, me.abort.signal);
      if (res.status === 429) { me.booked = true; return booked(); }
      if (!res.ok || !res.body) throw new Error('http ' + res.status);
      const rd = res.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await rd.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) { try { push(me, { ...JSON.parse(l), _g: gen }); } catch (x) { /* a broken line */ } } }
      }
    } catch (e) {
      if (me.abort.signal.aborted) return;
      push(me, { t: 'error', _g: gen }); push(me, { t: 'floor', _g: gen });
    }
  })();
  me.streaming = p;
  await p;
  if (me.streaming === p) me.streaming = null;
}
function push(me, e) { if (S !== me) return; me.queue.push(e); if (!me.playing) play(me); }

// ---------- playback: lines in order, each written word by word ----------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function play(me) {
  me.playing = true;
  while (me.queue.length && S === me) {
    const e = me.queue.shift();
    if (e.t === 'delta') { line(me, e.who).target += e.text; kick(me); continue; }
    if (e.t === 'cut') { const r = line(me, e.who); r.target = e.text; r.cut = true; r.by = e.by; kick(me); continue; }
    if (e.t === 'line') { const r = line(me, e.who); r.target = e.text; r.cut = !!e.cut; r.final = true; kick(me); await r.done; await wait(r.cut ? 120 : 420); finish(me, r); continue; }
    if (e.t === 'meeting') { me.id = e.id; continue; }
    if (e.t === 'typing') { me.typing = e.who; paintTiles(me); handBar(me); continue; }
    if (e.t === 'guest') { addRow(me, 'user', e.text, true); continue; }
    if (e.t === 'left') { await wait(250); sys(me, M_().left(NAME(e.who), FEM.has(e.who)), LEAVE, 'left'); gone(me, e.who); await wait(500); continue; }
    if (e.t === 'floor') { if (e._g !== me.gen) continue; me.floor = true; me.typing = null; me.speaking = null; paintTiles(me); handBar(me); continue; }
    if (e.t === 'end') { ended(me, e.who); continue; }
    if (e.t === 'recap') { me.recap = e.recap; recapCard(me); continue; }
    if (e.t === 'error') { sys(me, M_().drop, '', 'err'); continue; }
  }
  me.playing = false;
}
// the row being written for `who` (made at its first words)
function line(me, who) {
  if (me.row && me.row.who === who && !me.row.closed) return me.row;
  const r = { who, target: '', shown: 0, cut: false, final: false, closed: false };
  r.done = new Promise((ok) => (r.ok = ok));
  r.el = addRow(me, who, '', false);
  me.row = r; me.typing = null; me.speaking = who; paintTiles(me); handBar(me);
  return r;
}
// the words appear one by one at a talking pace (faster when far behind the stream)
function kick(me) {
  const r = me.row;
  if (!r || r.timer) return;
  const step = () => {
    r.timer = null;
    if (S !== me) return;
    const words = r.target.split(/(\s+)/);
    if (r.shown < words.length) {
      const far = words.length - r.shown;
      r.shown = Math.min(words.length, r.shown + (far > 40 ? 4 : 2));   // a word and its space
      r.el.querySelector('.mt-tx').innerHTML = fmt(words.slice(0, r.shown).join(''));
      if (me.stick) toEnd(); else newer();
    }
    if (r.shown >= words.length) { if (r.final) { r.el.querySelector('.mt-tx').innerHTML = fmt(r.target); r.ok(); } return; }
    r.timer = setTimeout(step, behind(r) > 40 ? 30 : 75);
  };
  r.timer = setTimeout(step, 0);
}
const behind = (r) => r.target.split(/(\s+)/).length - r.shown;
function finish(me, r) {
  r.closed = true;
  r.el.classList.remove('now');
  if (r.cut) { r.el.classList.add('cut'); if (r.by) sys(me, M_().cut(NAME(r.by), NAME(r.who), FEM.has(r.by)), '', 'cut'); }   // its own line in the history, under the cut line (a floating pill covered the rows - his first look 2026-11-20)
  if (me.speaking === r.who) me.speaking = null;
  paintTiles(me);
}
// a line as the page shows it: a stage action <...> dim and slanted, one still being written hidden until it closes
function fmt(t) {
  return esc(String(t).replace(/\[\[[^\]]*\]?\]?/g, '').replace(/<[^<>]*$/, '')).replace(/&lt;([^&]{1,80}?)&gt;/g, '<i class="mt-act">$1</i>');
}
function addRow(me, who, text, done) {
  const log = root()?.querySelector('#mt-log'); if (!log) return null;
  const el = document.createElement('div');
  el.className = `mt-row${who === 'user' ? ' me' : ''}${done ? '' : ' now'}`;
  el.innerHTML = `${who === 'user' ? `<span class="mt-av me">${I.person}</span>` : `<img class="mt-av" src="${esc(PIC(who))}" alt="">`}
    <div class="mt-bub"><div class="mt-who"><b>${esc(NAME(who))}</b>${who === 'user' ? '' : `<small>${esc(ROLE(who))}</small>`}</div><div class="mt-tx">${fmt(text)}</div></div>`;
  log.append(el);
  if (done && who === 'user') { me.stick = true; toEnd(true); } else if (me.stick) toEnd(); else newer();
  return el;
}
function sys(me, text, icon = '', cls = '') {
  const log = root()?.querySelector('#mt-log'); if (!log) return;
  log.insertAdjacentHTML('beforeend', `<div class="mt-sys ${cls}">${icon}<span>${esc(text)}</span></div>`);
  if (me.stick) toEnd(); else newer();
}
function toEnd(smooth) { const log = root()?.querySelector('#mt-log'); if (log) log.scrollTo({ top: log.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); }
function newer() { const b = root()?.querySelector('#mt-new'); if (b) b.hidden = false; }
let cueTimer = null;
function cue(text) {
  const c = root()?.querySelector('#mt-cue'); if (!c) return;
  c.textContent = text; c.hidden = false; c.classList.remove('go'); void c.offsetWidth; c.classList.add('go');
  clearTimeout(cueTimer); cueTimer = setTimeout(() => { c.hidden = true; }, 2600);
}
// the tiles: the one talking lit, the one whose line is being made "unmuting…", your own lit while it is your turn
function paintTiles(me) {
  for (const t of tiles()) {
    const id = t.dataset.id;
    t.classList.toggle('talk', id === me.speaking);
    t.classList.toggle('un', id === me.typing && id !== me.speaking);
    if (id === 'user') { t.classList.toggle('turn', me.floor && !me.ended); t.classList.toggle('hand', me.hand && !me.floor); }
  }
}
function gone(me, who) {
  me.room = me.room.filter((x) => x !== who);
  const t = root()?.querySelector(`.mt-tile[data-id="${who}"]`);
  if (!t) return;
  t.classList.add('bye');
  setTimeout(() => { t.remove(); const g = root()?.querySelector('#mt-tiles'); if (g) { g.style.setProperty('--n', me.room.length + 1); g.dataset.n = me.room.length + 1; } }, 450);
}

// ---------- 4א: typing = a raised hand; the floor is yours after the line in the air ----------
function raise() {
  const me = S;
  if (!me || me.ended || me.floor || !me.id || me.handSent) return;
  me.handSent = true; me.hand = true;
  track('meeting', 'hand');
  api({ op: 'hand', id: me.id }).catch(() => {});
  paintTiles(me); handBar(me);
}
function handBar(me) {
  const b = root()?.querySelector('#mt-handbar'); if (!b) return;
  const on = me.hand && !me.floor && !me.ended;
  b.hidden = !on;
  if (on) b.querySelector('span').textContent = M_().hand(me.speaking || me.typing ? NAME(me.speaking || me.typing) : '');
  const inp = root()?.querySelector('#mt-in');
  if (inp) inp.placeholder = me.floor && !me.ended ? M_().yourTurn : M_().placeholder;
}
// sending while the team still talks: the hand is up, the line in the air ends, that round's stream ends - then your words
async function say(text) {
  const me = S;
  me.pending = text;
  track('meeting', 'say');
  if (!me.floor) raise();
  while (me.streaming && S === me) await me.streaming.catch(() => {});
  while (!me.id && S === me) await wait(200);
  if (S !== me || me.ended) return;
  me.pending = null; me.hand = false; me.handSent = false; me.floor = false;
  paintTiles(me); handBar(me);
  stream({ op: 'say', id: me.id, text });
}

// ---------- the end (his note on 5א: redone in 3ב's style, with the wrap-up + actions) ----------
function ended(me, who) {
  me.ended = true; me.ender = who; me.floor = false; me.hand = false; me.typing = null; me.speaking = null;
  paintTiles(me); handBar(me);
  sys(me, M_().ended(NAME(who), FEM.has(who)), PHONE_OFF, 'end');
  const el = root(); if (!el) return;
  el.classList.add('done');
  el.querySelector('.mt-dot')?.remove();
  el.querySelector('#mt-box')?.remove();
  document.activeElement?.blur?.();
  const log = el.querySelector('#mt-log');
  log.insertAdjacentHTML('beforeend', `<section class="mt-recap wait" id="mt-recap"><div class="mt-rc-k">${esc(M_().recapKicker)}</div><div class="mt-rc-wait"><img src="${esc(PIC(HOST))}" alt=""><span>${esc(M_().recapWriting)}</span></div></section>`);
  el.querySelector('.mt-stage').insertAdjacentHTML('afterend', `<div class="mt-acts"><button class="mt-btn go" data-a="again">${esc(M_().again)}</button><button class="mt-btn ghost" data-a="share">${I.share}${esc(M_().share)}</button><button class="mt-btn ghost" data-a="talk">${esc(M_().talk(NAME(who)))}</button></div>`);
  el.querySelector('.mt-acts').onclick = (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'again') { track('meeting', 'again'); S.abort?.abort(); again(); }
    if (a === 'share') share(me);
    if (a === 'talk') talk(who);
  };
  me.stick = true; toEnd(true);
}
async function again() {
  const room = S.room;
  S = { owner: S.owner, room };
  const el = root(); if (el) el.innerHTML = loader();
  let p = {};
  try { const r = await api({ op: 'peek' }); p = r.ok ? await r.json() : {}; } catch (e) { p = {}; }
  if (!S) return;
  if (p.booked) booked(); else pick();
}
function recapCard(me) {
  const box = root()?.querySelector('#mt-recap'); if (!box) return;
  const R = me.recap || {};
  const mins = Math.max(1, Math.round((Date.now() - me.t0) / 60000));
  const face = (id) => (id === 'user' ? `<span class="mt-rc-av me">${I.person}</span>` : `<img class="mt-rc-av" src="${esc(PIC(id))}" alt="">`);
  const date = new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  const all = me.everyone || me.room || [];   // everyone who was in it (the ones who left too)
  box.className = 'mt-recap';
  box.innerHTML = `<div class="mt-rc-top"><div class="mt-rc-k">${esc(M_().recapKicker)}</div>${TT}</div>
    ${R.title ? `<h2>${esc(R.title)}</h2>` : ''}
    <div class="mt-rc-meta"><span class="mt-rc-faces">${all.map((id) => `<img src="${esc(PIC(id))}" alt="">`).join('')}<span class="me">${I.person}</span></span><span>${esc(date)}</span><i>·</i><span class="mt-rc-min">${CLOCK}${esc(M_().minutes(mins))}</span></div>
    ${R.summary ? `<p class="mt-rc-sum">${esc(R.summary)}</p>` : ''}
    ${(R.points || []).length ? `<h3>${esc(M_().recapSaid)}</h3><ul class="mt-rc-pts">${R.points.map((x) => `<li>${face(x.who)}<span><b>${esc(WHO(x.who))}</b> ${esc(x.text)}</span></li>`).join('')}</ul>` : ''}
    ${(R.items || []).length ? `<h3 class="ai">${esc(M_().recapItems)}</h3><ul class="mt-rc-items">${R.items.map((x) => `<li><span class="bx">${BOX}</span><span class="tx">${esc(x.text)}</span><span class="own">${face(x.who)}<b>${esc(NAME(x.who))}</b></span></li>`).join('')}</ul>` : ''}
    ${R.next ? `<p class="mt-rc-next">${esc(R.next)}</p>` : ''}
    <div class="mt-rc-sign"><img src="${esc(PIC(HOST))}" alt=""><span><b>${esc(NAME(HOST))}</b><small>${esc(ROLE(HOST))} · ${esc(M_().brand)}</small></span></div>`;
  // the wrap-up from its top, the closing line and "סיים את הפגישה" just above it
  const log = root()?.querySelector('#mt-log');
  if (log && me.stick) log.scrollTo({ top: Math.max(0, box.offsetTop - 130), behavior: 'smooth' }); else newer();
}
// share = the wrap-up as text (navigator.share, else copied)
async function share(me) {
  const R = me.recap || {};
  const text = [M_().shareHead, R.title || '', '', R.summary || '',
    ...((R.points || []).length ? ['', M_().recapSaid + ':', ...R.points.map((x) => `- ${WHO(x.who)}: ${x.text}`)] : []),
    ...((R.items || []).length ? ['', M_().recapItems + ':', ...R.items.map((x) => `- ${x.text} (${WHO(x.who)})`)] : []),
    ...(R.next ? ['', R.next] : []), '', `${NAME(HOST)} · ${ROLE(HOST)} · ${M_().brand}`, 'shlomiverse.com'].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  track('meeting', 'share');
  try { if (navigator.share) { await navigator.share({ title: M_().shareHead, text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast(M_().copied); } catch (e) { toast(M_().copied); }
}
