// ============================================================
// Humblo Scoring Engine™  (patent pending, obviously)
// Turns real face-api detections into a deadpan "humility" report.
// Everything here is deterministic: same face -> same score.
// The maths is real geometry; the *interpretation* is a joke.
// ============================================================

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const avg = (pts) => pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 })
const deg = (r) => (r * 180) / Math.PI

// deterministic pseudo-random in [0,1) from a numeric seed — keeps decimals "precise" & stable
function seeded(seed) {
  const x = Math.sin(seed * 9973.13) * 43758.5453
  return x - Math.floor(x)
}

export function analyzeHumility(det) {
  const pts = det.landmarks.positions
  const exp = det.expressions
  const age = det.age
  const gender = det.gender

  // ---- geometry (real) ----
  const jawL = pts[0], jawR = pts[16], chin = pts[8]
  const noseTip = pts[30], noseTop = pts[27]
  const rEye = avg(pts.slice(36, 42))
  const lEye = avg(pts.slice(42, 48))
  const browR = avg(pts.slice(17, 22))
  const browL = avg(pts.slice(22, 27))
  const mouthR = pts[48], mouthL = pts[54]
  const lipTop = pts[51], lipBot = pts[57]
  const innerTop = pts[62], innerBot = pts[66]

  const faceW = dist(jawL, jawR) || 1
  const faceH = dist(noseTop, chin) || 1

  // head tilt (degrees off horizontal between the two eyes)
  const tilt = Math.abs(deg(Math.atan2(lEye.y - rEye.y, lEye.x - rEye.x)))
  // eyebrow arch: brow height above eye, normalised
  const browGap = ((rEye.y - browR.y) + (lEye.y - browL.y)) / 2 / faceH
  // smirk asymmetry: vertical offset between the two mouth corners
  const smirk = Math.abs(mouthR.y - mouthL.y) / faceW
  // mouth curl: corners above/below the lip-center line (positive = smile)
  const mouthCenter = mid(lipTop, lipBot)
  const curl = (mouthCenter.y - (mouthR.y + mouthL.y) / 2) / faceH
  // gaze intensity: eye aperture
  const eyeOpen = ((dist(pts[37], pts[41]) + dist(pts[38], pts[40]) + dist(pts[43], pts[47]) + dist(pts[44], pts[46])) / 4) / faceH
  // mouth openness
  const mouthOpen = dist(innerTop, innerBot) / faceH
  // "chin elevation" — nose-to-chin proportion, read as looking-down-on-you
  const chinElev = dist(noseTip, chin) / faceH

  const seed = Math.round((faceW + faceH + noseTip.x + chin.y) * 100)
  const jit = (n) => (seeded(seed + n) - 0.5) // -0.5..0.5

  // ---- interpreted metrics (0..100) ----
  // higher = MORE of that (arrogance-ish) trait, unless noted
  const egoSaturation = clamp(
    (exp.surprised * 120 + exp.angry * 90 + exp.disgusted * 80 + browGap * 220) + jit(1) * 6
  )
  const smirkIndex = clamp(smirk * 900 + (exp.happy * 25) + jit(2) * 7)
  const chinElevation = clamp((chinElev - 0.62) * 320 + 50 + jit(3) * 6)
  const browSuperiority = clamp(browGap * 520 + jit(4) * 6)
  const gazeDominance = clamp((eyeOpen - 0.11) * 900 + 45 + jit(5) * 6)
  // neutral detachment reads as calm/humble; high = good for humility
  const neutralDetachment = clamp(exp.neutral * 100 + jit(6) * 5)
  const performativeSmile = clamp(exp.happy * 100 + mouthOpen * 120 + jit(7) * 5)

  // ---- the Humblo Score™ ----
  // Humble = calm/neutral, symmetrical, level chin, soft brow, relaxed gaze.
  let score = 52
  score += (neutralDetachment - 50) * 0.34
  score -= (egoSaturation - 40) * 0.28
  score -= (smirkIndex - 30) * 0.30
  score -= (chinElevation - 50) * 0.22
  score -= (browSuperiority - 40) * 0.20
  score -= (gazeDominance - 50) * 0.18
  score -= (performativeSmile - 40) * 0.12
  score += jit(9) * 4
  score = clamp(Math.round(score * 10) / 10, 4, 97) // never a perfect 100 — that wouldn't be humble

  const grade = gradeFor(score)

  // ---- metrics list (what the UI renders as bars) ----
  const metrics = [
    m('Ego Saturation', 'zygomatic + ocular load', egoSaturation, true),
    m('Micro-Smirk Index', 'labial corner asymmetry', smirkIndex, true),
    m('Chin Elevation Angle', 'mandibular projection vector', chinElevation, true),
    m('Eyebrow Superiority Arch', 'corrugator lift ratio', browSuperiority, true),
    m('Direct-Gaze Dominance', 'palpebral aperture', gazeDominance, true),
    m('Neutral Detachment', 'stoic baseline affect', neutralDetachment, false),
  ]

  // ---- annotated notes (drawn on the face) ----
  const sev = (v) => (v >= 66 ? 'high' : v >= 40 ? 'med' : 'low')
  const notes = [
    {
      point: mid(mouthL, mouthCenter),
      short: `smirk ${(smirk * 100).toFixed(1)}`,
      label: 'Zygomatic micro-smirk',
      detail: `Labial asymmetry of ${(smirk * 100).toFixed(1)} units. ${smirkIndex > 55 ? 'Consistent with an involuntary “I already knew that” expression.' : 'Within socially acceptable smugness range.'}`,
      severity: sev(smirkIndex),
    },
    {
      point: browL,
      short: `arch ${(browGap * 100).toFixed(1)}°`,
      label: 'Corrugator brow lift',
      detail: `Brow elevated ${(browGap * 100).toFixed(1)}° above the neutral axis. ${browSuperiority > 55 ? 'Classic marker of unearned certainty.' : 'Mild, forgivable eyebrow confidence.'}`,
      severity: sev(browSuperiority),
    },
    {
      point: noseTip,
      short: `tilt ${tilt.toFixed(1)}°`,
      label: 'Nasal elevation vector',
      detail: `Head axis off-level by ${tilt.toFixed(1)}°, chin projection ${chinElevation.toFixed(0)}%. ${chinElevation > 55 ? 'Subject appears to be looking slightly down on the viewer.' : 'Chin held at a commendably humble altitude.'}`,
      severity: sev(chinElevation),
    },
    {
      point: rEye,
      short: `gaze ${gazeDominance.toFixed(0)}`,
      label: 'Palpebral aperture',
      detail: `Eye openness reads ${gazeDominance.toFixed(0)}%. ${gazeDominance > 60 ? 'Intense, room-commanding gaze — hard to look away from a mirror.' : 'Soft, non-confrontational gaze. Good.'}`,
      severity: sev(gazeDominance),
    },
  ]

  const verdict = buildVerdict({ score, grade, age, gender, exp, neutralDetachment, egoSaturation, smirkIndex, chinElevation, tilt })

  return {
    score,
    grade,
    metrics,
    notes,
    verdict,
    raw: {
      age: Math.round(age),
      gender,
      dominantExpression: dominant(exp),
      expressions: exp,
      tilt: +tilt.toFixed(1),
    },
  }
}

function m(name, sub, value, inverse) {
  return { name, sub, value: Math.round(value), inverse } // inverse=true means high value is "less humble"
}

function dominant(exp) {
  return Object.entries(exp).sort((a, b) => b[1] - a[1])[0][0]
}

function gradeFor(s) {
  if (s >= 85) return { letter: 'A+', label: 'Certified Humble', tone: 'good' }
  if (s >= 72) return { letter: 'A', label: 'Quietly Grounded', tone: 'good' }
  if (s >= 60) return { letter: 'B', label: 'Situationally Humble', tone: 'good' }
  if (s >= 46) return { letter: 'C', label: 'Selectively Humble', tone: 'warn' }
  if (s >= 30) return { letter: 'D', label: 'Confidently Un-Humble', tone: 'warn' }
  return { letter: 'F', label: 'Clinically Arrogant', tone: 'danger' }
}

const EXPR_HE = {
  neutral: 'neutral', happy: 'happy', sad: 'sad', angry: 'angry',
  fearful: 'fearful', disgusted: 'disgusted', surprised: 'surprised',
}

function buildVerdict({ score, grade, age, gender, exp, neutralDetachment, egoSaturation, smirkIndex, chinElevation, tilt }) {
  const dom = dominant(exp)
  const domPct = Math.round(exp[dom] * 100)
  const g = gender === 'female' ? 'She' : 'He'

  const openers = {
    good: `The Humblo Engine detects a genuinely grounded facial signature. Rare, and frankly a little suspicious.`,
    warn: `The Humblo Engine detects a face that *believes* it is humble. This is the most dangerous kind.`,
    danger: `The Humblo Engine has flagged this face for immediate humility intervention.`,
  }

  const body =
    `${openers[grade.tone]} ` +
    `Dominant affect: <span class="hl">${domPct}% ${EXPR_HE[dom]}</span>. ` +
    `Ego load <span class="hl">${Math.round(egoSaturation)}%</span>, ` +
    `micro-smirk <span class="hl">${Math.round(smirkIndex)}%</span>, ` +
    `chin elevation <span class="hl">${Math.round(chinElevation)}%</span>` +
    (chinElevation > 55
      ? ` — geometrically, you are looking down on people.`
      : ` — a respectfully level chin.`)

  return { title: `${grade.label}`, sub: `Est. age ${Math.round(age)} · ${gender} · ${EXPR_HE[dom]} affect`, body }
}
