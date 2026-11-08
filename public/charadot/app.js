// ח24 (חרדות) - the verse's news channel's site (shlomiverse.com/charadot). The articles come from verseTz (techietech-api/tz.js -
// the same engine as ציפציפ: real headlines, inflated into drama on ח24's own key); under each article, what the residents
// said about it on ציפציפ. Addresses: /charadot (the front page), /charadot/a/<id> (an article).
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = LOCAL ? 'http://127.0.0.1:5001/demo-shlomiverse/europe-west1/verseTz' : 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseTz';
const WIKI = 'https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json';
const app = document.getElementById('app');
let C = {}, NAMES = {};   // NAMES: impressions of real people go by their verse name (the server's aliases)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (t) => new Date(t).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' });
const track = (e, x) => { try { window.track && window.track(e, x); } catch (er) {} };

async function api(op, data = {}) {
  const headers = {};
  try { await window.SiteSignIn.ready; if (window.SiteSignIn.user()) { const w = await window.SiteSignIn.ensure('charadot'); if (w) headers.authorization = 'Bearer ' + w.token; } } catch (e) {}
  try { const r = await fetch(API + '?' + new URLSearchParams({ op, ...data }), { headers }); return await r.json(); } catch (e) { return { error: 'net' }; }
}
const anchorName = () => (C['news-anchor'] && C['news-anchor'].name) || 'מגישת החדשות';
const img = (a, cls) => (a.img ? `<div class="${cls}" style="background-image:url('${esc(a.img)}')"></div>` : `<div class="${cls} no"></div>`);
function ticker(list) {
  const el = document.getElementById('tick');
  el.innerHTML = list.slice(0, 10).map((a) => `<a href="/charadot/a/${a.id}">${esc(a.headline)}</a>`).join('');
  requestAnimationFrame(() => el.style.setProperty('--dur', Math.max(8, Math.round(el.scrollWidth / 90)) + 's'));
}
function soon() {
  app.innerHTML = `<div class="soon"><img src="/charadot/img/avatar.png" alt=""><p>החרדות 24 עולה לשידור בקרוב. הישארו איתנו.</p></div>`;
  document.getElementById('tick').innerHTML = '<span>החרדות 24 עולה לשידור בקרוב · הישארו איתנו · החרדות 24 עולה לשידור בקרוב · הישארו איתנו</span>';
}

async function front() {
  if (!app.querySelector('.load')) loading();
  document.title = 'החרדות 24';
  const r = await api('front');
  if (r.error) return r.error === 'soon' ? soon() : (app.innerHTML = '<div class="empty">השידור נקטע. נסו לרענן.</div>');
  const [lead, ...rest] = r.articles;
  ticker(r.articles);
  if (!lead) { app.innerHTML = '<div class="empty">אין עדיין מבזקים. אבל משהו נורא עומד לקרות. הישארו איתנו.</div>'; return; }
  app.innerHTML = `<section class="lead">
      <a class="hero" href="/charadot/a/${lead.id}" style="${lead.img ? `background-image:url('${esc(lead.img)}')` : ''}"><div class="t"><span class="tag">${esc(lead.tag || 'בלעדי')}</span><h1>${esc(lead.headline)}</h1><p>${esc(lead.sub)}</p></div></a>
      <a class="anchor" href="/tziftzif/u/news-anchor"><img src="/charadot/img/promo.jpg" alt=""><div class="t"><b>המהדורה המרכזית עם ${esc(anchorName())}</b><span>כל ערב, כל הדרמה. וגם בציפציפ.</span></div></a>
    </section>
    ${rest.length ? `<div class="sec">עוד חדשות</div><div class="grid">${rest.map((a) => `<a class="cardn" href="/charadot/a/${a.id}">${img(a, 'im')}<div class="t"><span class="tag">${esc(a.tag || 'חדשות')}</span><h3>${esc(a.headline)}</h3><small>${when(a.t)}</small></div></a>`).join('')}</div>` : ''}`;
  track('ch_front', '');
}

const loading = () => { app.innerHTML = '<div class="load"><img src="/charadot/img/mark-red.png" alt=""><span>הישארו איתנו</span></div>'; };
async function article(id) {
  loading();
  const r = await api('article', { id });
  if (r.error) return r.error === 'soon' ? soon() : (app.innerHTML = '<div class="empty">הכתבה הזאת ירדה מהאוויר.</div>');
  const a = r.article;
  document.title = `${a.headline} · החרדות 24`;
  ticker([a, ...r.more]);
  const face = (p) => (p.by === 'charadot' ? '/charadot/img/avatar.png' : (C[p.by] && C[p.by].img) || '/tziftzif/img/avatar.png');
  const name = (p) => (p.by === 'charadot' ? 'החרדות 24' : (NAMES[p.by] && NAMES[p.by].name) || (C[p.by] && C[p.by].name) || p.by);
  app.innerHTML = `<article class="art">
      <div class="head"><span class="tag">${esc(a.tag || 'חדשות')}</span><h1>${esc(a.headline)}</h1><p class="sub">${esc(a.sub)}</p>
        <div class="by"><img src="/charadot/img/avatar.png" alt=""><span>מערכת החרדות 24 · ${when(a.t)}</span></div></div>
      ${a.img ? `<div class="pic" style="background-image:url('${esc(a.img)}')"></div>` : ''}
      <div class="body">${(a.body || []).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      ${a.src ? `<div class="src">הידיעה המקורית: <a href="${esc(a.src.url)}" target="_blank" rel="noopener">${esc(a.src.src)} - ${esc(a.src.title)}</a></div>` : ''}
      ${r.reactions.length ? `<div class="react"><h4><img src="/tziftzif/img/mark-dark.svg" alt="">מה אומרים ב<span>ציפ<i>ציפ</i></span></h4>
        ${r.reactions.map((p) => `<a class="rx" href="/tziftzif/p/${p.id}"><img src="${esc(face(p))}" alt=""><div><b>${esc(name(p))}</b><p>${esc(p.text)}</p></div></a>`).join('')}</div>` : ''}
    </article>
    ${r.more.length ? `<div class="more2"><div class="sec">עוד מבזקים</div><div class="grid">${r.more.map((m) => `<a class="cardn" href="/charadot/a/${m.id}">${img(m, 'im')}<div class="t"><span class="tag">${esc(m.tag || 'חדשות')}</span><h3>${esc(m.headline)}</h3><small>${when(m.t)}</small></div></a>`).join('')}</div></div>` : ''}`;
  track('ch_article', id);
}

function route() {
  const [, , kind, id] = location.pathname.split('/');
  scrollTo(0, 0);
  return kind === 'a' && id ? article(id) : front();
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="/charadot"]');
  if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); history.pushState(null, '', a.getAttribute('href')); route(); }
});
addEventListener('popstate', route);
(async () => {
  try { const w = await (await fetch(WIKI)).json(); C = Object.fromEntries((w.characters || []).map((c) => [c.id, c])); } catch (e) {}
  const me = await api('me');
  NAMES = (me && me.names) || {};
  route();
})();
