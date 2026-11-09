// "עכשיו בחרדות" on the home (plan tz-home, his pick A, 2026-11-08): ח24's lead story and, under it, "מה אומרים בציפציפ" - the
// three newest posts. Display only: ציפציפ (/tziftzif) and ח24 (/charadot) are their own sites (techietech-api/tz.js, built by the
// "Social next level" session); this reads verseTz?op=home. Until verseMeta/tz.open the server answers 403 to everyone but him, so
// for everyone else the module is simply not there - it follows that switch by itself. A quiet day (nobody posted today, or a bad
// day when the verse stays silent) shows the last ones under "מהימים האחרונים", never "לפני X דק'" that pretends they're fresh.
// Impressions of real people go by their verse names (op=home `names`), never the wiki's real name. No AI here, no cost.
import { esc, ago, abs, track, av, I } from './ui.js';
import { st, onState, signedIn } from './state.js';
import { tzHomeOpen } from './gates.js';

const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseTz?op=home';
const FRESH = 120e3;   // the home redraws often (state changes); one read every 2 minutes is plenty
let data = null, at = 0, busy = null, who;   // who = the account the last read was for (his account sees it before the release)

const nm = (id, names) => (id === 'charadot' ? 'החרדות 24' : (names && names[id] && names[id].name) || (C[id] && C[id].name) || '');
const face = (id) => (id === 'charadot' ? '/charadot/img/avatar.png' : abs(C[id] && C[id].img));
const ARROW = '←';

// one ציפציפ post (opt-a): the face, the name + time, two lines, and its likes / comments on the side
function post(p, names, quiet) {
  return `<a class="tzh-post" href="/tziftzif/p/${esc(p.id)}" data-tzh="post">
      <img class="tzh-face" src="${esc(face(p.by))}" alt="" loading="lazy">
      <div class="tzh-pb"><div class="tzh-l1"><b>${esc(nm(p.by, names))}</b>${quiet ? '' : `<time>${esc(ago(p.t))}</time>`}</div>
        <p>${esc(p.text)}</p>
        ${p.quote ? `<div class="tzh-q"><b>${esc(nm(p.quote.by, names))}</b> ${esc(p.quote.text)}</div>` : ''}</div>
      <div class="tzh-n"><span>${I.planet}${p.stamps || 0}</span><span>${CMT}${p.replies || 0}</span></div></a>`;
}
const CMT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.3A8.5 8.5 0 1 1 20.5 12z"/></svg>';

// the module's html from what was last read (sync - the home redraws it), '' when there is nothing or no access
export function tzHome() {
  if (!tzHomeOpen()) return '';   // his own switch (gates.js TZ_HOME), apart from ציפציפ's
  const d = data;
  if (!d || (!d.lead && !(d.posts || []).length)) return '';
  const quiet = !!(d.quiet || d.silent), L = d.lead, posts = (d.posts || []).slice(0, 3);
  return `<section class="tzh"><div class="tzh-card">
      <div class="tzh-h">${quiet ? '' : '<i class="tzh-live"></i>'}<h2>עכשיו בחרדות 24</h2>${quiet ? '<small>מהימים האחרונים</small>' : ''}</div>
      ${L ? `<a class="tzh-lead" href="/charadot/a/${esc(L.id)}" data-tzh="lead">${L.img ? `<img class="tzh-img" src="${esc(L.img)}" alt="" loading="lazy">` : ''}
        <img class="tzh-logo" src="/charadot/img/logo-wide.png?v=2" alt="החרדות 24">
        <span class="tzh-lt"><em>${esc(L.tag || 'מבזק')}</em><b>${esc(L.headline)}</b><small>אסונית לוי מדווחת${quiet ? '' : ` · <span>${esc(ago(L.t))}</span>`}</small></span></a>` : ''}
      ${posts.length ? `<div class="tzh-sub"><img src="/tziftzif/img/mark-dark.png" alt=""><b>מה מצייצים ב<span class="tzw">ציפ<i>ציפ</i></span></b></div>
        <div class="tzh-posts">${posts.map((p) => post(p, d.names, quiet)).join('')}</div>` : ''}
      <div class="tzh-links"><a href="/tziftzif" data-tzh="tziftzif">לכל הציפציפ ${ARROW}</a><a href="/charadot" data-tzh="charadot">להחרדות 24 ${ARROW}</a></div>
    </div></section>`;
}

// the card beside it for a signed-in visitor (plan tz-home D1, his "what for citizens?" 2026-11-08): a citizen gets "זכות הדיבור
// שלך" - their passport, ח24's lead as a prompt, two residents' posts about it (his "I should see tweets here", 2026-11-09),
// "לצייץ על זה" (ציפציפ opens with ח24's post quoted), their own numbers;
// a resident without a passport gets the way to one. Signed out, pages.js puts the citizenship card there instead.
export function tzSide() {
  if (!tzHomeOpen() || !signedIn() || !data || !data.lead) return '';
  const L = data.lead, f = st.fan || {}, n = f.citizen && f.citizen.n, m = data.mine || { posts: 0, stamps: 0 }, talk = data.talk || [];
  if (!n) return `<aside class="tzh-side"><div class="tzh-sh"><h2>זכות הדיבור</h2></div>
      <p class="tzh-sp">בציפציפ מצייצים, מגיבים ומחתימים רק אזרחי השלומיוורס - עם דרכון. התושבים כבר מתווכחים על החדשות של היום.</p>
      <a class="vx-btn main block" href="/citizenship" data-tzh="side-passport">להוציא דרכון</a></aside>`;
  return `<aside class="tzh-side"><div class="tzh-sh"><h2>זכות הדיבור שלך</h2><span class="tzh-chip">אזרח/ית</span></div>
      <div class="tzh-me">${av({ fan: f, cls: 'tzh-meav' })}<b>${esc(f.nick || '')}</b><span>אזרח/ית מס' ${esc(Number(n).toLocaleString('he-IL'))}</span></div>
      <a class="tzh-ask" href="/charadot/a/${esc(L.id)}" data-tzh="side-lead"><img src="/charadot/img/logo-wide.png?v=2" alt="החרדות 24"><b>${esc(L.headline)}</b><small>מה דעתך?</small></a>
      ${talk.length ? `<div class="tzh-talk"><small>מה אומרים התושבים</small>${talk.map((p) => `<a class="tzh-tk" href="/tziftzif/p/${esc(p.root || p.id)}" data-tzh="side-talk">
          <img class="tzh-face" src="${esc(face(p.by))}" alt="" loading="lazy"><span><b>${esc(nm(p.by, data.names))}</b><p>${esc(p.text)}</p></span></a>`).join('')}</div>` : ''}
      <a class="vx-btn main block" href="/tziftzif${L.post ? `?quote=${esc(L.post)}` : ''}" data-tzh="side-tweet">${PEN}לצייץ על זה</a>
      <p class="tzh-mine">הציוצים שלך: ${m.posts} · חותמות שקיבלת: ${m.stamps}</p></aside>`;
}
const PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/></svg>';

// on the home: read (at most every 2 minutes) and draw into #tz-home; any error (403 "soon" before the release) = nothing shown
export async function mountTz() {
  if (!tzHomeOpen()) return;   // closed: not even a request
  const draw = () => { const el = document.getElementById('tz-home'); if (el) el.innerHTML = tzHome(); const sd = document.getElementById('tz-side'); if (sd) sd.innerHTML = tzSide(); };
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
