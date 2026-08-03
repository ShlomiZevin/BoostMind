import { useState, useEffect, useMemo } from 'react';
import type { Route, FreeSession as FreeSessionType } from './types';
import { useAuth } from './hooks/useAuth';
import { useFirestore } from './hooks/useFirestore';
import { FreeHome } from './components/FreeHome';
import { FreeSession } from './components/FreeSession';
import { FreeHistory } from './components/FreeHistory';
import { Settings } from './components/Settings';
import { Exercises } from './components/Exercises';
import { PasscodeScreen } from './components/PasscodeScreen';
import { TabBar } from './components/TabBar';
import { StartSessionModal } from './components/StartSessionModal';
import type { MuscleGroup } from './data/muscles';
import { ACTIVE_MUSCLES } from './data/muscles';

function parseHash(): Route {
  const hash = window.location.hash.slice(1);
  if (!hash || hash === '/' || hash === '/home') return { page: 'home' };
  if (hash === '/history') return { page: 'history' };
  if (hash === '/settings') return { page: 'settings' };
  if (hash === '/exercises') return { page: 'exercises' };
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
    case 'session': return `#/session/${route.sessionId}`;
    case 'session-view': return `#/session-view/${route.sessionId}`;
  }
}

const TAB_PAGES = new Set(['home', 'history', 'exercises', 'settings']);

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
      setInProgress(list.find(s => !s.completed) || null);
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

  async function handleFabClick() {
    if (inProgress) {
      navigate({ page: 'session', sessionId: inProgress.id });
    } else {
      setShowStart(true);
    }
  }

  async function handleStart(muscles: MuscleGroup[]) {
    setShowStart(false);
    const id = await firestore.createFreeSession(muscles);
    navigate({ page: 'session', sessionId: id });
  }

  const isTabPage = TAB_PAGES.has(route.page);

  let content: React.ReactNode = null;
  switch (route.page) {
    case 'home':
      content = <FreeHome uid={uid} navigate={navigate} />;
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
      {showStart && (
        <StartSessionModal
          suggested={suggested}
          weeklySets={weeklySets}
          lastWeekMuscles={lastWeekMuscles}
          onClose={() => setShowStart(false)}
          onStart={handleStart}
        />
      )}
    </>
  );
}

export default function App() {
  const { uid, login, logout: doLogout } = useAuth();
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = routeToHash(r);
  };

  if (!uid) {
    return <PasscodeScreen onUnlock={login} />;
  }

  return <AppShell uid={uid} route={route} navigate={navigate} doLogout={doLogout} />;
}
