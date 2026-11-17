// The app shell (plan app-shell, mockups Documents/shlomiverse-v2-design/app-shell/1-4): on phones the Shlomiverse looks and
// moves like an app - a slim solid top bar (logo, search icon, bell, the account) and a bottom tab bar on EVERY screen:
// בית / סרטונים / משחקים / צ'אט / דמויות. The bar sits above the video / game / story layers and the sheets (they end above it,
// shell.css + player.js fit()); it steps aside on a computer, while typing, in a game's full screen and in the simulation /
// citizenship journeys. Behind gates.js APP_SHELL: html.app (set early by the wiki page, kept right here) turns all of it on.
import { onState } from './state.js';
import { appShell } from './gates.js';
import { feedToggle } from './gfeed.js';

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
  if (p === 'videos' || p === 'archive') return 'videos';
  if (p === 'games') return 'games';
  if (p === 'chat') return 'chat';
  if (p === 'community') return 'community';
  if (['characters', 'c', 'series', 's', 'sites'].includes(p)) return 'characters';
  return '';
}
const chatOpen = () => !!document.querySelector('#cx.open');
function paint() {
  if (!bar) return;
  // a video / game / story: the tab of the page it was opened from (its history entry keeps it - back from the chat to a
  // video lands on that entry again); else the page's own tab, or the chat when it is open
  const layer = LAYER.test(location.pathname), base = layer ? ((history.state && history.state.base) || lastBase) : null;
  const cur = base ? tabOf(base) : chatOpen() ? 'chat' : tabOf(location.pathname);
  bar.querySelectorAll('[data-tab]').forEach((a) => {
    const on = a.dataset.tab === cur;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
addEventListener('popstate', () => requestAnimationFrame(paint));
// the feed / grid switch lives in the top bar on the videos and games tabs (his rule: it never moves when you tap it) - the
// same spot in both views, between the search and the logo
function barSwitch() {
  const p = location.pathname, kind = p === '/videos' ? 'videos' : p === '/games' ? 'games' : null;
  let w = document.getElementById('tb-tg');
  if (!kind || !html.classList.contains('app') || !phone.matches) { w?.remove(); return; }
  if (!w) {
    w = Object.assign(document.createElement('span'), { id: 'tb-tg', className: 'tb-tg' });
    const top = document.getElementById('vx-top');   // at the left end, beside the bell (his note: search by the logo, the selector by the bell)
    top?.parentNode.insertBefore(w, top);
  }
  w.innerHTML = feedToggle(kind, /[?&]view=grid/.test(location.search) ? 'grid' : 'feed');
}
export function shellAfterRoute() {
  barSwitch();
  dispatchEvent(new Event('vx-route'));   // a moment held for a calm page (install.js whenCalm) looks again
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
  try { window.track && window.track('feed', 'bar:' + tab); } catch (x) { /* analytics never breaks a tap */ }
  closeSheets();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  // a layer the site opened (its entry marked) is replaced by the tab - back from the tab doesn't open it again
  const s = history.state || {}, inPlace = layer && !!(s.vxl || (s.vxo && s.ul));
  const docked = !!document.querySelector('#cx.dock');
  if (chatOpen() && !docked) closeChat();   // the drawer (a computer-wide window)
  if (!layer && tabOf() === tab) {
    // the tab already showing: back to its top (the feed to its first video / game, the chat to its last message)
    scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector('.fd, .gf')?.scrollTo({ top: 0, behavior: 'smooth' });
    paint();
    return;
  }
  // the videos tab comes back to the video it was on (round 2 - he lost his place: the feed began again from the top)
  let href = a.getAttribute('href');
  if (tab === 'videos') { try { const at = sessionStorage.getItem('vx-feed-at'); if (at) href = '/videos?at=' + encodeURIComponent(at); } catch (x) { /* private mode */ } }
  nav(href, inPlace);   // the chat tab: /chat = the last conversation (the keyboard waits for a tap)
});

// ---------- the chat opens / closes: its tab lights up ----------
const cx = document.getElementById('cx');
// (closed with its box still focused, the keyboard would stay "up" for us and keep the bar away: the box lets go)
if (cx) new MutationObserver(() => {
  if (!chatOpen() && cx.contains(document.activeElement)) document.activeElement.blur();
  kbCheck();
  paint();
}).observe(cx, { attributes: true, attributeFilter: ['class'] });

// ---------- the keyboard is up: the bar steps aside (and comes back when it goes down) ----------
// a real keyboard = a text field focused AND the visible area shrunk well below its tallest (iPhone shrinks only the visual
// viewport; Android may shrink the window too - so against the tallest seen, reset when the phone turns)
const coarse = matchMedia('(pointer: coarse)');
const vv = window.visualViewport;
let tallest = vv ? vv.height : innerHeight;
addEventListener('orientationchange', () => { tallest = 0; setTimeout(() => { tallest = vv ? vv.height : innerHeight; kbCheck(); }, 400); });
function kbCheck() {
  const f = document.activeElement;
  const typing = !!(f && f.matches && f.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable="true"]'));
  const h = vv ? vv.height : innerHeight;
  if (!typing || h > tallest) tallest = Math.max(tallest, h);
  const kb = typing && coarse.matches && !!vv && tallest - h > 120;
  if (kb !== html.classList.contains('kb')) { html.classList.toggle('kb', kb); requestAnimationFrame(tbChanged); if (kb) toBottom(); }
  fitDock();
}
// the chat tab while typing: it fills exactly what the keyboard leaves visible (iPhone shrinks only the visual viewport -
// a fixed bottom:0 would sit under the keyboard), the box right on top of the keyboard
function fitDock() {
  if (!cx) return;
  if (cx.classList.contains('dock') && html.classList.contains('kb') && vv) {
    cx.style.top = vv.offsetTop + 'px'; cx.style.height = vv.height + 'px'; cx.style.bottom = 'auto';
  } else if (cx.style.height) { cx.style.top = cx.style.height = cx.style.bottom = ''; }
}
function toBottom() { const m = cx && cx.classList.contains('dock') && cx.querySelector('.msgs'); if (m) requestAnimationFrame(() => { m.scrollTop = m.scrollHeight; }); }
addEventListener('focusin', kbCheck);
vv?.addEventListener('resize', kbCheck);
vv?.addEventListener('scroll', fitDock);
addEventListener('focusout', () => setTimeout(kbCheck, 0));

// ---------- a game's full screen, a phone turned into a computer-wide window ----------
new MutationObserver((list) => {
  for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('vp')) { new MutationObserver(() => requestAnimationFrame(tbChanged)).observe(n, { attributes: true, attributeFilter: ['class'] }); requestAnimationFrame(paint); }
  requestAnimationFrame(tbChanged);
}).observe(document.body, { childList: true });
phone.addEventListener?.('change', () => requestAnimationFrame(tbChanged));

// the send comet lights only for real text - a field of spaces stays dim (sending ignores it)
document.addEventListener('input', (e) => { const ta = e.target; if (ta.tagName === 'TEXTAREA' && ta.closest('.cx .composer')) ta.closest('.composer').classList.toggle('blank', !ta.value.trim()); }, true);

applyFlag();
onState(applyFlag);
paint();
