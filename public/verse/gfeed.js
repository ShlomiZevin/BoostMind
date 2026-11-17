// The games feed - the app shell's games tab on a phone: the same kind of page as the videos feed (his rule: no two kinds of
// pages; mockup app-shell/r6/1-games-feed). One game per screen between the bars, swipe up for the next, newest first. On
// every game: its cover big, the same round column as a video (comments with their count, today's records, save, share -
// the comments sheet and the saved list already take a game: videoStats/<game>, saveGame), the title and its line, the cast
// row with the game's characters (a face = the same card as on a video), and one big play button - straight into play (the
// game layer opens in its own full screen, player.js HOOK.playFromFeed). A game card on a phone opens here, at that game
// (/games?at=<id>). Analytics: 'feed' tab:games / game:<id>.
import { T } from './copy.js';
import { I, esc, av, track } from './ui.js';
import { st, onState, save } from './state.js';
import { openComments, share } from './player.js';
import { openBoard, TROPHY } from './records.js';
import { castSheet } from './cast.js';
import { ICON_COMMENT, ICON_SHARE, railBtn, placeRail, paintSave, paintCounts, statsNear, statsOff } from './feed.js';   // the same column as the videos feed

const G = () => T.gfeed;
let GF = null;
const svg = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_GRID = svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>');
// the play mark pointing the way the app reads (right to left) - one and the same button on every game's slide
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 4.8v14.4c0 .8-.9 1.3-1.6.9L4.1 12.9c-.6-.4-.6-1.4 0-1.8l11.3-7.2c.7-.4 1.6.1 1.6.9z"/></svg>';
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

// the feed / grid switch: the small two-icon pill in the content's top corner (his choice: the first games switch) - the same
// on the games and the videos tab, in both views (wiki games() / videos() ask HOOK.gamesToggle / HOOK.feedToggle)
const ICON_FEED = svg('<rect x="6.5" y="3" width="11" height="18" rx="2.5"/><path d="M9.5 17.5h5"/>');
export function feedToggle(kind, on) {
  const A = T.shell, a = (k, href, t, ic) => `<a href="${href}" class="${on === k ? 'on' : ''}" aria-label="${esc(t)}" ${on === k ? 'aria-current="true"' : ''}>${ic}</a>`;
  // (in the top bar, the same spot in both views - shell.js puts it there on the videos and games tabs)
  return `<div class="gf-tg gf-tg-${kind}" role="group" aria-label="${esc(A.view)}">${a('feed', '/' + kind, A.feed, ICON_FEED)}${a('grid', '/' + kind + '?view=grid', A.grid, ICON_GRID)}</div>`;
}
export const gamesToggle = (on) => feedToggle('games', on);
// the switch moves in place (no entry of its own: back from the grid leaves the tab, as from the feed)
document.addEventListener('click', (e) => {
  const a = e.target.closest('.gf-tg a');
  if (!a || e.button || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  if (!a.classList.contains('on')) { track('feed', 'tab:' + a.pathname.slice(1) + '-' + (a.search ? 'grid' : 'feed')); nav(a.getAttribute('href'), true); }
}, true);

function slide(g, i) {
  const cast = (g.chars || []).filter((id) => C[id]);
  return `<section class="gf-s" data-i="${i}" data-id="${esc(g.id)}" aria-label="${esc(g.title)}">
    <div class="gf-art"${wordy(g) ? ' data-words="1"' : ''}>${g.img ? `<img class="gf-bg" src="${esc(g.img)}" alt="" aria-hidden="true" ${i > 1 ? 'loading="lazy"' : ''}><img class="gf-main" src="${esc(g.img)}" alt="" ${i > 1 ? 'loading="lazy"' : ''}>` : ''}</div>
    <div class="gf-body">
      <h2 class="gf-t">${esc(g.title)}</h2>
      ${g.tagline ? `<p class="gf-tag">${esc(shortLine(g.tagline))}</p>` : ''}
      ${cast.length ? `<div class="fd-cast gf-cast"><span class="fd-cl">${esc(T.feed.cast)}</span><div class="fd-chips">${cast.map((id) => `<a class="fd-chip" href="/c/${id}">${av({ char: id })}<span>${esc(C[id].name)}</span></a>`).join('')}</div></div>` : ''}
      <a class="gf-play" href="/play/${esc(g.id)}" data-gf-play="${esc(g.id)}">${PLAY}<span>${esc(G().play)}</span></a>
    </div>
  </section>`;
}

export function gamesFeed(q = {}) {
  unmount();
  const list = W.games || [];
  if (!list.length) return null;
  const start = q.at ? list.findIndex((g) => g.id === q.at) : -1;
  queueMicrotask(() => { mount(list, start); if (start >= 0) linkOpen(list[start], q); });   // once the router has put it on the page
  return `<div class="gf" id="gf" role="feed" aria-label="${esc(G().title)}">${list.map(slide).join('')}</div>`;
}

const gv = (g) => ({ id: g.id, title: g.title, cast: g.chars || [], game: g });
function mount(list, start) {
  const el = document.getElementById('gf');
  if (!el || GF) return;
  document.documentElement.classList.add('gf-on');
  GF = { el, list, cur: -1, ctx: null, off: [] };
  // a game asked for (?at=): that game; back to the feed without one: where it was
  const fy = history.state && history.state.fy;
  if (start >= 0) el.scrollTop = start * el.clientHeight; else if (fy) el.scrollTop = fy;
  GF.io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) activate(+e.target.dataset.i);
  }, { root: el, threshold: [0.6] });
  el.querySelectorAll('.gf-s').forEach((s) => GF.io.observe(s));
  el.addEventListener('click', onClick);
  // ONE rail for the feed, fixed while the games swipe under it (his rule 2026-11-17) - it follows the game on screen
  const r = Object.assign(document.createElement('div'), { id: 'gf-rail', className: 'fd-rail gf-rail fd-fixed' });
  r.innerHTML = railBtn('comments', 'data-g', ICON_COMMENT, T.feed.comments, 'comments') + railBtn('records', 'data-g', TROPHY, T.rec.rail)
    + railBtn('save', 'data-g', I.save, T.feed.save) + railBtn('share', 'data-g', ICON_SHARE, T.feed.share);
  r.addEventListener('click', railClick);
  document.body.append(r);
  GF.rail = r;
  // a cover whose words are the picture: the whole of it over a blurred copy of itself (every other cover fills the frame)
  el.querySelectorAll('.gf-main').forEach((img) => { if (img.complete && img.naturalWidth) fit(img); else img.addEventListener('load', () => fit(img), { once: true }); });
  const top = (i) => { const s = el.querySelector(`.gf-s[data-i="${i}"]`); return s ? s.offsetTop : 0; };
  GF.rs = () => { el.querySelectorAll('.gf-main').forEach((img) => img.naturalWidth && fit(img)); placeGf(); if (GF.cur >= 0) requestAnimationFrame(() => { if (GF) el.scrollTop = top(GF.cur); }); };
  // as the videos feed: the height changes (a phone's toolbar) - back onto the game showing; a scroll that stops between two - onto the nearest
  GF.ro = new ResizeObserver(() => GF && GF.rs());
  GF.ro.observe(el);
  const settle = () => { if (!GF) return; const y = el.scrollTop, h = el.clientHeight || 1, i = Math.round(y / h), t = top(i); if (Math.abs(t - y) > 2) el.scrollTo({ top: t, behavior: 'smooth' }); };
  const ended = () => { clearTimeout(GF.endT); GF.endT = setTimeout(settle, 140); };
  el.addEventListener('scroll', ended, { passive: true });
  GF.off.push(() => { GF.ro?.disconnect(); el.removeEventListener('scroll', ended); clearTimeout(GF.endT); });
  addEventListener('resize', GF.rs);
  addEventListener('vx-tb', GF.rs);
  GF.off.push(onState(paintSaves));
  placeGf();
  track('feed', 'tab:games');
}
// the game on screen: its comment count live; the address follows it (/games?at=<id> - back and a reload land on it)
function activate(i) {
  if (!GF || i === GF.cur || !GF.list[i]) return;
  GF.cur = i;
  const g = GF.list[i], s = GF.el.querySelector(`.gf-s[data-i="${i}"]`);
  GF.ctx = { el: s, v: gv(g), video: null, lead: (g.chars || []).find((id) => C[id]) || null, stats: null, cm: null };
  const rec = GF.rail.querySelector('[data-g="records"]'), n = !g.record;
  if (rec.hidden !== n) { rec.hidden = n; placeGf(); }   // a game without records: the rail without that button
  statsNear(GF, [i - 1, i, i + 1].map((k) => GF.list[k] && GF.list[k].id).filter(Boolean), (id) => { if (GF && GF.list[GF.cur].id === id) paintRail(); });
  paintRail();
  if (location.pathname === '/games' && !/[?&]view=/.test(location.search)) history.replaceState(history.state, '', '/games?at=' + encodeURIComponent(g.id));
}
function paintSaves() { if (GF && GF.cur >= 0) paintSave(GF.rail, st.saves.has(GF.list[GF.cur].id)); }
function paintRail() {
  if (!GF || GF.cur < 0) return;
  const d = GF.stats && GF.stats.get(GF.list[GF.cur].id);
  if (d && GF.ctx) GF.ctx.stats = d;
  paintCounts(GF.rail, d || {});
  paintSaves();
}
// the rail ends ~12px above the highest top of any slide's words (the art's bottom less the title's overlap) - the same y for every game
function placeGf() {
  if (!GF || !GF.rail) return;
  const fr = GF.el.getBoundingClientRect();
  let low = Infinity;
  GF.el.querySelectorAll('.gf-body').forEach((b) => { low = Math.min(low, b.offsetTop); });
  if (!fr.height || low === Infinity) return;
  placeRail(GF.rail, fr.top + 12, fr.top + low - 12);
}
function railClick(e) {
  const b = e.target.closest('[data-g]');
  if (!b || !GF || GF.cur < 0) return;
  e.stopPropagation();
  const g = GF.list[GF.cur];
  switch (b.dataset.g) {
    case 'comments': openComments({}, GF.ctx); break;
    case 'records': openBoard(g, { onAgain: () => play(g.id) }); break;
    case 'save': save(g.id, 'saveGame'); break;
    case 'share': share(gv(g)); break;
  }
}
// a link that asked for more (a "someone took your first place" push: ?records=1; a comment: ?c=<id>): opened on the slide
function linkOpen(g, q) {
  if (!GF || !g) return;
  setTimeout(() => {
    if (!GF) return;
    activate(GF.list.indexOf(g));
    if (q.records && g.record) openBoard(g, { onAgain: () => play(g.id) });
    else if (q.c) openComments({ focus: q.c }, GF.ctx);
    if (q.records || q.c) history.replaceState(history.state, '', '/games?at=' + encodeURIComponent(g.id));
  }, 450);
}
const play = (id) => { HOOK.playFromFeed = id; track('feed', 'game:' + id); nav('/play/' + id); };
function onClick(e) {
  const s = e.target.closest('.gf-s');
  if (!s || !GF) return;
  const g = GF.list[+s.dataset.i];
  const chip = e.target.closest('.fd-chip');
  if (chip) { e.preventDefault(); e.stopPropagation(); castSheet(chip.getAttribute('href').split('/').pop(), { v: gv(g), video: null, from: 'games' }); return; }
  if (e.target.closest('[data-gf-play]')) { e.preventDefault(); e.stopPropagation(); play(g.id); return; }
}
// the art fills the top of the slide edge to edge, cropped; only a cover whose words are the picture is shown whole over its blur
function fit(img) {
  const art = img.parentNode, h = art.clientHeight - 36;
  const on = !!art.dataset.words;
  art.classList.toggle('fit', on);
  if (on && art.clientWidth && h > 0) art.style.setProperty('--gt', Math.max(0, h - art.clientWidth / (img.naturalWidth / img.naturalHeight)) + 'px');
}

export function unmount() {
  if (!GF) return;
  GF.io?.disconnect();
  statsOff(GF);
  GF.rail?.remove();
  GF.off.forEach((u) => u && u());
  GF.ctx?.cm?.close('away');
  removeEventListener('resize', GF.rs); removeEventListener('vx-tb', GF.rs);
  GF.el.removeEventListener('click', onClick);
  GF = null;
  document.documentElement.classList.remove('gf-on');
}
// the router moved on (another page, the grid): the feed lets go
export function gfeedAfterRoute() {
  if (GF && !document.body.contains(GF.el)) unmount();
}
// a game card on a phone (the grid, the home's row, a character's games): the games feed at that game - one game page
document.addEventListener('click', (e) => {
  const a = e.target.closest('a.gcard, a.gfeat');
  if (!a || e.button || e.metaKey || e.ctrlKey || !document.documentElement.classList.contains('app') || !matchMedia('(max-width: 760px)').matches) return;
  const id = (a.getAttribute('href') || '').split('/play/')[1];
  if (!id) return;
  e.preventDefault(); e.stopPropagation();
  nav('/games?at=' + encodeURIComponent(decodeURIComponent(id)));
}, true);
