export type Exercise = {
  id: string;
  name: string;
  nameHe?: string;
  muscle?: string;
  muscleHe?: string;
  sets: number;
  reps: number | null;       // null if time-based
  durationSeconds?: number;
  isUnilateral: boolean;
  isTimeBased: boolean;
  startWeakSide: boolean;
  notes?: string;
  imageUrl?: string;
  tag?: string; // optional free-text label, e.g. "alt", "pair-A"
};

export type Day = {
  day: 1 | 2 | 3 | 4 | 5;
  title: string;
  titleHe?: string;
  exercises: Exercise[];
};

export type Program = {
  name: string;
  startDate: string; // ISO
  phases: {
    phase: 1 | 2 | 3;
    weeks: [number, number];
    tempo: string;
    restSeconds: number;
  }[];
  days: Day[];
};

export type SetLog = {
  exerciseId: string;
  setNumber: number;
  weightLeft?: number;
  repsLeft?: number;
  weightRight?: number;
  repsRight?: number;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  durationLeftSeconds?: number;
  durationRightSeconds?: number;
  unit?: string; // measurement unit for weight; defaults to "kg" if absent
  timestamp: number;
};

export type Session = {
  id: string;
  date: number; // timestamp (start)
  completedAt?: number | null; // timestamp (end)
  day: 1 | 2 | 3 | 4 | 5;
  weekNumber: number;
  phase: 1 | 2 | 3;
  programName: string;
  completed: boolean;
  partial?: boolean;
  sets: SetLog[];
  skippedExerciseIds?: string[];
};

export type SideStat = {
  weight: number;
  reps: number;
  date: number;
  sessionId?: string;
};

export type ExerciseStats = {
  programName: string;
  max?: SideStat | { left: SideStat; right: SideStat };
  avg?: { weight: number; sampleCount: number } | { left: { weight: number; sampleCount: number }; right: { weight: number; sampleCount: number } };
  last?: SideStat & { sessionId: string } | { left: SideStat & { sessionId: string }; right: SideStat & { sessionId: string } };
  updatedAt: number;
};

// Free (muscle-based) session model — the new primary model
import type { MuscleGroup } from '../data/muscles';

export type FreeSet = {
  id: string;
  muscle: MuscleGroup;
  weight: number;
  reps: number;
  unit?: string;
  exerciseName?: string;
  timestamp: number;
};

export type PlannedExercise = {
  name: string;                // canonical Hebrew name
  muscle: MuscleGroup;
  addedAt: number;
};

export type FreeSession = {
  id: string;
  date: number;                // start timestamp
  completedAt?: number | null;
  muscleGroups: MuscleGroup[]; // focus for this session
  sets: FreeSet[];
  plannedExercises?: PlannedExercise[]; // exercises queued for this session but not yet logged
  completed: boolean;
};

// Route types
export type Route =
  | { page: 'home' }
  | { page: 'session'; sessionId: string }
  | { page: 'history' }
  | { page: 'session-view'; sessionId: string }
  | { page: 'settings' }
  | { page: 'exercises' };
