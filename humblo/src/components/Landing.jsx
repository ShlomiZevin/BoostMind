import { Icon } from './Icons.jsx'

const BASE = import.meta.env.BASE_URL

const FEATURES = [
  { icon: <Icon.Scan />, title: '68-point facial biometrics', text: 'Our engine maps 68 anatomical landmarks and reads 7 micro-expressions in real time — the same tech serious labs use, pointed at a much sillier question.' },
  { icon: <Icon.Brain />, title: 'The Humility Neural Layer™', text: 'Ego saturation, micro-smirk asymmetry, chin-elevation vectors and corrugator brow-lift are fused into a single, unforgiving score.' },
  { icon: <Icon.Gauge />, title: 'Your Humblo Score™', text: 'One number from 0–100 that tells you, objectively and without mercy, how humble your face actually is. Spoiler: less than you think.' },
]

const STEPS = [
  { n: 1, title: 'Upload a face', text: 'A selfie, a headshot, a LinkedIn photo you’re quietly proud of. Straight on works best.' },
  { n: 2, title: 'We analyze locally', text: 'The model runs entirely in your browser. Nothing is uploaded. Nothing is stored. Very humble of us.' },
  { n: 3, title: 'Receive your verdict', text: 'A full breakdown, annotated on your face, plus a personalized humility improvement plan.' },
]

export default function Landing({ onStart, onPricing }) {
  return (
    <div className="fade-in">
      <section className="hero">
        <div className="container">
          <span className="eyebrow"><span className="pulse" />Now with Humility Neural Layer™ v4.8</span>
          <h1 className="hero-title">How humble is your face, really?</h1>
          <p className="hero-sub">
            Humblo is the world&rsquo;s first AI that measures humility from a single photo.
            Upload your face and get a clinically-inspired Humblo Score™ in seconds —
            no account, no upload, no mercy.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" onClick={onStart}><Icon.Scan width="18" height="18" />Analyze my humility</button>
            <button className="btn btn-ghost btn-lg" onClick={onPricing}>See plans</button>
          </div>
          <div className="hero-note">Free scan · Runs 100% in your browser · Results in ~4 seconds</div>
        </div>
      </section>

      <section className="logos">
        <div className="container">
          <div className="logos-label">Humility-checked at</div>
          <div className="logos-row">
            <span className="logo-item">EgoCorp</span>
            <span className="logo-item">ThoughtLeader.io</span>
            <span className="logo-item">Founders Anonymous</span>
            <span className="logo-item">LinkedIn Influencers</span>
            <span className="logo-item">The Ice Bath Co.</span>
          </div>
        </div>
      </section>

      <section className="section" id="science">
        <div className="container">
          <div className="section-head">
            <div className="section-tag">THE SCIENCE</div>
            <h2 className="section-title">Humility, finally quantified</h2>
            <p className="section-desc">For centuries humility was a vibe. Humblo turns it into a number you can be judged by.</p>
          </div>
          <div className="grid-3">
            {FEATURES.map((f) => (
              <div className="card" key={f.title}>
                <div className="card-ico">{f.icon}</div>
                <div className="card-title">{f.title}</div>
                <div className="card-text">{f.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div className="section-tag">HOW IT WORKS</div>
            <h2 className="section-title">Three steps to a humbling experience</h2>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.n}>
                <div className="step-num">{s.n}</div>
                <div className="card-title" style={{ fontSize: 18 }}>{s.title}</div>
                <div className="card-text">{s.text}</div>
              </div>
            ))}
          </div>
          <div className="center" style={{ marginTop: 40 }}>
            <button className="btn btn-primary btn-lg" onClick={onStart}><Icon.Scan width="18" height="18" />Start free analysis</button>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 30, alignItems: 'center', padding: 34 }}>
            <div>
              <div className="section-tag">CLINICALLY-INSPIRED</div>
              <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10 }}>
                &ldquo;Be humble. You&rsquo;re not humble. Be humble.&rdquo;
              </h2>
              <p className="card-text" style={{ fontSize: 15, maxWidth: '52ch' }}>
                It started in an ice bath with a suspiciously calm man. It ends here, with a neural
                network telling you the exact percentage of smugness in your resting face. Progress.
              </p>
            </div>
            <img src={BASE + 'behumble.jpg'} alt="Be Humble" style={{ width: 150, borderRadius: 16, border: '1px solid var(--border)' }} />
          </div>
        </div>
      </section>
    </div>
  )
}
