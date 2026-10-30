#!/bin/bash
# sounds for יוסף מוקיר שבת via the studio (kept in its library); copies go to assets/snd
cd ~/plaxzy-studio && source ~/.plaxzy/leo-env.sh 2>/dev/null
O=/c/workspace/hani-games/yosef/assets/snd; mkdir -p $O
s(){ n=$1; secs=$2; shift 2; node tools/gen.js sfx --game yosef --name $n --secs $secs --prompt "$*" 2>&1 | tail -1; f=$(ls library/sfx/yosef/$n.* 2>/dev/null | head -1); [ -n "$f" ] && cp "$f" $O/; }
s coin-1 0.5 "single bright coin clink, kids game" & s coin-2 0.5 "cheerful cash register ding, short" & s coin-3 0.5 "soft magical coin collect chime" & s wrong-1 0.6 "soft cartoon wrong answer bonk, gentle, kids game" & wait
s wrong-2 0.6 "gentle low two-note uh-oh on a xylophone" & s pop-1 0.3 "soft cute pop" & s pop-2 0.3 "small bubble pop" & s pop-3 0.3 "light wooden click pop" & wait
s squash-1 0.4 "cartoon bug squish, short and cute, not gross" & s squash-2 0.4 "soft squelch splat, cartoon" & s squash-3 0.4 "tiny comic squish with a little pop" & s tak 0.5 "wooden spoon hitting a hard gem inside a pot, sharp tok" & wait
s ring 2 "modern smartphone ringing, simple marimba ringtone" & s siren 4 "distant gentle city siren rising and falling once, the Friday evening Shabbat siren" & s page-1 0.8 "turning a paper book page" & s page-2 0.8 "soft page flip of a children's book" & wait
s stamp 0.6 "rubber stamp thump on paper" & s win-1 1.6 "happy bright short success jingle with bells, kids game, no voices" & s win-2 1.6 "cheerful short fanfare on xylophone and chimes, no voices" & s whoosh 0.6 "quick soft whoosh swish" & wait
s scrape-1 0.6 "wooden spoon stirring thick stew in a metal pot" & s scrape-2 0.6 "spoon scraping through thick beans and potatoes" & s lid 0.6 "metal pot lid clank" & s gold-1 0.5 "pile of gold coins jingle, short" & s gold-2 0.5 "gold coin drop clink sparkle" & wait
echo SOUND-DONE; ls $O
