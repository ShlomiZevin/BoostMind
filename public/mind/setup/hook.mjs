// Mind hook - every Claude Code session on this computer reports itself to Shlomi's second brain
// (https://shlomiverse.com/mind/). Installed by install.mjs into ~/.mind/hook.mjs and wired into ~/.claude/settings.json:
//   SessionStart       -> tells the session its id (context line + MIND_SESSION env) and registers it
//   UserPromptSubmit   -> "working", with what he asked
//   Stop               -> "your turn", with the last thing Claude said
//   Notification       -> "needs you" (a permission prompt)
//   PostToolUse        -> back to "working" after a permission (only sends when the last state was "needs")
//   SessionEnd         -> "ended"
// Never slows a session: the network call runs in a detached child process, and any error is swallowed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOME = path.join(os.homedir(), '.mind');
const STATE = path.join(HOME, 'state');
const cfg = () => { try { return JSON.parse(fs.readFileSync(path.join(HOME, 'config.json'), 'utf8')); } catch { return null; } };

// the child: send one report, then exit
if (process.argv[2] === '--send') {
  const c = cfg();
  try {
    const body = Buffer.from(process.argv[3], 'base64').toString('utf8');
    if (c?.key) await fetch(c.url.replace(/\/+$/, '') + '/hook', { method: 'POST', body, signal: AbortSignal.timeout(15000),
      headers: { authorization: 'Bearer ' + c.key, 'content-type': 'application/json' } });
  } catch {}
  process.exit(0);
}

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch {}
let input = {};
try { input = JSON.parse(raw || '{}'); } catch {}
const ev = input.hook_event_name || process.argv[2];
const sid = input.session_id;
const c = cfg();
if (!sid || !c?.key) process.exit(0);

// the project = the git root's folder name (else the folder itself)
function project(dir) {
  let d = dir;
  for (let i = 0; i < 12 && d; i++) {
    if (fs.existsSync(path.join(d, '.git'))) return path.basename(d);
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  return path.basename(dir || '') || '';
}
// the last words Claude said this turn (from the transcript's tail)
function lastReply(file) {
  if (input.last_assistant_message) return String(input.last_assistant_message);
  try {
    const st = fs.statSync(file), n = Math.min(st.size, 400000), fd = fs.openSync(file, 'r'), buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, st.size - n); fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n').reverse();
    for (const l of lines) {
      if (!l.includes('"assistant"')) continue;
      try {
        const j = JSON.parse(l);
        if (j.type !== 'assistant') continue;
        const t = (j.message?.content || []).filter((p) => p.type === 'text').map((p) => p.text).join('\n').trim();
        if (t) return t;
      } catch {}
    }
  } catch {}
  return '';
}
// what he typed, without the blocks tools add to a prompt (<ide_selection>, <browser_instruction>, <system-reminder>...)
const untag = (t) => String(t || '').replace(/<([a-zA-Z_-]+)[^>]*>[\s\S]*?<\/\1>/g, ' ').trim();
const stateFile = path.join(STATE, sid.replace(/[^\w-]/g, '_'));
const lastState = () => { try { return fs.readFileSync(stateFile, 'utf8'); } catch { return ''; } };
const remember = (s) => { try { fs.mkdirSync(STATE, { recursive: true }); fs.writeFileSync(stateFile, s); } catch {} };

const cwd = input.cwd || process.cwd();
const report = { event: ev, session_id: sid, cwd, project: project(cwd), machine: c.machine || os.hostname() };
let send = true;
if (ev === 'SessionStart') {
  report.source = input.source;
  if (process.env.CLAUDE_ENV_FILE) try { fs.appendFileSync(process.env.CLAUDE_ENV_FILE, `export MIND_SESSION=${sid}\n`); } catch {}
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart',
    additionalContext: `Mind (Shlomi's second brain, https://shlomiverse.com/mind/): this session's id is ${sid}. Report to it with the mind MCP tools as the "mind" skill says (session_id = ${sid}).` } }));
  remember('new');
} else if (ev === 'UserPromptSubmit') { report.prompt = untag(input.prompt).slice(0, 600); remember('working'); }
else if (ev === 'Stop') { report.reply = lastReply(input.transcript_path).slice(-900); remember('waiting'); }
else if (ev === 'Notification') {
  const msg = String(input.message || '');
  if (!/permission|approv|אישור/i.test(msg) && input.notification_type !== 'permission_prompt') send = false;
  else { report.message = msg; remember('needs'); }
} else if (ev === 'PostToolUse') {
  if (lastState() !== 'needs') send = false;
  else { report.event = 'Resumed'; remember('working'); }
} else if (ev === 'SessionEnd') { report.reason = input.reason; remember('ended'); }
else send = false;

if (send) {
  try {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--send', Buffer.from(JSON.stringify(report)).toString('base64')],
      { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
  } catch {}
}
process.exit(0);
