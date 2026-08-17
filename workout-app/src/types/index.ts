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
  // All sets sharing the same supersetGroup id are one linked superset.
  // Field is optional so legacy sets keep working unchanged.
  supersetGroup?: string;
  // Position of THIS exercise within its supersetGroup (1 = first / source of the link).
  // All sets of the same exercise share the same supersetOrder. Used to render members
  // in the order the user linked them, and to support manual reorder via ↑/↓.
  supersetOrder?: number;
};

export type PlannedExercise = {
  name: string;                // canonical Hebrew name
  muscle: MuscleGroup;
  addedAt: number;
  // Optional superset id shared with other planned/logged items. When user logs the first set
  // for this planned exercise, the set inherits this supersetGroup automatically.
  supersetGroup?: string;
  supersetOrder?: number;      // same semantics as FreeSet.supersetOrder
};

// AerobicType is now free-form — any label the user has (either the seeded 5 or a custom
// exercise they added with defaultMuscle='aerobic'). Legacy values 'run'/'bike'/'row'/'walk'/
// 'elliptical' remain valid; a one-time migration renamed them to their Hebrew equivalents.
export type AerobicType = string;
export type AerobicEntry = {
  id: string;
  timestamp: number;
  type: AerobicType;
  minutes: number;
  km?: number;
  avgHr?: number;
  notes?: string;
};

// Session lifecycle:
//   planned    → scheduled for a future date, no sets logged yet, `plannedFor` set
//   active     → in progress (default when missing on old records)
//   completed  → done (`completedAt` set, `completed = true`)
export type FreeSessionStatus = 'planned' | 'active' | 'completed';

export type FreeSession = {
  id: string;
  date: number;                // start timestamp (for planned: midnight of `plannedFor`)
  completedAt?: number | null;
  muscleGroups: MuscleGroup[]; // focus for this session
  sets: FreeSet[];
  plannedExercises?: PlannedExercise[]; // exercises queued for this session but not yet logged
  completed: boolean;
  status?: FreeSessionStatus;  // present on new records; legacy records inferred from `completed`
  plannedFor?: string;         // YYYY-MM-DD when status='planned' (or when it once was planned)
  aerobicEntries?: AerobicEntry[]; // cardio work in this session — separate from muscle sets
  // Set when the user explicitly restarts the timer on an active session.
  // Home shows "התחל" instead of "המשך" until a new set is logged after this ts.
  restartedAt?: number;
  // Set while the session is paused — elapsed freezes at (pausedAt − date).
  // Cleared on resume; `date` is shifted forward to preserve elapsed.
  pausedAt?: number;
};

// Two exercises historically done together as a superset. Used to suggest partners when
// a user adds one of them to a session. Keyed by sorted pair ids so A+B == B+A.
export type SupersetPair = {
  id: string;               // pairKey — sorted exerciseId_a__exerciseId_b
  ids: [string, string];    // sorted
  count: number;            // how many times user linked them
  lastTs: number;
  hidden?: boolean;         // user chose "אל תציע שוב"
};

// User profile — collected during onboarding, editable in Settings, and updatable
// via conversation with the AI (the trainer can emit an update_profile action).
// Any field may be missing; the AI treats absent fields as "not asked yet".
export type UserProfile = {
  name?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  goal?: 'mass' | 'cut' | 'strength' | 'health';
  daysPerWeek?: 2 | 3 | 4 | 5 | 6 | 7;
  focusMuscles?: MuscleGroup[];  // canonical muscle keys
  focus?: string;                 // free-form label e.g. 'push_pull_legs' or 'גוף מלא'
  limitations?: string;
  // Set when the user finishes the onboarding wizard (or chooses to skip).
  // Used to gate whether we auto-open onboarding on next login.
  onboardingCompletedAt?: number;
  // Explicit user request to (re-)open the onboarding chat. Overrides the legacy
  // "has any data → mark complete" backfill so the reopen button always works,
  // even for accounts that already have sessions/exercises. Cleared automatically
  // when the user completes or skips the reopened chat.
  forceOnboarding?: boolean;
  updatedAt?: number;
};

// Chat persistence — moved from localStorage → Firestore so answers survive
// tab-close, sync across devices, and can be written by the server too.
// Thread doc holds metadata; per-message docs live in the messages subcollection.
export type ChatMessageDoc = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  truncated?: boolean;
  // Assistant messages carry the mode they were generated in so the UI can
  // render mode-specific badges if needed. User messages omit it.
  mode?: 'session' | 'trainer' | 'onboarding' | 'naming';
  // Optional attached image (base64 data URL). Present on user messages that
  // sent a photo ("what muscle does this machine work?" flows). Sits in the
  // same doc as `content` so a single Firestore read yields the whole turn.
  image?: string;
};
export type ChatThreadDoc = {
  id: string;
  title: string;
  ts: number;         // when the thread started
  updatedAt: number;  // last message ts (drives ordering)
  // 'coach' = onboarding/trainer/session (unified); 'naming' = naming helper
  bucket: 'coach' | 'naming';
};

// Route types
export type Route =
  | { page: 'home' }
  | { page: 'session'; sessionId: string }
  | { page: 'history' }
  | { page: 'session-view'; sessionId: string }
  | { page: 'settings' }
  | { page: 'exercises' }
  | { page: 'body' }
  | { page: 'install' };
