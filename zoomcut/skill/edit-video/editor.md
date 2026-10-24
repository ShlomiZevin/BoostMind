# The editor and the export - how they work (read before changing code)

## The tool and the skill (his rule, 2026-10-22)
- **The editor is a general tool.** It builds videos out of layers - pictures, backgrounds, subtitles, texts, images,
  voices, sounds, music, filters - each with its controls. He controls the layers himself, or through a session.
- **The edit-video skill knows how to USE the tool:** it sets up the layers of a project (from earlier projects and the
  recipes) and hands them to him. A session making a video does not change the tool. If a video needs something the
  tool can't do, that is a tool improvement - generic (a new layer kind or control that every project gets), done on
  purpose, written here - never a one-video patch.

## The layered tool (2026-10-22) - where every project is going
One format, one composition, one editor, one export. The format and the API: `layers.md`.
- **Format**: `episodes/<id>/project.json` - assets + layers of items. Changed ONLY by ops
  (`render/src/layers/ops.js`: apply, inverse = undo, validate); the studio (`server.mjs`, "layered projects")
  refuses a write that breaks the format, keeps `rev`, logs every op with its undo in `work/history/log.jsonl`.
- **Geometry**: `render/src/layers/geometry.js` (editor) = `pipeline/layer_geometry.py` (export); keep them equal -
  `node tools/geometry_parity.mjs` must pass after any change.
- **Picture**: `render/src/Layers.tsx` draws every layer; video layers through `layers/VideoTrack.tsx` (persistent
  copies per take - seamless cuts, dissolves), sound through `layers/AudioTrack.tsx` (live gains / fades / volume from
  each layer's prepared sources), looks from `layers/styles.tsx` (TEXT_STYLES / SUB_STYLES - a new look goes HERE).
  The editor plays it in a Player; the export draws its graphics with it (mode "graphics", frameMap).
- **Editor**: `render/ui/layers/` - LayersEditor (shell, routed from editor.tsx when /api/ep says `layered`), Timeline
  (lane per layer, grouped; drag / trim = ops, live while dragging; Ctrl+wheel zooms around the mouse, Alt / Shift+wheel
  scrolls sideways - a native non-passive listener; a caption's or a text's edge / move changes ONLY that item - never its
  line's picture / voice, nothing ripples - his rule; LayersEditor.onItemEdit hands those to the plain edit); **a click picks a block, only the picked one
  drags** - body = move, its two white grips = start / end, a label shows 'end +0.57 s' - so the edge between two clips
  is never the neighbour's (his rule, 2026-10-23); **Ctrl+Z / Ctrl+Shift+Z undo / redo EVERYTHING**, a builder's
  change too (a video's length re-cut from the take, a line fix, a caption, an Inspector action): the project before
  it is kept and the difference goes on the undo list as one step (api.ts diffOps / record)), Media (assets, upload, + timeline; a file's
  picture opens it big - VideoPeek: plays / shows it, Use / Don't use + a note, + Timeline - the list itself never
  changes layout, more options go in that window), Inspector
  (project panel, `inspect/*` per kind by boostmind-31, a plain fallback for the rest), api.ts (ops, undo, saves in
  order with `rev`).
- **Builders**: zoomcut.py analyzes as before; `pipeline/to_layers.py` writes its layers (window chrome picture from
  `render/src/builders/ZoomChrome.tsx`, title / timer / count as text, tiles as video items with `z`, office photos as
  backdrops, tags / borders / flash / notice, subtitles, voices with `ref: {line}` and `link`), merged by
  `pipeline/project.py` (his items `user: true`, deletions in `removed`, props his). New builder actions = a file in
  `render/actions/<action>.mjs`.
- **Export**: `pipeline/export_layers.py`. gilad-joins as layers (_gl): graphics 477 of 5647 frames drawn (~20 s, was
  110-195 s), Quick 103 s total. Gotchas it already met: NTFS allows 1023 hard links per file (the held graphics
  frames copy every 1000); a fully opaque frame comes out of the PNG encoder as RGB - ffmpeg re-inits mid-stream and
  deadlocks (`-reinit_filter 0` + `format=rgba` on the graphics inputs).
- **Sound**: `pipeline/layers_audio.py` - tracks per layer (= audio.mix math; null test on gilad-joins -46 dB), one
  gain to -14 LUFS, stems + prepared sources (`<layer>|<asset>` urls) for the editor. Item moves / trims / gains are
  live in the editor; only a new source (an added sound, a filter change) is re-made (seconds).

## Zoom projects: the layers in the older Zoom screen (2026-10-22, before project.json)
- **Picture per take** - the cut pieces on each character's lane (drag edges / move, as before).
- **Background per character - a layer.** The take is cut out once (`work/matte/<take>.mkv`, cached on the take only);
  the editor shows the office photo + the person on transparency (`clips/<take>_fg.webm`, VP9 alpha, 540p). A "רקע"
  lane under each character; its card: pick a photo (the project's `backgrounds/`, or add one), pan x / y, zoom - live
  (POST /api/ep/:id/character `bg`). Placement math: `bg_box` (pipeline/background.py) = `bgBox` (ZoomCall.tsx). The
  export composites the same: photo, the take masked by its matte, the look over both (pipeline/compose.py).
  `"background_layer": false` in episode.json = the old baked way (don't).
- **Voice per character - a layer.** Card: Volume (live - the editor plays one track per character,
  `work/public/voices/<char>.wav`), Cleaning off / mild / strong and Clarity (dB at 2.8 kHz) - a change mixes only the
  audio again (`zoomcut.py voices`, seconds). episode.json characters[].voice. The export mixes from the same settings.
- **Subtitles - a layer.** The Subtitles lane: click a chunk → its line → the subtitle text, edited live (corrections
  `caption`, chunks re-cut in edit.json at once, POST /api/ep/:id/caption).
- **Click a character's name on the timeline** = all of that character's settings (look, background, voice). The ✕ in
  the inspector header = back to the project settings (speed, subtitles, texts).
- Images (an end poster) are overlay layers (`style: image`), texts as before.
- **Export: Full quality or Quick check** (the Export menu). Quick check = the same composite at half size (540x960),
  ultrafast encoder, to `out/<id>.draft.mp4`, sent marked DRAFT - never replaces the real file (`zoomcut.py --quick`,
  compose `scale`). Where the time goes (3-min video): drawing the interface ~110-195 s (every frame, even unchanged
  ones - next speed-up: draw only frames that change), compositing ~60 s quick / ~5 min full, the speed pass.

## The editor is the tool - every feature is a control
- Layers list in the project panel (each with its state) · Add: Hook text / Question card / Thought / Lower third /
  Ticker / Market panel · Video card: Cut (Tight / Light / Keep pauses / Whole take), Speed, Slow motion (from the playhead), length.
- Right panel per layer (click a timeline lane or the preview): Captions (style, font, size, colour, height, All
  subtitles list with ✎), Speaker (size / position, cut-out or original place + Keep desk %, Look, Eye contact, voice
  presets incl. Raw / podcast / news / hall / stage, Noise Off / Standard / Strong, Pitch, PA echo), Background (zoom /
  position, set library), **Filters** (each: On / Off, strength bar, its start time; Fade in; hits and Black from
  here), Music & sounds (beds, volume, Duck under voice; each sound: filter - as recorded / laptop speaker / phone /
  speakerphone / thought / thought + echo / muffled, Clean, volume, Echo and Speed for voices, fades, swap, remove).
- Timeline: Text group, Captions, Speaker (cut pieces with edge handles), Background, **Filters group** (a lane per
  filter, blocks dragged / ends dragged = when it plays), **Sounds group** (a lane per sound - thoughts in purple named
  by their text, effects in gold; the music bed on its own lane). Groups collapse to one lane.
- Pickers are windows, never inside the panel (`SoundPicker`: "This project" = the series' `_assets` folder + every
  folder its sounds come from + its media/; "All sounds" one tab away). Rejected sounds → `_assets/<series>/rejected/`.
- Look: flat panels, hairline dividers, no rounded boxes, ~4px corners. "+ New video" creates a project (footage
  folder from Downloads, optional settings from an earlier project; POST /api/new).
- One project in every tool (editor, Reader, Karaoke) - localStorage/sessionStorage "zc-ep", studio/bar.js StudioProject.
  The Reader shows the project's script (episode.json `"script"` → scripts/<id>.txt); Paste saves into it.
- **The Reader (his teleprompter while recording):** a pace (wpm) for the script and one per character (the box beside
  each name). **⏱ beside a character** = measure his pace: it picks a fair line of his (closest to ~18 words), Start when
  he starts saying it, Stop when he finishes → "<name>: N wpm" → **Save / Measure again / Cancel** (Save = that
  character's pace in this script; nothing changes before Save; Escape cancels). The pace is the player's own formula
  backwards (`lineSeconds`: 0.3 s a line, his own lines +10% +0.15 s). A script without characters: one ⏱ by the line
  count, for the pace. **Stop resets the line** (its bar empty at once) - he always records a line whole from its start.
  **Checkpoint** (⚑ / M, or a line's bookmark) and **Home** = to the checkpoint (Home again = the start). Lines that
  start with `#` are notes, hidden (e.g. "# על המסך – ..." for what shows on screen); `[..]` are directions.
- **Speed** (Video card, both editors): the presets 1-1.3× and his own exact number in the box beside them (0.5-2×,
  Enter) - plays live, Export makes the file at it.
- Project media (Media tab → Logos & pictures): episode.json `"media"`, "+ Add file" → episodes/<id>/media/,
  "Put on video" = a plain image overlay.
- Studio rail → **Jobs**: what runs now (builds / exports with progress and step, sends by email / Telegram) and the
  **History** of every build, export and send (when, how long, done / failed, last line) - `GET /api/jobs`, kept in
  `episodes/_jobs.json` (git-ignored, last 300) across restarts; click one to open that project. Sends are jobs too.

## The live cut - every change is instant (his #1 rule)
He hates background processes and "Updating preview": dragging an edge, splitting, deleting a piece, moving the start /
end must show at once, with the real footage there.
- **The takes, whole, for the editor** - `work/public/takes/<take>.webm` (cut out, VP9 alpha, keyframe every 0.5 s),
  `<take>.plain.mp4` (as filmed), `<take>.raw.webm` (original eyes). `take_proxies`, cached by a stamp;
  `lesson.py episodes/<id> --takes` makes only them.
- **The editor plays the cut itself** (`render/ui/liveplayer.ts` `LiveClock`): edit.json `items` are parts of takes
  (slow motion = `sp`, played as playbackRate); two copies per take so the next part waits ready. It stands in for the
  preview `<video>`, so sound, subtitles and the film look follow it unchanged; while an edge is dragged it `peek`s.
- **Cut changes = `lesson.py --replan`** (~1.5 s: plan + subtitles + overlay / fx timing + sound stems). Sounds moved
  = `--stems`. Layout, look, voice, music, keep desk, cut-out on/off, eye switch, text, filters are drawn live and saved.
- **Sounds and music are layers like the video:** drag to move, drag ends (`trim_in`, `len`); music `start` / `end` /
  `off`. One Delete for whatever is picked (toolbar or the key) - never a ✕ on a block.
- **Sound layers are lanes of their own** (his rule, 2026-10-21): each sound has `lane`, the project `sound_lanes`
  (older projects: a lane per sound, in order). Deleting a sound leaves its layer ("Empty layer"); picking a layer's
  name on the left turns the button into **Delete layer** (it goes with what is on it, the ones under it move up);
  "+ Sound layer" adds one; a sound dragged up / down changes layer; a new sound goes on the first empty layer.
  Anything pointing at a sound by number (thought bubble `sound`, film hit / blackout `sound`) is renumbered.
- **Publish to his socials** (2026-10-24, render/publish.mjs + ui/publish/Publish.tsx): Export → "Export and publish…"
  (picks + caption + results in episodes/<id>/publish.json - NEVER episode.json: its mtime makes the export
  look stale; the export publishes by itself when it ends well - never a Quick draft; `{dry: true}` tests the whole path
  without the platform calls) or the **Publish** button (the file already made). The window shows the account, caption, file, length, size
  and export time before his click; a STALE export can't be published (server refuses 409 - export again); one run,
  no retries. Platforms (keys in zoomcut/.env, never print them): **Instagram** live (@shlomizevin, Creator; Reels via
  `video_url` - the file staged in the Drop bucket's hidden `_publish/` + the Drop's `/api/publink` one-hour private
  link, deleted after; key renews itself, IG_TOKEN_EXPIRES; the API can't delete a post); **Facebook** personal profile
  = no API: he taps "Share to Facebook" on the Instagram Reel; **X** (OAuth 1.0a on the plaxzy app, his account via
  PIN - X_* keys; 280 chars, 2:20), **TikTok** (to his drafts - TT_CLIENT_KEY/SECRET/REFRESH_TOKEN), **YouTube**
  Shorts (YT_CLIENT_ID/SECRET/REFRESH_TOKEN) are written and switch on when their keys exist. Results: Jobs history
  (kind publish) + episode.json publish.last. **Never post a test without his OK** - posts are public.
- **Footage from the iPhone - the Drop** (2026-10-22): https://drop-463727469066.me-west1.run.app (Cloud Run service
  `drop`, code in zoomcut/drop - redeploy: `gcloud run deploy drop --source drop --region me-west1 --project
  boostmind-b052c`; key in zoomcut/.env DROP_KEY - the studio's "+ New video" → From the iPhone shows the QR with it).
  On the phone he picks a **project** (folder) or makes one. **● Record voice** (2026-10-23) records his voice only, in
  the page (raw mic: no echo cancel / noise suppression / auto gain - the studio cleans it; AAC 256 kbps, `.m4a`; a
  level bar shows the mic hears him); on Stop it uploads straight away, no naming step, as `rec-HHMMSS.m4a` (recording
  time - the takes sort in order; he renames if he wants). Under each take: a player (from the phone itself), **Delete**
  (off the Drop and off the PC too) and **Record another**. Or he chooses videos and **names each file** before it goes up
  (chips = names he used before, e.g. amir / ofer - a taken name gets -2) and sees the project's files with
  **rename / delete**. On the desktop the same page is a **browser**: every project (files, size, last upload, delete
  project) beside the picked one's files. Files land in `gs://boostmind-drop/<project>/<name>.<ext>` (me-west1, private,
  60-day auto-delete; resumable 16 MB pieces, any size).
  The studio (render/drop.mjs) pulls each new file to `Downloads\drop\<project>` every minute and then **removes it
  from the Drop** once the copy here is checked (size + md5) - his rule (2026-10-23): the Drop only holds what is on its
  way; the PC copy is the footage. The cloud never deletes a file here any more (the old mirror did, and wiped the
  footage of projects marked Done - fixed; recovered from the bucket's 7-day soft delete: `gcloud storage ls
  --soft-deleted` / `gcloud storage restore <obj>#<generation>`). A delete on the page leaves `<project>/.gone/<size>~<name>`
  and the studio deletes that file here (same name, or name-N, same size). A name already here with other bytes comes
  down as name-2. Every pull is a "Drop" job whose line says what each file really is (ffprobe: size, resolution,
  codec, fps, bitrate). Use that folder as the project's footage. The editor's "Who is this?" list plays a file whole
  (`GET /api/ep/<id>/footage?rel=`). Test folders: `_x` - and a test of drop.mjs must list ONLY its own `_x` prefix
  (a copy that lists the bucket syncs - and with this rule removes - his real folders).
  **Full quality - only through Files:** a video picked from the PHOTO LIBRARY in Safari arrives converted (measured
  2026-10-22, accept limit or not: 720x1280 H.264 ~5 Mb/s, random-ID .mp4 names). Originals: in Photos select the clips
  → Share → Save to Files, then on the Drop page Choose videos → Choose File (Files) - they keep IMG_xxxx.MOV, full
  resolution, HEVC. The Drop job's line (ffprobe) tells which one arrived; never edit a converted copy without saying so.
- **Subtitle text is live too** (his note, 2026-10-21: "as in CapCut"): a line / a take's text edited -> the line shows
  at once, captions.txt saved, `--replan` places the subtitles again (~1.5 s, no picture work). Only the plaque /
  title (part of the set picture) rebuilds.
- **Sound players remade while playing** (a sound changed → new stems) start at once - before, every sound went
  quiet until the next Play.
- **Media load from the other host name** (`127.0.0.1` ↔ `localhost`, server `mediaHost`, CORS on /media): a browser
  allows 6 connections per host; the take videos + stems held all of them and saves (POST) hung silently - his edits
  "did nothing". Keep heavy media off the page's own host.
- **Testing on a copy:** name it `_something` (episodes/_x) - hidden from every project menu, still opens when asked
  for by id; delete it after. Never write into a project he is working on (he wants one project per video).
- **What still rebuilds** (a real job): Re-analyze, cut presets, matte engine, Make eye contact, Strong noise
  reduction, new footage, slow-motion ranges. Don't add new jobs for things the editor can draw.
- Testing: `window.__zcClock` is the live clock; a puppeteer script logging every frame's shown box and its video's
  readyState catches flicker. Waiting copies are hidden by opacity, never `visibility: hidden`.

## The build and the export (2026-10-20 - "what I see is what I export, and export fast")
- **The editor build** (`--preview`, seconds) makes only what the editor shows: takes, stems, timings, scene / plaque
  images. At its end it starts the **background render** - a detached, below-normal `lesson.py <ep> --warm`
  (`work/warm.pid`, `warm.log`): the person cut in **2 s take-grid chunks** (`chunks()`; slow motion = minterpolate
  "mci"), the animated thoughts (headless Chrome, `tools/thought_frames.mjs`), person.webm. A newer edit stops it.
- **Export** waits for the background render, reuses every chunk / clip (a cut, an end mark or a split re-renders only
  the chunk it touches), mixes the sound with the editor's own code (`tools/mixdown.mjs` → sound.ts), streams the
  picture (set + person) straight into the film pass (`fx_pass`: OpenCV on a thread pool, the curve from
  `render/ui/fx.js` via `tools/fx_curve.mjs` - the editor's own numbers), lays the text, then **checks** the file
  (`check_export`: length vs the edit at its speed, 1080x1920, 30 fps, sound - fails loudly) and **tidies**
  (`tidy`: anims / subtitle images of earlier versions, the project's unused filtered sound copies, pieces unused 24 h).
- The only intended difference from the editor: export slow motion is interpolated (smoother); the editor repeats frames.
- Every cache is written to a `.part` file and renamed (an interrupted run once left an empty .wav that broke builds).
- Never run a script that rewrites work/ files (mix, edit.json) while an export runs - it cut an export's audio once.
- The mask videos are TV range (16-235): `mask_curve()` maps them to 0-255 before the cut-off (read raw, the person
  was 70-75% solid - see-through).
