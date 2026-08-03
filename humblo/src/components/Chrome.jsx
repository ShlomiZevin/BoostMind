import { Icon } from './Icons.jsx'

const BASE = import.meta.env.BASE_URL

export function Nav({ theme, toggleTheme, onHome }) {
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <div className="brand" onClick={onHome}>
          <img className="brand-mark" src={BASE + 'behumble.jpg'} alt="Humblo" />
          Humblo<span className="brand-dot">.</span>
        </div>
        <div className="nav-right">
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
          </button>
        </div>
      </div>
    </nav>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div className="brand" style={{ marginBottom: 10 }}>
            <img className="brand-mark" src={BASE + 'behumble.jpg'} alt="Humblo" />
            Humblo<span className="brand-dot">.</span>
          </div>
          <p className="footer-note">
            Humblo is a satirical humility-assessment product. Your Humblo Score™ is not medical,
            psychological, or spiritual advice. No photos leave your device — the entire analysis
            runs locally in your browser.
          </p>
        </div>
        <div className="footer-links">
          <a href="https://boostmind-b052c.web.app/boostart/" target="_blank" rel="noreferrer">Made by Boostart</a>
        </div>
      </div>
      <div className="container" style={{ marginTop: 24, color: 'var(--faint)', fontSize: 12.5 }}>
        © {2026} Humblo Labs. Be humble. You're not humble. Be humble.
      </div>
    </footer>
  )
}

export function Modal({ title, children, onClose, cta }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div><p>{children}</p></div>
        <button className="btn btn-primary btn-block" onClick={onClose}>{cta || 'Got it'}</button>
      </div>
    </div>
  )
}
