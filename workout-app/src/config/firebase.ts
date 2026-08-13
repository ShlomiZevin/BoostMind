import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
  onAuthStateChanged, type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB90ncysHNU-fqHfe9dEudVR2sweXQGM90",
  authDomain: "boostmind-b052c.firebaseapp.com",
  projectId: "boostmind-b052c",
  storageBucket: "boostmind-b052c.firebasestorage.app",
  messagingSenderId: "463727469066",
  appId: "1:463727469066:web:fe01da10c04d395d55f5f3",
  measurementId: "G-DBV4LQG3RN"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Emails that resolve to a specific legacy uid instead of the raw Firebase Auth uid.
// This lets Shlomi's Google login land on his existing data at users/user_6724/*
// without moving anything. Add more entries here for any future legacy accounts.
const EMAIL_TO_UID: Record<string, string> = {
  'shlomi@boostart.io': 'user_6724',
};

// Resolve the app-level uid from a Firebase Auth user.
// Rule: emails in EMAIL_TO_UID map to their legacy uid; everyone else uses
// the raw Firebase Auth uid, ensuring per-user data isolation out of the box.
// Sync resolver — used at render time, no async I/O.
export function resolveAppUid(user: User): string {
  const email = (user.email || '').toLowerCase();
  return EMAIL_TO_UID[email] || user.uid;
}

// Async resolver — also consults the Firestore alias doc, letting users manually
// link a Google account to a legacy uid via Settings. Called once on login and
// cached in localStorage so subsequent renders can stay synchronous.
export async function resolveAppUidAsync(user: User): Promise<string> {
  const emailUid = EMAIL_TO_UID[(user.email || '').toLowerCase()];
  if (emailUid) return emailUid;
  try {
    const snap = await getDoc(doc(getFirestore(), 'authAliases', user.uid));
    if (snap.exists()) {
      const legacy = snap.data()?.legacyUid;
      if (typeof legacy === 'string' && legacy) return legacy;
    }
  } catch { /* alias doc missing / rules deny — fall through */ }
  return user.uid;
}

// Persist a link between the current Firebase Auth uid and a legacy passcode-based
// uid. After this, resolveAppUidAsync(user) returns the legacy uid so the user
// sees the same data they had before Google Sign-In.
export async function claimLegacyUid(user: User, legacyUid: string): Promise<void> {
  const clean = legacyUid.trim();
  if (!clean) throw new Error('empty legacyUid');
  await setDoc(doc(getFirestore(), 'authAliases', user.uid), {
    legacyUid: clean,
    email: user.email || null,
    createdAt: Date.now(),
  });
  // Also cache locally so useAuth picks it up on next mount without another read.
  try { localStorage.setItem(`authAlias:${user.uid}`, clean); } catch { /* ignore */ }
}

// Read the cached alias set by claimLegacyUid, if any.
export function cachedLegacyUid(user: User): string | null {
  try { return localStorage.getItem(`authAlias:${user.uid}`); } catch { return null; }
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}
