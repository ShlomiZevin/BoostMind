#!/bin/bash
# usage: bash run-jobs.sh [filter-regex]  - runs jobs.txt lines (6 at a time) through oai-image.js, skips done ones
W=/c/workspace/BoostMind-meetings/scripts/techytech-games/meetings
cd /c/workspace/BoostMind/zoomcut
one() {
  IFS='|' read -r name model q size refs tr pf <<< "$1"
  out=$W/art/$name.png
  [ -s "$out" ] && [ -z "$FORCE" ] && { echo "skip $name"; return; }
  args=(--prompt-file "$pf" --out "$out" --model "$model" --quality "$q" --size "$size")
  [ -n "$refs" ] && for r in ${refs//,/ }; do args+=(--ref "$r"); done
  [ "$tr" = 1 ] && args+=(--transparent)
  node skill/marketing-stories/tools/oai-image.js "${args[@]}" > $W/art/$name.log 2>&1 && echo "ok $name" || { echo "FAIL $name"; tail -1 $W/art/$name.log; }
}
export -f one; export W FORCE
grep -E "${1:-.}" $W/jobs.txt | xargs -P 6 -I{} bash -c 'one "$@"' _ {}
