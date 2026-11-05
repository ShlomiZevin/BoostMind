// Mind CLI - the same tools as the mind MCP server, for a session that doesn't have them (it started before Mind was
// set up on this computer, or MCP isn't connected). Installed by install.mjs into ~/.mind/mind.mjs.
//   node ~/.mind/mind.mjs whoami                          this session's id (newest transcript of this folder)
//   node ~/.mind/mind.mjs overview [project=X]            what's waiting for Shlomi, sessions, open items
//   node ~/.mind/mind.mjs list query=billing              items (status= type= project= query= include_done=true)
//   node ~/.mind/mind.mjs add text="..." type=idea project=Aspect body="..."
//   node ~/.mind/mind.mjs update id=abc123 status=done note="what was done + where"
//   node ~/.mind/mind.mjs report name="Aspect billing bug" state=working summary="..."
//   node ~/.mind/mind.mjs sessions [days=7] | get-session id=... | get id=abc123
// Arguments: key=value pairs, or one JSON object. session_id is filled in by itself (and cwd / computer for report).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = path.join(os.homedir(), '.mind');
const cfg = JSON.parse(fs.readFileSync(path.join(HOME, 'config.json'), 'utf8'));
const [cmd = 'overview', ...rest] = process.argv.slice(2);

// this session = the newest transcript of this folder (~/.claude/projects/<folder as a slug>/<session id>.jsonl)
function whoami() {
  if (process.env.MIND_SESSION) return process.env.MIND_SESSION;
  const slug = process.cwd().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const root = path.join(os.homedir(), '.claude', 'projects');
  let best = null;
  try {
    for (const d of fs.readdirSync(root)) {
      if (d.toLowerCase() !== slug) continue;
      for (const f of fs.readdirSync(path.join(root, d))) {
        if (!f.endsWith('.jsonl')) continue;
        const t = fs.statSync(path.join(root, d, f)).mtimeMs;
        if (!best || t > best.t) best = { t, id: f.slice(0, -6) };
      }
    }
  } catch {}
  return best?.id || '';
}
function project(dir) {
  let d = dir;
  for (let i = 0; i < 12 && d; i++) { if (fs.existsSync(path.join(d, '.git'))) return path.basename(d); const up = path.dirname(d); if (up === d) break; d = up; }
  return path.basename(dir);
}

let args = {};
if (rest[0]?.trim().startsWith('{')) args = JSON.parse(rest.join(' '));
else for (const a of rest) {
  const i = a.indexOf('='); if (i < 1) continue;
  const k = a.slice(0, i), v = a.slice(i + 1);
  args[k] = v === 'true' ? true : v === 'false' ? false : /^(tags|items)$/.test(k) ? v.split(',').map((s) => s.trim()).filter(Boolean) : k === 'days' || k === 'limit' ? +v : v;
}

if (cmd === 'whoami') { console.log(whoami() || '(not found - pass session_id=...)'); process.exit(0); }
const TOOL = { overview: 'mind_overview', list: 'mind_list_items', get: 'mind_get_item', add: 'mind_add_item', update: 'mind_update_item',
  report: 'mind_report_session', sessions: 'mind_list_sessions', 'get-session': 'mind_get_session' }[cmd] || cmd;
if (['mind_add_item', 'mind_update_item', 'mind_report_session'].includes(TOOL) && !args.session_id) args.session_id = whoami();
if (TOOL === 'mind_report_session') { args.cwd ||= process.cwd(); args.machine ||= cfg.machine || os.hostname(); args.project ||= project(process.cwd()); }

const r = await fetch(cfg.url.replace(/\/+$/, '') + '/mcp', { method: 'POST',
  headers: { authorization: 'Bearer ' + cfg.key, 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: TOOL, arguments: args } }) });
const j = await r.json().catch(() => ({}));
if (!r.ok || j.error) { console.error('Mind:', r.status, j.error?.message || JSON.stringify(j)); process.exit(1); }
const out = j.result?.content?.[0]?.text || '';
if (j.result?.isError) { console.error(out); process.exit(1); }
console.log(out);
