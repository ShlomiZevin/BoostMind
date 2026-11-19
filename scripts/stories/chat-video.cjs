// A LONG chat as a story video (his ask, 2026-11-19: "it's long - make a movie of it, with numbers, enough time to read"):
// the conversation in numbered parts (1/5, 2/5 ... beside the date), each part's bubbles appearing one by one and staying
// on screen long enough to read. Same look as chat-poster.cjs (the chat-story skill says how a chat is picked and cleaned).
//   node scripts/stories/chat-video.cjs spec.json out.mp4
// spec = a chat-poster spec, but "parts": [ [msgs of part 1], [msgs of part 2], ... ] instead of "msgs".
// Reading time per new bubble: 1.4 s + 1 s per 13 letters; the last bubble of a part +1.5 s, the very end +2.5 s.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { buildHtml, chrome, puppeteer } = require('./chat-poster.cjs');
const [specFile, out] = process.argv.slice(2);
if (!specFile || !out) { console.error('usage: chat-video.cjs spec.json out.mp4'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chatvid-'));
const readT = (t) => 1.4 + t.replace(/\s+/g, '').length / 13;
(async () => {
  const b = await puppeteer.launch({ executablePath: chrome() });
  const frames = [], N = spec.parts.length;
  for (let i = 0; i < N; i++) {
    const msgs = spec.parts[i];
    const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 });   // a fresh page per part (a second setContent hangs on networkidle)
    await p.setContent(buildHtml({ ...spec, msgs }, { part: `${i + 1}/${N}` }), { waitUntil: 'networkidle0' });
    await p.evaluate(() => document.fonts.ready);
    // the size that fits the WHOLE part, then the bubbles laid out top-down from where the full part sits centred - so
    // nothing moves when the next bubble appears
    const fsz = await p.evaluate(() => {
      const c = document.getElementById('chat'); let s;
      for (s = 46; s >= 26; s -= 1) { c.style.setProperty('--fs', s + 'px'); c.style.setProperty('--g', Math.round(s * 0.7) + 'px'); if (c.scrollHeight <= c.clientHeight) break; }
      const pad = Math.max(0, (c.clientHeight - c.scrollHeight) / 2);
      c.style.justifyContent = 'flex-start'; c.style.paddingTop = pad + 'px'; c.style.boxSizing = 'border-box';
      return s;
    });
    console.log(`part ${i + 1}/${N}: letters ${fsz}px${fsz < 30 ? ' (small - shorten or split)' : ''}`);
    for (let k = 1; k <= msgs.length; k++) {
      await p.evaluate((k) => document.querySelectorAll('#chat .row').forEach((r, j) => { r.style.visibility = j < k ? 'visible' : 'hidden'; }), k);
      const f = path.join(tmp, `f${String(frames.length).padStart(3, '0')}.png`);
      await p.screenshot({ path: f });
      let d = readT(msgs[k - 1].t);
      if (k === msgs.length) d += i === N - 1 ? 2.5 : 1.5;
      frames.push({ f, d: Math.round(d * 10) / 10 });
    }
    await p.close();
  }
  await b.close();
  // concat list (the last file repeated: the concat demuxer ignores the last duration otherwise)
  const list = frames.map((x) => `file '${x.f.replace(/\\/g, '/')}'\nduration ${x.d}`).join('\n') + `\nfile '${frames[frames.length - 1].f.replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(path.join(tmp, 'list.txt'), list);
  const total = frames.reduce((a, x) => a + x.d, 0);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'),
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest',
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-c:a', 'aac', '-movflags', '+faststart', '-t', total.toFixed(2), out]);   // -t: the repeated last file would add its own long hold
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(out, `${frames.length} steps, ${Math.round(total)} s`);
})();
