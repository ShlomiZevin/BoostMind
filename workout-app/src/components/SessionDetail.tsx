import { useEffect, useState } from 'react';
import type { Route, Session } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { PROGRAM } from '../data/program';

type Props = {
  uid: string;
  sessionId: string;
  navigate: (route: Route) => void;
};

export function SessionDetail({ uid, sessionId, navigate }: Props) {
  const { getSession } = useFirestore(uid);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession(sessionId).then(s => {
      setSession(s);
      setLoading(false);
    });
  }, [sessionId]);

  if (loading) return <div className="page-bg flex items-center justify-center text-muted">Loading...</div>;
  if (!session) return <div className="page-bg flex items-center justify-center text-muted">Session not found</div>;

  const dayConfig = PROGRAM.days.find(d => d.day === session.day);

  const grouped: Record<string, typeof session.sets> = {};
  for (const s of session.sets) {
    if (!grouped[s.exerciseId]) grouped[s.exerciseId] = [];
    grouped[s.exerciseId].push(s);
  }

  return (
    <div className="page-bg p-4 pb-20 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate({ page: 'history' })} className="text-muted text-2xl">←</button>
        <div>
          <h1 className="text-xl font-bold">Day {session.day} — W{session.weekNumber}</h1>
          <p className="text-xs text-muted">
            {new Date(session.date).toLocaleDateString('he-IL', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {dayConfig?.exercises.map(ex => {
        const sets = grouped[ex.id] || [];
        if (sets.length === 0) return null;

        return (
          <div key={ex.id} className="card mb-3">
            <h3 className="font-semibold text-sm mb-2">{ex.name}</h3>
            <div className="space-y-1">
              {sets.map((s, i) => (
                <div key={i} className="flex justify-between text-xs text-muted font-mono">
                  <span>Set {s.setNumber}</span>
                  {ex.isUnilateral && !ex.isTimeBased && (
                    <span>L {s.repsLeft}×{s.weightLeft}kg · R {s.repsRight}×{s.weightRight}kg</span>
                  )}
                  {!ex.isUnilateral && !ex.isTimeBased && (
                    <span>{s.reps}×{s.weight}kg</span>
                  )}
                  {ex.isTimeBased && ex.isUnilateral && (
                    <span>L {s.durationLeftSeconds}s · R {s.durationRightSeconds}s</span>
                  )}
                  {ex.isTimeBased && !ex.isUnilateral && (
                    <span>{s.durationSeconds}s</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
