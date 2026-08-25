import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

// Resolve a coach's users_index metadata given the raw Firebase Auth uid that
// the invite URL / trainee profile stores in `coachUid`.
//
// Why this exists: for aliased accounts (Shlomi's Google login maps to the
// legacy app uid `user_6724` via EMAIL_TO_UID), the raw auth uid does NOT
// match the doc id in `users_index` — his doc lives at `users_index/user_6724`
// with an `authUid` field pointing to the raw uid. So a naive lookup at
// `users_index/<rawAuthUid>` misses him entirely and marks the invite link
// "invalid" even though the binding write itself succeeds. Trying both paths
// makes both aliased and unaliased coaches resolve consistently.

export type CoachMeta = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role?: string | null;
};

export async function resolveCoachByAuthUid(coachAuthUid: string): Promise<CoachMeta | null> {
  // Fast path — direct id lookup. Works for every non-aliased account.
  try {
    const snap = await getDoc(doc(db, 'users_index', coachAuthUid));
    if (snap.exists()) {
      const d = snap.data() as any;
      return { uid: coachAuthUid, email: d.email, displayName: d.displayName, photoURL: d.photoURL, role: d.role };
    }
  } catch { /* fall through */ }
  // Fallback — search by the `authUid` field for aliased users.
  try {
    const q = query(collection(db, 'users_index'), where('authUid', '==', coachAuthUid), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const doc0 = snap.docs[0];
      const d = doc0.data() as any;
      return { uid: doc0.id, email: d.email, displayName: d.displayName, photoURL: d.photoURL, role: d.role };
    }
  } catch { /* ignore */ }
  return null;
}
