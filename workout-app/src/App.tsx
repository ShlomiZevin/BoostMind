import { useState, useEffect, useMemo, useRef } from 'react';
import type { Route, FreeSession as FreeSessionType } from './types';
import { useAuth } from './hooks/useAuth';
import { useFirestore } from './hooks/useFirestore';
import { FreeHome } from './components/FreeHome';
import { FreeSession } from './components/FreeSession';
import { FreeHistory } from './components/FreeHistory';
import { Settings } from './components/Settings';
import { Exercises } from './components/Exercises';
import { Body } from './components/Body';
import { Install } from './components/Install';
import { LoginScreen } from './components/LoginScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { TabBar } from './components/TabBar';
import { StartSessionModal } from './components/StartSessionModal';
import { Chronograph } from './components/Chronograph';
import { useTimer } from './hooks/useTimer';
import { useStandaloneStopwatch } from './hooks/useStandaloneStopwatch';
import { useAiTrainerPanel } from './hooks/useAiTrainerPanel';
import { AiChatPanel } from './components/AiChatPanel';
import type { MuscleGroup } from './data/muscles';
import { ACTIVE_MUSCLES } from './data/muscles';

function parseHash(): Route {
  const hash = window.location.hash.slice(1);
  if (!hash || hash === '/' || hash === '/home') return { page: 'home' };
  if (hash === '/history') return { page: 'history' };
  if (hash === '/settings') return { page: 'settings' };
  if (hash === '/exercises') return { page: 'exercises' };
  if (hash === '/body') return { page: 'body' };
  if (hash === '/install') return { page: 'install' };
  if (hash.startsWith('/session-view/')) {
    const sessionId = hash.split('/')[2];
    return { page: 'session-view', sessionId };
  }
  if (hash.startsWith('/session/')) {
    const sessionId = hash.split('/')[2];
    return { page: 'session', sessionId };
  }
  return { page: 'home' };
}

function routeToHash(route: Route): string {
  switch (route.page) {
    case 'home': return '#/';
    case 'history': return '#/history';
    case 'settings': return '#/settings';
    case 'exercises': return '#/exercises';
    case 'body': return '#/body';
    case 'install': return '#/install';
    case 'session': return `#/session/${route.sessionId}`;
    case 'session-view': return `#/session-view/${route.sessionId}`;
  }
}

const TAB_PAGES = new Set(['home', 'history', 'exercises', 'body', 'settings']);

function AppShell({ uid, route, navigate, doLogout }: {
  uid: string;
  route: Route;
  navigate: (r: Route) => void;
  doLogout: () => void;
}) {
  const firestore = useFirestore(uid);
  const [inProgress, setInProgress] = useState<FreeSessionType | null>(null);
  const [allSessions, setAllSessions] = useState<FreeSessionType[]>([]);
  const [showStart, setShowStart] = useState(false);

  // Poll for session state whenever route changes to a tab page.
  useEffect(() => {
    if (!TAB_PAGES.has(route.page)) return;
    (async () => {
      const list = await firestore.getFreeSessions();
      setAllSessions(list);
      // "In progress" means genuinely started — planned sessions are NOT in-progress
      // (they live only on Home until the user hits "התחל").
      setInProgress(list.find(s => s.status === 'active') || null);
    })();
  }, [route, uid]);

  // Weekly-sets and suggestions for StartSessionModal
  const weeklySets = useMemo(() => {
    const weekStart = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay());
      return d.getTime();
    })();
    const counts: Partial<Record<MuscleGroup, number>> = {};
    for (const sess of allSessions) {
      if (sess.date < weekStart) continue;
      for (const set of sess.sets) counts[set.muscle] = (counts[set.muscle] || 0) + 1;
    }
    return counts;
  }, [allSessions]);

  const suggested = useMemo(() => {
    const sorted = ACTIVE_MUSCLES
      .map(m => ({ id: m.id, done: weeklySets[m.id] || 0 }))
      .sort((a, b) => a.done - b.done);
    return sorted.slice(0, 4).map(x => x.id);
  }, [weeklySets]);

  // Muscles trained EXACTLY 7 days ago (± 12h) — great "same day last week" cue
  const lastWeekMuscles = useMemo(() => {
    const now = new Date();
    const target = now.getTime() - 7 * 86_400_000;
    const window = 12 * 3600_000;
    const found = new Set<MuscleGroup>();
    for (const sess of allSessions) {
      if (Math.abs(sess.date - target) > window) continue;
      for (const s of sess.sets) {
        if (s.weight > 0 || s.reps > 0) found.add(s.muscle);
      }
    }
    return found;
  }, [allSessions]);

  // Muscles trained in the last 24-48h — heads up so you don't hit them again too soon
  const recentMuscles = useMemo(() => {
    const cutoff = Date.now() - 48 * 3600_000;
    const found = new Set<MuscleGroup>();
    for (const sess of allSessions) {
      if (sess.date < cutoff) continue;
      for (const s of sess.sets) {
        if (s.weight > 0 || s.reps > 0) found.add(s.muscle);
      }
    }
    return found;
  }, [allSessions]);

  // Timestamp of the MOST-RECENT real set per muscle across all history.
  // Feeds the "אומן לפני N ימים" line on each tile in StartSessionModal.
  const lastTrainedByMuscle = useMemo(() => {
    const map: Partial<Record<MuscleGroup, number>> = {};
    for (const sess of allSessions) {
      for (const s of sess.sets) {
        if (s.weight === 0 && s.reps === 0) continue;
        const ts = s.timestamp || sess.date;
        const prev = map[s.muscle];
        if (prev === undefined || ts > prev) map[s.muscle] = ts;
      }
    }
    return map;
  }, [allSessions]);

  // If a completed session for TODAY exists, offer to return to it rather than starting a new one.
  const todaysCompleted = useMemo(() => {
    const midnight = new Date(); midnight.setHours(0,0,0,0);
    const start = midnight.getTime();
    const end = start + 86_400_000;
    return allSessions.find(s => s.status === 'completed' && (s.completedAt || s.date) >= start && (s.completedAt || s.date) < end) || null;
  }, [allSessions]);
  const [sameDayPrompt, setSameDayPrompt] = useState(false);

  async function handleFabClick() {
    // Re-fetch before deciding. Local `inProgress` can be stale — e.g. Home just deleted the
    // active session and App's state hasn't been re-polled (poll is on route-change only).
    // Without this we'd navigate to a deleted session and hit "session not found".
    const list = await firestore.getFreeSessions();
    setAllSessions(list);
    const freshActive = list.find(s => s.status === 'active') || null;
    setInProgress(freshActive);
    if (freshActive) {
      navigate({ page: 'session', sessionId: freshActive.id });
      return;
    }
    const midnight = new Date(); midnight.setHours(0,0,0,0);
    const start = midnight.getTime();
    const end = start + 86_400_000;
    const freshDoneToday = list.find(s => s.status === 'completed' && (s.completedAt || s.date) >= start && (s.completedAt || s.date) < end) || null;
    if (freshDoneToday) {
      setSameDayPrompt(true);
      return;
    }
    setShowStart(true);
  }

  async function handleStart(muscles: MuscleGroup[]) {
    setShowStart(false);
    const id = await firestore.createFreeSession(muscles);
    navigate({ page: 'session', sessionId: id });
  }

  async function handleReturnToTodays() {
    if (!todaysCompleted) return;
    setSameDayPrompt(false);
    await firestore.reactivateFreeSession(todaysCompleted.id);
    navigate({ page: 'session', sessionId: todaysCompleted.id });
  }

  // Standalone stopwatch — controlled by the TopBar toggle. Auto-hides during live sessions
  // (FreeSession renders its own Chronograph then).
  const { open: stopwatchOpen, set: setStopwatchOpen } = useStandaloneStopwatch();
  const standaloneTimer = useTimer();
  const showStandaloneStopwatch = stopwatchOpen && !inProgress && TAB_PAGES.has(route.page);

  // AI trainer panel — opened from the TopBar action on any tab page. General-purpose
  // coach chat (no live-session context). Rendered here at app-shell level so it can
  // overlay the current tab uniformly.
  const { open: aiPanelOpen, closePanel: closeAiPanel } = useAiTrainerPanel();

  const isTabPage = TAB_PAGES.has(route.page);

  let content: React.ReactNode = null;
  switch (route.page) {
    case 'home':
      content = <FreeHome uid={uid} navigate={navigate} onStartRequest={handleFabClick} />;
      break;
    case 'session':
      content = <FreeSession key={route.sessionId} uid={uid} sessionId={route.sessionId} navigate={navigate} />;
      break;
    case 'session-view':
      content = <FreeSession key={route.sessionId} uid={uid} sessionId={route.sessionId} navigate={navigate} historical />;
      break;
    case 'history':
      content = <FreeHistory uid={uid} navigate={navigate} />;
      break;
    case 'settings':
      content = <Settings uid={uid} navigate={navigate} onLogout={doLogout} />;
      break;
    case 'exercises':
      content = <Exercises uid={uid} navigate={navigate} />;
      break;
    case 'body':
      content = <Body uid={uid} navigate={navigate} />;
      break;
    case 'install':
      content = <Install navigate={navigate} />;
      break;
  }

  return (
    <>
      {/* Reserve room at the bottom so tab bar never overlaps content */}
      <div className={isTabPage ? 'pb-24' : ''}>
        {content}
      </div>
      {isTabPage && (
        <TabBar
          current={route.page as any}
          onNavigate={navigate}
          hasInProgress={!!inProgress}
          onFabClick={handleFabClick}
        />
      )}

      {/* Standalone stopwatch — floats globally; opened/closed via the TopBar toggle next to Settings.
          Automatically hidden when a live session is active (session has its own Chronograph). */}
      {showStandaloneStopwatch && (
        <Chronograph
          standalone
          sessionStartMs={Date.now()}
          restRemaining={standaloneTimer.remaining}
          restIsRunning={standaloneTimer.isRunning}
          restIsDone={standaloneTimer.isDone}
          onRestSkip={standaloneTimer.skip}
          onRestAdd={standaloneTimer.addTime}
          onRestStart={(s) => standaloneTimer.start(s)}
          onDismiss={() => setStopwatchOpen(false)}
        />
      )}
      {showStart && (
        <StartSessionModal
          suggested={suggested}
          weeklySets={weeklySets}
          lastWeekMuscles={lastWeekMuscles}
          recentMuscles={recentMuscles}
          lastTrainedByMuscle={lastTrainedByMuscle}
          onClose={() => setShowStart(false)}
          onStart={handleStart}
        />
      )}
      {aiPanelOpen && (
        <AiChatPanel
          uid={uid}
          mode="trainer"
          // Feed the trainer everything it needs to answer both "מה עשיתי השבוע?"
          // and "מה מתוכנן לי" questions. Sessions in allSessions are sorted
          // newest-first — take past 30 for history + all planned for schedule.
          recentSets={allSessions.slice(0, 30).flatMap(s => s.sets || [])}
          plannedSessions={allSessions.filter(s => s.status === 'planned')}
          onClose={closeAiPanel}
        />
      )}
      {sameDayPrompt && todaysCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4" onClick={() => setSameDayPrompt(false)}>
          <div className="card max-w-sm w-full text-right" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-emerald-600 dark:text-emerald-400 mb-2">כבר סיימת אימון היום</h3>
            <p className="text-sm text-muted mb-4">
              יש לך אימון שסיימת היום — {todaysCompleted.sets.filter(s => s.weight > 0 || s.reps > 0).length} סטים.
              נחזור אליו כדי להוסיף עוד?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSameDayPrompt(false)}
                className="btn-secondary flex-1 py-3"
              >ביטול</button>
              <button
                onClick={handleReturnToTodays}
                className="btn-primary flex-1 py-3"
              >חזור לאימון</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const { uid, loading, displayName, login, logout: doLogout } = useAuth();
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = routeToHash(r);
  };

  // Wait for Firebase Auth to hydrate before deciding what to show — otherwise we'd
  // briefly flash the login screen on every reload even for signed-in users.
  if (loading) {
    return <div className="page-bg" />;
  }

  if (!uid) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <AuthedShell
      uid={uid}
      displayName={displayName}
      route={route}
      navigate={navigate}
      doLogout={doLogout}
    />
  );
}

// Wraps AppShell with the empty-account check → onboarding gate.
// Kept as a separate component so the empty-account probe re-runs when uid changes
// (i.e. after login) without racing the AppShell mount.
function AuthedShell({ uid, displayName, route, navigate, doLogout }: {
  uid: string;
  displayName: string | null;
  route: Route;
  navigate: (r: Route) => void;
  doLogout: () => void;
}) {
  const firestore = useFirestore(uid);
  // 'checking' → probe hasn't returned yet; 'onboarding' → new user, show wizard;
  // 'ready' → normal app. We probe once per uid.
  const [status, setStatus] = useState<'checking' | 'onboarding' | 'ready'>('checking');
  // Stash firestore in a ref so the effect doesn't re-fire on every render.
  // (useFirestore returns a fresh object literal each render — depending on it in
  // deps would cause an infinite re-probe loop that kept status stuck at 'checking'
  // and rendered a permanent white page.)
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  useEffect(() => {
    let cancelled = false;
    firestoreRef.current.shouldShowOnboarding()
      .then(show => {
        if (cancelled) return;
        setStatus(show ? 'onboarding' : 'ready');
      })
      .catch(err => {
        console.warn('shouldShowOnboarding failed, defaulting to ready', err);
        if (!cancelled) setStatus('ready');
      });
    return () => { cancelled = true; };
  }, [uid]);

  if (status === 'checking') {
    return <div className="page-bg" />;
  }

  if (status === 'onboarding') {
    return (
      <OnboardingScreen
        uid={uid}
        displayName={displayName}
        navigate={navigate}
        onDone={() => setStatus('ready')}
      />
    );
  }

  return <AppShell uid={uid} route={route} navigate={navigate} doLogout={doLogout} />;
}
