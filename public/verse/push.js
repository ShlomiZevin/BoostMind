// Push: the service worker at the site's root (/sw.js), turning notifications on, the card after a follow (mockup C)
// and the home-screen guide (mockup D, #/install). iPhone: push works only from the home-screen icon (iOS 16.4+), so
// there the button leads to the guide instead.
import { call, VAPID } from './fb.js';
import { T } from './copy.js';
import { I, esc, card, av, toast, track, isIOS, isAndroid, standalone } from './ui.js';
import { st, onState, needFan } from './state.js';

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
  if (s === 'ios') { location.hash = '#/install'; track('push_optin', 'guide'); return false; }
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

// ---------- D: the home-screen guide ----------
let installEvent = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });

const pic = {
  iosShare: `<div class="ig-pic"><div class="ig-url">shlomiverse.com</div>
    <div class="ig-bar">${I.back.replace('m9 6', 'm15 6').replace('6 6-6 6', '-6 6 6 6')}<span style="opacity:.35">${I.back}</span>${I.safariShare}<span>${I.copy}</span><span>${I.addSquare}</span></div>
    <span class="ig-ring" style="bottom:2px;left:calc(50% - 23px)"></span></div>`,
  iosSheet: `<div class="ig-pic dark"><div class="ig-sheet"><div><span>העתקה</span>${I.copy}</div><div><span>הוספה לרשימת הקריאה</span>${I.comment}</div>
    <div class="hl"><span>הוספה למסך הבית</span>${I.addSquare}</div><div><span>סימון</span>${I.edit}</div></div></div>`,
  home: `<div class="ig-pic"><div class="ig-home"><span class="a1"></span><span class="a2"></span><span class="me"><img src="/verse/icon-192.png" alt="שלומיוורס"><b>שלומיוורס</b></span><span class="a3"></span><span class="a4"></span><span class="a5"></span><span class="a6"></span><span class="a7"></span></div></div>`,
  androidMenu: `<div class="ig-pic"><div class="ig-url" style="inset-inline-end:44px">shlomiverse.com</div><span style="position:absolute;top:22px;right:12px;width:24px;height:24px;color:#333">${I.dots}</span>
    <span class="ig-ring" style="top:12px;right:1px"></span></div>`,
  androidSheet: `<div class="ig-pic dark"><div class="ig-sheet"><div><span>כרטיסייה חדשה</span>${I.plus}</div><div><span>היסטוריה</span>${I.comment}</div>
    <div class="hl"><span>הוספה למסך הבית</span>${I.install}</div><div><span>הגדרות</span>${I.edit}</div></div></div>`,
};

export function installPage(q = {}) {
  const tab = q.os || (isIOS() ? 'ios' : isAndroid() ? 'android' : 'desktop');
  const steps = (list, pics) => list.map(([h, p], i) => `<div class="ig-step"><div><div class="n">${i + 1}</div><h3>${esc(h)}</h3>${p ? `<p>${esc(p)}</p>` : ''}</div>${pics[i]}</div>`).join('');
  const s = pushState();
  const pushRow = `<div class="ig-ok"><span class="vx-round" style="color:var(--vx-accent);background:var(--card2)">${I.bell}</span>
    <p>${esc(s === 'granted' ? T.pushDone : T.pushTitle())}</p>${s === 'granted' ? '' : `<button class="vx-btn main small" data-push-on>${esc(T.pushOn)}</button>`}</div>`;
  let body;
  if (standalone()) body = `<div class="ig-ok"><p>${esc(T.igStandalone)}</p></div>${pushRow}`;
  else if (tab === 'ios') body = steps(T.igIos, [pic.iosShare, pic.iosSheet, pic.home]) + `<p class="vx-small" style="color:var(--faint)">${esc(T.igIosNote)}</p>`;
  else if (tab === 'android') body = (installEvent ? `<div class="ig-ok"><p>${esc(T.igSub)}</p><button class="vx-btn main small" data-install>${esc(T.igInstall)}</button></div>` : '') + steps(T.igAndroid, [pic.androidMenu, pic.androidSheet, pic.home]) + pushRow;
  else body = `<div class="ig-ok"><p>${esc(T.igDesktop)}</p></div>${pushRow}${installEvent ? `<div class="ig-ok"><p>${esc(T.igInstall)}</p><button class="vx-btn glass small light-ok" data-install>${esc(T.igInstall)}</button></div>` : ''}`;
  return `<div class="ig"><h1>${esc(T.igTitle)}</h1><p>${esc(T.igSub)}</p>
    ${body}
    <a class="vx-btn glass block light-ok" href="#/" style="margin-top:22px;color:var(--text);background:var(--card);border-color:var(--line)">${esc(T.igGot)}</a>
    ${standalone() ? '' : `<div class="ig-tabs">${['ios', 'android', 'desktop'].filter((k) => k !== tab).map((k) => `<a href="#/install?os=${k}">${esc(T.igTabs[k])}</a>`).join('<span>·</span>')}</div>`}</div>`;
}
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-push-on]')) { e.preventDefault(); if (await enablePush()) window.dispatchEvent(new Event('hashchange')); }
  if (e.target.closest('[data-install]') && installEvent) { e.preventDefault(); installEvent.prompt(); const r = await installEvent.userChoice; installEvent = null; track('push_optin', 'install_' + r.outcome); }
});
