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
3. Footage folder `Downloads\drop\haredit-N` + the same folder on the phone's Drop page (an empty
   `gs://boostmind-drop/haredit-N/.keep` - `gcloud storage cp <an empty file> gs://boostmind-drop/haredit-N/.keep`), then
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
- haredit-3 = **WhatsApp stories** (his ask, 2026-11-01: "like a real WhatsApp, as we did on the previous video"): `_assets/haredit/story3/wa/` - the family group on Grandma's phone (`../../wa/wa.css`), Hani from the office computer, her photo + caption with the TITLE first in bold ("ניסי ניסים!!!" over the ruined car), 2-3 replies, Grandma's green one SIGNED in its text ("…, סבתא אוהבת" / "סבתא מכינה קוגל") - a green bubble has no name, he couldn't tell who sent it; shoot.mjs warns when the chat runs under the typing bar. **A place name goes IN the photo as a real sign** ("מוסך ויחנו ויסעו" above the garage door - GPT Image 2.5 writes short Hebrew signs right; make two, pick the correct spelling), never a label added on top ("not she added it"). Send as one Telegram album (sendMediaGroup). Two kids in one photo = one side-by-side reference of their canon portraits (`_assets/haredit/ref-sruli-yanky.jpg`, portrait 0.6) - both faces came out right first try (the hug story, "they are good brothers"). Ages from the tree / characters/hani: Yanky is 6 (not a baby - the baby is Shloimi, 1). **Both grandmas are Ashkenazi** - no "כפרות עליהם" (Sephardi); Yiddish-flavoured: "אַ מחיה!", "נחת", "שיהיו בריאים" (his note, 2026-11-01). An in-world business ad = **designed by GPT Image 2.5, never an HTML layout** (his words on my HTML flyers: "you are doing an awful job with how the advertisement looks. Ask OpenAI"): `ads/ai/head.txt` (a real ad for a Haredi weekly / Instagram, the photo used as is, exact Hebrew, no phone) + one `pN.txt` per ad (its purpose + exact text), `leonardo.mjs portrait <photo> pN.txt adN.jpg sunburst HIGH 0.6 1024x1280` ($0.06 each), proofread at full size, resize to 1080x1350 - all three came out like real ads first try. **The words = what that business really writes**, no invented slogans: he called "המוסך המשפחתי של בני ברק" and "המוסך של בני ברק" stupid ("do something which a real garage will do") - the headline became "מוסך מורשה / לכל סוגי הרכב". A one-line fix = an edit pass on the same image (ref = the ad, 0.8, "keep everything, change only ...").
- **מילון חני–עברי** (2026-11-01, his idea, "מושלם"): `_assets/haredit/dict/final/` - 30 stories (cover + one per expression: the word, a plain-Hebrew explanation, a "שימוש ביומיום:" quote from her lines, Hani below with a matching modest pose). Made the marketing-stories way: `head.txt` (series design system) + one prompt per word, `leonardo.mjs portrait <portrait-final.jpg>,<pilei.jpg as style ref> ... sunburst HIGH 0.6 1088x1920` ($0.05 each), first 4 shown, then the rest with the approved story as the 2nd reference - all consistent. **In-world content is REAL, never about the sketches** (his note): no "החרדית של המשרד", no "מהמערכונים", no "במערכון:" - she really is like this ("שימוש ביומיום", "בשפת ילדים"). Fixes = one edit pass per image (0.8). Its video = project `hani-milon` (2026-11-01, his ask "several seconds for each word"): an image layer of the 30 stories (cover 3.5 s, each word 5.5 s, 8-frame crossfades, box x -4 w 1088 so 1088x1920 fills), the freilach on Hani's own loop points (in 0 for 2459.1 frames, then in 14.7334 with a 26-frame overlap), a whoosh per word at volume 0.3 starting 2 frames early (its peak is at 0.08 s). 2:43; exported and sent on his word. Older HTML attempt (rejected): `_assets/haredit/ads/musach.html` -> `musach-post.jpg` (1080x1350, `shoot_post.mjs`) - played straight like the שפע עד flyers, the photo made from the story photo as reference so the sign matches, the text = a REAL local ad, no jokes from the video (his note: "your text is not that good. Just make it like an advertisement ... just add some small Bnei Brak stuff") - services, hours, "הנחה לאברכי כוללים", "גרר 24/6", "ו׳ וערבי חג עד 12:00 · סגור בשבתות וחגים"; no phone number. More of them: `grar.html` (the tow truck, "גרר 24/6") and `nes.html` (after an accident: "שמאי במקום"); shared `post.css`. The story photo's sign carries an invented phone number - crop it out (object-position) on anything published, it may be someone's real number. Finished posts go straight to his Telegram ("why isn't it in my Telegram?").
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

## haredit-4 - a REACTION video (2026-11-04: Yotam talks to the meeting room, we watch Hani react)
- He films the speaker first and wants him in the editor AT ONCE ("put a first version as fast as you can - I shoot Hani while hearing him"): send the raw take to Telegram first (seconds), then Analyze.
- Her takes were shot with his take playing: **sync by cross-correlating the loudness envelopes** (10 ms, log RMS) of his take vs each of hers -> hani_t = his_t + offset (A +2.56, B -21.77); check against one word. The cut follows HIS timeline. **Sound = whoever is on screen** (his note: "I rather hear only the voice from Hani when we see her - the full-quality Yotam voice only when he is on the screen"): one voice item per shot from the take shown (hers carries him through the speaker + her own whisper), synced to 1 ms (refine the envelope lag at 1 ms steps on 4 s windows at 4-5 points - A +2.581, B -21.772, no drift), 1-frame overlap, 0.03 s fades; transcribe the export - his words must read once, in order; every picture item's in = his time + that take's offset - so Hani never jumps, and a switch between her takes hides behind a shot of him ("don't make jumps, you can cut to Yotam"). **Mostly HER** (his note, 2026-11-04: "the editing itself should be mainly about Hani"): open on her already eating, stay on her through the name and her reaction - she SPAT the cookie out at the first "חני" (my first cut sat on Yotam right there and hid it); him only twice, ~2 s each (once, and once to hide the switch between her takes). LOOK at her takes at 3-6 fps around every name and every pause before placing a cut to him - a turn to the side to whisper to a friend ("את קולטת", almost mouthed, not in any transcript) and her big faces ("oh!", hands on face) are the jokes; my cuts to him covered three of them. Her hand reaching into the box above its top = the prop box starts higher (y0 0.22).
- **A background per person** ("they are sitting differently in the room"): the Set image layer gets one item per shot - his = the meeting room (TV wall), hers = the same room's reverse angle (windows; portrait from the first picture at 0.5). Both in the library.
- **The cookie box = prop_color hsv [[0,30,8],[180,255,255]], box [0.42,0.33,1,1]** (reference.md HELD PROPS 2b). keep.boxes looked right in the export but the EDITOR showed the box gone ("what is this shit... you didn't cut the box"). Check the editor's webm on green.
- Round 3 (2026-11-04): "start exactly from the okay" = from HIS mark (a "start here" note) - whisper word times run ~0.3 s early, check the export's first word is at 0.0. Her mouthed line ("את קולטת", a silent shout) = a big text pop above her head (text layer "צעקה בשקט": plain 118, white, navy stroke 14, scale 0.55->1.12->1, ~1.3 s on the wide-open mouth) - never a subtitle. A bad stretch of her = cut to him and come back on another moment of her (her head-covering play from the other take) - a cutaway makes any of her moments usable. Her hand above the box vs a wall object at the same height: the quality cut-out (matte_engine quality) + prop box from just above the box (0.335) - the hand reads as behind the box; use the hand-up moments only where a fingertip sliver is all that shows.
- **A cut-out person on a room photo must look IN the room** (his notes, 2026-11-04): it is the PHOTO, not a filter - "it doesn't make sense that you see the table behind Yotam, he is sitting near the table". The background = what is BEHIND that person's seat, shot from across the table at SEATED EYE HEIGHT, level: the wall behind them + the top of their empty chair's backrest, NO tabletop (`_assets/haredit/h4/seat-yotam.jpg` TV wall, `seat-hani.jpg` window wall; prompts next to them). Set blur 7 (a phone's background behind a close face), box x -100 w 1280. **No grade / vignette / grain on top** - he asked "did you add some filter on top of all? why?" (it greyed the picture).
- Round 4 (2026-11-04): **every "חני" = her REAL reaction, in order** ("any Hani mention she is מזועזעת - you changed the order, and I made sure to react to each one"): never put a moment of her from elsewhere after a mention; a cut to him ends ON the name and comes back to her synced. **His catchphrase on HIM** ("זה בסדר, זה בסדר" - show Yotam). Her silent shout = **word by word**, each word growing and fading in / out ("את" 0.6 s -> "קולטת?!" 1.0 s, scale 0.35 -> 1 -> 1.35/1.55).
- Export trap (fixed 2026-11-04 by Sketch Studio Online): a test export could fail on a just-added picture and leave the OLD out/<id>.test.mp4; now asset_public is locked and a test run deletes its old file first. Still: check the job ended ✔ before looking at stills.
- **The box + her hand, final (round 5, 2026-11-04)** - "the hand issue is all over the place": a gas tap on the wall sits right beside her fingers at the same height, so ONE colour box can't keep the hand and drop the tap. Split it: `keep.boxes` [[0.44,0.336,0.86,1],[0.86,0.368,1,1]] = the box (lid + front) as the real footage - her hand shows when it passes in front (live keep works in the editor since Sketch Studio Online's fix, 2026-11-04); `prop_color` all hues s>=30, box [0.64,0.20,1,0.37] = her hand above the box only, right of the tap; matte_engine quality. Measure on a raw crop with a grid where every wall object and the hand are before choosing boxes.
- If the synced take starts with her still for a second, start after his first word ("cut the okay - I don't want to see her frozen before it starts").
- Round 6 (2026-11-04): a cut script that REBUILDS the Set lane must use the current backgrounds - mine still named the old room photos and silently brought the table back behind Yotam ("you didn't fix Yotam's frame"). After every rebuild, look at one still of EACH person. His "I want to hear the first okay" while she is frozen in her take = open on HIM saying it (his own gesture), cut to her on the next word. Her hand over the kept box: prop_color's touch test counts the take's keep mask as the person (Sketch Studio Online, 2026-11-04) - so keep.boxes for the box + a colour box for the hand above it (right of any wall object) now keeps the whole hand. Check it in the editor's webm on green AND a test export.
- **Re-running Analyze on a hand-built cut resets `duration` to the builder's whole length** (haredit-4: 33 s -> 1:17, he: "why the end is so far?"). After every Analyze: `project set duration` back to the cut's length. The POV = the series box (haredit-3's ov.texts item: pov, light, size 62, y 300, w 940) - "פוב: החרדית של המשרד / ביקשה שיקראו לה חנה – חלק 4", first 5 s.
- Round 7 (2026-11-04): **open on HER** ("I really want to start with Hani - it's a good hook"), from his start mark, his first word heard over her. A close-up person needs a close wall behind: Yotam's TV-wall photo scaled 1.45x (box x -425, y -735, w 1856, h 2784) so the TV sits right behind his head ("it makes no sense Yotam is so far from the TV").
- **A still first moment in a synced take** ("Hani is frozen for a split second"): measure the frame-to-frame difference of the raw take at the start (mean abs diff, 180x320 grey) - she was still 0.33 s. Don't move the start (it cuts his first word): split the first piece - 1 s from her first movement at item `rate` 0.7, landing exactly on the synced `in` (+1.0 s); the sound is untouched.


## haredit-5 - a DIALOGUE in Osnat's (HR) room, each character filmed alone (his brief, 2026-11-08, the day before the shoot)
**The tool has dialogue rows since 2026-11-09 (layers.md -> "Dialogue"):** the next dialogue is made as a row per character
+ the "What we see" strip from the start; this one-row cut becomes a dialogue copy with `python tools/to_dialogue.py haredit-5 <new id>`.
Hani, Osnat and Yotam are each filmed on their own with the Reader (no stand-in, nothing copied from haredit-4). Project
`haredit-5`, script `scripts/haredit-5.txt`, Drop folder `haredit-5`. **He has no time for rounds: "make it good on first run".**
- **Cut EVERY silence** (his words: "cut any silence ... fast editing for the conversation") - this is NOT a phone call,
  so the "his pauses stay" rule of sections 3/5 does not apply. No dead air between lines or inside them. Kept only where
  the script asks for an acted beat: the mezuzah kiss before her first word, "(חני קופאת לרגע)", "(חני נשארת עם חיוך
  קפוא)" before Osnat's last line - LOOK at those frames, they are the joke, not silence.
- **Edit the talk like a film / series** (his words: "when someone still finishes you hear the second one start the
  answer ... the next one is already talking and you still see the first one ... the first one is still talking and you
  already see the next one"): the picture cut and the sound cut are NOT at the same moment.
  - sound: the next line often starts 0.15-0.4 s over the tail of the one before (the last word or two, never the
    punchline / a name / a number like "שבעה שקלים ועשרים אגורות"); interruptions start earlier (rule 4 in SKILL.md);
  - picture, mixed through the video (never the same pattern twice in a row): **J-cut** = we hear the next speaker
    while still seeing the one who just finished (their listening face), then cut to the speaker; **L-cut** = we already
    see the next speaker (or the listener's reaction) while the first one finishes; and some straight cuts;
  - Hani's long runs (the miracle story, the yichus chain, the pilpul) = cut away to Osnat's / Yotam's reactions in the
    middle (Osnat's fake rolling laugh, tongue between her teeth; Yotam lost) while Hani's voice runs on - reactions from
    the frames before / after their own lines in their takes (or a take where he only reacts).
  - How: the Person lane's pieces and the Voice lane's items are separate (like haredit-4's cut script, ops with rev),
    voice from the take of whoever SPEAKS, picture from whoever we SEE, each with its own background item. Check each
    join by listening - one voice must never be cut mid-word by the next one's fade.
- **Backgrounds per shot** (`_assets/haredit/h5/`, already in the project's Media; checked against the script 2026-11-08):
  - Hani in the doorway (greeting, kissing the mezuzah) = `door-in.jpg` (Osnat's view: mezuzah on the LEFT doorpost, the
    open space behind her). If his hand / the kiss lands on the other side of his head, mirror the take or the background
    so the mezuzah is on the side he kisses.
  - Osnat at her desk = `osnat-seat.jpg` (corkboard, orchid, pastel binders behind her - she faces the door).
  - Hani sitting = `hani-seat.jpg` (Osnat's view: guest chair backrest, the doorway + frosted glass behind her).
  - Yotam - he comes INTO the room ("יותם נכנס ... יותם יוצא", Hani and Osnat stay seated): he stands in the doorway =
    `door-in.jpg` (the open space he asked for shows through it). `corridor-yotam.jpg` (the open space, no doorway) only
    if he is shot walking up in the corridor. Ask nothing - pick by the footage.
  - Before handing over: one still of EACH person on EACH background they use (big), people at a believable size for the
    distance (a standing person close in the doorway; seated ones at the chair's height, the backrest under the shoulders).
- The opening (2026-11-08): greeting at the door -> Osnat "מה שלומך?" -> Hani sits -> the miracle story (שלוימי, 1, choked
  on an apple Brachi gave him; אברהם משה home only because רֶבּ שמוליק went to the ER) -> into the name request.
- **Hani's pass (2026-11-09):** her 18 takes came in the Drop folder "חני ומשאבי אנוש" (not `haredit-5` - pulled by hand
  into the project's folder). The cut is `episodes/haredit-5/work/cut.py` (SPEC = the dialogue in script order: Hani's
  pieces + Osnat / Yotam lines waiting for their takes; silences >= 0.3 s cut by voice level, acted beats `keep`;
  subtitles = the script's words on the recogniser's times; every piece its own Set item) - run it again after any change
  and after Osnat / Yotam land (fill their takes into SPEC, then the J/L offsets). Picks: greeting take 2 (the clearer
  kiss), name take 6, yichus 10 + 11, "אני אזוז" 14 (its silent tail = the freeze at Yotam), goodbye 18 (stands with the
  bag). Hani mirrored (her mezuzah hand lands on the door picture's side), seated y 150 / door y 0, subtitles y 1430.
  Hani's Yotam lines (takes 15-17, she looks at the lens) = `hani-seat-door.jpg` (Yotam's view from the doorway).
- **Yotam (2026-11-09):** 5 takes in the same Drop folder; he shot his entrance twice and chose **the wider one from below
  at the door** ("not the first one") = y4 (y5 = same angle, y1 + y2 = the first one in the room, not used); y3 = all his
  answers. A shot from below needs a background from below: `door-up.jpg` (the doorway from Hani's chair, tilted up,
  ceiling lights). **Yotam's items `mirror: false`** (his shirt has words) while the Hani row stays mirrored. Each
  character its own voice row (`voice` Hani, `voice.yotam`, later `voice.osnat`) - voices overlap at a change of speaker.
  cut.py now plans turns: sound overlap 0.12-0.3 s at a change of speaker, picture J / L / straight in turn using the
  pauses in each take (the listening face after / before a line), no picture under 0.8 s; his "חני!" plays over Hani
  freezing (her take 14 runs on) and we cut to him on "אנחנו רוצים".
- **Osnat (2026-11-09):** 13 takes; he added her EATING ("place it while Hani talks, ping-pong, she's not responding") and
  asked that the chewing be heard under ALL of Hani's talking while she eats ("if you show Osnat chewing and then Hani
  without the chewing noise it will be strange"). Done as: a chewing row (`chew`, o2's sound in passes with 0.3 s
  cross-fades, x4 - it sat ~20 dB under her voice as shot; skip its loud bite at 12.8 s) from her greeting to her next
  line, and a 1.5 s cutaway to her every ~6 s whose picture `in` = the chewing row's own time at that moment, so mouth
  and sound always match; cutaways sit on Hani's jump cuts to hide them. **His silent moments are hard to find and
  important** ("find it because it's important"): Hani's whispered "את קולטת?!" to Osnat when Yotam calls her "חני" was
  in the silent tail of Hani's take 13 (shocked 5.4 s, turns to the lens and mouths it 8.7-10.5 - frames at 5 fps, the
  whisper is near silence); Osnat's answer = a silent take (o12) - the slow nod with eyes closed at 3.4-5.8 s (face crops
  at 5 fps). Both play over Yotam's talk (`cover`), the words word by word on top (text row must be the TOP layer -
  index 0 is the bottom, it hid behind the set).
- **His notes on the first full cut (2026-11-09): "the editing is really bad - the conversation must flow".** His dialogue
  rule: **whoever talks is SEEN when they start** - cut to the next speaker early (L) or straight, never stay on the
  one who finished while the next talks (J cuts read as wrong to him: "cut to Osnat first because she starts"); Yotam
  seen AND heard as he arrives (the reaction beat comes after his first line, not over it); no cutaway over the
  speaker's big lines ("את קולטת חייבים לראות") - cutaways only while someone narrates; tighter (silences >= 0.2 s cut,
  0.2-0.35 s overlap between speakers); drop a redundant opening after the other's answer ("start from here after
  Osnat answers"). **Every voice in one atmosphere** ("Osnat sounds much better than Hani"): measure the bands through
  the editor's chain and match (Hani needed +11 warmth, +4 presence); the same light clean / speech level / small room
  on each row. **Scan every frame** for face-filter slips and recording starts (motion + sharpness per frame at 10 fps,
  `work/scan.py`, then look at the flagged spots): take 6 and take 3 lost the filter on a lunge / head swing.
  "The frames are excellent" - Hani raised against the chair (seat pictures 1.35x, backrest lower).
- **Version 3 (2026-11-09, his 35 notes + "the talk must be MUCH faster, I'm begging"):** the overlaps never happened
  because line ENDS were measured with a loose threshold (breath + room counted as voice) - measure edges strictly
  (peak - 24 dB), cut silences under peak - 28 dB (>= 0.18 s), clamp an end before the next transcript word; then a
  300-500 ms overlap is real. He wants J and L both ("sound continues into the next shot, or starts before its
  picture") - the earlier "cut to Osnat first" was a J that ran too long. **Osnat's tongue laugh plays on her face into
  the next speaker's first words** (laughs found by sound outside words after her lines, confirmed on mouth crops).
  **No frame from the first 0.7 s / last 0.45 s of any take** (most of his notes were recording starts / stops reached
  by L / J extensions, inserts, the end). Retake switches hidden behind Osnat. Hani pitch +0.5 (as haredit-2/3), the
  freilach bed 0.12, speed 1.3. A dramatic turn = stinger + push-in. A mezuzah must sit where the hand touches.
  Checks before handing over: `work/scan.py` (frames), `work/words_check.py` (each line transcribed as cut).
- **Version 5 (2026-11-09) - he called it "amazing"**: no fades anywhere (his rule: a 0.01 s click guard only); every
  line's sound starts 0.3 s before and ends 0.3 s after its picture ("so the sound always starts before and ends
  after", every cut); silences cut only at a word boundary (a silence INSIDE a word - "בק..טע", "תפ..וח" - stays; whisper
  boundaries = the midpoint between two words, within 0.04 s); a line never starts inside its take's previous word
  (the tail of "בכל" played twice); Yotam's entrance one unbroken piece; the look between Hani and Osnat on its OWN
  rows (glance + glance.bg) for him to adjust. Captions: line by line (overlaps never mix words), the script's word
  only where it was SAID (OpenAI gpt-4o-transcribe per line, `work/subs_check.py`, design key, ~$0.02), then a fixed
  list of hand corrections. A copy in the dialogue format: `tools/to_dialogue.py haredit-5 haredit-5-dialogue`.
  **Export trap**: the sound graph can fail under load during a Full export and the older mix goes out (and is sent!)
  - read the export log for "sound graph failed" before telling him it's sent; workaround = run tools/audio_layers.mjs
  on the job alone, touch job.<key>.done, export again. FIXED the same day by Sketch Studio Online (protocolTimeout 30 min,
  a second sound pass after the picture, a Full export that still fails exits 1 and sends nothing) - no workaround now.
- **The ending (haredit-5, 2026-11-09)**: a sponsor poster in the in-world brand ("הסרטון בחסות עיגוליות" - GPT Image from
  the real `ads/igulyot-box.jpg`, the slogan "מפוצץ שוקולד / ובכלל פרווה!" ON the picture) with a Leonardo dialogue-v3
  voice-over (vowel marks: "פַּרְוֶה", plain was read as fur), then a Shlomiverse card: the space look of
  `_assets/shlomiverse/source/frame-logo.jpg` with a SMALL logo, the product, the slogan again and "shlomiverse.com"
  glowing orange ("לאזרחי השלומיוורס – הנחה מיוחדת!"). Never a plain white text box ("super bad... we have a very good
  standard"). The voice-over = ONE continuous read by the same voice (a second, separate read sounded worse); the
  Shlomiverse part sped up with ffmpeg atempo (pitch kept) - he settled on x1.2 after x2 ("way too fast") and x1.4.
  The site's words: תייר / תושב / אזרח, never "משתמשים"; ask Shlomiverse Conversion for the funnel wording.
- **A story picture with many real people** (the "how Hani knows Rivki Weiss" connection board): GPT Image places 8
  references badly (wrong card, repeats) - make each photo on its own (canon portraits as refs: Avraham Moshe, Shindy,
  Savta Friedman from `tree/`), have GPT empty the board ("remove all pinned photos, keep everything else"), then pin
  the photos in code (PIL: white frame, slight tilt, shadow, red pin) - one per card, never two the same
  (`h5/story/compose.py`). It is a connection board, not a family tree.
