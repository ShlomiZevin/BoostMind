import { TOTAL_QUESTIONS } from '../data/schemas'
import { completionPercent } from '../lib/scoring'
import type { Answers } from '../lib/scoring'

interface Props {
  answers: Answers
  onStart: () => void
  onResume: () => void
  onReset: () => void
  onShowResults: () => void
  hasResults: boolean
}

export const Intro = ({ answers, onStart, onResume, onReset, onShowResults, hasResults }: Props) => {
  const progress = completionPercent(answers)
  const inProgress = progress > 0 && progress < 100

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="card p-8">
        <h1 className="text-3xl font-bold mb-2">שאלון הסכמות של יאנג</h1>
        <p className="text-zinc-400 text-sm mb-8">YSQ-L3 · גרסה ארוכה · {TOTAL_QUESTIONS} שאלות</p>

        <div className="space-y-4 text-zinc-300 leading-relaxed">
          <p>
            לפניך רשימת משפטים שאדם יכול להשתמש בהם כדי לתאר את עצמו. עבור כל משפט – ציין/י באיזו מידה הוא מתאר אותך, בסולם של 1 עד 6.
          </p>
          <p>
            כשאינך בטוח/ה, בסס/י את ההחלטה על תחושת הבטן או מה שאת/ה מרגיש/ה שעשוי להיות הציון הכי נכון, ולא על מה שאת/ה חושב/ת שנכון.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ScaleHint num={1} text="לגמרי לא נכון לגבי" />
          <ScaleHint num={2} text="לרוב לא נכון לגבי" />
          <ScaleHint num={3} text="קצת יותר נכון לגבי מאשר לא" />
          <ScaleHint num={4} text="נכון לגבי במידה בינונית" />
          <ScaleHint num={5} text="לרוב נכון לגבי" />
          <ScaleHint num={6} text="מתאר אותי בצורה מושלמת" />
        </div>

        {inProgress && (
          <div className="mt-8 p-4 bg-bg-subtle border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-zinc-400">התקדמות שמורה</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="h-1.5 bg-bg rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {inProgress ? (
            <>
              <button onClick={onResume} className="btn-primary">
                המשך מהמקום שעצרתי
              </button>
              <button onClick={onStart} className="btn-ghost">
                התחל מחדש
              </button>
            </>
          ) : (
            <button onClick={onStart} className="btn-primary">
              {progress === 100 ? 'התחל מילוי חדש' : 'התחל'}
            </button>
          )}

          {hasResults && (
            <button onClick={onShowResults} className="btn-ghost">
              צפה בתוצאות
            </button>
          )}

          {progress > 0 && (
            <button
              onClick={() => {
                if (confirm('למחוק את כל התשובות השמורות?')) onReset()
              }}
              className="btn-ghost text-zinc-500 hover:text-band-veryhigh"
            >
              איפוס
            </button>
          )}
        </div>

        <p className="mt-10 text-xs text-zinc-500 leading-relaxed">
          כלי לחקירה עצמית, לא אבחון קליני. השאלון מוגן בזכויות יוצרים של ד"ר ג'פרי יאנג / Schema Therapy Institute. תרגום עברי: ד"ר דני דרבי, אילנה סובל, ד"ר אשכול רפאלי (2007).
        </p>
      </div>
    </div>
  )
}

const ScaleHint = ({ num, text }: { num: number; text: string }) => (
  <div className="flex items-center gap-3 px-3 py-2 bg-bg-subtle border border-border-subtle rounded-lg text-sm">
    <span className="w-7 h-7 flex items-center justify-center bg-bg-card border border-border rounded font-mono text-accent shrink-0">
      {num}
    </span>
    <span className="text-zinc-400">{text}</span>
  </div>
)
