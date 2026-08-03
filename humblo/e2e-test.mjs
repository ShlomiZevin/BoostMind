import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const URL = 'http://localhost:4173/humblo/'
const IMG = 'C:\\Users\\shazbak\\Downloads\\behumble.jpg'

const log = (...a) => console.log(...a)

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
})
const page = await browser.newPage()
const errors = []
page.on('console', async (m) => {
  if (m.type() !== 'error') return
  try {
    const parts = await Promise.all(m.args().map((a) => a.evaluate((x) => (x && x.stack) || (x && x.message) || String(x)).catch(() => m.text())))
    errors.push(parts.join(' | ') || m.text())
  } catch { errors.push(m.text()) }
})
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + (e.stack || e.message)))

await page.goto(URL, { waitUntil: 'networkidle2' })
log('✓ page loaded, title:', await page.title())

// go to analyzer
await page.waitForSelector('button.btn-primary')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Analyze my humility/i.test(x.textContent))
  b.click()
})
await page.waitForSelector('input[type=file]', { timeout: 5000 })
log('✓ reached analyzer, uploading', IMG)

const input = await page.$('input[type=file]')
await input.uploadFile(IMG)

// wait for the result gauge to appear
try {
  await page.waitForSelector('.gauge-score', { timeout: 40000 })
} catch (e) {
  log('!! gauge never appeared. Diagnostics:')
  const diag = await page.evaluate(() => ({
    h3: [...document.querySelectorAll('h3')].map((x) => x.textContent),
    dropzoneText: document.querySelector('.dropzone')?.textContent,
    analyzingLog: document.querySelector('.analyzing-log')?.textContent,
    bodySnippet: document.body.innerText.slice(0, 400),
  }))
  log(JSON.stringify(diag, null, 2))
  log('CONSOLE ERRORS:', errors)
  await browser.close()
  process.exit(2)
}
// give the count-up + canvas draw a beat
await new Promise((r) => setTimeout(r, 1500))

const data = await page.evaluate(() => {
  const q = (s) => document.querySelector(s)?.textContent?.trim()
  const canvas = document.querySelector('canvas.stage-canvas')
  let canvasPainted = false
  if (canvas) {
    const ctx = canvas.getContext('2d')
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) { canvasPainted = true; break } }
  }
  return {
    score: q('.gauge-score'),
    grade: q('.grade-pill'),
    verdictTitle: q('.verdict-title'),
    verdictSub: q('.verdict-sub'),
    metrics: [...document.querySelectorAll('.metric-name')].map((e) => e.childNodes[0].textContent.trim()),
    metricVals: [...document.querySelectorAll('.metric-val')].map((e) => e.textContent.trim()),
    notes: [...document.querySelectorAll('.note-body')].length,
    canvasW: canvas?.width, canvasH: canvas?.height, canvasPainted,
  }
})
log('\n=== RESULT ===')
log(JSON.stringify(data, null, 2))

// now test the pricing CTA
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Show me how to be more humble/i.test(x.textContent))
  b.click()
})
await page.waitForSelector('.pricing-grid', { timeout: 5000 })
const plans = await page.evaluate(() => [...document.querySelectorAll('.price-name')].map((e) => e.textContent))
log('\n✓ pricing page reached, plans:', plans.join(', '))

log('\n=== CONSOLE ERRORS ===', errors.length ? errors : 'none')

await browser.close()
log('\nDONE')
