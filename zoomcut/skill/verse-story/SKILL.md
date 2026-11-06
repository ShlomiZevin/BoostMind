---
name: verse-story
description: Post (or fix) a character's story on the Shlomiverse (shlomiverse.com - the rings on the home page, /story/<character>) - a tall picture or short clip with its words laid out as text boxes (style, font, size, colour, place) that never cover a face or a word already in the picture, checked on three phone sizes before anything goes up. Use whenever a session announces something in the verse (a new game, a video, a site, a moment in a character's life), whenever he says story / סטורי / סטוריז / "tell the verse" / "post it in the stories", and whenever a story that is up needs fixing.
argument-hint: "[character] [what happens]"
---

# verse-story - a character's story on the Shlomiverse

Most stories on shlomiverse.com are posted by Claude sessions, not by him in /backstage/ (his words, 2026-11-04: "most of
the time the one who will build the stories will be a Claude session, so the skill matters more than the tool").
Reply in English; Hebrew only in the story.

## On another computer (his other PC - read this first there)
1. `git pull` in the BoostMind repo (this skill: `zoomcut/skill/verse-story/SKILL.md`; the tools: `scripts/story.mjs`,
   `scripts/stories/preview.mjs`, `scripts/stories/video.mjs`). Not on his main PC? Read this file directly - the skill
   is registered as `verse-story` only where `~/.claude/skills/verse-story` links to this folder.
2. Needs: Node 18+, **ffmpeg + ffprobe** on PATH (a video story), `npm install` once in `zoomcut/render` (puppeteer-core
   for the preview), and Chrome or Edge (or `CHROME_PATH=<chrome.exe>`). Removing words from a picture
   (`clean-words.mjs`) also needs the design key: `node scripts/design-env.mjs` once per computer.
3. **Whose story**: `"char"` = the character's id - the folder name under `zoomcut/characters/` (hani, shterni, yotam,
   avraham-moshe...) or `verse` for the Shlomiverse's own account. Check the id exists there before posting; the story
   shows that character's name, face and ring, and their followers get the bell + push.
4. **The owner key**: ask HIM for it in the chat, every time; never write it to a file or commit it. Then the flow below:
   preview -> `--test` -> post. Not on Shabbat. A video story: give the clip as `"file"` (any .mov / .mp4) - it is made
   story-ready by itself (section "A video story").

## His rules (2026-11-04 - every one cost a round)
1. **Nothing sits on anything.** No word on a face, no word on a word that is already in the picture, no box on another
   box, nothing under the name bar or the button. The viewer keeps the picture between the bar and the button on every
   screen (his choice "B", 2026-11-05 - the same for pictures and clips, on a phone the story fills the whole screen);
   you keep the boxes off faces and off the picture's own words.
   **Full screen** (the expand button next to the X): the original picture / clip on the whole screen with NOTHING on it -
   no name, no face, no words, no button; a tap anywhere comes back. So a story must also make sense with no words at all
   (rule 4). Give `keepClear` in the story JSON (the picture's own words and faces) - it goes up with the story.
2. **The whole picture is always seen.** A story fits the screen whole, never wider than it (the sides of a 9:16
   picture used to be cut off on phones - and words with them). Around it the viewer paints the same picture blurred.
   You do nothing for this - just never put anything important in the outer 2% of the picture.
3. **The words are boxes, not one block of text over everything.** The story's message goes in boxes you design
   (8 styles, 8 Hebrew fonts, any size / colour / place). Say it in one to three short boxes. A long block of text on a
   picture is what he showed as the problem ("We have problem in stories").
4. **A visitor can see the story without its words** (the viewer's button / holding a finger on it). So the message
   lives in boxes, not inside the picture: a picture made with the words drawn in can't be seen without them, and the
   image model misspells Hebrew (the wedding story's verse came out "אזוותנו"). What MAY be in the picture: a game's
   own title art / logo, a sign or a paper that is part of the scene (Shterni's roots-project board). Never the same
   words twice (in the picture AND in a box).
5. **Look before you post.** `scripts/stories/preview.mjs` draws it with the site's own code on three screens and checks
   every box; exit 1 = fix it. Then LOOK at the pictures yourself - the checker only knows the areas you told it.

## The flow
1. **The picture** - a tall 9:16 picture (1088x1920 or 1080x1920; another shape is fine, it fits whole) or a short clip.
   - New picture: GPT Image 2.5 (the `marketing-stories` skill's way: real references of the people, the scene's
     PURPOSE in the prompt). Ask for the scene WITHOUT words unless they belong to the scene, and leave quiet space
     (a wall, a floor, a sky, a dark dress) where the words will go - say where ("the upper right third is a plain wall").
   - A picture that already has words you will say again in boxes, or misspelled words: take them out -
     `node scripts/stories/clean-words.mjs in.jpg out.jpg "x1,y1,x2,y2" ... --hint "what is behind them"` (areas in % of
     the picture; only those areas are repainted, the rest is the original's own pixels, faces never change). Look at
     the result at full size: a band where an old fade or panel started = run it again over a bigger area.
2. **Look at it with the grid** - write the story JSON (below) with no boxes yet, run the preview, open
   `<name>-clean.png`: the bare picture with a 10% grid. Write down `keepClear` - every face, every word in the picture,
   anything the joke needs seen (the wig on the stand in "why a tichel and not a wig") - as [x1, y1, x2, y2] in %.
3. **The words** - written in the character's voice (Hebrew copy = Terra, `gpt-5.6-terra`, through the `openai-leonardo`
   skill, as all of his site copy), short. Then the boxes, in the empty places of the grid:
   - one headline at most, big (s 6-9); the rest s 3.6-5.5 (3.6 = the smallest a phone reads);
   - the box's `w` is its widest; check in the preview that a headline doesn't break into a word per line;
   - a long message = 2-3 boxes in a reading order (top to bottom), or two stories - not one block.
   Also `text`: the one line people get in the bell and the push (no box shows it).
4. **Preview and fix** - `node scripts/stories/preview.mjs story.json [outDir]` until it says no box sits on anything;
   then LOOK at `-phone.png`, `-short.png` (a small phone) and `-wide.png` (a computer). Fix what looks wrong even if the
   checker passed (unreadable letters on a busy background = a box style with a background).
5. **Post** - `OWNER_KEY=<ask him every time, never save it> node scripts/story.mjs story.json --test` (posted to
   nobody, hidden at once - check it in /backstage/ פרסום, then remove it), then without `--test`. `"everyone": true`
   only when he says so (big news). Never on Shabbat. Followers get the bell and a push at once - so step 4 first, always.
6. **Fixing a story that is up** - the same JSON with only what changes, `node scripts/story.mjs fix.json --edit <id>`:
   boxes (`[]` = no words on it), text, link + label (`"link": ""` = no button), file (a new picture). Nobody is told
   again. He can do the same in /backstage/ (a story → עריכה), dragging boxes on a phone preview.

## A video story (his ask, 2026-11-05 - the first: Hani's comic-book teaser)
A clip plays like Instagram's: the whole clip fits the screen, its cover blurred around it, the progress bar follows the
clip and the next story comes when it ends, a finger held on it pauses it, and a sound button sits in the name bar (sound
on unless the visitor turned it off; a phone that won't play sound by itself plays it muted and the button pulses until
they tap it).
1. **Any clip he gives you** (an iPhone .mov, an export, a big file): `"file": "C:/path/teaser.mov"` in the story JSON -
   that's all. `scripts/stories/video.mjs` makes it story-ready by itself (preview.mjs and story.mjs both run it, the
   second time reuses the first): H.264 + AAC, at most 1080x1920 and 30 fps, starts playing at once, under 25 MB (a long
   clip gets the bitrate that fits), and its **cover** (`<name>.poster.jpg` - the first real frame, not a black fade-in;
   shown while it loads, blurred around it, the picture in the push). Run it alone to see what it makes:
   `node scripts/stories/video.mjs <clip> [--at <seconds>]` (`--at` = the cover from that moment). Over ~3 minutes it
   can't fit - ask him for a shorter cut.
2. **A tall clip** (9:16) fills the phone; a square / wide one shows whole with its blurred cover around it - fine, but
   a teaser made for stories should be 9:16.
3. **Words on a clip**: usually none - a teaser carries its own titles and sound. Then write `"boxes": []` in the JSON:
   with no `boxes` key at all the viewer shows the bell's `text` as a box over the clip (on the בעלבוסטע teaser it sat on
   the poster's "בקרוב", 2026-11-05). If you add a box, it stays on screen the
   whole clip: the preview gives stills at 10/35/60/90% (`<name>-phone-at-<s>s.png`) - LOOK at all of them, a box that
   is clear at the start can sit on a face or a title later. Words that belong to one moment belong IN the clip (the
   editor), not in a box.
4. **The button** (`link` + `label`) works the same - for a teaser: where to follow / get notified (`/c/hani`), or the
   pre-order page once there is one.
5. **Post** as always (`--test` first; Never on Shabbat). `"poster": "C:/path/cover.jpg"` chooses another cover; on an
   up story `--edit <id>` with only `"poster"` replaces just the cover. In /backstage/ he can upload a clip too - the
   page grabs its cover by itself; an iPhone .mov or a file over 29 MB there = do it here instead (it says so).
6. **A clip is also a video** (his rule, 2026-11-05): posting it puts it in the latest videos and on the character's
   page too (the catalog, `story-<id>`, Terra's title from the story's words - `"videoTitle"` to choose one). Its
   followers already heard from the story, so no second "new video" ping. **The same clip already on the site** (he
   published it from the studio, or another session posted another cut) = `"videoId": "<its id>"` - the character joins
   that video's cast, no second copy (the בעלבוסטע teaser is `balabusta-teaser`, Hani + Shindy). `"toVideos": false` =
   a story only (a snippet that isn't a video of its own). `--test` never makes one; hiding the story hides the video it
   made (one it only joined stays). story.mjs prints the video's link - say it in the hand-over.
7. **Tested**: `techietech-api/test/story-video.emu.mjs` (on the emulators - `bash scripts/test.sh`) prepares a stand-in
   iPhone clip, posts it with its cover, replaces the cover, and checks the real viewer (cover, sound, hold, the bar).

## The story JSON
```json
{ "char": "hani", "file": "C:/path/story.jpg", "text": "the line in the bell and the push",
  "link": "/hani-games/pilai/", "label": "לשחק עכשיו", "everyone": false,
  "keepClear": [[34, 9, 58, 31], [70, 46, 97, 62]],
  "boxes": [ { "t": "למה מטפחת\nולא פאה?", "x": 79, "y": 16.6, "w": 40, "s": 6.6, "st": "line", "f": "secular",
               "bg": "#fff4c9", "c": "#14142b", "al": "right" } ] }
```
For a story that is up, `"media": {"url": "...", "kind": "image"}` instead of `file` (the preview needs the picture).
`char` = a character id (zoomcut/characters) or `verse` (the Shlomiverse's own account). `link`: https://..., a page of
the site (`/hani-games/...`, `/story/hani` = another character's stories, `/c/hani` = her page).

A box (all in % of the 9:16 picture; v2/site/verse/story-art.js draws it, techietech-api/verse.js keeps the same limits):
| key | | |
|---|---|---|
| `t` | the words, `\n` = new line | up to 300 characters, up to 8 boxes |
| `x`, `y` | the box's CENTRE | 0-100 |
| `w` | its widest (it hugs shorter words) | 10-100 |
| `s` | letter size, % of the picture's width | 3.6 smallest readable · body 3.6-5.5 · headline 6-9 |
| `st` | style | `box` solid card · `glass` dark see-through (on busy pictures) · `line` marker behind each line (headlines) · `outline` letters with a contour (on a photo, no box) · `shadow` plain letters with a shadow (only on dark, quiet areas) · `bubble` speech bubble (the character talking; `tail` br/bl/tr/tl/none) · `note` a paper note in handwriting (a child's project, a list) · `tag` a small pill (a closing line, a date) |
| `f` | font | `heebo` (the site's) · `rubik` round, games · `secular` bold headline · `suez` headline with serifs · `frank` book / verse (takes niqqud) · `amatic` handwriting (thin: s 5+) · `karantina` narrow poster · `varela` soft round |
| `c`, `bg` | text colour, box colour (outline: the contour) | `#rrggbb`, `rgba(...)` or `char` = the character's colour |
| `al`, `r`, `wt` | align right/center/left · turn -30..30° · weight 400/700/800/900 | |

## What went wrong before (2026-11-04, all seven stories that were up)
- Every story had its whole text (up to 288 characters) laid over the picture - over faces, over the poster's own
  title, and repeating words the picture already said ("משחק חדש!" twice).
- The phone cut the sides of every 9:16 picture: game titles lost letters ("פילאי פלואים", "יניב צריך עזרה").
- The name bar sat on the posters' top lines; on a small phone a long name wrapped onto the picture.
- A button "לסטורי של אמא" opened Hani's page, not her stories (`/story/hani` is the stories).
- The wedding picture's verse was misspelled by the image model; an emoji sat in a story's line (no emoji - his rule).
Fixed: the game posters keep their art and got one short box in an empty spot; the pictures that ARE the message (the
roots-project board, Pilai's poster) have no boxes; Hani's "why a tichel" and the wedding lost their drawn-in words
(clean-words.mjs) and got real boxes - the verse spelled right, with niqqud. The fix files (one JSON per story) are the
examples to copy: `scripts/stories/examples/`.
