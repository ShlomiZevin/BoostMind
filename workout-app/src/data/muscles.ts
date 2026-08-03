// Fine-grained muscle taxonomy (21 active sub-muscles + legacy compat IDs).
// Legacy IDs kept in the union so old FreeSets still typecheck and render.
export type MuscleGroup =
  // Chest
  | 'upper-chest' | 'chest' | 'lower-chest'
  // Back
  | 'lats' | 'mid-back' | 'traps' | 'rear-delts' | 'lower-back'
  // Shoulders (front + side; rear-delts under Back per training-day convention)
  | 'front-delts' | 'side-delts'
  // Arms
  | 'biceps' | 'triceps' | 'forearms'
  // Legs
  | 'quads' | 'hamstrings' | 'glutes' | 'adductors' | 'abductors' | 'calves'
  // Core
  | 'abs' | 'obliques'
  // Legacy — data compat only, do not offer for new picks
  | 'back' | 'legs' | 'shoulders';

export type MuscleParent = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';

export type MuscleInfo = {
  id: MuscleGroup;
  he: string;
  en: string;
  parent: MuscleParent;
  color: string;
  legacy?: boolean;
};

export const PARENT_INFO: Record<MuscleParent, { he: string; en: string; color: string; order: number }> = {
  chest:     { he: 'חזה',     en: 'Chest',     color: 'rose',    order: 1 },
  back:      { he: 'גב',      en: 'Back',      color: 'blue',    order: 2 },
  shoulders: { he: 'כתפיים',  en: 'Shoulders', color: 'amber',   order: 3 },
  arms:      { he: 'ידיים',   en: 'Arms',      color: 'violet',  order: 4 },
  legs:      { he: 'רגליים',  en: 'Legs',      color: 'emerald', order: 5 },
  core:      { he: 'ליבה',    en: 'Core',      color: 'zinc',    order: 6 },
};

export const MUSCLES: MuscleInfo[] = [
  // Chest
  { id: 'upper-chest',  he: 'חזה עליון',    en: 'Upper Chest',  parent: 'chest',     color: 'pink' },
  { id: 'chest',        he: 'חזה (אמצע)',    en: 'Chest (mid)',  parent: 'chest',     color: 'rose' },
  { id: 'lower-chest',  he: 'חזה תחתון',    en: 'Lower Chest',  parent: 'chest',     color: 'red' },
  // Back
  { id: 'lats',         he: 'רחב הגב',      en: 'Lats',         parent: 'back',      color: 'blue' },
  { id: 'mid-back',     he: 'גב אמצעי',     en: 'Mid Back',     parent: 'back',      color: 'sky' },
  { id: 'traps',        he: 'טרפז',         en: 'Traps',        parent: 'back',      color: 'indigo' },
  { id: 'rear-delts',   he: 'כתף אחורית',   en: 'Rear Delts',   parent: 'back',      color: 'cyan' },
  { id: 'lower-back',   he: 'גב תחתון',     en: 'Lower Back',   parent: 'back',      color: 'slate' },
  { id: 'back',         he: 'גב (כללי)',    en: 'Back (all)',   parent: 'back',      color: 'blue',    legacy: true },
  // Shoulders
  { id: 'front-delts',  he: 'כתף קדמית',    en: 'Front Delts',  parent: 'shoulders', color: 'amber' },
  { id: 'side-delts',   he: 'כתף צדדית',    en: 'Side Delts',   parent: 'shoulders', color: 'yellow' },
  { id: 'shoulders',    he: 'כתפיים (כללי)', en: 'Shoulders (all)', parent: 'shoulders', color: 'amber', legacy: true },
  // Arms
  { id: 'biceps',       he: 'ביצפס',        en: 'Biceps',       parent: 'arms',      color: 'violet' },
  { id: 'triceps',      he: 'טריצפס',       en: 'Triceps',      parent: 'arms',      color: 'fuchsia' },
  { id: 'forearms',     he: 'אמות',         en: 'Forearms',     parent: 'arms',      color: 'purple' },
  // Legs
  { id: 'quads',        he: 'קוודריצפס',    en: 'Quads',        parent: 'legs',      color: 'emerald' },
  { id: 'hamstrings',   he: 'אחוריים',      en: 'Hamstrings',   parent: 'legs',      color: 'green' },
  { id: 'glutes',       he: 'ישבן',         en: 'Glutes',       parent: 'legs',      color: 'teal' },
  { id: 'adductors',    he: 'מקרבי הירך',   en: 'Adductors',    parent: 'legs',      color: 'lime' },
  { id: 'abductors',    he: 'מרחיקי הירך',  en: 'Abductors',    parent: 'legs',      color: 'orange' },
  { id: 'calves',       he: 'תאומים',       en: 'Calves',       parent: 'legs',      color: 'stone' },
  { id: 'legs',         he: 'רגליים (כללי)', en: 'Legs (all)',  parent: 'legs',      color: 'emerald', legacy: true },
  // Core
  { id: 'abs',          he: 'בטן',          en: 'Abs',          parent: 'core',      color: 'zinc' },
  { id: 'obliques',     he: 'בטן צדדית',    en: 'Obliques',     parent: 'core',      color: 'gray' },
];

export const ACTIVE_MUSCLES: MuscleInfo[] = MUSCLES.filter(m => !m.legacy);

export const MUSCLE_BY_ID: Record<MuscleGroup, MuscleInfo> =
  MUSCLES.reduce((acc, m) => { acc[m.id] = m; return acc; }, {} as Record<MuscleGroup, MuscleInfo>);

export function musclesByParent(parent: MuscleParent, includeLegacy = false): MuscleInfo[] {
  return MUSCLES.filter(m => m.parent === parent && (includeLegacy || !m.legacy));
}

// Effective muscles for a session: the union of its declared focus + any muscle
// that actually has a logged set. Handles legacy sessions where a set was
// logged for a muscle that never made it into muscleGroups.
export function effectiveMuscles(
  muscleGroups: MuscleGroup[],
  sets: { muscle: MuscleGroup }[],
): MuscleGroup[] {
  const seen = new Set<MuscleGroup>(muscleGroups);
  const out: MuscleGroup[] = [...muscleGroups];
  for (const s of sets) {
    if (!seen.has(s.muscle)) {
      seen.add(s.muscle);
      out.push(s.muscle);
    }
  }
  return out;
}

// Default weekly-set targets — zero by default. User sets them in Settings.
export const DEFAULT_WEEKLY_TARGETS: Record<MuscleGroup, number> = {
  'upper-chest': 0, 'chest': 0, 'lower-chest': 0,
  'lats': 0, 'mid-back': 0, 'traps': 0, 'rear-delts': 0, 'lower-back': 0,
  'front-delts': 0, 'side-delts': 0,
  'biceps': 0, 'triceps': 0, 'forearms': 0,
  'quads': 0, 'hamstrings': 0, 'glutes': 0, 'adductors': 0, 'abductors': 0, 'calves': 0,
  'abs': 0, 'obliques': 0,
  'back': 0, 'legs': 0, 'shoulders': 0,
};

// Tailwind class helpers so purge picks them up statically.
export const MUSCLE_CLASSES: Record<string, { bg: string; text: string; ring: string; bar: string }> = {
  rose:    { bg: 'bg-rose-100 dark:bg-rose-900/50',       text: 'text-rose-700 dark:text-rose-300',       ring: 'ring-rose-500',    bar: 'bg-rose-500' },
  pink:    { bg: 'bg-pink-100 dark:bg-pink-900/50',       text: 'text-pink-700 dark:text-pink-300',       ring: 'ring-pink-500',    bar: 'bg-pink-500' },
  red:     { bg: 'bg-red-100 dark:bg-red-900/50',         text: 'text-red-700 dark:text-red-300',         ring: 'ring-red-500',     bar: 'bg-red-500' },
  blue:    { bg: 'bg-blue-100 dark:bg-blue-900/50',       text: 'text-blue-700 dark:text-blue-300',       ring: 'ring-blue-500',    bar: 'bg-blue-500' },
  sky:     { bg: 'bg-sky-100 dark:bg-sky-900/50',         text: 'text-sky-700 dark:text-sky-300',         ring: 'ring-sky-500',     bar: 'bg-sky-500' },
  indigo:  { bg: 'bg-indigo-100 dark:bg-indigo-900/50',   text: 'text-indigo-700 dark:text-indigo-300',   ring: 'ring-indigo-500',  bar: 'bg-indigo-500' },
  cyan:    { bg: 'bg-cyan-100 dark:bg-cyan-900/50',       text: 'text-cyan-700 dark:text-cyan-300',       ring: 'ring-cyan-500',    bar: 'bg-cyan-500' },
  slate:   { bg: 'bg-slate-200 dark:bg-slate-700/60',     text: 'text-slate-700 dark:text-slate-300',     ring: 'ring-slate-500',   bar: 'bg-slate-500' },
  amber:   { bg: 'bg-amber-100 dark:bg-amber-900/50',     text: 'text-amber-700 dark:text-amber-300',     ring: 'ring-amber-500',   bar: 'bg-amber-500' },
  yellow:  { bg: 'bg-yellow-100 dark:bg-yellow-900/50',   text: 'text-yellow-700 dark:text-yellow-300',   ring: 'ring-yellow-500',  bar: 'bg-yellow-500' },
  orange:  { bg: 'bg-orange-100 dark:bg-orange-900/50',   text: 'text-orange-700 dark:text-orange-300',   ring: 'ring-orange-500',  bar: 'bg-orange-500' },
  violet:  { bg: 'bg-violet-100 dark:bg-violet-900/50',   text: 'text-violet-700 dark:text-violet-300',   ring: 'ring-violet-500',  bar: 'bg-violet-500' },
  fuchsia: { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/50', text: 'text-fuchsia-700 dark:text-fuchsia-300', ring: 'ring-fuchsia-500', bar: 'bg-fuchsia-500' },
  purple:  { bg: 'bg-purple-100 dark:bg-purple-900/50',   text: 'text-purple-700 dark:text-purple-300',   ring: 'ring-purple-500',  bar: 'bg-purple-500' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-500', bar: 'bg-emerald-500' },
  green:   { bg: 'bg-green-100 dark:bg-green-900/50',     text: 'text-green-700 dark:text-green-300',     ring: 'ring-green-500',   bar: 'bg-green-500' },
  teal:    { bg: 'bg-teal-100 dark:bg-teal-900/50',       text: 'text-teal-700 dark:text-teal-300',       ring: 'ring-teal-500',    bar: 'bg-teal-500' },
  lime:    { bg: 'bg-lime-100 dark:bg-lime-900/50',       text: 'text-lime-700 dark:text-lime-300',       ring: 'ring-lime-500',    bar: 'bg-lime-500' },
  stone:   { bg: 'bg-stone-200 dark:bg-stone-700/60',     text: 'text-stone-700 dark:text-stone-300',     ring: 'ring-stone-500',   bar: 'bg-stone-500' },
  zinc:    { bg: 'bg-zinc-200 dark:bg-zinc-700/60',       text: 'text-zinc-700 dark:text-zinc-300',       ring: 'ring-zinc-500',    bar: 'bg-zinc-500' },
  gray:    { bg: 'bg-gray-200 dark:bg-gray-700/60',       text: 'text-gray-700 dark:text-gray-300',       ring: 'ring-gray-500',    bar: 'bg-gray-500' },
};
