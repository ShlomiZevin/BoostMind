import { useEffect, useMemo, useRef, useState } from 'react';
import type { FreeSession, MealLog, Route, UserProfile } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { FoodAiAction, SettingsGearAction } from './TopBarActions';
import { caloriesOn, effectiveTargetOf, estimateBurn, startOfDay } from '../data/diet';
import { DietProfileCard } from './DietProfileCard';

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
  const [sessions, setSessions] = useState<FreeSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [range, setRange] = useState<RangeKey>('last-7d');
  const [metric, setMetric] = useState<'eaten' | 'burned' | 'net'>('eaten');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [l, p, ss] = await Promise.all([
        firestoreRef.current.getMealLogs(startOfDay() - 120 * 86_400_000),
        firestoreRef.current.getUserProfile(),
        firestoreRef.current.getFreeSessions(),
      ]);
      if (cancelled) return;
      setLogs(l); setProfile(p); setSessions(ss); setLoaded(true);
    })().catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [uid, refreshKey]);

  const target = effectiveTargetOf(profile.diet);

  // Burn per day, from that day's actual training.
  const burnOn = useMemo(() => {
    const map = new Map<number, number>();
    for (const d of daysOfRange(range)) {
      const dayEnd = d + 86_400_000;
      const todays = sessions.filter(x => {
        const t = x.completedAt || x.date;
        return t >= d && t < dayEnd;
      });
      map.set(d, estimateBurn(todays, profile.diet?.weightKg));
    }
    return map;
  }, [sessions, range, profile.diet?.weightKg]);

  const series = useMemo(() => {
    return daysOfRange(range).map(d => {
      const kcal = caloriesOn(logs, d);
      // Burn only counts on days you also logged food. A day with training and
      // no meals isn't a 2,000-calorie deficit — it's a day you didn't track,
      // and treating it as data made the totals meaningless.
      const burn = kcal > 0 ? (burnOn.get(d) || 0) : 0;
      return {
        day: d,
        kcal,
        burn,
        net: kcal - burn,
        dow: new Date(d).toLocaleDateString('he-IL', { weekday: 'narrow' }),
      };
    });
  }, [logs, range, burnOn]);

  const hasData = series.some(d => d.kcal > 0);

  const METRICS = [
    { id: 'eaten' as const, he: 'נאכל', pick: (d: typeof series[number]) => d.kcal },
    { id: 'burned' as const, he: 'נשרף', pick: (d: typeof series[number]) => d.burn },
    { id: 'net' as const, he: 'נטו', pick: (d: typeof series[number]) => d.net },
  ];
  const activeMetric = METRICS.find(m => m.id === metric)!;

  // The range as a whole — this page is where you read the long game, so the
  // totals matter more than any single bar.
  const totals = useMemo(() => {
    const logged = series.filter(d => d.kcal > 0);
    const eaten = series.reduce((a, d) => a + d.kcal, 0);
    // series.burn is already zeroed on untracked days.
    const burned = series.reduce((a, d) => a + d.burn, 0);
    const goal = target != null ? target * logged.length : null;
    // Negative = deficit. Only counts days you actually logged, otherwise an
    // untracked day would read as a huge fake deficit.
    const net = goal == null ? null : eaten - burned - goal;
    return { eaten, burned, goal, net, days: logged.length };
  }, [series, target]);
  // A sensible ceiling even on an empty range, so the axis never reads 0/0/0.
  // 'net' draws eaten with the burned part stacked on top, so its ceiling is
  // driven by eaten — scaling by the net value alone squashed the bars.
  const maxKcal = Math.max(
    metric === 'burned' ? 0 : (target || 0),
    ...series.map(d => (metric === 'burned' ? d.burn : Math.max(d.kcal, Math.abs(d.net)))),
    500,
  );

  // Average across tracked days only, for the reference line.
  const avgValue = useMemo(() => {
    const tracked = series.filter(d => d.kcal > 0);
    if (tracked.length === 0) return 0;
    return Math.round(tracked.reduce((a, d) => a + activeMetric.pick(d), 0) / tracked.length);
  }, [series, metric]);

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
            {/* Profile access — mirrors how the training profile lives on גוף:
                collapsed by default so it does not compete with the calorie
                summary, expandable to edit the numbers that drive the target
                without leaving the page. */}
            <DietProfileCard uid={uid} />

            {/* Range summary — burn, goal, and where the deficit actually stands */}
            <div className="card">
              <h2 className="text-[12px] font-bold text-muted mb-3">סיכום התקופה</h2>
              {totals.days === 0 ? (
                <div className="py-4 text-center text-[12px] text-muted">אין ימים עם רישום בטווח הזה</div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[19px] font-bold font-mono" dir="ltr">{totals.eaten.toLocaleString()}</div>
                      <div className="text-[10px] text-muted mt-0.5">נאכל</div>
                    </div>
                    <div>
                      <div className="text-[19px] font-bold font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">{totals.burned.toLocaleString()}</div>
                      <div className="text-[10px] text-muted mt-0.5">נשרף באימונים</div>
                    </div>
                    <div>
                      <div className="text-[19px] font-bold font-mono" dir="ltr">{totals.goal != null ? totals.goal.toLocaleString() : '—'}</div>
                      <div className="text-[10px] text-muted mt-0.5">יעד ({totals.days} ימים)</div>
                    </div>
                  </div>

                  {totals.net != null && (
                    <div className="mt-3 pt-3 border-t border-subtle flex items-baseline justify-between">
                      <span className="text-[12px] text-muted">
                        {totals.net <= 0 ? 'גירעון מצטבר' : 'עודף מצטבר'}
                      </span>
                      <span className="text-right">
                        <span className={`text-[22px] font-bold font-mono ${totals.net <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`} dir="ltr">
                          {Math.abs(totals.net).toLocaleString()}
                        </span>
                        <span className="text-[11px] text-muted"> קק״ל</span>
                        {/* ~7,700 kcal ≈ 1kg of body fat — the number people
                            actually care about behind the calorie count. */}
                        <span className="block text-[10px] text-muted-more">
                          {'\u2248'} {(Math.abs(totals.net) / 7700).toFixed(2)} ק״ג {totals.net <= 0 ? 'ירידה' : 'עלייה'}
                        </span>
                      </span>
                    </div>
                  )}
                  {totals.net == null && (
                    <div className="mt-3 pt-3 border-t border-subtle text-[11px] text-muted text-center">
                      הגדר יעד קלורי כדי לראות את הגירעון המצטבר
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="card">
              {/* Title and its average belong together on the RTL start edge —
                  justify-between flung the average to the far left, where it
                  read as part of the Y axis. */}
              <div className="mb-3">
                <h2 className="text-[12px] font-bold text-muted">קלוריות ליום</h2>
                {hasData && (
                  <div className="text-[10px] text-muted-more mt-0.5">
                    ממוצע {activeMetric.he}{' '}
                    <span className="font-mono" dir="ltr">
                      {Math.round(
                        series.filter(d => d.kcal > 0).reduce((a, d) => a + activeMetric.pick(d), 0)
                        / Math.max(1, series.filter(d => d.kcal > 0).length),
                      )}
                    </span>{' '}קק״ל
                  </div>
                )}
              </div>

              {/* Which series to draw */}
              <div className="flex gap-1.5 mb-4">
                {METRICS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMetric(m.id)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      metric === m.id ? 'bg-amber-500 text-white' : 'bg-subtle text-muted'
                    }`}
                  >{m.he}</button>
                ))}
              </div>

              {!hasData ? (
                <div className="py-10 text-center text-[12px] text-muted">
                  אין עדיין נתונים בטווח הזה
                </div>
              ) : (
                /* A chart is a chart: axis on the LEFT, time flowing left to
                   right, regardless of the surrounding RTL text. Flipping it
                   for RTL made it harder to read, not easier. */
                <>
                  <div className="flex gap-2" dir="ltr">
                    <div className="relative w-9 shrink-0 h-36 mt-2">
                      {[1, 0.75, 0.5, 0.25, 0].map(f => (
                        <span key={f} className="absolute right-1 -translate-y-1/2 text-[9px] text-muted-more font-mono" style={{ bottom: `${f * 100}%` }}>
                          {Math.round(maxKcal * f)}
                        </span>
                      ))}
                    </div>
                    <div className="flex-1 relative h-36 mt-2 flex items-end justify-between gap-[3px]">
                      {[0.25, 0.5, 0.75, 1].map(f => (
                        <span key={f} className="absolute left-0 right-0 border-t border-slate-200/60 dark:border-slate-800/60 pointer-events-none" style={{ bottom: `${f * 100}%` }} />
                      ))}
                      {/* Target — meaningful against intake, so shown on both
                          נאכל and נטו, never against raw burn. */}
                      {metric !== 'burned' && target != null && target <= maxKcal && (
                        <span className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500/80 pointer-events-none z-20" style={{ bottom: `${(target / maxKcal) * 100}%` }}>
                          <span className="absolute right-0 -top-[7px] px-1 rounded bg-amber-500 text-white text-[8px] font-bold font-mono leading-[13px]">
                            {target}
                          </span>
                        </span>
                      )}
                      {/* Average of the tracked days in this range. */}
                      {avgValue > 0 && avgValue <= maxKcal && (
                        <span className="absolute left-0 right-0 border-t border-dashed border-slate-400/80 pointer-events-none z-20" style={{ bottom: `${(avgValue / maxKcal) * 100}%` }}>
                          <span className="absolute left-0 -top-[7px] px-1 rounded bg-slate-500 text-white text-[8px] font-bold font-mono leading-[13px]">
                            {avgValue}
                          </span>
                        </span>
                      )}
                      {series.map(d => {
                        const untracked = d.kcal === 0;
                        if (untracked) {
                          return (
                            <div key={d.day} className="flex-1 h-full flex flex-col justify-end relative z-10">
                              <div className="w-full rounded-t bg-slate-200 dark:bg-slate-800" style={{ height: '2%' }} />
                            </div>
                          );
                        }
                        if (metric === 'net') {
                          // Eaten is the full bar; the burned share sits on top in
                          // sky, literally eating into it. What's left underneath
                          // is the net — which is the number that counts.
                          const netPct = (Math.max(d.net, 0) / maxKcal) * 100;
                          const burnPct = (Math.min(d.burn, d.kcal) / maxKcal) * 100;
                          const over = target != null && d.net > target;
                          return (
                            <div key={d.day} className="flex-1 h-full flex flex-col justify-end relative z-10" title={`נאכל ${d.kcal} · נשרף ${d.burn} · נטו ${d.net}`}>
                              {burnPct > 0 && (
                                <div className="w-full rounded-t bg-sky-500/70" style={{ height: `${burnPct}%` }} />
                              )}
                              <div
                                className={`w-full ${burnPct > 0 ? '' : 'rounded-t'} ${over ? 'bg-red-400' : 'bg-emerald-500'}`}
                                style={{ height: `${Math.max(netPct, 3)}%` }}
                              />
                            </div>
                          );
                        }
                        const v = activeMetric.pick(d);
                        const pct = (Math.abs(v) / maxKcal) * 100;
                        const over = metric === 'eaten' && target != null && d.kcal > target;
                        const tone = metric === 'burned' ? 'bg-sky-500'
                          : over ? 'bg-red-400'
                          : 'bg-emerald-500';
                        return (
                          <div key={d.day} className="flex-1 h-full flex flex-col justify-end relative z-10">
                            <div
                              className={`w-full rounded-t ${tone}`}
                              style={{ height: `${Math.max(pct, 3)}%` }}
                              title={`${v}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Legend. The two dashed reference lines had none at all —
                      an amber line and a grey line with a bare number on each,
                      and nothing saying which was the target and which the
                      average. Conditions here mirror the drawing conditions
                      above exactly, so the legend can never name a line that
                      isn't on the chart. */}
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2 text-[9px] text-muted" dir="rtl">
                    {metric === 'net' && (
                      <>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> נטו</span>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-500/70" /> נשרף באימון</span>
                      </>
                    )}
                    {metric !== 'burned' && target != null && target <= maxKcal && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-3.5 border-t-2 border-dashed border-amber-500/80" /> יעד יומי
                      </span>
                    )}
                    {avgValue > 0 && avgValue <= maxKcal && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-3.5 border-t border-dashed border-slate-400/80" /> ממוצע בטווח
                      </span>
                    )}
                  </div>
                  {series.length <= 14 && (
                    <div className="flex gap-2 mt-1" dir="ltr">
                      <span className="w-9 shrink-0" />
                      <div className="flex-1 flex justify-between gap-[3px]">
                        {series.map(d => (
                          <span key={d.day} className="flex-1 text-center text-[8px] text-muted-more">{d.dow}</span>
                        ))}
                      </div>
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
