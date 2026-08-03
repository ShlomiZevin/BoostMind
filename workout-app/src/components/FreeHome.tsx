import { useEffect, useMemo, useState } from 'react';
import type { Route, FreeSession } from '../types';
import type { MuscleGroup, MuscleParent } from '../data/muscles';
import {
  PARENT_INFO, ACTIVE_MUSCLES, MUSCLE_BY_ID, MUSCLE_CLASSES,
  DEFAULT_WEEKLY_TARGETS, musclesByParent, effectiveMuscles,
} from '../data/muscles';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
};

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay()); // back to Sunday
  return out;
}

const PARENT_ORDER: MuscleParent[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

export function FreeHome({ uid, navigate }: Props) {
  const firestore = useFirestore(uid);
  const [sessions, setSessions] = useState<FreeSession[]>([]);
  const [targets, setTargets] = useState<Record<MuscleGroup, number>>({ ...DEFAULT_WEEKLY_TARGETS });
  const [loading, setLoading] = useState(true);

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
  }, []);

  const inProgress = sessions.find(s => !s.completed);

  const weekStart = startOfWeek(new Date());
  const weeklySetsPerMuscle = useMemo(() => {
    const counts: Partial<Record<MuscleGroup, number>> = {};
    for (const sess of sessions) {
      if (sess.date < weekStart.getTime()) continue;
      for (const set of sess.sets) counts[set.muscle] = (counts[set.muscle] || 0) + 1;
    }
    return counts;
  }, [sessions, weekStart.getTime()]);

  const hasAnyTarget = ACTIVE_MUSCLES.some(m => targets[m.id] > 0);

  // Max sets across all active muscles this week — used for the heatmap-style
  // bar when a muscle has no explicit target set.
  const maxWeeklySets = useMemo(() => {
    let m = 0;
    for (const mu of ACTIVE_MUSCLES) {
      const v = weeklySetsPerMuscle[mu.id] || 0;
      if (v > m) m = v;
    }
    return m;
  }, [weeklySetsPerMuscle]);

  // Max total sets across parent muscle groups this week — for parent bar
  const maxParentSets = useMemo(() => {
    let m = 0;
    for (const p of PARENT_ORDER) {
      const kids = musclesByParent(p);
      const done = kids.reduce((sum, k) => sum + (weeklySetsPerMuscle[k.id] || 0), 0);
      if (done > m) m = done;
    }
    return m;
  }, [weeklySetsPerMuscle]);

  if (loading) {
    return <div className="page-bg flex items-center justify-center text-muted">Loading...</div>;
  }

  const completedCount = sessions.filter(s => s.completed).length;

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="אימונים"
        subtitle={new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
        accent="brand"
      />
      <div className="p-4 pb-4 max-w-lg mx-auto">

      {inProgress && (() => {
        const realSetList = inProgress.sets.filter(s => s.weight > 0 || s.reps > 0);
        const realSets = realSetList.length;
        const uniqExercises = new Set(realSetList.map(x => (x.exerciseName || '').toLowerCase()).filter(Boolean)).size;
        const plannedOnly = (inProgress.plannedExercises || []).filter(p => !realSetList.some(s => (s.exerciseName || '').toLowerCase() === p.name.toLowerCase())).length;
        const totalExercises = uniqExercises + plannedOnly;
        const started = new Date(inProgress.date);
        const minutesAgo = Math.max(0, Math.floor((Date.now() - inProgress.date) / 60000));
        const timeLabel =
          minutesAgo < 60 ? `לפני ${minutesAgo}׳` :
          minutesAgo < 60 * 24 ? `לפני ${Math.floor(minutesAgo / 60)} שעות` :
          started.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
        return (
          <button
            onClick={() => navigate({ page: 'session', sessionId: inProgress.id })}
            className="w-full mb-4 relative overflow-hidden rounded-2xl border dark:border-emerald-500/30 border-emerald-400/50 dark:bg-emerald-950/30 bg-emerald-50/70 hover:brightness-105 transition p-4 group"
            dir="rtl"
          >
            <div className="flex items-center gap-3" dir="rtl">
              {/* Arrow — left side (RTL end) */}
              <div className="flex-shrink-0 text-emerald-600 dark:text-emerald-400 text-2xl group-hover:-translate-x-0.5 transition-transform order-2">←</div>
              {/* Content — right side (RTL start) */}
              <div className="flex-1 min-w-0 text-right order-1">
                {/* Title + live tag — title on right, tag to its left */}
                <div className="flex items-baseline gap-2" dir="rtl">
                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">אימון פתוח</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <span>חי · {timeLabel}</span>
                  </span>
                </div>
                {/* Big stats: exercises + sets */}
                <div className="mt-1.5 flex items-baseline gap-4 justify-end" dir="rtl">
                  <div>
                    <span className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-300 leading-none">{totalExercises}</span>
                    <span className="text-[10px] text-muted mr-1">תרגילים</span>
                  </div>
                  <span className="text-muted-most">·</span>
                  <div>
                    <span className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-300 leading-none">{realSets}</span>
                    <span className="text-[10px] text-muted mr-1">סטים</span>
                  </div>
                </div>
                {/* Muscles */}
                {inProgress.muscleGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-end mt-2">
                    {inProgress.muscleGroups.slice(0, 6).map(id => {
                      const m = MUSCLE_BY_ID[id];
                      if (!m) return null;
                      return (
                        <span key={id} className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 dark:bg-slate-900/40 text-emerald-700 dark:text-emerald-300">
                          {m.he}
                        </span>
                      );
                    })}
                    {inProgress.muscleGroups.length > 6 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded text-muted">+{inProgress.muscleGroups.length - 6}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })()}

      {/* Weekly volume dashboard — grouped by parent */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3" dir="rtl">
          <h2 className="text-sm font-semibold">נפח שבועי</h2>
          <span className="text-[10px] text-muted">שבוע נוכחי</span>
        </div>

        <div className="space-y-5">
          {PARENT_ORDER.map(parent => {
            const info = PARENT_INFO[parent];
            const parentClasses = MUSCLE_CLASSES[info.color];
            const children = musclesByParent(parent);
            const parentDone = children.reduce((sum, m) => sum + (weeklySetsPerMuscle[m.id] || 0), 0);
            const parentTarget = children.reduce((sum, m) => sum + (targets[m.id] || 0), 0);
            const parentHasTarget = parentTarget > 0;
            const parentPct = parentHasTarget
              ? Math.min(100, (parentDone / parentTarget) * 100)
              : (maxParentSets > 0 ? (parentDone / maxParentSets) * 100 : 0);
            return (
              <div key={parent}>
                {/* Parent group header — title on right, count on left */}
                <div className="flex items-baseline justify-between mb-1" dir="rtl">
                  <span className={`font-bold text-base ${parentClasses.text}`}>{info.he}</span>
                  <span className="font-mono text-xs text-muted-most">
                    {parentHasTarget
                      ? `${parentDone}/${parentTarget}`
                      : (parentDone > 0 ? `${parentDone} סטים` : '—')}
                  </span>
                </div>
                {/* Parent group bar — thicker, dedicated color */}
                <div className="w-full dark:bg-slate-800/60 bg-slate-200/70 rounded-full h-2.5 mb-2 flex">
                  <div
                    className={`${parentClasses.bar} h-2.5 rounded-full transition-all ml-auto ${parentDone === 0 ? 'opacity-0' : ''}`}
                    style={{ width: `${parentPct}%` }}
                  />
                </div>

                {/* Sub-muscle rows — thinner bars, indented for hierarchy */}
                <div className="space-y-1 pr-3">
                  {children.map(m => {
                    const done = weeklySetsPerMuscle[m.id] || 0;
                    const target = targets[m.id];
                    const hasTarget = target > 0;
                    const pct = hasTarget
                      ? Math.min(100, (done / target) * 100)
                      : (maxWeeklySets > 0 ? (done / maxWeeklySets) * 100 : 0);
                    const c = MUSCLE_CLASSES[m.color];
                    const isLow = hasTarget && done / target < 0.5;
                    return (
                      <div key={m.id}>
                        <div className="flex items-baseline justify-between text-[11px] mb-0.5" dir="rtl">
                          <span className={c.text}>{m.he}</span>
                          <span className={`font-mono ${isLow ? 'text-amber-500' : 'text-muted-most'}`}>
                            {hasTarget ? `${done}/${target}` : (done > 0 ? `${done} סטים` : '—')}
                          </span>
                        </div>
                        <div className="w-full dark:bg-slate-800 bg-slate-200 rounded-full h-1 flex">
                          <div
                            className={`${c.bar} h-1 rounded-full transition-all ml-auto ${!hasTarget && done === 0 ? 'opacity-0' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {!hasAnyTarget && (
          <div className="text-[10px] text-muted-most mt-3 text-right" dir="rtl">
            פסים יחסיים לשריר הכי אקטיבי השבוע. הגדר מטרות ב<button onClick={() => navigate({ page: 'settings' })} className="text-blue-500 underline">הגדרות</button> להשוואה מוחלטת.
          </div>
        )}
      </div>

      {/* Start-session action lives in the TabBar FAB now */}

      <div className="mb-4">
        <div className="text-sm font-semibold mb-2 text-right" dir="rtl">אימונים אחרונים</div>
        <div className="space-y-2">
          {sessions.filter(s => s.completed).slice(0, 8).map(s => {
            const d = new Date(s.completedAt || s.date);
            const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
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
        {completedCount === 0 && (
          <div className="text-center text-xs text-muted-most py-4" dir="rtl">אין עדיין אימונים</div>
        )}
      </div>

      </div>
    </div>
  );
}
