// Who is here: the Google account, the fan's profile (name, photo, who they follow), their saves and their bell - live
// from Firestore. Anything a fan does that needs an account goes through needFan(), which opens the sign-in sheet
// (mockup A) and, the first time, the "your name in the verse" screen (mockup B).
import { auth, db, A, F, call } from './fb.js';
import { T } from './copy.js';
import { I, esc, sheet, av, inApp, track, toast, catchphrase, openOutside, brand } from './ui.js';
import { pickAndCrop } from './crop.js';

export const st = { user: null, fan: null, follows: new Set(), saves: new Map(), notes: [], unread: 0, ready: false };
const subs = new Set();
export const onState = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => { remember(); subs.forEach((fn) => { try { fn(st); } catch (e) { console.error(e); } }); };
// who was signed in last time on this device: the page draws the signed-in look at once instead of flashing the
// signed-out one while Firebase wakes up (the wiki page reads the same key before any of this loads)
const ME = 'vx-me';
export const cachedMe = () => { try { return JSON.parse(localStorage.getItem(ME) || 'null'); } catch (e) { return null; } };
function remember() {
  try {
    if (st.user && st.fan && st.fan.nick) localStorage.setItem(ME, JSON.stringify({ nick: st.fan.nick, photo: st.fan.photo || null }));
    else if (st.ready && !st.user) localStorage.removeItem(ME);
  } catch (e) { /* private mode */ }
}

let live = [];
A.onAuthStateChanged(auth, (user) => {
  live.forEach((u) => u());
  live = [];
  Object.assign(st, { user, fan: null, follows: new Set(), saves: new Map(), notes: [], unread: 0, ready: !user });
  emit();
  if (!user) return;
  live.push(F.onSnapshot(F.doc(db, 'fans', user.uid), (snap) => {
    st.fan = snap.exists() ? snap.data() : null;
    st.follows = new Set(st.fan?.follows || []);
    st.ready = true;
    emit();
  }, (e) => { console.error('fan', e); st.ready = true; emit(); }));
  live.push(F.onSnapshot(F.collection(db, 'fans', user.uid, 'saves'), (snap) => {
    st.saves = new Map(snap.docs.map((d) => [d.id, d.data().t?.toMillis?.() || Date.now()]));
    emit();
  }, (e) => console.error('saves', e)));
  live.push(F.onSnapshot(F.query(F.collection(db, 'fans', user.uid, 'notes'), F.orderBy('t', 'desc'), F.limit(80)), (snap) => {
    st.notes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    st.unread = st.notes.filter((n) => !n.read).length;
    emit();
  }, (e) => console.error('notes', e)));
});

const until = (test) => new Promise((resolve) => { if (test()) return resolve(); const off = onState(() => { if (test()) { off(); resolve(); } }); });
// arrived from "open in browser" (ui.js openOutside): the sign-in sheet again, for what they were doing there
const wanted = new URLSearchParams(location.search).get('signin');
if (wanted) {
  const u = new URL(location.href); u.searchParams.delete('signin'); history.replaceState(null, '', u.pathname + u.search + u.hash);
  until(() => st.ready).then(() => { if (!st.user) setTimeout(() => needFan(wanted), 800); });
}
export const signedIn = () => !!(st.user && st.fan && st.fan.nick);

// before anything that needs an account: true when the fan is in (signed in + has a name), false if they walked away.
// `key` = what they pressed (T.gain: the sheet talks about that reward); `opt.img` = the sticker's frame, shown as the sticker
export async function needFan(key, char, opt = {}) {
  if (signedIn()) return true;
  if (!st.user && !(await signInSheet(key, char, opt))) return false;
  await until(() => st.user && st.ready);
  if (!st.fan || !st.fan.nick) return nameScreen();
  return true;
}

// ---------- A: the sign-in sheet (his note 2026-11-02: it has to read as a benefit - mockup golive/Y-signin-sticker) ----------
// a benefit row's icon, from what it promises
const rowIcon = (r) => /מורידים|הורדה/.test(r) ? I.download : /סטיקר/.test(r) ? I.sticker : /התראה|התראות/.test(r) ? I.bell : /סרטונים וסטוריז|סטוריז/.test(r) ? I.play
  : /שמרתם|שומרים/.test(r) ? I.save : /בשם/.test(r) ? I.user : /הודעות|תגובה|תגובות|@/.test(r) ? I.comment : /רעיון|מצביעים|קולות/.test(r) ? I.plus
  : /שלומי/.test(r) ? I.mail : /עוקבים|לעקוב/.test(r) ? I.bell : I.check;
export function signInSheet(key, char, opt = {}) {
  return new Promise((resolve) => {
    const c = char && C[char];
    const g = T.gain[key] || T.gain.default;
    const fill = (x) => x.replace(/\{name\}/g, c ? c.name : '');
    const face = opt.img
      ? opt.cut   // a finished die-cut sticker (the pack): shown as it is
        ? `<div class="vx-gain-st cut"><img src="${esc(opt.img)}" alt=""></div>`
        : `<div class="vx-gain-st"><span><img src="${esc(opt.img)}" alt="">${char && catchphrase(char) ? `<em>${esc(catchphrase(char))}</em>` : ''}</span></div>`
      : '';
    // everything but a sticker opens with Miriam's residency counter on top (his ask, 2026-11-06: "I like this image so much")
    const art = !opt.img;
    if (!opt.google) {   // opt.google = they came from the email sheet's "prefer Google?" - already counted
      track('signin_ask', inApp() ? 'inapp' : 'browser');   // how many reach the sign-in, and how many of them can't (in-app browser)
      track('signin_from', key || 'default');                // and what brought them there (backstage: which ask works)
    }
    // inside Instagram / TikTok / Facebook's own browser Google refuses to sign in: Miriam's counter, email + a code
    if (inApp() && MAIL_SIGNIN && !opt.google) return mailSheet(key, resolve);
    const body = inApp()
      ? `<p class="vx-sub" style="margin-top:6px">${esc(T.signinInApp)}</p>
         <button class="vx-btn white block" data-out>${esc(T.signinOut)}</button>
         <button class="vx-link" data-copy>${esc(T.signinCopy)}</button>
         ${MAIL_SIGNIN ? `<button class="vx-link si-mail" data-mail>${esc(T.mail.back)}</button>` : ''}`
      : `<button class="vx-btn white block" data-google>${I.google}${esc(T.signinGoogle)}</button>
         ${MAIL_SIGNIN ? `<button class="vx-link si-mail" data-mail>${esc(T.signinMail)}</button>` : `<p class="vx-small">${esc(T.signinSmall)}</p>`}`;
    let done = false;
    const h = sheet(`${art ? '<div class="ms-art"><img src="/verse/art/miriam-counter.jpg" alt=""></div>' : ''}<div class="in si-in" style="text-align:center">
        ${face}
        <h2 class="vx-h">${brand(fill(g.title))}</h2>
        ${inApp() ? '' : `<p class="vx-sub vx-gain-sub">${brand(fill(g.sub))}</p>`}
        <div class="vx-reasons">${g.rows.map((r, i) => `<div class="${i ? '' : 'hl'}"><span class="vx-round">${rowIcon(r)}</span><span>${esc(fill(r))}</span></div>`).join('')}<div class="more"><span class="vx-round">${I.plus}</span><span>${esc(T.gainMore)}</span></div></div>
        ${body}
      </div>`, { cls: art ? 'signin art' : 'signin', onClose: () => { if (!done) resolve(false); } });
    const out = h.el.querySelector('[data-out]');
    // the jump out works on Android and on iPhone with iOS 17+; when nothing happened, say what to do instead of nothing
    if (out) out.onclick = () => { openOutside(key); setTimeout(() => { if (document.visibilityState === 'visible') toast(T.signinOutFail); }, 1600); };
    const copy = h.el.querySelector('[data-copy]');
    if (copy) copy.onclick = () => { navigator.clipboard?.writeText(location.href); toast(T.linkCopied); };
    // whoever became a resident by email inside Instagram signs in here the same way (his point, 2026-11-06)
    const mail = h.el.querySelector('[data-mail]');
    if (mail) mail.onclick = () => { done = true; h.close('mail'); mailSheet(key, resolve); };
    const google = h.el.querySelector('[data-google]');
    if (google) google.onclick = async () => {
      google.disabled = true;
      try {
        const provider = new A.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const r = await A.signInWithPopup(auth, provider);
        const isNew = A.getAdditionalUserInfo(r)?.isNewUser;
        track('sign_in', isNew ? 'new' : 'back');
        if (isNew) { track('joined', key || 'default'); track('join_via', 'google'); }
        done = true; h.close('ok'); resolve(true);
      } catch (e) {
        google.disabled = false;
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') { A.signInWithRedirect(auth, new A.GoogleAuthProvider()); return; }
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast(T.signinFailed);
      }
    };
  });
}

// the email way (createCustomToken needs "Service Account Token Creator" on the functions' own service account - granted
// 2026-11-06); false = the old "open in browser" sheet in the apps and no "או עם מייל" link
const MAIL_SIGNIN = true;
// ---------- A2: residency by email, inside the apps' own browsers (2026-11-06, mockups conversion/S1-email, S2-code) ----------
// Miriam's counter: an email, a 6-digit code from verse.js (emailCode / emailIn), and the code opens the account - the
// same one a Google sign-in with that address has. "Open in the browser" stays, small, for whoever prefers Google.
function mailSheet(key, resolve) {
  let done = false, email = '';
  const h = sheet(`<div class="ms-art"><img src="/verse/art/miriam-counter.jpg" alt=""></div><div class="in ms-in"></div>`,
    { cls: 'signin mail', onClose: () => { if (!done) resolve(false); } });
  const box = h.el.querySelector('.ms-in');
  const busy = (b, on, label) => { b.disabled = on; b.innerHTML = on ? '<span class="vx-spin"></span>' : esc(label); };
  const err = (code) => T.mail.err[code] || T.mail.err.other;
  const step1 = () => {
    box.innerHTML = `<h2 class="vx-h">${esc(T.mail.title)}</h2><p class="vx-sub">${esc(T.mail.line)}</p>
      <form class="ms-form"><input class="vx-field" type="email" inputmode="email" autocomplete="email" dir="ltr" required
        placeholder="${esc(T.mail.placeholder)}" value="${esc(email)}">
      <p class="ms-err" role="alert"></p>
      <button class="vx-btn main block">${esc(T.mail.send)}</button></form>
      <p class="vx-small">${esc(T.mail.small)}</p>
      <button class="vx-link ms-out" type="button">${esc(T.mail.google)}</button>`;
    const f = box.querySelector('form'), input = f.querySelector('input'), b = f.querySelector('button'), e = f.querySelector('.ms-err');
    setTimeout(() => input.focus(), 250);
    // "prefer Google?": the Google sheet, which says why Google needs the phone's browser and takes them there (his note:
    // it must do something - before, the jump out failed silently on older iPhones and on a computer)
    box.querySelector('.ms-out').onclick = () => { done = true; h.close('google'); signInSheet(key, null, { google: true }).then(resolve); };
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      email = input.value.trim().toLowerCase();
      e.textContent = '';
      busy(b, true);
      try { await call('emailCode', { email }); track('email_code', 'sent'); step2(); }
      catch (x) { busy(b, false, T.mail.send); e.textContent = err(x.code); track('email_code', x.code || 'fail'); }
    };
  };
  const step2 = () => {
    box.innerHTML = `<h2 class="vx-h">${esc(T.mail.title2)}</h2><p class="vx-sub">${esc(T.mail.sent)} <b dir="ltr">${esc(email)}</b></p>
      <form class="ms-form"><input class="vx-field ms-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr"
        pattern="[0-9]*" placeholder="······" required>
      <p class="ms-err" role="alert"></p>
      <button class="vx-btn main block">${esc(T.mail.confirm)}</button></form>
      <div class="ms-again"><button class="vx-link" type="button" data-again>${esc(T.mail.again)}</button>
      <button class="vx-link" type="button" data-other>${esc(T.mail.other)}</button></div>`;
    const f = box.querySelector('form'), input = f.querySelector('input'), b = f.querySelector('button'), e = f.querySelector('.ms-err');
    setTimeout(() => input.focus(), 250);
    input.oninput = () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); if (input.value.length === 6) f.requestSubmit(); };
    box.querySelector('[data-other]').onclick = step1;
    box.querySelector('[data-again]').onclick = async (ev) => {
      ev.target.disabled = true;
      try { await call('emailCode', { email }); toast(T.mail.resent); } catch (x) { e.textContent = err(x.code); }
      setTimeout(() => { ev.target.disabled = false; }, 20000);
    };
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      if (b.disabled) return;
      e.textContent = '';
      busy(b, true);
      try {
        const r = await call('emailIn', { email, code: input.value });
        await A.signInWithCustomToken(auth, r.token);
        track('email_code', 'ok');
        track('sign_in', r.isNew ? 'new' : 'back');
        if (r.isNew) { track('joined', key || 'default'); track('join_via', 'email'); }
        done = true; h.close('ok'); resolve(true);
      } catch (x) {
        busy(b, false, T.mail.confirm);
        e.textContent = err(x.code); input.select();
        track('email_code', x.code || 'fail');
      }
    };
  };
  step1();
}

// ---------- B: your name in the verse (first sign-in; also "edit my name") ----------
export function nameScreen() {
  return new Promise((resolve) => {
    const photo = st.user?.photoURL || null; // the Google one
    // their face: 'keep' (what they have), 'upload' (cropped here), 'google' or 'none'
    let mode = st.fan?.photo ? 'keep' : 'none', upload = null;
    const ideas = [...T.nickIdeas].sort(() => Math.random() - 0.5).slice(0, 3);
    const first = st.fan?.nick || (st.user?.displayName || '').split(' ')[0] || '';
    const el = document.createElement('div');
    el.className = 'nk';
    // behind the card (desktop): a dim wall of the characters' faces, like the hero; on the phone the card is the screen
    const faces = (typeof heroFaces === 'function' ? heroFaces() : []).slice(0, 18);
    el.innerHTML = `<div class="nk-wall" aria-hidden="true">${faces.map((c) => `<img src="/wiki/${esc(c.img)}" alt="" loading="lazy">`).join('')}</div>
      <div class="nk-card">
      <img class="nk-logo" src="/verse/logo-160.png" alt="שלומיוורס">
      <h1 class="vx-h nk-h">${esc(T.nickTitle)}</h1>
      <p class="vx-sub">${esc(T.nickSub)}</p>
      <div class="big-av" id="nk-av"></div>
      <div class="nk-ph"><button type="button" class="vx-pill" id="nk-up">${I.camera}<span>${esc(T.photoUpload)}</span></button>
        ${photo ? `<button type="button" class="vx-pill" id="nk-g">${I.google}<span>${esc(T.photoGoogle)}</span></button>` : ''}</div>
      <form id="nk-form" style="margin-top:18px">
        <input class="vx-field" id="nk-in" maxlength="24" autocomplete="nickname" placeholder="${esc(T.nickPlaceholder)}" value="${esc(first)}">
        <div class="chips2">${ideas.map((x) => `<button type="button" class="vx-pill" data-idea="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        <p class="vx-small" id="nk-err" style="color:#ffb199;min-height:1.4em"></p>
      </form>
      <div class="grow"></div>
      <button class="vx-btn main block" id="nk-go">${esc(T.nickGo)}</button>
      ${st.fan ? `<button class="vx-link" id="nk-cancel">ביטול</button>` : ''}
      </div>
      <p class="nk-tag">${esc(T.tagline)}</p>`;
    document.body.append(el);
    const input = el.querySelector('#nk-in');
    const shown = () => ({ keep: st.fan?.photo, upload, google: photo, none: null }[mode]);
    const draw = () => {
      const src = shown();
      el.querySelector('#nk-av').innerHTML = `<button type="button" class="nk-face" aria-label="${esc(T.photoUpload)}">${src ? `<img class="vx-av" src="${esc(src)}" alt="">` : `<span class="vx-av">${I.person}</span>`}<span class="nk-cam">${I.camera}</span></button>
        ${src ? `<button type="button" class="nk-del" aria-label="${esc(T.photoNone)}">${I.x}</button>` : ''}`;
      el.querySelector('.nk-face').onclick = choose;
      el.querySelector('.nk-del')?.addEventListener('click', () => { mode = 'none'; draw(); });
      el.querySelector('#nk-up').classList.toggle('on', mode === 'upload');
      el.querySelector('#nk-g')?.classList.toggle('on', mode === 'google');
    };
    const choose = async () => { const d = await pickAndCrop(); if (d) { upload = d; mode = 'upload'; draw(); } };
    draw();
    el.querySelector('#nk-up').onclick = choose;
    el.querySelector('#nk-g')?.addEventListener('click', () => { mode = mode === 'google' ? 'none' : 'google'; draw(); });
    el.querySelectorAll('[data-idea]').forEach((b) => (b.onclick = () => { input.value = b.dataset.idea; input.focus(); }));
    const go = async (e) => {
      e?.preventDefault();
      const nick = input.value.trim();
      const err = el.querySelector('#nk-err');
      if (nick.length < 2) { err.textContent = T.nickShort; return; }
      const btn = el.querySelector('#nk-go');
      btn.disabled = true;
      btn.innerHTML = '<span class="vx-spin"></span>';
      try {
        await call('profile', { nick, usePhoto: mode === 'google', keepPhoto: mode === 'keep', photoData: mode === 'upload' ? upload.split(',')[1] : undefined });
        await until(() => st.fan && st.fan.nick === nick);
        el.remove();
        emit(); // the page behind skipped its redraws while this screen was up (home turns into "your verse" now)
        resolve(true);
      } catch (x) {
        btn.disabled = false;
        btn.textContent = T.nickGo;
        err.textContent = x.code === 'nick_bad' ? T.nickBad : x.code === 'nick_short' ? T.nickShort : /^photo_bad/.test(x.code) ? T.photoBad : T.errGeneric;
        if (/^photo_bad/.test(x.code)) { mode = 'none'; upload = null; draw(); }
      }
    };
    el.querySelector('#nk-form').onsubmit = go;
    el.querySelector('#nk-go').onclick = go;
    el.querySelector('#nk-cancel')?.addEventListener('click', () => { el.remove(); emit(); resolve(false); });
    setTimeout(() => input.focus(), 50);
  });
}

export const signOut = () => A.signOut(auth);

// ---------- follow / save: one place each ----------
export async function follow(char, on = true) {
  if (!(await needFan('follow', char))) return false;
  const was = st.follows.has(char);
  if (on === was) return true;
  // the screen moves at once; Firestore confirms
  if (on) st.follows.add(char); else st.follows.delete(char);
  emit();
  try { await call('follow', { char, on }); if (on) track('follow', char); return true; }
  catch (e) { if (was) st.follows.add(char); else st.follows.delete(char); emit(); toast(T.errGeneric); return false; }
}
export async function save(videoId, why = 'save') {
  if (!(await needFan(why))) return;
  const on = !st.saves.has(videoId);
  if (on) st.saves.set(videoId, Date.now()); else st.saves.delete(videoId);
  emit();
  toast(on ? T.savedToast : T.unsavedToast);
  try { await call('save', { videoId, on }); if (on) track('save', videoId); }
  catch (e) { toast(T.errGeneric); }
}
