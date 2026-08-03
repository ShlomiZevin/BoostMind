// Builds a branded, shareable PNG of the user's Humblo result (face + overlay + score).

const GRADE_COLOR = { good: '#5fa87d', warn: '#d9b063', danger: '#d97a63' }
const SHARE_URL = 'https://boostmind-b052c.web.app/humblo/'

function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
}

function drawCover(ctx, src, dx, dy, dw, dh) {
  const sw = src.naturalWidth || src.width
  const sh = src.naturalHeight || src.height
  const scale = Math.max(dw / sw, dh / sh)
  const w = sw * scale, h = sh * scale
  ctx.drawImage(src, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h)
}

export async function buildShareCard({ imgUrl, overlayCanvas, analysis }) {
  try { await (document.fonts && document.fonts.ready) } catch { /* ignore */ }
  const { score, grade } = analysis
  const accent = GRADE_COLOR[grade.tone] || '#5fa87d'
  const img = await loadImage(imgUrl)

  const W = 1000
  const faceH = Math.min(Math.round((W * img.naturalHeight) / img.naturalWidth), 1400)
  const panelH = 340
  const H = faceH + panelH

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')

  ctx.fillStyle = '#0c0f0e'
  ctx.fillRect(0, 0, W, H)

  // face + biometric overlay (both share the source aspect, so cover keeps them aligned)
  drawCover(ctx, img, 0, 0, W, faceH)
  if (overlayCanvas && overlayCanvas.width) drawCover(ctx, overlayCanvas, 0, 0, W, faceH)

  const y = faceH
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(0, y, W, 2)

  const pad = 58
  ctx.textBaseline = 'alphabetic'

  // brand
  ctx.fillStyle = '#e9ede9'
  ctx.font = '800 42px Inter, sans-serif'
  ctx.fillText('Humblo', pad, y + 74)
  const bw = ctx.measureText('Humblo').width
  ctx.fillStyle = accent
  ctx.fillText('.', pad + bw + 3, y + 74)

  ctx.fillStyle = '#8d968f'
  ctx.font = '700 18px Inter, sans-serif'
  try { ctx.letterSpacing = '3px' } catch { /* older browsers */ }
  ctx.fillText('AI HUMILITY ANALYSIS', pad, y + 106)
  try { ctx.letterSpacing = '0px' } catch { /* noop */ }

  // score (left)
  ctx.fillStyle = accent
  ctx.font = '800 152px Inter, sans-serif'
  ctx.fillText(String(score), pad - 4, y + 256)
  const scw = ctx.measureText(String(score)).width
  ctx.fillStyle = '#8d968f'
  ctx.font = '600 42px Inter, sans-serif'
  ctx.fillText('/100', pad + scw + 12, y + 256)

  // grade label
  ctx.fillStyle = '#e9ede9'
  ctx.font = '700 36px Inter, sans-serif'
  ctx.fillText(grade.label, pad, y + 306)

  // big grade letter (right)
  ctx.fillStyle = accent
  ctx.font = '800 150px Inter, sans-serif'
  const gl = grade.letter
  ctx.fillText(gl, W - pad - ctx.measureText(gl).width, y + 250)

  // url
  ctx.fillStyle = '#5c655f'
  ctx.font = '500 25px Inter, sans-serif'
  const url = 'boostmind-b052c.web.app/humblo'
  ctx.fillText(url, W - pad - ctx.measureText(url).width, H - 40)

  return await new Promise((r) => c.toBlob(r, 'image/png', 0.95))
}

export async function shareResults({ imgUrl, overlayCanvas, analysis }) {
  const { score, grade } = analysis
  const text = `My Humblo Score is ${score}/100 — “${grade.label}”. How humble is your face?`
  const waFallback = () => window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + SHARE_URL)}`, '_blank')

  try {
    const blob = await buildShareCard({ imgUrl, overlayCanvas, analysis })
    const file = new File([blob], 'humblo-score.png', { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: `${text} ${SHARE_URL}` })
      return
    }
    waFallback()
  } catch (e) {
    if (e && e.name === 'AbortError') return // user dismissed the share sheet
    waFallback()
  }
}
