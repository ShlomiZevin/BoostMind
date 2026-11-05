// Mind setup - connects THIS computer's Claude Code to Shlomi's second brain (https://shlomiverse.com/mind/).
//   curl -fsSL https://shlomiverse.com/mind/setup/install.mjs -o mind-install.mjs && node mind-install.mjs --key <key> --machine "<name>"
// Safe to run again (it replaces its own parts, keeps everything else). What it does:
//   1. ~/.mind/config.json (url, key, computer name) + ~/.mind/hook.mjs + ~/.mind/mind.mjs (the CLI)
//   2. hooks in ~/.claude/settings.json (backup next to it) - every session reports itself
//   3. the "mind" skill in ~/.claude/skills/mind/ - how sessions report and read
//   4. a short block in ~/.claude/CLAUDE.md - every session knows Mind exists
//   5. the "mind" MCP server for all projects (claude mcp add --scope user)
// Options: --key (required), --machine (default: this computer's name), --base (default https://shlomiverse.com/mind),
//          --from <folder> (take hook.mjs / SKILL.md from a folder instead of downloading), --uninstall
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes('--' + n);
const BASE = (arg('base', 'https://shlomiverse.com/mind')).replace(/\/+$/, '');
const KEY = arg('key');
const MACHINE = arg('machine', os.hostname());
const FROM = arg('from');
const HOME = os.homedir();
const MIND = path.join(HOME, '.mind');
const CLAUDE = path.join(HOME, '.claude');
const HOOK = path.join(MIND, 'hook.mjs').replace(/\\/g, '/');
const HOOK_MARK = '.mind/hook.mjs';
const say = (s) => console.log('  ' + s);

async function file(name) {
  if (FROM) return fs.readFileSync(path.join(FROM, name), 'utf8');
  const r = await fetch(`${BASE}/setup/${name}?v=${Date.now()}`);
  if (!r.ok) throw new Error(`download ${name}: ${r.status}`);
  return r.text();
}
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

function findClaude() {
  const tries = ['claude'];
  for (const p of [path.join(HOME, '.local', 'bin', 'claude.exe'), path.join(HOME, '.local', 'bin', 'claude'), path.join(HOME, '.claude', 'local', 'claude')]) if (fs.existsSync(p)) tries.push(p);
  for (const ext of [path.join(HOME, '.vscode', 'extensions'), path.join(HOME, '.cursor', 'extensions')]) {
    try {
      for (const d of fs.readdirSync(ext).filter((x) => x.startsWith('anthropic.claude-code-')).sort().reverse()) {
        for (const b of ['claude.exe', 'claude']) { const p = path.join(ext, d, 'resources', 'native-binary', b); if (fs.existsSync(p)) tries.push(p); }
      }
    } catch {}
  }
  for (const t of tries) { try { execFileSync(t, ['--version'], { stdio: 'ignore', timeout: 20000 }); return t; } catch {} }
  return null;
}

// ---------- hooks in settings.json ----------
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'Stop', 'Notification', 'PostToolUse', 'SessionEnd'];
function setHooks(on) {
  const p = path.join(CLAUDE, 'settings.json');
  const s = readJson(p) || {};
  if (fs.existsSync(p)) fs.copyFileSync(p, p + '.before-mind');
  s.hooks ||= {};
  for (const ev of EVENTS) {
    const list = (s.hooks[ev] || []).map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command || '').includes(HOOK_MARK)) })).filter((g) => g.hooks.length);
    if (on) list.push({ ...(ev === 'PostToolUse' ? { matcher: '*' } : {}), hooks: [{ type: 'command', command: `node "${HOOK}" ${ev}`, timeout: 10 }] });
    if (list.length) s.hooks[ev] = list; else delete s.hooks[ev];
  }
  if (!Object.keys(s.hooks).length) delete s.hooks;
  fs.mkdirSync(CLAUDE, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
  say(`hooks ${on ? 'added to' : 'removed from'} ${p}`);
}

// ---------- the CLAUDE.md block ----------
const BLOCK = `<!-- mind:start -->
## Mind - Shlomi's second brain (every session, every project, every computer)
Everything Shlomi has going is tracked at https://shlomiverse.com/mind/ - every idea, to-do, running job and every
Claude session on his computers. Hooks report this session's activity by themselves; you add the meaning with the
\`mind\` MCP tools, as the \`mind\` skill says (load it when you start real work):
- name this session and link it to its item (take it: status active + your session_id) when you start real work;
- any idea / to-do / "later" / "remind me" he mentions -> mind_add_item (search first, tell him in one line);
- a job that keeps running after your turn -> an item of type job; need his decision -> state waiting + question;
- finished -> the item done + a session summary saying where the result is;
- "what's open / what's waiting for me / which session did X" -> mind_overview / mind_list_sessions.
Your session id is in the SessionStart context ("this session's id is ...") and in $MIND_SESSION.
<!-- mind:end -->`;
function setBlock(on) {
  const p = path.join(CLAUDE, 'CLAUDE.md');
  let t = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  t = t.replace(/\n?<!-- mind:start -->[\s\S]*?<!-- mind:end -->\n?/g, '\n').replace(/^\n+/, '');
  if (on) t = (t.trimEnd() ? t.trimEnd() + '\n\n' : '') + BLOCK + '\n';
  fs.writeFileSync(p, t);
  say(`${on ? 'block written to' : 'block removed from'} ${p}`);
}

// ---------- the MCP server ----------
function setMcp(on) {
  const bin = findClaude();
  if (bin) {
    try { execFileSync(bin, ['mcp', 'remove', '--scope', 'user', 'mind'], { stdio: 'ignore', timeout: 30000 }); } catch {}
    if (on) {
      execFileSync(bin, ['mcp', 'add', '--transport', 'http', '--scope', 'user', 'mind', `${BASE}/mcp`, '--header', `Authorization: Bearer ${KEY}`], { stdio: 'ignore', timeout: 30000 });
      say(`MCP server "mind" added for every project (${path.basename(bin)})`);
    } else say('MCP server "mind" removed');
    return;
  }
  // no Claude CLI found: write it into ~/.claude.json directly
  const p = path.join(HOME, '.claude.json');
  const j = readJson(p) || {};
  j.mcpServers ||= {};
  if (on) j.mcpServers.mind = { type: 'http', url: `${BASE}/mcp`, headers: { Authorization: `Bearer ${KEY}` } };
  else delete j.mcpServers.mind;
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
  say(`MCP server "mind" ${on ? 'written into' : 'removed from'} ${p}`);
}

if (has('uninstall')) {
  console.log('Removing Mind from this computer');
  setHooks(false); setBlock(false); setMcp(false);
  fs.rmSync(path.join(CLAUDE, 'skills', 'mind'), { recursive: true, force: true }); say('skill removed');
  console.log('Done. (~/.mind kept - delete it by hand if you want)');
  process.exit(0);
}
if (!KEY) { console.log('Missing --key. Shlomi finds it on https://shlomiverse.com/mind/ under "חיבור מחשב".'); process.exit(1); }

console.log(`Connecting this computer ("${MACHINE}") to Mind`);
// the key works?
const test = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
if (!test.ok) { console.log(`The key was refused (${test.status}). Copy it again from the page.`); process.exit(1); }
say('key ok');

fs.mkdirSync(MIND, { recursive: true });
fs.writeFileSync(path.join(MIND, 'config.json'), JSON.stringify({ url: BASE, key: KEY, machine: MACHINE }, null, 2));
fs.writeFileSync(HOOK, await file('hook.mjs'));
fs.writeFileSync(path.join(MIND, 'mind.mjs'), await file('mind.mjs'));
say(`config + hook + CLI in ${MIND}`);
setHooks(true);
fs.mkdirSync(path.join(CLAUDE, 'skills', 'mind'), { recursive: true });
fs.writeFileSync(path.join(CLAUDE, 'skills', 'mind', 'SKILL.md'), await file('SKILL.md'));
say('skill "mind" installed');
setBlock(true);
setMcp(true);
console.log('\nDone. New Claude Code sessions on this computer report to Mind (running ones: after a restart).');
console.log(`Page: ${BASE}/`);
