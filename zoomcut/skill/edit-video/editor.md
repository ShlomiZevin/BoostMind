# The editor and the export - how they work (read before changing code)

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
- Project media (Media tab → Logos & pictures): episode.json `"media"`, "+ Add file" → episodes/<id>/media/,
  "Put on video" = a plain image overlay.
- Studio rail → **Jobs**: every project's build / export with progress and step; click one to open that project.

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
