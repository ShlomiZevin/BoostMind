#!/usr/bin/env bash
# Run before EVERY hosting deploy from this repo (scripts/deploy.sh does it for you). The work is in
# hani_games_pull.py: it brings the newest Hani game files from the live site into public/hani-games/<slug>/,
# downloading only what changed since the last pull.
#   bash scripts/hani_games_pull.sh
set -euo pipefail
cd "$(dirname "$0")/.."
python scripts/hani_games_pull.py
