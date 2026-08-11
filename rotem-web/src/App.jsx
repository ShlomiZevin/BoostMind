import { useEffect, useRef, useState } from 'react'
import { CHAPTERS } from './chapters.jsx'

const THEME_KEY = 'rotem-web-theme'
const DONE_KEY = 'rotem-web-done'

function loadDone() {
  try {
    const raw = localStorage.getItem(DONE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(loadDone)
  const topRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(DONE_KEY, JSON.stringify(done))
  }, [done])

  const go = (n) => {
    setIdx(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const chapter = CHAPTERS[idx]
  const Body = chapter.body
  const isDone = done.includes(chapter.id)
  const pct = Math.round((done.length / CHAPTERS.length) * 100)

  const toggleDone = () => {
    setDone(isDone ? done.filter((d) => d !== chapter.id) : [...done, chapter.id])
  }

  return (
    <div className="app" ref={topRef}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="dot" />
            <span>
              איך עובד ווב
              <small>המדריך של רותם · לפני שבונים את האפליקציה הראשונה</small>
            </span>
          </div>
          <div className="topbar-spacer" />
          <div className="progress-pill">
            <span className="progress-label">התקדמות</span>
            <span className="progress-track">
              <span className="progress-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="mono">{pct}%</span>
          </div>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="החלפת ערכת נושא"
            title="בהיר / כהה"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-title">תוכן העניינים</div>
          <nav className="nav">
            {CHAPTERS.map((c, i) => (
              <button
                key={c.id}
                className={`nav-item ${i === idx ? 'active' : ''} ${done.includes(c.id) ? 'done' : ''}`}
                onClick={() => go(i)}
              >
                <span className="nav-num">{done.includes(c.id) && i !== idx ? '✓' : i + 1}</span>
                <span className="nav-label">{c.nav}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="content">
          <div className="mobile-nav">
            <div className="mobile-nav-scroll">
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.id}
                  className={`chip ${i === idx ? 'active' : ''}`}
                  onClick={() => go(i)}
                >
                  {done.includes(c.id) && i !== idx ? '✓ ' : ''}
                  {c.nav}
                </button>
              ))}
            </div>
          </div>

          <div className="chapter-kicker">{chapter.kicker}</div>
          <h1>{chapter.title}</h1>

          <Body />

          <button className={`done-toggle ${isDone ? 'on' : ''}`} onClick={toggleDone}>
            {isDone ? '✓ סימנת שסיימת את הפרק' : 'סמני שסיימת את הפרק'}
          </button>

          <div className="chapter-nav">
            <button className="btn" onClick={() => go(idx - 1)} disabled={idx === 0}>
              → {idx > 0 ? CHAPTERS[idx - 1].nav : 'הקודם'}
            </button>
            <button
              className="btn primary"
              onClick={() => go(idx + 1)}
              disabled={idx === CHAPTERS.length - 1}
            >
              {idx < CHAPTERS.length - 1 ? CHAPTERS[idx + 1].nav : 'סיימת הכל 🎉'} ←
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
