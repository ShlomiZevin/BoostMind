import { useEffect, useState } from 'react'
import { Intro } from './components/Intro'
import { Questionnaire } from './components/Questionnaire'
import { Results } from './components/Results'
import { isComplete } from './lib/scoring'
import type { Answers, Rating } from './lib/scoring'
import {
  loadAnswers, saveAnswers, clearAll,
  loadMeta, saveMeta,
  loadTheme, saveTheme,
} from './lib/storage'

type View = 'intro' | 'questionnaire' | 'results'

const App = () => {
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers())
  const [view, setView] = useState<View>('intro')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadTheme())

  // apply theme to <html>
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
    saveTheme(theme)
  }, [theme])

  // persist answers + meta on every change
  useEffect(() => {
    saveAnswers(answers)
    const meta = loadMeta()
    const hasAny = Object.values(answers).some(v => v != null)
    const completed = isComplete(answers)
    saveMeta({
      startedAt: meta.startedAt ?? (hasAny ? new Date().toISOString() : null),
      completedAt: completed ? (meta.completedAt ?? new Date().toISOString()) : null,
      lastSavedAt: new Date().toISOString(),
    })
  }, [answers])

  const handleChange = (id: number, rating: Rating) => {
    setAnswers(prev => ({ ...prev, [id]: rating }))
  }

  const handleStart = () => {
    setAnswers({})
    clearAll()
    setView('questionnaire')
  }

  const handleResume = () => setView('questionnaire')
  const handleFinish = () => setView('results')
  const handleExitToIntro = () => setView('intro')
  const handleReset = () => {
    setAnswers({})
    clearAll()
    setView('intro')
  }

  const hasAnyAnswers = Object.values(answers).some(v => v != null)
  const allComplete = isComplete(answers)

  return (
    <div className="min-h-screen">
      <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />

      {view === 'intro' && (
        <Intro
          answers={answers}
          onStart={handleStart}
          onResume={handleResume}
          onReset={handleReset}
          onShowResults={handleFinish}
          hasResults={allComplete || (hasAnyAnswers && Object.values(answers).filter(v => v != null).length > 50)}
        />
      )}

      {view === 'questionnaire' && (
        <Questionnaire
          answers={answers}
          onChange={handleChange}
          onFinish={handleFinish}
          onExit={handleExitToIntro}
        />
      )}

      {view === 'results' && (
        <Results
          answers={answers}
          onBack={handleExitToIntro}
          onRetake={handleStart}
        />
      )}
    </div>
  )
}

const ThemeToggle = ({ theme, onToggle }: { theme: 'dark' | 'light'; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className="fixed top-3 left-3 z-30 w-9 h-9 flex items-center justify-center rounded-lg bg-bg-card border border-border hover:border-accent transition-colors text-zinc-300 print:hidden"
    aria-label={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
    title={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
  >
    {theme === 'dark' ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    )}
  </button>
)

export default App
