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
// a face on every post (his note 2026-11-09): the portrait, else (no portrait yet, or the wiki not read yet) the name's first
// letter - never a broken picture
const faceTag = (id, names, cls = 'tzh-face') => { const src = face(id); return src ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy">` : `<span class="${cls} tzh-ini">${esc(nm(id, names).slice(0, 1) || '?')}</span>`; };

// one ציפציפ post (opt-a): the face, the name + time, two lines, and its likes / comments on the side
function post(p, names, quiet) {
  return `<a class="tzh-post" href="/tziftzif/p/${esc(p.id)}" data-tzh="post">
      ${faceTag(p.by, names)}
      <div class="tzh-pb"><div class="tzh-l1"><b>${esc(nm(p.by, names))}</b>${quiet ? '' : `<time>${esc(ago(p.t))}</time>`}</div>
        <p>${esc(p.text)}</p>${about(p, names)}</div>
      <div class="tzh-n"><span>${I.planet}${p.stamps || 0}</span><span>${CMT}${p.replies || 0}</span></div></a>`;
}
// what a post is about (his note 2026-11-09: "not clear what the characters are reacting to"), on phones too: the post it
// reposts (its writer's face, and ח24's headline when it is the channel's) or the news it shares
function about(p, names) {
  const q = p.quote;
  if (q) return `<div class="tzh-q">${faceTag(q.by, names, 'tzh-qf')}<b>${esc(nm(q.by, names))}</b><span>${esc(q.headline || (q.link && q.link.title) || q.text)}</span></div>`;
  if (p.link) return `<div class="tzh-q tzh-lk">${LINK}<b>${esc(p.link.src)}</b><span>${esc(p.link.title)}</span></div>`;
  return '';
}
const LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>';
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
      ${posts.length ? `<a class="tzh-sub" href="/tziftzif" data-tzh="tziftzif-logo"><img src="/tziftzif/img/mark-dark.png" alt=""><b>מה מצייצים ב<span class="tzw">ציפ<i>ציפ</i></span></b><span class="tzh-go">${ARROW}</span></a>
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
  const L = data.lead, f = st.fan || {}, n = f.citizen && f.citizen.n, m = data.mine || { posts: 0, stamps: 0 }, talk = data.topic ? data.talk || [] : [];
  if (!n) return `<aside class="tzh-side"><div class="tzh-sh"><a class="tzh-mk" href="/tziftzif" data-tzh="side-logo" aria-label="ציפציפ"><img src="/tziftzif/img/mark-dark.png" alt=""></a><h2>זכות הדיבור</h2></div>
      <p class="tzh-sp">בציפציפ מצייצים, מגיבים ומחתימים רק אזרחי השלומיוורס - עם דרכון. התושבים כבר מתווכחים על החדשות של היום.</p>
      <a class="vx-btn main block" href="/citizenship" data-tzh="side-passport">להוציא דרכון</a></aside>`;
  // the story = ח24's post the residents answered (op=home `topic`), as a ציפציפ thread: the channel's post with its face and
  // the story's picture, the residents' answers hanging under it with theirs (his note 2026-11-09: every post with a face, and
  // clear what they react to); no answers yet = the newest story alone
  const T = data.topic || L, href = T.post ? `/tziftzif/p/${esc(T.post)}` : `/charadot/a/${esc(T.id)}`;
  return `<aside class="tzh-side"><div class="tzh-sh"><a class="tzh-mk" href="/tziftzif" data-tzh="side-logo" aria-label="ציפציפ"><img src="/tziftzif/img/mark-dark.png" alt=""></a><h2>זכות הדיבור שלך</h2><span class="tzh-chip">אזרח/ית</span></div>
      <div class="tzh-me">${av({ fan: f, cls: 'tzh-meav' })}<b>${esc(f.nick || '')}</b><span>אזרח/ית מס' ${esc(Number(n).toLocaleString('he-IL'))}</span></div>
      <div class="tzh-th">
        <a class="tzh-tp" href="${href}" data-tzh="side-lead"><img class="tzh-face" src="/charadot/img/avatar.png" alt="">
          <span class="tzh-tb"><span class="tzh-l1"><b>החרדות 24</b>${talk.length ? `<time>${esc(ago(T.t))}</time>` : ''}</span><p>${esc(T.text || T.headline)}</p>
          <span class="tzh-ta">${T.img ? `<img src="${esc(T.img)}" alt="" loading="lazy">` : ''}<span><small>${esc(T.tag || 'מבזק')}</small>${esc(T.headline)}</span></span></span></a>
        ${talk.map((p) => `<a class="tzh-tk" href="/tziftzif/p/${esc(p.root || p.id)}" data-tzh="side-talk">${faceTag(p.by, data.names)}
          <span><span class="tzh-l1"><b>${esc(nm(p.by, data.names))}</b><time>${p.kind === 'quote' ? 'ציטט/ה' : 'הגיב/ה'}</time></span><p>${esc(p.text)}</p></span></a>`).join('')}
      </div>
      <a class="vx-btn main block" href="/tziftzif${T.post ? `?quote=${esc(T.post)}` : ''}" data-tzh="side-tweet">${PEN}${talk.length ? 'גם לך יש מה להגיד?' : 'לצייץ על זה'}</a>
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
