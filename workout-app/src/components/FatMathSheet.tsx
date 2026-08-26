// What the "≈ 0.44 ק״ג" under the cumulative deficit actually means.
//
// It was shown bare, which made it read like a measured result — as if the app
// knew you had lost 0.44kg. It is nothing of the sort: it is the deficit divided
// by the energy stored in a kilo of body fat. Worth showing, because it is the
// number people actually care about behind a calorie count, but not worth
// showing without saying where it came from.

const KCAL_PER_KG_FAT = 7700;

export function FatMathSheet({
  net, days, onClose,
}: {
  /** Signed: negative = deficit. */
  net: number;
  days: number;
  onClose: () => void;
}) {
  const deficit = Math.abs(net);
  const kg = deficit / KCAL_PER_KG_FAT;
  const losing = net <= 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center dark:bg-black/70 bg-black/40"
      onClick={onClose}
    >
      <div
        className="overlay-solid w-full max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border border-subtle
                   p-4 pb-[max(env(safe-area-inset-bottom),1rem)] max-h-[88dvh] overflow-y-auto"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="font-bold text-[17px]">
            מאיפה מגיע ה־{kg.toFixed(2)} ק״ג
          </h3>
          <button onClick={onClose} aria-label="סגור" className="text-muted text-2xl leading-none shrink-0">×</button>
        </div>
        <p className="text-[12px] text-muted mb-4">זו לא מדידה — זו המרה של המספר שמעליו.</p>

        <div className="space-y-3">
          <div className="rounded-xl border border-subtle bg-subtle p-3">
            <div className="font-bold text-[14px] mb-1">החישוב</div>
            <div
              dir="ltr"
              className="font-mono text-[12.5px] rounded-lg border border-subtle bg-slate-100 dark:bg-slate-800
                         px-2.5 py-2 overflow-x-auto whitespace-nowrap"
            >
              {deficit.toLocaleString()} ÷ 7,700 = <b>{kg.toFixed(2)}</b> kg
            </div>
            <p className="text-[12px] text-muted leading-relaxed mt-2">
              בקילוגרם שומן בגוף אצורות בערך 7,700 קלוריות. {losing ? 'הגירעון' : 'העודף'} שצברת
              על פני {days} הימים האלה הוא {deficit.toLocaleString()} קק״ל — מחלקים, ומקבלים
              כמה שומן זה שווה בערך.
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/40 bg-amber-500/[.07] p-3">
            <div className="font-bold text-[14px] mb-1 text-amber-700 dark:text-amber-400">
              למה זה לא מה שהמשקל יראה
            </div>
            <p className="text-[12px] text-muted leading-relaxed">
              המשקל בבוקר זז גם ממים, מלח, פחמימות ומה שיש במערכת העיכול — לפעמים קילו שלם
              בין יום ליום. זה רעש שגדול בהרבה מהשינוי האמיתי בשומן, ולכן אין טעם להשוות
              את שני המספרים ביום נתון.
            </p>
          </div>

          <div className="rounded-xl border border-subtle bg-subtle p-3">
            <div className="font-bold text-[14px] mb-1">גם 7,700 זו הערכה</div>
            <p className="text-[12px] text-muted leading-relaxed">
              המספר הזה הוא ממוצע מקובל, לא קבוע פיזיקלי. גם הקלוריות שנשרפות באימון וגם
              אלה שבארוחות הן הערכות. אז תתייחס לזה ככיוון, לא כמאזן בנק.
            </p>
          </div>

          <p className="text-[12px] text-muted leading-relaxed">
            מה שכן אמין: המגמה. אם הגירעון נשמר לאורך שבועות, המשקל יילך לאותו כיוון —
            גם אם לא בדיוק במספר הזה ולא בדיוק בקצב הזה.
          </p>
        </div>

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
