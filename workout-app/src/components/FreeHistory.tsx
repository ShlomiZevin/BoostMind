import { useEffect, useState } from 'react';
import type { Route, FreeSession } from '../types';
import { MUSCLE_BY_ID, MUSCLE_CLASSES, effectiveMuscles } from '../data/muscles';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { SettingsGearAction } from './TopBarActions';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
};

export function FreeHistory({ uid, navigate }: Props) {
  const firestore = useFirestore(uid);
  const [sessions, setSessions] = useState<FreeSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    firestore.getFreeSessions().then(s => {
      setSessions(s.filter(x => x.completed));
      setLoading(false);
    });
  }, []);

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="היסטוריה"
        subtitle={sessions.length > 0 ? `${sessions.length} אימונים` : undefined}
        accent="brand"
        tint="blue"
        actions={<SettingsGearAction navigate={navigate} />}
      />
      <div className="p-4 pb-4 max-w-lg mx-auto">

      {loading && <div className="text-muted text-center py-8">Loading...</div>}
      {!loading && sessions.length === 0 && (
        <div className="text-muted text-center py-8" dir="rtl">אין עדיין אימונים</div>
      )}

      <div className="space-y-2">
        {sessions.map(s => {
          const d = new Date(s.completedAt || s.date);
          const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
          const dowStr = d.toLocaleDateString('he-IL', { weekday: 'short' });
          const realSets = s.sets.filter(x => x.weight > 0 || x.reps > 0);
          const setsPerMuscle = new Map<string, number>();
          for (const set of realSets) setsPerMuscle.set(set.muscle, (setsPerMuscle.get(set.muscle) || 0) + 1);
          const muscles = effectiveMuscles(s.muscleGroups, s.sets);
          const uniqExercises = new Set(realSets.map(x => (x.exerciseName || '').toLowerCase()).filter(Boolean)).size;
          return (
            <div
              key={s.id}
              className="card text-right dark:hover:bg-slate-800 hover:bg-slate-50"
              dir="rtl"
            >
              <button
                onClick={() => navigate({ page: 'session-view', sessionId: s.id })}
                className="w-full text-right"
                dir="rtl"
              >
                <div className="flex items-center justify-between mb-2" dir="rtl">
                  <span className="text-sm font-semibold">{dowStr}</span>
                  <span className="text-[10px] text-muted font-mono" dir="ltr">{dateStr}</span>
                </div>
                <div className="flex gap-1 flex-wrap justify-start mb-1.5" dir="rtl">
                  {muscles.map(id => {
                    const m = MUSCLE_BY_ID[id];
                    if (!m) return null;
                    const c = MUSCLE_CLASSES[m.color];
                    const count = setsPerMuscle.get(id) || 0;
                    return (
                      <span key={id} className={`text-[10px] px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>
                        {m.he} <span className="font-mono opacity-70">· {count}</span>
                      </span>
                    );
                  })}
                </div>
                <div className="text-xs text-muted text-right flex items-center gap-1.5 justify-end" dir="rtl">
                  <span className="font-mono font-semibold text-main">{uniqExercises}</span>
                  <span>תרגילים</span>
                  <span className="text-muted-most">·</span>
                  <span className="font-mono font-semibold text-main">{realSets.length}</span>
                  <span>סטים</span>
                </div>
              </button>
              <div className="flex justify-end mt-2 pt-2 border-t border-subtle/60">
                <button
                  onClick={async () => {
                    const newId = await firestore.duplicateFreeSession(s.id);
                    if (newId) navigate({ page: 'session', sessionId: newId });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold
                             px-3 py-1.5 rounded-full
                             dark:bg-emerald-900/40 bg-emerald-100
                             text-emerald-700 dark:text-emerald-300
                             dark:hover:bg-emerald-900/60 hover:bg-emerald-200 transition-colors"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="12" height="12" rx="2" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                  <span>שכפל אימון</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
