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
import { I, $, esc, av, abs, sheet, track } from './ui.js';
import { st, onState, follow, save } from './state.js';
import { openComments, openSticker, share, download, remember, followBtn, paintFollow, watched } from './player.js';
import { castSheet, talkFromVideo } from './cast.js';   // round 2: a face = a card over the video; "לדבר" = the heads-up, then the chat
import { offerPush } from './push.js';
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
const gender = (id) => (typeof GENDER !== 'undefined' && GENDER[id]) || 'm';
// the column's comment bubble and share arrow as drawn on mockup 2 (the rest are ui.js's own)
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_COMMENT = svg('<path d="M6 4.5h12a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5h-7.5L6 21v-3.5a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 6 4.5z"/>');
const ICON_SHARE = svg('<path d="M14 5.5 20 11l-6 5.5"/><path d="M20 11h-7.5C8 11 4.5 14 4 19"/>');
const ICON_SOUND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>';

function slide(v, i) {
  const cast = castOf(v);
  return `<section class="fd-s" data-i="${i}" data-id="${esc(v.id)}" aria-label="${esc(v.title)}">
    ${v.poster ? `<img class="fd-poster" src="${esc(abs(v.poster))}" alt="" ${i > 1 ? 'loading="lazy"' : ''}>` : ''}
    <div class="fd-media"></div>
    <div class="fd-shade"></div>
    <div class="fd-big" aria-hidden="true">${I.play}</div>
    <div class="fd-ui">
      <div class="fd-rail">
        <button data-f="comments" aria-label="${esc(FT.comments)}"><span class="fd-ic">${ICON_COMMENT}</span><b data-cc>${esc(FT.comments)}</b></button>
        <button data-f="sticker"><span class="fd-ic">${I.sticker}</span><b>${esc(FT.sticker)}</b></button>
        <button data-f="save"><span class="fd-ic" data-sv>${I.save}</span><b data-svl>${esc(FT.save)}</b></button>
        <button data-f="share"><span class="fd-ic">${ICON_SHARE}</span><b>${esc(FT.share)}</b></button>
        <button data-f="dl"><span class="fd-ic">${I.download}</span><b>${esc(FT.dl)}</b></button>
      </div>
      <div class="fd-info">
        <button class="fd-sound" data-f="sound" hidden>${ICON_SOUND_OFF}<span>${esc(FT.sound)}</span></button>
        <h2 class="fd-t">${esc(v.title)}</h2>
        ${cast.length ? `<div class="fd-cast"><span class="fd-cl">${esc(FT.cast)}</span><div class="fd-chips">${cast.map((id) => `<a class="fd-chip" href="/c/${id}">${av({ char: id })}<span>${esc(C[id].name)}</span></a>`).join('')}</div></div>
        <div class="fd-acts"><button class="fd-follow" data-f="follow"></button><button class="fd-talk" data-f="talk">${I.comment}<span>${esc(cast.length > 1 ? FT.talkAll : FT.talk1[gender(cast[0])])}</span></button></div>` : ''}
      </div>
    </div>
    <div class="fd-line"><i></i></div>
  </section>`;
}

// the follow button's words: one character - "לעקוב אחריו / אחריה", several - "לעקוב אחרי הדמויות"; followed = a check
function paintFollows() {
  if (!FD) return;
  FD.el.querySelectorAll('.fd-s').forEach((s) => {
    const b = $('.fd-follow', s);
    if (!b) return;
    const cast = castOf(FD.list[+s.dataset.i]);
    const all = cast.every((id) => st.follows.has(id));
    b.classList.toggle('on', all);
    b.innerHTML = all ? `${I.check}<span>${esc(cast.length > 1 ? FT.followingAll : T.following)}</span>`
      : `${I.plus}<span>${esc(cast.length > 1 ? FT.followAll : FT.follow1[gender(cast[0])])}</span>`;
  });
}
function paintSaves() {
  if (!FD) return;
  FD.el.querySelectorAll('.fd-s').forEach((s) => {
    const on = st.saves.has(s.dataset.id);
    const ic = $('[data-sv]', s);
    if (ic.classList.contains('on') === on && ic.dataset.p) return;
    ic.dataset.p = 1;
    ic.classList.toggle('on', on);
    ic.innerHTML = on ? I.saved : I.save;
    $('[data-svl]', s).textContent = on ? FT.saved : FT.save;
  });
}
function paintCount(s, n) {
  const b = s && $('[data-cc]', s);
  if (b) b.textContent = n ? (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n)) : FT.comments;
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
      const v = FD.list[FD.idx];
      if (Date.now() - FD.lastSave > 3000) { FD.lastSave = Date.now(); remember(v.id, t, d); }
      if (t / d >= 0.8 && !FD.done.has(v.id)) { FD.done.add(v.id); videoDone(v.id, castOf(v)[0] || null); }   // finished counts toward the tourist's 3
    });
    vd.addEventListener('play', () => { if (vd === cur()) FD.slides[FD.idx].classList.remove('paused'); });
    vd.addEventListener('pause', () => { if (FD && vd === cur() && FD.userPaused) FD.slides[FD.idx].classList.add('paused'); });
    vd.addEventListener('volumechange', () => { if (FD && vd === cur()) paintSound(); });
  });

  // which video is on screen: the one showing at least 70%
  FD.io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting && e.intersectionRatio >= 0.7) activate(+e.target.dataset.i);
  }, { root: el, threshold: [0.7] });
  slides.forEach((s) => FD.io.observe(s));

  el.scrollTop = start * el.clientHeight;
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
  const rs = () => { if (FD && FD.idx >= 0) FD.el.scrollTop = FD.idx * FD.el.clientHeight; };
  addEventListener('resize', rs);
  addEventListener('vx-tb', rs);
  FD.off.push(() => { document.removeEventListener('visibilitychange', vis); removeEventListener('resize', rs); removeEventListener('vx-tb', rs); });
  FD.off.push(onState(() => { paintSaves(); paintFollows(); }));
  paintSaves(); paintFollows();
  track('feed', list[start].id);
}

export function unmount() {
  if (!FD) return;
  FD.io?.disconnect(); FD.mo?.disconnect();
  FD.statOff?.();
  FD.off.forEach((u) => u && u());
  FD.ctx?.cm?.close('away');
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
  // the comment count of the video on screen, live
  FD.statOff?.();
  const ctx = FD.ctx;
  FD.statOff = F.onSnapshot(F.doc(db, 'videoStats', v.id), (s) => { const d = s.data() || {}; ctx.stats = d; paintCount(ctx.el, d.comments || 0); }, () => {});
  if (location.pathname === '/videos') history.replaceState(history.state, '', '/videos?at=' + encodeURIComponent(v.id));
  if (!blocked()) play();
  paintSound();
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
function paintSound() {
  if (!FD) return;
  const vd = cur();
  FD.slides.forEach((s, k) => { const b = $('.fd-sound', s); b.hidden = !(k === FD.idx && vd && vd.muted); });
}
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

// the people on the video: one = straight to them; several = a short list first
function pick(kind) {
  const cast = castOf(FD.list[FD.idx]);
  const h = sheet(`<div class="fd-pick"><h2 class="vx-h">${esc(kind === 'follow' ? FT.pickFollow : FT.pickTalk)}</h2>
    <div class="fd-pl">${cast.map((id) => `<div class="fd-pr">${av({ char: id, ring: true })}<b>${esc(C[id].name)}</b>
      ${kind === 'follow' ? followBtn(id, 'pill') : `<button class="vx-pill fd-tt" data-talk-to="${id}">${I.comment}${esc(FT.talkTo)}</button>`}</div>`).join('')}</div></div>`, { cls: 'fd-sheet' });
  if (kind === 'follow') {
    paintFollow(h.el);
    const off = onState(() => paintFollow(h.el));
    h.el.addEventListener('click', () => setTimeout(() => paintFollow(h.el), 0));
    const close = h.close;
    h.close = (w) => { off(); close(w); };
  } else {
    h.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-talk-to]');
      if (!b) return;
      h.close('talk');
      talkFromVideo(b.dataset.talkTo, vctx());
    });
  }
}

async function onClick(e) {
  if (!FD) return;
  const s = e.target.closest('.fd-s');
  if (!s || +s.dataset.i !== FD.idx) return;
  const chip = e.target.closest('.fd-chip');
  if (chip) { e.preventDefault(); castSheet(chip.getAttribute('href').split('/').pop(), vctx()); return; }   // a face: their card, the video waits
  if (e.target.closest('a')) return;
  const b = e.target.closest('[data-f]');
  const v = FD.list[FD.idx], ctx = FD.ctx, vd = cur();
  if (!b) {
    // a tap on the video: sound first (while muted), then pause / play
    if (vd.muted) { unmute(); return; }
    if (vd.paused) { FD.userPaused = false; play(); } else { FD.userPaused = true; vd.pause(); }
    return;
  }
  const cast = castOf(v);
  switch (b.dataset.f) {
    case 'sound': unmute(); break;
    case 'comments': openComments({}, ctx); break;
    case 'sticker': openSticker(ctx); break;
    case 'save': save(v.id); break;
    case 'share': share(v); break;
    case 'dl': download(v); break;
    case 'follow':
      if (cast.length > 1) pick('follow');
      else if (cast[0]) { const on = !st.follows.has(cast[0]); if ((await follow(cast[0], on)) && on) offerPush(cast[0]); }
      break;
    case 'talk':
      if (cast.length > 1) pick('talk');
      else if (cast[0]) talkFromVideo(cast[0], vctx());
      break;
  }
}
