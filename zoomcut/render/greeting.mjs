// Personal greetings in the studio (his ask, 2026-11-19 - plan greeting-send; recipe skill/edit-video/recipes/greeting.md).
// A project whose episode.json has "greeting" ({char, request, for, event, date}) is NOT a video of the resident's life:
// it never goes to the socials or to the Shlomiverse's videos (publish.mjs and verse.mjs refuse it). Send shows the
// greeting's own steps instead, every one a button he presses:
//   1. make   (exports first when needed) scripts/greetings/greet.cjs add -> its private page shlomiverse.com/greeting/<gid>,
//             then the video to his Telegram (to post as a story) with the page's link
//   2. test   greet.cjs send <gid> --test - the email to his own inbox, to see it as the person will
//   3. send   greet.cjs send <gid> --yes - to the person who asked: his click IS the approval
// State: episodes/<id>/greeting-out.json {gid, url, made, tested, sent, pending}. A new "make" after a new export makes a new
// page (the person gets the newest one).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { sendTelegram, sendTelegramText, sizedCopy } from './share.mjs';

export function startGreetings({ ROOT, app, epDir, readJson, writeJson, recordJob, isStale, saved }) {
  const BM = path.resolve(ROOT, '..'), GREET = process.env.ZC_GREET || path.join(BM, 'scripts', 'greetings', 'greet.cjs');
  const TEST = !!process.env.ZC_GREET;  // (a test: a stand-in greet.cjs, nothing to his Telegram)
  const runs = {};  // id -> {step, started, log, running, ok, error}
  const greetingOf = (id) => readJson(path.join(epDir(id), 'episode.json'), {}).greeting || null;
  const outFile = (id) => path.join(epDir(id), 'greeting-out.json');
  const master = (id) => path.join(epDir(id), 'out', `${id}.mp4`);
  const stateOf = (id) => readJson(outFile(id), {});
  const setState = (id, s) => { writeJson(outFile(id), { ...stateOf(id), ...s }); saved?.(id); };

  const greet = (args, log) => new Promise((ok, fail) => {
    const p = spawn('node', [GREET, ...args], { cwd: BM, windowsHide: true });
    let out = '';
    const take = (d, mine) => { if (mine) out += d; for (const l of String(d).split(/\r?\n/)) if (l.trim()) log.push(l.trim()); };
    p.stdout.on('data', (d) => take(d, true)); p.stderr.on('data', (d) => take(d, false));  // (parsed: stdout only - a warning on stderr never reads as the id)
    p.on('close', (c) => (c ? fail(new Error(log.at(-1) || `greet.cjs ${args[0]} failed`)) : ok(out)));
    p.on('error', fail);
  });

  async function step(id, which) {
    const g = greetingOf(id);
    const r = (runs[id] = { step: which, started: Date.now(), log: [], running: true });
    try {
      if (which === 'make') {
        if (!fs.existsSync(master(id))) throw new Error('Export the greeting first');
        const args = ['add', '--video', master(id), '--char', g.char];
        if (g.request) args.push('--request', g.request);
        if (g.for) args.push('--for', g.for);
        if (g.event) args.push('--event', g.event);
        const out = await greet(args, r.log);
        const gid = (out.match(/^greeting (\S+)\s*$/m) || [])[1], url = (out.match(/^https:\/\/\S+\/greeting\/\S+/m) || [])[0];
        if (!gid || !url) throw new Error('greet.cjs gave no greeting id');
        setState(id, { gid, url, made: Date.now(), tested: null, sent: null, pending: false });
        r.log.push('Sending it to your Telegram…');
        const file = await sizedCopy(master(id), 'telegram', () => {});
        // (his rule, 2026-11-19: never on our story before the person it's for has seen it - the requester presses "shown"
        // on the greeting page and he gets a Telegram then)
        if (!TEST) await sendTelegram({ file, caption: `💌 Greeting for ${g.for || 'them'} - for your story, but NOT yet: wait until they mark it shown on the page (you'll get a Telegram)\n${url}\nWhen it's good: Studio → Send → "Send to ${g.for || 'them'}"` });
        r.log.push(`✔ ${url} · in your Telegram`);
      } else if (which === 'test' || which === 'send') {
        const { gid } = stateOf(id);
        if (!gid) throw new Error('Make the greeting first');
        await greet(['send', gid, which === 'test' ? '--test' : '--yes'], r.log);
        setState(id, which === 'test' ? { tested: Date.now() } : { sent: Date.now() });
        if (which === 'send' && !TEST) await sendTelegramText(`💌 The greeting went to ${g.for || 'the person who asked'} ✓\n${stateOf(id).url}`).catch(() => {});
      } else throw new Error('unknown step');
      Object.assign(r, { running: false, ok: true });
    } catch (e) {
      Object.assign(r, { running: false, ok: false, error: String(e.message || e).slice(0, 300) });
      if (which === 'make') setState(id, { pending: false });
    }
    recordJob({ id, kind: 'greeting', channel: which, started: r.started, ended: Date.now(), ok: r.ok, line: r.ok ? r.log.at(-1) : r.error });
  }

  app.get('/api/ep/:id/greeting', (q, res) => {
    const id = q.params.id, g = greetingOf(id);
    if (!g) return res.json({ greeting: null });
    let file = null;
    try { const st = fs.statSync(master(id)); file = { exported: st.mtimeMs, stale: !!isStale(id) }; } catch {}
    res.json({ greeting: g, state: stateOf(id), run: runs[id] || null, file });
  });
  // {step: 'make' | 'test' | 'send'}; {step: 'make', afterExport: true} = make it when the export he just started ends
  app.post('/api/ep/:id/greeting', (q, res) => {
    const id = q.params.id, which = String(q.body?.step || '');
    if (!greetingOf(id)) return res.status(400).json({ error: 'Not a greeting (episode.json has no "greeting")' });
    if (runs[id]?.running) return res.status(409).json({ error: 'Already working on this greeting' });
    if (which === 'make' && q.body?.afterExport) { setState(id, { pending: true }); return res.json({ saved: true }); }
    if (which === 'send' && stateOf(id).sent && !q.body?.again) return res.status(409).json({ error: 'Already sent to them' });
    step(id, which);
    res.json({ run: runs[id] });
  });

  return {
    isGreeting: (id) => !!greetingOf(id),
    // an export ended well: the greeting he asked for is made now (a quick draft never)
    afterExport(id, quick) { if (!quick && greetingOf(id) && stateOf(id).pending) step(id, 'make'); },
    running: () => Object.entries(runs).filter(([, r]) => r.running).map(([id, r]) => ({ id, kind: 'greeting', channel: r.step, started: r.started, log: r.log.slice(-5) })),
  };
}
