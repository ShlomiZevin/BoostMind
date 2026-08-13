import { useEffect, useMemo, useRef, useState } from 'react';
import type { MuscleGroup } from '../data/muscles';
import { MUSCLE_BY_ID, MUSCLE_CLASSES, PARENT_INFO, musclesByParent } from '../data/muscles';
import { ExerciseInline } from './FreeSession';
import type { MuscleParent } from '../data/muscles';
import type { FreeSet } from '../types';
import {
  exerciseIdOf,
  findPersonalByName,
  pickPersonal,
  type PersonalExercise,
} from '../data/exercisesDB';
import { prepareMedia, exercisePhotoKey } from '../hooks/usePhotos';
import { useFirestore } from '../hooks/useFirestore';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

type Props = {
  uid: string;
  sessionMuscles: MuscleGroup[];
  defaultMuscle?: MuscleGroup;
  allPastSets: FreeSet[];
  editingSet?: FreeSet;
  duplicateFrom?: FreeSet;
  // Which save buttons to show at the bottom.
  //   'set'      → one "שמור סט" (default)
  //   'exercise' → one "שמור תרגיל" (pick-only, no weight/reps required)
  //   'dual'     → BOTH — used when the modal is opened via a muscle-group tile so the user can go either way
  saveMode?: 'set' | 'exercise' | 'dual';
  // When set, the modal renders in "replace this exercise" mode — swaps the header
  // and CTA to make it obvious we're substituting, not just adding.
  replacingName?: string;
  // Current session id — used to attach per-session difficulty ratings and to load
  // notes/difficulty for the currently-selected exercise inline.
  sessionId?: string;
  onClose: () => void;
  onSave: (set: Omit<FreeSet, 'id' | 'timestamp'>, editingSetId?: string) => void;
  // Called when saving as exercise-only (no weight/reps). Fires from 'exercise' or 'dual' modes.
  onPickOnly?: (name: string, muscle: MuscleGroup, en?: string, isHoldTime?: boolean) => void;
};

function isVideoUrl(src: string): boolean {
  return src.startsWith('data:video/') || /\.(mp4|webm|mov)$/i.test(src);
}

function Thumb({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  if (src) {
    if (isVideoUrl(src)) return <video src={src} className={className} muted playsInline autoPlay loop />;
    return <img src={src} alt={alt} className={className} />;
  }
  return <div className={`${className} dark:bg-slate-800 bg-slate-100 flex items-center justify-center text-muted-most text-xs`}>—</div>;
}

function weeksAgoLabel(ts: number): string {
  const days = (Date.now() - ts) / (24 * 60 * 60 * 1000);
  if (days < 7) return 'השבוע';
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'לפני שבוע';
  if (weeks < 4) return `לפני ${weeks} שבועות`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'לפני חודש';
  return `לפני ${months} חודשים`;
}

export function LogSetModal({
  uid, sessionMuscles, defaultMuscle, allPastSets, editingSet, duplicateFrom,
  saveMode = 'set',
  replacingName,
  sessionId,
  onClose, onSave, onPickOnly,
}: Props) {
  const showSet = saveMode === 'set' || saveMode === 'dual';
  const showExercise = saveMode === 'exercise' || saveMode === 'dual';
  useBodyScrollLock();
  const firestore = useFirestore(uid);
  const isEdit = !!editingSet;
  const seed = editingSet || duplicateFrom;

  const [personalExercises, setPersonalExercises] = useState<PersonalExercise[]>([]);
  const [photosMap, setPhotosMap] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    Promise.all([
      firestore.listPersonalExercises(),
      firestore.getAllExercisePhotos(),
      isAdmin ? firestore.listDefaultPhotoKeys() : Promise.resolve(new Set<string>()),
    ]).then(([exs, photos, defs]) => {
      setPersonalExercises(exs);
      setPhotosMap(photos);
      setDefaultKeys(defs);
    });
  }, [uid]);

  const [muscle, setMuscle] = useState<MuscleGroup | null>(
    seed?.muscle || defaultMuscle || null,
  );
  const [selectedExercise, setSelectedExercise] = useState<PersonalExercise | null>(null);
  const [customName, setCustomName] = useState<string>(seed?.exerciseName || '');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(!seed?.exerciseName);
  const [weight, setWeight] = useState(seed && seed.weight > 0 ? String(seed.weight) : '0');
  const [reps, setReps] = useState(seed && seed.reps > 0 ? String(seed.reps) : '12');
  const [unit, setUnit] = useState(seed?.unit || 'kg');
  const [showAddMuscle, setShowAddMuscle] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [holdRunning, setHoldRunning] = useState(false);
  const [holdStartMs, setHoldStartMs] = useState(0);
  const [holdElapsedTick, setHoldElapsedTick] = useState(0);
  const [defaultKeys, setDefaultKeys] = useState<Set<string>>(new Set());
  const isAdmin = uid === 'user_6724';

  useEffect(() => {
    if (!holdRunning) return;
    const id = setInterval(() => setHoldElapsedTick(t => t + 1), 50);
    return () => clearInterval(id);
  }, [holdRunning]);

  function startHoldTimer() {
    setHoldStartMs(Date.now());
    setHoldRunning(true);
  }
  function stopHoldTimer() {
    if (!holdRunning) return;
    const secs = Math.max(1, Math.round((Date.now() - holdStartMs) / 1000));
    setReps(String(secs));
    setHoldRunning(false);
  }
  const holdElapsedMs = holdRunning ? (Date.now() - holdStartMs) : 0;
  const holdElapsedSec = Math.floor(holdElapsedMs / 1000);
  const holdElapsedCs = Math.floor((holdElapsedMs % 1000) / 10);
  void holdElapsedTick;

  // Resolve seed to a PersonalExercise if possible
  useEffect(() => {
    if (!seed?.exerciseName) return;
    const match = findPersonalByName(personalExercises, seed.exerciseName);
    if (match) {
      setSelectedExercise(match);
      setCustomName('');
    }
  }, [seed?.exerciseName, personalExercises]);

  const currentName = selectedExercise ? selectedExercise.he : customName;
  const photoFor = (name: string | undefined | null): string | null => {
    if (!name) return null;
    const k = exercisePhotoKey(name);
    return k ? (photosMap[k] || null) : null;
  };

  // Build a map keyed by lowercase exercise NAME (not slug) so lookups stay consistent
  // with our name-based matching elsewhere (e.g. referenceRange).
  const historyMap = useMemo(() => {
    const map = new Map<string, { lastTs: number; minW: number; maxW: number; unit: string; count: number }>();
    for (const s of allPastSets) {
      if (!s.exerciseName) continue;
      const key = s.exerciseName.trim().toLowerCase();
      const prev = map.get(key);
      const w = s.weight;
      if (!prev) {
        map.set(key, {
          lastTs: s.timestamp,
          minW: w > 0 ? w : Infinity,
          maxW: w > 0 ? w : -Infinity,
          unit: s.unit || 'kg',
          count: 1,
        });
      } else {
        prev.lastTs = Math.max(prev.lastTs, s.timestamp);
        if (w > 0) {
          prev.minW = Math.min(prev.minW, w);
          prev.maxW = Math.max(prev.maxW, w);
        }
        prev.count += 1;
      }
    }
    return map;
  }, [allPastSets]);

  function historyForExercise(ex?: PersonalExercise | null, customText?: string) {
    const name = ex?.he ?? customText ?? '';
    const key = name.trim().toLowerCase();
    if (!key) return null;
    return historyMap.get(key) || null;
  }

  function formatRange(h: { minW: number; maxW: number; unit: string }): string | null {
    if (h.minW === Infinity || h.maxW === -Infinity) return null;
    if (h.minW === h.maxW) return `${h.minW}${h.unit}`;
    return `${h.minW}–${h.maxW}${h.unit}`;
  }

  // Personal DB listing for the picker — scoped by muscle chip or session focus.
  // pickPersonal expects id→ts, but historyMap is name-keyed for consistency, so translate here.
  const historyIdMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ex of personalExercises) {
      const h = historyMap.get(ex.he.trim().toLowerCase());
      if (h) m[ex.id] = h.lastTs;
    }
    return m;
  }, [historyMap, personalExercises]);

  const pickerList = useMemo(() => {
    return pickPersonal(personalExercises, {
      query: exerciseSearch,
      muscle: muscle ?? null,
      scope: sessionMuscles,
      historyMap: historyIdMap,
    });
  }, [personalExercises, exerciseSearch, muscle, sessionMuscles, historyIdMap]);

  // Most-recent real set for the CURRENT exercise (across all history) — used both to prefill
  // weight/reps and to render an explicit "פעם קודמת" line so the user sees the source.
  const lastSetForExercise = useMemo(() => {
    if (!currentName) return null;
    const target = currentName.trim().toLowerCase();
    return [...allPastSets]
      .filter(s => s.exerciseName?.trim().toLowerCase() === target && (s.weight > 0 || s.reps > 0))
      .sort((a, b) => b.timestamp - a.timestamp)[0] || null;
  }, [currentName, allPastSets]);

  // Prefill weight/reps. Simpler contract per user request:
  //   1. If we have history for THIS exercise → use last set's reps + weight
  //   2. Otherwise → 12 × 0kg (neutral default). No cross-muscle heuristic —
  //      that used to leak unrelated reps counts and confused new sets.
  useEffect(() => {
    if (seed) return;
    if (lastSetForExercise) {
      setWeight(String(lastSetForExercise.weight));
      setReps(String(lastSetForExercise.reps));
      if (lastSetForExercise.unit) setUnit(lastSetForExercise.unit);
      return;
    }
    setReps('12');
    setWeight('0');
  }, [muscle, currentName, lastSetForExercise]); // eslint-disable-line react-hooks/exhaustive-deps

  // Last time (ms) the CURRENT muscle was hit with a real set — for the "worked recently" warning.
  const muscleLastTrainedMs = useMemo(() => {
    if (!muscle) return null;
    let latest = 0;
    for (const s of allPastSets) {
      if (s.muscle !== muscle) continue;
      if (s.weight === 0 && s.reps === 0) continue;
      if (s.timestamp > latest) latest = s.timestamp;
    }
    return latest > 0 ? latest : null;
  }, [muscle, allPastSets]);
  const muscleWorkedRecentlyLabel = useMemo(() => {
    if (!muscleLastTrainedMs) return null;
    // Calendar-day diff, not raw hours — otherwise a 26-hour gap that straddles
    // midnight ('היום' → 'אתמול') was being read as 'אתמול' when it should be
    // 'שלשום', or a 50-hour gap as 'over 2 days' — off by one day for the user.
    const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const daysAgo = Math.round((startOfDay(Date.now()) - startOfDay(muscleLastTrainedMs)) / 86_400_000);
    if (daysAgo <= 0) return 'היום';
    if (daysAgo === 1) return 'אתמול';
    if (daysAgo === 2) return 'שלשום';
    if (daysAgo <= 3) return `לפני ${daysAgo} ימים`;
    return null;
  }, [muscleLastTrainedMs]);

  // Per-exercise range for the last 30 days — includes bodyweight (0kg) sets too
  const referenceRange = useMemo(() => {
    if (!currentName) return null;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const target = currentName.trim().toLowerCase();
    const recent = allPastSets.filter(s =>
      s.timestamp >= cutoff &&
      s.exerciseName &&
      s.exerciseName.trim().toLowerCase() === target
    );
    if (recent.length === 0) return null;
    const weights = recent.map(s => s.weight);
    return { min: Math.min(...weights), max: Math.max(...weights), count: recent.length };
  }, [currentName, allPastSets]);

  function formatReferenceRange(r: { min: number; max: number }, u: string): string {
    if (r.min === r.max) return `${r.min}${u}`;
    return `${r.min}–${r.max}${u}`;
  }

  function pickExisting(ex: PersonalExercise) {
    setSelectedExercise(ex);
    setCustomName('');
    setExerciseSearch('');
    setPickerOpen(false);
    if (ex.defaultMuscle !== muscle) setMuscle(ex.defaultMuscle);
  }

  function pickCustom(name: string) {
    setCustomName(name);
    setSelectedExercise(null);
    setExerciseSearch('');
    setPickerOpen(false);
  }

  function clearExercise() {
    setSelectedExercise(null);
    setCustomName('');
    setPickerOpen(true);
  }

  function doSave(asPlaceholder: boolean) {
    if (!muscle) return;
    const w = Number(weight) || 0;
    const r = Number(reps) || 0;
    onSave({
      muscle,
      weight: asPlaceholder ? 0 : w,
      reps: asPlaceholder ? 0 : r,
      unit: unit === 'kg' ? undefined : unit,
      exerciseName: currentName.trim() || undefined,
    }, editingSet?.id);
  }

  const hasValues = !!muscle && weight !== '' && reps !== '';
  const hasContext = !!muscle;

  const currentMuscle = muscle ? MUSCLE_BY_ID[muscle] : null;
  const currentClasses = currentMuscle ? MUSCLE_CLASSES[currentMuscle.color] : null;
  const chipMuscles = Array.from(new Set(muscle ? [...sessionMuscles, muscle] : sessionMuscles));
  const isNewMuscleForSession = !!muscle && !sessionMuscles.includes(muscle);
  const currentHistory = historyForExercise(selectedExercise, customName);
  const canAddPhoto = !!currentHistory; // only exercises with logged history

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-solid">
      <div className="flex items-center justify-between p-4 border-b border-subtle" dir="rtl">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-lg truncate">
            {replacingName ? 'החלף תרגיל' : isEdit ? 'עריכת סט' : 'סט חדש'}
          </h2>
          {replacingName && (
            <div className="text-[11px] text-muted truncate">
              במקום <span className="font-semibold text-main">{replacingName}</span>
            </div>
          )}
        </div>
        <button onClick={onClose} aria-label="סגור" className="text-muted text-2xl leading-none shrink-0">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Muscle chip picker */}
        <div>
          <div className="flex items-center justify-between mb-1.5" dir="rtl">
            {isNewMuscleForSession && (
              <span className="text-[10px] text-amber-500">+ יצטרף לפוקוס</span>
            )}
            <div className="text-[11px] font-medium dark:text-slate-300 text-slate-700">
              {muscle ? 'שריר (לחץ להסרה)' : 'שריר — כל תרגילי הפוקוס'}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-start" dir="rtl">
            {chipMuscles.map(id => {
              const m = MUSCLE_BY_ID[id];
              if (!m) return null;
              const c = MUSCLE_CLASSES[m.color];
              const active = id === muscle;
              return (
                <button
                  key={id}
                  onClick={() => {
                    if (active) { setMuscle(null); clearExercise(); }
                    else { setMuscle(id); clearExercise(); }
                  }}
                  className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    active ? `${c.bg} ${c.text} ring-2 ${c.ring}` : 'dark:bg-slate-800 bg-slate-100 text-muted'
                  }`}
                >
                  {m.he}
                </button>
              );
            })}
            <button
              onClick={() => setShowAddMuscle(v => !v)}
              className="text-sm px-3 py-1.5 rounded-lg dark:bg-slate-800 bg-slate-100 text-muted"
            >
              + אחר
            </button>
          </div>
          {showAddMuscle && (
            <div className="mt-2 space-y-3" dir="rtl">
              {/* Grouped by parent (חזה / גב / etc.) so scanning is quick — sub-muscles
                  live under their group header instead of one big undifferentiated grid. */}
              {(['chest','back','shoulders','arms','legs','core'] as MuscleParent[]).map(parent => {
                const info = PARENT_INFO[parent];
                const rows = musclesByParent(parent).filter(m => !chipMuscles.includes(m.id));
                if (rows.length === 0) return null;
                const parentCls = MUSCLE_CLASSES[info.color];
                return (
                  <div key={parent}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-1.5 h-3 rounded-full ${parentCls?.bar || 'bg-slate-400'}`} />
                      <span className={`text-[10px] uppercase tracking-widest font-bold ${parentCls?.text || 'text-muted'}`}>{info.he}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {rows.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setMuscle(m.id); setShowAddMuscle(false); clearExercise(); }}
                          className="text-[11px] py-1.5 px-2 rounded dark:bg-slate-800 bg-slate-100 text-muted dark:hover:bg-slate-700 hover:bg-slate-200"
                        >
                          {m.he}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {muscle && muscleWorkedRecentlyLabel && (
            <div
              className="mt-3 flex items-start gap-3 text-[12px] text-amber-800 dark:text-amber-200 dark:bg-amber-950/40 bg-amber-50 border dark:border-amber-500/40 border-amber-300 rounded-xl px-3 py-2.5"
              dir="rtl"
            >
              <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-amber-500 text-white">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <div className="text-right flex-1 min-w-0">
                <div className="font-semibold">אימנת את השריר הזה {muscleWorkedRecentlyLabel}</div>
                <div className="text-[11px] opacity-80 mt-0.5">שקול לתת לו יום מנוחה</div>
              </div>
            </div>
          )}
        </div>

        {/* Selected-exercise panel — ONE consistent layout for every exercise */}
        {!pickerOpen && currentName && (() => {
          const photo = photoFor(currentName);
          const hasAnyHistory = !!currentHistory;
          return (
            <div className="card !p-3 border-2 border-emerald-400 dark:border-emerald-500 dark:!bg-emerald-950/25 !bg-emerald-50 shadow-md">
              {/* Row 1: photo slot + name + החלף — always same shape */}
              <div className="flex flex-row-reverse items-start gap-3" dir="rtl">
                {/* Photo slot: thumbnail if exists, else "+ media" placeholder */}
                {photo ? (
                  <button
                    onClick={() => setImageOpen(true)}
                    aria-label="הצג תמונה"
                    className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-transparent border-0 p-0"
                  >
                    <Thumb src={photo} alt={currentName} className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    aria-label="הוסף תמונה או וידאו"
                    className="w-20 h-20 rounded-lg shrink-0 border-2 border-dashed dark:border-emerald-600/40 border-emerald-500/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </button>
                )}
                <div className="flex-1 text-right min-w-0">
                  <div className="text-[10px] text-muted mb-0.5">תרגיל</div>
                  <div className="text-sm font-semibold leading-tight">{currentName}</div>
                  {selectedExercise?.en && (
                    <div className="text-[11px] text-muted mt-0.5" dir="ltr" style={{ direction: 'ltr' }}>{selectedExercise.en}</div>
                  )}
                </div>
                <button onClick={() => setPickerOpen(true)} className="text-[11px] text-blue-500 dark:text-blue-400 shrink-0">
                  החלף
                </button>
              </div>

              {/* Row 2: history block — hide when we're only saving an exercise (no set stats matter) */}
              {saveMode !== 'exercise' && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20 text-right" dir="rtl">
                  {hasAnyHistory ? (
                    <div className="space-y-1">
                      {lastSetForExercise && (
                        <div className="flex items-baseline gap-1.5 text-[11px]" dir="rtl">
                          <span className="text-muted-most text-[10px]">פעם קודמת:</span>
                          <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300" dir="ltr">
                            {lastSetForExercise.weight}{lastSetForExercise.unit || 'kg'} × {lastSetForExercise.reps}
                          </span>
                          <span className="text-[10px] text-muted-most">· {weeksAgoLabel(lastSetForExercise.timestamp)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap text-[11px]" dir="rtl">
                        {referenceRange && (
                          <span className="font-mono text-main">
                            <span className="text-muted-most text-[10px]">טווח 30י׳</span>{' '}
                            <span dir="ltr" className="font-bold inline-block">{formatReferenceRange(referenceRange, unit)}</span>
                          </span>
                        )}
                        {referenceRange && <span className="text-muted-most">·</span>}
                        <span className="text-muted">{currentHistory!.count} סטים בעבר</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-most">
                      תרגיל חדש · אין עדיין נתונים היסטוריים
                    </div>
                  )}
                </div>
              )}

              {/* Row 3: media actions + Google search — ALWAYS shown so every exercise behaves the same */}
              <div className="flex items-center gap-3 justify-end mt-3 pt-3 border-t border-emerald-500/20 text-[11px]" dir="rtl">
                {isAdmin && photo && (() => {
                  const key = exercisePhotoKey(currentName);
                  const isDefault = defaultKeys.has(key);
                  return (
                    <button
                      onClick={async () => {
                        if (isDefault) {
                          await firestore.deleteDefaultExercisePhoto(currentName);
                          setDefaultKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
                        } else {
                          await firestore.setDefaultExercisePhoto(currentName, photo);
                          setDefaultKeys(prev => { const n = new Set(prev); n.add(key); return n; });
                        }
                      }}
                      title={isDefault ? 'התמונה היא ברירת מחדל לכולם — לחץ להסרה' : 'הגדר תמונה זו כברירת מחדל לכל המשתמשים'}
                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                        isDefault
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" width="10" height="10" fill={isDefault ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      <span>default</span>
                    </button>
                  );
                })()}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-blue-500 dark:text-blue-400 disabled:opacity-50"
                >
                  {uploading ? '...טוען' : (photo ? 'החלף תמונה/וידאו' : '+ תמונה/וידאו')}
                </button>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(((selectedExercise?.en || currentName) as string) + ' exercise')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="חפש בגוגל"
                  title="חיפוש בגוגל"
                  className="mr-auto inline-flex items-center gap-1 text-muted hover:text-main"
                  onClick={e => e.stopPropagation()}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                  <span>חפש בגוגל</span>
                </a>
              </div>
            </div>
          );
        })()}

        {/* Picker — personal DB */}
        {pickerOpen && (
          <div>
            <div className="text-[10px] text-muted mb-1.5 text-right" dir="rtl">
              {muscle ? `בחר תרגיל ל${currentMuscle?.he}` : 'בחר תרגיל מהרשימה שלך'}
            </div>
            <input
              type="text"
              value={exerciseSearch}
              onChange={e => setExerciseSearch(e.target.value)}
              placeholder="חפש בעברית או הקלד תרגיל חדש..."
              className="input-field !text-sm !py-2 mb-2"
              dir="rtl"
            />

            {pickerList.length > 0 && (
              <div>
                <div className="text-[10px] text-muted-most mb-1 text-right" dir="rtl">
                  {muscle ? `תרגילים ל${currentMuscle?.he}` : `תרגילי הפוקוס`} ({pickerList.length})
                </div>
                <div className="rounded-xl border border-subtle card !p-0 max-h-72 overflow-y-auto">
                  {pickerList.slice(0, 80).map(ex => {
                    const h = historyForExercise(ex);
                    const range = h ? formatRange(h) : null;
                    const exMuscle = MUSCLE_BY_ID[ex.defaultMuscle];
                    const emc = exMuscle ? MUSCLE_CLASSES[exMuscle.color] : null;
                    const photo = photoFor(ex.he) || ex.photoBase64;
                    return (
                      <button
                        key={ex.id}
                        onClick={() => pickExisting(ex)}
                        className="w-full flex flex-row-reverse items-center gap-2 px-3 py-2 border-b border-subtle/50 last:border-0 dark:hover:bg-slate-800 hover:bg-slate-100"
                      >
                        {photo && (
                          <div className="w-12 h-12 rounded overflow-hidden shrink-0">
                            <Thumb src={photo} alt={ex.he} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="text-right flex-1 min-w-0" dir="rtl">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{ex.he}</span>
                            {h && (
                              <span className="text-[9px] shrink-0 text-emerald-600 dark:text-emerald-400">
                                {weeksAgoLabel(h.lastTs)}
                              </span>
                            )}
                          </div>
                          {ex.en && (
                            <div className="text-[10px] text-muted truncate mt-0.5" dir="ltr" style={{ direction: 'ltr' }}>{ex.en}</div>
                          )}
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            {emc && <span className={`text-[9px] px-1 rounded ${emc.bg} ${emc.text}`}>{exMuscle?.he}</span>}
                            {range && <span className="text-[10px] font-mono text-main shrink-0" dir="ltr">{range}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {pickerList.length === 0 && !exerciseSearch && (
              <div className="text-[11px] text-muted-most text-center py-3" dir="rtl">
                אין עדיין תרגילים {muscle ? `ל${currentMuscle?.he}` : 'בפוקוס'}. הקלד למעלה כדי להוסיף אחד.
              </div>
            )}

            {exerciseSearch.trim() && !pickerList.some(x =>
              x.he.toLowerCase() === exerciseSearch.trim().toLowerCase()
            ) && (
              <button
                onClick={() => pickCustom(exerciseSearch.trim())}
                className="mt-2 w-full text-right p-2 rounded-lg border border-dashed dark:border-slate-700 border-slate-300 text-[11px] text-muted"
                dir="rtl"
              >
                + הוסף כתרגיל חדש: "{exerciseSearch.trim()}"
              </button>
            )}
          </div>
        )}

        {/* Weight + reps (or seconds when hold-time). In RTL grid, first DOM child
            goes to the RIGHT column. Put reps first so reps sit on the right and
            weight on the left — matches the original layout the user is used to. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5 text-right" dir="rtl">
              {selectedExercise?.isHoldTime ? 'שניות' : 'חזרות'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={reps}
              onChange={e => { const v = e.target.value; if (v === '' || /^[0-9]*$/.test(v)) setReps(v); }}
              onFocus={e => e.currentTarget.select()}
              placeholder={selectedExercise?.isHoldTime ? '30' : '12'}
              className="input-field !text-lg !py-3 !text-center"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5 text-right" dir="rtl">משקל ({unit})</label>
            <input
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={e => { const v = e.target.value; if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) setWeight(v); }}
              onFocus={e => e.currentTarget.select()}
              placeholder="0"
              className="input-field !text-lg !py-3 !text-center"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 justify-end text-[10px]" dir="rtl">
          <span className="text-muted">יחידה:</span>
          {['kg', 'lb'].map(u => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`px-2 py-0.5 rounded ${unit === u ? 'bg-blue-500 text-white' : 'dark:bg-slate-800 dark:text-slate-300 bg-slate-200 text-slate-600'}`}
            >{u}</button>
          ))}
        </div>

        {/* Difficulty + notes — inline, on the set page. Same widget the logged card
            uses, so ratings/notes attached here appear on the card later. Only shows
            once an exercise is selected AND we know the current session id. */}
        {sessionId && currentName && (
          <ExerciseInline uid={uid} exerciseName={currentName} sessionId={sessionId} />
        )}

        {/* Hold-time timer — scoreboard-style tool for hold-time exercises */}
        {selectedExercise?.isHoldTime && (
          <div className="mt-4 rounded-2xl overflow-hidden bg-emerald-950 border border-emerald-500/25 shadow-lg" dir="rtl">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-right">
                <div className="text-[9px] text-emerald-300/80 uppercase tracking-widest font-semibold flex items-center gap-1">
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2h12" />
                    <path d="M6 22h12" />
                    <path d="M6 2v5a6 6 0 0 0 12 0V2" />
                    <path d="M6 22v-5a6 6 0 0 1 12 0v5" />
                  </svg>
                  <span>סטופר</span>
                </div>
                <div className={`font-scoreboard text-3xl leading-none mt-1 ${holdRunning ? 'text-emerald-300' : 'text-white/60'}`}>
                  {String(Math.floor(holdElapsedSec / 60)).padStart(2, '0')}:{String(holdElapsedSec % 60).padStart(2, '0')}
                  <span className="text-xl opacity-80">.{String(holdElapsedCs).padStart(2, '0')}</span>
                </div>
              </div>
              <button
                onClick={holdRunning ? stopHoldTimer : startHoldTimer}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full font-semibold text-sm transition-colors ${
                  holdRunning
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {holdRunning ? (
                  <>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                    <span>עצור ושמור</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    <span>התחל</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-subtle">
        {saveMode === 'dual' ? (
          <div className="flex gap-2" dir="rtl">
            <button
              onClick={() => {
                if (!muscle || !currentName.trim()) return;
                onPickOnly?.(currentName.trim(), muscle, selectedExercise?.en, selectedExercise?.isHoldTime);
                onClose();
              }}
              disabled={!hasContext || !currentName.trim()}
              className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-colors ${
                hasContext && currentName.trim()
                  ? 'dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-subtle'
                  : 'dark:bg-slate-800/60 dark:text-slate-600 bg-slate-100 text-slate-400'
              }`}
            >שמור תרגיל</button>
            <button
              onClick={() => doSave(false)}
              disabled={!hasValues || !currentName.trim()}
              className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-colors ${
                hasValues && currentName.trim()
                  ? 'btn-primary'
                  : 'dark:bg-slate-800 dark:text-slate-600 bg-slate-200 text-slate-400'
              }`}
            >שמור סט</button>
          </div>
        ) : showExercise ? (
          <button
            onClick={() => {
              if (!muscle || !currentName.trim()) return;
              onPickOnly?.(currentName.trim(), muscle, selectedExercise?.en, selectedExercise?.isHoldTime);
              onClose();
            }}
            disabled={!hasContext || !currentName.trim()}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
              hasContext && currentName.trim() ? 'btn-primary' : 'dark:bg-slate-800 dark:text-slate-600 bg-slate-200 text-slate-400'
            }`}
          >{replacingName ? 'החלף בתרגיל הנבחר' : 'שמור תרגיל'}</button>
        ) : showSet ? (
          <button
            onClick={() => doSave(false)}
            disabled={!hasValues}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
              hasValues ? 'btn-primary' : 'dark:bg-slate-800 dark:text-slate-600 bg-slate-200 text-slate-400'
            }`}
          >
            {isEdit ? 'עדכן סט' : 'שמור סט'}
          </button>
        ) : null}
      </div>

      {imageOpen && photoFor(currentName) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setImageOpen(false)}>
          <Thumb src={photoFor(currentName)} alt={currentName} className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !currentName) return;
          setUploading(true);
          try {
            const { dataUrl } = await prepareMedia(file);
            await firestore.saveExercisePhoto(currentName, dataUrl);
            const k = exercisePhotoKey(currentName);
            setPhotosMap(prev => ({ ...prev, [k]: dataUrl }));
          } catch (err: any) {
            alert(err?.message || 'שגיאה בהעלאה');
          } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
      />
    </div>
  );
}
