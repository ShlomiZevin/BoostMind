#!/usr/bin/env bash
# Deploy the Shlomiverse hosting (boostmind-b052c) in one step:
#   1. deploy hosting - firebase.json's "predeploy" runs first, on EVERY hosting deploy (this script, a bare
#      `firebase deploy --only hosting`, either computer, any session):
#        scripts/hani_games_pull.py  - Hani's games, released from another machine straight onto live
#        scripts/site_files_guard.py - the site files git never holds (his face, videos, sounds): backed up to
#          gs://shlomiverse-private/site-files/, the missing ones brought here, and a stop if the deploy would still take
#          files off the live site (a deploy from the other computer dropped ~850 of them on 2026-11-12)
#   2. check the games still get Cache-Control: no-cache
# Usage: bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

firebase deploy --only hosting --project boostmind-b052c

cc=$(curl -sI https://boostmind-b052c.web.app/hani-games/ | tr -d '\r' | grep -i '^cache-control:' || true)
case "$cc" in
  *no-cache*) echo "ok: hani-games $cc" ;;
  *) echo "WARNING: hani-games lost its no-cache header ($cc) - check firebase.json headers"; exit 1 ;;
esac
