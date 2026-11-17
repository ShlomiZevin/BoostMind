// His owner key for the session tools (Backstage plans, events, stories, character notes, chat notes) - found by itself,
// so a session never asks him for it (his ask, 2026-11-17: "I don't want them to ask me for the key - just put it").
// Where: OWNER_KEY in the environment, else scripts/design.env (git-ignored - the repo is public, the key never goes in
// git), else Secret Manager VERSE_OWNER_KEY (if it exists - then written into design.env for next time).
// A new computer: node scripts/design-env.mjs writes design.env, the owner key included when the secret exists.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENV = path.join(path.dirname(fileURLToPath(import.meta.url)), 'design.env');

export function ownerKey() {
  if (process.env.OWNER_KEY) return process.env.OWNER_KEY.trim();
  try {
    const m = fs.readFileSync(ENV, 'utf8').match(/^OWNER_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  try {
    const k = execSync('gcloud secrets versions access latest --secret=VERSE_OWNER_KEY --project=boostmind-b052c', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (k) {
      try { fs.appendFileSync(ENV, `OWNER_KEY=${k}\n`, { mode: 0o600 }); } catch {}
      return k;
    }
  } catch {}
  return '';
}
