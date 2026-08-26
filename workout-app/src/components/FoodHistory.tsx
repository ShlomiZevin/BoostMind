import { useEffect, useMemo, useRef, useState } from 'react';
import type { FreeSession, MealLog, Route, UserProfile } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { FoodAiAction, SettingsGearAction } from './TopBarActions';
import { EditMealLogModal } from './EditMealLogModal';
import { LogMealModal } from './LogMealModal';
import { MEAL_TYPES, effectiveProteinTargetOf, effectiveTargetOf, estimateBurn, proteinOn, startOfDay } from '../data/diet';

type Props = { uid: string; navigate: (r: Route) => void; refreshKey?: number; onOpenChat: () => void };

export function FoodHistory({ uid, navigate, refreshKey, onOpenChat }: Props) {
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  const [logs, setLogs] = useState<MealLog[]>([]);
  const [profile, setProfile] = useState<UserProfile>({});
  const [sessions, setSessions] = useState<FreeSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<MealLog | null>(null);
  // Which past day we are adding a meal to. Editing and deleting already worked
  // here (tapping a row opens the same modal Today uses, and it carries מחק);
  // adding was the missing third.
  const [addingTo, setAddingTo] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [l, p, ss] = await Promise.all([
        firestoreRef.current.getMealLogs(startOfDay() - 60 * 86_400_000),
        firestoreRef.current.getUserProfile(),
        firestoreRef.current.getFreeSessions(),
      ]);
      if (cancelled) return;
      setLogs(l);
      setProfile(p);
      setSessions(ss);
      setLoaded(true);
    })().catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [uid, refreshKey]);

  async function reload() {
    setLogs(await firestoreRef.current.getMealLogs(startOfDay() - 60 * 86_400_000));
  }

  const target = effectiveTargetOf(profile.diet);
  const proteinTarget = effectiveProteinTargetOf(profile.diet);

  // Newest day first; each day carries its own logs so a row can expand in place.
  const days = useMemo(() => {
    const byDay = new Map<number, MealLog[]>();
    for (const l of logs) {
      const d = startOfDay(new Date(l.timestamp));
      const arr = byDay.get(d) || [];
      arr.push(l);
      byDay.set(d, arr);
    }
    return [...byDay.entries()]
      .map(([day, items]) => {
        const dayEnd = day + 86_400_000;
        const todays = sessions.filter(x => {
          const t = x.completedAt || x.date;
          return t >= day && t < dayEnd;
        });
        return {
          day,
          items: items.sort((a, b) => b.timestamp - a.timestamp),
          total: items.reduce((a, x) => a + (x.calories || 0), 0),
          burn: estimateBurn(todays, profile.diet?.weightKg),
          protein: proteinOn(items, day),
          missingMacros: items.filter(x => x.macros?.protein == null).length,
        };
      })
      .sort((a, b) => b.day - a.day);
  }, [logs, sessions, profile.diet?.weightKg]);

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="היסטוריה"
        subtitle={days.length > 0 ? `${days.length} ימים עם רישום` : undefined}
        accent="brand"
        tint="amber"
        actions={<><FoodAiAction onClick={onOpenChat} /><SettingsGearAction navigate={navigate} /></>}
      />
      <div className="max-w-lg mx-auto p-4 space-y-2" dir="rtl">
        {!loaded ? (
          <div className="text-[12px] text-muted py-8 text-center">טוען…</div>
        ) : days.length === 0 ? (
          <div className="card text-center py-10 text-[13px] text-muted">
            עוד אין היסטוריה — כל ארוחה שתרשום תופיע כאן
          </div>
        ) : days.map(({ day, items, total, burn, protein, missingMacros }) => {
          const key = String(day);
          // Same arithmetic as היום, so a past day reads the same way as today.
          const net = total - burn;
          const isOpen = openDay === key;
          const over = target != null && net > target;
          return (
            <div key={key} className="card py-0 overflow-hidden">
              <button
                onClick={() => setOpenDay(isOpen ? null : key)}
                className="w-full flex items-center gap-3 py-3 text-right"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px]">
                    {new Date(day).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </div>
                  {/* Protein rides the existing sub-line rather than joining the
                      numeric cluster on the right — that row already carries
                      יעד · נאכל · נשרף · גירעון, and a fifth column there would
                      wreck it on a phone. "88 / 125" stays one ltr run so bidi
                      does not flip it. */}
                  <div className="text-[10px] text-muted flex items-center gap-1.5">
                    <span>{items.length} ארוחות</span>
                    {proteinTarget != null && (
                      <>
                        <span className="text-muted-more">·</span>
                        <span className={protein >= proteinTarget ? "text-sky-600 dark:text-sky-400 font-semibold" : ""}>
                          חלבון <span dir="ltr">{protein} / {proteinTarget}</span>
                        </span>
                        {missingMacros > 0 && <span className="text-muted-more" title="ארוחות בלי נתוני חלבון">({missingMacros}?)</span>}
                      </>
                    )}
                  </div>
                </div>
                {/* goal · eaten · result — the three numbers that make a past
                    day mean something. */}
                {target != null ? (
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-center">
                      <span className="block font-mono text-[11px] text-muted" dir="ltr">{target}</span>
                      <span className="block text-[9px] text-muted-more">יעד</span>
                    </span>
                    <span className="text-center">
                      <span className="block font-mono font-bold text-[13px]" dir="ltr">{total}</span>
                      <span className="block text-[9px] text-muted-more">נאכל</span>
                    </span>
                    <span className="text-center">
                      <span className="block font-mono text-[11px] text-sky-500" dir="ltr">{burn > 0 ? burn : '—'}</span>
                      <span className="block text-[9px] text-muted-more">נשרף</span>
                    </span>
                    <span className="text-center">
                      <span className={`block font-mono font-bold text-[13px] ${over ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`} dir="ltr">
                        {net - target > 0 ? '+' : ''}{net - target}
                      </span>
                      <span className="block text-[9px] text-muted-more">{over ? 'עודף' : 'גירעון'}</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono font-bold text-[14px]" dir="ltr">{total}</span>
                    {burn > 0 && <span className="font-mono text-[11px] text-sky-500" dir="ltr">-{burn}</span>}
                  </div>
                )}
              </button>
              {isOpen && (
                <div className="border-t border-subtle py-2 space-y-1.5">
                  {items.map(l => (
                    <button
                      key={l.id}
                      onClick={() => setEditing(l)}
                      className="w-full flex items-center gap-2 text-[12px] text-right py-0.5"
                    >
                      <span className="shrink-0">{MEAL_TYPES.find(t => t.id === l.mealType)?.emoji || '🍽'}</span>
                      {/* Time matters here: meals get read back against sugar
                          readings, and "what" without "when" can't be lined up. */}
                      <span className="shrink-0 font-mono text-[10px] text-muted-more" dir="ltr">
                        {new Date(l.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="flex-1 min-w-0 truncate">
                        {l.name}{l.servings !== 1 && <span className="text-muted"> ×{l.servings}</span>}
                      </span>
                      {l.flags?.highSugar && <span>🍬</span>}
                      {l.flags?.emptyCarbs && <span>🍞</span>}
                      {/* Same label as Today — protein per meal reads the same
                          wherever you look at a meal. */}
                      {l.macros?.protein != null && (
                        <span className="shrink-0 text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
                          חלבון <span dir="ltr">{Math.round(l.macros.protein)}</span>
                        </span>
                      )}
                      <span className="font-mono text-muted shrink-0" dir="ltr">{l.calories}</span>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-more shrink-0">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                    </button>
                  ))}
                  <button
                    onClick={() => setAddingTo(day)}
                    className="w-full flex items-center justify-center gap-1.5 mt-1 py-2 rounded-lg
                               border border-dashed border-subtle text-[12px] font-semibold text-muted
                               dark:hover:bg-slate-800 hover:bg-slate-50"
                  >
                    <span className="text-[14px] leading-none">+</span>
                    הוסף ארוחה ליום הזה
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {addingTo != null && (
        <LogMealModal
          uid={uid}
          forDay={addingTo}
          onClose={() => setAddingTo(null)}
          onSaved={async () => { setAddingTo(null); await reload(); }}
          /* The coach only ever talks about today, so offering it from a past
             day would hand the conversation the wrong date. */
          onOpenChat={() => setAddingTo(null)}
        />
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
