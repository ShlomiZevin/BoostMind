import { addDoc, collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../config/firebase';

// Launch-day analytics: append-only events in Firestore, plus a lightweight
// users_index registry so the admin panel can show "who registered and when"
// without walking the whole users tree.
//
// Two collections:
//   analytics_events/{auto}   — every page view / sign-in / register
//   users_index/{uid}         — one row per registered user, upserted on sign-in
//
// The landing page (public/wholos/index.html) fires its own events over
// Firestore REST because it has no bundled SDK. Everything inside the app
// (login screen, sign-in) uses this helper.

export type EventType =
  | 'home_view'      // /wholos/ landing hit
  | 'login_view'     // login screen mounted
  | 'app_open'       // any authed screen mounted (deduped per-session)
  | 'sign_in'        // Google popup returned a user
  | 'register';      // FIRST sign-in for this uid (users_index just created)

const VISITOR_KEY = 'wholos_vid';
const SESSION_KEY = 'wholos_sid';

// Stable per-device id — persists across sessions so we can count uniques.
export function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return 'v_ephemeral';
  }
}

// Per-tab session — reset when the tab closes. Useful for dedup ("this pageview
// is the same session as that sign-in").
export function getSessionId(): string {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return 's_ephemeral';
  }
}

// Very short UA hint — good enough to see "how many iPhone" without a whole
// bulky user-agent string in the log. Bucketed on write so query is trivial.
function shortUa(): string {
  const ua = navigator.userAgent || '';
  const platform =
    /iPad/.test(ua) ? 'iPad'
    : /iPhone/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? 'Android'
    : /Mac/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : 'Other';
  const browser =
    /CriOS|Chrome/.test(ua) ? 'Chrome'
    : /FxiOS|Firefox/.test(ua) ? 'Firefox'
    : /Edg\//.test(ua) ? 'Edge'
    : /Safari/.test(ua) ? 'Safari'
    : 'Other';
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ? '/PWA' : '';
  return `${platform} ${browser}${standalone}`;
}

function utmFromLocation(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const p = new URLSearchParams(window.location.search);
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const v = p.get(k);
      if (v) out[k] = v.slice(0, 60);
    }
  } catch { /* ignore */ }
  return out;
}

// Per-session dedup so a re-render doesn't double-count the same view. We
// track which event types have already been fired for the current session,
// and skip repeats for the ones that are "one per session by nature"
// (home_view, login_view, app_open). Explicit events (sign_in, register)
// always fire.
const DEDUP_TYPES: EventType[] = ['home_view', 'login_view', 'app_open'];
const firedThisSession = new Set<string>();

// Owner uid — we do NOT want the account that runs the launch dashboard to
// appear in the funnel it renders. Every event with this uid is dropped at
// the source; the admin dashboard also filters it at read time as a belt.
const OWNER_UID = 'user_6724';

export async function logEvent(type: EventType, extra?: Record<string, unknown>): Promise<void> {
  const extraUid = extra && typeof extra.uid === 'string' ? extra.uid : undefined;
  if (extraUid === OWNER_UID) return;
  if (DEDUP_TYPES.includes(type)) {
    if (firedThisSession.has(type)) return;
    firedThisSession.add(type);
  }
  try {
    await addDoc(collection(db, 'analytics_events'), {
      type,
      ts: Date.now(),
      createdAt: serverTimestamp(),
      visitor: getVisitorId(),
      session: getSessionId(),
      path: (typeof window !== 'undefined' && window.location?.pathname) || '',
      referrer: (typeof document !== 'undefined' && document.referrer) || null,
      ua: shortUa(),
      ...utmFromLocation(),
      ...(extra || {}),
    });
  } catch (e) {
    // Analytics MUST NOT break the app. Swallow.
    console.warn('[analytics] logEvent failed', type, e);
  }
}

// Called on every successful Google sign-in.
// Upserts the users_index row. Returns true when the row was just created
// (i.e. this is a first-time registration) so the caller can fire a
// distinct 'register' event on top of the 'sign_in' one.
//
// (Previously skipped the owner uid to keep him out of the launch-dashboard
// funnel numbers — but the desktop /users-admin page now hosts a "הצג גם את
// שלומי" checkbox that owns the filtering, so the row itself needs to exist.
// Analytics counters still filter him out where relevant.)
export async function ensureUserIndex(user: User, appUid: string): Promise<{ isNew: boolean }> {
  try {
    const ref = doc(db, 'users_index', appUid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      // Bump last-seen + count; keep firstSeenAt intact.
      const data = snap.data() || {};
      await setDoc(ref, {
        uid: appUid,
        email: user.email || data.email || null,
        displayName: user.displayName || data.displayName || null,
        photoURL: user.photoURL || data.photoURL || null,
        lastSeenAt: Date.now(),
        signInCount: (data.signInCount || 1) + 1,
      }, { merge: true });
      return { isNew: false };
    }
    // First time ever.
    const now = Date.now();
    const utm = utmFromLocation();
    await setDoc(ref, {
      uid: appUid,
      authUid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      visitor: getVisitorId(),
      firstSeenAt: now,
      lastSeenAt: now,
      signInCount: 1,
      firstUa: shortUa(),
      firstReferrer: (typeof document !== 'undefined' && document.referrer) || null,
      ...(Object.keys(utm).length ? { firstUtm: utm } : {}),
    }, { merge: true });
    return { isNew: true };
  } catch (e) {
    console.warn('[analytics] ensureUserIndex failed', e);
    return { isNew: false };
  }
}
