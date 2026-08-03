// Draws the face mesh + annotated notes onto a canvas (natural image coords).

const GROUPS = [
  { r: [0, 17], closed: false },   // jaw
  { r: [17, 22], closed: false },  // right brow
  { r: [22, 27], closed: false },  // left brow
  { r: [27, 31], closed: false },  // nose bridge
  { r: [31, 36], closed: false },  // nose bottom
  { r: [36, 42], closed: true },   // right eye
  { r: [42, 48], closed: true },   // left eye
  { r: [48, 60], closed: true },   // outer mouth
  { r: [60, 68], closed: true },   // inner mouth
]

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export function drawOverlay(canvas, imgEl, det, notes, progress = 1) {
  const w = imgEl.naturalWidth || imgEl.width
  const h = imgEl.naturalHeight || imgEl.height
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h)

  const accent = cssVar('--accent', '#5fa87d')
  const scale = w / 640 // stroke scaling reference
  const pts = det.landmarks.positions

  // detection box
  const box = det.detection.box
  ctx.strokeStyle = accent
  ctx.lineWidth = 2 * scale
  ctx.setLineDash([10 * scale, 8 * scale])
  roundRect(ctx, box.x, box.y, box.width, box.height, 10 * scale)
  ctx.stroke()
  ctx.setLineDash([])

  // corner ticks on the box (targeting-reticle vibe)
  drawCorners(ctx, box, accent, scale)

  // mesh lines
  ctx.strokeStyle = hexA(accent, 0.55)
  ctx.lineWidth = 1.4 * scale
  const count = Math.floor(GROUPS.length * progress + 0.999)
  GROUPS.slice(0, count).forEach((g) => {
    ctx.beginPath()
    for (let i = g.r[0]; i < g.r[1]; i++) {
      const p = pts[i]
      if (i === g.r[0]) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    if (g.closed) ctx.closePath()
    ctx.stroke()
  })

  // landmark dots
  ctx.fillStyle = accent
  const visible = Math.floor(pts.length * progress)
  for (let i = 0; i < visible; i++) {
    const p = pts[i]
    ctx.beginPath()
    ctx.arc(p.x, p.y, 1.9 * scale, 0, Math.PI * 2)
    ctx.fill()
  }

  if (progress >= 1 && notes) drawNotes(ctx, notes, box, scale, accent)
}

function drawNotes(ctx, notes, box, scale, accent) {
  const W = ctx.canvas.width, H = ctx.canvas.height
  ctx.font = `${13 * scale}px Inter, sans-serif`
  const sevColor = {
    high: cssVar('--danger', '#d97a63'),
    med: cssVar('--warn', '#d9b063'),
    low: accent,
  }
  const margin = 8 * scale
  const padX = 8 * scale, bh = 24 * scale
  // stack tags vertically down each side, kept fully inside the canvas
  const left = [], right = []
  notes.forEach((n) => (n.point.x < box.x + box.width / 2 ? left : right).push(n))

  const place = (list, side) => {
    const n = list.length
    list.forEach((note, i) => {
      const c = sevColor[note.severity] || accent
      const label = `${note.label}  ·  ${note.short}`
      const tw = ctx.measureText(label).width
      const boxW = tw + padX * 2
      const tagY = clampY(margin + bh / 2 + (i + 0.5) * ((H - margin * 2 - bh) / Math.max(n, 1)), H, bh, margin)
      const bx = side === 'left' ? margin : W - margin - boxW

      // leader line: from face point to the near edge of the tag
      const anchorX = side === 'left' ? bx + boxW : bx
      ctx.strokeStyle = hexA(c, 0.7)
      ctx.lineWidth = 1.2 * scale
      ctx.beginPath()
      ctx.moveTo(note.point.x, note.point.y)
      ctx.lineTo(anchorX, tagY)
      ctx.stroke()

      // marker dot on the face
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(note.point.x, note.point.y, 3.4 * scale, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1 * scale
      ctx.stroke()

      // tag pill
      ctx.fillStyle = 'rgba(6,10,8,0.86)'
      roundRect(ctx, bx, tagY - bh / 2, boxW, bh, 5 * scale)
      ctx.fill()
      ctx.strokeStyle = hexA(c, 0.9)
      ctx.lineWidth = 1 * scale
      roundRect(ctx, bx, tagY - bh / 2, boxW, bh, 5 * scale)
      ctx.stroke()
      ctx.fillStyle = '#eef2ee'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, bx + padX, tagY + 0.5 * scale)
    })
  }
  place(left, 'left')
  place(right, 'right')
}

function clampY(y, H, bh, margin) {
  return Math.max(margin + bh / 2, Math.min(H - margin - bh / 2, y))
}

function drawCorners(ctx, box, color, scale) {
  const len = 16 * scale
  ctx.strokeStyle = color
  ctx.lineWidth = 3 * scale
  const corners = [
    [box.x, box.y, 1, 1],
    [box.x + box.width, box.y, -1, 1],
    [box.x, box.y + box.height, 1, -1],
    [box.x + box.width, box.y + box.height, -1, -1],
  ]
  corners.forEach(([x, y, sx, sy]) => {
    ctx.beginPath()
    ctx.moveTo(x + sx * len, y)
    ctx.lineTo(x, y)
    ctx.lineTo(x, y + sy * len)
    ctx.stroke()
  })
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function hexA(hex, a) {
  // accept #rgb/#rrggbb; fall back to rgba wrapper if already rgb()
  if (hex.startsWith('#')) {
    let h = hex.slice(1)
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    const n = parseInt(h, 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
  }
  return hex
}
