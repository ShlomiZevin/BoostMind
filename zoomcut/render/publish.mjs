// Publish - the exported video to his socials, from the studio. One adapter per platform (below); each says whether
// it is connected (its keys in zoomcut/.env) and posts a file. A project keeps its post in episodes/<id>/publish.json
// (platforms, caption, title, per-platform options, the last results) - NOT episode.json: a write there would make
// the export look older than the project (exportStale) and block publishing it. Export can publish by itself when it
// ends (publish.json afterExport - kept on disk, so a restart in between doesn't lose it).
//   Instagram  Reels (grid + Reels tab, or Reels tab only); Instagram downloads the video from a private one-hour link
//              (the Drop's /api/publink on a file staged in the bucket's hidden _publish/ folder, deleted after)
//   X          a post with the video (chunked upload, OAuth 1.0a, his own app 'Sketch Studio' on Pay Per Use - about
//              1.5 cents a post; links are taken out of the text, a link makes a post cost ~20 cents) - up to 2:20
//   TikTok     to his TikTok DRAFTS (an unaudited app can't post publicly): he adds a sound and posts in the app. The
//              API takes no caption for a draft - the caption comes to his Telegram, ready to copy into TikTok
//   YouTube    a Short (vertical, up to 3 min), public / unlisted / private
//   Facebook   no app can post to a personal profile: Instagram's own "Share to Facebook" button does it - picked,
//              it sends him a Telegram once the Instagram Reel is up (its link + the step), he shares it himself
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { sendTelegramText, tgEsc } from './share.mjs';

const DROP = 'https://drop-463727469066.me-west1.run.app';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startPublish({ app, ROOT, epDir, readJson, writeJson, recordJob, isStale }) {
  const ENV = path.join(ROOT, '.env');
  const env = () => Object.fromEntries(fs.readFileSync(ENV, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  const setEnv = (vals) => {  // (a renewed key goes back into the file)
    const keys = Object.keys(vals);
    let t = fs.readFileSync(ENV, 'utf8').split(/\r?\n/).filter((l) => !keys.some((k) => l.startsWith(k + '='))).join('\n').replace(/\n+$/, '');
    for (const k of keys) t += `\n${k}=${vals[k]}`;
    fs.writeFileSync(ENV, t + '\n');
  };
  const json = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; } };
  const gcloud = (args) => new Promise((ok, fail) => execFile('cmd', ['/c', 'gcloud', ...args], { windowsHide: true }, (e) => (e ? fail(e) : ok())));
  // a private one-hour link to the file (staged in the Drop bucket's hidden _publish/ folder) - for the platforms that
  // download the video themselves; the returned drop() deletes it
  async function privateLink(file) {
    const obj = `_publish/${crypto.randomBytes(10).toString('hex')}${path.extname(file) || '.mp4'}`;
    await gcloud(['storage', 'cp', file, `gs://boostmind-drop/${obj}`]);
    const drop = () => gcloud(['storage', 'rm', `gs://boostmind-drop/${obj}`]).catch(() => {});
    const l = await json(await fetch(`${DROP}/api/publink`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: env().DROP_KEY, f: obj }) }));
    if (!l.url) { await drop(); throw new Error('no private link: ' + JSON.stringify(l).slice(0, 120)); }
    return { url: l.url, drop };
  }

  // ---- the platforms ----------------------------------------------------------------------------------------
  const P = {
    instagram: {
      name: 'Instagram', what: 'Reel',
      connected: (e) => (e.IG_TOKEN && e.IG_USER_ID ? { ok: true, handle: '@shlomizevin', until: e.IG_TOKEN_EXPIRES } : { ok: false }),
      limits: { caption: 2200, seconds: 900 },
      async publish(file, post, log) {
        let e = env();
        if (e.IG_TOKEN_EXPIRES && Date.parse(e.IG_TOKEN_EXPIRES) - Date.now() < 15 * 864e5) {  // renew a key that ends within 15 days
          const r = await json(await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${e.IG_TOKEN}`));
          if (r.access_token) { setEnv({ IG_TOKEN: r.access_token, IG_TOKEN_EXPIRES: new Date(Date.now() + r.expires_in * 1000).toISOString().slice(0, 10) }); e = env(); log('key renewed'); }
        }
        const G = 'https://graph.instagram.com/v23.0', T = e.IG_TOKEN;
        log('handing Instagram a private link…');
        const link = await privateLink(file);
        try {
          const c = await json(await fetch(`${G}/${e.IG_USER_ID}/media`, { method: 'POST', body: new URLSearchParams({
            media_type: 'REELS', video_url: link.url, caption: post.caption || '', share_to_feed: post.options?.instagram?.reelsOnly ? 'false' : 'true', access_token: T }) }));
          if (!c.id) throw new Error(c.error?.message || 'Instagram refused the Reel');
          for (let i = 0; i < 200; i++) {  // Instagram downloads and processes it (a minute or two for a long one)
            const s = await json(await fetch(`${G}/${c.id}?fields=status_code,status&access_token=${T}`));
            if (s.status_code === 'FINISHED') break;
            if (s.status_code === 'ERROR' || s.error) throw new Error(s.status || s.error?.message || 'Instagram could not process it');
            log(`Instagram is processing it… ${i * 3}s`, true);
            await sleep(3000);
          }
          const pub = await json(await fetch(`${G}/${e.IG_USER_ID}/media_publish`, { method: 'POST', body: new URLSearchParams({ creation_id: c.id, access_token: T }) }));
          if (!pub.id) throw new Error(pub.error?.message || 'not published');
          const m = await json(await fetch(`${G}/${pub.id}?fields=permalink&access_token=${T}`));
          return { url: m.permalink, note: `posted PUBLIC - ${post.options?.instagram?.reelsOnly ? 'Reels tab only' : 'grid + Reels tab'}` };
        } finally { await link.drop(); }
      },
    },

    x: {
      name: 'X', what: 'Post',
      connected: (e) => (e.X_ACCESS_TOKEN && e.X_CONSUMER_KEY ? { ok: true, handle: e.X_HANDLE ? '@' + e.X_HANDLE : '' } : { ok: false }),
      limits: { caption: 280, seconds: 140 },
      async publish(file, post, log) {
        const e = env();
        const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
        const auth = (method, url, query = {}) => {  // OAuth 1.0a (the query is signed; JSON / multipart bodies are not)
          const o = { oauth_consumer_key: e.X_CONSUMER_KEY, oauth_nonce: crypto.randomBytes(16).toString('hex'), oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_token: e.X_ACCESS_TOKEN, oauth_version: '1.0' };
          const all = { ...o, ...query };
          const base = [method, enc(url), enc(Object.keys(all).sort().map((k) => `${enc(k)}=${enc(all[k])}`).join('&'))].join('&');
          o.oauth_signature = crypto.createHmac('sha1', `${enc(e.X_CONSUMER_SECRET)}&${enc(e.X_ACCESS_SECRET)}`).update(base).digest('base64');
          return 'OAuth ' + Object.keys(o).sort().map((k) => `${enc(k)}="${enc(o[k])}"`).join(', ');
        };
        const U = 'https://api.x.com/2/media/upload', size = fs.statSync(file).size;
        const init = await json(await fetch(`${U}/initialize`, { method: 'POST', headers: { Authorization: auth('POST', `${U}/initialize`), 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_type: 'video/mp4', total_bytes: size, media_category: 'tweet_video' }) }));
        const id = init.data?.id;
        if (!id) throw new Error('X upload: ' + JSON.stringify(init).slice(0, 200));
        const buf = fs.readFileSync(file), CH = 4 * 1048576;
        for (let i = 0, seg = 0; i < size; i += CH, seg++) {
          const form = new FormData();
          form.append('media', new Blob([buf.subarray(i, i + CH)]), 'chunk');
          form.append('segment_index', String(seg));
          const r = await fetch(`${U}/${id}/append`, { method: 'POST', headers: { Authorization: auth('POST', `${U}/${id}/append`) }, body: form });
          if (!r.ok) throw new Error(`X upload piece ${seg}: ${r.status} ${(await r.text()).slice(0, 150)}`);
          log(`uploading to X… ${Math.min(100, Math.round(((i + CH) / size) * 100))}%`, true);
        }
        let fin = await json(await fetch(`${U}/${id}/finalize`, { method: 'POST', headers: { Authorization: auth('POST', `${U}/${id}/finalize`) } }));
        let info = fin.data?.processing_info;
        for (let k = 0; info && info.state !== 'succeeded' && k < 120; k++) {
          if (info.state === 'failed') throw new Error('X could not process the video: ' + (info.error?.message || ''));
          log('X is processing it…', true);
          await sleep((info.check_after_secs || 2) * 1000);
          const q = { command: 'STATUS', media_id: id };
          const st = await json(await fetch(`${U}?command=STATUS&media_id=${id}`, { headers: { Authorization: auth('GET', U, q) } }));
          info = st.data?.processing_info;
        }
        // (no links: on X's Pay Per Use a post with a URL costs ~13x a plain one - his links page is in his X bio)
        const text = (post.options?.x?.text || post.caption || '').replace(/https?:\/\/\S+/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 280);
        const t = await json(await fetch('https://api.x.com/2/tweets', { method: 'POST', headers: { Authorization: auth('POST', 'https://api.x.com/2/tweets'), 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, media: { media_ids: [id] } }) }));
        if (!t.data?.id) throw new Error('X post: ' + JSON.stringify(t).slice(0, 200));
        return { url: `https://x.com/${e.X_HANDLE || 'i'}/status/${t.data.id}`, note: 'posted PUBLIC' };
      },
    },

    tiktok: {
      name: 'TikTok', what: 'Draft',
      connected: (e) => (e.TT_REFRESH_TOKEN && e.TT_CLIENT_KEY ? { ok: true, handle: e.TT_HANDLE ? '@' + e.TT_HANDLE : '', note: 'to your drafts' } : { ok: false }),
      limits: { caption: 0, seconds: 600 },
      async publish(file, post, log) {
        const e = env();
        const tok = await json(await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_key: e.TT_CLIENT_KEY, client_secret: e.TT_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: e.TT_REFRESH_TOKEN }) }));
        if (!tok.access_token) throw new Error('TikTok key: ' + (tok.error_description || tok.error || 'not renewed'));
        if (tok.refresh_token && tok.refresh_token !== e.TT_REFRESH_TOKEN) setEnv({ TT_REFRESH_TOKEN: tok.refresh_token });
        const size = fs.statSync(file).size, CH = size <= 64 * 1048576 ? size : 10 * 1048576, n = Math.floor(size / CH);
        const init = await json(await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', { method: 'POST',
          headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({ source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: CH, total_chunk_count: n } }) }));
        if (!init.data?.upload_url) throw new Error('TikTok: ' + (init.error?.message || JSON.stringify(init).slice(0, 200)));
        const buf = fs.readFileSync(file);
        for (let k = 0; k < n; k++) {  // (the last piece takes the rest)
          const a = k * CH, b = k === n - 1 ? size : a + CH;
          const r = await fetch(init.data.upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${a}-${b - 1}/${size}` }, body: buf.subarray(a, b) });
          if (!r.ok) throw new Error(`TikTok upload piece ${k}: ${r.status}`);
          log(`uploading to TikTok… ${Math.round((b / size) * 100)}%`, true);
        }
        for (let k = 0; k < 60; k++) {
          const s = await json(await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', { method: 'POST',
            headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify({ publish_id: init.data.publish_id }) }));
          const st = s.data?.status;
          if (st === 'SEND_TO_USER_INBOX' || st === 'PUBLISH_COMPLETE') {
            // (a draft can't carry text) - a Telegram that it's waiting for him in the app (the video's name, the steps),
            // then the caption ALONE in its own plain message: one long-press copies exactly it (his ask, 2026-10-25)
            const name = post.name || path.basename(file, '.mp4');
            const cap = (post.caption || '').trim();
            const sent = await sendTelegramText(`📱 <b>TikTok – ${tgEsc(name)}</b>\nWaiting for you to approve: TikTok → Inbox → "ready to edit" → add a sound → Post.\n\n`
              + (cap ? 'The caption is the next message - long-press it, Copy, paste it in TikTok.' : 'No caption was set for this video.'), { html: true })
              .then(async () => { if (cap) await sendTelegramText(cap); return true; }).catch(() => false);
            return { url: null, note: `Waiting for you in the TikTok app (Inbox → "ready to edit")${sent ? ' - details and the caption in your Telegram' : ''}` };
          }
          if (st === 'FAILED') throw new Error('TikTok: ' + (s.data?.fail_reason || 'failed'));
          log('TikTok is processing it…', true);
          await sleep(3000);
        }
        return { url: null, note: 'Sent - it should appear in your TikTok drafts' };
      },
    },

    youtube: {
      name: 'YouTube', what: 'Short',
      connected: (e) => (e.YT_REFRESH_TOKEN && e.YT_CLIENT_ID ? { ok: true, handle: e.YT_CHANNEL || '' } : { ok: false }),
      limits: { caption: 5000, title: 100, seconds: 180 },
      async publish(file, post, log) {
        const e = env();
        const tok = await json(await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: e.YT_CLIENT_ID, client_secret: e.YT_CLIENT_SECRET, refresh_token: e.YT_REFRESH_TOKEN, grant_type: 'refresh_token' }) }));
        if (!tok.access_token) throw new Error('YouTube key: ' + (tok.error_description || tok.error || 'not renewed'));
        const size = fs.statSync(file).size;
        const title = (post.title || post.caption || 'Short').split('\n')[0].slice(0, 100);
        // (each platform's options under its own name, as the window saves them). Unknown or missing -> PRIVATE, never
        // the platform's default: a post that can't read its setting must not go public
        const privacy = ['public', 'unlisted', 'private'].includes(post.options?.youtube?.privacy) ? post.options.youtube.privacy : 'private';
        // #Shorts in the description helps YouTube file a vertical video under Shorts right away
        const description = /#shorts/i.test(post.caption || '') ? post.caption : `${post.caption || ''}\n\n#Shorts`.trim();
        const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', { method: 'POST',
          headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) },
          body: JSON.stringify({ snippet: { title, description, categoryId: '23' },
            status: { privacyStatus: privacy, selfDeclaredMadeForKids: false } }) });
        const at = init.headers.get('location');
        if (!at) {
          const txt = await init.text();
          if (/exceeded the number of videos|uploadLimitExceeded/i.test(txt)) throw new Error("YouTube's daily upload limit for your channel - try again in a few hours (Send → only YouTube), or verify the channel: youtube.com/verify");
          throw new Error('YouTube: ' + txt.slice(0, 200));
        }
        log('uploading to YouTube…', true);
        const v = await json(await fetch(at, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: fs.readFileSync(file) }));
        if (!v.id) throw new Error('YouTube: ' + JSON.stringify(v).slice(0, 200));
        // (the log says the visibility YouTube actually gave it)
        const got = v.status?.privacyStatus || 'unknown';
        return { url: `https://youtube.com/shorts/${v.id}`, note: `uploaded as ${got.toUpperCase()}${got !== privacy ? ` (asked ${privacy})` : ''}` };
      },
    },

    facebook: {
      name: 'Facebook', what: 'Reel',
      connected: () => ({ ok: true, note: 'a Telegram reminder - you share the Instagram Reel to Facebook' }),
      limits: {},
      async publish(file, post, log, items) {  // (runs after Instagram - ORDER)
        const ig = items?.instagram;
        if (!ig || ig.state !== 'done' || !ig.url) throw new Error('Instagram didn\'t go out - nothing to share to Facebook');
        await sendTelegramText(`Your Instagram Reel is up ✓\n${ig.url}\n\nNow Facebook: open it in Instagram → ⋯ → "Share to Facebook"`);
        return { url: ig.url, note: 'Telegram reminder sent - share the Reel to Facebook from Instagram' };
      },
    },
  };
  const ORDER = ['instagram', 'tiktok', 'youtube', 'x', 'facebook'];

  // ---- runs ---------------------------------------------------------------------------------------------------
  const runs = {};  // id -> { running, started, items: { platform: { state, log, url, note, error } } }
  const epFile = (id) => path.join(epDir(id), 'episode.json');  // (read only: the title)
  const pubFile = (id) => path.join(epDir(id), 'publish.json');
  const master = (id) => path.join(epDir(id), 'out', `${id}.mp4`);
  // a Quick check or the phone test - shown in the window, never published (the newest of the two)
  const draftOf = (id) => [`${id}.test.mp4`, `${id}.draft.mp4`].map((n) => path.join(epDir(id), 'out', n)).filter((f) => fs.existsSync(f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || path.join(epDir(id), 'out', `${id}.draft.mp4`);
  function run(id, post, dry = false) {
    if (runs[id]?.running) return runs[id];
    const file = master(id);
    post = { ...post, platforms: ORDER.filter((p) => post.platforms.includes(p)), name: readJson(epFile(id), {}).title || id };  // (Instagram before Facebook's reminder; the video's name for messages)
    const r = (runs[id] = { running: true, started: Date.now(), items: Object.fromEntries(post.platforms.map((p) => [p, { state: 'waiting', log: [] }])) });
    (async () => {
      // every platform at once (his ask, 2026-10-25) - each its own job in the Jobs list; Facebook's reminder waits for
      // Instagram (it needs the Reel's link). Each goes out once: no retries.
      const one = async (p) => {
        const it = r.items[p], A = P[p];
        it.started = Date.now();
        const log = (m, replace) => { if (replace && it.log.length) it.log[it.log.length - 1] = m; else it.log.push(m); };
        if (!A?.publish || (!dry && !A.connected(env()).ok)) { it.state = 'skipped'; it.error = 'not connected'; return; }
        it.state = 'publishing';
        try {
          // (dry: everything but the platform call - a test of the path, nothing goes out)
          const res = dry ? (log('dry run - nothing sent'), await sleep(300), { url: null, note: `dry run: ${path.basename(file)} → ${A.name}` }) : await A.publish(file, post, log, r.items);
          Object.assign(it, { state: 'done', url: res.url || null, note: res.note || '' });
        } catch (e) { Object.assign(it, { state: 'failed', error: String(e.message || e).slice(0, 300) }); }
        if (!dry) recordJob({ id, kind: 'publish', channel: p, started: it.started, ended: Date.now(), ok: it.state === 'done', line: it.state === 'done' ? `${A.name}: ${it.url || it.note}` : `${A.name}: ${it.error}` });
      };
      const tasks = {};
      for (const p of post.platforms) if (p !== 'facebook') tasks[p] = one(p);
      if (post.platforms.includes('facebook')) tasks.facebook = (tasks.instagram || Promise.resolve()).then(() => one('facebook'));
      await Promise.all(Object.values(tasks));
      r.running = false; r.ended = Date.now();
      if (dry) return;
      const pj = readJson(pubFile(id), {});  // the results stay with the project
      writeJson(pubFile(id), { ...pj, afterExport: false, last: { at: r.ended, items: Object.fromEntries(Object.entries(r.items).map(([k, v]) => [k, { state: v.state, url: v.url, note: v.note, error: v.error }])) } });
      if (Object.values(r.items).some((it) => it.state === 'done')) site(id);  // out on a social -> on his sites too
    })();
    return r;
  }

  // ---- his sites: a published video goes on the Shlomiverse (the wiki + the links page) by itself, every time - videos
  // whose sessions skipped the wiki steps were missing there (2026-10-25). scripts/wiki/publish_site.py does it all
  // (done, web copy, Terra's fan copy, build, deploy, live check); here it is a "site" job, one at a time (it deploys
  // the whole hosting site), its lines the job's log, a Telegram with the link or the error.
  const BM = path.resolve(ROOT, '..');
  const sites = { queue: [], cur: null };
  function site(id) {
    if (sites.cur?.id === id || sites.queue.includes(id)) return { queued: true };
    sites.queue.push(id);
    pumpSites();
    return { queued: true };
  }
  function pumpSites() {
    if (sites.cur || !sites.queue.length) return;
    const id = sites.queue.shift();
    const cur = (sites.cur = { id, started: Date.now(), log: [] });
    const ch = spawn('python', ['scripts/wiki/publish_site.py', id], { cwd: BM, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    let buf = '';
    const take = (d) => { buf += d; const ls = buf.split(/\r?\n/); buf = ls.pop(); for (const l of ls) if (l.trim()) cur.log.push(l.trimEnd()); };
    ch.stdout.on('data', take); ch.stderr.on('data', take);
    let over = false;  // ('error' and 'close' can both come)
    const end = async (code) => {
      if (over) return;
      over = true;
      if (buf.trim()) cur.log.push(buf.trim());
      const ok = code === 0;
      const done = cur.log.filter((l) => l.startsWith('✔')), warn = cur.log.filter((l) => l.trim().startsWith('!'));
      recordJob({ id, kind: 'site', started: cur.started, ended: Date.now(), ok, line: ok ? done.at(-1) || 'on the Shlomiverse' : cur.log.at(-1) || `failed (${code})` });
      await sendTelegramText(ok ? `🌐 On the Shlomiverse ✓\n${done.join('\n')}${warn.length ? '\n\n' + warn.join('\n') : ''}`
        : `⚠ ${id} didn't go up on the Shlomiverse (the wiki / links page):\n${cur.log.slice(-6).join('\n')}\n\nRun it again: POST /api/ep/${id}/site`).catch(() => {});
      sites.cur = null;
      pumpSites();
    };
    ch.on('close', end);
    ch.on('error', (e) => { cur.log.push(String(e.message || e)); end(-1); });
  }
  // by hand: a video published before this, or one whose site job failed
  app.post('/api/ep/:id/site', (q, res) => {
    if (!fs.existsSync(master(q.params.id))) return res.status(400).json({ error: 'No full export of this video' });
    res.json(site(q.params.id));
  });
  const postOf = (body) => ({ platforms: (body.platforms || []).filter((p) => P[p]?.publish), caption: String(body.caption || ''), title: String(body.title || ''), options: body.options || {} });
  const savePost = (id, post, afterExport, dry = false) => writeJson(pubFile(id), { ...readJson(pubFile(id), {}), ...post, afterExport: !!afterExport, dry: !!dry });

  app.get('/api/publish/platforms', (_q, res) => {
    const e = env();
    res.json(ORDER.map((id) => ({ id, name: P[id].name, what: P[id].what, manual: !!P[id].manual, limits: P[id].limits, ...P[id].connected(e) })));
  });
  // the project's post (what he last chose) + the run now / the last results
  app.get('/api/ep/:id/publish', (q, res) => {
    const e = readJson(epFile(q.params.id), {}), f = master(q.params.id), pj = readJson(pubFile(q.params.id), null);
    let file = null;  // what would go out: the file, its size and when it was exported (the window shows it before he clicks)
    try { const st = fs.statSync(f); file = { name: path.basename(f), size: st.size, exported: st.mtimeMs, stale: !!isStale(q.params.id) }; } catch {}
    let draft = null;  // a Quick check (half size) - shown in the window, never published
    try { draft = { exported: fs.statSync(draftOf(q.params.id)).mtimeMs }; } catch {}
    res.json({ post: pj, run: runs[q.params.id] || null, title: e.title || q.params.id, file, draft });
  });
  // the video the window shows: the full export, else the Quick check draft
  app.get('/api/ep/:id/publish/video', (q, res) => {
    const f = [master(q.params.id), draftOf(q.params.id)].find((x) => fs.existsSync(x));
    if (!f) return res.status(404).end();
    res.sendFile(f);
  });
  // publish the current export now; {afterExport: true} only saves it - the export publishes when it ends well.
  // {dry: true}: the whole path without the platform calls (a test - nothing goes out)
  app.post('/api/ep/:id/publish', (q, res) => {
    const id = q.params.id, post = postOf(q.body || {});
    if (q.body?.afterExport) { savePost(id, post, true, !!q.body?.dry); return res.json({ saved: true }); }
    // {save: true}: only fills the Publish window (a session prepares caption / title / platforms - he presses Publish)
    if (q.body?.save) { savePost(id, post, !!readJson(pubFile(id), {}).afterExport); return res.json({ saved: true }); }
    if (!post.platforms.length) return res.status(400).json({ error: 'Pick where to publish' });
    if (!fs.existsSync(master(id))) return res.status(400).json({ error: 'Export the video first' });
    // never a file older than his last change (public and can't be undone) - export again first. Checked before
    // anything is written (publish.json isn't watched by exportStale anyway)
    if (isStale(id)) return res.status(409).json({ error: 'The video changed after this export - export again first' });
    if (runs[id]?.running) return res.status(409).json({ error: 'Already publishing this video' });
    savePost(id, post, false);
    res.json({ run: run(id, post, !!q.body?.dry) });  // (once: no retries - a failed platform says so, he decides)
  });

  // an export ended well: publish if it was asked to (a quick draft never goes out)
  return {
    afterExport(id, quick) {
      const pj = readJson(pubFile(id), {});
      if (quick || !pj.afterExport || !(pj.platforms || []).length) return;
      writeJson(pubFile(id), { ...pj, afterExport: false, dry: false });  // (cleared first: it publishes once)
      run(id, pj, !!pj.dry);
    },
    // the Jobs list: one job per platform (his ask) - its own progress line; the site job after them
    running: () => [...(sites.cur ? [{ id: sites.cur.id, kind: 'site', started: sites.cur.started, log: sites.cur.log.slice(-5) }] : []),
      ...sites.queue.map((id) => ({ id, kind: 'site', started: Date.now(), log: ['waiting for the site job before it'] })), ...Object.entries(runs).filter(([, r]) => r.running).flatMap(([id, r]) => Object.entries(r.items)
      .filter(([, it]) => it.state === 'waiting' || it.state === 'publishing')
      .map(([p, it]) => ({ id, kind: 'publish', channel: p, started: it.started || r.started,
        log: [`${P[p].name}: ${it.state === 'waiting' ? 'waiting for Instagram' : it.log.at(-1) || 'starting…'}`] })))],
  };
}
