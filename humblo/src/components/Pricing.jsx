import { useState } from 'react'
import { Icon } from './Icons.jsx'
import { Modal } from './Chrome.jsx'

const PLANS = [
  {
    name: 'Curious',
    tag: 'For the mildly self-aware',
    monthly: 0, yearly: 0,
    cta: 'Start free',
    feats: [
      ['1 humility scan', 'per month'],
      ['Basic Humblo Score™', ''],
      ['3 flagged observations', ''],
      ['Community-grade honesty', ''],
    ],
  },
  {
    name: 'Humble',
    tag: 'For the actively working-on-it',
    monthly: 39, yearly: 29,
    cta: 'Begin the work',
    feats: [
      ['Unlimited scans', ''],
      ['Full diagnostic breakdown', ''],
      ['Daily humility affirmations', ''],
      ['Smirk trend tracking', 'weekly'],
      ['Ego-spike push alerts', ''],
    ],
  },
  {
    name: 'Humbler',
    tag: 'For serious ego management',
    monthly: 99, yearly: 79,
    featured: true,
    cta: 'Get Humbler',
    feats: [
      ['Everything in Humble', ''],
      ['Real-time humblebrag auto-corrector', ''],
      ['Weekly session with an AI monk', ''],
      ['LinkedIn photo humility audit', ''],
      ['“Actually, I could be wrong” voice pack', ''],
      ['Priority grounding', ''],
    ],
  },
  {
    name: 'Transcendent',
    tag: 'For those who insist they don’t need it',
    monthly: 299, yearly: 249,
    cta: 'Ascend',
    feats: [
      ['Everything in Humbler', ''],
      ['24/7 personal humility concierge', ''],
      ['Quarterly ice-bath calibration', ''],
      ['Team ego dashboards', 'up to 50 seats'],
      ['White-glove ego intervention', ''],
      ['Certificate of Verified Humility™', ''],
    ],
  },
]

const FAQ = [
  ['Is my photo stored anywhere?', 'No. All analysis runs locally in your browser using an on-device model. Your face never touches a server. This is, itself, a humble design choice.'],
  ['Is the Humblo Score™ scientifically valid?', 'It is scientifically shaped. We measure real facial geometry and real micro-expressions. The leap from “eyebrow angle” to “humility” is where the art lives.'],
  ['Can I lower my score on purpose to seem humble?', 'Trying to appear humble is the least humble thing a person can do, and the model knows.'],
  ['What happens when I click a plan?', 'Nothing is charged. This is a satirical product. The only thing you owe is a little self-reflection.'],
]

export default function Pricing({ onBack }) {
  const [yearly, setYearly] = useState(true)
  const [modal, setModal] = useState(null)
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <div className="fade-in">
      <div className="container" style={{ paddingTop: 16 }}>
        <button className="btn btn-ghost pricing-back" onClick={onBack}><Icon.ArrowLeft width="16" height="16" />Back to my results</button>
      </div>
      <section className="section" style={{ paddingTop: 22, paddingBottom: 30 }}>
        <div className="container">
          <div className="section-head">
            <div className="section-tag">PRICING</div>
            <h2 className="section-title">Choose your path to humility</h2>
            <p className="section-desc">Every plan is a step away from your current, frankly concerning, Humblo Score™.</p>
          </div>

          <div className="center">
            <div className="billing-toggle">
              <button className={!yearly ? 'active' : ''} onClick={() => setYearly(false)}>Monthly</button>
              <button className={yearly ? 'active' : ''} onClick={() => setYearly(true)}>Yearly<span className="save-tag">–25%</span></button>
            </div>
          </div>

          <div className="pricing-grid">
            {PLANS.map((p) => {
              const price = yearly ? p.yearly : p.monthly
              return (
                <div className={'price-card' + (p.featured ? ' featured' : '')} key={p.name}>
                  {p.featured && <div className="price-badge">Most humble</div>}
                  <div className="price-name">{p.name}</div>
                  <div className="price-tag">{p.tag}</div>
                  <div className="price-amount">
                    {price === 0 ? (
                      <span className="num">Free</span>
                    ) : (
                      <><span className="cur">₪</span><span className="num">{price}</span><span className="per">/mo</span></>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', minHeight: 16 }}>
                    {price > 0 && yearly ? 'billed annually' : price > 0 ? 'billed monthly' : 'forever'}
                  </div>
                  <ul className="price-feats">
                    {p.feats.map((f, i) => (
                      <li key={i}><span className="chk"><Icon.Check /></span><span><b>{f[0]}</b>{f[1] ? ' — ' + f[1] : ''}</span></li>
                    ))}
                  </ul>
                  <button
                    className={'btn ' + (p.featured ? 'btn-primary' : 'btn-ghost') + ' btn-block'}
                    onClick={() => setModal(p)}
                  >
                    {p.cta}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="center" style={{ marginTop: 26, color: 'var(--faint)', fontSize: 13 }}>
            <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}><Icon.Lock /> No card required to start · Cancel your ego anytime</span>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container faq">
          <div className="section-head"><h2 className="section-title" style={{ fontSize: 28 }}>Questions, humbly answered</h2></div>
          {FAQ.map((f, i) => (
            <div className="faq-item" key={i}>
              <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                {f[0]} <span style={{ color: 'var(--faint)' }}>{openFaq === i ? '–' : '+'}</span>
              </div>
              {openFaq === i && <div className="faq-a">{f[1]}</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container center">
          <button className="btn btn-ghost btn-lg" onClick={onBack}><Icon.ArrowLeft width="18" height="18" />Back to my results</button>
        </div>
      </section>

      {modal && (
        <Modal title={`${modal.name} — one moment of honesty`} cta="I understand, I need work" onClose={() => setModal(null)}>
          Humblo is a satirical humility check — nothing is charged and no account is created.
          But take it as a sign: if you were ready to pay ₪{yearly ? modal.yearly : modal.monthly} to feel more humble,
          you might already be on your way. Be humble. You&rsquo;re not humble. Be humble.
        </Modal>
      )}
    </div>
  )
}
