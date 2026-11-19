// The home's notice board - "לוח המודעות" (his ask + pick 2026-11-19, mockups Documents/shlomiverse-v2-design/board/1-board.jpg A
// + 2-police.jpg 1): notices from inside the world, pinned as paper sheets on a cork board, between the hero and the sponsored
// banner. More than one = they change by themselves (every 7 s, only while the page is in view) and can be swiped; dots show how many.
// A notice is a record like a sponsor (techietech-api/ads.js, Firestore `ads/<id>`) placed on "board": its picture is the whole
// notice (designed per notice - a police notice, a lost cat, a wedding invitation...), `href` is where a tap goes, `alt` its words.
// The next notice = a json + `node scripts/verse/ads.cjs put <json>` with "places": ["board"] - no code, no deploy.
import { esc, track } from './ui.js';
import { adsReady } from './ads.js';

const EVERY = 7000;
const PIN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 2.4a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4 3 3 0 0 1-3.2.7l-3 3a6 6 0 0 1-1.2 5.9 1 1 0 0 1-1.5.1L9.4 15 4.7 19.7a1 1 0 1 1-1.4-1.4L8 13.6l-3.1-3.1A1 1 0 0 1 5 9a6 6 0 0 1 5.9-1.2l3-3a3 3 0 0 1 .7-3.4z"/></svg>';
const TILT = [-1.6, 1.2, -0.8, 1.7];

let list = null, cur = 0, timer = 0;
const seen = new Set();

function note(n, i) {
  return `<a class="bd-note${i === cur ? ' on' : ''}" href="${esc(n.href || '#')}" data-bd-open="${esc(n.id)}" style="--tilt:${TILT[i % TILT.length]}deg"${i === cur ? '' : ' tabindex="-1" aria-hidden="true"'}>
      <img src="${esc(n.card)}" alt="${esc(n.alt)}" draggable="false"${i ? ' loading="lazy"' : ''}><i class="bd-pin"></i><i class="bd-tape"></i></a>`;
}
function html() {
  const dots = list.length > 1 ? `<span class="bd-dots">${list.map((n, i) => `<button type="button" class="${i === cur ? 'on' : ''}" data-bd-dot="${i}" aria-label="מודעה ${i + 1}"></button>`).join('')}</span>` : '';
  return `<section class="bd" aria-label="לוח המודעות"><div class="bd-h"><span class="bd-t">${PIN}לוח המודעות</span>${dots}</div>
    <div class="bd-cork">${list.map(note).join('')}</div></section>`;
}

// the slot's html (the home re-renders often - the current notice stays, the timer lives here)
export function boardSlot() {
  if (list && list.length) viewed();
  return `<div class="bd-slot" data-board>${list && list.length ? html() : ''}</div>`;
}

function viewed() {
  const n = list[cur];
  if (n && !seen.has(n.id)) { seen.add(n.id); track('board_view', n.id); }
}
function show(i) {
  cur = (i + list.length) % list.length;
  for (const el of document.querySelectorAll('[data-board] .bd')) {
    el.querySelectorAll('.bd-note').forEach((a, k) => { a.classList.toggle('on', k === cur); a.toggleAttribute('aria-hidden', k !== cur); a.tabIndex = k === cur ? 0 : -1; });
    el.querySelectorAll('[data-bd-dot]').forEach((d, k) => d.classList.toggle('on', k === cur));
  }
  viewed();
}
function tick() {
  if (document.hidden || list.length < 2) return;
  const el = document.querySelector('[data-board] .bd');
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;   // off screen: wait, so nobody misses a notice
  show(cur + 1);
}
const restart = () => { clearInterval(timer); timer = setInterval(tick, EVERY); };

adsReady.then((ads) => {
  list = ads.filter((a) => (a.places || []).includes('board'));
  if (!list.length) return;
  for (const el of document.querySelectorAll('[data-board]')) el.innerHTML = html();
  if (document.querySelector('[data-board] .bd')) viewed();
  restart();
});

document.addEventListener('click', (e) => {
  const d = e.target.closest('[data-bd-dot]');
  if (d) { show(+d.dataset.bdDot); restart(); return; }
  const o = e.target.closest('[data-bd-open]');
  if (o) track('board_open', o.dataset.bdOpen);
});

// swipe: right-to-left world - a swipe to the right brings the next notice (as a Hebrew page turns), to the left the one before
let x0 = null, y0 = 0, swiped = false;
document.addEventListener('pointerdown', (e) => { if (list && list.length > 1 && e.target.closest('.bd-cork')) { x0 = e.clientX; y0 = e.clientY; swiped = false; } }, { passive: true });
document.addEventListener('pointerup', (e) => {
  if (x0 === null) return;
  const dx = e.clientX - x0, dy = e.clientY - y0;
  x0 = null;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; show(cur + (dx > 0 ? 1 : -1)); restart(); }
}, { passive: true });
document.addEventListener('click', (e) => { if (swiped && e.target.closest('.bd-cork')) { e.preventDefault(); e.stopPropagation(); swiped = false; } }, true);   // a swipe isn't a tap
