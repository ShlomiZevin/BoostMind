---
name: edit-video
description: Edit Shlomi's TikTok comedy footage into a finished vertical video with Sketch Studio (c:\workspace\BoostMind\zoomcut) - Zoom-call sketches, one-speaker monologues (rabbi / guru / news anchor) and desk sketches with an off-screen voice; layers, live editor, export, send. Use for /edit-video, and whenever Shlomi says he recorded a sketch / has new footage or a folder in Downloads / wants a video edited, mentions zoomcut, Sketch Studio, the editor at localhost:4747, Amir/Ofer/Daniel, POV text, or asks to export/send a video to email or Telegram.
argument-hint: "[footage folder in Downloads] [what the sketch is]"
---

# /edit-video - Sketch Studio

## When he types /edit-video
`$ARGUMENTS` is usually a folder name in `C:\Users\shazbak\Downloads` and a line about the sketch; a script may be pasted.
1. **Start the studio** if :4747 is down: `cd c:\workspace\BoostMind\zoomcut\render && node server.mjs` (background).
2. **Look before you plan**: list the folder with PowerShell (bash mangles Hebrew names); ffprobe each take; a contact
   sheet of frames (cv2 - read/write Hebrew paths with `np.fromfile` / `cv2.imencode().tofile`, never cv2.imwrite);
   transcribe (faster-whisper via `pipeline.transcribe._get_model`).
3. **Pick the template** - ask only if it is truly unclear:
   | What he recorded | Template | Section |
   |---|---|---|
   | several characters, one file each, a meeting | Zoom Call (`zoomcut.py`) | 0, 3, 4 |
   | one speaker to camera (rabbi, guru podcast, news anchor) | Lesson (`lesson.py`, `"type": "lesson"`) | 6 |
   | him at his desk/room + an off-screen voice (Zoom, phone) | Lesson + `sounds` over him | 6 "security" |
4. **Scaffold**: `zoomcut.py new episodes/<slug>` or `lesson.py new episodes/<slug> --from <closest series> --input "<folder>"`
   (or write episode.json by hand from the closest series). `input_dir` points at his folder - never copy footage.
   Subtitles: transcribe, then fix with his script's spelling - the subtitle follows what he SAID, not the script.
5. **Build through the server** (`curl -X POST localhost:4747/api/ep/<slug>/analyze`, poll `/api/ep/<slug>/job`), never a
   parallel CLI run while he may be exporting.
6. **Self-review**: stills (`lesson.py episodes/<slug> --still <s>` / remotion still), placements, lost words; fix first.
7. **Hand over**: the link, the length at 1x, 2-4 timestamps worth his ear, which pauses you trimmed/kept, and a reminder
   that he can drag any cut edge to pull back footage. Then iterate on his timestamped notes; export when he says.
8. Send progress lines while you work - he asks "what takes so long?" when you go quiet.

# The protocol

Shlomi runs a 40K-follower Hebrew comedy TikTok. He records each character separately (usually all of
them himself, with wigs and face filters), drops the files in a folder with the script, and wants a
finished vertical MP4 without touching a timeline. Sketch Studio does that; Zoom Call is template #1.

Everything is in `c:\workspace\BoostMind\zoomcut` (README.md = how it works). Runs 100% locally: no per-edit API cost.

## Standing rule — he can always re-trim the cut himself (asked ~5 times; never ship without it)
Every video, every template: the editor's video lane shows each cut piece as a block, and **dragging a
block's edge takes more (or less) of the ORIGINAL footage before / after it** — seconds you cut can always
be pulled back by him, without asking you. Today this is:
- Zoom Call: line blocks have edge handles + drag-to-move (`startTrim` → `corrections.json` in/out/shift).
- Lesson (one speaker): Speaker lane pieces have edge handles (`LessonTimeline` `grabEdge` → POST
  `/api/ep/:id/trim` → episode.json `cut.edges: {"<take>": [[computed edge, his edge], ...]}` → `spans()`
  applies them last, merging pieces dragged into each other) and rebuilds the layers in seconds.
- Any new template or timeline: build this in from day one, and when you change `spans()` / the plan, keep
  his `cut.edges` / `corrections.json` working (they are keyed by the computed edge time, ±0.12 s).
When you hand over, remind him in one line that he can drag the edges. Your own cut choices are a starting
point; tell him which pauses you trimmed or kept so he knows where to pull.

## 0. Episode-day runbook — he sends videos + a script; you deliver a preview he only fine-tunes
Goal set by Shlomi after episode 1: **fewer review rounds** — everything he taught us is in the code
defaults now, and you self-review before he sees anything.

1. **Intake** (ask nothing you can infer):
   - Find the files (usually `Downloads\<folder>`; list with PowerShell — bash mangles Hebrew names).
     Several files per character are normal ("split for the same person") — they're one role, read in
     file-name order (`amir-1`, `amir-2`). If a file name doesn't say who it is, ask once with the list.
   - Characters: Amir/Ofer/Daniel are the recurring cast (`presets/episode-template.json`). New
     names → add them; the one who keeps getting cut off is `role: victim`, the rest `exec`.
2. **Scaffold**: `.venv\Scripts\python zoomcut.py new episodes/<slug>` (clean template + last episode's
   office backgrounds). Edit `episode.json`: `title`, `input_dir` (point at his folder — never copy
   footage), the POV text in `overlays` (his exact words; if he gave none, ask — don't invent one).
3. **Script** → `script.txt`, verbatim. `—` at the end of every line where someone is cut off. If the
   sketch ends with a removal: `[<victim> מנסה לדבר 2.0]` then `[הסר: <victim>]`. **No `[שתיקה]`
   pauses** unless he asks — he wants it tight.
4. **Analyze through the editor server** (start `cd render && node server.mjs` if :4747 is down;
   `curl -X POST localhost:4747/api/ep/<slug>/analyze`). Wait for "preview ready".
5. **Self-review before showing him** — `.venv\Scripts\python zoomcut.py audit episodes/<slug>`. Fix
   every finding yourself first:
   - *starts mid-word / cut off at the end* → a rule problem (voice the detector missed) — look at the
     100 ms dB around the cut, fix the rule if it's general, a `corrections.json` in/out if it's one line.
   - *too long for its text* → a wrong window (words joined across a pause / another line's words) —
     check `work/transcripts`, fix the match.
   - *check / missing* → read "heard" vs the script; a jargon line (English words) is usually fine.
   - *silence before it* → an overlap/timing problem, not a pause he wants.
   Then render stills of each layout (`remotion still … --frame=`) and look: faces not cut, POV not
   over faces, the removal beat visible.
6. **Hand over**: refresh link (localhost:4747), length, and the 2–4 lines worth his ear with timestamps.
   Never "it's perfect" — say what you checked.
7. **His notes come as timestamps** → map with `work/state.json` (line `start`), apply as section 4
   says, rebuild through the server, re-run the audit, answer line by line.
8. **Export** (fast compositor, minutes) → he presses Telegram/Email, or "Export & send".

## 1. Reference — the pieces
```
cd c:\workspace\BoostMind\zoomcut
.venv\Scripts\python zoomcut.py new episodes/<slug>        # scaffold from presets/episode-template.json
.venv\Scripts\python zoomcut.py audit episodes/<slug>      # self-review (work/audit.md)
```
1. `episodes/<slug>/script.txt` — `**אמיר:** text` lines. A line ending in `—` is interrupted.
   Directives: `[דניאל מנסה לדבר 2.0]` (last try, unscripted speech from the end of his take),
   `[הסר: דניאל]` (host removes him), `[שתיקה 0.8]`, `[חפיפה 0.3]`.
2. `episode.json` — characters (id, Hebrew name, filename aliases, role `exec` | `victim`), `title`,
   `input_dir`, `overlays` (POV: text, font, theme light/dark, opacity, y), per-character `look`
   {saturate, contrast, brightness} and `frame` {zoom, y, x} — set these only after seeing his footage
   (episode 1: Daniel's footage was dull, +45% saturation, framed higher).
3. Backgrounds: `backgrounds/<char>.jpg`, 16:9 office photos (copied from the last episode by `new`).
   New ones: Leonardo GPT Image 2.5 Flare via
   `node c:\workspace\noam\team-photos\gen.mjs image prompt.txt out.jpg flare HIGH 1536x1024` (~$0.11).
4. Editor: `cd render && node server.mjs` → **http://localhost:4747**. First analysis per take:
   transcription + background cut-out, a few minutes; after that every edit rebuilds in seconds.
5. Export uses the fast compositor (`pipeline/compose.py`; `--slow` = old all-browser render).

**Run everything through the editor server's API**, never a parallel CLI run: one run per episode
(`work/.lock`), and he watches the job in the UI. Never kill or restart while he is exporting.

## 2. What to tell him before he records (keep it to 6 lines — he won't read more)
1. One take per character, every line in order, ~1s pause between lines; fumble → just say it again.
2. On every line ending with "—", keep talking past it; the edit cuts you off.
3. ~60s of just listening per character (`<name>-listen.mp4`) — optional but makes reaction tiles better.
4. Same mic, camera at eye level, head and shoulders with room around.
5. For a removal: Daniel ends his take with ~3s of "wait, I just wanted to…" (the last try).
6. File names say who it is (`amir-1.MP4`, `amir-2.MP4`, `ofer.MP4`, `daniel.MOV`). Several files per
   character are fine — they're read as one role in name order.

## 3. The editing rules he signed off on (episode 1, "agentic-sync") — keep them
- **Subtitles sit inside the main (big) tile**, above its name tag (rule changed on episode 3, "ronit-joins"): the
  thumbnails underneath stay clear so the others' reactions are always seen. An aside (`corrections.json` line
  `"aside": true, "at": s, "gain": 0.85` - said on the side during someone else's line, takes no time) gets its own amber
  subtitle stacked on top of the main one, a 0.9 s look at the one saying it, lower volume. Any line: `"gain"` (0-1.5)
  and `"soften": true` (shouted / too close to the phone) - also in the editor's line panel (Sound card).
- **"חד משמעית" jumps in 0.25 s earlier** than a normal handover (`eager_extra`), every time.
- **Cut only when the speaker changes.** One `speaker` shot per turn. No reaction cuts mid-line, no
  gallery flashes. Only exception: after a removal, the remaining two in a gallery.
- **Overlap every handover** — the next one starts while the previous is "almost done":
  exec→exec 0.3s; victim answers immediately (−0.08s).
- **Ping-pong is the strongest part** (episode 2 note): exec→exec with a line ≤1.8s overlaps
  `quick_overlap` 0.4s (max 40% of the previous line) — they jump on each other's last syllable.
  Lines never start with dead air: breath / room tone before the voice is trimmed (0.1s lead kept).
  Subtitles switch with the speaker — a caption never runs on under the next one.
- **Interruptions:** the interrupter jumps in on the victim's last scripted word (0.15s, never more than
  25% of a short line); the victim's voice continues **at full level** for 0.3s then stops. No fades,
  no ducking — he hates "lowered" voices. Never let the victim's unscripted trailing-off ("אוקיי…")
  play under the next speaker.
- **Never start or end a line mid-word.** Line start = the earlier of transcript word / voice region,
  then walk back over any loud voice right before it (voice-level threshold, stop at a 0.15s pause or
  the previous line's last word, max 1.5s). Line end = end of the voice region. The recogniser drops
  short or English words ("רגע", "נכון", "Multi-Agentic", "RAG") — trust the audio, not the transcript.
- **Tiles never jump.** A listening tile keeps running the person's own take from where their last
  line ended and arrives exactly where their next line starts; if those differ, a 6-frame dissolve in
  the middle while they're small.
- **The removal beat** (he loved it): the victim starts talking ~1s before the last line ends, the view
  goes to him when it ends, his tile flashes red "הוסר מהפגישה", he's cut off ~85% into his sentence
  with the leave sound, big notice under the POV, then **1–2 seconds** and the video ends.
  He wants it in **every** episode, even when the script doesn't say so — add the two directives.
  No unscripted last try at the end of the victim's take (episode 2) → point it at one of his
  protests in `corrections.json`: `"attempts": {"daniel": {"clip": "daniel.MOV", "in": …, "out": …, "heard": "…"}}`.
- **A line the actor never recorded**: reuse another take of his (corrections `clip`/`in`/`cut`) and change
  the subtitle in `script.txt` to what is heard. Where an actor ad-libbed words, the subtitle follows the
  performance, not the script.
- **POV text** is TikTok-style, top band between the Zoom bar and the tiles (the call moves down to
  make room). His fonts: Assistant, Arimo, Abraham, Stam Ashkenaz/Sefarad (in `zoomcut/fonts`).
- Framing comes from the person's silhouette (works with wigs/filters); Daniel got +45% saturation
  and was framed higher.

## 4. Applying his notes
He reviews with timestamps ("0:42 — need a bit before"). Map them first:
`work/state.json` has every line's timeline `start`, take `in/out/cut`. Then write
`corrections.json` (or let him use the editor — same file):
- "start it a bit sooner / small gap" → `{"shift": -0.3}`
- "remove some of his mumbling" (interrupted line) → `"tail": 0.12` (default 0.3 after the cut) and/or a later `in`
- "the victim should come in earlier / closer to Amir's last words" → `shift` −0.1…−0.3 (small: "only by a bit" = −0.1)
- "need a bit before, first word unclear" → `in` 0.15s earlier
- "starts with mumbling, should start from X" → `in` = word X start − 0.08 (find it in `work/transcripts/`)
- "can't hear the start" / "starts faded" → first check loudness (`pipeline.media.read_wav`, 100ms dB):
  usually a voice burst before `in` that the detector missed — fix the rule, not just the line.
- "too long / gaps" → remove `[שתיקה]` directives, check overlaps.
Check his own edits in `corrections.json` before applying yours — he sometimes only tested something
and wants it cleared ("I was only checking").

## 5. Gotchas already paid for
- Background removal: MediaPipe selfie segmenter (~45 fps, CapCut-level) is the default; RVM is
  "quality" mode at ~7 fps — he explicitly prefers fast. Cut out whole takes once.
- Browser preview plays 540p `*.preview.mp4` copies; full-res stays for export. Three full-res phone
  videos in the browser = audio drift complaints that aren't real.
- `os.kill(pid, 0)` on Windows **terminates** the process. Use the `_alive()` helper in zoomcut.py.
- faster-whisper: feed numpy (PyAV version clash); transcribe per VAD chunk (else word times slide
  across long silences); opencv must be <5.
- Headless-Chrome screenshots mirror Hebrew; the real render is fine — don't "fix" it.
- Bash heredocs with apostrophes in comments break in this environment: write long patch scripts to a
  file and run them.
- Credentials: Gmail (`GMAIL_USER`/`GMAIL_APP_PASSWORD`) in aspect-agent-server/.env, Telegram
  (`TELEGRAM_TOKEN`/`TELEGRAM_CHAT_ID`) in xplace-auto-bidder/.env. Read at send time, never print.
  Gmail caps attachments at 25 MB, Telegram bots at 50 MB → `share.mjs` makes size-capped copies.
- Report to the fleet board (alias `video-editing` was episode 1's unit).

## 6. Template #2 — Rabbi Lesson (`lesson.py`, episode.json `"type": "lesson"`) — tuned on "demokratovich-elections"
One speaker, takes in order (IMG_*.MP4), no script file: transcribe, write `captions.txt` (one `== <take>` block each,
corrected by hand — the recogniser garbles Aramaic/wordplay), and let `lesson.py` cut, place and subtitle. Same editor,
same buttons (Re-analyze = layers, Export, Export & send). What he signed off on:
- **Layers, never baked**: person (his cut + mask, cached per cut piece), scene (set photo) + plaque (sharp, in
  perspective via `plaque_quad`), subtitles, text-on-video, sounds. Background zoom/position, his size/position,
  subtitle height and speed are live in the editor (Layout card / drag); Export uses the same numbers.
- **Rhythm**: cut every pause > 0.25s; each join starts 0.18s on top of the last word; a take ends where the voice
  after its last word stops (keeps a sung/held last word, drops a phone thud after a gap).
- **Sounds under his speech, never pauses**: ring from ~2s before he reacts until the moment he answers; the other side
  of a call mumbles (pitch 1.2, phone EQ) the whole call, even while he talks.
- Title = gold Stam on a ~45% black box; subtitles yellow Stam with black outline (letter-spacing — the outline fuses
  "זו"). Speed 1.2× is his choice. Background cut-out: quality engine only when hands go up against a white wall.
- Telegram gets a 2-pass copy under the bot's 50 MB; the out/ folder keeps only the master and the telegram copy.
- Never run a script that rewrites work/ files (mix, edit.json) while an export is running — it cut the export's audio.

### Series: "tadar" (spiritual-guru podcast parody, white bob wig, podcast mic) — started 2026-10-17
- episodes/tadar-1 (IMG_9979, first try) and tadar-2 (IMG_9980, the better take). Settings to reuse for every next one:
  background `_assets/tadar/studio.jpg` (warm podcast studio, crystals/salt lamp), music `_assets/tadar/music.mp3` at 0.3,
  `"voice": "podcast"`, `"eye_contact": {"strength":1,"dy":0.6}`, grade warm 0.07 / sat 1.1, matte quality + cut 70
  (hands against a white wall), clean white Assistant subtitles, person y 200.
- New video: `lesson.py new episodes/tadar-N --from tadar-2 --input "<folder>" --takes IMG_xxxx.MP4 --script <reader id>`
  then Re-analyze in the editor. The script text lives in the Reader (zoomcut/scripts/echar-תודעה-גבוהה.txt).
- Editor right panel is per layer (click a timeline lane or the preview): Speaker = size/position, eye contact, voice
  filters (all live); Music = track list + volume; Captions = style/height/words; Background; Text. No Apply buttons.

### Eye contact (2026-10-17: NVIDIA + our blink handling beat CapCut - he called it perfect)
- Default for every new episode: `"eye_contact": {"on": true}` = mode nvidia -> `tools/eyes_nvidia.py`: NVIDIA Maxine's
  hosted Eye Contact (key NVIDIA_API_KEY in zoomcut/.env; client C:/tmp/maxine/nim-clients) with closure detection OFF,
  then only the eye region laid on the original frames, faded by our MediaPipe eye-openness (closed eyes stay filmed).
  ~2 min per 90 s take. If NVIDIA fails (trial credits, endpoint change) lesson.py falls back to v6 by itself
  (logs it, writes <gaze>.fallback) and retries NVIDIA on the next prepare.
- A CapCut export next to the take (`"file": "x.mp4"` or `<take>*eye*.mp4`) still wins. `"mode": "neural"` forces v6.
- Sound: one chain for editor and export - render/ui/sound.ts (export renders it in headless Chrome via
  tools/mixdown.mjs, then -14 LUFS by the same code). Never reintroduce a separate ffmpeg voice chain.
- POV texts default to y 270 (below the Reels/TikTok header); never higher than ~250.

### Series: "news" (anchor parody, curly red wig) — episodes/news-1, 2026-10-18, he called it almost perfect
- Lesson template + layers: set `_assets/news/studio.jpg` (Leonardo, world-map video wall); anchor `person`
  scale 1.12, x 230 (off to the right, so the screen shows), y 200; `cut.silence: false` (trim only start/end).
- Opening = a LAYER, never baked: `"intro_video": {file: intro30.mp4 (Seedance 2.0 Mini, motion-interpolated
  24->30 fps or it stutters), from, seconds ~1, fade = seconds}` - dissolving from the first frame over the live
  anchor (no freeze - he hated the frozen frame); `"intro_sound"`: his N12 music from its first hit (7.46 s in the
  file), under the first words, fading out. The hook must come within 1 s.
- Story pictures: overlay `style: image, behind: true` on the screen (x105 y352 870x490), one per story timed to
  his words (several per story are fine, e.g. 3 for Bennett); `tag: "תמונת AI"` on realistic AI images of real
  people (TikTok rule). Lower third `style: band` "region | headline" (red tag + blue band) at y 1500; ticker 1775;
  POV hook in the strip above the screen (y 262) for the first ~4.5 s, then the live bug takes that slot.
- Voice: `"voice": "news"` + `"denoise": {"rnn": "models/rnnoise/cb.rnnn"}` (RNNoise - took his AC hum away; he
  loved it). Grade `smooth` 0.6 (bilateral skin smoothing, same in editor and export).
- Never generate realistic images of real politicians at invented events (name or reference photo); his own images
  he supplies are used locally and kept out of the public git repo (`_assets/news/.gitignore`).

### Series: "security" (broken security guy at his desk, an off-screen Zoom voice) — episodes/security-1, 2026-10-19
- Camera stays on HIM at his desk the whole time - "WE ARE NOT SEEING THE ZOOM". No call screens / tiles / toasts.
- The props are the joke: `"keep": {"<take>": {"below": desk-edge y, "bright_in": [x0,y0,x1,y1]}}` (take pixels) keeps the
  real desk, mini keyboard and lamp-"mouse" in front of the new set (`_assets/security/office.jpg`, Leonardo).
- He acts to the other voice in one continuous take: lay it OVER him with `sounds` + `end_word` (the line ends where he
  reacts) / `start_word`; `"filter": "speaker"` = laptop speakers; overlap is wanted. The other side's subtitles:
  `captions` on the sound, blue, stacked above his (`captions_other: {color, y}`). Never open holds or reuse footage.
- Cut: pauses detected on the RNNoise-cleaned voice when AC hum sits near a quiet voice (`above_floor` 28,
  `voice_above_floor` 38); light trims (`pad_out` 0.35) - his faces/gestures live in the pauses; `keep_pauses` where the
  other side talks; `lead_in` = 1-2 s before his first word (the take's first seconds are him starting the phone);
  `end_at` = a hard cut mid-word on the punchline. Eye contact OFF (he looks at the screen / a colleague).

### Building blocks added 2026-10-19 (lesson template) - use them, don't rebuild them
- **Follower question** (story-style card): overlay `style: "question"` {text, label, y, w, size, accent}; timed by
  `from_words` (a list of alternatives: the question read aloud, else the answer's first words) - stays until the next
  question. Lives in tools/lesson_text.mjs + editor.tsx (same numbers). Series "tadar" (spiritual-2 / tadar-4).
- **Thoughts** (Gen Z): `sounds` with `"filter": "thought"` (close inner voice, soft echo), `"duck": -12` (the room goes
  down under it), placed `"at"` (take seconds) or `"after_prev"` (gap after the previous sound), `"chime"` (whoosh / pop
  as it starts); overlay `style: "thought"` with `"sound": <index>` = a comic cloud that fades in/out with that sound.
- **No cut-out**: `"cutout": false` keeps the person's own place (no background swap, no matte run).
  `"cut": {"whole": true}` keeps the whole take (a stare - no speech to cut on).
- Overlays tied to words or sounds get their start/end written back into episode.json at every build (the editor
  shows them in place); `_todo` / `sounds_pending` keys are notes for the next session, ignored by the code.
- Gym series (gym-1): `_assets/gym/` set + `bed.mp3` (gym music through ceiling speakers + treadmill ambience, one
  music bed) + `beep.mp3` (treadmill speed-up). Gen Z series (genz-1): `_assets/genz/` whoosh, pop, black.jpg.
- **Hook text wording (2026-10-19):** write "פוב:" - never "POV:" - at the start of the hook text. Some videos take no
  prefix at all, only the line itself (Gen Z: "מחשבות של גן זי כשהם תוקעים בך מבט של עז בי לייק:"); use his words as given.

## The editor is the tool - every feature is a button (review round, 2026-10-19)
Templates are named for what they are: **Solo · one person** (lesson.py: monologue, Q&A, desk sketch with an off-screen
voice) and **Zoom call · several people**. Never a series name. Anything you add for one video must land as a generic
button (POST /api/ep/:id/config with a whitelisted key, or the overlay "+ Add" chips) - not as a hand-edited setting only.
- Project panel: Layers list (each with its state) · Add: Hook text / Question card / Thought / Lower third / Ticker ·
  Video card: Cut (Tight / Light / Keep pauses / Whole take), Speed, final length.
- Captions: Yellow·Stam / White·Assistant, font, size, colour, height · **All subtitles** list (click = go there, ✎ = fix
  one line; rebuilds) · per-take text.
- Speaker: size/position · Background removal (Cut out / Keep original place) + Keep desk (bottom %) · Look ·
  Eye contact (Make eye contact = NVIDIA, or the On/Off switch once made) · Voice presets incl. Raw · Noise Off / Standard / Strong (RNNoise).
- Background: zoom/position · Set library (every upright picture in _assets).
- Music & sounds: beds list + volume · Sound effects & voices: per effect filter (as recorded / laptop speaker / phone /
  thought), volume, remove, ▶ go there · + Add effect at the playhead from the library (all _assets audio).
- Media tab: footage used per take, the set, the sound, the library counts. Projects menu: newest first, Done section.
- **Editor look (his note):** flat panels - sections divided by hairlines, no rounded boxes, no tray behind option
  buttons, square-ish corners (4px). Keep new panels in that style. "+ New video" tab (left pane) creates a project:
  template, footage folder from Downloads, optional settings from an earlier project (POST /api/new) - prefer it to the CLI.
- **One project, every tool (his rule, 2026-10-20):** the project is the same in the video editor, the Reader and
  Karaoke - pick it in any tool and the others follow (localStorage "zc-ep" + storage events; studio/bar.js
  StudioProject). The Reader shows the project's script (episode.json "script": "<id>" -> scripts/<id>.txt, or the
  Zoom project's own script.txt); Paste saves into it. Karaoke opens the project's latest song recording.
- **Subtitles come from the project's script** (he keeps updating it): lesson.py sync_captions remakes captions.txt
  from the script whenever the script is newer - only the on-camera speaker's lines, no notes / [directions] /
  on-screen questions, a skipped passage left out, a longer ad-lib as said. A line fixed in the editor stays until the
  script changes. "captions_from": "file" freezes captions.txt (finished videos, Gen Z thoughts).
- **Project media (Media tab → Logos & pictures):** episode.json "media" lists the project's own files (logos,
  pictures); "+ Add file" uploads into episodes/<id>/media/ (POST /api/ep/:id/media); "Put on video" adds a plain image
  overlay (a corner logo, draggable). Anything generated for a project goes on its media list.
