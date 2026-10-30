#!/bin/bash
# play art for יוסף מוקיר שבת: square scene backgrounds + transparent object sprites, same simple book style
cd ~/plaxzy-studio && source ~/.plaxzy/leo-env.sh 2>/dev/null
A=/c/workspace/hani-games/yosef/art; REF=$A/pages/p01.jpg
ST='VERY simple children'"'"'s picture book drawing for little Haredi kids, the Bnei Brak storybook look: thick soft dark outlines, flat bright colors, no shading, no textures, cute and friendly. No text, no letters, no numbers.'
SP="A single object sticker, $ST Isolated on a transparent background, centered, filling the frame, nothing else."
bgp(){ n=$1; shift; [ -f $A/play/$n.jpg ] && return; node tools/gen.js image --model flare --quality HIGH --kind background --game yosef --name play-$n --size square --reference $REF --strength LOW --prompt "Background scene for a game screen, $ST Empty of people, calm, nothing important in the middle. $*" --out $A/play/$n.jpg 2>&1 | tail -1; }
sp(){ n=$1; shift; [ -f $A/sprites/$n.png ] && return; node tools/gen.js image --model flare --quality MEDIUM --kind sprite --game yosef --name s-$n --size square --transparent --prompt "$SP $*" --out $A/sprites/$n.png 2>&1 | tail -1; }
face(){ n=$1; shift; [ -f $A/sprites/face-$n.png ] && return; node tools/gen.js image --model flare --quality MEDIUM --kind sprite --game yosef --name f-$n --size square --transparent --prompt "Head and shoulders portrait sticker of one cartoon man, front view, smiling, $ST Isolated on a transparent background, nothing else. $*" --out $A/sprites/face-$n.png 2>&1 | tail -1; }
bgp office "Inside a bright hi-tech office high up: a huge window over three tall blue glass towers and blue sky with soft clouds, a simple floor at the bottom." &
bgp screen "A giant glowing dark-blue computer screen filling the whole picture, soft blue glow, faint thin grid lines, a thin dark frame at the very edges." &
bgp velvet "Close-up from above of a jeweller's deep blue velvet tray filling the whole picture, soft folds, a thin golden rim at the edges." &
bgp highway "Night: a wide city highway seen from the side, a concrete highway bridge across the top of the picture, street lamps, dark blue sky with a moon, city lights far away. The road along the bottom part." &
wait
bgp code "A close-up of a laptop screen filling the whole picture: dark editor background with colourful rows of simple blocks like code lines (no real letters), a thin grey frame at the edges." &
bgp restaurant "Inside a small cosy Jewish restaurant: warm wall, wooden shelves with jars and pots, hanging lamps; a long empty wooden counter across the lower part of the picture." &
bgp kitchen "Seen from straight above: a warm wooden kitchen counter top filling the whole picture, a folded towel in a corner." &
bgp dining "Seen from straight above: a wooden floor with a simple rug filling the whole picture, warm evening light." &
wait
bgp night "Night sky over Bnei Brak: dark blue sky with stars and a crescent moon, rooftops of apartment buildings along the bottom, warm lit windows." &
sp card "A bright ORANGE plastic meal card with a small gold chip and a white fork-and-knife icon, slightly tilted." &
sp phone "A smartphone whose screen shows a bright ORANGE app with a white fork-and-knife icon and an empty white bar." &
sp pizza "A slice of pizza." &
wait
sp burger "A hamburger in a bun." & sp falafel "A pita stuffed with falafel balls and salad." & sp sushi "Two pieces of sushi." & sp diamond "One big sparkling clear-blue cut diamond." & wait
sp diamond-crack "One big clear-blue cut diamond with a clear dark CRACK running through it." & sp pot "A big grey metal cholent pot with two handles and its lid closed, side view." & sp pot-open "A big grey metal cholent pot with two handles, side view, NO lid, steaming brown cholent inside." & sp lid "Just the round grey metal lid of a big pot, side view, with a knob on top." & wait
sp hat "A brown felt fedora hat." & sp truck "A small white delivery truck seen from the side, with an open flat cargo bed at the back, cab facing left." & sp bug "A cute small green cartoon beetle bug seen from above." & sp splat "A flat squashed green cartoon bug splat, cute not gross, seen from above." & wait
sp challah "Two braided golden challah breads." & sp wine "A dark red wine bottle with a cream label (no letters)." & sp candles "Two white Shabbat candles lit, in two silver candlesticks." & sp cup "A silver kiddush cup." & wait
sp plate "A white dinner plate seen from slightly above." & sp icecream "An ice cream cone with a pink scoop." & sp chips "A yellow bag of potato chips (no letters)." & sp ball "A colourful beach ball." & wait
sp soda "A red soda can (no letters)." & sp counter "A long wooden shop counter conveyor belt, seen from the front, very wide and thin." & sp pot-top "A big round grey metal pot seen from STRAIGHT ABOVE, empty, the inside bottom visible, two handles." & sp stew "Seen from STRAIGHT ABOVE: the surface of thick brown cholent stew filling the whole square: potatoes, beans, eggs, pieces of meat. Fill the whole frame edge to edge, no pot, no background." & wait
sp table "A dining table seen from STRAIGHT ABOVE, covered with a white tablecloth, rectangular, empty." & sp drawer "A small wooden chest of drawers with one drawer pulled open, front view." & sp coin "A shiny gold coin." & sp attic "A tiny attic room window: a small wooden window frame with a dark empty inside." & wait
sp attic-gold "A tiny attic room window: a small wooden window frame overflowing with shiny gold coins." & sp phone-ring "A smartphone ringing, small red vibration lines around it, screen showing a green call button." &
face yosef --reference $REF --strength MID "Yosef: young Haredi man, black velvet kippah, round glasses, short black beard, white shirt." &
face a "young Haredi man, black kippah, NO glasses, short black beard, white shirt." & wait
face b "Haredi man, black kippah, round glasses, BROWN beard, white shirt." & face c "man with a blue knitted kippah, round glasses, short black beard, light blue shirt." & face d "old man, black kippah, round glasses, long WHITE beard, white shirt." & face e "young man, NO kippah, short black hair, round glasses, no beard, red t-shirt." & wait
face f "young man with a red baseball cap, no beard, no glasses, green t-shirt." & face g "Haredi man with a black hat, black beard, no glasses, black jacket." & face h "man with a red-ginger beard, black kippah, no glasses, white shirt." & face i "man with no kippah, grey hair, glasses, clean shaven, suit and tie." & wait
echo PLAY-ART-DONE
