import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { trialStateOf, type AccessFields, type TrialState } from '../config/access';

/**
 * Resolves where the account stands on its free week.
 *
 * Reads the same doc the rest of the app uses (profile/main) and stamps
 * `trialStartedAt` the first time it sees an account without one — so the clock
 * starts on first use rather than on some signup timestamp we never recorded.
 * Existing accounts therefore get a fresh week from the day this ships, which is
 * the correct behaviour: nobody should be retroactively locked out.
 *
 * The owner short-circuits before any I/O — there is no code path where the
 * person who built this waits on a network read to be let into their own app.
 */
export function useTrial(uid: string | null, isOwner: boolean) {
  const [trial, setTrial] = useState<TrialState | null>(
    isOwner ? { status: 'exempt', daysLeft: 0, endsAt: 0 } : null,
  );
  // Kept so the focus/interval re-check can recompute without re-reading.
  const fieldsRef = useRef<AccessFields | null>(null);

  const recompute = useCallback(() => {
    // No fields means the read never succeeded and we already failed open —
    // recomputing from nothing would silently undo that.
    if (isOwner || !fieldsRef.current) return;
    setTrial(trialStateOf(fieldsRef.current, false));
  }, [isOwner]);

  useEffect(() => {
    if (isOwner) {
      setTrial({ status: 'exempt', daysLeft: 0, endsAt: 0 });
      return;
    }
    if (!uid) return;

    let cancelled = false;

    (async () => {
      let fields: AccessFields = {};
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'profile', 'main'));
        if (snap.exists()) fields = snap.data() as AccessFields;
      } catch {
        // Offline or rules denied. Fail OPEN: a network blip must not look like
        // an expired trial to someone who is paying attention.
        if (!cancelled) setTrial({ status: 'exempt', daysLeft: 0, endsAt: 0 });
        return;
      }

      if (!fields.trialStartedAt && !fields.trialExempt) {
        const trialStartedAt = Date.now();
        fields = { ...fields, trialStartedAt };
        try {
          await setDoc(
            doc(db, 'users', uid, 'profile', 'main'),
            { trialStartedAt, updatedAt: trialStartedAt },
            { merge: true },
          );
        } catch { /* the in-memory value still gates this session correctly */ }
      }

      if (cancelled) return;
      fieldsRef.current = fields;
      setTrial(trialStateOf(fields, false));
    })();

    return () => { cancelled = true; };
  }, [uid, isOwner]);

  // A phone left open for days should still notice the week ended.
  useEffect(() => {
    if (isOwner) return;
    const onFocus = () => recompute();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const t = window.setInterval(recompute, 60 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.clearInterval(t);
    };
  }, [isOwner, recompute]);

  return trial;
}
