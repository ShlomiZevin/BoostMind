---
name: edit-video
description: Edit Shlomi's TikTok comedy footage into a finished vertical video with Sketch Studio (c:\workspace\BoostMind\zoomcut) - one editor where every element is a layer (each take, each character's background, subtitles, texts, images, voices, music, filters) and one export. Projects, never templates; recipes per kind of video (Zoom-call sketch, monologue - rabbi / guru / news anchor / keynote, a person with an off-screen voice, Gen Z thoughts). Use for /edit-video, and whenever Shlomi says he recorded a sketch / has new footage / uploaded through the Drop / a folder in Downloads / wants a video edited, mentions zoomcut, Sketch Studio, the editor at localhost:4747, Amir/Ofer/Daniel/Ronit/Gilad, POV text, or asks to export/send a video to email or Telegram.
argument-hint: "[footage folder in Downloads or the Drop] [what the sketch is]"
---

# /edit-video - Sketch Studio

Shlomi runs a 40K-follower Hebrew comedy TikTok. He records every character himself (wigs, face filters) and wants a
finished vertical 1080x1920 MP4. **You make the first edit; he fine-tunes it himself in the editor
(http://localhost:4747) and exports.** Everything is in `c:\workspace\BoostMind\zoomcut`; it runs locally.
Reply to him in English; Hebrew only inside the video.

## THE EDITOR IS THE TOOL. YOU FILL IT - YOU DON'T CHANGE IT. (his words, 2026-10-22)
"When an editor is working, he doesn't change the tool almost never. He is mainly spilling things into the tool."
"We need to have a tool which can have layers ... zoom is a great example of a very complex layered composition ...
any AI code tool can work with and spill things into it without changing it. The skill should say what to do."

**A video is a list of layers: `episodes/<id>/project.json`.** Read `layers.md` (the format) before you touch one.
- Layer kinds: video (footage in a window, cut-out), backdrop (the photo behind a cut-out person), image, text
  (styles: pov, plain, tag, toast, pill...), subtitles, shape, audio (voices, effects, music - with RNNoise / clarity /
  speech levelling), effect. Every item has `from` / `dur` in frames; the editor shows each layer as a lane he controls.
- **You fill it, three ways - all through the studio, never by editing files behind the editor:**
  1. a **builder** turns footage + script into layers: Zoom grid = Re-analyze (`POST /api/p/<id>/build {action:
     "analyze"}`; a new Zoom project: analyze, then `{action: "layers"}` once). Line fixes: `{action: "line", n, fix}`.
     A rebuild never touches what he changed by hand (pipeline/project.py merge);
  2. **ops** for everything else: `POST /api/p/<id>/ops {rev, ops: [...]}` - add a text / picture / sound layer, move
     an item, set a background, a voice filter, a speed (examples in `layers.md`);
  3. **files** into Media: `POST /api/p/<id>/assets?name=<file>` (raw body), then use the asset id in a layer.
- A look the tool doesn't have (a new text style, a new layer kind) = tool work: one generic addition (a style in
  `render/src/layers/styles.tsx`, documented in `layers.md`), on its own, tested on a `_` copy - never a one-video hack.
  If you notice you are about to edit `render/`, `pipeline/` or the engines while making a video - stop, tell him in
  one line, treat it as its own task.
- Export = the one exporter (`pipeline/export_layers.py`): what the editor shows is what the file gets.
- Projects made before the layered tool still open in the older screens (one-camera projects move over with the solo
  builder - stage 2). Don't convert a project he is working on; convert on a `_` copy first and show him.

## READ FIRST - how we work (his rules; each one cost him a round)

1. **No templates. Only projects.** A new video is a new project. Learn from earlier projects and copy their look and
   feel (a Zoom grid, office backgrounds, the POV band, an end poster, a voice setting) - but it is a project, never a
   "template". Never say or show "template" to him. (2026-10-22: "We don't need templates. We just need projects.")
2. **Everything is a layer he can change himself.** Each take's picture, **each character's background / set**, **the
   subtitles**, every text, every picture (end card, poster, sticker), **every voice with its own filters and volume**,
   the music, every filter - each one visible on the timeline with its own controls. Nothing is baked into another
   layer's pixels or audio. A setting you add for one video becomes a generic control, never a hand edit.
   - **Before you build:** check the engine shows every element as a layer. If it can't, tell him in one line first;
     the fix is a layer in the editor, never a one-video workaround that bakes it in.
   - **Before you hand over:** open the project in the editor and confirm every layer is there; name any that is not.
   - *What went wrong (gilad-joins, 2026-10-22):* the Zoom engine baked the office backgrounds into the takes, had no
     subtitles layer and one mixed voice track - the edit was "very, very good", but he could not show the whisky in
     Gilad's room or play with Daniel's voice himself. "It has to be layers." Bringing them to the editor is the work.
3. **Every scripted line is accounted for.** After each build read `matched X/Y · N to check · N missing` and run the
   audit. The recogniser drops short phrases ("חד משמעית", "נכון", "מצוין", "טוב, תודה"), so a "missing" line is often
   there: measure the voice (dB per 10 ms) and transcribe that span alone before you call it missing. If a line is
   really not in his takes, **tell him**: who, the exact line, where it falls. Never patch it silently.
4. **A real conversation.** Normal turns: lines land on each other, no dead air (he called this "perfect"). **Cut-offs:
   the one cutting in starts while the other is still clearly talking** (0.5-1 s of both voices), the cut-off voice
   keeps going underneath, then stops. A line said over someone ("זה סדר הגודל" over "תקשיב ×3") plays in full on top,
   and the view switches between them. Start each line on its first word (no breath, no tail of the line before) and
   end on its last word (no gasp after).
5. **The editor is the tool; this skill uses it.** Making a video = setting up a project's layers with the tool as it
   is, then he (or you, on his word) changes them. A video session does not change the tool. Something the tool can't
   do = a deliberate, generic tool improvement (a layer kind / control every project gets, written in `editor.md`) -
   never a one-video patch. See `editor.md` → "The tool and the skill".
6. **This skill learns.** Anything you learn about how he wants it - cutting, rhythm, sound, looks, how he works -
   goes into this skill (here, the recipe, or `reference.md`) the same session, with the date and his words. A lesson
   that stays only in the conversation is lost.
7. **First cut fast, then his notes.** Never let him review a half-built state ("wait, building" - then say it's ready).
   His timestamps are the editor's time at 1x speed. When he says "you do it", make the call yourself.

## USING THE TOOL RIGHT - what went wrong on gilad-joins (2026-10-22) and the rules from it
The video came out great; the way I used the tool did not ("something in the tool you didn't use as supposed to").
What I did wrong:
- **Built features into a side screen.** The Zoom project opens in an older, Zoom-only screen. I added backgrounds,
  voices and subtitles THERE (a "רקע" lane, a character card) instead of in the main editor every other project uses -
  so its backgrounds were nowhere in Media, controls sat in other places, it didn't feel like his tool.
- **Changed the tool in the middle of a video**, under time pressure, piece by piece, while he was waiting.
- **Worked behind the editor's back**: edited episode.json / corrections.json and ran `zoomcut.py voices` from the
  shell instead of going through the editor's controls / the studio's endpoints - the screen didn't always show it.
- **Exported without checking what he set**: an export went out at 2× because the project's speed had changed.
- **Made the export heavier without load-testing it** - his PC blue-screened mid-export.
- **Debugged too long** on one problem (the export freeze) before taking the simple route.

The rules:
1. **One editor.** Every project - Zoom grid or one camera - is edited in the same main editor: its Media tab, its
   layers, its inspector. Never add a feature to a side screen. If a project type still opens elsewhere, say so and
   bring it into the main editor (tool work, below) - don't extend the side screen.
2. **Use the tool the way he does.** Change a project through the editor's own controls / the studio's endpoints, so
   what you set is what he sees. Never edit project files behind an open editor; never run the engine from the shell
   while the studio is up (build / export / voices go through the studio).
3. **Tool work is separate from video work.** Making a video = setting layers with the tool as it is. If the tool
   lacks something: stop, tell him in one line, and do the tool change as its own planned task - generic (every
   project gets it, in the main editor's existing places), tested on a hidden copy, load-tested before he exports with
   it, written in `editor.md`. Never patch the tool piece by piece while he waits on a video.
4. **Before every export:** read the project as he left it - speed, the layers, the length (`GET /api/ep/<id>`) - and
   export exactly that (a layered project: `GET /api/p/<id>` - speed, hidden / muted layers, length). A setting that
   looks off (2× speed) = ask, don't export.
5. **Show before applying** a look or sound change: stills of the tiles (big AND small), short before / after mp3s.
6. **Time-box debugging:** two or three attempts, then the simplest route that works.

## The workflow (every video)
1. **Studio up?** `cd c:\workspace\BoostMind\zoomcut\render && node server.mjs` (background). Never restart it while a
   job runs (`GET /api/ep/<id>/job`).
2. **Footage.** The folder he names, or **the Drop**: he uploads from the iPhone at
   https://drop-463727469066.me-west1.run.app and files land in `Downloads\drop\<folder>` within a minute (the studio
   pulls each minute; if one is late, `gcloud storage ls gs://boostmind-drop/<folder>/` and pull it yourself). iPhone
   and filter-app files have random names (`13944E36-….MP4`, `export_….mov`):
   - **who is who** from a contact sheet of frames (wig, cap, glasses, shirt); ask once if unsure;
   - **order** from the recording time (`ffprobe … creation_time`; filter-app exports: the number in the name) →
     episode.json `"files": {"<file>": {"char": "ofer", "order": 2}}`;
   - he uploads while you work: start with what's there, but **one build with everything** - cancel a build a new
     arrival makes obsolete (`POST /api/ep/<id>/cancel`) instead of rebuilding twice.
   **Look before you plan:** ffprobe each file, frames, transcribe (faster-whisper via `pipeline.transcribe._get_model`,
   feed numpy). Know the footage second by second.
3. **Pick the recipe** (table below) and read it.
4. **Make the project from the closest earlier one** (`lesson.py new episodes/<slug> --from <closest> --input "<folder>"`,
   or `zoomcut.py new` for a Zoom grid). `input_dir` points at his folder - never copy footage.
5. **Build through the server** (`POST /api/p/<slug>/build {action: "analyze"}`, wait on `/api/ep/<slug>/job`),
   never a parallel CLI run. A new Zoom project: after the first analyze, `{action: "layers"}` makes its project.json
   (copy the look of the closest earlier layered project: its text layers, poster, voice settings - as ops).
   Then **fill the layers** (hook text, end poster, backgrounds, voice cleaning, sounds) with ops - read `layers.md`.
6. **Self-review before he sees it** - lines (rule 3), rhythm (rule 4), voices (levels per take: a mostly silent take
   gets a huge automatic gain), stills of the key moments (opening, every cut-off, the ending) through the export path.
   Fix what you find first.
7. **Hand over:** the link, the length, the lines you fixed or could not find, 2-4 timestamps worth his ear, one line
   that he can drag any cut edge to pull footage back.
8. **Iterate on his notes**, keep a short line going while you work.
9. **Export - a Quick check first, then Full quality** (his flow, 2026-10-22): he checks the edit on his phone from a
   **Quick check** (Export menu → Quick check: half size 540x960, fastest encoder, `out/<id>.draft.mp4`, the email says
   DRAFT; ~3 min for a 3-min Zoom video vs ~9 for full). When he's happy, **Full quality** (1080x1920, `out/<id>.mp4`,
   "ready for TikTok"). Same button / endpoint he uses: `POST /api/ep/<id>/export {send: ["email"], quick: true}`.
   Commit and push when he asks - only your own files (other sessions have uncommitted work in this repo).

## More of his rules
- **He can always re-trim the cut himself:** every cut piece's edge drags to take more / less of the original take
  (`cut.edges`, `corrections.json` for Zoom). Keep it working whenever you change the cut.
- **Every change shows at once.** He hates waiting and "Updating preview". Only real picture work rebuilds.
- **What he sees is what he exports, and exports fast.** Same cut, sounds, text, filters, speed in both.
- **Subtitles follow what he SAID**, not the script (his ad-libs stay - add them to the script line). Hook text starts
  "פוב:" (never "POV:") unless his words have no prefix; his exact words; y ≥ ~250; max ~3 lines so it never covers
  a face (smaller `size` before more lines).
- **Cinematic, not overdone:** a real-looking scene first, effects as layers on top at moderate strength. He rejected
  shake, flashes, zoom kicks, heavy grades ("like Saw").
- **Sound is measured, not guessed** (dB per window, spectrum, ring-out after words). Phone / filter-app voices: find
  the actual problem first (muffled? ringing? codec "watery" top?) and fix that; one fixed loudness gain for the whole
  video (no level riding); never let processing eat a word (RNNoise ate an "אה" and a last word) - transcribe before /
  after.
- **The ending:** end on the last word. A character / company site goes on a **full-screen poster on black** right on
  that word (logo, the hook - e.g. "מחפשים עובדים!" - the site, the URL big and clear), held ~4 s. No Zoom tail.
- **Real people:** no realistic images of real politicians at invented events; "תמונת AI" tag on realistic AI people.
  His own images / recordings stay out of the public git repo.
- **Every character is a real person** (2026-10-21): each recurring character gets their own web presence built the
  way THEY would build it - Ayelet's 2009 healer site (/ayelet/), Yuval's publisher page (/homo-useless/), Yotam's shop
  (/yotamverse/), Techy-Tech's corporate site (techytech.web.app - a serious company site, no jokes on it). Never
  "parody", never Shlomi's name on it. Every such site gets a button on his links page (public/links/), and the video
  shows it (an end poster, or a short ticker / blinking box that says "הלינק בביו" - never the boostmind URL).
- **A character based on a REAL person** (he worries about being sued, 2026-10-21): the character gets a fully fictional
  name - in the hook, on the site, on the poster ("נהור (ציון) מינוף", not the real surname); the site gets
  `<meta name="robots" content="noindex">` so a search for the real name never lands on it; faces are his own
  (Leonardo from his frames), never the real person's; nothing collected or charged.

## Recipes - read the one you need
Under the hood two engines exist: `lesson.py` (one camera - almost everything) and `zoomcut.py` (a Zoom grid of
separately filmed characters). Pick by the footage; never name things after a series in the UI.

| What he recorded | Recipe | Engine |
|---|---|---|
| several characters, one file each, a meeting / call grid | `recipes/zoom-call.md` | zoomcut.py |
| one person talking to camera - rabbi lesson, guru podcast (tadar), news anchor, keynote | `recipes/monologue.md` | lesson.py |
| one person reacting to a voice we don't see - a Zoom at his desk, a phone call on speaker | `recipes/offscreen-voice.md` | lesson.py |
| a silent stare + her thoughts as voice-over (Gen Z), cinematic | `recipes/genz-thoughts.md` | lesson.py |
A new kind of video: start from the closest recipe and the closest earlier project, then write its recipe file when
he signs off.

## More
- `layers.md` - **the project format**: layer kinds, items, ops, builders, export. The contract for filling a video.
- `editor.md` - how the editor, the live cut, layers, the background render and the export work (read before
  changing code).
- `reference.md` - every episode.json setting, the tools (Leonardo, sound kit, eye contact, sending), gotchas.
