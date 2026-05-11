import { useMemo } from 'react'
import { DOMAINS, BAND_LABELS_HE, SCHEMA_BY_CODE } from '../data/schemas'
import type { Band, DomainCode } from '../data/schemas'
import { scoreAll } from '../lib/scoring'
import type { Answers, SchemaResult } from '../lib/scoring'
import { exportJson, exportAnswersCsv, exportResultsCsv, printResults } from '../lib/export'

interface Props {
  answers: Answers
  onBack: () => void
  onRetake: () => void
}

const BAND_BG: Record<Band, string> = {
  low: 'bg-band-low',
  medium: 'bg-band-medium',
  high: 'bg-band-high',
  veryhigh: 'bg-band-veryhigh',
}

const BAND_TEXT: Record<Band, string> = {
  low: 'text-band-low',
  medium: 'text-band-medium',
  high: 'text-band-high',
  veryhigh: 'text-band-veryhigh',
}

const BAND_BORDER: Record<Band, string> = {
  low: 'border-band-low/30',
  medium: 'border-band-medium/30',
  high: 'border-band-high/30',
  veryhigh: 'border-band-veryhigh/40',
}

export const Results = ({ answers, onBack, onRetake }: Props) => {
  const results = useMemo(() => scoreAll(answers), [answers])

  const totalAnswered = results.reduce((sum, r) => sum + r.itemsAnswered, 0)
  const totalItems = results.reduce((sum, r) => sum + r.schema.itemCount, 0)
  const topSchemas = [...results]
    .filter(r => r.itemsAnswered > 0)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 print:py-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <button onClick={onBack} className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
          ← חזור
        </button>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => exportJson(answers, results)} className="btn-ghost text-sm">JSON</button>
          <button onClick={() => exportAnswersCsv(answers)} className="btn-ghost text-sm">CSV תשובות</button>
          <button onClick={() => exportResultsCsv(results)} className="btn-ghost text-sm">CSV תוצאות</button>
          <button onClick={printResults} className="btn-ghost text-sm">הדפסה / PDF</button>
          <button onClick={onRetake} className="btn-ghost text-sm">מילוי חדש</button>
        </div>
      </div>

      {/* Title */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-1">תוצאות שאלון יאנג</h1>
        <p className="text-zinc-400 text-sm">
          {new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })}
          {' · '}
          <span className="font-mono">{totalAnswered}/{totalItems}</span> שאלות
        </p>
      </div>

      {/* Top schemas summary */}
      {topSchemas.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm uppercase tracking-wider text-zinc-500 font-semibold mb-3">חמש סכמות בולטות</h2>
          <div className="card p-5">
            <ol className="space-y-2.5">
              {topSchemas.map((r, idx) => (
                <li key={r.code} className="flex items-center gap-3">
                  <span className="font-mono text-zinc-500 text-sm w-6">{idx + 1}</span>
                  <span className="flex-1 truncate">{r.schema.nameHe}</span>
                  <BandBadge band={r.band} />
                  <span className="font-mono text-sm text-zinc-400 w-20 text-left">
                    {r.rawScore}/{r.maxScore}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Domain radar */}
      <section className="mb-10">
        <h2 className="text-sm uppercase tracking-wider text-zinc-500 font-semibold mb-3">חמשת התחומים</h2>
        <div className="card p-5 grid md:grid-cols-2 gap-6">
          <DomainRadar results={results} />
          <DomainSummary results={results} />
        </div>
      </section>

      {/* Per-schema detailed results */}
      {DOMAINS.map(domain => {
        const domainResults = results.filter(r => r.schema.domain === domain.code)
        return (
          <section key={domain.code} className="mb-8 break-inside-avoid">
            <h2 className="text-lg font-bold mb-3">{domain.nameHe}</h2>
            <div className="space-y-3">
              {domainResults.map(r => <SchemaCard key={r.code} result={r} />)}
            </div>
          </section>
        )
      })}

      <p className="mt-12 text-xs text-zinc-500 leading-relaxed text-center print:mt-6">
        כלי לחקירה עצמית בלבד · לא מהווה אבחון פסיכולוגי או הנחיה טיפולית · YSQ-L3 © Jeffrey Young
      </p>
    </div>
  )
}

const BandBadge = ({ band }: { band: Band }) => (
  <span className={`px-2 py-0.5 text-xs font-medium rounded border ${BAND_BORDER[band]} ${BAND_TEXT[band]} bg-bg-subtle`}>
    {BAND_LABELS_HE[band]}
  </span>
)

const SchemaCard = ({ result }: { result: SchemaResult }) => {
  const pct = (result.rawScore / result.maxScore) * 100
  // segment widths from band ranges (proportional to maxScore)
  const segments = result.schema.bands.map(b => ({
    band: b.band,
    width: ((b.max - b.min + 1) / result.maxScore) * 100,
  }))

  return (
    <div className={`card p-4 border-r-4 ${BAND_BORDER[result.band]}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{result.schema.nameHe}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{result.schema.nameEn}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <BandBadge band={result.band} />
        </div>
      </div>

      <p className="text-sm text-zinc-400 leading-relaxed mb-3">{result.schema.description}</p>

      {/* Banded bar */}
      <div className="relative">
        <div className="flex h-2 rounded-full overflow-hidden">
          {segments.map((seg, i) => (
            <div key={i} className={`${BAND_BG[seg.band]} opacity-25`} style={{ width: `${seg.width}%` }} />
          ))}
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-zinc-100 dark:bg-white"
          style={{ insetInlineStart: `${Math.min(100, Math.max(0, pct))}%`, transform: 'translate(-50%, -50%)' }}
          aria-hidden
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-zinc-500 font-mono">
        <span>ממוצע {result.meanScore.toFixed(2)} · אישרת {result.endorsedCount} פריטים (4+)</span>
        <span className="text-zinc-300">{result.rawScore}/{result.maxScore}</span>
      </div>
    </div>
  )
}

const DomainSummary = ({ results }: { results: SchemaResult[] }) => {
  return (
    <div className="space-y-3">
      {DOMAINS.map(d => {
        const dr = results.filter(r => r.schema.domain === d.code)
        const totalRaw = dr.reduce((s, r) => s + r.rawScore, 0)
        const totalMax = dr.reduce((s, r) => s + r.maxScore, 0)
        const pct = totalMax > 0 ? Math.round((totalRaw / totalMax) * 100) : 0
        return (
          <div key={d.code}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-medium">{d.nameHe}</span>
              <span className="text-xs text-zinc-500 font-mono">{pct}% · {totalRaw}/{totalMax}</span>
            </div>
            <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const DomainRadar = ({ results }: { results: SchemaResult[] }) => {
  const size = 280
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.38

  const domainData = DOMAINS.map(d => {
    const dr = results.filter(r => r.schema.domain === d.code)
    const totalRaw = dr.reduce((s, r) => s + r.rawScore, 0)
    const totalMax = dr.reduce((s, r) => s + r.maxScore, 0)
    const pct = totalMax > 0 ? totalRaw / totalMax : 0
    return { code: d.code, nameHe: d.nameHe, pct }
  })

  const N = domainData.length
  const angle = (i: number) => (Math.PI * 2 * i) / N - Math.PI / 2

  const point = (i: number, p: number) => ({
    x: cx + Math.cos(angle(i)) * radius * p,
    y: cy + Math.sin(angle(i)) * radius * p,
  })

  const polyPoints = domainData.map((d, i) => {
    const p = point(i, d.pct)
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ')

  const gridLevels = [0.25, 0.5, 0.75, 1]

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Grid polygons */}
        {gridLevels.map(level => {
          const pts = Array.from({ length: N }, (_, i) => {
            const p = point(i, level)
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
          }).join(' ')
          return (
            <polygon
              key={level}
              points={pts}
              fill="none"
              className="stroke-border"
              strokeWidth={1}
              opacity={0.5}
            />
          )
        })}
        {/* Spokes */}
        {domainData.map((_, i) => {
          const end = point(i, 1)
          return (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={end.x} y2={end.y}
              className="stroke-border"
              strokeWidth={1}
              opacity={0.4}
            />
          )
        })}
        {/* Data polygon */}
        <polygon
          points={polyPoints}
          className="fill-accent stroke-accent"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        {/* Data dots */}
        {domainData.map((d, i) => {
          const p = point(i, d.pct)
          return (
            <circle
              key={d.code}
              cx={p.x} cy={p.y} r={4}
              className="fill-accent"
            />
          )
        })}
        {/* Labels */}
        {domainData.map((d, i) => {
          const p = point(i, 1.18)
          return (
            <text
              key={d.code}
              x={p.x} y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-zinc-300 text-[11px]"
            >
              {d.nameHe}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
