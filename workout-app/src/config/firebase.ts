import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

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

// Passcode-based user ID
export function getPasscode(): string | null {
  return localStorage.getItem('workout-passcode');
}

export function setPasscode(passcode: string) {
  localStorage.setItem('workout-passcode', `user_${passcode}`);
}

export function getUserId(): string | null {
  const passcode = localStorage.getItem('workout-passcode');
  return passcode;
}

export function logout() {
  localStorage.removeItem('workout-passcode');
}

// Migrate data from old device ID to new passcode-based ID
export async function migrateFromDeviceId(newUserId: string) {
  const oldId = localStorage.getItem('workout-device-id');
  if (!oldId || oldId === newUserId) return;

  const subcollections = ['sessions', 'exerciseStats', 'exercisePhotos', 'customExercises', 'hiddenExercises'];

  for (const sub of subcollections) {
    const oldCol = collection(db, 'users', oldId, sub);
    const snap = await getDocs(oldCol);
    for (const d of snap.docs) {
      const newRef = doc(db, 'users', newUserId, sub, d.id);
      await setDoc(newRef, d.data());
      await deleteDoc(doc(db, 'users', oldId, sub, d.id));
    }
  }

  // Clean up old device ID
  localStorage.removeItem('workout-device-id');
}
