import { useState } from 'react';
import { AiChatPanel } from './AiChatPanel';
import { useOnboardingBuilder, type OnboardingProfile, type BuildProgress } from '../hooks/useOnboardingBuilder';
import { useFirestore } from '../hooks/useFirestore';
import type { Route } from '../types';

type Props = {
  uid: string;
  displayName: string | null;
  navigate: (r: Route) => void;
  onDone: () => void; // called after plan is built + persisted (or explicitly skipped)
};

// Full-screen new-user onboarding: warm AI chat → guided Q&A → chunked plan build.
// The chat is FREE — the user can just talk, ask questions, skip fields. Every
// captured field is persisted via update_profile (handled inside AiChatPanel).
// When the AI thinks it has enough, it offers a "בנה לי את התוכנית" CTA.
// The user can also skip onboarding entirely and land on Home.
export function OnboardingScreen({ uid, displayName, navigate, onDone }: Props) {
  const [building, setBuilding] = useState<BuildProgress>({ phase: 'idle' });
  const [confirmSkip, setConfirmSkip] = useState(false);
  const { build } = useOnboardingBuilder(uid);
  const firestore = useFirestore(uid);

  const greeting = displayName
    ? `היי ${displayName.split(' ')[0]}! 👋 ברוכ/ה הבא/ה. אני המאמן שלך כאן. אשאל אותך כמה דברים קצרים ונבנה לך תוכנית מותאמת — אבל אתה גם יכול פשוט לדבר איתי חופשי, לשאול שאלות, או לדלג על כל דבר שאתה לא רוצה לענות עליו. איך קוראים לך?`
    : `היי, ברוכ/ה הבא/ה! 👋 אני המאמן שלך כאן. אשאל כמה דברים קצרים ונבנה לך תוכנית מותאמת — אבל אתה גם יכול פשוט לדבר איתי חופשי, לשאול שאלות, או לדלג על כל דבר שאתה לא רוצה לענות עליו. איך קוראים לך?`;

  async function handleReadyToBuild(profile: OnboardingProfile) {
    setBuilding({ phase: 'skeleton' });
    const res = await build(profile, setBuilding);
    if (res.ok && res.sessionIds.length > 0) {
      // Also clear forceOnboarding so a future refresh doesn't reopen the wizard.
      await firestore.updateUserProfile({ onboardingCompletedAt: Date.now(), forceOnboarding: false });
      setTimeout(() => {
        onDone();
        navigate({ page: 'home' });
      }, 1600);
    }
  }

  async function handleSkip() {
    // "מדלג לעכשיו" — mark complete so we don't re-prompt on next login, but skip
    // the plan build. Anything the user did say is already persisted as profile fields.
    await firestore.updateUserProfile({ onboardingCompletedAt: Date.now(), forceOnboarding: false });
    onDone();
    navigate({ page: 'home' });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-solid" style={{ height: '100dvh' }}>
      <AiChatPanel
        uid={uid}
        mode="onboarding"
        initialAssistantMessage={greeting}
        // Stable thread id per user — always resumes the same "שיחת ההיכרות"
        // when the user re-opens onboarding from Settings, or starts a fresh
        // one for a brand-new account. Never creates a new thread on reopen.
        fixedThreadId={`onboarding_${uid}`}
        onReadyToBuild={handleReadyToBuild}
        onClose={() => setConfirmSkip(true)}
        // Inline "דלג לעכשיו" chip below the initial greeting. Auto-hides once
        // the user replies for the first time — from that point the × in the
        // header is the only escape.
        earlySkipCta={{ label: 'דלג לעכשיו', onClick: () => setConfirmSkip(true) }}
      />
      {confirmSkip && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center dark:bg-black/70 bg-black/40 p-4" onClick={() => setConfirmSkip(false)}>
          <div className="card max-w-sm w-full text-right" dir="rtl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-2">לדלג על הצ'אט?</h3>
            <p className="text-sm text-muted mb-4">
              תעבור ישר לאפליקציה. תוכל תמיד לדבר עם המאמן מהמסך הראשי, ולהגדיר פרופיל אישי בהגדרות.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmSkip(false)} className="btn-secondary flex-1 py-2.5">ביטול</button>
              <button onClick={handleSkip} className="btn-primary flex-1 py-2.5">דלג</button>
            </div>
          </div>
        </div>
      )}
      {building.phase !== 'idle' && (
        <BuildOverlay progress={building} />
      )}
    </div>
  );
}

function BuildOverlay({ progress }: { progress: BuildProgress }) {
  let title = '';
  let subtitle = '';
  let percent = 0;
  let done = false;
  let error: string | null = null;

  if (progress.phase === 'skeleton') {
    title = 'בונה את השלד של התוכנית...';
    subtitle = 'שוקל את החלוקה השבועית ואת הפוקוס לכל יום';
    percent = 15;
  } else if (progress.phase === 'days') {
    title = 'מייצר תרגילים לכל יום...';
    subtitle = `${progress.completed}/${progress.total} ימים מוכנים`;
    percent = 15 + Math.round((progress.completed / Math.max(1, progress.total)) * 80);
  } else if (progress.phase === 'done') {
    title = '✨ התוכנית מוכנה!';
    subtitle = progress.summary;
    percent = 100;
    done = true;
  } else if (progress.phase === 'error') {
    title = 'משהו השתבש';
    subtitle = progress.message;
    error = progress.message;
    percent = 0;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center dark:bg-black/70 bg-black/40 p-4">
      <div className="card max-w-sm w-full text-center" dir="rtl">
        {!error && !done && (
          <div className="mx-auto w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin mb-4" />
        )}
        {done && (
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
        )}
        {error && (
          <div className="mx-auto w-14 h-14 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mb-4 text-3xl">!</div>
        )}
        <h3 className="font-bold text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted mb-4 whitespace-pre-wrap">{subtitle}</p>
        {!error && (
          <div className="h-1.5 rounded-full dark:bg-slate-800 bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
