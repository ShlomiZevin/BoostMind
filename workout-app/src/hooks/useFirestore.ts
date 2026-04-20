import { useCallback } from 'react';
import {
  collection, doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc,
  arrayUnion, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Session, SetLog, ExerciseStats, Exercise } from '../types';
import { PROGRAM } from '../data/program';

function sessionsCol(uid: string) {
  return collection(db, 'users', uid, 'sessions');
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
    sets: data.sets || [],
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
    hideExercise,
    unhideExercise,
    getHiddenExercises,
    saveExerciseNote,
    getExerciseNote,
    saveExerciseDifficulty,
    getExerciseDifficulty,
  };
}
