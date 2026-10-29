#!/usr/bin/env bash
# Run before EVERY hosting deploy from this repo: the Hani games are released by another session (on another
# machine) straight onto the live site - it clones the live version and adds /hani-games/<slug>/ - so this folder
# never has its newest game files, and a deploy from public/ would put old copies back.
# This downloads every file of every game folder in the current live release into public/hani-games/<slug>/.
# The site page itself (index.html, img/, audio/, video/, sounds/) is ours and is never pulled.
#   bash scripts/hani_games_pull.sh
set -euo pipefail
cd "$(dirname "$0")/.."
T=$(gcloud auth print-access-token)
API=https://firebasehosting.googleapis.com/v1beta1
H=(-H "Authorization: Bearer $T" -H "x-goog-user-project: boostmind-b052c")
V=$(curl -s "${H[@]}" "$API/sites/boostmind-b052c/releases?pageSize=1" | python -c "import sys,json; print(json.load(sys.stdin)['releases'][0]['version']['name'])" | tr -d '\r')
echo "live: $V"
list=$(mktemp); tok=""
while :; do
  r=$(curl -s "${H[@]}" "$API/$V/files?pageSize=1000&pageToken=$tok")
  echo "$r" | python -c "import sys,json; [print(f['path']) for f in json.load(sys.stdin).get('files',[])]" | tr -d '\r' >> "$list"
  tok=$(echo "$r" | python -c "import sys,json; print(json.load(sys.stdin).get('nextPageToken',''))" | tr -d '\r')
  [ -z "$tok" ] && break
done
n=0; changed=0
while read -r p; do
  case "$p" in /hani-games/*/*) ;; *) continue ;; esac
  case "$p" in /hani-games/img/*|/hani-games/audio/*|/hani-games/video/*|/hani-games/sounds/*) continue ;; esac
  f="public$p"; mkdir -p "$(dirname "$f")"
  tmp=$(mktemp); curl -sf "https://boostmind-b052c.web.app$p" -o "$tmp" || { echo "FAIL $p"; rm -f "$tmp"; continue; }
  if [ ! -f "$f" ] || ! cmp -s "$tmp" "$f"; then mv "$tmp" "$f"; changed=$((changed+1)); echo "updated $p"; else rm -f "$tmp"; fi
  n=$((n+1))
done < "$list"
rm -f "$list"
echo "game files: $n checked, $changed updated"
