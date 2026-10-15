# zoomcut

Raw takes + Hebrew script → finished vertical (1080×1920) Zoom-call comedy MP4.

```
python zoomcut.py build episodes/agentic-sync          # everything, cached between runs
python zoomcut.py build episodes/agentic-sync --no-render   # just match + plan + report
python zoomcut.py new episodes/next-sketch             # scaffold the next episode
```
(use `.venv/Scripts/python`)

## An episode folder
```
episode.json        characters (id, Hebrew name, filename aliases, role exec|victim), title, subtitles
script.txt          **אמיר:** ... lines, plus directives (below)
input/              footage, any structure. File/folder names say who it is: amir.mp4, ofer/take2.mov,
                    daniel-listen.mp4 ("listen" / "react" / "שקט" / "תגובה" = silent listening footage)
backgrounds/        optional <character>.jpg → virtual background (person cut out with RVM)
corrections.json    optional hand fixes, applied on the next build
work/               generated (report.md, edit.json, stills/) — safe to delete
out/<episode>.mp4   the result
```
If a file name doesn't say who it is, map it in episode.json: `"files": {"IMG_0412.MOV": "ofer"}`
or `{"IMG_0413.MOV": {"char": "daniel", "kind": "listen"}}`.

## Script directives
| directive | does |
|---|---|
| line ending with `—` | interrupted: next speaker starts on the cut, this voice runs on underneath and fades |
| `[שתיקה 0.8]` | extra silence before the next line (comedic pause) |
| `[חפיפה 0.3]` | next line starts 0.3s before this one ends (talking over each other) |
| `[דניאל מנסה לדבר 2.0]` | Daniel's last unscripted bit of speech (the "one more try" recorded at the end of his take) |
| `[הסר: דניאל]` | host removes him: tile vanishes mid-word, toast, participants 3→2 |

## corrections.json
```json
{ "lines": {
    "7":  { "clip": "amir.mp4", "in": 41.2, "out": 44.9 },
    "12": { "layout": "duo" },
    "18": { "pause_before": 0.9 },
    "20": { "skip": true }
} }
```
Line numbers are the `#` column in `work/report.md`. Layouts: `gallery`, `speaker`, `duo`.

## How it works
1. **prepare** — CFR 30fps proxies, audio aligned to the first video frame, denoised 48k + raw 16k wavs, face position per clip.
2. **transcribe** — ivrit-ai whisper-large-v3-turbo (CPU, int8) with word timestamps, biased with the script's names/jargon.
3. **match** — fuzzy text windows per line; a monotonic DP keeps lines in script order (so "אנחנו." finds the right "אנחנו"),
   prefers the later of two takes, and fills a line the recogniser mangled from its position between matched neighbours (flagged ⚠).
   In/out points are refined on the audio envelope so words aren't clipped.
4. **plan** — timing (interruptions cut on the word, pauses kept), comedy-aware layouts, listening footage on every
   non-speaking tile, active-speaker highlight (with Zoom's slight lag), live captions, Zoom events.
5. **background** — MediaPipe selfie segmentation (~45 fps, CapCut-level) on whole takes, composited at full res; `"background_engine": "quality"` uses RVM (~7 fps).
6. **mix** — line audio placed with fades, characters levelled, two-pass loudnorm to −14 LUFS.
7. **render** — fast path (`pipeline/compose.py`): Remotion draws only the interface as transparent PNGs, ffmpeg
   composites the videos per shot in parallel chunks, concat + audio. `--slow` renders everything in the browser
   (~1 fps). Then **validate** (size, codec, length, loudness, a still per shot).

## The editor
`cd render && node server.mjs` → http://localhost:4747 — script/media bin, live preview (540p preview copies),
inspector (take, in/out/cut, pause, layout, per-character framing & color, text on video), timeline
(Ctrl+wheel zoom, drag to move, drag edges to trim), undo/redo, Export / Export & send (email + Telegram).

Missing lines are reported, never substituted. Presets (UI strings, accent, timing) live in `presets/zoom-he.json`.

## Recording guide (send this to the actors / yourself)
- One take per character: every line in order, ~1s pause between lines. Fumble? Just say it again.
- On every line that ends with "—", **keep talking** past it. The edit cuts you off.
- Then ~60s of just listening (separate file named `<name>-listen`): nodding, reacting, trying to speak.
- Landscape, camera at eye level, head and shoulders with room around. Same mic for everyone.
- Different shirt per character. Plain background helps the cut-out.

Test material: `python tools/make_test_footage.py episodes/agentic-sync` builds a TTS-voiced fake episode
(`episodes/agentic-sync-test`, every frame says TEST).
