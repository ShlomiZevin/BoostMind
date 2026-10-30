#!/usr/bin/env bash
# Release a coming-soon game on Hani's games hub: bash scripts/hani_games_release.sh <slug>
# Pulls the games session's live files first (so nothing goes back), flips only that game's game.json to
# "status": "live", deploys hosting and checks the live file. Run only on Shlomi's go.
set -euo pipefail
cd "$(dirname "$0")/.."
slug="${1:?usage: hani_games_release.sh <slug>}"
f="public/hani-games/$slug/game.json"
bash scripts/hani_games_pull.sh | tail -1
[ -f "$f" ] || { echo "no $f"; exit 1; }
python -X utf8 - "$f" <<'PY'
import json, sys
p = sys.argv[1]; g = json.load(open(p, encoding='utf-8'))
print('was:', g.get('status')); g['status'] = 'live'
open(p, 'w', encoding='utf-8').write(json.dumps(g, ensure_ascii=False, indent=2) + '\n')
PY
firebase deploy --only hosting --project boostmind-b052c | grep -i "deploy complete\|error"
for i in 1 2 3 4 5 6; do   # the new release can take a few seconds to reach the edge
  curl -s "https://boostmind-b052c.web.app/hani-games/$slug/game.json?v=$RANDOM" | grep -q '"status": *"live"' && { echo "LIVE: https://boostmind-b052c.web.app/hani-games/$slug/"; exit 0; }
  sleep 5
done
echo "deployed, but the live game.json does not say live yet - check it"; exit 1
