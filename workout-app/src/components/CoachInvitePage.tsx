import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import { resolveCoachByAuthUid } from '../hooks/useCoachLookup';
import type { Route } from '../types';

// Public landing for the coach's invite link. The URL carries the coach's
// raw Firebase Auth uid:
//     https://wholos.com/wholos-app/#/coach/invite/<coachUid>
//
// Flow:
//   1. Trainee opens the link (unauthenticated OK).
//   2. Page shows "You've been invited by <coach name>. Sign in to join."
//   3. Trainee signs in with Google.
//   4. On successful sign-in, we set `coachUid = <coachUid>` on the trainee's
//      profile doc (+ mirror to users_index) and redirect to home.

export function CoachInvitePage({ coachUid, navigate }: {
  coachUid: string;
  navigate: (r: Route) => void;
}) {
  const { uid, rawAuthUid, login } = useAuth();
  const signedIn = !!uid;

  const [coachName, setCoachName] = useState<string | null>(null);
  const [coachEmail, setCoachEmail] = useState<string | null>(null);
  const [coachPhoto, setCoachPhoto] = useState<string | null>(null);
  const [invalidCoach, setInvalidCoach] = useState(false);
  const [applying, setApplying] = useState(false);
  const [appliedTo, setAppliedTo] = useState<string | null>(null);

  // Look up the coach from users_index so we can show a real name/photo.
  // Uses resolveCoachByAuthUid which handles ALIASED accounts (Shlomi's
  // users_index doc is at `user_6724`, keyed by his APP uid — direct lookup
  // by his raw auth uid misses him and used to flash "invalid link" even
  // though the binding write itself worked).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meta = await resolveCoachByAuthUid(coachUid);
      if (cancelled) return;
      if (!meta || meta.role !== 'coacher') { setInvalidCoach(true); return; }
      setCoachName(meta.displayName || meta.email || 'המאמן שלך');
      setCoachEmail(meta.email || null);
      setCoachPhoto(meta.photoURL || null);
    })();
    return () => { cancelled = true; };
  }, [coachUid]);

  // Once signed in, apply the coachUid to the trainee's profile.
  useEffect(() => {
    if (!signedIn || !uid || invalidCoach || applying || appliedTo === coachUid) return;
    // Guard against the coach opening their OWN invite link — that would
    // pin their coachUid to themselves and break everything.
    if (rawAuthUid === coachUid) return;
    setApplying(true);
    (async () => {
      try {
        await setDoc(doc(db, 'users', uid, 'profile', 'main'), {
          coachUid,
          coachAcceptedAt: Date.now(),
          updatedAt: Date.now(),
        }, { merge: true });
        // Mirror to users_index so the coach dashboard query finds them.
        await setDoc(doc(db, 'users_index', uid), {
          coachUid,
          coachAcceptedAt: Date.now(),
        }, { merge: true });
        setAppliedTo(coachUid);
        // Small delay so the "connected" state is visible for a beat, then
        // send them into the app.
        setTimeout(() => navigate({ page: 'home' }), 1200);
      } catch (e) {
        console.warn('coach-invite accept failed', e);
        setApplying(false);
      }
    })();
  }, [signedIn, uid, rawAuthUid, coachUid, invalidCoach, applying, appliedTo, navigate]);

  const gBtn = (
    <svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true">
      <path fill="#4285F4" d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.4a4.6 4.6 0 0 1-2 3.03v2.5h3.24c1.9-1.75 3-4.33 3-7.34z" />
      <path fill="#34A853" d="M10 20c2.7 0 4.98-.9 6.64-2.43l-3.24-2.5c-.9.6-2.05.96-3.4.96-2.6 0-4.82-1.76-5.6-4.13H1.05v2.6A10 10 0 0 0 10 20z" />
      <path fill="#FBBC05" d="M4.4 11.9a6.02 6.02 0 0 1 0-3.82V5.48H1.05a10.02 10.02 0 0 0 0 9.04L4.4 11.9z" />
      <path fill="#EA4335" d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A10 10 0 0 0 1.05 5.48L4.4 8.08C5.18 5.72 7.4 3.96 10 3.96z" />
    </svg>
  );

  // Every state renders inside the same shell as LoginScreen — same ambient
  // light, same card, same lockup. A trainee arriving here should not be able
  // to tell it apart from the normal way in.
  return (
    <div className="login-page" dir="rtl">
      <div className="login-amb" aria-hidden="true" />
      <div className="login-grain" aria-hidden="true" />

      <div className="login-inner">
        <div className="login-card">

          <div className="login-lockup" style={{ animationDelay: '40ms' }}>
            <div className="login-mark">
              <svg viewBox="0 0 64 64" width="50" height="50" fill="currentColor" stroke="currentColor" aria-hidden="true">
                <circle cx="32" cy="32" r="27" fill="none" strokeWidth="4.5" />
                <path d="M5 32 C14 23 23 23 32 32 C41 41 50 41 59 32 A27 27 0 0 1 5 32 Z" />
              </svg>
            </div>
            <h1 className="login-title">Wholos</h1>
          </div>

          {invalidCoach ? (
            <div className="inv-state" style={{ animationDelay: '160ms' }}>
              <p className="login-sub">קישור לא תקף</p>
              <p className="login-sub2">
                הקישור הזה לא מוביל למאמן פעיל. בקשו מהמאמן שלכם לשלוח קישור חדש.
              </p>
              <button onClick={() => navigate({ page: 'home' })} className="login-btn">
                <span>כניסה ל-Wholos</span>
              </button>
            </div>
          ) : appliedTo ? (
            <div className="inv-state" style={{ animationDelay: '160ms' }}>
              <p className="login-sub">מחוברים אל {coachName}</p>
              <p className="login-sub2">רגע, נכנסים לאפליקציה…</p>
            </div>
          ) : !signedIn ? (
            <>
              {/* The coach is the reason this page exists, so they get the
                  weight here — the way the two mode pills do on LoginScreen. */}
              <div className="inv-coach" style={{ animationDelay: '170ms' }}>
                <span className="inv-ava">
                  {coachPhoto
                    ? <img src={coachPhoto} alt="" />
                    : <i>{(coachName || '?').slice(0, 1)}</i>}
                </span>
                <span className="inv-who">
                  <b>{coachName || '…'}</b>
                  {coachEmail && <u dir="ltr">{coachEmail}</u>}
                </span>
              </div>

              <p className="login-sub" style={{ animationDelay: '220ms' }}>
                הוזמנתם להתאמן עם {coachName || 'המאמן שלכם'}.
              </p>
              <p className="login-sub2" style={{ animationDelay: '260ms' }}>
                האימונים והתזונה שלכם במקום אחד, עם AI שמכיר את שניהם.
              </p>

              <div className="login-ai inv-note" style={{ animationDelay: '310ms' }}>
                <span className="q">השיחות שלכם עם ה-AI נשארות פרטיות.</span>
              </div>

              <button onClick={() => login()} className="login-btn" style={{ animationDelay: '370ms' }}>
                {gBtn}<span>המשך עם Google</span>
              </button>
            </>
          ) : rawAuthUid === coachUid ? (
            <div className="inv-state" style={{ animationDelay: '160ms' }}>
              <p className="login-sub">זה הקישור שלכם</p>
              <p className="login-sub2">
                אתם המאמן. שלחו את הקישור למתאמנים שלכם, לא לעצמכם.
              </p>
              <button onClick={() => navigate({ page: 'home' })} className="login-btn">
                <span>כניסה ל-Wholos</span>
              </button>
            </div>
          ) : (
            <div className="inv-state" style={{ animationDelay: '160ms' }}>
              <span className="inv-spin" aria-hidden="true" />
              <p className="login-sub2">מחברים אתכם אל {coachName || '…'}…</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
