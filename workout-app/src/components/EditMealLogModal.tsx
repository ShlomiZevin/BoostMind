import { useState } from 'react';
import type { MealIngredient, MealLog, MealType } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { MEAL_TYPES } from '../data/diet';

// Edit one thing you already ate. History is a snapshot, so this touches ONLY
// this entry — the template it came from is left alone.

export function EditMealLogModal({
  uid, log, onClose, onDone,
}: {
  uid: string;
  log: MealLog;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const firestore = useFirestore(uid);
  const [name, setName] = useState(log.name);
  const [calories, setCalories] = useState(String(log.calories));
  const [mealType, setMealType] = useState<MealType>(log.mealType);
  const [when, setWhen] = useState(() => {
    const d = new Date(log.timestamp);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  const [ingredients, setIngredients] = useState<MealIngredient[]>(log.ingredients || []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy || !name.trim()) return;
    setBusy(true);
    // Keep the meal on its original day; only the time-of-day is editable here.
    const base = new Date(log.timestamp);
    const [h, m] = when.split(':').map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) base.setHours(h, m, 0, 0);
    await firestore.updateMealLog(log.id, {
      name: name.trim(),
      calories: Math.max(0, Number(calories) || 0),
      ingredients,
      mealType,
      timestamp: base.getTime(),
    });
    await onDone();
  }

  async function remove() {
    setBusy(true);
    await firestore.deleteMealLog(log.id);
    await onDone();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center dark:bg-black/70 bg-black/40" onClick={onClose}>
      <div
        className="overlay-solid w-full max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border border-subtle p-4 space-y-3 pb-[max(env(safe-area-inset-bottom),1rem)]"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold">עריכת ארוחה</h3>
          <button onClick={onClose} aria-label="סגור" className="text-muted text-2xl leading-none">×</button>
        </div>

        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-transparent border-b border-subtle pb-1 font-bold text-[15px] focus:outline-none focus:border-amber-500"
        />

        {/* The breakdown is part of the record, not just of the proposal — it
            is what makes a logged number checkable a week later. */}
        {(
          <div className="space-y-1 bg-subtle rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted">מה יש בפנים</span>
              {ingredients.length > 0 && (
                <span className="text-[11px] font-bold font-mono" dir="ltr">
                  {ingredients.reduce((a, x) => a + x.calories, 0)}
                </span>
              )}
            </div>
            {ingredients.length === 0 && (
              <div className="text-[11px] text-muted-more py-1">אין פירוט לרישום הזה</div>
            )}
            {ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 text-[13px]">
                <input
                  value={ing.he}
                  onChange={e => {
                    const next = [...ingredients];
                    next[i] = { ...next[i], he: e.target.value };
                    setIngredients(next);
                  }}
                  className="flex-1 bg-transparent focus:outline-none"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={ing.calories}
                  onChange={e => {
                    const next = [...ingredients];
                    next[i] = { ...next[i], calories: Math.max(0, Number(e.target.value) || 0) };
                    setIngredients(next);
                    setCalories(String(next.reduce((a, x) => a + x.calories, 0)));
                  }}
                  className="w-16 text-left bg-transparent font-mono focus:outline-none"
                  dir="ltr"
                />
                <button
                  onClick={() => {
                    const next = ingredients.filter((_, k) => k !== i);
                    setIngredients(next);
                    if (next.length > 0) setCalories(String(next.reduce((a, x) => a + x.calories, 0)));
                  }}
                  aria-label="הסר מרכיב"
                  className="text-muted-more hover:text-red-500 shrink-0"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              onClick={() => setIngredients(prev => [...prev, { he: '', calories: 0 }])}
              className="text-[12px] font-semibold text-amber-600 dark:text-amber-400 pt-0.5"
            >+ הוסף מרכיב</button>
          </div>
        )}

        <div>
          <div className="text-[12px] text-muted mb-1.5">איזו ארוחה</div>
          <div className="flex flex-wrap gap-1.5">
            {MEAL_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setMealType(t.id)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${
                  mealType === t.id ? 'bg-amber-500 text-white' : 'bg-subtle text-muted'
                }`}
              >{t.emoji} {t.he}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted shrink-0">קלוריות</span>
          <input
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={e => setCalories(e.target.value)}
            className="input-field flex-1 py-2 text-base"
          />
          <span className="text-[12px] text-muted shrink-0">שעה</span>
          <input
            type="time"
            value={when}
            onChange={e => setWhen(e.target.value)}
            className="input-field w-28 py-2 text-base"
          />
        </div>

        <div className="flex gap-2 pt-1">
          {confirmDelete ? (
            <>
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 py-2.5">ביטול</button>
              <button onClick={() => void remove()} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold">
                מחק
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(true)} className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 font-semibold text-[13px]">
                מחק
              </button>
              <button onClick={() => void save()} disabled={busy || !name.trim()} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-bold disabled:opacity-40">
                {busy ? 'שומר…' : 'שמור'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
