// Characters' stories between videos - written in /backstage/ or by a Claude session (the verse-story skill). Rings on the home page and around a
// character's portrait; #/story/<character> plays them full screen (tap left = next, right = back, like any RTL app).
import { db, F } from './fb.js';
import { T } from './copy.js';
import { I, esc, av, ago, abs, charColor, track } from './ui.js';
import { st } from './state.js';
import { paintFollow } from './player.js';
import { stageHtml, readMs } from './story-art.js';

const RECENT = 3 * 864e5;   // a story stays in the rings for three days
// a story can also come from the Shlomiverse itself (char 'verse', his official account): its logo and name
const VERSE = { name: 'שלומיוורס', img: '/verse/icon-192.png' };
const who = (c) => (c === 'verse' ? VERSE : C[c]);
const whoFace = (c) => (c === 'verse' ? `<span class="vx-av ring"><img src="${VERSE.img}" alt=""></span>` : av({ char: c, ring: true }));
let all = [], loaded = false, waiting = null;
const subs = new Set();
export const onStories = (fn) => subs.add(fn);
F.onSnapshot(F.query(F.collection(db, 'stories'), F.where('hidden', '==', false), F.orderBy('t', 'desc'), F.limit(150)), (s) => {
  all = s.docs.map((d) => ({ id: d.id, ...d.data(), ms: d.data().t?.toMillis?.() || Date.now() }));
  loaded = true;
  // a story link opened cold (a push, a shared link) waited for the stories to arrive
  if (waiting && location.pathname === '/story/' + waiting) { const c = waiting; waiting = null; openStory(c); }
  subs.forEach((fn) => fn());
}, (e) => console.error('stories', e));

const SEEN = 'vx-seen-stories';
const seen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN)) || []); } catch (e) { return new Set(); } };
const markSeen = (id) => { const s = seen(); s.add(id); try { localStorage.setItem(SEEN, JSON.stringify([...s].slice(-400))); } catch (e) {} };

const recentOf = (char) => all.filter((x) => x.char === char && Date.now() - x.ms < RECENT && who(x.char));
// characters with something new: unseen first, the ones you follow first
export function ringsHtml() {
  const chars = [...new Set(all.filter((x) => Date.now() - x.ms < RECENT && who(x.char)).map((x) => x.char))];
  if (!chars.length) return '';
  const s = seen();
  const unseen = (c) => recentOf(c).some((x) => !s.has(x.id));
  chars.sort((a, b) => (unseen(b) - unseen(a)) || ((b === 'verse') - (a === 'verse')) || (st.follows.has(b) - st.follows.has(a)));
  return `<div class="rings">${chars.map((c) => `<a class="ring ${unseen(c) ? '' : 'seen'}" href="/story/${c}"><span class="rim"><span>${who(c).img ? `<img src="${abs(who(c).img)}" alt="">` : ''}</span></span><b>${esc(who(c).name)}</b></a>`).join('')}</div>`;
}
// the home's "what you can do" tile: up to three faces with something new (unseen first), and the first to open
export function storyFaces() {
  const s = seen();
  const chars = [...new Set(all.filter((x) => Date.now() - x.ms < RECENT && who(x.char)).map((x) => x.char))];
  const unseen = (c) => recentOf(c).some((x) => !s.has(x.id));
  return chars.sort((a, b) => unseen(b) - unseen(a)).slice(0, 3).map((c) => ({ id: c, img: who(c).img ? abs(who(c).img) : '' }));
}
// the character page: a ring around the portrait when there is something to watch
export const storyRing = (char) => (recentOf(char).length ? ` data-story="${char}" style="outline:3px solid var(--vx-accent);outline-offset:4px;cursor:pointer"` : '');
document.addEventListener('click', (e) => { const p = e.target.closest('[data-story]'); if (p) { e.preventDefault(); nav('/story/' + p.dataset.story); } });

// ---------- the viewer ----------
let SV = null;
let backTo = '/';
export const setStoryBack = (h) => { backTo = h || '/'; };

// "בלי טקסט": the visitor sees the story without its words (his ask, 2026-11-04) - the button keeps it for the
// stories that follow; holding a finger on a story shows only the picture for as long as it is held, like Instagram
const CLEAN = 'vx-story-clean';
// full screen (his ask, 2026-11-05): the original picture or clip on the whole screen and NOTHING on it - no name, no face,
// no words, no button, no bars. The story waits there (a clip keeps playing, round again); a tap anywhere comes back.
// A small shrink icon shows for two seconds so people know the way back.
const textOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const textOn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
// a clip's sound (his ask, 2026-11-05 - the first video story is a teaser with music): on unless the visitor turned it off;
// when the phone won't play sound by itself the clip plays muted and the button waits for a tap, like Instagram
const SOUND = 'vx-story-sound';
const soundOn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const soundOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
export function openStory(char) {
  closeStory();
  if (!loaded) { waiting = char; return; }
  let list = recentOf(char).reverse();
  if (!list.length) list = all.filter((x) => x.char === char).slice(0, 10).reverse();
  if (!list.length || !who(char)) { nav(backTo, true); return; }
  const s = seen();
  let i = Math.max(0, list.findIndex((x) => !s.has(x.id)));
  const el = document.createElement('div');
  el.className = 'sv';
  el.innerHTML = `<div class="sv-box" style="--c:${charColor(char)}">
      <div class="sv-bars">${list.map(() => '<span><i></i></span>').join('')}</div>
      <div class="sv-head"><span class="sv-who"><a href="${char === 'verse' ? '/' : `/c/${char}`}">${whoFace(char)}</a>${char === 'verse' ? '' : `<button class="sv-follow" data-follow="${char}" aria-label="לעקוב"></button>`}</span>
        <span class="sv-name"><b>${esc(who(char).name)}</b><small data-ago></small></span>
        <span class="end"><button class="sv-btn sv-clean" data-clean></button><button class="sv-btn sv-sound" data-sound hidden></button><button class="sv-btn" data-x aria-label="סגירה">${I.x}</button></span></div>
      <div class="sv-shade bot"></div>
      <div data-slot></div>
      <div class="sv-shade"></div>
      <button class="sv-tap next" data-next aria-label="הבא"></button><button class="sv-tap prev" data-prev aria-label="הקודם"></button>
      <button class="sv-exit" data-exit aria-label="יציאה ממסך מלא">${textOn}</button>
    </div>`;
  document.body.append(el);
  document.body.style.overflow = 'hidden';
  SV = { el, timer: 0, raf: 0, start: 0, held: 0, full: 0 };
  const cb = el.querySelector('[data-clean]');
  cb.innerHTML = textOff; cb.setAttribute('aria-label', 'מסך מלא'); cb.title = 'מסך מלא';
  const enterFull = () => { SV.full = performance.now(); el.classList.add('clean'); track('story_clean', char); };
  const exitFull = () => {
    if (!SV.full) return;
    if (!el.querySelector('video.sa-media')) SV.start += performance.now() - SV.full;   // a picture's time waited too
    SV.full = 0; el.classList.remove('clean');
  };
  const paintSound = () => {
    const v = el.querySelector('video.sa-media'), b = el.querySelector('[data-sound]');
    b.hidden = !v;
    if (!v) return;
    b.innerHTML = v.muted ? soundOff : soundOn;
    b.classList.toggle('nudge', v.muted && localStorage.getItem(SOUND) !== '0');   // muted by the phone, not by them: a nudge
    b.setAttribute('aria-label', v.muted ? 'להפעיל סאונד' : 'להשתיק');
    b.title = b.getAttribute('aria-label');
  };
  paintFollow(el);
  const bars = [...el.querySelectorAll('.sv-bars i')];
  const show = () => {
    cancelAnimationFrame(SV.raf);
    const x = list[i];
    markSeen(x.id);
    track('story_view', char);
    track('story_seen', x.id);
    bars.forEach((b, k) => { b.style.width = k < i ? '100%' : '0'; });
    el.querySelector('[data-ago]').textContent = ago(x.ms);
    const slot = el.querySelector('[data-slot]');
    // a story's button (a new game, a video, a site): another site opens in a new tab, ours in this one
    const out = x.link && /^https?:/.test(x.link.url) && !x.link.url.startsWith(location.origin);
    const cta = x.link ? `<a class="sv-cta" href="${esc(x.link.url)}"${out ? ' target="_blank" rel="noopener"' : ''} data-cta>${esc(x.link.label)}${I.next}</a>` : '';
    slot.classList.toggle('with-cta', !!x.link);
    // the whole story always fits the screen; around it, the same picture blurred (story-art.js)
    slot.innerHTML = stageHtml(x, { autoplay: true }) + cta;
    const vid = slot.querySelector('video');
    SV.start = performance.now();
    const len = () => (vid && vid.duration ? vid.duration * 1000 : readMs(x));
    const step = (now) => {
      if (!SV || !bars[i]) return;
      if (SV.held || (SV.full && !vid)) { SV.raf = requestAnimationFrame(step); return; }
      const p = vid ? (vid.currentTime * 1000) / len() : (now - SV.start) / len();
      bars[i].style.width = Math.min(100, p * 100) + '%';
      if (p >= 1 && SV.full && vid) { vid.currentTime = 0; vid.play().catch(() => {}); SV.raf = requestAnimationFrame(step); return; }   // full screen: round again
      if (p >= 1) return go(1);
      SV.raf = requestAnimationFrame(step);
    };
    if (vid) {
      vid.muted = localStorage.getItem(SOUND) === '0';
      vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); paintSound(); });
    }
    paintSound();
    SV.raf = requestAnimationFrame(step);
  };
  const go = (d) => {
    i += d;
    if (i < 0) i = 0;
    if (i >= list.length) {
      cancelAnimationFrame(SV.raf);
      i = list.length - 1;
      // the next character with something unseen, or back where we came from
      const s2 = seen();
      const nextChar = [...new Set(all.filter((x) => Date.now() - x.ms < RECENT && x.char !== char && who(x.char) && !s2.has(x.id)).map((x) => x.char))][0];
      if (nextChar) nav('/story/' + nextChar, true); else nav(backTo);
      return;
    }
    show();
  };
  // holding a finger on the story: only the picture, paused, until it is let go
  let holdT = 0, wasHeld = false;
  const release = () => {
    clearTimeout(holdT);
    if (!SV?.held) return;
    SV.start += performance.now() - SV.held;
    SV.held = 0;
    el.classList.remove('peek');
    const v = el.querySelector('.sa-media[src]'); if (v?.play) v.play().catch(() => {});
  };
  el.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.sv-tap') || SV.full) return;
    wasHeld = false;
    holdT = setTimeout(() => {
      if (!SV) return;
      wasHeld = true; SV.held = performance.now(); el.classList.add('peek');
      const v = el.querySelector('video'); if (v) v.pause();
    }, 260);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((k) => el.addEventListener(k, release));
  el.addEventListener('contextmenu', (e) => { if (e.target.closest('.sv-tap')) e.preventDefault(); });
  el.addEventListener('click', (e) => {
    if (SV.full) { e.preventDefault(); exitFull(); return; }   // full screen: any tap comes back
    if (wasHeld && e.target.closest('.sv-tap')) { wasHeld = false; return; }
    if (e.target.closest('[data-sound]')) {
      const v = el.querySelector('video.sa-media');
      if (v) { v.muted = !v.muted; localStorage.setItem(SOUND, v.muted ? '0' : '1'); if (!v.muted) v.play().catch(() => {}); paintSound(); track('story_sound', v.muted ? 'off' : 'on'); }
      return;
    }
    if (e.target.closest('[data-clean]')) { enterFull(); return; }
    if (e.target.closest('[data-cta]')) { track('story_link', list[i].id); cancelAnimationFrame(SV.raf); return; }
    if (e.target.closest('[data-next]')) go(1);
    else if (e.target.closest('[data-prev]')) go(-1);
    else if (e.target.closest('[data-x]')) nav(backTo);
  });
  SV.key = (e) => { if (SV.full) { exitFull(); return; } if (e.key === 'ArrowLeft') go(1); if (e.key === 'ArrowRight') go(-1); if (e.key === 'Escape') nav(backTo); };
  document.addEventListener('keydown', SV.key);
  show();
}
export function closeStory() {
  waiting = null;
  if (!SV) return false;
  cancelAnimationFrame(SV.raf);
  document.removeEventListener('keydown', SV.key);
  SV.el.remove();
  SV = null;
  document.body.style.overflow = '';
  return true;
}
