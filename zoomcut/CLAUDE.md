# Sketch Studio (zoomcut)

Shlomi's own editor for his TikTok/Instagram comedy sketches: raw character takes + a Hebrew script →
finished vertical MP4. Zoom Call is the first template. **Load the `sketch-studio` skill** before working
on an episode — it holds the full protocol and the editing rules he signed off on.

- `README.md` — how the pipeline works, folder layout, script directives, corrections.
- `zoomcut.py` — CLI (`build episodes/<ep> [--preview|--no-render|--slow]`, `new`).
- `pipeline/` — prepare → transcribe (ivrit-ai Whisper, CPU) → match → plan → background (MediaPipe) →
  mix → compose (fast export) → validate.
- `render/` — `src/ZoomCall.tsx` (the Zoom template, Remotion), `server.mjs` (editor server, :4747),
  `ui/editor.tsx` (the editor), `share.mjs` (email / Telegram).
- `episodes/<ep>/` — episode.json, script.txt, corrections.json, backgrounds/, work/ (generated), out/.

Rules of the house:
- Run analysis/export through the editor server's API, never a parallel CLI run (one run per episode).
- Never kill, restart or rebuild while he is exporting. Ask first.
- Speed over perfection (CapCut-level is fine), but never start/end a line mid-word and never lower a
  voice under an overlap.
- Changes to `render/src/ZoomCall.tsx` geometry must be mirrored in `pipeline/compose.py`.
