// בדיקת שפיות: מרנדרים את כל הפרקים ב-Node כדי לתפוס קריסות ריצה
import { build } from 'esbuild'
import { renderToString } from 'react-dom/server'
import React from 'react'
import fs from 'node:fs'

globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null },
  setItem(k, v) { this._d[k] = String(v) },
}
globalThis.window = { scrollTo() {} }
globalThis.document = { documentElement: { setAttribute() {} } }

await build({
  entryPoints: ['src/chapters.jsx'],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  external: ['react', 'react-dom'],
  loader: { '.css': 'empty' },
  outfile: '.ssr-out.mjs',
  logLevel: 'error',
})

const { CHAPTERS } = await import('./.ssr-out.mjs')

let fail = 0
for (const c of CHAPTERS) {
  try {
    const html = renderToString(React.createElement(c.body))
    console.log(`✓ ${c.id.padEnd(10)} ${String(html.length).padStart(6)} chars`)
  } catch (e) {
    fail++
    console.log(`✗ ${c.id}: ${e.message}`)
  }
}

await build({
  entryPoints: ['src/App.jsx'],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  external: ['react', 'react-dom'],
  loader: { '.css': 'empty' },
  outfile: '.ssr-app.mjs',
  logLevel: 'error',
})
const { default: App } = await import('./.ssr-app.mjs')
try {
  const html = renderToString(React.createElement(App))
  console.log(`✓ App        ${String(html.length).padStart(6)} chars`)
} catch (e) {
  fail++
  console.log(`✗ App: ${e.message}`)
}

fs.rmSync('.ssr-out.mjs', { force: true })
fs.rmSync('.ssr-app.mjs', { force: true })
process.exit(fail ? 1 : 0)
