import { useEffect, useMemo, useRef, useState } from 'react';
import type { MealFlags, MealIngredient, MealMacros, MealType, PersonalMeal } from '../types';
import type { MealDraft } from './AiChatPanel';
import { useFirestore } from '../hooks/useFirestore';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { compressImage } from '../hooks/usePhotos';
import { MEAL_TYPES, daysAgoLabel, mealTypeForNow, pickMeals } from '../data/diet';

// The MANUAL path: pick from your library, or type a name and a number.
// Fast, offline, no waiting. The conversational path is the AI button in the
// top bar — a real chat that happens to hand you meal cards. Keeping the two
// apart is deliberate: mixing a picker into a conversation makes both worse.

type Draft = {
  mealId: string | null;
  he: string;
  type: MealType;
  caloriesPerServing: number;
  ingredients?: MealIngredient[];
  macros?: MealMacros;
  flags?: MealFlags;
  photoBase64?: string;
};

type Props = {
  uid: string;
  /** Pre-filled draft — set when the user taps "ערוך" on a chat meal card. */
  initialDraft?: MealDraft | null;
  onClose: () => void;
  onSaved: () => void;
  /** Hand off to the conversational path. */
  onOpenChat: () => void;
};

const SERVING_STEPS = [0.5, 1, 1.5, 2];

export function LogMealModal({ uid, initialDraft, onClose, onSaved, onOpenChat }: Props) {
  useBodyScrollLock();
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  // Only used to bias the picker toward the current slot and to seed a new
  // draft — the user picks the actual meal type in the specifics step.
  const mealType: MealType = initialDraft?.mealType || mealTypeForNow();
  const [meals, setMeals] = useState<PersonalMeal[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(
    initialDraft
      ? {
          mealId: initialDraft.mealId ?? null,
          he: initialDraft.he,
          type: initialDraft.mealType,
          caloriesPerServing: initialDraft.calories,
          ingredients: initialDraft.ingredients,
          macros: initialDraft.macros,
          flags: initialDraft.flags,
        }
      : null,
  );
  const [servings, setServings] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    firestoreRef.current.listPersonalMeals()
      .then(list => { if (!cancelled) setMeals(list); })
      .catch(() => { /* empty library is the expected first state */ });
    return () => { cancelled = true; };
  }, [uid]);

  const ranked = useMemo(() => pickMeals(meals, { query, type: mealType }), [meals, query, mealType]);

  function pickTemplate(m: PersonalMeal) {
    setDraft({
      mealId: m.id,
      he: m.he,
      // Templates no longer carry a slot; default to the current clock slot.
      type: m.type || mealType,
      caloriesPerServing: m.calories,
      ingredients: m.ingredients,
      macros: m.macros,
      flags: m.flags,
      photoBase64: m.photoBase64,
    });
    setServings(1);
  }

  function startManual() {
    setDraft({ mealId: null, he: query.trim(), type: mealType, caloriesPerServing: 0 });
    setServings(1);
  }

  async function save() {
    if (!draft || saving) return;
    if (!draft.he.trim() || draft.caloriesPerServing <= 0) return;
    setSaving(true);
    try {
      await firestoreRef.current.logMeal({
        mealId: draft.mealId,
        he: draft.he.trim(),
        mealType: draft.type,
        caloriesPerServing: draft.caloriesPerServing,
        servings,
        ingredients: draft.ingredients,
        macros: draft.macros,
        flags: draft.flags,
        photoBase64: draft.photoBase64,
      });
      // Saving an edited chat card still settles that card, so reopening the
      // conversation shows it as added rather than offering it again.
      if (initialDraft?.actionRef) {
        try {
          await firestoreRef.current.markActionApplied(initialDraft.actionRef.threadId, initialDraft.actionRef.key);
        } catch { /* the log is what matters */ }
      }
      onSaved();
      onClose();
    } catch (e) {
      console.warn('logMeal failed', e);
      setError('השמירה נכשלה — נסה שוב');
      setSaving(false);
    }
  }

  const total = Math.round(draft ? draft.caloriesPerServing * servings : 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-solid">
      <div className="flex items-center justify-between p-4 border-b border-subtle" dir="rtl">
        <h2 className="font-bold text-lg">{draft ? 'אישור ארוחה' : 'ארוחה חדשה'}</h2>
        <button onClick={onClose} aria-label="סגור" className="text-muted text-2xl leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" dir="rtl">
        {draft ? (
          /* ─── Confirm ───────────────────────────────────────── */
          <div className="card space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => photoRef.current?.click()}
                className="w-14 h-14 rounded-xl bg-subtle flex items-center justify-center shrink-0 overflow-hidden"
              >
                {draft.photoBase64
                  ? <img src={draft.photoBase64} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[10px] text-muted">+ תמונה</span>}
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (f) { try { setDraft({ ...draft, photoBase64: await compressImage(f, 640, 0.72) }); } catch { /* ignore */ } }
                  e.currentTarget.value = '';
                }}
              />
              <input
                value={draft.he}
                onChange={e => setDraft({ ...draft, he: e.target.value })}
                placeholder="שם הארוחה"
                className="flex-1 bg-transparent border-b border-subtle pb-1 font-bold text-[15px] focus:outline-none focus:border-amber-500"
              />
            </div>

            {draft.ingredients && draft.ingredients.length > 0 && (
              <div className="space-y-1">
                {draft.ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px]">
                    <input
                      value={ing.he}
                      onChange={e => {
                        const next = [...draft.ingredients!];
                        next[i] = { ...next[i], he: e.target.value };
                        setDraft({ ...draft, ingredients: next });
                      }}
                      className="flex-1 bg-transparent focus:outline-none"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      value={ing.calories}
                      onChange={e => {
                        const next = [...draft.ingredients!];
                        next[i] = { ...next[i], calories: Math.max(0, Number(e.target.value) || 0) };
                        // Keep the headline honest: it is the sum of its parts.
                        setDraft({ ...draft, ingredients: next, caloriesPerServing: next.reduce((a, x) => a + x.calories, 0) });
                      }}
                      className="w-16 text-left bg-transparent font-mono focus:outline-none"
                      dir="ltr"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted">קלוריות למנה</span>
              <input
                type="number"
                inputMode="numeric"
                value={draft.caloriesPerServing || ''}
                onChange={e => setDraft({ ...draft, caloriesPerServing: Math.max(0, Number(e.target.value) || 0), ingredients: undefined })}
                placeholder="0"
                className="input-field flex-1 py-2 text-base"
              />
            </div>

            {/* Which slot it counts as. Belongs HERE, with the rest of the
                specifics — asking before you've picked a meal is asking about
                nothing. Defaults from the clock, or from the template. */}
            <div>
              <div className="text-[12px] text-muted mb-1.5">איזו ארוחה</div>
              <div className="flex flex-wrap gap-1.5">
                {MEAL_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setDraft({ ...draft, type: t.id })}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                      draft.type === t.id
                        ? 'bg-amber-500 text-white'
                        : 'bg-subtle text-muted'
                    }`}
                  >{t.emoji} {t.he}</button>
                ))}
              </div>
            </div>

            {/* Serving multiplier — what keeps "half a portion" from becoming a
                second DB entry called חצי־something. */}
            <div>
              <div className="text-[12px] text-muted mb-1.5">גודל מנה</div>
              <div className="flex gap-1.5">
                {SERVING_STEPS.map(s => (
                  <button
                    key={s}
                    onClick={() => setServings(s)}
                    className={`flex-1 py-2 rounded-lg text-[13px] font-bold ${
                      servings === s ? 'bg-amber-500 text-white' : 'bg-subtle text-muted'
                    }`}
                  >×{s}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-1.5">
              {([
                { key: 'highSugar' as const, he: '🍬 עתיר סוכר' },
                { key: 'emptyCarbs' as const, he: '🍞 פחמימות ריקות' },
              ]).map(f => {
                const on = !!draft.flags?.[f.key];
                return (
                  <button
                    key={f.key}
                    onClick={() => setDraft({ ...draft, flags: { ...draft.flags, [f.key]: !on } })}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                      on ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-subtle text-muted'
                    }`}
                  >{f.he}</button>
                );
              })}
            </div>

            {error && <div className="text-[12px] text-red-500">{error}</div>}

            <div className="flex items-center justify-between pt-1">
              {/* Back goes where you actually came from: the picker if you
                  chose from the library, the conversation if the coach sent
                  you here. */}
              <button
                onClick={() => { if (initialDraft) onClose(); else setDraft(null); }}
                className="inline-flex items-center gap-1 text-[13px] font-semibold px-3 py-2 rounded-lg bg-subtle text-muted"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
                {initialDraft ? 'חזור לשיחה' : 'חזור'}
              </button>
              <div className="text-[15px] font-bold">
                <span className="font-mono" dir="ltr">{total}</span> <span className="text-[12px] text-muted">קק״ל</span>
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving || !draft.he.trim() || draft.caloriesPerServing <= 0}
              className="w-full py-3 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-400 disabled:opacity-40 transition-colors"
            >
              {saving ? 'שומר…' : 'הוסף להיום'}
            </button>
            {!draft.mealId && (
              <div className="text-[11px] text-muted text-center">ארוחה חדשה — תישמר גם למאגר שלך</div>
            )}
          </div>
        ) : (
          /* ─── Pick ──────────────────────────────────────────── */
          <>
            {/* The other path. Not a mode switch inside this screen — it opens
                the coach, which is a full conversation in its own right. */}
            <button
              onClick={() => { onClose(); onOpenChat(); }}
              className="w-full card flex items-center gap-3 py-3 text-right hover:bg-subtle transition-colors"
            >
              <span className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z" /></svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-[13px]">ספר למאמן מה אכלת</span>
                <span className="block text-[11px] text-muted">שיחה חופשית — הוא יפרק לקלוריות</span>
              </span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-[11px] text-muted">או בחר מהמאגר</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>

            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="חיפוש או שם חדש…"
              className="w-full bg-subtle rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            />

            {ranked.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <div className="text-[13px] text-muted">
                  {meals.length === 0 ? 'המאגר שלך ריק — כל ארוחה שתוסיף תישמר כאן' : 'אין התאמה'}
                </div>
                {query.trim() && (
                  <button onClick={startManual} className="text-[13px] font-semibold text-amber-600 dark:text-amber-400">
                    + הוסף «{query.trim()}» ידנית
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {ranked.slice(0, 60).map(m => (
                  <button
                    key={m.id}
                    onClick={() => pickTemplate(m)}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-subtle hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-right"
                  >
                    {m.photoBase64
                      ? <img src={m.photoBase64} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      : <span className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 text-sm">
                          {MEAL_TYPES.find(t => t.id === m.type)?.emoji || '🍽'}
                        </span>}
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        {m.isAnchor && <span className="text-amber-500 text-[11px]">★</span>}
                        <span className="font-semibold text-[13px] truncate">{m.he}</span>
                      </span>
                      <span className="block text-[10px] text-muted">{daysAgoLabel(m.lastUsedAt)}</span>
                    </span>
                    <span className="text-[12px] font-mono text-muted shrink-0" dir="ltr">{m.calories}</span>
                  </button>
                ))}
                {query.trim() && (
                  <button onClick={startManual} className="w-full py-2.5 text-[12px] text-muted">
                    + הוסף «{query.trim()}» ידנית
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
