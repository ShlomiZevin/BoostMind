# התרופות של שמונה - Lola & Savta pills game

## His words (11 Nov 2026)
"a game for shlomiverse about grandma and lola - lola needs to fit her medicines; real medicine names; the whole game is
about the different pills shape, size and colors; fun addictive mobile game."
Offered 3 mechanics -> "all sounds too good, let's do all :) on the same game, you choose which type to play, use the
same assets between the games". Then: "super nice, pixel perfect, nice images, look and feel, easy to understand for
dummies" + "use designer" = GPT Image 2.5 designs every screen, the build copies it.

## Decisions
- Characters: Lola (caregiver, "אמא", "בבקשה אמא") and Savta (sure Lola swaps her pills, whispers to the player).
- 10 real GENERIC medicines (no brands): aspirin, bisoprolol (yellow heart), warfarin 5 mg (peach), omeprazole (purple/pink
  capsule), metformin (big white oblong), atorvastatin (white oval), calcium + D (huge), vitamin D (golden softgel),
  omega-3 (amber softgel), iron (red-brown). Painted once (art/pills-sheet.png), used by all three modes.
- Mode 1 קופסת השבוע = Block Blast on a 7-day x 8 pill organizer. A pill takes cells by its real size (1/2/3), a piece = a
  shape tiled with one medicine. Full row or full day clears; a big pill touching a cleared line is taken out whole.
  Pieces dealt from a daily seed. Game over when nothing fits.
- Mode 2 הבקבוקים = Ball Sort, bottles of 4. Levels 1-2: clearly different pills; from 3 the look-alikes (whites /
  yellows). Every level proven solvable by a solver before it is shown. Undo. Score per level, fewer moves = more.
- Mode 3 המגש של סבתא = match-3, 7x8. Savta's order (pills x count) in N moves. 4 in a line = a glowing line-clearer,
  5 = clears that medicine. Levels 1-2 only distinct pills; whites join from level 3.
- Easy for anyone: hint chip with a bulb under the play area, an animated hand that shows a real move after 5 s of no
  input (and at once in every "try it" tutorial step), refusals say why ("זה לא אותו כדור! תסתכלו על הצורה").
- Designer screens: design/mock-*.png (start, box, sort, tray, end). Purple glossy buttons, cream panels with a wood rim,
  painted title sign, big Lola & Savta at the top with a bubble between them.
- One daily record for the game (VerseFrame.score with the run's score, any mode). Best per mode in localStorage.
- Upright only; a landscape phone shows "turn the phone".

## Round 2-4 (11 Nov, his notes)
- Kupat holim world: hold music + recorded menu voice (tools/voice.mjs), queue/extension words on every screen.
- REAL BRAND names old people get (his explicit ask, overrides the generic choice): מיקרופירין, קונקור, קומדין, אומפרדקס,
  גלוקופאג', ליפיטור, קלציום D, ויטמין D3, אומגה 3, פרו-גרדומט + new פוסיד (white, FUSID 40) and ואבן (light blue).
- The pill's NAME everywhere: tray pieces named, dragged piece named, drop/match pops "name ×n +pts" (he loved it),
  lifted bottle pill named, prescription ticket names. Numbers drawn apart from Hebrew (bidi).
- Full bottle = pharmacy label (painted blank, printed in Miriam Libre, wrapped on the jar) + red stamp נופק.

## Tutorial (per mode, first play, "?" on each card)
box: who is Lola -> Savta -> the box + goal -> real sizes -> the tray -> TRY: drag the capsule into the gap -> clears ->
losing -> home/restart. sort: Savta mixed them -> goal -> tap-tap -> rules -> TRY a move -> TRY solve -> undo -> ready.
tray: Savta's tray -> the order + moves -> swap rule -> TRY the marked iron -> specials -> losing -> ready.

## Files
public/lola-games/pills/ (index.html, game.js, game.json, cover.jpg, assets/), workshop here: prompts/, art/, design/,
tools/cut.py (sheets -> assets), tools/sfx.sh (ElevenLabs sounds), tools/t1-play.js, tools/t2-phones.js.
