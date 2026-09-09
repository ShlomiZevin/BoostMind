// Who has full admin powers across the app: reports admin, users admin,
// analytics, exercise-DB writes, trial exemption, the admin-only settings
// block, the desktop admin pages.
//
// TWO sources feed the roster:
//
//   1. ADMIN_EMAILS  — hardcoded seed. Shlomi + Sergio. Guarantees these
//      accounts are always admin even before the Firestore cache loads.
//      Edit + deploy to add a founding admin.
//
//   2. Runtime cache — refreshRuntimeAdmins() reads users_index docs with
//      `isAdmin: true` and stores their emails. Toggle it from the users-
//      admin page and it takes effect on the next app load for any device.
//      No deploy needed.
//
// Consumers always call the SYNC isAdminEmail(email) helper. It reads
// both sources, so a hardcoded admin is admin even before the async
// refresh completes on first paint.

import { collection, getDocs, query, where, setDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

export const ADMIN_EMAILS: ReadonlySet<string> = new Set([
  'shlomi@boostart.io',
  'sergiokatz78@gmail.com',
]);

// Module-level cache. Rebuilt by refreshRuntimeAdmins() and read by every
// isAdminEmail() call. Empty until the first refresh finishes — meanwhile
// the hardcoded set covers the founding admins.
let runtimeAdminEmails: Set<string> = new Set();

export async function refreshRuntimeAdmins(): Promise<void> {
  try {
    const snap = await getDocs(
      query(collection(db, 'users_index'), where('isAdmin', '==', true)),
    );
    const next = new Set<string>();
    for (const d of snap.docs) {
      const data = d.data() as any;
      const e = data?.email;
      if (typeof e === 'string' && e) next.add(e.toLowerCase());
    }
    runtimeAdminEmails = next;
  } catch {
    // Rules deny / offline — hardcoded set still works; skip the refresh.
  }
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lc = email.toLowerCase();
  return ADMIN_EMAILS.has(lc) || runtimeAdminEmails.has(lc);
}

// Grant / revoke admin from the users-admin page. Writes `isAdmin` to
// users_index/{uid} and refreshes the local cache so the change reflects
// immediately in the current session too.
export async function setUserAdmin(uid: string, isAdmin: boolean): Promise<void> {
  await setDoc(doc(db, 'users_index', uid), { isAdmin }, { merge: true });
  await refreshRuntimeAdmins();
}
