// "אתם חיים בסימולציה?" - the simulation test's page (/simulation), the home band and the chat card (plan conversion-next v6,
// approved 2026-11-06; mockups Documents/shlomiverse-v2-design/next-plan Q1-Q7). The server is techietech-api/sim.js:
// the host's opening, 7 questions written one after the other (the next one is written for all 4 answers while the
// visitor reads), the department Yotam assigns (round 4: instead of the score), and a simulation the AI mixes from 2-3 real
// characters with a picture of them together. A tourist sees the department; the full result after "מסדירים תושבות" - then it
// sticks to their account.
// The share card is drawn here on a canvas (the picture + the words in code, so the Hebrew is always right).
import { T } from './copy.js';
import { esc, track, sheet, toast, brand } from './ui.js';
import { st, onState, needFan, signedIn, follow } from './state.js';
import { LOCAL } from './fb.js';
import { isCitizen, writeBar, wireWrite } from './citizen.js';
import { simOpen, czOpen } from './gates.js';
import { putAbout } from './about.js';

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
  if (C.yotam) return 'yotam';   // the classifier, always (his note 2026-11-07: not a random character)
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
const myTest = () => { const m = mine(); if (m && m.done) return m; const f = st.fan && st.fan.sim; return f ? { rid: f.rid, done: true, score: f.score, dept: f.dept || null, name: f.name, full: true } : null; };

// a name with English in brackets ("הקופאית (Gen Z)") kept whole and in its own direction - else it breaks across the line with
// the brackets flipped (round 4 check)
const nameHtml = (n) => esc(n).replace(/\(([^)]*)\)/g, (m) => `<bdi>${m.replace(/ /g, '&nbsp;')}</bdi>`);

// ---------- the home band (Q1): under the question box, for tourists and residents who haven't done it ----------
export function mountBand() {
  const el = document.getElementById('sim-band');
  if (!el) return;
  if (!simOpen()) { el.innerHTML = ''; return; }   // no way in for now (gates.js)
  // after the test the band is gone (plan cz-sim-r4, his note 2026-11-07): the result lives in the passport and the profile
  if (myTest()) { el.innerHTML = ''; return; }
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
  const h = visitHost();
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
  run = { host: visitHost(), from: q.from || (document.referrer.includes('instagram') ? 'instagram' : 'direct'), ref: q.ref || null };
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
  firstQ().catch(() => {});
}

// the first question is written as the page opens (plan cz-sim-r4, his note 2026-11-07: the wait after "תבדקו אותי" was too long),
// so the tap shows it at once. Kept in the browser for a few hours: a reload never writes (or counts) another one.
const PRE = 'vx-sim-pre';
function firstQ() {
  if (run.first) return run.first;
  const uid = st.user ? st.user.uid : null;
  try { const c = JSON.parse(localStorage.getItem(PRE) || 'null'); if (c && c.uid === uid && Date.now() - c.t < 6 * 3600e3) return (run.first = Promise.resolve(c.r)); } catch (e) {}
  run.first = api('start', { host: run.host, from: run.from, ref: run.ref, own: own(), v: (localStorage.getItem('t-v') || ''), pre: true })
    .then((r) => { try { localStorage.setItem(PRE, JSON.stringify({ uid, t: Date.now(), r })); } catch (e) {} return r; });
  run.first.catch(() => { run.first = null; });
  return run.first;
}

async function start() {
  const b = box().querySelector('[data-sim-go]'), line = box().querySelector('.sim-line');
  b.disabled = true; b.classList.add('wait');
  // still being written: Yotam runs his "system check", a line a second (Terra's)
  let k = 0, roll = 0;
  const next = () => { if (line) line.textContent = S().check[k++ % S().check.length]; roll = setTimeout(next, 1000); };
  roll = setTimeout(next, 150);
  try {
    const r = await firstQ();
    clearTimeout(roll);
    Object.assign(run, r, { last: '' });
    try { localStorage.removeItem(PRE); } catch (e) {}
    api('go', { rid: run.rid }).catch(() => {});   // the tap = a real start (Backstage's funnel)
    track('sim_start', run.host);
    questionView();
  } catch (e) {
    clearTimeout(roll);
    b.disabled = false; b.classList.remove('wait');
    toast(e.code === 'limit' ? S().limit : S().fail, 3200);
  }
}

// one stage at a time (plan cz-sim-r4 mockup simq-a, his correction 2026-11-07: "not a whole conversation - stages that move on"):
// a small header (Yotam, the 7 stations), their last answer as their own bubble, Yotam's reaction to THAT answer right under it,
// then the new question; earlier exchanges are gone. The answers are tappable cards; the writing bar sits pinned at the bottom.
const dots = (n, of) => Array.from({ length: of }, (_, i) => `<i class="${i < n - 1 ? 'done' : i === n - 1 ? 'now' : ''}"></i>`).join('');
function questionView() {
  const el = box(), c = C[run.host];
  el.innerHTML = `<section class="sim-q">
    <header class="sim-qh"><img src="${esc(img(run.host))}" alt="${esc(c.name)}"><span class="sim-qh-t"><b>${esc(c.name)} · ${esc(S().hostTag)}</b><small>${esc(S().stage(run.n, run.of))}</small></span>
      <span class="sim-dots" aria-hidden="true">${dots(run.n, run.of)}</span></header>
    <div class="sim-stage">
      ${run.last ? `<p class="sim-mine">${esc(run.last)}</p>` : ''}
      ${run.react ? `<div class="sim-re"><img src="${esc(img(run.host))}" alt=""><p>${esc(run.react)}</p></div>` : ''}
      <p class="sim-bubble">${esc(run.q)}</p></div>
    <p class="vx-pick-hint">${esc(S().pickHint)}</p>
    <div class="sim-as">${run.a.map((x, i) => `<button data-sim-a="${i}"><i></i><span>${esc(x)}</span></button>`).join('')}</div>
    <div class="sim-dock">${writeBar(S().free, 120)}${run.n > 3 ? `<button class="sim-skip" data-sim-skip>${esc(S().skip)}</button>` : ''}</div></section>`;
  el.querySelectorAll('[data-sim-a]').forEach((btn) => (btn.onclick = () => answer({ pick: +btn.dataset.simA }, btn, run.a[+btn.dataset.simA])));
  // their own answer (plan cz-sim-r3 mockup simfree): Yotam reacts to it in the next stage
  wireWrite(el.querySelector('.vx-write'), (v, btn) => answer({ text: v }, btn, v));
  el.querySelector('[data-sim-skip]')?.addEventListener('click', skipToEnd);
  window.scrollTo(0, 0);
}
// while the next question is written: the question bubble, at the height it had, types Yotam's short lines (the citizenship's
// think - nothing is written ahead, his call 2026-11-08: "it's okay that the user will wait")
let thinkT = 0;
function think() {
  const say = box()?.querySelector('.sim-bubble'), lines = S().think;
  if (!say || !lines) return;
  clearTimeout(thinkT);
  say.style.height = say.offsetHeight + 'px';
  say.classList.add('thinking');
  say.innerHTML = '<span class="cz-think"><em></em><i></i></span>';
  const em = say.querySelector('em');
  let k = Math.floor(Math.random() * lines.length), c = 0;
  (function type() {
    if (!say.isConnected) return;
    const line = lines[k % lines.length];
    if (c <= line.length) { em.textContent = line.slice(0, c++); thinkT = setTimeout(type, 32); return; }
    thinkT = setTimeout(() => { k++; c = 0; type(); }, 1500);
  })();
}
const lock = (on) => box()?.querySelectorAll('[data-sim-a], .sim-dock button, .sim-dock textarea').forEach((b) => (b.disabled = on));
// the stage moves on: the old one fades out, the new one comes in (CSS sim-in)
const moveOn = () => new Promise((res) => { const q = box()?.querySelector('.sim-q'); if (!q) return res(); q.classList.add('out'); setTimeout(res, 170); });

async function answer(data, btn, label) {
  if (run.busy) return;
  run.busy = true;
  btn.classList.add('on');
  lock(true);
  const last = run.n === run.of;
  let slow = setTimeout(() => btn.classList.add('wait'), 600);
  if (last) setTimeout(computingView, 350); else think();
  try {
    const r = await api('answer', { rid: run.rid, n: run.n, ...data });
    clearTimeout(slow);
    run.busy = false;
    track('sim_q', String(run.n) + (data.text ? 't' : ''));
    if (r.done) {
      keep({ rid: run.rid, done: true, score: r.score, dept: r.dept || null, host: run.host });
      track('sim_done', String(r.score));
      return resultView(run.rid, true);
    }
    await moveOn();
    Object.assign(run, r, { last: label || '' });
    questionView();
  } catch (e) {
    clearTimeout(slow);
    run.busy = false;
    if (e.code === 'gone' || (e.code === 'step' && run.n === 1)) { try { localStorage.removeItem(PRE); } catch (x) {} run = null; return boot({}); }   // a first question kept from before, gone on the server
    toast(S().fail, 3000);
    clearTimeout(thinkT);
    questionView();   // the bubble showed Yotam's waiting lines - the question back
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
    keep({ rid: run.rid, done: true, score: r.score, dept: r.dept || null, host: run.host });
    track('sim_done', String(r.score));
    resultView(run.rid, true);
  } catch (e) { run.busy = false; toast(S().fail, 3000); questionView(); }
}

// "יותם מסווג אתכם" (plan cz-sim-r4 mockup classify, his note 2026-11-07: no spinning logo - "we are a serious immersive site"):
// six random faces on a circle (his choice), one lit at a time as if asked right now, a thin scan line sweeping slowly in the
// middle, and the line under the title says whom Yotam asks - Terra's line for that face, else a plain one. Up to three of the
// six are drawn from the characters Terra wrote lines for, so her lines turn up.
let calcT = 0;
const plain = (c) => String(c.name || '').replace(/\s*\([^)]*\)/g, '').trim();   // 'נהור (ציון) מינוף' -> 'נהור מינוף'
function computingView() {
  const el = box();
  if (!el) return;
  clearTimeout(calcT);
  const all = Object.values(C).filter((c) => c.img && c.id !== 'guide' && c.id !== 'yotam').sort(() => Math.random() - 0.5);
  const told = all.filter((c) => S().asks[c.id]).slice(0, 3);
  const faces = [...told, ...all.filter((c) => !told.includes(c))].slice(0, 6).sort(() => Math.random() - 0.5);
  el.innerHTML = `<section class="sim-calc"><div class="sim-ring">${faces.map((c, i) => `<img src="${esc(c.img)}" alt="" style="--i:${i}">`).join('')}<span class="sim-scan"></span></div>
    <h2>${esc(S().computing)}</h2><p data-sim-c2>${esc(S().computing2)}</p></section>`;
  const ims = [...el.querySelectorAll('.sim-ring img')], line = el.querySelector('[data-sim-c2]');
  let k = 0;
  const lit = () => {
    if (!line.isConnected) return;
    const i = k++ % faces.length;
    ims.forEach((im, j) => im.classList.toggle('on', j === i));
    line.textContent = S().asks[faces[i].id] || S().askAny(plain(faces[i]));
    calcT = setTimeout(lit, 2300);
  };
  calcT = setTimeout(lit, 900);
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
  if (!r.name) return lockedView(r, fresh);
  fullView(r, fresh);
}

// the classification certificate (plan cz-sim-r3 mockup result-2): "הסיווג שלכם בשלומיוורס", the department Yotam gave (plan
// cz-sim-r4: instead of the score - "the 0-100 means nothing"), the classification's name and Yotam's signature. A tourist sees
// the department with the name locked until they sign in. Old results have no department: the name alone (the score only
// where nothing else would show - a tourist's locked one).
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const SIGN = '<svg class="sim-sign" viewBox="0 0 140 44" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 30c6-14 14-20 14-9 0 9-7 10-3 1 3-7 10-9 11 1 1 6 6 5 9-3 3-6 7-4 6 3s5 6 9-1c3-5 7-4 6 2 0 5 7 4 11-3l6-8c-1 9 3 11 9 4 4-6 10-6 15-3"/><path d="M18 38c32-5 72-2 108-7"/></svg>';
const PASS_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/></svg>';
const ME_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
function cert(r, locked) {
  const mid = r.dept ? `<div class="sim-cert-dept"><small>${esc(S().dept)}</small><b>${esc(r.dept)}</b></div>`
    : locked ? `<div class="sim-cert-score"><b>${r.score}</b><small>${esc(S().of100)}</small></div>` : '<span></span>';
  return `<div class="sim-cert">
    <div class="sim-cert-h"><span>${brand(S().cert)}</span></div>
    <div class="sim-cert-row">
      <img class="sim-cert-logo" src="/verse/logo-160.png" alt="שלומיוורס">
      ${mid}
      <div class="sim-cert-sign">${SIGN}<small>${esc(S().signed)}</small></div>
    </div>
    ${locked ? `<div class="sim-cert-name locked">${LOCK}<span>${esc(S().locked)}</span></div>` : `<h1 class="sim-cert-name">${esc(r.name)}</h1>`}
  </div>`;
}

function lockedView(r, fresh) {
  const el = box(), c = C[r.host?.id] || C.yotam;
  el.innerHTML = `<section class="sim-res2">
    ${cert(r, true)}
    <div class="sim-sealed"><div class="sim-blur">${[c, ...Object.values(C).filter((x) => x.img && x.id !== c.id).slice(0, 2)].map((x) => `<img src="${esc(x.img)}" alt="">`).join('')}</div>
      <span class="sim-lock">${LOCK}</span>
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
  keep({ rid: r.rid, done: true, full: true, score: r.score, dept: r.dept || null, host: r.host?.id, name: r.name, img: r.img || null });
  const lines = String(r.verdict || '').split('\n');
  const cast = r.cast.filter((x) => C[x.id]), ids = cast.map((x) => x.id);
  const allFollowed = () => ids.every((id) => st.follows.has(id));
  // where to go next (plan cz-sim-r4 mockup simend, 2026-11-07): home first, then the passport (a non-citizen: get one) and the
  // profile side by side, sharing quiet. The certificate, the three and these fit the first screen; the picture + verdict below.
  const pass = isCitizen() ? S().myPass : S().getPass;
  el.innerHTML = `<section class="sim-res2 sim-end">
    ${cert(r)}
    <div class="sim-sec-h"><span>${esc(S().castH)}</span></div>
    <div class="sim-cast3">${cast.map((x) => `<a href="/c/${esc(x.id)}"><img src="${esc(img(x.id))}" alt=""><b>${nameHtml(C[x.id].name)}</b><small>${esc(x.role || '')}</small></a>`).join('')}</div>
    <button class="vx-btn block sim-follow" data-sim-follow ${allFollowed() ? 'disabled' : ''}>${esc(allFollowed() ? S().following : S().followAll(ids.length))}</button>
    <a class="vx-btn main block sim-home" href="/">${esc(S().home)}</a>
    <div class="sim-two">${czOpen() && signedIn() ? `<a class="vx-btn" href="/citizenship" data-sim-pass>${PASS_IC}<span>${esc(pass)}</span></a>` : ''}
      ${signedIn() ? `<a class="vx-btn" href="/me">${ME_IC}<span>${esc(S().myProfile)}</span></a>` : ''}</div>
    <button class="sim-quiet" data-sim-share>${esc(S().share)}</button>
    <div class="sim-pic ${r.img ? 'ok' : 'dev'}">${r.img ? `<img src="${esc(r.img)}" alt="">` : `<div class="sim-faces3">${r.cast.map((x) => `<img src="${esc(img(x.id))}" alt="">`).join('')}</div><span class="sim-dev">${esc(S().developing)}</span>`}</div>
    <p class="sim-verdict">${lines.map(esc).join('<br>')}</p>
</section>`;
  if (fresh || !sessionStorage.getItem('vx-sim-full-' + r.rid)) { track('sim_full', r.rid); try { sessionStorage.setItem('vx-sim-full-' + r.rid, '1'); } catch (e) {} }
  el.querySelector('[data-sim-share]').onclick = () => shareSheet(r);
  el.querySelector('[data-sim-pass]')?.addEventListener('click', () => track('cz_banner', 'sim'));
  // "עקבו אחרי שלושתם": follows them (the site's follow) and adds them to the characters they came to visit (their profile, up to 3)
  el.querySelector('[data-sim-follow]').onclick = async (e) => {
    const b = e.currentTarget;
    b.classList.add('wait');
    let ok = true;
    for (const id of ids) ok = (await follow(id, true)) && ok;
    if (ok) putAbout({ fav: ids }, { add: true }).catch((x) => console.error('sim fav', x));
    b.classList.remove('wait');
    if (!ok) return;
    track('sim_follow', ids.join(','));
    b.disabled = true; b.textContent = S().following; toast(S().followed);
  };
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
      ${r.dept ? `<div class="sim-badge dept"><small>${esc(S().dept)}</small><b>${esc(r.dept)}</b></div>` : ''}</div>
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
  // the department on top (plan cz-sim-r4: no score); old results: the name alone
  if (r.dept) { let f = 80; do { x.font = `900 ${f}px Heebo`; f -= 4; } while (f > 44 && x.measureText(r.dept).width > W - 128); x.fillStyle = '#fc7211'; x.fillText(r.dept, R, 220); }
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
