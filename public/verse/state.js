// Who is here: the Google account, the fan's profile (name, photo, who they follow), their saves and their bell - live
// from Firestore. Anything a fan does that needs an account goes through needFan(), which opens the sign-in sheet
// (mockup A) and, the first time, the "your name in the verse" screen (mockup B).
import { auth, db, A, F, call } from './fb.js';
import { T } from './copy.js';
import { I, esc, sheet, av, inApp, track, toast } from './ui.js';
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
export const signedIn = () => !!(st.user && st.fan && st.fan.nick);

// before anything that needs an account: true when the fan is in (signed in + has a name), false if they walked away
export async function needFan(why, char) {
  if (signedIn()) return true;
  if (!st.user && !(await signInSheet(why, char))) return false;
  await until(() => st.user && st.ready);
  if (!st.fan || !st.fan.nick) return nameScreen();
  return true;
}

// ---------- A: the sign-in sheet ----------
export function signInSheet(why, char) {
  return new Promise((resolve) => {
    const c = char && C[char];
    const face = c ? `<div class="vx-hero-face">${av({ char, ring: true })}</div>` : `<div class="vx-hero-face">${av({ planet: true })}</div>`;
    const icons = [I.user, I.bell, I.save];
    const body = inApp()
      ? `<p class="vx-sub" style="margin-top:6px">${esc(T.signinInApp)}</p>
         <button class="vx-btn glass block" data-copy>${I.copy}${esc(T.signinCopy)}</button>`
      : `<button class="vx-btn white block" data-google>${I.google}${esc(T.signinGoogle)}</button>
         <p class="vx-small">${esc(T.signinSmall)}</p>`;
    let done = false;
    const h = sheet(`<div class="in" style="text-align:center">
        ${face}
        <h2 class="vx-h">${esc(T.signinTitle(c && c.name))}</h2>
        ${why && !c ? `<p class="vx-sub" style="margin:0">${esc(why)}</p>` : ''}
        <div class="vx-reasons">${T.signinReasons.map((r, i) => `<div><span class="vx-round">${icons[i]}</span><span>${esc(r)}</span></div>`).join('')}</div>
        ${body}
      </div>`, { cls: 'signin', onClose: () => { if (!done) resolve(false); } });
    const google = h.el.querySelector('[data-google]');
    if (google) google.onclick = async () => {
      google.disabled = true;
      try {
        const provider = new A.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const r = await A.signInWithPopup(auth, provider);
        const isNew = A.getAdditionalUserInfo(r)?.isNewUser;
        track('sign_in', isNew ? 'new' : 'back');
        done = true; h.close('ok'); resolve(true);
      } catch (e) {
        google.disabled = false;
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') { A.signInWithRedirect(auth, new A.GoogleAuthProvider()); return; }
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast(T.signinFailed);
      }
    };
    const copy = h.el.querySelector('[data-copy]');
    if (copy) copy.onclick = () => { navigator.clipboard?.writeText(location.href); toast(T.linkCopied); };
  });
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
  if (!(await needFan(C[char] ? T.why.follow(C[char].name) : '', char))) return false;
  const was = st.follows.has(char);
  if (on === was) return true;
  // the screen moves at once; Firestore confirms
  if (on) st.follows.add(char); else st.follows.delete(char);
  emit();
  try { await call('follow', { char, on }); if (on) track('follow', char); return true; }
  catch (e) { if (was) st.follows.add(char); else st.follows.delete(char); emit(); toast(T.errGeneric); return false; }
}
export async function save(videoId) {
  if (!(await needFan(T.why.save))) return;
  const on = !st.saves.has(videoId);
  if (on) st.saves.set(videoId, Date.now()); else st.saves.delete(videoId);
  emit();
  toast(on ? T.savedToast : T.unsavedToast);
  try { await call('save', { videoId, on }); if (on) track('save', videoId); }
  catch (e) { toast(T.errGeneric); }
}
