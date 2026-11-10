#!/bin/bash
# two candidates per sound, Leonardo sfx (ElevenLabs out of credits)
cd /c/workspace/BoostMind/zoomcut
D=/c/workspace/BoostMind/scripts/yotam-games/deadlock/sfx2
secs(){ case $1 in bump*|honk*|pick|window*) echo 1;; slide*) echo 2;; gate|start) echo 4;; win) echo 2;; esac; }
for f in $D/p/*.txt; do n=$(basename $f .txt); s=$(secs $n)
  for k in a b; do [ -f $D/raw/$n-$k.mp3 ] && continue
    ( node tools/leonardo.mjs sfx $f $D/raw/$n-$k.mp3 $s --leonardo --about "$(cat $f), for the Yotam Deadlock game" --tags "yotam,techy-tech,parking,car,sfx,game" --project game-deadlock > $D/raw/$n-$k.log 2>&1 ) || sleep 5
  done
done
wait; ls $D/raw/*.mp3 | wc -l
