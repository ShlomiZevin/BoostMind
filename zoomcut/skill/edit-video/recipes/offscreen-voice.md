# Recipe: one person + a voice we don't see (a Zoom at his desk, a phone call on speaker) - engine `lesson.py`

He acts to the other voice in one continuous take; the other voice is a sound layer laid over him.

## Series "security" - broken security guy at his desk, an off-screen Zoom voice (security-1, 2026-10-19)
- The camera stays on HIM the whole time - "WE ARE NOT SEEING THE ZOOM". No call screens / tiles / toasts.
- The props are the joke: `"keep": {"<take>": {"below": desk-edge y, "bright_in": [x0,y0,x1,y1]}}` (take pixels) keeps
  the real desk, mini keyboard and lamp-"mouse" in front of the new set (`_assets/security/office.jpg`).
- The other voice: `sounds` + `end_word` (its line ends where he reacts) / `start_word`; `"filter": "speaker"` =
  laptop speakers; overlap is wanted. Its subtitles: `captions` on the sound, blue, stacked above his
  (`captions_other: {color, y}`). Never open holds or reuse footage.
- Cut: pauses detected on the RNNoise-cleaned voice when AC hum sits near a quiet voice (`above_floor` 28,
  `voice_above_floor` 38); light trims (`pad_out` 0.35) - his faces live in the pauses; `keep_pauses` where the other
  side talks; `lead_in` 1-2 s before his first word; `end_at` = a hard cut mid-word on the punchline. Eye contact OFF.

## Series "gym" - a phone rant in a busy gym, Sigal on speaker (gym-1, 2026-10-20, "perfect")
- Set `_assets/gym/` + bed `bed_crowd.mp3` (chatter, weights, grunts; NO treadmill - he is not on one; music soft as
  from ceiling speakers) at 0.45 + one-shots every ~5 s (sfx_rack / sfx_drop / sfx_plates / sfx_grunt) under his
  speech. No beep (he hated it). Voice preset **hall** (sound.ts room reverb; Room / Room size sliders).
- Cut for a phone rant: continuous - merge 0.15, pad_out 0.15 (the word's tail rings under the next), join 0.18.
  Cut-out RVM "quality" (fast kept the black wall hexagon and dropped the phone). 3 takes in a `sequence`; subtitles as
  SAID ("רגע רגע רגע רגע", "סיגל נשמה"), frozen with `"captions_from": "file"`.
- **The other side of a phone call on speaker (Sigal - perfect after 6 rounds):**
  - NOT a continuous mumble under him, NOT a clean voice, NOT too quiet. A FEW placed lines (5 in 31 s), each
    0.8-1.1 s, at the END of his sentences where he drops or pauses, running a little into his next words (he cuts her
    off): as the video opens (mid-sentence), before each "רגע רגע", in his listening pause, between takes.
  - Source `_assets/gym/sigal-mumble.mp3` (= the demokratovich wife-call mumble he likes); each line a different phrase
    (`from`/`to` = seconds of the RAW file; the line lasts (to - from) / (pitch x tempo) - voiced runs only).
  - `"filter": "speakerphone"` (8 kHz line, small-speaker honk, codec crunch, short bounce), `"pitch": 1.25`,
    `"tempo": 1.15` ("cartoon but real"), `"room": true` (the same room as his voice), gain 1.9 (2.4 in his pause) →
    5-8 dB under his voice. A phone voice needs 150-250%: the Volume slider goes to 300%.
  - Measure, don't guess: fx.wav vs voice_dn.wav dB over each line's window (`work/public/`).

## Series "hani" - Hani Friedman, Haredi backend developer at Techy-Tech (haredit-1, 2026-10-25)
One camera at her desk; she talks to colleagues around her, a Teams call, her daughter Malki on the phone, a caller
on her kosher phone. Character: `characters/hani` (profile + Techy-Tech team card, Data & AI under Erez, next to Yotam).
- Set `_assets/haredit/set.jpg` (Techy-Tech open space behind her partition: tzedakah box, prayer book, mug on the
  ledge); her kids = `kids.png` (nine Haredi kids by height in a gold frame, cut out) as a `behind` image layer on
  the left, box ~x 12 y 500 w 400 - small, her head hid it. Eye contact OFF (she never talks to the lens).
- **Every phone / Teams call gets the other side** (his note: "when she speaks to the phone, do some mumbling sound
  that someone is talking with her. We have this sound already"): `_assets/gym/sigal-mumble.mp3`, one short line in
  each of her pauses, starting a little before her next word (she cuts it off). Per voice: Teams colleague =
  `filter speaker`, pitch 0.95, tempo 1.1, room, gain 1.5; a 3-year-old on the phone = `filter phone`, pitch 1.6,
  tempo 1.1, gain 1.3; an adult caller = `filter phone`, pitch 1.0, tempo 1.05, gain 1.3. `from`/`to` = seconds of
  the RAW file - measured: the line on the video lasts (to - from) / (pitch x tempo) (a 0.75 s slice at pitch 1.6
  tempo 1.1 played 0.43 s; the gym note above says "processed" - wrong). Read the RAW file's dB per 100 ms, take
  voiced runs only, and size each slice = wanted length x pitch x tempo. Two lines placed across a join can overlap
  (the first runs on into the next take) - check the Sounds lane for two mumbles at once. The ring before each call: `_assets/haredit/kosher-ring.mp3`
  (ElevenLabs sound effect, monophonic), gain 0.095, on the previous take's last words.
- **A whisper is not silence** (his note: "she's whispering a prayer, and you cut it because it's silent... let her
  drink and finish drink, and then keep on going"): a whispered blessing sits ~-40 dB, at the room's floor - the cut
  takes it for a pause. Look at the frames of every long pause before cutting it; an acted moment (blessing, drinking,
  a look) = `keep_pauses` {take: [[a, b]]}, and give the whisper its subtitle (the recogniser hears nothing there).
- **Connected joins, no words lost** ("make the connection between the different videos more connected, remove the
  silence, but be careful not to remove the words"): `cut` merge 0.6, pad_in 0.05, pad_out 0.15, join 0.2.
- **Never naked sound** ("now it's a bit naked in terms of sound"): an ambience layer of the place (here
  `office-room-long.mp3`, an ElevenLabs office room tone looped to 2 min with crossfades, own layer "אווירת משרד",
  gain 7, pin span) + a comedy bed in `music`. **The comedy beds are FAST** (his words: "something with rhythm...
  very pace, lots of music, funny, like something really quick is happening"): `_assets/music/fast/` -
  klezmer-ska (161 BPM, hers), montage (144, ukulele / whistle / claps), chase (152, cartoon hurry - has a stop
  mid-way), swing (140, electro swing); -10.4 / -10.5 / -12.9 / -12.8 LUFS → music volume ~0.05 / 0.05 / 0.065 /
  0.065; the `.json` beside each is its composition plan. Hasidic / klezmer ones (his pick for Hani, "klezmer or
  Hasidish is a good idea"): hasidic-freilach (172, clarinet + fiddle hora), hasidic-wedding (161, keyboard-organ
  wedding band; trimmed at 82.6 s - it ended early with 8 s of silence), klezmer-bulgar (161, frantic). Check every
  new track's end for silence before it loops.
- **Options he should hear go into Media through `POST /api/p/<id>/assets?name=music-<name>.mp3`** - a sound
  listed in episode.json `media` does NOT show in the layered editor's Media (he: "these I don't find there"). NOT `_assets/music/comedy-*.mp3` (slow, he hated them).
- Sound effects: `POST https://api.elevenlabs.io/v1/sound-generation {text, duration_seconds <= 22}` (key in
  zoomcut/.env) - 60 credits for 6 s, 220 for 22 s.

- **Her story poster = a pashkevil** (he: "super funny!!!"): a Bnei Brak wall notice played straight - בס״ד, "קול
  ששון בצוות הדאטה", "הודעה משמחת / הדיפלוי עלה!", her framed family photo (`family-framed.png`), "מזל טוב לבת ציון
  החשובה מרת חני פרידמן תחי׳", small print with her jokes (kosher phone, Yotam's decision, 16:20), CTA "טקי-טק
  מגייסת" + the link box. `_assets/haredit/story/story.html` (`#tiktok` = the TikTok text), shot with
  `_assets/dorit/tarot/shoot.mjs`; copy by Terra. Her family: `family-0.5.jpg` (cheap studio, he loved it) and the
  girls' portraits in `_assets/haredit/daughter-*` - Leonardo refuses any "11-year-old girl" prompt (5 times, with
  or without a reference); the eldest's portrait is cut from the family photo instead.
- SOL from a project folder picks the folder's revoked OPENAI key (it reads `./.env` first) - run `sol.js` from
  the scratchpad.

- **Hani's sound = part 1's final mix, copy it into every Hani video** (his words, 2026-10-27: "the setup with her
  sound and the bg, everything was perfect, we need the same"): Voice layer `fx.pitch` 0.5, `clean: "fft"`, NO voice
  preset; Music = klezmer-ska at volume 0.05 AND his own layer "music-hasidic-freilach" at volume 0.12 (one piece from
  the top, the rest continuing from 14.73 s into the track); no office ambience (he deleted it); speed 1.15. Read
  haredit-1's project.json for the exact props before a new one.
- **Hani's look = part 1's final layout, copy it too** (2026-10-27: "make the images at the same place of the prev
  project"): Set = `set-wall-a.jpg` (the wall-only office, he chose it) at box x -302 y -450 w 1800; the kids' photo
  (`kids.png`) behind her at x -8 y 414 w 398; the framed family photo (`family-framed.png`, Hani + her 3 daughters)
  behind her at x 573 y 854 w 585 - both layers BELOW Person. Upload them with `?cutout=0`.
- **haredit-2** (part 2, prepared 2026-10-27 on a stand-in): the calls with Brachi and the house are the point - see
  SKILL.md "ElevenLabs - the whole toolbox"; assets `_assets/haredit/calls/`, 4 lanes (ברכי בטלפון, הבית ברקע,
  אירועים וצלצולים); placement plan in its `_todo`. His notes on the stand-in (2026-10-27), to redo on the real
  takes: Brachi = her real lines at pitch 1.7 (chipmunk), nobody else speaks (office lane removed), no climbing,
  "אמא! אמא!" dry through the phone at pitch 1.7, the house events loud; **call 2: a quiet shower runs from Hani's
  first word of the call until just after "ותגידי לו שיחכה", then the water stops** (`shower-loop.mp3`, clean, gain
  0.12 - it's -9 LUFS); the shower-with-the-boy only at "שרולי נפל במקלחת".
- **Sounds that last through a moment** (the shower, a TV, a bed): start with the scene and end on the line that
  stops them (here "שיחכה") - never one short clip that ends on its own (his note: "we need to hear the water, then
  shut down after Hani said to").
