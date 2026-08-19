import { useCallback } from 'react';
import {
  collection, doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc,
  arrayUnion, Timestamp, onSnapshot, query, orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Session, SetLog, ExerciseStats, Exercise, FreeSession, FreeSet, PlannedExercise, FreeSessionStatus, AerobicEntry, SupersetPair, UserProfile, ChatThreadDoc, ChatMessageDoc, ChatBucket, PersonalMeal, MealLog, MealType, MealIngredient, MealMacros, MealFlags, DietProfile } from '../types';
import type { MuscleGroup } from '../data/muscles';
import { DEFAULT_WEEKLY_TARGETS } from '../data/muscles';
import { exercisePhotoKey } from './usePhotos';
import { exerciseIdOf, findPersonalByName, type PersonalExercise, type RenameSuggestion } from '../data/exercisesDB';
import { PROGRAM } from '../data/program';

function sessionsCol(uid: string) {
  return collection(db, 'users', uid, 'sessions');
}

function freeSessionsCol(uid: string) {
  return collection(db, 'users', uid, 'freeSessions');
}

function exerciseStatsCol(uid: string) {
  return collection(db, 'users', uid, 'exerciseStats');
}

function customExercisesCol(uid: string) {
  return collection(db, 'users', uid, 'customExercises');
}

// ─── Exercise DB paths ───────────────────────────────────────────
// Global shared DB — read by everyone. Only admin writes here directly.
function globalExercisesCol() {
  return collection(db, 'exercises');
}
// User's own personal additions — NOT visible to other users.
function userPersonalExercisesCol(uid: string) {
  return collection(db, 'users', uid, 'personalExercises');
}
// User's per-exercise overrides (rename, muscle change) on global entries.
function userExerciseOverridesCol(uid: string) {
  return collection(db, 'users', uid, 'exerciseOverrides');
}
// User's soft-delete of a global entry — hides it from their list only.
function userHiddenPersonalExercisesCol(uid: string) {
  return collection(db, 'users', uid, 'hiddenPersonalExercises');
}
// Users allowed to write directly to the global exercise DB.
// Once Google-Auth lands, this becomes an email-based check on the auth token.
const ADMIN_UIDS = new Set<string>(['user_6724']);
function isAdminUid(uid: string): boolean { return ADMIN_UIDS.has(uid); }

function toSession(id: string, data: any): Session {
  return {
    id,
    date: data.date?.toMillis?.() || data.date,
    completedAt: data.completedAt?.toMillis?.() || data.completedAt || null,
    day: data.day,
    weekNumber: data.weekNumber,
    phase: data.phase,
    programName: data.programName,
    completed: data.completed,
    partial: data.partial || false,
    sets: data.sets || [],
    skippedExerciseIds: data.skippedExerciseIds || [],
  };
}

// Fetch all sessions once, filter client-side (no composite indexes needed)
async function fetchAllSessions(uid: string): Promise<Session[]> {
  const snap = await getDocs(sessionsCol(uid));
  return snap.docs
    .map(d => toSession(d.id, d.data()))
    .filter(s => s.programName === PROGRAM.name)
    .sort((a, b) => b.date - a.date);
}

export function useFirestore(uid: string | null) {

  const createSession = useCallback(async (
    day: 1 | 2 | 3 | 4 | 5,
    weekNumber: number,
    phase: 1 | 2 | 3,
  ): Promise<string> => {
    if (!uid) throw new Error('No uid');
    const sessionId = `${PROGRAM.name}_w${weekNumber}_d${day}_${Date.now()}`;
    const ref = doc(sessionsCol(uid), sessionId);
    await setDoc(ref, {
      date: Timestamp.now(),
      day,
      weekNumber,
      phase,
      programName: PROGRAM.name,
      completed: false,
      sets: [],
    });
    return sessionId;
  }, [uid]);

  const getSession = useCallback(async (sessionId: string): Promise<Session | null> => {
    if (!uid) return null;
    const snap = await getDoc(doc(sessionsCol(uid), sessionId));
    if (!snap.exists()) return null;
    return toSession(snap.id, snap.data());
  }, [uid]);

  const logSet = useCallback(async (sessionId: string, setLog: SetLog) => {
    if (!uid) return;
    const ref = doc(sessionsCol(uid), sessionId);
    await updateDoc(ref, {
      sets: arrayUnion(setLog),
    });
  }, [uid]);

  const skipExercise = useCallback(async (sessionId: string, exerciseId: string) => {
    if (!uid) return;
    const session = await getSession(sessionId);
    if (!session) return;
    const skipped = new Set(session.skippedExerciseIds || []);
    skipped.add(exerciseId);
    await updateDoc(doc(sessionsCol(uid), sessionId), { skippedExerciseIds: [...skipped] });
    return [...skipped];
  }, [uid]);

  const unskipExercise = useCallback(async (sessionId: string, exerciseId: string) => {
    if (!uid) return;
    const session = await getSession(sessionId);
    if (!session) return;
    const skipped = (session.skippedExerciseIds || []).filter(id => id !== exerciseId);
    await updateDoc(doc(sessionsCol(uid), sessionId), { skippedExerciseIds: skipped });
    return skipped;
  }, [uid]);

  const restartExercise = useCallback(async (sessionId: string, exerciseId: string) => {
    if (!uid) return;
    const session = await getSession(sessionId);
    if (!session) return;
    const filteredSets = session.sets.filter(s => s.exerciseId !== exerciseId);
    const ref = doc(sessionsCol(uid), sessionId);
    await updateDoc(ref, { sets: filteredSets });
    return filteredSets;
  }, [uid]);

  const completeSession = useCallback(async (sessionId: string, partial?: boolean) => {
    if (!uid) return;
    const ref = doc(sessionsCol(uid), sessionId);
    await updateDoc(ref, { completed: true, completedAt: Timestamp.now(), ...(partial ? { partial: true } : {}) });
  }, [uid]);

  const updateSessionDates = useCallback(async (sessionId: string, opts: { date?: number; completedAt?: number }) => {
    if (!uid) return;
    const ref = doc(sessionsCol(uid), sessionId);
    const update: any = {};
    if (opts.date != null) update.date = Timestamp.fromMillis(opts.date);
    if (opts.completedAt != null) update.completedAt = Timestamp.fromMillis(opts.completedAt);
    if (Object.keys(update).length === 0) return;
    await updateDoc(ref, update);
  }, [uid]);

  const updateExerciseStats = useCallback(async (exerciseId: string, setLog: SetLog, sessionId: string) => {
    if (!uid) return;
    const ref = doc(exerciseStatsCol(uid), exerciseId);
    const snap = await getDoc(ref);
    const existing: ExerciseStats | null = snap.exists() ? snap.data() as ExerciseStats : null;

    const exercise = PROGRAM.days
      .flatMap(d => d.exercises)
      .find(e => e.id === exerciseId);
    const isUni = exercise?.isUnilateral ?? false;

    const now = Date.now();

    if (isUni) {
      const leftW = setLog.weightLeft ?? 0;
      const leftR = setLog.repsLeft ?? 0;
      const rightW = setLog.weightRight ?? 0;
      const rightR = setLog.repsRight ?? 0;

      const prev = existing as any || {};
      const maxLeft = prev.max?.left || { weight: 0, reps: 0, date: 0 };
      const maxRight = prev.max?.right || { weight: 0, reps: 0, date: 0 };
      const avgLeft = prev.avg?.left || { weight: 0, sampleCount: 0 };
      const avgRight = prev.avg?.right || { weight: 0, sampleCount: 0 };

      const newMaxLeft = (leftW > maxLeft.weight || (leftW === maxLeft.weight && leftR > maxLeft.reps))
        ? { weight: leftW, reps: leftR, date: now } : maxLeft;
      const newMaxRight = (rightW > maxRight.weight || (rightW === maxRight.weight && rightR > maxRight.reps))
        ? { weight: rightW, reps: rightR, date: now } : maxRight;

      const newAvgLeft = {
        weight: ((avgLeft.weight * avgLeft.sampleCount) + leftW) / (avgLeft.sampleCount + 1),
        sampleCount: avgLeft.sampleCount + 1,
      };
      const newAvgRight = {
        weight: ((avgRight.weight * avgRight.sampleCount) + rightW) / (avgRight.sampleCount + 1),
        sampleCount: avgRight.sampleCount + 1,
      };

      await setDoc(ref, {
        programName: PROGRAM.name,
        max: { left: newMaxLeft, right: newMaxRight },
        avg: { left: newAvgLeft, right: newAvgRight },
        last: {
          left: { weight: leftW, reps: leftR, date: now, sessionId },
          right: { weight: rightW, reps: rightR, date: now, sessionId },
        },
        updatedAt: now,
      });
    } else {
      const w = setLog.weight ?? 0;
      const r = setLog.reps ?? 0;
      const prev = existing as any || {};
      const maxStat = prev.max || { weight: 0, reps: 0, date: 0 };
      const avgStat = prev.avg || { weight: 0, sampleCount: 0 };

      const newMax = (w > maxStat.weight || (w === maxStat.weight && r > maxStat.reps))
        ? { weight: w, reps: r, date: now } : maxStat;

      const newAvg = {
        weight: ((avgStat.weight * avgStat.sampleCount) + w) / (avgStat.sampleCount + 1),
        sampleCount: avgStat.sampleCount + 1,
      };

      await setDoc(ref, {
        programName: PROGRAM.name,
        max: newMax,
        avg: newAvg,
        last: { weight: w, reps: r, date: now, sessionId },
        updatedAt: now,
      });
    }
  }, [uid]);

  const getExerciseStats = useCallback(async (exerciseId: string): Promise<ExerciseStats | null> => {
    if (!uid) return null;
    const ref = doc(exerciseStatsCol(uid), exerciseId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() as ExerciseStats : null;
  }, [uid]);

  const getSessions = useCallback(async (): Promise<Session[]> => {
    if (!uid) return [];
    return fetchAllSessions(uid);
  }, [uid]);

  const getLastSessionForDay = useCallback(async (day: 1 | 2 | 3 | 4 | 5): Promise<Session | null> => {
    if (!uid) return null;
    const all = await fetchAllSessions(uid);
    return all.find(s => s.day === day) || null;
  }, [uid]);

  const getIncompleteSession = useCallback(async (day: 1 | 2 | 3 | 4 | 5): Promise<Session | null> => {
    if (!uid) return null;
    const all = await fetchAllSessions(uid);
    return all.find(s => s.day === day && !s.completed) || null;
  }, [uid]);

  const getLastCompletedSessionForDay = useCallback(async (day: 1 | 2 | 3 | 4 | 5): Promise<Session | null> => {
    if (!uid) return null;
    const all = await fetchAllSessions(uid);
    return all.find(s => s.day === day && s.completed) || null;
  }, [uid]);

  const resetProgram = useCallback(async () => {
    if (!uid) return;
    const sessSnap = await getDocs(sessionsCol(uid));
    for (const d of sessSnap.docs) {
      await deleteDoc(doc(sessionsCol(uid), d.id));
    }
    const statsSnap = await getDocs(exerciseStatsCol(uid));
    for (const d of statsSnap.docs) {
      await deleteDoc(doc(exerciseStatsCol(uid), d.id));
    }
  }, [uid]);

  const addCustomExercise = useCallback(async (day: 1 | 2 | 3 | 4 | 5, exercise: Exercise) => {
    if (!uid) return;
    const ref = doc(customExercisesCol(uid), exercise.id);
    // Strip undefined values — Firestore rejects them
    const data: any = { ...exercise, day, programName: PROGRAM.name };
    Object.keys(data).forEach(k => { if (data[k] === undefined) delete data[k]; });
    await setDoc(ref, data);
  }, [uid]);

  const getCustomExercises = useCallback(async (day: 1 | 2 | 3 | 4 | 5): Promise<Exercise[]> => {
    if (!uid) return [];
    const snap = await getDocs(customExercisesCol(uid));
    return snap.docs
      .map(d => d.data())
      .filter((e: any) => e.day === day && e.programName === PROGRAM.name)
      .map((e: any): Exercise => ({
        id: e.id,
        name: e.name,
        nameHe: e.nameHe,
        muscle: e.muscle,
        muscleHe: e.muscleHe,
        sets: e.sets,
        reps: e.reps,
        durationSeconds: e.durationSeconds,
        isUnilateral: e.isUnilateral,
        isTimeBased: e.isTimeBased,
        startWeakSide: e.startWeakSide,
        notes: e.notes,
        imageUrl: e.imageUrl,
        tag: e.tag,
      }));
  }, [uid]);

  const deleteCustomExercise = useCallback(async (exerciseId: string) => {
    if (!uid) return;
    await deleteDoc(doc(customExercisesCol(uid), exerciseId));
  }, [uid]);

  const hideExercise = useCallback(async (day: 1 | 2 | 3 | 4 | 5, exerciseId: string) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'hiddenExercises', `${PROGRAM.name}_d${day}`);
    const snap = await getDoc(ref);
    const existing: string[] = snap.exists() ? snap.data().ids || [] : [];
    if (!existing.includes(exerciseId)) {
      await setDoc(ref, { ids: [...existing, exerciseId], programName: PROGRAM.name, day });
    }
  }, [uid]);

  const unhideExercise = useCallback(async (day: 1 | 2 | 3 | 4 | 5, exerciseId: string) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'hiddenExercises', `${PROGRAM.name}_d${day}`);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const ids: string[] = (snap.data().ids || []).filter((id: string) => id !== exerciseId);
      await setDoc(ref, { ids, programName: PROGRAM.name, day });
    }
  }, [uid]);

  const getHiddenExercises = useCallback(async (day: 1 | 2 | 3 | 4 | 5): Promise<string[]> => {
    if (!uid) return [];
    const ref = doc(db, 'users', uid, 'hiddenExercises', `${PROGRAM.name}_d${day}`);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data().ids || [] : [];
  }, [uid]);

  // `difficulty` = next-time weight bump chip (plus-1.25/plus-2.5/plus-5/plus-10).
  // `nextReps`   = next-time target reps chip (8/10/12/15).
  // Both are opaque strings in Firestore so the schema doesn't churn every time
  // we swap chip semantics. Either can be null (cleared).
  type DifficultyPatch = { difficulty?: string | null; nextReps?: string | null };
  const saveExerciseDifficulty = useCallback(async (exerciseId: string, sessionId: string, patch: DifficultyPatch) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'exerciseDifficulty', `${exerciseId}_${sessionId}`);
    // Merge so setting nextReps doesn't wipe difficulty and vice versa.
    const body: any = { exerciseId, sessionId, timestamp: Date.now() };
    if (patch.difficulty !== undefined) body.difficulty = patch.difficulty;
    if (patch.nextReps !== undefined) body.nextReps = patch.nextReps;
    await setDoc(ref, body, { merge: true });
  }, [uid]);

  const getExerciseDifficultyForSession = useCallback(async (exerciseId: string, sessionId: string): Promise<{ difficulty?: string; nextReps?: string } | null> => {
    if (!uid) return null;
    const ref = doc(db, 'users', uid, 'exerciseDifficulty', `${exerciseId}_${sessionId}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data();
    return { difficulty: d.difficulty || undefined, nextReps: d.nextReps || undefined };
  }, [uid]);

  const deleteExerciseDifficulty = useCallback(async (exerciseId: string, sessionId: string): Promise<void> => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'exerciseDifficulty', `${exerciseId}_${sessionId}`));
  }, [uid]);

  const getExerciseDifficulty = useCallback(async (exerciseId: string): Promise<{ difficulty?: string; nextReps?: string } | null> => {
    if (!uid) return null;
    // Get most recent chip choices for this exercise across all sessions.
    const snap = await getDocs(collection(db, 'users', uid, 'exerciseDifficulty'));
    const ratings = snap.docs
      .map(d => d.data())
      .filter(d => d.exerciseId === exerciseId)
      .sort((a, b) => b.timestamp - a.timestamp);
    return ratings[0] ? { difficulty: ratings[0].difficulty || undefined, nextReps: ratings[0].nextReps || undefined } : null;
  }, [uid]);

  // ─── Free (muscle-based) sessions ───────────────────────────────

  const toFreeSession = (id: string, data: any): FreeSession => {
    const explicit: FreeSessionStatus | undefined =
      data.status === 'planned' || data.status === 'active' || data.status === 'completed'
        ? data.status
        : undefined;
    const inferred: FreeSessionStatus = data.completed ? 'completed' : 'active';
    return {
      id,
      date: data.date?.toMillis?.() ?? data.date,
      completedAt: data.completedAt?.toMillis?.() ?? data.completedAt ?? null,
      muscleGroups: data.muscleGroups || [],
      sets: (data.sets || []).map((s: any) => ({ ...s })),
      plannedExercises: Array.isArray(data.plannedExercises) ? data.plannedExercises : [],
      completed: !!data.completed,
      status: explicit || inferred,
      plannedFor: typeof data.plannedFor === 'string' ? data.plannedFor : undefined,
      aerobicEntries: Array.isArray(data.aerobicEntries) ? data.aerobicEntries : [],
      restartedAt: data.restartedAt?.toMillis?.() ?? data.restartedAt ?? undefined,
      pausedAt: data.pausedAt?.toMillis?.() ?? data.pausedAt ?? undefined,
    };
  };

  const createFreeSession = useCallback(async (muscleGroups: MuscleGroup[]): Promise<string> => {
    if (!uid) throw new Error('No uid');
    const sessionId = `free_${Date.now()}`;
    const ref = doc(freeSessionsCol(uid), sessionId);
    // pausedAt = date pins a "fresh" state — the elapsed clock stays at 0 until
    // the user explicitly hits "התחל" (which calls resumeFreeSession) or logs a
    // set (which auto-resumes). This keeps the tile's "התחל" ↔ "המשך" label
    // consistent with actual timer activity.
    const nowTs = Timestamp.now();
    await setDoc(ref, {
      date: nowTs,
      pausedAt: nowTs,
      muscleGroups,
      sets: [],
      completed: false,
      status: 'active',
    });
    return sessionId;
  }, [uid]);

  // Create a session scheduled for a future (or today, before starting) day.
  // Stores midnight of `plannedFor` in `date` so all sort/date logic keeps working —
  // when the user "starts" the session we overwrite `date` with the real start time.
  const createPlannedSession = useCallback(async (
    muscleGroups: MuscleGroup[],
    plannedFor: string, // YYYY-MM-DD
    plannedExercises?: PlannedExercise[],
  ): Promise<string> => {
    if (!uid) throw new Error('No uid');
    const [y, m, d] = plannedFor.split('-').map(Number);
    const midnight = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
    const sessionId = `plan_${plannedFor.replace(/-/g, '')}_${Date.now()}`;
    const ref = doc(freeSessionsCol(uid), sessionId);
    const payload: any = {
      date: Timestamp.fromMillis(midnight),
      muscleGroups,
      sets: [],
      completed: false,
      status: 'planned',
      plannedFor,
    };
    if (plannedExercises && plannedExercises.length) payload.plannedExercises = plannedExercises;
    await setDoc(ref, payload);
    return sessionId;
  }, [uid]);

  // "Restart from scratch": clear ALL logged sets, zero the timer, and pin
  // pausedAt = date so the timer stays frozen at 0 until the user explicitly
  // taps "התחל" again (which resumes via resumeFreeSession). Planned exercises
  // stay put — this is "start over the sets", not "delete the workout plan".
  const restartFreeSession = useCallback(async (sessionId: string): Promise<void> => {
    if (!uid) return;
    const nowTs = Timestamp.now();
    await updateDoc(doc(freeSessionsCol(uid), sessionId), {
      date: nowTs,
      restartedAt: nowTs,
      pausedAt: nowTs,   // frozen at 0 elapsed — fresh state
      sets: [],
    });
  }, [uid]);

  // Pause the elapsed-time clock on an active session. `pausedAt` marks WHEN we
  // paused; while it's set, the UI shows the frozen elapsed = pausedAt − date.
  const pauseFreeSession = useCallback(async (sessionId: string): Promise<void> => {
    if (!uid) return;
    await updateDoc(doc(freeSessionsCol(uid), sessionId), {
      pausedAt: Timestamp.fromMillis(Date.now()),
    });
  }, [uid]);

  // Resume from pause: shift `date` forward by the time we were paused, so the
  // ongoing "elapsed = now − date" formula picks up right where it stopped.
  const resumeFreeSession = useCallback(async (sessionId: string): Promise<void> => {
    if (!uid) return;
    const snap = await getDoc(doc(freeSessionsCol(uid), sessionId));
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const pausedAt: number | undefined = data.pausedAt?.toMillis?.() ?? data.pausedAt;
    const startedAt: number | undefined = data.date?.toMillis?.() ?? data.date;
    if (!pausedAt || !startedAt) {
      await updateDoc(doc(freeSessionsCol(uid), sessionId), { pausedAt: null });
      return;
    }
    const gap = Date.now() - pausedAt;
    await updateDoc(doc(freeSessionsCol(uid), sessionId), {
      date: Timestamp.fromMillis(startedAt + gap),
      pausedAt: null,
    });
  }, [uid]);

  // Move a planned session to a different date. Rewrites both `plannedFor` (the
  // YYYY-MM-DD key) and `date` (midnight timestamp used by sorters), keeping the
  // status intact. No-op if the session doesn't exist or isn't planned.
  const movePlannedSession = useCallback(async (sessionId: string, newYmd: string): Promise<void> => {
    if (!uid) return;
    const clean = /^\d{4}-\d{2}-\d{2}$/.test(newYmd) ? newYmd : null;
    if (!clean) throw new Error('bad date');
    const [y, m, d] = clean.split('-').map(Number);
    const midnight = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
    await updateDoc(doc(freeSessionsCol(uid), sessionId), {
      plannedFor: clean,
      date: Timestamp.fromMillis(midnight),
    });
  }, [uid]);

  // Promote a planned session to active. GUARDS:
  //   • If already active/completed → returns the id (no-op).
  //   • If any OTHER active session exists → returns that session's id instead
  //     (never overwrites a running session with a plan-start).
  const startPlannedSession = useCallback(async (sessionId: string): Promise<string | null> => {
    if (!uid) return null;
    const all = await getDocs(freeSessionsCol(uid));
    const list = all.docs.map(d => toFreeSession(d.id, d.data()));
    const other = list.find(s => s.id !== sessionId && s.status === 'active');
    if (other) return other.id;
    const target = list.find(s => s.id === sessionId);
    if (!target) return null;
    if (target.status === 'active') return sessionId;
    if (target.status === 'completed') return sessionId;
    // pausedAt = date so the promoted session lands in "fresh, not started"
    // state — user still has to tap "התחל" to kick off the timer.
    const nowTs = Timestamp.now();
    await updateDoc(doc(freeSessionsCol(uid), sessionId), {
      status: 'active',
      date: nowTs,
      pausedAt: nowTs,
    });
    return sessionId;
  }, [uid]);

  const getFreeSession = useCallback(async (sessionId: string): Promise<FreeSession | null> => {
    if (!uid) return null;
    const snap = await getDoc(doc(freeSessionsCol(uid), sessionId));
    if (!snap.exists()) return null;
    return toFreeSession(snap.id, snap.data());
  }, [uid]);

  const getFreeSessions = useCallback(async (): Promise<FreeSession[]> => {
    if (!uid) return [];
    const snap = await getDocs(freeSessionsCol(uid));
    return snap.docs
      .map(d => toFreeSession(d.id, d.data()))
      .sort((a, b) => b.date - a.date);
  }, [uid]);

  const logFreeSet = useCallback(async (sessionId: string, set: FreeSet) => {
    if (!uid) return;
    const clean: any = { ...set };
    Object.keys(clean).forEach(k => { if (clean[k] === undefined) delete clean[k]; });
    await updateDoc(doc(freeSessionsCol(uid), sessionId), { sets: arrayUnion(clean) });
  }, [uid]);

  const updateFreeSets = useCallback(async (sessionId: string, sets: FreeSet[]) => {
    if (!uid) return;
    const clean = sets.map(s => {
      const c: any = { ...s };
      Object.keys(c).forEach(k => { if (c[k] === undefined) delete c[k]; });
      return c;
    });
    await updateDoc(doc(freeSessionsCol(uid), sessionId), { sets: clean });
  }, [uid]);

  const completeFreeSession = useCallback(async (sessionId: string) => {
    if (!uid) return;
    // Prune focus muscles: keep only muscles that actually got a real (non-placeholder) set.
    const snap = await getDoc(doc(freeSessionsCol(uid), sessionId));
    if (!snap.exists()) return;
    const data = snap.data();
    const sets: FreeSet[] = (data.sets || []).map((s: any) => ({ ...s }));
    const originalMuscles: MuscleGroup[] = data.muscleGroups || [];
    const musclesWithRealSets = new Set<MuscleGroup>(
      sets.filter(s => s.weight > 0 || s.reps > 0).map(s => s.muscle),
    );
    const pruned = originalMuscles.filter(m => musclesWithRealSets.has(m));
    await updateDoc(doc(freeSessionsCol(uid), sessionId), {
      completed: true,
      completedAt: Timestamp.now(),
      status: 'completed',
      muscleGroups: pruned.length > 0 ? pruned : originalMuscles,
    });
  }, [uid]);

  const updatePlannedExercises = useCallback(async (sessionId: string, planned: PlannedExercise[]) => {
    if (!uid) return;
    await updateDoc(doc(freeSessionsCol(uid), sessionId), { plannedExercises: planned });
  }, [uid]);

  const duplicateFreeSession = useCallback(async (sessionId: string, opts?: { includeExercises?: boolean }): Promise<string | null> => {
    if (!uid) return null;
    const includeExercises = opts?.includeExercises ?? true;
    const src = await getDoc(doc(freeSessionsCol(uid), sessionId));
    if (!src.exists()) return null;
    const data = src.data();
    const sets: FreeSet[] = (data.sets || []).map((s: any) => ({ ...s }));
    let planned: PlannedExercise[] = [];
    if (includeExercises) {
      const seen = new Set<string>();
      for (const s of sets) {
        const name = s.exerciseName?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        planned.push({ name, muscle: s.muscle, addedAt: Date.now() });
      }
    }
    const newId = `free_${Date.now()}`;
    await setDoc(doc(freeSessionsCol(uid), newId), {
      date: Timestamp.now(),
      muscleGroups: data.muscleGroups || [],
      sets: [],
      plannedExercises: planned,
      completed: false,
      status: 'active',
    });
    return newId;
  }, [uid]);

  // Convert an active (or completed) session BACK to planned. Sets are cleared; unique
  // exercise names are lifted into plannedExercises so nothing is lost. Reason for
  // existing: user built a session yesterday because we didn't have planning yet.
  const convertToPlanned = useCallback(async (sessionId: string, plannedFor: string): Promise<void> => {
    if (!uid) return;
    const snap = await getDoc(doc(freeSessionsCol(uid), sessionId));
    if (!snap.exists()) return;
    const data = snap.data();
    const sets: FreeSet[] = (data.sets || []).map((s: any) => ({ ...s }));
    // Extract exercises (name + muscle) into planned entries so we don't lose them.
    const seen = new Set<string>();
    const planned: PlannedExercise[] = Array.isArray(data.plannedExercises) ? [...data.plannedExercises] : [];
    for (const p of planned) seen.add(p.name.toLowerCase());
    for (const s of sets) {
      const name = s.exerciseName?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      planned.push({ name, muscle: s.muscle, addedAt: Date.now() });
    }
    const [y, m, d] = plannedFor.split('-').map(Number);
    const midnight = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
    await updateDoc(doc(freeSessionsCol(uid), sessionId), {
      status: 'planned',
      plannedFor,
      date: Timestamp.fromMillis(midnight),
      completed: false,
      completedAt: null,
      sets: [],
      plannedExercises: planned,
    });
  }, [uid]);

  const deleteFreeSession = useCallback(async (sessionId: string) => {
    if (!uid) return;
    await deleteDoc(doc(freeSessionsCol(uid), sessionId));
  }, [uid]);

  // Reactivate a completed session — flip it back to active so the user can add more sets today
  // instead of holding two separate sessions for the same day.
  const reactivateFreeSession = useCallback(async (sessionId: string): Promise<void> => {
    if (!uid) return;
    await updateDoc(doc(freeSessionsCol(uid), sessionId), {
      completed: false,
      completedAt: null,
      status: 'active',
    });
  }, [uid]);

  // Aerobic entries on a session — replaces the whole array (add/edit/delete all use this).
  const setAerobicEntries = useCallback(async (sessionId: string, entries: AerobicEntry[]) => {
    if (!uid) return;
    // Firestore rejects undefined — strip any optional fields that are undefined.
    const clean = entries.map(e => {
      const c: any = { ...e };
      Object.keys(c).forEach(k => { if (c[k] === undefined) delete c[k]; });
      return c;
    });
    await updateDoc(doc(freeSessionsCol(uid), sessionId), { aerobicEntries: clean });
  }, [uid]);

  // ─── Superset pairs ───────────────────────────────────────────
  // Keyed by "sorted_a__sorted_b" so the same pair is recorded once regardless of order.
  function pairKey(a: string, b: string): string {
    return a < b ? `${a}__${b}` : `${b}__${a}`;
  }
  const listSupersetPairs = useCallback(async (): Promise<SupersetPair[]> => {
    if (!uid) return [];
    const snap = await getDocs(collection(db, 'users', uid, 'supersetPairs'));
    return snap.docs.map(d => d.data() as SupersetPair);
  }, [uid]);
  const recordSupersetPair = useCallback(async (a: string, b: string) => {
    if (!uid || a === b) return;
    const key = pairKey(a, b);
    const ref = doc(db, 'users', uid, 'supersetPairs', key);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as SupersetPair;
      await setDoc(ref, { ...data, count: (data.count || 0) + 1, lastTs: Date.now() }, { merge: true });
    } else {
      const ids: [string, string] = a < b ? [a, b] : [b, a];
      const rec: SupersetPair = { id: key, ids, count: 1, lastTs: Date.now(), hidden: false };
      await setDoc(ref, rec);
    }
  }, [uid]);
  const hideSupersetPair = useCallback(async (a: string, b: string) => {
    if (!uid) return;
    const key = pairKey(a, b);
    await setDoc(doc(db, 'users', uid, 'supersetPairs', key), { hidden: true }, { merge: true });
  }, [uid]);
  const unhideSupersetPair = useCallback(async (a: string, b: string) => {
    if (!uid) return;
    const key = pairKey(a, b);
    await setDoc(doc(db, 'users', uid, 'supersetPairs', key), { hidden: false }, { merge: true });
  }, [uid]);

  // Copy planned/completed sessions from a source week (offset -1 = last week) into a target week
  // (offset 0 = this week). Only picks completed sessions from the source (we never re-plan
  // future incomplete plans). Each day in the source that had a completed workout becomes a
  // planned session on the corresponding day of the target week.
  const copyPlannedWeek = useCallback(async (opts: {
    sourceWeekOffset: number;         // e.g. -1 for last week
    targetWeekOffset: number;         // e.g. 0 for this week
    includeExercises: boolean;        // true = muscles + exercises, false = muscles only
  }): Promise<number> => {
    if (!uid) return 0;
    const now = new Date();
    const sunday = new Date(now); sunday.setHours(0,0,0,0); sunday.setDate(sunday.getDate() - sunday.getDay());
    const srcStart = new Date(sunday); srcStart.setDate(srcStart.getDate() + opts.sourceWeekOffset * 7);
    const srcEnd = new Date(srcStart); srcEnd.setDate(srcEnd.getDate() + 7);
    const tgtStart = new Date(sunday); tgtStart.setDate(tgtStart.getDate() + opts.targetWeekOffset * 7);
    // Load everything, filter, avoid double-planning: if the target day already has any session, skip.
    const all = await getDocs(freeSessionsCol(uid));
    const list = all.docs.map(d => toFreeSession(d.id, d.data()));
    const srcSessions = list.filter(s => s.status === 'completed' && s.date >= srcStart.getTime() && s.date < srcEnd.getTime());
    const targetHasByDow = new Set<number>();
    for (const s of list) {
      const d = new Date(s.date);
      if (d >= tgtStart && d < new Date(tgtStart.getTime() + 7 * 86_400_000)) targetHasByDow.add(d.getDay());
    }
    let created = 0;
    for (const src of srcSessions) {
      const srcDate = new Date(src.date);
      const dow = srcDate.getDay();
      if (targetHasByDow.has(dow)) continue;
      const tgtDate = new Date(tgtStart); tgtDate.setDate(tgtDate.getDate() + dow);
      const y = tgtDate.getFullYear();
      const m = String(tgtDate.getMonth() + 1).padStart(2, '0');
      const d2 = String(tgtDate.getDate()).padStart(2, '0');
      const plannedFor = `${y}-${m}-${d2}`;
      // Muscles come from what was actually trained, not the original focus (pruned in complete).
      const muscles = src.muscleGroups.slice();
      let planned: PlannedExercise[] | undefined;
      if (opts.includeExercises) {
        const seen = new Set<string>();
        planned = [];
        for (const s of src.sets) {
          const name = s.exerciseName?.trim();
          if (!name) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          planned.push({ name, muscle: s.muscle, addedAt: Date.now() });
        }
      }
      await createPlannedSession(muscles, plannedFor, planned);
      created++;
      targetHasByDow.add(dow);
    }
    return created;
  }, [uid, createPlannedSession]);

  const updateFreeSessionDates = useCallback(async (sessionId: string, opts: { date?: number; completedAt?: number }) => {
    if (!uid) return;
    const update: any = {};
    if (opts.date != null) update.date = Timestamp.fromMillis(opts.date);
    if (opts.completedAt != null) update.completedAt = Timestamp.fromMillis(opts.completedAt);
    if (Object.keys(update).length === 0) return;
    await updateDoc(doc(freeSessionsCol(uid), sessionId), update);
  }, [uid]);

  const updateFreeSessionMuscles = useCallback(async (sessionId: string, muscleGroups: MuscleGroup[]) => {
    if (!uid) return;
    await updateDoc(doc(freeSessionsCol(uid), sessionId), { muscleGroups });
  }, [uid]);

  const getWeeklyTargets = useCallback(async (): Promise<Record<MuscleGroup, number>> => {
    if (!uid) return { ...DEFAULT_WEEKLY_TARGETS };
    const ref = doc(db, 'users', uid, 'settings', 'main');
    const snap = await getDoc(ref);
    const stored = snap.exists() ? snap.data().weeklyTargets : null;
    return { ...DEFAULT_WEEKLY_TARGETS, ...(stored || {}) };
  }, [uid]);

  const setWeeklyTargets = useCallback(async (targets: Partial<Record<MuscleGroup, number>>) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'settings', 'main');
    await setDoc(ref, { weeklyTargets: targets }, { merge: true });
  }, [uid]);

  // Realtime version — every subscriber (home, settings, chat) sees the same
  // change instantly, so an AI-driven update to goals reflects on every screen
  // without a reload. Merges DEFAULT_WEEKLY_TARGETS on top of stored so muscles
  // never seen before still have a numeric baseline.
  const subscribeToWeeklyTargets = useCallback((cb: (t: Record<MuscleGroup, number>) => void): () => void => {
    if (!uid) return () => {};
    const ref = doc(db, 'users', uid, 'settings', 'main');
    return onSnapshot(ref, snap => {
      const stored = snap.exists() ? (snap.data() as any).weeklyTargets : null;
      cb({ ...DEFAULT_WEEKLY_TARGETS, ...(stored || {}) });
    });
  }, [uid]);

  // Week-order preference — controls whether the home week grid starts on
  // Saturday (Israeli default) or Sunday. Stored per-user in settings/main.
  type WeekOrder = 'saturday-first' | 'sunday-first';
  const subscribeToWeekOrder = useCallback((cb: (order: WeekOrder) => void): () => void => {
    if (!uid) return () => {};
    const ref = doc(db, 'users', uid, 'settings', 'main');
    return onSnapshot(ref, snap => {
      const stored = snap.exists() ? ((snap.data() as any).weekOrder as WeekOrder | undefined) : undefined;
      cb(stored === 'sunday-first' ? 'sunday-first' : 'saturday-first');
    });
  }, [uid]);
  const setWeekOrder = useCallback(async (order: WeekOrder) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'settings', 'main');
    await setDoc(ref, { weekOrder: order }, { merge: true });
  }, [uid]);

  // Goals config — two modes:
  //   'fixed'   → weeklyTargets is the source of truth (existing behavior)
  //   'percent' → weeklyTotalSets (total per week) split by weeklyPercents (%/muscle)
  //               Effective target for a muscle = round(total * percent / 100)
  //               Bank = 100 - sum(percents). Never goes negative.
  type GoalsConfig = {
    mode: 'fixed' | 'percent';
    totalSets: number;
    percents: Partial<Record<MuscleGroup, number>>;
  };
  const getGoalsConfig = useCallback(async (): Promise<GoalsConfig> => {
    if (!uid) return { mode: 'fixed', totalSets: 0, percents: {} };
    const ref = doc(db, 'users', uid, 'settings', 'main');
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const mode: 'fixed' | 'percent' = data.goalsMode === 'percent' ? 'percent' : 'fixed';
    const totalSets = typeof data.weeklyTotalSets === 'number' ? data.weeklyTotalSets : 0;
    const percents = (data.weeklyPercents && typeof data.weeklyPercents === 'object') ? data.weeklyPercents : {};
    return { mode, totalSets, percents };
  }, [uid]);
  const setGoalsConfig = useCallback(async (cfg: Partial<GoalsConfig>) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'settings', 'main');
    const payload: any = {};
    if (cfg.mode) payload.goalsMode = cfg.mode;
    if (cfg.totalSets != null) payload.weeklyTotalSets = cfg.totalSets;
    if (cfg.percents) payload.weeklyPercents = cfg.percents;
    await setDoc(ref, payload, { merge: true });
  }, [uid]);

  // ─── end free sessions ──────────────────────────────────────────

  // ─── Personal exercise DB ─────────────────────────────────────
  // Layered model:
  //   • Global `exercises/{id}` — shared read for every user, seeded from
  //     Shlomi's original personal DB. Admin writes here directly.
  //   • `users/{uid}/personalExercises/{id}` — this user's own additions
  //     (not visible to other users).
  //   • `users/{uid}/exerciseOverrides/{id}` — this user's rename / muscle
  //     change on a specific global entry.
  //   • `users/{uid}/hiddenPersonalExercises/{id}` — this user soft-deleted
  //     the global entry; hidden from THEIR list only.
  //
  // Reader merges (global ∪ userCustom) → applies overrides → filters hidden.
  // Writer routes to the right layer based on the uid's admin status and
  // whether the target id already exists in global.
  const listPersonalExercises = useCallback(async (): Promise<PersonalExercise[]> => {
    if (!uid) return [];
    const [globalSnap, customSnap, ovSnap, hiddenSnap] = await Promise.all([
      getDocs(globalExercisesCol()),
      getDocs(userPersonalExercisesCol(uid)),
      getDocs(userExerciseOverridesCol(uid)),
      getDocs(userHiddenPersonalExercisesCol(uid)),
    ]);
    const hidden = new Set(hiddenSnap.docs.map(d => d.id));
    const overrides = new Map<string, Partial<PersonalExercise>>(
      ovSnap.docs.map(d => [d.id, d.data() as Partial<PersonalExercise>])
    );
    const out: PersonalExercise[] = [];
    const seen = new Set<string>();
    for (const d of globalSnap.docs) {
      const raw = d.data() as PersonalExercise;
      if (hidden.has(raw.id)) continue;
      // isAnchor is per-user and lives ONLY on the override. Strip whatever
      // may have leaked into the global doc so old data doesn't cross users.
      const { isAnchor: _dropAnchor, ...base } = raw as any;
      void _dropAnchor;
      const ov = overrides.get(raw.id);
      out.push(ov ? { ...base, ...ov, id: raw.id } as PersonalExercise : { ...base, id: raw.id } as PersonalExercise);
      seen.add(raw.id);
    }
    for (const d of customSnap.docs) {
      const custom = d.data() as PersonalExercise;
      if (hidden.has(custom.id) || seen.has(custom.id)) continue;
      out.push(custom);
    }
    return out;
  }, [uid]);

  const upsertPersonalExercise = useCallback(async (ex: PersonalExercise) => {
    if (!uid) return;
    const cleanFull: any = { ...ex, updatedAt: Date.now() };
    Object.keys(cleanFull).forEach(k => { if (cleanFull[k] === undefined) delete cleanFull[k]; });

    // isAnchor is ALWAYS a per-user preference — never a global attribute of
    // the exercise itself. Split it out so admin edits don't propagate one
    // user's anchor picks to everyone. (This was the "shared anchors on a
    // fresh user" bug: admin's toggles were writing isAnchor to the global
    // exercises doc.) Strip from any global write, then persist to the
    // per-user override separately.
    const userAnchor: boolean | undefined = cleanFull.isAnchor;
    delete cleanFull.isAnchor;

    async function writeUserAnchor() {
      if (userAnchor) {
        await setDoc(
          doc(userExerciseOverridesCol(uid!), ex.id),
          { isAnchor: true, updatedAt: Date.now() },
          { merge: true },
        );
      } else {
        // Toggled off: clear it from the override with merge so we don't
        // wipe unrelated overrides (e.g. custom Hebrew name).
        try {
          await setDoc(
            doc(userExerciseOverridesCol(uid!), ex.id),
            { isAnchor: false, updatedAt: Date.now() },
            { merge: true },
          );
        } catch { /* ignore */ }
      }
    }

    // Does a global entry with this id exist?
    const globalRef = doc(globalExercisesCol(), ex.id);
    const globalSnap = await getDoc(globalRef);

    if (globalSnap.exists()) {
      if (isAdminUid(uid)) {
        // Admin edits propagate to everyone — write global directly.
        // But isAnchor is user-scoped, so it goes to the override.
        await setDoc(globalRef, cleanFull);
        await writeUserAnchor();
      } else {
        // Regular user: store only the fields that differ from the global base
        // as an override. Keeps the shared DB clean and other users unaffected.
        const base = globalSnap.data() as PersonalExercise;
        const diff: any = { updatedAt: Date.now() };
        for (const k of ['he', 'en', 'defaultMuscle', 'aliases', 'isHoldTime', 'notes', 'photoBase64'] as const) {
          const cur = (ex as any)[k];
          const b = (base as any)[k];
          if (cur !== undefined && JSON.stringify(cur) !== JSON.stringify(b)) diff[k] = cur;
        }
        // Always include isAnchor in the override (per-user preference).
        if (userAnchor !== undefined) diff.isAnchor = userAnchor;
        await setDoc(doc(userExerciseOverridesCol(uid), ex.id), diff);
      }
      return;
    }

    // No global entry yet: admin creates one, regular user creates their own.
    if (isAdminUid(uid)) {
      await setDoc(globalRef, cleanFull);
      await writeUserAnchor();
    } else {
      // Regular user's own doc — isAnchor lives on the doc directly.
      if (userAnchor !== undefined) cleanFull.isAnchor = userAnchor;
      await setDoc(doc(userPersonalExercisesCol(uid), ex.id), cleanFull);
    }
  }, [uid]);

  // Idempotent: creates only if a matching personal exercise doesn't already exist.
  // Matches by he / alias / slug so AI-generated variants map back to the same DB entry
  // instead of spawning duplicates. Optionally fills English on first create.
  const ensurePersonalExercise = useCallback(async (
    name: string,
    defaultMuscle: MuscleGroup,
    en?: string,
    isHoldTime?: boolean,
  ): Promise<PersonalExercise | null> => {
    if (!uid || !name.trim()) return null;
    const list = await listPersonalExercises();
    const existing = findPersonalByName(list, name)
      || list.find(e => e.id === exerciseIdOf(name));
    if (existing) {
      if (en && !existing.en) {
        const updated = { ...existing, en: en.trim(), updatedAt: Date.now() };
        await upsertPersonalExercise(updated);
        return updated;
      }
      return existing;
    }
    const id = exerciseIdOf(name);
    if (!id) return null;
    const ex: PersonalExercise = {
      id,
      he: name.trim(),
      en: en?.trim() || undefined,
      defaultMuscle,
      isHoldTime: isHoldTime || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await upsertPersonalExercise(ex);
    return ex;
  }, [uid, listPersonalExercises, upsertPersonalExercise]);

  const deletePersonalExercise = useCallback(async (id: string) => {
    if (!uid) return;
    const globalRef = doc(globalExercisesCol(), id);
    const globalSnap = await getDoc(globalRef);
    if (globalSnap.exists()) {
      if (isAdminUid(uid)) {
        await deleteDoc(globalRef);
      } else {
        // Soft-hide for this user; also clear any override they had.
        await setDoc(doc(userHiddenPersonalExercisesCol(uid), id), { id, hiddenAt: Date.now() });
        try { await deleteDoc(doc(userExerciseOverridesCol(uid), id)); } catch { /* ignore */ }
      }
      return;
    }
    // Not global — try user's own custom entry.
    try { await deleteDoc(doc(userPersonalExercisesCol(uid), id)); } catch { /* ignore */ }
  }, [uid]);

  // ─── Rename suggestions (persistent across visits) ─────────────

  const listRenameSuggestions = useCallback(async (): Promise<RenameSuggestion[]> => {
    if (!uid) return [];
    const snap = await getDocs(collection(db, 'users', uid, 'renameSuggestions'));
    return snap.docs.map(d => d.data() as RenameSuggestion);
  }, [uid]);

  const upsertRenameSuggestion = useCallback(async (sug: RenameSuggestion) => {
    if (!uid) return;
    const clean: any = { ...sug, updatedAt: Date.now() };
    Object.keys(clean).forEach(k => { if (clean[k] === undefined) delete clean[k]; });
    await setDoc(doc(db, 'users', uid, 'renameSuggestions', sug.id), clean);
  }, [uid]);

  const deleteRenameSuggestion = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'renameSuggestions', id));
  }, [uid]);

  // ─── User profile (single doc) ────────────────────────────────
  // Stored at users/{uid}/profile/main. Any field may be missing.
  // The AI trainer can update it via update_profile action, and the user can
  // edit fields directly from Settings. Also carries onboardingCompletedAt.
  const getUserProfile = useCallback(async (): Promise<UserProfile> => {
    if (!uid) return {};
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'profile', 'main'));
      if (snap.exists()) return snap.data() as UserProfile;
    } catch { /* new user or empty */ }
    return {};
  }, [uid]);

  const updateUserProfile = useCallback(async (patch: Partial<UserProfile>): Promise<UserProfile> => {
    if (!uid) return patch as UserProfile;
    const ref = doc(db, 'users', uid, 'profile', 'main');
    const merged: any = { ...patch, updatedAt: Date.now() };
    Object.keys(merged).forEach(k => { if (merged[k] === undefined) delete merged[k]; });
    await setDoc(ref, merged, { merge: true });
    // Return the full merged profile so callers can reflect it in UI immediately.
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() as UserProfile : (merged as UserProfile);
  }, [uid]);

  const markOnboardingComplete = useCallback(async (): Promise<void> => {
    await updateUserProfile({ onboardingCompletedAt: Date.now() });
  }, [updateUserProfile]);

  // ─── Chat threads + messages (Firestore-backed, realtime) ────────
  // Threads live at users/{uid}/chatThreads/{threadId}, messages at
  // users/{uid}/chatThreads/{threadId}/messages/{msgId}. Moving off localStorage
  // gives us cross-device sync + tab-close resilience + a server-writable log.
  const chatThreadsCol = useCallback(() => collection(db, 'users', uid || 'null', 'chatThreads'), [uid]);
  const chatMessagesCol = useCallback((threadId: string) =>
    collection(db, 'users', uid || 'null', 'chatThreads', threadId, 'messages'), [uid]);

  const upsertChatThread = useCallback(async (threadId: string, meta: Partial<ChatThreadDoc>) => {
    if (!uid) return;
    await setDoc(doc(chatThreadsCol(), threadId), { id: threadId, ...meta }, { merge: true });
  }, [uid, chatThreadsCol]);

  const addChatMessage = useCallback(async (threadId: string, msg: Omit<ChatMessageDoc, 'id'>): Promise<string> => {
    if (!uid) return '';
    // Deterministic id from ts+role so client optimism and server writes don't
    // duplicate the same message. Same ts+role means same message.
    const id = `m_${msg.ts}_${msg.role}`;
    const clean: any = { ...msg, id };
    Object.keys(clean).forEach(k => { if (clean[k] === undefined) delete clean[k]; });
    await setDoc(doc(chatMessagesCol(threadId), id), clean, { merge: true });
    // Bump thread updatedAt so the list orders correctly without extra reads.
    // `lastRole` mirrors what the server stamps on its own writes — a user
    // message clears the "coach answered" state so the notification only ever
    // fires on a genuinely new reply.
    await setDoc(
      doc(chatThreadsCol(), threadId),
      { id: threadId, updatedAt: msg.ts, lastRole: msg.role, lastAt: msg.ts, ...(msg.role === 'user' ? { lastHasAction: false } : {}) },
      { merge: true },
    );
    return id;
  }, [uid, chatThreadsCol, chatMessagesCol]);

  const listChatThreads = useCallback(async (bucket: ChatBucket): Promise<ChatThreadDoc[]> => {
    if (!uid) return [];
    const snap = await getDocs(chatThreadsCol());
    return snap.docs
      .map(d => d.data() as ChatThreadDoc)
      .filter(t => (t.bucket || 'coach') === bucket)
      .sort((a, b) => (b.updatedAt || b.ts || 0) - (a.updatedAt || a.ts || 0));
  }, [uid, chatThreadsCol]);

  const subscribeToChatThreads = useCallback((bucket: ChatBucket, cb: (threads: ChatThreadDoc[]) => void): () => void => {
    if (!uid) return () => {};
    return onSnapshot(chatThreadsCol(), snap => {
      // Firestore fires the listener from local cache first. On a fresh browser
      // that cache is empty even when the server has threads, which used to make
      // us think "no history → create a new thread" and land on a blank chat.
      // Skip cache-only EMPTY snapshots — the server round-trip will follow with
      // the real data. Non-empty cache snapshots are still useful (fast paint).
      if (snap.empty && snap.metadata && snap.metadata.fromCache) return;
      const list = snap.docs
        .map(d => d.data() as ChatThreadDoc)
        .filter(t => (t.bucket || 'coach') === bucket)
        .sort((a, b) => (b.updatedAt || b.ts || 0) - (a.updatedAt || a.ts || 0));
      cb(list);
    });
  }, [uid, chatThreadsCol]);

  const subscribeToChatMessages = useCallback((threadId: string, cb: (msgs: ChatMessageDoc[]) => void): () => void => {
    if (!uid) return () => {};
    const q = query(chatMessagesCol(threadId), orderBy('ts', 'asc'));
    return onSnapshot(q, snap => {
      // Same cache-race guard as subscribeToChatThreads. First fire on a
      // fresh browser is often the empty local cache — we'd flash "no
      // messages" before the server round-trip. Skipping cache-empty snapshots
      // keeps the previous state until real data lands.
      if (snap.empty && snap.metadata && snap.metadata.fromCache) return;
      cb(snap.docs.map(d => d.data() as ChatMessageDoc));
    });
  }, [uid, chatMessagesCol]);

  const deleteChatThread = useCallback(async (threadId: string): Promise<void> => {
    if (!uid) return;
    // Delete messages subcollection first (Firestore doesn't cascade).
    try {
      const snap = await getDocs(chatMessagesCol(threadId));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    } catch { /* ignore */ }
    try { await deleteDoc(doc(chatThreadsCol(), threadId)); } catch { /* ignore */ }
  }, [uid, chatMessagesCol, chatThreadsCol]);

  // Gate for the onboarding wizard: show it whenever the user hasn't marked
  // onboarding as complete. Legacy heuristic — treat accounts with existing sessions
  // as already-onboarded so Shlomi's account and any other pre-profile user aren't
  // re-prompted on next login.
  //
  // The `forceOnboarding` flag on the profile OVERRIDES the legacy check, so the
  // Settings "reopen" button always brings the user back to the chat even after
  // they've built up history.
  // NUKE every piece of user data from Firestore for the current uid. Leaves the
  // Firebase Auth account intact — just erases the app's memory of this user so a
  // fresh sign-in feels like a brand-new account. Also removes any authAlias doc
  // that binds a Google account to this uid.
  //
  // ⚠️ PROTECTED UIDS ⚠️
  // The list below MUST NEVER be wiped via this flow. Callers pass their own
  // shlomi@boostart.io => user_6724 mapping through resolveAppUid, so a
  // misclick while signed in as Shlomi could otherwise erase years of data.
  // If the resolved uid matches, we throw before touching a single doc.
  const wipeAllUserData = useCallback(async (rawAuthUid?: string | null): Promise<void> => {
    if (!uid) return;
    const PROTECTED_UIDS = new Set<string>(['user_6724']);
    if (PROTECTED_UIDS.has(uid)) {
      throw new Error(`Protected uid "${uid}" — refusing to wipe. Remove it from PROTECTED_UIDS if you truly mean it.`);
    }
    const subcollections = [
      'sessions',
      'freeSessions',
      'exerciseStats',
      'customExercises',
      'hiddenExercises',
      'personalExercises',
      'exerciseOverrides',
      'hiddenPersonalExercises',
      'exercisePhotos',
      'renameSuggestions',
      'supersetPairs',
      'profile',
      'settings',
      'personalMeals',
      'mealLogs',
      'appliedChatActions',
    ];
    for (const sub of subcollections) {
      try {
        const snap = await getDocs(collection(db, 'users', uid, sub));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      } catch (err) {
        console.warn('wipe subcollection failed', sub, err);
      }
    }
    // Also clear the alias binding if any — otherwise next sign-in would re-resolve
    // to the same (now-empty) app uid, which is fine but leaves stale linkage state.
    if (rawAuthUid) {
      try { await deleteDoc(doc(db, 'authAliases', rawAuthUid)); } catch { /* ignore */ }
    }
    // Purge local caches so the app truly forgets us on next mount.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.includes(uid) || key.startsWith('aichat:') || key.startsWith('authAlias:')) {
          localStorage.removeItem(key);
        }
      }
    } catch { /* ignore */ }
  }, [uid]);

  const shouldShowOnboarding = useCallback(async (): Promise<boolean> => {
    if (!uid) return false;
    const profile = await getUserProfile();
    if (profile.forceOnboarding) return true;
    if (profile.onboardingCompletedAt) return false;
    // Legacy accounts: any prior session means we implicitly consider them onboarded.
    const [freeSnap, oldSessSnap, customSnap, ovSnap] = await Promise.all([
      getDocs(freeSessionsCol(uid)),
      getDocs(sessionsCol(uid)),
      getDocs(userPersonalExercisesCol(uid)),
      getDocs(userExerciseOverridesCol(uid)),
    ]);
    const hasAnyData = !freeSnap.empty || !oldSessSnap.empty || !customSnap.empty || !ovSnap.empty;
    if (hasAnyData) {
      // Backfill the flag so we don't repeat this check on every login.
      await markOnboardingComplete();
      return false;
    }
    return true;
  }, [uid, getUserProfile, markOnboardingComplete]);

  // One-time migration: scan all past sets and create personal entries for
  // any exerciseName that doesn't already exist. Muscle inferred from most
  // recent set that used that name.
  const migratePersonalFromHistory = useCallback(async (): Promise<number> => {
    if (!uid) return 0;
    const [sessions, existing] = await Promise.all([
      getDocs(freeSessionsCol(uid)).then(s => s.docs.map(d => d.data() as any)),
      listPersonalExercises(),
    ]);
    const existingIds = new Set(existing.map(e => e.id));
    // Build map: name → most-recent { muscle, ts }
    const latest = new Map<string, { name: string; muscle: MuscleGroup; ts: number }>();
    for (const s of sessions) {
      for (const set of s.sets || []) {
        if (!set.exerciseName) continue;
        const id = exerciseIdOf(set.exerciseName);
        if (!id || existingIds.has(id)) continue;
        const prev = latest.get(id);
        const ts = set.timestamp || 0;
        if (!prev || ts > prev.ts) {
          latest.set(id, { name: set.exerciseName, muscle: set.muscle, ts });
        }
      }
    }
    let created = 0;
    for (const [id, info] of latest) {
      const ex: PersonalExercise = {
        id,
        he: info.name.trim(),
        defaultMuscle: info.muscle,
        createdAt: info.ts || Date.now(),
        updatedAt: Date.now(),
      };
      // Route through upsertPersonalExercise so admin writes to global and
      // regular users write to their personal collection.
      await upsertPersonalExercise(ex);
      created++;
    }
    return created;
  }, [uid, listPersonalExercises, upsertPersonalExercise]);

  // ─── Exercise photos (user-uploaded, one per exercise-name) ────

  const saveExercisePhoto = useCallback(async (
    exerciseName: string,
    base64: string,
    opts?: { alsoDefault?: boolean },
  ) => {
    if (!uid) return;
    const key = exercisePhotoKey(exerciseName);
    if (!key) return;
    // Always write the per-user copy.
    const ref = doc(db, 'users', uid, 'exercisePhotos', key);
    await setDoc(ref, { key, exerciseName, base64, createdAt: Date.now() });
    // If the caller opted in (admin flow), also promote it to the global defaults.
    if (opts?.alsoDefault) {
      const defRef = doc(db, 'defaultExercisePhotos', key);
      await setDoc(defRef, { key, exerciseName, base64, uploadedBy: uid, updatedAt: Date.now() });
    }
  }, [uid]);

  const getExercisePhoto = useCallback(async (exerciseName: string): Promise<string | null> => {
    if (!uid) return null;
    const key = exercisePhotoKey(exerciseName);
    if (!key) return null;
    const snap = await getDoc(doc(db, 'users', uid, 'exercisePhotos', key));
    if (snap.exists() && snap.data().base64) return snap.data().base64;
    // Fall back to the global default.
    const defSnap = await getDoc(doc(db, 'defaultExercisePhotos', key));
    if (defSnap.exists() && defSnap.data().base64) return defSnap.data().base64;
    return null;
  }, [uid]);

  // Returns { key → base64 } for both the global defaults AND the user's per-user overrides.
  // User overrides always win over defaults (spread order matters).
  // Defaults are BEST EFFORT — if rules block us or the collection doesn't exist, keep going.
  const getAllExercisePhotos = useCallback(async (): Promise<Record<string, string>> => {
    if (!uid) return {};
    const out: Record<string, string> = {};
    try {
      const defSnap = await getDocs(collection(db, 'defaultExercisePhotos'));
      for (const d of defSnap.docs) {
        const data = d.data();
        if (data.base64 && data.key) out[data.key] = data.base64;
      }
    } catch { /* defaults are optional — user photos still show */ }
    const userSnap = await getDocs(collection(db, 'users', uid, 'exercisePhotos'));
    for (const d of userSnap.docs) {
      const data = d.data();
      if (data.base64 && data.key) out[data.key] = data.base64; // override wins
    }
    return out;
  }, [uid]);

  const deleteExercisePhoto = useCallback(async (exerciseName: string) => {
    if (!uid) return;
    const key = exercisePhotoKey(exerciseName);
    if (!key) return;
    await deleteDoc(doc(db, 'users', uid, 'exercisePhotos', key));
  }, [uid]);

  // Admin only — deletes a global default photo (used to un-promote something).
  const deleteDefaultExercisePhoto = useCallback(async (exerciseName: string) => {
    const key = exercisePhotoKey(exerciseName);
    if (!key) return;
    await deleteDoc(doc(db, 'defaultExercisePhotos', key));
  }, []);

  // Admin only — promotes a specific photo (base64) to the global default for that exercise.
  const setDefaultExercisePhoto = useCallback(async (exerciseName: string, base64: string) => {
    const key = exercisePhotoKey(exerciseName);
    if (!key) return;
    await setDoc(doc(db, 'defaultExercisePhotos', key), {
      key, exerciseName, base64, uploadedBy: uid || 'admin', updatedAt: Date.now(),
    });
  }, [uid]);

  // Set of photo-keys that currently have a global default. Used by admin UI to show ★ state.
  const listDefaultPhotoKeys = useCallback(async (): Promise<Set<string>> => {
    try {
      const snap = await getDocs(collection(db, 'defaultExercisePhotos'));
      const out = new Set<string>();
      for (const d of snap.docs) {
        const data = d.data();
        if (data.key) out.add(data.key);
      }
      return out;
    } catch { return new Set(); }
  }, []);

  // ─── תזונה: meal library + meal log ───────────────────────────
  // Mirrors the personal-exercise model. The reader is written as a layered
  // merge from day one (global ∪ personal), with the global layer currently
  // empty — so a seeded Israeli-food DB can land later with zero migration.
  function personalMealsCol(u: string) { return collection(db, 'users', u, 'personalMeals'); }
  function mealLogsCol(u: string) { return collection(db, 'users', u, 'mealLogs'); }

  const listPersonalMeals = useCallback(async (): Promise<PersonalMeal[]> => {
    if (!uid) return [];
    const out: PersonalMeal[] = [];
    const seen = new Set<string>();
    // Global layer — optional. Missing collection or denying rules must not
    // break the user's own library.
    try {
      const globalSnap = await getDocs(collection(db, 'meals'));
      for (const d of globalSnap.docs) {
        const m = d.data() as PersonalMeal;
        if (!m?.id) continue;
        out.push(m);
        seen.add(m.id);
      }
    } catch { /* global meal DB is optional */ }
    const mineSnap = await getDocs(personalMealsCol(uid));
    for (const d of mineSnap.docs) {
      const m = d.data() as PersonalMeal;
      if (!m?.id || seen.has(m.id)) continue;
      out.push(m);
    }
    return out;
  }, [uid]);

  const upsertPersonalMeal = useCallback(async (meal: PersonalMeal): Promise<void> => {
    if (!uid) return;
    const clean: any = { ...meal, updatedAt: Date.now() };
    Object.keys(clean).forEach(k => { if (clean[k] === undefined) delete clean[k]; });
    await setDoc(doc(personalMealsCol(uid), meal.id), clean, { merge: true });
  }, [uid]);

  const deletePersonalMeal = useCallback(async (id: string): Promise<void> => {
    if (!uid) return;
    await deleteDoc(doc(personalMealsCol(uid), id));
  }, [uid]);

  // Idempotent: returns the existing template when the name already resolves,
  // otherwise creates one. This is what makes "log a meal" and "grow my meal
  // DB" the same action instead of two chores.
  const ensurePersonalMeal = useCallback(async (
    input: { he: string; type: MealType; calories: number; ingredients?: MealIngredient[]; macros?: MealMacros; flags?: MealFlags; photoBase64?: string },
  ): Promise<PersonalMeal | null> => {
    if (!uid || !input.he.trim()) return null;
    const all = await listPersonalMeals();
    const nLower = input.he.trim().toLowerCase();
    const existing = all.find(m =>
      m.he.trim().toLowerCase() === nLower ||
      (m.aliases || []).some(a => a.trim().toLowerCase() === nLower),
    ) || all.find(m => m.id === exerciseIdOf(input.he));
    if (existing) return existing;
    const id = exerciseIdOf(input.he);
    if (!id) return null;
    const meal: PersonalMeal = {
      id,
      he: input.he.trim(),
      type: input.type,
      calories: Math.max(0, Math.round(input.calories)),
      ingredients: input.ingredients,
      macros: input.macros,
      flags: input.flags,
      photoBase64: input.photoBase64,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await upsertPersonalMeal(meal);
    return meal;
  }, [uid, listPersonalMeals, upsertPersonalMeal]);

  const getMealLogs = useCallback(async (sinceTs?: number): Promise<MealLog[]> => {
    if (!uid) return [];
    const snap = await getDocs(mealLogsCol(uid));
    return snap.docs
      .map(d => d.data() as MealLog)
      .filter(l => (sinceTs == null ? true : (l.timestamp || 0) >= sinceTs))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [uid]);

  // Log a meal. Creates the template when this is a brand-new meal (§ auto-add
  // rule) and stamps lastUsedAt so the picker's least-recently-eaten ordering
  // stays honest.
  const logMeal = useCallback(async (input: {
    mealId?: string | null;
    he: string;
    mealType: MealType;
    caloriesPerServing: number;
    servings: number;
    ingredients?: MealIngredient[];
    macros?: MealMacros;
    flags?: MealFlags;
    photoBase64?: string;
    notes?: string;
    timestamp?: number;
  }): Promise<string | null> => {
    if (!uid) return null;
    let templateId = input.mealId || null;
    if (!templateId) {
      const created = await ensurePersonalMeal({
        he: input.he,
        type: input.mealType,
        calories: input.caloriesPerServing,
        ingredients: input.ingredients,
        macros: input.macros,
        flags: input.flags,
        photoBase64: input.photoBase64,
      });
      templateId = created?.id || null;
    }
    if (templateId) {
      try {
        await setDoc(doc(personalMealsCol(uid), templateId), { lastUsedAt: Date.now() }, { merge: true });
      } catch { /* template may be global / read-only */ }
    }
    const ts = input.timestamp ?? Date.now();
    const id = `ml_${ts}_${Math.random().toString(36).slice(2, 7)}`;
    const servings = input.servings > 0 ? input.servings : 1;
    const scale = (n?: number) => (n == null ? undefined : Math.round(n * servings));
    const log: MealLog = {
      id,
      mealId: templateId,
      name: input.he.trim(),
      calories: Math.max(0, Math.round(input.caloriesPerServing * servings)),
      servings,
      ingredients: input.ingredients,
      macros: input.macros ? {
        protein: scale(input.macros.protein),
        carbs: scale(input.macros.carbs),
        fat: scale(input.macros.fat),
        sugar: scale(input.macros.sugar),
      } : undefined,
      flags: input.flags,
      mealType: input.mealType,
      timestamp: ts,
      notes: input.notes,
    };
    const clean: any = { ...log };
    if (clean.macros) {
      Object.keys(clean.macros).forEach(k => { if (clean.macros[k] === undefined) delete clean.macros[k]; });
      if (Object.keys(clean.macros).length === 0) delete clean.macros;
    }
    Object.keys(clean).forEach(k => { if (clean[k] === undefined) delete clean[k]; });
    await setDoc(doc(mealLogsCol(uid), id), clean);
    return id;
  }, [uid, ensurePersonalMeal]);

  // Edit an already-logged meal in place. History is a snapshot, so this only
  // touches THIS entry — the template it came from is untouched.
  const updateMealLog = useCallback(async (id: string, patch: Partial<MealLog>): Promise<void> => {
    if (!uid) return;
    const clean: any = { ...patch };
    Object.keys(clean).forEach(k => { if (clean[k] === undefined) delete clean[k]; });
    await setDoc(doc(mealLogsCol(uid), id), clean, { merge: true });
  }, [uid]);

  const deleteMealLog = useCallback(async (id: string): Promise<void> => {
    if (!uid) return;
    await deleteDoc(doc(mealLogsCol(uid), id));
  }, [uid]);

  // Which chat action cards have already been acted on. Kept in Firestore, not
  // component state, so "added" survives closing the panel — the old in-memory
  // set forgot everything the moment the chat reopened, which made the same
  // suggestion look un-added and invited a duplicate log.
  const getAppliedActions = useCallback(async (threadId: string): Promise<Set<string>> => {
    if (!uid || !threadId) return new Set();
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'appliedChatActions'));
      const out = new Set<string>();
      for (const d of snap.docs) {
        const data = d.data() as any;
        if (data?.threadId === threadId && typeof data.key === 'string') out.add(data.key);
      }
      return out;
    } catch { return new Set(); }
  }, [uid]);

  const markActionApplied = useCallback(async (threadId: string, key: string): Promise<void> => {
    if (!uid || !threadId || !key) return;
    const id = `${threadId}__${key}`.replace(/[^\w-]+/g, '_').slice(0, 180);
    await setDoc(doc(db, 'users', uid, 'appliedChatActions', id), {
      threadId, key, appliedAt: Date.now(),
    });
  }, [uid]);

  // Dietary profile lives under profile/main alongside the training profile.
  const updateDietProfile = useCallback(async (patch: Partial<DietProfile>): Promise<UserProfile> => {
    if (!uid) return {} as UserProfile;
    const ref = doc(db, 'users', uid, 'profile', 'main');
    const clean: any = { ...patch };
    Object.keys(clean).forEach(k => { if (clean[k] === undefined) delete clean[k]; });
    // merge:true merges nested maps, so this patches `diet` without clobbering
    // the training fields that live beside it.
    await setDoc(ref, { diet: clean, updatedAt: Date.now() }, { merge: true });
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() as UserProfile : ({ diet: clean } as UserProfile);
  }, [uid]);

  const getProgramStartOverride = useCallback(async (): Promise<string | null> => {
    if (!uid) return null;
    const ref = doc(db, 'users', uid, 'settings', 'main');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const v = snap.data().programStartOverride;
    return typeof v === 'string' && v ? v : null;
  }, [uid]);

  const setProgramStartOverride = useCallback(async (iso: string | null) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'settings', 'main');
    await setDoc(ref, { programStartOverride: iso || null }, { merge: true });
  }, [uid]);

  const saveExerciseNote = useCallback(async (exerciseId: string, note: string) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'exerciseNotes', exerciseId);
    await setDoc(ref, { note, updatedAt: Date.now() });
  }, [uid]);

  const getExerciseNote = useCallback(async (exerciseId: string): Promise<string> => {
    if (!uid) return '';
    const ref = doc(db, 'users', uid, 'exerciseNotes', exerciseId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data().note || '' : '';
  }, [uid]);

  return {
    createSession,
    getSession,
    logSet,
    completeSession,
    updateSessionDates,
    updateExerciseStats,
    getExerciseStats,
    getSessions,
    getLastSessionForDay,
    getLastCompletedSessionForDay,
    getIncompleteSession,
    resetProgram,
    addCustomExercise,
    getCustomExercises,
    deleteCustomExercise,
    restartExercise,
    skipExercise,
    unskipExercise,
    hideExercise,
    unhideExercise,
    getHiddenExercises,
    saveExerciseNote,
    getExerciseNote,
    saveExerciseDifficulty,
    getExerciseDifficulty,
    getExerciseDifficultyForSession,
    deleteExerciseDifficulty,
    getProgramStartOverride,
    setProgramStartOverride,
    // Free (muscle-based) sessions
    createFreeSession,
    createPlannedSession,
    movePlannedSession,
    restartFreeSession,
    pauseFreeSession,
    resumeFreeSession,
    startPlannedSession,
    copyPlannedWeek,
    convertToPlanned,
    reactivateFreeSession,
    setAerobicEntries,
    listSupersetPairs,
    recordSupersetPair,
    hideSupersetPair,
    unhideSupersetPair,
    getFreeSession,
    getFreeSessions,
    logFreeSet,
    updateFreeSets,
    completeFreeSession,
    deleteFreeSession,
    updateFreeSessionDates,
    updateFreeSessionMuscles,
    updatePlannedExercises,
    duplicateFreeSession,
    getWeeklyTargets,
    setWeeklyTargets,
    subscribeToWeeklyTargets,
    subscribeToWeekOrder,
    setWeekOrder,
    getGoalsConfig,
    setGoalsConfig,
    // Exercise photos
    saveExercisePhoto,
    getExercisePhoto,
    getAllExercisePhotos,
    deleteExercisePhoto,
    deleteDefaultExercisePhoto,
    setDefaultExercisePhoto,
    listDefaultPhotoKeys,
    // Personal exercise DB
    listPersonalExercises,
    upsertPersonalExercise,
    ensurePersonalExercise,
    deletePersonalExercise,
    migratePersonalFromHistory,
    listRenameSuggestions,
    upsertRenameSuggestion,
    deleteRenameSuggestion,
    // תזונה
    listPersonalMeals,
    upsertPersonalMeal,
    ensurePersonalMeal,
    deletePersonalMeal,
    getMealLogs,
    logMeal,
    updateMealLog,
    deleteMealLog,
    updateDietProfile,
    getAppliedActions,
    markActionApplied,
    // Onboarding + profile
    getUserProfile,
    updateUserProfile,
    markOnboardingComplete,
    shouldShowOnboarding,
    wipeAllUserData,
    // Chat (Firestore-backed)
    upsertChatThread,
    addChatMessage,
    listChatThreads,
    subscribeToChatThreads,
    subscribeToChatMessages,
    deleteChatThread,
  };
}
