// Vault: one password vault shared by all your devices.
// Master password -> PBKDF2-SHA256 (600k rounds) -> AES-256-GCM key, in the
// browser. Firestore (vaults/{uid}, owner-only rules) and localStorage (offline
// copy) only ever hold the ciphertext; the master password never leaves the page.
import {
  initializeApp, getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  initializeFirestore, memoryLocalCache, doc, getDoc, onSnapshot, runTransaction, serverTimestamp,
} from './firebase.js';

const VAULT_KEY = 'vault.v1';       // offline copy of the encrypted vault
const META_KEY = 'vault.meta';      // { owner: uid, pending: bool }
const UNMERGED_KEY = 'vault.v1.unmerged';
const THEME_KEY = 'vault.theme';
const ITERATIONS = 600000;
const IDLE_MS = 5 * 60 * 1000;
const CLIPBOARD_MS = 30 * 1000;
const CLOUD_WAIT_MS = 8000;

const fbApp = initializeApp({
  apiKey: 'AIzaSyB90ncysHNU-fqHfe9dEudVR2sweXQGM90',
  authDomain: 'boostmind-b052c.firebaseapp.com',
  projectId: 'boostmind-b052c',
  appId: '1:463727469066:web:fe01da10c04d395d55f5f3',
});
const auth = getAuth(fbApp);
const db = initializeFirestore(fbApp, { localCache: memoryLocalCache() });

const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- local storage ----------
function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key, val) { localStorage.setItem(key, val); } // let it throw: a failed vault save must be visible
function lsDel(key) { try { localStorage.removeItem(key); } catch {} }
function readJSON(key) { try { return JSON.parse(lsGet(key)); } catch { return null; } }
function readMeta() { return readJSON(META_KEY) || {}; }
function writeMeta(patch) { try { localStorage.setItem(META_KEY, JSON.stringify({ ...readMeta(), ...patch })); } catch {} }

// The offline copy, if it belongs to this account (or predates sign-in).
function localBlob() {
  const blob = readJSON(VAULT_KEY);
  if (!isVaultBlob(blob)) return null;
  const owner = readMeta().owner;
  return !owner || (user && owner === user.uid) ? blob : null;
}

// ---------- crypto ----------
function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function seal(key, salt, iterations, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data))));
  return {
    format: 'boostmind-vault', v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations },
    salt: b64(salt), iv: b64(iv), ct: b64(ct),
  };
}

// The ciphertext of {"entries":[]}: an empty vault, recognisable without the key
function isEmptyBlob(b) {
  return unb64(b.ct).length === 16 + enc.encode(JSON.stringify({ entries: [] })).length;
}

function isVaultBlob(b) {
  return !!(b && b.format === 'boostmind-vault' && b.v === 1 && b.kdf && b.salt && b.iv && b.ct);
}

async function decryptWith(key, blob) {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
    return JSON.parse(dec.decode(plain));
  } catch {
    throw new Error('bad-password');
  }
}

// Returns { key, salt, iterations, data } or throws 'bad-password'.
async function openBlob(blob, password) {
  const salt = unb64(blob.salt);
  const key = await deriveKey(password, salt, blob.kdf.iterations);
  return { key, salt, iterations: blob.kdf.iterations, data: await decryptWith(key, blob) };
}

// ---------- entries ----------
// A deleted login stays as { id, deleted, updatedAt } so the deletion syncs too.
function mergeEntries(a, b) {
  const byId = new Map(a.map((x) => [x.id, x]));
  for (const x of b) {
    const mine = byId.get(x.id);
    if (!mine || (x.updatedAt || 0) > (mine.updatedAt || 0)) byId.set(x.id, x);
  }
  return [...byId.values()];
}
const live = (entries) => entries.filter((x) => !x.deleted);
const sameEntries = (a, b) => {
  const key = (list) => JSON.stringify(list.map((x) => x.id + ':' + x.updatedAt).sort());
  return key(a) === key(b);
};

// ---------- password generator ----------
function randomInt(n) {
  const limit = Math.floor(0x100000000 / n) * n; // rejection sampling: no modulo bias
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % n;
}
function generatePassword(length, symbols) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789'];
  if (symbols) sets.push('!@#$%^&*-_=+?');
  const all = sets.join('');
  const chars = sets.map((s) => s[randomInt(s.length)]); // at least one of each kind
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function strengthBits(pw) {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 20;
  const unique = new Set(pw).size;
  return Math.round(Math.min(pw.length, unique * 1.5) * Math.log2(pool || 1));
}

// ---------- state ----------
let user = null;      // Firebase user
let cloud = null;     // { exists: true|false|null (unknown, offline), blob }
let session = null;   // { key, salt, iterations, entries } while unlocked
let lastSeenCt = null; // ciphertext of the cloud version this device has merged
let unsubscribe = null;
let pushing = null;
let pushAgain = false;
let pendingRemote = null; // a cloud change that arrived mid-push; handled right after
let idleTimer = null;
let clipTimer = null;
let lastActive = Date.now();
let clipAt = 0;
const openIds = new Set();

const vaultRef = () => doc(db, 'vaults', user.uid);

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

async function loadCloud() {
  try {
    const snap = await withTimeout(getDoc(vaultRef()), CLOUD_WAIT_MS);
    const blob = snap.exists() ? snap.data().blob : null;
    cloud = { exists: isVaultBlob(blob), blob };
  } catch (err) {
    if (err && err.code === 'permission-denied') throw err;
    cloud = { exists: null, blob: null }; // offline: work from the local copy
  }
}

function saveLocal(blob) {
  lsSet(VAULT_KEY, JSON.stringify(blob));
  writeMeta({ owner: user.uid });
}

// ---------- sync ----------
function setSync(state) {
  const el = $('sync-status');
  el.dataset.state = state;
  el.textContent = { synced: 'Synced', saving: 'Saving...', offline: 'Offline · will sync', error: 'Not synced' }[state];
}

// Writes this device's entries to the cloud, merging whatever another device
// saved in between. A transaction needs the network, so offline edits wait
// (marked pending) and go up when the connection is back.
async function push(rekey) {
  if (!session || !user) return;
  if (pushing) {
    if (!rekey) { pushAgain = true; return pushing; }
    await pushing.catch(() => {});
  }
  setSync('saving');
  writeMeta({ pending: true });
  const current = session;
  pushing = (async () => {
    try {
      const target = rekey || current;
      const result = await runTransaction(db, async (tx) => {
        const snap = await tx.get(vaultRef());
        let entries = current.entries;
        const remote = snap.exists() ? snap.data().blob : null;
        if (isVaultBlob(remote) && remote.ct !== lastSeenCt) {
          if (remote.salt === b64(current.salt)) entries = mergeEntries(entries, (await decryptWith(current.key, remote)).entries || []);
          else if (!isEmptyBlob(remote)) throw new Error('key-changed'); // an empty vault may be replaced
        }
        const blob = await seal(target.key, target.salt, target.iterations, { entries });
        tx.set(vaultRef(), { blob, updatedAt: serverTimestamp() });
        return { entries, blob };
      });
      if (session !== current) return; // locked meanwhile
      if (rekey) session = { ...rekey, entries: result.entries };
      else session.entries = mergeEntries(result.entries, session.entries);
      lastSeenCt = result.blob.ct;
      cloud = { exists: true, blob: result.blob };
      saveLocal(result.blob);
      writeMeta({ pending: false });
      setSync('synced');
      render();
    } catch (err) {
      if (err.message === 'key-changed') return masterChangedElsewhere();
      if (rekey) throw err;
      setSync(navigator.onLine === false || /offline|unavailable|timeout/i.test(err.code + err.message) ? 'offline' : 'error');
    } finally {
      pushing = null;
    }
    const remote = pendingRemote;
    pendingRemote = null;
    if (remote && session) await handleRemote(remote);
    if (pushAgain && session) { pushAgain = false; await push(); }
  })();
  return pushing;
}

function startSync() {
  stopSync();
  unsubscribe = onSnapshot(vaultRef(), (snap) => {
    if (!session || snap.metadata.hasPendingWrites || !snap.exists()) return;
    const remote = snap.data().blob;
    if (!isVaultBlob(remote)) return;
    // Mid-push this may be our own write echoing back; look at it once the push settles.
    if (pushing) { pendingRemote = remote; return; }
    handleRemote(remote);
  }, () => setSync('offline'));
}

// Another device saved: merge its version into this one.
async function handleRemote(remote) {
  if (remote.ct === lastSeenCt) return;
  if (remote.salt !== b64(session.salt)) { cloud = { exists: true, blob: remote }; return masterChangedElsewhere(); }
  const current = session;
  let incoming;
  try { incoming = (await decryptWith(current.key, remote)).entries || []; } catch { return; }
  if (session !== current) return;
  const merged = mergeEntries(current.entries, incoming);
  current.entries = merged;
  lastSeenCt = remote.ct;
  cloud = { exists: true, blob: remote };
  if (sameEntries(merged, incoming)) {
    saveLocal(remote);
    if (!pushing) setSync('synced');
  } else {
    push(); // this device has changes the cloud is missing
  }
  render();
}

function stopSync() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
}

function masterChangedElsewhere() {
  lock();
  showError('unlock-error', 'The master password was changed on another device. Unlock with the new one.');
}

window.addEventListener('online', () => { if (session && readMeta().pending) push(); });

// Seal the change on this device right away, then send it to the cloud.
async function persist() {
  const blob = await seal(session.key, session.salt, session.iterations, { entries: session.entries });
  try {
    saveLocal(blob);
  } catch (err) {
    toast('Could not save: browser storage is full or blocked');
    throw err;
  }
  push();
}

// ---------- lock / idle ----------
function lock() {
  session = null;
  lastSeenCt = null;
  stopSync();
  openIds.clear();
  clearTimeout(idleTimer);
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  $('list').replaceChildren();
  $('search').value = '';
  $('menu').hidden = true;
  showScreen();
}

function bumpIdle() {
  if (!session) return;
  lastActive = Date.now();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { lock(); toast('Locked after 5 minutes idle'); }, IDLE_MS);
}
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
  document.addEventListener(ev, bumpIdle, { passive: true }));

// Phones freeze timers in the background, so check again when the app comes back.
function onReturn() {
  if (document.visibilityState !== 'visible') return;
  if (session && Date.now() - lastActive > IDLE_MS) { lock(); toast('Locked after 5 minutes idle'); }
  if (clipAt && Date.now() - clipAt > CLIPBOARD_MS) clearClipboard();
}
document.addEventListener('visibilitychange', onReturn);
window.addEventListener('focus', onReturn);
window.addEventListener('pageshow', onReturn);

// ---------- screens ----------
const SCREENS = ['loading', 'signin', 'setup', 'unlock', 'main'];

function currentScreen() {
  if (!user) return 'signin';
  if (session) return 'main';
  if (cloud && cloud.exists) return 'unlock';
  if (localBlob()) return 'unlock';
  if (cloud && cloud.exists === false) return 'setup';
  return 'loading'; // offline and nothing on this device yet
}

function showScreen(name = currentScreen()) {
  const before = SCREENS.find((s) => !$('screen-' + s).hidden);
  SCREENS.forEach((s) => { $('screen-' + s).hidden = s !== name; });
  document.querySelectorAll('[data-account]').forEach((n) => { n.textContent = user ? user.email || 'Signed in' : ''; });
  if (name === before && (name === 'setup' || name === 'unlock')) return; // keep what's typed
  if (name === 'loading') {
    $('loading-text').textContent = "You're offline and this device has no copy of the vault yet. Connect to the internet once to load it.";
    $('loading-retry').hidden = false;
  } else if (name === 'setup') {
    $('setup-pw').value = '';
    $('setup-pw2').value = '';
    $('setup-error').hidden = true;
    updateMeter();
    $('setup-pw').focus();
  } else if (name === 'unlock') {
    $('unlock-pw').value = '';
    $('unlock-error').hidden = true;
    $('unlock-lead').textContent = cloud && cloud.exists === null
      ? "Offline: opening this device's copy. Changes sync when you're back online."
      : readStash().length
        ? 'Logins saved earlier on this device are kept safe. Enter the master password you created them with.'
        : 'Enter your master password.';
    $('unlock-pw').focus();
  } else if (name === 'main') {
    render();
    bumpIdle();
  }
}

function updateMeter() {
  const pw = $('setup-pw').value;
  const bits = strengthBits(pw);
  const bar = $('setup-meter');
  const label = $('setup-meter-label');
  if (!pw) {
    bar.style.width = '0';
    label.textContent = 'At least 10 characters. A long phrase beats a short tricky word.';
    return;
  }
  bar.style.width = Math.min(100, Math.round((bits / 90) * 100)) + '%';
  let color = 'var(--danger)', text = 'Weak';
  if (pw.length >= 10 && bits >= 60) { color = 'var(--warn)'; text = 'OK'; }
  if (pw.length >= 12 && bits >= 75) { color = 'var(--ok)'; text = 'Strong'; }
  bar.style.background = color;
  label.textContent = text + (pw.length < 10 ? ' · needs ' + (10 - pw.length) + ' more characters' : '');
}

function showError(id, msg) { const el = $(id); el.textContent = msg; el.hidden = false; }

function busy(btn, on, text) {
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = text; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}

// ---------- sign in ----------
$('signin-btn').addEventListener('click', async () => {
  const btn = $('signin-btn');
  $('signin-error').hidden = true;
  busy(btn, true, 'Signing in...');
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      showError('signin-error', 'Sign-in failed: ' + (err.code || err.message));
    }
  } finally {
    busy(btn, false);
  }
});

async function signOutHere() {
  lock();
  await signOut(auth);
}
document.querySelectorAll('[data-signout]').forEach((b) => b.addEventListener('click', signOutHere));

onAuthStateChanged(auth, async (u) => {
  user = u;
  if (!u) { cloud = null; session = null; stopSync(); return showScreen(); }
  showScreen('loading');
  $('loading-text').textContent = 'Opening...';
  $('loading-retry').hidden = true;
  try {
    await loadCloud();
  } catch (err) {
    $('loading-text').textContent = 'Could not open the vault: ' + (err.code || err.message);
    $('loading-retry').hidden = false;
    return;
  }
  showScreen();
});

$('loading-retry').addEventListener('click', async () => {
  if (!user) return showScreen();
  $('loading-text').textContent = 'Opening...';
  $('loading-retry').hidden = true;
  try { await loadCloud(); } catch {}
  showScreen();
});

// ---------- create / unlock ----------
$('setup-pw').addEventListener('input', updateMeter);

$('form-setup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = $('setup-pw').value;
  if (pw.length < 10) return showError('setup-error', 'Use at least 10 characters.');
  if (pw !== $('setup-pw2').value) return showError('setup-error', 'The two passwords are not the same.');
  const btn = e.submitter || $('form-setup').querySelector('button[type=submit]');
  busy(btn, true, 'Creating...');
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(pw, salt, ITERATIONS);
    await startSession({ key, salt, iterations: ITERATIONS, entries: [] }, true);
  } catch (err) {
    session = null;
    showError('setup-error', 'Could not create the vault: ' + err.message);
  } finally {
    busy(btn, false);
  }
});

async function startSession(s, needsPush) {
  session = s;
  askPersistentStorage();
  showScreen();
  startSync();
  if (needsPush) return persist();
  if (cloud && cloud.exists) writeMeta({ pending: false });
  setSync(cloud && cloud.exists === null ? 'offline' : 'synced');
}

// Logins on this device the cloud may not have: a vault from before sync,
// edits made offline, or a vault put aside because its password differed.
function readStash() {
  const s = readJSON(UNMERGED_KEY);
  return (Array.isArray(s) ? s : [s]).filter(isVaultBlob);
}
function writeStash(list) {
  if (list.length) lsSet(UNMERGED_KEY, JSON.stringify(list)); else lsDel(UNMERGED_KEY);
}
function deviceCopies() {
  const meta = readMeta();
  const local = localBlob();
  const synced = cloud.exists && local && local.ct === cloud.blob.ct;
  const copies = local && !synced && (meta.pending || !meta.owner || !cloud.exists) ? [local] : [];
  return copies.concat(readStash());
}

$('form-unlock').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('unlock-btn');
  const pw = $('unlock-pw').value;
  $('unlock-error').hidden = true;
  busy(btn, true, 'Unlocking...');
  try {
    await loadCloud(); // the newest version, in case another device changed it
    const copies = deviceCopies();
    let base = null;
    if (cloud.exists) {
      try {
        base = await openBlob(cloud.blob, pw);
        lastSeenCt = cloud.blob.ct;
      } catch (err) {
        // An empty cloud vault under another password gives way to the logins on this device
        if (!isEmptyBlob(cloud.blob)) throw err;
      }
    }
    const opened = [], locked = [];
    for (const c of copies) {
      try { opened.push(base && c.salt === cloud.blob.salt ? { data: await decryptWith(base.key, c) } : await openBlob(c, pw)); }
      catch { locked.push(c); }
    }
    const cloudEntries = base ? base.data.entries || [] : null;
    if (!base) {
      if (!opened.length) throw new Error('bad-password');
      opened.sort((x, y) => live(y.data.entries || []).length - live(x.data.entries || []).length);
      base = opened.shift(); // the fullest copy becomes the vault
    }
    let entries = base.data.entries || [];
    for (const o of opened) entries = mergeEntries(entries, o.data.entries || []);
    writeStash(locked); // before the local copy is overwritten
    const needsPush = !cloudEntries || !sameEntries(entries, cloudEntries);
    if (!needsPush) saveLocal(cloud.blob);
    await startSession({ key: base.key, salt: base.salt, iterations: base.iterations, entries }, needsPush);
    updateStashUI();
  } catch (err) {
    showError('unlock-error', err.message === 'bad-password' ? 'Wrong master password.' : 'Could not open the vault: ' + err.message);
    $('unlock-pw').select();
  } finally {
    busy(btn, false);
  }
});

// Menu: bring in logins this device kept aside, with the password they were made with.
async function mergeStash() {
  const stash = readStash();
  if (!stash.length || !session) return;
  let found = [];
  const ok = await passDialog({
    title: 'Bring in earlier logins',
    lead: 'This device kept logins from before, locked with a different master password. Enter that password and they join your vault.',
    label: 'Their master password',
    check: async ({ current }) => {
      found = [];
      for (const b of stash) { try { found.push([b, (await openBlob(b, current)).data.entries || []]); } catch {} }
      if (found.length) return true;
      showError('pass-error', 'That password does not open them.');
      return false;
    },
  });
  if (!ok || !session) return;
  const before = live(session.entries).length;
  if (!(await change(found.reduce((all, [, list]) => mergeEntries(all, list), session.entries)))) return;
  writeStash(stash.filter((b) => !found.some(([f]) => f === b)));
  updateStashUI();
  render();
  toast((live(session.entries).length - before) + ' logins brought in');
}

function updateStashUI() {
  const n = readStash().length;
  $('stash-banner').hidden = !(n && session);
  document.querySelector('[data-act=stash]').hidden = !n;
}

function askPersistentStorage() {
  // Asks the browser not to evict the offline copy when disk space runs low.
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}
}

// ---------- list ----------
const AVATAR_COLORS = ['#4f8cff', '#3ecf8e', '#f5a623', '#e5484d', '#8e4ec6', '#12a594', '#d6409f', '#0090ff', '#e54d2e', '#30a46c'];
function avatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function safeUrl(raw) {
  if (!raw) return null;
  let s = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u : null;
  } catch { return null; }
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function button(label, cls, onClick, title) {
  const b = el('button', 'btn ' + (cls || ''), label);
  b.type = 'button';
  if (title) { b.title = title; b.setAttribute('aria-label', title); }
  b.addEventListener('click', onClick);
  return b;
}

function matches(entry, q) {
  if (!q) return true;
  return [entry.name, entry.url, entry.username, entry.notes].some((f) => f && f.toLowerCase().includes(q));
}

function render() {
  if (!session || $('screen-main').hidden) return;
  const q = $('search').value.trim().toLowerCase();
  const all = live(session.entries).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const shown = all.filter((e) => matches(e, q));
  $('list').replaceChildren(...shown.map(renderItem));
  $('empty').hidden = all.length > 0;
  $('no-results').hidden = all.length === 0 || shown.length > 0;
  $('list-count').textContent = all.length
    ? (q ? shown.length + ' of ' + all.length : all.length + (all.length === 1 ? ' login' : ' logins'))
    : '';
}

function renderItem(entry) {
  const item = el('article', 'item');
  const isOpen = openIds.has(entry.id);
  if (isOpen) item.classList.add('open');

  const head = el('div', 'item-head');
  const toggle = el('button', 'item-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', String(isOpen));
  const av = el('span', 'avatar', (entry.name.trim()[0] || '?').toUpperCase());
  av.style.background = avatarColor(entry.name);
  const main = el('span', 'item-main');
  main.append(el('span', 'item-name', entry.name));
  const host = safeUrl(entry.url);
  main.append(el('span', 'item-sub', entry.username || (host ? host.hostname : '') || ' '));
  toggle.append(av, main);
  toggle.addEventListener('click', () => {
    if (openIds.has(entry.id)) openIds.delete(entry.id); else openIds.add(entry.id);
    render();
  });

  const quick = el('div', 'item-quick');
  if (entry.username) quick.append(button('User', 'small', () => copy(entry.username, 'Username'), 'Copy username'));
  if (entry.password) quick.append(button('Pass', 'small', () => copy(entry.password, 'Password'), 'Copy password'));
  head.append(toggle, quick);
  item.append(head);

  if (isOpen) {
    const body = el('div', 'item-body');
    if (entry.username) body.append(row('Username', entry.username, [button('Copy', 'small', () => copy(entry.username, 'Username'))]));
    if (entry.password) {
      const value = el('span', 'row-value mono', '•'.repeat(12));
      let shown = false;
      const reveal = button('Show', 'small', () => {
        shown = !shown;
        value.textContent = shown ? entry.password : '•'.repeat(12);
        reveal.textContent = shown ? 'Hide' : 'Show';
      });
      body.append(rowNode('Password', value, [reveal, button('Copy', 'small', () => copy(entry.password, 'Password'))]));
    }
    if (host) {
      const a = el('a', null, host.hostname + (host.pathname !== '/' ? host.pathname : ''));
      a.href = host.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      const v = el('span', 'row-value');
      v.append(a);
      body.append(rowNode('Website', v, []));
    } else if (entry.url) {
      body.append(row('Website', entry.url, []));
    }
    if (entry.notes) body.append(rowNode('Notes', el('span', 'row-value notes', entry.notes), []));
    const actions = el('div', 'item-actions');
    actions.append(el('span', 'meta', 'Updated ' + new Date(entry.updatedAt).toLocaleDateString()));
    actions.append(button('Edit', 'small', () => openEntryDialog(entry)));
    actions.append(button('Delete', 'small danger-text', () => confirmDelete(entry)));
    body.append(actions);
    item.append(body);
  }
  return item;
}

function row(label, text, btns) { return rowNode(label, el('span', 'row-value', text), btns); }
function rowNode(label, valueNode, btns) {
  const r = el('div', 'row');
  const b = el('div', 'row-btns');
  b.append(...btns);
  r.append(el('span', 'row-label', label), valueNode, b);
  return r;
}

$('search').addEventListener('input', render);

// ---------- clipboard ----------
async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    toast('Copy failed. Your browser blocked clipboard access.');
    return;
  }
  toast(what + ' copied. Clipboard clears in 30 s.');
  clipAt = Date.now();
  clearTimeout(clipTimer);
  clipTimer = setTimeout(clearClipboard, CLIPBOARD_MS);
}

// Browsers only allow this while the page has focus; if it fails, onReturn tries again.
function clearClipboard() {
  if (document.hasFocus && !document.hasFocus()) return;
  navigator.clipboard.writeText('').then(() => { clipAt = 0; }, () => {});
}

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// ---------- add / edit / delete ----------
let editing = null; // entry being edited, or null for new

function openEntryDialog(entry) {
  editing = entry || null;
  $('entry-title').textContent = entry ? 'Edit login' : 'Add login';
  $('e-name').value = entry ? entry.name : '';
  $('e-url').value = entry ? entry.url : '';
  $('e-user').value = entry ? entry.username : '';
  $('e-pass').value = entry ? entry.password : '';
  $('e-notes').value = entry ? entry.notes : '';
  $('e-pass').type = 'password';
  $('e-reveal').textContent = 'Show';
  $('dlg-entry').showModal();
  $('e-name').focus();
}

$('btn-add').addEventListener('click', () => openEntryDialog(null));
$('empty-add').addEventListener('click', () => openEntryDialog(null));

$('e-reveal').addEventListener('click', () => {
  const p = $('e-pass');
  p.type = p.type === 'password' ? 'text' : 'password';
  $('e-reveal').textContent = p.type === 'password' ? 'Show' : 'Hide';
});
$('e-gen').addEventListener('click', () => {
  $('e-pass').value = generatePassword(+$('g-len').value, $('g-sym').checked);
  $('e-pass').type = 'text';
  $('e-reveal').textContent = 'Hide';
});
$('g-len').addEventListener('input', () => { $('g-len-val').textContent = $('g-len').value; });

// Swap in a new entries list, sealed locally and synced; undone if the local save fails.
async function change(next) {
  const before = session.entries;
  session.entries = next;
  try { await persist(); return true; } catch { session.entries = before; return false; }
}

$('form-entry').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('e-name').value.trim();
  if (!name) return $('e-name').focus();
  const now = Date.now();
  const fields = {
    name,
    url: $('e-url').value.trim(),
    username: $('e-user').value.trim(),
    password: $('e-pass').value,
    notes: $('e-notes').value.trim(),
    updatedAt: now,
  };
  let next;
  if (editing) {
    next = session.entries.map((x) => (x.id === editing.id ? { ...x, ...fields } : x));
  } else {
    const id = b64(crypto.getRandomValues(new Uint8Array(9)));
    next = session.entries.concat({ id, createdAt: now, ...fields });
    openIds.add(id);
  }
  if (!(await change(next))) return;
  $('dlg-entry').close();
  toast(editing ? 'Saved' : 'Added ' + name);
  render();
});

function confirmDialog({ title, text, ok, typeWord }) {
  return new Promise((resolve) => {
    const dlg = $('dlg-confirm');
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    $('confirm-ok').textContent = ok;
    $('confirm-type-f').hidden = !typeWord;
    $('confirm-type').value = '';
    if (typeWord) $('confirm-type-l').textContent = 'Type ' + typeWord + ' to confirm';
    const done = () => {
      dlg.removeEventListener('close', done);
      resolve(dlg.returnValue === 'ok' && (!typeWord || $('confirm-type').value.trim().toUpperCase() === typeWord));
    };
    dlg.returnValue = '';
    dlg.addEventListener('close', done);
    dlg.showModal();
    if (typeWord) $('confirm-type').focus();
  });
}

async function confirmDelete(entry) {
  const ok = await confirmDialog({ title: 'Delete ' + entry.name + '?', text: 'This removes the login from the vault on all your devices.', ok: 'Delete' });
  if (!ok) return;
  const now = Date.now();
  if (!(await change(session.entries.map((x) => (x.id === entry.id ? { id: x.id, deleted: true, updatedAt: now } : x))))) return;
  openIds.delete(entry.id);
  toast('Deleted');
  render();
}

async function eraseVault() {
  const ok = await confirmDialog({
    title: 'Erase the vault?',
    text: 'Every saved login is deleted, from the cloud and from all your devices. Only a backup file can bring them back.',
    ok: 'Erase', typeWord: 'ERASE',
  });
  if (!ok) { if ($('dlg-confirm').returnValue === 'ok') toast('Not erased: the word did not match'); return; }
  try {
    // A transaction fails when offline instead of queueing the delete for later
    await withTimeout(runTransaction(db, async (tx) => { await tx.get(vaultRef()); tx.delete(vaultRef()); }), CLOUD_WAIT_MS);
  } catch (err) {
    toast('Could not reach the cloud, so nothing was erased. Try again online.');
    return;
  }
  lsDel(VAULT_KEY);
  lsDel(META_KEY);
  cloud = { exists: false, blob: null };
  lock();
  toast('Vault erased');
}
$('unlock-erase').addEventListener('click', eraseVault);

document.querySelectorAll('dialog [data-close]').forEach((b) =>
  b.addEventListener('click', () => b.closest('dialog').close('')));

// ---------- password prompt dialog (restore / change) ----------
// `check` validates the input; the dialog stays open until it returns true.
function passDialog({ title, lead, label, change: isChange, check }) {
  return new Promise((resolve) => {
    const dlg = $('dlg-pass');
    const form = $('form-pass');
    $('pass-title').textContent = title;
    $('pass-lead').textContent = lead;
    $('pass-l1').textContent = label;
    $('pass-f2').hidden = !isChange;
    $('pass-f3').hidden = !isChange;
    ['pass-1', 'pass-2', 'pass-3'].forEach((id) => { $(id).value = ''; });
    $('pass-error').hidden = true;
    const ok = $('pass-ok');
    ok.disabled = false;
    ok.textContent = 'OK';
    const cleanup = () => { dlg.removeEventListener('close', onClose); form.removeEventListener('submit', onSubmit); };
    const onClose = () => { cleanup(); resolve(false); };
    const onSubmit = async (e) => {
      e.preventDefault();
      $('pass-error').hidden = true;
      ok.disabled = true;
      ok.textContent = 'Checking...';
      let passed = false;
      try {
        passed = await check({ current: $('pass-1').value, next: $('pass-2').value, repeat: $('pass-3').value });
      } catch (err) {
        showError('pass-error', err.message);
      }
      ok.disabled = false;
      ok.textContent = 'OK';
      if (passed === true) { cleanup(); dlg.close('ok'); resolve(true); }
    };
    form.addEventListener('submit', onSubmit);
    dlg.addEventListener('close', onClose);
    dlg.returnValue = '';
    dlg.showModal();
    $('pass-1').focus();
  });
}

// ---------- backup files ----------
function downloadBackup() {
  const raw = lsGet(VAULT_KEY);
  if (!raw) return;
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const a = el('a');
  a.href = url;
  a.download = 'vault-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded. It is encrypted with your master password.');
}

function pickFile() {
  return new Promise((resolve) => {
    const input = $('file-input');
    input.value = '';
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

async function readBackupFile() {
  const file = await pickFile();
  if (!file) return null;
  try {
    const blob = JSON.parse(await file.text());
    if (isVaultBlob(blob)) return blob;
  } catch {}
  toast('That file is not a Vault backup');
  return null;
}

async function askBackupPassword(blob, title, lead) {
  let opened = null;
  const ok = await passDialog({
    title, lead, label: 'Master password of the backup',
    check: async ({ current }) => {
      try { opened = await openBlob(blob, current); return true; }
      catch { showError('pass-error', 'Wrong password for this backup.'); return false; }
    },
  });
  return ok ? opened : null;
}

// No vault yet: the backup becomes the vault.
$('setup-restore').addEventListener('click', async () => {
  const blob = await readBackupFile();
  if (!blob) return;
  const opened = await askBackupPassword(blob, 'Restore backup', 'Enter the master password that was used when this backup was made.');
  if (!opened) return;
  await startSession({ key: opened.key, salt: opened.salt, iterations: opened.iterations, entries: opened.data.entries || [] }, true);
  toast('Restored ' + live(session.entries).length + ' logins');
});

// Unlocked: merge a backup in (the newer edit of the same login wins).
async function importBackup() {
  const blob = await readBackupFile();
  if (!blob) return;
  const opened = await askBackupPassword(blob, 'Import a backup', 'Logins from the backup are merged into this vault.');
  if (!opened || !session) return;
  const before = live(session.entries).length;
  if (!(await change(mergeEntries(session.entries, opened.data.entries || [])))) return;
  render();
  toast((live(session.entries).length - before) + ' logins added');
}

async function changeMaster() {
  const ok = await passDialog({
    title: 'Change master password',
    lead: 'Your other devices will ask for the new password. Old backup files keep the old one.',
    label: 'Current master password', change: true,
    check: async ({ current, next, repeat }) => {
      if (next.length < 10) { showError('pass-error', 'The new password needs at least 10 characters.'); return false; }
      if (next !== repeat) { showError('pass-error', 'The new passwords are not the same.'); return false; }
      try { await openBlob(cloud && cloud.exists ? cloud.blob : localBlob(), current); }
      catch { showError('pass-error', 'The current password is wrong.'); return false; }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(next, salt, ITERATIONS);
      try {
        await push({ key, salt, iterations: ITERATIONS });
      } catch {
        showError('pass-error', 'Could not reach the cloud. Changing the password needs a connection.');
        return false;
      }
      return true;
    },
  });
  if (ok) toast('Master password changed.');
}

// ---------- menu, theme, lock ----------
const menu = $('menu');
$('btn-menu').addEventListener('click', (e) => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
  $('btn-menu').setAttribute('aria-expanded', String(!menu.hidden));
});
document.addEventListener('click', (e) => {
  if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; $('btn-menu').setAttribute('aria-expanded', 'false'); }
});
menu.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  const act = b && b.dataset.act;
  if (!act) return;
  menu.hidden = true;
  if (act === 'backup') downloadBackup();
  if (act === 'restore') importBackup();
  if (act === 'change') changeMaster();
  if (act === 'install') install();
  if (act === 'signout') signOutHere();
  if (act === 'stash') mergeStash();
  if (act === 'erase') eraseVault();
});
$('btn-lock').addEventListener('click', lock);
$('stash-merge').addEventListener('click', mergeStash);

function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').content = t === 'light' ? '#f7f7f8' : '#0b0d10';
}
applyTheme(lsGet(THEME_KEY) === 'light' ? 'light' : 'dark');
$('btn-theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch {}
});

// Keyboard: "/" focuses search, Esc clears it
document.addEventListener('keydown', (e) => {
  if (!session || document.querySelector('dialog[open]')) return;
  if (e.key === '/' && document.activeElement !== $('search')) { e.preventDefault(); $('search').focus(); }
  if (e.key === 'Escape' && document.activeElement === $('search')) { $('search').value = ''; render(); }
});

// ---------- install as an app ----------
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
document.querySelectorAll('[data-install-hint]').forEach((n) => { n.hidden = !(isIOS && !standalone); });

let installEvent = null; // Chrome / Android: its own install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  document.querySelectorAll('[data-install-btn]').forEach((n) => { n.hidden = false; });
});
async function install() {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => {});
  installEvent = null;
  document.querySelectorAll('[data-install-btn]').forEach((n) => { n.hidden = true; });
}
document.querySelector('.install-btn').addEventListener('click', install);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
