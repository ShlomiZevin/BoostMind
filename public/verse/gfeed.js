// The games feed - the app shell's משחקים tab on a phone (mockup app-shell/3-games-feed, plan app-shell phase 4): one game per
// screen between the top bar and the tab bar, swipe up for the next (scroll-snap), newest first (wiki.json games, as the
// games page). On every game: its cover big, the title, its one line, whose game it is (face + name), a big "לשחק" (the
// game layer - /play/<id>, player.js openGame) and, for a game with daily records, today's best (records/<game>_<day>, the
// same board records.js shows - read once, when the game comes on screen). The grid stays at /games?view=grid (a small
// toggle at the top, on both). Analytics: 'feed' tab:games when it opens, game:<id> on "לשחק" (analytics.js whitelist).
import { db, F } from './fb.js';
import { T } from './copy.js';
import { esc, av, track } from './ui.js';
import { dayIL } from './records.js';

const G = () => T.gfeed;
let GF = null;
const svg = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_FEED = svg('<rect x="6.5" y="3" width="11" height="18" rx="2.5"/><path d="M9.5 17.5h5"/>');
const ICON_GRID = svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>');
const ICON_UP = svg('<path d="m6 13 6-6 6 6"/><path d="m6 19 6-6 6 6"/>', 2.6);
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11.3-7.2c.6-.4.6-1.4 0-1.8L8.6 3.9C7.9 3.5 7 4 7 4.8z"/></svg>';
const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString('en-US');
const lead = (g) => (g.chars || []).find((id) => C[id]) || null;

// the feed / grid switch (also on the grid page: wiki games() asks HOOK.gamesToggle)
export function gamesToggle(on) {
  return `<div class="gf-tg" role="group" aria-label="${esc(G().view)}">
    <a href="/games" class="${on === 'feed' ? 'on' : ''}" aria-label="${esc(G().viewFeed)}" ${on === 'feed' ? 'aria-current="true"' : ''}>${ICON_FEED}</a>
    <a href="/games?view=grid" class="${on === 'grid' ? 'on' : ''}" aria-label="${esc(G().viewGrid)}" ${on === 'grid' ? 'aria-current="true"' : ''}>${ICON_GRID}</a></div>`;
}
// the switch moves in place (no entry of its own: back from the grid leaves the tab, as from the feed)
document.addEventListener('click', (e) => {
  const a = e.target.closest('.gf-tg a');
  if (!a || e.button || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  if (!a.classList.contains('on')) { track('feed', 'tab:games-' + (a.search ? 'grid' : 'feed')); nav(a.getAttribute('href'), true); }
}, true);

function slide(g, i, all) {
  const o = lead(g), last = i === all.length - 1;
  return `<section class="gf-s" data-i="${i}" data-id="${esc(g.id)}" aria-label="${esc(g.title)}">
    <div class="gf-art">${g.img ? `<img src="${esc(g.img)}" alt="" ${i > 1 ? 'loading="lazy"' : ''}>` : ''}</div>
    <div class="gf-body">
      <h2 class="gf-t">${esc(g.title)}</h2>
      ${g.tagline ? `<p class="gf-tag">${esc(g.tagline)}</p>` : ''}
      ${o ? `<a class="gf-who" href="/c/${o}">${av({ char: o, ring: true })}<b>${esc(C[o].name)}</b></a>` : ''}
      <a class="gf-play" href="/play/${esc(g.id)}" data-gf-play="${esc(g.id)}">${PLAY}<span>${esc(G().play)}</span></a>
      ${g.record ? `<div class="gf-rec" hidden></div>` : ''}
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
  GF = { el, list, recs: new Set() };
  // back to the feed (a tab tapped back, the back button): where it was
  const fy = history.state && history.state.fy;
  if (fy) el.scrollTop = fy;
  GF.io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { const i = +e.target.dataset.i; record(i); record(i + 1); }
  }, { root: el, threshold: [0.55] });
  el.querySelectorAll('.gf-s').forEach((s) => GF.io.observe(s));
  el.addEventListener('click', onClick);
  track('feed', 'tab:games');
}
function onClick(e) {
  const p = e.target.closest('[data-gf-play]');
  if (p) track('feed', 'game:' + p.dataset.gfPlay);   // the link itself opens the game (the router: /play/<id>)
  const g = e.target.closest('[data-gf-grid]');
  if (g) { e.preventDefault(); e.stopPropagation(); nav('/games?view=grid', true); }
}
// today's best on this game's board (lower is better for some - the board keeps its own order; top[0] is the leader)
function record(i) {
  if (!GF || GF.recs.has(i)) return;
  const g = GF.list[i];
  if (!g || !g.record) return;
  GF.recs.add(i);
  const own = GF;
  F.getDoc(F.doc(db, 'records', `${g.id}_${dayIL()}`)).then((s) => {
    const top = s.exists() ? (s.data().top || [])[0] : null;
    const slot = own === GF && GF.el.querySelector(`.gf-s[data-i="${i}"] .gf-rec`);
    if (!top || !slot || typeof top.value !== 'number') return;
    slot.innerHTML = `<span>${esc(G().best)}</span> <b>${fmt(top.value)}</b> <small>${esc(g.record.unit || '')}</small>`;
    slot.hidden = false;
  }).catch(() => {});
}

export function unmount() {
  if (!GF) return;
  GF.io?.disconnect();
  GF.el.removeEventListener('click', onClick);
  GF = null;
  document.documentElement.classList.remove('gf-on');
}
// the router moved on (another page, the grid): the feed lets go
export function gfeedAfterRoute() {
  if (GF && !document.body.contains(GF.el)) unmount();
}
