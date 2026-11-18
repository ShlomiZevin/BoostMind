# Recipe: Zoom-call sketch (several characters, a call grid) - engine `zoomcut.py`

Projects to learn from: agentic-sync (#1), follow-up, ronit-joins (#3), **gilad-joins (#4 - the reference: 5 people, the
Drop, every rhythm note applied, the end poster)**. Recurring cast Amir / Ofer / Daniel / Ronit / Gilad (company:
Techy-Tech, techytech.web.app); the one who keeps getting cut off is `role: victim`, the rest `exec`. The grid fits
any number of people (5 = one big tile + 4 thumbnails, a 2x2 gallery after a removal).

## Making it (he sends videos + a script; you deliver a preview he only fine-tunes)
1. **Intake** (ask nothing you can infer): several files per character are one role, read in order. Named files
   (`amir-1`, `amir-2`) go by name; phone / Drop files (random names) - who from the frames, order from the recording
   time, written as `"files": {"<file>": {"char": "amir", "order": 1}}` (see SKILL.md, workflow 2). New names → add them.
2. **Scaffold:** `.venv\Scripts\python zoomcut.py new episodes/<slug>` (a clean project + the last project's office
   backgrounds). episode.json: `title`, `input_dir`, the POV text in `overlays` (his exact words; if none, ask).
3. **Script** → `script.txt`, verbatim. `—` at the end of every line where someone is cut off. If the sketch ends with
   a removal: `[<victim> מנסה לדבר 2.0]` then `[הסר: <victim>]`. **No `[שתיקה]` pauses** unless he asks.
4. **Build through the server**; wait for "preview ready".
5. **Self-review** - `.venv\Scripts\python zoomcut.py audit episodes/<slug>`, fix every finding first:
   - *starts mid-word / cut off at the end* → voice the detector missed - look at the 100 ms dB around the cut; fix
     the rule if general, a `corrections.json` in/out if one line.
   - *too long for its text* → a wrong window (words joined across a pause) - check `work/transcripts`.
   - *check / missing* → read "heard" vs the script; a jargon line (English words) is usually fine.
   - *silence before it* → an overlap / timing problem, not a pause he wants.
   Then stills of each layout (`remotion still … --frame=`): faces not cut, POV not over faces, the removal visible.
6. **Hand over** with timestamps; his notes → map with `work/state.json` (line `start`), apply, rebuild, re-audit.

## What to tell him before he records (6 lines - he won't read more)
1. One take per character, every line in order, ~1 s pause between lines; fumble → just say it again.
2. On every line ending with "—", keep talking past it; the edit cuts you off.
3. ~60 s of just listening per character (`<name>-listen.mp4`) - optional, makes reaction tiles better.
4. Same mic, camera at eye level, head and shoulders with room around.
5. For a removal: the victim ends his take with ~3 s of "wait, I just wanted to…" (the last try).
6. File names say who it is (`amir-1.MP4`, `ofer.MP4`, `daniel.MOV`); several files per character are fine.

## The editing rules he signed off on
- **Subtitles inside the main (big) tile**, above its name tag (thumbnails stay clear so reactions are seen). An aside
  (`corrections.json` `"aside": true, "at": s, "gain": 0.85` - said during someone else's line, takes no time) gets
  its own amber subtitle stacked on top, a 0.9 s look at the one saying it, lower volume. Any line: `"gain"` (0-1.5),
  `"soften": true` (shouted / too close to the phone) - also in the editor's line panel.
- **"חד משמעית" jumps in 0.25 s earlier** than a normal handover (`eager_extra`), every time.
- **Cut only when the speaker changes.** One speaker shot per turn; no reaction cuts mid-line, no gallery flashes
  (except after a removal: the remaining two in a gallery).
- **Hold the speaker; nobody under 1.5 s** (his notes on the-consultant, 2026-11-18: "you cut away too fast - nobody
  under 1.5 s. Whoever speaks stays on screen until the next person, who may start talking before he finishes"; "let
  Ofer finish his words on his own video, then switch"). Episode `"timing": {"hold_picture": true, "min_shot": 1.5}`
  (pipeline/plan.py step 2; off unless set, so older projects keep their cut). For new Zoom projects, set them from the
  start.
  - `hold_picture`: on a change of speaker the picture switches when the one talking finishes (his last word, or where
    he is cut off), not when the next voice starts. The new voice is heard under him first (a J-cut), and the switch is
    never later than 0.3 s before the new line ends. Asides, forced layouts and the removal attempt keep their own times.
  - `min_shot`: no shot shorter than that. A shot that comes too soon waits, and it is dropped if its speaker would be
    done by then (nobody is shown after their words). A removal never moves, so the attempt just before it may stay
    short.
  - In fast ping-pong, some quick lines are heard but not seen. That is the rule working. A line that must be seen gets
    a `layout` in corrections, or a `shift`.
  - Measured on the-consultant: shots under 1.5 s went from 18 to 1 (the removal attempt).
- **Overlap every handover:** exec→exec 0.3 s; victim answers immediately (−0.08 s). **Ping-pong** (exec→exec, line
  ≤1.8 s) overlaps `quick_overlap` 0.4 s (max 40% of the previous line). Lines never start with dead air (0.1 s lead
  kept). Subtitles switch with the speaker.
- **Interruptions - a real argument** (his note, gilad-joins 2026-10-22: "the regular conversation you did perfect", the
  cut-offs were too polite): the interrupter starts **while the other is still clearly talking** - episode `"timing":
  {"interrupt_overlap": 0.7, "interrupted_tail": 0.7}` for every "—" line, plus a `shift` (-0.5 to -1.0) on lines that cut
  in without a "—" ("אמיר, אמיר, חכה רגע", "אתה שוב רץ"). A line said over someone ("זה סדר הגודל" over "תקשיב ×3") gets
  a big negative `shift` so both play in full and the view switches. No fades, no ducking. The removed one's line
  gets `"tail": 0.03` so his voice stops on the removal.
- **Voices:** a character with phone / filter-app codec damage gets `"clean": true` in episode.json characters (low-cut,
  high-cut at 7.5 kHz, mild denoise, compressor, soft gate - checked that no word is lost). A mostly silent take (a
  listening take with one line) gets a huge automatic gain: set that line's `"gain"` by measuring it against his other lines.
  The mix is one fixed gain to -14 LUFS (loudnorm's dynamic fallback pumped the voices around a loud aside).
- **Ending on a removal:** if the boss keeps talking after "אתה יכול לרדת מהשיחה", keep it (subtitle it), let the
  victim start right after the address (`shift`), the victim is removed mid-word, and **the video ends on the boss's
  last word: the call cuts away to a full-screen poster on black** (below). No Zoom tail after it.
- **Never start or end a line mid-word:** start = the earlier of transcript word / voice region, walked back over loud
  voice right before it (stop at a 0.15 s pause or the previous line's last word, max 1.5 s); end = end of the voice
  region. The recogniser drops short / English words ("רגע", "נכון", "RAG") - trust the audio.
- **Tiles never jump:** a listening tile keeps running the person's own take; if positions differ, a 6-frame dissolve
  while small.
- **The removal beat** (he loved it, wants it in EVERY episode): the victim starts ~1 s before the last line ends, the
  view goes to him, his tile flashes red "הוסר מהפגישה", he's cut off ~85% into his sentence with the leave sound, big
  notice under the POV, then 1-2 s and the end. No unscripted last try in his take → point at one of his protests:
  `"attempts": {"daniel": {"clip": "daniel.MOV", "in": …, "out": …, "heard": "…"}}`.
- **A line never recorded:** reuse another take of his (corrections `clip`/`in`/`cut`) and change the subtitle to what
  is heard.
- **POV text** TikTok-style in the top band between the Zoom bar and the tiles (the call moves down). Fonts: Assistant,
  Arimo, Abraham, Stam Ashkenaz/Sefarad (`zoomcut/fonts`).
- Framing from the person's silhouette (works with wigs); Daniel: +45% saturation, framed higher.

## Applying his notes (corrections.json - or the editor, same file)
- "start it a bit sooner / small gap" → `{"shift": -0.3}`; "only by a bit" = −0.1
- "remove some of his mumbling" (interrupted line) → `"tail": 0.12` (default 0.3) and/or a later `in`
- "need a bit before, first word unclear" → `in` 0.15 s earlier
- "starts with mumbling, should start from X" → `in` = word X start − 0.08 (`work/transcripts/`)
- "can't hear the start" → check loudness first (100 ms dB): usually voice before `in` the detector missed - fix the rule
- "too long / gaps" → remove `[שתיקה]`, check overlaps.
Check his own edits in `corrections.json` before applying yours ("I was only checking").

## Pieces
`script.txt` (`**אמיר:** text`; directives `[דניאל מנסה לדבר 2.0]`, `[הסר: דניאל]`, `[שתיקה 0.8]`, `[חפיפה 0.3]`);
episode.json (characters, title, input_dir, overlays, per-character `look` / `frame` - set after seeing the footage);
`backgrounds/<char>.jpg` 16:9 office photos (Leonardo, `reference.md`). Export = fast compositor (`pipeline/compose.py`).

**Voices and backgrounds - what he signed off on** (gilad-joins, 2026-10-22):
- **Every voice at the same level.** The mixer measures each take on the pieces the video uses (a mostly silent
  listening take measured whole came out 6-10 dB too loud - Daniel +10, Ofer +7, Ronit +6). Check the speech level per
  character from `work/public/voices/<char>.wav` before handover; they should sit within ~1 dB.
- **Phone / filter-app voice (Daniel): `"voice": {"clean": "nn"}`** - RNNoise, the neural noise filter he knows from
  the news voice. He called the result "amazing"; my own ffmpeg chains ("strong") sounded "terrible". Start with NN.
  Send him a short BEFORE / AFTER mp3 of the character's lines (SendUserFile) before applying - he decides by ear.
- **Background proportion:** the photo is fitted to the person's whole video frame, which is taller than the tile
  shows, so on the big tile the room looks blown up. Zoom the background layer below 100% (Gilad: `gilad-wide.jpg`,
  zoom 0.6, pan x 0.35 - the ship and the whisky at a natural size; it never shrinks past covering the tile). Show him
  A / B / C stills of the tile before choosing.

**More he caught on the export (gilad-joins round 3, 2026-10-22):**
- **Never a take's first 3 s / last 2.5 s in a tile** - that's him starting / stopping the phone recording (Gilad
  reaching for the phone showed at 2:31). Listening footage and the lead-in / run-on around a line both keep out of
  them (zoomcut.py idle_pools, plan.py `TAKE_HEAD` / `TAKE_TAIL`). After a build, list tile segments that touch a take's
  start / end: only spoken lines may.
- **An aside's `gain` is relative to the other voices** - after the level fix, 0.2 made Ronit's "נורא קר פה בזום"
  inaudible; 0.65 and `show` = her whole line (1.7 s) is what he wanted ("put her for a bit more").
- **Same proportion in every tile:** zooming the photo out works on the big tile only - a thumbnail's view is almost the
  whole box, so the photo can't shrink without empty edges. The fix is a WIDER photo of the same room (more field of
  view): `node scripts/outpaint-image.mjs` (the photo at 60% on a transparent canvas → gpt-image fills the rest; it
  repaints the room wider - check the ship / whisky are still there), then zoom ~1.45 + pan to frame it. Gilad:
  `gilad-office-wide.jpg`, x 0, y -0.35, zoom 1.45. Check stills of the big tile AND a thumbnail.

**The end poster** (gilad-joins, 2026-10-22 - his final call after two tries: a small card over the call was wrong):
a 1080x1920 picture on **black** - the logo, the hook ("מחפשים עובדים!"), a strip of the real site, the URL big and clear
(techytech.web.app). Made in HTML and captured with a **full-page** headless screenshot (a clip / element capture at
1920 high came out white). Layer: `{"style": "image", "image": "media/<poster>.png", "start": -4.3, "w": 1080, "y": 960,
"fade_in": 0.08}` - a negative `start` counts from the end; set the episode `"timing": {"tail_after_removal": …}` so the
poster starts exactly on the last word (check `edit.json`: poster `from` = the last word's end), held ~4 s. It's an
image layer: live in the editor, covering everything in the export. Any preset timing value can be overridden per episode.

## His rounds on not-the-question (2026-11-16) - do these from the first build
- **One fixed overlap at every handover** (his note: "sometimes you start too early and sometimes too late - just set up a
  fixed time"; the join he called perfect = the words overlap 0.47 s). The builder times lines by their `in` / `out`,
  which carry a different breath / silence each, so the same setting gave -0.85 .. +0.8 s. Fix: trim EVERY line to its
  words (corrections `in` = speech onset - 0.04, `out` = last word's energy end + 0.06, measured at 10 ms from
  `work/audio/<clip>.wav`: first frame > -30 dB walked out to -42 dB), then `timing` handover_overlap = quick_overlap =
  0.48, victim_answer = -0.48, eager_extra 0. Check the soft first words by hand ("כן", "אוקיי" sit under -30 dB - keep
  the transcript's start), keep "אה" tails out, and re-measure the word gaps after the build.
- **No `[שתיקה]`** even when the script has *(שתיקה קצרה)* - "don't make a pause here, it must be continuous".
- **An aside that is only a mumble = no look** (`"show": 0` - the picture stays on the speaker). A look only for a line.
- **Silent business is a cutaway** ("move him to the speaking bubble for one or two seconds"): Daniel crunching his
  snack with the bag to camera, Ofer picking his ear - an empty-text script line (`**דניאל:** (קראנץ')` - parentheses =
  no subtitle) + corrections `{clip, in, out, aside: true, at, show: 1.8-2.2, gain}` (gain 0 for a silent one, high for
  a crunch, at most ~1.5: gain 6 lifted his room noise - "terrible bg noise... just show him eating with regular sound,
  maybe a bit louder"; that clip `clean: "off"`).
- **A TikTok-app take: no RNNoise** (`clean: "mild"` - "off" left an annoying room noise) - the `nn` setting copied from the old Daniel (filter-app voice)
  made this one "completely broken". Check each take's audio before copying a character's voice settings.
- **Held props survive the Zoom cut-out** (the עיגוליות bag held to camera stayed whole) - check a still with
  `cutout: true` before turning the cut-out off; turning it off lost his office background ("daniel missing his bg").
  Text on a prop read backwards = the picture layer's `mirror: true`.
- **Listening tiles can land on a bad stretch** (Daniel's phone fell, 1:17-1:20 of his take): list the take's bad
  spans from a contact sheet before handing over and move those tile items' `in` by op after the last rebuild.
- **The removal while the boss keeps talking**: split the boss's last line at the removal (script line, `[מנסה לדבר]`,
  `[הסר]`, the rest as its own line) and pull the rest in (`shift` ~-0.3) so he talks over the victim's last try.
- **Every voice starts ~0.25 s before its first word, the words staying put** (round 2: "Ofer swallows the first word -
  just start his sound earlier without changing anything"): `in` -0.25 AND `shift` -0.25 on each line (check the take
  is silent there). Trimming lines to the words made the soft first syllables too tight.
- **Rebuild after hand ops**: items changed by op are `user: true` and keep their OLD frames through a rebuild (they
  overlapped the new cut). Hand them back first - `item.update` with `"user": false` and `set: {"user": null}` - then
  rebuild and re-apply. After every rebuild check each voice row for overlaps of the same person.

## the-consultant (2026-11-18) - a guest with a bad connection, a guest with a site
- **The timing that matched "perfect" with the 0.25 s voice lead**: trim every line to its words (as above), `in` -0.25 /
  `shift` -0.25, then `timing` handover_overlap = quick_overlap = 0.62, victim_answer -0.62 - the words overlap ~0.45 s
  at every handover (measure: speech onset of the next minus the last word end of the one before, from the takes' wavs).
- **A short line between two lines of the same person** (Amir / Ofer "חד משמעית" / Amir): the person must never overlap
  himself on his voice row. Clear it on the next line (lead 0.25 -> 0.10, `shift` + the rest of the overlap), then
  CENTRE the short line: `shift` +d on it and -d on the next line, so it lands on both sides (~0 gap each). Shifts
  cascade (a line is placed from the end of the one before), so +d / -d moves only that join.
- **A script line ending "..." or "—" = interrupted** (its voice runs on under the next line). The freeze beat ("תודה
  שהצטרפת." then "אתה איתנו?") needs a full stop and a `shift` on the next line (~0.5 s beat).
- **One take, two script lines**: Ofer said "חד משמעית מקוטע" once where the script has "חד משמעית." and, a line later,
  "חד משמעית מקוטע." - the first line plays the same take up to "משמעית", the second the whole of it. Look for this before
  calling a line missing (whisper heard "מקוטע" as "נקודה").
- **Check every person's cut-out after the first build**: this project came out with Amir's and Ofer's `cutout: false`
  (their real rooms instead of the offices) - `layer.update <who>.picture props {cutout: true}`.
- **A broken connection, from the tool's own pieces** (his ask: "stuck, hanging, scratching, no connection"):
  - stuck = the picture item split, the frozen part `rate: 0` (a held frame);
  - his line breaking up = the voice item split into the words that survive ("כן... אני... שו... אתם... אותי?") with
    silence where the others were, plus the signal "hanging": a 60 ms slice repeated 3x (`in` 15.32, 1.8 frames each);
    the picture freezes (`rate 0`) and jumps (`in` skips ahead) in the same dropouts;
  - scratches = `episodes/_assets/socials-ending/signal-glitch-1/2.mp3` on the sfx row at each dropout (gain ~0.5) and
    `signal-static.mp3` very low (0.12) while he is frozen;
  - Zoom's warning on his tile = a `toast` text layer "החיבור של רונן לא יציב" (size 17 small tile / 28 big);
  - the subtitle = the broken words: `POST /api/p/<id>/build {action: "caption", n, text}`;
  - camera off ("we hear him, don't see him") = his picture items removed for the span, and an image layer of exactly
    what his tile shows of his background (crop computed with geometry.js `fitBox` + `backdropBox` for his take and
    tile size: here x 480..1056 of the 1536 photo) - background, logo and URL, his voice going on.
  Do all of it AFTER the last rebuild (hand ops on builder rows stay `user: true`).
- **A guest with a site (Ronen -> shlomiverse.com/ksa)**: his virtual background carries the firm's panel (logo + URL,
  its own picture in Media), but `fit: face` keeps his head in the middle of the tile, so in the big tile his head covers
  any panel. While he speaks: a `pill` text layer "KSA GROUP · shlomiverse.com/ksa" in the free bottom corner of his tile
  (bottom-left, opposite the name tag; gold #C9A96E on navy text, size 34), one item per big-tile span of his picture
  (filter `box.w > 900` - after a removal the small tiles are 518 wide), smaller (19) in a mid-size tile.
- **A take's bad stretch** (Daniel's phone went black / fell, 1:55-2:05): contact-sheet the take at 1 fps, and move the
  listening tiles that land on it (`item.update ... in`) to a clean listening stretch.

## The overlap, set once (2026-11-18 - SKILL.md "THE OVERLAP": 100 ms word to word at playback speed)
- Zoom builder: trim lines to words + the 0.25 s voice lead (above), `timing` handover_overlap = quick_overlap = 0.30,
  victim_answer -0.30 (lands near 0.1 s), then measure every join (last word end -> next first word, from the takes'
  wavs) and correct each with `shift` on the next line: `shift -= gap - (-0.125)` (0.125 s on the timeline = 100 ms at
  1.25x). Skip same-speaker joins, interruptions, the removal and a scripted beat. One rebuild: 33 of 33 joins at
  -0.12/-0.13 on the-consultant. Then fix any person overlapping himself by trimming that line's lead (`in` + x,
  `shift` + x - the words don't move).
- With `hold_picture` + `min_shot 1.5` on (Studio, 2026-11-18): the speaker stays on screen until his words end;
  turn both on in every Zoom project.
- Hand effects on builder rows are lost / stuck by a rebuild: keep them in ONE scratchpad script computed from the
  current timeline (line starts, the line-3 voice item, the tiles' boxes) with a `--clean` mode (remove mine, release
  `user`) - clean, rebuild, apply. the-consultant's `fx_apply.py` did freeze / broken voice / warning / camera-off /
  URL pill / Daniel's bad stretch in one call.
- **The socials drop (signal-lost ending), his calls on the-consultant (2026-11-18):** earlier than the last minute -
  "all are too late, people might not understand it": he weighed mid Amir's circular line ("אבל כדי ש—", 1:34) and in the end chose the
  silence right after Ronen's "מה בעצם אתם רוצים שהמערכת תעשה?" (frame 4005, 0.25 s after his last word) - "give them
  almost everything, this is the first video I'm doing it". Moving a drop by op = move every `ending.*` item by the same delta. The card's link pill = `shlomiverse.com/videos` (the phone feed, newest first - the video is
  the first one there; Studio, 2026-11-18), his extra line under the words: "השידור ממשיך שם עכשיו. / ברצינות, פשוט
  תיכנסו." (+37 frames on the card so it reads), and the caption ends "השיחה נקטעה באמצע. ההמשך בשלומיוורס:
  shlomiverse.com/videos" + the hashtags.
