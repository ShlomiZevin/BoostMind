// Sign-in for the characters' sites (his rule, 2026-11-01): sending anything from a Shlomiverse site - an order from
// Hani's shop, a quote from Avi Balloons, a CV to Techy-Tech - needs a Google account, so he has everyone's email
// (they show in /backstage/ -> אנשים). The same Firebase Auth as the verse (boostmind-b052c): on shlomiverse.com a fan
// who is already signed in to the verse is signed in here too, and sends without seeing anything.
//   <script src="/verse/site-signin.js" defer></script>      (techytech.web.app: https://shlomiverse.com/verse/site-signin.js)
//   const who = await SiteSignIn.ensure('ofnat-hani');       // null if they closed the window
//   fetch(API, { method: 'POST', body: fd, headers: { authorization: 'Bearer ' + who.token } });
(() => {
  const SDK = 'https://www.gstatic.com/firebasejs/12.4.0';
  // boostmind-b052c's web app (a web API key is public by design) - the same as public/verse/fb.js
  const CONFIG = { apiKey: 'AIzaSyB90ncysHNU-fqHfe9dEudVR2sweXQGM90', authDomain: 'boostmind-b052c.firebaseapp.com', projectId: 'boostmind-b052c', appId: '1:463727469066:web:fe01da10c04d395d55f5f3' };
  const HELLO = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/siteUser';
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

  function sheet() {
    return new Promise((resolve) => {
      if (!document.getElementById('ssi-css')) document.head.insertAdjacentHTML('beforeend', `<style id="ssi-css">${css}</style>`);
      const back = document.createElement('div');
      back.className = 'ssi-back';
      try { window.track && window.track('signin_ask', inApp() ? 'inapp' : 'browser'); } catch (e) {}
      back.innerHTML = inApp()
        ? `<div class="ssi-card" role="dialog" aria-modal="true"><button class="ssi-x" aria-label="סגירה">×</button>
            <b>רגע לפני ששולחים</b><p>שולחים מחשבון Google, ו-Google לא מאפשרת להתחבר מתוך האפליקציה הזאת. פתחו את הקישור בדפדפן (שלוש הנקודות ← "פתיחה בדפדפן") ונמשיך משם.</p>
            <button class="ssi-g" data-copy>העתקת הקישור</button></div>`
        : `<div class="ssi-card" role="dialog" aria-modal="true"><button class="ssi-x" aria-label="סגירה">×</button>
            <b>רגע לפני ששולחים</b><p>מתחברים עם Google, וככה יש לנו איך לחזור אליכם.</p>
            <button class="ssi-g" data-google>${G}<span>המשך עם Google</span></button><small>בלי סיסמאות. בלי ספאם.</small></div>`;
      document.body.appendChild(back);
      const close = (v) => { back.remove(); resolve(v); };
      back.querySelector('.ssi-x').onclick = () => close(false);
      back.onclick = (e) => { if (e.target === back) close(false); };
      const copy = back.querySelector('[data-copy]');
      if (copy) copy.onclick = () => { navigator.clipboard?.writeText(location.href).then(() => { copy.textContent = 'הקישור הועתק'; }, () => {}); };
      const g = back.querySelector('[data-google]');
      if (g) g.onclick = async () => {
        g.disabled = true;
        const small = back.querySelector('small');
        try {
          const p = new A.GoogleAuthProvider();
          p.setCustomParameters({ prompt: 'select_account' });
          await A.signInWithPopup(auth, p);   // straight from the click, so the browser lets the window open
          close(true);
        } catch (e) {
          g.disabled = false;
          if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
          small.className = 'ssi-err';
          small.textContent = e.code === 'auth/popup-blocked' ? 'הדפדפן חסם את חלון ההתחברות. אפשרו חלונות קופצים ונסו שוב.' : 'ההתחברות לא הצליחה. נסו שוב.';
        }
      };
    });
  }

  window.SiteSignIn = {
    ready,
    // signed in already -> the account at once; otherwise the sheet first. null = they walked away (or it can't load)
    async ensure(site) {
      try { await ready; } catch { alert('משהו לא נטען. רעננו את הדף ונסו שוב.'); return null; }
      if (!auth.currentUser && !(await sheet())) return null;
      return who(site);
    },
    user: () => (auth && auth.currentUser ? { email: auth.currentUser.email, name: auth.currentUser.displayName || '' } : null),
  };
})();
