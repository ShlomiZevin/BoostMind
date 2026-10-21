#!/bin/sh
# Saves the agent + crew to Lybi (new version, not published) and moves it into the "Shlomi" folder.
B=https://aspect-agent-server-1018338671074.europe-west1.run.app
cd "$(dirname "$0")"
curl -s -X POST $B/builder/mcp/agents/shlomi-cycle-test -H 'content-type: application/json; charset=utf-8' --data-binary @post-agent.json; echo
curl -s -X POST $B/builder/mcp/agents/shlomi-cycle-test/crews/crew_jz05s4n3yqvm -H 'content-type: application/json; charset=utf-8' --data-binary @post-crew.json; echo
curl -s -X PATCH $B/api/builder/agents/agent_f2xdf96dyqvl -H 'content-type: application/json' -d '{"workspaceId":"ws_8bhctox2mqhlzb43"}'; echo
