# Assets for "אז אנחנו מסונכרנים" (techytech-games/meetings)

Game folder: public/techytech-games/meetings/assets/   Workshop: scripts/techytech-games/meetings/ (prompts/, art/ raw)
Refs (real portraits): scripts/techytech-games/meetings/refs/*.jpg
Style: the approved concept (art/concept.png) - polished, colourful, slightly caricatured painted game art.
Every picture: OpenAI gpt-image-2.5 via zoomcut/skill/marketing-stories/tools/oai-image.js (sunburst HIGH for people,
title, cover; flare MEDIUM for the rest), then `node zoomcut/tools/library_add.mjs <raw> --about ... --tags ... --project game-meetings`.
Prompt the WHAT, not the HOW. Give a person's ref only to pictures with that person. Look at every result.

## People = webcam tiles (square; final 512x512 .webp, q~82)
Each = that person as seen in their own video call: head and shoulders, centred, looking at the camera, their own
home/office background behind (no UI, no text, no frame). Same face / glasses / hair / clothes as their portrait.
Main cast (ref = refs/<id>.jpg):
- amir.webp, amir-talk.webp (talking, mouth open, one hand gesturing)          bg: corner office in a Tel Aviv tower
- ofer.webp, ofer-talk.webp                                                     bg: a meeting room / home office
- ronit.webp, ronit-talk.webp                                                   bg: neat office
- gilad.webp, gilad-talk.webp                                                   bg: CEO office
- itay.webp (sitting), itay-leave.webp (standing up, closing laptop, half out of frame, in a hurry)
- yaniv.webp, yaniv-mouse.webp (holding up a weird curved ergonomic mouse, annoyed)
- daniel.webp, daniel-hand.webp (raising his hand politely), daniel-try.webp (mouth open, trying to speak)
  Daniel bg: small cluttered room in an apartment, IKEA-style shelf, rubber duck. Black cap, glasses, beard, t-shirt.
More staff (painted from refs, normal pose only): yotam, osnat, tzvika(=dino.jpg), vova, erez, ido, lior(=sales.jpg),
rami(=arch.jpg), yoav(=vprd.jpg)  -> <name>.webp
Crowd (office workers of an Israeli enterprise company, men and women, varied ages; NOBODY resembling the cast):
- crowd-01.webp ... crowd-24.webp normal; plus talking versions for 8 of them: crowd-01-talk ... crowd-08-talk
  (paint sheets with clear gaps and cut with make-game sheetcut.py, check every cut; or one by one).
- asleep.webp: one crowd worker asleep on camera. noone.webp: an empty chair in a home office (camera on, nobody there).

## Big pictures
- assets/hub.jpg (1080x1920 upright, jpg): the hub's "laptop desktop" wallpaper - Techy-Tech office/city view,
  calm, empty space in the middle for 3 icons (no icons, no text).
- assets/app-zoomba.png, app-meetly.png, app-teamz.png (transparent, 512): rounded app icons for three INVENTED video
  call apps (blue camera / green people / purple share-ish), no text, not real brands.
- assets/title.png (transparent, wide): painted lettering "אז אנחנו מסונכרנים" in Hebrew, exact spelling, corporate-fun style.
- cover.jpg (1200x630, in the game folder root): the cast in a big video-call grid, Amir in the middle; no text over faces.
- assets/hero.jpg (1080x1350): the cover look upright with the title on it; assets/share.jpg 1200x630.

## Sounds (assets/sfx/*.mp3, ElevenLabs via zoomcut/tools/leonardo.mjs sfx|loop, batches of 3-4, levels evened)
join-1..2 (call joining chime), leave-1 (call leave chime), slide-1..3 (soft whoosh of a tile sliding), merge-1..4 (a
satisfying pop/chime, rising), big-1..2 (bigger celebratory merge), removed-1..2 (short negative "kicked from
meeting" bloop), itay-1 (rushed door/laptop slam), tap-1..2 (UI tap), wrong-1..2 (soft buzzer), found-1..3 (bright
"got it" chime), line-1..3 (tick as a line grows a cell), connect-1..2 (pair connected), level-1..2 (level complete
fanfare, short), over-1 (game over), music-loop (~30 s corporate on-hold elevator music, light, loops cleanly).
