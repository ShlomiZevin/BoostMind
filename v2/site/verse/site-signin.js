// Sign-in for the characters' sites (his rule, 2026-11-01): sending anything from a Shlomiverse site - an order from
// Hani's shop, a quote from Avi Balloons, a CV to Techy-Tech - needs a Google account, so he has everyone's email
// (they show in /backstage/ -> אנשים). The same Firebase Auth as the verse (boostmind-b052c): on shlomiverse.com a fan
// who is already signed in to the verse is signed in here too, and sends without seeing anything.
// Since 2026-11-06 also any regular email (his ask): a 6-digit code from verse.js (emailCode / emailIn), the same account
// as the verse's - first inside Instagram / TikTok / Facebook (Google refuses there), "או עם מייל רגיל" under Google elsewhere.
//   <script src="/verse/site-signin.js" defer></script>      (techytech.web.app: https://shlomiverse.com/verse/site-signin.js)
//   const who = await SiteSignIn.ensure('ofnat-hani');       // null if they closed the window
//   fetch(API, { method: 'POST', body: fd, headers: { authorization: 'Bearer ' + who.token } });
(() => {
  const SDK = 'https://www.gstatic.com/firebasejs/12.4.0';
  // boostmind-b052c's web app (a web API key is public by design) - the same as public/verse/fb.js
  const CONFIG = { apiKey: 'AIzaSyB90ncysHNU-fqHfe9dEudVR2sweXQGM90', authDomain: 'boostmind-b052c.firebaseapp.com', projectId: 'boostmind-b052c', appId: '1:463727469066:web:fe01da10c04d395d55f5f3' };
  const HELLO = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/siteUser';
  const VERSE = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verse';   // the callable, spoken directly
  const call = async (op, data) => {
    const r = await fetch(VERSE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: { op, ...data } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw Object.assign(new Error('call'), { code: (j.error && j.error.message) || 'other' });
    return j.result;
  };
  const ERR = { email_bad: 'הכתובת הזאת לא נראית כמו מייל.', code_bad: 'הקוד לא נכון. נסו שוב.', code_old: 'הקוד פג. שלחו קוד חדש.',
    slow_down: 'רגע, לאט. נסו שוב עוד כמה דקות.', mail_full: 'אי אפשר לשלוח עוד קודים היום. נסו מחר.', mail_failed: 'המייל לא יצא. נסו שוב.', other: 'משהו השתבש. נסו שוב.' };
  const t = (ev, x) => { try { window.track && window.track(ev, x); } catch (e) {} };
  // Google refuses to sign in inside TikTok / Instagram / Facebook's own browsers (the same test as the verse's ui.js)
  const inApp = () => /musical_ly|bytedance|BytedanceWebview|TikTok|Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(navigator.userAgent);
  let A = null, auth = null, greeted = false;
  const ready = (async () => {
    const { initializeApp, getApps } = await import(`${SDK}/firebase-app.js`);
    A = await import(`${SDK}/firebase-auth.js`);
    auth = A.getAuth(getApps()[0] || initializeApp(CONFIG));
    await auth.authStateReady();
  })();
  ready.catch((e) => console.error('sign-in did not load', e));

  const css = `.ssi-back{position:fixed;inset:0;z-index:2147483000;background:rgba(10,10,14,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:grid;place-items:center;padding:16px;animation:ssi-in .2s ease}
.ssi-card{position:relative;width:min(380px,100%);background:#fff;color:#16161b;border-radius:22px;padding:30px 24px 22px;text-align:center;direction:rtl;font-family:inherit;box-shadow:0 24px 70px rgba(0,0,0,.35)}
.ssi-card b{display:block;font-size:1.3rem;line-height:1.3;margin:0 0 8px}.ssi-card p{margin:0 0 20px;font-size:.98rem;line-height:1.55;color:#4a4a55}
.ssi-g{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:50px;border:1px solid #d6d6de;border-radius:14px;background:#fff;color:#16161b;font:inherit;font-weight:700;font-size:1rem;cursor:pointer}
.ssi-g:hover{background:#f6f6f8}.ssi-g[disabled]{opacity:.6;cursor:wait}.ssi-g svg{width:20px;height:20px;flex:none}
.ssi-card small{display:block;margin-top:12px;color:#7a7a85;font-size:.82rem}.ssi-err{color:#c0392b!important}
.ssi-f{display:flex;flex-direction:column;gap:10px}.ssi-in{width:100%;min-height:50px;box-sizing:border-box;border:1px solid #d6d6de;border-radius:14px;padding:0 14px;font:inherit;font-size:1rem;text-align:center;direction:ltr}
.ssi-in:focus{outline:2px solid #ff6a1f;border-color:transparent}.ssi-code{font-size:1.6rem;font-weight:800;letter-spacing:.45em;text-indent:.45em}
.ssi-go{width:100%;min-height:50px;border:0;border-radius:14px;background:#16161b;color:#fff;font:inherit;font-weight:700;font-size:1rem;cursor:pointer}.ssi-go[disabled]{opacity:.6;cursor:wait}
.ssi-l{display:block;margin:12px auto 0;border:0;background:none;color:#4a4a55;font:inherit;font-size:.92rem;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.ssi-x{position:absolute;top:10px;inset-inline-start:10px;width:36px;height:36px;border:0;border-radius:50%;background:#f1f1f4;color:#555;font-size:22px;line-height:1;cursor:pointer}
@keyframes ssi-in{from{opacity:0}to{opacity:1}}`;
  const G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>';

  // the account, told to the server once per page (siteUsers), then handed to the page
  async function who(site) {
    const u = auth.currentUser;
    const token = await u.getIdToken();
    if (!greeted) {
      greeted = true;
      fetch(HELLO, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ site }) }).catch(() => {});
    }
    return { token, email: u.email, name: u.displayName || '', photo: u.photoURL || '', uid: u.uid };
  }

  function sheet(site) {
    return new Promise((resolve) => {
      if (!document.getElementById('ssi-css')) document.head.insertAdjacentHTML('beforeend', `<style id="ssi-css">${css}</style>`);
      const back = document.createElement('div');
      back.className = 'ssi-back';
      t('signin_ask', inApp() ? 'inapp' : 'browser'); t('signin_from', 'site-' + site);
      const X = '<button class="ssi-x" aria-label="סגירה">×</button>';
      const safe = (v) => String(v).replace(/[<>&"']/g, '');
      let email = '';
      // Google (outside the apps) - email first inside them, where Google refuses to sign in
      const google = () => `${X}<b>רגע לפני ששולחים</b><p>מתחברים, וככה יש לנו איך לחזור אליכם.</p>
        <button class="ssi-g" data-google>${G}<span>המשך עם Google</span></button>
        <button class="ssi-l" data-mail>או עם מייל רגיל</button><small>בלי סיסמאות. בלי ספאם.</small>`;
      const mail = () => `${X}<b>רגע לפני ששולחים</b><p>משאירים מייל, מקבלים קוד, וזהו. כל מייל עובד, לא רק Gmail.</p>
        <form class="ssi-f" data-f1><input class="ssi-in" type="email" inputmode="email" autocomplete="email" required placeholder="כתובת המייל שלכם" value="${safe(email)}">
        <button class="ssi-go">שלחו קוד</button></form><small></small>
        ${inApp() ? '<button class="ssi-l" data-copy>מעדיפים Google? העתיקו את הקישור ופתחו בדפדפן</button>' : '<button class="ssi-l" data-back>חזרה ל-Google</button>'}`;
      const code = () => `${X}<b>שלחנו לכם קוד</b><p>למייל <span dir="ltr">${safe(email)}</span>. הקוד בתוקף 10 דקות.</p>
        <form class="ssi-f" data-f2><input class="ssi-in ssi-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" required placeholder="······">
        <button class="ssi-go">אישור</button></form><small></small>
        <button class="ssi-l" data-again>לא הגיע? שלחו שוב</button><button class="ssi-l" data-mail>מייל אחר</button>`;
      document.body.appendChild(back);
      const close = (v) => { back.remove(); resolve(v); };
      back.onclick = (e) => { if (e.target === back) close(false); };
      const busy = (b, on, label) => { b.disabled = on; b.textContent = on ? '...' : label; };
      const draw = (html) => { back.innerHTML = `<div class="ssi-card" role="dialog" aria-modal="true">${html}</div>`; wire(); };
      function wire() {
        back.querySelector('.ssi-x').onclick = () => close(false);
        const small = back.querySelector('small');
        const err = (c) => { small.className = 'ssi-err'; small.textContent = ERR[c] || ERR.other; };
        back.querySelector('[data-mail]')?.addEventListener('click', () => draw(mail()));
        back.querySelector('[data-back]')?.addEventListener('click', () => draw(google()));
        const copy = back.querySelector('[data-copy]');
        if (copy) copy.onclick = () => { navigator.clipboard?.writeText(location.href).then(() => { copy.textContent = 'הקישור הועתק. פתחו אותו בדפדפן'; }, () => {}); };
        const f1 = back.querySelector('[data-f1]');
        if (f1) {
          const inp = f1.querySelector('input'), b = f1.querySelector('button');
          setTimeout(() => inp.focus(), 100);
          f1.onsubmit = async (e) => {
            e.preventDefault(); email = inp.value.trim().toLowerCase(); busy(b, true);
            try { await call('emailCode', { email }); t('email_code', 'sent'); draw(code()); }
            catch (x) { busy(b, false, 'שלחו קוד'); err(x.code); t('email_code', x.code); }
          };
        }
        const f2 = back.querySelector('[data-f2]');
        if (f2) {
          const inp = f2.querySelector('input'), b = f2.querySelector('button');
          setTimeout(() => inp.focus(), 100);
          inp.oninput = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); if (inp.value.length === 6) f2.requestSubmit(); };
          f2.onsubmit = async (e) => {
            e.preventDefault(); if (b.disabled) return; busy(b, true);
            try {
              const r = await call('emailIn', { email, code: inp.value });
              await A.signInWithCustomToken(auth, r.token);
              t('email_code', 'ok'); t('sign_in', r.isNew ? 'new' : 'back');
              if (r.isNew) { t('joined', 'site-' + site); t('join_via', 'email'); }
              close(true);
            } catch (x) { busy(b, false, 'אישור'); err(x.code); inp.select(); t('email_code', x.code); }
          };
          back.querySelector('[data-again]').onclick = async (e) => {
            e.target.disabled = true;
            try { await call('emailCode', { email }); small.className = ''; small.textContent = 'שלחנו קוד חדש'; } catch (x) { err(x.code); }
          };
        }
        const g = back.querySelector('[data-google]');
        if (g) g.onclick = async () => {
          g.disabled = true;
          try {
            const p = new A.GoogleAuthProvider();
            p.setCustomParameters({ prompt: 'select_account' });
            const r = await A.signInWithPopup(auth, p);   // straight from the click, so the browser lets the window open
            const isNew = A.getAdditionalUserInfo(r)?.isNewUser;
            t('sign_in', isNew ? 'new' : 'back');
            if (isNew) { t('joined', 'site-' + site); t('join_via', 'google'); }
            close(true);
          } catch (e) {
            g.disabled = false;
            if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
            small.className = 'ssi-err';
            small.textContent = e.code === 'auth/popup-blocked' ? 'הדפדפן חסם את חלון ההתחברות. אפשרו חלונות קופצים ונסו שוב.' : 'ההתחברות לא הצליחה. נסו שוב.';
          }
        };
      }
      draw(inApp() ? mail() : google());
    });
  }

  window.SiteSignIn = {
    ready,
    // signed in already -> the account at once; otherwise the sheet first. null = they walked away (or it can't load)
    async ensure(site) {
      try { await ready; } catch { alert('משהו לא נטען. רעננו את הדף ונסו שוב.'); return null; }
      if (!auth.currentUser && !(await sheet(site))) return null;
      return who(site);
    },
    user: () => (auth && auth.currentUser ? { email: auth.currentUser.email, name: auth.currentUser.displayName || '' } : null),
  };
})();
