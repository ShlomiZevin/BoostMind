import { useEffect, useRef, useState } from 'react';
import type { DietProfile, Route, UserProfile } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { CloseAction } from './TopBarActions';
import { ACTIVITY_LEVELS, bmrOf, suggestedTargetOf, tdeeOf } from '../data/diet';

type Props = { uid: string; navigate: (r: Route) => void };

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

// MVP collects the profile as a plain form. It unblocks the calorie target with
// no AI dependency; the guided first-entry chat (mirroring the exercise
// onboarding) lands with the dietary coach, and this stays as the edit surface.
export function FoodSettings({ uid, navigate }: Props) {
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  const [diet, setDiet] = useState<DietProfile>({});
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    firestoreRef.current.getUserProfile()
      .then((p: UserProfile) => { if (!cancelled) { setDiet(p.diet || {}); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [uid]);

  async function patch(next: Partial<DietProfile>) {
    const merged = { ...diet, ...next };
    setDiet(merged);
    await firestoreRef.current.updateDietProfile({ ...next, enabled: true });
    setSavedAt(Date.now());
  }

  const bmr = bmrOf(diet);
  const tdee = tdeeOf(diet);
  const suggested = suggestedTargetOf(diet);
  const usingManual = !!diet.dailyCalorieTargetManual && !!diet.dailyCalorieTarget;
  const shownTarget = usingManual ? diet.dailyCalorieTarget! : (suggested ?? 0);

  const numField = (
    label: string,
    key: 'weightKg' | 'heightCm' | 'age',
    unit: string,
  ) => (
    <div className="flex items-center gap-2">
      <span className="text-[13px] flex-1">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={diet[key] ?? ''}
        onChange={e => {
          const n = Number(e.target.value);
          void patch({ [key]: Number.isFinite(n) && n > 0 ? n : undefined } as Partial<DietProfile>);
        }}
        className="w-20 input-field py-1.5 text-base"
      />
      <span className="text-[11px] text-muted w-8">{unit}</span>
    </div>
  );

  return (
    <div className="page-bg min-h-screen">
      <TopBar title="הגדרות תזונה" accent="brand" tint="amber" actions={<CloseAction navigate={navigate} />} />
      <div className="max-w-lg mx-auto p-4 space-y-4 pb-24" dir="rtl">
        {!loaded ? (
          <div className="text-[12px] text-muted py-8 text-center">טוען…</div>
        ) : (
          <>
            {/* Goal */}
            <div className="card space-y-2.5">
              <h2 className="text-[12px] font-bold text-muted">המטרה שלי</h2>
              <div className="flex gap-1.5">
                {GOALS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => void patch({ goal: g.id })}
                    className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold ${
                      diet.goal === g.id ? 'bg-amber-500 text-white' : 'bg-subtle text-muted'
                    }`}
                  >{g.he}</button>
                ))}
              </div>
            </div>

            {/* Body stats */}
            <div className="card space-y-3">
              <h2 className="text-[12px] font-bold text-muted">נתונים</h2>
              {numField('משקל', 'weightKg', 'ק״ג')}
              {numField('גובה', 'heightCm', 'ס״מ')}
              {numField('גיל', 'age', 'שנים')}
              <div className="flex items-center gap-2">
                <span className="text-[13px] flex-1">מין</span>
                <div className="flex gap-1.5">
                  {GENDERS.map(g => (
                    <button
                      key={g.id}
                      onClick={() => void patch({ gender: g.id })}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${
                        diet.gender === g.id ? 'bg-amber-500 text-white' : 'bg-subtle text-muted'
                      }`}
                    >{g.he}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity */}
            <div className="card space-y-2.5">
              <h2 className="text-[12px] font-bold text-muted">רמת פעילות</h2>
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_LEVELS.map(a => (
                  <button
                    key={a.value}
                    onClick={() => void patch({ activityMultiplier: a.value })}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${
                      (diet.activityMultiplier || 1.375) === a.value ? 'bg-amber-500 text-white' : 'bg-subtle text-muted'
                    }`}
                  >{a.he}</button>
                ))}
              </div>
            </div>

            {/* Target */}
            <div className="card space-y-2.5">
              <h2 className="text-[12px] font-bold text-muted">יעד קלורי יומי</h2>
              {bmr == null ? (
                <div className="text-[12px] text-muted">
                  מלא משקל, גובה וגיל כדי לחשב יעד אוטומטי — או קבע מספר ידנית למטה.
                </div>
              ) : (
                <div className="text-[11px] text-muted">
                  BMR <span className="font-mono" dir="ltr">{bmr}</span>
                  {' · '}TDEE <span className="font-mono" dir="ltr">{tdee}</span>
                  {diet.goal === 'lose' && ' · פחות 500 ליעד ירידה'}
                  {diet.goal === 'gain' && ' · ועוד 300 ליעד עלייה'}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void patch({ dailyCalorieTarget: Math.max(1000, (shownTarget || 1800) - 50), dailyCalorieTargetManual: true })}
                  className="w-10 h-10 rounded-xl bg-subtle text-lg font-bold"
                >−</button>
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold font-mono" dir="ltr">{shownTarget || '—'}</div>
                  <div className="text-[10px] text-muted">{usingManual ? 'ידני' : 'מחושב'}</div>
                </div>
                <button
                  onClick={() => void patch({ dailyCalorieTarget: (shownTarget || 1800) + 50, dailyCalorieTargetManual: true })}
                  className="w-10 h-10 rounded-xl bg-subtle text-lg font-bold"
                >+</button>
              </div>
              {usingManual && suggested != null && (
                <button
                  onClick={() => void patch({ dailyCalorieTargetManual: false })}
                  className="w-full text-[12px] text-amber-600 dark:text-amber-400 py-1"
                >
                  חזור לחישוב אוטומטי ({suggested})
                </button>
              )}
            </div>

            {/* Craving control */}
            <div className="card space-y-2">
              <h2 className="text-[12px] font-bold text-muted">שליטה בדחפים</h2>
              {([
                { key: 'avoidSugar' as const, he: '🍬 הימנע מסוכר' },
                { key: 'avoidEmptyCarbs' as const, he: '🍞 הימנע מפחמימות ריקות' },
              ]).map(t => (
                <button
                  key={t.key}
                  onClick={() => void patch({ [t.key]: !diet[t.key] } as Partial<DietProfile>)}
                  className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-[13px] font-semibold ${
                    diet[t.key] ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-subtle text-muted'
                  }`}
                >
                  <span>{t.he}</span>
                  <span>{diet[t.key] ? '✓' : ''}</span>
                </button>
              ))}
            </div>

            {/* Constraints */}
            <div className="card space-y-2">
              <h2 className="text-[12px] font-bold text-muted">מגבלות</h2>
              <textarea
                value={diet.constraints || ''}
                onChange={e => setDiet({ ...diet, constraints: e.target.value })}
                onBlur={() => void patch({ constraints: diet.constraints })}
                placeholder="צמחוני, אלרגי לבוטנים, ללא גלוטן…"
                rows={2}
                className="w-full bg-subtle rounded-xl px-3 py-2 text-sm resize-none focus:outline-none"
              />
            </div>

            {savedAt > 0 && (
              <div className="text-center text-[11px] text-emerald-600 dark:text-emerald-400">✓ נשמר</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
