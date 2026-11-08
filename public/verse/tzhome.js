// "עכשיו בחרדות" on the home (plan tz-home, his pick A, 2026-11-08): ח24's lead story and, under it, "מה אומרים בציפציפ" - the
// three newest posts. Display only: ציפציפ (/tziftzif) and ח24 (/charadot) are their own sites (techietech-api/tz.js, built by the
// "Social next level" session); this reads verseTz?op=home. Until verseMeta/tz.open the server answers 403 to everyone but him, so
// for everyone else the module is simply not there - it follows that switch by itself. A quiet day (nobody posted today, or a bad
// day when the verse stays silent) shows the last ones under "מהימים האחרונים", never "לפני X דק'" that pretends they're fresh.
// Impressions of real people go by their verse names (op=home `names`), never the wiki's real name. No AI here, no cost.
import { esc, ago, abs, track } from './ui.js';
import { st, onState } from './state.js';
import { tzHomeOpen } from './gates.js';

const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseTz?op=home';
const FRESH = 120e3;   // the home redraws often (state changes); one read every 2 minutes is plenty
let data = null, at = 0, busy = null, who;   // who = the account the last read was for (his account sees it before the release)

const nm = (id, names) => (id === 'charadot' ? 'ח24' : (names && names[id] && names[id].name) || (C[id] && C[id].name) || '');
const face = (id) => (id === 'charadot' ? '/charadot/img/avatar.png' : abs(C[id] && C[id].img));
const ARROW = '←';

function post(p, names, quiet) {
  return `<a class="tzh-post" href="/tziftzif/p/${esc(p.id)}" data-tzh="post">
      <img class="tzh-face" src="${esc(face(p.by))}" alt="" loading="lazy">
      <div class="tzh-pb"><div class="tzh-l1"><b>${esc(nm(p.by, names))}</b>${quiet ? '' : `<time>${esc(ago(p.t))}</time>`}</div>
        <p>${esc(p.text)}</p>
        ${p.quote ? `<div class="tzh-q"><b>${esc(nm(p.quote.by, names))}</b> ${esc(p.quote.text)}</div>` : ''}
        ${p.replies || p.stamps ? `<div class="tzh-n">${p.replies ? `<span>${p.replies === 1 ? 'תגובה אחת' : p.replies + ' תגובות'}</span>` : ''}${p.stamps ? `<span>${p.stamps === 1 ? 'חותמת אחת' : p.stamps + ' חותמות'}</span>` : ''}</div>` : ''}</div></a>`;
}

// the module's html from what was last read (sync - the home redraws it), '' when there is nothing or no access
export function tzHome() {
  if (!tzHomeOpen()) return '';   // his own switch (gates.js TZ_HOME), apart from ציפציפ's
  const d = data;
  if (!d || (!d.lead && !(d.posts || []).length)) return '';
  const quiet = !!(d.quiet || d.silent), L = d.lead, posts = (d.posts || []).slice(0, 3);
  return `<section class="sec tzh"><div class="tzh-card">
      <div class="tzh-h">${quiet ? '' : '<i class="tzh-live"></i>'}<h2>עכשיו בחרדות</h2>${quiet ? '<small>מהימים האחרונים</small>' : ''}</div>
      ${L ? `<a class="tzh-lead" href="/charadot/a/${esc(L.id)}" data-tzh="lead">
        <span class="tzh-pic">${L.img ? `<img class="tzh-bg" src="${esc(L.img)}" alt="" aria-hidden="true" loading="lazy"><img class="tzh-img" src="${esc(L.img)}" alt="" loading="lazy">` : ''}<img class="tzh-logo" src="/charadot/img/logo-wide.png" alt="ח24"></span>
        <span class="tzh-lt"><em>${esc(L.tag || 'מבזק')}</em><b>${esc(L.headline)}</b><small>אסונית לוי מדווחת${quiet ? '' : ` · <span>${esc(ago(L.t))}</span>`}</small></span></a>` : ''}
      ${posts.length ? `<div class="tzh-sub"><img src="/tziftzif/img/mark-dark.png" alt=""><b>מה אומרים בציפציפ</b></div>
        <div class="tzh-posts">${posts.map((p) => post(p, d.names, quiet)).join('')}</div>` : ''}
      <div class="tzh-links"><a href="/tziftzif" data-tzh="tziftzif">לכל הציפציפ ${ARROW}</a><a href="/charadot" data-tzh="charadot">לח24 ${ARROW}</a></div>
    </div></section>`;
}

// on the home: read (at most every 2 minutes) and draw into #tz-home; any error (403 "soon" before the release) = nothing shown
export async function mountTz() {
  if (!tzHomeOpen()) return;   // closed: not even a request
  const draw = () => { const el = document.getElementById('tz-home'); if (el) el.innerHTML = tzHome(); };
  draw();
  if (Date.now() - at < FRESH && who === (st.user ? st.user.uid : null)) return;
  if (!busy) {
    busy = (async () => {
      try {
        who = st.user ? st.user.uid : null;
        const tok = st.user ? await st.user.getIdToken() : null;
        const r = await fetch(API, { headers: tok ? { authorization: 'Bearer ' + tok } : {} });
        data = r.ok ? await r.json() : null;
      } catch (e) { data = null; }
      at = Date.now();
    })().finally(() => { busy = null; });
  }
  await busy;
  draw();
}
document.addEventListener('click', (e) => { const a = e.target.closest('[data-tzh]'); if (a) track('tz_home', a.dataset.tzh); });
// the account becomes known after the first draw (Firebase) - read again for it, so he sees it on a refresh too
onState(() => { if (document.getElementById('tz-home') && who !== (st.user ? st.user.uid : null)) mountTz(); });
