# Workout Logger

PWA for tracking gym workouts. Dark mode, mobile-first, offline-capable.

## Setup

```bash
npm install
npm run dev
```

## Firebase Project Setup

Using existing Firebase project `boostmind-b052c`.

1. Enable **Anonymous Authentication** in Firebase Console → Authentication → Sign-in method
2. Enable **Firestore** in Firebase Console → Firestore Database
3. Set Firestore rules to allow authenticated users to read/write their own data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Swapping the Training Program

Replace `src/data/program.ts` with your new program. The `Program` type is defined in `src/types/index.ts`. All UI derives from the config — no code changes needed.

## Deploy

```bash
npm run build
firebase deploy --only hosting --project boostmind-b052c
```

Build outputs to `../public/workout-app/` → accessible at `boostmind-b052c.web.app/workout-app/`.
