---
name: marketing-stories
description: Make the launch marketing for a new game / product of Shlomi's (Hani's playhouse "המשחקייה של חני", Plaxzy, any brand) - Instagram stories and posts designed by GPT image 2.5 (sunburst / flare) from REAL photos of the people + the product's own art, a fast launch teaser video (model-designed frames with the host as the hook, trailer voice-over, a tiny story hook, a radio-ad disclaimer, a 'how do you get there' end frame) and optionally a silent chapter video for a song. Use whenever he says marketing, promo, stories, סטוריז, posts, פוסטים, teaser, טיזר, launch, "tell people the game is up", or hands over a promo HANDOFF.
---

# marketing-stories - launch marketing from real people + real product art

Born on "יוסף מוקיר שבת" (Hani's playhouse, 2026-10-30). He: "now you are doing super great - remember how you did it".
**Talk to him short, in his language, and ask with clickable options.** He sits in front of the computer: show results
on screen (open the file / give the full path), don't push them to Telegram unless he asks.

**These are Instagram stories.** A story on the Shlomiverse itself (the rings on shlomiverse.com) is the `verse-story`
skill (2026-11-04): the picture without the message drawn in (a game's title art may stay), the words as boxes on it,
nothing on a face or on the picture's own words, checked with `scripts/stories/preview.mjs` before it goes up.

## Everything you make goes into the editor's library - labelled, right away (his rule, 2026-11-02)
Any background, music, sound effect, picture, icon, emoji, sticker or clip you CREATE for a video goes into the asset
library (`zoomcut/library/`, the studio's Assets page) the moment it exists, with every label that matters - so nothing
is ever tagged in bulk again (his words: "so we won't get another time these things to tag").
- The makers do it themselves: `node tools/leonardo.mjs image|portrait|sfx|loop|video ... --about "<what it is, for
  which video>" --tags "<mood, place, use, character, style>" --project <id> [--kind background|picture|icon]`,
  `node tools/elevenlabs_music.mjs <out.mp3> <secs> "<prompt>" --about "..." --tags "..." --project <id>`.
- Anything else (a frame you cut, a sound you edited, a file from elsewhere): `node tools/library_add.mjs <file>
  --about "..." --tags "..." --project <id> [--kind ...]`.
- `--no-library` only for a throwaway test. Before you finish: `node tools/library_add.mjs --unlabelled` must be empty
  for what you made.
- Labels = what someone would search for later: what it shows / sounds like, the mood, the place, the character, the
  kind of video (Zoom call, rabbi monologue, news, trailer...), the series. Hebrew words welcome.

## What wins (each line cost a round)
- **Let the image model DESIGN the story - don't stamp cut-outs on a template.** My hand-made HTML layout (photos
  pasted around text boxes) was "a mess, no logic". The fix: give gpt-image-2.5 all the pictures + the exact text and
  say what the story is FOR; it composes the scene and the Hebrew typography together. Sunburst and flare both do
  good Hebrew.
- **Real people, from real photos.** If you have no realistic photo of a person, ask him first. A picture he pastes in
  the chat is already saved on disk (the session's `images/` folder, the path is shown with it) - use that path, never
  go searching the disk for it ("it's here, don't you get it?"). From one portrait you
  can generate more poses (`--ref` the portrait); show every new picture before building on it. People he gives you
  (photos he pastes) are used as-is, as references.
- **Modesty is the brand** (Haredi audience): calm, restrained poses - hands clasped, holding a phone / book / laptop,
  pointing low. **No raised arms or showy posing** ("she is Haredi, she can't be posing - לא צנועה"). Women modestly
  dressed, married women's hair covered; crowds = men only. Nobody's hands or fingers cut by the frame.
- **Keep it simple**: "a new game is up" + what the story is + how you play. Not clever, not joke-heavy. The host
  (Hani) is the centre of the brand and is never funny on purpose.
- **Say clearly why it's kosher** when it matters to the audience: who made it (a real-sounding credential), "music
  only (no women singing)", "no chat, no ads". He chose the wording himself - use his exact words, ask for names.
- **Never reveal the cliffhanger** in a teaser picture or video.
- Launch wording is "עלה עכשיו" / "עכשיו ב…" (not "בקרוב") once it's live; the product card on the site is released
  together with the promo, only when he says so.

## The stories (1088x1920 from the model; Instagram keeps ~15% at the bottom clear)
One prompt per story, written to a file (never Hebrew through the console). Say WHAT is needed, not how it looks:
1. A shared header: what the brand is, what the product is, who the people in the references are and what must stay
   exactly (faces, glasses, clothes), the modesty rule, "game art from the references is used as-is", "Hebrew spelled
   exactly, right-to-left", "text never covers faces", "keep the bottom 15% free of text".
2. Per story: its **purpose** (launch / suspense teaser / how you play / who made it / play now), which reference is
   which, and the **exact text** (label, headline, line, button).
Typical set: launch (host + cover + "עלה עכשיו!") · suspense (a story page before the twist + a question) · how you play
(real gameplay screenshots inside phones) · who made it (a family photo of the real people, names, kosher badges) ·
play now (host + product + button + "הקישור בביו").

```
# the key: oai-image.js takes the Shlomiverse design key (scripts/design.env) by itself - Backstage counts it.
# A Plaxzy launch: run it with Plaxzy's own key from the Plaxzy repo, not from here.
node tools/oai-image.js --model sunburst --size 1088x1920 --quality high \
  --prompt-file prompts/s1.txt --ref people/hani.png --ref art/cover.png --out out/story-1.png
```
Run the stories in parallel (`&` ... `wait`). Up to ~5 references work well.

**A story he posts with a link sticker** (his rule, 10 Nov 2026 - the Deadlock story took four rounds):
- **The link box's centre sits ~25% from the bottom** (about y 1420-1540 of 1920), never lower - low on the screen the
  sticker is hard to see and Instagram's reply bar covers it. Leave that band empty in the prompt and draw the box
  (a dashed rounded frame, nothing inside) yourself, exactly.
- **Let GPT image paint the whole poster, its words included** (title, the character's line, a short line) - its
  typography is good and one painted poster looks far calmer than code text stacked over a picture. Only the brand
  (logo, two-colour wordmark, URL) and the link box are laid over it in code.
- **Few elements, room between them**: picture, one line from the character, one short line, the box, the brand. Every
  extra line made it "a mess". A prefix before the wordmark ("משחק חדש ב-") goes on its own small line, never glued to it.
- **Shlomiverse branding** = the planet logo (`v2/site/verse/logo-512.png`) + the wordmark "שלומי" white, "וורס"
  #ff6a1f (weight 900, as `.vx-wordmark` in verse.css) + shlomiverse.com.
- **Characters are painted from their real photos, at their real age and attitude** - a stylised painting from an
  earlier painting drifts toward a cute kid (round baby face, tiny chubby hands). Reference the real photo and say who
  they are (a grown-up geek, skeptical) in the prompt.
  **Best reference = frames from the character's own videos** (Yotam, 10 Nov: the verse portrait still came out
  "childish" and "not himself"; frames fixed it). The videos are in the verse data
  (`storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json` -> `videos` with the character -> the mp4): pull a
  contact sheet (`ffmpeg -vf fps=1/2,scale=240:-1,tile=6x3`), pick 2-3 frames where they do their typical thing, and
  describe the attitude in words too (Yotam: arrogant know-it-all geek, a bit on the spectrum, likable - looking down
  his nose, mid-explanation). Then the masked head edit below.
  A fallback photo = the character's verse portrait, `https://storage.googleapis.com/shlomiverse-media/wiki/img/c/<id>.jpg`
  (not another AI picture of them - one gave Yotam a narrow, frowning face: "doesn't look like himself"). If the face
  still drifts, fix it with a masked edit of the head only (ref = the poster + the portrait), compare side by side with
  the portrait, and keep the rest of the poster. Characters Shlomi plays: the lazy LEFT eye too.
  The masked edit: `tools/oai-image.js --ref poster.png --ref frame1.jpg --ref frame2.jpg --mask head-mask.png
  --prompt-file face.txt` (the mask = a PNG the poster's size, transparent over the head only; the prompt starts
  "Repaint only the masked area..." and ends "Everything outside the mask stays exactly the same"). A too-small hand or a
  childish face gets the same treatment. Put the result next to the frames in one picture and LOOK before you send.
- **The words come from Terra** (`gpt-5.6-terra`, `openai-leonardo` skill) - ask for several short options, pick.
- **Never stretch a picture to 9:16** - crop it or have the model paint it at 1088x1920 (Osnat, 9 Nov: "it's stretched").
  And he wants the story READY TO POST - the picture with its words, the brand and the link box - not a bare picture.
- **Send it to his Telegram ONCE, as one file** (a document, full quality). Never the same picture twice - photo + file
  annoyed him (10 Nov: "stop sending me everything twice").
- **Worked example**: `scripts/yotam-games/deadlock/story/` - `prompt3.txt` (the poster), `face2.txt` + `face-mask2.png`
  (the head fix from video frames), `story.html` + `shot.js` (brand + link box laid on in code -> `deadlock-story.jpg`).
  Copy that folder's story.html for the next one: change the picture and the words, keep the brand and the box.

**Then proofread every word at full size** (crop + zoom the headline). The model slips on single letters (it wrote
עכשין for עכשיו twice). Fix with an **edit pass on that same image**: ref = the image, prompt = "keep everything exactly,
change only <the word>: <what the letter must be and why it is wrong now>". That fixed it in one go where re-generating
didn't.

## New characters (a relative, a developer...)
When the story needs a person who has no photo (Hani's sister-in-law who "developed" the game): generate a realistic
person in the host's photo style (`--ref` the host photo), matching the audience (Haredi: modest, unmarried girl with a
braid, married woman's hair covered), show 2 options, let him pick. Then **ask for the name** (Haredi names often come
as two first names - offer options) and check the age reads right. A real person's photo he gives (the husband) is used
as-is. For a "family photo" give the model all of them as references in one prompt - it places them together far
better than pasted cut-outs.

## Posts (1080x1350)
Ask whether he wants them at all ("למה צריך פוסטים?" - for Yosef he used stories + the teaser only; the teaser is the post). If yes, the same way
as the stories (prompt files + references), size 1024x1280-ish, then fit to 1080x1350.

## Cut-outs (when you DO need a person on its own, e.g. in a video)
`tools/cut.py` - for studio photos on a plain grey backdrop: backdrop = grey that is low-saturation and not dark,
connected to the edge, plus enclosed gaps (between a head covering and the neck - zoom in on the head, he checks
there). `--hole-top 0.35` keeps enclosed grey/white lower down (a laptop, a white shirt, tzitzit). Check on a coloured
background at full size around the head before using.

## The launch teaser video (1080x1920, with sound) - what he signed off on
**A teaser is an ANNOUNCEMENT, not the story**: "new - now on the site - go read, hear and play". A tiny story hook only
(3 short lines), trailer pace ("much, much faster", "like a movie teaser - but Haredi, so a bit lame"). My first two
versions told the whole story slowly - rejected. **The host (Hani) is the hook** - big and clear in every frame.
- **Frames are designed by the image model too** (same as the stories): one frame per beat, the host big in each, the
  product art shown WHOLE, the beat's words baked in. My HTML-composited frames looked "like a draft" and cropped the
  pictures. Keep the frames in their own folder (`frames-art/`), never in a render temp folder.
- **A trailer voice-over** (ElevenLabs, one of the 8 Hebrew men's voices - play him all 8 saying the opening line in
  one file and let him pick by ear - print each voice's START SECOND in that file, he answers "the one at 19 sec"; the
  plan allows 5 ElevenLabs requests at once, run 4): "<brand> מציגה:" → "חדש!" → the product's NAME → the hook lines (from the real
  narration) → what it is ("ספר מוקרא, עשרה משחקים") → "עכשיו באתר!".
- **Tight**: trim silence at both ends of every clip, shorten pauses inside, speed the voice up (VO 1.2, narration 1.3),
  lay everything back to back - `tools/build-teaser.js` builds the whole timeline from a short BEATS list (frame + what's
  said over it) by measuring the cut clips. Changing the video = editing BEATS, not times.
- **A radio-ad disclaimer at the end** (he loved it): kosher / supervision, not active on Shabbat and holidays, music
  only, no chat or ads, who developed it, "images for illustration only" - read fast (x1.35 was right; x1.7 too fast),
  and the fine print on screen **synced line by line to the words** (scribe word timestamps), never covering the host's
  hands or a button. Check with him that any certification claim is true.
- Sound: niggun under everything, ducked by a sidechain compressor; whoosh on every cut, a thud on title hits, the
  product's own sounds on their beats.
- **End with "how do you get there"** and HOLD it (~9 s): his bio link is a list of ALL his links, so people won't find
  it. A clear frame + the voice: 1 נכנסים לקישור בביו, 2 מחפשים: <brand name>, 3 נכנסים ומשחקים - with a mock link list
  where the brand's button lights up and pulses, the host pointing at it.
- **Draft first**: `render-teaser.js --draft` (12 fps, half size) for review; full quality only after he says so.
- Clip the page (`html,body{overflow:clip}` + `body{contain:paint}`) - an overflowing RTL page renders shifted.
- The model keeps writing a word-final vav as a final nun (עכשין): avoid such words in baked text (כבר באתר!,
  כנסו לשחק!) and let the voice say them; zoom-proofread every frame. An edit pass may also re-frame the picture a
  little - re-check the host's hands and the edges after it.

## A gameplay promo clip for one game (~15 s, 9:16) - "אתה לא בורג", 9 Nov
His notes, in order: a 10 s cut of fast play was "completely not clear"; "it has to be clear we are presenting a NEW
game"; "use the actual title of the game all over the place". What he signed off on:
1. `שלומיוורס מציגים` bookend -> 2. a title card: the GAME'S OWN title art drops in over a blurred frame of the game +
"משחק חדש" -> 3. ONE clear loop of real play, one numbered caption per action (1. bring the candidate 2. give him what he
asked 3. sign - he leaves) -> 4. the end card = the Instagram story picture -> 5. `רק בשלומיוורס` bookend.
- The real game filmed by a bot on the browser's virtual clock (steady 30 fps, a visible finger ring on every tap), its
  real sounds logged and mixed back at their moments, its own music from frame 0, a white flash on every hand-over.
- The same title everywhere: title card, story text, end card, `videoTitle`. Never invent a marketing name for it.
- Worked example: `scripts/osnat-games/genz-hiring/promo/` (record.js, compose.py, caps.js, ig.html).

## The silent chapter video (for a song he adds in Instagram)
~5 s per chapter (slow - 2.5 s was too fast), host in the intro and the end card, each chapter = page picture +
one caption + a phone with that page's game. No sound in the file.

## Housekeeping
- Anything made from a real person's face never goes into git (keep it in git-ignored folders); commit only your own
  scripts / pages.
- Write scripts with the Write tool (Git Bash eats backslashes in heredocs); Windows Python needs encoding="utf-8".
