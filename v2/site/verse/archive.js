// הארכיון - /archive (his ask, 2026-11-10; mockups scripts/v2-design/archive.mjs A1 phone, A3 the post sheet, A4 desktop):
// every Instagram post of his since 2019 (~1,315), for residents only. He finds old videos by WHEN they were, so: newest first,
// the month and year as headers pinned while you scroll through them, a timeline to jump to any year / month (a column on the
// right on a computer, two rows on a phone, and the pinned header opens it too), the date on every post. The caption's start
// is on every post (he reads it to recognise the video) and search finds words in captions, hashtags, dates ("2023",
// "אוגוסט 2024", "24.8") and the cast. A post not in the verse yet can be asked for (verse op wish, with an optional note);
// the residents who asked hear when it's in (verse.js wishFound). The list: insta-to-verse's scripts/insta/gallery.py ->
// gs://shlomiverse-media/insta/list.json {items: [{id, d, l, c, cap, p, k, t, h?, v?, who?}]} + covers insta/t/<id>.jpg.
import { call } from './fb.js';
import { T } from './copy.js';
import { I, esc, sheet, toast, track } from './ui.js';
import { needFan, signedIn, onState } from './state.js';

const A = () => T.arc;
const LIST = 'https://storage.googleapis.com/shlomiverse-media/insta/list.json';
const COVER = (id) => `https://storage.googleapis.com/shlomiverse-media/insta/t/${id}.jpg`;
const IG = (p) => `https://www.instagram.com/reel/${p}/`;
const HEART = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-8-5-8-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8C20 16 12 21 12 21z"/></svg>';
const BUBBLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z"/></svg>';
const SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

const k = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'K' : String(n || 0));
const num = (n) => Number(n).toLocaleString('he-IL');
const ymd = (d) => d.split('-').map(Number);
const dot = (d) => { const [y, m, dd] = ymd(d); return `${dd}.${m}.${y}`; };
const longDate = (d) => { const [y, m, dd] = ymd(d); return `${dd} ב${A().months[m - 1]} ${y}`; };
const monthKey = (d) => d.slice(0, 7);
const monthTitle = (mk) => { const [y, m] = mk.split('-').map(Number); return `${A().months[m - 1]} ${y}`; };
const norm = (s) => String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[״"׳'`’]/g, '');
const tagsOf = (x) => (Array.isArray(x.h) && x.h.length ? x.h : [...String(x.cap || '').matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]));
const textOf = (x) => String(x.cap || '').replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\s+\n/g, '\n').trim();

let items = null, failed = false, loading = null;
let sort = 'new', filter = 'all', q = '', wishesLoaded = false;
const mine = new Set(), counts = {}, done = {};
let unsub = null, io = null;

function load() {
  if (loading) return loading;
  loading = fetch(LIST, { cache: 'no-cache' }).then((r) => r.json()).then((d) => {
    items = (d.items || []).map((x) => {
      const [y, m, dd] = ymd(x.d);
      const tags = tagsOf(x);
      // everything search reads: the caption, the hashtags (with and without #), the cast, and the date in every way he'd type it
      x._hay = norm([x.cap, tags.join(' '), tags.map((t) => '#' + t).join(' '), (x.who || []).join(' '), x.d, `${dd}.${m}.${y}`, `${dd}.${m}`, `${m}.${y}`,
        A().months[m - 1], `${A().months[m - 1]} ${y}`, String(y)].join(' '));
      x._tags = tags;
      return x;
    }).sort((a, b) => b.d.localeCompare(a.d) || b.id.localeCompare(a.id));
  }).catch(() => { failed = true; });
  return loading;
}
async function loadWishes() {
  if (wishesLoaded || !signedIn()) return;
  wishesLoaded = true;
  try {
    const r = await call('wishes');
    (r.mine || []).forEach((id) => mine.add(id));
    Object.assign(counts, r.counts || {}); Object.assign(done, r.done || {});
    paint();
  } catch (e) { wishesLoaded = false; }
}

// ---------- the home's strip (his choice 2026-11-10: H4's layout with H3's fanned covers + the planet, mockups
// scripts/v2-design/archive-home.mjs; under the hero as a strip, never in it): an announcement - the archive is everything,
// far more than the verse; find any video, ask for it. One small file (insta/strip.json: the count, the first year, one
// cover a year) - the home never loads the whole list. ----------
let strip = null;
export function archiveStrip(onReady) {
  if (strip === null) {
    strip = false;
    fetch('https://storage.googleapis.com/shlomiverse-media/insta/strip.json', { cache: 'no-cache' }).then((r) => r.json())
      .then((d) => { if (d && d.n && d.covers?.length) { strip = d; onReady?.(); } }).catch(() => {});
  }
  if (!strip) return '';
  const S = A().strip, v = (typeof W !== 'undefined' && W?.videos?.length) || 0;
  let seen = false; try { seen = !!localStorage.getItem('vx-arc-seen'); } catch (e) {}
  const covers = strip.covers.slice(-4);
  return `<a class="arc-strip" href="/archive" data-arc-strip>
    <div class="arc-txt">${seen ? '' : `<span class="arc-tag">${esc(S.tag)}</span>`}<b class="arc-title">${esc(S.title)}</b>
      <p class="arc-long">${esc(S.line(num(strip.n), strip.from, num(v)))}</p><p class="arc-short">${esc(S.short(num(strip.n), num(v)))}</p>
      <div class="arc-vs"><span class="on">${esc(S.arc)} · <b>${num(strip.n)}</b></span><span>${esc(S.verse)} · <b>${num(v)}</b></span></div>
      <span class="arc-go"><span>${esc(S.go)}</span><i>${I.next}</i></span>
      <small class="arc-only">${LOCK}${esc(S.only)}</small></div>
    <div class="arc-fan" aria-hidden="true">${covers.map((c, i) => `<span class="arc-c c${i}"><img src="${COVER(c.id)}" alt="" loading="lazy"><em>${c.y}</em></span>`).join('')}
      <img class="arc-planet" src="/verse/logo-512.png" alt=""></div></a>`;
}

// ---------- the page ----------
export function archivePage() {
  setTimeout(mount, 0);
  return `<div class="ar-page" id="ar-root"><div class="ar-wait">${esc(A().loading)}</div></div>`;
}
async function mount() {
  const root = document.getElementById('ar-root');
  if (!root) return;
  if (new URLSearchParams(location.search).get('mine') === '1') filter = 'mine';
  try { localStorage.setItem('vx-arc-seen', '1'); } catch (e) {}
  if (!unsub) unsub = onState(() => { if (!document.getElementById('ar-root')) { unsub(); unsub = null; return; } if (signedIn() !== (root.dataset.in === '1')) mount(); });
  await load();
  if (!document.getElementById('ar-root')) return;
  if (failed || !items) { root.innerHTML = `<div class="ar-wait">${esc(A().failed)}</div>`; return; }
  root.dataset.in = signedIn() ? '1' : '0';
  if (!signedIn()) return locked(root);
  const top = document.getElementById('top');
  root.style.setProperty('--ar-top', `${top ? top.getBoundingClientRect().height : 64}px`);
  const tags = popularTags();
  root.innerHTML = `<div class="ar-head"><h1>${esc(A().title)}</h1><p>${esc(A().sub(num(items.length), items[items.length - 1].d.slice(0, 4)))}</p></div>
    <label class="ar-search">${SEARCH}<input id="ar-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="${esc(A().search)}" value="${esc(q)}"></label>
    <div class="ar-tags"><span>${esc(A().popular)}</span>${tags.map((t) => `<button data-ar-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>
    <div class="ar-chips">${[['all', A().all], ['out', A().notIn], ['mine', A().mine]].map(([kk, l]) => `<button data-ar-filter="${kk}" class="${filter === kk ? 'on' : ''}">${esc(l)}${kk === 'mine' ? '<i class="ar-mine-n"></i>' : ''}</button>`).join('')}
      <span class="ar-sep"></span>${[['new', A().newest], ['old', A().oldest], ['liked', A().liked]].map(([kk, l]) => `<button data-ar-sort="${kk}" class="${sort === kk ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
    <div class="ar-body"><aside class="ar-time" id="ar-time"></aside><div class="ar-main"><div class="ar-count" id="ar-count"></div><div id="ar-list"></div></div></div>`;
  let qt;
  root.insertAdjacentHTML('beforeend', `<div class="ar-bar" id="ar-bar"><div><b id="ar-bar-n"></b><small>${esc(A().barSub)}</small></div><button class="vx-btn main small" data-ar-mine></button></div>`);
  root.querySelector('#ar-q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { q = e.target.value.trim(); paint(); }, 160); });
  paint();
  loadWishes();
}
function locked(root) {
  const pics = items.filter((x) => x.t).slice().sort((a, b) => b.l - a.l).slice(0, 12);
  root.innerHTML = `<div class="ar-lock"><div class="ar-lock-pics" aria-hidden="true">${pics.map((x) => `<img src="${COVER(x.id)}" alt="" loading="lazy">`).join('')}</div>
    <div class="ar-lock-card"><span class="ar-lock-ic">${LOCK}</span><h1>${esc(A().lockTitle)}</h1><p>${esc(A().lockSub)}</p>
    <button class="vx-btn main block" data-ar-in>${esc(A().lockGo)}</button></div></div>`;
}
function popularTags() {
  const n = {};
  for (const x of items) for (const t of x._tags) n[t] = (n[t] || 0) + 1;
  return Object.entries(n).filter(([t]) => t !== 'שלומיוורס').sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
}
function shown() {
  let L = items;
  if (filter === 'out') L = L.filter((x) => !x.v && !done[x.id]);
  if (filter === 'mine') L = L.filter((x) => mine.has(x.id));
  if (q) {
    const words = norm(q).replace(/^#/, '').split(/\s+/).map((w) => w.replace(/^#/, '')).filter(Boolean);
    L = L.filter((x) => words.every((w) => x._hay.includes(w)));
  }
  if (sort === 'old') L = L.slice().reverse();
  if (sort === 'liked') L = L.slice().sort((a, b) => b.l - a.l);
  return L;
}

function card(x) {
  const vid = x.v || done[x.id], n = counts[x.id] || 0, me = mine.has(x.id);
  const badge = vid ? `<span class="ar-in">${esc(A().inVerse)}</span>` : n ? `<span class="ar-n">${esc(A().askedShort(n))}</span>` : '';
  const act = vid ? `<a class="ar-btn ghost" href="/v/${esc(vid)}" data-ar-stop>${I.play}<span>${esc(A().watch)}</span></a>`
    : me ? `<button class="ar-btn done" data-ar-open>${I.check}<span>${esc(A().asked)}</span></button>`
    : `<button class="ar-btn" data-ar-ask>${I.plus}<span>${esc(A().ask)}</span></button>`;
  const cap = textOf(x) || x._tags.map((t) => '#' + t).join(' ');
  return `<article class="ar-card${vid ? ' in' : ''}" data-id="${x.id}">
    <div class="ar-cover">${x.t ? `<img src="${COVER(x.id)}" alt="" loading="lazy" decoding="async">` : ''}${badge}</div>
    <div class="ar-meta"><span class="ar-date">${dot(x.d)}</span><span>${HEART}${k(x.l)}</span><span>${BUBBLE}${k(x.c)}</span></div>
    <p class="ar-cap">${esc(cap)}</p>${vid && x.who?.length ? `<p class="ar-who">${esc(x.who.join(' · '))}</p>` : ''}
    <div class="ar-act">${act}</div></article>`;
}
// what I asked for: the chip's count and the bar at the bottom
function mineUi() {
  const n = mine.size, c = document.querySelector('.ar-mine-n'), bar = document.getElementById('ar-bar');
  if (c) c.textContent = n ? ` · ${n}` : '';
  if (!bar) return;
  bar.classList.toggle('show', n > 0);
  document.getElementById('ar-bar-n').textContent = A().barN(n);
  bar.querySelector('[data-ar-mine]').textContent = filter === 'mine' ? A().barAll : A().barList;
}
// one post drawn again in place - asking never redraws the list (his note 2026-11-10: "I asked for a movie and the page jumped")
function updateCard(x) {
  const el = document.querySelector(`.ar-card[data-id="${x.id}"]`);
  if (el) el.outerHTML = card(x);
  mineUi();
}
function paint() {
  const root = document.getElementById('ar-root'), list = document.getElementById('ar-list');
  if (!root || !list) return;
  const L = shown();
  document.getElementById('ar-count').textContent = L.length === items.length ? A().posts(num(L.length)) : A().found(num(L.length), num(items.length));
  if (!L.length) { list.innerHTML = `<div class="ar-empty">${esc(filter === 'mine' ? A().noneMine : A().none)}</div>`; timeline([]); return; }
  if (sort === 'liked') { list.innerHTML = `<section class="ar-sec"><div class="ar-grid">${L.map(card).join('')}</div></section>`; timeline([]); return; }
  // month sections, the header pinned while its month scrolls by
  const months = [];
  for (const x of L) { const mk = monthKey(x.d); if (!months.length || months[months.length - 1].mk !== mk) months.push({ mk, list: [] }); months[months.length - 1].list.push(x); }
  list.innerHTML = months.map((m) => `<section class="ar-sec" data-mk="${m.mk}"><button class="ar-mh" data-ar-jump id="ar-m-${m.mk}"><b>${esc(monthTitle(m.mk))}</b><span>${esc(A().posts(num(m.list.length)))}</span>${CAL}</button>
    <div class="ar-grid">${m.list.map(card).join('')}</div></section>`).join('');
  timeline(months.map((m) => m.mk));
  watch();
  mineUi();
}

// ---------- the timeline: years, and the months of the year you're in ----------
let tl = [], curMk = null;
function timeline(mks) {
  tl = mks;
  if (!curMk || !mks.includes(curMk)) curMk = mks[0] || null;
  drawTimeline();
}
function drawTimeline() {
  const box = document.getElementById('ar-time');
  if (!box) return;
  if (!tl.length) { box.innerHTML = ''; box.hidden = true; return; }
  box.hidden = false;
  const years = [...new Set(tl.map((m) => m.slice(0, 4)))];
  const y = (curMk || tl[0]).slice(0, 4);
  const have = new Set(tl.filter((m) => m.startsWith(y)).map((m) => +m.slice(5)));
  const monthsOrder = sort === 'old' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  box.innerHTML = `<div class="ar-t-h">${CAL}<span>${esc(A().jump)}</span></div>
    <div class="ar-years">${years.map((yy) => `<button data-ar-year="${yy}" class="${yy === y ? 'on' : ''}">${yy}</button>`).join('')}</div>
    <div class="ar-months">${monthsOrder.filter((m) => have.has(m)).map((m) => { const mk = `${y}-${String(m).padStart(2, '0')}`; return `<button data-ar-month="${mk}" class="${mk === curMk ? 'on' : ''}"><span class="l">${esc(A().months[m - 1])}</span><span class="s">${esc(A().monthsShort[m - 1])}</span></button>`; }).join('')}</div>`;
  const on = box.querySelector('.ar-years .on'); if (on && box.querySelector('.ar-years').scrollWidth > box.clientWidth) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}
// which month is at the top while scrolling (its header is pinned there)
function watch() {
  if (io) io.disconnect();
  const top = parseFloat(getComputedStyle(document.getElementById('ar-root')).getPropertyValue('--ar-top')) || 64;
  io = new IntersectionObserver((es) => {
    const secs = [...document.querySelectorAll('.ar-sec[data-mk]')];
    const at = secs.find((s) => s.getBoundingClientRect().bottom > top + 60);
    if (at && at.dataset.mk !== curMk) { curMk = at.dataset.mk; drawTimeline(); }
  }, { rootMargin: `-${top}px 0px 0px 0px`, threshold: [0, 1] });
  document.querySelectorAll('.ar-sec[data-mk]').forEach((s) => io.observe(s));
}
function goMonth(mk) {
  const h = document.getElementById('ar-m-' + mk);
  if (!h) return;
  const top = parseFloat(getComputedStyle(document.getElementById('ar-root')).getPropertyValue('--ar-top')) || 64;
  curMk = mk; drawTimeline();
  window.scrollTo({ top: h.closest('.ar-sec').getBoundingClientRect().top + scrollY - top + 1, behavior: 'smooth' });
}
function jumpSheet() {
  const years = [...new Set(tl.map((m) => m.slice(0, 4)))];
  const s = sheet(`<div class="in"><div class="ar-jump"><h2>${CAL}${esc(A().jump)}</h2>${years.map((y) => `<div class="ar-jy"><b>${y}</b><div>${tl.filter((m) => m.startsWith(y)).map((mk) =>
    `<button data-ar-go="${mk}" class="${mk === curMk ? 'on' : ''}">${esc(A().monthsShort[+mk.slice(5) - 1])}</button>`).join('')}</div></div>`).join('')}</div></div>`, { cls: 'ar-sheet' });
  s.el.addEventListener('click', (e) => { const b = e.target.closest('[data-ar-go]'); if (b) { s.close('x'); setTimeout(() => goMonth(b.dataset.arGo), 280); } });
}

// ---------- one post, big: the whole caption, its hashtags, the ask with a note ----------
function postSheet(x) {
  const draw = () => {
    const vid = x.v || done[x.id], n = counts[x.id] || 0, me = mine.has(x.id);
    const ask = vid ? `<a class="vx-btn main block" href="/v/${esc(vid)}" data-vx-close>${I.play}<span>${esc(A().watch)} ${esc(A().inVerse)}</span></a>${x.who?.length ? `<p class="ar-s-who">${esc(x.who.join(' · '))}</p>` : ''}`
      : `${me ? `<div class="ar-s-done">${I.check}<div><b>${esc(A().askedTitle)}</b><small>${esc(A().askedSub)}</small></div></div>` : ''}
        <textarea id="ar-note" maxlength="300" rows="2" placeholder="${esc(A().note)}"></textarea>
        <button class="vx-btn main block" data-ar-send>${esc(me ? A().askSave : A().askGo)}</button>
        ${n ? `<p class="ar-s-n">${I.people}<span>${esc(A().askedN(n))}</span></p>` : ''}${me ? `<button class="ar-s-undo" data-ar-undo>${esc(A().askUndo)}</button>` : ''}`;
    return `<div class="ar-s"><a class="ar-s-cover" href="${IG(x.p)}" target="_blank" rel="noopener">${x.t ? `<img src="${COVER(x.id)}" alt="">` : ''}</a>
      <div class="ar-s-body"><p class="ar-s-date">${esc(longDate(x.d))}</p>
        <div class="ar-s-nums"><span>${HEART}${k(x.l)}</span><span>${BUBBLE}${k(x.c)}</span></div>
        <p class="ar-s-cap">${esc(textOf(x))}</p>
        ${x._tags.length ? `<div class="ar-s-tags">${x._tags.map((t) => `<button data-ar-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
        <a class="vx-btn glass block" href="${IG(x.p)}" target="_blank" rel="noopener">${I.out}<span>${esc(A().onInsta)}</span></a>
        <div class="ar-s-ask">${ask}</div></div></div>`;
  };
  const s = sheet(`<div class="in">${draw()}</div>`, { cls: 'ar-sheet' });
  const redraw = () => { s.el.querySelector('.ar-s').outerHTML = draw(); };
  s.el.addEventListener('click', async (e) => {
    const tag = e.target.closest('[data-ar-tag]');
    if (tag) { s.close('x'); setTag(tag.dataset.arTag); return; }
    if (e.target.closest('[data-ar-send]')) {
      const b = e.target.closest('[data-ar-send]'); b.disabled = true;
      if (await ask(x, true, (s.el.querySelector('#ar-note')?.value || '').trim())) s.close('x'); else { b.disabled = false; redraw(); }
    }
    if (e.target.closest('[data-ar-undo]')) { await ask(x, false); redraw(); }
  });
}
async function ask(x, on, note = '') {
  if (!(await needFan('archive'))) return false;
  try {
    const r = await call('wish', { ig: x.id, on, note, permalink: IG(x.p) });
    if (r.done) { done[x.id] = r.videoId; mine.delete(x.id); toast(A().toastIn); }
    else { counts[x.id] = r.n; r.mine ? mine.add(x.id) : mine.delete(x.id); toast(on ? A().toastAsked : A().toastUndo); track('click', on ? 'arc_ask' : 'arc_undo'); }
    updateCard(x);
    return true;
  } catch (e) {
    toast(e.code === 'closed' ? A().toastClosed : e.code === 'text_bad' ? A().toastBad : A().toastFail);
    return false;
  }
}
function setTag(t) {
  q = '#' + t;
  const inp = document.getElementById('ar-q'); if (inp) inp.value = q;
  paint(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', async (e) => {
  if (!e.target.closest('#ar-root')) return;
  const t = e.target.closest('button, a, article');
  if (!t) return;
  if (t.matches('[data-ar-in]')) { e.preventDefault(); if (await needFan('archive')) mount(); return; }
  if (t.matches('[data-ar-tag]')) return setTag(t.dataset.arTag);
  if (t.matches('[data-ar-mine]')) { filter = filter === 'mine' ? 'all' : 'mine'; document.querySelectorAll('[data-ar-filter]').forEach((b) => b.classList.toggle('on', b.dataset.arFilter === filter)); paint(); window.scrollTo({ top: 0 }); return; }
  if (t.matches('[data-ar-filter]')) { filter = t.dataset.arFilter; t.parentElement.querySelectorAll('[data-ar-filter]').forEach((b) => b.classList.toggle('on', b === t)); paint(); return; }
  if (t.matches('[data-ar-sort]')) { sort = t.dataset.arSort; curMk = null; t.parentElement.querySelectorAll('[data-ar-sort]').forEach((b) => b.classList.toggle('on', b === t)); paint(); window.scrollTo({ top: 0 }); return; }
  if (t.matches('[data-ar-year]')) { const mk = tl.find((m) => m.startsWith(t.dataset.arYear)); if (mk) goMonth(mk); return; }
  if (t.matches('[data-ar-month]')) return goMonth(t.dataset.arMonth);
  if (t.matches('[data-ar-jump]')) return jumpSheet();
  if (t.matches('[data-ar-stop]')) return;   // the post's own link (watch in the verse)
  const c = t.closest('.ar-card');
  if (!c) return;
  const x = items.find((i) => i.id === c.dataset.id);
  if (!x) return;
  if (t.matches('[data-ar-ask]')) { t.disabled = true; await ask(x, true); t.disabled = false; return; }
  postSheet(x);
});
