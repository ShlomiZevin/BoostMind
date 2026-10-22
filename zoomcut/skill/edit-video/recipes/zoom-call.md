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

**The end poster** (gilad-joins, 2026-10-22 - his final call after two tries: a small card over the call was wrong):
a 1080x1920 picture on **black** - the logo, the hook ("מחפשים עובדים!"), a strip of the real site, the URL big and clear
(techytech.web.app). Made in HTML and captured with a **full-page** headless screenshot (a clip / element capture at
1920 high came out white). Layer: `{"style": "image", "image": "media/<poster>.png", "start": -4.3, "w": 1080, "y": 960,
"fade_in": 0.08}` - a negative `start` counts from the end; set the episode `"timing": {"tail_after_removal": …}` so the
poster starts exactly on the last word (check `edit.json`: poster `from` = the last word's end), held ~4 s. It's an
image layer: live in the editor, covering everything in the export. Any preset timing value can be overridden per episode.
