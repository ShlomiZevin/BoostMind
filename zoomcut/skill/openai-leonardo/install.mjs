// Installs the OpenAI helper skill on this computer (run once per computer, after git pull):
//   node zoomcut/skill/openai-leonardo/install.mjs
// - links ~/.claude/skills/openai-leonardo to this folder (git keeps both computers the same);
// - the old skill (~/.claude/skills/sol-leonardo, until 2026-11-06) goes to ~/.claude/skills/.trash, and its old script
//   paths stay as tiny forwarders, so commands written with sol-leonardo/scripts/sol.js (other projects, old notes) still work;
// - writes scripts/design.env (the Shlomiverse design key) if it is missing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS = path.join(os.homedir(), '.claude', 'skills');
const link = path.join(SKILLS, 'openai-leonardo'), old = path.join(SKILLS, 'sol-leonardo');
fs.mkdirSync(SKILLS, { recursive: true });

if (!fs.existsSync(path.join(link, 'SKILL.md'))) {
  fs.rmSync(link, { recursive: true, force: true });
  fs.symlinkSync(HERE, link, 'junction');
  console.log('linked', link, '->', HERE);
} else console.log('already linked', link);

if (fs.existsSync(path.join(old, 'SKILL.md'))) {
  const trash = path.join(SKILLS, '.trash', 'sol-leonardo-' + Date.now());
  fs.mkdirSync(path.dirname(trash), { recursive: true });
  fs.renameSync(old, trash);
  console.log('old skill moved to', trash);
}
fs.mkdirSync(path.join(old, 'scripts'), { recursive: true });
for (const [name, to] of [['sol.js', 'openai.js'], ['leo.js', 'leo.js']])
  fs.writeFileSync(path.join(old, 'scripts', name), `// moved: the openai-leonardo skill (2026-11-06) - this only forwards\nrequire(${JSON.stringify(path.join(HERE, 'scripts', to))});\n`);
fs.writeFileSync(path.join(old, 'README.md'), 'Renamed to the openai-leonardo skill (2026-11-06). The scripts here only forward to it.\n');
console.log('old paths forward to the new scripts');

const env = path.resolve(HERE, '..', '..', '..', 'scripts', 'design.env');
if (!fs.existsSync(env)) {
  try { execSync('node scripts/design-env.mjs', { cwd: path.resolve(HERE, '..', '..', '..'), stdio: 'inherit' }); }
  catch { console.log('! could not write scripts/design.env - run: node scripts/design-env.mjs (needs gcloud signed in)'); }
} else console.log('design key present');
console.log('done - start a new Claude session to see the skill');
