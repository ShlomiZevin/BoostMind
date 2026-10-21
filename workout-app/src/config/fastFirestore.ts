// Drop-in replacements for getDoc / getDocs / setDoc / updateDoc / deleteDoc
// that never leave the UI waiting on a bad connection.
//
// Why: gyms have terrible reception. The plain SDK calls wait for the server
// with no upper bound, and every screen awaits them before it renders or
// closes a modal — so a stalled request froze the app on "Loading..." or on a
// set that would not save.
//
// How: each call gets a time budget. A read that blows it is answered from the
// on-device cache (enabled in firebase.ts); a write that blows it resolves
// anyway, because the SDK has already applied it locally and queued it in
// IndexedDB — it syncs by itself when the signal comes back, even if the app
// was closed in between. After one miss we stay in "slow" mode (cache-first
// reads, instant writes) until the server answers inside budget again.
//
// On a good connection nothing changes: calls return the server result and
// errors propagate exactly as before.
import {
  getDoc as rawGetDoc, getDocs as rawGetDocs,
  getDocFromCache, getDocsFromCache,
  setDoc as rawSetDoc, updateDoc as rawUpdateDoc, deleteDoc as rawDeleteDoc,
} from 'firebase/firestore';

const READ_BUDGET_MS = 2000;
const WRITE_BUDGET_MS = 1000;

let slow = typeof navigator !== 'undefined' && navigator.onLine === false;
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => { slow = true; });
}

const TIMEOUT = Symbol('timeout');
function within<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(TIMEOUT), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// Track how long a server call took; a fast answer ends slow mode.
function timed<T>(p: Promise<T>, budget: number): Promise<T> {
  const t0 = Date.now();
  p.then(() => { if (Date.now() - t0 < budget) slow = false; }, () => { /* caller handles */ });
  return p;
}

// In slow mode, one background server read at a time keeps the cache fresh
// and notices when the connection is back — without piling up requests.
let probing = false;
function probe(run: () => Promise<unknown>) {
  if (probing) return;
  probing = true;
  // Bounded: a probe that stalls must not block every later probe, or we'd
  // never notice the connection came back.
  within(timed(run(), READ_BUDGET_MS), READ_BUDGET_MS)
    .catch(() => { /* still offline */ })
    .finally(() => { probing = false; });
}

export const getDoc = (async (ref: any) => {
  if (slow) {
    try {
      const cached = await getDocFromCache(ref);
      probe(() => rawGetDoc(ref));
      return cached;
    } catch { /* not cached yet — must ask the server */ }
  }
  const server = timed(rawGetDoc(ref), READ_BUDGET_MS);
  const r = await within(server, READ_BUDGET_MS);
  if (r !== TIMEOUT) return r;
  slow = true;
  // Only a cached copy counts. A doc we have never seen must not be reported
  // as missing — the session page would read that as "deleted" and bounce.
  try { return await getDocFromCache(ref); } catch { return server; }
}) as typeof rawGetDoc;

export const getDocs = (async (q: any) => {
  if (slow) {
    try {
      const cached = await getDocsFromCache(q);
      // An empty cache result may just mean "never fetched" — callers create
      // records based on what's missing, so don't trust an empty answer.
      if (!cached.empty) {
        probe(() => rawGetDocs(q));
        return cached;
      }
    } catch { /* fall through */ }
  }
  const server = timed(rawGetDocs(q), READ_BUDGET_MS);
  const r = await within(server, READ_BUDGET_MS);
  if (r !== TIMEOUT) return r;
  slow = true;
  try {
    const cached = await getDocsFromCache(q);
    if (!cached.empty) return cached;
  } catch { /* fall through */ }
  return server;
}) as typeof rawGetDocs;

function fastWrite(p: Promise<void>): Promise<void> {
  timed(p, WRITE_BUDGET_MS);
  if (slow) {
    p.catch(e => console.error('[wholos] queued write failed', e));
    return Promise.resolve();
  }
  return within(p, WRITE_BUDGET_MS).then(r => {
    if (r === TIMEOUT) {
      slow = true;
      p.catch(e => console.error('[wholos] queued write failed', e));
    }
  });
}

export const setDoc = ((...args: any[]) => fastWrite((rawSetDoc as any)(...args))) as typeof rawSetDoc;
export const updateDoc = ((...args: any[]) => fastWrite((rawUpdateDoc as any)(...args))) as typeof rawUpdateDoc;
export const deleteDoc = ((...args: any[]) => fastWrite((rawDeleteDoc as any)(...args))) as typeof rawDeleteDoc;
