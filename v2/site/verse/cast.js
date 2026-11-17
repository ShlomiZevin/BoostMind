// APP SHELL round 2 (his notes 4, 5, 7 - mockups app-shell/r2/2-character-card, 3-leave-heads-up): from a video to a person
// and to the chat without losing the video.
// - castSheet: a face in the video's cast opens a card over the video (the video pauses and dims behind it): face, name, the
//   line, how many videos / games (real numbers; a 0 is left out), "לדבר עם X", "לדף של X", and x to keep watching. It is a
//   sheet, so the back button closes it.
// - talkFromVideo: "לדבר" from a video - the first two times in this browser a short heads-up says the video will wait; then
//   the chat (/chat?with=<id>, its own history entry), with "חזרה לסרטון" (HOOK.videoReturn) back to the same second.
import { T } from './copy.js';
import { esc, av, sheet, track } from './ui.js';
import { remember } from './player.js';

const A = () => T.shell;
const svg = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_TALK = svg('<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.3A8.5 8.5 0 1 1 20.5 12z"/>');
const ICON_PAGE = svg('<path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>');
const ICON_FILM = svg('<rect x="3.5" y="8" width="17" height="12" rx="2"/><path d="M3.5 8 19 3.8l.9 3M8 6.8l2 2.6M12.6 5.6l2 2.6"/><path d="m10.5 11.6 4 2.4-4 2.4z" fill="currentColor"/>', 1.8);
const ICON_PAD = svg('<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="17.5" cy="13.8" r=".9" fill="currentColor"/>', 1.8);
const ICON_X = svg('<path d="M6 6l12 12M18 6 6 18"/>', 2.2);

// a name that fits a button: the name, or its shortest Hebrew aka (רוזנבלום, דמוקרטוביץ) - measured after drawing, and when even
// that doesn't fit the button says it without the name ("לדבר איתה", "לדף הדמות")
const heb = (n) => n && /^[֐-׿][֐-׿\s'"״׳-]*$/.test(n);
function shortName(c) {
  if (c.name.length <= 9) return c.name;
  const a = (c.aka || []).filter((n) => heb(n) && n.length <= 11).sort((x, y) => x.length - y.length)[0];
  return a || c.name;
}
const gender = (id) => (typeof GENDER !== 'undefined' && GENDER[id]) || 'm';
function fitButtons(el, id) {
  requestAnimationFrame(() => {
    const t = el.querySelector('[data-cs-talk] span'), p = el.querySelector('[data-cs-page] span');
    if (t && t.scrollWidth > t.clientWidth + 1) t.textContent = T.feed.talk1[gender(id)] || T.feed.talk1.m;
    if (p && p.scrollWidth > p.clientWidth + 1) p.textContent = A().pageGeneric;
  });
}
const resumeLater = (vd) => { if (vd && !vd.ended && document.body.contains(vd)) vd.play().catch(() => {}); };

export function castSheet(id, vctx) {
  const c = C[id];
  if (!c) return;
  const vd = vctx && vctx.video, was = !!(vd && !vd.paused);
  vd?.pause();
  const nv = (c.videos || []).length, ng = (W.games || []).filter((g) => (g.chars || []).includes(id)).length;
  const facts = `${nv ? `<span class="cs-fact">${ICON_FILM}${esc(A().nVideos(nv))}</span>` : ''}${ng ? `<span class="cs-fact">${ICON_PAD}${esc(A().nGames(ng))}</span>` : ''}`;
  const h = sheet(`<div class="cs-card">
      <button class="cs-x" data-vx-close aria-label="${esc(A().close)}">${ICON_X}</button>
      <div class="cs-top">${av({ char: id, ring: true, cls: 'cs-face' })}
        <div class="cs-t"><h2>${esc(c.name)}</h2>${c.tagline || c.role ? `<p>${esc(c.tagline || c.role)}</p>` : ''}${facts ? `<div class="cs-facts">${facts}</div>` : ''}</div></div>
      <div class="cs-acts"><button class="vx-btn main" data-cs-talk>${ICON_TALK}<span>${esc(A().talkTo(shortName(c)))}</span></button>
        <a class="vx-btn ghost" href="/c/${esc(id)}" data-cs-page>${ICON_PAGE}<span>${esc(A().pageOf(shortName(c)))}</span></a></div>
    </div>`, { cls: 'cs-sheet', onClose: (why) => { if (was && why !== 'talk' && why !== 'page') resumeLater(vd); } });
  fitButtons(h.el, id);
  h.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-cs-talk]')) { h.close('talk'); talkFromVideo(id, vctx); }
    else if (e.target.closest('[data-cs-page]')) { e.preventDefault(); e.stopPropagation(); h.close('page'); leaveVideo('page', id, vctx); }   // the heads-up first
  });
  track('feed', 'cast:' + id);
}

export const talkFromVideo = (id, vctx) => leaveVideo('chat', id, vctx);
// leaving the video for the chat or the character's page: a short heads-up EVERY time (his note: when it stopped showing he
// thought it was broken) - "עוברים לצ'אט / לדף של X", the video waits; the way there is an entry of its own over the video,
// so back (or "חזרה לסרטון" in the chat) lands on the same video at the same second
export function leaveVideo(kind, id, vctx) {
  const c = C[id];
  if (!c) return;
  const v = vctx && vctx.v, vd = vctx && vctx.video;
  if (vd) { vd.pause(); if (v && vd.duration) remember(v.id, vd.currentTime, vd.duration); }   // the second it stopped at
  if (v) HOOK.videoReturn = { v: v.id, t: vd ? vd.currentTime : 0, poster: v.poster || '', title: v.title || '', url: vctx.from === 'feed' ? '/videos?at=' + encodeURIComponent(v.id) : '/v/' + v.id, label: A().backToVideo, fresh: true };
  track('feed', (kind === 'page' ? 'page:' : 'talk:') + id);
  const page = kind === 'page';
  const h = sheet(`<div class="lv-card">
      <div class="lv-top">${av({ char: id, ring: true, cls: 'lv-face' })}<div class="lv-t"><h2>${esc(page ? A().leaveTitlePage(c.name) : A().leaveTitle(c.name))}</h2><p>${esc(A().leaveLine)}</p></div></div>
      <div class="lv-acts"><button class="vx-btn main" data-lv-go>${esc(page ? A().leaveGoPage : A().leaveGo)}</button><button class="vx-btn ghost" data-lv-stay>${esc(A().leaveStay)}</button></div>
    </div>`, { cls: 'lv-sheet', onClose: (why) => { if (why !== 'go') { HOOK.videoReturn = null; resumeLater(vd); } } });
  h.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-lv-go]')) {
      h.close('go');
      if (!page) { openChat(id); return; }
      if (HOOK.videoReturn) HOOK.videoReturn.fresh = false;
      nav('/c/' + id, false, { fromVideo: 1 });
    } else if (e.target.closest('[data-lv-stay]')) h.close('stay');
  });
}
