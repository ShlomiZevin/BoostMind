// The videos feed - the app shell's סרטונים tab on a phone (mockup app-shell/2-videos-feed, plan app-shell phase 5): one video
// per screen between the top bar and the tab bar, swipe up for the next (scroll-snap), newest first (the wiki's fresh()).
// Muted until one tap ("לחצו לשמיעה"), then sound for the whole visit. On every video: the action column (comments with their
// count, sticker, save, share, download - player.js's own functions, given this video as their context), the title, "בכיכוב:"
// with the cast's faces, "לעקוב" and "לדבר" (several characters: a picker first). Three <video> elements serve every slide
// (the one playing, the next - loading - and the one before); the address follows the video (/videos?at=<id>). Views are
// counted by the wiki page's own 'play' listener (data-vid / data-counted, reset here when an element gets a new video).
// The grid stays at /videos?view=grid (and on a computer).
import { db, F } from './fb.js';
import { T } from './copy.js';
import { I, $, esc, av, abs, track } from './ui.js';
import { st, onState, save } from './state.js';
import { openComments, stickerMenu, share, download, remember, watched } from './player.js';
import { castSheet } from './cast.js';   // round 2: a face = a card over the video; "לדבר" = the heads-up, then the chat
import { videoDone } from './status.js';

const FT = T.feed;
const SOUND = 'vx-feed-sound';
let soundOn = (() => { try { return sessionStorage.getItem(SOUND) === '1'; } catch (e) { return false; } })();
let FD = null, mountAt = null;

const castOf = (v) => {
  const c = v.cast.filter((id) => C[id]);
  if (c.length) return c;
  const guess = W.characters.map((x) => x.id).find((id) => v.id.split(/[-_]/).includes(id));   // as the player does
  return guess ? [guess] : [];
};
// the column's comment bubble and share arrow as drawn on mockup 2 (the rest are ui.js's own)
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON_COMMENT = svg('<path d="M6 4.5h12a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5h-7.5L6 21v-3.5a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 6 4.5z"/>');
export const ICON_SHARE = svg('<path d="M14 5.5 20 11l-6 5.5"/><path d="M20 11h-7.5C8 11 4.5 14 4 19"/>');
const ICON_FULL = svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>');
const ICON_SOUND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>';

function slide(v, i) {
  const cast = castOf(v);
  return `<section class="fd-s" data-i="${i}" data-id="${esc(v.id)}" aria-label="${esc(v.title)}">
    ${v.poster ? `<img class="fd-poster" src="${esc(abs(v.poster))}" alt="" ${i > 1 ? 'loading="lazy"' : ''}>` : ''}
    <div class="fd-media"></div>
    <div class="fd-shade"></div>
    <div class="fd-big" aria-hidden="true">${I.play}</div>
    <div class="fd-ui">
      <div class="fd-info">
        <h2 class="fd-t">${esc(v.title)}</h2>
        ${cast.length ? `<div class="fd-cast"><span class="fd-cl">${esc(FT.cast)}</span><div class="fd-chips">${cast.map((id) => `<a class="fd-chip" href="/c/${id}">${av({ char: id })}<span>${esc(C[id].name)}</span></a>`).join('')}</div></div>` : ''}
      </div>
    </div>
    <div class="fd-line"><i></i></div>
  </section>`;
}

// ---------- the rail (his rule 2026-11-17): ONE column for the feed, fixed while the videos swipe under it - its counts and
// states follow the video on screen. The counts of the video before and after are already listening, so a swipe never flickers ----------
const nfmt = (n) => (n ? (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n)) : '');
export const railBtn = (key, attr, ic, label, n) => `<button ${attr}="${key}"><span class="fd-ic"${key === 'save' ? ' data-sv' : ''}>${ic}</span><b${key === 'save' ? ' data-svl' : ''}>${esc(label)}</b>${n ? `<i class="fd-n" data-n="${n}"></i>` : ''}</button>`;
// the rail's place: its bottom ~12px above the picture's bottom, the buttons as big as the room allows (46-56px), one even gap
export function placeRail(rail, top, bottom) {
  const vis = [...rail.children].filter((b) => !b.hidden), n = vis.length || 1, g = innerHeight < 700 ? 6 : 8;
  const extra = vis.filter((b) => b.querySelector('[data-n]')).length * 12;   // a button with a count grows by its line
  const size = Math.max(46, Math.min(innerHeight < 700 ? 46 : 56, Math.floor((bottom - top - extra - (n - 1) * g) / n)));   // a short phone: the small size
  rail.style.setProperty('--rb', size + 'px'); rail.style.setProperty('--rg', g + 'px');
  // the box from the top room to the bottom line, the buttons at its bottom: a count arriving never moves the rail's end
  rail.style.top = Math.round(top) + 'px'; rail.style.height = Math.max(0, Math.round(bottom - top)) + 'px';
}
export function paintSave(rail, on) {
  const ic = rail && rail.querySelector('[data-sv]');
  if (!ic || (ic.classList.contains('on') === on && ic.dataset.p)) return;
  ic.dataset.p = 1; ic.classList.toggle('on', on); ic.innerHTML = on ? I.saved : I.save;
  rail.querySelector('[data-svl]').textContent = on ? FT.saved : FT.save;
}
export function paintCounts(rail, d) {
  if (!rail) return;
  rail.querySelectorAll('[data-n]').forEach((x) => { x.textContent = nfmt((d || {})[x.dataset.n] || 0); });
}
// videoStats/<id> of the item on screen and its two neighbours, live; cache = Map id -> stats
export function statsNear(S, ids, onData) {
  S.subs = S.subs || new Map(); S.stats = S.stats || new Map();
  for (const [id, off] of S.subs) if (!ids.includes(id)) { off(); S.subs.delete(id); }
  for (const id of ids) if (id && !S.subs.has(id)) S.subs.set(id, F.onSnapshot(F.doc(db, 'videoStats', id), (x) => { S.stats.set(id, x.data() || {}); onData(id); }, () => {}));
}
export const statsOff = (S) => { if (S && S.subs) { S.subs.forEach((off) => off()); S.subs.clear(); } };
const fdRail = () => document.getElementById('fd-rail');
function paintSaves() { if (FD && FD.idx >= 0) paintSave(fdRail(), st.saves.has(FD.list[FD.idx].id)); }
function paintRail() {
  if (!FD || FD.idx < 0) return;
  const id = FD.list[FD.idx].id, d = FD.stats && FD.stats.get(id);
  if (FD.ctx && d) FD.ctx.stats = d;
  paintCounts(fdRail(), d || {});
  paintSaves();
}

export function videosFeed(q) {
  unmount();
  const list = fresh().filter((v) => v.src && !v.url);
  if (!list.length) return null;
  let start = q.at ? list.findIndex((v) => v.id === q.at) : 0;
  if (start < 0) start = 0;
  mountAt = q.at || null;
  queueMicrotask(() => mount(list, start));   // once the router has put it on the page
  return `<div class="fd" id="fd" role="feed" aria-label="${esc(FT.title)}">${list.map(slide).join('')}</div>`;
}

function makeVideo() {
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
  v.crossOrigin = 'anonymous';   // the sticker grabs a frame from it
  v.disablePictureInPicture = true;
  v.setAttribute('controlslist', 'nodownload');
  v.addEventListener('contextmenu', (e) => e.preventDefault());
  return v;
}

function mount(list, start) {
  const el = document.getElementById('fd');
  if (!el || FD) return;
  document.documentElement.classList.add('feed-on');
  const slides = [...el.querySelectorAll('.fd-s')];
  FD = { el, list, slides, at: mountAt, idx: -1, pool: [makeVideo(), makeVideo(), makeVideo()], off: [], done: new Set(), userPaused: false, ctx: null, statOff: null, lastSave: 0 };
  const { pool } = FD;

  pool.forEach((vd) => {
    vd.addEventListener('timeupdate', () => {
      if (!FD || vd !== cur()) return;
      const d = vd.duration || 0, t = vd.currentTime;
      if (!d) return;
      const s = FD.slides[FD.idx];
      $('.fd-line i', s).style.width = (t / d) * 100 + '%';
      stripTime();
      const v = FD.list[FD.idx];
      if (Date.now() - FD.lastSave > 3000) { FD.lastSave = Date.now(); remember(v.id, t, d); }
      if (t / d >= 0.8 && !FD.done.has(v.id)) { FD.done.add(v.id); videoDone(v.id, castOf(v)[0] || null); }   // finished counts toward the tourist's 3
    });
    vd.addEventListener('play', () => { if (vd === cur()) { FD.slides[FD.idx].classList.remove('paused'); ctlPaint(); } });
    vd.addEventListener('pause', () => { if (FD && vd === cur()) { if (FD.userPaused) FD.slides[FD.idx].classList.add('paused'); ctlPaint(); } });
    vd.addEventListener('volumechange', () => { if (FD && vd === cur()) paintSound(); });
  });

  // which video is on screen: the one showing at least 70%
  FD.io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting && e.intersectionRatio >= 0.7) activate(+e.target.dataset.i);
  }, { root: el, threshold: [0.7] });
  slides.forEach((s) => FD.io.observe(s));

  el.scrollTop = slideTop(start);
  // back to the feed on a video it was showing (the back button, the tab, "חזרה לסרטון"): that video from the second it stopped at
  if (FD.list[start] && FD.list[start].id === FD.at) FD.resumeAt = FD.at;
  activate(start);

  el.addEventListener('click', onClick);
  // something opened over the feed (comments, the sticker screen, the chat, a video / game / story layer, sign-in): it waits
  FD.mo = new MutationObserver(blockCheck);
  FD.mo.observe(document.body, { childList: true });
  const cx = document.getElementById('cx');
  if (cx) FD.mo.observe(cx, { attributes: true, attributeFilter: ['class'] });
  const vis = () => blockCheck();
  document.addEventListener('visibilitychange', vis);
  const rs = () => resnap();
  // the feed's own height changes (a phone's toolbar, clean mode, the keyboard): back onto the slide showing
  FD.ro = new ResizeObserver(() => { resnap(); ctlPaint(); });
  FD.ro.observe(el);
  // a scroll that ends between two videos (WebKit sometimes stops mid-way): onto the nearest one
  const ended = () => { clearTimeout(FD.endT); FD.endT = setTimeout(settle, 140); };
  el.addEventListener('scroll', ended, { passive: true });
  if ('onscrollend' in window) el.addEventListener('scrollend', settle);
  FD.off.push(() => { FD.ro?.disconnect(); el.removeEventListener('scroll', ended); el.removeEventListener('scrollend', settle); clearTimeout(FD.endT); });
  ctlMount();
  addEventListener('resize', rs);
  addEventListener('vx-tb', rs);
  FD.off.push(() => { document.removeEventListener('visibilitychange', vis); removeEventListener('resize', rs); removeEventListener('vx-tb', rs); });
  FD.off.push(onState(paintSaves));
  track('feed', list[start].id);
}

export function unmount() {
  if (!FD) return;
  document.documentElement.classList.remove('fd-clean');
  document.getElementById('fd-strip')?.remove(); document.getElementById('fd-hint')?.remove(); fdRail()?.remove();
  clearTimeout(hint.t); clearTimeout(hint.idle);
  FD.io?.disconnect(); FD.mo?.disconnect();
  statsOff(FD);
  FD.off.forEach((u) => u && u());
  FD.ctx?.cm?.close('away');
  FD.gate?.destroy();
  FD.pool.forEach((vd) => { vd.pause(); vd.removeAttribute('src'); try { vd.load(); } catch (e) { /* gone */ } vd.remove(); });
  FD.el.removeEventListener('click', onClick);
  FD = null;
  document.documentElement.classList.remove('feed-on');
}
// the router moved on (another page): the feed lets go of its videos
export function feedAfterRoute(page) {
  if (FD && (page !== 'videos' || !document.body.contains(FD.el))) unmount();
}

const cur = () => (FD && FD.idx >= 0 ? FD.pool[FD.idx % 3] : null);
const vctx = () => ({ v: FD.list[FD.idx], video: cur(), from: 'feed' });
function load(i, preload) {
  const s = FD.slides[i], v = FD.list[i];
  if (!s || !v) return;
  const vd = FD.pool[i % 3];
  if (vd.dataset.vid !== v.id) {
    vd.pause();
    vd.dataset.vid = v.id;
    delete vd.dataset.counted;   // a new video on this element: its first play is counted again (the wiki's 'play' listener)
    vd.poster = abs(v.poster || '');
    vd.preload = preload;
    vd.src = abs(v.src);
  } else if (preload === 'auto' && vd.preload !== 'auto') vd.preload = 'auto';
  const media = $('.fd-media', s);
  if (vd.parentNode !== media) media.append(vd);
}
function activate(i) {
  if (!FD || i === FD.idx || !FD.slides[i]) return;
  const prev = cur();
  FD.idx = i;
  FD.userPaused = false;
  load(i, 'auto'); load(i + 1, 'auto'); load(i - 1, 'metadata');
  const vd = cur();
  FD.pool.forEach((x) => { if (x !== vd) x.pause(); });
  FD.slides.forEach((s, k) => s.classList.toggle('on', k === i));
  FD.slides[i].classList.remove('paused');
  if (prev !== vd || vd.currentTime > 0.5) { try { vd.currentTime = 0; } catch (e) { /* not loaded yet */ } }
  const v = FD.list[i];
  if (FD.resumeAt === v.id) {
    FD.resumeAt = null;
    const w = watched()[v.id], seek = () => { try { vd.currentTime = w.t; } catch (e) { /* gone */ } };
    if (w && w.t > 1 && (!w.d || w.t < w.d - 2)) { if (vd.readyState >= 1) seek(); else vd.addEventListener('loadedmetadata', seek, { once: true }); }
  }
  try { sessionStorage.setItem('vx-feed-at', v.id); } catch (e) { /* private mode */ }   // the videos tab comes back to this one
  FD.ctx = { el: FD.slides[i], v, video: vd, lead: castOf(v)[0] || null, stats: null, cm: null };
  // the locked version (signal-lost.js, his concept 2026-11-17): a video with a socials ending drops its signal at the same
  // moment for a signed-out viewer - signing in brings it back
  FD.gate?.destroy(); FD.gate = null;
  if (v.drop) { const s = FD.slides[i]; import('./signal-lost.js').then(({ lockedVersion }) => { if (FD && FD.idx === i && cur() === vd) FD.gate = lockedVersion({ video: vd, stage: $('.fd-media', s), drop: v.drop, host: s }); }); }
  // the comment count of the video on screen, live
  statsNear(FD, [i - 1, i, i + 1].map((k) => FD.list[k] && FD.list[k].id).filter(Boolean), (id) => { if (FD && FD.list[FD.idx].id === id) paintRail(); });
  paintRail();
  if (location.pathname === '/videos') history.replaceState(history.state, '', '/videos?at=' + encodeURIComponent(v.id));
  if (!blocked()) play();
  paintSound();
  ctlPaint();
  if (isClean()) hint();   // a new video in clean mode: the swipe hint again for a moment
}
function play() {
  const vd = cur();
  if (!vd) return;
  vd.muted = !soundOn;
  const p = vd.play();
  if (p) p.catch(() => {
    if (vd !== cur() || vd.muted) return;
    // the browser wants a tap for sound again: muted, and the pill says so
    soundOn = false; vd.muted = true; vd.play().catch(() => {}); paintSound();
  });
}
function paintSound() { ctlPaint(); }   // (the strip's sound control says it - orange with "לחצו לשמיעה" while muted)
function mute() { const vd = cur(); if (!vd) return; soundOn = false; try { sessionStorage.removeItem(SOUND); } catch (e) { /* private */ } vd.muted = true; ctlPaint(); }
function unmute() {
  const vd = cur();
  if (!vd) return;
  soundOn = true;
  try { sessionStorage.setItem(SOUND, '1'); } catch (e) { /* private mode */ }
  vd.muted = false;
  vd.play().catch(() => {});
  // iPhone lets a video play with sound only after a tap on THAT element: the other two are let in now, inside this tap
  FD.pool.forEach((x) => { if (x !== vd && x.src) { x.muted = false; x.play().catch(() => {}); x.pause(); } });
  paintSound();
  track('feed', 'sound:' + FD.list[FD.idx].id);
}

const blocked = () => document.hidden || !!document.querySelector('.vp, .sv, .st, .nk, .vx-sheet, .vx-card, #cx.open');
function blockCheck() {
  if (!FD) return;
  if (!document.body.contains(FD.el)) { unmount(); return; }
  const vd = cur();
  if (!vd) return;
  if (blocked()) vd.pause();
  else if (!FD.userPaused && vd.paused) play();
}

// ---------- the three ways to watch (his notes + mockup app-shell/r9): "מלא" (the feed with everything), "נקי" (only the
// video, still swiping: a tap = play / pause, a thin line, a hint that the next one is a swipe away, the next video's edge
// peeking) and "מסך מלא" (the phone's own player). ONE fixed control at the top-left corner, the same place in both feed
// modes: play / pause, the view switch (expand / shrink), and in clean mode the detach (the phone's own full screen) ----------
const ICON_SHRINK = svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>');
const ICON_DETACH = svg('<path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>');
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>';
const ICON_UP = svg('<path d="m6 15 6-6 6 6"/>', 2.4);
const isClean = () => document.documentElement.classList.contains('fd-clean');
// ---------- the play strip (his notes + mockups app-shell/r10): ONE fixed strip for the feed, not part of a slide - in the full
// view it sits just above the words card at the same y for every video (the picture ends at it); in the clean view the same strip
// moves to the screen's bottom, see-through, with "back to the full view" and "full screen". Play / pause, a seekable line with
// the time, sound (orange with "לחצו לשמיעה" while muted) ----------
const ICON_SND = svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>');
const mmss = (x) => { x = Math.max(0, Math.floor(x || 0)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
function ctlMount() {
  let c = document.getElementById('fd-strip');
  if (!c) {
    c = Object.assign(document.createElement('div'), { id: 'fd-strip', className: 'fd-strip' });
    // laid out as a tape, left to right like every player (not mirrored for RTL): play, time, the line, sound, the views
    c.innerHTML = `<button class="fs-pp" data-c="pp"></button>
      <span class="fs-time"><span class="fs-t1"></span><span class="fs-t2"></span></span>
      <div class="fs-bar" data-c="seek"><i class="fs-fill"></i><b class="fs-knob"></b></div>
      <button class="fs-snd" data-c="snd"></button>
      <button class="fs-view" data-c="view"></button>
      <button class="fs-det" data-c="detach" aria-label="${esc(T.shell.detach)}">${ICON_DETACH}</button>`;
    c.addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]');
      if (!b || !FD || b.dataset.c === 'seek') return;
      e.stopPropagation();
      peek();   // (clean view: a tap on the strip keeps it showing a little longer)
      if (b.dataset.c === 'pp') togglePlay();
      else if (b.dataset.c === 'snd') { const vd = cur(); if (vd && vd.muted) unmute(); else mute(); }
      else if (b.dataset.c === 'view') clean(!isClean());
      else full(cur(), FD.list[FD.idx]);
    });
    // seek: tap or drag on the line (left to right, as a timeline)
    const bar = c.querySelector('.fs-bar');
    const seekTo = (x) => { const vd = cur(), r = bar.getBoundingClientRect(); if (!vd || !vd.duration) return; vd.currentTime = Math.min(1, Math.max(0, (x - r.left) / r.width)) * vd.duration; stripTime(); };
    let drag = false;
    bar.addEventListener('pointerdown', (e) => { e.stopPropagation(); peek(); drag = true; c.classList.add('seeking'); bar.setPointerCapture(e.pointerId); seekTo(e.clientX); });
    bar.addEventListener('pointermove', (e) => { if (drag) seekTo(e.clientX); });
    const stop = () => { drag = false; c.classList.remove('seeking'); };
    bar.addEventListener('pointerup', stop); bar.addEventListener('pointercancel', stop);
    document.body.append(c);
    const r = Object.assign(document.createElement('div'), { id: 'fd-rail', className: 'fd-rail fd-fixed' });
    r.innerHTML = railBtn('comments', 'data-f', ICON_COMMENT, FT.comments, 'comments') + railBtn('sticker', 'data-f', I.sticker, FT.sticker, 'stickers')
      + railBtn('save', 'data-f', I.save, FT.save) + railBtn('share', 'data-f', ICON_SHARE, FT.share) + railBtn('dl', 'data-f', I.download, FT.dl);
    r.addEventListener('click', railClick);
    document.body.append(r);
    paintRail();
    const h = Object.assign(document.createElement('div'), { id: 'fd-hint', className: 'fd-hint' });
    h.innerHTML = `${ICON_UP}<span>${esc(T.shell.swipeNext)}</span>`;
    document.body.append(h);
  }
  ctlPaint();
}
// the frame (mockup r12-A, the lighter feed): the video fills the feed (top bar to tab bar); the title + chips and the fixed strip
// sit on its bottom over a soft gradient; the fixed rail ends ~12px above the tallest words block of the feed (one y for all)
function ctlPlace() {
  const r = fdRail();
  if (!FD || isClean() || !r) return;
  const fr = FD.el.getBoundingClientRect();
  let tall = 0;
  for (const s of FD.slides) { const i = s.querySelector('.fd-info'); if (i) tall = Math.max(tall, i.offsetHeight); }
  if (!tall || !fr.height) return;
  placeRail(r, fr.top + 12, fr.bottom - 50 - tall - 24);   // its bottom ~24px above the tallest title's top, growing upward
}
function ctlPaint() {
  const c = document.getElementById('fd-strip');
  if (!c || !FD) return;
  ctlPlace();
  const vd = cur(), playing = vd && !vd.paused, muted = !vd || vd.muted;
  const pp = c.querySelector('[data-c="pp"]'), view = c.querySelector('[data-c="view"]'), snd = c.querySelector('[data-c="snd"]');
  pp.innerHTML = playing ? ICON_PAUSE : ICON_PLAY; pp.setAttribute('aria-label', playing ? FT.pause : FT.play);
  view.innerHTML = isClean() ? ICON_SHRINK : ICON_FULL; view.setAttribute('aria-label', isClean() ? T.shell.cleanOff : T.shell.clean);
  snd.classList.toggle('muted', muted);
  snd.innerHTML = muted ? ICON_SOUND_OFF : ICON_SND;   // muted: the icon alone on orange (no words - the line keeps its room)
  snd.setAttribute('aria-label', muted ? FT.sound : T.shell.mute);
  stripTime();
}
function stripTime() {
  const c = document.getElementById('fd-strip'), vd = cur();
  if (!c || !vd) return;
  const d = vd.duration || 0, t = vd.currentTime || 0, p = d ? (t / d) * 100 : 0;
  c.querySelector('.fs-fill').style.width = p + '%';
  c.querySelector('.fs-knob').style.left = p + '%';
  c.querySelector('.fs-t1').textContent = mmss(t);
  c.querySelector('.fs-t2').textContent = ` / ${d ? mmss(d) : '-:--'}`;   // (the narrowest phones: the second only - the line keeps its room)
}
function togglePlay() {
  const vd = cur();
  if (!vd || !FD) return;
  if (vd.paused) { FD.userPaused = false; play(); } else { FD.userPaused = true; vd.pause(); }
  const s = FD.slides[FD.idx];
  s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash');   // the soft big sign, for a moment
  s.querySelector('.fd-big').innerHTML = vd.paused ? I.play : ICON_PAUSE;
  setTimeout(ctlPaint, 0);
}
// the hint: on entering clean mode and on each new video for ~2 s; after a while without a swipe, quietly again
function hint(on = true) {
  const h = document.getElementById('fd-hint');
  if (!h) return;
  clearTimeout(hint.t); clearTimeout(hint.idle);
  h.classList.toggle('on', on && isClean());
  if (on) hint.t = setTimeout(() => h.classList.remove('on'), 2200);
  if (isClean()) hint.idle = setTimeout(() => { if (isClean()) { h.classList.add('on', 'quiet'); hint.t = setTimeout(() => h.classList.remove('on', 'quiet'), 2600); } }, 9000);
}
// the clean view's strip shows for ~3 s (on entering, on a tap), then steps aside
function peek(on = true) {
  const c = document.getElementById('fd-strip');
  if (!c) return;
  clearTimeout(peek.t);
  c.classList.remove('away');
  if (on && isClean()) peek.t = setTimeout(() => { if (isClean()) c.classList.add('away'); }, 3000);
}
function clean(on) {
  if (!FD) return;
  const html = document.documentElement;
  if (html.classList.contains('fd-clean') === on) { ctlPaint(); return; }
  html.classList.toggle('fd-clean', on);
  if (on) track('feed', 'clean:' + FD.list[FD.idx].id);
  ctlPaint();
  peek(on);
  resnap(true);
  hint(on);
}
// ---------- snapping that holds: by the slide's own top (works with clean mode's shorter slides), after layout settles ----------
const slideTop = (i) => (FD && FD.slides[i] ? FD.slides[i].offsetTop : 0);
function resnap(hard) {
  if (!FD || FD.idx < 0) return;
  const idx = FD.idx, el = FD.el;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!FD || FD.el !== el) return;
    if (hard) el.style.scrollSnapType = 'none';
    el.scrollTop = slideTop(idx);
    if (hard) requestAnimationFrame(() => { el.style.scrollSnapType = ''; });
  }));
}
function settle() {
  if (!FD) return;
  const el = FD.el, y = el.scrollTop;
  let best = 0, d = Infinity;
  FD.slides.forEach((s, k) => { const dd = Math.abs(s.offsetTop - y); if (dd < d) { d = dd; best = k; } });
  if (d > 2) el.scrollTo({ top: FD.slides[best].offsetTop, behavior: 'smooth' });
}
// full screen: the browser's own on the <video> (iPhone: webkitEnterFullscreen); leaving it (back, the exit) returns to the feed
function full(vd, v) {
  if (!vd) return;
  const back = () => { if (!document.fullscreenElement && !document.webkitFullscreenElement) { document.removeEventListener('fullscreenchange', back); resnap(true); } };
  document.addEventListener('fullscreenchange', back);
  vd.addEventListener('webkitendfullscreen', () => resnap(true), { once: true });
  track('feed', 'full:' + v.id);
  const p = vd.requestFullscreen ? vd.requestFullscreen() : vd.webkitRequestFullscreen ? vd.webkitRequestFullscreen() : null;
  if (p && p.catch) p.catch(() => { if (vd.webkitEnterFullscreen) vd.webkitEnterFullscreen(); });
  else if (!p && vd.webkitEnterFullscreen) vd.webkitEnterFullscreen();
  if (vd.paused) vd.play().catch(() => {});
}
function onClick(e) {
  if (!FD) return;
  const s = e.target.closest('.fd-s');
  if (!s || +s.dataset.i !== FD.idx) return;
  const chip = e.target.closest('.fd-chip');
  // a face: their card (follow, talk, their page - the heads-up before leaving), the video waits
  if (chip) { e.preventDefault(); castSheet(chip.getAttribute('href').split('/').pop(), vctx()); return; }
  if (e.target.closest('a, button')) return;
  // a tap on the video: sound first (while muted), then play / pause - with the soft big sign for a moment
  if (isClean()) { peek(); return; }   // the clean view: a tap only brings the strip back (its play button pauses)
  if (cur().muted) { unmute(); return; }
  togglePlay();
}
// the fixed rail's buttons act on the video on screen
function railClick(e) {
  const b = e.target.closest('[data-f]');
  if (!b || !FD || FD.idx < 0) return;
  e.stopPropagation();
  const v = FD.list[FD.idx], ctx = FD.ctx;
  switch (b.dataset.f) {
    case 'comments': openComments({}, ctx); break;
    case 'sticker': stickerMenu(ctx); break;   // make one / the fans' stickers of this video
    case 'save': save(v.id); break;
    case 'share': share(v); break;
    case 'dl': download(v); break;
  }
}
