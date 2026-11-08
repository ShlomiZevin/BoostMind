// ציפציפ's logo as real vectors (his note 2026-11-08 on the image-model sheets: "this one a bit broken" - the one-colour
// version's ring broke into the bird). The mark he picked (feed-logos/P1: the planet-bird speech bubble) redrawn in SVG -
// the ring passes behind the bird and in front of it, with a gap of the background around it - and the word ציפציפ set in
// a real Hebrew font (Rubik 900), so it is exact at every size and in every colour. Writes the site's files
// (public/tziftzif/img/) and a sheet of every version for him.
//   node scripts/v2-design/tz-logo-svg.mjs   ->  public/tziftzif/img/*  +  Documents/shlomiverse-v2-design/tz-logo/V-*.png
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('../../zoomcut/render/node_modules/puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SITE = 'C:/workspace/BoostMind/public/tziftzif/img';
const OUT = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/tz-logo';
fs.mkdirSync(SITE, { recursive: true });

const ORANGE = '#ff7a1f';
// the mark, 140x110: body circle (64,52) r32 + the bubble's tail at the bottom left, an open beak, an eye, the ring
// (an ellipse turned -14deg): its back half under the body, its front half over it, each with a band of `bg` around it
function mark({ bg, body, line = 'none', ring, eye, glow = false, lineW = 3.5, id = 'm' }) {
  // body circle (62,50) r32; the bubble's tail short and round at the bottom left; the beak open, high on the right;
  // the ring flatter and lower (turned -9deg) so it never reaches the beak
  const shape = 'M43.5 76.1 L27 96 L57 81.6 A32 32 0 1 0 43.5 76.1 Z';
  const beak = 'M87.5 27 L108 21 L93.5 36 Z M93.5 38.5 L106 41.5 L90 44 Z';
  const ell = (stroke, w) => `<ellipse cx="60" cy="60" rx="53" ry="11" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 124 106">
  <defs>
    ${glow ? `<filter id="${id}g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : ''}
    <clipPath id="${id}f"><rect x="-20" y="60" width="170" height="40" transform="rotate(-6 60 60)"/></clipPath>
  </defs>
  <g ${glow ? `filter="url(#${id}g)"` : ''}>
    <g transform="rotate(-6 60 60)">${ell(ring, 6)}</g>
    <path d="${shape}" fill="${body}" stroke="${line}" stroke-width="${line === 'none' ? 0 : lineW}" stroke-linejoin="round"/>
    <path d="${beak}" fill="${line !== 'none' ? line : ring}" stroke="${line !== 'none' ? line : ring}" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="73" cy="37" r="5.4" fill="${eye}"/>
    <g clip-path="url(#${id}f)" transform="rotate(-6 60 60)">${ell(bg, 10.5)}${ell(ring, 6)}</g>
  </g>
</svg>`;
}
const V = {
  dark: { bg: '#0b0b0e', body: '#0b0b0e', line: ORANGE, ring: ORANGE, eye: '#ffffff', glow: true, word: ['#ffffff', ORANGE] },
  light: { bg: '#faf7f2', body: '#1c1c22', ring: ORANGE, eye: '#ffffff', word: ['#1c1c22', ORANGE] },
  orange: { bg: ORANGE, body: '#ffffff', ring: '#ffffff', eye: ORANGE, word: ['#ffffff', '#ffffff'] },
  white: { bg: '#000000', body: '#ffffff', ring: '#ffffff', eye: '#000000', word: ['#ffffff', '#ffffff'] },
  black: { bg: '#ffffff', body: '#000000', ring: '#000000', eye: '#ffffff', word: ['#000000', '#000000'] },
  mono: { bg: '#0b0b0e', body: ORANGE, ring: ORANGE, eye: '#0b0b0e', word: [ORANGE, ORANGE] },
};
const svg = (k, id = k) => mark({ ...V[k], id });
const word = (k, size) => `<span class="w" style="font-size:${size}px"><b style="color:${V[k].word[0]}">ציפ</b><b style="color:${V[k].word[1]}">ציפ</b></span>`;
const FONT = '<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800;900&display=swap" rel="stylesheet">';
const CSS = `*{margin:0;box-sizing:border-box} body{font-family:Rubik,sans-serif;direction:rtl}
.w{font-weight:900;letter-spacing:-.01em;line-height:1;white-space:nowrap} .w b{font-weight:900}
.h{display:flex;align-items:center;gap:.25em} .s{display:flex;flex-direction:column;align-items:center;gap:6px}`;

// the site's own files: the mark in each colour, and the horizontal lockup as SVG with the word outlined later by the page font
for (const k of Object.keys(V)) fs.writeFileSync(path.join(SITE, `mark-${k}.svg`), svg(k));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
async function shot(html, file, w, h, scale = 2) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: scale });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${CSS}</style></head><body>${html}</body></html>`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(async () => { await document.fonts.load('900 40px Rubik', 'ציפ'); await document.fonts.ready; });
  await page.screenshot({ path: file, omitBackground: html.includes('data-clear') });
}
// icons for the site (app icon, avatar, favicon)
const tile = (k, size, round) => `<div style="width:${size}px;height:${size}px;background:${V[k].bg};border-radius:${round ? '50%' : size * 0.22 + 'px'};display:grid;place-items:center"><div style="width:${size * 0.8}px">${svg(k, k + size)}</div></div>`;
await shot(tile('dark', 512, false).replace('border-radius:112.64px', 'border-radius:0'), path.join(SITE, 'icon-512.png'), 512, 512, 1);
await shot(tile('dark', 192, false).replace(/border-radius:[\d.]+px/, 'border-radius:0'), path.join(SITE, 'icon-192.png'), 192, 192, 1);
await shot(`<div data-clear>${tile('dark', 256, true)}</div>`, path.join(SITE, 'avatar.png'), 256, 256, 1);
await shot(tile('orange', 64, false).replace(/border-radius:[\d.]+px/, 'border-radius:14px'), path.join(SITE, 'favicon-64.png'), 64, 64, 1);
await shot(`<div style="background:${V.dark.bg};width:1200px;height:630px;display:grid;place-items:center"><div class="h" style="direction:rtl"><div style="width:230px">${svg('dark', 'og')}</div>${word('dark', 150)}</div></div>`, path.join(SITE, 'og.png'), 1200, 630, 1);

// the sheet for him: every version
const panel = (k, inner, w = 560, h = 230) => `<div style="background:${V[k].bg};width:${w}px;height:${h}px;display:grid;place-items:center">${inner}</div>`;
const horiz = (k, s = 1) => `<div class="h"><div style="width:${120 * s}px">${svg(k, 'h' + k + s)}</div>${word(k, 78 * s)}</div>`;
const stack = (k) => `<div class="s"><div style="width:200px">${svg(k, 's' + k)}</div>${word(k, 84)}</div>`;
await shot(`<div style="display:grid;grid-template-columns:repeat(2,560px)">${['dark', 'light', 'orange', 'white', 'black', 'mono'].map((k) => panel(k, horiz(k))).join('')}</div>`, path.join(OUT, 'V-horizontal.png'), 1120, 690);
await shot(`<div style="display:grid;grid-template-columns:repeat(2,560px)">${['dark', 'light'].map((k) => panel(k, stack(k), 560, 420)).join('')}</div>`, path.join(OUT, 'V-stacked.png'), 1120, 420);
await shot(`<div style="display:flex;gap:28px;padding:28px;background:#e9e6e0;align-items:center">${tile('dark', 220, false)}${tile('orange', 220, false)}${tile('dark', 220, true)}${tile('light', 220, false)}<div style="display:flex;flex-direction:column;gap:14px;align-items:center">${tile('orange', 64, false)}${tile('orange', 32, false)}${tile('dark', 16, false)}</div></div>`, path.join(OUT, 'V-icons.png'), 1100, 276);
await browser.close();
console.log('ok');
