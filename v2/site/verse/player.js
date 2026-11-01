// The video page (#/v/<id>): always vertical, edge to edge. Watching is naked - only a hair-thin progress line and a
// faded wordmark. One tap pauses and floats in the glass controls (mockup 2): the character + follow, the orange
// "sticker from the moment" first, comments, save, share, and the episode card with its scrubber. Comments (a sheet:
// likes, replies, @character answers) and the sticker screen (mockup 3) live here too.
import { db, F, call } from './fb.js';
import { T } from './copy.js';
import { I, $, esc, av, ago, mmss, sheet, toast, track, abs, charColor, stampText, catchphrase, wordmark, isIOS, isAndroid, LIKE, LINK_RE, linkTag, ofc } from './ui.js';
import { st, onState, needFan, follow, save } from './state.js';
import { offerPush } from './push.js';

let P = null;   // the open player
let backTo = '#/';
export const setBack = (h) => { backTo = h || '#/'; };

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
export function openPlayer(id, q = {}) {
  const v = V[id];
  if (!v) { toast(T.errGeneric); location.hash = '#/'; return; }
  if (v.url) { window.open(v.url, '_blank', 'noopener'); location.replace(backTo); return; }
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
        ${lead ? `<a class="vp-who" href="#/c/${lead}">${av({ char: lead, ring: true })}<b>${esc(C[lead].name)}</b></a>${followBtn(lead, 'pill')}` : ''}
        <a class="vp-brand" href="#/" data-close aria-label="חזרה לשלומיוורס"><img src="/verse/logo-160.png" alt="שלומיוורס"></a>
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
  document.body.style.overflow = 'hidden';
  const video = $('video', el);
  P = { el, v, video, lead, off: [], hideT: 0 };

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
  video.addEventListener('ended', () => { remember(id, video.duration, video.duration); setUi(true); });
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
    else if (b.matches('[data-ep]') && b.dataset.ep) location.replace('#/v/' + b.dataset.ep);
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
    if (to) location.replace('#/v/' + to.id);
  });
  P.key = (e) => {
    if (document.querySelector('.vx-sheet, .st, input:focus, textarea:focus')) return;
    if (e.key === ' ') { e.preventDefault(); if (video.paused) video.play(); else { video.pause(); setUi(true); } }
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowDown' && eps[n + 1]) location.replace('#/v/' + eps[n + 1].id);
    if (e.key === 'ArrowUp' && eps[n - 1]) location.replace('#/v/' + eps[n - 1].id);
  };
  document.addEventListener('keydown', P.key);
  deepLinks(q);
}
function deepLinks(q) {
  if (q.c) setTimeout(() => openComments({ focus: q.c }), 300);
  else if (q.sticker) setTimeout(() => openComments({ tab: 's', focus: q.sticker }), 300);
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
  if (ms) P.hideT = setTimeout(() => P && !P.video.paused && P.el.classList.remove('ui'), ms);
}
function paint() {
  const { el, v } = P;
  const saved = st.saves.has(v.id);
  $('[data-save] .vx-round', el).innerHTML = saved ? I.saved : I.save;
  $('[data-save] .vx-round', el).classList.toggle('on', saved);
  $('[data-save-l]', el).textContent = saved ? T.saved : T.save;
  paintFollow(el);
}
function share(v) {
  const url = `${location.origin}/wiki/#/v/${v.id}`;
  track('share', v.id);
  if (navigator.share) navigator.share({ title: v.title, text: T.shareText(v.title), url }).catch(() => {});
  else { navigator.clipboard?.writeText(url); toast(T.linkCopied); }
}
function close() { location.hash = backTo; }
function destroy() {
  if (!P) return;
  if (P.cm) P.cm.close('away');
  P.off.forEach((u) => u && u());
  document.removeEventListener('keydown', P.key);
  P.video.pause();
  P.video.removeAttribute('src');
  P.video.load();
  P.el.remove();
  P = null;
  document.body.style.overflow = '';
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
    const tag = c ? `<a class="at" href="#/c/${c.id}" style="--c:${charColor(c.id)}">${at}</a>` : `<span class="at fan">${at}</span>`;
    h = h.split(at).join(`\u0000${marks.push(tag) - 1}\u0000`);
  }
  return h.replace(/\u0000(\d+)\u0000/g, (_, i) => marks[i]);
}

export function openComments({ tab = 'c', focus = null } = {}) {
  if (!P || document.querySelector('.cm')) return;
  const { v } = P;
  P.video.pause();
  setUi(true);
  let comments = [], stickers = [], myLikes = new Set(), myStamps = new Set(), cur = tab, replying = null;
  // what this fan just sent shows at once (faded, "sending") while the server checks it; the real one replaces it
  let pending = [], nicks = [];
  const all = () => [...comments, ...pending.filter((p) => !p.realId || !comments.some((c) => c.id === p.realId))];
  const open = new Set(), typing = new Map(), off = [];
  const h = P.cm = sheet(`<div class="tabs"><button class="vx-pill" data-tab="c"></button><button class="vx-pill" data-tab="s"></button>
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
  off.push(F.onSnapshot(F.query(F.collection(db, 'stickers'), F.where('videoId', '==', v.id), F.where('status', '==', 'live'), F.where('hidden', '==', false), F.orderBy('stampCount', 'desc'), F.limit(60)), (s) => {
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
      ${c.char ? `<a class="cm-face" href="#/c/${c.char}" aria-label="${esc(c.nick)}">${av({ char: c.char, ring: true })}</a>` : av({ fan: c })}
      <div class="body"><div class="cm-who">${c.char ? `<a href="#/c/${c.char}"><b>${esc(c.nick)}</b></a>` : `<b>${esc(c.nick)}</b>${ofc(c)}`}<small>${c.pending ? esc(T.cmSending) : c.t ? ago(c.t) : T.now}</small></div>
        <div class="txt">${richText(c.text, nicks)}</div>
        ${c.pending ? '' : `<div class="acts"><button data-like="${c.id}" class="like ${myLikes.has(c.id) ? 'on' : ''}" aria-label="${esc(T.cmLike)}">${LIKE}<span>${c.likeCount || esc(T.cmLike)}</span></button>
          <button data-reply="${c.id}" data-root="${c.parentId || c.id}">${esc(T.cmReply)}</button>
          ${isMine ? `<button data-del="${c.id}">${esc(T.cmDelete)}</button>` : ''}</div>`}</div></div>`;
  };
  function draw() {
    const comments = all();
    nicks = [...new Set(comments.filter((x) => !x.char).map((x) => x.nick))];
    $('[data-tab="c"]', h.el).textContent = T.tabsComments(comments.length || P?.stats?.comments || 0);
    $('[data-tab="s"]', h.el).textContent = T.tabsStickers(stickers.length);
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
      if (!(await needFan(T.why.comment))) return;
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
    else if (b.matches('[data-in]')) { if (await needFan(T.why.comment)) drawCompose(); }
    else if (b.matches('[data-unreply]')) unreply();
    else if (b.dataset.reply) {
      if (!(await needFan(T.why.comment))) return;
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
      if (!(await needFan(T.why.like))) return;
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
  if (!(await needFan(T.why.stamp))) return;
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
  if (!(await needFan(T.why.sticker, lead))) return;
  const frame = grabFrame(video);
  if (!frame) { toast(T.errGeneric); return; }
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
// WhatsApp's sticker: 512x512, see-through, a 16 px margin, a WebP under 100 KB. The small planet logo rides along in the
// corner, so whoever gets it can find where it came from. Android: shared as the WebP file it arrives AS a sticker.
// iPhone: saved to Photos, then WhatsApp's own "create sticker" picks it up. Desktop: download, WhatsApp Web the same.
const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = no; i.src = src; });
const toBlob = (c, type, q) => new Promise((ok) => c.toBlob(ok, type, q));
// the logo never sits on the character or the words: it goes to the emptiest (most see-through) corner of the art, and if
// no corner is empty enough the art shrinks a little to make room. They can still drag it anywhere on the preview.
const S = 512, M = 16, LW = 84;
async function prepare(src) {
  const [art, logo] = await Promise.all([createImageBitmap(await (await fetch(src)).blob()), loadImg('/verse/logo-160.png').catch(() => null)]);
  const LH = logo ? (logo.height / logo.width) * LW : 0;
  const lay = (scale) => {
    const k = Math.min((S - 2 * M) / art.width, (S - 2 * M) / art.height) * scale, w = art.width * k, h = art.height * k;
    return { x: (S - w) / 2, y: (S - h) / 2, w, h };
  };
  const drawArt = (g, L) => { g.clearRect(0, 0, S, S); g.imageSmoothingQuality = 'high'; g.drawImage(art, L.x, L.y, L.w, L.h); };
  let L = lay(1), pos = null;
  if (logo) {
    const c = Object.assign(document.createElement('canvas'), { width: S, height: S }), g = c.getContext('2d', { willReadFrequently: true });
    const spots = [[M - 6, M - 4], [S - M - LW + 6, M - 4], [M - 6, S - M - LH + 4], [S - M - LW + 6, S - M - LH + 4]];
    for (const scale of [1, 0.9, 0.82]) {
      L = lay(scale); drawArt(g, L);
      const cost = spots.map(([x, y]) => { const d = g.getImageData(Math.round(x), Math.round(y), LW, Math.round(LH)).data; let n = 0; for (let i = 3; i < d.length; i += 4) n += d[i] > 40; return n / (d.length / 4); });
      const best = cost.indexOf(Math.min(...cost));
      pos = { x: spots[best][0], y: spots[best][1] };
      if (cost[best] < 0.04) break;   // under 4% of the logo's box touches the art
    }
  }
  return { art, logo, L, pos, LH, drawArt };
}
async function compose(P, pos) {
  const c = Object.assign(document.createElement('canvas'), { width: S, height: S }), g = c.getContext('2d');
  P.drawArt(g, P.L);
  if (P.logo && pos) g.drawImage(P.logo, pos.x, pos.y, LW, P.LH);
  const png = await toBlob(c, 'image/png');
  let webp = null;
  for (const q of [0.9, 0.8, 0.7, 0.6, 0.5]) { const b = await toBlob(c, 'image/webp', q); if (!b || b.type !== 'image/webp') break; webp = b; if (b.size <= 100e3) break; }
  return { png: new File([png], 'shlomiverse-sticker.png', { type: 'image/png' }), webp: webp && new File([webp], 'shlomiverse-sticker.webp', { type: 'image/webp' }) };
}
export async function waCard(src, videoId) {
  const os = isIOS() ? 'ios' : isAndroid() ? 'android' : 'desktop';
  const steps = { ios: T.waStepsIOS, android: T.waStepsAndroid, desktop: T.waStepsDesktop }[os];
  const btns = { ios: `<button class="vx-btn main block" data-save>${I.download}${esc(T.waSavePhotos)}</button>`,
    android: `<button class="vx-btn main block" data-send>${I.whatsapp}${esc(T.waSend)}</button><button class="vx-btn glass block" data-save>${I.download}${esc(T.waSave)}</button>`,
    desktop: `<button class="vx-btn main block" data-save>${I.download}${esc(T.waDownload)}</button>` }[os];
  const h = sheet(`<div class="wa"><h2 class="vx-h">${esc(T.waTitle)}</h2>
      <div class="wa-art"><span class="vx-spin"></span></div><p class="wa-hint">${esc(T.waMoveLogo)}</p>
      <ol class="wa-steps">${steps.map((x, i) => `<li><b>${i + 1}</b><span>${esc(x)}</span></li>`).join('')}</ol>
      <div class="wa-btns">${btns}</div></div>`, { cls: 'wa-sheet' });
  let P;
  try { P = await prepare(src); } catch (e) { console.error('sticker file', e); toast(T.errGeneric); h.close(); return; }
  // the preview: the art on a canvas, the logo a layer on top that follows the finger (positions kept in the 512 px space)
  const box = h.el.querySelector('.wa-art');
  box.innerHTML = '<canvas width="512" height="512"></canvas>' + (P.logo ? '<img class="wa-logo" src="/verse/logo-160.png" alt="" draggable="false">' : '');
  P.drawArt(box.querySelector('canvas').getContext('2d'), P.L);
  let pos = P.pos;
  const logoEl = box.querySelector('.wa-logo');
  if (logoEl) {
    const place = () => Object.assign(logoEl.style, { left: `${(pos.x / S) * 100}%`, top: `${(pos.y / S) * 100}%`, width: `${(LW / S) * 100}%` });
    place();
    let drag = null;
    logoEl.addEventListener('pointerdown', (e) => { e.preventDefault(); logoEl.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, p: { ...pos }, k: S / box.clientWidth }; logoEl.classList.add('drag'); });
    logoEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      pos = { x: Math.min(S - LW, Math.max(0, drag.p.x + (e.clientX - drag.x) * drag.k)), y: Math.min(S - P.LH, Math.max(0, drag.p.y + (e.clientY - drag.y) * drag.k)) };
      place();
    });
    const up = () => { drag = null; logoEl.classList.remove('drag'); };
    logoEl.addEventListener('pointerup', up);
    logoEl.addEventListener('pointercancel', up);
  } else h.el.querySelector('.wa-hint').remove();
  const share = async (file) => {
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return true; } }
    catch (e) { if (e.name === 'AbortError') return true; }
    return false;
  };
  const download = (file) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name }); a.click(); };
  h.el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const files = await compose(P, pos);   // made from where the logo is now
    // the file alone, no text with it: a caption would make WhatsApp send a picture, not a sticker
    if (b.matches('[data-send]')) { if (!(await share(files.webp || files.png))) download(files.webp || files.png); track('share', videoId); }
    else if (b.matches('[data-save]')) { if (os === 'desktop' || !(await share(files.png))) download(os === 'android' && files.webp ? files.webp : files.png); track('share', videoId); }
  });
}
document.addEventListener('click', (e) => { const i = e.target.closest('[data-wa-img]'); if (i) waCard(i.dataset.waImg, i.dataset.waV); });
