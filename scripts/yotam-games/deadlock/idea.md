# דדלוק - Yotam's parking game

## His words
"Suggest a game in the shlomiverse about yotam" -> picked **Deadlock** (9 Nov 2026) from 3 ideas
(Deadlock / Emergency Override elevators / Travelling Waiter).

## His notes
- "It should be clear that everything is about the workers in Techie Tech" (9 Nov) -> every car belongs to a
  named teammate, painted to fit them, with their painted face sticker on the roof; tap = name + role + Yotam's line
  about them; hints / blocks name the teammate.

## Decisions (approved 9 Nov, built)
- Mechanic: Rush Hour (proven). 6x6 grid in the Techy-Tech underground parking (B2), exit gate on the right of row 3.
- Yotam's green car (galaxy sticker on the roof) must get out. Teammates' cars block him: Erez (black manager car),
  Osnat, Yaniv, Ido, a delivery van ("משלוחים", no brand). Tap a car = whose it is.
- Cars slide only along their length, drag with the thumb.
- Daily: 5 lots, easy -> hard, same for everyone (seeded by 'deadlock|' + day), each generated + solved by BFS so the
  optimal number of moves is known. Score = total moves (fewer = better) -> daily record `better: low`.
- Yotam's strip (bottom): reacts in his voice - "Circular Wait קלאסי", "Victim Process", optimal finish =
  "Shortest Path", extra moves = "זה בסדר, זה בסדר". Every line a different engineering image, "קונטקסט" at most once.
- Hint button = Yotam explains the next optimal move (+3 moves penalty).
- Restart lot button.
- Painted: background lot, each car top-down, Yotam's poses (explain / happy / sad / beseder). Sounds: engines, honks,
  barrier lift, bumps (several variants each), music loop - ElevenLabs.
- Concept: art/concept.jpg

## Tutorial steps
1. You are Yotam, end of the day, the parking is in deadlock.
2. Goal: get the green car out the gate.
3. Cars move only forward/back along their length - try: drag the marked car.
4. Moves counter + the day's record (fewer = better).
5. Hint (costs 3 moves) + restart.
6. 5 lots a day, same for everyone - ready?

## Built (9 Nov 2026)
- public/yotam-games/deadlock/ (index.html, game.js, game.json status soon, lots.json, cover.jpg, assets/).
- Cars: assets/cars/<id>.webp cut from art/sheets/cars2.png (4x3) + cars3.png (1x3) by art/cut.py (sheetcut).
  Owners: erez, osnat, yaniv, ido, tzvika, amir, ronit, daniel, sagi (2 spaces); gilad limo, ofer SUV, Osnat's
  candidates' shuttle (3 spaces). itay + a silver car cut but unused (no Itay portrait on this PC).
- Faces: assets/faces/<id>.webp (sunburst HIGH from each one's portrait + Yotam's painted style).
- Lots: tools/gen.js hill-climb per tier -> tools/out/*.json -> `node tools/gen.js merge` -> lots.json (bucketed by
  real optimal: 4-7 / 8-12 / 13-17 / 18-22 / 23+). Daily pick = hash('deadlock|day|tier') % tier length.
- Sounds: ElevenLabs studio key was OUT OF CREDITS -> reused Plaxzy library sounds (container-pack slide/fit,
  tiny-racers bumps, gan-run honks + bus) + Pac-Man's start/clear/music. Replace with ElevenLabs once credits return.
- Tests: tools/t1-play.js (tutorial + all 5 lots by real drags), tools/t2-phones.js (4 phones by touch + landscape).

## Round 2 (10 Nov 2026) - his notes: "sounds not great", "people lean out of the window, colleagues - can't shout",
"buttons hide that it's a Techy-Tech parking", "bottom area wasted", "make it more Techy-Tech / my verse", a story poster
- Sounds remade (Leonardo; ElevenLabs still 0 credits): 2 candidates each, sfx2/fix.js cuts the leading silence (old ones
  started 0.2-0.6 s late), trims, fades, peak -1.5 dB. 8 slides, 4 bumps, 5 honks, 5 window motors, gate, 2 picks, start, 2 wins.
- Window peeks: after a move / a bump / when blocking Yotam, the owner's face slides from the roof to the side window with a
  polite bubble (Terra lines, lines/window.json) + a window-motor sound. No honks on bumps.
- HUD moved to the bottom; the board is pinned to the top so the Techy-Tech wall sign is never covered.
- Lobby strip (assets/lobby.jpg, flare from floor.jpg): elevator, badge reader, charger, Sagi's scooter, logo - fills the bottom.
- Team chat card "#חניון-b2" in the lobby (Terra lines, lines/chat.json): 2 teammates post at each lot's start, one cheers on exit.
- End screen: "the team who blocked me today" faces -> /c/<id> in the verse.
- Story poster: story/story.html + art.jpg -> story/deadlock-story.jpg (empty dashed box for the link sticker), sent to Telegram.
