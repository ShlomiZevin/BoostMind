// The home's Syncs panel (his ask 2026-11-25: "a more prominent, successful panel with a bit of animation, instead of the
// meeting video's strip and the simple ad strip"): takes the hero band where the drop video's live strip stood (livestrip.js),
// between the question box and "מי עונה?". Left: a tiny meeting window - Techy-Tech's team on a 2x2 call, the speaker ring
// moving between them, then the recap card slides up with the action items ticking in (CSS only, one ~9 s loop; still for
// prefers-reduced-motion). Right: the product line and the button to the product page.
import { T } from './copy.js';
import { esc, track } from './ui.js';

export const SYNCS_PANEL = true;   // false = the band goes back to the drop video's live strip
const HREF = '/techietech/syncs/';
const PIC = (id) => `https://storage.googleapis.com/shlomiverse-media/wiki/img/c/${id}.jpg`;
const TEAM = ['amir', 'ronit', 'ofer', 'daniel'];
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

let seen = false;
export function syncsPanel() {
  const P = T.syncsPanel;
  const name = (id) => (typeof C !== 'undefined' && C[id] && C[id].name ? C[id].name.split(' ')[0] : '');
  if (!seen) { seen = true; track('syncs_panel_view', 'home'); }
  return `<a class="sx" href="${HREF}" data-sx aria-label="${esc(P.aria)}">
    <span class="sx-txt">
      <span class="sx-brand"><img src="/verse/art/syncs-icon.png" alt="" width="22" height="22"><b>Syncs</b><small>by Techy-Tech</small></span>
      <span class="sx-h">${esc(P.h1)}<br><em>${esc(P.h2)}</em></span>
      <span class="sx-sub">${esc(P.sub).replace('טקי-טק', '<span class="nw">טקי-טק</span>')}</span>
      <span class="sx-go">${esc(P.go)}<i>←</i></span>
    </span>
    <span class="sx-win" aria-hidden="true">
      <span class="sx-bar"><i class="sx-rec"></i><span>${esc(P.rec)}</span></span>
      <span class="sx-grid">${TEAM.map((id, i) => `<span class="sx-tile t${i}"><img src="${esc(PIC(id))}" alt="" loading="lazy"><small>${esc(name(id))}</small></span>`).join('')}</span>
      <span class="sx-recap"><b>${esc(P.recap)}</b>${P.items.map((x, i) => `<span class="sx-it i${i}"><i>${CHECK}</i>${esc(x)}</span>`).join('')}</span>
    </span>
  </a>`;
}

document.addEventListener('click', (e) => { if (e.target.closest('[data-sx]')) track('syncs_panel_open', 'home'); }, true);
