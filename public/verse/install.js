// The Shlomiverse on the home screen (his ask, 2026-11-03: "saving it on the home screen with our icon is super nice
// and I want people to know how to do it ... do it nicely, not a patch"; mockups scripts/v2-design/install.mjs).
// Three parts, one look:
//   - the invite: offered at a good moment - a video watched to its end (or 20 s and closed), a game played, a second
//     visit - never on arrival. A drawn home screen with the real icon and a notification from the character they just
//     watched. Android with an install prompt: one tap installs. "לא עכשיו" = two weeks of quiet; installed = never again.
//   - the guide: the page dims, an arrow points at the real button of THIS browser (Safari's share at the bottom,
//     Chrome's at the top of the address bar, Instagram / TikTok's ⋯ - their built-in browsers can't add to the home
//     screen, so step one there is opening the page in the phone's browser) and one card shows the three steps.
//   - the same steps on /install (verse/push.js installPage) and an icon in the phone footer.
import { T } from './copy.js';
import { I, esc, sheet, toast, track, isIOS, isAndroid, standalone, av } from './ui.js';
import { enablePush, pushState } from './push.js';

// ---------- where we are ----------
const ua = navigator.userAgent;
const mirrored = /^(he|ar|fa|ur)/i.test(navigator.language || '');   // Android mirrors Chrome's ⋮ to the left in Hebrew
export function env() {
  const ios = isIOS(), android = isAndroid();
  const inapp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Bytedance|Line\/|Snapchat|LinkedInApp/i.test(ua);
  const browser = inapp ? 'inapp' : ios ? (/CriOS/.test(ua) ? 'chrome' : /FxiOS|EdgiOS|OPiOS/.test(ua) ? 'other' : 'safari') : android ? 'chrome' : 'desktop';
  return { ios, android, phone: ios || android, inapp, browser, os: ios ? 'ios' : android ? 'android' : 'desktop' };
}
const A = () => T.app;
function stepsOf(e) {
  if (e.ios) return { safari: A().stepsSafari, chrome: A().stepsChromeIos, other: A().stepsOtherIos, inapp: A().stepsInappIos }[e.browser] || A().stepsSafari;
  return e.inapp ? A().stepsInappAndroid : A().stepsAndroid;
}
// where the button is, outside the page: the arrow's corner
function arrowAt(e) {
  if (e.ios) return { safari: 'bottom', other: 'bottom', chrome: 'top-right', inapp: 'top-right' }[e.browser] || 'bottom';
  return mirrored ? 'top-left' : 'top-right';
}

// ---------- the little drawings (the steps' pictures) ----------
const ring = (style) => `<span class="ig-ring" style="${style}"></span>`;
const bar = (url, right, ringAt) => `<div class="ig-pic"><div class="ig-url ig-url-row"><span>${url}</span>${right}</div>${ring(ringAt)}</div>`;
export const pic = {
  iosShare: `<div class="ig-pic"><div class="ig-url">shlomiverse.com</div>
    <div class="ig-bar">${I.back.replace('m9 6', 'm15 6').replace('6 6-6 6', '-6 6 6 6')}<span style="opacity:.35">${I.back}</span>${I.safariShare}<span>${I.copy}</span><span>${I.addSquare}</span></div>
    ${ring('bottom:2px;left:calc(50% - 23px)')}</div>`,
  chromeBar: bar('shlomiverse.com', `<i class="ig-ico">${I.safariShare}</i>`, 'top:calc(50% - 23px);right:8px'),
  inappBar: bar('shlomiverse.com', `<i class="ig-ico ig-dots h">${I.dots}</i>`, 'top:calc(50% - 23px);right:8px'),
  menuBar: `<div class="ig-pic"><div class="ig-url" style="inset-inline-end:44px">shlomiverse.com</div><span style="position:absolute;top:22px;right:12px;width:24px;height:24px;color:#333">${I.dots}</span>
    ${ring('top:12px;right:1px')}</div>`,
  sheet: (rows, hl) => `<div class="ig-pic dark"><div class="ig-sheet">${rows.map(([t, ic], i) => `<div class="${i === hl ? 'hl' : ''}"><span>${t}</span>${ic}</div>`).join('')}</div></div>`,
  home: `<div class="ig-pic"><div class="ig-home"><span class="a1"></span><span class="a2"></span><span class="me"><img src="/verse/icon-192.png" alt="שלומיוורס"><b>שלומיוורס</b></span><span class="a3"></span><span class="a4"></span><span class="a5"></span><span class="a6"></span><span class="a7"></span></div></div>`,
};
const shareSheet = () => pic.sheet([['העתקה', I.copy], ['הוספה לרשימת הקריאה', I.comment], ['הוספה למסך הבית', I.addSquare], ['סימון', I.edit]], 2);
const openSheet = (chrome) => pic.sheet([['העתקה', I.copy], [chrome ? 'פתיחה ב-Chrome' : 'פתיחה בדפדפן', I.out], ['דיווח', I.bug]], 1);
const androidSheet = () => pic.sheet([['כרטיסייה חדשה', I.plus], ['היסטוריה', I.comment], ['הוספה למסך הבית', I.install], ['הגדרות', I.edit]], 2);
function picsOf(e) {
  if (e.ios) return { safari: [pic.iosShare, shareSheet(), pic.home], chrome: [pic.chromeBar, shareSheet(), pic.home], other: [pic.menuBar, shareSheet(), pic.home], inapp: [pic.inappBar, openSheet(false), shareSheet()] }[e.browser];
  return e.inapp ? [pic.menuBar, openSheet(true), androidSheet()] : [pic.menuBar, androidSheet(), pic.home];
}
// the three steps as cards (the guide and /install)
export function stepsHtml(e = env()) {
  const pics = picsOf(e);
  return stepsOf(e).map(([h, p], i) => `<div class="ig-step"><div><div class="n">${i + 1}</div><h3>${esc(h)}</h3>${p ? `<p>${esc(p)}</p>` : ''}</div>${pics[i]}</div>`).join('');
}

// the notifications part: the same cards, for iPhone (only from the icon) or Android (right away in the browser)
const permPic = () => pic.sheet([[A().permAsk, I.bell], [A().permNo, ''], [A().permYes, I.check]], 2);
const btnPic = () => pic.sheet([[T.pushOn, I.bell]], 0);
export function pushStepsHtml(os = env().os) {
  const steps = os === 'ios' ? A().pushStepsIos : A().pushStepsAndroid, pics = os === 'ios' ? [pic.home, btnPic(), permPic()] : [btnPic(), permPic()];
  return steps.map(([h, p], i) => `<div class="ig-step"><div><div class="n">${i + 1}</div><h3>${esc(h)}</h3>${p ? `<p>${esc(p)}</p>` : ''}</div>${pics[i]}</div>`).join('');
}

// ---------- remembering ----------
const KEY = 'vx-app';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (x) { return {}; } };
const keep = (o) => { try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...o })); } catch (x) {} };
let installEvent = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
addEventListener('appinstalled', () => { keep({ installed: true }); installEvent = null; toast(A().installedToast); track('app_install', 'installed'); });
export const canInstallNow = () => !!installEvent;
export async function installNow() {
  if (!installEvent) return false;
  installEvent.prompt();
  const r = await installEvent.userChoice.catch(() => ({ outcome: 'dismissed' }));
  installEvent = null;
  track('app_install', r.outcome);
  if (r.outcome === 'accepted') keep({ installed: true });
  return r.outcome === 'accepted';
}

// ---------- the invite ----------
function canOffer() {
  if (!env().phone || standalone()) return false;
  const s = load();
  if (s.installed || (s.later && Date.now() - s.later < 14 * 864e5)) return false;
  try { if (sessionStorage.getItem('vx-app-asked')) return false; } catch (x) {}
  return !document.querySelector('.vx-sheet, .st, .ac, .vp');   // never over a video, a game, a sheet, the stories
}
// a good moment just happened: offer once the page is calm
export function appMoment(kind, char) {
  if (!canOffer()) return;
  setTimeout(() => { if (canOffer()) invite(kind, char); }, kind === 'visit' ? 0 : 900);
}
function invite(kind, char) {
  try { sessionStorage.setItem('vx-app-asked', '1'); } catch (x) {}
  keep({ offered: Date.now() });
  track('app_offer', kind);
  const who = (char && C[char]) || (W.characters || []).find((c) => c.img) || null;
  const e = env(), one = e.android && !e.inapp && canInstallNow();
  const h = sheet(`<div class="ap">
    <h2>${esc(A().inviteTitle)}</h2><p class="ap-line">${esc(A().inviteLine)}</p>
    <div class="ap-phone"><div class="ap-screen">
      <div class="ap-status"><b>9:41</b><i></i></div>
      <div class="ap-apps"><span class="ap-me"><img src="/verse/icon-192.png" alt=""><b>שלומיוורס</b></span><span class="ap-t t1"></span><span class="ap-t t2"></span><span class="ap-t t3"></span></div>
      <div class="ap-notif"><img src="/verse/icon-192.png" alt=""><span><b>שלומיוורס</b><span>${esc(A().notifNew.replace('{name}', who ? who.name : 'חני פרידמן'))}</span></span><small>${esc(T.now)}</small></div>
    </div></div>
    <button class="vx-btn main block" data-app-yes>${esc(one ? A().inviteInstall : A().inviteYes)}</button>
    <button class="vx-link" data-app-later>${esc(A().inviteLater)}</button></div>`, { cls: 'ap-sheet', x: false });
  h.el.addEventListener('click', async (ev) => {
    if (ev.target.closest('[data-app-yes]')) {
      track('app_yes', e.browser);
      h.close('yes');
      if (one) { if (!(await installNow())) setTimeout(() => coach(), 300); }
      else setTimeout(() => coach(), 250);
    } else if (ev.target.closest('[data-app-later]')) {
      keep({ later: Date.now() });
      track('app_later', kind);
      h.close('later');
    }
  });
}

// ---------- the guide: the arrow at the real button + the three steps ----------
export function coach() {
  if (document.querySelector('.ac')) return;
  const e = env();
  if (!e.phone || standalone()) { nav('/install'); return; }
  const el = document.createElement('div');
  el.className = `ac at-${arrowAt(e)}`;
  el.innerHTML = `<div class="ac-arrow"><svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 108C30 60 60 34 104 18"/><path d="M76 14l28 4-6 28"/></svg><i class="ac-ring"></i></div>
    <div class="ac-card" role="dialog" aria-modal="true"><img class="ac-icon" src="/verse/icon-192.png" alt="">
      <h2>${esc(e.inapp ? A().coachTitleInapp : A().coachTitle)}</h2>
      <div class="ac-steps">${stepsHtml(e)}</div>
      <button class="vx-btn main block" data-ac-got>${esc(A().coachGot)}</button></div>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('on'));
  const close = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', (ev) => { if (ev.target === el || ev.target.closest('[data-ac-got]')) close(); });
  track('app_guide', e.browser);
}

// ---------- the first moments inside the app: the one place an iPhone can say yes to notifications ----------
// Opened from the icon and notifications never asked: a welcome with one button. "אחר כך" = three days of quiet.
function welcomeOk() {
  if (!standalone() || pushState() !== 'default') return false;
  const s = load();
  if (s.welcomeLater && Date.now() - s.welcomeLater < 3 * 864e5) return false;
  try { if (sessionStorage.getItem('vx-app-welcome')) return false; } catch (x) {}
  return !document.querySelector('.vx-sheet, .st, .ac, .vp');
}
function welcome() {
  try { sessionStorage.setItem('vx-app-welcome', '1'); } catch (x) {}
  track('app_welcome', env().os);
  const who = (W.characters || []).find((c) => c.img) || null;
  const h = sheet(`<div class="ap">
    <h2>${esc(A().welcomeTitle)}</h2><p class="ap-line">${esc(A().welcomeLine)}</p>
    <div class="ap-phone"><div class="ap-screen">
      <div class="ap-status"><b>9:41</b><i></i></div>
      <div class="ap-notif"><img src="/verse/icon-192.png" alt=""><span><b>שלומיוורס</b><span>${esc(A().notifNew.replace('{name}', who ? who.name : 'חני פרידמן'))}</span></span><small>${esc(T.now)}</small></div>
      <div class="ap-apps"><span class="ap-me"><img src="/verse/icon-192.png" alt=""><b>שלומיוורס</b></span><span class="ap-t t1"></span><span class="ap-t t2"></span><span class="ap-t t3"></span></div>
    </div></div>
    <button class="vx-btn main block" data-welcome-yes>${I.bell}${esc(A().welcomeYes)}</button>
    <button class="vx-link" data-welcome-later>${esc(A().welcomeLater)}</button></div>`, { cls: 'ap-sheet', x: false });
  h.el.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-welcome-yes]')) { track('app_welcome_yes', env().os); h.close('yes'); enablePush(); }
    else if (ev.target.closest('[data-welcome-later]')) { keep({ welcomeLater: Date.now() }); track('app_welcome_later', env().os); h.close('later'); }
  });
}

// ---------- on every page ----------
export function appBoot() {
  if (standalone()) {
    keep({ installed: true });
    const tryWelcome = (n) => setTimeout(() => { if (welcomeOk()) welcome(); else if (n > 0 && standalone() && pushState() === 'default') tryWelcome(n - 1); }, n === 3 ? 2500 : 8000);
    tryWelcome(3);
  }
  const e = env();
  document.documentElement.classList.toggle('can-app', e.phone && !standalone() && !load().installed);
  // a second visit, on another day: once the person has been on the home for a moment
  const today = new Date().toISOString().slice(0, 10), s = load(), days = (s.days || []).filter((d) => d !== today).slice(-5);
  keep({ days: [...days, today] });
  if (days.length >= 1) setTimeout(() => { if (location.pathname === '/') appMoment('visit'); }, 25000);
}
// the footer icon on a phone (and any [data-app] button) opens the guide right away
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-app]');
  if (!b) return;
  ev.preventDefault();
  if (env().android && canInstallNow()) installNow(); else coach();
}, true);
