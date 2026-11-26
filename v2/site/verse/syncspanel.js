// The home's Syncs strip (his asks 2026-11-25/26: "a more prominent panel with a bit of animation instead of the meeting
// video's strip" -> "the same height as the current panel, with some animation"): takes the hero band where the drop video's
// live strip stood (livestrip.js), at its 72px. Right: Techy-Tech's team on a call, the speaker ring moving between them;
// middle: the line flips "מסיימים ישיבה." <-> "מתחילים לבצע." (with a ticked action item); left: the round orange button.
// CSS only (verse.css .sx), still for prefers-reduced-motion.
import { T } from './copy.js';
import { esc, track } from './ui.js';

export const SYNCS_PANEL = true;   // false = the band goes back to the drop video's live strip
const HREF = '/techietech/syncs/';
const PIC = (id) => `https://storage.googleapis.com/shlomiverse-media/wiki/img/c/${id}.jpg`;
const TEAM = ['amir', 'ronit', 'ofer'];
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

let seen = false;
export function syncsPanel() {
  const P = T.syncsPanel;
  if (!seen) { seen = true; track('syncs_panel_view', 'home'); }
  return `<a class="sx" href="${HREF}" data-sx aria-label="${esc(P.aria)}">
    <span class="sx-faces" aria-hidden="true">${TEAM.map((id, i) => `<span class="sx-face f${i}"><img src="${esc(PIC(id))}" alt="" loading="lazy"></span>`).join('')}<i class="sx-rec"></i></span>
    <span class="sx-txt">
      <span class="sx-brand"><small>by Techy-Tech</small><b>Syncs</b><img src="/verse/art/syncs-icon.png" alt="" width="15" height="15"></span>
      <span class="sx-flip"><span>${esc(P.h1)}</span><span><i>${CHECK}</i>${esc(P.h2)}</span></span>
    </span>
    <span class="sx-go" aria-hidden="true">←</span>
  </a>`;
}

document.addEventListener('click', (e) => { if (e.target.closest('[data-sx]')) track('syncs_panel_open', 'home'); }, true);
