// The watch count on every video (his ask, 2026-11-13: "add watch count on every video... you decide"): all-time plays on
// the site, from videoStats/_plays (analytics.js videoTops writes it every 15 minutes; only videos with 20+ plays are in it -
// a handful of plays next to a 40K channel would make the site look empty). Read once per visit. Every video card on any
// page (the wiki's .vid, the home's top-10 .t10) gets a small badge on its picture as it appears; the player shows it under
// the title (player.js).
import { db, F } from './fb.js';
import { I } from './ui.js';

let plays = null;
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, '') + 'M'
  : n >= 1e3 ? (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K' : String(n));
export const playsOf = (id) => (plays && plays[id]) || 0;
export const playsText = (id) => (playsOf(id) ? fmt(playsOf(id)) : '');

const badge = (n) => `<span class="vx-plays" aria-label="${n} צפיות">${I.play}${fmt(n)}</span>`;
function paint(root = document) {
  if (!plays) return;
  for (const card of root.querySelectorAll('.vid[data-video], .t10[data-video]')) {
    const th = card.querySelector('.thumb');
    if (!th || th.dataset.pl) continue;
    th.dataset.pl = '1';
    const n = playsOf(card.dataset.video);
    if (n) th.insertAdjacentHTML('beforeend', badge(n));
  }
  // the player: "· 107 צפיות" after the series / character line
  for (const s of root.querySelectorAll('[data-plays-for]:not([data-pl])')) {
    s.dataset.pl = '1';
    const n = playsOf(s.dataset.playsFor);
    if (n) s.textContent = ` · ${fmt(n)} צפיות`;
  }
}
let queued = false;
const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; paint(); }); };

export function startPlays(onLoad) {
  F.getDoc(F.doc(db, 'videoStats', '_plays')).then((d) => {
    plays = d.exists() ? d.data().n || {} : {};
    paint();
    new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
    if (onLoad) onLoad();
  }).catch((e) => console.error('plays', e));
}
