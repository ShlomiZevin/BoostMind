// A LONG chat as a story video (his ask, 2026-11-19): numbered parts (1/5 beside the date), every bubble TYPED fast
// like someone writing, the whole thing under a minute (one story clip; his note: "much, much faster, typing animation").
// Same look as chat-poster.cjs (the chat-story skill says how a chat is picked and cleaned).
//   node scripts/stories/chat-video.cjs spec.json out.mp4 [--max 55]
// spec = a chat-poster spec, but "parts": [ [msgs of part 1], [msgs of part 2], ... ] instead of "msgs".
// Pace: typing speed is set so the whole video fits --max seconds (default 55); after each bubble a short beat
// (visitor 0.3 s, resident 0.7 s), the end of a part +0.5 s, the very end +2 s.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { buildHtml, chrome, puppeteer } = require('./chat-poster.cjs');
const args = process.argv.slice(2), [specFile, out] = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const MAX = Number(args.includes('--max') ? args[args.indexOf('--max') + 1] : 55) || 55;
if (!specFile || !out) { console.error('usage: chat-video.cjs spec.json out.mp4 [--max 55]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const FPS = 30, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chatvid-'));
const N = spec.parts.length, all = spec.parts.flat();
const beat = (m) => (m.who === 'c' ? 0.7 : 0.3);
const fixed = all.reduce((a, m) => a + beat(m), 0) + N * 0.5 + 2;
const letters = all.reduce((a, m) => a + m.t.length, 0);
const CPS = Math.max(35, letters / Math.max(10, MAX - fixed));   // letters per second (never slower than 35)
(async () => {
  const b = await puppeteer.launch({ executablePath: chrome() });
  const frames = [];   // { f, n } - a picture and how many video frames it stays
  const shot = async (p, n) => { const f = path.join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`); await p.screenshot({ path: f, type: 'jpeg', quality: 90 }); frames.push({ f, n }); };
  for (let i = 0; i < N; i++) {
    const msgs = spec.parts[i];
    const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 });   // a fresh page per part (a second setContent hangs on networkidle)
    await p.setContent(buildHtml({ ...spec, msgs }, { part: `${i + 1}/${N}` }), { waitUntil: 'networkidle0' });
    await p.evaluate(() => document.fonts.ready);
    // the size that fits the WHOLE part; laid out top-down from where the full part sits centred, so nothing moves
    const fsz = await p.evaluate(() => {
      const c = document.getElementById('chat'); let s;
      for (s = 46; s >= 26; s -= 1) { c.style.setProperty('--fs', s + 'px'); c.style.setProperty('--g', Math.round(s * 0.7) + 'px'); if (c.scrollHeight <= c.clientHeight) break; }
      // the bubbles' own height (scrollHeight is never below clientHeight, so it can't centre a short part)
      const rows = c.querySelectorAll('.row'), contentH = rows[rows.length - 1].getBoundingClientRect().bottom - rows[0].getBoundingClientRect().top;
      c.style.justifyContent = 'flex-start'; c.style.boxSizing = 'border-box'; c.style.paddingTop = Math.max(0, (c.clientHeight - contentH) / 2) + 'px';
      const st = document.createElement('style'); st.textContent = '.caret{display:inline-block;width:.08em;height:1em;margin-inline-start:.06em;vertical-align:-.12em;background:currentColor;opacity:.8}'; document.head.appendChild(st);
      window.__full = [...document.querySelectorAll('#chat .row .b')].map((e) => e.textContent);
      document.querySelectorAll('#chat .row').forEach((r) => { r.style.visibility = 'hidden'; });
      return s;
    });
    console.log(`part ${i + 1}/${N}: letters ${fsz}px${fsz < 30 ? ' (small - shorten or split)' : ''}`);
    if (i > 0) await shot(p, 1);   // the new part's empty screen, one frame
    for (let k = 0; k < msgs.length; k++) {
      const len = msgs[k].t.length, nF = Math.max(3, Math.round((len / CPS) * FPS));
      for (let f = 1; f <= nF; f++) {
        const n = Math.round((len * f) / nF), done = f === nF;
        await p.evaluate((k, n, done) => {
          const r = document.querySelectorAll('#chat .row')[k], bb = r.querySelector('.b');
          r.style.visibility = 'visible';
          bb.textContent = window.__full[k].slice(0, n);
          if (!done) { const c = document.createElement('span'); c.className = 'caret'; bb.appendChild(c); }
        }, k, n, done);
        await shot(p, 1);
      }
      let hold = beat(msgs[k]); if (k === msgs.length - 1) hold += i === N - 1 ? 2 : 0.5;
      frames[frames.length - 1].n += Math.round(hold * FPS);
    }
    await p.close();
  }
  await b.close();
  const total = frames.reduce((a, x) => a + x.n, 0) / FPS;
  const list = frames.map((x) => `file '${x.f.replace(/\\/g, '/')}'\nduration ${(x.n / FPS).toFixed(4)}`).join('\n') + `\nfile '${frames[frames.length - 1].f.replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(path.join(tmp, 'list.txt'), list);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'),
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest',
    '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-c:a', 'aac', '-movflags', '+faststart', '-t', total.toFixed(2), out]);   // -t: the repeated last file would add its own hold
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(out, `${Math.round(total)} s, typing ${Math.round(CPS)} letters/s`);
})();
