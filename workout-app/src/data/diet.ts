import type { DietProfile, MealType, PersonalMeal, MealLog } from '../types';
import type { FreeSession } from '../types';

// ─── Meal types ────────────────────────────────────────────────────

export const MEAL_TYPES: { id: MealType; he: string; emoji: string }[] = [
  { id: 'breakfast', he: 'בוקר', emoji: '🌅' },
  { id: 'lunch', he: 'צהריים', emoji: '🍽' },
  { id: 'dinner', he: 'ערב', emoji: '🌙' },
  { id: 'snack', he: 'נשנוש', emoji: '🥨' },
  { id: 'drink', he: 'שתייה', emoji: '☕' },
];

export const MEAL_TYPE_HE: Record<MealType, string> = {
  breakfast: 'בוקר', lunch: 'צהריים', dinner: 'ערב', snack: 'נשנוש', drink: 'שתייה',
};

/** Default meal type from the clock — the slot you're most likely logging. */
export function mealTypeForNow(d = new Date()): MealType {
  const h = d.getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

// ─── Calorie math ──────────────────────────────────────────────────

export const ACTIVITY_LEVELS: { value: number; he: string }[] = [
  { value: 1.2, he: 'יושבני' },
  { value: 1.375, he: 'קצת פעילות' },
  { value: 1.55, he: 'בינוני' },
  { value: 1.725, he: 'פעיל' },
  { value: 1.9, he: 'מאוד פעיל' },
];

/** Mifflin-St Jeor. Returns null when we're missing the stats to compute it. */
export function bmrOf(p: DietProfile | undefined): number | null {
  if (!p?.weightKg || !p?.heightCm || !p?.age) return null;
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  if (p.gender === 'female') return Math.round(base - 161);
  if (p.gender === 'male') return Math.round(base + 5);
  // 'other' / unset → average of the two formulas rather than picking one.
  return Math.round(base - 78);
}

export function tdeeOf(p: DietProfile | undefined): number | null {
  const bmr = bmrOf(p);
  if (bmr == null) return null;
  return Math.round(bmr * (p?.activityMultiplier || 1.375));
}

/** Suggested daily target. `lose` = −500 (≈0.5kg/week), `gain` = +300. */
export function suggestedTargetOf(p: DietProfile | undefined): number | null {
  const tdee = tdeeOf(p);
  if (tdee == null) return null;
  if (p?.goal === 'lose') return Math.max(1200, tdee - 500);
  if (p?.goal === 'gain') return tdee + 300;
  return tdee;
}

/** The number the UI actually uses: a manual override wins, else the computed
 *  suggestion, else nothing (and the Today view shows a "set a target" CTA). */
export function effectiveTargetOf(p: DietProfile | undefined): number | null {
  if (p?.dailyCalorieTargetManual && p?.dailyCalorieTarget) return p.dailyCalorieTarget;
  return suggestedTargetOf(p) ?? p?.dailyCalorieTarget ?? null;
}

// ─── Exercise → calories burned ────────────────────────────────────

const MET_BY_TYPE: Record<string, number> = {
  'ריצה': 8, 'אופניים': 7, 'חתירה': 7, 'הליכה': 3.5, 'אליפטיקל': 5,
};

/** Rough burn estimate for a day's training. Strength is counted per real set;
 *  aerobic uses a small MET table against bodyweight. Deliberately coarse — it
 *  is a nudge on the balance line, not a medical figure. */
export function estimateBurn(sessions: FreeSession[], weightKg?: number): number {
  const w = weightKg && weightKg > 0 ? weightKg : 70;
  let kcal = 0;
  for (const s of sessions) {
    const realSets = (s.sets || []).filter(x => x.weight > 0 || x.reps > 0).length;
    kcal += realSets * 5;
    for (const a of s.aerobicEntries || []) {
      const met = MET_BY_TYPE[a.type] ?? 6;
      kcal += (met * w * (a.minutes || 0)) / 60;
    }
  }
  return Math.round(kcal);
}

// ─── Day helpers ───────────────────────────────────────────────────

export function startOfDay(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function ymdOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function caloriesOn(logs: MealLog[], dayStart: number): number {
  const dayEnd = dayStart + 86_400_000;
  return logs
    .filter(l => l.timestamp >= dayStart && l.timestamp < dayEnd)
    .reduce((acc, l) => acc + (l.calories || 0), 0);
}

// ─── Picker ranking ────────────────────────────────────────────────

/** Anchors first, then least-recently-eaten. Same rotation logic the exercise
 *  picker uses — the point is to surface what you haven't had in a while. */
export function pickMeals(
  all: PersonalMeal[],
  opts: { query?: string; type?: MealType | null } = {},
): PersonalMeal[] {
  const q = (opts.query || '').trim().toLowerCase();
  let list = all;
  if (q) {
    list = list.filter(m =>
      m.he.toLowerCase().includes(q) ||
      (m.aliases || []).some(a => a.toLowerCase().includes(q)),
    );
  }
  const rank = (a: PersonalMeal, b: PersonalMeal) => {
    const aTs = a.lastUsedAt;
    const bTs = b.lastUsedAt;
    if (!aTs && bTs) return -1;
    if (aTs && !bTs) return 1;
    if (!aTs && !bTs) return a.he.localeCompare(b.he, 'he');
    return (aTs as number) - (bTs as number);
  };
  return [...list].sort((a, b) => {
    // Legacy templates may still carry a slot; when present it nudges matching
    // meals up, but only among equals. New templates have none — a meal is just
    // a meal, and WHEN you eat it is recorded on the log entry.
    if (opts.type) {
      const aT = a.type === opts.type;
      const bT = b.type === opts.type;
      if (aT && !bT) return -1;
      if (!aT && bT) return 1;
    }
    const aA = !!a.isAnchor;
    const bA = !!b.isAnchor;
    if (aA && !bA) return -1;
    if (!aA && bA) return 1;
    return rank(a, b);
  });
}

export function daysSince(ts?: number): number | null {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / 86_400_000);
}

export function daysAgoLabel(ts?: number): string {
  const d = daysSince(ts);
  if (d == null) return 'לא נאכל עדיין';
  if (d === 0) return 'היום';
  if (d === 1) return 'אתמול';
  if (d < 7) return `לפני ${d} ימים`;
  if (d < 30) return `לפני ${Math.floor(d / 7)} שב׳`;
  return `לפני ${Math.floor(d / 30)} חוד׳`;
}
