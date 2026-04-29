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
  const { getSession, updateSessionDates } = useFirestore(uid);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession(sessionId).then(s => {
      setSession(s);
      setLoading(false);
    });
  }, [sessionId]);

  function toDateInput(ts: number): string {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function fromDateInput(value: string, hour: number, min: number): number {
    const [yyyy, mm, dd] = value.split('-').map(Number);
    return new Date(yyyy, mm - 1, dd, hour, min).getTime();
  }

  async function handleDateChange(field: 'date' | 'completedAt', newDateValue: string) {
    if (!session) return;
    const old = field === 'date' ? session.date : session.completedAt;
    const oldDate = old ? new Date(old) : new Date();
    const newTs = fromDateInput(newDateValue, oldDate.getHours(), oldDate.getMinutes());
    await updateSessionDates(session.id, { [field]: newTs });
    setSession({ ...session, [field]: newTs });
  }

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
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate({ page: 'history' })} className="text-muted text-2xl">←</button>
        <div>
          <h1 className="text-xl font-bold">Day {session.day} — W{session.weekNumber}</h1>
        </div>
      </div>

      <div className="card mb-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted uppercase tracking-wider">Started</span>
          <input
            type="date"
            value={toDateInput(session.date)}
            onChange={e => handleDateChange('date', e.target.value)}
            className="input-field !text-xs !py-1 !px-2 !w-auto"
          />
        </div>
        {session.completedAt && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-muted uppercase tracking-wider">Completed</span>
            <input
              type="date"
              value={toDateInput(session.completedAt)}
              onChange={e => handleDateChange('completedAt', e.target.value)}
              className="input-field !text-xs !py-1 !px-2 !w-auto"
            />
          </div>
        )}
      </div>

      {dayConfig?.exercises.map(ex => {
        const sets = grouped[ex.id] || [];
        const isSkipped = (session.skippedExerciseIds || []).includes(ex.id);
        if (sets.length === 0 && !isSkipped) return null;

        if (sets.length === 0 && isSkipped) {
          return (
            <div key={ex.id} className="card mb-3 opacity-60">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{ex.name}</h3>
                <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-[10px]">⊘ SKIPPED</span>
              </div>
            </div>
          );
        }

        return (
          <div key={ex.id} className="card mb-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-sm">{ex.name}</h3>
              {isSkipped && <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-[10px]">⊘ SKIPPED</span>}
            </div>
            <div className="space-y-1">
              {sets.map((s, i) => (
                <div key={i} className="flex justify-between text-xs text-muted font-mono">
                  <span>Set {s.setNumber}</span>
                  {ex.isUnilateral && !ex.isTimeBased && (
                    <span>L {s.repsLeft}×{s.weightLeft}{s.unit || 'kg'} · R {s.repsRight}×{s.weightRight}{s.unit || 'kg'}</span>
                  )}
                  {!ex.isUnilateral && !ex.isTimeBased && (
                    <span>{s.reps}×{s.weight}{s.unit || 'kg'}</span>
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
