import { useEffect, useState } from 'react';
import type { Route, Session } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { PROGRAM } from '../data/program';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
};

export function History({ uid, navigate }: Props) {
  const { getSessions } = useFirestore(uid);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessions().then(s => {
      setSessions(s);
      setLoading(false);
    });
  }, []);

  const dayTitle = (day: number) => {
    const d = PROGRAM.days.find(dd => dd.day === day);
    return d ? d.title : `Day ${day}`;
  };

  return (
    <div className="page-bg p-4 pb-20 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate({ page: 'home' })} className="text-muted text-2xl">←</button>
        <h1 className="text-xl font-bold">History</h1>
      </div>

      {loading ? (
        <div className="text-center text-muted py-12">Loading...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center text-muted py-12">
          <div className="text-4xl mb-2">🏋️</div>
          <p>No workouts yet. Get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => navigate({ page: 'session-detail', sessionId: session.id })}
              className="w-full card dark:hover:bg-slate-800 hover:bg-slate-50 transition-colors text-left flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500 dark:text-emerald-400 font-semibold">Day {session.day}</span>
                  <span className="text-muted text-sm">W{session.weekNumber} · P{session.phase}</span>
                  {!session.completed && (
                    <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px]">INCOMPLETE</span>
                  )}
                  {session.completed && (
                    <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px]">✓</span>
                  )}
                </div>
                <div className="text-sm text-muted">{dayTitle(session.day)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted">
                  {(() => { const _d = new Date(session.date); return `${_d.getDate()}/${_d.getMonth()+1}/${_d.getFullYear()}`; })()}
                </div>
                <div className="text-xs text-muted-most mt-0.5">
                  {session.sets.length} sets
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
