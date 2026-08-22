import type { DietProfile } from '../types';
import { ACTIVITY_LEVELS, bmrOf, suggestedTargetOf, tdeeOf } from '../data/diet';

// "מחושב" is a single number with three steps hidden behind it. Rather than a
// textbook definition of BMR and TDEE, this shows the arithmetic with the
// user's OWN values substituted in — the same numbers they can see on the card
// behind the sheet. A generic formula would explain the concept; this explains
// their number, which is what they actually asked.
//
// Kept as a sheet you open and dismiss: the explanation is worth reading once,
// and worth zero permanent space on the screen.

const GOAL_STEP: Record<NonNullable<DietProfile['goal']>, { he: string; delta: string }> = {
  lose: { he: 'לרדת', delta: '− 500' },
  maintain: { he: 'לשמור', delta: '± 0' },
  gain: { he: 'לעלות', delta: '+ 300' },
};

function Row({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-5 h-5 mt-0.5 shrink-0 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold mb-1">{title}</div>
        {children}
      </div>
    </div>
  );
}

/** The arithmetic itself. LTR because it is maths, inside an RTL sheet. */
function Math_({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="ltr"
      className="font-mono text-[12px] leading-relaxed rounded-lg border border-subtle bg-slate-100 dark:bg-slate-800 px-2.5 py-2 overflow-x-auto whitespace-nowrap"
    >
      {children}
    </div>
  );
}

export function CalorieMathModal({ diet, onClose }: { diet: DietProfile; onClose: () => void }) {
  const bmr = bmrOf(diet);
  const tdee = tdeeOf(diet);
  const suggested = suggestedTargetOf(diet);

  const w = diet.weightKg;
  const h = diet.heightCm;
  const age = diet.age;
  const mult = diet.activityMultiplier || 1.375;
  const activityHe = ACTIVITY_LEVELS.find(a => a.value === mult)?.he || '';
  const goal = diet.goal || 'maintain';

  // The gender term of Mifflin-St Jeor. 'other'/unset averages the two rather
  // than silently picking one — worth being honest about here.
  const genderTerm = diet.gender === 'female' ? '− 161' : diet.gender === 'male' ? '+ 5' : '− 78';
  const genderNote =
    diet.gender === 'female' ? 'אישה' : diet.gender === 'male' ? 'גבר' : 'ממוצע בין שתי הנוסחאות';

  const haveAll = bmr != null && w && h && age;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center dark:bg-black/70 bg-black/40"
      onClick={onClose}
    >
      <div
        className="overlay-solid w-full max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border border-subtle p-4 pb-[max(env(safe-area-inset-bottom),1rem)] max-h-[88dvh] overflow-y-auto"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold">איך היעד מחושב</h3>
          <button onClick={onClose} aria-label="סגור" className="text-muted text-2xl leading-none">×</button>
        </div>
        <p className="text-[12px] text-muted mb-4">שלושה שלבים, עם המספרים שלך.</p>

        {!haveAll ? (
          <div className="text-[13px] text-muted leading-relaxed">
            כדי לחשב יעד צריך משקל, גובה וגיל. אחרי שתמלא אותם, כאן יופיע החישוב המלא עם המספרים שלך.
          </div>
        ) : (
          <div className="space-y-4">
            <Row n={1} title="BMR — מה הגוף שורף במנוחה">
              <p className="text-[12px] text-muted mb-1.5 leading-relaxed">
                הקלוריות שהגוף צורך רק כדי להתקיים — נשימה, לב, חום גוף — בלי לזוז בכלל.
                לפי נוסחת Mifflin-St Jeor.
              </p>
              <Math_>
                10 × {w} + 6.25 × {h} − 5 × {age} {genderTerm} = <b>{bmr}</b>
              </Math_>
              <div className="text-[11px] text-muted-more mt-1">
                ק״ג · ס״מ · שנים · {genderNote}
              </div>
            </Row>

            <Row n={2} title="TDEE — כמה אתה שורף ביום בפועל">
              <p className="text-[12px] text-muted mb-1.5 leading-relaxed">
                ה-BMR מוכפל במקדם שמייצג כמה אתה זז ביום־יום.
              </p>
              <Math_>
                {bmr} × {mult} = <b>{tdee}</b>
              </Math_>
              <div className="text-[11px] text-muted-more mt-1">
                {activityHe ? `רמת הפעילות שבחרת: ${activityHe} (${mult})` : `מקדם ${mult}`}
              </div>
            </Row>

            <Row n={3} title="היעד — TDEE בתוספת המטרה">
              <p className="text-[12px] text-muted mb-1.5 leading-relaxed">
                כדי לרדת אוכלים מתחת למה ששורפים, כדי לעלות אוכלים מעל.
              </p>
              <Math_>
                {tdee} {GOAL_STEP[goal].delta} = <b>{suggested}</b>
              </Math_>
              <div className="text-[11px] text-muted-more mt-1">
                המטרה שבחרת: {GOAL_STEP[goal].he}
                {goal === 'lose' && ' · היעד לא יורד מתחת ל-1,200'}
              </div>
            </Row>

            <div className="rounded-xl border border-subtle bg-slate-100 dark:bg-slate-800 p-3 text-[12px] text-muted leading-relaxed">
              המספר הזה הוא הערכה, לא מדידה — הוא נקודת פתיחה טובה, ומה שקובע בפועל זה מה שקורה
              לך על המשקל לאורך זמן. אפשר תמיד לדרוס אותו ידנית עם − ו-+.
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl bg-amber-500 text-white font-bold text-[14px]"
        >
          הבנתי
        </button>
      </div>
    </div>
  );
}
