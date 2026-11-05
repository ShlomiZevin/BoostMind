#!/usr/bin/env bash
# Every automated test of the Shlomiverse's server side, in one go (his ask, 2026-11-05: "make tests to make sure
# everything works right"). Run it before deploying techietech-api, and after changing the chat, stories or mail:
#   bash scripts/test.sh            the quick ones + the emulator ones (a few minutes; nothing live is touched)
#   bash scripts/test.sh --quick    only the quick ones (no emulators)
# The emulator tests run on project demo-shlomiverse (v2/firebase.json). Before them: nothing heavy running - Sketch
# Studio's /api/jobs `busy` must be empty (one heavy job at a time). The chat replies need an OpenAI key: taken from
# aspect-agent-server/.env, as v2/dev.mjs does, and never printed.
set -eo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "== quick"
node techietech-api/test/mailer.test.cjs
node techietech-api/test/unsubscribe.test.cjs
node -e "require('./techietech-api/index.js'); console.log('functions load')"
[ "$1" = "--quick" ] && exit 0

if curl -s --max-time 2 localhost:4747/api/jobs | grep -q '"busy":\[[^]]'; then echo "Sketch Studio is busy - run the emulator tests later"; exit 1; fi
KEY=$(grep -h "^OPENAI_API_KEY=" /c/workspace/aspect/aspect-agent-server/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"\r')
export VERSE_OPENAI_KEY="$KEY" WIKI_OPENAI_KEY="$KEY"
export JAVA_HOME="${USERPROFILE:-$HOME}/.local/jre21" PATH="${USERPROFILE:-$HOME}/.local/jre21/bin:$PATH"
cd v2
echo "== the chat's limits and bring-a-friend (emulators)"
firebase emulators:exec --project demo-shlomiverse --only auth,firestore,functions "node ../techietech-api/test/chat-quota.emu.cjs" 2>&1 | grep -E "^ok|FAILED|all good|^\(no|Error"
echo "== a video story, posted and watched (emulators)"
firebase emulators:exec --project demo-shlomiverse --only auth,firestore,functions,storage "node ../techietech-api/test/story-video.emu.mjs" 2>&1 | grep -E "^ok|FAILED|all good|^no viewer|Error"
echo "== an idea's way: liked / live, the writer and the voters told (emulators)"
firebase emulators:exec --project demo-shlomiverse --only auth,firestore,functions "node ../techietech-api/test/idea-status.emu.mjs" 2>&1 | grep -E "^ok|FAILED|all good|Error"
echo "== the video catalog: publish, keep, hide (emulators)"
firebase emulators:exec --project demo-shlomiverse --only auth,firestore,functions,storage "node ../techietech-api/test/publish.emu.mjs" 2>&1 | grep -E "^ok|FAILED|all good|Error"
