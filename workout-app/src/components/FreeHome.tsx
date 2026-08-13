import { useEffect, useMemo, useState } from 'react';
import type { Route, FreeSession } from '../types';
import type { MuscleGroup, MuscleParent } from '../data/muscles';
import {
  PARENT_INFO, ACTIVE_MUSCLES, MUSCLE_BY_ID, MUSCLE_CLASSES,
  DEFAULT_WEEKLY_TARGETS, musclesByParent, effectiveMuscles,
} from '../data/muscles';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { TabActions } from './TopBarActions';
import { StartSessionModal } from './StartSessionModal';
import { MovePlanModal } from './MovePlanModal';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
  // Opens the same "מה מתאמנים היום?" start-session modal that the tab-bar FAB shows.
  onStartRequest?: () => void;
};

const PARENT_ORDER: MuscleParent[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
const DOW_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DOW_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// Group aerobic entries by type → sum of minutes. Returns [] when no entries.
// Used to render one solid-cyan "🏃 ריצה · 30ד" chip per unique aerobic type alongside
// the muscle chips on session cards. Aerobic chips are visually distinct (filled cyan
// with an emoji prefix) so they never get confused with regular exercise chips.
function groupAerobic(session: FreeSession): Array<{ type: string; minutes: number }> {
  const entries = session.aerobicEntries;
  if (!entries || entries.length === 0) return [];
  const byType = new Map<string, number>();
  for (const e of entries) byType.set(e.type, (byType.get(e.type) || 0) + (e.minutes || 0));
  return Array.from(byType.entries()).map(([type, minutes]) => ({ type, minutes }));
}
const AEROBIC_ICON: Record<string, string> = {
  'ריצה': '🏃', 'אופניים': '🚴', 'חתירה': '🚣', 'הליכה': '🚶', 'אליפטיקל': '⚙',
};
function aerobicIcon(type: string): string { return AEROBIC_ICON[type] || '❤'; }

// Compact labeled chip groups for the top banners. Renders muscles and aerobic
// entries as two tiny bordered mini-panels (one on top of the other) so the
// two categories stay visually distinct even in the tight banner area.
function BannerChipGroups({ muscles, aerobic, muscleTint, labelBg }: {
  muscles: MuscleGroup[];
  aerobic: Array<{ type: string; minutes: number }>;
  muscleTint: 'emerald' | 'blue';
  labelBg?: string;
}) {
  const muscleTxt = muscleTint === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300';
  const bg = labelBg || 'bg-white/85 dark:bg-slate-900/70';
  const shown = muscles.slice(0, 6);
  const overflow = muscles.length - shown.length;
  return (
    <div className="flex flex-col gap-2 min-w-0 flex-1">
      {shown.length > 0 && (
        <div className="relative rounded-md border border-slate-400/30 dark:border-slate-500/40 px-1.5 pt-2 pb-1">
          <span className={`absolute -top-1.5 right-1.5 px-1 ${bg} text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400`}>כח</span>
          <div className="flex flex-wrap gap-1">
            {shown.map(id => {
              const m = MUSCLE_BY_ID[id]; if (!m) return null;
              return <span key={id} className={`text-[9px] px-1.5 py-0.5 rounded-full bg-white/70 dark:bg-slate-900/40 ${muscleTxt}`}>{m.he}</span>;
            })}
            {overflow > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full text-muted">+{overflow}</span>}
          </div>
        </div>
      )}
      {aerobic.length > 0 && (
        <div className="relative rounded-md border border-cyan-400/50 px-1.5 pt-2 pb-1">
          <span className={`absolute -top-1.5 right-1.5 px-1 ${bg} text-[8px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400`}>אירובי</span>
          <div className="flex flex-wrap gap-1">
            {aerobic.map(a => (
              <span key={`aer-${a.type}`} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500 text-white inline-flex items-center gap-1 shadow-sm">
                <span className="text-[10px] leading-none">{aerobicIcon(a.type)}</span>
                <bdi>{a.type}</bdi> · {a.minutes}ד
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay()); // back to Sunday
  return out;
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

type GraphMode = 'done' | 'planned';

export function FreeHome({ uid, navigate, onStartRequest }: Props) {
  const firestore = useFirestore(uid);
  const [sessions, setSessions] = useState<FreeSession[]>([]);
  const [targets, setTargets] = useState<Record<MuscleGroup, number>>({ ...DEFAULT_WEEKLY_TARGETS });
  const [goalsMode, setGoalsMode] = useState<'fixed' | 'percent'>('fixed');
  const [goalsTotalSets, setGoalsTotalSets] = useState<number>(0);
  const [goalsPercents, setGoalsPercents] = useState<Partial<Record<MuscleGroup, number>>>({});
  const [loading, setLoading] = useState(true);
  const [expandedParents, setExpandedParents] = useState<Set<MuscleParent>>(new Set());
  const [confirmDeleteInProgress, setConfirmDeleteInProgress] = useState<string | null>(null);
  const [confirmDeletePlanned, setConfirmDeletePlanned] = useState<string | null>(null);
  const [movePlanId, setMovePlanId] = useState<string | null>(null);
  const [confirmRestartId, setConfirmRestartId] = useState<string | null>(null);
  const [planForDate, setPlanForDate] = useState<string | null>(null); // YYYY-MM-DD
  const [copyWeekOpen, setCopyWeekOpen] = useState(false);
  const [graphMode, setGraphMode] = useState<GraphMode>('done');
  // Volume comparison basis — persisted so the user's preference sticks across reloads.
  //   'goals'     → use targets (or last-week fallback when none set) — the default
  //   'last-week' → force compare to last week's counts, ignoring configured targets
  //   'absolute'  → no target, bars fill relatively vs. the busiest muscle
  const [volumeMode, setVolumeMode] = useState<'goals' | 'last-week' | 'absolute'>(() => {
    try {
      const v = localStorage.getItem('freehome:volumeMode');
      return (v === 'last-week' || v === 'absolute') ? v : 'goals';
    } catch { return 'goals'; }
  });
  function changeVolumeMode(v: 'goals' | 'last-week' | 'absolute') {
    setVolumeMode(v);
    try { localStorage.setItem('freehome:volumeMode', v); } catch { /* ignore */ }
  }
  const [startingId, setStartingId] = useState<string | null>(null);
  const [convertActiveOpen, setConvertActiveOpen] = useState<string | null>(null);

  function toggleParent(p: MuscleParent) {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function refresh() {
    const [s, t, cfg] = await Promise.all([
      firestore.getFreeSessions(),
      firestore.getWeeklyTargets(),
      firestore.getGoalsConfig(),
    ]);
    setSessions(s);
    setTargets(t);
    setGoalsMode(cfg.mode);
    setGoalsTotalSets(cfg.totalSets);
    setGoalsPercents(cfg.percents);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  const inProgress = sessions.find(s => s.status === 'active');

  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

  // Grouped by day-of-week within current week: 7 slots, Sun..Sat
  const weekSlots = useMemo(() => {
    const slots: Array<{
      date: Date;
      key: string;
      completed: FreeSession[];
      planned: FreeSession[];
      active: FreeSession | null;
    }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart.getTime() + i * 86_400_000);
      slots.push({ date: d, key: ymd(d), completed: [], planned: [], active: null });
    }
    for (const s of sessions) {
      const anchor = s.status === 'planned' && s.plannedFor
        ? new Date(s.plannedFor + 'T00:00:00')
        : new Date(s.date);
      if (anchor < weekStart || anchor >= weekEnd) continue;
      const slot = slots[anchor.getDay()];
      if (!slot) continue;
      if (s.status === 'completed') slot.completed.push(s);
      else if (s.status === 'planned') slot.planned.push(s);
      else if (s.status === 'active') slot.active = s;
    }
    return slots;
  }, [sessions, weekStart.getTime(), weekEnd.getTime()]);

  const todayYmd = ymd(new Date());
  const todaySlot = weekSlots.find(s => s.key === todayYmd);
  const plannedToday = !inProgress ? (todaySlot?.planned[0] || null) : null;
  // Today already has a completed session? Newest first so the tile shows the latest.
  const completedToday = !inProgress && !plannedToday
    ? [...(todaySlot?.completed || [])].sort((a, b) => (b.completedAt || b.date) - (a.completedAt || a.date))[0] || null
    : null;

  async function handleReactivateCompleted(id: string) {
    await firestore.reactivateFreeSession(id);
    navigate({ page: 'session', sessionId: id });
  }

  // Weekly muscle counts — separated into done vs planned so the bar can render two-tone.
  // "planned" means every plannedExercise on a planned/active session, counted as 3 sets
  // (the user's default plan). Active sessions contribute BOTH their done sets AND their
  // still-planned (not-yet-done) exercises.
  const PLANNED_SETS_PER_EX = 3;
  const weeklyBreakdown = useMemo(() => {
    const done: Partial<Record<MuscleGroup, number>> = {};
    const planned: Partial<Record<MuscleGroup, number>> = {};
    for (const sess of sessions) {
      const anchor = sess.status === 'planned' && sess.plannedFor
        ? new Date(sess.plannedFor + 'T00:00:00').getTime()
        : sess.date;
      if (anchor < weekStart.getTime() || anchor >= weekEnd.getTime()) continue;

      // DONE sets from any session — the real ones.
      for (const set of sess.sets) {
        if (set.weight > 0 || set.reps > 0) done[set.muscle] = (done[set.muscle] || 0) + 1;
      }

      // PLANNED — every exercise queued but not yet done.
      const doneExNames = new Set(
        sess.sets.filter(s => s.weight > 0 || s.reps > 0).map(s => (s.exerciseName || '').toLowerCase()).filter(Boolean),
      );
      const plannedList = sess.plannedExercises || [];
      for (const p of plannedList) {
        if (doneExNames.has(p.name.toLowerCase())) continue;
        planned[p.muscle] = (planned[p.muscle] || 0) + PLANNED_SETS_PER_EX;
      }
      // Planned session with no plannedExercises → fall back to focus muscles × 3 sets each.
      if (sess.status === 'planned' && plannedList.length === 0) {
        for (const m of sess.muscleGroups) planned[m] = (planned[m] || 0) + PLANNED_SETS_PER_EX;
      }
    }
    return { done, planned };
  }, [sessions, weekStart.getTime(), weekEnd.getTime()]);

  const weeklySetsPerMuscle = useMemo(() => {
    if (graphMode === 'done') return weeklyBreakdown.done;
    const merged: Partial<Record<MuscleGroup, number>> = { ...weeklyBreakdown.done };
    for (const [k, v] of Object.entries(weeklyBreakdown.planned)) {
      merged[k as MuscleGroup] = (merged[k as MuscleGroup] || 0) + (v || 0);
    }
    return merged;
  }, [weeklyBreakdown, graphMode]);

  const hasAnyTarget = goalsMode === 'percent'
    ? (goalsTotalSets > 0 && Object.values(goalsPercents).some(v => (v || 0) > 0))
    : ACTIVE_MUSCLES.some(m => targets[m.id] > 0);

  // Last week's actual sets per muscle — used as a soft goal when no explicit target is set
  // and no percent goals configured. "Beat last week" beats "compare to busiest muscle".
  const lastWeekSetsPerMuscle = useMemo(() => {
    const counts: Partial<Record<MuscleGroup, number>> = {};
    const lastStart = new Date(weekStart); lastStart.setDate(lastStart.getDate() - 7);
    const lastEnd = weekStart;
    for (const sess of sessions) {
      if (sess.status !== 'completed') continue;
      const ts = sess.completedAt || sess.date;
      if (ts < lastStart.getTime() || ts >= lastEnd.getTime()) continue;
      for (const set of sess.sets) {
        if (set.weight === 0 && set.reps === 0) continue;
        counts[set.muscle] = (counts[set.muscle] || 0) + 1;
      }
    }
    return counts;
  }, [sessions, weekStart.getTime()]);

  // Effective goal per muscle. Behavior depends on `volumeMode`:
  //   'absolute'  → 0 (no target, bars normalize to the busiest muscle)
  //   'last-week' → last week's real volume for that muscle
  //   'goals'     → percent mode: total × percent / 100
  //               → fixed mode: explicit target if set, else last week's fallback
  function effectiveTarget(id: MuscleGroup): number {
    if (volumeMode === 'absolute') return 0;
    if (volumeMode === 'last-week') return lastWeekSetsPerMuscle[id] || 0;
    if (goalsMode === 'percent' && goalsTotalSets > 0) {
      const pct = goalsPercents[id] || 0;
      return Math.round(goalsTotalSets * pct / 100);
    }
    if (targets[id] > 0) return targets[id];
    return lastWeekSetsPerMuscle[id] || 0;
  }

  const maxWeeklySets = useMemo(() => {
    let m = 0;
    for (const mu of ACTIVE_MUSCLES) {
      const v = weeklySetsPerMuscle[mu.id] || 0;
      if (v > m) m = v;
    }
    return m;
  }, [weeklySetsPerMuscle]);

  const maxParentSets = useMemo(() => {
    let m = 0;
    for (const p of PARENT_ORDER) {
      const kids = musclesByParent(p);
      const done = kids.reduce((sum, k) => sum + (weeklySetsPerMuscle[k.id] || 0), 0);
      if (done > m) m = done;
    }
    return m;
  }, [weeklySetsPerMuscle]);

  async function handlePlanSave(muscles: MuscleGroup[]) {
    if (!planForDate) return;
    const forDate = planForDate;
    setPlanForDate(null);
    const newId = await firestore.createPlannedSession(muscles, forDate);
    // Navigate straight into the plan so the user can add exercises (same UI as a session,
    // just no log-set until they hit "התחל").
    navigate({ page: 'session', sessionId: newId });
  }

  // AI per-day flow: create an empty planned session for the chosen date, navigate to it,
  // and flag that the chat should open on arrival — WITHOUT auto-sending anything.
  // User writes their own prompt.
  async function handlePlanWithAi(ymdStr: string) {
    try { sessionStorage.setItem('ai:openOnLoad', '1'); } catch { /* ignore */ }
    const newId = await firestore.createPlannedSession([], ymdStr);
    navigate({ page: 'session', sessionId: newId });
  }

  async function handleStartPlanned(sessionId: string) {
    setStartingId(sessionId);
    // Guard: if any active session exists, the firestore method returns THAT id
    // instead of overwriting it. Navigate wherever we end up.
    const targetId = await firestore.startPlannedSession(sessionId);
    setStartingId(null);
    if (targetId) navigate({ page: 'session', sessionId: targetId });
  }

  if (loading) {
    return <div className="page-bg flex items-center justify-center text-muted">Loading...</div>;
  }

  // Suggestion inputs for the plan modal.
  // - lastWeekMuscles = "what did I train the same weekday last week" — anchored to the PLAN date
  //   (not today), so planning Monday pulls last Monday, not last Sunday.
  //   Uses exact-YMD matching (midnight → midnight of that day) instead of a ±12h age window,
  //   which was miscounting sessions when session-time-of-day differed from anchor-time-of-day.
  // - recentMuscles = "trained in the 48h leading up to the plan date" — amber warning.
  const anchorDate = planForDate
    ? (() => { const [y, m, d] = planForDate.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0); })()
    : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const anchorMs = anchorDate.getTime();
  const sameDayLastWeek = new Date(anchorDate); sameDayLastWeek.setDate(sameDayLastWeek.getDate() - 7);
  const sameDayLastWeekStart = sameDayLastWeek.getTime();
  const sameDayLastWeekEnd = sameDayLastWeekStart + 86_400_000;
  const recentCutoff = anchorMs - 2 * 86_400_000; // 48h before plan-day midnight
  const lastWeekMuscles = new Set<MuscleGroup>();
  const recentMuscles = new Set<MuscleGroup>();
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const ts = s.completedAt || s.date;
    if (ts >= sameDayLastWeekStart && ts < sameDayLastWeekEnd) {
      for (const set of s.sets) if (set.weight > 0 || set.reps > 0) lastWeekMuscles.add(set.muscle);
    }
    if (ts >= recentCutoff && ts < anchorMs) {
      for (const set of s.sets) if (set.weight > 0 || set.reps > 0) recentMuscles.add(set.muscle);
    }
  }
  const suggested = ACTIVE_MUSCLES
    .map(m => ({ id: m.id, done: weeklySetsPerMuscle[m.id] || 0 }))
    .sort((a, b) => a.done - b.done)
    .slice(0, 4)
    .map(x => x.id);

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="השבוע"
        subtitle={new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
        accent="brand"
        actions={<TabActions navigate={navigate} />}
      />
      <div className="px-4 pt-0 pb-4 max-w-lg mx-auto">

      {/* HERO — "היום" — always the first thing on the page. Absorbs live/planned/done/empty states. */}
      <TodayTile
        active={inProgress || null}
        planned={plannedToday}
        completed={completedToday}
        isStarting={plannedToday ? startingId === plannedToday.id : false}
        onNavigate={navigate}
        onStartPlanned={() => plannedToday && handleStartPlanned(plannedToday.id)}
        onReactivate={() => completedToday && handleReactivateCompleted(completedToday.id)}
        onDeleteActive={() => inProgress && setConfirmDeleteInProgress(inProgress.id)}
        onConvertActive={() => inProgress && setConvertActiveOpen(inProgress.id)}
        onDeletePlanned={() => plannedToday && setConfirmDeletePlanned(plannedToday.id)}
        onMovePlanned={() => plannedToday && setMovePlanId(plannedToday.id)}
        onRestartActive={() => inProgress && setConfirmRestartId(inProgress.id)}
        onTogglePauseActive={async () => {
          if (!inProgress) return;
          if (inProgress.pausedAt) { await firestore.resumeFreeSession(inProgress.id); }
          else { await firestore.pauseFreeSession(inProgress.id); }
          await refresh();
        }}
        onStartActive={async () => {
          if (!inProgress) return;
          await firestore.resumeFreeSession(inProgress.id);
          await refresh();
        }}
        onStartNew={() => onStartRequest?.()}
      />

      {/* Confirm-delete dialogs */}
      {confirmDeleteInProgress && (
        <ConfirmModal
          title="מחק את האימון הפתוח?"
          body="האימון יימחק לגמרי, כולל כל הסטים והתרגילים המתוכננים. לא ניתן לשחזר."
          onCancel={() => setConfirmDeleteInProgress(null)}
          onConfirm={async () => {
            const id = confirmDeleteInProgress;
            setConfirmDeleteInProgress(null);
            if (id) { await firestore.deleteFreeSession(id); await refresh(); }
          }}
        />
      )}
      {confirmDeletePlanned && (
        <ConfirmModal
          title="מחק תוכנית?"
          body="תוכנית האימון תימחק. אימונים שכבר בוצעו לא יושפעו."
          onCancel={() => setConfirmDeletePlanned(null)}
          onConfirm={async () => {
            const id = confirmDeletePlanned;
            setConfirmDeletePlanned(null);
            if (id) { await firestore.deleteFreeSession(id); await refresh(); }
          }}
        />
      )}
      {movePlanId && (
        <MovePlanModal
          currentYmd={sessions.find(s => s.id === movePlanId)?.plannedFor}
          onCancel={() => setMovePlanId(null)}
          onMove={async (newYmd) => {
            const id = movePlanId;
            setMovePlanId(null);
            if (id) { await firestore.movePlannedSession(id, newYmd); await refresh(); }
          }}
        />
      )}
      {confirmRestartId && (
        <ConfirmModal
          title="לאפס את הטיימר?"
          body="הזמן שהצטבר יאופס והכפתור יחזור ל־'התחל'. הסטים שכבר רשמת נשארים."
          onCancel={() => setConfirmRestartId(null)}
          onConfirm={async () => {
            const id = confirmRestartId;
            setConfirmRestartId(null);
            if (id) { await firestore.restartFreeSession(id); await refresh(); }
          }}
        />
      )}

      {/* ═══ Section: נפח שבועי ═══ */}
      <section className="mb-6" dir="rtl">
        <div className="sticky z-20 -mx-4 px-4 py-2.5 mb-2 backdrop-blur bg-gradient-to-b from-emerald-50/95 to-white/85 dark:from-emerald-950/40 dark:to-slate-950/90 border-b border-emerald-500/20 shadow-[0_2px_10px_-6px_rgba(16,185,129,0.35)]" style={{ top: 'var(--top-bar-h)' }}>
          <div className="max-w-lg mx-auto flex items-baseline justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-base font-bold shrink-0">
              <span>נפח שבועי</span>
              <span className="w-1 h-4 rounded-full bg-emerald-500" />
            </h2>
            {/* Both switchers on ONE line — tighter chip padding so the 3-way volume
                mode picker fits alongside the 2-way בוצע/+מתוכנן. The "ערוך" pill
                was removed; edit-goals is reachable from the same button below the
                weekly graph card. */}
            <div className="inline-flex items-center gap-1.5 shrink-0 min-w-0">
              <div className="inline-flex items-center rounded-full p-0.5 bg-slate-100 dark:bg-slate-900 text-[10px] font-semibold">
                <ToggleChip active={volumeMode === 'goals'} onClick={() => changeVolumeMode('goals')} tint="emerald">יעדים</ToggleChip>
                <ToggleChip active={volumeMode === 'last-week'} onClick={() => changeVolumeMode('last-week')} tint="emerald">שב׳ שעבר</ToggleChip>
                <ToggleChip active={volumeMode === 'absolute'} onClick={() => changeVolumeMode('absolute')} tint="emerald">מוחלט</ToggleChip>
              </div>
              <div className="inline-flex items-center rounded-full p-0.5 bg-slate-100 dark:bg-slate-900 text-[10px] font-semibold">
                <ToggleChip active={graphMode === 'done'} onClick={() => setGraphMode('done')} tint="emerald">בוצע</ToggleChip>
                <ToggleChip active={graphMode === 'planned'} onClick={() => setGraphMode('planned')} tint="blue">+ מתוכנן</ToggleChip>
              </div>
            </div>
          </div>
        </div>
        <div className="card !p-3">
          <div className="space-y-3">
            {PARENT_ORDER.map(parent => {
              const info = PARENT_INFO[parent];
              const parentClasses = MUSCLE_CLASSES[info.color];
              const children = musclesByParent(parent);
              const parentDoneOnly = children.reduce((sum, m) => sum + (weeklyBreakdown.done[m.id] || 0), 0);
              const parentPlannedOnly = children.reduce((sum, m) => sum + (weeklyBreakdown.planned[m.id] || 0), 0);
              const parentTotal = graphMode === 'planned' ? parentDoneOnly + parentPlannedOnly : parentDoneOnly;
              // effectiveTarget handles: percent mode, fixed target, and last-week fallback.
              const parentExplicitTarget = children.reduce((sum, m) => sum + (targets[m.id] || 0), 0);
              const parentTarget = children.reduce((sum, m) => sum + effectiveTarget(m.id), 0);
              const parentHasTarget = parentTarget > 0;
              // Only show the ↺ badge when the goal came from last-week fallback (not from % mode).
              const parentIsLastWeekGoal = goalsMode === 'fixed' && parentExplicitTarget === 0 && parentTarget > 0;
              const denominator = parentHasTarget ? parentTarget : (maxParentSets > 0 ? maxParentSets : 1);
              const donePct = Math.min(100, (parentDoneOnly / denominator) * 100);
              const plannedPct = graphMode === 'planned'
                ? Math.min(100 - donePct, (parentPlannedOnly / denominator) * 100)
                : 0;
              const isExpanded = expandedParents.has(parent);
              return (
                <div key={parent}>
                  <button onClick={() => toggleParent(parent)} className="w-full text-right" dir="rtl">
                    <div className="flex items-center justify-between mb-1" dir="rtl">
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-most transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
                        <span className={`font-bold text-base ${parentClasses.text}`}>{info.he}</span>
                      </div>
                      <span className="font-mono text-xs text-muted-most inline-flex items-baseline gap-1">
                        {parentHasTarget
                          ? (
                            <>
                              <span>
                                {graphMode === 'planned' && parentPlannedOnly > 0
                                  ? `${parentDoneOnly}+${parentPlannedOnly}/${parentTarget}`
                                  : `${parentDoneOnly}/${parentTarget}`}
                              </span>
                              {parentIsLastWeekGoal && (
                                <span className="text-[9px] text-muted-most/70" title="יעד = מה שעשית שבוע שעבר">↺</span>
                              )}
                            </>
                          )
                          : (parentTotal > 0 ? `${parentDoneOnly}${parentPlannedOnly > 0 && graphMode === 'planned' ? `+${parentPlannedOnly}` : ''} סטים` : '—')}
                      </span>
                    </div>
                    <div className="w-full dark:bg-slate-800/60 bg-slate-200/70 rounded-full h-2.5 overflow-hidden flex flex-row-reverse">
                      {/* Right-anchored (RTL) — DONE segment first (solid), then PLANNED extension (striped). */}
                      <div className={`${parentClasses.bar} h-2.5 transition-all ${parentDoneOnly === 0 ? 'opacity-0' : ''}`} style={{ width: `${donePct}%` }} />
                      {plannedPct > 0 && (
                        <div
                          className="h-2.5 transition-all"
                          style={{
                            width: `${plannedPct}%`,
                            backgroundImage: 'repeating-linear-gradient(45deg, rgba(59,130,246,0.55), rgba(59,130,246,0.55) 4px, rgba(59,130,246,0.20) 4px, rgba(59,130,246,0.20) 8px)',
                          }}
                        />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="space-y-1 pr-6 mt-2">
                      {children.map(m => {
                        const done = weeklySetsPerMuscle[m.id] || 0;
                        const explicitTarget = targets[m.id];
                        const target = effectiveTarget(m.id);
                        const hasTarget = target > 0;
                        const isLastWeekGoal = goalsMode === 'fixed' && !explicitTarget && target > 0;
                        const pct = hasTarget
                          ? Math.min(100, (done / target) * 100)
                          : (maxWeeklySets > 0 ? (done / maxWeeklySets) * 100 : 0);
                        const c = MUSCLE_CLASSES[m.color];
                        const isLow = hasTarget && done / target < 0.5;
                        return (
                          <div key={m.id}>
                            <div className="flex items-baseline justify-between text-[11px] mb-0.5" dir="rtl">
                              <span className={c.text}>{m.he}</span>
                              <span className={`font-mono inline-flex items-baseline gap-1 ${isLow ? 'text-amber-500' : 'text-muted-most'}`}>
                                {hasTarget ? (
                                  <>
                                    <span>{done}/{target}</span>
                                    {isLastWeekGoal && <span className="text-[9px] opacity-70" title="יעד = שבוע שעבר">↺</span>}
                                  </>
                                ) : (done > 0 ? `${done} סטים` : '—')}
                              </span>
                            </div>
                            <div className="w-full dark:bg-slate-800 bg-slate-200 rounded-full h-1 flex">
                              <div className={`${c.bar} h-1 rounded-full transition-all ml-auto ${!hasTarget && done === 0 ? 'opacity-0' : ''}`} style={{ width: `${pct}%` }} />
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
          {graphMode === 'planned' && (
            <div className="mt-3 pt-3 border-t border-subtle text-[10px] text-right flex items-center gap-3 justify-end" dir="rtl">
              <div className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-2 rounded-sm bg-emerald-500" />
                <span className="text-muted">בוצע</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-2 rounded-sm"
                  style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(59,130,246,0.55), rgba(59,130,246,0.55) 3px, rgba(59,130,246,0.20) 3px, rgba(59,130,246,0.20) 6px)' }}
                />
                <span className="text-muted">מתוכנן (×3 סטים לתרגיל)</span>
              </div>
            </div>
          )}
          <div className="text-[10px] text-muted-most mt-3 text-right" dir="rtl">
            {!hasAnyTarget ? 'יעדים: נפח של שבוע שעבר.' : goalsMode === 'percent' ? 'יעדים: חלוקת אחוזים.' : 'יעדים: סטים קבועים.'}
            {' '}
            <button onClick={() => navigate({ page: 'settings' })} className="text-blue-500 dark:text-blue-400 underline">שנה בהגדרות</button>
          </div>
        </div>
      </section>

      {/* ═══ Section: אימוני השבוע ═══ */}
      <section className="mb-4" dir="rtl">
        <div className="sticky z-20 -mx-4 px-4 py-2.5 mb-2 backdrop-blur bg-gradient-to-b from-blue-50/95 to-white/85 dark:from-blue-950/40 dark:to-slate-950/90 border-b border-blue-500/20 shadow-[0_2px_10px_-6px_rgba(59,130,246,0.35)]" style={{ top: 'var(--top-bar-h)' }}>
          <div className="max-w-lg mx-auto flex items-baseline justify-between">
            <h2 className="inline-flex items-center gap-2 text-base font-bold">
              <span>אימוני השבוע</span>
              <span className="w-1 h-4 rounded-full bg-blue-500" />
            </h2>
            <button
              onClick={() => setCopyWeekOpen(true)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
            >העתק שבוע שעבר</button>
          </div>
        </div>

        <div className="space-y-2">
          {/* Descending day-of-week: Sat(6) → Sun(0). Every day of the week is shown regardless
              of whether it has content. Empty future days get the "+ הוסף אימון" button. */}
          {[...weekSlots].sort((a, b) => b.date.getDay() - a.date.getDay()).map((slot) => {
            const isToday = slot.key === todayYmd;
            const isPast = slot.date.getTime() < new Date(new Date().setHours(0,0,0,0)).getTime();
            const hasAny = slot.completed.length > 0 || slot.planned.length > 0 || !!slot.active;
            const hasCompleted = slot.completed.length > 0;
            const dow = slot.date.getDay();
            const dateStr = `${slot.date.getDate()}/${slot.date.getMonth() + 1}`;

            // Four distinct visual moods, each with its own personality:
            //   today (no session yet)    → alive, emerald ring + glow + gradient
            //   today + already made      → alive AND settled — ring + trophy accent
            //   made-day (past+completed) → done + calm; deep card + prominent ✓ stripe
            //   rest-day (past+empty)     → quiet; dotted pattern, centered moon, no text
            //   future-day                → neutral
            let slotClass = 'border-subtle dark:bg-slate-900/40 bg-white';
            let slotStyle: React.CSSProperties | undefined;
            if (isToday && hasCompleted) {
              // Both today AND already done — layered: emerald ring (alive) + amber trim (achievement)
              slotClass = 'border-emerald-500/70 ring-2 ring-emerald-500/30 shadow-[0_6px_24px_-8px_rgba(16,185,129,0.45)] dark:bg-gradient-to-br dark:from-emerald-950/50 dark:via-amber-950/10 dark:to-slate-900/40 bg-gradient-to-br from-emerald-50/80 via-amber-50/40 to-white';
            } else if (isToday) {
              slotClass = 'border-emerald-500/60 ring-1 ring-emerald-500/25 shadow-[0_4px_20px_-8px_rgba(16,185,129,0.35)] dark:bg-gradient-to-br dark:from-emerald-950/40 dark:to-slate-900/40 bg-gradient-to-br from-emerald-50/70 to-white';
            } else if (isPast && hasCompleted) {
              // Darker card, bolder right-stripe. Feels "banked". Distinct from today's brightness.
              slotClass = 'dark:bg-slate-900/70 bg-slate-50 dark:border-slate-800 border-slate-200 border-r-[3px] border-r-emerald-500/70';
            } else if (isPast && !hasAny) {
              // Subtle dotted pattern gives the tile texture without saying "empty".
              slotClass = 'border-subtle/40 dark:bg-slate-900/30 bg-slate-50/60';
              slotStyle = {
                backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.14) 1px, transparent 0)',
                backgroundSize: '14px 14px',
              };
            }

            // If the tile has content, one click on the tile background (empty area,
            // NOT on an inner button) navigates to the primary session:
            //   active → session (live) · planned → session (edit) · else → session-view.
            // Inner buttons keep their own onClicks — the closest() check skips
            // the outer nav when the click bubbled up from an interactive element.
            const primary = slot.active
              ? { id: slot.active.id, page: 'session' as const }
              : slot.planned[0]
                ? { id: slot.planned[0].id, page: 'session' as const }
                : slot.completed[0]
                  ? { id: slot.completed[0].id, page: 'session-view' as const }
                  : null;
            const handleTileClick = (e: React.MouseEvent<HTMLDivElement>) => {
              if (!primary) return;
              const t = e.target as HTMLElement;
              if (t.closest('button, a, input, textarea, select, [role="button"]')) return;
              navigate({ page: primary.page, sessionId: primary.id });
            };
            return (
              <div
                key={slot.key}
                onClick={handleTileClick}
                className={`rounded-2xl border ${slotClass} p-3 transition-colors ${primary ? 'cursor-pointer' : ''}`}
                style={slotStyle}
                dir="rtl"
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-2" dir="rtl">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-bold ${
                      isToday ? 'text-emerald-700 dark:text-emerald-300' :
                      isPast && hasCompleted ? 'text-main' :
                      isPast && !hasAny ? 'text-muted' :
                      'text-main'
                    }`}>
                      יום {DOW_SHORT[dow]}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">היום</span>
                    )}
                    {/* Made-day check badge — filled emerald pill with ✓. Prominent, celebratory,
                        clearly distinct from today's outlined "היום" chip. */}
                    {hasCompleted && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shadow-[0_2px_6px_-1px_rgba(16,185,129,0.5)]" title="בוצע">
                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      </span>
                    )}
                    {/* Today + already made = trophy accent, "closed the day" */}
                    {isToday && hasCompleted && (
                      <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400" title="סיימת את היום">🏆</span>
                    )}
                    <span className="text-[10px] text-muted-most font-mono" dir="ltr">{dateStr}</span>
                  </div>
                  {/* Second Hebrew-long-day chip on the left was removed — it duplicated
                      the "יום X" label on the right. */}
                </div>

                {/* Content */}
                {slot.active && (() => {
                  const act = slot.active!;
                  const paused = !!act.pausedAt;
                  // Fresh = pausedAt pinned to start (== date). Fresh wins over paused
                  // for label/color, so "restart" reads as a new session (not "מושהה").
                  const fresh = paused && act.pausedAt === act.date;
                  const trulyPaused = paused && !fresh;
                  const dotBg = trulyPaused ? 'bg-amber-500' : 'bg-emerald-500';
                  const dotRingBg = trulyPaused ? 'bg-amber-400' : 'bg-emerald-400';
                  const label = fresh ? 'אימון מוכן' : (trulyPaused ? 'מושהה' : 'אימון פתוח');
                  const labelCls = trulyPaused ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300';
                  // Card tint: amber when paused so the WHOLE tile reads as on-hold,
                  // not just the dot/label. Fresh + running stay emerald.
                  const cardCls = trulyPaused
                    ? 'dark:bg-amber-950/30 bg-amber-50 border-amber-500/40'
                    : 'dark:bg-emerald-950/30 bg-emerald-50 border-emerald-500/40';
                  return (
                    <div
                      className={`mb-2 rounded-xl px-3 py-2 border relative ${cardCls}`}
                      dir="rtl"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            {!trulyPaused && !fresh && (
                              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${dotRingBg}`} />
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${dotBg}`} />
                          </span>
                          <span className={`text-[11px] font-bold uppercase tracking-widest ${labelCls}`}>{label}</span>
                        </div>
                        <div className="inline-flex items-center gap-1">
                          {!fresh && (
                            <button
                              onClick={async () => {
                                if (paused) { await firestore.resumeFreeSession(act.id); }
                                else { await firestore.pauseFreeSession(act.id); }
                                await refresh();
                              }}
                              aria-label={paused ? 'המשך' : 'השהה'}
                              title={paused ? 'המשך' : 'השהה'}
                              className={`w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-500/10 ${paused ? 'text-blue-600 dark:text-blue-300' : 'text-emerald-700 dark:text-emerald-300'}`}
                            >
                              {paused ? (
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                              ) : (
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                              )}
                            </button>
                          )}
                          {!fresh && (
                            <button
                              onClick={() => setConfirmRestartId(act.id)}
                              aria-label="אפס טיימר"
                              title="אפס טיימר"
                              className="w-7 h-7 rounded-full flex items-center justify-center text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
                            >
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 4v6h-6" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              // Primary CTA transitions state whether fresh (התחל)
                              // or paused (המשך). Timer runs after either tap.
                              if (fresh || trulyPaused) {
                                await firestore.resumeFreeSession(act.id);
                              }
                              navigate({ page: 'session', sessionId: act.id });
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                          >
                            <span>{fresh ? 'התחל' : 'המשך'}</span>
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M15 6l-6 6 6 6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <MuscleChips ids={act.muscleGroups} tint="emerald" aerobic={groupAerobic(act)} />
                    </div>
                  );
                })()}

                {slot.completed.map((s) => {
                  const realSets = s.sets.filter(x => x.weight > 0 || x.reps > 0);
                  const setsPerMuscle = new Map<string, number>();
                  for (const set of realSets) setsPerMuscle.set(set.muscle, (setsPerMuscle.get(set.muscle) || 0) + 1);
                  const muscles = effectiveMuscles(s.muscleGroups, s.sets);
                  const uniq = new Set(realSets.map(x => (x.exerciseName || '').toLowerCase()).filter(Boolean)).size;
                  return (
                    <button
                      key={s.id}
                      onClick={() => navigate({ page: 'session-view', sessionId: s.id })}
                      className="w-full text-right rounded-xl px-3 py-2 dark:bg-slate-800/60 bg-slate-100/70 hover:bg-slate-100 dark:hover:bg-slate-800 mb-2"
                      dir="rtl"
                    >
                      {muscles.length > 0 && (
                        <div className="relative rounded-lg border border-slate-400/25 dark:border-slate-500/30 p-1.5 pt-3 mb-3">
                          <span className="absolute -top-2 right-2 px-1.5 dark:bg-slate-800 bg-slate-100 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">כח</span>
                          <div className="flex gap-1 flex-wrap">
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
                        </div>
                      )}
                      {groupAerobic(s).length > 0 && (
                        <div className="relative rounded-lg border border-cyan-400/40 p-1.5 pt-3 mb-1.5">
                          <span className="absolute -top-2 right-2 px-1.5 dark:bg-slate-800 bg-slate-100 text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">אירובי</span>
                          <div className="flex gap-1 flex-wrap">
                            {groupAerobic(s).map(a => (
                              <span key={`aer-${a.type}`} className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500 text-white ring-1 ring-cyan-300/60 dark:ring-cyan-400/40 inline-flex items-center gap-1">
                                <span className="text-[11px] leading-none">{aerobicIcon(a.type)}</span>
                                <bdi>{a.type}</bdi> <span className="font-mono opacity-90">· {a.minutes}ד</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="text-[11px] text-muted flex items-center gap-1.5" dir="rtl">
                        <span className="font-mono font-semibold text-main">{uniq}</span>
                        <span>תרגילים</span>
                        <span className="text-muted-most">·</span>
                        <span className="font-mono font-semibold text-main">{realSets.length}</span>
                        <span>סטים</span>
                      </div>
                    </button>
                  );
                })}

                {slot.planned.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl px-3 py-2 dark:bg-blue-950/25 bg-blue-50 border border-blue-500/30 mb-2"
                    dir="rtl"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 inline-flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>תוכנית</span>
                      </div>
                      <button
                        onClick={() => setConfirmDeletePlanned(s.id)}
                        aria-label="מחק תוכנית"
                        className="text-red-400/70 hover:text-red-500 p-0.5"
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                        </svg>
                      </button>
                    </div>
                    <button
                      onClick={() => navigate({ page: 'session', sessionId: s.id })}
                      className="w-full text-right"
                      dir="rtl"
                    >
                      <MuscleChips ids={s.muscleGroups} tint="blue" aerobic={groupAerobic(s)} />
                      {(s.plannedExercises && s.plannedExercises.length > 0) && (
                        <div className="mt-1.5 text-[10px] text-blue-800/80 dark:text-blue-300/80">
                          {s.plannedExercises.length} תרגילים מוכנים
                        </div>
                      )}
                    </button>
                    {isToday ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setMovePlanId(s.id)}
                          className="py-2 rounded-lg border border-blue-500/50 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 text-xs font-semibold inline-flex items-center justify-center gap-1"
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                          </svg>
                          <span>העבר לתאריך</span>
                        </button>
                        <button
                          onClick={() => handleStartPlanned(s.id)}
                          disabled={startingId === s.id}
                          className="py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-60"
                        >{startingId === s.id ? '...מתחיל' : 'התחל תוכנית'}</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setMovePlanId(s.id)}
                        className="mt-2 w-full py-2 rounded-lg border border-blue-500/50 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                        </svg>
                        <span>העבר לתאריך</span>
                      </button>
                    )}
                  </div>
                ))}

                {/* Empty state */}
                {!hasAny && (
                  isPast && !isToday ? (
                    // Rest day: no text. Just a softly-lit moon centered in the tile.
                    // The dotted background pattern (on the tile itself) does the rest of the work.
                    <div className="flex items-center justify-center py-2" dir="rtl">
                      <span
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full dark:bg-slate-800/60 bg-slate-200/70 text-slate-400 dark:text-slate-500"
                        style={{ boxShadow: '0 0 20px -4px rgba(148,163,184,0.35)' }}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPlanForDate(slot.key)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg dark:bg-slate-800 bg-slate-100 dark:hover:bg-slate-700 hover:bg-slate-200 text-sm font-semibold text-main"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                        <span>הוסף אימון</span>
                      </button>
                      <button
                        onClick={() => handlePlanWithAi(slot.key)}
                        title="תכנן ליום זה עם AI"
                        aria-label="תכנן עם AI"
                        className="shrink-0 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 font-bold text-xs"
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                          <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
                        </svg>
                        <span>AI</span>
                      </button>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </section>

      </div>

      {/* Plan modal — reuses the start-session modal in "plan" mode */}
      {planForDate && (() => {
        const d = new Date(planForDate + 'T00:00:00');
        const dow = d.getDay();
        const dateLabel = `יום ${DOW_SHORT[dow]} · ${d.getDate()}/${d.getMonth() + 1}`;
        return (
          <StartSessionModal
            suggested={suggested}
            weeklySets={weeklySetsPerMuscle}
            lastWeekMuscles={lastWeekMuscles}
            recentMuscles={recentMuscles}
            heading={`תכנן ל${dateLabel}`}
            buttonLabel="שמור תוכנית"
            buttonLabelWithCount={(n) => `שמור תוכנית (${n})`}
            onClose={() => setPlanForDate(null)}
            onStart={handlePlanSave}
          />
        );
      })()}

      {copyWeekOpen && (
        <CopyWeekModal
          onClose={() => setCopyWeekOpen(false)}
          onCopy={async (includeExercises) => {
            setCopyWeekOpen(false);
            await firestore.copyPlannedWeek({ sourceWeekOffset: -1, targetWeekOffset: 0, includeExercises });
            await refresh();
          }}
        />
      )}

      {convertActiveOpen && (
        <ConvertToPlannedModal
          onClose={() => setConvertActiveOpen(null)}
          onConfirm={async (targetYmd) => {
            const id = convertActiveOpen;
            setConvertActiveOpen(null);
            if (id) {
              await firestore.convertToPlanned(id, targetYmd);
              await refresh();
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

// ─── Today hero banner ─────────────────────────────────────────
// EDGE-TO-EDGE wide strip (not a padded card). Same visual language across four states so the
// top of Home always feels like the same element, just with different content:
//   1. Live session      → emerald gradient + live pulse + "המשך"
//   2. Planned session   → blue gradient + "התחל תוכנית"
//   3. Already made today → emerald gradient + trophy + "הוסף עוד"
//   4. Nothing yet       → emerald gradient + invitation + "התחל אימון"
function TodayTile({
  active, planned, completed, isStarting,
  onNavigate, onStartPlanned, onReactivate, onDeleteActive, onConvertActive, onDeletePlanned, onMovePlanned, onRestartActive, onTogglePauseActive, onStartActive, onStartNew,
}: {
  active: FreeSession | null;
  planned: FreeSession | null;
  completed: FreeSession | null;
  isStarting: boolean;
  onNavigate: (r: Route) => void;
  onStartPlanned: () => void;
  onReactivate: () => void;
  onDeleteActive: () => void;
  onConvertActive: () => void;
  onDeletePlanned: () => void;
  onMovePlanned: () => void;
  onRestartActive: () => void;
  onTogglePauseActive: () => void;
  // Called when the fresh session's primary "התחל" button is tapped. Parent
  // should resume the timer before navigating so the transition persists.
  onStartActive: () => Promise<void> | void;
  onStartNew: () => void;
}) {
  const todayLabel = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  // ── 1. Live session ─────────────────────────────────────────
  if (active) {
    const realSetList = active.sets.filter(s => s.weight > 0 || s.reps > 0);
    const realSets = realSetList.length;
    const uniqExercises = new Set(realSetList.map(x => (x.exerciseName || '').toLowerCase()).filter(Boolean)).size;
    const plannedOnly = (active.plannedExercises || []).filter(p => !realSetList.some(s => (s.exerciseName || '').toLowerCase() === p.name.toLowerCase())).length;
    const totalExercises = uniqExercises + plannedOnly;
    const paused = !!active.pausedAt;
    // Elapsed: frozen when paused, live otherwise
    const elapsedMs = (paused ? (active.pausedAt as number) : Date.now()) - active.date;
    const minutesAgo = Math.max(0, Math.floor(elapsedMs / 60000));
    // Fresh = pausedAt pinned to the session's start moment (== date). This is
    // the "new / restart" state — despite pausedAt being set, we treat it as a
    // fresh session, NOT as "paused". Fresh takes priority over paused so labels
    // and colors read as "ready to start", not "on hold".
    const fresh = paused && active.pausedAt === active.date;
    const trulyPaused = paused && !fresh;
    const timeLabel = fresh
      ? 'עכשיו'
      : minutesAgo < 60 ? `לפני ${minutesAgo}׳`
      : minutesAgo < 60 * 24 ? `לפני ${Math.floor(minutesAgo / 60)} שעות`
      : new Date(active.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
    // Visual accents shift with state so the banner announces itself:
    //   fresh          → emerald, no pulse (nothing to keep ticking about yet)
    //   active-running → emerald ring + pulse
    //   truly paused   → amber tint + amber dot, no pulse
    const containerCls = trulyPaused
      ? 'from-amber-500/15 via-amber-500/6 dark:from-amber-500/20 dark:via-amber-500/10 border-amber-500/40 dark:border-amber-500/40'
      : 'from-emerald-500/18 via-emerald-500/10 dark:from-emerald-500/25 dark:via-emerald-500/12 border-emerald-500/50 dark:border-emerald-500/50';
    const dotBg = trulyPaused ? 'bg-amber-500' : 'bg-emerald-500';
    const dotRingBg = trulyPaused ? 'bg-amber-400' : 'bg-emerald-400';
    const label = fresh ? 'אימון מוכן' : (trulyPaused ? 'מושהה' : 'אימון פתוח');
    const labelCls = trulyPaused ? 'text-amber-800 dark:text-amber-200' : 'text-emerald-800 dark:text-emerald-200';
    const subCls = trulyPaused ? 'text-amber-700/80 dark:text-amber-300/80' : 'text-emerald-700 dark:text-emerald-300';
    return (
      <div
        className={`w-full -mx-4 mb-0 px-4 py-3 text-right bg-gradient-to-l to-transparent border-b-2 shadow-[0_4px_18px_-8px_rgba(0,0,0,0.15)] ${containerCls}`}
        style={{ width: 'calc(100% + 2rem)' }}
        dir="rtl"
      >
        <div className="max-w-lg mx-auto">
          {/* Row 1: status + counters on the RIGHT (RTL start), icon actions on the LEFT */}
          <div className="flex items-start justify-between gap-2">
            <div className="inline-flex items-center gap-2 flex-wrap min-w-0">
              <span className="relative flex h-2 w-2 self-center">
                {!trulyPaused && !fresh && (
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${dotRingBg}`} />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${dotBg}`} />
              </span>
              <span className={`text-sm font-bold ${labelCls}`}>{label}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${subCls}`}>{timeLabel}</span>
              <span className="text-muted-most">·</span>
              <span className="inline-flex items-baseline gap-1"><span className={`font-mono font-bold text-base ${subCls}`}>{totalExercises}</span><span className="text-[9px] text-muted">תר׳</span></span>
              <span className="text-muted-most">·</span>
              <span className="inline-flex items-baseline gap-1"><span className={`font-mono font-bold text-base ${subCls}`}>{realSets}</span><span className="text-[9px] text-muted">סט׳</span></span>
            </div>
            {/* Top-left action icons — pause/restart show only when there's something
                to pause or reset. Convert-to-planned + delete are always available. */}
            <div className="inline-flex items-center gap-0.5 shrink-0">
              {!fresh && (
                <IconBtn onClick={onTogglePauseActive} title={paused ? 'המשך' : 'השהה'} tint={paused ? 'blue' : 'red'}>
                  {paused ? (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  )}
                </IconBtn>
              )}
              {!fresh && (
                <IconBtn onClick={onRestartActive} title="אפס טיימר" tint="blue">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6h-6" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </IconBtn>
              )}
              <IconBtn onClick={onConvertActive} title="המר לתוכנית" tint="blue">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </IconBtn>
              <IconBtn onClick={onDeleteActive} title="מחק" tint="red">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                </svg>
              </IconBtn>
            </div>
          </div>
          {/* Row 2: chip groups on the right, primary CTA on the left */}
          <div className="flex items-start justify-between gap-2 mt-2">
            <BannerChipGroups
              muscles={active.muscleGroups}
              aerobic={groupAerobic(active)}
              muscleTint="emerald"
            />
            <button
              onClick={async () => {
                // Primary CTA resumes the timer whether the session is "fresh"
                // (never started) or "paused" (mid-session pause). Either way,
                // the user's intent is "let's go" — so state should transition.
                if (fresh || trulyPaused) await onStartActive();
                onNavigate({ page: 'session', sessionId: active.id });
              }}
              className="shrink-0 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-[0_3px_10px_-2px_rgba(16,185,129,0.5)]"
            >
              <span>{fresh ? 'התחל' : 'המשך'}</span>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. Planned for today ────────────────────────────────────
  if (planned) {
    return (
      <div
        className="w-full -mx-4 mb-0 px-4 py-3 text-right
                   bg-gradient-to-l from-blue-500/12 via-blue-500/6 to-transparent
                   dark:from-blue-500/18 dark:via-blue-500/10
                   border-b dark:border-blue-500/25 border-blue-500/25"
        style={{ width: 'calc(100% + 2rem)' }}
        dir="rtl"
      >
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 min-w-0">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 self-center">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-sm font-bold text-blue-800 dark:text-blue-200">תוכנית להיום</span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">מוכן להתחיל</span>
            </div>
            <div className="inline-flex items-center gap-1 shrink-0">
              <IconBtn onClick={onMovePlanned} title="העבר לתאריך" tint="blue">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </IconBtn>
              <IconBtn onClick={onDeletePlanned} title="מחק תוכנית" tint="red">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                </svg>
              </IconBtn>
              <button
                onClick={() => onNavigate({ page: 'session', sessionId: planned.id })}
                className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold px-1.5"
              >ערוך</button>
            </div>
          </div>
          {/* Row 2: chip groups on the right (RTL start), single primary CTA on the left */}
          <div className="flex items-start justify-between gap-2 mt-2">
            <BannerChipGroups
              muscles={planned.muscleGroups}
              aerobic={groupAerobic(planned)}
              muscleTint="blue"
            />
            <button
              onClick={onStartPlanned}
              disabled={isStarting}
              className="shrink-0 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-[0_3px_10px_-2px_rgba(59,130,246,0.5)] disabled:opacity-60"
            >
              <span>{isStarting ? '...' : 'התחל תוכנית'}</span>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. Completed today (no active/planned) ─────────────────
  if (completed) {
    const realSetList = completed.sets.filter(s => s.weight > 0 || s.reps > 0);
    const uniq = new Set(realSetList.map(x => (x.exerciseName || '').toLowerCase()).filter(Boolean)).size;
    return (
      <div
        className="w-full -mx-4 mb-0 px-4 py-3 text-right
                   bg-gradient-to-l from-emerald-500/12 via-amber-500/6 to-transparent
                   dark:from-emerald-500/18 dark:via-amber-500/10
                   border-b dark:border-emerald-500/25 border-emerald-500/25"
        style={{ width: 'calc(100% + 2rem)' }}
        dir="rtl"
      >
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shadow self-center">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </span>
              <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">סיימת אימון היום</span>
              <span className="text-[10px]">🏆</span>
            </div>
            <div className="inline-flex items-baseline gap-2 shrink-0">
              <span className="inline-flex items-baseline gap-1"><span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-300">{uniq}</span><span className="text-[9px] text-emerald-700/70 dark:text-emerald-300/70">תר׳</span></span>
              <span className="text-muted-most">·</span>
              <span className="inline-flex items-baseline gap-1"><span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-300">{realSetList.length}</span><span className="text-[9px] text-emerald-700/70 dark:text-emerald-300/70">סט׳</span></span>
            </div>
          </div>
          <div className="flex items-start justify-between gap-2 mt-2">
            <BannerChipGroups
              muscles={effectiveMuscles(completed.muscleGroups, completed.sets)}
              aerobic={groupAerobic(completed)}
              muscleTint="emerald"
            />
            <button
              onClick={onReactivate}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-emerald-500/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 text-xs font-semibold"
            >
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              <span>הוסף עוד</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 4. Empty — invitation ──────────────────────────────────
  return (
    <div
      className="w-full -mx-4 mb-0 px-4 py-3 text-right
                 bg-gradient-to-l from-emerald-500/12 via-emerald-500/6 to-transparent
                 dark:from-emerald-500/18 dark:via-emerald-500/10
                 border-b dark:border-emerald-500/25 border-emerald-500/25"
      style={{ width: 'calc(100% + 2rem)' }}
      dir="rtl"
    >
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 min-w-0">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="text-emerald-500 self-center">
            <path d="M13 2 L4 14 h6 l-2 8 l10 -13 h-6 z" />
          </svg>
          <div className="min-w-0">
            <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200">מה מתאמנים היום?</div>
            <div className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">{todayLabel}</div>
          </div>
        </div>
        <button
          onClick={onStartNew}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-[0_3px_10px_-2px_rgba(16,185,129,0.5)]"
        >
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
            <path d="M13 2 L4 14 h6 l-2 8 l10 -13 h-6 z" />
          </svg>
          <span>התחל אימון</span>
        </button>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, tint }: { children: React.ReactNode; onClick: () => void; title: string; tint: 'red' | 'blue' }) {
  const color = tint === 'red'
    ? 'text-red-400/80 hover:text-red-500 hover:bg-red-500/10'
    : 'text-blue-500/80 hover:text-blue-500 hover:bg-blue-500/10';
  return (
    <button
      onClick={onClick}
      aria-label={title}
      title={title}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors ${color}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >{children}</button>
  );
}

// ─── (unused) old thin banners kept temporarily during rollout ──
function ActiveSessionBanner({ session, onDelete, onConvertToPlanned, navigate }: { session: FreeSession; onDelete: () => void; onConvertToPlanned: () => void; navigate: (r: Route) => void }) {
  const realSetList = session.sets.filter(s => s.weight > 0 || s.reps > 0);
  const realSets = realSetList.length;
  const uniqExercises = new Set(realSetList.map(x => (x.exerciseName || '').toLowerCase()).filter(Boolean)).size;
  const plannedOnly = (session.plannedExercises || []).filter(p => !realSetList.some(s => (s.exerciseName || '').toLowerCase() === p.name.toLowerCase())).length;
  const totalExercises = uniqExercises + plannedOnly;
  const started = new Date(session.date);
  const minutesAgo = Math.max(0, Math.floor((Date.now() - session.date) / 60000));
  const timeLabel =
    minutesAgo < 60 ? `לפני ${minutesAgo}׳` :
    minutesAgo < 60 * 24 ? `לפני ${Math.floor(minutesAgo / 60)} שעות` :
    started.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate({ page: 'session', sessionId: session.id })}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate({ page: 'session', sessionId: session.id }); }}
      className="w-full -mx-4 mb-0 px-4 py-2.5 text-right group cursor-pointer
                 bg-gradient-to-l from-emerald-500/10 via-emerald-500/5 to-transparent
                 dark:from-emerald-500/15 dark:via-emerald-500/8
                 border-b dark:border-emerald-500/25 border-emerald-500/25
                 hover:from-emerald-500/15 dark:hover:from-emerald-500/20 transition-colors"
      style={{ width: 'calc(100% + 2rem)' }}
      dir="rtl"
    >
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="relative flex h-2 w-2 self-center">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">אימון פתוח</span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{timeLabel}</span>
          </div>
          <div className="inline-flex items-baseline gap-2 shrink-0">
            <div className="inline-flex items-baseline gap-1">
              <span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-300 leading-none">{totalExercises}</span>
              <span className="text-[9px] text-emerald-700/70 dark:text-emerald-300/70">תר׳</span>
            </div>
            <span className="text-muted-most">·</span>
            <div className="inline-flex items-baseline gap-1">
              <span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-300 leading-none">{realSets}</span>
              <span className="text-[9px] text-emerald-700/70 dark:text-emerald-300/70">סט׳</span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 text-base group-hover:-translate-x-0.5 transition-transform mr-1">←</span>
          </div>
        </div>
        <div className="flex items-start justify-between gap-2 mt-1.5">
          <BannerChipGroups
            muscles={session.muscleGroups}
            aerobic={groupAerobic(session)}
            muscleTint="emerald"
          />
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onConvertToPlanned(); }}
              title="המר לתוכנית"
              aria-label="המר לתוכנית"
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-blue-500/80 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              aria-label="מחק אימון פתוח"
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-red-400/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlannedTodayBanner({ session, isStarting, onStart, onDelete }: {
  session: FreeSession;
  isStarting: boolean;
  onStart: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="w-full -mx-4 mb-0 px-4 py-2.5 text-right
                 bg-gradient-to-l from-blue-500/10 via-blue-500/5 to-transparent
                 dark:from-blue-500/15 dark:via-blue-500/8
                 border-b dark:border-blue-500/25 border-blue-500/25"
      style={{ width: 'calc(100% + 2rem)' }}
      dir="rtl"
    >
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="w-2 h-2 rounded-full bg-blue-500 self-center" />
            <span className="text-sm font-bold text-blue-800 dark:text-blue-200">תוכנית להיום</span>
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">מוכן להתחיל</span>
          </div>
          <div className="inline-flex items-center gap-2 shrink-0">
            <button
              onClick={onDelete}
              aria-label="מחק תוכנית"
              className="text-red-400/70 hover:text-red-500 p-1 rounded"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
              </svg>
            </button>
            <button
              onClick={onStart}
              disabled={isStarting}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60"
            >{isStarting ? '...' : 'התחל ←'}</button>
          </div>
        </div>
        <div className="mt-1.5">
          <BannerChipGroups
            muscles={session.muscleGroups}
            aerobic={groupAerobic(session)}
            muscleTint="blue"
          />
        </div>
      </div>
    </div>
  );
}

function MuscleChips({ ids, tint, aerobic, labelBg }: { ids: MuscleGroup[]; tint: 'blue' | 'emerald'; aerobic?: Array<{ type: string; minutes: number }>; labelBg?: string }) {
  const cls = tint === 'blue'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
  const bg = labelBg || (tint === 'blue' ? 'dark:bg-slate-900 bg-blue-50' : 'dark:bg-slate-900 bg-emerald-50');
  const hasMuscles = ids.length > 0;
  const hasAerobic = (aerobic || []).length > 0;
  return (
    <div className="space-y-3">
      {hasMuscles && (
        <div className="relative rounded-lg border border-slate-400/25 dark:border-slate-500/30 p-1.5 pt-3">
          <span className={`absolute -top-2 right-2 px-1.5 ${bg} text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider`}>כח</span>
          <div className="flex flex-wrap gap-1">
            {ids.map(id => {
              const m = MUSCLE_BY_ID[id];
              if (!m) return null;
              return <span key={id} className={`text-[10px] px-1.5 py-0.5 rounded ${cls}`}>{m.he}</span>;
            })}
          </div>
        </div>
      )}
      {hasAerobic && (
        <div className="relative rounded-lg border border-cyan-400/40 p-1.5 pt-3">
          <span className={`absolute -top-2 right-2 px-1.5 ${bg} text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider`}>אירובי</span>
          <div className="flex flex-wrap gap-1">
            {(aerobic || []).map(a => (
              <span key={`aer-${a.type}`} className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500 text-white ring-1 ring-cyan-300/60 dark:ring-cyan-400/40 inline-flex items-center gap-1">
                <span className="text-[11px] leading-none">{aerobicIcon(a.type)}</span>
                <bdi>{a.type}</bdi> <span className="font-mono opacity-90">· {a.minutes}ד</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleChip({ children, active, onClick, tint }: { children: React.ReactNode; active: boolean; onClick: () => void; tint: 'emerald' | 'blue' }) {
  const activeCls = tint === 'emerald' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white';
  return (
    <button
      onClick={onClick}
      className={`px-1.5 py-0.5 rounded-full transition-colors whitespace-nowrap ${active ? activeCls : 'text-muted hover:text-main'}`}
    >{children}</button>
  );
}

function ConfirmModal({ title, body, onCancel, onConfirm }: { title: string; body: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
      <div className="card max-w-sm w-full text-right" dir="rtl">
        <h3 className="font-bold text-red-500 mb-2">{title}</h3>
        <p className="text-sm text-muted mb-4">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">ביטול</button>
          <button onClick={onConfirm} className="btn-primary flex-1 !bg-red-600 hover:!bg-red-500">מחק</button>
        </div>
      </div>
    </div>
  );
}

function ConvertToPlannedModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (ymd: string) => void }) {
  const [ymdStr, setYmdStr] = useState(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  });
  const upcoming: Array<{ ymd: string; label: string }> = [];
  {
    const t = new Date(); t.setHours(0,0,0,0);
    for (let i = 0; i < 8; i++) {
      const d = new Date(t.getTime() + i * 86_400_000);
      upcoming.push({
        ymd: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
        label: i === 0 ? `היום · ${d.getDate()}/${d.getMonth()+1}` : `${DOW_HE[d.getDay()]} · ${d.getDate()}/${d.getMonth()+1}`,
      });
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4" onClick={onClose}>
      <div className="card max-w-sm w-full text-right" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-1 text-blue-600 dark:text-blue-400">המר לתוכנית</h3>
        <p className="text-xs text-muted mb-3">
          האימון הפתוח יהפוך לתוכנית ליום שתבחר. הסטים שנרשמו יימחקו, אבל התרגילים יישמרו כתוכנית לפי השרירים.
        </p>
        <div className="max-h-64 overflow-y-auto space-y-1 mb-4">
          {upcoming.map(u => (
            <label key={u.ymd} className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg ${ymdStr === u.ymd ? 'dark:bg-blue-950/50 bg-blue-100' : 'dark:bg-slate-800 bg-slate-100'}`}>
              <input type="radio" checked={ymdStr === u.ymd} onChange={() => setYmdStr(u.ymd)} className="accent-blue-500" />
              <span className="text-sm">{u.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          <button onClick={() => onConfirm(ymdStr)} className="btn-primary flex-1 !bg-blue-600 hover:!bg-blue-500">המר</button>
        </div>
      </div>
    </div>
  );
}

function CopyWeekModal({ onClose, onCopy }: { onClose: () => void; onCopy: (includeExercises: boolean) => void }) {
  const [includeExercises, setIncludeExercises] = useState(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4" onClick={onClose}>
      <div className="card max-w-sm w-full text-right" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-2 text-blue-600 dark:text-blue-400">העתק שבוע שעבר</h3>
        <p className="text-sm text-muted mb-4">
          יוצר תוכניות לימים בהם התאמנת בשבוע שעבר. ימים שכבר יש בהם משהו — לא ידרסו.
        </p>
        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg dark:bg-slate-800 bg-slate-100">
            <input
              type="radio"
              checked={!includeExercises}
              onChange={() => setIncludeExercises(false)}
              className="accent-blue-500"
            />
            <div>
              <div className="text-sm font-semibold">רק שרירים</div>
              <div className="text-[11px] text-muted">אבחר בעצמי את התרגילים</div>
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg dark:bg-slate-800 bg-slate-100">
            <input
              type="radio"
              checked={includeExercises}
              onChange={() => setIncludeExercises(true)}
              className="accent-blue-500"
            />
            <div>
              <div className="text-sm font-semibold">שרירים + תרגילים</div>
              <div className="text-[11px] text-muted">כל התרגילים מהאימונים של שבוע שעבר</div>
            </div>
          </label>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          <button onClick={() => onCopy(includeExercises)} className="btn-primary flex-1">העתק</button>
        </div>
      </div>
    </div>
  );
}
