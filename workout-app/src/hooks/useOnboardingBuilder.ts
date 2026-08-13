import { useCallback } from 'react';
import { CHAT_API_URL } from '../config/api';
import { useFirestore } from './useFirestore';
import type { MuscleGroup } from '../data/muscles';
import type { PlannedExercise } from '../types';
import { exerciseIdOf, type PersonalExercise } from '../data/exercisesDB';

// The profile object emitted by the onboarding chat's ready_to_build action.
export type OnboardingProfile = {
  name?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  goal?: 'mass' | 'cut' | 'strength' | 'health';
  daysPerWeek?: 2 | 3 | 4 | 5 | 6 | 7;
  focus?: string;
  focusMuscles?: string[];
  limitations?: string;
};

export type BuildProgress =
  | { phase: 'idle' }
  | { phase: 'skeleton' }
  | { phase: 'days'; completed: number; total: number }
  | { phase: 'done'; sessionIds: string[]; summary: string }
  | { phase: 'error'; message: string };

export type BuiltDay = {
  nameHe: string;
  focusMuscles: MuscleGroup[];
  exercises: Array<{ he: string; en?: string; muscle: MuscleGroup; isHoldTime?: boolean }>;
  plannedFor: string; // YYYY-MM-DD
  sessionId?: string;
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Return the next `count` calendar days starting today. Rest days are skipped by
// the AI implicitly — each generated day gets consecutive dates so the user sees a
// clear "this week" schedule on Home.
function nextDates(count: number): string[] {
  const out: string[] = [];
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    out.push(ymd(t));
    t.setDate(t.getDate() + 1);
  }
  return out;
}

// Orchestrates the two-stage onboarding plan build.
//   1. POST /api/onboarding/build-skeleton  → { days: [{nameHe, focusMuscles}] }
//   2. Parallel POST /api/onboarding/build-day for each day  → { exercises: [...] }
//   3. Ensures every returned exercise exists in the personal DB (via ensurePersonalExercise).
//   4. Creates a planned FreeSession per day with those exercises pre-populated.
//
// All steps are size-bounded — each Anthropic call is small, so a single failure
// only kills one day (not the whole flow). Failed days are retried once.
export function useOnboardingBuilder(uid: string) {
  const firestore = useFirestore(uid);

  const build = useCallback(async (
    profile: OnboardingProfile,
    onProgress: (p: BuildProgress) => void,
  ): Promise<{ ok: boolean; sessionIds: string[]; days: BuiltDay[]; error?: string }> => {
    try {
      onProgress({ phase: 'skeleton' });

      // Stage A: skeleton.
      const skelResp = await fetch(`${CHAT_API_URL.replace(/\/$/, '')}/api/onboarding/build-skeleton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, profile }),
      });
      if (!skelResp.ok) {
        const body = await skelResp.json().catch(() => ({}));
        throw new Error(body.error || `skeleton ${skelResp.status}`);
      }
      const skel = await skelResp.json();
      const rawDays = Array.isArray(skel?.days) ? skel.days : [];
      if (rawDays.length === 0) throw new Error('empty skeleton');

      // Assign consecutive calendar dates to the skeleton.
      const dates = nextDates(rawDays.length);
      const scaffolded: BuiltDay[] = rawDays.map((d: any, i: number) => ({
        nameHe: String(d.nameHe || `יום ${i + 1}`).slice(0, 60),
        focusMuscles: (d.focusMuscles || []).slice(0, 6) as MuscleGroup[],
        exercises: [],
        plannedFor: dates[i],
      }));

      onProgress({ phase: 'days', completed: 0, total: scaffolded.length });

      // Load the current global+custom exercise list so build-day can prefer names
      // that already exist in the DB (keeps history linked cleanly).
      const globalList = await firestore.listPersonalExercises();
      const globalPayload = globalList.map(e => ({ he: e.he, defaultMuscle: e.defaultMuscle }));

      // Stage B: per-day exercises, parallel with a small concurrency cap so we don't
      // trip Anthropic rate limits or the app-level 100/day limiter on a burst.
      const CONC = 3;
      let done = 0;
      const results: BuiltDay[] = new Array(scaffolded.length);

      async function fetchDay(day: BuiltDay, attempt = 1): Promise<BuiltDay> {
        try {
          const res = await fetch(`${CHAT_API_URL.replace(/\/$/, '')}/api/onboarding/build-day`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid,
              profile,
              day: { nameHe: day.nameHe, focusMuscles: day.focusMuscles },
              globalExercises: globalPayload,
            }),
          });
          if (!res.ok) throw new Error(`day ${res.status}`);
          const data = await res.json();
          const list = Array.isArray(data?.exercises) ? data.exercises : [];
          return { ...day, exercises: list.slice(0, 8) };
        } catch (err) {
          if (attempt < 2) return fetchDay(day, attempt + 1);
          // Give up on this day silently — user still gets the skeleton, they can
          // add exercises manually later. Better than blocking the whole flow.
          console.warn('build-day failed for', day.nameHe, err);
          return day;
        }
      }

      // Simple concurrency runner: keep CONC in-flight.
      let idx = 0;
      async function worker() {
        while (idx < scaffolded.length) {
          const my = idx++;
          const filled = await fetchDay(scaffolded[my]);
          results[my] = filled;
          done++;
          onProgress({ phase: 'days', completed: done, total: scaffolded.length });
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONC, scaffolded.length) }, worker));

      // Persist: for each day, ensure every exercise exists in the DB (creates it
      // in the right layer via ensurePersonalExercise), then create the planned session.
      const sessionIds: string[] = [];
      for (const day of results) {
        const planned: PlannedExercise[] = [];
        for (const ex of day.exercises) {
          const ensured: PersonalExercise | null = await firestore.ensurePersonalExercise(
            ex.he, ex.muscle, ex.en, ex.isHoldTime,
          );
          const name = ensured?.he || ex.he;
          const muscle = ensured?.defaultMuscle || ex.muscle;
          planned.push({ name, muscle, addedAt: Date.now() });
        }
        const sid = await firestore.createPlannedSession(day.focusMuscles, day.plannedFor, planned);
        day.sessionId = sid;
        sessionIds.push(sid);
      }

      // Also make sure the global aerobic starter exercises are discoverable — they're
      // already global so no action needed. Skipped intentionally.

      const summary = `${results.length} ימי אימון נוצרו לך — כל אחד עם ${results.reduce((s, d) => s + d.exercises.length, 0) / results.length | 0} תרגילים בממוצע. מוכן להתחיל!`;
      onProgress({ phase: 'done', sessionIds, summary });
      return { ok: true, sessionIds, days: results };
    } catch (err: any) {
      const msg = err?.message || String(err);
      onProgress({ phase: 'error', message: msg });
      return { ok: false, sessionIds: [], days: [], error: msg };
    }
  }, [uid, firestore]);

  return { build };
}

// Slugging helper for edge cases — exported so callers can pre-compute an id if needed.
export function exerciseKey(name: string): string {
  return exerciseIdOf(name);
}
