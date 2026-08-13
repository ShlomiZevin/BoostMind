import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route, UserProfile } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { PARENT_INFO, musclesByParent, ACTIVE_MUSCLES, DEFAULT_WEEKLY_TARGETS } from '../data/muscles';
import type { MuscleGroup, MuscleParent } from '../data/muscles';
import { TopBar } from './TopBar';
import { CloseAction } from './TopBarActions';
import { auth } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';

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

      <ProfileCard uid={uid} />

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

      <ForgetMeCard onLogout={onLogout} />

      <div className="card mb-4">
        <div className="flex items-center justify-between" dir="rtl">
          <div className="text-right">
            <div className="font-medium">החלף משתמש</div>
            <div className="text-xs text-muted">התנתק והכנס עם חשבון Google אחר</div>
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

// ─── Profile card ─────────────────────────────────────────────────
// Same fields the onboarding chat collects. User can edit directly here, OR
// keep chatting with the AI trainer which can also update these fields. The
// "פתח מחדש את שאלון האונבורדינג" button clears the completion flag and reloads
// so the onboarding gate re-triggers.
type Level = NonNullable<UserProfile['level']>;
type Goal  = NonNullable<UserProfile['goal']>;
const LEVEL_HE: Record<Level, string> = { beginner: 'מתחיל', intermediate: 'בינוני', advanced: 'מתקדם' };
const GOAL_HE:  Record<Goal,  string> = { mass: 'מסה', cut: 'חיטוב', strength: 'כוח', health: 'בריאות' };

function ProfileCard({ uid }: { uid: string }) {
  const firestore = useFirestore(uid);
  const [profile, setProfile] = useState<UserProfile>({});
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    firestore.getUserProfile().then(p => { setProfile(p); setLoaded(true); }).catch(() => setLoaded(true));
  }, [uid]);

  async function patch(p: Partial<UserProfile>) {
    const merged = await firestore.updateUserProfile(p);
    setProfile(merged);
  }

  async function reopenOnboarding() {
    // Two-step: (1) blow away the "completed" flag so the wizard is a candidate again,
    // (2) set forceOnboarding so shouldShowOnboarding returns true regardless of the
    // legacy "has any data" heuristic. Reload lets AuthedShell re-probe cleanly.
    await firestore.updateUserProfile({ onboardingCompletedAt: 0 as any, forceOnboarding: true });
    window.location.reload();
  }

  const filled: string[] = [];
  if (profile.name) filled.push(profile.name);
  if (profile.level) filled.push(LEVEL_HE[profile.level]);
  if (profile.goal) filled.push(GOAL_HE[profile.goal]);
  if (profile.daysPerWeek) filled.push(`${profile.daysPerWeek} ימים/שבוע`);

  return (
    <div className="card mb-4" dir="rtl">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-right"
      >
        <div>
          <div className="font-medium">פרופיל אישי</div>
          <div className="text-xs text-muted">
            {!loaded ? '...טוען' : filled.length > 0 ? filled.join(' · ') : 'עוד לא הוגדר — לחץ להגדרה או דבר עם המאמן'}
          </div>
        </div>
        <span className="text-muted text-lg">{expanded ? '▾' : '←'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">שם</label>
            <input
              type="text"
              value={profile.name || ''}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              onBlur={e => patch({ name: e.target.value.trim() || undefined })}
              placeholder="—"
              className="input-field w-full !text-right"
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">רמה</label>
            <div className="flex gap-2">
              {(Object.keys(LEVEL_HE) as Level[]).map(k => (
                <button
                  key={k}
                  onClick={() => patch({ level: k })}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                    profile.level === k
                      ? 'bg-emerald-500 text-white'
                      : 'dark:bg-slate-800 bg-slate-100 text-main'
                  }`}
                >{LEVEL_HE[k]}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">מטרה</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(GOAL_HE) as Goal[]).map(k => (
                <button
                  key={k}
                  onClick={() => patch({ goal: k })}
                  className={`py-2 rounded-lg text-sm font-semibold ${
                    profile.goal === k
                      ? 'bg-emerald-500 text-white'
                      : 'dark:bg-slate-800 bg-slate-100 text-main'
                  }`}
                >{GOAL_HE[k]}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">ימים בשבוע</label>
            <div className="grid grid-cols-6 gap-2">
              {[2, 3, 4, 5, 6, 7].map(n => (
                <button
                  key={n}
                  onClick={() => patch({ daysPerWeek: n as 2 | 3 | 4 | 5 | 6 | 7 })}
                  className={`py-2 rounded-lg text-sm font-semibold ${
                    profile.daysPerWeek === n
                      ? 'bg-emerald-500 text-white'
                      : 'dark:bg-slate-800 bg-slate-100 text-main'
                  }`}
                >{n}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">מגבלות / פציעות</label>
            <textarea
              value={profile.limitations || ''}
              onChange={e => setProfile(p => ({ ...p, limitations: e.target.value }))}
              onBlur={e => patch({ limitations: e.target.value.trim() || undefined })}
              placeholder="אין"
              rows={2}
              className="w-full text-[13px] rounded-xl border border-subtle bg-transparent p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none text-right"
              dir="rtl"
            />
          </div>

          <div className="pt-3 border-t border-subtle">
            <button
              onClick={reopenOnboarding}
              className="w-full py-3 rounded-xl inline-flex items-center justify-center gap-2 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_3px_10px_-2px_rgba(16,185,129,0.5)] transition-colors"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
              </svg>
              <span>פתח את שיחת ההכרות עם המאמן</span>
            </button>
            <p className="text-[10px] text-muted-most text-center mt-2">
              המאמן AI יזכור שיחות קודמות ויכול גם לעדכן שדות פרופיל דרך שיחה חופשית
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── "שכח אותי" — destructive wipe + logout ────────────────────────
// Deletes every subcollection under users/{uid}/*, the profile doc, and any
// authAlias binding. Signs the user out and reloads to the login screen.
// Hard-guarded against wiping protected uids (see wipeAllUserData). Requires
// the user to TYPE their email to confirm — no accidental blast-radius.
function ForgetMeCard({ onLogout }: { onLogout: () => void }) {
  const { uid, rawAuthUid, email } = useAuth();
  const firestore = useFirestore(uid || '');
  const [expanded, setExpanded] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const matches = !!email && typed.trim().toLowerCase() === email.toLowerCase();

  async function forgetMe() {
    if (busy || !uid) return;
    if (!matches) { setErr('הקלד את המייל שלך במלואו כדי לאשר'); return; }
    setBusy(true); setErr(null);
    try {
      await firestore.wipeAllUserData(rawAuthUid);
      onLogout();
      // Sign-out is async but useAuth listens; force a reload to be safe so the
      // whole tree remounts against a clean state.
      setTimeout(() => window.location.reload(), 400);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="card mb-4 border border-red-500/30" dir="rtl">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-right"
      >
        <div>
          <div className="font-medium text-red-600 dark:text-red-400">שכח אותי (מחק חשבון)</div>
          <div className="text-xs text-muted">
            מוחק את כל הנתונים שלך ומתנתק. פעולה בלתי הפיכה.
          </div>
        </div>
        <span className="text-muted text-lg">{expanded ? '▾' : '←'}</span>
      </button>
      {expanded && (
        <div className="mt-4 space-y-3 text-right">
          <div className="text-[11px] text-muted bg-red-500/5 border border-red-500/20 rounded-lg p-3 leading-relaxed">
            <div className="font-bold text-red-600 dark:text-red-400 mb-1">⚠️ מחיקה מלאה</div>
            <div>ימחקו כל האימונים, התוכניות, הפרופיל, השיחות עם המאמן והתמונות שהעלית.</div>
            <div>לא ניתן לשחזר. מאגר התרגילים המשותף לא יושפע.</div>
          </div>
          <div className="text-[10px] text-muted-most bg-slate-500/5 rounded-lg p-2">
            <div>מייל: <span dir="ltr">{email || '(ללא)'}</span></div>
            <div>מזהה: <span dir="ltr" className="font-mono text-[10px]">{uid || '?'}</span></div>
          </div>
          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">
              כדי לאשר, הקלד את המייל שלך:
            </label>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={email || ''}
              className="input-field w-full"
              dir="ltr"
              autoComplete="off"
            />
          </div>
          {err && <div className="text-xs text-red-500">{err}</div>}
          <button
            onClick={forgetMe}
            disabled={busy || !matches}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${
              matches && !busy
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'dark:bg-slate-800 dark:text-slate-600 bg-slate-200 text-slate-400'
            }`}
          >{busy ? '...מוחק' : 'מחק את החשבון ואת כל הנתונים והתנתק'}</button>
        </div>
      )}
    </div>
  );
}
