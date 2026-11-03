#!/usr/bin/env bash
# Publish storage.rules to the Drop's bucket (boostmind-drop, linked to Firebase Storage 2026-11-03). Not through
# `firebase deploy`: the project has no default Firebase bucket, so the CLI refuses - the Rules API takes it directly.
set -euo pipefail
cd "$(dirname "$0")/.."
T=$(gcloud auth print-access-token)
H=(-H "Authorization: Bearer $T" -H "x-goog-user-project: boostmind-b052c" -H "Content-Type: application/json")
BODY=$(node -e "console.log(JSON.stringify({source:{files:[{name:'storage.rules',content:require('fs').readFileSync('storage.rules','utf8')}]}}))")
RS=$(curl -s "${H[@]}" -X POST -d "$BODY" https://firebaserules.googleapis.com/v1/projects/boostmind-b052c/rulesets | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const j=JSON.parse(s);if(!j.name){console.error(s);process.exit(1)}console.log(j.name)})")
REL=projects/boostmind-b052c/releases/firebase.storage/boostmind-drop
curl -s "${H[@]}" -X PATCH -d "{\"release\":{\"name\":\"$REL\",\"rulesetName\":\"$RS\"}}" https://firebaserules.googleapis.com/v1/$REL >/dev/null
echo "storage rules live: $RS"
