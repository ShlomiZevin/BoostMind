// Syncs - Techy-Tech's meeting app, its own page: /syncs (public/syncs/index.html; was ישיבת זום at /meeting, then a page inside the
// verse). His idea 2026-11-20; plan meeting-design - his picks: 2א the picker, 3ב the live screen: the tiles on top and the whole
// conversation below as rows, written word by word as it streams; 3ג the speaker lit; 4א the raised hand; the end in 3ב's style with
// Amir's wrap-up.
// Round 3 (his notes - "a REAL product, like a real Zoom"): full screen, a way out, the picker = face, name, title; no "guest" - the
// visitor is their own face and Shlomiverse name with the corporate title the meeting gives them; Daniel never finishes a sentence.
// Round 4 (his notes after the demo - "do it right, not patches", RTL first, pro): its own page with its own loader (the logo's sync
// arrows turning - never the Shlomiverse's), a real app bar (brand, the state - live / recording -, running time, how many on the
// call, the way out), the tiles row IS the speakers queue (who talks lit, who is next marked with their pre-talk moment, a cut shows
// on the tile: "על השתק"), "<who> שם את <who> על השתק" the moment a line is cut, the history pinned to its last line, the action
// items as their own block, the end = back to the Shlomiverse + share (a link to THIS meeting: /syncs/m/<id>, a public read-only page
// with its own WhatsApp preview - verseMeeting renders it), a recording plays with a playback bar.
// Modes: live (signed in, owner only for now - anyone else gets the end of the verse), demo (?demo=1: a recorded meeting, demo.json,
// no sign-in, no server), shared (/syncs/m/<id>: the server puts the meeting in #s-data).
import { T } from '/verse/copy.js';
import { I, esc, toast } from '/verse/ui.js';

const M_ = () => T.meet;
const LOCAL = /^(localhost|127\.)/.test(location.hostname);
const API = LOCAL ? '/api/verseMeeting' : 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseMeeting';
const SITE = LOCAL ? location.origin : 'https://shlomiverse.com';
const TEAM = ['amir', 'ofer', 'daniel', 'ronit', 'gilad', 'yaniv'];
const HOST = 'amir';
const FEM = new Set(['ronit']);
const PIC = (id) => `https://storage.googleapis.com/shlomiverse-media/wiki/img/c/${id}.jpg`;
const track = (e, x) => { try { window.track && window.track(e, x); } catch (er) { /* analytics never breaks the app */ } };
// the visitor: their Shlomiverse name and the title this meeting gave them
const VIS = () => (S && S.visitor) || {};
const vName = () => VIS().name || '';
const NAME = (id) => (id === 'user' ? vName() || VIS().title || M_().you : M_().names[id] || id);
const ROLE = (id) => (id === 'user' ? (vName() ? VIS().title || '' : '') : M_().role[id] || '');

const svg = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const HAND = svg('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11.5V4a1.5 1.5 0 0 1 3 0v7.5"/><path d="M14 11.5V5.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3.3 15.4a1.6 1.6 0 0 1 2.5-2L8 15.5V8.5a1.5 1.5 0 0 1 3 0"/>', 1.8);
const LEAVE = svg('<path d="M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14"/><path d="M9 16.5 4.5 12 9 7.5M4.5 12H15"/>');
const PHONE_OFF = svg('<path d="M3.5 14.5c4.7-4.2 12.3-4.2 17 0l-1.8 2.4a1.2 1.2 0 0 1-1.5.3l-2.6-1.4a1.2 1.2 0 0 1-.6-1v-1.6a12 12 0 0 0-4 0v1.6a1.2 1.2 0 0 1-.6 1l-2.6 1.4a1.2 1.2 0 0 1-1.5-.3z"/>');
const CLOCK = svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>');
const PEOPLE = svg('<circle cx="9" cy="8.5" r="3.3"/><path d="M2.8 19.5c.7-3.3 3.2-5.3 6.2-5.3s5.5 2 6.2 5.3"/><path d="M15.6 5.4a3.3 3.3 0 0 1 0 6.3M17.6 14.4c1.9.7 3.2 2.5 3.6 5.1"/>');
const MUTE = svg('<path d="M9 9v2.5a3 3 0 0 0 5.1 2.1M15 10.5V6a3 3 0 0 0-5.9-.8"/><path d="M18.5 11.5a6.5 6.5 0 0 1-1.2 3.8M5.5 11.5a6.5 6.5 0 0 0 10.2 5.3M12 18v3"/><path d="m4 4 16 16"/>');
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const REPLAY = svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4"/><path d="M4.5 4.5v4h4"/>');
const WA = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.4 4.8 4.9-1.3A9.8 9.8 0 1 0 12 2.2zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11 11 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.5 2.5 0 0 0 1.7-1.2 2 2 0 0 0 .1-1.2c0-.2-.2-.2-.4-.3z"/></svg>';
const LOCK = svg('<rect x="5.5" y="11" width="13" height="9" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>', 2.2);
const CHECK = svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.6);
const TT = '<span class="mt-tt" dir="ltr"><b>Syncs</b><i>·</i><span class="m">&lt;/&gt;</span><b>Techy-Tech</b></span>';

// Syncs' own loader (his ask round 4): the logo rebuilt in SVG - the camera with its people, the two sync arrows turning around it
export const LOADER_SVG = `<svg class="sy-logo" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="syg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a2e"/><stop offset="1" stop-color="#ff5508"/></linearGradient></defs>
<rect x="6" y="6" width="108" height="108" rx="30" fill="url(#syg)"/><g class="sy-arrows" fill="#ffd21f" stroke="#ffd21f" stroke-width="7" stroke-linecap="round"><path fill="none" d="M27 39 A39 39 0 0 1 89 35"/><path stroke="none" d="M97.5 44 L84.5 41 L93 30.5Z"/><path fill="none" d="M93 81 A39 39 0 0 1 31 85"/><path stroke="none" d="M22.5 76 L35.5 79 L27 89.5Z"/></g>
<g class="sy-cam"><rect x="31" y="46" width="44" height="28" rx="7" fill="#fff"/><path d="M76.5 56 L89 48.5 V71.5 L76.5 64 Z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="53" cy="56.5" r="4.6" fill="#ff6a1f"/><path d="M45 70.5a8 7 0 0 1 16 0Z" fill="#ff6a1f"/><circle cx="42.5" cy="58.5" r="3.4" fill="#ffab6b"/><path d="M37 70.5a5.5 5.5 0 0 1 11 0Z" fill="#ffab6b"/><circle cx="63.5" cy="58.5" r="3.4" fill="#ffab6b"/><path d="M58 70.5a5.5 5.5 0 0 1 11 0Z" fill="#ffab6b"/></g></svg>`;
const loaderHtml = (line = '') => `<div class="sy-load" role="status" aria-label="Syncs">${LOADER_SVG}<b dir="ltr">Syncs</b>${line ? `<span>${esc(line)}</span>` : ''}</div>`;

// ---------- the page ----------
let S = null;          // the screen's state
let auth = null;       // the verse's account (state.js), loaded only for the live tool
const root = () => document.getElementById('mt');
const shared = (() => { try { return JSON.parse(document.getElementById('s-data')?.textContent || 'null'); } catch (e) { return null; } })();
const sharePath = /^\/syncs\/m\/[^/]+/.test(location.pathname);
const demoAsked = () => new URLSearchParams(location.search).get('demo') === '1';
// a preview key (/syncs?k=<key> - his ask: a Marketing session with no Google account): kept for this tab, off the address at once;
// the server knows only its hash and gives it its own day limit
const KEY = (() => {
  try {
    const u = new URL(location.href), k = u.searchParams.get('k');
    if (k) { sessionStorage.setItem('syncs-k', k); u.searchParams.delete('k'); history.replaceState(null, '', u.pathname + u.search); }
    return sessionStorage.getItem('syncs-k') || '';
  } catch (e) { return ''; }
})();

async function api(body, signal) {
  const tok = auth && auth.st.user ? await auth.st.user.getIdToken().catch(() => '') : '';
  return fetch(API, { method: 'POST', signal, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...(KEY ? { 'x-syncs-key': KEY } : {}) }, body: JSON.stringify(body) });
}
// signed out, not the owner, a meeting nobody shared: what any address that isn't there shows - the end of the verse
function notFound() {
  document.title = M_().nfDoc;
  const el = root(); if (!el) return;
  el.className = 'mt mt-nf';
  el.innerHTML = `<div class="eov"><h1>${esc(M_().nfTitle)}</h1><p>${esc(M_().nfLine)}</p><a class="eov-home" href="/">${esc(M_().nfHome)}<span class="eov-wm">שלומי<b>וורס</b></span></a></div>`;
}

async function boot() {
  watchFit();
  if (sharePath) return shared ? sharedView(shared) : notFound();
  if (demoAsked()) return demo();
  if (KEY) {   // the preview key: no account - the server says who this is ("צוות השיווק")
    let k = null;
    try { k = await api({ op: 'peek' }); } catch (e) { k = null; }
    if (k && k.ok) {
      const p = await k.json().catch(() => ({}));
      S = { mode: 'live', owner: !!p.more, booked: !!p.booked, visitor: { name: p.name || '', photo: '' } };
      return S.booked ? booked() : pick();
    }
  }
  // the live tool: the verse's account (Firebase) - who they are, their name and face
  const [{ st, onState }] = await Promise.all([import('/verse/state.js')]);
  auth = { st };
  if (!st.ready) await new Promise((ok) => { const off = onState(() => { if (st.ready) { off(); ok(); } }); });
  if (!st.user) return notFound();
  let r = null;
  try { r = await api({ op: 'peek' }); } catch (e) { r = null; }
  if (!r || !r.ok) return notFound();
  const p = await r.json().catch(() => ({}));
  S = { mode: 'live', owner: !!(p.more || p.owner), booked: !!p.booked, visitor: me0() };
  if (S.booked) booked(); else pick();
}
const me0 = () => ({ name: (auth?.st.fan && auth.st.fan.nick) || '', photo: (auth?.st.fan && auth.st.fan.photo) || '' });

// ---------- the phone: the page is the whole screen; while typing, exactly what the keyboard leaves ----------
const vv = window.visualViewport;
let tallest = vv ? vv.height : innerHeight;
function fit() {
  const el = root(); if (!el) return;
  const f = document.activeElement, typing = !!(f && f.matches && f.matches('input, textarea'));
  const h = vv ? vv.height : innerHeight;
  if (!typing || h > tallest) tallest = Math.max(tallest, h);
  const kb = typing && !!vv && tallest - h > 120;
  el.classList.toggle('kb', kb);
  if (kb) { el.style.top = vv.offsetTop + 'px'; el.style.height = vv.height + 'px'; el.style.bottom = 'auto'; }
  else if (el.style.height) el.style.top = el.style.height = el.style.bottom = '';
  pin();
}
function watchFit() {
  vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit);
  addEventListener('focusin', () => { fit(); setTimeout(fit, 350); }); addEventListener('focusout', () => setTimeout(fit, 60));
}

// ---------- the app bar: brand · the state + running time + who is on the call · the way out ----------
function bar(kind = '') {
  return `<header class="mt-bar"><div class="mt-brand"><img src="/verse/art/syncs-icon.png" alt="" width="36" height="36"><span><b dir="ltr">Syncs</b><small dir="ltr">Let's circle back</small></span></div>
    <div class="mt-meta" id="mt-meta">${kind ? meta(kind) : ''}</div>
    <button class="mt-out" id="mt-out" aria-label="${esc(M_().out)}">${LEAVE}<span>${esc(M_().out)}</span></button></header>`;
}
// the state: a live meeting you are in / a recording playing / a meeting that ended / a shared wrap-up
function meta(kind) {
  const badge = { live: `<span class="mt-badge live"><i></i>${esc(M_().live)}</span>`, rec: `<span class="mt-badge rec">${esc(M_().recorded)}${PLAY}</span>`,
    ended: `<span class="mt-badge ended">${esc(M_().endedBadge)}</span>`, shared: `<span class="mt-badge rec">${esc(M_().recapKicker)}</span>` }[kind] || '';
  const n = S && (S.everyone || S.room) ? (S.everyone || S.room).length + 1 : 0;
  return `${badge}<span class="mt-info"><span class="mt-time" id="mt-time">${CLOCK}<b>${clock(S && S.t0 ? Date.now() - S.t0 : 0)}</b></span>${n ? `<i>·</i><span>${PEOPLE}<b>${n}</b></span>` : ''}</span>`;
}
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
function setMeta(kind) { const m = root()?.querySelector('#mt-meta'); if (m) m.innerHTML = meta(kind); }
let ticker = null;
function tick() {
  clearInterval(ticker);
  ticker = setInterval(() => {
    if (!S || S.ended) return clearInterval(ticker);
    const t = root()?.querySelector('#mt-time b'); if (t) t.textContent = clock((S.mode === 'demo' ? S.demoNow() : Date.now()) - S.t0);
    if (S.mode === 'demo') playbar();
  }, 500);
}
function bindOut(el) { el.querySelector('#mt-out').onclick = () => { track('meeting', 'out'); S?.abort?.abort(); location.href = '/'; }; }

// ---------- the room is booked (a resident's one meeting of the day was used) ----------
function booked() {
  const el = root(); if (!el) return;
  el.className = 'mt mt-booked';
  el.innerHTML = `${bar()}<div class="mt-bk"><div class="mt-bk-faces">${['ronit', HOST, 'ofer'].map((id) => `<img src="${esc(PIC(id))}" alt="">`).join('')}</div>
    <h1>${esc(M_().bookedTitle)}</h1><p>${esc(M_().bookedLine)}</p><a class="mt-btn ghost" href="/">${esc(M_().back)}</a></div>`;
  bindOut(el);
}

// ---------- who is in the meeting - face, name, title ----------
function pick() {
  const el = root(); if (!el) return;
  const was = new Set(S.room || []);
  el.className = 'mt mt-pick';
  el.innerHTML = `${bar()}<div class="mt-pk"><h1>${esc(M_().pickTitle)}</h1>
    <div class="mt-pk-list">${TEAM.map((id) => {
      const host = id === HOST;
      return `<label class="mt-pk-row${host ? ' host' : ''}"><img src="${esc(PIC(id))}" alt=""><span class="mt-pk-who"><b>${esc(NAME(id))}</b><small>${esc(M_().roleFull[id])}</small></span>
        <input type="checkbox" value="${id}"${host || was.has(id) ? ' checked' : ''}${host ? ' disabled' : ''}><span class="mt-pk-box">${host ? LOCK : CHECK}</span></label>`;
    }).join('')}</div></div>
    <div class="mt-foot"><button class="mt-btn go" id="mt-go">${esc(M_().start)}</button></div>`;
  bindOut(el);
  el.querySelector('#mt-go').onclick = () => {
    const room = [...el.querySelectorAll('.mt-pk-row input:checked')].map((i) => i.value);
    track('meeting', 'start:' + room.join(','));
    live([HOST, ...TEAM.filter((id) => id !== HOST && room.includes(id))]);
  };
}

// ---------- the meeting ----------
function live(room, opts = {}) {
  const el = root(); if (!el) return;
  const demoMode = !!opts.demo;
  Object.assign(S, { room, everyone: room.slice(), id: null, ended: false, streaming: null, queue: [], playing: false, row: null, speaking: null, typing: null,
    hand: false, handSent: false, pending: null, floor: false, stick: true, t0: Date.now(), recap: null, ender: null, next: null, notes: {}, muted: {},
    abort: new AbortController(), mode: demoMode ? 'demo' : 'live', started: false });
  if (!demoMode) S.rec = [];   // every event with its time: "לצפות שוב" replays THIS meeting (no server), and record-demo.cjs records the demo
  el.className = `mt mt-live${demoMode ? ' demo' : ''}`;
  // the bar and the tiles row in one panel, the playback panel at the bottom (concept 2 of bars-mockups.jpg, his pick)
  el.innerHTML = `<div class="mt-top">${bar(demoMode ? 'rec' : 'live')}
    <div class="mt-tiles" id="mt-tiles">${room.map(tile).join('')}${meTile()}</div></div>
    <div class="mt-stage"><div class="mt-log" id="mt-log"><div class="mt-rows" id="mt-rows">${demoMode ? '' : `<div class="mt-wait" id="mt-wait">${loaderHtml(M_().joining)}</div>`}</div></div><button class="mt-new" id="mt-new" hidden>${esc(M_().newer)}</button></div>
    ${demoMode ? `<div class="mt-play" id="mt-play"><div class="mt-pl-mid"><b><span class="mt-pl-ic">${PLAY}</span>${esc(M_().demoBar)}</b>
      <div class="mt-pl-row" dir="ltr"><span class="mt-pl-t" id="mt-pl-t">00:00 / 00:00</span><span class="mt-pl-line"><i id="mt-pl-fill"></i><em id="mt-pl-knob"></em></span></div></div>
      <span class="mt-pl-div"></span><button class="mt-replay" id="mt-replay" aria-label="${esc(M_().demoAgain)}">${REPLAY}</button></div>`
    : `<form class="mt-box" id="mt-box" autocomplete="off"><input id="mt-in" enterkeyhint="send" maxlength="600" placeholder="${esc(M_().placeholder)}" aria-label="${esc(M_().placeholder)}">
      <button type="button" class="mt-hand" id="mt-hand" aria-label="${esc(M_().handLabel)}">${HAND}</button><button class="mt-send" id="mt-send" aria-label="${esc(M_().sendLabel)}">${I.send}</button></form>`}`;
  bindOut(el);
  watchLog();
  tick();
  if (demoMode) { el.querySelector('#mt-replay').onclick = () => { track('meeting', 'demo-again'); demo(); }; return; }
  const inp = el.querySelector('#mt-in');
  inp.addEventListener('input', () => { el.querySelector('#mt-box').classList.toggle('has', !!inp.value.trim()); if (inp.value.trim()) raise(); });
  el.querySelector('#mt-hand').onclick = () => { raise(); inp.focus(); };
  el.querySelector('#mt-box').onsubmit = (e) => { e.preventDefault(); const t = inp.value.trim(); if (!t || S.ended || S.pending) return; inp.value = ''; el.querySelector('#mt-box').classList.remove('has'); say(t); };
  stream({ op: 'start', room });
}
// a tile: the face, the name; a tag on top (next / cutting in) and a band over the face for what they are doing right now
const tile = (id) => `<div class="mt-tile" data-id="${id}"><img src="${esc(PIC(id))}" alt=""><span class="mt-tag"></span><span class="mt-un"></span><span class="mt-ic"></span><span class="mt-nm"><b>${esc(NAME(id))}</b></span></div>`;
const meFace = (cls) => (VIS().photo ? `<img class="${cls}" src="${esc(VIS().photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="${cls} ini">${esc((vName() || '?').trim()[0] || '?')}</span>`);
const meTile = () => `<div class="mt-tile me" data-id="user">${meFace('mt-me-face')}<span class="mt-tag"></span><span class="mt-un"></span><span class="mt-ic"></span><span class="mt-nm"><b>${esc(vName() || M_().you)}</b></span></div>`;
function paintMe() { const t = root()?.querySelector('.mt-tile.me'); if (t) t.outerHTML = meTile(); if (S) paintTiles(S); }
const tiles = () => [...(root()?.querySelectorAll('.mt-tile') || [])];

// the server's stream: one event a line of ndjson; they play in order (playback paces the words)
async function stream(body) {
  const me = S, gen = me.gen = (me.gen || 0) + 1;   // a 'floor' of an older round, still playing, never gives the floor back
  const p = (async () => {
    try {
      const res = await api(body, me.abort.signal);
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
function push(me, e) {
  if (S !== me) return;
  if (me.rec) { const { _g, ...x } = e; me.rec.push({ at: Date.now() - me.t0, e: x }); }   // recording a demo (?rec=1)
  me.queue.push(e); if (!me.playing) play(me);
}

// ---------- playback: lines in order, each written word by word ----------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function play(me) {
  me.playing = true;
  while (me.queue.length && S === me) {
    const e = me.queue.shift();
    if (!me.started && e.t !== 'meeting' && e.t !== 'visitor') { me.started = true; root()?.querySelector('#mt-wait')?.remove(); sys(me, M_().starting); }
    if (e.t === 'delta') { line(me, e.who).target += e.text; kick(me); continue; }
    if (e.t === 'cut') { const r = line(me, e.who); r.target = e.text; r.cut = true; r.by = e.by; kick(me); continue; }
    if (e.t === 'line') {
      const r = line(me, e.who); r.target = e.text; r.cut = !!e.cut; r.final = true; kick(me);
      await r.done;
      if (r.cut && r.by) muted(me, r);   // the moment the line stops: "<who> שם את <who> על השתק"
      await wait(r.cut ? 260 : 420);
      finish(me, r); continue;
    }
    if (e.t === 'meeting') { me.id = e.id; continue; }
    if (e.t === 'visitor') { me.visitor = { ...me.visitor, name: e.name || me.visitor.name || '', title: e.title || '' }; paintMe(); continue; }
    if (e.t === 'next') { upNext(me, e.who, e.cut); continue; }
    if (e.t === 'typing') { me.typing = e.who; if (!me.notes[e.who]) upNext(me, e.who, false); paintTiles(me); continue; }
    if (e.t === 'guest') { if (me.next === 'user') me.next = null; me.floor = false; me.hand = false; addRow(me, 'user', e.text, true); paintTiles(me); continue; }
    if (e.t === 'away') { sys(me, M_().away(NAME(e.who), FEM.has(e.who), e.holy), '', 'left'); gone(me, e.who); continue; }   // Shabbat / a holiday they keep (the chat's [[away]])
    if (e.t === 'left') { await wait(250); sys(me, M_().left(NAME(e.who), FEM.has(e.who)), LEAVE, 'left'); gone(me, e.who); await wait(500); continue; }
    if (e.t === 'floor') { if (e._g !== me.gen) continue; me.floor = true; me.typing = null; me.speaking = null; if (me.next !== 'user') me.next = null; paintTiles(me); placeholder(me); continue; }
    if (e.t === 'end') { ended(me, e.who); continue; }
    if (e.t === 'recap') { me.recap = e.recap; recapCard(me); continue; }
    if (e.t === 'error') { sys(me, M_().drop, '', 'err'); continue; }
    if (e.t === '_hand') { me.hand = true; paintTiles(me); continue; }   // the demo: the visitor raised a hand here
  }
  me.playing = false;
}
// the row being written for `who` (made at its first words): they leave the queue and speak
function line(me, who) {
  if (me.row && me.row.who === who && !me.row.closed) return me.row;
  const r = { who, target: '', shown: 0, cut: false, final: false, closed: false };
  r.done = new Promise((ok) => (r.ok = ok));
  r.el = addRow(me, who, '', false);
  if (me.next === who) me.next = null;
  delete me.notes[who];   // next time, another moment
  me.row = r; me.typing = null; me.speaking = who; paintTiles(me);
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
      pin();
    }
    if (r.shown >= words.length) { if (r.final) { r.el.querySelector('.mt-tx').innerHTML = fmt(r.target); pin(); r.ok(); } return; }
    r.timer = setTimeout(step, words.length - r.shown > 40 ? 30 : 75);
  };
  r.timer = setTimeout(step, 0);
}
// the cut: the line stops, the line under it says who muted whom, the one cut shows it on their tile for a moment
function muted(me, r) {
  sys(me, M_().mute(NAME(r.by), NAME(r.who), FEM.has(r.by)), MUTE, 'cut');
  me.muted[r.who] = Date.now();
  paintTiles(me);
  setTimeout(() => { if (S === me) { delete me.muted[r.who]; paintTiles(me); } }, 3200);
}
function finish(me, r) {
  r.closed = true;
  r.el.classList.remove('now');
  if (r.cut) r.el.classList.add('cut');
  if (me.speaking === r.who) me.speaking = null;
  paintTiles(me);
}
// a line as the page shows it: a stage action <...> dim and slanted, one still being written hidden until it closes
function fmt(t) {
  return esc(String(t).replace(/\[\[[^\]]*\]?\]?/g, '').replace(/<[^<>]*$/, '')).replace(/&lt;([^&]{1,80}?)&gt;/g, '<i class="mt-act">$1</i>');
}
function rowHtml(who, text, cls = '') {
  const role = ROLE(who);
  return `<div class="mt-row${who === 'user' ? ' me' : ''}${cls ? ' ' + cls : ''}">${who === 'user' ? meFace('mt-av me') : `<img class="mt-av" src="${esc(PIC(who))}" alt="">`}
    <div class="mt-bub"><div class="mt-who"><b>${esc(NAME(who))}</b>${role ? `<small>${esc(role)}</small>` : ''}</div><div class="mt-tx">${fmt(text)}</div></div></div>`;
}
function addRow(me, who, text, done) {
  const rows = root()?.querySelector('#mt-rows'); if (!rows) return null;
  rows.insertAdjacentHTML('beforeend', rowHtml(who, text, done ? '' : 'now'));
  if (done && who === 'user') me.stick = true;
  pin();
  return rows.lastElementChild;
}
function sys(me, text, icon = '', cls = '') {
  const rows = root()?.querySelector('#mt-rows'); if (!rows) return;
  rows.insertAdjacentHTML('beforeend', `<div class="mt-sys ${cls}">${icon}<span>${esc(text)}</span></div>`);
  pin();
}

// ---------- the history stays on its last line (his note round 4: he once didn't see the end) ----------
// Every change of the rows' size (a word, a row, a picture that loaded, the wrap-up) pins the scroll to the bottom - unless they
// scrolled up themselves (a touch / wheel / key on the history, then away from the bottom); back at the bottom, it pins again.
let userAt = 0;
function watchLog() {
  const log = root()?.querySelector('#mt-log'), rows = root()?.querySelector('#mt-rows');
  if (!log || !rows) return;
  const mark = () => (userAt = Date.now());
  ['touchstart', 'touchmove', 'wheel', 'pointerdown', 'keydown'].forEach((ev) => log.addEventListener(ev, mark, { passive: true }));
  log.addEventListener('scroll', () => {
    if (!S) return;
    const gap = log.scrollHeight - log.scrollTop - log.clientHeight;
    if (gap < 24) { S.stick = true; root().querySelector('#mt-new').hidden = true; }
    else if (Date.now() - userAt < 1200) S.stick = false;
  }, { passive: true });
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => pin()); ro.observe(rows); ro.observe(log); }   // a word, a row, the keyboard
  rows.addEventListener('load', () => pin(), true);   // a picture loaded
  root().querySelector('#mt-new').onclick = () => { S.stick = true; pin(true); };
}
function pin(force) {
  const log = root()?.querySelector('#mt-log'); if (!log || !S || S.mode === 'shared') return;
  if (S.stick || force) { log.scrollTop = log.scrollHeight; root().querySelector('#mt-new').hidden = true; }
  else if (log.scrollHeight - log.scrollTop - log.clientHeight > 24) root().querySelector('#mt-new').hidden = false;
}

// ---------- the tiles row is the speakers queue (his note round 4) ----------
// who talks now: lit and wider · who is next: marked "הבא/ה" with their pre-talk moment on the tile (a cut-in in orange: "נכנס
// באמצע…") · the one just cut: "על השתק" · the one leaving fades out · you: your hand up / your turn
let lastNote = -1;
function preNote(id) {
  const all = M_().pre;
  let i = Math.floor(Math.random() * all.length);
  if (i === lastNote) i = (i + 1) % all.length;
  lastNote = i;
  return all[i](FEM.has(id));
}
function upNext(me, who, cut) {
  if (!who || me.ended) return;
  if (who === 'user') { me.next = 'user'; paintTiles(me); return; }
  me.next = who;
  if (cut) me.notes[who] = { cut: true, t: M_().cutting(FEM.has(who)) };
  else if (!me.notes[who]) me.notes[who] = { t: preNote(who) };
  paintTiles(me);
}
function paintTiles(me) {
  const handUp = me.hand && !me.floor && !me.ended;
  for (const t of tiles()) {
    const id = t.dataset.id, f = FEM.has(id);
    const talk = id === me.speaking, mute = !!me.muted[id];
    const next = !talk && !me.ended && (id === me.next || id === me.typing || (id === 'user' && handUp));
    const note = me.notes[id];
    let tag = '', band = '', ic = '';
    if (mute) { band = M_().onMute; ic = MUTE; }
    else if (id === 'user') {
      if (me.floor && !me.ended) band = M_().yourTurn1;
      else if (handUp) { band = M_().handUp; ic = HAND; }   // the hand says it (no tag beside it on a narrow tile)
      else if (me.next === 'user') { band = M_().youNext; tag = M_().nextTag('you'); }
    } else if (next) { tag = note && note.cut ? '' : M_().nextTag(f); band = note ? note.t : M_().pre[0](f); }
    t.classList.toggle('talk', talk);
    t.classList.toggle('next', next || (id === 'user' && (me.next === 'user' || (me.floor && !me.ended))));
    t.classList.toggle('cutin', !!(next && note && note.cut));
    t.classList.toggle('muted', mute);
    t.classList.toggle('turn', id === 'user' && me.floor && !me.ended);
    t.querySelector('.mt-tag').textContent = tag;
    t.querySelector('.mt-un').textContent = band;
    t.querySelector('.mt-ic').innerHTML = ic;
  }
}
function gone(me, who) {
  me.room = me.room.filter((x) => x !== who);
  if (me.next === who) me.next = null;
  const t = root()?.querySelector(`.mt-tile[data-id="${who}"]`);
  if (!t) return;
  t.querySelector('.mt-un').textContent = M_().leaving(FEM.has(who));
  t.classList.add('bye');
  setTimeout(() => { t.remove(); setMeta(me.ended ? 'ended' : me.mode === 'demo' ? 'rec' : 'live'); }, 900);
}

// ---------- typing = a raised hand; the floor is yours after the line in the air ----------
function raise() {
  const me = S;
  if (!me || me.mode !== 'live' || me.ended || me.floor || !me.id || me.handSent) return;
  me.handSent = true; me.hand = true;
  track('meeting', 'hand');
  if (me.rec) me.rec.push({ at: Date.now() - me.t0, e: { t: '_hand' } });
  api({ op: 'hand', id: me.id }).catch(() => {});
  paintTiles(me);
}
function placeholder(me) {
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
  paintTiles(me); placeholder(me);
  stream({ op: 'say', id: me.id, text });
}

// ---------- the end: the closing line, "<who> סיים את הפגישה", Amir's wrap-up, back to the Shlomiverse / share ----------
function ended(me, who) {
  me.ended = true; me.ender = who; me.floor = false; me.hand = false; me.typing = null; me.speaking = null; me.next = null;
  me.endMs = (me.mode === 'demo' ? me.demoNow() : Date.now()) - me.t0;
  paintTiles(me);
  setMeta('ended');
  const tm = root()?.querySelector('#mt-time b'); if (tm) tm.textContent = clock(me.endMs);
  sys(me, M_().ended(NAME(who), FEM.has(who)), PHONE_OFF, 'end');
  const el = root(); if (!el) return;
  el.classList.add('done');
  el.querySelector('#mt-box')?.remove();
  document.activeElement?.blur?.();
  root().querySelector('#mt-rows').insertAdjacentHTML('beforeend', `<section class="mt-recap wait" id="mt-recap">${loaderHtml(M_().recapWriting)}</section>`);
  if (me.mode === 'demo') playbar(true);
  const acts = document.createElement('div');
  const extra = me.owner && me.mode === 'live';   // a new meeting: only the owner (a resident gets one a day)
  acts.className = `mt-acts${extra ? ' four' : ''}`;
  acts.innerHTML = `<a class="mt-btn go" href="/" data-a="back">${esc(M_().back)}</a><button class="mt-btn ghost" data-a="share">${WA}${esc(M_().share)}</button><button class="mt-btn ghost" data-a="again">${REPLAY}${esc(M_().demoAgain)}</button>${extra ? `<button class="mt-btn ghost" data-a="new">${esc(M_().again)}</button>` : ''}`;
  (el.querySelector('#mt-play') || el.querySelector('.mt-stage')).after(acts);
  el.querySelector('#mt-play')?.remove();
  acts.onclick = (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'back') track('meeting', 'back');
    if (a === 'share') share(me);
    if (a === 'again') { track('meeting', 'replay'); demo(me.mode === 'demo' ? me.demoData : replayOf(me)); }
    if (a === 'new') { track('meeting', 'again'); again(); }
  };
  me.stick = true; pin();
}
async function again() {
  const room = S.room, owner = S.owner;
  S = { mode: 'live', owner, room, visitor: KEY && !auth ? { ...S.visitor } : me0() };
  const el = root(); if (el) { el.className = 'mt'; el.innerHTML = loaderHtml(); }
  let p = {};
  try { const r = await api({ op: 'peek' }); p = r.ok ? await r.json() : {}; } catch (e) { p = {}; }
  if (p.booked) booked(); else pick();
}
// the wrap-up: the title, what it was about, the ACTION ITEMS as their own block (owner + task), what came up, Amir's signature
function recapHtml(R, everyone, ms, date) {
  const face = (id, cls) => (id === 'user' ? meFace(`${cls} me`) : `<img class="${cls}" src="${esc(PIC(id))}" alt="">`);
  const items = R.items || [];
  return `<div class="mt-rc-top"><div class="mt-rc-k">${esc(M_().recapKicker)}</div>${TT}</div>
    ${R.title ? `<h2>${esc(R.title)}</h2>` : ''}
    <div class="mt-rc-meta"><span class="mt-rc-faces">${everyone.map((id) => `<img src="${esc(PIC(id))}" alt="">`).join('')}${meFace('me')}</span><span>${esc(date)}</span><i>·</i><span class="mt-rc-min">${CLOCK}${esc(M_().minutes(Math.max(1, Math.round(ms / 60000))))}</span></div>
    ${R.summary ? `<p class="mt-rc-sum">${esc(R.summary)}</p>` : ''}
    ${items.length ? `<div class="mt-ai"><div class="mt-ai-h"><b dir="ltr">${esc(M_().recapItems)}</b><span>${items.length}</span></div>
      <ol>${items.map((x) => `<li>${face(x.who, 'mt-ai-av')}<div><b>${esc(NAME(x.who))}</b><p>${esc(x.text)}</p></div></li>`).join('')}</ol></div>` : ''}
    ${(R.points || []).length ? `<h3>${esc(M_().recapSaid)}</h3><ul class="mt-rc-pts">${R.points.map((x) => `<li>${face(x.who, 'mt-rc-av')}<span><b>${esc(NAME(x.who))}</b> ${esc(x.text)}</span></li>`).join('')}</ul>` : ''}
    ${R.next ? `<p class="mt-rc-next">${esc(R.next)}</p>` : ''}
    <div class="mt-rc-sign"><img src="${esc(PIC(HOST))}" alt=""><span><b>${esc(NAME(HOST))}</b><small>${esc(M_().role[HOST])} · ${esc(M_().brand)}</small></span></div>`;
}
const today = (d = new Date()) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
function recapCard(me) {
  const box = root()?.querySelector('#mt-recap'); if (!box) return;
  box.className = 'mt-recap';
  box.innerHTML = recapHtml(me.recap || {}, me.everyone || me.room || [], me.endMs || 0, today());
  pin();
}
// share = a link to THIS meeting (/syncs/m/<id>, public read-only, with its own WhatsApp preview) - WhatsApp first, else copied
async function share(me) {
  track('meeting', 'share');
  const dd = me.demoData || {};
  let url = me.shareUrl || dd.shareUrl;
  const id = me.mode === 'live' ? me.id : dd.live ? dd.id : null;   // a live meeting, or the replay of one
  if (!url && !id && me.mode === 'demo') url = `${SITE}/syncs/m/demo`;   // the demo: its fixed shared meeting
  if (!url && id) {
    try { const r = await api({ op: 'share', id }); const j = r.ok ? await r.json() : {}; url = j.url; } catch (e) { url = null; }
  }
  if (!url) { toast(M_().shareFail); return; }
  me.shareUrl = url; if (me.demoData) me.demoData.shareUrl = url;
  await sendLink(url, (me.recap || {}).title);
}
async function sendLink(url, title) {
  const text = M_().shareText(title || '');
  try { if (navigator.share) { await navigator.share({ title: 'Syncs', text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch (e) { /* no clipboard */ }
  open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener');
  toast(M_().copied);
}

// ---------- a recorded meeting (?demo=1): the very events a real meeting streamed, at their real pace, through this same UI ----------
// demo.json = {room, visitor: {name}, ms, events: [{at, e}]} (scripts/meeting/record-demo.cjs). No sign-in, no server, nothing
// written; the bottom is a playback bar (the recording's time, a line that fills, play again).
// THIS meeting as a recording (his ask: "לצפות שוב" after a live meeting) - the events it played, with their times
const replayOf = (me) => ({ room: me.everyone, visitor: { ...me.visitor }, ms: me.endMs || 0, events: (me.rec || []).filter((x) => x.e.t !== 'meeting'), owner: me.owner, live: true, id: me.id, shareUrl: me.shareUrl });
async function demo(given) {
  const el = root(); if (!el) return;
  if (S) { S.abort?.abort(); clearTimeout(S.demoTimer); }
  S = null;
  el.className = 'mt'; el.innerHTML = loaderHtml();
  let d = given || null;
  if (!d) { try { d = await fetch('/syncs/demo.json', { cache: 'no-cache' }).then((r) => r.json()); } catch (e) { d = null; } }
  if (!d) return notFound();
  S = { mode: 'demo', owner: !!d.owner, visitor: { name: (d.visitor || {}).name || '', title: '', photo: (d.visitor || {}).photo || '' }, demoData: d };
  live(d.room, { demo: true });
  // the waits are kept short (a resident thinking for 6 s plays as 2.5 s, the pre-talk moment on their tile) - the talk itself at its pace
  const evs = [];
  let shift = 0, prev = 0;
  for (const x of d.events || []) { const gap = x.at - prev; if (gap > 2500) shift += gap - 2500; prev = x.at; evs.push({ at: x.at - shift, e: x.e }); }
  const me = S, t0 = Date.now();
  me.demoLen = evs.length ? evs[evs.length - 1].at + 1500 : 0;
  me.demoNow = () => Date.now();
  me.t0 = t0;
  let i = 0;
  const step = () => {
    if (S !== me) return;
    while (i < evs.length && evs[i].at <= Date.now() - t0) push(me, evs[i++].e);
    if (i < evs.length) me.demoTimer = setTimeout(step, Math.min(400, Math.max(10, evs[i].at - (Date.now() - t0))));
  };
  step();
}
function playbar(full) {
  const me = S; if (!me || me.mode !== 'demo') return;
  const p = full ? 1 : Math.min(1, (Date.now() - me.t0) / (me.demoLen || 1));
  const f = root()?.querySelector('#mt-pl-fill'), t = root()?.querySelector('#mt-pl-t'), k = root()?.querySelector('#mt-pl-knob');
  if (f) f.style.width = (p * 100).toFixed(1) + '%';
  if (k) k.style.left = (p * 100).toFixed(1) + '%';
  if (t) t.textContent = `${clock(full ? me.demoLen : Date.now() - me.t0)} / ${clock(me.demoLen)}`;
}

// ---------- /syncs/m/<id>: a shared meeting - its wrap-up and the whole conversation, read-only ----------
function sharedView(d) {
  const el = root(); if (!el) return;
  S = { mode: 'shared', visitor: d.visitor || {}, everyone: d.room || [], room: d.room || [], t0: 0 };
  document.title = d.recap && d.recap.title ? `${d.recap.title} · Syncs` : 'Syncs';
  el.className = 'mt mt-live mt-shared done';
  const lines = (d.log || []).map((l) => (l.left ? `<div class="mt-sys left">${LEAVE}<span>${esc(M_().left(NAME(l.who), FEM.has(l.who)))}</span></div>` : rowHtml(l.who, l.text, l.cut ? 'cut' : ''))).join('');
  el.innerHTML = `<div class="mt-top">${bar()}<div class="mt-tiles">${S.room.map(tile).join('')}${meTile()}</div></div>
    <div class="mt-stage"><div class="mt-log" id="mt-log"><div class="mt-rows" id="mt-rows">
      ${d.recap ? `<section class="mt-recap">${recapHtml(d.recap, S.room, d.ms || 0, d.t ? today(new Date(d.t)) : today())}</section>` : ''}
      <h3 class="mt-convo">${esc(M_().convo)}</h3>${lines}
      ${d.ender ? `<div class="mt-sys end">${PHONE_OFF}<span>${esc(M_().ended(NAME(d.ender), FEM.has(d.ender)))}</span></div>` : ''}
    </div></div><button class="mt-new" id="mt-new" hidden>${esc(M_().newer)}</button></div>
    <div class="mt-acts"><a class="mt-btn go" href="/">${esc(M_().back)}</a><button class="mt-btn ghost" id="mt-sh">${WA}${esc(M_().share)}</button>${d.id === 'demo' ? `<a class="mt-btn ghost" href="/syncs?demo=1">${PLAY}${esc(M_().watch)}</a>` : ''}</div>`;
  const m = root().querySelector('#mt-meta');
  if (m) m.innerHTML = `<span class="mt-badge rec">${esc(M_().recapKicker)}</span><span class="mt-info"><span>${PEOPLE}<b>${S.room.length + 1}</b></span>${d.ms ? `<i>·</i><span>${CLOCK}<b>${clock(d.ms)}</b></span>` : ''}</span>`;
  bindOut(el);
  root().querySelector('#mt-sh').onclick = () => { track('meeting', 'reshare'); sendLink(location.origin + location.pathname, (d.recap || {}).title); };
  S.stick = false;
}

boot();
// recording a demo (scripts/meeting/record-demo.cjs drives a real meeting in a browser): ?rec=1 keeps every event with its time
export const takeRec = () => (S ? { room: S.everyone, visitor: { name: vName() }, ms: Date.now() - S.t0, events: S.rec || [] } : null);
