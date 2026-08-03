import puppeteer from 'puppeteer-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const URL = 'http://localhost:4173/humblo/'
const IMG = 'C:\\Users\\shazbak\\Downloads\\behumble.jpg'
const OUT = 'C:\\Users\\shazbak\\AppData\\Local\\Temp\\claude\\c--workspace-BoostMind\\f6aa1212-e007-40ce-92a7-76752e11b40a\\scratchpad\\'

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--use-gl=swiftshader', '--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

// 1. mobile home (the tool) — idle
await page.goto(URL, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: OUT + 'm-home.png', fullPage: true })

// 2. upload directly + result
await page.waitForSelector('input[type=file]')
await (await page.$('input[type=file]')).uploadFile(IMG)
await page.waitForSelector('.gauge-score', { timeout: 40000 })
await new Promise((r) => setTimeout(r, 1800))
await page.screenshot({ path: OUT + 'm-result.png', fullPage: true })

// 3. pricing
await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /more humble/i.test(x.textContent)).click())
await page.waitForSelector('.pricing-grid')
await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: OUT + 'm-pricing.png', fullPage: true })

// 4. desktop home sanity
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
await page.goto(URL, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: OUT + 'd-home.png' })

await browser.close()
console.log('shots done')
