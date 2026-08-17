import { useEffect, useMemo, useRef, useState } from 'react';
import { useFirestore } from '../hooks/useFirestore';
import {
  PARENT_INFO, ACTIVE_MUSCLES, DEFAULT_WEEKLY_TARGETS, musclesByParent,
} from '../data/muscles';
import type { MuscleGroup, MuscleParent } from '../data/muscles';

const PARENT_ORDER: MuscleParent[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];
type GoalsMode = 'fixed' | 'percent';

/**
 * Self-contained "מטרות שבועיות" editor. Moved out of Settings so it can live
 * inside the Body tab (per user request) without duplicating state or the
 * percent-mode logic. Any surface that imports this shares the same live
 * subscription — approving goals from the AI chat updates every mounted copy.
 */
export function GoalsCard({ uid }: { uid: string }) {
  const firestore = useFirestore(uid);
  const [targets, setTargets] = useState<Record<MuscleGroup, number>>({ ...DEFAULT_WEEKLY_TARGETS });
  const [loaded, setLoaded] = useState(false);
  const [goalsMode, setGoalsMode] = useState<GoalsMode>('fixed');
  const [totalSets, setTotalSets] = useState<number>(0);
  const [percents, setPercents] = useState<Partial<Record<MuscleGroup, number>>>({});

  useEffect(() => {
    (async () => {
      const [t, cfg] = await Promise.all([
        firestore.getWeeklyTargets(),
        firestore.getGoalsConfig(),
      ]);
      setTargets(t);
      setGoalsMode(cfg.mode);
      const defaultTotal = Object.values(t).reduce((s, v) => s + (v || 0), 0) || 100;
      setTotalSets(cfg.totalSets > 0 ? cfg.totalSets : defaultTotal);
      if (cfg.percents && Object.keys(cfg.percents).length > 0) {
        setPercents(cfg.percents);
      } else {
        const equal = Math.floor(100 / ACTIVE_MUSCLES.length);
        const initial: Partial<Record<MuscleGroup, number>> = {};
        for (const m of ACTIVE_MUSCLES) initial[m.id] = equal;
        setPercents(initial);
      }
      setLoaded(true);
    })();
  }, [uid]);

  // Realtime subscribe — AI approvals and other-tab edits reflect here without reload.
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;
  useEffect(() => {
    if (!uid) return;
    const unsub = firestoreRef.current.subscribeToWeeklyTargets(t => setTargets(t));
    return unsub;
  }, [uid]);

  const percentSum = useMemo(() => Object.values(percents).reduce((s: number, v) => s + (v || 0), 0), [percents]);
  const bank = Math.max(0, 100 - percentSum);

  const saveTimer = useRef<any>(null);
  function saveDebounced(next: Partial<Record<MuscleGroup, number>>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      firestore.setGoalsConfig({ percents: next });
    }, 250);
  }

  async function changeTarget(id: MuscleGroup, delta: number) {
    const next = Math.max(0, (targets[id] || 0) + delta);
    const newTargets = { ...targets, [id]: next };
    setTargets(newTargets);
    await firestore.setWeeklyTargets(newTargets);
  }
  async function resetTargets() {
    setTargets({ ...DEFAULT_WEEKLY_TARGETS });
    await firestore.setWeeklyTargets(DEFAULT_WEEKLY_TARGETS);
  }
  async function switchMode(next: GoalsMode) {
    setGoalsMode(next);
    await firestore.setGoalsConfig({ mode: next });
  }
  async function changeTotal(delta: number) {
    const next = Math.max(0, totalSets + delta);
    setTotalSets(next);
    await firestore.setGoalsConfig({ totalSets: next });
  }
  function normalize(next: Partial<Record<MuscleGroup, number>>) {
    for (const k of Object.keys(next) as MuscleGroup[]) {
      const v = Math.round((next[k] || 0) * 10) / 10;
      next[k] = v < 0.05 ? 0 : v;
    }
    return next;
  }

  function setPercentValue(id: MuscleGroup, targetPct: number) {
    const current = percents[id] || 0;
    const delta = targetPct - current;
    if (Math.abs(delta) < 0.05) return;
    let next = { ...percents };
    if (delta < 0) {
      next[id] = Math.max(0, current + delta);
    } else {
      const currentBank = Math.max(0, 100 - Object.values(next).reduce((s: number, v) => s + (v || 0), 0));
      let want = delta;
      const fromBank = Math.min(currentBank, want);
      want -= fromBank;
      next[id] = current + fromBank;
      if (want > 0) {
        const others = ACTIVE_MUSCLES.filter(m => m.id !== id && (next[m.id] || 0) > 0);
        if (others.length > 0) {
          let remaining = want;
          let pool = others.slice();
          while (remaining > 0.0001 && pool.length > 0) {
            const per = remaining / pool.length;
            const stillPositive: typeof pool = [];
            remaining = 0;
            for (const m of pool) {
              const cur = next[m.id] || 0;
              const take = Math.min(cur, per);
              next[m.id] = cur - take;
              remaining += per - take;
              if ((next[m.id] || 0) > 0.0001) stillPositive.push(m);
            }
            pool = stillPositive;
          }
          next[id] = (next[id] || 0) + (want - remaining);
        }
      }
    }
    next = normalize(next);
    setPercents(next);
    saveDebounced(next);
  }

  function setGroupPercentValue(parent: MuscleParent, targetPct: number) {
    const children = musclesByParent(parent);
    const currentSum = children.reduce((s, m) => s + (percents[m.id] || 0), 0);
    const delta = targetPct - currentSum;
    if (Math.abs(delta) < 0.05) return;
    let next = { ...percents };
    if (delta < 0) {
      const reduce = -delta;
      const totalChild = children.reduce((s, m) => s + (next[m.id] || 0), 0);
      if (totalChild > 0.0001) {
        for (const m of children) {
          const share = (next[m.id] || 0) / totalChild * reduce;
          next[m.id] = Math.max(0, (next[m.id] || 0) - share);
        }
      }
    } else {
      const bankNow = Math.max(0, 100 - Object.values(next).reduce((s: number, v) => s + (v || 0), 0));
      let want = delta;
      const fromBank = Math.min(bankNow, want);
      want -= fromBank;
      let actuallyGot = fromBank;
      if (want > 0) {
        const childIds = new Set(children.map(m => m.id));
        const others = ACTIVE_MUSCLES.filter(m => !childIds.has(m.id) && (next[m.id] || 0) > 0);
        if (others.length > 0) {
          let remaining = want;
          let pool = others.slice();
          while (remaining > 0.0001 && pool.length > 0) {
            const per = remaining / pool.length;
            const stillPositive: typeof pool = [];
            remaining = 0;
            for (const m of pool) {
              const cur = next[m.id] || 0;
              const take = Math.min(cur, per);
              next[m.id] = cur - take;
              remaining += per - take;
              if ((next[m.id] || 0) > 0.0001) stillPositive.push(m);
            }
            pool = stillPositive;
          }
          actuallyGot += (want - remaining);
        }
      }
      if (actuallyGot > 0.0001) {
        const totalChild = children.reduce((s, m) => s + (next[m.id] || 0), 0);
        if (totalChild > 0.0001) {
          for (const m of children) {
            next[m.id] = (next[m.id] || 0) + actuallyGot * ((next[m.id] || 0) / totalChild);
          }
        } else {
          const per = actuallyGot / children.length;
          for (const m of children) next[m.id] = per;
        }
      }
    }
    next = normalize(next);
    setPercents(next);
    saveDebounced(next);
  }

  async function resetPercentsEqual() {
    const equal = Math.floor(100 / ACTIVE_MUSCLES.length);
    const initial: Partial<Record<MuscleGroup, number>> = {};
    for (const m of ACTIVE_MUSCLES) initial[m.id] = equal;
    setPercents(initial);
    await firestore.setGoalsConfig({ percents: initial });
  }

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-3" dir="rtl">
        <div className="text-right">
          <div className="font-medium">מטרות שבועיות</div>
          <div className="text-xs text-muted">
            {goalsMode === 'fixed' ? 'כמה סטים לכל שריר בשבוע' : 'חלוקה יחסית — % מסך הסטים השבועי'}
          </div>
        </div>
        <button
          onClick={goalsMode === 'fixed' ? resetTargets : resetPercentsEqual}
          className="text-[11px] text-blue-500 dark:text-blue-400"
        >איפוס</button>
      </div>

      <div className="inline-flex items-center rounded-full p-0.5 mb-4 bg-slate-100 dark:bg-slate-900 text-[11px] font-semibold" dir="rtl">
        <button
          onClick={() => switchMode('fixed')}
          className={`px-3 py-1 rounded-full transition-colors ${goalsMode === 'fixed' ? 'bg-emerald-500 text-white' : 'text-muted'}`}
        >סטים קבועים</button>
        <button
          onClick={() => switchMode('percent')}
          className={`px-3 py-1 rounded-full transition-colors ${goalsMode === 'percent' ? 'bg-emerald-500 text-white' : 'text-muted'}`}
        >חלוקת אחוזים</button>
      </div>

      {loaded && goalsMode === 'fixed' && (
        <div className="space-y-4">
          {PARENT_ORDER.map(parent => {
            const info = PARENT_INFO[parent];
            const children = musclesByParent(parent);
            return (
              <div key={parent}>
                <div className="text-xs font-semibold text-right mb-1.5 pb-1 border-b border-subtle" dir="rtl">
                  {info.he}
                </div>
                <div className="space-y-1">
                  {children.map(m => (
                    <div key={m.id} className="flex items-center justify-between py-1" dir="rtl">
                      <div className="text-sm">{m.he}</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => changeTarget(m.id, -1)}
                          className="w-8 h-8 rounded-lg dark:bg-slate-800 bg-slate-200 text-muted text-lg leading-none"
                        >−</button>
                        <span className="font-mono text-sm w-8 text-center">{targets[m.id] || 0}</span>
                        <button
                          onClick={() => changeTarget(m.id, 1)}
                          className="w-8 h-8 rounded-lg dark:bg-slate-800 bg-slate-200 text-muted text-lg leading-none"
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loaded && goalsMode === 'percent' && (
        <>
          <div className="flex items-center justify-between mb-4 gap-3" dir="rtl">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">סה"כ סטים לשבוע</span>
              <button onClick={() => changeTotal(-5)} className="w-7 h-7 rounded-lg dark:bg-slate-800 bg-slate-200 text-muted">−</button>
              <span className="font-mono text-base font-bold w-10 text-center">{totalSets}</span>
              <button onClick={() => changeTotal(+5)} className="w-7 h-7 rounded-lg dark:bg-slate-800 bg-slate-200 text-muted">+</button>
            </div>
            <div
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                bank > 0
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              }`}
              title={bank > 0 ? 'זמין לחלוקה' : 'כל האחוזים מחולקים'}
            >
              {bank > 0 ? `בנק: ${Math.round(bank * 10) / 10}%` : 'מלא · 100%'}
            </div>
          </div>

          <div className="space-y-5">
            {PARENT_ORDER.map(parent => {
              const info = PARENT_INFO[parent];
              const children = musclesByParent(parent);
              const parentPct = children.reduce((s, m) => s + (percents[m.id] || 0), 0);
              const parentSets = Math.round(totalSets * parentPct / 100);
              return (
                <div key={parent}>
                  <PercentSlider
                    label={info.he}
                    pct={parentPct}
                    setsPreview={parentSets}
                    accent="group"
                    onChange={(v) => setGroupPercentValue(parent, v)}
                  />
                  <div className="mt-1 mr-3 space-y-1">
                    {children.map(m => {
                      const pct = percents[m.id] || 0;
                      const setsFromPct = Math.round(totalSets * pct / 100);
                      return (
                        <PercentSlider
                          key={m.id}
                          label={m.he}
                          pct={pct}
                          setsPreview={setsFromPct}
                          accent="muscle"
                          onChange={(v) => setPercentValue(m.id, v)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] text-muted-most mt-4 text-right leading-relaxed" dir="rtl">
            <span className="font-semibold">איך זה עובד:</span> כל שריר מתחיל ב-{Math.floor(100 / ACTIVE_MUSCLES.length)}%.
            גרירה למעלה שואבת קודם מהבנק, ואם הבנק ריק — לוקחת שווה מהשאר.
            גרירה למטה תמיד חוזרת לבנק. אפשר להזיז ברמת קבוצת שרירים או ברמת שריר בודד.
          </div>
        </>
      )}
    </div>
  );
}

function PercentSlider({
  label, pct, setsPreview, accent, onChange,
}: {
  label: string; pct: number; setsPreview: number; accent: 'group' | 'muscle'; onChange: (v: number) => void;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const alpha = 0.35 + (clamped / 100) * 0.65;
  const fillRgb = '16, 185, 129';
  const trackEmpty = 'rgba(148, 163, 184, 0.22)';
  const bg = `linear-gradient(to left, rgba(${fillRgb}, ${alpha}) 0%, rgba(${fillRgb}, ${alpha}) ${clamped}%, ${trackEmpty} ${clamped}%, ${trackEmpty} 100%)`;
  return (
    <div className={`${accent === 'group' ? 'py-1.5' : 'py-1'}`} dir="rtl">
      <div className={`flex items-baseline justify-between mb-1 ${accent === 'group' ? 'text-sm font-bold text-main' : 'text-xs text-main'}`}>
        <span className="truncate min-w-0 flex-1">{label}</span>
        <span className="shrink-0 font-mono ml-2 flex items-baseline gap-1.5">
          <span className={accent === 'group' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'}>{Math.round(clamped * 10) / 10}%</span>
          <span className="text-[9px] text-muted-most">·</span>
          <span className="text-[9px] text-muted-most">≈{setsPreview}</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`pct-slider w-full cursor-pointer ${accent === 'group' ? 'h-2.5' : 'h-1.5'}`}
        style={{ background: bg }}
      />
    </div>
  );
}
