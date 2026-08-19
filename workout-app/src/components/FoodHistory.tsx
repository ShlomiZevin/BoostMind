import { useEffect, useMemo, useRef, useState } from 'react';
import type { MealLog, Route, UserProfile } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { FoodAiAction, SettingsGearAction } from './TopBarActions';
import { EditMealLogModal } from './EditMealLogModal';
import { MEAL_TYPES, effectiveTargetOf, startOfDay } from '../data/diet';

type Props = { uid: string; navigate: (r: Route) => void; refreshKey?: number; onOpenChat: () => void };

export function FoodHistory({ uid, navigate, refreshKey, onOpenChat }: Props) {
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  const [logs, setLogs] = useState<MealLog[]>([]);
  const [profile, setProfile] = useState<UserProfile>({});
  const [loaded, setLoaded] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<MealLog | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [l, p] = await Promise.all([
        firestoreRef.current.getMealLogs(startOfDay() - 60 * 86_400_000),
        firestoreRef.current.getUserProfile(),
      ]);
      if (cancelled) return;
      setLogs(l);
      setProfile(p);
      setLoaded(true);
    })().catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [uid, refreshKey]);

  async function reload() {
    setLogs(await firestoreRef.current.getMealLogs(startOfDay() - 60 * 86_400_000));
  }

  const target = effectiveTargetOf(profile.diet);

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
      .map(([day, items]) => ({
        day,
        items: items.sort((a, b) => b.timestamp - a.timestamp),
        total: items.reduce((a, x) => a + (x.calories || 0), 0),
      }))
      .sort((a, b) => b.day - a.day);
  }, [logs]);

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
        ) : days.map(({ day, items, total }) => {
          const key = String(day);
          const isOpen = openDay === key;
          const over = target != null && total > target;
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
                  <div className="text-[10px] text-muted">{items.length} ארוחות</div>
                </div>
                {target != null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    over ? 'bg-red-500/15 text-red-500' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {over ? 'מעל היעד' : 'בגירעון'}
                  </span>
                )}
                <span className="font-mono font-bold text-[14px] shrink-0" dir="ltr">{total}</span>
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
                      <span className="flex-1 min-w-0 truncate">
                        {l.name}{l.servings !== 1 && <span className="text-muted"> ×{l.servings}</span>}
                      </span>
                      {l.flags?.highSugar && <span>🍬</span>}
                      {l.flags?.emptyCarbs && <span>🍞</span>}
                      <span className="font-mono text-muted shrink-0" dir="ltr">{l.calories}</span>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-more shrink-0">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
