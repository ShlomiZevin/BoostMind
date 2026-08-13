import { useState } from 'react';
import type { MuscleGroup, MuscleParent } from '../data/muscles';
import { PARENT_INFO, ACTIVE_MUSCLES, MUSCLE_CLASSES, musclesByParent } from '../data/muscles';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

type Props = {
  suggested?: MuscleGroup[];
  // Weekly-set counts per muscle. Muscles with 0 sets get highlighted "אטנשן".
  weeklySets?: Partial<Record<MuscleGroup, number>>;
  // Muscles trained around this same weekday last week — used to hint "you did these 7d ago".
  lastWeekMuscles?: Set<MuscleGroup>;
  // Muscles trained in the last 48h — amber warning ("give them a rest")
  recentMuscles?: Set<MuscleGroup>;
  // Optional overrides so the same modal can be used for planning a future day.
  heading?: string;         // e.g. "תכנן ליום שלישי"
  buttonLabel?: string;     // e.g. "תכנן אימון"
  buttonLabelWithCount?: (n: number) => string;
  onClose: () => void;
  onStart: (muscles: MuscleGroup[]) => void;
};

const PARENT_ORDER: MuscleParent[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

export function StartSessionModal({
  suggested = [],
  weeklySets = {},
  lastWeekMuscles,
  recentMuscles,
  heading,
  buttonLabel,
  buttonLabelWithCount,
  onClose,
  onStart,
}: Props) {
  useBodyScrollLock();
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
      <div className="flex items-center justify-between p-4 border-b border-subtle" dir="rtl">
        <h2 className="font-bold text-lg">{heading || 'מה מתאמנים היום?'}</h2>
        <button onClick={onClose} aria-label="סגור" className="text-muted text-2xl leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Compact chip row — suggestions live as tiny quick-actions, not full-width cards */}
        {(suggested.length > 0 || (lastWeekMuscles && lastWeekMuscles.size > 0)) && (
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1" dir="rtl">
            {suggested.length > 0 && (
              <button
                onClick={useSuggestion}
                className="shrink-0 inline-flex items-center text-[11px] font-semibold px-2.5 py-1.5 rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20"
              >
                <span>החלשים השבוע</span>
              </button>
            )}
            {lastWeekMuscles && lastWeekMuscles.size > 0 && (
              <button
                onClick={useLastWeek}
                className="shrink-0 inline-flex items-center text-[11px] font-semibold px-2.5 py-1.5 rounded-full bg-blue-500/12 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/20"
              >
                <span>שבוע שעבר</span>
              </button>
            )}
            <button
              onClick={() => setSelected(new Set())}
              className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full text-muted hover:text-main"
            >נקה</button>
          </div>
        )}


        {PARENT_ORDER.map(parent => {
          const info = PARENT_INFO[parent];
          const children = musclesByParent(parent);
          const allSelected = children.every(m => selected.has(m.id));
          const someSelected = children.some(m => selected.has(m.id));
          const parentSets = children.reduce((sum, m) => sum + (weeklySets[m.id] || 0), 0);
          const maxGroupSets = Math.max(1, ...PARENT_ORDER.map(p =>
            musclesByParent(p).reduce((s, m) => s + (weeklySets[m.id] || 0), 0)
          ));
          const groupRatio = Math.min(1, parentSets / maxGroupSets);
          const groupBarPct = maxGroupSets > 0 ? (parentSets / maxGroupSets) * 100 : 0;
          // 4-tier group heat matching the tile grammar below — same instant readability.
          let groupRgb = '203, 213, 225'; let groupAlpha = 0; let groupHeavyText = false;
          if (parentSets > 0) {
            if      (groupRatio <= 0.25) { groupRgb = '254, 202, 202'; groupAlpha = 0.9; groupHeavyText = false; }
            else if (groupRatio <= 0.55) { groupRgb = '248, 113, 113'; groupAlpha = 0.85; groupHeavyText = false; }
            else if (groupRatio <= 0.80) { groupRgb = '220, 38, 38';   groupAlpha = 0.9;  groupHeavyText = true; }
            else                         { groupRgb = '127, 29, 29';   groupAlpha = 1.0;  groupHeavyText = true; }
          }
          const heatColor = groupRgb;
          const heatAlpha = groupAlpha;
          return (
            <div key={parent}>
              <div className="flex items-center justify-between mb-1" dir="rtl">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{info.he}</span>
                  {parentSets > 0 && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${groupHeavyText ? 'text-white' : 'text-red-900 dark:text-red-950'}`}
                      style={{ backgroundColor: `rgba(${heatColor}, ${heatAlpha})` }}
                    >
                      {parentSets}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggleParent(parent)}
                  className={`text-[10px] px-2 py-0.5 rounded ${allSelected ? 'bg-emerald-500 text-white' : someSelected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'dark:bg-slate-800 dark:text-slate-400 bg-slate-200 text-slate-500'}`}
                >
                  {allSelected ? 'נבחר הכל' : 'בחר הכל'}
                </button>
              </div>
              {/* Group heat bar — same tier grammar so bar + pill + tiles all agree */}
              <div className="w-full h-1 rounded-full dark:bg-slate-800/60 bg-slate-200/60 mb-2 overflow-hidden flex flex-row-reverse">
                <div
                  className={`h-1 transition-all ${parentSets === 0 ? 'opacity-0' : ''}`}
                  style={{ width: `${groupBarPct}%`, backgroundColor: `rgba(${heatColor}, 1)` }}
                />
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
                    // Discrete 4-tier heat scale — meant to be readable at a glance, not smooth.
                    // Tiers picked so a "hammered" muscle (near max) reads DRAMATICALLY hotter
                    // than a moderately-worked one (~half of max).
                    //   ratio ≤ 0.25 → pale pink   (worked a little)
                    //   ratio ≤ 0.55 → light red   (moderate)
                    //   ratio ≤ 0.80 → strong red  (a lot)
                    //   ratio  > 0.80 → deep crimson (hammered)
                    let tileRgb: string; let tileAlpha: number; let heavyText = false;
                    if (ratio <= 0.25)      { tileRgb = '254, 202, 202'; tileAlpha = 0.9;   heavyText = false; }
                    else if (ratio <= 0.55) { tileRgb = '248, 113, 113'; tileAlpha = 0.85;  heavyText = false; }
                    else if (ratio <= 0.80) { tileRgb = '220, 38, 38';   tileAlpha = 0.90;  heavyText = true; }
                    else                    { tileRgb = '127, 29, 29';   tileAlpha = 1.0;   heavyText = true; }
                    inlineStyle = { backgroundColor: `rgba(${tileRgb}, ${tileAlpha})` };
                    extraClass = heavyText ? 'text-white font-semibold' : 'text-red-900 dark:text-red-950';
                  }
                  const isRecent = recentMuscles?.has(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(m.id)}
                      className={`${baseClass} ${extraClass}`}
                      style={inlineStyle}
                      dir="rtl"
                    >
                      {/* Single badge cluster in the top-left corner — no overlap, always readable */}
                      {(isLastWeek || isRecent) && (
                        <div className="absolute -top-1.5 -left-1.5 flex items-center gap-0.5">
                          {isRecent && (
                            <span
                              className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow"
                              title="אומן ב-48 השעות האחרונות"
                            >
                              <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                            </span>
                          )}
                          {isLastWeek && (
                            <span
                              className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white shadow"
                              title="אומן לפני שבוע"
                            >
                              <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                                <path d="M3 3v5h5" />
                              </svg>
                            </span>
                          )}
                        </div>
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
        {(() => {
          const recentPicked = recentMuscles ? [...selected].filter(id => recentMuscles.has(id)) : [];
          if (recentPicked.length === 0) return null;
          return (
            <div className="mb-2 flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300" dir="rtl">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="flex-1 truncate">
                {recentPicked.length} {recentPicked.length === 1 ? 'שריר אומן' : 'שרירים אומנו'} ב-48 שעות ({recentPicked.map(id => ACTIVE_MUSCLES.find(m => m.id === id)?.he).filter(Boolean).join(', ')})
              </span>
            </div>
          );
        })()}
        <button
          onClick={() => onStart([...selected])}
          disabled={!canStart}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
            canStart ? 'btn-primary' : 'dark:bg-slate-800 dark:text-slate-600 bg-slate-200 text-slate-400'
          }`}
        >
          {canStart
            ? (buttonLabelWithCount ? buttonLabelWithCount(selected.size) : (buttonLabel ? `${buttonLabel} (${selected.size})` : `התחל אימון (${selected.size})`))
            : 'בחר לפחות שריר אחד'}
        </button>
      </div>
    </div>
  );
}
