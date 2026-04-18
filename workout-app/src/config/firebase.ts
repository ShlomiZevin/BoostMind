import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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

// Simple device-based ID
export function getDeviceId(): string {
  let id = localStorage.getItem('workout-device-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('workout-device-id', id);
  }
  return id;
}
