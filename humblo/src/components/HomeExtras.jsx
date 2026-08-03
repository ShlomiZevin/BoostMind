const BASE = import.meta.env.BASE_URL

const STEPS = [
  ['Upload a face', 'A selfie or that headshot you’re quietly proud of.'],
  ['We analyze on-device', '68 landmarks + micro-expressions. Nothing leaves your phone.'],
  ['Get the verdict', 'Your Humblo Score™ in seconds.'],
]

export default function HomeExtras() {
  return (
    <div className="extras">
      <div className="extras-divider">How it works</div>
      <div className="mini-steps">
        {STEPS.map((s, i) => (
          <div className="mini-step" key={i}>
            <div className="n">{i + 1}</div>
            <div><b>{s[0]}</b><span>{s[1]}</span></div>
          </div>
        ))}
      </div>

      <div className="mascot-card">
        <img src={BASE + 'behumble.jpg'} alt="Be Humble" />
        <div className="q">&ldquo;Be humble. You&rsquo;re not humble. Be humble.&rdquo;</div>
        <div className="a">It started in an ice bath. It ends with a neural net grading your smugness.</div>
      </div>
    </div>
  )
}
