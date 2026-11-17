// The games feed - the app shell's משחקים tab on a phone (mockup app-shell/3-games-feed, plan app-shell phase 4): one game per
// screen between the top bar and the tab bar, swipe up for the next (scroll-snap), newest first (wiki.json games, as the
// games page). On every game: its cover big, the title, its one line, whose game it is (face + name), a big "לשחק" (the
// game layer - /play/<id>, player.js openGame) and, for a game with daily records, today's best (records/<game>_<day>, the
// same board records.js shows - every board read once when the feed opens, before it shows, so the line never pushes the
// page; kept a few minutes). The grid stays at /games?view=grid (a small
// toggle at the top, on both). Analytics: 'feed' tab:games when it opens, game:<id> on "לשחק" (analytics.js whitelist).
import { db, F } from './fb.js';
import { T } from './copy.js';
import { esc, av, track } from './ui.js';
import { dayIL } from './records.js';

const G = () => T.gfeed;
let GF = null;
const svg = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_GRID = svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>');
const ICON_UP = svg('<path d="m6 13 6-6 6 6"/><path d="m6 19 6-6 6 6"/>', 2.6);
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.3-7.2c.6-.4.6-1.4 0-1.8L8.6 3.9C7.9 3.5 7 4 7 4.8z"/></svg>';
const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString('en-US');
const lead = (g) => (g.chars || []).find((id) => C[id]) || null;
// covers whose words (a title, the logo) are the picture: shown whole, never cropped at the sides. A game can say so itself
// (game.json "cover_text": true - build.py, content.js and catalog.js pass it on); until that server change is live these, looked at one by one (2026-11-17)
const COVER_TEXT = new Set(['hani-games-yosef', 'hani-games-pilai', 'verse-fly']);
const wordy = (g) => (g.cover_text != null ? !!g.cover_text : COVER_TEXT.has(g.id));
// one short line, as on the mockup: the first sentence; still long - cut at a clause (" – ", ":", ",") or a word, never mid-word
const MAX = 66;
function shortLine(t) {
  t = String(t || '').trim().replace(/\s+/g, ' ');
  const m = t.match(/^.{10,}?[.!?](?=\s|$)/);
  const x = m ? m[0] : t;
  if (x.length <= MAX) return x;
  const c = x.slice(0, MAX + 1);
  let k = -1;
  for (const b of [' – ', ' - ', ': ', ', ', '; ']) k = Math.max(k, c.lastIndexOf(b));
  if (k >= 18) return x.slice(0, k).trim() + '…';
  const sp = c.lastIndexOf(' ');
  return x.slice(0, sp > 0 ? sp : MAX).replace(/[,:;–-]\s*$/, '').trim() + '…';
}

// the feed / grid switch - "פיד" | "רשת" (round 2: the same on the games and the videos tab; on the grid pages too - wiki games()
// / videos() ask HOOK.gamesToggle / HOOK.feedToggle)
export function feedToggle(kind, on) {
  const A = T.app, a = (k, href, t) => `<a href="${href}" class="${on === k ? 'on' : ''}" ${on === k ? 'aria-current="true"' : ''}>${esc(t)}</a>`;
  return `<div class="gf-tg gf-tg-${kind}" role="group" aria-label="${esc(A.view)}">${a('feed', '/' + kind, A.feed)}${a('grid', '/' + kind + '?view=grid', A.grid)}</div>`;
}
export const gamesToggle = (on) => feedToggle('games', on);
// the switch moves in place (no entry of its own: back from the grid leaves the tab, as from the feed)
document.addEventListener('click', (e) => {
  const a = e.target.closest('.gf-tg a');
  if (!a || e.button || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  if (!a.classList.contains('on')) { track('feed', 'tab:' + a.pathname.slice(1) + '-' + (a.search ? 'grid' : 'feed')); nav(a.getAttribute('href'), true); }
}, true);

function slide(g, i, all) {
  const o = lead(g), last = i === all.length - 1;
  return `<section class="gf-s" data-i="${i}" data-id="${esc(g.id)}" aria-label="${esc(g.title)}">
    <div class="gf-art"${wordy(g) ? ' data-words="1"' : ''}>${g.img ? `<img class="gf-bg" src="${esc(g.img)}" alt="" aria-hidden="true" ${i > 1 ? 'loading="lazy"' : ''}><img class="gf-main" src="${esc(g.img)}" alt="" ${i > 1 ? 'loading="lazy"' : ''}>` : ''}</div>
    <div class="gf-body">
      <h2 class="gf-t">${esc(g.title)}</h2>
      ${g.tagline ? `<p class="gf-tag">${esc(shortLine(g.tagline))}</p>` : ''}
      ${o ? `<a class="gf-who" href="/c/${o}">${av({ char: o, ring: true })}<b>${esc(C[o].name)}</b></a>` : ''}
      <a class="gf-play" href="/play/${esc(g.id)}" data-gf-play="${esc(g.id)}">${PLAY}<span>${esc(G().play)}</span></a>
      ${g.record ? `<div class="gf-rec" ${recLine(g) ? '' : 'hidden'}>${recLine(g)}</div>` : ''}
      ${last ? `<a class="gf-next gf-end" href="/games?view=grid" data-gf-grid>${ICON_GRID}<span>${esc(G().last)} · ${esc(G().grid)}</span></a>`
        : `<div class="gf-next" aria-hidden="true">${ICON_UP}<span>${esc(G().more)}</span></div>`}
    </div>
  </section>`;
}

export function gamesFeed() {
  unmount();
  const list = W.games || [];
  if (!list.length) return null;
  queueMicrotask(() => mount(list));   // once the router has put it on the page
  return `${gamesToggle('feed')}<div class="gf" id="gf" role="feed" aria-label="${esc(G().title)}">${list.map(slide).join('')}</div>`;
}

function mount(list) {
  const el = document.getElementById('gf');
  if (!el || GF) return;
  document.documentElement.classList.add('gf-on');
  GF = { el, list, late: new Set(), cur: 0 };
  // back to the feed (a tab tapped back, the back button): where it was
  const fy = history.state && history.state.fy;
  if (fy) el.scrollTop = fy;
  GF.io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { GF.cur = +e.target.dataset.i; placeLate(); }
  }, { root: el, threshold: [0.55] });
  GF.cur = Math.round(el.scrollTop / (el.clientHeight || 1));
  boards(list, el);
  el.querySelectorAll('.gf-s').forEach((s) => GF.io.observe(s));
  el.addEventListener('click', onClick);
  // a cover whose words are the picture: the whole of it over a blurred copy of itself (every other cover fills the frame)
  el.querySelectorAll('.gf-main').forEach((img) => { if (img.complete && img.naturalWidth) fit(img); else img.addEventListener('load', () => fit(img), { once: true }); });
  GF.rs = () => { el.querySelectorAll('.gf-art[style*="flex"]').forEach((a) => { a.style.flex = ''; }); el.querySelectorAll('.gf-main').forEach((img) => img.naturalWidth && fit(img)); };
  addEventListener('resize', GF.rs);
  addEventListener('vx-tb', GF.rs);
  track('feed', 'tab:games');
}
function onClick(e) {
  const p = e.target.closest('[data-gf-play]');
  if (p) track('feed', 'game:' + p.dataset.gfPlay);   // the link itself opens the game (the router: /play/<id>)
  const g = e.target.closest('[data-gf-grid]');
  if (g) { e.preventDefault(); e.stopPropagation(); nav('/games?view=grid', true); }
}
// the art fills the top of the slide edge to edge, cropped (cover, mockup 3); only a cover whose words are the picture
// (COVER_TEXT / cover_text) is shown whole over its own blur
function fit(img) {
  const art = img.parentNode, h = art.clientHeight - 36;
  const on = !!art.dataset.words;
  art.classList.toggle('fit', on);
  if (on && art.clientWidth && h > 0) art.style.setProperty('--gt', Math.max(0, h - art.clientWidth / (img.naturalWidth / img.naturalHeight)) + 'px');   // where the picture starts: its top edge melts into the blur
}
// ---------- today's best: every scoring game's board, read when the feed opens (kept 5 minutes), before the feed shows ----------
const BOARDS = {};   // '<game>_<day>' -> the leader or null
let boardsAt = 0;
const key = (g) => `${g.id}_${dayIL()}`;
function recLine(g) {
  const top = BOARDS[key(g)];
  return top ? `<span>${esc(G().best)}</span> <b>${fmt(top.value)}</b> <small>${esc(g.record.unit || '')}</small>` : '';
}
function boards(list, el) {
  const games = list.filter((g) => g.record);
  if (Date.now() - boardsAt > 300e3) { games.forEach((g) => delete BOARDS[key(g)]); boardsAt = Date.now(); }
  const own = GF;
  const read = (g) => F.getDoc(F.doc(db, 'records', key(g))).then((s) => {
    const top = s.exists() ? (s.data().top || [])[0] : null;
    BOARDS[key(g)] = top && typeof top.value === 'number' ? top : null;
  }).catch(() => { BOARDS[key(g)] = null; });
  // the game showing first: its board alone, first - its line's place kept (before the first paint), the score fading in,
  // or, when nobody scored today, the place closing from below: the art keeps its height, so the title and "לשחק" stay
  // exactly where the thumb saw them and only the hint moves up
  const first = list[GF.cur], slot = first && first.record && !(key(first) in BOARDS) && el.querySelector(`.gf-s[data-i="${GF.cur}"] .gf-rec`);
  const rest = () => games.filter((g) => !(key(g) in BOARDS)).forEach((g) => read(g).then(() => { if (own === GF && BOARDS[key(g)]) { own.late.add(g.id); placeLate(); } }));
  if (!slot) { rest(); return; }
  slot.innerHTML = `<span>${esc(G().best)}</span> <b>0</b>`;
  slot.hidden = false;
  slot.classList.add('rsv');
  read(first).then(() => {
    if (own !== GF) return;
    if (BOARDS[key(first)]) { slot.innerHTML = recLine(first); slot.classList.remove('rsv'); slot.classList.add('in'); }
    else {
      const art = slot.closest('.gf-s').querySelector('.gf-art');
      art.style.flex = `0 0 ${art.getBoundingClientRect().height}px`;   // (until the window changes size - GF.rs lets it go)
      slot.classList.add('shut');
      const done = () => { slot.hidden = true; slot.classList.remove('rsv', 'shut'); };
      slot.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 600);
    }
    rest();
  });
}
// a line that arrives late goes onto the games off screen at once, and onto the one showing only once it has left it
function placeLate(all) {
  if (!GF) return;
  for (const id of [...GF.late]) {
    const i = GF.list.findIndex((g) => g.id === id), slot = GF.el.querySelector(`.gf-s[data-i="${i}"] .gf-rec`);
    if (!slot) { GF.late.delete(id); continue; }
    if (!all && i === GF.cur) continue;
    slot.innerHTML = recLine(GF.list[i]);
    slot.hidden = false;
    GF.late.delete(id);
  }
}

export function unmount() {
  if (!GF) return;
  GF.io?.disconnect();
  removeEventListener('resize', GF.rs); removeEventListener('vx-tb', GF.rs);
  GF.el.removeEventListener('click', onClick);
  GF = null;
  document.documentElement.classList.remove('gf-on');
}
// the router moved on (another page, the grid): the feed lets go
export function gfeedAfterRoute() {
  if (GF && !document.body.contains(GF.el)) unmount();
}
