// The video page (#/v/<id>) - and a game's (#/play/<id>), the same page with the game where the video plays: always vertical, edge to edge. Watching is naked - only a hair-thin progress line and a
// faded wordmark. One tap pauses and floats in the glass controls (mockup 2): the character + follow, the orange
// "sticker from the moment" first, comments, save, share, and the episode card with its scrubber. Comments (a sheet:
// likes, replies, @character answers) and the sticker screen (mockup 3) live here too.
import { db, F, call } from './fb.js';
import { T } from './copy.js';
import { I, $, esc, av, ago, mmss, sheet, toast, track, abs, charColor, stampText, catchphrase, wordmark, isIOS, isAndroid, LIKE, LINK_RE, linkTag, ofc, lockScroll, unlockScroll } from './ui.js';
import { st, onState, needFan, follow, save, signedIn } from './state.js';
import { openBoard, onScore, TROPHY } from './records.js';
import { appMoment } from './install.js';
import { offerPush } from './push.js';

let P = null;   // the open player
let backTo = '/';
export const setBack = (h) => { backTo = h || '/'; };

// ---------- episodes and "continue watching" ----------
export function episodes(v) {
  const s = S[v.series];
  const list = (s ? s.videos : [v.id]).map((id) => V[id]).filter((x) => x && !x.url);
  return list.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || W.videos.indexOf(b) - W.videos.indexOf(a));
}
const WATCH = 'vx-watch';
export function watched() { try { return JSON.parse(localStorage.getItem(WATCH)) || {}; } catch (e) { return {}; } }
function remember(id, t, d) {
  const all = watched();
  all[id] = { t: Math.round(t), d: Math.round(d), at: Date.now() };
  const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 40);
  try { localStorage.setItem(WATCH, JSON.stringify(Object.fromEntries(keep))); } catch (e) {}
}

// ---------- the page ----------
// The layer takes the size of what the phone really shows (visualViewport), kept up to date: iPhone sometimes sizes a
// fixed full-screen layer shorter than the screen and leaves an empty black strip at the bottom (his screenshot,
// 2026-11-03, a game opened by refreshing its link).
function fit(el) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const go = () => { el.style.top = vv.offsetTop + 'px'; el.style.height = vv.height + 'px'; el.style.bottom = 'auto'; };
  go();
  const ts = [setTimeout(go, 300), setTimeout(go, 1200)];
  vv.addEventListener('resize', go); vv.addEventListener('scroll', go); addEventListener('orientationchange', go);
  return () => { ts.forEach(clearTimeout); vv.removeEventListener('resize', go); vv.removeEventListener('scroll', go); removeEventListener('orientationchange', go); };
}
const opened = () => document.documentElement.classList.remove('opening');   // the wiki page hid the home until now
export function openPlayer(id, q = {}) {
  const v = V[id];
  if (!v) { opened(); window.showNotFound?.(); return; }
  if (v.url) { opened(); window.open(v.url, '_blank', 'noopener'); nav(backTo, true); return; }
  if (P && P.v.id === id) { deepLinks(q); return; }
  if (P) destroy();
  const eps = episodes(v);
  const n = eps.findIndex((x) => x.id === id);
  // who posted it: the first of the cast; a video whose cast is empty in the wiki data falls back to a character named in its id
  const lead = v.cast.find((c) => C[c]) || W.characters.map((c) => c.id).find((id) => v.id.split(/[-_]/).includes(id)) || null;
  const el = document.createElement('div');
  el.className = 'vp ui';
  el.innerHTML = `<div class="vp-bg" style="background-image:url('${abs(v.poster)}')"></div>
    <div class="vp-stage">
      <video playsinline webkit-playsinline preload="auto" crossorigin="anonymous" poster="${abs(v.poster)}" src="${abs(v.src)}"></video>
      <div class="vp-dim"></div>
      <div class="vp-big">${I.play}</div>
      <div class="vp-mark"><img src="/verse/logo-160.png" alt=""></div>
      <div class="vp-line"><i></i></div>
    </div>
    <div class="vp-ui">
      <div class="vp-head">
        ${lead ? `<a class="vp-who" href="/c/${lead}">${av({ char: lead, ring: true })}<b>${esc(C[lead].name)}</b></a>${followBtn(lead, 'pill')}` : ''}
        <a class="vp-brand" href="/" data-close aria-label="חזרה לשלומיוורס"><img src="/verse/logo-160.png" alt="שלומיוורס"></a>
      </div>
      <div class="vp-rail">
        <button data-sticker><span class="vx-round main">${I.sticker}</span>${esc(T.sticker)}</button>
        <button data-comments><span class="vx-round">${I.comment}</span>${esc(T.comments)}<small data-count-c></small></button>
        <button data-save><span class="vx-round">${I.save}</span><span data-save-l>${esc(T.save)}</span></button>
        <button data-share><span class="vx-round">${I.share}</span>${esc(T.share)}</button>
      </div>
      <div class="vp-ep">
        <div><h2>${esc(v.title)}</h2><div class="meta">${esc(S[v.series] && eps.length > 1 ? T.episode(n + 1, S[v.series].title) : (S[v.series]?.title || (lead ? C[lead].name : '')))}</div></div>
        <button class="vx-round pp" data-pp aria-label="נגינה">${I.play}</button>
        <div class="scrub"><input type="range" min="0" max="1000" value="0" data-scrub aria-label="מיקום בסרטון"><div class="times"><span data-cur>00:00</span><span data-dur>--:--</span></div></div>
      </div>
    </div>`;
  document.body.append(el);
  lockScroll();   // the page behind stays put (iPhone scrolls a body under overflow: hidden)
  const video = $('video', el);
  P = { el, v, video, lead, off: [fit(el)], hideT: 0 };
  opened();

  // live counts under the video
  P.off.push(F.onSnapshot(F.doc(db, 'videoStats', id), (s) => { const d = s.data() || {}; P && (P.stats = d, $('[data-count-c]', el).textContent = d.comments ? String(d.comments) : ''); }, () => {}));
  P.off.push(onState(() => P && paint()));
  paint();

  // play: with sound when the browser allows it, otherwise muted with "tap for sound"
  const resume = watched()[id];
  if (resume && resume.t > 3 && resume.t < resume.d - 4) video.currentTime = resume.t;
  video.play().then(() => setUi(false, 2200)).catch(() => {
    video.muted = true;
    video.play().catch(() => {});
    const b = document.createElement('button');
    b.className = 'vx-btn glass vp-sound';
    b.innerHTML = `${I.sound}${esc(T.tapSound)}`;
    b.onclick = (e) => { e.stopPropagation(); video.muted = false; b.remove(); video.play(); setUi(false); };
    $('.vp-stage', el).append(b);
    setUi(false, 2200);
  });
  track('video', id);

  let lastSave = 0;
  video.addEventListener('timeupdate', () => {
    const d = video.duration || 0, t = video.currentTime;
    if (!d) return;
    const p = (t / d) * 100;
    $('.vp-line i', el).style.width = p + '%';
    const r = $('[data-scrub]', el);
    if (!r.matches(':active')) { r.value = Math.round(p * 10); r.style.setProperty('--p', p + '%'); }
    $('[data-cur]', el).textContent = mmss(t);
    if (Date.now() - lastSave > 3000) { lastSave = Date.now(); remember(id, t, d); }
  });
  video.addEventListener('loadedmetadata', () => { $('[data-dur]', el).textContent = mmss(video.duration); });
  video.addEventListener('play', () => { el.classList.remove('paused'); $('[data-pp]', el).innerHTML = I.pause; flashLine(); });
  video.addEventListener('pause', () => { el.classList.add('paused'); $('[data-pp]', el).innerHTML = I.play; });
  video.addEventListener('ended', () => { remember(id, video.duration, video.duration); setUi(true); P.liked = true; });
  $('[data-scrub]', el).addEventListener('input', (e) => {
    const p = e.target.value / 10;
    e.target.style.setProperty('--p', p + '%');
    if (video.duration) video.currentTime = (p / 100) * video.duration;
  });

  // a tap on the picture shows / hides everything around it (comments, save, the episode bar) and never stops the video -
  // he wants to look at the sides while it keeps playing. Stopping is the play/pause button (or space). A paused video
  // starts again from a tap too.
  $('.vp-stage', el).addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (video.muted && $('.vp-sound', el)) { video.muted = false; $('.vp-sound', el).remove(); return; }
    if (video.paused) { video.play(); return; }
    setUi(!el.classList.contains('ui'));
    flashLine();
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button, a');
    if (!b) return;
    if (b.matches('[data-close]')) { e.preventDefault(); close(); }
    else if (b.matches('[data-pp]')) { if (video.paused) video.play(); else { video.pause(); setUi(true); } }
    else if (b.matches('[data-comments]')) openComments();
    else if (b.matches('[data-save]')) save(id);
    else if (b.matches('[data-share]')) share(v);
    else if (b.matches('[data-sticker]')) openSticker();
    else if (b.matches('[data-ep]') && b.dataset.ep) nav('/v/' + b.dataset.ep, true);
    else if (b.matches('.vp-who')) { /* the link closes the player through the router */ }
  });
  // swipe up / down: the next / previous episode
  let y0 = null;
  $('.vp-stage', el).addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
  $('.vp-stage', el).addEventListener('touchend', (e) => {
    if (y0 === null) return;
    const dy = e.changedTouches[0].clientY - y0;
    y0 = null;
    if (Math.abs(dy) < 80) return;
    const to = dy < 0 ? eps[n + 1] : eps[n - 1];
    if (to) nav('/v/' + to.id, true);
  });
  P.key = (e) => {
    if (document.querySelector('.vx-sheet, .st, input:focus, textarea:focus')) return;
    if (e.key === ' ') { e.preventDefault(); if (video.paused) video.play(); else { video.pause(); setUi(true); } }
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowDown' && eps[n + 1]) nav('/v/' + eps[n + 1].id, true);
    if (e.key === 'ArrowUp' && eps[n - 1]) nav('/v/' + eps[n - 1].id, true);
  };
  document.addEventListener('keydown', P.key);
  deepLinks(q);
}

// ---------- a game: the video page's parts, in a frame (his ask, 2026-11-03; mockups scripts/v2-design/game-frame.mjs) ----------
// Every game in wiki.json gets this page for free. Laid out like the video page, but nothing ever covers the game: the
// character + follow and the logo above, the rail beside the framed game (the planet like in the sticker's place,
// comments under the game's id, save, share), the title card with a labelled "מסך מלא" below. Full screen = the game
// fills the phone and ONE labelled pill (the character's face + "יציאה ממסך מלא") brings the frame back.
// The game protocol (verse/game-frame.js, loaded by every game): the game says hello, the page answers with the strip
// to keep free at its top - 0 in the frame, the pill's height in full screen - so the pill never hides the game's HUD.
// (The first version floated the video's buttons over the game and faded them - he couldn't find them again.)
// Playing needs an account (his rule, 2026-11-03), but the first game of each game is free on this device - the game's
// cover and "התחברו כדי לשחק" stand in for it after that. A game with a daily record (game.json "record") gets the
// "שיאים" button, and its score at game over goes on today's table (verse/records.js).
const FREE = 'verse-free:';
const FULL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const SHRINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
export function openGame(id, q = {}) {
  const g = (W.games || []).find((x) => x.id === id);
  if (!g) { opened(); window.showNotFound?.(); return; }
  if (P && P.v.id === id) { deepLinks(q); return; }
  if (P) destroy();
  const lead = (g.chars || []).find((c) => C[c]) || null;
  const v = { id, title: g.title, cast: g.chars || [], game: g };
  const el = document.createElement('div');
  el.className = 'vp vg';
  const face = lead ? av({ char: lead }) : av({ planet: true });
  el.innerHTML = `<div class="vp-bg" style="background-image:url('${esc(g.img || '')}')"></div>
    <div class="vg-col">
      <div class="vg-head">
        ${lead ? `<a class="vp-who" href="/c/${lead}">${av({ char: lead, ring: true })}<b>${esc(C[lead].name)}</b></a>${followBtn(lead, 'pill')}` : ''}
        <a class="vp-brand" href="/" data-close aria-label="חזרה לשלומיוורס"><img src="/verse/logo-160.png" alt="שלומיוורס"></a>
      </div>
      <div class="vg-mid">
      <div class="vg-acts">
        ${g.record ? `<button data-records><span class="vx-round">${TROPHY}</span>${esc(T.rec.rail)}</button>` : ''}
        <button data-heart><span class="vx-round">${I.planet}</span><span data-heart-l>${esc(T.gLike)}</span><small data-count-h></small></button>
        <button data-comments><span class="vx-round">${I.comment}</span>${esc(T.comments)}<small data-count-c></small></button>
        <button data-save><span class="vx-round">${I.save}</span><span data-save-l>${esc(T.save)}</span></button>
        <button data-share><span class="vx-round">${I.share}</span>${esc(T.share)}</button>
      </div>
      <div class="vg-game"></div>
      </div>
      <div class="vg-card">
        <div><h2>${esc(g.title)}</h2><div class="meta">${esc(g.tagline || (lead ? T.gMeta(C[lead].name) : ''))}</div></div>
        <button class="vg-full" data-full>${FULL}<span>${esc(T.gFull)}</span></button>
      </div>
    </div>
    <button class="vg-exit" data-exit>${face}<span>${esc(T.gExit)}</span>${SHRINK}</button>`;
  document.body.append(el);
  lockScroll();
  P = { el, v, lead, off: [fit(el)], hideT: 0, hearted: false, uid: undefined };
  opened();
  document.title = `${g.title} · שלומיוורס`;
  P.off.push(F.onSnapshot(F.doc(db, 'videoStats', id), (s) => {
    const d = s.data() || {};
    if (!P) return;
    P.stats = d;
    $('[data-count-c]', el).textContent = d.comments ? String(d.comments) : '';
    $('[data-count-h]', el).textContent = d.hearts > 0 ? String(d.hearts) : '';
  }, () => {}));
  // their own like: read again whenever who is signed in changes
  const mine = () => {
    const uid = st.user?.uid || null;
    if (!P || P.uid === uid) return;
    P.uid = uid;
    if (P.offHeart) P.offHeart();
    P.offHeart = null; P.hearted = false;
    if (uid) P.offHeart = F.onSnapshot(F.doc(db, 'fans', uid, 'hearts', id), (s) => { if (P) { P.hearted = s.exists(); paint(); } }, () => {});
  };
  P.off.push(onState(() => { if (P) { mine(); paint(); decide(); if (signedIn() && !frame) mount(); } }), () => P?.offHeart?.());
  mine();
  paint();
  track('game', id);
  // full screen: the page's own (no frame) everywhere; on top of it the browser's real full screen where there is one
  // (Android, computers - not iPhone). Leaving the browser's full screen (Esc, back) brings the frame back too.
  // the game itself - or, signed out after the free game, its cover and the way in
  let frame = null;
  const box = $('.vg-game', el);
  const mount = () => {
    if (frame || !P) return;
    box.innerHTML = `<iframe src="${esc(g.url)}" title="${esc(g.title)}" allow="autoplay; fullscreen; clipboard-write; web-share" allowfullscreen></iframe>`;
    frame = $('iframe', box);
  };
  const gate = () => {
    box.innerHTML = `<div class="vg-gate">${g.img ? `<img src="${esc(g.img)}" alt="">` : ''}<h3>${esc(T.rec.gateTitle)}</h3><p>${esc(T.rec.gateSub)}</p>
      <button class="vx-btn main" data-gate>${esc(T.rec.gateBtn)}</button></div>`;
  };
  // decided once we know who is here (a fresh page learns it a moment after the page opens): signed in, or the first
  // game of this game on this device = play; otherwise the way in
  let decided = false;
  const decide = () => {
    if (decided || !st.ready || !P) return;
    decided = true;
    let free = false;
    try { free = !localStorage.getItem(FREE + id); } catch (x) {}
    if (signedIn()) mount();
    else if (free) { try { localStorage.setItem(FREE + id, '1'); } catch (x) {} mount(); }
    else gate();
  };
  if (g.img) box.innerHTML = `<div class="vg-gate wait"><img src="${esc(g.img)}" alt=""></div>`;
  decide();
  const tell = () => {
    const top = el.classList.contains('full') ? Math.ceil($('.vg-exit', el).getBoundingClientRect().bottom + 6) : 0;
    frame?.contentWindow?.postMessage({ verse: 'frame', top }, '*');
  };
  const full = async (on) => {
    el.classList.toggle('full', on);
    tell();
    const go = el.requestFullscreen || el.webkitRequestFullscreen;
    if (on && go && !document.fullscreenElement) { try { await go.call(el); } catch (x) {} }
    if (!on && document.fullscreenElement === el) document.exitFullscreen?.().catch(() => {});
    tell();
  };
  P.onFs = () => { if (P && !document.fullscreenElement) P.el.classList.remove('full'); if (P) tell(); };
  document.addEventListener('fullscreenchange', P.onFs);
  const again = () => { if (frame) frame.src = g.url; };
  P.onMsg = (e) => {
    if (!P || !frame || e.source !== frame.contentWindow || !e.data) return;
    if (e.data.verse === 'hello') tell();
    else if (e.data.verse === 'score') { P.liked = true; if (g.record) onScore(g, Number(e.data.value), { reopen: again }); }
  };
  addEventListener('message', P.onMsg);
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button, a');
    if (!b) return;
    if (b.matches('[data-close]')) { e.preventDefault(); close(); }
    else if (b.matches('[data-full]')) full(true);
    else if (b.matches('[data-exit]')) full(false);
    else if (b.matches('[data-heart]')) heart();
    else if (b.matches('[data-records]')) openBoard(g, { onAgain: again });
    else if (b.matches('[data-gate]')) { if (await needFan('play')) mount(); }
    else if (b.matches('[data-comments]')) openComments();
    else if (b.matches('[data-save]')) save(id, 'saveGame');
    else if (b.matches('[data-share]')) share(v);
  });
  P.key = (e) => {
    if (document.querySelector('.vx-sheet, .st, input:focus, textarea:focus')) return;
    if (e.key === 'Escape' && !document.fullscreenElement) { if (el.classList.contains('full')) full(false); else close(); }
  };
  document.addEventListener('keydown', P.key);
  deepLinks(q);
  if (q.records && g.record) setTimeout(() => openBoard(g, { onAgain: again }), 400);   // "someone took your first place" 
}
async function heart() {
  if (!(await needFan('heart')) || !P) return;
  const { el, v } = P, on = !P.hearted;
  P.hearted = on;
  const n = $('[data-count-h]', el), was = parseInt(n.textContent, 10) || 0;
  n.textContent = Math.max(0, was + (on ? 1 : -1)) || '';
  paint();
  if (on) { const r = $('[data-heart] .vx-round', el); r.classList.remove('pop'); void r.offsetWidth; r.classList.add('pop'); toast(T.gLikeToast); track('heart', v.id); }
  call('heart', { id: v.id, on }).catch(() => { toast(T.errGeneric); if (P) { P.hearted = !on; paint(); } });
}
function deepLinks(q) {
  if (q.c) setTimeout(() => openComments({ focus: q.c }), 300);
  else if (q.sticker) setTimeout(() => openComments({ tab: 's', focus: q.sticker }), 300);
  else if (q.how === 'sticker') setTimeout(stickerTip, 900);
}
// from the home's "what you can do": the sticker button pointed out until they press it (or anything else)
function stickerTip() {
  const b = P && P.el.querySelector('[data-sticker]');
  if (!b) return;
  const tip = Object.assign(document.createElement('div'), { className: 'vp-tip', textContent: T.stTip });
  b.classList.add('pulse');
  b.append(tip);
  setUi(true, 9000);   // the buttons stay up while it shows
  const off = () => { tip.remove(); b.classList.remove('pulse'); P?.el.removeEventListener('pointerdown', off, true); };
  setTimeout(() => P?.el.addEventListener('pointerdown', off, true), 400);
  setTimeout(off, 9000);
}
// the thin time line at the bottom: a moment after the video starts or after a tap, then it fades (he: "it remains")
function flashLine() {
  if (!P) return;
  P.el.classList.add('line-on');
  clearTimeout(P.lineT);
  P.lineT = setTimeout(() => P && P.el.classList.remove('line-on'), 2500);
}
function setUi(on, ms) {
  if (!P) return;
  clearTimeout(P.hideT);
  P.el.classList.toggle('ui', on || !!ms);
  if (ms) P.hideT = setTimeout(() => P && !(P.video && P.video.paused) && P.el.classList.remove('ui'), ms);
}
function paint() {
  const { el, v } = P;
  const saved = st.saves.has(v.id);
  $('[data-save] .vx-round', el).innerHTML = saved ? I.saved : I.save;
  $('[data-save] .vx-round', el).classList.toggle('on', saved);
  $('[data-save-l]', el).textContent = saved ? T.saved : T.save;
  const h = $('[data-heart] .vx-round', el);
  if (h) { h.classList.toggle('main', !!P.hearted); $('[data-heart-l]', el).textContent = P.hearted ? T.gLiked : T.gLike; }
  paintFollow(el);
}
function share(v) {
  const url = `${location.origin}/${v.game ? 'play' : 'v'}/${v.id}`;
  track('share', v.id);
  if (navigator.share) navigator.share({ title: v.title, text: T.shareText(v.title), url }).catch(() => {});
  else { navigator.clipboard?.writeText(url); toast(T.linkCopied); }
}
function close() { nav(backTo); }
function destroy() {
  if (!P) return;
  // a video watched (to its end, or 20 s) or a game played: once the layer is gone, a good moment to offer the home screen
  const liked = P.liked || (P.video && P.video.currentTime > 20), lead = P.lead, kind = P.video ? 'video' : 'game';
  if (liked) setTimeout(() => appMoment(kind, lead), 400);   // appMoment waits until no other layer is open
  if (P.cm) P.cm.close('away');
  P.off.forEach((u) => u && u());
  document.removeEventListener('keydown', P.key);
  if (P.onFs) document.removeEventListener('fullscreenchange', P.onFs);
  if (P.onMsg) removeEventListener('message', P.onMsg);
  if (P.video) { P.video.pause(); P.video.removeAttribute('src'); P.video.load(); }
  if (document.fullscreenElement === P.el) document.exitFullscreen?.().catch(() => {});
  P.el.querySelector('iframe')?.remove();   // the game stops (its sound too)
  P.el.remove();
  P = null;
  unlockScroll();
}
export function closePlayer() { const was = !!P; destroy(); document.querySelectorAll('.st').forEach((x) => x.remove()); return was; }

// ---------- follow: the same button everywhere (the video page, the character page) ----------
export function followBtn(char, kind = 'pill') {
  return kind === 'pill'
    ? `<button class="vx-pill" data-follow="${char}">${esc(T.follow)}</button>`
    : `<button class="btn ghost" data-follow="${char}">${I.plus}<span>${esc(T.follow)}</span></button>`;
}
export function paintFollow(root = document) {
  root.querySelectorAll('[data-follow]').forEach((b) => {
    const on = st.follows.has(b.dataset.follow);
    b.classList.toggle('on', on);
    const label = on ? T.following : T.follow;
    if (b.classList.contains('vx-pill')) b.innerHTML = on ? `${I.check}${esc(label)}` : esc(label);
    else b.innerHTML = `${on ? I.check : I.plus}<span>${esc(label)}</span>`;
  });
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-follow]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  const char = b.dataset.follow;
  const on = !st.follows.has(char);
  if (await follow(char, on) && on) offerPush(char);
}, true);

// ---------- comments ----------
function mentionOf(text, v) {
  const order = [...v.cast, ...W.characters.map((c) => c.id)];
  return order.find((id) => C[id] && text.includes('@' + C[id].name)) || null;
}
// @mentions light up: a character (tap = their page) and anyone in the thread by their name (longest names first, so
// "@צופה מהספה" wins over "@צופה")
// A link in a comment is a whole tappable link (his ask, 2026-11-01): shown left-to-right so the slash stays at its end
function richText(text, nicks = []) {
  const marks = [];
  let h = esc(text).replace(LINK_RE, (u) => `\u0000${marks.push(linkTag(u)) - 1}\u0000`);
  const names = [...W.characters.map((c) => ({ n: c.name, c })), ...nicks.filter(Boolean).map((n) => ({ n }))]
    .sort((a, b) => b.n.length - a.n.length);
  for (const { n, c } of names) {
    const at = '@' + esc(n);
    if (!h.includes(at)) continue;
    const tag = c ? `<a class="at" href="/c/${c.id}" style="--c:${charColor(c.id)}">${at}</a>` : `<span class="at fan">${at}</span>`;
    h = h.split(at).join(`\u0000${marks.push(tag) - 1}\u0000`);
  }
  return h.replace(/\u0000(\d+)\u0000/g, (_, i) => marks[i]);
}

export function openComments({ tab = 'c', focus = null } = {}) {
  if (!P || document.querySelector('.cm')) return;
  const { v } = P;
  P.video?.pause();
  setUi(true);
  let comments = [], stickers = [], myLikes = new Set(), myStamps = new Set(), cur = tab, replying = null;
  // what this fan just sent shows at once (faded, "sending") while the server checks it; the real one replaces it
  let pending = [], nicks = [];
  const all = () => [...comments, ...pending.filter((p) => !p.realId || !comments.some((c) => c.id === p.realId))];
  const open = new Set(), typing = new Map(), off = [];
  const h = P.cm = sheet(`<div class="tabs"><button class="vx-pill" data-tab="c"></button>${v.game ? '' : '<button class="vx-pill" data-tab="s"></button>'}
      <button class="vx-x" data-vx-close style="position:static;margin-inline-start:auto">${I.x}</button></div>
    <div class="list"></div>
    <div class="cm-compose"></div>`, { cls: 'cm', onClose: () => { off.forEach((u) => u()); if (P) P.cm = null; } });
  const list = $('.list', h.el), compose = $('.cm-compose', h.el);

  off.push(F.onSnapshot(F.query(F.collection(db, 'comments'), F.where('videoId', '==', v.id), F.where('hidden', '==', false), F.orderBy('t', 'desc'), F.limit(300)), (s) => {
    comments = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    // a character answered: stop its "writing..."
    for (const [root, w] of typing) if (comments.some((c) => c.parentId === root && c.char === w.char && (c.t?.toMillis?.() || Date.now()) > w.since)) typing.delete(root);
    draw();
  }, (e) => console.error('comments', e)));
  if (!v.game) off.push(F.onSnapshot(F.query(F.collection(db, 'stickers'), F.where('videoId', '==', v.id), F.where('status', '==', 'live'), F.where('hidden', '==', false), F.orderBy('stampCount', 'desc'), F.limit(60)), (s) => {
    stickers = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    draw();
  }, (e) => console.error('stickers', e)));
  const mine = () => {
    if (!st.user) return;
    off.push(F.onSnapshot(F.query(F.collection(db, 'fans', st.user.uid, 'likes'), F.where('videoId', '==', v.id)), (s) => { myLikes = new Set(s.docs.map((d) => d.id)); draw(); }, () => {}));
    off.push(F.onSnapshot(F.query(F.collection(db, 'fans', st.user.uid, 'stamps'), F.where('videoId', '==', v.id)), (s) => { myStamps = new Set(s.docs.map((d) => d.id)); draw(); }, () => {}));
  };
  mine();
  const offState = onState(() => { if (st.user && !off.mine) { off.mine = 1; mine(); } drawCompose(); });
  off.push(offState);

  const row = (c, isReply) => {
    const isMine = st.user && c.uid === st.user.uid;
    return `<div class="cm-item ${c.char ? 'char' : ''} ${c.pending ? 'sending' : ''} ${focus === c.id ? 'hl' : ''}" style="--c:${c.char ? charColor(c.char) : 'var(--vx-accent)'}" data-cid="${c.id}">
      ${c.char ? `<a class="cm-face" href="/c/${c.char}" aria-label="${esc(c.nick)}">${av({ char: c.char, ring: true })}</a>` : av({ fan: c })}
      <div class="body"><div class="cm-who">${c.char ? `<a href="/c/${c.char}"><b>${esc(c.nick)}</b></a>` : `<b>${esc(c.nick)}</b>${ofc(c)}`}<small>${c.pending ? esc(T.cmSending) : c.t ? ago(c.t) : T.now}</small></div>
        <div class="txt">${richText(c.text, nicks)}</div>
        ${c.pending ? '' : `<div class="acts"><button data-like="${c.id}" class="like ${myLikes.has(c.id) ? 'on' : ''}" aria-label="${esc(T.cmLike)}">${LIKE}<span>${c.likeCount || esc(T.cmLike)}</span></button>
          <button data-reply="${c.id}" data-root="${c.parentId || c.id}">${esc(T.cmReply)}</button>
          ${isMine ? `<button data-del="${c.id}">${esc(T.cmDelete)}</button>` : ''}</div>`}</div></div>`;
  };
  function draw() {
    const comments = all();
    nicks = [...new Set(comments.filter((x) => !x.char).map((x) => x.nick))];
    $('[data-tab="c"]', h.el).textContent = T.tabsComments(comments.length || P?.stats?.comments || 0);
    if (!v.game) $('[data-tab="s"]', h.el).textContent = T.tabsStickers(stickers.length);
    h.el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === cur));
    compose.style.display = cur === 'c' ? '' : 'none';
    if (cur === 's') { list.innerHTML = stickerTab(stickers, myStamps); return; }
    const now = Date.now();
    const tops = comments.filter((c) => !c.parentId).sort((a, b) => {
      const fresh = (c) => (st.user && c.uid === st.user.uid && now - (c.t?.toMillis?.() || now) < 300e3 ? 1 : 0);
      return fresh(b) - fresh(a) || (b.likeCount || 0) - (a.likeCount || 0) || (b.t?.toMillis?.() || now) - (a.t?.toMillis?.() || now);
    });
    if (!tops.length) { list.innerHTML = `<div class="cm-empty">${esc(T.cmEmpty)}</div>`; return; }
    list.innerHTML = tops.map((c) => {
      const reps = comments.filter((r) => r.parentId === c.id).sort((a, b) => (a.t?.toMillis?.() || now) - (b.t?.toMillis?.() || now));
      const showAll = open.has(c.id) || reps.some((r) => r.id === focus);
      const shown = showAll ? reps : reps.slice(-2);
      const w = typing.get(c.id);
      return row(c) + (reps.length || w ? `<div class="cm-replies">
        ${!showAll && reps.length > 2 ? `<button class="cm-more" data-more="${c.id}">${esc(T.cmMore(reps.length - 2))}</button>` : ''}
        ${shown.map((r) => row(r, true)).join('')}
        ${w ? `<div class="cm-typing">${av({ char: w.char, cls: '' }).replace('vx-av', 'vx-av" style="width:28px;height:28px')}<span>${esc(T.cmTyping(C[w.char].name, typeof GENDER !== 'undefined' ? GENDER[w.char] : null))}</span><i></i></div>` : ''}</div>` : '');
    }).join('');
    if (focus) { const f = list.querySelector(`[data-cid="${focus}"]`); if (f) { f.scrollIntoView({ block: 'center' }); focus = null; } }
  }
  function drawCompose() {
    if (!st.user || !st.fan?.nick) { compose.innerHTML = `<button class="vx-btn main block" data-in>${esc(T.cmSignin)}</button>`; return; }
    if (compose.querySelector('textarea')) return;
    compose.innerHTML = `<div class="cm-replying" style="display:none"><span></span><button data-unreply>${I.x.replace('<svg', '<svg width="16" height="16"')}</button></div>
      <div class="cm-at" style="display:none"></div>
      <form>${av({ fan: st.fan, cls: '' }).replace('vx-av', 'vx-av" style="width:40px;height:40px;align-self:center')}
        <textarea rows="1" maxlength="500" placeholder="${esc(T.cmPlaceholder)}"></textarea>
        <button class="send" disabled aria-label="שליחה">${I.send}</button></form>
      <div class="cm-note">${esc(T.cmNote)}</div>`;
    const ta = $('textarea', compose), send = $('.send', compose), atBox = $('.cm-at', compose);
    window.atMirror?.(ta);   // an @tag stays coloured while typing (the wiki page's mirror)
    ta.oninput = () => {
      send.disabled = !ta.value.trim();
      ta.style.height = '48px'; ta.style.height = Math.min(ta.scrollHeight + 2, 120) + 'px';
      const m = /@([^\s@]{0,14})$/.exec(ta.value.slice(0, ta.selectionStart));
      if (!m) { atBox.style.display = 'none'; return; }
      const q = m[1];
      const ids = [...new Set([...v.cast, ...W.characters.map((c) => c.id)])].filter((id) => C[id] && C[id].name.startsWith(q)).slice(0, 8);
      atBox.innerHTML = ids.map((id) => `<button type="button" data-at="${id}">${av({ char: id })}${esc(C[id].name)}</button>`).join('');
      atBox.style.display = ids.length ? '' : 'none';
    };
    atBox.onclick = (e) => {
      const b = e.target.closest('[data-at]');
      if (!b) return;
      const pos = ta.selectionStart, before = ta.value.slice(0, pos).replace(/@([^\s@]{0,14})$/, '@' + C[b.dataset.at].name + ' ');
      ta.value = before + ta.value.slice(pos);
      atBox.style.display = 'none';
      ta.focus(); ta.oninput();
    };
    $('form', compose).onsubmit = async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      if (!(await needFan('comment'))) return;
      const mention = mentionOf(text, v), was = replying;
      const p = { id: `tmp-${Date.now()}`, pending: true, uid: st.user.uid, nick: st.fan.nick, photo: st.fan.photo || null, text, parentId: was?.root || null };
      pending.push(p);
      if (was) open.add(was.root);
      ta.value = ''; ta.oninput(); unreply();
      draw();
      try {
        const r = await call('comment', { videoId: v.id, text, parentId: was?.root || null, replyTo: was?.to || null, mention });
        track('comment', v.id);
        p.realId = r.id;
        if (r.mention) typing.set(was?.root || r.id, { char: r.mention, since: Date.now() - 2000 });
        setTimeout(() => { for (const [k, w] of typing) if (Date.now() - w.since > 60e3) typing.delete(k); draw(); }, 61e3);
        setTimeout(() => { pending = pending.filter((x) => x !== p); draw(); }, 8000); // the snapshot has it by then
        draw();
      } catch (x) {
        pending = pending.filter((y) => y !== p);
        if (!ta.value) { ta.value = text; ta.oninput(); }
        draw();
        toast(x.code === 'text_bad' ? T.cmBad : x.code === 'slow_down' ? T.cmSlow : T.errGeneric);
      }
    };
  }
  function unreply() { replying = null; const r = $('.cm-replying', compose); if (r) r.style.display = 'none'; }
  drawCompose();
  draw();
  h.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tab) { cur = b.dataset.tab; draw(); }
    else if (b.dataset.more) { open.add(b.dataset.more); draw(); }
    else if (b.matches('[data-in]')) { if (await needFan('comment')) drawCompose(); }
    else if (b.matches('[data-unreply]')) unreply();
    else if (b.dataset.reply) {
      if (!(await needFan('comment'))) return;
      const c = comments.find((x) => x.id === b.dataset.reply);
      replying = { root: b.dataset.root, to: c.id, nick: c.nick };
      drawCompose();
      const bar = $('.cm-replying', compose);
      bar.style.display = '';
      $('span', bar).textContent = T.cmReplying(c.nick);
      const ta = $('textarea', compose);
      if (c.char && !ta.value.includes('@' + C[c.char].name)) ta.value = '@' + C[c.char].name + ' ' + ta.value;
      ta.focus(); ta.oninput();
    } else if (b.dataset.like) {
      if (!(await needFan('like'))) return;
      const id = b.dataset.like, on = !myLikes.has(id), c = comments.find((x) => x.id === id);
      if (on) myLikes.add(id); else myLikes.delete(id);
      if (c) c.likeCount = (c.likeCount || 0) + (on ? 1 : -1);
      draw();
      if (on) track('like', v.id);
      call('like', { commentId: id, on }).catch(() => toast(T.errGeneric));
    } else if (b.dataset.del) {
      call('deleteComment', { id: b.dataset.del }).catch(() => toast(T.errGeneric));
    } else if (b.dataset.stamp) {
      stampIt(b, stickers, myStamps, draw);
    } else if (b.matches('[data-make]')) { h.close('sticker'); openSticker(); }
  });
}

// ---------- stickers: the fans' strip / tab, and stamps (the character's catchphrase as the like) ----------
function stickerCard(s, myStamps) {
  const n = s.stampCount || 0;
  return `<div class="stc"><img src="${esc(s.img)}" alt="${esc(s.text)}" data-wa-img="${esc(s.img)}" data-wa-v="${esc(s.videoId)}">
    <button class="stamp ${myStamps.has(s.id) ? 'on' : ''}" data-stamp="${s.id}" title="${esc(stampText(s.char))}">${LIKE}<b>${n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : n || ''}</b></button></div>`;
}
function stickerTab(stickers, myStamps) {
  return `<button class="vx-btn main block" data-make style="margin:6px 0 14px">${I.sticker}${esc(T.sticker)}</button>
    ${stickers.length ? `<div class="stg">${stickers.map((s) => stickerCard(s, myStamps)).join('')}</div>` : `<div class="cm-empty">${esc(T.stFansEmpty)}</div>`}`;
}
async function stampIt(b, stickers, myStamps, redraw) {
  if (!(await needFan('stamp'))) return;
  const id = b.dataset.stamp, on = !myStamps.has(id), s = stickers.find((x) => x.id === id);
  if (on) myStamps.add(id); else myStamps.delete(id);
  if (s) s.stampCount = (s.stampCount || 0) + (on ? 1 : -1);
  redraw();
  if (on) {
    track('stamp', s?.videoId);
    // the character's catchphrase lands on the sticker like a rubber stamp
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-stamp="${id}"]`)?.closest('.stc');
      if (!card) return;
      const mark = Object.assign(document.createElement('span'), { className: 'stamp-mark', textContent: stampText(s?.char) });
      card.append(mark);
      setTimeout(() => mark.remove(), 1400);
    });
  }
  call('stamp', { stickerId: id, on }).catch(() => toast(T.errGeneric));
}

// ---------- sticker from the moment (mockup 3) ----------
function grabFrame(video) {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return null;
  const k = Math.min(1, 1024 / Math.max(w, h));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(w * k), height: Math.round(h * k) });
  c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
  try { return c.toDataURL('image/jpeg', 0.88); } catch (e) { console.error('frame', e); return null; }
}
export async function openSticker() {
  if (!P) return;
  const { v, video, lead } = P;
  video.pause();
  setUi(true);
  const frame = grabFrame(video);   // first, so the sign-in sheet can show this very moment as the sticker
  if (!frame) { toast(T.errGeneric); return; }
  if (!(await needFan('sticker', lead, { img: frame }))) return;
  const at = video.currentTime;
  const el = document.createElement('div');
  el.className = 'st';
  el.innerHTML = `<div class="st-bg" style="background-image:url('${frame}')"></div>
    <div class="st-head"><span class="ttl">${esc(T.stTitle)}</span>${wordmark(T.tagline)}<button class="st-back" data-x aria-label="חזרה">${I.next}</button></div>
    <div class="st-main">
      <div class="st-art"><img class="frame" src="${frame}" alt=""></div>
      <input class="vx-field" maxlength="40" placeholder="${esc(T.stPlaceholder)}" value="${esc(catchphrase(lead))}">
      <div class="st-row" data-row><button class="vx-btn main" data-make>${I.sticker}${esc(T.stMake)}</button></div>
      <p class="st-q" data-q></p>
    </div>
    <div class="st-fans"><div class="st-fans-h"><h3>${esc(T.stFans)}</h3><button data-all>${esc(T.stAll)}${I.next}</button></div><div class="strip" data-fans></div></div>`;
  document.body.append(el);
  const art = $('.st-art', el), row = $('[data-row]', el), input = $('input', el), q = $('[data-q]', el);
  let made = null, myStamps = new Set(), fans = [];
  const off = [];
  const shut = () => { off.forEach((u) => u()); el.remove(); };
  $('[data-x]', el).onclick = shut;
  call('stickerQuota').then((r) => { q.textContent = T.stLeft(r.left, r.perDay); }).catch(() => {});
  off.push(F.onSnapshot(F.query(F.collection(db, 'stickers'), F.where('videoId', '==', v.id), F.where('status', '==', 'live'), F.where('hidden', '==', false), F.orderBy('stampCount', 'desc'), F.limit(20)), (s) => {
    fans = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    drawFans();
  }, () => {}));
  if (st.user) off.push(F.onSnapshot(F.query(F.collection(db, 'fans', st.user.uid, 'stamps'), F.where('videoId', '==', v.id)), (s) => { myStamps = new Set(s.docs.map((d) => d.id)); drawFans(); }, () => {}));
  function drawFans() { $('[data-fans]', el).innerHTML = fans.length ? fans.map((s) => stickerCard(s, myStamps)).join('') : `<p class="vx-muted" style="grid-column:1/-1">${esc(T.stFansEmpty)}</p>`; }
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-stamp]'); if (b) stampIt(b, fans, myStamps, drawFans); });

  const make = async () => {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    row.innerHTML = '';
    art.classList.add('working');
    art.querySelector('.made')?.remove();
    if (!art.querySelector('.frame')) art.insertAdjacentHTML('afterbegin', `<img class="frame" src="${frame}" alt="">`);
    let i = 0;
    art.insertAdjacentHTML('beforeend', `<div class="busy"><div><span class="vx-spin"></span><span data-w>${esc(T.stWorking[0])}</span></div></div>`);
    const tick = setInterval(() => { const w = art.querySelector('[data-w]'); if (w) w.textContent = T.stWorking[Math.min(++i, T.stWorking.length - 1)]; }, 5000);
    try {
      made = await call('sticker', { videoId: v.id, char: lead, at, text, frame });
      track('sticker_create', v.id);
      art.innerHTML = `<img class="made" src="${esc(made.img)}" alt="${esc(text)}">`;
      q.textContent = T.stLeft(made.left, 3);
      row.innerHTML = `<button class="vx-btn main" data-post>${esc(T.stPost)}</button><button class="vx-btn glass" data-wa>${I.whatsapp}${esc(T.stWhatsapp)}</button>`;
      row.insertAdjacentHTML('afterend', `<div class="st-row" data-row2 style="justify-content:center;gap:18px"><button class="vx-link" data-again style="margin:0">${esc(T.stAgain)}</button></div>`);
    } catch (x) {
      art.querySelector('.busy')?.remove();
      row.innerHTML = `<button class="vx-btn main" data-make>${I.sticker}${esc(T.stMake)}</button>`;
      toast(x.code === 'quota' ? T.stQuota : x.code === 'image_refused' || x.code === 'text_bad' ? T.stRefused : T.stFailed, 4000);
    } finally { clearInterval(tick); art.classList.remove('working'); }
  };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-make]')) make();
    else if (b.matches('[data-all]')) { shut(); openComments({ tab: 's' }); }
    else if (b.matches('[data-again]')) { el.querySelector('[data-row2]')?.remove(); made = null; input.focus(); input.select(); row.innerHTML = `<button class="vx-btn main" data-make>${I.sticker}${esc(T.stMake)}</button>`; }
    else if (b.matches('[data-post]') && made) {
      b.disabled = true;
      try { await call('publishSticker', { id: made.id }); toast(T.stPosted); b.textContent = T.stPosted; }
      catch (x) { b.disabled = false; toast(T.errGeneric); }
    } else if (b.matches('[data-wa]') && made) { call('publishSticker', { id: made.id }).catch(() => {}); waCard(made.img, v.id); }
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') make(); });
}
// ---------- the sticker as a real WhatsApp sticker (the viral part) ----------
// WhatsApp's sticker: 512x512, see-through, a 16 px margin, a WebP under 100 KB. No logo (his call 2026-11-03, after the
// /sticker-lab/ test: WhatsApp's own cut-out dropped it and left white around it). Copy first - pasted into a WhatsApp
// chat it goes as a sticker, the easiest way (his words); save to Photos (iPhone) / the phone (Android) keeps it in
// WhatsApp's stickers for good; Android can also share the WebP, which arrives AS a sticker.
const toBlob = (c, type, q) => new Promise((ok) => c.toBlob(ok, type, q));
const S = 512, M = 16;
async function stickerFiles(src) {
  const art = await createImageBitmap(await (await fetch(src)).blob());
  const k = Math.min((S - 2 * M) / art.width, (S - 2 * M) / art.height), w = art.width * k, h = art.height * k;
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S }), g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(art, (S - w) / 2, (S - h) / 2, w, h);
  const png = await toBlob(c, 'image/png');
  let webp = null;
  for (const q of [0.9, 0.8, 0.7, 0.6, 0.5]) { const b = await toBlob(c, 'image/webp', q); if (!b || b.type !== 'image/webp') break; webp = b; if (b.size <= 100e3) break; }
  return { c, png: new File([png], 'shlomiverse-sticker.png', { type: 'image/png' }), webp: webp && new File([webp], 'shlomiverse-sticker.webp', { type: 'image/webp' }) };
}
export async function waCard(src, videoId) {
  const os = isIOS() ? 'ios' : isAndroid() ? 'android' : 'desktop';
  const steps = { ios: T.waStepsIOS, android: T.waStepsAndroid, desktop: T.waStepsDesktop }[os];
  const copy = `<button class="vx-btn main block" data-copy-st>${I.copy}${esc(T.waCopy)}</button>`;
  const btns = copy + { ios: `<button class="vx-btn glass block" data-save>${I.download}${esc(T.waSavePhotos)}</button>`,
    android: `<button class="vx-btn glass block" data-send>${I.whatsapp}${esc(T.waSend)}</button><button class="vx-btn glass block" data-save>${I.download}${esc(T.waSave)}</button>`,
    desktop: `<button class="vx-btn glass block" data-save>${I.download}${esc(T.waDownload)}</button>` }[os];
  const h = sheet(`<div class="wa"><h2 class="vx-h">${esc(T.waTitle)}</h2>
      <div class="wa-art"><span class="vx-spin"></span></div>
      <ol class="wa-steps">${steps.map((x, i) => `<li><b>${i + 1}</b><span>${esc(x)}</span></li>`).join('')}</ol>
      <div class="wa-btns">${btns}</div></div>`, { cls: 'wa-sheet' });
  const ready = stickerFiles(src);   // started now, so a tap on Copy finds it (almost) done
  let F;
  try { F = await ready; } catch (e) { console.error('sticker file', e); toast(T.errGeneric); h.close(); return; }
  const box = h.el.querySelector('.wa-art');
  box.innerHTML = '';
  box.appendChild(F.c);
  const share = async (file) => {
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return true; } }
    catch (e) { if (e.name === 'AbortError') return true; }
    return false;
  };
  const download = (file) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name }); a.click(); };
  h.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-copy-st]')) {
      // written inside the tap (iPhone Safari allows the clipboard only there) - the PNG goes as a see-through sticker
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': Promise.resolve(F.png) })]); toast(T.waCopied); track('st_copy', videoId); }
      catch (err) { console.warn('sticker copy', err); toast(T.waCopyFail); }
    }
    // the file alone, no text with it: a caption would make WhatsApp send a picture, not a sticker
    else if (b.matches('[data-send]')) { if (!(await share(F.webp || F.png))) download(F.webp || F.png); track('share', videoId); }
    else if (b.matches('[data-save]')) { if (os === 'desktop' || !(await share(F.png))) download(os === 'android' && F.webp ? F.webp : F.png); track('share', videoId); }
  });
}
document.addEventListener('click', (e) => { const i = e.target.closest('[data-wa-img]'); if (i) waCard(i.dataset.waImg, i.dataset.waV); });
