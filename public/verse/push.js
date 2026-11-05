// Push: the service worker at the site's root (/sw.js), turning notifications on, the card after a follow (mockup C)
// and the home-screen guide (mockup D, #/install). iPhone: push works only from the home-screen icon (iOS 16.4+), so
// there the button leads to the guide instead.
import { call, VAPID } from './fb.js';
import { T } from './copy.js';
import { I, esc, card, av, toast, track, isIOS, isAndroid, standalone } from './ui.js';
import { st, onState, needFan } from './state.js';
import { env, stepsHtml, pushStepsHtml, canInstallNow, installNow } from './install.js';

export const swReady = 'serviceWorker' in navigator
  ? navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => { console.error('sw', e); return null; })
  : Promise.resolve(null);

// 'granted' | 'default' | 'denied' | 'ios' (needs the home-screen icon first) | 'unsupported'
export function pushState() {
  if (isIOS() && !standalone()) return 'ios';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

const key = (b64) => { const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
async function subscribe() {
  const reg = await swReady;
  if (!reg) throw new Error('no sw');
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID) }));
  await call('pushSub', { sub: sub.toJSON(), ua: navigator.userAgent.slice(0, 120) });
  return sub;
}

export async function enablePush() {
  const s = pushState();
  if (s === 'ios') { if (location.pathname !== '/install') nav('/install'); else document.querySelector('.ig-part:nth-of-type(2)')?.scrollIntoView({ behavior: 'smooth' }); track('push_optin', 'guide'); return false; }
  if (s === 'unsupported') { toast(T.pushUnsupported); return false; }
  if (!(await needFan('push'))) return false;
  const perm = s === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') { toast(T.pushDenied, 4000); track('push_optin', 'denied'); emitPush(); return false; }
  try { await subscribe(); track('push_optin', 'ok'); toast(T.pushDone); emitPush(); return true; }
  catch (e) { console.error('push', e); toast(T.errGeneric); return false; }
}
const pushSubs = new Set();
export const onPush = (fn) => pushSubs.add(fn);
const emitPush = () => pushSubs.forEach((fn) => fn(pushState()));

// a device that already allowed push is tied to whoever signs in on it
let boundTo = null;
onState(async () => {
  const uid = st.user && st.fan && st.fan.nick ? st.user.uid : null;
  if (!uid || uid === boundTo || pushState() !== 'granted') return;
  boundTo = uid;
  try { const reg = await swReady; if (reg && (await reg.pushManager.getSubscription())) await subscribe(); } catch (e) { console.error('push rebind', e); }
});

// ---------- C: after a follow, offer notifications (not again for 3 days after "maybe later") ----------
export function offerPush(char) {
  const s = pushState();
  if (s === 'granted' || s === 'denied' || s === 'unsupported') return;
  try { if (Date.now() - (+localStorage.getItem('vx-push-later') || 0) < 3 * 864e5) return; } catch (e) {}
  const c = C[char];
  const latest = c && c.videos && V[c.videos[0]];
  const h = card(`<div class="vx-hero-face">${av({ char, ring: true })}<span class="ok">${I.check}</span></div>
    <p class="vx-muted" style="margin-top:16px">${esc(T.pushFollowing(c ? c.name : ''))}</p>
    <h2 class="vx-h" style="margin-top:4px">${esc(T.pushTitle(c && c.name))}</h2>
    <div class="vx-notif"><span class="ic">${I.planet}</span><span style="flex:1"><b>השלומיוורס</b><span>${esc(T.pushPreviewNew(c ? c.name : '', latest ? latest.title : '…'))}</span></span><small>${esc(T.now)}</small></div>
    <button class="vx-btn main block" data-on>${esc(s === 'ios' ? T.pushIos : T.pushOn)}</button>
    <button class="vx-link" data-vx-close data-later>${esc(T.pushLater)}</button>`, { x: false });
  h.el.querySelector('[data-on]').onclick = () => { h.close('on'); enablePush(); };
  h.el.querySelector('[data-later]').onclick = () => { try { localStorage.setItem('vx-push-later', Date.now()); } catch (e) {} };
}

// ---------- D: the home-screen guide (the steps and drawings live in verse/install.js, shared with the guide overlay) ----------
export function installPage(q = {}) {
  const here = env(), tab = q.os || here.os;
  // the steps of this browser on its own phone; another tab = that phone's usual browser
  const e = tab === here.os ? here : { ...here, ios: tab === 'ios', android: tab === 'android', inapp: false, browser: tab === 'ios' ? 'safari' : 'chrome', os: tab };
  const s = pushState(), A = T.app, mine = tab === here.os;
  const part = (n, title, done) => `<h2 class="ig-part"><span>${n}</span>${esc(title)}${done ? `<i>${I.check}</i>` : ''}</h2>`;
  const okRow = (text, btn = '') => `<div class="ig-ok${btn ? ' col' : ''}"><span class="vx-round" style="color:var(--vx-accent);background:var(--card2)">${I.bell}</span><p>${esc(text)}</p>${btn}</div>`;
  const onBtn = `<button class="vx-btn main small" data-push-on>${I.bell}${esc(T.pushOn)}</button>`;
  // part 2 on the phone you hold: done / blocked / a button that works now / (iPhone in the browser) the steps after the icon
  const push2 = () => {
    if (mine && s === 'granted') return okRow(A.part2Done);
    if (mine && s === 'denied') return okRow(A.part2Denied);
    if (tab === 'ios') return (mine && standalone() ? okRow(A.whatYouGet, onBtn) : `<p class="ig-note">${esc(A.iosOnlyFromIcon)}</p>`) + pushStepsHtml('ios');
    return (mine && s === 'default' ? okRow(A.whatYouGet, onBtn) : '') + pushStepsHtml('android');
  };
  let body;
  if (standalone()) body = part(1, A.part1Done, true) + part(2, A.part2, mine && s === 'granted') + push2();
  else if (tab === 'desktop') body = `<div class="ig-ok"><p>${esc(T.igDesktop)}</p></div>${s === 'default' ? okRow(T.pushTitle(), onBtn) : s === 'granted' ? okRow(A.part2Done) : ''}${canInstallNow() ? `<div class="ig-ok"><p>${esc(T.igInstall)}</p><button class="vx-btn glass small light-ok" data-install>${esc(T.igInstall)}</button></div>` : ''}`;
  else body = part(1, A.part1)
    + (tab === 'android' && canInstallNow() && !e.inapp ? `<div class="ig-ok"><p>${esc(A.inviteLine)}</p><button class="vx-btn main small" data-install>${esc(A.inviteInstall)}</button></div>` : '')
    + (e.inapp ? `<div class="ig-ok"><p>${esc(A.coachTitleInapp)}</p></div>` : '') + stepsHtml(e)
    + part(2, A.part2, mine && s === 'granted') + push2();
  // a way back at the top: inside the home-screen app there's no browser back button
  return `<div class="ig"><button class="pg-back" data-ig-back>${I.back}${esc(T.app.back)}</button><h1>${esc(T.app.pageTitle)}</h1><p>${esc(T.app.pageSub)}</p>
    ${body}
    <a class="vx-btn glass block light-ok" href="/" style="margin-top:22px;color:var(--text);background:var(--card);border-color:var(--line)">${esc(T.igGot)}</a>
    ${standalone() ? '' : `<div class="ig-tabs">${['ios', 'android', 'desktop'].filter((k) => k !== tab).map((k) => `<a href="/install?os=${k}">${esc(T.igTabs[k])}</a>`).join('<span>·</span>')}</div>`}</div>`;
}
const START_LEN = history.length;
document.addEventListener('click', async (e) => {
  // back to the page they came from inside the site (the history grew since the site opened), else home
  if (e.target.closest('[data-ig-back]')) { e.preventDefault(); if (history.length > START_LEN || document.referrer.startsWith(location.origin)) history.back(); else nav('/'); return; }
  if (e.target.closest('[data-push-on]')) { e.preventDefault(); if (await enablePush()) window.dispatchEvent(new Event('popstate')); }
  if (e.target.closest('[data-install]') && canInstallNow()) { e.preventDefault(); await installNow(); window.dispatchEvent(new Event('popstate')); }
});
