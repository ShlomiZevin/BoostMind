// "אתם חיים בסימולציה?" - the simulation test's page (/simulation), the home band and the chat card (plan conversion-next v6,
// approved 2026-11-06; mockups Documents/shlomiverse-v2-design/next-plan Q1-Q7). The server is techietech-api/sim.js:
// the host's opening, 7 questions written one after the other (the next one is written for all 4 answers while the
// visitor reads), the score, and a simulation the AI mixes from 2-3 real characters with a picture of them together.
// A tourist sees the score; the full result after "מסדירים תושבות" - then it sticks to their account.
// The share card is drawn here on a canvas (the picture + the words in code, so the Hebrew is always right).
import { T } from './copy.js';
import { esc, track, sheet, toast } from './ui.js';
import { st, onState, needFan, signedIn } from './state.js';
import { LOCAL } from './fb.js';
import { isCitizen } from './citizen.js';
import { simOpen, czOpen } from './gates.js';

const API = LOCAL ? '/api/verseSim' : 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseSim';
const S = () => T.sim;
const LS = 'vx-sim';
const mine = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } };
const keep = (x) => { try { localStorage.setItem(LS, JSON.stringify(x)); } catch (e) {} };
const own = () => { try { return !!localStorage.getItem('t-ignore'); } catch (e) { return false; } };
const img = (id) => (C[id] && C[id].img) || '';

// the account is known (a resident's own result needs their token - right after a page load it isn't there yet)
const ready = () => new Promise((res) => { const t0 = Date.now(); (function w() { if (st.ready || Date.now() - t0 > 5000) res(); else setTimeout(w, 80); })(); });
async function api(op, data = {}, auth = false) {
  const headers = { 'content-type': 'application/json' };
  if ((auth || st.user) && st.user) headers.authorization = 'Bearer ' + (await st.user.getIdToken());
  const r = await fetch(API, { method: 'POST', headers, body: JSON.stringify({ op, ...data }) });
  const j = await r.json().catch(() => ({ error: 'server' }));
  if (j.error) throw Object.assign(new Error(j.error), { code: j.error });
  return j;
}

// the host on the home page: a new one on every load until they take the test (his ask: "maybe once I see a character I
// like I'll want to"), drawn by how likely they are to like them - a new visitor by the characters' general popularity
// (their videos), a returning one by their own history (videos they finished, characters they follow: Hani 5 + Yotam 1
// = 5/6 and 1/6). Everyone else keeps a small chance (10% of the draw, shared), so new faces still turn up.
let host = null;
function visitHost() {
  if (host && C[host]) return host;
  try {
    const all = Object.values(C).filter((c) => c.img && c.id !== 'guide');
    const mine = {};
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem('vx-done')) || []; } catch (e) {}
    for (const x of seen) { const id = x.lead || (V[x.id] && V[x.id].cast && V[x.id].cast[0]); if (C[id]) mine[id] = (mine[id] || 0) + 1; }
    for (const id of st.follows || []) if (C[id]) mine[id] = (mine[id] || 0) + 2;
    const personal = Object.keys(mine).length > 0;
    const base = Object.fromEntries(all.map((c) => [c.id, personal ? mine[c.id] || 0 : (c.videos ? c.videos.length : 0) + 1]));
    const total = Object.values(base).reduce((a, b) => a + b, 0) || 1, floor = (total * 0.1) / all.length;
    const w = all.map((c) => base[c.id] + floor), sum = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum, i = 0;
    while (i < w.length - 1 && (r -= w[i]) > 0) i++;
    host = all[i].id;
  } catch (e) { host = 'yotam'; }
  return host;
}
// the host's opening (title / line / button), kept in the browser - the band shows it without waiting
const OPEN = 'vx-sim-open';
const openCached = (h) => { try { return (JSON.parse(localStorage.getItem(OPEN) || '{}'))[h] || null; } catch (e) { return null; } };
async function openOf(h) {
  const c = openCached(h);
  if (c) return c;
  const r = await api('open', { host: h });
  try { const all = JSON.parse(localStorage.getItem(OPEN) || '{}'); all[r.host.id] = r.open; localStorage.setItem(OPEN, JSON.stringify(all)); } catch (e) {}
  return r.open;
}
const done = () => !!(mine()?.done || st.fan?.sim);
const myTest = () => { const m = mine(); if (m && m.done) return m; const f = st.fan && st.fan.sim; return f ? { rid: f.rid, done: true, score: f.score, name: f.name, full: true } : null; };

// ---------- the home band (Q1): under the question box, for tourists and residents who haven't done it ----------
export function mountBand() {
  const el = document.getElementById('sim-band');
  if (!el) return;
  if (!simOpen()) { el.innerHTML = ''; return; }   // no way in for now (gates.js)
  const t = myTest();
  if (t) {
    const full = !!(t.name && (t.full || signedIn()));
    const h = C[t.host] ? t.host : visitHost();
    el.innerHTML = `<a class="sim-band" href="/simulation" data-sim-band>
      <i class="sim-g g1"></i><i class="sim-g g2"></i><i class="sim-g g3"></i>
      <span class="sim-band-face"><img src="${esc(t.img || img(h))}" alt=""></span>
      <b class="sim-band-h">${esc(full ? t.name : `${S().yourScore}: ${t.score}`)}</b>
      <small class="sim-band-l">${esc(full ? `${S().yours} · ${t.score}` : S().sealed)}</small>
      <span class="vx-btn main small sim-band-go">${esc(full ? S().toResult : S().toFull)}</span></a>`;
    return;
  }
  const h = visitHost(), c = C[h], o = openCached(h);
  el.innerHTML = `<a class="sim-band ${signedIn() ? 'small' : ''}" href="/simulation?host=${h}&from=home" data-sim-band>
    <i class="sim-g g1"></i><i class="sim-g g2"></i><i class="sim-g g3"></i>
    <span class="sim-band-face"><img src="${esc(img(h))}" alt="${esc(c.name)}"></span>
    <b class="sim-band-h" data-text="${esc(S().title)}">${esc(S().title)}</b>
    <small class="sim-band-l">${esc(o ? o.line : '')}</small>
    <span class="vx-btn main small sim-band-go">${esc(S().go)}</span></a>`;
  if (!el.dataset.seen) { el.dataset.seen = '1'; track('sim_band', h); }
  if (!o) openOf(h).then((x) => { const s = el.querySelector('.sim-band-l'); if (s) s.textContent = x.line; }).catch(() => {});
}

// ---------- the chat card (Q7): [[quiz]] in a reply - the character suggests the test when it fits the talk ----------
export function quizCard(mode) {
  if (!simOpen()) return '';
  const h = C[mode] ? mode : visitHost();
  return `<div class="sim-chat"><b>${esc(S().title)}</b><a class="vx-btn main small" href="/simulation?host=${h}&from=chat" onclick="window.track&&window.track('sim_card','${h}')">${esc(S().chatGo)}</a></div>`;
}

// ---------- the page ----------
let run = null;   // the test on screen: { host, open, rid, n, of, q, a, react, busy }
export function simPage(q = {}) {
  setTimeout(() => boot(q), 0);
  return '<div class="sim" id="sim"><div class="sim-load"><span class="sim-planet"></span></div></div>';
}
const box = () => document.getElementById('sim');
async function boot(q) {
  const el = box();
  if (!el) return;
  await ready();
  document.title = `${S().title} · שלומיוורס`;
  const fab = document.getElementById('fab'); if (fab) fab.style.display = 'none';   // the floating chat button would cover the answers
  const m = myTest();
  // a friend's shared result
  if (q.r && (!m || m.rid !== q.r)) return friendView(q.r, q);
  // their own test that is already done: straight to it - one test per person (his rule)
  if (q.r || m) return resultView(q.r || m.rid);
  run = { host: C[q.host] ? q.host : visitHost(), from: q.from || (document.referrer.includes('instagram') ? 'instagram' : 'direct'), ref: q.ref || null };
  track('sim_open', run.from);
  openingView();
}

function openingView() {
  const el = box(), c = C[run.host];
  const paint = (o) => {
    el.innerHTML = `<section class="sim-open">
      <div class="sim-host"><img src="${esc(img(run.host))}" alt="${esc(c.name)}"><span class="sim-live"><i></i>${esc(S().live)}</span></div>
      <h1>${esc(o ? o.title : c.name)}</h1>
      <p class="sim-line">${esc(o ? o.line : '')}</p>
      <button class="vx-btn main block sim-go" data-sim-go ${o ? '' : 'disabled'}>${esc(o ? o.btn : S().go)}</button>
      <p class="sim-small">${esc(S().small)}</p></section>`;
    el.querySelector('[data-sim-go]').onclick = start;
  };
  const o = openCached(run.host);
  paint(o);
  if (!o) openOf(run.host).then((x) => { if (box() && !run.rid) paint(x); }).catch(() => paint({ title: c.name, line: '', btn: S().go }));
}

async function start() {
  const b = box().querySelector('[data-sim-go]');
  b.disabled = true; b.classList.add('wait');
  try {
    const r = await api('start', { host: run.host, from: run.from, ref: run.ref, own: own(), v: (localStorage.getItem('t-v') || '') });
    Object.assign(run, r);
    track('sim_start', run.host);
    questionView();
  } catch (e) {
    b.disabled = false; b.classList.remove('wait');
    toast(e.code === 'limit' ? S().limit : S().fail, 3200);
  }
}

function questionView() {
  const el = box(), c = C[run.host];
  el.innerHTML = `<section class="sim-q">
    <div class="sim-prog"><span style="width:${Math.round(((run.n - 1) / run.of) * 100)}%"></span></div>
    <div class="sim-qn">${esc(S().qOf(run.n, run.of))}</div>
    <div class="sim-ask"><img src="${esc(img(run.host))}" alt="${esc(c.name)}"><div>
      ${run.react ? `<p class="sim-react">${esc(run.react)}</p>` : ''}<p class="sim-bubble">${esc(run.q)}</p></div></div>
    <div class="sim-as">${run.a.map((x, i) => `<button data-sim-a="${i}">${esc(x)}</button>`).join('')}</div>
    ${run.n > 3 ? `<button class="sim-skip" data-sim-skip>${esc(S().skip)}</button>` : ''}</section>`;
  el.querySelectorAll('[data-sim-a]').forEach((btn) => (btn.onclick = () => answer(+btn.dataset.simA, btn)));
  el.querySelector('[data-sim-skip]')?.addEventListener('click', skipToEnd);
  window.scrollTo(0, 0);
  // the next question for each of the 4 answers, written while they read this one
  if (run.n < run.of) api('pre', { rid: run.rid, n: run.n }).catch(() => {});
}

async function answer(pick, btn) {
  if (run.busy) return;
  run.busy = true;
  btn.classList.add('on');
  box().querySelectorAll('[data-sim-a]').forEach((b) => (b.disabled = true));
  const last = run.n === run.of;
  let slow = setTimeout(() => btn.classList.add('wait'), 600);
  if (last) setTimeout(computingView, 350);
  try {
    const r = await api('answer', { rid: run.rid, n: run.n, pick });
    clearTimeout(slow);
    run.busy = false;
    track('sim_q', String(run.n));
    if (r.done) {
      keep({ rid: run.rid, done: true, score: r.score, host: run.host });
      track('sim_done', String(r.score));
      return resultView(run.rid, true);
    }
    Object.assign(run, r);
    questionView();
  } catch (e) {
    clearTimeout(slow);
    run.busy = false;
    toast(S().fail, 3000);
    if (last) questionView(); else { btn.classList.remove('on', 'wait'); box().querySelectorAll('[data-sim-a]').forEach((b) => (b.disabled = false)); }
  }
}

// after 3 answers they may go straight to the result (his ask) - made from what they answered
async function skipToEnd() {
  if (run.busy) return;
  run.busy = true;
  track('sim_skip', String(run.n - 1));
  computingView();
  try {
    const r = await api('finish', { rid: run.rid });
    run.busy = false;
    keep({ rid: run.rid, done: true, score: r.score, host: run.host });
    track('sim_done', String(r.score));
    resultView(run.rid, true);
  } catch (e) { run.busy = false; toast(S().fail, 3000); questionView(); }
}

function computingView() {
  const el = box();
  if (!el) return;
  const faces = Object.values(C).filter((c) => c.img).sort(() => Math.random() - 0.5).slice(0, 6);
  el.innerHTML = `<section class="sim-calc"><div class="sim-orbit">${faces.map((c, i) => `<img src="${esc(c.img)}" alt="" style="--i:${i}">`).join('')}<span class="sim-planet"></span></div>
    <h2>${esc(S().computing)}</h2><p data-sim-c2>${esc(S().computing2)}</p></section>`;
}

// ---------- the result: the score (tourist) or all of it (resident) ----------
let poll = 0;
async function resultView(rid, fresh) {
  const el = box();
  if (!el) return;
  clearTimeout(poll);
  let r;
  await ready();
  try { r = await api('get', { rid }, true); } catch (e) {
    if (e.code === 'gone') { localStorage.removeItem(LS); return boot({}); }
    el.innerHTML = `<div class="empty">${esc(S().fail)}</div>`; return;
  }
  if (!box()) return;
  if (!r.name) return scoreView(r, fresh);
  fullView(r, fresh);
}

function scoreView(r, fresh) {
  const el = box(), c = C[r.host?.id] || C.yotam;
  el.innerHTML = `<section class="sim-score">
    <div class="sim-big"><small>${esc(S().yourScore)}</small><b>${r.score}</b><span>${esc(S().of100)}</span></div>
    <div class="sim-sealed"><div class="sim-blur">${[c, ...Object.values(C).filter((x) => x.img && x.id !== c.id).slice(0, 2)].map((x) => `<img src="${esc(x.img)}" alt="">`).join('')}</div>
      <span class="sim-lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
      <p>${esc(S().sealed)}</p></div>
    <button class="vx-btn main block" data-sim-join>${esc(S().join)}</button>
</section>`;
  track('sim_score', String(r.score));
  el.querySelector('[data-sim-join]').onclick = async () => {
    track('sim_join', 'press');
    if (await needFan('sim')) { track('sim_join', 'resident'); resultView(r.rid, true); }
  };
}

let shown = null;   // the result on screen (its picture arrives later - the share card takes it from here)
function fullView(r, fresh) {
  const el = box();
  shown = r;
  keep({ rid: r.rid, done: true, full: true, score: r.score, host: r.host?.id, name: r.name, img: r.img || null });
  const lines = String(r.verdict || '').split('\n');
  el.innerHTML = `<section class="sim-res">
    <div class="sim-pic ${r.img ? 'ok' : 'dev'}">${r.img ? `<img src="${esc(r.img)}" alt="">` : `<div class="sim-faces3">${r.cast.map((x) => `<img src="${esc(img(x.id))}" alt="">`).join('')}</div><span class="sim-dev">${esc(S().developing)}</span>`}
      <div class="sim-badge"><b>${r.score}</b><small>${esc(S().yourScore)}</small></div></div>
    <div class="sim-body">
      <div class="sim-k">${esc(S().yours)}</div><h1>${esc(r.name)}</h1>
      <p class="sim-verdict">${lines.map(esc).join('<br>')}</p>
      <div class="sim-cast-h">${esc(S().who)}</div>
      <div class="sim-cast">${r.cast.map((x) => `<a href="/c/${esc(x.id)}"><img src="${esc(img(x.id))}" alt=""><span><b>${esc(C[x.id]?.name || x.id)}</b><small>${esc(x.role || '')}</small></span></a>`).join('')}</div>
      <button class="vx-btn main block" data-sim-share>${esc(S().share)}</button>
      ${czOpen() && signedIn() && !isCitizen() ? `<a class="vx-btn block" href="/citizenship" onclick="window.track&&window.track('cz_banner','sim')">${esc(T.cz.id.add)}</a>` : ''}
      <button class="vx-btn block" data-sim-meet>${esc(S().meet)}</button>
</div></section>`;
  if (fresh || !sessionStorage.getItem('vx-sim-full-' + r.rid)) { track('sim_full', r.rid); try { sessionStorage.setItem('vx-sim-full-' + r.rid, '1'); } catch (e) {} }
  el.querySelector('[data-sim-share]').onclick = () => shareSheet(r);
  el.querySelector('[data-sim-meet]').onclick = () => { track('sim_meet', r.cast[0]?.id); if (typeof openChat === 'function') openChat(r.cast[0]?.id || 'guide'); };
  window.scrollTo(0, 0);
  if (!r.img && r.mine) picture(r);
}

// the picture of their simulation: asked once, then looked for every 3 s while it is being made (~15 s)
async function picture(r, tries = 0) {
  try {
    const x = await api('image', { rid: r.rid }, true);
    if (x.img) return showPic(x.img);
    if (x.wait && tries < 20) { poll = setTimeout(() => picture(r, tries + 1), 3000); return; }
  } catch (e) {
    if (tries < 20 && e.code !== 'cap' && e.code !== 'image' && e.code !== 'not_yours') { poll = setTimeout(() => picture(r, tries + 1), 3000); return; }
  }
  const d = box()?.querySelector('.sim-dev');
  if (d) { d.textContent = S().picFail; d.classList.add('fail'); }
}
function showPic(url) {
  const p = box()?.querySelector('.sim-pic');
  if (!p) return;
  const im = new Image();
  if (shown) shown.img = url;
  im.onload = () => { p.classList.remove('dev'); p.classList.add('ok', 'reveal'); p.querySelector('.sim-faces3')?.remove(); p.querySelector('.sim-dev')?.remove(); p.prepend(im); };
  im.src = url;
  track('sim_img', 'ok');
  const m = mine(); if (m) keep({ ...m, img: url });
}

// ---------- a friend's shared result ----------
async function friendView(rid, q) {
  const el = box();
  let r;
  try { r = await api('get', { rid }); } catch (e) { return boot({ host: q.host, from: 'share' }); }
  if (!r.name) { run = { host: visitHost(), from: 'share', ref: rid }; track('sim_open', 'share'); return openingView(); }
  track('sim_ref', rid);
  el.innerHTML = `<section class="sim-res friend">
    <div class="sim-pic ${r.img ? 'ok' : ''}">${r.img ? `<img src="${esc(r.img)}" alt="">` : `<div class="sim-faces3">${r.cast.map((x) => `<img src="${esc(img(x.id))}" alt="">`).join('')}</div>`}
      <div class="sim-badge"><b>${r.score}</b><small>${esc(S().yourScore)}</small></div></div>
    <div class="sim-body"><div class="sim-k">${esc(S().friend)}</div><h1>${esc(r.name)}</h1>
      <p class="sim-verdict">${esc(r.share || '')}</p>
      <button class="vx-btn main block" data-sim-mine>${esc(S().askFriends)}</button></div></section>`;
  el.querySelector('[data-sim-mine]').onclick = () => { run = { host: visitHost(), from: 'share', ref: rid }; track('sim_open', 'share'); openingView(); };
}

// ---------- sharing: the card (Q6), drawn here ----------
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function drawCard(r) {
  const W = 1080, H = 1920, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.fillStyle = '#0b0b0e'; x.fillRect(0, 0, W, H);
  const cover = (im, dx, dy, dw, dh) => { const s = Math.max(dw / im.width, dh / im.height), w = im.width * s, h = im.height * s; x.drawImage(im, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h); };
  try {
    if (r.img) cover(await loadImg(r.img), 0, 0, W, H);
    else { const ims = await Promise.all(r.cast.map((c) => loadImg(img(c.id)))); const w = W / ims.length; ims.forEach((im, i) => cover(im, i * w, 300, w, 1200)); }
  } catch (e) {}
  let g = x.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, 'rgba(0,0,0,.88)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, 640);
  g = x.createLinearGradient(0, H - 640, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(0,0,0,.9)'); x.fillStyle = g; x.fillRect(0, H - 640, W, 640);
  await document.fonts.load('900 80px Heebo').catch(() => {});
  x.direction = 'rtl'; x.textAlign = 'right';
  const R = W - 64;
  x.fillStyle = '#fc7211'; x.font = '900 190px Heebo'; x.fillText(String(r.score), R, 230);
  x.fillStyle = '#fff'; x.font = '800 64px Heebo'; wrap(x, r.name, R, 330, W - 128, 74, 2);
  x.fillStyle = '#e8e2dc'; x.font = '500 44px Heebo'; wrap(x, r.share || '', R, 500, W - 128, 56, 2);
  x.fillStyle = '#fff'; x.font = '800 60px Heebo'; x.fillText(r.ask || S().askFriends, R, H - 200);
  x.font = '900 64px Heebo'; x.fillStyle = '#fdf6ef'; const sw = x.measureText('שלומי').width; x.fillText('שלומי', R, H - 90); x.fillStyle = '#fc7211'; x.fillText('וורס', R - sw, H - 90);
  x.direction = 'ltr'; x.textAlign = 'left'; x.fillStyle = '#d8d2cc'; x.font = '500 36px Heebo'; x.fillText('shlomiverse.com/simulation', 64, H - 100);
  return new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));
}
function wrap(x, text, right, y, max, lh, lines) {
  const words = String(text).split(/\s+/); let line = '', n = 0;
  for (let i = 0; i < words.length; i++) {
    const t = line ? line + ' ' + words[i] : words[i];
    if (x.measureText(t).width > max && line) { x.fillText(line, right, y + n * lh); n++; line = words[i]; if (n >= lines - 1) { line = words.slice(i).join(' '); break; } }
    else line = t;
  }
  if (line) x.fillText(line, right, y + n * lh);
}

async function shareSheet(r) {
  const url = `https://shlomiverse.com/simulation?r=${r.rid}`;
  const text = `${r.share} ${r.ask}`.trim();
  const mark = (via) => { track('sim_share', via); api('share', { rid: r.rid, via }, true).catch(() => {}); };
  const blob = await drawCard(r);
  const file = blob && new File([blob], 'shlomiverse-simulation.jpg', { type: 'image/jpeg' });
  // the phone's own share sheet with the card itself (Instagram story, WhatsApp status...)
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    mark('native');
    try { await navigator.share({ files: [file], text: `${text}\n${url}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const pic = blob ? URL.createObjectURL(blob) : '';
  sheet(`<div class="sim-sh">${pic ? `<img src="${pic}" alt="">` : ''}
    <a class="vx-btn main block" data-sim-wa href="https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}" target="_blank" rel="noopener">${esc(S().wa)}</a>
    <button class="vx-btn block" data-sim-copy>${esc(S().copy)}</button>
    ${pic ? `<a class="vx-btn block" data-sim-save href="${pic}" download="shlomiverse-simulation.jpg">${esc(S().save)}</a>` : ''}</div>`, { cls: 'sim-sheet' });
  const root = [...document.querySelectorAll('.vx-sheet.sim-sheet')].pop() || document;
  root.querySelector('[data-sim-wa]')?.addEventListener('click', () => mark('whatsapp'));
  root.querySelector('[data-sim-save]')?.addEventListener('click', () => mark('save'));
  root.querySelector('[data-sim-copy]')?.addEventListener('click', async (e) => { const btn = e.currentTarget; mark('copy'); try { await navigator.clipboard.writeText(url); } catch (err) {} btn.textContent = S().copied; });
}

// a test done as a tourist that just became a resident elsewhere on the site: nothing to do - the result page claims it
onState(() => { if (location.pathname === '/') mountBand(); });
