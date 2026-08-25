import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { resolveAppUid, resolveAppUidAsync, cachedLegacyUid, signInWithGoogle, signOutUser, subscribeToAuth, db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ensureUserIndex, logEvent } from '../utils/analytics';
import { isCoacherEmail, presetCoachUidFor } from '../config/coaches';

export type AuthState = {
  uid: string | null;         // app-level uid (aliased for legacy accounts)
  rawAuthUid: string | null;  // raw Firebase Auth uid — for the claim flow
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  // Re-run the async resolver — call after `claimLegacyUid` writes the alias so
  // the app immediately switches over to the linked uid without a reload.
  refreshAlias: () => void;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Resolved app-level uid — starts from sync resolver + local cache, then
  // gets patched by the async Firestore alias lookup once it lands.
  const [uid, setUid] = useState<string | null>(null);
  const [aliasTick, setAliasTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeToAuth(u => {
      setUser(u);
      if (!u) {
        setUid(null);
        setLoading(false);
        return;
      }
      // Sync first: hardcoded EMAIL_TO_UID map + localStorage cache. This lets the
      // UI mount immediately without waiting for a Firestore round-trip.
      const cached = cachedLegacyUid(u);
      setUid(cached || resolveAppUid(u));
      setLoading(false);
    });
    return unsub;
  }, []);

  // Kick off the async Firestore alias lookup once we have a user. This can only
  // OVERRIDE the sync answer if the Firestore alias exists and the sync map
  // didn't already have a hit. Never overrides an already-set EMAIL_TO_UID map.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    resolveAppUidAsync(user).then(next => {
      if (cancelled) return;
      setUid(prev => prev === next ? prev : next);
    }).catch(() => { /* keep sync answer */ });
    return () => { cancelled = true; };
  }, [user, aliasTick]);

  // ─── Analytics on sign-in ─────────────────────────────────────────
  // Fire once per authenticated user per page load. Waits until the app-level
  // uid resolves so `users_index/{uid}` is keyed on the same identity the
  // rest of the app uses (aliased for legacy accounts like user_6724).
  const trackedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !uid) return;
    if (trackedForRef.current === uid) return;
    trackedForRef.current = uid;
    void logEvent('sign_in', { uid, email: user.email || null });
    void ensureUserIndex(user, uid).then(({ isNew }) => {
      if (isNew) {
        void logEvent('register', { uid, email: user.email || null });
      }
    });
    // ── Auto-promote known coacher emails to role='coacher' ─────
    // Merges `role: coacher` onto the profile doc AND the users_index row
    // so both surfaces (impersonation + admin dashboard) see the flag. Runs
    // once per sign-in, skipped when the profile already has that role.
    if (isCoacherEmail(user.email)) {
      void (async () => {
        try {
          const pref = doc(db, 'users', uid, 'profile', 'main');
          const snap = await getDoc(pref);
          if (snap.exists() && snap.data()?.role === 'coacher') return;
          await setDoc(pref, { role: 'coacher', updatedAt: Date.now() }, { merge: true });
          await setDoc(doc(db, 'users_index', uid), { role: 'coacher' }, { merge: true });
        } catch (e) {
          console.warn('[coacher promote] failed', e);
        }
      })();
    }
    // ── Preset trainee-to-coach binding ─────────────────────────
    // For demo/testing accounts pre-declared in PRESET_TRAINEES: if the
    // profile has no coachUid yet, apply the preset. Same effect as clicking
    // the invite link, but without the round trip. Idempotent — skips when
    // already bound.
    const presetCoach = presetCoachUidFor(user.email);
    if (presetCoach) {
      void (async () => {
        try {
          const pref = doc(db, 'users', uid, 'profile', 'main');
          const snap = await getDoc(pref);
          const existing = snap.exists() ? (snap.data() as any)?.coachUid : undefined;
          if (existing) return;
          const stamp = Date.now();
          await setDoc(pref, {
            coachUid: presetCoach,
            coachAcceptedAt: stamp,
            updatedAt: stamp,
          }, { merge: true });
          await setDoc(doc(db, 'users_index', uid), {
            coachUid: presetCoach,
            coachAcceptedAt: stamp,
          }, { merge: true });
        } catch (e) {
          console.warn('[preset coach] failed', e);
        }
      })();
    }
  }, [user, uid]);

  async function login() {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
      throw err;
    }
  }

  async function logout() {
    await signOutUser();
  }

  return {
    uid,
    rawAuthUid: user?.uid ?? null,
    email: user?.email ?? null,
    displayName: user?.displayName ?? null,
    photoURL: user?.photoURL ?? null,
    loading,
    login,
    logout,
    refreshAlias: () => setAliasTick(t => t + 1),
  };
}
