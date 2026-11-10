# Build rules for Shlomiverse games

Learnt from Plaxzy's Creator (its build rules and the owners' rounds on ~20 games) and from the playhouse's games
(ניסי ניסים, מזבח הקטורת, 4:20, שקל טוב, יוסף מוקיר שבת, פילאי פלואים). Each one cost a round with him. They are
principles - apply them to whatever the game is.

## The idea
- **The player's action carries the meaning.** If the "game" is watching something happen, or one tap turns bad into
  good, it is a toy, not a game. The character's idea must be what you DO.
- **Thinking, not spamming.** Something to read before acting (what is coming, what is hidden, what the order is),
  and a reason to choose. A bot that plays properly finds unfair spots made by chance - use one.
- **Not tight to the script.** A game can start from a video's idea and go its own way; it must feel like the
  character, not retell the episode.
- **Simple** (his rule): the fewest screens, options and buttons that still make it a full game. No settings pages.

## Screens and layout
- Start screen: the game's cover art as the hero, the title, one line of what it is, ONE big main button ("שחקו"),
  a quieter "איך משחקים", the record, and a small footer (back to the hub, sound). Not a stack of equal buttons.
  He called a plain menu "terrible" - the start screen is the game's shop window.
- Phone upright is the main layout; the computer layout is the same game with more room, not a different design.
- Measure the layout from the real viewport (CSS variables set from `innerWidth` / `innerHeight`), with a smaller
  mode for very small phones. Nothing may need scrolling.
- When an action is finished (a round done), hide what can no longer be used and show the next button where the
  thumb is. A button under another layer is a bug.
- Clear transient effects (banners, flying pieces) before showing an end screen.
- Animated buttons (a breathing "play") are "not stable" to Playwright - click them with `{ force: true }` in tests.

## Art
- A picture that moves at a joint (a limb bending): paint the WHOLE part straight with a brace / tape on the joint,
  then cut it at the support in code and turn the far side - one painting keeps scale and skin the same, and the
  support hides the seam (מילימטרים, 3 Nov 2026).
- Don't describe what the game draws on top of a background in its prompt - the painter paints it in. Ask for the
  empty place.
- OpenAI's filter can refuse a harmless medical prop (a neck collar was refused twice as "self-harm"): drop it and
  pick another, don't fight it.
- Concept picture first, approved, then the real art.
- A character the player sees a lot = painted poses from their own portrait (or from an approved painted design),
  normalised to the same size and foot line, each pose on a canvas wide enough that arms and fingers are never cut.
  Code uses each picture's real width.
- Everyone painted into a scene must match their profile (age, hair, clothes, glasses) - put the profile's look
  sentence into the prompt, and look at every result.
- A reference photo pulls its people into the picture: give a reference only to the pictures that should contain
  that person.
- Background people follow the world's rules (a Haredi office background = men only).
- The painter adds things you did not ask for (symbols, a smartphone instead of a kosher phone, food on the floor) -
  check every picture before it goes in, regenerate what is wrong.
- Pictures for the screen: jpg / webp at the size they are shown (cards ~480 px), transparent png only where needed.

## Sound
- ElevenLabs takes at most 5 requests at once - make sounds in batches of 3-4.
- Never one sound for a repeated event: 2-4 variants, picked so the same one never plays twice in a row.
- The character's real voice where it exists; otherwise ElevenLabs sound effects; music only when it earns it.
- Audio starts from a tap (browsers block it before); a sound button that is remembered; everything pauses on pause
  and stops on pagehide / leaving the page.

## Tutorial
- One step at a time with the game frozen, a spotlight on the real thing, the card away from the spotlight.
- "Try it now" steps wait for the real action and say "nice!" before going on.
- The tutorial uses its own fixed content, never spends score, lives or records, and the real game starts clean.

## Records and stats
- Best as a plain number under the agreed key (hubs read it); extra data (a time, a date) under its own key.
- A daily record = the same course for everyone that day (seeded by date).
- `track('game_start')` when a real round starts (not the tutorial), `track('game_over')` at its end.

## Testing
- Play the whole thing: tutorial, every level / story, a mistake on purpose, the end screen - with real clicks.
- Four upright phone sizes plus a landscape, with touch; assert no overflow and that the main buttons are on screen.
- A test reads state through the game's test hook, never by guessing from pixels.
- Test the LIVE page after release the same way.

- **A character who pops up talks beside his own head** (Asaf, 3 Nov 2026): a soft, light bubble next to the head, on the side with more room, fading with him - not only a strip at the top. The strip keeps the loud lines (a lost heart).

- **Steering on a phone = a floating joystick** (פקי-טק, 4 Nov 2026): finger down anywhere, hold and drag; the held direction is kept and taken at the next turn, and a slightly late turn still counts. Never make the player time single swipes - "it should be fun and easy on mobile".
- **A safe place really hides the player**: while the player is in it, the enemies lose track and go elsewhere - no circling at the door.
- **Signs and labels belong to the world**: paint them (GPT) and lay them on the tiles they name (a plate in three pieces - ends + a stretched middle), never a UI card floating on the map.
- **Walls one tile thick** in maze games (no 2x2 solid masses except the enemies' house); check it with a script (yotam-games/pacman/tools/maze-check.py).

- **Cut sprite sheets by the shapes, then look at every cut** on a contrasting background before it goes in: cutting a sheet into equal cells chops anything wide (a scooter, a side view) and drags in pieces of its neighbour (Sagi, 5 Nov 2026).

- **What you see is what blocks you** (Sagi, 5 Nov 2026): furniture drawn inside its own tiles with a floor shadow; no traps in a random map - every free tile has two ways out and the floor is one piece (check every seed with a script); a turn a moment late still counts. "It looks good and it is fun, but you cannot really play it" came from exactly these.

- **No dead ends** (Osnat, 8 Nov 2026): every wrong action needs a way back inside the game (a wrong item in full hands is swapped out by the next pick). Test the stuck states on purpose, not only the happy path.
- **Balance with bots of a few skills, fast-forwarded in the page** (a `tick(dt)` in the test hook): a slow, a normal and a sharp bot. If they all die on the same day, that day is a wall - skill must decide how far you get.
- **Even out the sound levels** (ffmpeg volumedetect, then gain to one mean level): generated effects come back up to 20 dB apart; and run voice clips through speech-to-text to be sure a "laugh" is really a laugh.
- **Git Bash rewrites /site/paths in arguments** into Windows paths - run deploy-onto-live.js with `MSYS_NO_PATHCONV=1` when you pass `--page=/...`.
- **The picture IS the button, with a thumb's gap** (Osnat, 8 Nov 2026): a perk that sticks out above its button's box is NOT tappable there (pointer-events: none on the img sends the tap to the canvas below) - make the visible shape the hit area. Round, at least ~48px, >= 14px apart on the smallest phone (two zigzag rows when they don't fit one); test it by measuring the gaps and elementFromPoint on every picture at every size. What the player needs right now (a wanted item) moves; names can go when the request already shows the picture.
- **Percent heights don't resolve inside a <button>** - size its picture from a CSS variable set in px.

- **Puzzle levels are proven by a bot both ways** (הקטר המאסף, 10 Nov 2026): every level must FAIL with no player action and PASS with one written solution (`tools/solutions.js` + `t0-levels.js`, fast-forwarded through the test hook). Timed hazards (a passing column, a patrol) get a long enough warning that the player can still clear what is already in the way - check it with a bot that only reacts to the warning.
- **Sudden mischief = a warning, a timer and a free answer**: when a character suddenly acts up (runs to the toilets, pulls out a ball), show a red mark with a shrinking bar over them for ~2.5s, and a tap on them stops it for free. It adds reflexes on top of a thinking game without punishing a player who is busy elsewhere.
