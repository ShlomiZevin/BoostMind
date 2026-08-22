import { useEffect, useRef, useState } from 'react';
import type { DietProfile, UserProfile } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { ACTIVITY_LEVELS, bmrOf, suggestedTargetOf, tdeeOf } from '../data/diet';
import { CalorieMathModal } from './CalorieMathModal';

// Collapsible diet-profile card. Same shape as the training ProfileCard
// (summary line when collapsed, full form when expanded) so switching
// between אימונים and תזונה feels like the same screen with different
// content — that was the misalignment complaint. Used in two places:
//   • FoodSettings (top)   — primary edit surface for the profile
//   • FoodInsights (top)   — quick access while looking at the calories
//                            tab, mirroring how גוף shows the training profile

const GOALS: { id: NonNullable<DietProfile['goal']>; he: string }[] = [
  { id: 'lose', he: 'לרדת' },
  { id: 'maintain', he: 'לשמור' },
  { id: 'gain', he: 'לעלות' },
];

const GENDERS: { id: NonNullable<DietProfile['gender']>; he: string }[] = [
  { id: 'male', he: 'גבר' },
  { id: 'female', he: 'אישה' },
  { id: 'other', he: 'אחר' },
];

const GOAL_HE: Record<NonNullable<DietProfile['goal']>, string> = {
  lose: 'לרדת', maintain: 'לשמור', gain: 'לעלות',
};

// bg-subtle is slate-900/50, and .card is slate-900 — so in dark mode every
// unselected control here sat at almost exactly the card's own colour and
// vanished. The form read as loose text with a few amber words in it, and you
// could not tell what was a button. These give every control a surface you can
// actually see, in both themes. Borders on BOTH states so nothing shifts by a
// pixel when the selection moves.
const CHIP = 'border transition-colors';
const CHIP_OFF = 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300';
const CHIP_ON = 'bg-amber-500 border-amber-500 text-white';
/** Same surface, for things that are containers rather than choices. */
const SURFACE = 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700';
/** Group labels — were 11px slate-300 and read as noise between the controls. */
const GROUP_LABEL = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export function DietProfileCard({ uid, defaultExpanded }: { uid: string; defaultExpanded?: boolean }) {
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  const [diet, setDiet] = useState<DietProfile>({});
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  const [savedAt, setSavedAt] = useState(0);
  const [mathOpen, setMathOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    firestoreRef.current.getUserProfile()
      .then((p: UserProfile) => { if (!cancelled) { setDiet(p.diet || {}); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [uid]);

  // Cravings toggles pass `quiet` — the check flips visibly and there is no
  // ambiguity about whether it stuck, so a "נשמר" toast on top is just noise.
  async function patchDiet(next: Partial<DietProfile>, opts?: { quiet?: boolean }) {
    const merged = { ...diet, ...next };
    setDiet(merged);
    await firestoreRef.current.updateDietProfile({ ...next, enabled: true });
    if (!opts?.quiet) setSavedAt(Date.now());
  }

  const bmr = bmrOf(diet);
  const tdee = tdeeOf(diet);
  const suggested = suggestedTargetOf(diet);
  const usingManual = !!diet.dailyCalorieTargetManual && !!diet.dailyCalorieTarget;
  const shownTarget = usingManual ? diet.dailyCalorieTarget! : (suggested ?? 0);

  // One-line summary for the collapsed state — the numbers you look up most
  // often (target, goal), then the raw inputs.
  const summary: string[] = [];
  if (shownTarget) summary.push(`${shownTarget} קק"ל/יום`);
  if (diet.goal) summary.push(GOAL_HE[diet.goal]);
  const size: string[] = [];
  if (diet.weightKg) size.push(`${diet.weightKg} ק״ג`);
  if (diet.heightCm) size.push(`${diet.heightCm} ס״מ`);
  if (diet.age) size.push(`${diet.age}`);
  if (size.length) summary.push(size.join(' · '));

  const numField = (label: string, key: 'weightKg' | 'heightCm' | 'age', unit: string) => (
    <div className="flex items-center gap-2">
      <span className="text-[13px] flex-1">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={diet[key] ?? ''}
        onChange={e => {
          const n = Number(e.target.value);
          void patchDiet({ [key]: Number.isFinite(n) && n > 0 ? n : undefined } as Partial<DietProfile>);
        }}
        className="w-20 input-field py-1.5 text-base"
      />
      <span className="text-[11px] text-muted w-8">{unit}</span>
    </div>
  );

  return (
    <div className="card mb-4" dir="rtl">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-right"
      >
        <div className="min-w-0">
          <div className="font-medium">פרופיל תזונה</div>
          <div className="text-xs text-muted truncate">
            {!loaded ? '...טוען' : summary.length > 0 ? summary.join(' · ') : 'עוד לא הוגדר — לחץ להגדרה'}
          </div>
        </div>
        <span className="text-muted text-lg shrink-0">{expanded ? '▾' : '←'}</span>
      </button>

      {expanded && loaded && (
        <div className="mt-4 space-y-4">
          {/* Goal */}
          <div>
            <label className={`${GROUP_LABEL} mb-1.5`}>המטרה שלי</label>
            <div className="flex gap-1.5">
              {GOALS.map(g => (
                <button
                  key={g.id}
                  onClick={() => void patchDiet({ goal: g.id })}
                  className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold ${CHIP} ${
                    diet.goal === g.id ? CHIP_ON : CHIP_OFF
                  }`}
                >{g.he}</button>
              ))}
            </div>
          </div>

          {/* Body stats */}
          <div className="space-y-3">
            <label className={GROUP_LABEL}>נתונים</label>
            {numField('משקל', 'weightKg', 'ק״ג')}
            {numField('גובה', 'heightCm', 'ס״מ')}
            {numField('גיל', 'age', 'שנים')}
            <div className="flex items-center gap-2">
              <span className="text-[13px] flex-1">מין</span>
              <div className="flex gap-1.5">
                {GENDERS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => void patchDiet({ gender: g.id })}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${CHIP} ${
                      diet.gender === g.id ? CHIP_ON : CHIP_OFF
                    }`}
                  >{g.he}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Activity */}
          <div>
            <label className={`${GROUP_LABEL} mb-1.5`}>רמת פעילות</label>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_LEVELS.map(a => (
                <button
                  key={a.value}
                  onClick={() => void patchDiet({ activityMultiplier: a.value })}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${CHIP} ${
                    (diet.activityMultiplier || 1.375) === a.value ? CHIP_ON : CHIP_OFF
                  }`}
                >{a.he}</button>
              ))}
            </div>
          </div>

          {/* Target — improved BMR/TDEE visual (was a muted single line, now a
              two-stat mini-grid so the driving numbers read as data, not
              footnote). */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className={GROUP_LABEL}>יעד קלורי יומי</label>
              {/* The whole point of BMR/TDEE/מחושב is that the number is
                  derived, not decided. One tap shows the derivation; it costs
                  no permanent space on a screen that is already dense. */}
              <button
                onClick={() => setMathOpen(true)}
                aria-label="איך היעד מחושב"
                className="w-[18px] h-[18px] rounded-full border border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-none flex items-center justify-center"
              >?</button>
            </div>

            {bmr == null ? (
              <div className="text-[12px] text-muted mb-2">
                מלא משקל, גובה וגיל כדי לחשב יעד אוטומטי — או קבע מספר ידנית למטה.
              </div>
            ) : (
              <div className="flex items-stretch gap-2 mb-2" dir="ltr">
                <div className={`flex-1 rounded-lg ${SURFACE} px-2.5 py-1.5 text-center`}>
                  <div className="text-[9px] text-muted font-bold tracking-widest">BMR</div>
                  <div className="text-[15px] font-bold font-mono">{bmr}</div>
                </div>
                <div className={`flex-1 rounded-lg ${SURFACE} px-2.5 py-1.5 text-center`}>
                  <div className="text-[9px] text-muted font-bold tracking-widest">TDEE</div>
                  <div className="text-[15px] font-bold font-mono">{tdee}</div>
                </div>
                {(diet.goal === 'lose' || diet.goal === 'gain') && (
                  <div className={`flex-1 rounded-lg border px-2.5 py-1.5 text-center ${
                    diet.goal === 'lose'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                  }`}>
                    <div className="text-[9px] font-bold tracking-widest opacity-70">
                      {diet.goal === 'lose' ? 'DEFICIT' : 'SURPLUS'}
                    </div>
                    <div className="text-[15px] font-bold font-mono" dir="ltr">
                      {diet.goal === 'lose' ? '−500' : '+300'}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => void patchDiet({ dailyCalorieTarget: Math.max(1000, (shownTarget || 1800) - 50), dailyCalorieTargetManual: true })}
                className={`w-10 h-10 rounded-xl text-lg font-bold ${SURFACE}`}
              >−</button>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold font-mono" dir="ltr">{shownTarget || '—'}</div>
                {usingManual ? (
                  <div className="text-[10px] text-muted">ידני</div>
                ) : (
                  <button
                    onClick={() => setMathOpen(true)}
                    className="text-[10px] text-muted underline underline-offset-2 decoration-dotted"
                  >מחושב</button>
                )}
              </div>
              <button
                onClick={() => void patchDiet({ dailyCalorieTarget: (shownTarget || 1800) + 50, dailyCalorieTargetManual: true })}
                className={`w-10 h-10 rounded-xl text-lg font-bold ${SURFACE}`}
              >+</button>
            </div>
            {usingManual && suggested != null && (
              <button
                onClick={() => void patchDiet({ dailyCalorieTargetManual: false })}
                className="w-full text-[12px] text-amber-600 dark:text-amber-400 py-1 mt-1"
              >
                חזור לחישוב אוטומטי ({suggested})
              </button>
            )}
          </div>

          {/* Craving control — cravings toggle passes {quiet:true} so it does
              not fire the "נשמר" toast (the ✓ on the row is the confirmation). */}
          <div className="space-y-2">
            <label className={GROUP_LABEL}>שליטה בדחפים</label>
            {([
              { key: 'avoidSugar' as const, he: '🍬 הימנע מסוכר' },
              { key: 'avoidEmptyCarbs' as const, he: '🍞 הימנע מפחמימות ריקות' },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => void patchDiet({ [t.key]: !diet[t.key] } as Partial<DietProfile>, { quiet: true })}
                className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-[13px] font-semibold ${CHIP} ${
                  diet[t.key]
                    ? 'bg-amber-500/15 border-amber-500/45 text-amber-700 dark:text-amber-300'
                    : CHIP_OFF
                }`}
              >
                <span>{t.he}</span>
                <span>{diet[t.key] ? '✓' : ''}</span>
              </button>
            ))}
          </div>

          {/* Constraints */}
          <div className="space-y-2">
            <label className={GROUP_LABEL}>מגבלות</label>
            <textarea
              value={diet.constraints || ''}
              onChange={e => setDiet({ ...diet, constraints: e.target.value })}
              onBlur={() => void patchDiet({ constraints: diet.constraints })}
              placeholder="צמחוני, אלרגי לבוטנים, ללא גלוטן…"
              rows={2}
              className={`w-full rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-500 ${SURFACE}`}
            />
          </div>

          {savedAt > 0 && (
            <div className="text-center text-[11px] text-emerald-600 dark:text-emerald-400">✓ נשמר</div>
          )}
        </div>
      )}

      {mathOpen && <CalorieMathModal diet={diet} onClose={() => setMathOpen(false)} />}
    </div>
  );
}
