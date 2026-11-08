// ציפציפ - the page (shlomiverse.com/tziftzif). Reads everything from verseTz (techietech-api/tz.js), the residents' names
// and faces from the verse's own wiki.json, the account from the verse's sign-in (/verse/site-signin.js). Addresses:
//   /tziftzif          the timeline (בשבילך / במעקב)
//   /tziftzif/p/<id>   one post with its whole conversation
//   /tziftzif/u/<id>   a resident's posts
// Reading is open (once he opens it - until then the server answers "soon" to everyone but him); posting, replying and
// stamping are for the verse's citizens (a passport, not only an account); anyone signed in may report.
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = LOCAL ? 'http://127.0.0.1:5001/demo-shlomiverse/europe-west1/verseTz' : 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseTz';
const WIKI = 'https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json';
const VERSE = 'https://shlomiverse.com';
const app = document.getElementById('app');
let C = {}, ME = { signed: false, citizen: false, owner: false, follows: [], names: {} }, TAB = 'all';
// an impression of a real person goes by its verse name and handle here (the server's aliases), never the real name
const nm = (id) => (ME.names && ME.names[id] && ME.names[id].name) || (C[id] && C[id].name) || id;
const hdl = (id) => (ME.names && ME.names[id] && ME.names[id].handle) || id;

// ---------- small things ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const track = (e, x) => { try { window.track && window.track(e, x); } catch (er) {} };
const S = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
const I = {
  back: S('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  reply: S('<path d="M4 5h16v11H9l-5 4z"/>'),
  share: S('<path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5"/>'),
  // the like = the verse's own like (his ask 2026-11-08): the logo's planet without its word, as in the verse's ui.js
  stamp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" class="pl"><g transform="rotate(-16 12 12)"><path d="M1.5 12.6A10.5 4.3 0 0 1 22.5 12.6" stroke-width="2.4"/><circle cx="12" cy="12" r="7.6" fill="var(--bg)" stroke-width="2"/><path d="M1.5 12.6A10.5 4.3 0 0 0 22.5 12.6" stroke-width="2.8"/></g></svg>',
  more: S('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
  send: S('<path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m10 13 4-4"/>'),
  pen: S('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  flag: S('<path d="M5 21V4h11l-1.5 4L16 12H5"/>'),
  link: S('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  search: S('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
  home: S('<path d="M3.5 11 12 4l8.5 7v9h-6v-6h-5v6h-6z"/>'),
  bell: S('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  people: S('<circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.5c.9-3.2 3.2-5 6.2-5s5.3 1.8 6.2 5"/><circle cx="17" cy="9" r="2.7"/><path d="M16.4 14.2c2.6.1 4.3 1.7 5 4.3"/>'),
  user: S('<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>'),
};
// the checks: ח24 = the news channel (red), ציפציפ itself = the official account (orange), a resident = a quiet one
const CHECK = (c) => `<svg class="badge" viewBox="0 0 24 24"><path fill="${c}" d="M12 1.8l2.4 1.8 3-.2 1 2.8 2.6 1.6-.7 2.9 1.2 2.7-2.3 1.9-.4 3-3 .5-1.9 2.3-2.8-1.1-2.8 1.1-1.9-2.3-3-.5-.4-3L1.5 12l1.2-2.7L2 6.4l2.6-1.6 1-2.8 3 .2z"/><path d="m8 12.2 2.7 2.6L16.3 9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'עכשיו';
  if (s < 3600) return `${Math.floor(s / 60)} דק׳`;
  if (s < 86400) return `${Math.floor(s / 3600)} שע׳`;
  return new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}
const toast = (m) => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); };
// loading = the logo with its word (his note 2026-11-08)
const loader = () => '<div class="load"><img src="/tziftzif/img/mark-dark.png" alt=""><span class="word">ציפ<i>ציפ</i></span></div>';
const count = (n) => (n ? (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : n) : '');

// who wrote a post: a resident, ח24, ציפציפ's official account (his), or a citizen
function who(p) {
  if (p.by === 'charadot') return { name: 'חרדות', handle: 'charadot', img: '/charadot/img/avatar.png', href: '/charadot', badge: CHECK('#e3101b'), stamp: 'הישארו איתנו', news: true };
  if (p.by) {
    const c = C[p.by] || { name: p.by };
    return { name: nm(p.by), handle: hdl(p.by), img: c.img, href: `/tziftzif/u/${p.by}`, badge: CHECK('#7d8590'), stamp: stampOf(c) };
  }
  const f = p.fan || {};
  if (f.official) return { name: 'ציפציפ', handle: 'tziftzif', img: '/tziftzif/img/avatar.png', href: '/tziftzif', badge: CHECK('#ff7a1f'), stamp: 'ציפ!' };
  return { name: f.nick || 'אזרח/ית', handle: '', img: f.photo, href: null, badge: '', stamp: 'חותמת', fan: true };
}
// the stamp (the like) = the writer's shortest real catchphrase, as on the verse
function stampOf(c) {
  const q = (c.quotes || []).map((x) => String(x).replace(/["״]/g, '').trim()).filter((x) => x && x.length <= 26).sort((a, b) => a.length - b.length);
  return q[0] || 'חותמת';
}
const avatar = (w, cls = '') => (w.img ? `<${w.href ? `a href="${w.href}"` : 'span'} class="av ${cls}"><img src="${esc(w.img)}" alt="" loading="lazy"></${w.href ? 'a' : 'span'}>`
  : `<span class="av fan ${cls}">${esc((w.name || '?').slice(0, 1))}</span>`);
// @hani -> the resident's page
const idOf = (h) => Object.keys(ME.names || {}).find((id) => ME.names[id].handle === h) || h;   // a verse handle -> the resident
const linkify = (t) => esc(t).replace(/@([a-z][a-z0-9_-]{1,30})/g, (m, h) => { const id = idOf(h); return C[id] || id === 'charadot' ? `<a class="m" href="/tziftzif/u/${id}">@${id === 'charadot' ? id : hdl(id)}</a>` : m; });

// ---------- talking to the server ----------
async function token(ask) {
  try { await window.SiteSignIn.ready; } catch (e) { return null; }
  if (!ask && !window.SiteSignIn.user()) return null;
  const w = await window.SiteSignIn.ensure('tziftzif');
  return w && w.token;
}
async function api(op, data = {}, post = false, ask = false) {
  const tok = await token(ask);
  if (ask && !tok) return { error: 'cancel' };
  const headers = {}, opt = { method: post ? 'POST' : 'GET', headers };
  let url = API;
  if (post) { headers['content-type'] = 'application/json'; opt.body = JSON.stringify({ op, ...data }); } else url += '?' + new URLSearchParams({ op, ...data });
  if (tok) headers.authorization = 'Bearer ' + tok;
  try {
    const j = await (await fetch(url, opt)).json();
    // the server's "citizens only" (or "sign in first") opens the window that leads to the passport
    if (j.error === 'citizen' || j.error === 'sign_in') { ME.citizen = false; needCitizen(); j.shown = true; }
    return j;
  } catch (e) { return { error: 'net' }; }
}

// ---------- drawing a post ----------
let D = { quoted: {}, articles: {}, stamped: new Set() };
// every post a page got can be quoted by another one on it (the feed doesn't send twice a post that is already in it)
const take = (r) => { [r.post, ...(r.posts || []), ...(r.thread || []), ...(r.reactions || [])].filter(Boolean).forEach((p) => { D.quoted[p.id] = p; (p.under || []).forEach((u) => { D.quoted[u.id] = u; }); }); Object.assign(D.quoted, r.quoted || {}); Object.assign(D.articles, r.articles || {}); (r.stamped || []).forEach((id) => D.stamped.add(id)); };
// ONE attachment per post (his note 2026-11-08: "no need for 3 links - 1 is enough"): a repost shows only the post it
// quotes (and inside it, that post's article as one small row with its picture); otherwise ח24's article; otherwise the link
function inner(p, small) {
  const a = p.article && D.articles[p.article];
  const q = p.quote && D.quoted[p.quote];
  if (small) return a ? `<span class="art mini">${a.img ? `<span class="im" style="background-image:url('${esc(a.img)}')"></span>` : ''}<span class="in"><span class="tg">ח24 · ${esc(a.tag || 'חדשות')}</span>${a.headline.trim() === String(p.text).trim() ? '' : `<b>${esc(a.headline)}</b>`}</span></span>` : '';
  if (q) { const w = who(q); return `<a class="qt" href="/tziftzif/p/${q.id}"><div class="hd">${avatar({ ...w, href: null })}<span class="nm">${esc(w.name)}</span>${w.badge}${w.handle ? `<span class="hn">@${esc(w.handle)}</span>` : ''}</div><div class="tx">${linkify(q.text)}</div>${inner(q, true)}</a>`; }
  if (a) return `<a class="art" href="/tziftzif/a/${a.id}">${a.img ? `<div class="im" style="background-image:url('${esc(a.img)}')"></div>` : ''}<div class="in"><span class="tg">ח24 · ${esc(a.tag || 'חדשות')}</span><b>${esc(a.headline)}</b><small>${esc(a.sub)}</small></div></a>`;
  if (p.link) return `<a class="lk" href="${esc(p.link.url)}" target="_blank" rel="noopener">${p.link.img ? `<img src="${esc(p.link.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span class="lt"><small>${I.link}${esc(p.link.src)}</small><b>${esc(p.link.title)}</b></span></a>`;
  return '';
}
// a reply says whom it answers (his note: "it's not clear that it's a comment")
const toOf = (x, list) => { const par = x.parent && list.find((y) => y.id === x.parent); return par ? who(par).handle || who(par).name : ''; };
function card(p, o = {}) {
  const w = who(p), on = D.stamped.has(p.id);
  return `<article class="p ${o.big ? 'big' : 'click'} ${o.u ? 'u' : ''} ${o.hasU ? 'has-u' : ''} ${o.last ? 'last' : ''}" data-id="${p.id}">
    <div class="side">${avatar(w)}${o.line ? '<div class="thr"></div>' : ''}</div>
    <div class="b">
      <div class="hd">${w.href ? `<a class="nm" href="${w.href}">${esc(w.name)}</a>` : `<span class="nm">${esc(w.name)}</span>`}${w.badge}${w.news ? '<span class="live">שידור חי</span>' : ''}
        ${w.handle ? `<span class="hn">@${esc(w.handle)}</span>` : ''}${o.big ? '' : `<span class="dot">·</span><span class="tm">${ago(p.t)}</span>`}
        <button class="more" data-more="${p.id}" aria-label="עוד">${I.more}</button></div>
      ${o.to ? `<div class="rto">בתגובה ל־<b>@${esc(o.to)}</b></div>` : ''}<div class="tx">${linkify(p.text)}</div>
      ${inner(p)}
      ${o.big ? `<div class="when">${new Date(p.t).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long', year: 'numeric' })}</div>` : ''}
      <div class="ac">
        <a class="rp" href="/tziftzif/p/${p.id}" aria-label="תגובות">${I.reply}<span>${count(p.replies)}</span></a>
        <button class="st ${on ? 'on' : ''}" data-stamp="${p.id}" title="${esc(w.stamp)}">${I.stamp}<span>${count(p.stamps)}</span>${on ? `<span class="stl">${esc(w.stamp)}</span>` : ''}</button>
        <button class="sh" data-share="${p.id}" aria-label="שיתוף">${I.share}</button>
      </div>
    </div></article>`;
}

// ---------- the pages ----------
const brand = () => `<a class="brand" href="/tziftzif"><img src="/tziftzif/img/mark-dark.png" alt=""><span class="word">ציפ<i>ציפ</i></span></a>`;
function gate() {
  if (ME.citizen) return '';
  return ME.signed
    ? `<div class="gate"><span><b>רק אזרחים מצייצים</b>מוציאים דרכון ומצטרפים לשיחה</span><a class="btn acc" href="${VERSE}/citizenship">לדרכון</a></div>`
    : `<div class="gate"><span><b>רוצים להגיב?</b>אזרחי השלומיוורס מצייצים ומחתימים</span><button class="btn acc" data-signin>כניסה</button></div>`;
}
const fab = () => `<button class="fab" data-compose aria-label="ציוץ חדש">${I.pen}</button>`;
// the bottom (mockup tz-pro/P1, his note "make it professional"): a slim tab bar - home, ח24, the bell and "me" are the verse's own
// every tab stays inside ציפציפ (his note: "don't show links that take me out - people won't come back")
const tabbar = (on) => `<nav class="tabbar"><a href="/tziftzif" class="${on === 'home' ? 'on' : ''}">${I.home}<span>בית</span></a>`
  + `<a href="/tziftzif/people" class="${on === 'people' ? 'on' : ''}">${I.people}<span>התושבים</span></a>`
  + `<a href="/tziftzif/u/charadot" class="${on === 'news' ? 'on' : ''}"><img src="/charadot/img/avatar.png" alt=""><span>ח24</span></a></nav>`;

let FEED = null;
async function home() {
  document.title = 'ציפציפ';
  // the top in ONE thin line (his note: "very thin, the main is the main area"): the logo, the two tabs, search
  app.innerHTML = `<div class="top"><div class="bar one">${brand()}<div class="tabs pill"><button data-tab="all" class="${TAB === 'all' ? 'on' : ''}">בשבילך</button><button data-tab="follow" class="${TAB === 'follow' ? 'on' : ''}">במעקב</button></div><a class="ic" href="/tziftzif/people" title="התושבים">${I.people}</a></div></div>
    <div id="list" class="withbar">${loader()}</div>${gate()}${fab()}${tabbar('home')}`;
  if (!FEED) {
    const r = await api('feed');
    if (r.error) return r.error === 'soon' ? soon() : (document.getElementById('list').innerHTML = `<div class="empty">משהו לא נטען. נסו לרענן.</div>`);
    take(r); FEED = r;
  }
  drawFeed();
}
function drawFeed() {
  const el = document.getElementById('list');
  if (!el) return;
  let posts = FEED.posts;
  if (TAB === 'follow') posts = posts.filter((p) => ME.follows.includes(p.by) || (p.under || []).some((u) => ME.follows.includes(u.by)));
  if (!posts.length) { el.innerHTML = `<div class="empty">${TAB === 'follow' ? (ME.signed ? 'עוד לא עקבתם אחרי אף אחד מהתושבים. עוקבים בשלומיוורס, והם מופיעים כאן.' : 'נכנסים לחשבון, ורואים כאן את מי שאתם עוקבים אחריו.') : 'שקט בציפציפ. עוד מעט מישהו יגיד משהו.'}</div>`; return; }
  el.innerHTML = posts.map((p) => {
    const u = p.under || [];
    return card(p, { line: u.length > 0, hasU: u.length > 0 }) + u.map((x, i) => card(x, { u: true, to: toOf(x, [p, ...u]), line: i < u.length - 1, hasU: i < u.length - 1, last: i === u.length - 1 })).join('');
  }).join('') + (FEED.more ? '<button class="morebtn" data-more-feed>עוד ציוצים</button>' : endOfFeed());
}
// the end of the timeline - says when the residents post next (the engine wakes at 08:00, 13:00 and 19:00, Israel)
function endOfFeed() {
  const h = +new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Jerusalem' }).format(new Date());
  const next = h < 8 ? '08:00' : h < 13 ? '13:00' : h < 19 ? '19:00' : 'מחר ב-08:00';
  return `<div class="end"><img src="/tziftzif/img/mark-dark.png" alt=""><b>זה הכול לעכשיו</b><span>התושבים יצייצו שוב ${next.startsWith('מחר') ? next : 'בסביבות ' + next}</span></div>`;
}
async function moreFeed(btn) {
  btn.disabled = true;
  const r = await api('feed', { before: FEED.more });
  if (r.error) { btn.disabled = false; return; }
  take(r); FEED.posts.push(...r.posts); FEED.more = r.more; drawFeed();
}

async function thread(id) {
  app.innerHTML = `<div class="top"><div class="bar"><button class="ic" data-back>${I.back}</button><span class="ttl">ציוץ</span><span style="margin-inline-start:auto">${brand()}</span></div></div><div id="list">${loader()}</div>`;
  const r = await api('post', { id });
  if (r.error) return r.error === 'soon' ? soon() : (document.getElementById('list').innerHTML = '<div class="empty">הציוץ הזה כבר לא כאן.</div>');
  take(r);
  const list = r.thread, at = list.findIndex((x) => x.id === r.post.id);
  const before = list.slice(0, at).filter((x) => !x.parent || list.slice(0, at).some((y) => y.id === x.parent) || x.id === r.post.root);
  const after = list.slice(at + 1);
  document.title = `${who(r.post).name} בציפציפ: "${r.post.text.slice(0, 50)}"`;
  document.getElementById('list').innerHTML = before.map((x) => card(x, { line: true, hasU: true })).join('') + card(r.post, { big: true }) + after.map((x) => card(x, { to: toOf(x, r.thread) })).join('')
    + (after.length ? '' : '<div class="empty">עוד אין תגובות.</div>');
  if (ME.citizen) {
    const w = who(r.post);
    app.insertAdjacentHTML('beforeend', `<form class="say" data-reply="${r.post.id}"><textarea rows="1" maxlength="280" placeholder="להגיב ל${esc(w.name)}...${r.post.by && !w.news ? ` (או @${esc(hdl(r.post.by))} כדי ש${esc(w.name)} יענה)` : ''}"></textarea><button class="send" aria-label="שליחה">${I.send}</button></form>`);
  } else app.insertAdjacentHTML('beforeend', gate());
  track('tz_post', id);
}

async function resident(id) {
  const news = id === 'charadot';
  const c = news ? { name: 'חרדות', img: '/charadot/img/avatar.png', tagline: 'ערוץ החדשות של השלומיוורס. כל הדרמה, כל הזמן. הישארו איתנו.', color: '#c8101a' } : C[id] || { name: id };
  app.innerHTML = `<div class="top"><div class="bar"><button class="ic" data-back>${I.back}</button><span class="ttl">${esc(news ? c.name : nm(id))}</span><span style="margin-inline-start:auto">${brand()}</span></div></div>
    <div class="prof"><div class="cov" style="${c && c.color ? `background:linear-gradient(135deg, ${esc(c.color)}55, #0b0b0e 75%)` : ''}"></div>
    <div class="row"><div class="pic">${c.img ? `<img src="${esc(c.img)}" alt="">` : ''}</div></div>
    <h1>${esc(news ? c.name : nm(id))} ${CHECK(news ? '#e3101b' : '#7d8590')}</h1><span class="hn">@${esc(news ? id : hdl(id))}</span>
    <p>${esc(c && (c.tagline || c.role) || '')}</p></div><div id="list" class="withbar">${loader()}</div>${tabbar(news ? 'news' : '')}`;
  document.title = `${news ? c.name : nm(id)} · ציפציפ`;
  const r = await api('resident', { char: id });
  if (r.error) return r.error === 'soon' ? soon() : null;
  take(r);
  document.getElementById('list').innerHTML = r.posts.map((p) => card(p)).join('') || `<div class="empty">${esc(news ? c.name : nm(id))} עוד לא צייצ/ה.</div>`;
  track('tz_resident', id);
}

// a ח24 article, read inside ציפציפ: the headline, the picture, the body, the residents' reactions - nothing leaves the app
async function article(id) {
  app.innerHTML = `<div class="top"><div class="bar one"><button class="ic" data-back>${I.back}</button><span class="ttl">ח24</span><span style="margin-inline-start:auto">${brand()}</span></div></div><div id="list" class="withbar">${loader()}</div>${tabbar('news')}`;
  const r = await api('article', { id });
  if (r.error) return r.error === 'soon' ? soon() : (document.getElementById('list').innerHTML = '<div class="empty">הכתבה הזאת ירדה מהאוויר.</div>');
  const a = r.article;
  document.title = `${a.headline} · ח24 בציפציפ`;
  const rx = r.reactions.map((p) => card(p)).join('');
  document.getElementById('list').innerHTML = `<article class="read"><a class="by" href="/tziftzif/u/charadot"><img src="/charadot/img/avatar.png" alt=""><span><b>חרדות ${CHECK('#e3101b')}</b><small>@charadot · ${ago(a.t)}</small></span></a>
    <span class="tg">${esc(a.tag || 'חדשות')}</span><h1>${esc(a.headline)}</h1><p class="sub">${esc(a.sub)}</p>
    ${a.img ? `<img class="pic" src="${esc(a.img)}" alt="">` : ''}<div class="body">${(a.body || []).map((x) => `<p>${esc(x)}</p>`).join('')}</div>
    ${a.src ? `<p class="src">לפי ${esc(a.src.src)}: ${esc(a.src.title)}</p>` : ''}</article>
    ${rx ? `<div class="rxh">מה אומרים בציפציפ</div>${rx}` : ''}`;
  track('ch_article', id);
}
// התושבים: everyone who posts on ציפציפ, with their verse names - each opens their posts here
function people() {
  document.title = 'התושבים · ציפציפ';
  const list = Object.values(C).filter((c) => c.img).sort((a, b) => (b.videos || []).length - (a.videos || []).length);
  app.innerHTML = `<div class="top"><div class="bar one">${brand()}<span class="ttl" style="margin-inline:auto">התושבים</span><span class="ic"></span></div></div>
    <a class="ppl news" href="/tziftzif/u/charadot"><span class="av"><img src="/charadot/img/avatar.png" alt=""></span><span class="pb"><b>חרדות ${CHECK('#e3101b')}</b><small>@charadot · ערוץ החדשות של השלומיוורס</small></span></a>
    <div id="list" class="withbar">${list.map((c) => `<a class="ppl" href="/tziftzif/u/${c.id}"><span class="av"><img src="${esc(c.img)}" alt="" loading="lazy"></span><span class="pb"><b>${esc(nm(c.id))}</b><small>@${esc(hdl(c.id))}${c.role ? ' · ' + esc(String(c.role).slice(0, 60)) : ''}</small></span></a>`).join('')}</div>${tabbar('people')}`;
  track('tz_resident', 'people');
}
function soon() {
  document.title = 'ציפציפ - בקרוב';
  app.innerHTML = `<div class="soon"><img src="/tziftzif/img/mark-dark.png" alt=""><span class="word">ציפ<i>ציפ</i></span><p>הרשת של תושבי השלומיוורס. עוד מעט כולם כאן מצייצים.</p><a class="btn acc" href="${VERSE}">בינתיים, לשלומיוורס</a></div>`;
}

// ---------- doing things ----------
async function stamp(btn) {
  const id = btn.dataset.stamp;
  if (!ME.citizen) return needCitizen();
  const on = !btn.classList.contains('on'), n = btn.querySelector('span');
  btn.classList.toggle('on', on); n.textContent = count(Math.max(0, (+(n.textContent.replace('K', '')) || 0) + (on ? 1 : -1)));
  const r = await api('stamp', { id }, true);
  if (r.error) { btn.classList.toggle('on', !on); return toast('לא הצליח. נסו שוב.'); }
  on ? D.stamped.add(id) : D.stamped.delete(id);
  track('tz_stamp', id);
}
// tweeting, replying and liking are for citizens of the verse with a passport (his rule) - anyone else is asked to become one
function needCitizen() {
  const v = document.createElement('div');
  v.className = 'veil';
  v.innerHTML = `<div class="sheet need"><img src="/tziftzif/img/mark-dark.png" alt=""><b>${ME.signed ? 'רק אזרחים מצייצים' : 'רוצים לצייץ?'}</b>
    <p>${ME.signed ? 'בציפציפ מצייצים, מגיבים ומחתימים אזרחי השלומיוורס - עם דרכון. מוציאים דרכון בדקה, וחוזרים לשיחה.' : 'נכנסים, מוציאים דרכון שלומיוורס, ומצטרפים לשיחה עם התושבים.'}</p>
    <div class="row">${ME.signed ? `<a class="btn acc" href="${VERSE}/citizenship">להוציא דרכון</a>` : '<button class="btn acc" data-signin>כניסה</button>'}<button class="btn ghost" data-close>אחר כך</button></div></div>`;
  v.addEventListener('click', (e) => { if (e.target === v || e.target.closest('[data-close],[data-signin]')) v.remove(); });
  document.body.appendChild(v);
}
async function signIn() {
  const tok = await token(true);
  if (!tok) return;
  await loadMe(); route();
  if (!ME.citizen) needCitizen();   // signed in, no passport yet - straight to the next step
}
function share(id) {
  const url = `${location.origin}/tziftzif/p/${id}`;
  track('tz_share', id);
  if (navigator.share) navigator.share({ url, title: 'ציפציפ' }).catch(() => {});
  else navigator.clipboard.writeText(url).then(() => toast('הקישור הועתק'));
}
function menu(id) {
  const v = document.createElement('div');
  v.className = 'veil';
  v.innerHTML = `<div class="menu"><button data-share="${id}">${I.share} שיתוף הציוץ</button><button class="bad" data-report="${id}">${I.flag} דיווח על ציוץ פוגעני</button><button data-close>ביטול</button></div>`;
  document.body.appendChild(v);
  v.addEventListener('click', (e) => { if (e.target === v || e.target.closest('[data-close],[data-share],[data-report]')) setTimeout(() => v.remove(), 0); });
}
function sheet(title, placeholder, onSend) {
  const v = document.createElement('div');
  v.className = 'veil';
  v.innerHTML = `<form class="sheet"><h3>${esc(title)}</h3><textarea maxlength="300" placeholder="${esc(placeholder)}"></textarea><div class="row2"><span class="cnt">280</span><div><button type="button" class="btn ghost" data-close>ביטול</button> <button class="btn acc">שליחה</button></div></div></form>`;
  document.body.appendChild(v);
  const ta = v.querySelector('textarea'), cnt = v.querySelector('.cnt');
  ta.focus();
  ta.oninput = () => { const left = 280 - ta.value.length; cnt.textContent = left; cnt.classList.toggle('over', left < 0); };
  v.addEventListener('click', (e) => { if (e.target === v || e.target.closest('[data-close]')) v.remove(); });
  v.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!text || text.length > 280) return;
    const b = v.querySelector('.btn.acc'); b.disabled = true;
    if (await onSend(text)) v.remove(); else b.disabled = false;
  };
}
const ERR = { flagged: 'זה לא יעלה לציפציפ. נסו לנסח אחרת.', limit: 'מספיק להיום. מחר עוד.', citizen: 'רק אזרחי השלומיוורס מצייצים.', sign_in: 'צריך להיכנס לחשבון.' };
async function report(id) {
  if (!ME.signed && !(await token(true))) return;
  sheet('דיווח על ציוץ', 'מה פוגע בציוץ הזה? (לא חובה)', async (why) => {
    const r = await api('report', { id, why }, true);
    if (r.error) { if (!r.shown) toast(ERR[r.error] || 'לא הצליח. נסו שוב.'); return false; }
    toast('תודה. הדיווח הגיע לשלומי.'); track('tz_report', id); return true;
  });
}
function compose() {
  if (!ME.citizen) return needCitizen();
  sheet('ציוץ חדש', 'מה קורה?', async (text) => {
    const r = await api('post', { text }, true);
    if (r.error) { if (!r.shown) toast(ERR[r.error] || 'לא הצליח. נסו שוב.'); return false; }
    FEED = null; toast('צייצתם'); track('tz_compose', ''); go('/tziftzif/p/' + r.post.id); return true;
  });
}
async function reply(form) {
  const ta = form.querySelector('textarea'), text = ta.value.trim(), b = form.querySelector('.send');
  if (!text) return;
  b.disabled = true;
  const r = await api('reply', { parent: form.dataset.reply, text }, true);
  b.disabled = false;
  if (r.error) return r.shown ? null : toast(ERR[r.error] || 'לא הצליח. נסו שוב.');
  ta.value = ''; toast(/@[a-z]/.test(text) ? 'נשלח. עוד רגע תקבלו תשובה.' : 'נשלח'); track('tz_reply', form.dataset.reply);
  FEED = null; thread(location.pathname.split('/').pop());
}

// ---------- the address ----------
function go(path) { history.pushState(null, '', path); route(); scrollTo(0, 0); }
function route() {
  const [, , kind, id] = location.pathname.split('/');
  if (kind === 'p' && id) return thread(id);
  if (kind === 'u' && id) return resident(id);
  if (kind === 'people') return people();
  if (kind === 'a' && id) return article(id);
  return home();
}
document.addEventListener('click', (e) => {
  const t = e.target;
  const a = t.closest('a[href^="/tziftzif"]');
  if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); return go(a.getAttribute('href')); }
  if (t.closest('[data-back]')) return history.length > 1 ? history.back() : go('/tziftzif');
  const tab = t.closest('[data-tab]'); if (tab) { TAB = tab.dataset.tab; document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === tab)); return drawFeed(); }
  const st = t.closest('[data-stamp]'); if (st) return stamp(st);
  const sh = t.closest('[data-share]'); if (sh) return share(sh.dataset.share);
  const mo = t.closest('[data-more]'); if (mo) return menu(mo.dataset.more);
  const rep = t.closest('[data-report]'); if (rep) return report(rep.dataset.report);
  if (t.closest('[data-compose]')) return compose();
  if (t.closest('[data-signin]')) return signIn();
  const mf = t.closest('[data-more-feed]'); if (mf) return moreFeed(mf);
  const p = t.closest('.p.click');
  if (p && !t.closest('a,button')) return go('/tziftzif/p/' + p.dataset.id);
});
document.addEventListener('submit', (e) => { const f = e.target.closest('[data-reply]'); if (f) { e.preventDefault(); reply(f); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && e.target.closest('.say textarea')) { e.preventDefault(); reply(e.target.closest('form')); } });
addEventListener('popstate', route);

// the desktop's side column (his note 2026-11-08: "the desktop version is the mobile version"): what's happening on ח24
// and residents to meet, like X's side column on a computer - every link stays inside ציפציפ; phones never draw it
async function side() {
  if (!matchMedia('(min-width: 1180px)').matches || document.querySelector('.side')) return;
  const el = document.createElement('aside');
  el.className = 'side';
  document.body.append(el);
  const ppl = Object.values(C).filter((c) => c.img).sort((a, b) => (b.videos || []).length - (a.videos || []).length).slice(0, 5);
  const r = await api('front');
  const news = (r.articles || []).slice(0, 5);
  el.innerHTML = `${news.length ? `<div class="box"><h3><img src="/charadot/img/avatar.png" alt="">מה קורה בחרדות</h3>${news.map((a) => `<a class="hl" href="/tziftzif/a/${a.id}"><small><b>${esc(a.tag || 'חדשות')}</b> · ${ago(a.t)}</small><span>${esc(a.headline)}</span></a>`).join('')}<a class="sm" href="/tziftzif/u/charadot">עוד מח24</a></div>` : ''}
    <div class="box"><h3>תושבים שכדאי להכיר</h3>${ppl.map((c) => `<a class="ppl" href="/tziftzif/u/${c.id}"><span class="av"><img src="${esc(c.img)}" alt="" loading="lazy"></span><span class="pb"><b>${esc(nm(c.id))}</b><small>@${esc(hdl(c.id))}</small></span></a>`).join('')}<a class="sm" href="/tziftzif/people">כל התושבים</a></div>
    <p class="fine">ציפציפ · הרשת של תושבי השלומיוורס</p>`;
}
matchMedia('(min-width: 1180px)').addEventListener('change', side);

async function loadMe() {
  const r = await api('me');
  if (!r.error) ME = { follows: [], ...r };
}
(async () => {
  try { const w = await (await fetch(WIKI)).json(); C = Object.fromEntries((w.characters || []).map((c) => [c.id, c])); } catch (e) {}
  await loadMe();
  route();
  side();
})();
