#!/bin/sh
# Rebuilds public/firebase.js from the pinned versions in package.json.
cd "$(dirname "$0")" && npm ci --silent && npx esbuild entry.js --bundle --format=esm --minify --target=es2020 --legal-comments=none --outfile=../public/firebase.js
