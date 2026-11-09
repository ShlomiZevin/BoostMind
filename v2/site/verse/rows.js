// A computer: every row that moves sideways (videos, sites, games, stories) gets two round arrows instead of a grey scrollbar
// (his note 2026-11-09: "I can't reach it" - a mouse doesn't scroll sideways). Hebrew reads right to left, so what comes next
// is on the LEFT: the left arrow points left and moves on, the right one goes back. Phones keep the finger swipe, no arrows.
const ROWS = '.row, .srow, .grow, .yv-picks, .yv-st, .rings';
const FINE = matchMedia('(hover: hover) and (pointer: fine)');
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

function arm(row) {
  if (row.dataset.arw || row.scrollWidth <= row.clientWidth + 4) return;   // only a row that really has more
  row.dataset.arw = '1';
  const host = document.createElement('div');
  host.className = 'vx-rowhost';
  row.before(host); host.append(row);
  const mk = (cls, d, label) => Object.assign(document.createElement('button'), { type: 'button', className: `vx-arrow ${cls}`, innerHTML: svg(d), ariaLabel: label });
  const next = mk('next', 'M14.5 6 8.5 12l6 6', 'הבא'), prev = mk('prev', 'M9.5 6l6 6-6 6', 'הקודם');
  host.append(next, prev);
  const step = () => Math.max(220, row.clientWidth * 0.85);
  // in a right-to-left row scrollLeft runs from 0 (the start, on the right) down to minus the overflow
  next.onclick = (e) => { e.preventDefault(); row.scrollBy({ left: -step(), behavior: 'smooth' }); };
  prev.onclick = (e) => { e.preventDefault(); row.scrollBy({ left: step(), behavior: 'smooth' }); };
  const paint = () => {
    const x = Math.abs(row.scrollLeft), max = row.scrollWidth - row.clientWidth;
    prev.classList.toggle('off', x < 4);
    next.classList.toggle('off', x > max - 4);
  };
  row.addEventListener('scroll', paint, { passive: true });
  new ResizeObserver(paint).observe(row);
  paint();
}

let queued = false;
const scan = () => { queued = false; if (FINE.matches) document.querySelectorAll(ROWS).forEach(arm); };
const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => setTimeout(scan, 60)); } };
export function startRowArrows() {
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  addEventListener('resize', later);
  addEventListener('load', later);
  later();
}
