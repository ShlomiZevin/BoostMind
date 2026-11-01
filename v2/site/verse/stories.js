// Characters' stories between videos - Shlomi writes every one (/backstage/). Rings on the home page and around a
// character's portrait; #/story/<character> plays them full screen (tap left = next, right = back, like any RTL app).
import { db, F } from './fb.js';
import { T } from './copy.js';
import { I, esc, av, ago, abs, charColor, track } from './ui.js';
import { st } from './state.js';
import { followBtn, paintFollow } from './player.js';

const RECENT = 3 * 864e5;   // a story stays in the rings for three days
let all = [];
const subs = new Set();
export const onStories = (fn) => subs.add(fn);
F.onSnapshot(F.query(F.collection(db, 'stories'), F.where('hidden', '==', false), F.orderBy('t', 'desc'), F.limit(150)), (s) => {
  all = s.docs.map((d) => ({ id: d.id, ...d.data(), ms: d.data().t?.toMillis?.() || Date.now() }));
  subs.forEach((fn) => fn());
}, (e) => console.error('stories', e));

const SEEN = 'vx-seen-stories';
const seen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN)) || []); } catch (e) { return new Set(); } };
const markSeen = (id) => { const s = seen(); s.add(id); try { localStorage.setItem(SEEN, JSON.stringify([...s].slice(-400))); } catch (e) {} };

const recentOf = (char) => all.filter((x) => x.char === char && Date.now() - x.ms < RECENT && C[x.char]);
// characters with something new: unseen first, the ones you follow first
export function ringsHtml() {
  const chars = [...new Set(all.filter((x) => Date.now() - x.ms < RECENT && C[x.char]).map((x) => x.char))];
  if (!chars.length) return '';
  const s = seen();
  const unseen = (c) => recentOf(c).some((x) => !s.has(x.id));
  chars.sort((a, b) => (unseen(b) - unseen(a)) || (st.follows.has(b) - st.follows.has(a)));
  return `<div class="rings">${chars.map((c) => `<a class="ring ${unseen(c) ? '' : 'seen'}" href="#/story/${c}"><span class="rim"><span>${C[c].img ? `<img src="${abs(C[c].img)}" alt="">` : ''}</span></span><b>${esc(C[c].name)}</b></a>`).join('')}</div>`;
}
// the character page: a ring around the portrait when there is something to watch
export const storyRing = (char) => (recentOf(char).length ? ` data-story="${char}" style="outline:3px solid var(--vx-accent);outline-offset:4px;cursor:pointer"` : '');
document.addEventListener('click', (e) => { const p = e.target.closest('[data-story]'); if (p) { e.preventDefault(); location.hash = '#/story/' + p.dataset.story; } });

// ---------- the viewer ----------
let SV = null;
let backTo = '#/';
export const setStoryBack = (h) => { backTo = h || '#/'; };

export function openStory(char) {
  closeStory();
  let list = recentOf(char).reverse();
  if (!list.length) list = all.filter((x) => x.char === char).slice(0, 10).reverse();
  if (!list.length || !C[char]) { location.replace(backTo); return; }
  const s = seen();
  let i = Math.max(0, list.findIndex((x) => !s.has(x.id)));
  const el = document.createElement('div');
  el.className = 'sv';
  el.innerHTML = `<div class="sv-box" style="--c:${charColor(char)}">
      <div class="sv-bars">${list.map(() => '<span><i></i></span>').join('')}</div>
      <div class="sv-head"><a href="#/c/${char}">${av({ char, ring: true })}</a><span><b>${esc(C[char].name)}</b><br><small data-ago></small></span>
        <span class="end">${followBtn(char, 'pill')}<button class="vx-round" data-x style="width:42px;height:42px" aria-label="סגירה">${I.x}</button></span></div>
      <div data-slot></div>
      <div class="sv-shade"></div>
      <button class="sv-tap next" data-next aria-label="הבא"></button><button class="sv-tap prev" data-prev aria-label="הקודם"></button>
    </div>`;
  document.body.append(el);
  document.body.style.overflow = 'hidden';
  SV = { el, timer: 0, raf: 0 };
  paintFollow(el);
  const bars = [...el.querySelectorAll('.sv-bars i')];
  const show = () => {
    cancelAnimationFrame(SV.raf);
    const x = list[i];
    markSeen(x.id);
    track('story_view', char);
    bars.forEach((b, k) => { b.style.width = k < i ? '100%' : '0'; });
    el.querySelector('[data-ago]').textContent = ago(x.ms);
    const slot = el.querySelector('[data-slot]');
    const text = x.text ? `<div class="sv-text">${esc(x.text)}</div>` : '';
    if (x.media?.kind === 'video') slot.innerHTML = `<video class="sv-media" src="${esc(x.media.url)}" playsinline autoplay></video>${text}`;
    else if (x.media?.kind === 'image') slot.innerHTML = `<img class="sv-media" src="${esc(x.media.url)}" alt="">${text}`;
    else slot.innerHTML = `<div class="sv-plain">${text}</div>`;
    const vid = slot.querySelector('video');
    const start = performance.now();
    const len = () => (vid && vid.duration ? vid.duration * 1000 : Math.min(9000, 4000 + (x.text || '').length * 45));
    const step = (now) => {
      if (!SV || !bars[i]) return;
      const p = vid ? (vid.currentTime * 1000) / len() : (now - start) / len();
      bars[i].style.width = Math.min(100, p * 100) + '%';
      if (p >= 1) return go(1);
      SV.raf = requestAnimationFrame(step);
    };
    if (vid) vid.play().catch(() => { vid.muted = true; vid.play(); });
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
      const nextChar = [...new Set(all.filter((x) => Date.now() - x.ms < RECENT && x.char !== char && C[x.char] && !s2.has(x.id)).map((x) => x.char))][0];
      if (nextChar) location.replace('#/story/' + nextChar); else location.hash = backTo;
      return;
    }
    show();
  };
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) go(1);
    else if (e.target.closest('[data-prev]')) go(-1);
    else if (e.target.closest('[data-x]')) location.hash = backTo;
  });
  SV.key = (e) => { if (e.key === 'ArrowLeft') go(1); if (e.key === 'ArrowRight') go(-1); if (e.key === 'Escape') location.hash = backTo; };
  document.addEventListener('keydown', SV.key);
  show();
}
export function closeStory() {
  if (!SV) return false;
  cancelAnimationFrame(SV.raf);
  document.removeEventListener('keydown', SV.key);
  SV.el.remove();
  SV = null;
  document.body.style.overflow = '';
  return true;
}
