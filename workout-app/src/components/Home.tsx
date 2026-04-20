import { useEffect, useState } from 'react';
import type { Route } from '../types';
import { useProgram, getAutoWeek } from '../hooks/useProgram';
import { useFirestore } from '../hooks/useFirestore';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
  initialWeek?: number;
};

export function Home({ uid, navigate, initialWeek }: Props) {
  const autoWeek = getAutoWeek();
  const [selectedWeek, setSelectedWeek] = useState(initialWeek || autoWeek);
  const { program, weekNumber, phase, totalWeeks } = useProgram(selectedWeek);
  const { getSessions, resetProgram } = useFirestore(uid);
  const [showReset, setShowReset] = useState(false);
  const [dayHistory, setDayHistory] = useState<Record<string, string[]>>({}); // "day_week" -> dates
  const [allDayDates, setAllDayDates] = useState<Record<number, string[]>>({}); // day -> all dates ever
  const [todayCompleted, setTodayCompleted] = useState<Record<number, string>>({});
  const [lastCompletedId, setLastCompletedId] = useState<Record<string, string>>({});
  const [incompleteDays, setIncompleteDays] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const history: Record<string, string[]> = {};
      const allDates: Record<number, string[]> = {};
      const todayDone: Record<number, string> = {};
      const weekCompleted: Record<string, string> = {};
      const incomplete: Record<string, string> = {};
      const today = new Date().toDateString();

      try {
        const allSessions = await getSessions();
        for (const s of allSessions) {
          const d = s.day;
          // Use completedAt if available, fallback to date
          const displayDate = s.completed && s.completedAt ? s.completedAt : s.date;
          const dateStr = (() => { const _d = new Date(displayDate); return `${_d.getDate()}/${_d.getMonth()+1}`; })();

          if (s.completed) {
            // Per-week history
            const hKey = `${d}_${s.weekNumber}`;
            if (!history[hKey]) history[hKey] = [];
            if (!history[hKey].includes(dateStr)) history[hKey].push(dateStr);
            // All-time history per day
            if (!allDates[d]) allDates[d] = [];
            if (!allDates[d].includes(dateStr)) allDates[d].push(dateStr);
            // Track per week
            weekCompleted[`${d}_${s.weekNumber}`] = s.id;
            // Track if completed today
            if (new Date(displayDate).toDateString() === today) {
              todayDone[d] = s.id;
            }
          } else {
            const key = `${d}_${s.weekNumber}`;
            if (s.sets.length > 0 && !incomplete[key]) {
              incomplete[key] = s.id;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load sessions', e);
      }

      setDayHistory(history);
      setAllDayDates(allDates);
      setTodayCompleted(todayDone);
      setLastCompletedId(weekCompleted);
      setIncompleteDays(incomplete);
    })();
  }, []);

  const progressPct = Math.round((weekNumber / totalWeeks) * 100);
  const isCurrentWeek = selectedWeek === autoWeek;

  // Week date range from schedule
  const formatShort = (d: Date) => `${d.getDate()}/${d.getMonth()+1}`;
  const programStart = new Date(program.startDate);
  const scheduleStart = new Date(programStart.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
  const scheduleEnd = new Date(scheduleStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  // Collect all dates from the green boxes for this week to show actual range
  const allWeekDates: string[] = [];
  for (const day of program.days) {
    const hist = dayHistory[`${day.day}_${weekNumber}`];
    if (hist) allWeekDates.push(...hist);
  }
  // Dedupe
  const uniqueDates = [...new Set(allWeekDates)];
  const weekRange = uniqueDates.length > 0
    ? (uniqueDates.length === 1 ? uniqueDates[0] : `${uniqueDates[uniqueDates.length - 1]} – ${uniqueDates[0]}`)
    : `${formatShort(scheduleStart)} – ${formatShort(scheduleEnd)}`;

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
              <div className="text-[10px] text-muted mt-0.5">{weekRange}</div>
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
              const weekSessionId = lastCompletedId[`${day.day}_${weekNumber}`];
              if (incompleteDays[`${day.day}_${weekNumber}`]) {
                navigate({ page: 'workout', day: day.day, sessionId: incompleteDays[`${day.day}_${weekNumber}`], week: weekNumber });
              } else if (weekSessionId) {
                navigate({ page: 'workout', day: day.day, sessionId: weekSessionId, week: weekNumber });
              } else {
                navigate({ page: 'workout', day: day.day, week: weekNumber });
              }
            }}
            className="w-full card dark:hover:bg-slate-800 hover:bg-slate-50 active:opacity-80 transition-colors text-left flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 dark:text-emerald-400 font-bold text-lg">Day {day.day}</span>
                {incompleteDays[`${day.day}_${weekNumber}`] ? (
                  <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px]">RESUME</span>
                ) : lastCompletedId[`${day.day}_${weekNumber}`] ? (
                  <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px]">
                    ✓ DONE
                  </span>
                ) : null}
              </div>
              <div className="text-sm font-medium">{day.title}</div>
              {day.titleHe && (
                <div className="text-xs text-muted" dir="rtl">{day.titleHe}</div>
              )}
            </div>
            <div className="text-right shrink-0 ml-3 max-w-[130px]">
              {(() => {
                const thisWeekDates = dayHistory[`${day.day}_${weekNumber}`] || [];
                const allDates = allDayDates[day.day] || [];
                const prevDates = allDates.filter(d => !thisWeekDates.includes(d));
                return (
                  <div>
                    {thisWeekDates.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {thisWeekDates.map((d, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 whitespace-nowrap">
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                    {prevDates.length > 0 && (
                      <div className="mt-1">
                        <div className="text-[8px] text-muted-most">Prev</div>
                        <div className="flex flex-wrap gap-0.5 justify-end">
                          {prevDates.map((d, i) => (
                            <span key={i} className="text-[8px] px-1 py-0.5 rounded bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 whitespace-nowrap">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {thisWeekDates.length === 0 && prevDates.length === 0 && (
                      <span className="text-xs text-muted-most">—</span>
                    )}
                  </div>
                );
              })()}
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
                  setShowReset(false);
                  setLastCompletedId({});
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
