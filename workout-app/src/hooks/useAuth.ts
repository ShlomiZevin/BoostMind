import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { resolveAppUid, resolveAppUidAsync, cachedLegacyUid, signInWithGoogle, signOutUser, subscribeToAuth } from '../config/firebase';

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
