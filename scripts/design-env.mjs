// Writes scripts/design.env (git-ignored) with the Shlomiverse design key from Secret Manager - the key every design /
// session script uses (mockups, copy, stories, Mind art...), so Backstage -> הוצאות shows its spend apart from Aspect's.
// Run once per computer:  node scripts/design-env.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const f = path.join(path.dirname(fileURLToPath(import.meta.url)), 'design.env');
const secret = (name) => execSync(`gcloud secrets versions access latest --secret=${name} --project=boostmind-b052c`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
// + the Shlomiverse's Anthropic key (Console key "Shlomiverse", 2026-11-12) - Sonnet in the characters' chain
fs.writeFileSync(f, `OPENAI_API_KEY=${secret('VERSE_DESIGN_OPENAI_KEY')}\nANTHROPIC_API_KEY=${secret('VERSE_ANTHROPIC_KEY')}\n`, { mode: 0o600 });
console.log('written', f);
