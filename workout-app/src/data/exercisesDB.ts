// Personal exercise DB.
// Each user builds their own catalog session-by-session. Entries live in
// Firestore under `users/{uid}/exercises/{id}`. There is no shared DB.

import type { MuscleGroup } from './muscles';

export type PersonalExercise = {
  id: string;                    // slug of the exercise name — stable key
  he: string;                    // canonical Hebrew name (user-facing, PURE Hebrew)
  en?: string;                   // English canonical name (standard fitness terminology)
  defaultMuscle: MuscleGroup;    // primary muscle for the picker filter
  aliases?: string[];            // alternate names / typos that resolve here
  photoBase64?: string;          // user-uploaded photo, replaces any icon
  notes?: string;                // free-text
  // Hold-time exercises (planks, wall-sits, dead-hangs).
  // When true, the "reps" field on each FreeSet represents seconds-held, not repetitions.
  // Undefined (default) → normal rep-based exercise. Fully backward-compatible.
  isHoldTime?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type RenameSuggestion = {
  id: string;                    // same as exercise id
  currentHe: string;             // snapshot at generation time
  suggestedHe: string;
  suggestedEn?: string;
  muscle?: MuscleGroup;
  reason?: string;
  status: 'pending' | 'accepted' | 'rejected';
  editedHe?: string;             // user overrides
  editedEn?: string;
  createdAt: number;
  updatedAt: number;
};

// Slug an exercise name into a stable id. Keeps Hebrew + word chars.
export function exerciseIdOf(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w֐-׿]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

// Lookup a personal exercise by user-typed name (exact or alias match, case-insensitive).
export function findPersonalByName(
  all: PersonalExercise[],
  name: string,
): PersonalExercise | undefined {
  if (!name) return undefined;
  const n = name.trim();
  const nLower = n.toLowerCase();
  return all.find(e =>
    e.he === n ||
    e.he.toLowerCase() === nLower ||
    (e.aliases || []).some(a => a === n || a.toLowerCase() === nLower)
  );
}

// Filter + rank personal exercises for a picker.
// Optionally scope to a muscle (or a set of session-focus muscles).
export function pickPersonal(
  all: PersonalExercise[],
  opts: {
    query?: string;
    muscle?: MuscleGroup | null;
    scope?: MuscleGroup[];       // fallback scope when muscle isn't set
    historyMap?: Record<string, number>; // id → last-used timestamp
  } = {},
): PersonalExercise[] {
  const q = (opts.query || '').trim().toLowerCase();
  let list = all;
  if (opts.muscle) {
    list = list.filter(e => e.defaultMuscle === opts.muscle);
  } else if (opts.scope && opts.scope.length > 0) {
    const scopeSet = new Set(opts.scope);
    list = list.filter(e => scopeSet.has(e.defaultMuscle));
  }
  if (q) {
    list = list.filter(e =>
      e.he.toLowerCase().includes(q) ||
      (e.aliases || []).some(a => a.toLowerCase().includes(q))
    );
  }
  const h = opts.historyMap || {};
  return [...list].sort((a, b) => {
    const aH = h[a.id] || 0;
    const bH = h[b.id] || 0;
    if (aH || bH) return bH - aH;
    return a.he.localeCompare(b.he, 'he');
  });
}
