# One layered tool - plan and status (session boostmind-c?, 2026-10-22)

Shlomi: "a tool with layers ... zoom is a complex layered composition ... any AI code tool can spill things into it
without changing it; the skill says what to do." He doesn't want to review the plan - he wants it done.

## Architecture
- **One layer model: `episodes/<id>/project.json`** (not episode.json). episode.json stays the *builders'* input.
  A project with project.json opens in the new layered editor and exports through the new exporter; a project
  without it keeps today's screens/endpoints untouched until migrated (on a `_` copy first).
- Format `sketch-studio/1`: canvas {w,h,fps,color}, duration (frames at 1x), speed, assets {id: {kind, src (relative
  to the project folder), w, h, framing, fg, matte, preview, audio}}, layers bottom->top [{id, kind, name, group,
  hidden, muted, owner, props, items[]}]. Kinds: video, backdrop (photo behind a cut-out video layer), image, text,
  subtitles, shape, audio, effect. Item: id, from, dur (frames), in (s), box, fades (s), anim keyframes, ref, user, pin.
- **Ops** (`render/src/layers/ops.js`, shared by server and editor): project / layer.add|update|remove|move /
  item.add|update|remove / asset.add|remove, `validate()`, `inverse()` for undo.
- **Builders** write whole projects and are merged (`pipeline/project.py merge`): his props/layers/hand-edited items
  (user: true) / deletions (layer.removed refs) survive a rebuild. Zoom builder = zoomcut.py as today +
  `pipeline/to_layers.py` (edit.json + mix.json -> layers). One-camera builder = lesson.py + a to_layers for it (stage 2).
- **Renderer**: `render/src/Layers.tsx` (Remotion), styles registry `render/src/layers/styles.tsx`, geometry
  `render/src/layers/geometry.js` == `pipeline/layer_geometry.py` (parity test `tools/geometry_parity.mjs`).
- **Export**: `pipeline/export_layers.py` - graphics runs rendered by Remotion only on frames that change
  (frameMap), video runs composited by ffmpeg (generalized compose.render_chunk, same gentle limits), sound by
  `pipeline/layers_audio.py` (same math as audio.mix; null test vs the old mix on gilad-joins: -46 dB).
- **Studio API**: GET /api/p/:id, POST /api/p/:id/ops {rev, ops}, assets upload/list, builder actions, export,
  GET /api/schema. Docs: `skill/edit-video/layers.md`.
- **Editor**: `LayersEditor` (render/ui/layers/*), from LessonView's shell: Media (every asset incl. backgrounds),
  Script (builder lines), lanes per layer grouped, inspector per kind, ops-based undo.

## Status
Done: geometry + parity, ops.js, project.py merge, to_layers.py (Zoom), layers_audio.py, Layers.tsx (first cut),
ZoomChrome builder picture. Test copy: `episodes/_gl` (gilad-joins). Next: stills parity vs ZoomCall, exporter,
endpoints, editor, docs. Stage 2 = one-camera projects.

## Your 9 points
1. Instant changes: kept. Layer ops are instant (no job); audio-only ops re-make stems (seconds). For one-camera the
   LiveClock whole-take players must stay - stage 2 will render video items of the layered editor through the same
   LiveClock/preload approach, not plain Remotion <Video>, where smoothness needs it. Review wanted here.
2. Everything a layer with a control: that's the model. Sounds = audio layers (a lane = a layer); deleting an item
   leaves the layer; Delete layer separate. Index references go away (items have ids).
3. WYSIWYG: geometry shared + parity test; audio: layers_audio.py now (python, = audio.mix). sound.ts live chains
   (one-camera voice presets) come in stage 2 - via mixdown.mjs as today.
4. mediaHost + CORS + preload + immutable versioned URLs: reused as is.
5. Jobs: same runJob/jobwrap/history; never restart during a job.
6. Projects: unchanged; tests on `_gl`.
7. Reader: not touched.
8. Will type-check the new files that way.
9. Skill rewritten at the end to match.
