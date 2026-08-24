/* Wholos — upload queue, shared by every marketing page.
 *
 * All the marketing pages sit on one origin, so localStorage is the whole
 * mechanism: mark a creative anywhere, see it at /uploads/.
 *
 * Cards are discovered generically rather than by page, so this file keeps
 * working when a round adds a new grid. What it needs from a card:
 *   - an <a> pointing at the full-size file under img/
 *   - an <img> for the thumbnail
 *   - some text for a title
 *
 * The link it reads is the one the page is *currently showing*, so on round 6
 * marking while the clean/with-url switch is set to "עם כתובת" queues the
 * with-url render. Mark what you see.
 */
(function () {
  var KEY = 'wholos-upload-v1';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function write(q) {
    try { localStorage.setItem(KEY, JSON.stringify(q)); } catch (e) {}
  }
  function abs(u) {
    try { return new URL(u, location.href).pathname; } catch (e) { return u; }
  }

  window.WholosQueue = { read: read, write: write, KEY: KEY };

  // ── card discovery ───────────────────────────────────────────────
  // .cr = round 6 campaign + extras, .tc = round 6 Leonardo typography,
  // .c  = round 7 posters.
  function cards() {
    return [].slice.call(document.querySelectorAll('article.cr, article.tc, article.c'));
  }

  function info(card) {
    var link = card.querySelector('a[href*="img/"]');
    var img = card.querySelector('img');
    if (!link || !img) return null;
    var full = abs(link.getAttribute('href'));
    var id = full.split('/').pop().replace(/\.(png|jpg|jpeg)$/i, '');
    var t = card.querySelector('.cp b, .h, .th, .t');
    // /marketing-6/ and /marketing-6/index.html must yield the same page name,
    // or the same creative would queue twice under two keys.
    var segs = location.pathname.split('/').filter(Boolean);
    while (segs.length && /\.html?$/i.test(segs[segs.length - 1])) segs.pop();
    var page = segs.length ? segs[segs.length - 1] : 'page';
    return {
      id: id,
      key: page + ':' + id,
      page: page,
      title: (t ? t.textContent : id).trim().replace(/\s+/g, ' ').slice(0, 90),
      thumb: abs(img.getAttribute('src')),
      full: full,
      variant: /with-url/.test(full) ? 'עם כתובת' : (/no-url/.test(full) ? 'נקי' : 'יחיד')
    };
  }

  // ── per-card button ──────────────────────────────────────────────
  function paint(btn, on) {
    btn.classList.toggle('on', on);
    btn.textContent = on ? '✓ מסומן להעלאה' : '+ סמן להעלאה';
  }

  function attach() {
    var q = read();
    cards().forEach(function (card) {
      if (card.querySelector('.wq-btn')) return;
      var d = info(card);
      if (!d) return;
      var btn = document.createElement('button');
      btn.className = 'wq-btn';
      btn.type = 'button';
      paint(btn, !!q[d.key]);
      btn.addEventListener('click', function () {
        var cur = read();
        var now = info(card);           // re-read: the variant switch may have moved
        if (cur[now.key]) { delete cur[now.key]; } else { cur[now.key] = now; }
        write(cur);
        paint(btn, !!cur[now.key]);
        count();
      });
      (card.querySelector('.b, .cp, .tb, .dl') || card).appendChild(btn);
    });
  }

  // ── floating counter ─────────────────────────────────────────────
  var pill;
  function count() {
    var n = Object.keys(read()).length;
    if (!pill) {
      pill = document.createElement('a');
      pill.className = 'wq-pill';
      pill.href = '/uploads/';
      document.body.appendChild(pill);
    }
    pill.innerHTML = '<b>' + n + '</b> מסומנים · לרשימה';
    pill.style.display = n ? 'flex' : 'none';
  }

  /* ── saving to the phone ──────────────────────────────────────────
   * On a phone, <a download> is the wrong tool. iOS Safari puts the file in
   * Files, not Photos, so Instagram cannot see it; Android drops it in
   * Downloads. The native share sheet is what actually offers "Save Image"
   * and Instagram, so on mobile every download link goes through it instead.
   *
   * share() must run inside the user gesture. Awaiting the fetch first can
   * lose that gesture on iOS, so the blob is fetched on pointerdown and is
   * usually already in hand by the time the click lands.
   */
  var canShareFiles = !!(navigator.canShare && navigator.share);
  var isTouch = matchMedia('(pointer:coarse)').matches;
  var useShare = canShareFiles && isTouch;
  var blobs = {};   // href -> Promise<File>

  function grab(href) {
    if (!blobs[href]) {
      blobs[href] = fetch(href).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }).then(function (b) {
        var name = href.split('/').pop();
        return new File([b], name, { type: b.type || 'image/png' });
      });
      // A failed prefetch must not be cached as a permanent rejection.
      blobs[href]['catch'](function () { delete blobs[href]; });
    }
    return blobs[href];
  }

  window.WholosSave = {
    supported: useShare,
    // Shares one or more same-origin images through the native sheet.
    // Returns false if it could not, so the caller can fall back.
    share: function (hrefs, title) {
      if (!useShare) return Promise.resolve(false);
      return Promise.all(hrefs.map(grab)).then(function (files) {
        if (!navigator.canShare({ files: files })) return false;
        return navigator.share({ files: files, title: title || 'Wholos' })
          .then(function () { return true; })
          .catch(function (err) {
            // AbortError = the user dismissed the sheet. That is a completed
            // interaction, not a failure to fall back from.
            return err && err.name === 'AbortError' ? true : false;
          });
      }).catch(function () { return false; });
    },
    prefetch: grab,
    // pages that re-render their grid call this to re-label the new links
    relabel: function () { relabel(); }
  };

  function installSaveHandler() {
    if (!useShare) return;
    // Warm the blob as the finger goes down, before the click fires.
    document.addEventListener('pointerdown', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[download]');
      if (a && a.getAttribute('href')) grab(a.getAttribute('href'));
    }, true);

    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[download]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href) return;
      e.preventDefault();
      var label = a.textContent;
      a.textContent = 'רגע…';
      window.WholosSave.share([href]).then(function (ok) {
        a.textContent = label;
        if (!ok) {
          // Last resort: open it so the image can be long-pressed and saved.
          window.open(href, '_blank', 'noopener');
        }
      });
    }, true);

    // Say what the button will actually do on a phone.
    document.addEventListener('DOMContentLoaded', relabel);
    relabel();
  }

  function relabel() {
    if (!useShare) return;
    [].forEach.call(document.querySelectorAll('a[download]'), function (a) {
      if (a.dataset.wqLabelled) return;
      a.dataset.wqLabelled = '1';
      var t = a.textContent.trim();
      if (t === 'הורדה') a.textContent = 'שמירה לגלריה';
      else if (t.indexOf('הורדה · ') === 0) a.textContent = 'שמירה · ' + t.slice(8);
    });
  }

  var CSS = [
    '.wq-btn{margin-top:8px;width:100%;font:inherit;font-size:12.5px;font-weight:700;',
    '  cursor:pointer;padding:9px 6px;border-radius:10px;background:none;',
    '  border:1px solid rgba(255,255,255,.20);color:#a9b3c6;transition:all .16s ease}',
    '.wq-btn:hover{border-color:#9b8cf5;color:#f4f7fc}',
    '.wq-btn.on{background:#5b4bc4;border-color:#9b8cf5;color:#fff}',
    '.wq-pill{position:fixed;inset-inline-end:18px;bottom:18px;z-index:90;display:flex;',
    '  align-items:center;gap:7px;padding:11px 17px;border-radius:999px;',
    '  background:#5b4bc4;border:1px solid #9b8cf5;color:#fff;text-decoration:none;',
    '  font-size:13.5px;font-weight:700;box-shadow:0 6px 22px rgba(0,0,0,.45)}',
    '.wq-pill b{font-size:15px}',
    '.dl{flex-wrap:wrap}'
  ].join('\n');

  function boot() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);

    // Saving works everywhere this file is loaded, including /uploads/ itself.
    installSaveHandler();

    // The marking UI belongs on the creative pages only — /uploads/ is where
    // marks are reviewed, not made. Compare the directory, not the raw path,
    // so /uploads/index.html is treated the same as /uploads/.
    var segs = location.pathname.split('/').filter(Boolean);
    while (segs.length && /\.html?$/i.test(segs[segs.length - 1])) segs.pop();
    if (segs[segs.length - 1] === 'uploads') return;

    attach();
    count();
    // round 6's variant switch rewrites hrefs in place; keep labels honest
    document.addEventListener('click', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('vb')) {
        setTimeout(function () {
          var q = read();
          cards().forEach(function (card) {
            var b = card.querySelector('.wq-btn'), d = info(card);
            if (b && d) paint(b, !!q[d.key]);
          });
        }, 0);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
