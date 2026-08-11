import { useEffect, useMemo, useState } from 'react';
import type { Route, FreeSession } from '../types';
import type { MuscleGroup, MuscleParent } from '../data/muscles';
import {
  PARENT_INFO, ACTIVE_MUSCLES, MUSCLE_CLASSES,
  DEFAULT_WEEKLY_TARGETS, musclesByParent,
} from '../data/muscles';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { TabActions } from './TopBarActions';

type Props = { uid: string; navigate: (r: Route) => void };

const PARENT_ORDER: MuscleParent[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

type RangeKey = 'this-week' | 'last-7d' | 'previous-week' | 'this-month' | 'last-30d' | 'previous-month';
const RANGE_ORDER: { key: RangeKey; label: string }[] = [
  { key: 'this-week',       label: 'שבוע נוכחי' },
  { key: 'last-7d',         label: '7 ימים אחרונים' },
  { key: 'previous-week',   label: 'שבוע שעבר' },
  { key: 'this-month',      label: 'חודש נוכחי' },
  { key: 'last-30d',        label: '30 ימים אחרונים' },
  { key: 'previous-month',  label: 'חודש שעבר' },
];

function computeRange(key: RangeKey): { start: number; end: number } {
  const now = Date.now();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  switch (key) {
    case 'this-week': {
      const start = new Date(today); start.setDate(start.getDate() - start.getDay()); // Sunday
      return { start: start.getTime(), end: now };
    }
    case 'last-7d': {
      return { start: now - 7 * 86_400_000, end: now };
    }
    case 'previous-week': {
      const thisWeekStart = new Date(today); thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
      const prevStart = new Date(thisWeekStart); prevStart.setDate(prevStart.getDate() - 7);
      return { start: prevStart.getTime(), end: thisWeekStart.getTime() };
    }
    case 'this-month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: start.getTime(), end: now };
    }
    case 'last-30d': {
      return { start: now - 30 * 86_400_000, end: now };
    }
    case 'previous-month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: start.getTime(), end: end.getTime() };
    }
  }
}

export function Body({ uid, navigate }: Props) {
  const firestore = useFirestore(uid);
  const [sessions, setSessions] = useState<FreeSession[]>([]);
  const [targets, setTargets] = useState<Record<MuscleGroup, number>>({ ...DEFAULT_WEEKLY_TARGETS });
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>('this-week');
  const [expandedParents, setExpandedParents] = useState<Set<MuscleParent>>(new Set());

  function toggleParent(p: MuscleParent) {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  useEffect(() => {
    (async () => {
      const [s, t] = await Promise.all([
        firestore.getFreeSessions(),
        firestore.getWeeklyTargets(),
      ]);
      setSessions(s);
      setTargets(t);
      setLoading(false);
    })();
  }, [uid]);

  const { start: rangeStart, end: rangeEnd } = useMemo(() => computeRange(range), [range]);

  const setsPerMuscle = useMemo(() => {
    const counts: Partial<Record<MuscleGroup, number>> = {};
    for (const sess of sessions) {
      const ts = sess.completedAt ?? sess.date;
      if (ts < rangeStart || ts >= rangeEnd) continue;
      for (const s of sess.sets) {
        if (s.weight === 0 && s.reps === 0) continue;
        counts[s.muscle] = (counts[s.muscle] || 0) + 1;
      }
    }
    return counts;
  }, [sessions, rangeStart, rangeEnd]);

  const totalSets = useMemo(() => {
    let sum = 0;
    for (const v of Object.values(setsPerMuscle)) sum += v || 0;
    return sum;
  }, [setsPerMuscle]);

  const sessionsInRange = useMemo(() => {
    return sessions.filter(sess => {
      const ts = sess.completedAt ?? sess.date;
      return ts >= rangeStart && ts < rangeEnd && sess.completed;
    }).length;
  }, [sessions, rangeStart, rangeEnd]);

  const maxParentSets = useMemo(() => {
    let m = 0;
    for (const p of PARENT_ORDER) {
      const kids = musclesByParent(p);
      const done = kids.reduce((sum, k) => sum + (setsPerMuscle[k.id] || 0), 0);
      if (done > m) m = done;
    }
    return m;
  }, [setsPerMuscle]);

  const maxSubMuscleSets = useMemo(() => {
    let m = 0;
    for (const mu of ACTIVE_MUSCLES) {
      const v = setsPerMuscle[mu.id] || 0;
      if (v > m) m = v;
    }
    return m;
  }, [setsPerMuscle]);

  if (loading) return <div className="page-bg flex items-center justify-center text-muted">Loading...</div>;

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="גוף"
        subtitle={`${sessionsInRange} אימונים · ${totalSets} סטים`}
        accent="brand"
        tint="blue"
        actions={<TabActions navigate={navigate} />}
      />
      <div className="px-4 pt-0 pb-4 max-w-lg mx-auto">
        {/* ═══ Range picker ═══ */}
        <section className="mb-4" dir="rtl">
          <div className="sticky z-20 -mx-4 px-4 py-2.5 mb-2 backdrop-blur bg-gradient-to-b from-blue-50/95 to-white/85 dark:from-blue-950/40 dark:to-slate-950/90 border-b border-blue-500/20 shadow-[0_2px_10px_-6px_rgba(59,130,246,0.35)]" style={{ top: 'var(--top-bar-h)' }}>
            <div className="max-w-lg mx-auto flex items-baseline justify-between">
              <h2 className="inline-flex items-center gap-2 text-base font-bold">
                <span>טווח זמן</span>
                <span className="w-1 h-4 rounded-full bg-blue-500" />
              </h2>
              <span className="text-[10px] text-muted-most uppercase tracking-widest font-semibold">
                {new Date(rangeStart).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} — {new Date(rangeEnd).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
              </span>
            </div>
          </div>
          <div className="card !p-2">
            <div className="grid grid-cols-2 gap-2">
              {RANGE_ORDER.map(r => {
                const active = r.key === range;
                return (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={`text-right text-xs px-3 py-2 rounded-lg transition-colors ${
                      active
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'dark:bg-slate-800 bg-slate-100 text-main dark:hover:bg-slate-700 hover:bg-slate-200'
                    }`}
                    dir="rtl"
                  >{r.label}</button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ Volume ═══ */}
        <section className="mb-4" dir="rtl">
          <div className="sticky z-20 -mx-4 px-4 py-2.5 mb-2 backdrop-blur bg-gradient-to-b from-emerald-50/95 to-white/85 dark:from-emerald-950/40 dark:to-slate-950/90 border-b border-emerald-500/20 shadow-[0_2px_10px_-6px_rgba(16,185,129,0.35)]" style={{ top: 'var(--top-bar-h)' }}>
            <div className="max-w-lg mx-auto flex items-baseline justify-between">
              <h2 className="inline-flex items-center gap-2 text-base font-bold">
                <span>נפח לפי שריר</span>
                <span className="w-1 h-4 rounded-full bg-emerald-500" />
              </h2>
              <span className="text-[10px] text-muted-most uppercase tracking-widest font-semibold">
                {totalSets} סטים
              </span>
            </div>
          </div>
          <div className="card !p-3">
            <div className="space-y-3">
              {PARENT_ORDER.map(parent => {
                const info = PARENT_INFO[parent];
                const parentClasses = MUSCLE_CLASSES[info.color];
                const children = musclesByParent(parent);
                const done = children.reduce((sum, m) => sum + (setsPerMuscle[m.id] || 0), 0);
                const pct = maxParentSets > 0 ? (done / maxParentSets) * 100 : 0;
                const isExpanded = expandedParents.has(parent);
                return (
                  <div key={parent}>
                    <button
                      onClick={() => toggleParent(parent)}
                      className="w-full text-right"
                      dir="rtl"
                    >
                      <div className="flex items-center justify-between mb-1" dir="rtl">
                        <div className="flex items-center gap-2">
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`text-muted-most transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          >
                            <path d="M15 18l-6-6 6-6" />
                          </svg>
                          <span className={`font-bold text-base ${parentClasses.text}`}>{info.he}</span>
                        </div>
                        <span className="font-mono text-xs text-muted-most">
                          {done > 0 ? `${done} סטים` : '—'}
                        </span>
                      </div>
                      <div className="w-full dark:bg-slate-800/60 bg-slate-200/70 rounded-full h-2.5 flex">
                        <div
                          className={`${parentClasses.bar} h-2.5 rounded-full transition-all ml-auto ${done === 0 ? 'opacity-0' : ''}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="space-y-1 pr-6 mt-2">
                        {children.map(m => {
                          const d = setsPerMuscle[m.id] || 0;
                          const p = maxSubMuscleSets > 0 ? (d / maxSubMuscleSets) * 100 : 0;
                          const c = MUSCLE_CLASSES[m.color];
                          return (
                            <div key={m.id}>
                              <div className="flex items-baseline justify-between text-[11px] mb-0.5" dir="rtl">
                                <span className={c.text}>{m.he}</span>
                                <span className="font-mono text-muted-most">{d > 0 ? `${d} סטים` : '—'}</span>
                              </div>
                              <div className="w-full dark:bg-slate-800 bg-slate-200 rounded-full h-1 flex">
                                <div
                                  className={`${c.bar} h-1 rounded-full transition-all ml-auto ${d === 0 ? 'opacity-0' : ''}`}
                                  style={{ width: `${p}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="text-[10px] text-muted-most text-right px-1" dir="rtl">
          יעדים שבועיים מוגדרים ב<span className="opacity-70">הגדרות</span>. הטווחים כאן יחסיים לשריר האקטיבי ביותר בטווח הנבחר. {Object.values(targets).some(v => v > 0) ? '' : ''}
        </div>
      </div>
    </div>
  );
}
