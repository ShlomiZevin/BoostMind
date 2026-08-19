import { useEffect, useMemo, useRef, useState } from 'react';
import type { MealLog, Route, UserProfile } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { FoodAiAction, SettingsGearAction } from './TopBarActions';
import { caloriesOn, effectiveTargetOf, startOfDay } from '../data/diet';

type Props = { uid: string; navigate: (r: Route) => void; refreshKey?: number; onOpenChat: () => void };

// Same range vocabulary as גוף — one filter language across the app.
type RangeKey = 'last-7d' | 'this-week' | 'previous-week' | 'last-30d' | 'this-month' | 'previous-month';
const RANGE_ORDER: { key: RangeKey; label: string }[] = [
  { key: 'last-7d',        label: '7 ימים אחרונים' },
  { key: 'this-week',      label: 'שבוע נוכחי' },
  { key: 'previous-week',  label: 'שבוע שעבר' },
  { key: 'last-30d',       label: '30 ימים אחרונים' },
  { key: 'this-month',     label: 'חודש נוכחי' },
  { key: 'previous-month', label: 'חודש שעבר' },
];

/** Day buckets for a range, oldest -> newest. */
function daysOfRange(key: RangeKey): number[] {
  const today = startOfDay();
  const out: number[] = [];
  const push = (from: number, to: number) => {
    for (let t = from; t <= to; t += 86_400_000) out.push(t);
  };
  switch (key) {
    case 'last-7d':  push(today - 6 * 86_400_000, today); break;
    case 'last-30d': push(today - 29 * 86_400_000, today); break;
    case 'this-week': {
      const d = new Date(today); d.setDate(d.getDate() - d.getDay());
      push(startOfDay(d), today); break;
    }
    case 'previous-week': {
      const d = new Date(today); d.setDate(d.getDate() - d.getDay() - 7);
      const start = startOfDay(d);
      push(start, start + 6 * 86_400_000); break;
    }
    case 'this-month': {
      const n = new Date(today);
      push(startOfDay(new Date(n.getFullYear(), n.getMonth(), 1)), today); break;
    }
    case 'previous-month': {
      const n = new Date(today);
      const start = startOfDay(new Date(n.getFullYear(), n.getMonth() - 1, 1));
      const end = startOfDay(new Date(n.getFullYear(), n.getMonth(), 1)) - 86_400_000;
      push(start, end); break;
    }
  }
  return out;
}

// Streaks are computed on demand from the log — no separate collection until we
// see that it's actually slow.
function streakOf(logs: MealLog[], ok: (dayLogs: MealLog[]) => boolean): number {
  let n = 0;
  for (let i = 0; i < 120; i++) {
    const start = startOfDay(new Date(Date.now() - i * 86_400_000));
    const dayLogs = logs.filter(l => l.timestamp >= start && l.timestamp < start + 86_400_000);
    // A day with nothing logged breaks the chain rather than silently counting —
    // an unlogged day is unknown, not clean.
    if (dayLogs.length === 0) {
      if (i === 0) continue; // today may simply not have started yet
      break;
    }
    if (!ok(dayLogs)) break;
    n++;
  }
  return n;
}

export function FoodInsights({ uid, navigate, refreshKey, onOpenChat }: Props) {
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  const [logs, setLogs] = useState<MealLog[]>([]);
  const [profile, setProfile] = useState<UserProfile>({});
  const [loaded, setLoaded] = useState(false);
  const [range, setRange] = useState<RangeKey>('last-7d');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [l, p] = await Promise.all([
        firestoreRef.current.getMealLogs(startOfDay() - 120 * 86_400_000),
        firestoreRef.current.getUserProfile(),
      ]);
      if (cancelled) return;
      setLogs(l); setProfile(p); setLoaded(true);
    })().catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [uid, refreshKey]);

  const target = effectiveTargetOf(profile.diet);

  const series = useMemo(() => {
    return daysOfRange(range).map(d => ({
      day: d,
      kcal: caloriesOn(logs, d),
      dow: new Date(d).toLocaleDateString('he-IL', { weekday: 'narrow' }),
    }));
  }, [logs, range]);

  const hasData = series.some(d => d.kcal > 0);
  // A sensible ceiling even on an empty range, so the axis never reads 0/0/0.
  const maxKcal = Math.max(target || 0, ...series.map(w => w.kcal), 500);

  const deficitStreak = target != null
    ? streakOf(logs, dl => dl.reduce((a, x) => a + x.calories, 0) <= target)
    : 0;
  const sugarFreeStreak = streakOf(logs, dl => !dl.some(l => l.flags?.highSugar));
  const cleanStreak = streakOf(logs, dl => !dl.some(l => l.flags?.highSugar || l.flags?.emptyCarbs));

  return (
    <div className="page-bg min-h-screen">
      <TopBar title="קלוריות" accent="brand" tint="amber" actions={<><FoodAiAction onClick={onOpenChat} /><SettingsGearAction navigate={navigate} /></>} />
      <div className="max-w-lg mx-auto p-4 space-y-4" dir="rtl">
        {!loaded ? (
          <div className="text-[12px] text-muted py-8 text-center">טוען…</div>
        ) : (
          <>
            <div className="card">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[12px] font-bold text-muted">קלוריות ליום</h2>
                {hasData && (
                  <span className="text-[10px] text-muted-more">
                    ממוצע <span className="font-mono" dir="ltr">
                      {Math.round(series.reduce((a, d) => a + d.kcal, 0) / Math.max(1, series.filter(d => d.kcal > 0).length))}
                    </span>
                  </span>
                )}
              </div>

              {!hasData ? (
                <div className="py-10 text-center text-[12px] text-muted">
                  אין עדיין נתונים בטווח הזה
                </div>
              ) : (
                /* RTL: axis on the RIGHT, newest day on the LEFT, so the chart
                   reads in the same direction as the text around it. */
                <>
                  <div className="flex gap-2" dir="ltr">
                    <div className="flex-1 relative h-36 flex items-end justify-between gap-[3px]">
                      {[0.25, 0.5, 0.75, 1].map(f => (
                        <span key={f} className="absolute left-0 right-0 border-t border-slate-200/60 dark:border-slate-800/60 pointer-events-none" style={{ bottom: `${f * 100}%` }} />
                      ))}
                      {target != null && target <= maxKcal && (
                        <span className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500/70 pointer-events-none" style={{ bottom: `${(target / maxKcal) * 100}%` }} />
                      )}
                      {[...series].reverse().map(d => {
                        const pct = (d.kcal / maxKcal) * 100;
                        const over = target != null && d.kcal > target;
                        return (
                          <div key={d.day} className="flex-1 h-full flex flex-col justify-end relative z-10">
                            <div
                              className={`w-full rounded-t ${
                                d.kcal === 0 ? 'bg-slate-200 dark:bg-slate-800'
                                  : over ? 'bg-red-400' : 'bg-emerald-500'
                              }`}
                              style={{ height: `${d.kcal === 0 ? 2 : Math.max(pct, 3)}%` }}
                              title={`${d.kcal}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="relative w-9 shrink-0 h-36">
                      {[1, 0.75, 0.5, 0.25, 0].map(f => (
                        <span key={f} className="absolute left-1 -translate-y-1/2 text-[9px] text-muted-more font-mono" style={{ bottom: `${f * 100}%` }}>
                          {Math.round(maxKcal * f)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {series.length <= 14 && (
                    <div className="flex gap-2 mt-1" dir="ltr">
                      <div className="flex-1 flex justify-between gap-[3px]">
                        {[...series].reverse().map(d => (
                          <span key={d.day} className="flex-1 text-center text-[8px] text-muted-more">{d.dow}</span>
                        ))}
                      </div>
                      <span className="w-9 shrink-0" />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Range filter — same vocabulary and shape as גוף */}
            <div className="card !p-2">
              <div className="grid grid-cols-2 gap-2">
                {RANGE_ORDER.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={`text-right text-xs px-3 py-2 rounded-lg transition-colors ${
                      r.key === range
                        ? 'bg-amber-500 text-white font-semibold'
                        : 'dark:bg-slate-800 bg-slate-100 text-main'
                    }`}
                    dir="rtl"
                  >{r.label}</button>
                ))}
              </div>
            </div>

            {/* Streaks */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { he: 'ימים בגירעון', n: deficitStreak, tint: 'text-emerald-600 dark:text-emerald-400', hint: target == null ? 'הגדר יעד' : undefined },
                { he: 'ללא סוכר', n: sugarFreeStreak, tint: 'text-blue-600 dark:text-blue-400' },
                { he: 'ימים נקיים', n: cleanStreak, tint: 'text-amber-600 dark:text-amber-400' },
              ].map(s => (
                <div key={s.he} className="card text-center py-4">
                  <div className={`text-2xl font-bold font-mono ${s.tint}`} dir="ltr">{s.n}</div>
                  <div className="text-[10px] text-muted mt-1">{s.hint || s.he}</div>
                </div>
              ))}
            </div>

            {logs.length === 0 && (
              <div className="text-center text-[12px] text-muted py-4">
                רשום כמה ארוחות והגרפים יתמלאו
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
