// Your status in the Shlomiverse (2026-11-06, the conversion plan; mockups conversion/C-chip, L1-ladder): everyone arrives
// as a tourist (תייר), an account makes you a resident (תושב), and the citizenship journey (soon) makes you a citizen
// (אזרח). A small chip in the top bar says which you are; tapping it opens the window with the three and the way up.
import { T } from './copy.js';
import { I, esc, sheet, track } from './ui.js';
import { needFan, signedIn } from './state.js';

const S = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const SI = {
  passport: S('<rect x="5" y="2.5" width="14" height="19" rx="2"/><circle cx="12" cy="10" r="3.6"/><path d="M8.4 10h7.2M12 6.4c1.2 1 1.8 2.2 1.8 3.6s-.6 2.6-1.8 3.6c-1.2-1-1.8-2.2-1.8-3.6s.6-2.6 1.8-3.6zM9 17.5h6"/>'),
  house: S('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>'),
  id: S('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5.2 16c.7-1.7 1.9-2.5 3.3-2.5s2.6.8 3.3 2.5M14 10h4.5M14 13.5h3"/>'),
  award: S('<circle cx="12" cy="9" r="5.5"/><path d="m12 6.4.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 8.5l2-.3z"/><path d="M8.6 13.5 7 21l5-2.6 5 2.6-1.6-7.5"/>'),
  hash: S('<path d="M9 3.5 7.5 20.5M16.5 3.5 15 20.5M4.5 8.5h16M3.5 15.5h16"/>'),
  doc: S('<path d="M6 2.5h8.5L19 7v14.5H6z"/><path d="M14 2.5V7h5M9 12h7M9 15.5h7M9 19h4"/>'),
  bars: S('<path d="M5 20v-6M10 20V9M15 20v-8M20 20V4"/>'),
};
const TIERS = [
  { id: 'tourist', icon: SI.passport, items: [I.comment, I.play, I.game] },
  { id: 'resident', icon: SI.house, items: [I.comment, I.sticker, SI.bars] },
  { id: 'citizen', icon: SI.id, items: [SI.doc, SI.hash, SI.award] },
];
export const myStatus = () => (signedIn() ? 'resident' : 'tourist');

// the chip in the top bar (pages.js renderTop)
export const statusChip = () => `<button class="st-chip" data-status aria-label="${esc(T.status.title)}">${myStatus() === 'tourist' ? SI.passport : SI.house}<span>${esc(T.status.name[myStatus()])}</span></button>`;

export function openStatus(where = 'chip') {
  track('status_open', where);
  const me = myStatus(), at = TIERS.findIndex((t) => t.id === me);
  const tier = (t, i) => `<div class="sl-tier${i === at ? ' here' : ''}${i < at ? ' past' : ''}">
      <div class="sl-head"><span class="sl-ic">${t.icon}</span><b>${esc(T.status.name[t.id])}</b>
        ${i === at ? `<em class="sl-here">${esc(T.status.here)}</em>` : t.id === 'citizen' ? `<em class="sl-soon">${esc(T.status.soon)}</em>` : ''}</div>
      <p>${esc(T.status.line[t.id])}</p>
      <ul>${t.items.map((ic, k) => `<li>${ic}<span>${esc(T.status.gets[t.id][k])}</span></li>`).join('')}</ul></div>`;
  const h = sheet(`<div class="in sl">
      <img class="sl-logo" src="/verse/logo-160.png" alt="שלומיוורס">
      <h2 class="vx-h">${esc(T.status.title)}</h2>
      <p class="vx-sub">${esc(T.status.sub[me])}</p>
      <div class="sl-path">${TIERS.map(tier).join('')}</div>
      ${me === 'tourist' ? `<button class="vx-btn main block" data-sl-go>${esc(T.status.go)}</button>` : `<p class="vx-small">${esc(T.status.residentNote)}</p>`}
    </div>`, { cls: 'status' });
  h.el.querySelector('[data-sl-go]')?.addEventListener('click', () => { h.close('go'); needFan('status'); });
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-status]')) { e.preventDefault(); openStatus('chip'); } });

// ---------- the ask after 3 videos (2026-11-06, mockup conversion/A-3videos) ----------
// A tourist who watched 3 videos to the end (or 80%) has met the people here: one warm step into the world, with the faces
// of the characters they watched. Shown when a video ends (over the ended video) or when they close one they finished;
// never over a playing video. "Not now" = 7 days; once a visit; it takes the home-screen invite's place that visit.
const DONE = 'vx-done', ASK = 'vx-ask3';
const doneList = () => { try { return JSON.parse(localStorage.getItem(DONE)) || []; } catch (e) { return []; } };
export function videoDone(id, lead) {
  const list = doneList().filter((x) => x.id !== id);
  list.unshift({ id, lead: lead || null });
  try { localStorage.setItem(DONE, JSON.stringify(list.slice(0, 20))); } catch (e) {}
}
function canAsk3() {
  if (signedIn() || doneList().length < 3) return false;
  try {
    if (sessionStorage.getItem(ASK)) return false;
    const later = +localStorage.getItem(ASK) || 0;
    if (Date.now() - later < 7 * 864e5) return false;
  } catch (e) { return false; }
  return !document.querySelector('.vx-sheet, .st, .ac, .nk');
}
// true = it was shown (the caller then skips the home-screen invite)
export function ask3Moment() {
  if (!canAsk3()) return false;
  try { sessionStorage.setItem(ASK, '1'); sessionStorage.setItem('vx-app-asked', '1'); } catch (e) {}
  track('ask3', 'show');
  const faces = [...new Set(doneList().map((x) => x.lead).filter((c) => c && typeof C !== 'undefined' && C[c] && C[c].img))].slice(0, 3);
  let yes = false;
  const h = sheet(`<div class="in a3">
      <div class="a3-faces">${faces.map((c) => `<span><img src="${esc(C[c].img)}" alt=""><b>${esc(C[c].name)}</b></span>`).join('')}</div>
      <h2 class="vx-h">${esc(T.ask3.title)}</h2>
      <p class="vx-sub">${esc(T.ask3.line)}</p>
      <button class="vx-btn main block" data-a3-go>${esc(T.ask3.go)}</button>
      <button class="vx-link" data-a3-later>${esc(T.ask3.later)}</button>
    </div>`, { cls: 'ask3', onClose: () => { if (!yes) { track('ask3', 'later'); try { localStorage.setItem(ASK, String(Date.now())); } catch (e) {} } } });
  h.el.querySelector('[data-a3-go]').onclick = () => { yes = true; track('ask3', 'yes'); h.close('go'); needFan('three'); };
  h.el.querySelector('[data-a3-later]').onclick = () => h.close('later');
  return true;
}
