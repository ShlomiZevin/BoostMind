import { useCallback } from 'react';
import {
  collection, doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc,
  arrayUnion, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Session, SetLog, ExerciseStats, Exercise, FreeSession, FreeSet, PlannedExercise } from '../types';
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

  const saveExerciseDifficulty = useCallback(async (exerciseId: string, sessionId: string, difficulty: 'easy' | 'ok' | 'hard', addWeight: boolean) => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'exerciseDifficulty', `${exerciseId}_${sessionId}`);
    await setDoc(ref, { exerciseId, sessionId, difficulty, addWeight, timestamp: Date.now() });
  }, [uid]);

  const getExerciseDifficulty = useCallback(async (exerciseId: string): Promise<{ difficulty: string; addWeight: boolean } | null> => {
    if (!uid) return null;
    // Get most recent difficulty rating for this exercise
    const snap = await getDocs(collection(db, 'users', uid, 'exerciseDifficulty'));
    const ratings = snap.docs
      .map(d => d.data())
      .filter(d => d.exerciseId === exerciseId)
      .sort((a, b) => b.timestamp - a.timestamp);
    return ratings[0] ? { difficulty: ratings[0].difficulty, addWeight: ratings[0].addWeight } : null;
  }, [uid]);

  // ─── Free (muscle-based) sessions ───────────────────────────────

  const toFreeSession = (id: string, data: any): FreeSession => ({
    id,
    date: data.date?.toMillis?.() ?? data.date,
    completedAt: data.completedAt?.toMillis?.() ?? data.completedAt ?? null,
    muscleGroups: data.muscleGroups || [],
    sets: (data.sets || []).map((s: any) => ({ ...s })),
    plannedExercises: Array.isArray(data.plannedExercises) ? data.plannedExercises : [],
    completed: !!data.completed,
  });

  const createFreeSession = useCallback(async (muscleGroups: MuscleGroup[]): Promise<string> => {
    if (!uid) throw new Error('No uid');
    const sessionId = `free_${Date.now()}`;
    const ref = doc(freeSessionsCol(uid), sessionId);
    await setDoc(ref, {
      date: Timestamp.now(),
      muscleGroups,
      sets: [],
      completed: false,
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
      muscleGroups: pruned.length > 0 ? pruned : originalMuscles,
    });
  }, [uid]);

  const updatePlannedExercises = useCallback(async (sessionId: string, planned: PlannedExercise[]) => {
    if (!uid) return;
    await updateDoc(doc(freeSessionsCol(uid), sessionId), { plannedExercises: planned });
  }, [uid]);

  const duplicateFreeSession = useCallback(async (sessionId: string): Promise<string | null> => {
    if (!uid) return null;
    const src = await getDoc(doc(freeSessionsCol(uid), sessionId));
    if (!src.exists()) return null;
    const data = src.data();
    const sets: FreeSet[] = (data.sets || []).map((s: any) => ({ ...s }));
    // Build planned list from unique exercise names in the source session.
    const seen = new Set<string>();
    const planned: PlannedExercise[] = [];
    for (const s of sets) {
      const name = s.exerciseName?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      planned.push({ name, muscle: s.muscle, addedAt: Date.now() });
    }
    const newId = `free_${Date.now()}`;
    await setDoc(doc(freeSessionsCol(uid), newId), {
      date: Timestamp.now(),
      muscleGroups: data.muscleGroups || [],
      sets: [],
      plannedExercises: planned,
      completed: false,
    });
    return newId;
  }, [uid]);

  const deleteFreeSession = useCallback(async (sessionId: string) => {
    if (!uid) return;
    await deleteDoc(doc(freeSessionsCol(uid), sessionId));
  }, [uid]);

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

  // ─── end free sessions ──────────────────────────────────────────

  // ─── Personal exercise DB (per-user, built session by session) ─

  const listPersonalExercises = useCallback(async (): Promise<PersonalExercise[]> => {
    if (!uid) return [];
    const snap = await getDocs(collection(db, 'users', uid, 'exercises'));
    return snap.docs.map(d => d.data() as PersonalExercise);
  }, [uid]);

  const upsertPersonalExercise = useCallback(async (ex: PersonalExercise) => {
    if (!uid) return;
    const clean: any = { ...ex, updatedAt: Date.now() };
    Object.keys(clean).forEach(k => { if (clean[k] === undefined) delete clean[k]; });
    await setDoc(doc(db, 'users', uid, 'exercises', ex.id), clean);
  }, [uid]);

  // Idempotent: creates only if a matching personal exercise doesn't already exist.
  // Matching uses alias / he / slug so AI-generated variants map to the same DB entry
  // instead of spawning duplicates. Optionally fills English on first create.
  const ensurePersonalExercise = useCallback(async (
    name: string,
    defaultMuscle: MuscleGroup,
    en?: string,
    isHoldTime?: boolean,
  ): Promise<PersonalExercise | null> => {
    if (!uid || !name.trim()) return null;
    // First, check all existing personal exercises for a name-based match (he / alias / slug).
    const all = await getDocs(collection(db, 'users', uid, 'exercises'));
    const list = all.docs.map(d => d.data() as PersonalExercise);
    const existing = findPersonalByName(list, name)
      || list.find(e => e.id === exerciseIdOf(name));
    if (existing) {
      // Backfill English if we now have one and the record didn't.
      if (en && !existing.en) {
        const updated = { ...existing, en: en.trim(), updatedAt: Date.now() };
        await setDoc(doc(db, 'users', uid, 'exercises', existing.id), updated);
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
    const clean: any = { ...ex };
    Object.keys(clean).forEach(k => { if (clean[k] === undefined) delete clean[k]; });
    await setDoc(doc(db, 'users', uid, 'exercises', id), clean);
    return ex;
  }, [uid]);

  const deletePersonalExercise = useCallback(async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'exercises', id));
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
      await setDoc(doc(db, 'users', uid, 'exercises', id), ex);
      created++;
    }
    return created;
  }, [uid, listPersonalExercises]);

  // ─── Exercise photos (user-uploaded, one per exercise-name) ────

  const saveExercisePhoto = useCallback(async (exerciseName: string, base64: string) => {
    if (!uid) return;
    const key = exercisePhotoKey(exerciseName);
    if (!key) return;
    const ref = doc(db, 'users', uid, 'exercisePhotos', key);
    await setDoc(ref, { key, exerciseName, base64, createdAt: Date.now() });
  }, [uid]);

  const getExercisePhoto = useCallback(async (exerciseName: string): Promise<string | null> => {
    if (!uid) return null;
    const key = exercisePhotoKey(exerciseName);
    if (!key) return null;
    const snap = await getDoc(doc(db, 'users', uid, 'exercisePhotos', key));
    if (!snap.exists()) return null;
    return snap.data().base64 || null;
  }, [uid]);

  const getAllExercisePhotos = useCallback(async (): Promise<Record<string, string>> => {
    if (!uid) return {};
    const snap = await getDocs(collection(db, 'users', uid, 'exercisePhotos'));
    const out: Record<string, string> = {};
    for (const d of snap.docs) {
      const data = d.data();
      if (data.base64 && data.key) out[data.key] = data.base64;
    }
    return out;
  }, [uid]);

  const deleteExercisePhoto = useCallback(async (exerciseName: string) => {
    if (!uid) return;
    const key = exercisePhotoKey(exerciseName);
    if (!key) return;
    await deleteDoc(doc(db, 'users', uid, 'exercisePhotos', key));
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
    getProgramStartOverride,
    setProgramStartOverride,
    // Free (muscle-based) sessions
    createFreeSession,
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
    // Exercise photos
    saveExercisePhoto,
    getExercisePhoto,
    getAllExercisePhotos,
    deleteExercisePhoto,
    // Personal exercise DB
    listPersonalExercises,
    upsertPersonalExercise,
    ensurePersonalExercise,
    deletePersonalExercise,
    migratePersonalFromHistory,
    listRenameSuggestions,
    upsertRenameSuggestion,
    deleteRenameSuggestion,
  };
}
