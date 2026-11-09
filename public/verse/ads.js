// The verse's sponsored banner ("ממומן") - his note 2026-11-09: Hani's video ends "בחסות עיגוליות" with a discount for
// Shlomiverse users, so the site carries the ad too (part of the world). One general slot, the same for every sponsor (his OK on
// mockups B1/B2/P1/D1/W1, scripts/v2-design/ad-slot.mjs): a label row nobody can miss ("ממומן" + "בחסות <sponsor>"), the sponsor's
// own picture (wide on a computer, a tighter card on a phone). A coupon ad opens the coupon window: a citizen gets the code
// (the server gives it only to a passport - techietech-api/ads.js), anyone else the way to a passport. The sponsors are records
// (scripts/verse/ads.cjs) - placed by `places`: "home" (under the hero) and "c/<character>" (the top of the character's page).
import { esc, track, sheet, toast } from './ui.js';
import { st, signedIn } from './state.js';
import { isCitizen } from './citizen.js';

const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseAds';
let ads = null;
const seen = new Set();

const label = (a) => `<div class="ad-h"><span class="ad-by">בחסות ${esc(a.sponsor)}</span><button type="button" class="ad-tag" data-ad-info aria-label="מודעה ממומנת">${INFO}ממומן</button></div>`;
const INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.1"/></svg>';

function banner(a) {
  return `<section class="ad">${label(a)}
    <a class="ad-pic" href="${esc(a.href || '#')}" data-ad-open="${esc(a.id)}"><picture><source media="(min-width: 700px)" srcset="${esc(a.wide)}">
      <img src="${esc(a.card)}" alt="${esc(a.alt)}" loading="lazy"></picture></a></section>`;
}

// the slot's html for a place ('' until the list is here - then every slot on the page fills itself)
export function adSlot(place) {
  const a = ads && ads.find((x) => (x.places || []).includes(place));
  if (a && !seen.has(place + location.pathname)) { seen.add(place + location.pathname); track('ad_view', `${a.id}:${place}`); }
  return `<div class="ad-slot" data-ad-place="${esc(place)}">${a ? banner(a) : ''}</div>`;
}

(async () => {
  try { const r = await fetch(API + '?op=list'); ads = r.ok ? (await r.json()).ads || [] : []; } catch (e) { ads = []; }
  for (const el of document.querySelectorAll('[data-ad-place]')) if (!el.firstElementChild) el.outerHTML = adSlot(el.dataset.adPlace);
})();

// ---------- the coupon window (mockup W1) ----------
function ticket(a, code, locked) {
  return `<div class="adc-ticket${locked ? ' locked' : ''}"><b class="adc-code">${locked ? '' : code ? esc(code) : '<i class="adc-wait"></i>'}</b>
      ${locked ? `<span class="adc-lock">${LOCK}</span>` : ''}<p>${esc(a.coupon.line)}</p></div>`;
}
const LOCK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0zm3 4a1.6 1.6 0 0 0-1 2.9V19h2v-2.1a1.6 1.6 0 0 0-1-2.9z"/></svg>';

function body(a, state, code) {
  const c = a.coupon, locked = state === 'locked';
  return `<div class="in adc">
      <span class="adc-tag">ממומן · בחסות ${esc(a.sponsor)}</span>
      ${c.logo ? `<img class="adc-logo" src="${esc(c.logo)}" alt="${esc(a.sponsor)}">` : ''}
      <h2 class="adc-t">${esc(c.title)}</h2>
      ${ticket(a, code, locked)}
      ${locked ? `<p class="adc-why">יש להוציא דרכון שלומיוורס כדי לקבל את הקופון</p>
          <a class="adc-go" href="/citizenship" data-ad-passport>להוציא דרכון ולקבל את הקופון</a>`
        : `<button type="button" class="adc-go" data-ad-copy${code ? '' : ' disabled'}>להעתיק את הקוד</button>`}
      ${c.fine ? `<p class="adc-fine">${esc(c.fine)}</p>` : ''}
      ${a.href ? `<a class="adc-more" href="${esc(a.href)}">לאתר של ${esc(a.sponsor)} ←</a>` : ''}</div>`;
}

async function openCoupon(a) {
  track('ad_click', a.id);
  const can = signedIn() && isCitizen();
  const h = sheet(body(a, can ? 'wait' : 'locked'), { cls: 'adc-sheet' });
  let code = '';
  h.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-ad-passport]')) { track('ad_passport', a.id); h.close('go'); }   // the page goes on to /citizenship
    if (e.target.closest('[data-ad-copy]') && code) {
      try { await navigator.clipboard.writeText(code); } catch (err) { /* old browsers: the code is on the screen anyway */ }
      track('ad_copy', a.id); toast('הקוד הועתק');
    }
  });
  if (!can) return;
  try {
    const r = await fetch(`${API}?op=coupon&id=${encodeURIComponent(a.id)}`, { headers: { authorization: 'Bearer ' + (await st.user.getIdToken()) } });
    const j = await r.json();
    code = j.code || '';
    h.el.querySelector('.adc').outerHTML = body(a, code ? 'code' : 'locked', code);
  } catch (e) { h.el.querySelector('.adc').outerHTML = body(a, 'locked'); }
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-ad-info]')) { e.preventDefault(); toast('מודעה ממומנת. השלומיוורס קיבל עליה תשלום בעיגוליות.', 3200); return; }
  const o = e.target.closest('[data-ad-open]');
  if (!o) return;
  const a = ads && ads.find((x) => x.id === o.dataset.adOpen);
  if (!a || !a.coupon) { if (a) track('ad_click', a.id); return; }   // a plain ad: the link goes to the sponsor
  e.preventDefault();
  openCoupon(a);
}, true);   // before the wiki's router, whatever the sponsor's link is
