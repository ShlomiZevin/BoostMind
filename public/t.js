// Shlomi's own analytics - one tiny event per action, sent to the `track` function (techietech-api/analytics.js).
// On a page: <script src="/t.js" data-site="ayelet" defer></script>   (other domains: the full boostmind URL)
// It sends a 'view' by itself and catches links out (WhatsApp, mail, socials, the characters' sites).
// Pages add their own moments with window.track(event, target), e.g. track('chat_message', 'ayelet').
// Nothing personal: an anonymous random id per browser (to count visitors), no cookies, no IP, no typed text.
(function () {
  var URL_ = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/track';
  var me = document.currentScript, site = (me && me.dataset.site) || 'other';
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  var ss = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };
  var rnd = function () { return Math.random().toString(36).slice(2, 10); };

  // Shlomi's own devices don't count: ?notrack=1 (or opening /stats/ signed in) marks this browser, ?track=1 unmarks it
  var qs = new URLSearchParams(location.search);
  try { if (qs.has('notrack')) localStorage.setItem('t-ignore', '1'); if (qs.has('track')) localStorage.removeItem('t-ignore'); } catch (e) {}
  if (ls('t-ignore')) { window.track = function () {}; return; }
  var fresh = false, vid = ls('t-v'), sid = ss('t-s');
  if (!vid) { vid = rnd(); ls('t-v', vid); fresh = true; }
  if (!sid) { sid = rnd(); ss('t-s', sid); }
  var today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

  // where the visitor came from: ?src=, the in-app browser, or the referrer
  var ua = navigator.userAgent, ref = document.referrer, q = qs.get('src');
  var source = ss('t-r');
  if (!source) {
    source = q ? q.toLowerCase()
      : /musical_ly|bytedance|tiktok/i.test(ua) || /tiktok/.test(ref) ? 'tiktok'
      : /instagram/i.test(ua) || /instagram/.test(ref) ? 'instagram'
      : /FBAN|FBAV|FB_IAB/.test(ua) || /facebook|fb\.com/.test(ref) ? 'facebook'
      : /youtube\.com|youtu\.be/.test(ref) ? 'youtube'
      : /t\.co\/|twitter|x\.com/.test(ref) ? 'x'
      : /google\./.test(ref) ? 'google'
      : /whatsapp/i.test(ua + ref) ? 'whatsapp'
      : /boostmind-b052c|shlomiverse\.com|techytech/.test(ref) ? 'internal'
      : ref ? 'other' : 'direct';
    ss('t-r', source);
  }
  var phone = /Mobi|Android|iPhone|iPad/i.test(ua);

  window.track = function (e, x) {
    var first = ls('t-d') !== today;
    if (first) ls('t-d', today);
    var body = JSON.stringify({ e: e, x: x || '', p: site, r: source, m: phone, v: vid, s: sid, first: first, fresh: fresh });
    fresh = false;
    try { if (navigator.sendBeacon && navigator.sendBeacon(URL_, body)) return; } catch (err) {}
    try { fetch(URL_, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }); } catch (err) {}
  };

  // links out: contact, socials, the characters' sites, anything else
  var SITE_OF = { '/ayelet': 'ayelet', '/demokratovich': 'demokratovich', '/hindsight': 'hindsight', '/homo-useless': 'homo-useless', '/yotamverse': 'yotamverse', '/hani-games': 'hani-games', '/friedman': 'friedman', '/ofnat-hani': 'ofnat-hani', '/dorit': 'dorit', '/shefa-ad': 'shefa-ad', '/birkat-hashefa': 'birkat-hashefa', '/micro-comedy': 'micro-comedy', '/shlomi-zevin': 'shlomi-zevin', 'techytech.web.app': 'techytech' };
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a || a.hasAttribute('data-t-skip')) return;
    var h = a.getAttribute('href');
    if (/^https:\/\/wa\.me/.test(h)) return window.track('contact', 'whatsapp');
    if (/^mailto:/.test(h)) return window.track('contact', 'mail');
    var net = /tiktok\.com/.test(h) ? 'tiktok' : /instagram\.com/.test(h) ? 'instagram' : /youtube\.com|youtu\.be/.test(h) ? 'youtube' : /facebook\.com/.test(h) ? 'facebook' : /(^|\/\/)(x|twitter)\.com/.test(h) ? 'x' : '';
    if (net) return window.track('social', net);
    var path = h.replace(/^https:\/\/(boostmind-b052c\.web\.app|(www\.)?shlomiverse\.com)/, '');
    for (var k in SITE_OF) if (path.indexOf(k) === 0 || path.indexOf('//' + k) >= 0) return SITE_OF[k] === site ? undefined : window.track('site', SITE_OF[k]);
    if (/^https?:\/\//.test(h) && h.indexOf(location.host) < 0) window.track('click', h.replace(/^https?:\/\//, '').slice(0, 60));
  }, true);

  // the page itself (the wiki reports its own screens as it moves between them)
  if (!me || !me.hasAttribute('data-no-view')) window.track('view', location.pathname);
})();
