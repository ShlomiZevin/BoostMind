#!/bin/bash
# make the game's sounds with ElevenLabs (4 at a time), into the editor's library
cd /c/workspace/BoostMind/zoomcut
P=../scripts/lola-games/pills; A=../public/lola-games/pills/assets/sfx
mk(){ echo "$2" > $P/prompts/sfx/$1.txt; node tools/leonardo.mjs sfx $P/prompts/sfx/$1.txt $A/$1.mp3 $3 --about "$4, for the Lola & Savta pills game" --tags "pills, medicine, game, lola, savta, $5" --project game-lola-pills --kind sound > $P/prompts/sfx/$1.log 2>&1; }
mk place1 "a small plastic pill dropping into a plastic pill organizer compartment, a crisp short click" 0.6 "pill placed click" "click, ui" &
mk place2 "a hard tablet clicking into a small plastic box, short satisfying tick" 0.6 "pill placed click" "click, ui" &
mk place3 "two small pills tapping into a plastic tray, short light clack" 0.6 "pill placed click" "click, ui" &
mk rattle1 "one pill falling into an empty plastic pill bottle, short rattle" 0.7 "pill into bottle" "rattle" &
wait
mk rattle2 "a tablet dropping into a plastic medicine bottle, quick plastic tock" 0.7 "pill into bottle" "rattle" &
mk rattle3 "a capsule falling into a pill bottle with other pills, short rattle" 0.7 "pill into bottle" "rattle" &
mk clear1 "a bright magical sparkle chime, reward, a row cleared in a casual puzzle game" 1.2 "row cleared" "reward, chime" &
mk clear2 "a pill box lid snapping shut followed by a happy short twinkle" 1.2 "row cleared" "reward, chime" &
wait
mk clear3 "a cheerful rising glockenspiel sparkle, puzzle game line clear" 1.2 "row cleared" "reward, chime" &
mk pop1 "a soft bubbly pop, candy match in a mobile game" 0.5 "match pop" "pop" &
mk pop2 "a juicy short pop with a tiny sparkle, mobile match-3" 0.5 "match pop" "pop" &
mk pop3 "a light plastic pop, playful, short" 0.5 "match pop" "pop" &
wait
mk error "a soft comic wrong bonk, gentle, short, not harsh" 0.5 "wrong move" "error" &
mk win "a short cheerful victory jingle, xylophone and strings, cosy family game" 2.5 "level won" "win, jingle" &
mk lose "a short comic sad descending tune, gentle trombone, cosy game" 2 "game over" "lose" &
mk shake "a plastic pill bottle shaken with many pills inside, rattling" 1.2 "pills shaken / mixed" "rattle, shuffle" &
wait
mk combo "a fast rising sparkling arpeggio, combo reward in a puzzle game" 1 "combo" "reward" &
mk swap "a quick soft whoosh of two small things swapping places" 0.4 "swap" "whoosh" &
wait
ls -la $A
