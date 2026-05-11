import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Route, Exercise, SetLog, ExerciseStats, Session } from '../types';
import { PROGRAM } from '../data/program';
import { useProgram, useProgramStart } from '../hooks/useProgram';
import { useFirestore } from '../hooks/useFirestore';
import { useTimer } from '../hooks/useTimer';
import { searchExercises, MUSCLE_CATEGORIES, EXERCISE_LIBRARY, type LibraryExercise } from '../data/exerciseLibrary';

function findLibraryImage(name: string): string | undefined {
  const match = EXERCISE_LIBRARY.find(e => e.name.toLowerCase() === name.toLowerCase());
  return match?.imageUrl;
}
import { usePhotos, type ExercisePhoto } from '../hooks/usePhotos';
import { RestTimer } from './RestTimer';
import { PhotoPanel } from './PhotoPanel';
import { ExerciseImage } from './ExerciseImage';

type Props = {
  uid: string;
  day: 1 | 2 | 3 | 4 | 5;
  existingSessionId?: string;
  weekOverride?: number;
  navigate: (route: Route) => void;
};

export function Workout({ uid, day, existingSessionId, weekOverride, navigate }: Props) {
  const programStart = useProgramStart(uid);
  const { weekNumber, phase } = useProgram(weekOverride, programStart);
  const firestore = useFirestore(uid);
  const photos = usePhotos(uid);
  const timer = useTimer();

  const dayConfig = PROGRAM.days.find(d => d.day === day)!;
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [hiddenExercises, setHiddenExercises] = useState<Set<string>>(new Set());
  // Custom exercises with same ID as program ones act as overrides
  const customIds = new Set(customExercises.map(e => e.id));
  const programExercises = dayConfig.exercises
    .filter(e => !hiddenExercises.has(e.id))
    .map(e => customIds.has(e.id) ? customExercises.find(c => c.id === e.id)! : e);
  const addedExercises = customExercises.filter(e => !dayConfig.exercises.some(p => p.id === e.id));
  const exercises = [...programExercises, ...addedExercises];

  const [sessionId, setSessionId] = useState<string | null>(existingSessionId || null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [loggedSets, setLoggedSets] = useState<SetLog[]>([]);
  const [stats, setStats] = useState<Record<string, ExerciseStats | null>>({});
  const [lastSessionSets, setLastSessionSets] = useState<Record<string, SetLog[]>>({});
  const [exercisePhotos, setExercisePhotos] = useState<Record<string, ExercisePhoto[]>>({});
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionPartial, setSessionPartial] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [allSessions, setAllSessions] = useState<Session[] | null>(null);
  const [unitByExercise, setUnitByExercise] = useState<Record<string, string>>({});

  // Input state — string so empty field stays empty (not "0")
  const [repsLeft, setRepsLeft] = useState('');
  const [weightLeft, setWeightLeft] = useState('');
  const [repsRight, setRepsRight] = useState('');
  const [weightRight, setWeightRight] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [duration, setDuration] = useState('');
  const [durationLeft, setDurationLeft] = useState('');
  const [durationRight, setDurationRight] = useState('');

  const [showExerciseList, setShowExerciseList] = useState(false);
  const [splitSides, setSplitSides] = useState(false);
  const [showFinishEarly, setShowFinishEarly] = useState(false); // false = same for both hands
  const [confirmSkip, setConfirmSkip] = useState(false);

  // Swipe state
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);

  // Warn dialog
  const [showWarn, setShowWarn] = useState(false);
  const pendingSetRef = useRef<SetLog | null>(null);

  const currentExercise = exercises[exerciseIndex];

  // History across all sessions for the current exercise (newest first)
  const exerciseHistory = useMemo(() => {
    if (!allSessions || !currentExercise) return [] as { set: SetLog; sessionDate: number; sessionId: string }[];
    const out: { set: SetLog; sessionDate: number; sessionId: string }[] = [];
    for (const sess of allSessions) {
      if (sess.id === sessionId) continue; // exclude current in-progress session
      const dt = sess.completedAt || sess.date;
      for (const s of sess.sets) {
        if (s.exerciseId === currentExercise.id) {
          out.push({ set: s, sessionDate: dt, sessionId: sess.id });
        }
      }
    }
    out.sort((a, b) => b.sessionDate - a.sessionDate);
    return out;
  }, [allSessions, currentExercise, sessionId]);

  const unitsUsed = useMemo(() => {
    const set = new Set<string>();
    for (const h of exerciseHistory) set.add(h.set.unit || 'kg');
    // also include any unit in the current session for this exercise
    for (const s of loggedSets) if (s.exerciseId === currentExercise?.id) set.add(s.unit || 'kg');
    return [...set];
  }, [exerciseHistory, loggedSets, currentExercise]);

  // Currently selected unit for this exercise (defaults to last-used unit, or "kg")
  const currentUnit: string = (currentExercise && unitByExercise[currentExercise.id])
    || exerciseHistory[0]?.set.unit
    || 'kg';

  // History filtered to currently-selected unit
  const filteredHistory = useMemo(
    () => exerciseHistory.filter(h => (h.set.unit || 'kg') === currentUnit),
    [exerciseHistory, currentUnit]
  );

  // Most recent session's sets for current exercise + unit
  const lastSessionSetsForUnit = useMemo(() => {
    const top = filteredHistory[0];
    if (!top) return [] as SetLog[];
    return filteredHistory.filter(h => h.sessionId === top.sessionId).map(h => h.set);
  }, [filteredHistory]);

  // Init session + load custom exercises
  useEffect(() => {
    (async () => {
      // Load custom + hidden exercises for this day
      const [custom, hidden] = await Promise.all([
        firestore.getCustomExercises(day),
        firestore.getHiddenExercises(day),
      ]);
      setCustomExercises(custom);
      setHiddenExercises(new Set(hidden));

      if (existingSessionId) {
        const existing = await firestore.getSession(existingSessionId);
        if (existing) {
          setLoggedSets(existing.sets);
          setSkipped(new Set(existing.skippedExerciseIds || []));
          const allEx = [...dayConfig.exercises, ...custom];
          resumePositionWithExercises(existing.sets, allEx, new Set(existing.skippedExerciseIds || []));
          if (existing.completed) {
            setSessionComplete(true);
            setSessionPartial(!!existing.partial);
          }
        }
        setSessionId(existingSessionId);
      }
      // Don't create session here — wait until first "Did it"

      // Load all sessions once — used for unit-aware history lookup
      const sessions = await firestore.getSessions();
      setAllSessions(sessions);

      // Load last completed session for this day (for "prev sets" display)
      const lastCompleted = sessions.find(s => s.day === day && s.completed && s.id !== existingSessionId);
      if (lastCompleted) {
        const grouped: Record<string, SetLog[]> = {};
        for (const s of lastCompleted.sets) {
          if (!grouped[s.exerciseId]) grouped[s.exerciseId] = [];
          grouped[s.exerciseId].push(s);
        }
        setLastSessionSets(grouped);
      }

      setInitialized(true);
    })();
  }, []);

  function resumePositionWithExercises(sets: SetLog[], exList: Exercise[], skippedSet: Set<string> = new Set()) {
    if (sets.length === 0 && skippedSet.size === 0) return;

    const allDone = exList.every(e =>
      skippedSet.has(e.id) || sets.filter(s => s.exerciseId === e.id).length >= e.sets
    );
    if (allDone) {
      setSessionComplete(true);
      return;
    }

    const firstUndoneIdx = exList.findIndex(e =>
      !skippedSet.has(e.id) && sets.filter(s => s.exerciseId === e.id).length < e.sets
    );
    if (firstUndoneIdx >= 0) {
      setExerciseIndex(firstUndoneIdx);
      const setsForEx = sets.filter(s => s.exerciseId === exList[firstUndoneIdx].id);
      setCurrentSet(setsForEx.length + 1);
    }
  }

  // Prefill inputs whenever exercise or selected unit changes
  useEffect(() => {
    if (!currentExercise || !initialized) return;
    const lastInUnit = filteredHistory[0]?.set || null;
    prefillInputs(currentExercise, lastInUnit);
    // Load photos for this exercise
    if (!exercisePhotos[currentExercise.id]) {
      photos.getPhotos(currentExercise.id).then(p => {
        setExercisePhotos(prev => ({ ...prev, [currentExercise.id]: p }));
      });
    }
    // Keep stats doc loaded for any consumers (passed to StatsPanel below)
    if (!stats[currentExercise.id]) {
      firestore.getExerciseStats(currentExercise.id).then(s => {
        setStats(prev => ({ ...prev, [currentExercise.id]: s }));
      });
    }
  }, [exerciseIndex, initialized, currentUnit]);

  function prefillInputs(ex: Exercise, lastRef: SetLog | null) {
    const todaySets = loggedSets.filter(l => l.exerciseId === ex.id);
    const lastTodaySet = todaySets.length > 0 ? todaySets[todaySets.length - 1] : null;

    if (ex.isTimeBased) {
      const dur = String(ex.durationSeconds || 30);
      const ref = lastTodaySet || lastRef;
      if (ex.isUnilateral) {
        setDurationLeft(ref?.durationLeftSeconds != null ? String(ref.durationLeftSeconds) : dur);
        setDurationRight(ref?.durationRightSeconds != null ? String(ref.durationRightSeconds) : dur);
      } else {
        setDuration(ref?.durationSeconds != null ? String(ref.durationSeconds) : dur);
      }
      setReps(''); setWeight(''); setRepsLeft(''); setWeightLeft(''); setRepsRight(''); setWeightRight('');
      return;
    }

    setDuration(''); setDurationLeft(''); setDurationRight('');

    const ref = lastTodaySet || lastRef;
    if (ex.isUnilateral) {
      if (ref) {
        setRepsLeft(String(ref.repsLeft ?? ''));
        setWeightLeft(String(ref.weightLeft ?? ''));
        setRepsRight(String(ref.repsRight ?? ''));
        setWeightRight(String(ref.weightRight ?? ''));
      } else {
        setRepsLeft(''); setWeightLeft(''); setRepsRight(''); setWeightRight('');
      }
      setReps(''); setWeight('');
    } else {
      if (ref) {
        setReps(String(ref.reps ?? ''));
        setWeight(String(ref.weight ?? ''));
      } else {
        setReps(''); setWeight('');
      }
      setRepsLeft(''); setWeightLeft(''); setRepsRight(''); setWeightRight('');
    }
  }

  // Sync left → right when sides are linked
  function handleRepsLeftChange(val: string) {
    setRepsLeft(val);
    if (!splitSides) setRepsRight(val);
  }

  function handleWeightLeftChange(val: string) {
    setWeightLeft(val);
    if (!splitSides) setWeightRight(val);
  }

  const resetInputsForNextSet = useCallback(() => {
    // Keep weight/reps prefilled from current values for next set
    // Only clear if time-based
    if (currentExercise?.isTimeBased) {
      // Keep durations as-is
    }
  }, [currentExercise]);

  // Navigate to exercise (free movement)
  function goToExercise(idx: number) {
    if (idx < 0 || idx >= exercises.length) return;
    setExerciseIndex(idx);
    const ex = exercises[idx];
    const setsForEx = loggedSets.filter(s => s.exerciseId === ex.id);
    setCurrentSet(Math.min(setsForEx.length + 1, ex.sets + 1));
    setSplitSides(false);
    setConfirmSkip(false);
    window.scrollTo({ top: 0 });
  }

  // Swipe handlers
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = false;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only swipe if clearly horizontal: >80px, and at least 3x more horizontal than vertical
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 3) {
      if (dx > 0) {
        goToExercise(exerciseIndex - 1);
      } else {
        goToExercise(exerciseIndex + 1);
      }
    }
  }

  function getInputValue(strVal: string, placeholder: number | null): number {
    if (strVal === '' || strVal === undefined) {
      // Use placeholder as actual value
      return placeholder ?? 0;
    }
    return Number(strVal) || 0;
  }

  const handleDidIt = useCallback(async () => {
    if (!currentExercise) return;
    const ex = currentExercise;
    const setsForEx = loggedSets.filter(s => s.exerciseId === ex.id);
    const setNum = setsForEx.length + 1;

    // Check if all sets already done
    if (setNum > ex.sets) return;

    const setLog: SetLog = {
      exerciseId: ex.id,
      setNumber: setNum,
      timestamp: Date.now(),
    };
    if (!ex.isTimeBased) {
      setLog.unit = currentUnit;
    }

    if (ex.isTimeBased) {
      if (ex.isUnilateral) {
        setLog.durationLeftSeconds = getInputValue(durationLeft, ex.durationSeconds ?? 30);
        setLog.durationRightSeconds = getInputValue(durationRight, ex.durationSeconds ?? 30);
      } else {
        setLog.durationSeconds = getInputValue(duration, ex.durationSeconds ?? 30);
      }
    } else if (ex.isUnilateral) {
      setLog.repsLeft = getInputValue(repsLeft, ex.reps);
      setLog.weightLeft = getInputValue(weightLeft, null);
      setLog.repsRight = getInputValue(repsRight, ex.reps);
      setLog.weightRight = getInputValue(weightRight, null);

      // Warn if right reps > left reps
      if (setLog.repsRight! > setLog.repsLeft! && !showWarn) {
        pendingSetRef.current = setLog;
        setShowWarn(true);
        return;
      }
    } else {
      setLog.reps = getInputValue(reps, ex.reps);
      setLog.weight = getInputValue(weight, null);
    }

    await commitSet(setLog);
  }, [sessionId, currentExercise, loggedSets, weightLeft, repsLeft, weightRight, repsRight, weight, reps, duration, durationLeft, durationRight, showWarn, currentUnit]);

  const commitSet = async (setLog: SetLog) => {
    setShowWarn(false);
    pendingSetRef.current = null;

    // Create session on first set if needed
    let sid = sessionId;
    if (!sid) {
      sid = await firestore.createSession(day, weekNumber, phase.phase as 1 | 2 | 3);
      setSessionId(sid);

    }

    // Save to Firestore
    await firestore.logSet(sid, setLog);
    await firestore.updateExerciseStats(currentExercise.id, setLog, sid);

    const newLoggedSets = [...loggedSets, setLog];
    setLoggedSets(newLoggedSets);

    const ex = currentExercise;
    const setsForEx = newLoggedSets.filter(s => s.exerciseId === ex.id);

    if (setsForEx.length >= ex.sets) {
      // All sets done for this exercise
      const allDone = exercises.every(e => {
        if (skipped.has(e.id)) return true;
        const eSets = newLoggedSets.filter(s => s.exerciseId === e.id);
        return eSets.length >= e.sets;
      });
      if (allDone) {
        await firestore.completeSession(sid);
        setSessionComplete(true);
        return;
      }
      // Start timer, stay on current exercise (user can swipe to next)
      timer.start(phase.restSeconds);
      setCurrentSet(setsForEx.length + 1);
    } else {
      // Start timer for next set
      timer.start(phase.restSeconds);
      setCurrentSet(setsForEx.length + 1);
    }
  };

  const handleConfirmWarn = () => {
    if (pendingSetRef.current) {
      commitSet(pendingSetRef.current);
    }
  };

  const handleSkipCurrent = async () => {
    if (!currentExercise) return;
    let sid = sessionId;
    if (!sid) {
      sid = await firestore.createSession(day, weekNumber, phase.phase as 1 | 2 | 3);
      setSessionId(sid);
    }
    await firestore.skipExercise(sid, currentExercise.id);
    const newSkipped = new Set(skipped);
    newSkipped.add(currentExercise.id);
    setSkipped(newSkipped);

    const allDone = exercises.every(e =>
      newSkipped.has(e.id) || loggedSets.filter(s => s.exerciseId === e.id).length >= e.sets
    );
    if (allDone) {
      await firestore.completeSession(sid);
      setSessionComplete(true);
      return;
    }
    const nextIdx = exercises.findIndex(e =>
      !newSkipped.has(e.id) && loggedSets.filter(s => s.exerciseId === e.id).length < e.sets
    );
    if (nextIdx >= 0) goToExercise(nextIdx);
  };

  const handleUnskipCurrent = async () => {
    if (!currentExercise || !sessionId) return;
    await firestore.unskipExercise(sessionId, currentExercise.id);
    const newSkipped = new Set(skipped);
    newSkipped.delete(currentExercise.id);
    setSkipped(newSkipped);
  };

  if (sessionComplete) {
    return (
      <div className="page-bg p-4 pb-20 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate({ page: 'home', week: weekNumber })} className="text-muted text-2xl">←</button>
          <div className="text-center">
            {sessionPartial ? (
              <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Partial ~ not all exercises</span>
            ) : (
              <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Session Complete ✓</span>
            )}
          </div>
          <div />
        </div>
        <h2 className="text-lg font-bold mb-1">Day {day} — {dayConfig.title}</h2>
        <p className="text-muted text-sm mb-4">{loggedSets.length} sets logged</p>

        {exercises.map(ex => {
          const sets = loggedSets.filter(s => s.exerciseId === ex.id);
          const isSkipped = skipped.has(ex.id);
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
              {ex.nameHe && <p className="text-xs text-muted mb-2" dir="rtl">{ex.nameHe}</p>}
              <div className="space-y-1">
                {sets.map((s, i) => (
                  <div key={i} className="flex justify-between text-xs text-muted font-mono bg-subtle rounded px-3 py-1.5">
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

        <div className="flex gap-3 mt-4">
          <button onClick={() => navigate({ page: 'home', week: weekNumber })} className="btn-secondary flex-1">
            Home
          </button>
          <button
            onClick={async () => {
              // Save current sets as "last session" for prev reference
              if (loggedSets.length > 0) {
                const grouped: Record<string, SetLog[]> = {};
                for (const s of loggedSets) {
                  if (!grouped[s.exerciseId]) grouped[s.exerciseId] = [];
                  grouped[s.exerciseId].push(s);
                }
                setLastSessionSets(grouped);
              }
              // Delete entire session
              if (sessionId) {
                const { doc: fdoc, deleteDoc } = await import('firebase/firestore');
                const { db } = await import('../config/firebase');
                await deleteDoc(fdoc(db, 'users', uid, 'sessions', sessionId));
              }
              setSessionId(null);
              setLoggedSets([]);
              setSessionComplete(false);
              setExerciseIndex(0);
              setCurrentSet(1);
            }}
            className="btn-secondary flex-1 text-amber-500"
          >
            Restart Day
          </button>
        </div>
      </div>
    );
  }

  if (!currentExercise || !initialized) {
    return <div className="page-bg flex items-center justify-center text-muted">Loading...</div>;
  }

  const exerciseStats = stats[currentExercise.id];
  const setsForExercise = loggedSets.filter(s => s.exerciseId === currentExercise.id);
  const exerciseDone = setsForExercise.length >= currentExercise.sets;
  const nextExercise = exercises[exerciseIndex + 1];
  const nextLabel = !exerciseDone
    ? `${currentExercise.name} — Set ${setsForExercise.length + 2}`
    : nextExercise
      ? nextExercise.name
      : 'Session complete';

  return (
    <div
      className="page-bg p-4 pb-32 max-w-lg mx-auto overflow-x-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Rest Timer overlay */}
      <RestTimer
        remaining={timer.remaining}
        isRunning={timer.isRunning}
        isDone={timer.isDone}
        onSkip={timer.skip}
        onAddTime={timer.addTime}
        nextLabel={nextLabel}
      />

      {/* Warn dialog */}
      {showWarn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full">
            <h3 className="font-bold text-amber-400 mb-2">⚠️ Right reps &gt; Left reps</h3>
            <p className="text-sm text-muted mb-4">
              Unilateral protocol: right should match or be less than left. Continue anyway?
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowWarn(false); pendingSetRef.current = null; }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleConfirmWarn} className="btn-primary flex-1 !bg-amber-600 hover:!bg-amber-500">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise list panel */}
      {showExerciseList && (
        <ExerciseListPanel
          day={day}
          exercises={exercises}
          loggedSets={loggedSets}
          programExerciseCount={programExercises.length}
          onSelect={(i) => { goToExercise(i); setShowExerciseList(false); }}
          onClose={() => setShowExerciseList(false)}
          onAddExercise={async (ex) => {
            await firestore.addCustomExercise(day, ex);
            setCustomExercises(prev => [...prev, ex]);
          }}
          onDeleteExercise={async (id) => {
            const isProgramEx = dayConfig.exercises.some(e => e.id === id);
            if (isProgramEx) {
              await firestore.hideExercise(day, id);
              setHiddenExercises(prev => new Set([...prev, id]));
              // Also remove any custom override
              await firestore.deleteCustomExercise(id).catch(() => {});
              setCustomExercises(prev => prev.filter(e => e.id !== id));
            } else {
              await firestore.deleteCustomExercise(id);
              setCustomExercises(prev => prev.filter(e => e.id !== id));
            }
          }}
          onEditExercise={async (ex) => {
            await firestore.addCustomExercise(day, ex);
            setCustomExercises(prev => {
              const exists = prev.some(e => e.id === ex.id);
              return exists ? prev.map(e => e.id === ex.id ? ex : e) : [...prev, ex];
            });
          }}
          onRestartExercise={async (exerciseId) => {
            if (!sessionId) return;
            const newSets = await firestore.restartExercise(sessionId, exerciseId);
            if (newSets) setLoggedSets(newSets);
          }}
          skipped={skipped}
          onSkipExercise={async (exerciseId) => {
            let sid = sessionId;
            if (!sid) {
              sid = await firestore.createSession(day, weekNumber, phase.phase as 1 | 2 | 3);
              setSessionId(sid);
            }
            await firestore.skipExercise(sid, exerciseId);
            setSkipped(prev => new Set(prev).add(exerciseId));
          }}
          onUnskipExercise={async (exerciseId) => {
            if (!sessionId) return;
            await firestore.unskipExercise(sessionId, exerciseId);
            setSkipped(prev => {
              const next = new Set(prev);
              next.delete(exerciseId);
              return next;
            });
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate({ page: 'home', week: weekNumber })} className="text-muted text-2xl">←</button>
        <div className="text-center">
          <span className="text-xs text-muted">Day {day}</span>
          <span className="text-xs text-muted-most mx-2">·</span>
          <span className="text-xs text-muted">W{weekNumber} P{phase.phase}</span>
        </div>
        <button
          onClick={() => setShowExerciseList(true)}
          className="text-xs text-muted btn-icon px-2 py-1"
        >
          {exerciseIndex + 1}/{exercises.length} ☰
        </button>
      </div>

      {/* Exercise dots — tappable */}
      <div className="flex gap-1 mb-6">
        {exercises.map((ex, i) => {
          const done = loggedSets.filter(s => s.exerciseId === ex.id).length >= ex.sets;
          const isSkipped = skipped.has(ex.id);
          let cls: string;
          if (i === exerciseIndex) {
            cls = isSkipped ? 'bg-slate-500 h-3' : (done ? 'bg-emerald-500 h-3' : 'bg-blue-500 h-3');
          } else {
            cls = isSkipped ? 'bg-slate-400 dark:bg-slate-600 h-2' : (done ? 'bg-emerald-500 h-2' : 'dark:bg-slate-800 bg-slate-200 h-2');
          }
          return (
            <button
              key={i}
              onClick={() => goToExercise(i)}
              className={`flex-1 rounded-full transition-all ${cls}`}
            />
          );
        })}
      </div>

      {/* ── Exercise Info ── */}
      <div className="card mb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h2 className="text-lg font-bold leading-tight">{currentExercise.name}</h2>
            {currentExercise.nameHe && (
              <p className="text-sm text-muted" dir="rtl">{currentExercise.nameHe}</p>
            )}
          </div>
          <ExerciseImage imageUrl={currentExercise.imageUrl || findLibraryImage(currentExercise.name)} name={currentExercise.name} />
        </div>
        {currentExercise.muscle && (
          <p className="text-xs text-emerald-600 mb-2">
            {currentExercise.muscle}{currentExercise.muscleHe ? ` · ${currentExercise.muscleHe}` : ''}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-main text-sm">
            {currentExercise.sets}×{currentExercise.isTimeBased ? `${currentExercise.durationSeconds}s` : currentExercise.reps}
          </span>
          {currentExercise.isUnilateral && (
            <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">UNI</span>
          )}
          {currentExercise.startWeakSide && (
            <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">START LEFT</span>
          )}
          {currentExercise.tag && (
            <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">{currentExercise.tag}</span>
          )}
          {skipped.has(currentExercise.id) && (
            <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">SKIPPED</span>
          )}
        </div>
        {currentExercise.notes && (
          <div className="text-xs text-amber-600 dark:text-amber-500 mt-2 dark:bg-amber-950/30 bg-amber-50 rounded-lg px-3 py-2">
            {currentExercise.notes}
          </div>
        )}
        {/* Stats inline */}
        {!currentExercise.isTimeBased && filteredHistory.length > 0 && (
          <div className="mt-3 pt-3 border-t border-subtle text-xs">
            <StatsPanel
              history={filteredHistory.map(h => h.set)}
              isUnilateral={currentExercise.isUnilateral}
              unit={currentUnit}
              lastSessionSets={lastSessionSetsForUnit}
            />
          </div>
        )}
        {/* User note */}
        <ExerciseNote exerciseId={currentExercise.id} firestore={firestore} />
        {/* Difficulty rating */}
        <DifficultyRating exerciseId={currentExercise.id} sessionId={sessionId} isDone={exerciseDone} firestore={firestore} />
      </div>

      {/* ── Current Set ── */}
      <div className="card mb-4">
        {/* Set label */}
        <div className="text-center mb-3">
          {skipped.has(currentExercise.id) ? (
            <div className="flex flex-col items-center gap-2">
              <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-sm px-4 py-1">
                ⊘ Skipped
              </span>
              <button
                onClick={handleUnskipCurrent}
                className="text-xs text-blue-500 hover:text-blue-400"
              >Unskip</button>
            </div>
          ) : exerciseDone ? (
            <div className="flex flex-col items-center gap-2">
              <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-sm px-4 py-1">
                ✓ All {currentExercise.sets} sets done
              </span>
              <button
                onClick={async () => {
                  if (!sessionId) return;
                  const newSets = await firestore.restartExercise(sessionId, currentExercise.id);
                  if (newSets) {
                    setLoggedSets(newSets);
                    setCurrentSet(1);
                  }
                }}
                className="text-xs text-amber-500 hover:text-amber-300"
              >Restart exercise</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted font-medium">
                Set {setsForExercise.length + 1} of {currentExercise.sets}
              </span>
              <div className="flex gap-4 items-center">
                {setsForExercise.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!sessionId) return;
                      const newSets = await firestore.restartExercise(sessionId, currentExercise.id);
                      if (newSets) {
                        setLoggedSets(newSets);
                        setCurrentSet(1);
                      }
                    }}
                    className="text-[10px] text-amber-500 hover:text-amber-300"
                  >Restart exercise</button>
                )}
                {confirmSkip ? (
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-500">Skip this exercise?</span>
                    <button
                      onClick={async () => { setConfirmSkip(false); await handleSkipCurrent(); }}
                      className="text-[10px] text-amber-500 font-bold hover:text-amber-300"
                    >Yes</button>
                    <button
                      onClick={() => setConfirmSkip(false)}
                      className="text-[10px] text-muted hover:text-main"
                    >No</button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmSkip(true)}
                    className="text-[10px] text-slate-500 hover:text-slate-400"
                  >Skip exercise</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input row */}
        {!exerciseDone && !skipped.has(currentExercise.id) && (
          <div>
          {currentExercise.isTimeBased ? (
            currentExercise.isUnilateral ? (
              <div className="space-y-3">
                <InputRow
                  label="LEFT"
                  highlight
                  fields={[
                    { label: 'sec', value: durationLeft, placeholder: String(currentExercise.durationSeconds || 30), onChange: setDurationLeft, inputMode: 'numeric' },
                  ]}
                />
                <InputRow
                  label="RIGHT"
                  fields={[
                    { label: 'sec', value: durationRight, placeholder: String(currentExercise.durationSeconds || 30), onChange: setDurationRight, inputMode: 'numeric' },
                  ]}
                />
              </div>
            ) : (
              <InputRow
                fields={[
                  { label: 'sec', value: duration, placeholder: String(currentExercise.durationSeconds || 30), onChange: setDuration, inputMode: 'numeric' },
                ]}
              />
            )
          ) : currentExercise.isUnilateral ? (
            <div className="space-y-3">
              {splitSides ? (
                <>
                  <InputRow
                    label="LEFT"
                    highlight
                    fields={[
                      { label: 'Reps', value: repsLeft, placeholder: String(currentExercise.reps || ''), onChange: handleRepsLeftChange, inputMode: 'numeric' },
                      { label: currentUnit, value: weightLeft, placeholder: '0', onChange: handleWeightLeftChange, inputMode: 'decimal', step: '0.5' },
                    ]}
                  />
                  <InputRow
                    label="RIGHT"
                    fields={[
                      { label: 'Reps', value: repsRight, placeholder: String(currentExercise.reps || ''), onChange: setRepsRight, inputMode: 'numeric' },
                      { label: currentUnit, value: weightRight, placeholder: '0', onChange: setWeightRight, inputMode: 'decimal', step: '0.5' },
                    ]}
                  />
                </>
              ) : (
                <InputRow
                  label="Both sides"
                  highlight
                  fields={[
                    { label: 'Reps', value: repsLeft, placeholder: String(currentExercise.reps || ''), onChange: handleRepsLeftChange, inputMode: 'numeric' },
                    { label: currentUnit, value: weightLeft, placeholder: '0', onChange: handleWeightLeftChange, inputMode: 'decimal', step: '0.5' },
                  ]}
                />
              )}
              <button
                onClick={() => {
                  if (!splitSides) {
                    // Splitting: copy current values to right
                    setRepsRight(repsLeft);
                    setWeightRight(weightLeft);
                  }
                  setSplitSides(!splitSides);
                }}
                className="text-[10px] text-blue-500 dark:text-blue-400 text-center w-full"
              >
                {splitSides ? 'Same for both sides' : 'Different per side'}
              </button>
            </div>
          ) : (
            <InputRow
              fields={[
                { label: 'Reps', value: reps, placeholder: String(currentExercise.reps || ''), onChange: setReps, inputMode: 'numeric' },
                { label: currentUnit, value: weight, placeholder: '0', onChange: setWeight, inputMode: 'decimal', step: '0.5' },
              ]}
            />
          )}
          {!currentExercise.isTimeBased && (
            <div className="mt-3 pt-3 border-t border-subtle">
              <UnitPicker
                current={currentUnit}
                options={unitsUsed}
                onChange={(u) => setUnitByExercise(prev => ({ ...prev, [currentExercise.id]: u }))}
              />
            </div>
          )}
        </div>
      )}

        {/* Logged sets for this exercise today */}
        {setsForExercise.length > 0 && (
          <div className={`${!exerciseDone ? 'mt-3 pt-3 border-t border-subtle' : 'mt-2'}`}>
            <h4 className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Today</h4>
            <div className="space-y-1">
              {setsForExercise.map((s, i) => (
                <div key={i} className="flex justify-between text-xs text-muted font-mono bg-subtle rounded px-3 py-1.5">
                  <span>Set {s.setNumber}</span>
                  {currentExercise.isUnilateral && !currentExercise.isTimeBased && (
                    <span>L {s.repsLeft}×{s.weightLeft}{s.unit || 'kg'} · R {s.repsRight}×{s.weightRight}{s.unit || 'kg'}</span>
                  )}
                  {!currentExercise.isUnilateral && !currentExercise.isTimeBased && (
                    <span>{s.reps}×{s.weight}{s.unit || 'kg'}</span>
                  )}
                  {currentExercise.isTimeBased && currentExercise.isUnilateral && (
                    <span>L {s.durationLeftSeconds}s · R {s.durationRightSeconds}s</span>
                  )}
                  {currentExercise.isTimeBased && !currentExercise.isUnilateral && (
                    <span>{s.durationSeconds}s</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Machine Settings ── */}
      <div className="card mb-3">
        <h4 className="text-[10px] text-muted uppercase tracking-wider mb-2">Machine Settings</h4>
        <PhotoPanel
          photos={exercisePhotos[currentExercise.id] || []}
          onCapture={async (base64) => {
            await photos.savePhoto(currentExercise.id, base64);
            const updated = await photos.getPhotos(currentExercise.id);
            setExercisePhotos(prev => ({ ...prev, [currentExercise.id]: updated }));
          }}
          onDelete={async (photoId) => {
            await photos.deletePhoto(photoId);
            setExercisePhotos(prev => ({
              ...prev,
              [currentExercise.id]: (prev[currentExercise.id] || []).filter(p => p.id !== photoId),
            }));
          }}
        />
      </div>

      {/* Swipe hint + finish early */}
      <div className="text-center text-[10px] text-muted-most mb-4">
        ← swipe to navigate exercises →
        {loggedSets.length > 0 && !sessionComplete && (
          <div className="mt-2">
            {showFinishEarly ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-amber-500">Finish without completing all?</span>
                <button
                  onClick={async () => {
                    if (sessionId) {
                      await firestore.completeSession(sessionId, true);
                      setSessionComplete(true);
                      setSessionPartial(true);
                    }
                    setShowFinishEarly(false);
                  }}
                  className="text-red-500 font-bold"
                >Yes</button>
                <button onClick={() => setShowFinishEarly(false)} className="text-muted">No</button>
              </div>
            ) : (
              <button onClick={() => setShowFinishEarly(true)} className="text-amber-600 dark:text-amber-500">
                Finish early
              </button>
            )}
          </div>
        )}
      </div>

      {/* DID IT button - fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t dark:from-slate-950 dark:via-slate-950 from-slate-50 via-slate-50 to-transparent">
        <div className="max-w-lg mx-auto">
          {(() => {
            const allExercisesDone = exercises.every(e =>
              skipped.has(e.id) || loggedSets.filter(s => s.exerciseId === e.id).length >= e.sets
            );
            const nextUndoneIdx = exercises.findIndex(e =>
              !skipped.has(e.id) && loggedSets.filter(s => s.exerciseId === e.id).length < e.sets
            );

            if (allExercisesDone) {
              return (
                <button
                  onClick={async () => {
                    if (sessionId) {
                      await firestore.completeSession(sessionId);
                                    setSessionComplete(true);
                    }
                  }}
                  className="btn-primary w-full text-xl py-5"
                >
                  Finish Session ✓
                </button>
              );
            }
            if (exerciseDone && nextUndoneIdx >= 0) {
              return (
                <button
                  onClick={() => goToExercise(nextUndoneIdx)}
                  className="btn-primary w-full text-xl py-5"
                >
                  Next Exercise →
                </button>
              );
            }
            return (
              <button
                onClick={handleDidIt}
                className="btn-primary w-full text-xl py-5"
              >
                Did it! 💪
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// Unified input row component
type FieldConfig = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  inputMode: 'numeric' | 'decimal';
  step?: string;
};

function InputRow({ label, highlight, fields }: { label?: string; highlight?: boolean; fields: FieldConfig[] }) {
  return (
    <div>
      {label && (
        <div className={`text-xs font-medium mb-1.5 ${highlight ? 'text-blue-500 dark:text-blue-400' : 'text-muted'}`}>
          {label}
        </div>
      )}
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${fields.length}, 1fr)` }}>
        {fields.map((f, i) => (
          <div key={i}>
            <label className="block text-[10px] text-muted mb-1">{f.label}</label>
            <input
              type="text"
              value={f.value}
              onChange={e => {
                const v = e.target.value;
                if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) f.onChange(v);
              }}
              placeholder={f.placeholder}
              className={`input-field ${highlight ? '!border-blue-700 focus:!ring-blue-500' : ''}`}
              inputMode={f.inputMode}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function DifficultyRating({ exerciseId, sessionId, isDone, firestore }: { exerciseId: string; sessionId: string | null; isDone: boolean; firestore: ReturnType<typeof useFirestore> }) {
  const [lastRating, setLastRating] = useState<{ difficulty: string; addWeight: boolean } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
    firestore.getExerciseDifficulty(exerciseId).then(setLastRating);
  }, [exerciseId]);

  async function rate(difficulty: 'easy' | 'ok' | 'hard', addWeight: boolean) {
    if (!sessionId) return;
    await firestore.saveExerciseDifficulty(exerciseId, sessionId, difficulty, addWeight);
    setLastRating({ difficulty, addWeight });
    setSaved(true);
  }

  return (
    <div className="mt-3 pt-3 border-t border-subtle">
      {lastRating && !saved && (
        <div className="text-[10px] text-muted mb-2">
          Last: <span className={lastRating.difficulty === 'easy' ? 'text-emerald-500' : lastRating.difficulty === 'hard' ? 'text-red-500' : 'text-amber-500'}>{lastRating.difficulty}</span>
          {lastRating.addWeight && <span className="text-blue-500 ml-1">↑ add weight</span>}
        </div>
      )}
      {isDone && !saved && (
        <div>
          <div className="text-[10px] text-muted mb-1.5">How was it?</div>
          <div className="flex gap-2 mb-2">
            <button onClick={() => rate('easy', false)} className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Easy</button>
            <button onClick={() => rate('ok', false)} className="flex-1 text-xs py-1.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">OK</button>
            <button onClick={() => rate('hard', false)} className="flex-1 text-xs py-1.5 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">Hard</button>
          </div>
          <button onClick={() => rate('easy', true)} className="w-full text-[10px] text-blue-500 dark:text-blue-400">
            ↑ Add weight next time
          </button>
        </div>
      )}
      {saved && (
        <div className="text-[10px] text-emerald-500">Saved ✓</div>
      )}
    </div>
  );
}

function ExerciseNote({ exerciseId, firestore }: { exerciseId: string; firestore: ReturnType<typeof useFirestore> }) {
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef<number | null>(null);

  useEffect(() => {
    setLoaded(false);
    setEditing(false);
    firestore.getExerciseNote(exerciseId).then(n => {
      setNote(n);
      setLoaded(true);
    });
  }, [exerciseId]);

  function handleChange(val: string) {
    setNote(val);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = window.setTimeout(() => {
      firestore.saveExerciseNote(exerciseId, val);
    }, 1000);
  }

  if (!loaded) return null;

  return (
    <div className="mt-3 pt-3 border-t border-subtle">
      {editing ? (
        <div>
          <textarea
            value={note}
            onChange={e => handleChange(e.target.value)}
            placeholder="הוסף הערה..."
            className="input-field !text-right !text-xs !py-2 !px-3 !text-sm min-h-[60px] resize-none"
            dir="rtl"
            autoFocus
            onBlur={() => { if (!note.trim()) setEditing(false); }}
          />
          <button onClick={() => setEditing(false)} className="text-[10px] text-muted mt-1">Done</button>
        </div>
      ) : note ? (
        <button onClick={() => setEditing(true)} className="text-right w-full" dir="rtl">
          <div className="text-[10px] text-muted font-semibold mb-1">הערות</div>
          <div className="text-xs text-muted-more whitespace-pre-wrap">{note}</div>
        </button>
      ) : (
        <button onClick={() => setEditing(true)} className="text-[10px] text-muted">
          + Add note
        </button>
      )}
    </div>
  );
}

function StatsPanel({ history, isUnilateral, unit, lastSessionSets }: { history: SetLog[]; isUnilateral: boolean; unit: string; lastSessionSets: SetLog[] }) {
  if (history.length === 0) return null;

  if (isUnilateral) {
    const last = history[0];
    let maxLW = 0, maxLR = 0, maxRW = 0, maxRR = 0;
    let sumL = 0, sumR = 0;
    for (const s of history) {
      const lw = s.weightLeft ?? 0; const lr = s.repsLeft ?? 0;
      const rw = s.weightRight ?? 0; const rr = s.repsRight ?? 0;
      if (lw > maxLW || (lw === maxLW && lr > maxLR)) { maxLW = lw; maxLR = lr; }
      if (rw > maxRW || (rw === maxRW && rr > maxRR)) { maxRW = rw; maxRR = rr; }
      sumL += lw; sumR += rw;
    }
    const avgL = sumL / history.length;
    const avgR = sumR / history.length;
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-muted">Prev</span>
          <span className="font-mono text-main">
            L {last.repsLeft}×{last.weightLeft}{unit} · R {last.repsRight}×{last.weightRight}{unit}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Max</span>
          <span className="font-mono text-emerald-400">
            L {maxLR}×{maxLW}{unit} · R {maxRR}×{maxRW}{unit}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Avg</span>
          <span className="font-mono text-muted">
            L {avgL.toFixed(1)}{unit} · R {avgR.toFixed(1)}{unit}
          </span>
        </div>
        <LastSetsDisplay sets={lastSessionSets} isUnilateral={true} unit={unit} />
      </div>
    );
  }

  const last = history[0];
  let maxW = 0, maxR = 0, sum = 0;
  for (const s of history) {
    const w = s.weight ?? 0; const r = s.reps ?? 0;
    if (w > maxW || (w === maxW && r > maxR)) { maxW = w; maxR = r; }
    sum += w;
  }
  const avg = sum / history.length;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-muted">Prev</span>
        <span className="font-mono text-main">{last.reps}×{last.weight}{unit}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">Max</span>
        <span className="font-mono text-emerald-400">{maxR}×{maxW}{unit}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">Avg</span>
        <span className="font-mono text-muted">{avg.toFixed(1)}{unit}</span>
      </div>
      <LastSetsDisplay sets={lastSessionSets} isUnilateral={false} unit={unit} />
    </div>
  );
}

function UnitPicker({ current, options, onChange }: { current: string; options: string[]; onChange: (u: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');

  const all = Array.from(new Set([...options, 'kg', current]));

  // Compact view when only kg is in play and user hasn't asked to change
  if (all.length === 1 && all[0] === 'kg' && !adding) {
    return (
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-muted">Unit:</span>
        <span className="text-main">kg</span>
        <button onClick={() => setAdding(true)} className="text-muted-most underline">change</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-muted mr-1">Unit:</span>
      {all.map(u => (
        <button
          key={u}
          onClick={() => onChange(u)}
          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
            u === current
              ? 'bg-blue-500 text-white'
              : 'dark:bg-slate-800 dark:text-slate-300 bg-slate-200 text-slate-600 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >{u}</button>
      ))}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = text.trim();
            if (v) onChange(v);
            setText(''); setAdding(false);
          }}
          className="flex items-center gap-1"
        >
          <input
            autoFocus
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="lb, L5..."
            className="input-field !text-[10px] !py-0.5 !px-2"
            style={{ width: '70px' }}
          />
          <button type="submit" className="text-[10px] text-blue-500 px-1">✓</button>
          <button type="button" onClick={() => { setAdding(false); setText(''); }} className="text-[10px] text-muted px-1">×</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="text-[10px] text-muted-most">+ other</button>
      )}
    </div>
  );
}

function LastSetsDisplay({ sets, isUnilateral, unit }: { sets?: SetLog[]; isUnilateral: boolean; unit?: string }) {
  const [show, setShow] = useState(false);
  if (!sets || sets.length === 0) return null;
  const u = (s: SetLog) => s.unit || unit || 'kg';
  return (
    <div className="mt-1.5 pt-1.5 border-t border-subtle">
      <button onClick={() => setShow(!show)} className="text-[10px] text-muted">
        Last session sets {show ? '▲' : '▼'}
      </button>
      {show && (
        <div className="mt-1 space-y-0.5">
          {sets.map((s, i) => (
            <div key={i} className="flex justify-between font-mono text-muted-more">
              <span>S{s.setNumber}</span>
              {isUnilateral ? (
                <span>L {s.repsLeft}×{s.weightLeft}{u(s)} · R {s.repsRight}×{s.weightRight}{u(s)}</span>
              ) : (
                <span>{s.reps}×{s.weight}{u(s)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// === Exercise List Panel with Add Exercise ===

function ExerciseListPanel({ day, exercises, loggedSets, onSelect, onClose, onAddExercise, onDeleteExercise, onEditExercise, onRestartExercise, programExerciseCount, skipped, onSkipExercise, onUnskipExercise }: {
  day: 1 | 2 | 3 | 4 | 5;
  exercises: Exercise[];
  loggedSets: SetLog[];
  onSelect: (i: number) => void;
  onClose: () => void;
  onAddExercise: (ex: Exercise) => void;
  onDeleteExercise: (id: string) => void;
  onEditExercise: (ex: Exercise) => void;
  onRestartExercise: (exerciseId: string) => void;
  programExerciseCount: number;
  skipped: Set<string>;
  onSkipExercise: (id: string) => void;
  onUnskipExercise: (id: string) => void;
}) {
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LibraryExercise[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customNameHe, setCustomNameHe] = useState('');
  const [customMuscle, setCustomMuscle] = useState('');
  const [customMuscleHe, setCustomMuscleHe] = useState('');
  const [customSets, setCustomSets] = useState('3');
  const [customReps, setCustomReps] = useState('12');
  const [customIsUni, setCustomIsUni] = useState(false);
  const [customIsTime, setCustomIsTime] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmSkipId, setConfirmSkipId] = useState<string | null>(null);

  useEffect(() => {
    if (searchQuery.length >= 3) {
      setSearchResults(searchExercises(searchQuery));
      setSelectedCategory(null);
    } else if (searchQuery.length === 0) {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const categoryExercises = selectedCategory
    ? EXERCISE_LIBRARY.filter(e => e.category === selectedCategory)
    : [];

  function selectFromLibrary(lib: LibraryExercise) {
    setCustomName(lib.name);
    setCustomNameHe(lib.nameHe);
    setCustomMuscle(lib.muscle);
    setCustomMuscleHe(lib.muscleHe);
    setCustomIsUni(lib.isUnilateral);
    setCustomIsTime(lib.isTimeBased);
    setCustomImageUrl(lib.imageUrl || '');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCategory(null);
  }

  function handleSave() {
    if (!customName.trim()) return;
    const ex: Exercise = {
      id: editingExercise?.id || `custom_d${day}_${Date.now()}`,
      name: customName.trim(),
      nameHe: customNameHe.trim() || undefined,
      muscle: customMuscle.trim() || undefined,
      muscleHe: customMuscleHe.trim() || undefined,
      sets: Number(customSets) || 3,
      reps: customIsTime ? null : (Number(customReps) || 12),
      durationSeconds: customIsTime ? (Number(customReps) || 30) : undefined,
      isUnilateral: customIsUni,
      isTimeBased: customIsTime,
      startWeakSide: customIsUni,
      imageUrl: customImageUrl || undefined,
      tag: customTag.trim() || undefined,
    };
    if (mode === 'edit') {
      onEditExercise(ex);
    } else {
      onAddExercise(ex);
    }
    setMode('list');
    resetForm();
  }

  function startEdit(ex: Exercise) {
    setEditingExercise(ex);
    setCustomName(ex.name);
    setCustomNameHe(ex.nameHe || '');
    setCustomMuscle(ex.muscle || '');
    setCustomMuscleHe(ex.muscleHe || '');
    setCustomSets(String(ex.sets));
    setCustomReps(String(ex.isTimeBased ? (ex.durationSeconds || 30) : (ex.reps || 12)));
    setCustomIsUni(ex.isUnilateral);
    setCustomIsTime(ex.isTimeBased);
    setCustomImageUrl(ex.imageUrl || '');
    setCustomTag(ex.tag || '');
    setMode('edit');
  }

  function resetForm() {
    setCustomName(''); setCustomNameHe(''); setCustomMuscle(''); setCustomMuscleHe('');
    setCustomSets('3'); setCustomReps('12'); setCustomIsUni(false); setCustomIsTime(false); setCustomImageUrl('');
    setCustomTag('');
    setSearchQuery(''); setSearchResults([]); setSelectedCategory(null);
  }

  if (mode === 'add' || mode === 'edit') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col overlay-solid">
        <div className="flex items-center justify-between p-4 border-b border-subtle">
          <h2 className="font-bold text-lg">{mode === 'edit' ? 'Edit Exercise' : 'Add Exercise'}</h2>
          <button onClick={() => { setMode('list'); resetForm(); }} className="text-muted text-2xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Search from library */}
          <div>
            <label className="block text-xs text-muted mb-1">Search exercise library</label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Type 3+ letters..."
              className="input-field !text-left !text-sm"
              autoFocus
            />
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-subtle card !p-0">
                {searchResults.map((r, i) => (
                  <div key={i} className="flex items-center border-b border-subtle/50 last:border-0">
                    <button
                      onClick={() => selectFromLibrary(r)}
                      className="flex-1 text-left px-3 py-2 dark:hover:bg-slate-800 hover:bg-slate-100"
                    >
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted">{r.nameHe} · {r.muscle} · {r.muscleHe}</div>
                    </button>
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(r.name + ' exercise form')}&tbm=isch`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 w-8 h-8 flex items-center justify-center text-muted-most hover:text-main text-xs"
                      onClick={e => e.stopPropagation()}
                    >?</a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Browse by category */}
          {!searchQuery && !customName && (
            <div>
              <label className="block text-xs text-muted mb-2">Or browse by muscle</label>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                    className={`text-xs rounded-lg px-3 py-1.5 transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-800 text-emerald-200'
                        : 'dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {cat.name} · {cat.nameHe}
                  </button>
                ))}
              </div>
              {selectedCategory && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-subtle card !p-0">
                  {categoryExercises.map((r, i) => (
                      <div key={i} className="flex items-center border-b border-subtle/50 last:border-0">
                        <button
                          onClick={() => selectFromLibrary(r)}
                          className="flex-1 text-left px-3 py-2 dark:hover:bg-slate-800 hover:bg-slate-100"
                        >
                          <div className="text-sm font-medium">{r.name}</div>
                          <div className="text-xs text-muted">{r.nameHe} · {r.muscle} · {r.muscleHe}</div>
                        </button>
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(r.name + ' exercise form')}&tbm=isch`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 w-8 h-8 flex items-center justify-center text-muted-most hover:text-main text-xs"
                          onClick={e => e.stopPropagation()}
                        >?</a>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Manual fields */}
          <div className="border-t border-subtle pt-4 space-y-3">
            <div className="text-xs text-muted uppercase tracking-wider">Exercise details</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted mb-1">Name (EN)</label>
                <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Exercise name" className="input-field !text-left !text-sm" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1">Name (HE)</label>
                <input type="text" value={customNameHe} onChange={e => setCustomNameHe(e.target.value)} placeholder="שם התרגיל" className="input-field !text-left !text-sm" dir="rtl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted mb-1">Muscle (EN)</label>
                <input type="text" value={customMuscle} onChange={e => setCustomMuscle(e.target.value)} placeholder="e.g. Chest" className="input-field !text-left !text-sm" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1">Muscle (HE)</label>
                <input type="text" value={customMuscleHe} onChange={e => setCustomMuscleHe(e.target.value)} placeholder="למשל חזה" className="input-field !text-left !text-sm" dir="rtl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted mb-1">Sets</label>
                <input type="number" value={customSets} onChange={e => setCustomSets(e.target.value)} className="input-field !text-sm" inputMode="numeric" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1">{customIsTime ? 'Seconds' : 'Reps'}</label>
                <input type="number" value={customReps} onChange={e => setCustomReps(e.target.value)} className="input-field !text-sm" inputMode="numeric" />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-main">
                <input type="checkbox" checked={customIsUni} onChange={e => setCustomIsUni(e.target.checked)} className="rounded dark:bg-slate-800 dark:border-slate-600 bg-white border-slate-300" />
                Unilateral
              </label>
              <label className="flex items-center gap-2 text-sm text-main">
                <input type="checkbox" checked={customIsTime} onChange={e => setCustomIsTime(e.target.checked)} className="rounded dark:bg-slate-800 dark:border-slate-600 bg-white border-slate-300" />
                Time-based
              </label>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1">Tag (optional · e.g. "alt", "pair-A")</label>
              <input type="text" value={customTag} onChange={e => setCustomTag(e.target.value)} placeholder="alternate / pair label" className="input-field !text-left !text-sm" />
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="p-4 border-t border-subtle">
          <button
            onClick={handleSave}
            disabled={!customName.trim()}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
              customName.trim() ? 'btn-primary' : 'dark:bg-slate-800 dark:text-slate-600 bg-slate-200 text-slate-400'
            }`}
          >
            {mode === 'edit' ? 'Save Changes' : 'Add Exercise'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-solid">
      <div className="flex items-center justify-between p-4 border-b border-subtle">
        <h2 className="font-bold text-lg">Day {day} — Exercises</h2>
        <button onClick={onClose} className="text-muted text-2xl">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {exercises.map((ex, i) => {
          const done = loggedSets.filter(s => s.exerciseId === ex.id).length >= ex.sets;
          const isCustom = i >= programExerciseCount;
          const isSkipped = skipped.has(ex.id);
          return (
            <div
              key={ex.id}
              className={`rounded-xl p-3 transition-colors ${
                isSkipped ? 'dark:bg-slate-900/60 bg-slate-100 border dark:border-slate-700/50 border-slate-200 opacity-70'
                : done ? 'dark:bg-emerald-950/40 bg-emerald-50 border dark:border-emerald-800/50 border-emerald-200' : 'card !rounded-xl'
              }`}
            >
              <div className="flex items-start gap-2" onClick={() => onSelect(i)}>
                <div className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-most font-mono text-xs">{i + 1}.</span>
                    <span className="font-medium text-sm">{ex.name}</span>
                    {done && !isSkipped && <span className="text-emerald-500 text-xs">✓</span>}
                    {isSkipped && <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-[10px]">⊘ SKIPPED</span>}
                    {isCustom && <span className="badge bg-purple-900 text-purple-300 text-[10px]">CUSTOM</span>}
                    {ex.tag && <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-[10px]">{ex.tag}</span>}
                  </div>
                  {ex.nameHe && <div className="text-xs text-muted mt-0.5 ml-5" dir="rtl">{ex.nameHe}</div>}
                  {ex.muscle && (
                    <div className="text-xs text-emerald-600 mt-1 ml-5">
                      {ex.muscle}{ex.muscleHe ? ` · ${ex.muscleHe}` : ''}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <div className="font-mono text-xs text-muted">
                    {ex.sets}×{ex.isTimeBased ? `${ex.durationSeconds}s` : ex.reps}
                  </div>
                  {ex.isUnilateral && <span className="badge bg-blue-900 text-blue-300 text-[10px]">UNI</span>}
                  <div onClick={e => e.stopPropagation()}>
                    <ExerciseImage imageUrl={ex.imageUrl || findLibraryImage(ex.name)} name={ex.name} />
                  </div>
                </div>
              </div>
              {/* Actions: edit, delete, restart */}
              <div className="flex gap-3 mt-2 ml-5">
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(ex); }}
                  className="text-[10px] text-blue-400 hover:text-blue-300"
                >Edit</button>
                {confirmDelete === ex.id ? (
                  <span className="flex gap-1 items-center">
                    <span className="text-[10px] text-red-400">Delete?</span>
                    <button onClick={() => { onDeleteExercise(ex.id); setConfirmDelete(null); }} className="text-[10px] text-red-400 font-bold hover:text-red-300">Yes</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-muted hover:text-main">No</button>
                  </span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(ex.id); }}
                    className="text-[10px] text-red-600 hover:text-red-400"
                  >Delete</button>
                )}
                {done && !isSkipped && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRestartExercise(ex.id); }}
                    className="text-[10px] text-amber-500 hover:text-amber-300"
                  >Restart</button>
                )}
                {isSkipped ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onUnskipExercise(ex.id); }}
                    className="text-[10px] text-blue-500 hover:text-blue-400"
                  >Unskip</button>
                ) : !done && (
                  confirmSkipId === ex.id ? (
                    <span className="flex gap-1 items-center" onClick={e => e.stopPropagation()}>
                      <span className="text-[10px] text-amber-500">Skip?</span>
                      <button onClick={() => { onSkipExercise(ex.id); setConfirmSkipId(null); }} className="text-[10px] text-amber-500 font-bold hover:text-amber-300">Yes</button>
                      <button onClick={() => setConfirmSkipId(null)} className="text-[10px] text-muted hover:text-main">No</button>
                    </span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmSkipId(ex.id); }}
                      className="text-[10px] text-slate-500 hover:text-slate-400"
                    >Skip</button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Add exercise button — sticky footer */}
      <div className="sticky bottom-0 p-4 border-t border-subtle overlay-solid">
        <button
          onClick={() => setMode('add')}
          className="w-full py-3 rounded-xl border border-dashed dark:border-slate-700 border-slate-300 text-muted dark:hover:text-white hover:text-slate-900 dark:hover:border-slate-500 hover:border-slate-400 transition-colors text-sm"
        >
          + Add Exercise
        </button>
      </div>
    </div>
  );
}
