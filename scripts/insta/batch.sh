#!/usr/bin/env bash
# Prepare the next N reels for the wiki (reel.py on each), newest first, skipping every reel state.json already knows.
#   bash scripts/insta/batch.sh [N=10] [MIN_LIKES=1000] [BEFORE=2026-10-17] [AFTER=]
#   e.g. recent ones even under 1,000 likes:  bash scripts/insta/batch.sh 10 0 2026-10-17 2026-06-01
# The reel list is scripts/insta/work/media.json (node scripts/insta/list.mjs refreshes it - new reels, new likes).
# Prepared ids land in scripts/insta/work/batch-ids.txt; then the skill's steps (who / ask / to_wiki / copy / push).
cd "$(dirname "$0")/../.." || exit 1
N=${1:-10}; MIN=${2:-1000}; BEFORE=${3:-2026-10-17}; AFTER=${4:-}
IDS=scripts/insta/work/batch-ids.txt; TRIED=scripts/insta/work/batch-tried.txt; : > $IDS; : > $TRIED; done_n=0
for i in $(seq 1 $((N * 3))); do
  id=$(PYTHONIOENCODING=utf8 python -c "
import json
s=json.load(open('scripts/insta/state.json',encoding='utf8'))
m=json.load(open('scripts/insta/work/media.json',encoding='utf8'))
skip=set(open('$TRIED').read().split())
c=[x for x in m if '$AFTER'<=x.get('timestamp','')<'$BEFORE' and x['id'] not in s and x['id'] not in skip
   and x.get('media_product_type')=='REELS' and (x.get('like_count') or 0)>=$MIN]
c.sort(key=lambda x:x['timestamp'],reverse=True); print(c[0]['id'] if c else '')")
  [ -z "$id" ] && break
  out=$(PYTHONIOENCODING=utf8 zoomcut/.venv/Scripts/python scripts/insta/reel.py $id 2>&1 | tail -4)
  echo "== $id $(echo "$out" | grep -E 'TWIN|NO FILE|total|Error' | head -1)"
  echo $id >> $TRIED
  if echo "$out" | grep -q "total"; then echo $id >> $IDS; done_n=$((done_n+1)); fi
  [ $done_n -ge $N ] && break
done
echo FINISHED $done_n
