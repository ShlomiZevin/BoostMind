import { useState, useEffect } from 'react'
import { Nav, Footer } from './components/Chrome.jsx'
import Analyzer from './components/Analyzer.jsx'
import HomeExtras from './components/HomeExtras.jsx'
import Pricing from './components/Pricing.jsx'

export default function App() {
  const [view, setView] = useState('home') // home | pricing
  const [theme, setTheme] = useState(() => localStorage.getItem('humblo-theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('humblo-theme', theme)
  }, [theme])

  const go = (v) => { setView(v); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return (
    <>
      <Nav
        theme={theme}
        toggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onHome={() => go('home')}
      />

      {/* Analyzer stays mounted so returning from pricing preserves your result */}
      <div style={{ display: view === 'pricing' ? 'none' : 'block' }}>
        <Analyzer onPricing={() => go('pricing')} below={<HomeExtras />} />
      </div>
      {view === 'pricing' && <Pricing onBack={() => go('home')} />}

      <Footer />
    </>
  )
}
