cd "$(dirname "$0")"; Z=../../../../zoomcut
i=0
while IFS='|' read -r n kind secs prompt; do
  [ -f "$n.mp3" ] && continue
  echo "$prompt" > "p-$n.txt"
  (cd $Z && node tools/leonardo.mjs $kind "../scripts/night-guy-games/garden/sfx/p-$n.txt" "../scripts/night-guy-games/garden/sfx/$n.mp3" $secs --about "$n sound for the Garden Psychopath game" --tags "night-guy, game, sound, $n" --project game-garden --kind sound > "../scripts/night-guy-games/garden/sfx/log-$n.txt" 2>&1) &
  i=$((i+1)); [ $((i%4)) -eq 0 ] && wait
done < list.txt
wait
cd $Z && node tools/elevenlabs_music.mjs ../scripts/night-guy-games/garden/sfx/music.mp3 60 "playful creepy-cute night music loop for a mobile game, pizzicato strings, music box, soft bass, sneaky and comedic, seamless loop, instrumental" --about "music loop for the Garden Psychopath game" --tags "night-guy, game, music, creepy, cute" --project game-garden > ../scripts/night-guy-games/garden/sfx/log-music.txt 2>&1
echo ALLDONE
