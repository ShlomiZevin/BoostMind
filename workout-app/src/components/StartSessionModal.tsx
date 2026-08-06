import { useState } from 'react';
import type { MuscleGroup, MuscleParent } from '../data/muscles';
import { PARENT_INFO, ACTIVE_MUSCLES, MUSCLE_CLASSES, musclesByParent } from '../data/muscles';

type Props = {
  suggested?: MuscleGroup[];
  // Weekly-set counts per muscle. Muscles with 0 sets get highlighted "אטנשן".
  weeklySets?: Partial<Record<MuscleGroup, number>>;
  // Muscles trained around this same weekday last week — used to hint "you did these 7d ago".
  lastWeekMuscles?: Set<MuscleGroup>;
  // Muscles trained in the last 48h — amber warning ("give them a rest")
  recentMuscles?: Set<MuscleGroup>;
  onClose: () => void;
  onStart: (muscles: MuscleGroup[]) => void;
};

const PARENT_ORDER: MuscleParent[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

export function StartSessionModal({ suggested = [], weeklySets = {}, lastWeekMuscles, recentMuscles, onClose, onStart }: Props) {
  const [selected, setSelected] = useState<Set<MuscleGroup>>(new Set());

  function useLastWeek() {
    if (!lastWeekMuscles) return;
    setSelected(new Set(lastWeekMuscles));
  }

  function toggle(id: MuscleGroup) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleParent(parent: MuscleParent) {
    const children = musclesByParent(parent).map(m => m.id);
    const allSelected = children.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      for (const id of children) {
        if (allSelected) next.delete(id); else next.add(id);
      }
      return next;
    });
  }

  function useSuggestion() {
    setSelected(new Set(suggested.slice(0, 4)));
  }

  const canStart = selected.size > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-solid">
      <div className="flex flex-row-reverse items-center justify-between p-4 border-b border-subtle">
        <h2 className="font-bold text-lg" dir="rtl">מה מתאמנים היום?</h2>
        <button onClick={onClose} className="text-muted text-2xl">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {suggested.length > 0 && (
          <button
            onClick={useSuggestion}
            className="w-full text-right p-3 rounded-xl border border-dashed dark:border-emerald-800 border-emerald-300 dark:bg-emerald-950/30 bg-emerald-50 text-sm dark:hover:bg-emerald-950/50 hover:bg-emerald-100"
            dir="rtl"
          >
            <div className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">בחר את החלשים השבוע</div>
            <div className="text-xs text-muted">
              {suggested.slice(0, 4).map((id, i) => {
                const m = ACTIVE_MUSCLES.find(x => x.id === id);
                return m ? (i > 0 ? ' · ' : '') + m.he : '';
              }).join('')}
            </div>
          </button>
        )}

        {recentMuscles && recentMuscles.size > 0 && [...selected].some(id => recentMuscles.has(id)) && (
          <div className="flex items-start gap-3 rounded-xl px-3 py-2.5 dark:bg-amber-950/40 bg-amber-50 border dark:border-amber-500/40 border-amber-300 text-[12px] text-amber-800 dark:text-amber-200" dir="rtl">
            <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-amber-500 text-white">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <div className="text-right flex-1 min-w-0">
              <div className="font-semibold">בחרת שרירים שאימנת ב-48 שעות האחרונות</div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {[...selected].filter(id => recentMuscles.has(id)).map(id => ACTIVE_MUSCLES.find(m => m.id === id)?.he).filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        )}

        {lastWeekMuscles && lastWeekMuscles.size > 0 && (
          <button
            onClick={useLastWeek}
            className="w-full text-right p-3 rounded-xl border border-dashed dark:border-blue-800 border-blue-300 dark:bg-blue-950/30 bg-blue-50 text-sm dark:hover:bg-blue-950/50 hover:bg-blue-100"
            dir="rtl"
          >
            <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1 inline-flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>אותם שרירים כמו בשבוע שעבר</span>
            </div>
            <div className="text-xs text-muted">
              {[...lastWeekMuscles].slice(0, 6).map((id, i) => {
                const m = ACTIVE_MUSCLES.find(x => x.id === id);
                return m ? (i > 0 ? ' · ' : '') + m.he : '';
              }).join('')}
            </div>
          </button>
        )}

        {PARENT_ORDER.map(parent => {
          const info = PARENT_INFO[parent];
          const children = musclesByParent(parent);
          const allSelected = children.every(m => selected.has(m.id));
          const someSelected = children.some(m => selected.has(m.id));
          return (
            <div key={parent}>
              <div className="flex items-center justify-between mb-1.5" dir="rtl">
                <div className="text-sm font-semibold">{info.he}</div>
                <button
                  onClick={() => toggleParent(parent)}
                  className={`text-[10px] px-2 py-0.5 rounded ${allSelected ? 'bg-emerald-500 text-white' : someSelected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'dark:bg-slate-800 dark:text-slate-400 bg-slate-200 text-slate-500'}`}
                >
                  {allSelected ? 'נבחר הכל' : 'בחר הכל'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2" dir="rtl">
                {children.map(m => {
                  const isSelected = selected.has(m.id);
                  const isLastWeek = lastWeekMuscles?.has(m.id);
                  const c = MUSCLE_CLASSES[m.color];
                  const doneThisWeek = weeklySets[m.id] || 0;
                  const maxThisWeek = Math.max(1, ...ACTIVE_MUSCLES.map(x => weeklySets[x.id] || 0));
                  const ratio = Math.min(1, doneThisWeek / maxThisWeek);
                  // Clean heat scale — untrained is neutral (not amber), trained fades emerald→red.
                  let baseClass = 'relative text-right px-3 py-3 rounded-xl transition text-sm min-h-[52px] flex items-center';
                  let inlineStyle: React.CSSProperties = {};
                  let extraClass = '';
                  if (isSelected) {
                    extraClass = `${c.bg} ${c.text} ring-2 ${c.ring} font-semibold`;
                  } else if (doneThisWeek === 0) {
                    // Untrained: clean neutral tile with a subtle border, no yellow rings.
                    extraClass = 'dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 text-main';
                  } else {
                    const alpha = 0.12 + ratio * 0.68;
                    inlineStyle = { backgroundColor: `rgba(239, 68, 68, ${alpha})` };
                    extraClass = ratio > 0.55
                      ? 'text-white font-semibold'
                      : 'text-red-900 dark:text-red-50';
                  }
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(m.id)}
                      className={`${baseClass} ${extraClass}`}
                      style={inlineStyle}
                      dir="rtl"
                    >
                      {isLastWeek && (
                        <span
                          className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[8px] font-bold shadow"
                          title="אימנת אותם לפני שבוע"
                        >
                          <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                            <path d="M3 3v5h5" />
                          </svg>
                        </span>
                      )}
                      {recentMuscles?.has(m.id) && (
                        <span
                          className={`absolute ${isLastWeek ? '-top-1 -left-6' : '-top-1 -left-1'} flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[8px] font-bold shadow`}
                          title="אימנת בשריר הזה ב-48 שעות האחרונות"
                        >
                          <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        </span>
                      )}
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="flex-1 text-right font-medium">{m.he}</span>
                        {doneThisWeek > 0 && (
                          <span className="text-[10px] font-mono shrink-0 opacity-80">{doneThisWeek}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-subtle">
        <button
          onClick={() => onStart([...selected])}
          disabled={!canStart}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
            canStart ? 'btn-primary' : 'dark:bg-slate-800 dark:text-slate-600 bg-slate-200 text-slate-400'
          }`}
        >
          {canStart ? `התחל אימון (${selected.size})` : 'בחר לפחות שריר אחד'}
        </button>
      </div>
    </div>
  );
}
