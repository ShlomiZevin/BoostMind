# Shlomiverse Studio - nudge any cut edge by milliseconds, the easiest thing in the world

**His ask (2026-11-02):** "In the editor it should be easy to pick any end or start of a segment, and really really
really comfortable to tell it: add a few ms or remove a few ms - and everything syncs instantly. The easiest in the
world."

Read first: `zoomcut/skill/edit-video/SKILL.md` + `editor.md`, `zoomcut/render/ui/layers/design.md` (the editor's UI
language - follow it), `render/ui/layers/LayersEditor.tsx` (keys: ←/→ already move the playhead a frame),
`render/ui/layers/inspect/controls.tsx` (`Num` / time fields nudge one frame today), the timeline component, and the
ops API (`render/ops` - every change is an op with a rev). Memory: `feedback_drag_cut_edges.md` (he drags cut edges
to pull footage back - asked 5 times, must keep working), `feedback_modal_not_panel.md`, `feedback_everything_live.md`.
Another session may be moving the studio's data to the cloud (`plans/studio-online.md`) - it owns the server /
storage side, you own the timeline UI; don't touch storage.

## What to build (suggested - show him a first version fast, then iterate on his notes)
- **Pick an edge**: click near a clip's start or end on the timeline -> that edge is selected (a clear highlight),
  Tab / Shift+Tab jump to the next / previous edge on the lane, so he can walk the cuts without the mouse.
- **Nudge it**: keys, e.g. `,` / `.` = −/+ one step; Shift = a bigger step; the step in ms (default ~40 ms; one frame
  is 33 ms at 30 fps). Also type it: press a key, type `+120` or `-80`, Enter.
- **Show it where he looks**: a small chip at the edge on the timeline ("+40 ms", the running total since he picked
  it), no new controls in a panel (his rule - never add controls to a panel or change its layout).
- **Everything follows instantly**: the neighbour clip (a join moves both sides, or ripples the rest - decide with
  him), subtitles / voices linked to that line, the preview - live, nothing rebuilds. One op per nudge (undo works).
- Video can only cut on a frame; if he wants sub-frame ms for the sound, say what's possible (audio can be finer than
  the picture) before building it.

## His rules that bind this work
- Everything live like CapCut; the export runs the same code (`feedback_everything_live.md`). Dragging cut edges keeps
  working exactly as now.
- Test on a hidden `_name` copy of a project, delete it after; never write into a project he's editing; never restart
  the studio while a job runs; never export Full quality yourself. UI checks headless with
  `ignoreDefaultArgs: ['--hide-scrollbars']`.
- Reply in English. Commit and push your own files when done; tell him to press F5.
