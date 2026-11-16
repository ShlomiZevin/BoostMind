// The app shell (plan app-shell, mockups Documents/shlomiverse-v2-design/app-shell/1-4): on phones the Shlomiverse looks and
// moves like an app - a slim solid top bar (logo, search icon, bell, the account) and a bottom tab bar on EVERY screen:
// בית / סרטונים / משחקים / צ'אט / דמויות. The bar sits above the video / game / story layers and the sheets (they end above it,
// shell.css + player.js fit()); it steps aside on a computer, while typing, in a game's full screen and in the simulation /
// citizenship journeys. Behind gates.js APP_SHELL: html.app (set early by the wiki page, kept right here) turns all of it on.
import { onState } from './state.js';
import { appShell } from './gates.js';

const html = document.documentElement;
const bar = document.getElementById('tabbar');
const phone = matchMedia('(max-width: 760px)');
const LAYER = /^\/(v|play|story)\//;
let lastBase = '/';   // the page under a layer (a tab tap that needs the page - the chat - goes back to it)

// ---------- the flag ----------
function applyFlag() {
  const on = appShell();
  html.classList.toggle('app', on);
  try { if (on) localStorage.setItem('vx-app', '1'); else localStorage.removeItem('vx-app'); } catch (e) { /* private mode */ }
  tbChanged();
}

// ---------- the bar's height changed (shown / hidden): the layers sized by script (player.js fit) size again ----------
let lastTb = -1;
function tbChanged() {
  const h = bar ? bar.offsetHeight : 0;
  if (h === lastTb) return;
  lastTb = h;
  dispatchEvent(new Event('vx-tb'));
}

// ---------- which tab is this page ----------
function tabOf(path = location.pathname) {
  const p = path.split('/')[1] || '';
  if (!p) return 'home';
  if (p === 'videos') return 'videos';
  if (p === 'games') return 'games';
  if (['characters', 'c', 'series', 's', 'sites'].includes(p)) return 'characters';
  return '';
}
const chatOpen = () => !!document.querySelector('#cx.open');
function paint() {
  if (!bar) return;
  const cur = chatOpen() ? 'chat' : tabOf(LAYER.test(location.pathname) ? lastBase : location.pathname);
  bar.querySelectorAll('[data-tab]').forEach((a) => {
    const on = a.dataset.tab === cur;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
export function shellAfterRoute() {
  if (!LAYER.test(location.pathname)) lastBase = location.pathname + location.search;
  paint();
}

// ---------- a tab tap: whatever is open over the page closes first (a sheet, the menu, the chat, a layer) ----------
function closeSheets() {
  document.querySelectorAll('.vx-back, .mm-back').forEach((b) => b.click());
  document.querySelectorAll('.nc-ask').forEach((x) => x.remove());
}
if (bar) bar.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-tab]');
  if (!a || !html.classList.contains('app')) return;
  e.preventDefault();   // the page's own link handler stands down
  const tab = a.dataset.tab, layer = LAYER.test(location.pathname);
  try { window.track && window.track('tab', tab); } catch (x) { /* analytics never breaks a tap */ }
  closeSheets();
  if (tab === 'chat') {
    if (chatOpen()) return;
    if (layer) nav(lastBase);
    const mode = typeof cxMode !== 'undefined' && cxMode ? cxMode : 'guide';
    openChat(mode);
    paint();
    return;
  }
  const wasChat = chatOpen();
  if (wasChat) closeChat();
  if (!layer && tabOf() === tab) {
    // the tab already showing: back to its top (the feed to its first video)
    if (!wasChat) { scrollTo({ top: 0, behavior: 'smooth' }); document.querySelector('.fd')?.scrollTo({ top: 0, behavior: 'smooth' }); }
    paint();
    return;
  }
  nav(a.getAttribute('href'));
});

// ---------- the chat opens / closes: its tab lights up ----------
const cx = document.getElementById('cx');
if (cx) new MutationObserver(paint).observe(cx, { attributes: true, attributeFilter: ['class'] });

// ---------- the keyboard is up: the bar steps aside (and comes back when it goes down) ----------
const coarse = matchMedia('(pointer: coarse)');
function kbCheck() {
  const f = document.activeElement;
  const typing = !!(f && f.matches && f.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable="true"]'));
  const kb = typing && coarse.matches;
  if (kb !== html.classList.contains('kb')) { html.classList.toggle('kb', kb); requestAnimationFrame(tbChanged); }
}
addEventListener('focusin', kbCheck);
addEventListener('focusout', () => setTimeout(kbCheck, 0));

// ---------- a game's full screen, a phone turned into a computer-wide window ----------
new MutationObserver((list) => {
  for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('vp')) new MutationObserver(() => requestAnimationFrame(tbChanged)).observe(n, { attributes: true, attributeFilter: ['class'] });
  requestAnimationFrame(tbChanged);
}).observe(document.body, { childList: true });
phone.addEventListener?.('change', () => requestAnimationFrame(tbChanged));

applyFlag();
onState(applyFlag);
paint();
