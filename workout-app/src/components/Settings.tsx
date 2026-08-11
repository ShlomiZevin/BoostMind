import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { PARENT_INFO, musclesByParent, ACTIVE_MUSCLES, DEFAULT_WEEKLY_TARGETS } from '../data/muscles';
import type { MuscleGroup, MuscleParent } from '../data/muscles';
import { TopBar } from './TopBar';
import { CloseAction } from './TopBarActions';

type GoalsMode = 'fixed' | 'percent';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
  onLogout: () => void;
};

const PARENT_ORDER: MuscleParent[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

export function Settings({ uid, navigate, onLogout }: Props) {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const firestore = useFirestore(uid);
  const [targets, setTargets] = useState<Record<MuscleGroup, number>>({ ...DEFAULT_WEEKLY_TARGETS });
  const [loaded, setLoaded] = useState(false);

  // Percent-mode state
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
      // First time entering percent mode with nothing stored → equal split for everyone,
      // total defaults to sum of the fixed targets so switching is a no-op numerically.
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

  const percentSum = useMemo(() => Object.values(percents).reduce((s: number, v) => s + (v || 0), 0), [percents]);
  const bank = Math.max(0, 100 - percentSum);

  // Debounce firestore writes when dragging sliders — otherwise we'd write dozens per second.
  const saveTimer = useRef<any>(null);
  function saveDebounced(next: Partial<Record<MuscleGroup, number>>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      firestore.setGoalsConfig({ percents: next });
    }, 250);
  }

  function toggleTheme() {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('bg-slate-950', 'text-slate-100');
      document.body.classList.add('bg-slate-50', 'text-slate-900');
      localStorage.setItem('workout-theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      document.body.classList.remove('bg-slate-50', 'text-slate-900');
      document.body.classList.add('bg-slate-950', 'text-slate-100');
      localStorage.setItem('workout-theme', 'dark');
      setIsDark(true);
    }
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

  // Round percents and snap tiny FP drift to 0.
  function normalize(next: Partial<Record<MuscleGroup, number>>) {
    for (const k of Object.keys(next) as MuscleGroup[]) {
      const v = Math.round((next[k] || 0) * 10) / 10;
      next[k] = v < 0.05 ? 0 : v;
    }
    return next;
  }

  // Bank-aware "set X to targetPct".
  //   Increase → consume from bank first; residue taken equally from ALL OTHER muscles.
  //   Decrease → the diff returns to the bank; nothing else changes (you can reallocate later).
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

  // Set the PARENT (muscle-group) total. Children inside the group are adjusted proportionally
  // to their current split. If they're all zero, split equally among the children.
  // Extra/shortfall between OTHER groups follows the same bank-then-equal-take rule.
  function setGroupPercentValue(parent: MuscleParent, targetPct: number) {
    const children = musclesByParent(parent);
    const currentSum = children.reduce((s, m) => s + (percents[m.id] || 0), 0);
    const delta = targetPct - currentSum;
    if (Math.abs(delta) < 0.05) return;
    let next = { ...percents };

    if (delta < 0) {
      // Reduce children proportionally
      const reduce = -delta;
      const totalChild = children.reduce((s, m) => s + (next[m.id] || 0), 0);
      if (totalChild > 0.0001) {
        for (const m of children) {
          const share = (next[m.id] || 0) / totalChild * reduce;
          next[m.id] = Math.max(0, (next[m.id] || 0) - share);
        }
      }
    } else {
      // Take from bank first, then equally from OTHER PARENTS' muscles
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

      // Distribute the amount we got into this parent's children
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
    <div className="page-bg min-h-screen">
      <TopBar
        title="הגדרות"
        accent="brand"
        tint="amber"
        actions={<CloseAction navigate={navigate} />}
      />
      <div className="p-4 pb-4 max-w-lg mx-auto">

      <div className="card mb-4">
        <div className="flex items-center justify-between" dir="rtl">
          <div className="text-right">
            <div className="font-medium">מצב תצוגה</div>
            <div className="text-xs text-muted">חשוך / בהיר</div>
          </div>
          <button onClick={toggleTheme} className="btn-secondary px-4 py-2 text-sm">
            {isDark ? '☀️ בהיר' : '🌙 חשוך'}
          </button>
        </div>
      </div>

      <button
        onClick={() => navigate({ page: 'exercises' })}
        className="w-full card mb-4 dark:hover:bg-slate-800 hover:bg-slate-50"
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <div className="text-right">
            <div className="font-medium">התרגילים שלי</div>
            <div className="text-xs text-muted">ניהול תרגילים, תמונות, שמות וכינויים</div>
          </div>
          <span className="text-muted text-lg">←</span>
        </div>
      </button>

      <button
        onClick={() => navigate({ page: 'install' })}
        className="w-full card mb-4 dark:hover:bg-slate-800 hover:bg-slate-50"
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <div className="text-right flex-1 min-w-0">
            <div className="font-medium flex items-center gap-2">
              <span>התקנה למסך הבית</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 uppercase tracking-widest">PWA</span>
            </div>
            <div className="text-xs text-muted">הוראות ל-iPhone ול-Android — פותח כאפליקציה מלאה</div>
          </div>
          <span className="text-muted text-lg">←</span>
        </div>
      </button>

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

        {/* Mode toggle */}
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
            {/* Total sets + bank strip */}
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

            {/* Percent sliders — group + per-muscle. Drag any bar to move %; bank/other groups adjust. */}
            <div className="space-y-5">
              {PARENT_ORDER.map(parent => {
                const info = PARENT_INFO[parent];
                const children = musclesByParent(parent);
                const parentPct = children.reduce((s, m) => s + (percents[m.id] || 0), 0);
                const parentSets = Math.round(totalSets * parentPct / 100);
                return (
                  <div key={parent}>
                    {/* Group-level slider */}
                    <PercentSlider
                      label={info.he}
                      pct={parentPct}
                      setsPreview={parentSets}
                      accent="group"
                      onChange={(v) => setGroupPercentValue(parent, v)}
                    />
                    {/* Per-muscle sliders */}
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

      <div className="card mb-4">
        <div className="flex items-center justify-between" dir="rtl">
          <div className="text-right">
            <div className="font-medium">החלף משתמש</div>
            <div className="text-xs text-muted">התנתק והכנס עם סיסמה אחרת</div>
          </div>
          <button onClick={onLogout} className="btn-secondary px-4 py-2 text-sm text-red-500">
            התנתק
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Slider row used in percent-mode goals ────────────────────
// Native <input type="range"> with a hand-painted fill:
//   • Colored bar from start (right, since dir=rtl) up to the current value
//   • Empty track (light slate) beyond the thumb
//   • Alpha ramps 0.35 → 1.0 with the value, so bigger = bolder
function PercentSlider({
  label, pct, setsPreview, accent, onChange,
}: {
  label: string; pct: number; setsPreview: number; accent: 'group' | 'muscle'; onChange: (v: number) => void;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const alpha = 0.35 + (clamped / 100) * 0.65;
  // Emerald fill for groups (loud), a slightly cooler emerald for individual muscles (still consistent).
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
