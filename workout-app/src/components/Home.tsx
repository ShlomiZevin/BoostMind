import { useEffect, useState } from 'react';
import type { Route } from '../types';
import { useProgram, getAutoWeek } from '../hooks/useProgram';
import { useFirestore } from '../hooks/useFirestore';
import { getActiveSession, clearActiveSession } from '../hooks/useActiveSession';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
};

export function Home({ uid, navigate }: Props) {
  const autoWeek = getAutoWeek();
  const [selectedWeek, setSelectedWeek] = useState(autoWeek);
  const { program, weekNumber, phase, totalWeeks } = useProgram(selectedWeek);
  const { getLastSessionForDay, getIncompleteSession, resetProgram } = useFirestore(uid);
  const [showReset, setShowReset] = useState(false);
  const [lastDates, setLastDates] = useState<Record<number, string>>({});
  const [incompleteDays, setIncompleteDays] = useState<Record<number, string>>({});

  useEffect(() => {
    const localIncomplete: Record<number, string> = {};
    for (const day of program.days) {
      const localId = getActiveSession(day.day);
      if (localId) {
        localIncomplete[day.day] = localId;
      }
    }
    setIncompleteDays(localIncomplete);

    (async () => {
      const dates: Record<number, string> = {};
      const incomplete: Record<number, string> = { ...localIncomplete };
      for (const day of program.days) {
        try {
          if (!incomplete[day.day]) {
            const inc = await getIncompleteSession(day.day);
            if (inc) {
              incomplete[day.day] = inc.id;
            }
          }
          const last = await getLastSessionForDay(day.day);
          if (last) {
            dates[day.day] = new Date(last.date).toLocaleDateString('he-IL', {
              day: 'numeric', month: 'short',
            });
          }
        } catch (e) {
          console.warn('Failed to load session for day', day.day, e);
        }
      }
      setLastDates(dates);
      setIncompleteDays(incomplete);
    })();
  }, []);

  const progressPct = Math.round((weekNumber / totalWeeks) * 100);
  const isCurrentWeek = selectedWeek === autoWeek;

  return (
    <div className="page-bg p-4 pb-20 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-1">Workout Logger</h1>
        <p className="text-muted text-sm">{program.name}</p>
      </div>

      {/* Week / Phase card */}
      <div className="card mb-6">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedWeek(w => Math.max(1, w - 1))}
              className={`text-2xl w-8 h-8 flex items-center justify-center rounded-lg ${
                selectedWeek <= 1 ? 'text-muted-most' : 'text-muted btn-icon'
              }`}
              disabled={selectedWeek <= 1}
            >
              ‹
            </button>
            <div className="text-center">
              <span className="text-3xl font-bold text-emerald-500 dark:text-emerald-400">Week {weekNumber}</span>
              <span className="text-muted text-lg"> / {totalWeeks}</span>
              {!isCurrentWeek && (
                <button
                  onClick={() => setSelectedWeek(autoWeek)}
                  className="block text-[10px] text-blue-500 dark:text-blue-400 mt-0.5 mx-auto"
                >
                  ← back to current (W{autoWeek})
                </button>
              )}
            </div>
            <button
              onClick={() => setSelectedWeek(w => Math.min(totalWeeks, w + 1))}
              className={`text-2xl w-8 h-8 flex items-center justify-center rounded-lg ${
                selectedWeek >= totalWeeks ? 'text-muted-most' : 'text-muted btn-icon'
              }`}
              disabled={selectedWeek >= totalWeeks}
            >
              ›
            </button>
          </div>
          <div className="text-right">
            <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Phase {phase.phase}</span>
            <div className="text-xs text-muted mt-1">Tempo {phase.tempo}</div>
            <div className="text-xs text-muted">Rest {phase.restSeconds}s</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full dark:bg-slate-800 bg-slate-200 rounded-full h-2">
          <div
            className="bg-emerald-500 h-2 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Day buttons */}
      <div className="space-y-3 mb-6">
        {program.days.map(day => (
          <button
            key={day.day}
            onClick={() => {
              if (incompleteDays[day.day]) {
                navigate({ page: 'workout', day: day.day, sessionId: incompleteDays[day.day] });
              } else {
                navigate({ page: 'workout', day: day.day });
              }
            }}
            className="w-full card dark:hover:bg-slate-800 hover:bg-slate-50 active:opacity-80 transition-colors text-left flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 dark:text-emerald-400 font-bold text-lg">Day {day.day}</span>
                {incompleteDays[day.day] && (
                  <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px]">RESUME</span>
                )}
              </div>
              <div className="text-sm font-medium">{day.title}</div>
              {day.titleHe && (
                <div className="text-xs text-muted" dir="rtl">{day.titleHe}</div>
              )}
            </div>
            <div className="text-right shrink-0 ml-3">
              {lastDates[day.day] ? (
                <span className="text-xs text-muted">{lastDates[day.day]}</span>
              ) : (
                <span className="text-xs text-muted-most">—</span>
              )}
              <div className="text-muted-most text-xl mt-1">›</div>
            </div>
          </button>
        ))}
      </div>

      {/* Bottom links */}
      <div className="flex gap-3 mb-4">
        <button onClick={() => navigate({ page: 'program-info' })} className="btn-secondary flex-1 text-center">Program Info</button>
        <button onClick={() => navigate({ page: 'history' })} className="btn-secondary flex-1 text-center">History</button>
        <button onClick={() => navigate({ page: 'settings' })} className="btn-secondary flex-1 text-center">Settings</button>
      </div>

      {/* Reset program */}
      <div className="text-center">
        <button onClick={() => setShowReset(true)} className="text-xs text-muted-most hover:text-red-400 transition-colors">
          Reset Program
        </button>
      </div>

      {/* Reset confirm dialog */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full">
            <h3 className="font-bold text-red-500 mb-2">Reset Program?</h3>
            <p className="text-sm text-muted mb-4">
              This will delete all sessions and exercise stats. You'll start fresh. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowReset(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={async () => {
                  await resetProgram();
                  for (let d = 1; d <= 5; d++) clearActiveSession(d);
                  setShowReset(false);
                  setLastDates({});
                  setIncompleteDays({});
                }}
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-500"
              >Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
