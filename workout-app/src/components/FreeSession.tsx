import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route, FreeSession as FreeSessionType, FreeSet, PlannedExercise } from '../types';
import type { MuscleGroup } from '../data/muscles';
import { MUSCLE_BY_ID, MUSCLE_CLASSES } from '../data/muscles';
import { useFirestore } from '../hooks/useFirestore';
import { useTimer } from '../hooks/useTimer';
import { LogSetModal } from './LogSetModal';
import { AiChatPanel } from './AiChatPanel';
import { findPersonalByName, type PersonalExercise } from '../data/exercisesDB';
import { TopBar } from './TopBar';
import { SessionScoreboard } from './SessionScoreboard';
import aiCoachIcon from '../assets/ai-coach.png';

type Props = {
  uid: string;
  sessionId: string;
  navigate: (route: Route) => void;
  historical?: boolean;   // when true: viewing/editing a past session (no rest timer, no AI chat)
};

const DEFAULT_REST_SECONDS = 30;
function getUserDefaultRest(): number {
  try {
    const v = Number(localStorage.getItem('scoreboard:defaultRestSec'));
    if (v >= 15 && v <= 600) return v;
  } catch { /* ignore */ }
  return DEFAULT_REST_SECONDS;
}

type ModalMode = { kind: 'add'; muscle?: MuscleGroup; exerciseName?: string }
              | { kind: 'edit'; set: FreeSet }
              | { kind: 'dup'; set: FreeSet }
              | { kind: 'pick' };

export function FreeSession({ uid, sessionId, navigate, historical }: Props) {
  const firestore = useFirestore(uid);
  const timer = useTimer();

  const [session, setSession] = useState<FreeSessionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [allPastSets, setAllPastSets] = useState<FreeSet[]>([]);
  const [personalExercises, setPersonalExercises] = useState<PersonalExercise[]>([]);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | undefined>(undefined);
  const [chatReplaceCtx, setChatReplaceCtx] = useState<{ name: string; muscle: MuscleGroup } | undefined>(undefined);
  const [chatNewThread, setChatNewThread] = useState(false);
  const chatKeyRef = useRef(0);
  const [confirmDeleteSetId, setConfirmDeleteSetId] = useState<string | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, all, exs] = await Promise.all([
        firestore.getFreeSession(sessionId),
        firestore.getFreeSessions(),
        firestore.listPersonalExercises(),
      ]);
      setSession(s);
      setPersonalExercises(exs);
      const past: FreeSet[] = [];
      for (const sess of all) {
        if (sess.id === sessionId) continue;
        for (const set of sess.sets) past.push(set);
      }
      setAllPastSets(past);
      setLoading(false);
    })();
  }, [sessionId]);

  const setsByMuscle = useMemo(() => {
    const map = new Map<MuscleGroup, FreeSet[]>();
    if (!session) return map;
    for (const s of session.sets) {
      const arr = map.get(s.muscle) || [];
      arr.push(s);
      map.set(s.muscle, arr);
    }
    return map;
  }, [session]);

  // Group sets by (muscle, exerciseName) — same exercise stacks into one card.
  // Newest group first; sets within a group are chronological.
  type SetGroup = { muscle: MuscleGroup; exerciseName: string; sets: FreeSet[]; latestTs: number };
  const groupedSets = useMemo<SetGroup[]>(() => {
    if (!session) return [];
    const groups = new Map<string, SetGroup>();
    for (const s of session.sets) {
      const key = `${s.muscle}::${(s.exerciseName || '').toLowerCase()}`;
      let g = groups.get(key);
      if (!g) {
        g = { muscle: s.muscle, exerciseName: s.exerciseName || '', sets: [], latestTs: 0 };
        groups.set(key, g);
      }
      g.sets.push(s);
      if (s.timestamp > g.latestTs) g.latestTs = s.timestamp;
    }
    const arr = Array.from(groups.values());
    arr.forEach(g => g.sets.sort((a, b) => a.timestamp - b.timestamp));
    arr.sort((a, b) => b.latestTs - a.latestTs);
    return arr;
  }, [session]);

  async function handleAddPlannedExercise(name: string, muscle: MuscleGroup, en?: string, isHoldTime?: boolean) {
    if (!session) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    // Resolve to canonical personal exercise (avoids duplicates)
    const ensured = await firestore.ensurePersonalExercise(trimmed, muscle, en, isHoldTime);
    const canonical = ensured?.he || trimmed;
    const finalMuscle = ensured?.defaultMuscle || muscle;
    // Add muscle to focus
    let sessionMuscles = session.muscleGroups;
    if (!sessionMuscles.includes(finalMuscle)) {
      sessionMuscles = [...sessionMuscles, finalMuscle];
      await firestore.updateFreeSessionMuscles(session.id, sessionMuscles);
    }
    // Update planned list (skip if already planned or already logged)
    const nameKey = canonical.toLowerCase();
    const alreadyLogged = session.sets.some(s => (s.exerciseName || '').toLowerCase() === nameKey);
    const alreadyPlanned = (session.plannedExercises || []).some(p => p.name.toLowerCase() === nameKey);
    let newPlanned = session.plannedExercises || [];
    if (!alreadyLogged && !alreadyPlanned) {
      newPlanned = [...newPlanned, { name: canonical, muscle: finalMuscle, addedAt: Date.now() }];
      await firestore.updatePlannedExercises(session.id, newPlanned);
    }
    // Refresh personal cache in case new entry was created
    const exs = await firestore.listPersonalExercises();
    setPersonalExercises(exs);
    setSession({ ...session, muscleGroups: sessionMuscles, plannedExercises: newPlanned });
  }

  async function handleRemovePlanned(name: string) {
    if (!session) return;
    const newPlanned = (session.plannedExercises || []).filter(p => p.name.toLowerCase() !== name.toLowerCase());
    await firestore.updatePlannedExercises(session.id, newPlanned);
    setSession({ ...session, plannedExercises: newPlanned });
  }

  async function handleSaveSet(partial: Omit<FreeSet, 'id' | 'timestamp'>, editingId?: string) {
    if (!session) return;

    // Auto-add muscle to session focus if new
    let sessionMuscles = session.muscleGroups;
    if (!sessionMuscles.includes(partial.muscle)) {
      sessionMuscles = [...sessionMuscles, partial.muscle];
      await firestore.updateFreeSessionMuscles(session.id, sessionMuscles);
    }

    // Auto-create a personal exercise entry when a new name shows up
    if (partial.exerciseName && partial.exerciseName.trim()) {
      await firestore.ensurePersonalExercise(partial.exerciseName.trim(), partial.muscle);
    }

    // Remove from planned list if it was there (now becomes a real logged exercise)
    let newPlanned = session.plannedExercises || [];
    if (partial.exerciseName) {
      const nameKey = partial.exerciseName.trim().toLowerCase();
      const before = newPlanned.length;
      newPlanned = newPlanned.filter(p => p.name.toLowerCase() !== nameKey);
      if (newPlanned.length !== before) {
        await firestore.updatePlannedExercises(session.id, newPlanned);
      }
    }

    const oldSet = editingId ? session.sets.find(s => s.id === editingId) : null;
    const wasPlaceholder = !!oldSet && oldSet.weight === 0 && oldSet.reps === 0;
    const isPlaceholderNow = partial.weight === 0 && partial.reps === 0;

    let newSets: FreeSet[];
    if (editingId) {
      newSets = session.sets.map(s => s.id === editingId
        ? { ...s, ...partial, id: s.id, timestamp: s.timestamp }
        : s);
      await firestore.updateFreeSets(session.id, newSets);
    } else {
      const set: FreeSet = { ...partial, id: `s_${Date.now()}`, timestamp: Date.now() };
      newSets = [...session.sets, set];
      await firestore.logFreeSet(session.id, set);
    }

    setSession({ ...session, muscleGroups: sessionMuscles, sets: newSets, plannedExercises: newPlanned });
    setModal(null);

    // Start timer when: new real set OR completing a placeholder into a real set.
    const shouldStartTimer = !isPlaceholderNow && (!editingId || wasPlaceholder);
    if (shouldStartTimer) {
      timer.start(getUserDefaultRest());
      // Jump to top so the user sees the just-saved set + the scoreboard.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function openChatWith(
    prompt?: string,
    replaceCtx?: { name: string; muscle: MuscleGroup },
    startFresh?: boolean,
  ) {
    setChatInitialPrompt(prompt);
    setChatReplaceCtx(replaceCtx);
    setChatNewThread(!!startFresh);
    chatKeyRef.current += 1;
    setChatOpen(true);
  }

  async function handleReplacePlanned(oldName: string, newName: string, muscle: MuscleGroup, en?: string, isHoldTime?: boolean) {
    if (!session) return;
    const nameKey = oldName.toLowerCase();
    // Safety: real sets logged → don't replace, fall back to add.
    const hasSets = session.sets.some(s => (s.exerciseName || '').toLowerCase() === nameKey);
    if (hasSets) {
      await handleAddPlannedExercise(newName, muscle, en, isHoldTime);
      return;
    }
    // Resolve new exercise to canonical (avoids duplicates)
    const trimmed = newName.trim();
    if (!trimmed) return;
    const ensured = await firestore.ensurePersonalExercise(trimmed, muscle, en, isHoldTime);
    const canonical = ensured?.he || trimmed;
    const finalMuscle = ensured?.defaultMuscle || muscle;

    // Add new muscle to focus if needed
    let sessionMuscles = session.muscleGroups;
    if (!sessionMuscles.includes(finalMuscle)) {
      sessionMuscles = [...sessionMuscles, finalMuscle];
      await firestore.updateFreeSessionMuscles(session.id, sessionMuscles);
    }

    // Atomic: build final planned list in one write.
    const withoutOld = (session.plannedExercises || []).filter(p => p.name.toLowerCase() !== nameKey);
    const alreadyPlanned = withoutOld.some(p => p.name.toLowerCase() === canonical.toLowerCase());
    const finalPlanned = alreadyPlanned
      ? withoutOld
      : [...withoutOld, { name: canonical, muscle: finalMuscle, addedAt: Date.now() }];
    await firestore.updatePlannedExercises(session.id, finalPlanned);

    const exs = await firestore.listPersonalExercises();
    setPersonalExercises(exs);
    setSession({ ...session, muscleGroups: sessionMuscles, plannedExercises: finalPlanned });
  }

  async function handleDeleteSet(setId: string) {
    if (!session) return;
    const newSets = session.sets.filter(s => s.id !== setId);
    await firestore.updateFreeSets(session.id, newSets);
    setSession({ ...session, sets: newSets });
  }

  async function handleFinish() {
    if (!session) return;
    await firestore.completeFreeSession(session.id);
    navigate({ page: 'home' });
  }

  async function handleAbandon() {
    // Session always stays alive when user just exits. To delete, use the trash button.
    // Empty state (only focus muscles picked, no sets/exercises yet) is a valid in-progress state —
    // user might come back to it after checking home / history / etc.
    navigate({ page: 'home' });
  }

  async function handleDeleteSession() {
    if (!session) return;
    await firestore.deleteFreeSession(session.id);
    navigate({ page: 'home' });
  }

  if (loading) return <div className="page-bg flex items-center justify-center text-muted">Loading...</div>;
  if (!session) return <div className="page-bg flex items-center justify-center text-muted">Session not found</div>;

  const realSetCount = session.sets.filter(s => s.weight > 0 || s.reps > 0).length;
  const exerciseCount = groupedSets.length + (session.plannedExercises || []).filter(p => !session.sets.some(s => (s.exerciseName || '').toLowerCase() === p.name.toLowerCase())).length;
  const dateLabel = new Date(session.date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });

  // Historical-view helpers
  function toDateInput(ts: number): string {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function toTimeInput(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function combineDateTime(dateStr: string, timeStr: string): number {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    return new Date(y, mo - 1, d, hh || 0, mm || 0).getTime();
  }
  function formatDuration(ms: number): string {
    if (ms <= 0) return '—';
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h} שעות ${m ? ` ${m} דקות` : ''}`.trim();
    return `${m} דקות`;
  }
  // Edit session date (keeps existing start-hour). Also snaps completedAt onto the new date.
  async function handleEditSessionDate(newDateStr: string) {
    if (!session) return;
    const newStart = combineDateTime(newDateStr, toTimeInput(session.date));
    const updates: { date: number; completedAt?: number } = { date: newStart };
    if (session.completedAt != null) {
      updates.completedAt = combineDateTime(newDateStr, toTimeInput(session.completedAt));
    }
    await firestore.updateFreeSessionDates(session.id, updates);
    setSession({ ...session, ...updates });
  }
  async function handleEditStartTime(timeStr: string) {
    if (!session) return;
    const newStart = combineDateTime(toDateInput(session.date), timeStr);
    await firestore.updateFreeSessionDates(session.id, { date: newStart });
    setSession({ ...session, date: newStart });
  }
  async function handleEditEndTime(timeStr: string) {
    if (!session) return;
    const baseDate = session.completedAt ?? session.date;
    const newEnd = combineDateTime(toDateInput(baseDate), timeStr);
    await firestore.updateFreeSessionDates(session.id, { completedAt: newEnd });
    setSession({ ...session, completedAt: newEnd });
  }
  const sessionDurationMs = session && session.completedAt ? (session.completedAt - session.date) : 0;
  const durationLabel = sessionDurationMs > 0 ? formatDuration(sessionDurationMs) : null;

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title={historical ? 'אימון' : 'אימון בתהליך'}
        accent={historical ? 'brand' : 'live'}
        tint={historical ? 'blue' : undefined}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <span>{dateLabel}</span>
            <span className="text-muted-most">·</span>
            <span className="font-mono">{exerciseCount} תרגילים</span>
            <span className="text-muted-most">·</span>
            <span className="font-mono">{realSetCount} סטים</span>
          </span>
        }
        actions={
          <>
            {!historical && (
              <button
                onClick={() => setConfirmFinish(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold
                           px-3 py-1.5 rounded-full
                           bg-emerald-600 hover:bg-emerald-500 text-white
                           transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                <span>סיים</span>
              </button>
            )}
            <button
              onClick={() => setConfirmDeleteSession(true)}
              aria-label="מחק אימון"
              className="w-9 h-9 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
              </svg>
            </button>
            <button
              onClick={historical ? () => navigate({ page: 'history' }) : handleAbandon}
              aria-label={historical ? 'חזור להיסטוריה' : 'חזור לבית'}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-slate-500/10"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </>
        }
      />
      <div className="px-4 pt-0 pb-32 max-w-lg mx-auto">
      {!historical && (
        <SessionScoreboard
          sessionStartMs={session.date}
          restRemaining={timer.remaining}
          restIsRunning={timer.isRunning}
          restIsDone={timer.isDone}
          onRestSkip={timer.skip}
          onRestAdd={timer.addTime}
        />
      )}

      {historical && (
        <div
          className="w-full -mx-4 mb-0 px-4 py-2.5 text-right
                     bg-gradient-to-l from-blue-500/10 via-blue-500/5 to-transparent
                     dark:from-blue-500/15 dark:via-blue-500/8
                     border-b dark:border-blue-500/25 border-blue-500/25"
          style={{ width: 'calc(100% + 2rem)' }}
          dir="rtl"
        >
          <div className="max-w-lg mx-auto">
            {durationLabel && (
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[10px] text-blue-700/70 dark:text-blue-300/70 uppercase tracking-widest font-semibold">משך אימון</div>
                <div className="font-mono font-bold text-base text-blue-700 dark:text-blue-300">{durationLabel}</div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <DateField
                label="תאריך"
                value={toDateInput(session.date)}
                display={new Date(session.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                onChange={handleEditSessionDate}
              />
              <TimeField
                label="שעת התחלה"
                value={toTimeInput(session.date)}
                onChange={handleEditStartTime}
              />
              <TimeField
                label="שעת סיום"
                value={session.completedAt != null ? toTimeInput(session.completedAt) : ''}
                onChange={handleEditEndTime}
                disabled={session.completedAt == null}
              />
            </div>
          </div>
        </div>
      )}

      {!historical && chatOpen && (
        <AiChatPanel
          key={chatKeyRef.current}
          uid={uid}
          sessionMuscles={session.muscleGroups}
          recentSets={[...allPastSets, ...session.sets]}
          initialPrompt={chatInitialPrompt}
          replaceContext={chatReplaceCtx}
          newThreadOnMount={chatNewThread}
          onClose={() => setChatOpen(false)}
          onAddSet={async (partial) => {
            if (chatReplaceCtx) {
              await handleReplacePlanned(chatReplaceCtx.name, partial.exerciseName, partial.muscle, partial.en, partial.isHoldTime);
              // After the first replace picked, drop out of replace mode so more suggestions become adds.
              setChatReplaceCtx(undefined);
            } else {
              await handleAddPlannedExercise(partial.exerciseName, partial.muscle, partial.en, partial.isHoldTime);
            }
          }}
        />
      )}

      {modal && (
        <LogSetModal
          uid={uid}
          sessionMuscles={session.muscleGroups}
          defaultMuscle={modal.kind === 'add' ? modal.muscle : undefined}
          allPastSets={allPastSets}
          editingSet={modal.kind === 'edit' ? modal.set : undefined}
          duplicateFrom={
            modal.kind === 'dup' ? modal.set :
            modal.kind === 'add' && modal.exerciseName
              ? { id: 'seed', muscle: (modal.muscle || 'chest') as MuscleGroup, weight: 0, reps: 0, exerciseName: modal.exerciseName, timestamp: Date.now() }
              : undefined
          }
          pickOnly={modal.kind === 'pick'}
          onClose={() => setModal(null)}
          onSave={handleSaveSet}
          onPickOnly={(name, muscle) => handleAddPlannedExercise(name, muscle)}
        />
      )}


      {/* Floating AI coach — minimal glass orb with subtle heartbeat (live sessions only) */}
      {!historical && <button
        onClick={() => openChatWith()}
        aria-label="שאל את המאמן"
        className="fixed bottom-32 left-4 z-30 bg-transparent border-0 p-0 focus:outline-none group"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <span
          className="ai-orb flex items-center justify-center w-12 h-12 rounded-full
                     bg-white/85 dark:bg-slate-900/80 backdrop-blur-md
                     border border-emerald-500/30 dark:border-emerald-400/30
                     transition-transform group-active:scale-90 group-hover:scale-105"
        >
          {/* Clean AI sparkle — emerald, matches the primary action color */}
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
          </svg>
        </span>
      </button>}

      {/* ═══ Section: בפוקוס ═══ */}
      <section className="mb-6" dir="rtl">
        <div className="sticky z-20 -mx-4 px-4 py-2.5 mb-2 backdrop-blur bg-gradient-to-b from-rose-50/95 to-white/85 dark:from-rose-950/40 dark:to-slate-950/90 border-b border-rose-500/20 shadow-[0_2px_10px_-6px_rgba(244,63,94,0.35)]" style={{ top: historical ? 'var(--top-bar-h)' : 'calc(var(--top-bar-h) + 38px)' }}>
          <div className="max-w-lg mx-auto flex items-baseline justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-base font-bold">
              <span>בפוקוס</span>
              <span className="w-1 h-4 rounded-full bg-rose-500" />
            </h2>
            <span className="text-[10px] text-muted-most uppercase tracking-widest font-semibold flex items-center gap-1 flex-wrap justify-end">
              <span className="font-mono">{session.muscleGroups.length}</span><span>שרירים</span>
              <span className="text-muted-most">·</span>
              <span className="font-mono">{exerciseCount}</span><span>תרגילים</span>
              <span className="text-muted-most">·</span>
              <span className="font-mono">{realSetCount}</span><span>סטים</span>
            </span>
          </div>
        </div>
        <div className="card !p-3">
          <div className="grid grid-cols-2 gap-2" dir="rtl">
            {session.muscleGroups.map(id => {
              const m = MUSCLE_BY_ID[id];
              if (!m) return null;
              const c = MUSCLE_CLASSES[m.color];
              const sets = setsByMuscle.get(id) || [];
              const realSets = sets.filter(s => s.weight > 0 || s.reps > 0).length;
              // Count unique exercises: from logged sets + from planned that map to this muscle
              const uniqLogged = new Set(sets.map(s => (s.exerciseName || '').toLowerCase()).filter(Boolean));
              const plannedForMuscle = (session.plannedExercises || []).filter(p =>
                p.muscle === id && !uniqLogged.has(p.name.toLowerCase())
              );
              const exCount = uniqLogged.size + plannedForMuscle.length;
              return (
                <button
                  key={id}
                  onClick={() => setModal({ kind: 'add', muscle: id })}
                  className={`text-right p-3 rounded-xl ${c.bg} ${c.text}`}
                  dir="rtl"
                >
                  <div className="text-base font-semibold">{m.he}</div>
                  <div className="text-xs opacity-80 mt-0.5">
                    {exCount} תרגילים · {realSets} סטים
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ Section: תרגילים באימון ═══ */}
      {(groupedSets.length > 0 || (session.plannedExercises || []).length > 0) && (
        <section className="mb-4" dir="rtl">
          <div className="sticky z-20 -mx-4 px-4 py-2.5 mb-2 backdrop-blur bg-gradient-to-b from-blue-50/95 to-white/85 dark:from-blue-950/40 dark:to-slate-950/90 border-b border-blue-500/20 shadow-[0_2px_10px_-6px_rgba(59,130,246,0.35)]" style={{ top: historical ? 'var(--top-bar-h)' : 'calc(var(--top-bar-h) + 38px)' }}>
            <div className="max-w-lg mx-auto flex items-baseline justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 text-base font-bold">
                <span>תרגילים באימון</span>
                <span className="w-1 h-4 rounded-full bg-blue-500" />
              </h2>
              <span className="text-[10px] text-muted-most uppercase tracking-widest font-semibold flex items-center gap-1 flex-wrap justify-end">
                <span className="font-mono">{session.muscleGroups.length}</span><span>שרירים</span>
                <span className="text-muted-most">·</span>
                <span className="font-mono">{exerciseCount}</span><span>תרגילים</span>
                <span className="text-muted-most">·</span>
                <span className="font-mono">{realSetCount}</span><span>סטים</span>
              </span>
            </div>
          </div>

          {/* 1) Exercises with logged sets — TOP */}
          {groupedSets.map(g => {
            const m = MUSCLE_BY_ID[g.muscle];
            if (!m) return null;
            const c = MUSCLE_CLASSES[m.color];
            const displayName = g.exerciseName || '(ללא שם תרגיל)';
            const enName = g.exerciseName ? findPersonalByName(personalExercises, g.exerciseName)?.en : null;
            const realSetCount = g.sets.filter(s => s.weight > 0 || s.reps > 0).length;
            return (
              <div key={`${g.muscle}::${g.exerciseName.toLowerCase()}`} className="card mb-3" dir="rtl">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="text-right flex-1 min-w-0">
                    <div className="text-base font-bold leading-tight">{displayName}</div>
                    {enName && (
                      <div className="text-[11px] text-muted mt-0.5 text-right" dir="ltr" style={{ direction: 'ltr' }}>{enName}</div>
                    )}
                  </div>
                  {/* Top-left corner: muscle chip · set count (+ hold-time badge) */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full ${c.bg} ${c.text}`}>
                      <span>{m.he}</span>
                      <span className="opacity-70 font-mono">· {realSetCount}</span>
                    </span>
                    {findPersonalByName(personalExercises, g.exerciseName)?.isHoldTime && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded dark:bg-slate-800 bg-slate-100 text-muted-most">⏱ החזקה</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {g.sets.map(s => {
                    const unit = s.unit || 'kg';
                    const isPlaceholder = s.weight === 0 && s.reps === 0;
                    const isHold = !!findPersonalByName(personalExercises, g.exerciseName)?.isHoldTime;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setModal({ kind: 'edit', set: s })}
                        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-3 bg-subtle cursor-pointer active:opacity-80 min-h-[44px] ${isPlaceholder ? 'border border-dashed dark:border-amber-700 border-amber-300' : ''}`}
                        dir="rtl"
                      >
                        <div className="font-mono text-base flex-1 text-right">
                          {isPlaceholder ? (
                            <span className="text-amber-500 text-sm">— להשלים —</span>
                          ) : isHold ? (
                            <span dir="ltr" className="inline-block font-bold">
                              {s.reps}<span className="text-xs text-muted mr-0.5">שנ'</span>
                              {s.weight > 0 && (<> · {s.weight}<span className="text-xs text-muted">{unit}</span></>)}
                            </span>
                          ) : (
                            <span dir="ltr" className="inline-block font-bold">{s.weight}<span className="text-xs text-muted mr-0.5">{unit}</span> × {s.reps}</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteSetId(s.id); }}
                          aria-label="מחק סט"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-subtle/60" dir="rtl">
                  <button
                    onClick={() => setModal({ kind: 'dup', set: g.sets[g.sets.length - 1] })}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl border-2 dark:border-emerald-500/60 border-emerald-500 text-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-500/10 hover:bg-emerald-500/5 transition-colors"
                  >+ סט נוסף</button>
                  <button
                    onClick={() => openChatWith(
                      `תציע לי תרגיל נוסף/משלים ל"${displayName}" (${m.he}), משהו שיוסיף לאימון של היום.`,
                      undefined,
                      true, // start fresh chat
                    )}
                    className="btn-secondary !py-2.5 !px-3 text-sm"
                    aria-label="הוסף עוד AI"
                  >✨</button>
                </div>
              </div>
            );
          })}

          {/* 2) Planned exercises — BELOW */}
          {(session.plannedExercises || [])
            .filter(p => !session.sets.some(s => (s.exerciseName || '').toLowerCase() === p.name.toLowerCase()))
            .map(p => {
              const m = MUSCLE_BY_ID[p.muscle];
              if (!m) return null;
              const c = MUSCLE_CLASSES[m.color];
              const enName = findPersonalByName(personalExercises, p.name)?.en;
              return (
                <div
                  key={`planned::${p.name.toLowerCase()}`}
                  className="card mb-3 border-dashed border-2 dark:border-slate-700 border-slate-300"
                  dir="rtl"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="text-right flex-1 min-w-0">
                      <div className="text-base font-bold leading-tight">{p.name}</div>
                      {enName && (
                        <div className="text-[11px] text-muted mt-0.5 text-right" dir="ltr" style={{ direction: 'ltr' }}>{enName}</div>
                      )}
                    </div>
                    {/* Top-left corner: muscle chip · 0 (dashed border already signals "planned") */}
                    <span className={`shrink-0 inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full ${c.bg} ${c.text} opacity-80`}>
                      <span>{m.he}</span>
                      <span className="opacity-70 font-mono">· 0</span>
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-subtle/60" dir="rtl">
                    <button
                      onClick={() => setModal({ kind: 'add', muscle: p.muscle, exerciseName: p.name })}
                      className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >+ רשום סט</button>
                    <button
                      onClick={() => openChatWith(
                        `תציע לי חלופה ל"${p.name}" (${m.he}), משהו שאני יכול לעשות עכשיו במקום.`,
                        { name: p.name, muscle: p.muscle },
                        true, // start fresh chat
                      )}
                      className="btn-secondary !py-2.5 !px-3 text-sm"
                    >✨ החלף</button>
                    <button
                      onClick={() => handleRemovePlanned(p.name)}
                      className="btn-secondary !py-2.5 !px-3 text-sm text-red-500"
                    >הסר</button>
                  </div>
                </div>
              );
            })}
        </section>
      )}

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t dark:from-slate-950 dark:via-slate-950 from-slate-50 via-slate-50 to-transparent">
        <div className="max-w-lg mx-auto flex gap-2">
          <button
            onClick={() => setModal({ kind: 'pick' })}
            className="btn-secondary py-4 px-4 text-sm font-semibold shrink-0"
          >+ תרגיל</button>
          <button
            onClick={() => setModal({ kind: 'add' })}
            className="btn-primary flex-1 py-5 text-xl font-semibold"
          >
            + סט
          </button>
        </div>
      </div>

      {confirmDeleteSetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full text-right" dir="rtl">
            <h3 className="font-bold text-red-500 mb-2">מחק סט?</h3>
            <p className="text-sm text-muted mb-4">
              הסט יימחק מהאימון הזה. לא ניתן לשחזר.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteSetId(null)} className="btn-secondary flex-1">ביטול</button>
              <button
                onClick={async () => {
                  const id = confirmDeleteSetId;
                  setConfirmDeleteSetId(null);
                  if (id) await handleDeleteSet(id);
                }}
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-500"
              >מחק</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full text-right" dir="rtl">
            <h3 className="font-bold text-red-500 mb-2">מחק את האימון?</h3>
            <p className="text-sm text-muted mb-4">
              האימון יימחק לגמרי, כולל כל הסטים והתרגילים המתוכננים. לא ניתן לשחזר.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteSession(false)} className="btn-secondary flex-1">ביטול</button>
              <button
                onClick={async () => {
                  setConfirmDeleteSession(false);
                  await handleDeleteSession();
                }}
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-500"
              >מחק</button>
            </div>
          </div>
        </div>
      )}

      {confirmFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full text-right" dir="rtl">
            <h3 className="font-bold text-emerald-500 mb-2">סיים אימון?</h3>
            <p className="text-sm text-muted mb-4">
              רשמת {session.sets.filter(s => s.weight > 0 || s.reps > 0).length} סטים. אחרי הסיום האימון עובר להיסטוריה.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmFinish(false)} className="btn-secondary flex-1">ביטול</button>
              <button onClick={handleFinish} className="btn-primary flex-1">סיים</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// Compact date field — shows a formatted display, hides the native picker behind it.
// The <input type="date"> covers the whole element (opacity-0) so tapping it opens the
// system picker without the picker chrome overflowing.
function DateField({
  label, value, display, onChange,
}: {
  label: string; value: string; display: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] text-muted mb-1 text-right">{label}</label>
      <div className="relative">
        <div className="input-field !text-sm !py-2.5 !px-2 !text-center font-mono pointer-events-none">
          {display}
        </div>
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

// Same idea for time.
function TimeField({
  label, value, onChange, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] text-muted mb-1 text-right">{label}</label>
      <div className="relative">
        <div className={`input-field !text-sm !py-2.5 !px-2 !text-center font-mono pointer-events-none ${disabled ? 'opacity-50' : ''}`}>
          {value || '—'}
        </div>
        <input
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
