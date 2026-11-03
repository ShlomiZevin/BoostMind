---
name: make-verse-game
description: Make (or change) a browser game for the Shlomiverse (shlomiverse.com) starring any of Shlomi's characters - Hani and her family, the Techy-Tech team, Ayelet, Demokratovich, Nahor, Dorit, Rosenblum, Gen Z, anyone in zoomcut/characters. Built as well as Plaxzy's Creator builds (plan, concept picture first, painted art, real sounds, a tutorial, played as a phone before it is called done) but with none of Plaxzy's limits and never uploaded to Plaxzy - it lives on shlomiverse.com, true to the character's profile and world, announced with a Shlomiverse story. Use whenever he asks for a game for a character, a game in the verse, a game for Hani's playhouse (המשחקייה של חני), "make a game about <character>", or to change one of these games.
argument-hint: "[character] [idea, or 'you decide']"
---

# make-verse-game - games for the Shlomiverse

Shlomi has dozens of characters (all of them in Sketch Studio, `zoomcut/characters/`). Each one can have games, and
every game is part of the Shlomiverse: it lives on **shlomiverse.com**, it is true to who the character is, and it
links back into the verse (the character's wiki page, their site, the links page). **Reply in English; Hebrew only
inside the game.**

This skill takes everything that makes Plaxzy's Creator games good - plan first, show the look as a picture, painted
art and real sounds, rules learnt from real bugs, a tutorial, and PLAYING the game (as a phone too) before anyone sees
it - and drops everything that belongs to Plaxzy: no single-HTML-file rule, no 900 KB limit, no sandbox, no
`Plaxzy.save` / Plaxzy Sound, no Plaxzy branding, no upload to plaxzy.com. **Never upload a Shlomiverse game to Plaxzy.**

Never skip a step. The quality bar is "as good as Plaxzy Create" - the rules below are the floor, not the ceiling.

## 0. Setup (every time, seconds)
- **The repo**: BoostMind = the Shlomiverse (read its `CLAUDE.md`). Work in a worktree or a clean checkout of
  `origin/main`; `git fetch` first - other sessions push all day. Commit only your own files, and only when he asks.
- **Sketch Studio's tools = this skill's makers** (`zoomcut/tools/`, keys in `zoomcut/.env`, the studio's own - never
  borrow another project's key, never print one):
  - pictures: `node tools/leonardo.mjs image <prompt.txt> <out.jpg> [flare|sunburst] [HIGH|MEDIUM] [WxH]`;
    a character from their portrait: `node tools/leonardo.mjs portrait <ref.png> <prompt.txt> <out.jpg> sunburst HIGH`
    (both call OpenAI GPT Image 2.5 directly). Several references at once (a character + a style + a layout):
    `zoomcut/skill/marketing-stories/tools/oai-image.js --ref a --ref b ...` with `OPENAI_API_KEY` taken from
    `zoomcut/.env`, then `tools/library_add.mjs` on the result.
  - sound effects: `node tools/leonardo.mjs sfx <prompt.txt> <out.mp3> <secs>` (ElevenLabs directly);
    loops: `... loop ...`; music: `node tools/elevenlabs_music.mjs <out.mp3> <secs> "<prompt>"`.
  - **Everything you make goes into the editor's asset library, labelled, right away** (his rule, 2026-11-02): pass
    `--about "<what it is>, for the <game> game" --tags "<character, world, mood, use, game>" --project game-<slug>`
    to every maker; anything else (a cut sprite, a trimmed sound) with `node tools/library_add.mjs <file> ...`.
    Before you finish, `node tools/library_add.mjs --unlabelled` shows nothing of yours.
- **Look before you make**: the asset library (studio Assets page / `zoomcut/library/`) and Plaxzy's studio library
  (`$HOME/plaxzy-studio` or `c:/workspace/plaxzy-studio`: `node tools/find.js <words>`) may already hold the
  background, sound or prop. Reuse first. Plaxzy's studio techniques are open to us too - read its `PROTOCOL.md` for
  guide sheets (`studio/sheet.js` -> `studio/paint.js` -> `studio/cut.py`), walk cycles, audio trimming
  (`tools/audio.js`) - but a Shlomiverse game's assets are made with the editor's tools and keys, above.
- **3D**: three.js from jsDelivr with a pinned version in an importmap (Hani's games use 0.160.0); Blender for models
  (`C:/Users/shazb/tools/blender-5.2.2-windows-x64` on the second PC). Before any 3D characters read Plaxzy's
  `make-game-kit/skills/make-game/characters.md`, before any sports game its `sports.md` (in
  `c:/workspace/plaxzy/make-game-kit/` - the lessons hold here; ignore what is about uploading to Plaxzy).
- **Browser tests**: Playwright (`playwright-core` from any local node_modules, e.g. `~/plaxzy-creator`) driving the
  installed Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`, `--use-angle=swiftshader` for WebGL).

## The makers - always these
- **Every picture = OpenAI GPT Image 2.5, one of exactly two models** (super important - his rule):
  - **`gpt-image-2.5-flare`** (`flare`) - the default: scenes, props, backgrounds, icons, the concept picture.
  - **`gpt-image-2.5-sunburst`** (`sunburst`) - the most exact: the characters and their poses, the cover, the title
    art, the hero and the story picture - at HIGH quality.
  - No other image model, ever (no DALL-E, no gpt-image-1, no Flux). Called directly: game art, the concept picture, the cover, the title art, the share picture, story
  pictures. Never Leonardo (only if OpenAI refuses or fails), never shapes drawn in code for what the player looks at.
- **Every sound = ElevenLabs**: sound effects, loops, voices and music (`leonardo.mjs sfx|loop` calls ElevenLabs
  directly, `elevenlabs_music.mjs` for music, `elevenlabs.mjs` for voices).
- Through the Sketch Studio tools above, so each result lands in the editor's library with its labels.

## Every game ships with its cover and its title - not optional
A game is not done without these, all made with OpenAI from the game's real look and the character's portrait,
and shown to him before they are used:
1. **The cover** (`cover.jpg`, 1.91:1 / 1200x630 - the verse's game card; Hani's playhouse cards are 4:3) - ONE painted picture, the character at the center, the game's
   world; no text over faces.
2. **The title art** - the game's name as painted lettering (`assets/title.png`, transparent background, `--transparent`),
   in the game's style; used on the start screen, the end screen and the promo. Hebrew spelled exactly as given in the
   prompt; check every letter.
3. **The start-screen hero** (`assets/hero.jpg`) - the cover with the title on it, as the start screen's main picture.
4. **The share picture** (`assets/share.jpg`, 1200x630) + `og:image` / `og:title` / `og:description` in `index.html`.
5. The **story picture** for the launch (step 9).

## 1. The character comes first
Read before any idea - the game must be something THIS character would be in:
- `zoomcut/characters/<id>/profile.md` (who they are, how they talk, what is funny about them, their look, the rules
  for writing them, the "never" list) and `character.json` (`relations`, `world`, `site`, `assets.portraits`).
- Their world in `zoomcut/characters/index.json` (`worlds`): its brief and site. The game lives in that world - a
  Techy-Tech game looks like Techy-Tech, Hani's games are in her playhouse, Ayelet's in her podcast's mystic world.
- **Everyone who appears must match the family tree / the org chart** - read the profile of every character you put in
  (ages, looks, who is whose child, who reports to whom). A wrong kid or a wrong boss is a bug he will catch.
- The character's videos and scripts (`zoomcut/episodes/`, `zoomcut/scripts/`) are the best source of game ideas -
  their catchphrases, situations, running jokes. A game "from the last Hani script" means reading that script.
- **Every character is a real person** in the verse: never "parody", never Shlomi's name on them, never a real
  product's or brand's name in their world (invent one). Their `writing_rules` and `dont` lines apply in the game too.
- A character with no profile yet: ask him who they are (one question with options), never invent one.

## 2. The idea - concepts as pictures, his pick
- Suggest 3-4 game ideas in plain words, each one sentence of "what you DO" + why it is this character. Ask with
  clickable options (AskUserQuestion), short. **"You decide"** = pick yourself, ask nothing, build, then show.
- **Start from a mechanic that is proven to work** (his rule, 3 Nov 2026): Pac-Man, Space Invaders, whack-a-mole,
  Breakout, Tetris, a runner, a fishing reel... - a real, known game whose loop is fun by itself - and put the
  character's story on it. Never invent a new mechanic, and never make a quiz or a dialogue picker ("pick the right
  answer") - those were all rejected for Asaf. Each idea = "<known game> + <who the character is>".
- **About who the character IS, not one video**: their running traits across all their videos (Asaf is always on the
  sofa, can't be happy for you) - the newest video is a source of lines, not the whole game.
- **The story carries the character, not a skin on a generic game.** Learnt the hard way
  on פילאי פלואים (2 Nov 2026): merge icons, flip cards, memory and a "glasses that turn bad to good" game were all
  rejected - "the glasses don't do anything but turn it to good; we need to SEE the miracle". What worked (a story
  chain: order the cards between the mishap and the miracle) made the player DO the idea. Ask: does playing it feel
  like the character's world, and does the player's action carry the meaning?
- **A game must need thinking** (Plaxzy, 28 Oct): if one button answers everything there is no game. Give the player
  something to READ before acting.
- "A game like X" = it looks AND plays like X (its real numbers, screens and feel, from videos and its wiki, not from
  memory) - only the names, characters and world are ours.
- **Show a concept picture before building** - one picture of the finished game screen (`leonardo.mjs image`, MEDIUM,
  with the character's portrait as a reference when they are in it). He approves the look from a picture, not words.
- Write the decisions to the game's `idea.md` (his words first, then the decisions, then the tutorial steps).

## 3. Where the game lives
| Who stars | Where | URL | How it goes live |
|---|---|---|---|
| Hani and her family (Avraham Moshe, the kids, Shindy...) | `public/hani-games/<slug>/` - **המשחקייה של חני** | shlomiverse.com/hani-games/<slug>/ | `hani-games.md` in this folder - the playhouse's own path (released from the live site, never by a plain deploy) |
| Anyone else | `public/<character>-games/<slug>/` - just a folder; the game lives in the verse (first: `yaniv-games/millimeters`) | shlomiverse.com/<character>-games/<slug>/ | git + `bash scripts/deploy.sh` (step 8) |
| A character with their own site (Techy-Tech, /ayelet/, /dorit/...) | also a link / card on that site | | the site's owner session, or edit it here and deploy |

- **Games belong to their character - they live in the Shlomiverse, on the character's wiki page** (his ask,
  3 Nov 2026). The contract is ONE `game.json` - nothing else: `games()` in `scripts/wiki/build.py` collects every
  `public/<folder>/<slug>/game.json` with `"status": "live"` into wiki.json `games`, and the verse shows it on the
  character's page (shlomiverse.com/wiki/#/c/<id>), in the home games row and on #/games, opening the game on its
  page inside the verse (#/play/<id> - see "The frame protocol" in step 8). Per game: `title`, `tagline`, `character` (studio id; `chars` = a list for
  several), `date` (YYYY-MM-DD - always set it), `status`, `cover` (default `cover.jpg`, **1.91:1**, e.g. 1200x630).
  Then `python scripts/wiki/build.py` + `node scripts/wiki/push.cjs` (no deploy for the wiki; other sessions may have
  work in `scripts/wiki/*` - never revert it). The verse's pages (`v2/site/wiki/`, `v2/site/verse/`) belong to the
  Shlomiverse session - don't edit them.
- **No games site, no hub, no `links` entry** for a non-Hani character: the game lives ONLY in the Shlomiverse.
  (Hani's games are the exception: they have their own site, המשחקייה של חני, AND appear in the verse.) The game's
  back / "more" links go to the character's wiki page with `target="_top"` (the game may run inside the verse's layer).
- Stats: the folder name is the game's stats site (`data-site` on `/t.js`) - add it to `SITES` in
  `techietech-api/analytics.js` (then deploy the `track` function - from the main PC, it needs `owner.json`) and to
  `SITE` + the game to `GAME` in `public/backstage/index.html` and `v2/site/backstage/`.
- One folder per game: `index.html`, `game.js` (or `src/` + a small build), `game.json`, `cover.jpg`, `assets/`
  (pictures, sounds, models). Ordinary web files - as many and as big as the game needs; only keep phone loading
  sensible (jpg/webp at the size shown, mp3 sounds trimmed, models compressed).
- `game.json`: `slug`, `title`, `tagline`, `character` (studio id), `world`, `status` (`soon` / `live`), `cover`,
  `best` ({`key`, `label`}), `date` - the verse reads it (contract above).
- Workshop files (prompts, raw paintings, guides, Blender scripts, tests) live beside it in
  `scripts/<character>-games/<slug>/` (Hani's: `scripts/hani-games/`), never under `public/`.
- **No Hani-face pictures in git** - the paintings made from her portrait stay out (the playhouse already follows this).

## 4. The plan
Before code, write it in `idea.md` and show it in plain words (title, what you do, how you win / what the score is,
the look - with the concept picture -, the sounds, the size, the tutorial's steps). Build only after he says go.
- Size: anything. A one-idea game and a big one are both right; never trim to save time, never pad.
- Hebrew, right to left (`<html lang="he" dir="rtl">`), the character's own voice in every line - words they would say.
- The game's title is Hebrew unless the character's world is English (Homo Useless, HINDSIGHT VIP).

## 5. Build - the rules (from Plaxzy's bugs and the playhouse's rounds)
Read `rules.md` in this folder - all of it - before writing the game. The short of it:
1. **Phone first, upright.** Most players come from a story on a phone. Big thumb controls, nothing under the thumbs
   covering the action, every key has a touch twin, no key hints on a phone. A landscape-only game says "turn the
   phone"; an upright game says so in landscape.
2. **One layer on screen at a time** - no panel on a panel, no menu over a menu. The character's speech lives in its
   own strip, never over the play.
3. **Every action says in words what to do** (a verb chip: "גררו", "הקישו", "החזיקו") - a picture alone is not enough.
4. **Painted, not drawn**: what the player looks at is painted (character poses, scenes, props, the cover); effects,
   shadows and UI in code. **Prompt the WHAT, never the HOW** - say what the thing is and what the picture is for,
   let the painter design it; a character the player sees all game is painted from their portrait, approved, then
   posed from their own picture. HIGH quality for characters, cover and title art; MEDIUM for the rest.
5. **The character must be perfect** ("Hani's figure has to be perfect, that's the whole point"): same face, same
   clothes in every pose, hands and fingers never cut by the frame, no blush on cheeks.
6. **Sounds**: real recorded / generated sounds, several variants for anything repeated, never the same one twice in a
   row; the character's REAL voice lines from their videos where they exist (Hani's: `/hani-games/sounds/`). Sound
   stops when its cause ends, on pause, and when the player leaves the page (pagehide).
7. **The world's own rules**: Haredi characters = kosher - modest poses (no raised arms), only niggunim (no women
   singing), crowds of men only, no crosses or other symbols (check every book the painter adds). Techy-Tech = a
   serious company - the humour is in the situation, never in the company's text. Follow each world's lines.
8. **Shlomiverse branding** instead of Plaxzy's: the start screen says whose game it is ("המשחקייה של חני",
   "Techy-Tech", the character's name) and links back to the character's wiki page (Hani's: "→ לכל המשחקים" to the
   playhouse); the end screen offers the
   character's wiki page / site. Never the Plaxzy logo. RTL links: the arrow goes where Hebrew reads it - text then
   "←" ("יניב בשלומיוורס ←"), check it on screen.
   **The frame protocol - every game, no exceptions** (his rule, 3 Nov 2026: "every game saves space for the things
   that the platform adds"). Every game is played inside the verse's game page (#/play/<id>, an iframe): the
   character + follow and the logo above it, the like / comments / save / share rail beside it, the title card with
   "מסך מלא" below. In full screen the game fills the phone and the verse puts ONE pill at its top - the character's
   face + "יציאה ממסך מלא". The game makes room for it; the platform never covers the game's HUD. Two lines:
   - `<script src="/verse/game-frame.js"></script>` in `<head>` (the protocol's game side, `v2/site/verse/game-frame.js`);
   - the template's top variable takes the strip: `--safe-t: calc(env(safe-area-inset-top, 0px) + var(--verse-top, 0px));`
     and EVERYTHING anchored to the top (HUD, banners, screens, tutorial cards - in CSS and in game.js) uses
     `var(--safe-t)`, never `env(safe-area-inset-top)` directly.
   `--verse-top` is 0 on the game's own address and in the frame, and the pill's height (about 56px) in full screen;
   `html.in-verse` / `html.verse-full` mark the two states, and a `verseframe` event ({ top }, also
   `window.VerseFrame.top`) tells a canvas game that draws its own HUD where to start. Inside the verse the script
   sends links that leave the game to the whole tab (a link back to the hub, `../` / `/hani-games/`, goes to the
   verse's games page), so plain links are fine; still write `target="_top"` on links to the verse. Things the page
   already has - share, like, follow, "back to the site" - get class `verse-hide` (hidden in the verse, shown on the
   game's own address). Test it: open #/play/<id>, press "מסך מלא", start the game - the HUD sits under the pill.
9. **Records**: localStorage keys `shlomiverse:<slug>:best` (a plain number - hubs read it) and a daily best
   `shlomiverse:<slug>:day` ("date|value"); Hani's games keep `hani-games:<slug>:*`. Same course for everyone each day
   = a generator seeded by `'<slug>|' + day`.
10. **Stats**: load `/t.js` and send `track('game_start', '<slug>')` / `track('game_over', '<slug>')`; add the
    game's Hebrew name to the `GAME` table of `public/stats/index.html` (and `public/backstage/` if it lists games).
11. **A test hook**: `window.<SLUG> = { state, ... }` so tests can read the game without guessing from pixels.

## 6. The tutorial - every game, no exceptions
Step by step, the game stopped between steps, **Space / Enter = next** (a big "הבא" button on a phone), **Esc = skip**,
a step counter. In order: who you are -> the GOAL -> how you lose -> every action and every HUD item and tool, one step
each, with a spotlight on the real thing in the game -> "try it now" steps that wait for the real action -> "ready?".
Runs by itself on the first play (remembered), and from "איך משחקים" on the start screen. No step longer than three
lines on a phone. After it the real game starts clean. Worked example: `public/hani-games/pilai/game.js` (STEPS,
spot / try).

## 7. Check - play it until it is good
- **Play it as a player** with Playwright: the tutorial (every step, every "try it" with real taps), a whole round, a
  loss and a win; screenshots you READ.
- **As phones, by touch**: 320x568, 360x640, 390x844, 412x915 upright (and landscape): nothing overflows, nothing hides
  under the strip or the thumbs, every button reachable. Fix, run again.
- **For fun, not only bugs**: pacing, difficulty, feedback, the character's lines firing at the right moments.
- Keep the tests in `scripts/<character>-games/<slug>/tools/` (t1-play.js, t2-phones.js - start from
  `scripts/hani-games/pilai/tools/`, which play the tutorial, every round and five phone sizes).
- Then show him: the local link (`python -m http.server <port>` in `public/`) and two or three screenshots.

## 8. Live on shlomiverse.com - only on his word
- **Hani's games**: follow `hani-games.md` in this folder (the playhouse's release tool; the hub page has its owner).
- **Every other game**: commit its folder (`public/<character>-games/<slug>/`) and its workshop
  (`scripts/<character>-games/<slug>/`), rebase on `origin/main`, push, then `bash scripts/deploy.sh` (the one deploy -
  never a bare `firebase deploy` - or, when this PC's `public/` may be behind the live site, add only the game's files
  onto the live version with `scripts/hani-games/tools/deploy-onto-live.js --page=/<path>=<file> ...`), then the wiki
  build + push so it shows on the character's page. Bump `game.js?v=N`
  on every change (the site caches files).
- **A new page is not done until it is listed** (BoostMind CLAUDE.md): `/all/` (`python scripts/all/catalog.py`), the
  character's studio profile (`links` / `site`), their world in `zoomcut/characters/index.json` if it gets a site, the
  links page's sites strip, and the sites table in `zoomcut/skill/edit-video/wiki.md`.
- Verify live: open the real URL on a phone size with Playwright and play a round.

## 9. Tell the verse - a cover and a story
- The cover, title art, hero and share picture (see "Every game ships with its cover and its title") are in place
  and approved before release.
- **A Shlomiverse story** to announce it (the `marketing-stories` skill for the picture and copy): a tall 9:16 picture,
  the character at the center, text never covered, the bottom 15% left free (the site puts its orange button there),
  posted with `OWNER_KEY=<ask him every time, never save it> node scripts/story.mjs story.json --test` first, then
  without `--test`; `"everyone": true` only when he says so. Never on Shabbat.
- If he wants it on Instagram too, a version with the button lifted out of Instagram's bottom zone.

## 10. Remember it
At the end of the session: a memory note for the game (where it is, its rules, how to update it), and if a lesson is
general, a line in `rules.md` here (a principle, not a one-game detail) - so the next game starts smarter.

## Changing a game later
`git fetch`, read the game's `idea.md` and its memory note, change it, run its tests (t1, t2) until clean, play it,
show him, then step 8 on his word.
