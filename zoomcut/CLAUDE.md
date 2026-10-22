# Sketch Studio (zoomcut)

Shlomi's own video editor for his TikTok/Instagram comedy sketches: raw takes + a Hebrew script → a finished vertical
MP4. **Load the `edit-video` skill** before working on any video - it holds the protocol and the rules he signed off on.

## THE EDITOR IS THE TOOL. A VIDEO SESSION FILLS IT - IT DOES NOT CHANGE IT.
- There is **one editor** (http://localhost:4747) for every project, and every project is **layers** in it: pictures,
  backgrounds, subtitles, texts, images, voices, sounds, music, filters. He controls every layer himself.
- **Making a video = spilling content into the editor**: footage, the script, lines, backgrounds, voices, texts, the
  end poster - through the editor's own controls / the studio's endpoints. Like a human editor: he works in the tool,
  he doesn't rewrite it.
- **Changing the tool is a separate job**, done rarely and on purpose: generic (every project gets it), in the one
  editor's existing places (Media, layers, inspector), tested on a hidden copy and load-tested, written in
  `skill/edit-video/editor.md`. Never patch the tool piece by piece while he waits on a video.
- No templates. Projects - you learn from earlier projects and copy their look.

## Where things are
- **`episodes/<id>/project.json` = a layered project** (the format: `skill/edit-video/layers.md`). Changed only through
  the studio's ops (`POST /api/p/<id>/ops`); drawn by `render/src/Layers.tsx`, edited in `render/ui/layers/`,
  exported by `pipeline/export_layers.py`, sound by `pipeline/layers_audio.py`. Builders: `pipeline/to_layers.py`
  (Zoom), the solo builder (coming). Projects without project.json still use the older screens below.
- `README.md` — how the pipeline works, folder layout, script directives, corrections.
- `zoomcut.py` (Zoom-grid projects) / `lesson.py` (one-camera projects) — the engines behind the one editor.
- `pipeline/` — prepare → transcribe (ivrit-ai Whisper, CPU) → match → plan → background (cut-out + photo layer) →
  mix (voice layers) → compose (export) → validate.
- `render/` — `server.mjs` (the studio, :4747), `ui/editor.tsx` (the editor), `src/ZoomCall.tsx` (the Zoom-grid
  picture), `share.mjs` (email / Telegram).
- `episodes/<ep>/` — episode.json, script.txt, corrections.json, backgrounds/, media/, work/ (generated), out/.

## Rules of the house
- Build / export / re-mix through the studio's API (the editor's own buttons), never a parallel CLI run.
- Never kill, restart or rebuild while a job runs. The export is gentle on purpose (his PC blue-screens under
  full load) - don't raise its parallelism.
- Before an export: read the project as he left it (speed, layers, length) and export exactly that.
- Speed over perfection (CapCut-level is fine), but never start/end a line mid-word.
- Changes to `render/src/layers/geometry.js` must be mirrored in `pipeline/layer_geometry.py` (`node tools/geometry_parity.mjs`).
  (Older Zoom screen: `render/src/ZoomCall.tsx` geometry mirrored in `pipeline/compose.py`.)
