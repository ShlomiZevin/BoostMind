import { useState, useEffect } from 'react';
import type { Route } from './types';
import { useAuth } from './hooks/useAuth';
import { Home } from './components/Home';
import { ProgramInfo } from './components/ProgramInfo';
import { Workout } from './components/Workout';
import { History } from './components/History';
import { SessionDetail } from './components/SessionDetail';
import { Settings } from './components/Settings';

function parseHash(): Route {
  const hash = window.location.hash.slice(1);
  if (!hash || hash === '/') return { page: 'home' };
  if (hash === '/program-info') return { page: 'program-info' };
  if (hash === '/history') return { page: 'history' };
  if (hash === '/settings') return { page: 'settings' };
  if (hash.startsWith('/workout/')) {
    const parts = hash.split('/');
    const day = Number(parts[2]) as 1 | 2 | 3 | 4 | 5;
    const sessionId = parts[3] || undefined;
    return { page: 'workout', day, sessionId };
  }
  if (hash.startsWith('/session/')) {
    const sessionId = hash.split('/')[2];
    return { page: 'session-detail', sessionId };
  }
  return { page: 'home' };
}

function routeToHash(route: Route): string {
  switch (route.page) {
    case 'home': return '#/';
    case 'program-info': return '#/program-info';
    case 'history': return '#/history';
    case 'settings': return '#/settings';
    case 'workout': return `#/workout/${route.day}${route.sessionId ? '/' + route.sessionId : ''}`;
    case 'session-detail': return `#/session/${route.sessionId}`;
  }
}

export default function App() {
  const { uid, loading: authLoading } = useAuth();
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = routeToHash(r);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Auth failed. Refresh to retry.</div>
      </div>
    );
  }

  switch (route.page) {
    case 'home':
      return <Home uid={uid} navigate={navigate} />;
    case 'program-info':
      return <ProgramInfo navigate={navigate} />;
    case 'workout':
      return <Workout key={route.day + (route.sessionId || '')} uid={uid} day={route.day} existingSessionId={route.sessionId} navigate={navigate} />;
    case 'history':
      return <History uid={uid} navigate={navigate} />;
    case 'session-detail':
      return <SessionDetail uid={uid} sessionId={route.sessionId} navigate={navigate} />;
    case 'settings':
      return <Settings navigate={navigate} />;
  }
}
