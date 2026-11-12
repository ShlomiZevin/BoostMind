#!/usr/bin/env bash
# Deploy the Shlomiverse hosting (boostmind-b052c) in one step, safely:
#   1. pull Hani's games from live (they are released from another machine - see scripts/hani_games_pull.sh)
#   2. bring from live every site file git never holds that this computer lacks (his face, videos, sounds - a deploy
#      from the other computer dropped ~850 of them on 2026-11-12; scripts/live_ignored_pull.py)
#   3. deploy hosting
#   4. check the games still get Cache-Control: no-cache
# Usage: bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/hani_games_pull.sh
python scripts/live_ignored_pull.py
firebase deploy --only hosting --project boostmind-b052c

cc=$(curl -sI https://boostmind-b052c.web.app/hani-games/ | tr -d '\r' | grep -i '^cache-control:' || true)
case "$cc" in
  *no-cache*) echo "ok: hani-games $cc" ;;
  *) echo "WARNING: hani-games lost its no-cache header ($cc) - check firebase.json headers"; exit 1 ;;
esac
