import { useEffect, useMemo, useRef, useState } from 'react';
import type { MealLog, Route, UserProfile, FreeSession } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { FoodAiAction, SettingsGearAction } from './TopBarActions';
import { EditMealLogModal } from './EditMealLogModal';
import {
  MEAL_TYPES, caloriesOn, effectiveTargetOf, estimateBurn, startOfDay,
} from '../data/diet';

type Props = {
  uid: string;
  navigate: (r: Route) => void;
  /** Bumped by the shell after a meal is logged, so Today refetches. */
  refreshKey?: number;
  onAddMeal: () => void;
  onOpenChat: () => void;
};

/** One aligned label/number line in the hero breakdown. */
function Row({ label, value, prefix, tone }: { label: string; value: number; prefix?: string; tone?: string }) {
  // A sign on zero reads as broken arithmetic ("−0"). Zero has no direction.
  const sign = value === 0 ? '' : (prefix || '');
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span>{label}</span>
      <span className={`font-mono ${tone || ''}`} dir="ltr">{sign}{value}</span>
    </div>
  );
}

export function FoodToday({ uid, navigate, refreshKey, onAddMeal, onOpenChat }: Props) {
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  const [logs, setLogs] = useState<MealLog[]>([]);
  const [profile, setProfile] = useState<UserProfile>({});
  const [sessions, setSessions] = useState<FreeSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<MealLog | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<MealLog | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState<MealLog | null>(null);

  const dayStart = startOfDay();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [l, p, s] = await Promise.all([
        firestoreRef.current.getMealLogs(dayStart - 7 * 86_400_000),
        firestoreRef.current.getUserProfile(),
        firestoreRef.current.getFreeSessions(),
      ]);
      if (cancelled) return;
      setLogs(l);
      setProfile(p);
      setSessions(s);
      setLoaded(true);
    })().catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [uid, refreshKey, dayStart]);

  const todayLogs = useMemo(
    () => logs.filter(l => l.timestamp >= dayStart).sort((a, b) => b.timestamp - a.timestamp),
    [logs, dayStart],
  );

  const eaten = useMemo(() => caloriesOn(logs, dayStart), [logs, dayStart]);
  const target = effectiveTargetOf(profile.diet);
  const burn = useMemo(() => {
    const todays = sessions.filter(s => (s.completedAt || s.date) >= dayStart);
    return estimateBurn(todays, profile.diet?.weightKg);
  }, [sessions, dayStart, profile.diet?.weightKg]);

  // Negative = deficit (good when losing). Only meaningful once a target exists.
  const balance = target != null ? eaten - burn - target : null;
  const cleanDay = todayLogs.length > 0 && !todayLogs.some(l => l.flags?.highSugar || l.flags?.emptyCarbs);

  async function duplicate(l: MealLog) {
    // Re-log the template as it was eaten: same per-serving calories, same
    // breakdown, same serving size — only the clock moves.
    const perServing = Math.round(l.calories / (l.servings || 1));
    await firestoreRef.current.logMeal({
      mealId: l.mealId,
      he: l.name,
      mealType: l.mealType,
      caloriesPerServing: perServing,
      servings: l.servings || 1,
      ingredients: l.ingredients,
      flags: l.flags,
    });
    await reload();
  }

  async function reload() {
    const l = await firestoreRef.current.getMealLogs(dayStart - 7 * 86_400_000);
    setLogs(l);
  }

  // Grouped by meal type, in the order you eat them, each panel collapsible and
  // showing its own calorie subtotal.
  const groups = useMemo(() => {
    return MEAL_TYPES
      .map(t => ({
        type: t,
        items: todayLogs.filter(l => l.mealType === t.id).sort((a, b) => a.timestamp - b.timestamp),
      }))
      .filter(g => g.items.length > 0)
      .map(g => ({ ...g, kcal: g.items.reduce((a, x) => a + (x.calories || 0), 0) }));
  }, [todayLogs]);

  const balanceTone = balance == null
    ? 'text-main'
    : balance <= -100 ? 'text-emerald-600 dark:text-emerald-400'
    : balance >= 100 ? 'text-red-500'
    : 'text-amber-500';

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="היום"
        subtitle={new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
        accent="brand"
        tint="amber"
        actions={<><FoodAiAction onClick={onOpenChat} /><SettingsGearAction navigate={navigate} /></>}
      />

      <div className="max-w-lg mx-auto p-4 space-y-4" dir="rtl">
        {/* Balance hero — the one thing you open תזונה to see.
            A ring, not a number on a slab: it shows progress toward the day's
            target at a glance, and degrades honestly to "eaten so far" when no
            target is set yet. */}
        {(() => {
          const pct = target ? Math.min(1, Math.max(0, eaten / target)) : 0;
          const remaining = target ? Math.round(target - eaten + burn) : null;
          const over = remaining != null && remaining < 0;
          const RING = 54, STROKE = 9;
          const C = 2 * Math.PI * RING;
          const ringTone = !target ? 'stroke-slate-400'
            : over ? 'stroke-red-500'
            : pct > 0.85 ? 'stroke-amber-500'
            : 'stroke-emerald-500';
          return (
            <div className="card py-5">
              <div className="flex items-center gap-5">
                <div className="relative shrink-0" style={{ width: 132, height: 132 }}>
                  <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
                    <circle cx="66" cy="66" r={RING} fill="none" strokeWidth={STROKE}
                            className="stroke-slate-200 dark:stroke-slate-800" />
                    <circle cx="66" cy="66" r={RING} fill="none" strokeWidth={STROKE} strokeLinecap="round"
                            className={`${ringTone} transition-all duration-500`}
                            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[30px] font-bold font-mono leading-none" dir="ltr">{eaten}</span>
                    <span className="text-[10px] text-muted mt-1">קק״ל נאכלו</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-2.5">
                  {target == null ? (
                    <>
                      <div className="text-[13px] text-muted leading-snug">
                        קבע יעד יומי כדי לראות כמה נשאר לך
                      </div>
                      <button
                        onClick={() => navigate({ page: 'food-settings' })}
                        className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-lg bg-amber-500 text-white"
                      >
                        <span>הגדר יעד קלורי</span>
                        {/* RTL: forward means LEFT. */}
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 6l-6 6 6 6" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        {/* dir=ltr keeps the digits in order; text-right keeps
                            it on the same edge as the breakdown rows below. */}
                        <div className={`text-[26px] font-bold font-mono leading-none text-right ${over ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`} dir="ltr">
                          {Math.abs(remaining!)}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">
                          {over ? 'קק״ל מעל היעד' : 'קק״ל נשארו להיום'}
                        </div>
                      </div>
                      <div className="space-y-1 text-[11px] text-muted">
                        <Row label="יעד" value={target} />
                        {burn > 0 && <Row label="נשרף באימון" value={burn} prefix="+" tone="text-emerald-600 dark:text-emerald-400" />}
                        <Row label="נאכל" value={eaten} prefix="−" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {(cleanDay || todayLogs.length > 0) && (
                <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-subtle">
                  {cleanDay && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 font-semibold">
                      ✓ יום נקי
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-1 rounded-full bg-slate-500/10 text-muted font-semibold">
                    {todayLogs.length} ארוחות
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Timeline */}
        <div>
          <h2 className="text-[12px] font-bold text-muted mb-2">מה אכלת היום</h2>
          {!loaded ? (
            <div className="text-[12px] text-muted py-6 text-center">טוען…</div>
          ) : todayLogs.length === 0 ? (
            <div className="card text-center py-8">
              <div className="text-[13px] text-muted">עדיין לא רשמת ארוחות היום</div>
              <button
                onClick={onAddMeal}
                className="mt-3 text-[13px] font-bold px-4 py-2 rounded-xl bg-amber-500 text-white"
              >+ ארוחה ראשונה</button>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map(g => {
                const isOpen = !collapsed.has(g.type.id);
                return (
                  <div key={g.type.id} className="card py-0 overflow-hidden">
                    <button
                      onClick={() => setCollapsed(prev => {
                        const next = new Set(prev);
                        if (next.has(g.type.id)) next.delete(g.type.id); else next.add(g.type.id);
                        return next;
                      })}
                      className="w-full flex items-center gap-2 py-2.5 text-right"
                    >
                      <span className="text-base shrink-0">{g.type.emoji}</span>
                      <span className="flex-1 font-bold text-[13px]">{g.type.he}</span>
                      <span className="text-[10px] text-muted">{g.items.length}</span>
                      <span className="font-mono font-bold text-[13px]" dir="ltr">{g.kcal}</span>
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                           className={`text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="border-t border-subtle divide-y divide-slate-200/60 dark:divide-slate-800/60">
                        {g.items.map(l => (
                          <div key={l.id} className="flex items-center gap-1 py-2.5">
                          <button
                            onClick={() => setEditing(l)}
                            className="flex-1 flex items-center gap-3 text-right min-w-0"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-[13px] truncate">
                                {l.name}
                                {l.servings !== 1 && <span className="text-muted font-normal"> ×{l.servings}</span>}
                              </div>
                              <div className="text-[10px] text-muted flex items-center gap-1.5">
                                <span>{new Date(l.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                {l.flags?.highSugar && <span title="עתיר סוכר">🍬</span>}
                                {l.flags?.emptyCarbs && <span title="פחמימות ריקות">🍞</span>}
                              </div>
                            </div>
                            <span className="font-mono text-[13px] font-bold shrink-0" dir="ltr">{l.calories}</span>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-more shrink-0">
                              <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setConfirmDuplicate(l)}
                            aria-label="שכפל"
                            title="אכלתי את זה שוב"
                            className="shrink-0 p-2 text-muted-more hover:text-amber-500"
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                            </svg>
                          </button>
                          {/* Fast delete — still asks, because a mis-tap here
                              silently changes the day's total. */}
                          <button
                            onClick={() => setConfirmDelete(l)}
                            aria-label="מחק"
                            className="shrink-0 p-2 text-muted-more hover:text-red-500"
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                            </svg>
                          </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirmDuplicate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center dark:bg-black/70 bg-black/40 p-4" onClick={() => setConfirmDuplicate(null)}>
          <div className="card max-w-sm w-full text-right" dir="rtl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-1">להוסיף שוב?</h3>
            <p className="text-sm text-muted mb-1">
              {confirmDuplicate.name}
              {confirmDuplicate.servings !== 1 && <span> ×{confirmDuplicate.servings}</span>}
              {' · '}
              <span className="font-mono" dir="ltr">{confirmDuplicate.calories}</span> קק״ל
            </p>
            <p className="text-[12px] text-muted-more mb-4">
              יתווסף עכשיו ({new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}) עם אותו פירוט וגודל מנה.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDuplicate(null)} className="btn-secondary flex-1 py-3">ביטול</button>
              <button
                onClick={async () => {
                  const l = confirmDuplicate;
                  setConfirmDuplicate(null);
                  await duplicate(l);
                }}
                className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-bold"
              >הוסף שוב</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center dark:bg-black/70 bg-black/40 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="card max-w-sm w-full text-right" dir="rtl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-1">למחוק את הארוחה?</h3>
            <p className="text-sm text-muted mb-4">
              {confirmDelete.name} · {confirmDelete.calories} קק״ל
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1 py-3">ביטול</button>
              <button
                onClick={async () => {
                  const id = confirmDelete.id;
                  setConfirmDelete(null);
                  await firestoreRef.current.deleteMealLog(id);
                  setLogs(prev => prev.filter(x => x.id !== id));
                }}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold"
              >מחק</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <EditMealLogModal
          uid={uid}
          log={editing}
          onClose={() => setEditing(null)}
          onDone={async () => { setEditing(null); await reload(); }}
        />
      )}
    </div>
  );
}
