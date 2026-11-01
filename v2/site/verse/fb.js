// Firebase for the Shlomiverse's fans. On localhost everything goes to the emulators (project demo-shlomiverse, started
// by v2/dev.mjs); live it is boostmind-b052c on shlomiverse.com.
const SDK = 'https://www.gstatic.com/firebasejs/12.4.0';
const { initializeApp } = await import(`${SDK}/firebase-app.js`);
const A = await import(`${SDK}/firebase-auth.js`);
const F = await import(`${SDK}/firebase-firestore.js`);
const Fn = await import(`${SDK}/firebase-functions.js`);

export const LOCAL = /^(localhost|127\.)/.test(location.hostname);
// LIVE: boostmind-b052c's web app (`firebase apps:sdkconfig web`; a web API key is public by design). On shlomiverse.com the
// Google sign-in stays on the Shlomiverse's own address (Safari blocks the cross-site way); elsewhere firebaseapp.com
const LIVE_CONFIG = { apiKey: 'AIzaSyB90ncysHNU-fqHfe9dEudVR2sweXQGM90', authDomain: location.hostname.endsWith('shlomiverse.com') ? location.hostname : 'boostmind-b052c.firebaseapp.com', projectId: 'boostmind-b052c', storageBucket: 'boostmind-b052c.firebasestorage.app', messagingSenderId: '463727469066', appId: '1:463727469066:web:fe01da10c04d395d55f5f3' };
const app = initializeApp(LOCAL ? { apiKey: 'local-key', authDomain: 'localhost', projectId: 'demo-shlomiverse', appId: 'local' } : LIVE_CONFIG);

export const auth = A.getAuth(app);
export const db = F.getFirestore(app);
const fns = Fn.getFunctions(app, 'europe-west1');
if (LOCAL) {
  A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  F.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  Fn.connectFunctionsEmulator(fns, '127.0.0.1', 5001);
}
export { A, F };

// the push key's public half (its private half is the function's secret)
export const VAPID = 'BApNz6a4ZuFrPgaIEHGY9rvyKkwIvrJPsRjH0k01QYruVT2yz5ce-0fVuuIsk9vyprZ8Gq1nGxXajBL-EMD0hP0';
export const OWNER_API = LOCAL ? '/api/verseOwner' : 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseOwner';

const verse = Fn.httpsCallable(fns, 'verse', { timeout: 120000 });
// every fan action goes through the one `verse` function
export async function call(op, data = {}) {
  try { return (await verse({ op, ...data })).data; }
  catch (e) { throw Object.assign(new Error(e.message), { code: (e.message || '').trim() }); }
}
