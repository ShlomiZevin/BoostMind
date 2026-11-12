#!/usr/bin/env bash
# Deploy the Shlomiverse hosting (boostmind-b052c). The live site = exactly what is pushed to git (his rule, 2026-11-12):
# firebase.json's "predeploy" runs scripts/deploy_check.py on EVERY hosting deploy and stops it when this computer is
# behind / ahead of git or public/ has anything not committed. So: commit, git pull --rebase, git push, then this.
# Usage: bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

firebase deploy --only hosting --project boostmind-b052c

cc=$(curl -sI https://boostmind-b052c.web.app/hani-games/ | tr -d '\r' | grep -i '^cache-control:' || true)
case "$cc" in
  *no-cache*) echo "ok: hani-games $cc" ;;
  *) echo "WARNING: hani-games lost its no-cache header ($cc) - check firebase.json headers"; exit 1 ;;
esac
