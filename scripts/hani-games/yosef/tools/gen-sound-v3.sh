#!/bin/bash
# sounds for the games added 30 Oct (whack, wind, run, pay, gold) - several variants each, the game never repeats one twice in a row
cd ~/plaxzy-studio && source ~/.plaxzy/leo-env.sh 2>/dev/null
O=/c/workspace/hani-games/yosef/assets/snd; mkdir -p $O
s(){ n=$1; secs=$2; shift 2; node tools/gen.js sfx --game yosef --name $n --secs $secs --prompt "$*" 2>&1 | tail -1; f=$(ls library/sfx/yosef/$n.* 2>/dev/null | head -1); [ -n "$f" ] && cp "$f" $O/; }
s bonk-1 0.5 "cartoon whack-a-mole hit, a cardboard sign bonking a head, funny boing thump, kids game" & s bonk-2 0.5 "comic soft bonk with a springy boing, children's cartoon" & s bonk-3 0.5 "playful cartoon thwack with a tiny bell ding" & wait
s popup-1 0.4 "cartoon pop-up sound, a character popping out of a hole, quick rising pluck" & s popup-2 0.4 "short comic slide-whistle up, quick" & s popup-3 0.4 "bouncy cartoon boing up, short" & wait
s dizzy-1 0.8 "cartoon dizzy stars twinkling after a bonk, tweety birds, short" & s dizzy-2 0.8 "comic sliding down slide-whistle, character sinking back into a hole" & s miss-1 0.3 "soft cardboard swish hitting nothing" & wait
s jump-1 0.4 "cartoon jump boing, light and cheerful" & s jump-2 0.4 "quick springy hop sound, kids game" & s gust-1 1 "short gust of wind whooshing past" & s gust-2 1 "playful wind swirl whoosh" & wait
s thud-1 0.5 "soft cap landing in a truck bed full of pots, light thump with a little metal clink" & s thud-2 0.5 "cloth hat plopping onto metal, gentle" & s splash-1 0.5 "cartoon splash and pot sloshing, oops" & s splash-2 0.5 "comic soup slosh with a small clang" & wait
s card-1 0.4 "payment card tap on a card reader, short beep" & s card-2 0.4 "contactless payment confirm beep, soft" & s card-3 0.4 "cash register small ding" & s paid 1.2 "payment approved happy chime then a soft cash register kaching" & wait
echo SOUND-DONE; ls $O | wc -l
