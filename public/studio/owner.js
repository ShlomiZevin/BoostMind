// His creation pages on shlomiverse.com (/studio/, /drop/, /shoot/) - his Google account only (his rule, 2026-11-03).
// The sign-in is the verse's own Firebase Auth; the files go straight into the Drop's bucket (boostmind-drop) through
// Firebase Storage - storage.rules lets in only shlomi@boostart.io, so the gate here is the door and the rules are
// the lock. No server: the studio on his PC pulls the files down (render/drop.mjs) and pushes the scripts up.
//   const O = await import('/studio/owner.js');
//   await O.gate();                       // the sign-in card until he is in (another account: refused)
//   const { folders } = await O.drop.list();
const SDK = 'https://www.gstatic.com/firebasejs/12.4.0';
const OWNER = 'shlomi@boostart.io';
// boostmind-b052c's web app (a web API key is public by design) - the same as public/verse/fb.js
const CONFIG = { apiKey: 'AIzaSyB90ncysHNU-fqHfe9dEudVR2sweXQGM90', authDomain: 'boostmind-b052c.firebaseapp.com', projectId: 'boostmind-b052c', appId: '1:463727469066:web:fe01da10c04d395d55f5f3' };

const [{ initializeApp, getApps }, A, S] = await Promise.all([
  import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-storage.js`)]);
const app = getApps()[0] || initializeApp(CONFIG);
export const auth = A.getAuth(app);
const st = S.getStorage(app, 'gs://boostmind-drop');
st.maxUploadRetryTime = 2 * 3600e3;    // (a long take on a weak connection: keep trying for two hours)
st.maxOperationRetryTime = 10 * 60e3;
await A.getRedirectResult(auth).catch(() => {});
await auth.authStateReady();

const isOwner = (u) => !!u && u.emailVerified && (u.email || '').toLowerCase() === OWNER;
export const user = () => (isOwner(auth.currentUser) ? auth.currentUser : null);

// ---- the gate: a card over the page until he is signed in ----
const css = `.og-back{position:fixed;inset:0;z-index:2147483000;background:#131211;display:grid;place-items:center;padding:20px;font-family:Inter,-apple-system,system-ui,sans-serif}
.og-card{width:min(360px,100%);background:#1a1918;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px 22px 22px;text-align:center;color:#f2f0ed}
.og-card b{display:block;font-size:20px;margin:0 0 6px}.og-card p{margin:0 0 20px;color:#a8a39c;font-size:14px;line-height:1.5}
.og-g{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:50px;border:0;border-radius:10px;background:#ff6b57;color:#fff;font:inherit;font-weight:700;font-size:16px;cursor:pointer}
.og-g[disabled]{opacity:.6}.og-out{margin-top:12px;background:none;border:0;color:#a8a39c;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer}
.og-err{color:#ff8a7a!important;margin:12px 0 0!important;font-size:13px!important}`;
let gating = null;
export function gate() {
  if (user()) return Promise.resolve(user());
  return (gating ||= new Promise((ok) => {
    const sty = document.createElement("style"); sty.textContent = css; document.head.appendChild(sty);
    const back = document.createElement('div'); back.className = 'og-back';
    const draw = () => {
      const other = auth.currentUser && !isOwner(auth.currentUser);
      back.innerHTML = `<div class="og-card"><b>Shlomi's studio</b>
        <p>${other ? `${auth.currentUser.email} can't open this - it's Shlomi's own.` : 'Sign in with your Google account.'}</p>
        <button class="og-g">${other ? 'Use another account' : 'Sign in with Google'}</button>
        ${other ? '<button class="og-out">Sign out</button>' : ''}<p class="og-err" hidden></p></div>`;
      const btn = back.querySelector('.og-g'), err = back.querySelector('.og-err');
      btn.onclick = async () => {
        btn.disabled = true;
        const p = new A.GoogleAuthProvider();
        p.setCustomParameters({ prompt: 'select_account', login_hint: OWNER });
        try { await A.signInWithPopup(auth, p); }
        catch (e) {
          if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return A.signInWithRedirect(auth, p);
          if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') { err.hidden = false; err.textContent = e.message; }
        }
        btn.disabled = false;
      };
      back.querySelector('.og-out')?.addEventListener('click', () => A.signOut(auth));
    };
    draw();
    (document.body || document.documentElement).appendChild(back);
    A.onAuthStateChanged(auth, (u) => {
      if (isOwner(u)) { back.remove(); sty.remove(); ok(u); } else draw();
    });
  }));
}

// ---- the Drop: projects (folders) and their files, straight in the bucket ----
const R = (p) => S.ref(st, p);
const missing = (e) => e?.code === 'storage/object-not-found';
const quiet = (p) => p.catch((e) => { if (!missing(e)) throw e; });
// a folder / file name as it lands in the bucket and on the PC: letters (Hebrew too), digits, - _ . and spaces
export const clean = (s, max = 120) => String(s || '').normalize('NFC').replace(/[^\p{L}\p{N}\-_. ]+/gu, '-').replace(/^[-. ]+|[-. ]+$/g, '').slice(0, max);
const exists = (p) => S.getMetadata(R(p)).then(() => true, (e) => { if (missing(e)) return false; throw e; });
const urls = {};

export const drop = {
  // every project with its files, newest first ("_name" folders are the studio's own, never his projects)
  async list() {
    await gate();
    const top = await S.listAll(R(''));
    const folders = await Promise.all(top.prefixes.filter((p) => !p.name.startsWith('_')).map(async (pre) => {
      const fo = { name: pre.name, files: [], bytes: 0, updated: '' };
      const l = await S.listAll(pre);
      const thumbsRef = l.prefixes.find((p) => p.name === '.thumbs');
      const thumbs = new Set(thumbsRef ? (await S.listAll(thumbsRef)).items.map((i) => i.name.slice(0, -4)) : []);
      await Promise.all(l.items.map(async (it) => {
        const m = await S.getMetadata(it).catch(() => null);
        if (!m) return;
        if (m.updated > fo.updated) fo.updated = m.updated;
        if (it.name.startsWith('.')) return;  // (".keep": a project made before its first file)
        fo.files.push({ name: it.name, size: +m.size, updated: m.updated, type: m.contentType || '', thumb: thumbs.has(it.name) });
        fo.bytes += +m.size;
      }));
      return fo;
    }));
    return { folders: folders.sort((a, b) => (b.updated > a.updated ? 1 : -1)) };
  },
  async mkdir({ folder }) {  // a new project: a placeholder so it shows before its first file
    await gate();
    const f = clean(folder, 60);
    if (!f) throw new Error('Give it a name');
    await S.uploadString(R(`${f}/.keep`), '', 'raw', { contentType: 'text/plain' });
    return { folder: f };
  },
  // one file, resumable (the SDK sends it in pieces and picks up after a dropped connection). unique: a name that is
  // there already gets -2, -3. onProgress(bytes sent). Resolves { name } once it is all there
  async upload({ folder, name, file, type, unique, onProgress }) {
    await gate();
    const f = clean(folder, 60);
    let n = clean(name) || 'video';
    if (!f) throw new Error('folder');
    if (unique) {
      const i = n.lastIndexOf('.'), [base, dot] = i > 0 ? [n.slice(0, i), n.slice(i)] : [n, ''];
      for (let k = 2; await exists(`${f}/${n}`); k++) n = `${base}-${k}${dot}`;
    }
    const task = S.uploadBytesResumable(R(`${f}/${n}`), file, { contentType: type || file.type || 'application/octet-stream' });
    await new Promise((ok, fail) => task.on('state_changed', (s) => onProgress?.(s.bytesTransferred), fail, ok));
    return { name: n };
  },
  // off the Drop - and a marker (<folder>/.gone/<size>~<name>), so the studio deletes the copy it already pulled too
  async delete({ folder, name, size }) {
    await gate();
    const m = await S.getMetadata(R(`${folder}/${name}`)).catch(() => null);
    const sz = m ? +m.size : Number(size) || 0;
    if (sz > 0) await S.uploadString(R(`${folder}/.gone/${sz}~${name}`), '', 'raw', { contentType: 'text/plain' });
    await quiet(S.deleteObject(R(`${folder}/${name}`)));
    await quiet(S.deleteObject(R(`${folder}/.thumbs/${name}.jpg`)));
    return { ok: true };
  },
  async thumb({ folder, name, data }) {  // a file's small picture (a JPEG drawn by the page), kept beside it in .thumbs/
    await gate();
    await S.uploadString(R(`${folder}/.thumbs/${name}.jpg`), data, 'data_url');
    return { ok: true };
  },
  async rmdir({ folder }) {  // a whole project
    await gate();
    const all = [];
    const walk = async (r) => { const l = await S.listAll(r); all.push(...l.items); for (const p of l.prefixes) await walk(p); };
    await walk(R(clean(folder, 60)));
    await Promise.all(all.map((it) => quiet(S.deleteObject(it))));
    return { removed: all.length };
  },
  // a file's own link (an <img>, a <video>, a download)
  async url(path) {
    await gate();
    return (urls[path] ||= await S.getDownloadURL(R(path)));
  },
  // the scripts for Shoot's prompter - the studio keeps them up to date under _scripts/ (render/drop.mjs pushScripts)
  async scripts() {
    await gate();
    try { return { scripts: JSON.parse(new TextDecoder().decode(await S.getBytes(R('_scripts/index.json')))) }; }
    catch (e) { if (missing(e)) return { scripts: [] }; throw e; }
  },
  async script({ id }) {
    await gate();
    if (!/^[se]\/[^/]+$/.test(String(id)) || String(id).includes('..')) throw new Error('id');
    return { text: new TextDecoder().decode(await S.getBytes(R(`_scripts/${id}.txt`))) };
  },
};
