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
  sets: SetLog[];
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

// Route types
export type Route =
  | { page: 'home'; week?: number }
  | { page: 'program-info' }
  | { page: 'workout'; day: 1 | 2 | 3 | 4 | 5; sessionId?: string; week?: number }
  | { page: 'history' }
  | { page: 'session-detail'; sessionId: string }
  | { page: 'settings' };
