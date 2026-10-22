# The layered editor - design

Picked from three Leonardo mockups (GPT Image 2.5 flare, MEDIUM, 2026-10-22): the editor shell, the picture / voice /
clip panels, the text / subtitle / image panels. The same language as today's editor (editor.css "mockup B"), so old and
new screens read as one product.

## Language
- **Colours:** `editor.css :root` tokens only. Warm off-black (`--app` `--panel` `--panel-2/3`), text `--text` / `--dim` /
  `--faint`, ONE accent `--accent` (coral). Character colours (`--amir` ...) only on their lanes and avatars. State: `--ok`,
  `--warn`, `--bad`.
- **Flat:** no gradients, no glow, no shadows on panels. Borders are 1px `--edge` / `--edge-2`. Radius 6-8px (12 on cards).
- **Type:** Inter (Heebo for Hebrew), 13px body, 12.5px labels in `--dim`, 14px/600 titles. Numbers are tabular.
- **Motion:** 150ms colour / background transitions. Nothing bounces.

## Layout
- Top bar: the project, a Saved state dot, speed, Email / Telegram, the coral Export.
- Left rail: Editor / Media / Reader / Jobs. Left pane: Script | Media.
- Centre: the 9:16 preview with the transport under it.
- Right: the **Inspector** for the selection.
- Bottom: the timeline. Lanes are **grouped per character** (Picture, Background, Name tag, Voice), and each lane header
  has shown / heard / locked toggles. The selected clip has a coral outline and trim handles.

## The inspector (render/ui/layers/inspect, classes in tokens.css)
- **Head:** the kind's icon in a coral-soft square, then "Group · Layer", then "Clip id · kind" or "Video layer · n clips".
- **Sections** (`Sec`) fold open and closed, and remember it. Their order is the same for every kind:
  1. what the clip is (Clip: start / length / source / speed / fades, then Split at playhead and Delete clip);
  2. the kind's own sections;
  3. Layer (name, shown, heard, locked, Remove layer), folded.
- **Settings live on the layer.** A clip that overrides one shows a coral `clip ×` mark; click it to use the layer's
  value again. A change goes where the value lives.
- **Controls:**
  - Chips pick a look or preset; the chosen one is solid coral.
  - Segmented picks a mode.
  - Toggle rows are on / off.
  - Sliders have label | track | value. They are live while dragging (a draft, not saved), saved on release, and a
    double-click returns the default.
  - Number and time fields: type m:ss:ff or seconds; ‹ › nudge one frame.
  - A 3x3 anchor grid for placement.
  - Swatches plus "any colour".
- **Every feature is visible.** A feature that isn't ready for this project still shows, disabled, with one line
  saying why and how it gets made. Example: Eye contact "not prepared - one-camera projects make it when built".
- **Hold to compare:** "Hold: hear it untouched" plays the voice without its chain while held. It's a draft, never saved.

## Bench
`http://localhost:4747/inspect-test.html?id=_gl&show=amir.picture@first,daniel.voice,subs@first` shows any panels
side by side on a test copy. Ops are applied locally and never saved; `window.__ops` lists what was sent.
