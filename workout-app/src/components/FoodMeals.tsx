import { useEffect, useMemo, useRef, useState } from 'react';
import type { PersonalMeal, Route } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { compressImage } from '../hooks/usePhotos';
import { TopBar } from './TopBar';
import { FoodAiAction, SettingsGearAction } from './TopBarActions';
import { daysAgoLabel, pickMeals } from '../data/diet';

type Props = { uid: string; navigate: (r: Route) => void; refreshKey?: number; onOpenChat: () => void };

export function FoodMeals({ uid, navigate, refreshKey, onOpenChat }: Props) {
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  const [meals, setMeals] = useState<PersonalMeal[]>([]);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<PersonalMeal | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function reload() {
    const list = await firestoreRef.current.listPersonalMeals();
    setMeals(list);
    setLoaded(true);
  }

  useEffect(() => {
    let cancelled = false;
    firestoreRef.current.listPersonalMeals()
      .then(l => { if (!cancelled) { setMeals(l); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [uid, refreshKey]);

  const ranked = useMemo(() => pickMeals(meals, { query }), [meals, query]);

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="מאכלים"
        subtitle={meals.length > 0 ? `${meals.length} ארוחות במאגר` : undefined}
        accent="brand"
        tint="amber"
        actions={<><FoodAiAction onClick={onOpenChat} /><SettingsGearAction navigate={navigate} /></>}
      />
      <div className="max-w-lg mx-auto p-4 space-y-3" dir="rtl">
        {meals.length > 0 && (
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="חיפוש…"
            className="w-full bg-subtle rounded-xl px-3 py-2.5 text-sm focus:outline-none"
          />
        )}

        {!loaded ? (
          <div className="text-[12px] text-muted py-8 text-center">טוען…</div>
        ) : ranked.length === 0 ? (
          <div className="card text-center py-10 space-y-1">
            <div className="text-[13px] text-muted">
              {meals.length === 0 ? 'המאגר ריק' : 'אין התאמה'}
            </div>
            {meals.length === 0 && (
              <div className="text-[11px] text-muted-more">
                כל ארוחה חדשה שתרשום נשמרת לכאן אוטומטית
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {ranked.map(m => {
              const isOpen = expanded.has(m.id);
              return (
              <div key={m.id} className="card py-0 overflow-hidden">
              <div className="flex items-center gap-3 py-2.5">
              <button
                onClick={() => setExpanded(prev => {
                  const next = new Set(prev);
                  if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
                  return next;
                })}
                className="flex-1 flex items-center gap-3 text-right min-w-0"
              >
                {m.photoBase64
                  ? <img src={m.photoBase64} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  : <span className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 text-[15px]">🍽</span>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {m.isAnchor && <span className="text-amber-500 text-[11px]">★</span>}
                    <span className="font-semibold text-[13px] truncate">{m.he}</span>
                  </div>
                  <div className="text-[10px] text-muted flex items-center gap-1.5">
                    <span>{daysAgoLabel(m.lastUsedAt)}</span>
                    {m.flags?.highSugar && <span>🍬</span>}
                    {m.flags?.emptyCarbs && <span>🍞</span>}
                  </div>
                </div>
                <span className="font-mono text-[13px] font-bold shrink-0" dir="ltr">{m.calories}</span>
              </button>
              <button
                onClick={() => setEditing(m)}
                aria-label="ערוך"
                className="shrink-0 p-2 text-muted"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </button>
              </div>
              {/* What is actually in it. A meal is a name plus a breakdown —
                  two dishes can share a name and differ entirely inside. */}
              {isOpen && (
                <div className="border-t border-subtle py-2 space-y-0.5">
                  {(m.ingredients && m.ingredients.length > 0) ? m.ingredients.map((ing, k) => (
                    <div key={k} className="flex items-baseline justify-between text-[11px] text-muted">
                      <span className="truncate">{ing.he}</span>
                      <span className="font-mono shrink-0" dir="ltr">{ing.calories}</span>
                    </div>
                  )) : (
                    <div className="text-[11px] text-muted-more">אין פירוט למנה הזו</div>
                  )}
                </div>
              )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <EditMealModal
          uid={uid}
          meal={editing}
          onClose={() => setEditing(null)}
          onDone={async () => { setEditing(null); await reload(); }}
        />
      )}
    </div>
  );
}

function EditMealModal({
  uid, meal, onClose, onDone,
}: {
  uid: string;
  meal: PersonalMeal;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const firestore = useFirestore(uid);
  const [he, setHe] = useState(meal.he);
  const [calories, setCalories] = useState(String(meal.calories));
  const [isAnchor, setIsAnchor] = useState(!!meal.isAnchor);
  const [photo, setPhoto] = useState(meal.photoBase64);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    if (busy || !he.trim()) return;
    setBusy(true);
    // The id is the slug of the ORIGINAL name and stays put — rewriting it on a
    // rename would orphan every log that points at this template.
    await firestore.upsertPersonalMeal({
      ...meal,
      he: he.trim(),
      calories: Math.max(0, Number(calories) || 0),
      isAnchor,
      photoBase64: photo,
    });
    await onDone();
  }

  async function remove() {
    setBusy(true);
    await firestore.deletePersonalMeal(meal.id);
    await onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center dark:bg-black/70 bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="overlay-solid w-full max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border border-subtle p-4 space-y-3 pb-[max(env(safe-area-inset-bottom),1rem)]" dir="rtl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">עריכת ארוחה</h3>
          <button onClick={onClose} className="text-muted text-2xl leading-none">×</button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-16 h-16 rounded-xl bg-subtle flex items-center justify-center shrink-0 overflow-hidden"
          >
            {photo
              ? <img src={photo} alt="" className="w-full h-full object-cover" />
              : <span className="text-[10px] text-muted">+ תמונה</span>}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async e => {
              const f = e.target.files?.[0];
              if (f) { try { setPhoto(await compressImage(f, 640, 0.72)); } catch { /* ignore */ } }
              e.currentTarget.value = '';
            }}
          />
          <input
            value={he}
            onChange={e => setHe(e.target.value)}
            className="flex-1 bg-transparent border-b border-subtle pb-1 font-bold focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted shrink-0">קלוריות למנה</span>
          <input
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={e => setCalories(e.target.value)}
            className="input-field flex-1 py-2 text-base"
          />
        </div>

        <button
          onClick={() => setIsAnchor(v => !v)}
          className={`w-full py-2.5 rounded-xl text-[13px] font-semibold ${
            isAnchor ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-subtle text-muted'
          }`}
        >
          {isAnchor ? '★ ארוחה קבועה — תופיע ראשונה' : '☆ סמן כארוחה קבועה'}
        </button>

        <div className="flex gap-2 pt-1">
          {confirmDelete ? (
            <>
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 py-2.5">ביטול</button>
              <button onClick={() => void remove()} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold">
                מחק לצמיתות
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(true)} className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 font-semibold text-[13px]">
                מחק
              </button>
              <button onClick={() => void save()} disabled={busy || !he.trim()} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-bold disabled:opacity-40">
                {busy ? 'שומר…' : 'שמור'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
