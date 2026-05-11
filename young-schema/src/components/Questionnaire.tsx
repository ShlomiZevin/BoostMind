import { useEffect, useMemo, useRef, useState } from 'react'
import { QUESTIONS, type Question } from '../data/questions'
import { SCHEMAS, BAND_LABELS_HE } from '../data/schemas'
import type { SchemaCode } from '../data/schemas'
import { completionPercent, isComplete } from '../lib/scoring'
import type { Answers, Rating } from '../lib/scoring'

interface Props {
  answers: Answers
  onChange: (id: number, rating: Rating) => void
  onFinish: () => void
  onExit: () => void
  startSchema?: SchemaCode
}

export const Questionnaire = ({ answers, onChange, onFinish, onExit, startSchema }: Props) => {
  const initialIdx = startSchema ? Math.max(0, SCHEMAS.findIndex(s => s.code === startSchema)) : 0
  const [schemaIdx, setSchemaIdx] = useState(initialIdx)
  const [focusId, setFocusId] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentSchema = SCHEMAS[schemaIdx]
  const currentItems = useMemo(
    () => QUESTIONS.filter(q => q.schema === currentSchema.code),
    [currentSchema.code],
  )

  const sectionAnswered = currentItems.filter(q => answers[q.id] != null).length
  const sectionTotal = currentItems.length
  const sectionDone = sectionAnswered === sectionTotal

  const overallPercent = completionPercent(answers)
  const overallDone = isComplete(answers)

  // Scroll to top when changing section
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setFocusId(currentItems[0]?.id ?? null)
  }, [schemaIdx, currentItems])

  // Keyboard 1-6 sets rating for focused item; arrows move focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (focusId == null) return
      if (e.key >= '1' && e.key <= '6') {
        const r = parseInt(e.key, 10) as Rating
        onChange(focusId, r)
        // auto-advance
        const idx = currentItems.findIndex(q => q.id === focusId)
        const next = currentItems[idx + 1]
        if (next) {
          setFocusId(next.id)
          // scroll into view
          setTimeout(() => {
            document.getElementById(`q-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 50)
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        const idx = currentItems.findIndex(q => q.id === focusId)
        const next = currentItems[idx + 1]
        if (next) {
          setFocusId(next.id)
          document.getElementById(`q-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        const idx = currentItems.findIndex(q => q.id === focusId)
        const prev = currentItems[idx - 1]
        if (prev) {
          setFocusId(prev.id)
          document.getElementById(`q-${prev.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusId, currentItems, onChange])

  const goPrev = () => setSchemaIdx(i => Math.max(0, i - 1))
  const goNext = () => setSchemaIdx(i => Math.min(SCHEMAS.length - 1, i + 1))

  return (
    <div className="min-h-screen flex flex-col" ref={containerRef}>
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-bg/95 dark:bg-bg/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2 gap-3">
            <button onClick={onExit} className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              ← חזור
            </button>
            <div className="text-sm text-zinc-400 font-mono">
              {overallPercent}% · {Object.values(answers).filter(v => v != null).length}/{QUESTIONS.length}
            </div>
          </div>
          <div className="h-1 bg-bg-subtle rounded-full overflow-hidden mb-3">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${overallPercent}%` }} />
          </div>
          <SchemaTabs activeIdx={schemaIdx} onSelect={setSchemaIdx} answers={answers} />
        </div>
      </header>

      {/* Section content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider text-accent font-semibold mb-1">
            {schemaIdx + 1} / {SCHEMAS.length}
          </div>
          <h2 className="text-2xl font-bold mb-1">{currentSchema.nameHe}</h2>
          <p className="text-zinc-400 text-sm">{currentSchema.description}</p>
          <div className="mt-2 text-xs text-zinc-500 font-mono">
            {sectionAnswered}/{sectionTotal} בסעיף זה
          </div>
        </div>

        <ol className="space-y-3">
          {currentItems.map(q => (
            <QuestionRow
              key={q.id}
              question={q}
              value={answers[q.id] ?? null}
              focused={focusId === q.id}
              onFocus={() => setFocusId(q.id)}
              onChange={r => onChange(q.id, r)}
            />
          ))}
        </ol>

        {/* Bottom nav */}
        <div className="mt-10 flex items-center justify-between gap-3">
          <button onClick={goPrev} disabled={schemaIdx === 0} className="btn-ghost">
            ← הקודם
          </button>

          {schemaIdx === SCHEMAS.length - 1 ? (
            <button
              onClick={onFinish}
              disabled={!overallDone}
              className="btn-primary"
              title={overallDone ? '' : `נשארו ${QUESTIONS.length - Object.values(answers).filter(v => v != null).length} שאלות לא מסומנות`}
            >
              {overallDone ? 'סיום וצפייה בתוצאות' : `נשארו ${QUESTIONS.length - Object.values(answers).filter(v => v != null).length} ללא מענה`}
            </button>
          ) : (
            <button
              onClick={goNext}
              className={sectionDone ? 'btn-primary' : 'btn-ghost'}
            >
              הבא ←
            </button>
          )}
        </div>

        {!sectionDone && schemaIdx < SCHEMAS.length - 1 && (
          <p className="mt-3 text-xs text-zinc-500 text-center">
            אפשר לעבור לסעיף הבא גם אם לא ענית על הכל — תוכל לחזור.
          </p>
        )}
      </main>
    </div>
  )
}

const QuestionRow = ({
  question,
  value,
  focused,
  onFocus,
  onChange,
}: {
  question: Question
  value: Rating | null
  focused: boolean
  onFocus: () => void
  onChange: (r: Rating) => void
}) => {
  return (
    <li
      id={`q-${question.id}`}
      tabIndex={0}
      onFocus={onFocus}
      onClick={onFocus}
      className={`card p-4 transition-all ${focused ? 'ring-2 ring-accent border-accent' : 'hover:border-zinc-600'}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xs text-zinc-500 font-mono shrink-0 mt-1 w-8 text-left">{question.id}.</span>
        <p className="text-zinc-100 leading-relaxed">{question.text}</p>
      </div>
      <div className="flex gap-1.5 sm:gap-2 justify-stretch">
        {([1, 2, 3, 4, 5, 6] as Rating[]).map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 h-10 rounded-md font-mono text-sm font-medium border transition-all ${
              value === n
                ? 'bg-accent text-white border-accent'
                : 'bg-bg-subtle border-border text-zinc-400 hover:border-accent hover:text-zinc-100'
            }`}
            aria-label={`דרג ${n}`}
          >
            {n}
          </button>
        ))}
      </div>
    </li>
  )
}

const SchemaTabs = ({
  activeIdx,
  onSelect,
  answers,
}: {
  activeIdx: number
  onSelect: (idx: number) => void
  answers: Answers
}) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    tabRefs.current[activeIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeIdx])

  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-thin -mx-4 px-4 pb-1">
      {SCHEMAS.map((s, idx) => {
        const items = QUESTIONS.filter(q => q.schema === s.code)
        const answered = items.filter(q => answers[q.id] != null).length
        const total = items.length
        const done = answered === total
        const empty = answered === 0
        const active = idx === activeIdx
        return (
          <button
            key={s.code}
            ref={el => { tabRefs.current[idx] = el }}
            onClick={() => onSelect(idx)}
            className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              active
                ? 'bg-accent text-white border-accent'
                : done
                  ? 'bg-bg-subtle border-band-low/40 text-zinc-300 hover:border-band-low'
                  : empty
                    ? 'bg-transparent border-border text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                    : 'bg-bg-subtle border-border text-zinc-300 hover:border-accent'
            }`}
            title={`${s.nameHe} · ${BAND_LABELS_HE.low === '' ? '' : ''}${answered}/${total}`}
          >
            <span className="font-mono opacity-60 ml-1">{idx + 1}</span>
            {s.nameHe}
          </button>
        )
      })}
    </div>
  )
}
