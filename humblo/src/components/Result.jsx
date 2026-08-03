import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons.jsx'
import { shareResults } from '../lib/share.js'

const TONE = { good: 'var(--good)', warn: 'var(--warn)', danger: 'var(--danger)' }

function Gauge({ score, tone }) {
  const [shown, setShown] = useState(0)
  const R = 92, C = 2 * Math.PI * R
  useEffect(() => {
    let raf, start
    const dur = 1100
    const step = (t) => {
      if (!start) start = t
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(score * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [score])
  const color = TONE[tone] || 'var(--accent)'
  return (
    <div className="gauge-wrap">
      <svg width="220" height="220" viewBox="0 0 220 220">
        <circle cx="110" cy="110" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
        <circle
          cx="110" cy="110" r={R} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C - (C * shown) / 100}
          transform="rotate(-90 110 110)"
        />
      </svg>
      <div className="gauge-num">
        <div className="gauge-score" style={{ color }}>{shown.toFixed(shown < 100 ? 1 : 0)}</div>
        <div className="gauge-outof">Humblo Score™ / 100</div>
      </div>
    </div>
  )
}

export default function Result({ analysis, imgUrl, canvasRef, onPricing, onRetry }) {
  const { score, grade, metrics, notes, verdict, raw } = analysis
  const color = TONE[grade.tone]

  // floating CTA nudges while reading, hides once the in-content CTA is on screen
  const bandRef = useRef(null)
  const [showFloat, setShowFloat] = useState(true)
  const [sharing, setSharing] = useState(false)

  const onShare = async () => {
    setSharing(true)
    await shareResults({ imgUrl, overlayCanvas: canvasRef.current, analysis })
    setSharing(false)
  }
  useEffect(() => {
    const el = bandRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setShowFloat(!e.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <>
    <section className="section fade-in" style={{ paddingTop: 26 }}>
      <div className="appcol appcol-wide">
        <div className="section-head" style={{ marginBottom: 24 }}>
          <div className="section-tag">ANALYSIS COMPLETE</div>
          <h2 className="section-title" style={{ fontSize: 26 }}>Your humility report</h2>
        </div>

        <div className="result-top">
          <div className="gauge-card">
            <Gauge score={score} tone={grade.tone} />
            <div className="grade-pill" style={{ color, borderColor: color }}>{grade.letter} · {grade.label}</div>
            <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--faint)' }}>
              Confidence 98.6% · Model v4.8 · {raw.dominantExpression} affect
            </div>
          </div>

          <div>
            <div className="verdict-title">{verdict.title}</div>
            <div className="verdict-sub">{verdict.sub}</div>
            <p className="verdict-text" dangerouslySetInnerHTML={{ __html: verdict.body }} />

            <div className="result-scan">
              <div className="stage">
                <img className="stage-src" src={imgUrl} alt="analyzed face" />
                <canvas ref={canvasRef} className="stage-canvas" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
              </div>
              <div className="scan-caption">Fig. 1 — annotated biometric overlay · 68 landmarks · {notes.length} regions flagged</div>
            </div>
          </div>
        </div>

        {/* metrics */}
        <div className="metrics">
          <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Diagnostic breakdown</h3>
          {metrics.map((mt) => {
            const barColor = mt.inverse
              ? (mt.value >= 60 ? 'var(--danger)' : mt.value >= 40 ? 'var(--warn)' : 'var(--good)')
              : (mt.value >= 55 ? 'var(--good)' : mt.value >= 35 ? 'var(--warn)' : 'var(--danger)')
            return (
              <div className="metric" key={mt.name}>
                <div className="metric-name">{mt.name}<small>{mt.sub}</small></div>
                <div className="metric-bar"><i style={{ width: mt.value + '%', background: barColor }} /></div>
                <div className="metric-val" style={{ color: barColor }}>{mt.value}</div>
              </div>
            )
          })}
        </div>

        {/* notes */}
        <div style={{ marginTop: 34 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 14 }}>Flagged observations</h3>
          <div className="notes-list">
            {notes.map((n, i) => (
              <div className="note" key={i}>
                <div className="note-idx">{i + 1}</div>
                <div className="note-body"><b>{n.label}.</b> <span>{n.detail}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA -> pricing */}
        <div className="cta-band" ref={bandRef}>
          <h3>Good news: humility is trainable.</h3>
          <p>
            Your face isn&rsquo;t a verdict — it&rsquo;s a starting point. Humblo Premium builds you a
            personalized humility program, tracks your smirk over time, and gently notifies you when
            you&rsquo;re being insufferable.
          </p>
          <button className="btn btn-primary btn-lg" onClick={onPricing}>
            Show me how to be more humble <Icon.Arrow />
          </button>
        </div>

        <div className="result-actions">
          <button className="btn btn-wa" onClick={onShare} disabled={sharing}>
            <Icon.WhatsApp width="19" height="19" />{sharing ? 'Preparing…' : 'Share my results'}
          </button>
          <button className="btn btn-ghost" onClick={onRetry}><Icon.Refresh />Analyze another photo</button>
        </div>
      </div>
    </section>

    {showFloat && (
      <button className="btn btn-primary btn-lg floating-cta in" onClick={onPricing}>
        How to become more humble <Icon.Arrow />
      </button>
    )}
    </>
  )
}
