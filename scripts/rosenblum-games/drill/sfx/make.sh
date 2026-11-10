cd /c/workspace/BoostMind-drill
D=scripts/rosenblum-games/drill/sfx; O=public/rosenblum-games/drill/assets/sfx
n=0
while IFS=$'\t' read -r name kind secs prompt; do
  printf '%s' "$prompt" > $D/$name.txt
  node zoomcut/tools/leonardo.mjs $kind $D/$name.txt $D/$name.mp3 $secs --about "$prompt, for the Rosenblum shelter-drill game" --tags "rosenblum, school, shelter drill, game sound, game-drill" --project game-drill > $D/$name.log 2>&1 &
  n=$((n+1)); if [ $((n%4)) -eq 0 ]; then wait; fi
done < $D/list.tsv
wait
node zoomcut/tools/elevenlabs_music.mjs $D/music.mp3 60 "Light comedic marching tune for a school drill video game, playful woodwinds, snare drum, pizzicato strings, bouncy and a bit pompous, loopable, instrumental" --about "background music for the Rosenblum shelter-drill game" --tags "rosenblum, music, comedic march, game-drill" --project game-drill > $D/music.log 2>&1
ls $D/*.mp3 | wc -l
