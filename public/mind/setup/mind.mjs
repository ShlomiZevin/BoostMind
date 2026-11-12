// Mind CLI - the same tools as the mind MCP server, for a session that doesn't have them. Installed by install.mjs into
// ~/.mind/mind.mjs. Mind is Shlomi's own notebook (since 2026-11-12): write to it ONLY when he tells you to.
//   node ~/.mind/mind.mjs overview [project=X]            what waits for him + open items by project
//   node ~/.mind/mind.mjs list query=billing              items (status= type= project= query= include_done=true)
//   node ~/.mind/mind.mjs get id=abc123                   one item with its timeline
//   node ~/.mind/mind.mjs add text="..." type=idea project=Aspect body="..."      (only when he asks)
//   node ~/.mind/mind.mjs update id=abc123 status=done note="..."                (only when he asks)
// Arguments: key=value pairs, or one JSON object. Hebrew: pass it as a JSON file's content, never typed in the console.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.mind', 'config.json'), 'utf8'));
const [cmd = 'overview', ...rest] = process.argv.slice(2);

let args = {};
if (rest[0]?.trim().startsWith('{')) args = JSON.parse(rest.join(' '));
else for (const a of rest) {
  const i = a.indexOf('='); if (i < 1) continue;
  const k = a.slice(0, i), v = a.slice(i + 1);
  args[k] = v === 'true' ? true : v === 'false' ? false : k === 'tags' ? v.split(',').map((s) => s.trim()).filter(Boolean) : k === 'limit' ? +v : v;
}
const TOOL = { overview: 'mind_overview', list: 'mind_list_items', get: 'mind_get_item', add: 'mind_add_item', update: 'mind_update_item' }[cmd];
if (!TOOL) { console.error('commands: overview | list | get | add | update'); process.exit(1); }

const r = await fetch(cfg.url.replace(/\/+$/, '') + '/mcp', { method: 'POST',
  headers: { authorization: 'Bearer ' + cfg.key, 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: TOOL, arguments: args } }) });
const j = await r.json().catch(() => ({}));
if (!r.ok || j.error) { console.error('Mind:', r.status, j.error?.message || JSON.stringify(j)); process.exit(1); }
const out = j.result?.content?.[0]?.text || '';
if (j.result?.isError) { console.error(out); process.exit(1); }
console.log(out);
