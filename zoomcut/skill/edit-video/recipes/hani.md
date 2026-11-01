# A new Hani video (haredit-N) - step by step

How haredit-1 and haredit-2 were made, written so a new session can make the next one without him repeating himself.
**haredit-2 is the reference video** ("POV: אתה יושב ליד החרדית של המשרד – חלק 2", 2026-10-28, 61 s at 1.17x): open
`episodes/haredit-2/project.json` and copy what it does. The rules behind each step are in `offscreen-voice.md` →
Series "hani" and SKILL.md → "ElevenLabs - the whole toolbox"; this page is the order to do them in.

Who: **Hani Friedman** (חני פרידמן), Haredi backend developer at Techy-Tech (Data & AI, under Erez, next to Yotam).
He plays her (wig, glasses, navy blouse). Husband Avraham Moshe (אברך), nine kids - the profiles are in
`characters/` (`hani`, `brachi` 10, `sruli` 8 with the cast, `malki` 3, `shterni`, `yanky`, `ruchami`...). Her
kosher phone has no WhatsApp. She is calm, grateful ("ניסי ניסים", "ברוך השם") while everything burns around her.
The joke: the chaos on the other side of the phone, played nonchalant.

## 0. Before anything
- Studio up at http://localhost:4747 (`cd zoomcut/render && node server.mjs`); `GET /api/jobs` → `busy` empty
  before any build. Never restart it while a job runs.
- Read SKILL.md (the editor rules), `layers.md` (the format), `offscreen-voice.md` → Series "hani".

## 1. The script → the Reader (he films with it)
He gives a script. Make it a project at once so it shows in the Reader:
1. `POST /api/scripts {name: "haredit-3"}`, `PUT /api/scripts/haredit-3 {text}`. First line `# <title>` (the hook,
   e.g. `# POV: אתה יושב ליד החרדית של המשרד – חלק 3 (haredit-3)`). Only what Hani SAYS, one line per row;
   directions on their own row in parentheses `(מכסה את הטלפון)`, never inside a spoken line, never `**`.
   Write the hook and the Reader text exactly as he wrote it - Hebrew only through files, never through the console.
2. **The other side of every call goes in the script too** - he writes Brachi's (or whoever's) real lines. If he
   didn't, write them in her voice (deadpan 10-year-old reporting disaster), show him, and add them. Real words,
   never mumble: "where it was real speech it works really great".
   **Brachi's lines go in the Reader as direction rows** - `(ברכי – אימא, ברח ליענקי במכנסיים!)` right after the line
   she answers (haredit-3, 2026-10-30): he sees where to leave her pause while filming, Play never stops on them, and
   the pipeline ignores them (a spoken row of hers would count as a "missing" line of his).
   **A dash, never a colon** (2026-11-01): the Reader takes any row starting "Name:" as a character - even inside
   parentheses - and Hani's lines (no "Name:") then vanish; he saw only "הוראת בימוי". Check the script has no `:`
   outside the `#` title row.
3. Footage folder `Downloads\drop\haredit-N` + the same folder on the phone's Drop page (`POST
   https://drop-463727469066.me-west1.run.app/api/mkdir {k: DROP_KEY from zoomcut/.env, folder}`), then
   `POST /api/new {name: "haredit-3", folder, from: "haredit-2"}` - `from` copies the set, music, voice, look.
   Set the project's `script` to `haredit-3` and its Hebrew `title` (episode.json - `script` is not a config key).
   Tell him: "refresh the Reader, pick haredit-3".
   - **Never the Reader's "Create a new project… settings like haredit-2"** (`/api/new-from-script` with `like`): the
     copy keeps `script: "haredit-2"`, so the new text is written OVER haredit-2's script (found 2026-10-30, not yet
     fixed in the tool).
   - `from` also carries the old video's take-bound keys: delete `sequence`, `props`, `captions_from`, `cut.removes`
     and `media` (its `media/` paths don't exist in the new folder) before the first Analyze.

## 2. Hani's look and sound - copy haredit-2 exactly (he: "everything was perfect, we need the same")
Read `episodes/haredit-2/project.json` and make the same layers with ops (`POST /api/p/<id>/ops {rev, ops}`):
| layer | what | settings |
|---|---|---|
| Set (image) | `_assets/haredit/set-wall-a.jpg` | box x -302 y -450 w 1800, unblurred |
| Stickers (behind) | `kids.png` (nine kids in a gold frame) | x -8 y 414 w 398, BELOW Person |
| family-framed (image) | `family-framed.png` (Hani + daughters) | x 573 y 854 w 585, BELOW Person |
| Person (video) | his takes, cut out (`matte_engine: body`, `matte_cut` 70) | person y 150, eye contact OFF |
| Texts | the POV hook | style pov, font assistant, theme light, y 300, size 62, 0-5.5 s |
| Subtitles | from the script (`captions_from: "file"` once fixed) | assistant 800, 66, white, stroke 10, y 1430 |
| Voice | his voice | `fx.pitch` 0.5, `clean: "fft"`, NO voice preset |
| Music | `_assets/music/fast/klezmer-ska.mp3` | volume 0.05 |
| music-hasidic-freilach | his own second bed | volume 0.12 |
Speed 1.15-1.17. Upload pictures with `POST /api/p/<id>/assets?name=<file>&cutout=0`. No office ambience (he
deleted it). New pictures (a prop, an ad, a family photo) = `tools/leonardo.mjs` (OpenAI direct), flare for people / sunburst for products,
MEDIUM 1024 - but children: see SKILL.md → "Leonardo and children" before spending.

## 3. The phone calls - the heart of the video
Everything Hani hears on the phone is made with ElevenLabs (`ELEVENLABS_API_KEY` in `zoomcut/.env`, never printed)
and lives in `_assets/haredit/calls/` (haredit-2's files are there - reuse the house sounds, make new lines).

**3a. The caller's lines (Brachi, a little kid)**
- One file per line: `POST https://api.elevenlabs.io/v1/text-to-speech/Tbj9UQjXon5RB9MPEyc2` (Zina, a young adult
  Hebrew voice - Voice Design refuses children, never rephrase around it), `model_id: "eleven_v4"`,
  `language_code: "he"`, `voice_settings {stability: 0.3, similarity_boost: 0.75}`.
- Direct the delivery with audio tags in the text: `[flat, matter-of-fact]`, `[whining]`, `[panicked, out of
  breath]`, `[crying, shouting]`... (`...` = pause, `—` = cut off). Tags are not read aloud.
- Names with niqqud (שְׁרוּלִי - without it v4 said "שאולי"). Write the request body to a JSON file (UTF-8) and post it
  with `curl --data-binary @file` - never Hebrew on the command line.
- **Transcribe every generated line** (faster-whisper) and regenerate any that came out wrong.
- Name them `brachi3-rNN.mp3` (don't overwrite haredit-2's `brachi-rNN`). Level them all to one loudness
  (~-20 dB active) with a per-file gain.

**3b. The house behind her**
- Sound effects: `POST /v1/sound-generation {text, duration_seconds 0.5-30, model_id "eleven_text_to_sound_v2",
  prompt_influence 0.5}`; `loop: true` for a bed. Specific prompts with context ("a boy with a plaster leg cast
  clumsily climbing a wooden kitchen cabinet: wood creaking, doors banging, a heavy thud").
- One looping chaos bed under the whole call (`house-bed.mp3`) + one file per event (crash, crying, cookie tin,
  shower), each its own item, timed to a word (the crash, then the crying, right before "מי בוכה שם?").
- **Only what happens DURING the call is heard happening** (his note, haredit-3, 2026-10-30): Sruli slipped minutes
  before Brachi calls ("the father asked her to call") - so no fall / thud, but the hurt kid moaning in the
  background through the whole call (`sruli3-moan.mp3`, a wordless sfx loop, ~8 dB under Brachi) + one v4
  `[groaning in pain] אוי... כואב` (pitch 1.4) right after she reports it. Ask: is this event live or already over?
- **Any word is TTS, never a sound effect** (the sfx model said "mommy" in English): "אמא! אמא!" = v4
  `[crying, shouting] אמאאא! אמא!` dry.
- A sound that lasts through a moment (shower, TV) starts with the scene and stops on the line that stops it
  ("ותגידי לו שיחכה") - `shower-loop.mp3` on its own lane.
- The ring before each call: `kosher-ring.mp3` (in the room, no filter, gain ~0.1) on the previous line's last words.

**3c. Into the editor - 4 lanes, like haredit-2**
Upload each file (`/assets?name=`), then audio layers with ops:
| lane | what | volume |
|---|---|---|
| ברכי בטלפון | her lines: item `fx {filter: "phone"}` + the SAME filter on the layer (`layer.update props.fx`) = a stronger phone; **pitch 1.6, tempo 1.0** (haredit-3: "brachi is way too fast" at 1.7x1.3) | **0.8** ("לא שומעים את ברכי") |
| הבית ברקע | the looping house bed, `filter: phone` | **0.18** - the house under her, never over her |
| אירועים וצלצולים | crashes, crying, the ring (ring without filter) | 0.35 |
| מקלחת | the shower loop, `filter: phone` | 0.35 |
- **Chipmunk = pitch 1.7** on the item (it speeds up with it: 4.8 s → 2.6 s). His words: "like chipmunks, a little
  girl saying stuff quick".
- **Place her lines in HIS pauses**: each starts on his pause and may run under his next words. His pauses are
  0.1-0.4 s - **never slow Hani down to make room** ("if you need, make Brachi speak faster"). When he covers the
  phone and talks to a colleague, her nagging keeps going under him ~7 dB softer until he's back.
- **The whole call is QUIET** (asked three times: "it's coming out of the phone... it can't be louder than her"):
  every lane through `filter: phone` at 0.3-0.35 - clear, but plainly a phone at her ear. House events still punch
  (item gains 0.6-0.9 within the lane). Only the desk ring is in the room.
- Nobody else speaks - no office mumbles, no colleagues' voices.

## 4. Before the footage: build it on a stand-in
So he sees every layer before he films: edge-tts `he-IL-HilaNeural` reads the script over his reference photo,
"STAND-IN" burnt in, `episodes/haredit-3/stand-in/` (git-ignored, like haredit-2's), `input_dir` there,
Analyze through the studio (`POST /api/p/haredit-3/build {action: "analyze"}`). Then lay the call lanes on it. Hand
items made for the stand-in must be trimmed to the real length later.

## 5. His real takes
He uploads through the Drop (iPhone; random file names). Several takes of a passage, sometimes a line shot later.
1. Transcribe every file; order by recording time; read his Use / Don't use marks in Media (his Use = the takes).
2. Pick repeats into `sequence` - cut where the next take starts the sentence again (measure the dip at 10 ms).
   Narrow `takes` to the files used (unused takes still get cut out - minutes each).
3. `cut`: merge 0.6, pad_in 0.05, pad_out 0.15, join 0.2, **`silence: false`** (his pauses stay - the calls need
   them). The record tap (~1 s bump) makes a piece start early: give that take a `from` just before the first word.
4. Acted silent moments (a blessing, a bite, a drink, a whisper, a hand to a colleague) = `lead_in` / `keep_pauses`
   - look at the frames of every long pause; a whisper sits at the room's floor and the cut thinks it's silence.
   Whispers get hand-timed subtitles (ops on `subs`), then freeze `captions_from: "file"`.
5. His ad-libs go into the Reader script so the subtitles follow what he said.
6. A held prop the cut-out drops (cookie box) = episode.json `props` (reference.md); a sign read backwards =
   Person → Mirror.
7. Analyze through the studio. Then re-place every call item on the real pauses (they moved).
8. **No behind-the-scenes arm** (his words, haredit-3, 2026-11-01): "when you see my arm reaching from the mobile
   which is taking the shot ... I just clicked on record and pull my hand back. It's like behind the scenes." Every
   take's head and tail: a contact sheet every 0.15 s around the first / last word; the big blurred arm near the lens
   (usually bottom-right, ~0.6-1.3 s after the tap, ~0.6 s after the last word) is out - `sequence` from / to.
   **His hands on his head, gestures, the phone at the ear are acting - they stay.** He wants this automatic in the
   editor one day (tool work, separate).
9. **Put the call sounds straight on the takes** - episode.json `sounds` are in take seconds, so place them from the
   word timings + a 10 ms energy scan (Whisper hides pauses inside words) BEFORE Analyze; the builder lays them.
   His real pauses in a call are 0.3-0.7 s: trim Brachi to the part that fits (`from` / `to` on the item - "אמא, ברח
   ליענקי במכנסיים" without the rest), split a line around his reaction ("כן, אמא!" → his "אוי ואבוי" → the rest),
   or make a shorter line. An acted moment before the first word (leaning to the fridge, listening on the phone) =
   `cut.lead_in` {take: [a, b]} with b BEFORE the piece's first start (else it's ignored).

## 6. Check before he sees it
- `matched X/Y · N missing` - a missing line: measure and transcribe that span before calling it missing; if it's
  really not there, tell him who / which line / where.
- After a rebuild, check the picture lane has no gaps and the hand items still fit (SKILL.md, the flash check:
  `tools/flash_frames.py` on the export).
- Listen to every call: Brachi clear but phone-quiet, the house under her, Hani never slowed.
- Hand over: the link, the length, 2-4 timestamps, "you can drag any cut edge to pull footage back", and the post
  caption + YouTube title saved in the Send window. He fine-tunes and presses Send himself.

## 7. After - what each Hani video also got
- Story posters (Instagram + TikTok): haredit-1 = a pashkevil (`_assets/haredit/story/`); haredit-2 = שפע עד
  newspaper ads (`_assets/haredit/ads/`, plain newspaper look - one headline, a big product photo, nothing he didn't
  ask for).
- haredit-3 = **WhatsApp stories** (his ask, 2026-11-01: "like a real WhatsApp, as we did on the previous video"): `_assets/haredit/story3/wa/` - the family group on Grandma's phone (`../../wa/wa.css`), Hani from the office computer, her photo + caption with the TITLE first in bold ("ניסי ניסים!!!" over the ruined car), 2-3 replies, Grandma's green one SIGNED in its text ("…, סבתא אוהבת" / "סבתא מכינה קוגל") - a green bubble has no name, he couldn't tell who sent it; shoot.mjs warns when the chat runs under the typing bar. **A place name goes IN the photo as a real sign** ("מוסך ויחנו ויסעו" above the garage door - GPT Image 2.5 writes short Hebrew signs right; make two, pick the correct spelling), never a label added on top ("not she added it"). Send as one Telegram album (sendMediaGroup). Two kids in one photo = one side-by-side reference of their canon portraits (`_assets/haredit/ref-sruli-yanky.jpg`, portrait 0.6) - both faces came out right first try (the hug story, "they are good brothers"). Ages from the tree / characters/hani: Yanky is 6 (not a baby - the baby is Shloimi, 1). **Both grandmas are Ashkenazi** - no "כפרות עליהם" (Sephardi); Yiddish-flavoured: "אַ מחיה!", "נחת", "שיהיו בריאים" (his note, 2026-11-01).
- The wiki / links page when he publishes (wiki.md).
- Each new family member or caller = a character profile (`POST /api/characters/<id>`), relations both ways.

## Everything his 76 notes on haredit-2 taught (5 rounds, 2026-10-28) - do these BEFORE he has to say them
His notes are in `episodes/haredit-2/project.json` → `notes` (each with my reply) - read them. What they add up to:

**Rhythm - tight, but every word whole**
- Between pieces: **no gap, no pause** - the next line starts right on the last word of the one before (14 of his
  notes were "tighten" / "cut the silence here"). His pauses INSIDE a call stay (Brachi lives in them), but a dead
  pause between two of his lines is cut.
- **Never eat a word doing it**: "עשינו" lost its last syllable to a crossfade three times, "מה השעה?" and "זה מה
  שקורה" were cut too close. After every tightening, transcribe the join and check the last and first word.
- A swallowed word / a "tsk" / "מה?" before the real line = cut out, straight to the line ("טוב, תעזרי לו").
- Start of the video: not on his hand going back from the record button (cut 0.2 s later); her head fully in frame.
- Start of a take: when she is already moving - a still frame then movement "looks like I freeze and then start".
- A transition between rooms / takes: 2 frames of the shot before, not 7.
- The end: on her last real line ("הכל טוב, בשורות טובות"), before she walks out with extra goodbyes.

**The acted moments are the comedy - keep them, tight**
- Kissing the hands after "חסדו" / "ורגע", the finger "wait", the lips, the mumble - he notices when one is missing.
- The cookie blessing: start when the cookie is already at her mouth, the whole blessing + a little chewing, then
  the colleague's request. Not the long grab, not long chewing.
- The whispered grace: one piece from the moment she is already praying (not from him starting the camera) straight
  into the mumble - no jump from silence to a sudden rustle.
- The phone after "מה רצית?": the ring starts on the cut, she turns and answers at once (0.9 s, not 2).

**His takes**
- **Use the takes he marked Use** (he checked three times). When two takes cover the same passage, his note on the
  take says which; one that plays straight through beats a jump between two takes.
- Where a take was cut just to remove a word, prefer letting the better take run on.

**Framing**
- No empty sides or bottom in any shot - make her bigger (box 1200-1340 wide) and lower rather than show the edge.
- A held prop (the cookie box) must stay visible while she uses / tosses it - `props` in episode.json, or a bigger
  framing so the empty edge is out of the frame.
- After enlarging a piece, check it didn't keep its old length and overlap the next piece of the same take ("two
  videos merging").

**Brachi (the caller)**
- **Louder and clearer than the house** - every line levelled to one loudness, the house mess turned down under her
  (later: the whole call quiet relative to Hani, Brachi still the clearest thing in it).
- **She answers every question**, right as Hani's question ends - not in the middle of it, never silence where an
  answer belongs ("מי בוכה שם?" → "יענקי!"). Missing answers = generate them in her voice.
- All real words, all chipmunk - never some mumble and some words.
- While Hani talks to a colleague with the phone covered, Brachi keeps talking nonstop underneath, softer -
  generate more lines if she runs out.
- Her last line ("טוב, אימא, ביי!") may carry over into the next part.
- **Never slow Hani to fit her** - slow motion froze the picture and went black in the export. Speed Brachi up.

**Subtitles and stickers**
- Every word he says gets a subtitle, including short ones ("ברכי, אני איתך,").
- A mumbled blessing gets its words as a subtitle over the mumble: "בורא מיני מזונות", "...יברך את עמו בשלום." -
  starting where the mumble starts; no השם in it.
- Puns get the pun spelling ("לגו-יים").
- A sticker he didn't ask for goes (the 4:20 sticker was removed).
- The ring at the end ("כמעט שכחתי את הפלאפון") must be audible - he noticed when it was missing.

**Export**
- Run `tools/flash_frames.py` on every export: a third of the cuts once showed one frame of the empty set.
- He keeps his own edits (speed 1.17, a subtitle split, a Brachi line he removed) - a rebuild must never undo them.

**His notes on haredit-3 (2026-11-01, 19 notes) - do these before he has to say them**
- **Brachi must be heard**: Brachi lane 0.55, house lane 0.18, both still `filter: phone`.
- **The pickup is a moment**: start the call take while she is working, the ring, she looks at the phone, picks up -
  not on the first word. The ring (`kosher-ring.mp3`, gain 0.6, in the room) must be clearly audible both times.
- A call that starts on a new take: the hand is ALREADY at the ear (after the record arm), never the phone rising.
- **"דסי" before a line is part of the line** - keep it and put it in the subtitles (the aligner dropped it: whisper
  heard "טסי"). Check every take's first word against the audio.
- **Never a lead_in right before speech**: the 0.2 s join crossfade fades out the first word ("דסי" was lost). Pull
  the piece's start back with `cut.edges` {take: [[was, now]]} instead - one continuous piece. `was` must be the
  RAW span edge (`lesson.spans(ls, take)`), not the timeline item's end (23.39, not 23.2).
- Acted beats after a line stay (kissing the hands after "חס ושלום") - extend the end with `edges` up to the arm.
- **A box / sign to the front camera reads backwards** -> `mirror: true` on that piece (item.update, after the last
  rebuild) + `props` so the cut-out keeps it solid ("לא רואים את העיגוליות").
- End on the punchline he marks ("את הפלאפון שכחתי!"), not on the extra goodbye.
- Every pause between his lines he hears is a note: after Analyze cut each 0.25 s+ dead pause (10 ms energy scan).
- **Mirror every take** (person layer `mirror: true`): he films with the front camera, so all of it is mirrored -
  "need to mirror all the videos so it would make sense" (not only the piece with the box).
- **Brachi answers EVERY line of his that asks or repeats** ("ברח ליענקי במכנסיים?" -> "כן!", "הלו?" -> "אמא!"),
  and while he talks to a colleague she nags LOUD the whole time ("she needs to drive Hani crazy") - never softer.
  Say the thing he reacts to plainly ("זה לא פיפי, זה קקי!" before "זה גדויילים?").
- Fit her by the audio energy, not Whisper's word ends (Whisper ends "מה קרה?" 0.2 s early - she came in on top of
  him). Where his reply repeats her words, drop her opening word so his echo comes after hers.
- A volume he once set on a Brachi item (`user: true`) survives every rebuild with its old rate - after changing her
  speed, check the lane for user items and set them to the new values.
- **Hani says the news out loud** (his re-shoot, 2026-11-01: "אוי ואבוי, שרולי החליק על הגדויילים של יענקי"): the
  viewer must hear the event from HER, not only from the chipmunk on the phone - when writing the script, give Hani
  a line that repeats each piece of news. A re-shot line goes in as its own `sequence` entry between the takes, its
  head pulled back with `edges` to the hand-at-ear beat (room for Brachi), mirrored like the rest (layer mirror).
- **How a cut sounds** (measured, haredit-3): the outgoing piece's voice runs 0.2 s past its picture and fades out
  over those 0.2 s; the next piece starts AT ONCE (12 ms fade). So for a pause cut `[r0, r1]` in one take: r0 = the
  last word's end (10 ms energy, -30 dB) + 0.17, r1 = the next word's start - 0.04 -> heard pause ~0, nothing
  clipped. A cut tighter than that fades the last word ("יענקי" lost its end, "מה" vanished at a take join). After
  every tightening, play the join the same way (fade the tail, start the next at once) and transcribe it.
- **A framing change on a piece (box) makes it `user: true`** - he moves pieces himself (y 150 -> ~4). After any
  rebuild that moves cuts, his framed pieces keep their OLD start / length and lie over the new ones: for each user
  piece whose take start changed, copy its box to the new piece(s) of that take and remove the stale one; fix the
  length of one whose start stayed. Then: no gaps / overlaps in the picture lane.
- **Brachi starts ~0.2 s EARLIER than "right after his pause starts"** (his rule, 2026-11-01: "always start Brachi a bit
  before") - she comes in on the tail of his last word, like a kid who doesn't wait.
- **Test every chipmunk line at her playback speed** (asetrate 1.6, transcribe 3x): "יצא למנחה" at 1.6 is heard as
  "ביי" ("תודה. יצא לה מנחה"), "הלך למנחה" turned to mush; "אבא במנחה" held. Pick words with clear consonants.
- **Trap: `sounds` items are named by their index** (`x12` = sounds[12]); a deleted item is remembered by that index
  (layer `removed`). Deleting or inserting a sound in episode.json shifts every later id - an old deletion then hides
  a different sound (the ring vanished). After changing `sounds`, check the call lanes item by item; clear stale
  `removed` with `layer.update {set: {removed: []}}`.

## What he rejected (don't repeat)
Mumble slices instead of words · other voices in the office · the call louder than Hani · slow-motion on Hani to fit
the caller · reverb / "far away" baked into a phone voice · a shower that ends on its own · English words from the
sound-effects model · the office ambience · slow, sparse music beds · a blurred set · adding things he didn't ask for.
