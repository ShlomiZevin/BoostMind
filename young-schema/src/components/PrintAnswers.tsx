import { useEffect } from 'react'
import { QUESTIONS } from '../data/questions'
import { SCHEMAS } from '../data/schemas'
import type { Answers } from '../lib/scoring'

interface Props {
  answers: Answers
  onClose: () => void
}

const RATING_LABEL_HE: Record<number, string> = {
  1: 'לגמרי לא נכון לגבי',
  2: 'לרוב לא נכון לגבי',
  3: 'קצת יותר נכון לגבי מאשר לא נכון',
  4: 'נכון לגבי במידה בינונית',
  5: 'לרוב נכון לגבי',
  6: 'מתאר אותי בצורה מושלמת',
}

export const PrintAnswers = ({ answers, onClose }: Props) => {
  // Auto-trigger print dialog on mount; restore on afterprint
  useEffect(() => {
    const onAfter = () => onClose()
    window.addEventListener('afterprint', onAfter)
    const t = setTimeout(() => window.print(), 250)
    return () => {
      window.removeEventListener('afterprint', onAfter)
      clearTimeout(t)
    }
  }, [onClose])

  const totalAnswered = Object.values(answers).filter(v => v != null).length
  const dateStr = new Date().toLocaleDateString('he-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="print-qa min-h-screen bg-white text-black">
      {/* Screen-only controls */}
      <div className="screen-only sticky top-0 z-10 bg-white border-b border-zinc-300 px-4 py-3 flex items-center justify-between">
        <button onClick={onClose} className="text-sm text-zinc-700 hover:text-black underline">
          ← חזור לתוצאות
        </button>
        <button onClick={() => window.print()} className="bg-black text-white px-4 py-1.5 rounded text-sm">
          הדפסה / PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 print:px-0 print:py-4">
        <header className="mb-6 pb-4 border-b border-zinc-400">
          <h1 className="text-2xl font-bold mb-1">שאלון הסכמות של יאנג — תשובות גולמיות</h1>
          <p className="text-sm text-zinc-700">
            YSQ-L3 · {dateStr} · {totalAnswered}/{QUESTIONS.length} שאלות
          </p>
          <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
            סולם: 1 = לגמרי לא נכון · 2 = לרוב לא נכון · 3 = קצת יותר נכון מלא · 4 = נכון במידה בינונית · 5 = לרוב נכון · 6 = מתאר בצורה מושלמת
          </p>
        </header>

        {SCHEMAS.map(s => {
          const items = QUESTIONS.filter(q => q.schema === s.code)
          return (
            <section key={s.code} className="mb-6 break-inside-avoid-page">
              <h2 className="text-base font-bold mb-2 pb-1 border-b border-zinc-300">
                {s.nameHe}
                <span className="text-zinc-600 font-normal text-sm mr-2">
                  · {s.nameEn} · {s.code}
                </span>
              </h2>
              <ol className="space-y-1.5">
                {items.map(q => {
                  const v = answers[q.id]
                  return (
                    <li key={q.id} className="flex items-start gap-2 text-sm leading-snug break-inside-avoid">
                      <span className="font-mono text-zinc-500 shrink-0 w-10 text-left">{q.id}.</span>
                      <span className="flex-1">{q.text}</span>
                      <span className={`shrink-0 font-mono font-semibold w-6 text-center ${v == null ? 'text-zinc-400' : 'text-black'}`}>
                        {v == null ? '—' : v}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-600 w-36 text-right hidden sm:inline">
                        {v == null ? '' : RATING_LABEL_HE[v]}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}

        <footer className="mt-8 pt-4 border-t border-zinc-300 text-xs text-zinc-600">
          YSQ-L3 © Jeffrey Young / Schema Therapy Institute · תרגום עברי: ד"ר דני דרבי, אילנה סובל, ד"ר אשכול רפאלי (2007)
        </footer>
      </div>
    </div>
  )
}
