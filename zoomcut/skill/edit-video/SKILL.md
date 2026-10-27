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
- **One editor for every project** (his call, 2026-10-22: "I just want one editor"): every project has a
  project.json and opens in the layered editor. Zoom projects get it from every analysis; one-camera projects from
  the solo builder (`pipeline/to_layers_solo.py`). The older screens are not used any more. Deleting project.json
  brings a project back to its older screen (its episode.json / captions / corrections are never touched).

## EVERYTHING IS LIVE - NOTHING REBUILDS (his words, 2026-10-22: "as in CapCut exactly")
"When I'm changing something, it should be live." Every change in the editor shows at once - a filter, a voice
setting, noise cleaning, pitch, speed, the set, the cut-out's edge, a text, a drag of any clip. The only real jobs are
new content: **Analyze** (new footage) and **Make eye contact**; the cut-out engine (fast / quality / hybrid) is chosen
at Analyze. A builder that must re-plan after a drag does it quietly in the background - the edit already shows.
If you find something that makes him wait, it's a tool bug: fix it generically (a live prop + the same math in the
export), never "press Re-analyze".

There is ONE kind of project: layers. Never talk about "Zoom videos" vs "regular videos" - a grid of people is just
layers a builder made; the editor and the export don't know or care which builder.

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
8. **You don't export - he does.** Exporting is HIS step (the Send window), not part of your hand-over (his words,
   2026-10-25: "I hate it when he exports, especially the full quality"). If YOU want to check your work, use the live
   preview and stills first; if you still need a file, ONLY the fast test export, without sending it
   (`POST /api/ep/<id>/export {test: true, send: []}` - about a minute, `out/<id>.test.mp4`), and only when nothing else
   runs (`GET /api/jobs` → `busy` empty). **Never a Full quality export on your own** - only when he asks or presses Send.

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
1. **Studio up?** `cd c:\workspace\BoostMind\zoomcut\render && node server.mjs` (background). Never restart it or start
   another heavy job while ANY job runs, test (`_`) projects too: `GET /api/jobs` → `busy` must be empty.
2. **Footage.** The folder he names, or **the Drop**: he uploads from the iPhone at
   https://drop-463727469066.me-west1.run.app and files land in `Downloads\drop\<folder>` within a minute (the studio
   pulls each minute, then removes it from the Drop - the folder here is the footage; if one is late, `gcloud storage
   ls gs://boostmind-drop/<folder>/` and pull it yourself). **His marks:** in Media he marks takes Use / Don't use with
   a note (asset `mark` / `note`, layers.md) - read them before picking or changing takes. iPhone
   and filter-app files have random names (`13944E36-….MP4`, `export_….mov`):
   - **who is who** from a contact sheet of frames (wig, cap, glasses, shirt); ask once if unsure;
   - **order** from the recording time (`ffprobe … creation_time`; filter-app exports: the number in the name) →
     episode.json `"files": {"<file>": {"char": "ofer", "order": 2}}`;
   - he uploads while you work: start with what's there, but **one build with everything** - cancel a build a new
     arrival makes obsolete (`POST /api/ep/<id>/cancel`) instead of rebuilding twice.
   **Look before you plan:** ffprobe each file, frames, transcribe (faster-whisper via `pipeline.transcribe._get_model`,
   feed numpy). Know the footage second by second.
3. **Pick the recipe** (table below) and read it.
4. **Make the project** - before filming, from a script: the Reader's **Paste → "Create a new project for it"** (one
   camera / Zoom call, optional "settings like" an earlier project) makes the project with the script AND its Drop folder
   (`POST /api/new-from-script {name, kind, like, text}`) - he films with the Reader, uploads the takes into that Drop
   folder, and the project finds them. Or after filming: the editor's "+ New video" (`POST /api/new {name, template: "zoom" | ..., folder, from}`;
   `from` = the closest earlier one-camera project: its set, music, voice, eye contact, look, subtitle style).
   `input_dir` points at his folder - never copy footage. Every new project is a layered one from the first minute
   (an empty project.json) and opens in the one editor with a **"New video"** step:
   - Zoom: the footage files with a thumbnail each - pick who is in each (Dialogue / Listening). The analysis starts
     by itself once every file has its person (`POST /api/ep/<slug>/files` per pick; it answers `waiting: n` until
     the last one).
   - One camera: the takes, and **Analyze**.
5. **Eye contact only when the video needs it** (2026-10-25): any `eye_contact` key - even `{"on": false}` - runs it
   (minutes). Not a talk to the lens -> remove the key before Analyze (`recipes/monologue.md` → Eye contact).
   **Analyze through the server** (`POST /api/p/<slug>/build {action: "analyze"}`, wait on `/api/ep/<slug>/job`),
   never a parallel CLI run, and only when `GET /api/jobs` → `busy` is empty. The analysis (zoomcut.py / lesson.py)
   ends by writing the project's layers; they appear in the same editor. Then **fill the layers** (hook text, end
   poster, backgrounds, voice cleaning, effects, sounds) with ops - read `layers.md`; copy the look of the closest
   earlier project as ops.
6. **Self-review before he sees it** - lines (rule 3), rhythm (rule 4), voices (levels per take: a mostly silent take
   gets a huge automatic gain), stills of the key moments (opening, every cut-off, the ending) through the export path.
   Fix what you find first.
7. **Hand over:** the link, the length, the lines you fixed or could not find, 2-4 timestamps worth his ear, one line
   that he can drag any cut edge to pull footage back. **And the post is already written** (his rule, 2026-10-25):
   every video you make comes with its DEFAULT caption - a hook line + 3-6 hashtags, in the character's voice
   (`publishing.md`) - and its YouTube title, saved into the Send window (`POST /api/ep/<id>/publish {save: true,
   platforms, caption, title}`), so when he opens Send it's all there; tell him the caption in the hand-over.
8. **Iterate on his notes**, keep a short line going while you work.
9. **Send - one window for everything** (2026-10-25): the top bar's **Send** button opens it - **Test on my phone**
   (`POST /api/ep/<id>/export {test: true, send: ["telegram"]}`: 378x672, ultrafast, `out/<id>.test.mp4`, marked TEST,
   never published - to check the look and the sound), **Send the file** (Telegram, Email) and **Publish** (the
   socials). An up-to-date full export goes out as is; otherwise its button exports first (`out/<id>.mp4`, 1080x1920).
   **This is his step** - you never press Send or export Full quality for him (rule 8); you tell him it's ready.
   Commit and push when he asks - only your own files (other sessions have uncommitted work in this repo).
10. **Post it** - read `publishing.md`. The caption you saved in step 7 is in the Send window; **he presses Send**,
   never you. Instagram, TikTok drafts, YouTube Shorts and X are live; Facebook = a Telegram reminder to share the
   Instagram Reel.
11. **Put it on the Shlomiverse** - part of publishing, not an extra: the studio's "site" job runs
   `scripts/wiki/publish_site.py` by itself after every Publish (Jobs panel "Shlomiverse"); by hand
   `POST /api/ep/<id>/site` (`wiki.md`): web copy + poster, the fan title (Terra), build, deploy the site and the
   chat. Check it ended ✔ and act on any "!". Until then the video isn't on https://boostmind-b052c.web.app/wiki/ and the characters can't talk
   about it. **Do it the moment he publishes - don't wait to be asked** (2026-10-25, haredit-1: he had to remind me).
   A video reaches the wiki only when its project is **done** (`POST /api/ep/<id>/done {done: true}`) and has
   `out/<id>.mp4`.
12. **Every place the character and the video must reach - check each one, every video** (his ask, 2026-10-25:
   "make sure the edit video knows to guide each session to add the character to all these places if it wasn't
   already, and the character's videos"). For each character in the video, tick what's missing:
   - [ ] **Characters page** - a profile (`POST /api/characters/<id>`), its portrait, the video in `videos`, the
     facts the video added (family, catchphrases), then `node zoomcut/tools/character_profiles.mjs`.
   - [ ] **The world's site** - a Techy-Tech character gets a team card (`public/techietech/index.html` TEAM +
     the org chart DIVS, photo `team/<id>.jpg` 560x560 corporate headshot) and BOTH copies deployed:
     `sh techietech-site/deploy.sh` (techytech.web.app) AND `firebase deploy --only hosting` (/techietech/ on the
     main site). His browser caches techytech for an hour - tell him Ctrl+F5.
   - [ ] **Their own site** if they have one (a new video tile, its 540p copy) + its button on the links page.
   - [ ] **The Shlomiverse wiki** (step 11) - character page, portrait, the video, the fan copy.
   - [ ] **The chat agent** - it learns ONLY from `techietech-api/wiki-brain.json`, written by `build.py`: after the
     build, `firebase deploy --only functions:wikiChat` from `techietech-api/`, then TEST it: POST
     `https://europe-west1-boostmind-b052c.cloudfunctions.net/wikiChat` `{"mode": "<id>", "own": true,
     "messages": [{"role": "user", "content": "<a question about this video>"}]}` (Python, UTF-8; `own` keeps it
     out of his logs) and read the answer - it must know the new video.
   Before a main-site deploy: other sessions' unfinished pages ride along - compare the modified `public/` files with
   the live ones first (md5 of local vs `curl`), and say what else would go out.

## More of his rules
- **He can always re-trim the cut himself - in the one editor, in every kind of video** (asked 6 times, last
  2026-10-22: "make sure I can drag videos to start before them and after them... always on partial videos"): every
  cut piece's edge drags out to take more of the original take, or in to take less. Zoom: the drag becomes a line
  fix (the analysis re-times the line, picture / voice / subtitles together). One camera: the drag re-cuts the take
  (`/api/ep/<id>/trim`, seconds) - picture, voice and subtitles follow, everything after shifts. A layer you make
  yourself: the item's edge pulls back footage up to the take's start / end.
  **The whole-take rule for any session:** a video item points at the WHOLE take (`asset` = the take, `in` = where the
  piece starts in it). Never a file cut down to the piece - then there is nothing to pull back.
- **Sound is never naked; calls always have the other side** (2026-10-25, haredit-1): every video gets an ambience
  layer of the place + a bed (reusable comedy beds in `_assets/music/`), and every phone / Teams call gets the
  other side's mumble in her pauses (`recipes/offscreen-voice.md` → hani). A whispered blessing / drinking is acted,
  not silence - check the frames of a long pause before cutting it.
- **Pauses inside a take stay; only the joins BETWEEN takes are tight** (his words, 2026-10-23: "don't cut spaces in
  the same video, only between videos"). One-camera projects with several short takes: `cut.silence: false`. At a
  join the previous take's sound runs on under the next one's start (`cut.join` 0.25 - "continue the sound of the
  previous and start the sound of the next"); each take starts on its first syllable (measure the onset, dB per 10 ms).
- **A cut that changes the length (`removes`, `keep_pauses`, merge) moves only the builder's items** - everything he
  placed or trimmed by hand after that point (his own sound layers, `user` items, a hand-trimmed last piece, a
  duplicate subtitle) stays at its old frame: a gap before the last piece, music past the end (haredit-1,
  2026-10-25: "something in the end is not right... fit everything again, make them stitch"). After such a cut,
  shift every hand item after it by the same frames, then check: no gap between Person pieces, nothing past
  `duration`.
- **Trim a take's start / end with `cut.edges` [[where the cut put it, where it goes]] - never `cut.removes`** for that.
  removes run AFTER his drags, so the editor's edge stopped moving and he dragged six times for nothing (2026-10-23).
  The natural edges come from `lesson.spans` with no edges / removes. removes = a piece cut out of the middle only.
- **Several takes of the same passage:** show them before choosing - one numbered comparison video (`TAKE 1..n`
  burnt in, outside the footage folder) + a table of what differs; he picks. Drop exact duplicates by hash (the Drop
  can bring `<name>-2.mp4` copies); pick the takes with a `takes` glob that matches exactly those files.
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
- **Every video ships with two posters** (his rule, 2026-10-23: "for every video it has also to prepare story
  poster with link below"): the END CARD inside the video (above) and a **STORY POSTER** he posts the same day -
  1080x1920 JPG in the footage's Downloads folder, two versions: `<name>-story-instagram.jpg` with a dashed box BELOW
  ("👇 לקביעת טיפול 👇" / "👇 הקישור כאן 👇") where he drops Instagram's link sticker with the site URL, and
  `<name>-story-tiktok.jpg` with "🔗 הלינק בביו ⬆️" in that box (TikTok stories carry no link). Same art as the end
  card - a Leonardo portrait from his frame, the character's logo, the site's CTA in the character's voice, a line
  tied to the video's punchline. Nothing important in the top 240 px or the bottom 300 px (the apps' bars). Made as
  HTML + headless Chrome at 1080x1920, ONE render per call (parallel renders sharing a profile fail silently).
  Layouts to copy: `recipes/monologue.md` → tadar. Make both as soon as the script arrives - before the footage.
- **A script before the footage = a ready project before the footage** (2026-10-23: "prepare first the project
  reader then the rest, I'm filming" / "fill it while I'm filming"). He films with the Reader, and **the Reader lists
  PROJECTS, not scripts** - a script with no project never shows ("I don't see it here").
  **"Ready" means he opens the editor and sees every layer on the timeline** - set, wall pictures, stickers, texts,
  subtitles, music, end card - NOT a plan in episode.json that only Analyze turns into layers (2026-10-25, dorit-1:
  "why I can't see the Dorit project on the layers... I want you to create it already"). Never hand over a
  before-footage project with an empty timeline: build it on a stand-in take (step 3b). So, in this order:
  1. **Script** - `POST /api/scripts {name: "<id>"}` then `PUT /api/scripts/<id> {text}` (first line `# <title>`, a
     `# על המסך – ...` note above each line that gets a sticker / card). **The Reader text = only what the character
     SAYS** (2026-10-25, haredit-1: he had me strip the `**(stage directions)**` and the `**` marks - "רק את הטקסט
     שהיא אומרת"). A pasted script = a NEW script id - never paste it over a project's script in the Reader (that
     overwrote dorit-1's astrology script; restored from `scripts/<id>.txt.bak`).
  2. **Project, at once** - make the footage folder (`Downloads\<series>\<n>`, empty is fine), then
     `POST /api/new {name: "<series>-<n>", folder, from: "<last project of the series>"}`; set its `script` to the id
     and its Hebrew `title` (the copy still points at the old script). Tell him: "refresh the Reader, pick <id>".
  3. **Fill it while he films** - the pictures (stickers via Leonardo, cut out; the end card; the story posters) AND
     the project's layers in episode.json `overlays`, each tied to her words (`from_words` / `to_words`, a list of
     alternatives each) so the analysis places them where she says it: hook (draft), ticker, every sticker, the verse
     card, the mid-video polaroid, the blinking CTA, the end card (`poster`, `fade_in` 1.5, from her last line, no
     `to_words` = to the end), `music.lift`; the files in `media/` + episode.json `media`. What needs the takes
     (re-take overlaps, the end-card hold, the fade to black) goes in `_todo` for right after Analyze.
  3b. **Then BUILD it on a stand-in take, so he SEES every layer in the editor before he films** (his words, 2026-10-25:
     "when I say to create everything before the actual video, I want you to create it already. So why it's not
     there?" - dorit-1 had 32 overlays in episode.json and an EMPTY timeline). A stand-in = edge-tts `he-IL-HilaNeural`
     (or AvriNeural for a man) reading the script's spoken lines over his reference photo, "STAND-IN" burnt in, in
     `episodes/<id>/stand-in/` (git-ignored); `input_dir` there, eye contact off, Analyze through the studio. Check
     every overlay landed (count = episode.json overlays) and do the `_todo` on it, so he can move things now.
  4. Footage arrives -> `input_dir` to his folder, eye contact on -> Analyze (replaces the stand-in) -> redo the
     take-bound `_todo` (end-card hold, fade) -> review -> hand over.
     **Trap (dorit-1, 2026-10-25 - "you didn't run the fix eyes to look to the camera"):** the stand-in build saved the
     Person layer's `eyes: false`, and layer props are never overwritten by a rebuild - the NVIDIA copies were made but
     the editor kept showing the original eyes. After the real Analyze: `layer.update person props {eyes: true}` by op,
     and check `GET /api/p/<id>` → the takes' `eyes_engine` is set AND the Person layer's `eyes` is true.
     **Also:** the Reader edits whichever script is selected - if he pastes a new script over this project's, the
     analysis subtitles the wrong text (dorit-1 got another video's lines). Before Analyze, read the script's first
     line; `scripts/<id>.txt.bak` holds the version before the last project-script edit.
  Example: tadar-6 (spiritual-4, elections).
- **Mirror** a take when he holds up a book / sign and the letters read backwards (front camera): the Person layer's
  Inspector → "Mirror (flip left ↔ right)" (`props.mirror`, layers.md) - his picture flips, the set and texts don't.
- **As few layers as possible** (asked 2026-10-23 and again 2026-10-25): stickers / texts that are not on screen
  together share one layer - time them so they don't overlap; a second layer only for things meant to be seen together.
  Report "N items on M layers" (reference.md → "Few lanes").
- **A new character = a new idea** (2026-10-25: "don't copy. We need to come with our own idea for this project"):
  look at earlier projects for the mechanics, never reuse another character's look (stickers, set, music, posters).
  **Each character has ONE studio** used by all their videos, and the video's own pictures (a chart on her wall, a
  map) are separate layers on it (`behind: true` overlays) - never baked into the studio photo.
- **Real people:** no realistic images of real politicians at invented events; "תמונת AI" tag on realistic AI people.
  His own images / recordings stay out of the public git repo.
- **Every character is a real person** (2026-10-21): each recurring character gets their own web presence built the
  way THEY would build it - Ayelet's 2009 healer site (/ayelet/), Yuval's publisher page (/homo-useless/), Yotam's shop
  (/yotamverse/), Techy-Tech's corporate site (techytech.web.app - a serious company site, no jokes on it). Never
  "parody", never Shlomi's name on it. Every such site gets a button on his links page (public/links/), and the video
  shows it (an end poster, or a short ticker / blinking box that says "הלינק בביו" - never the boostmind URL).
- **Every video can have its character's site, and every site has a CTA that reaches his email** (his ask, 2026-10-23:
  "there should be a cta on the website, a call to do something... going to my email"). If a character has no site
  yet, offer one. Live now: /ayelet/ (book a treatment), /hindsight/ (join a plan), /demokratovich/ (ask the rabbi /
  pledge a donation), Techy-Tech (send a CV). How to make one:
  - **Look like the character would build it**, as lame or as slick as the real thing (a community-shul site: בס״ד,
    navy + gold, marquee, red "תרמו עכשיו" everywhere, a donation pop-up). The jokes are in the character's voice and
    from his scripts; the site plays it straight.
  - **Pictures with Leonardo** (below): his portrait from a frame of his footage, the logo, a product, an event photo.
    `public/<site>/img/` + `v/` for his video (a 540p copy). His face and recordings go in `.gitignore` (deployed from
    this machine, never in the public repo). A realistic AI crowd gets a small "תמונת AI" tag.
  - **The CTA = a form posted to `siteLead`** (`techietech-api/index.js`, emailed to shlomi@boostart.io; name + phone or
    email, a `choice` line and a message; nothing charged, nothing stored, a hidden `website` field for bots). A new
    site = one entry in `SITES` there, then `cd techietech-api && firebase deploy --only functions:siteLead --project
    boostmind-b052c`, then one test POST with curl (a "בדיקה" name) before he relies on it. Money is only ever a pledge
    ("we'll call you back") - never a payment.
  - **A good link preview** (WhatsApp / social - he asked, 2026-10-23): `img/og.jpg` 1200x630, under 300 KB, made as
    HTML and shot with headless Chrome (his portrait, the logo, the name, one line in the character's voice, the CTA);
    og:title / description / url / image (ABSOLUTE https URL - WhatsApp ignores a relative one) + og:image:width /
    height + `twitter:card` summary_large_image. Check with `curl -A "WhatsApp/2.23" <url>`.
  - Deploy the site (`firebase deploy --only hosting --project boostmind-b052c` from BoostMind), check the URLs 200,
    add the links-page button, and give the video a poster / CTA that sends them to the bio.

## ElevenLabs - more people from his own voice (his call, 2026-10-23: "it might be a game changer")
`node zoomcut/tools/elevenlabs.mjs choir <his take.mp4> <out.wav>` = a crowd singing / saying it WITH him: the voice
changer (`eleven_multilingual_sts_v2`) turns his take into 4 other men (Brian, Bill, Callum, Roger), each lined up
to his take by its loudness envelope (they come back within +-20 ms), 0/15/30/45 ms apart, one hall; mix it UNDER him
(a sound tied to the take: `at` = `from` = the take second, gain ~0.45). Also `sts <in> <voice> <out>` (his line in
one other voice), `voices`, `balance`. Key: `ELEVENLABS_API_KEY` in `zoomcut/.env` (git-ignored, never printed).
- **Cost** (always tell him): ~1000 credits per minute of audio per voice; Creator plan = 300k credits a month,
  ~$0.07 per 1000. The medley (8 songs x 4 voices, made twice) used 12,195 credits (~4%, ~$0.90).
- The plan allows 5 requests at once - the tool retries; run takes one after another. The voices are kept in
  `<out>.voices/` - a new mix never pays twice.
- **Never re-time a voice** (an asetrate detune drifted 0.2 s over a song - "the singers are not synced").
- **Each singer its own layer, never one mixed choir** (his words: "put all the singers as layers. Don't merge
  them"): one `sounds` entry per take per singer with `lane` 0-3 (= Sounds 1-4, renamed "קהל – <name>" by op), the
  file = the voice kept in `<choir>.voices/<voice id>.mp3`, gain ~0.36, `room` 0.4.
- **Tie a take's sound to where HIS voice starts in it** (`from` = `at` = the piece's `in`, e.g. 1.13): `at` 0 put
  every choir 0.7-1.4 s late - the cut starts the sound at the clip, not before it.
- **Nobody sings on the dot** (his words): Brian 14-22 ms early, Roger 4-12 early, Bill 18-26 late, Callum 36-44
  late, a few ms different every song. Late = `at` later than `from`; early = `from` later than `at` (start further
  into the singer's own recording) - an `at` before the clip start is clamped to 0.
- Clear the project's `work/layers/sounds/` after replacing a sound file under the same name (cached copies).
- Free alternative to compare: his own voice through `rubberband=pitch=..:formant=preserved` x4 (0.84 / 0.92 /
  1.06 / 0.5), same delays and hall. Send him both (A / B) the first time a video needs a crowd.
- **Hebrew voices, picked per song** (2026-10-23, "some came out good and some terrible"): the 8 Israeli men in the
  account ("HE Nimrod / Itamar / Viktor / Dorian / Itai / Omer / Tomer / Amit" - the tool's default 4 are Hebrew now).
  Convert every song with every voice, then SCORE each pair: the recogniser on the voice vs his own take's words
  (clarity) + the loudness-curve correlation with his take (timing, and its lag). Keep per song only timing >= 0.75
  (0.85 on a wordless niggun - no voice says "רק") and clarity within 0.25 of that song's best; e.g. "אנא עבדא" kept 4,
  "גוש השינוי חי" all 8. Depth baked into each kept file (close dry / mid darker + short room / far darker + more
  room, gains 0.26 / 0.24 / 0.20). 8 songs x 8 voices = ~5k credits.
- He is happy to spend the credits ("you can even use them all") - quality over saving; still say what it cost.
- Try a big change to his video on a COPY (`<id>-he`: copy episode.json, captions.txt, project.json, media/, work/)
  while he is still checking the original (his ask).
- **Music beds** (2026-10-25, "find the background music suitable... create it with 11 labs or Leonardo"):
  `node zoomcut/tools/elevenlabs_music.mjs <out.mp3> 80 "<prompt>"` (Eleven Music, instrumental). Only 2 requests at
  once on this plan (a third gets 429). Make 3 options in the character's world, put all three in the project's
  `media`, pick one for `music.sound`; **never ask the prompt to be "quiet / sparse / gentle so speech sits on top"** -
  that made three slow, empty tracks he called awful (2026-10-25); the level is the mix's job. A bed with a
  character = a composition plan (`node zoomcut/tools/elevenlabs_music.mjs <out.mp3> - <plan.json>`: global styles
  with the BPM + instruments, negative styles slow / ambient / sparse / vocals, 4 sections). Measure every option's
  tempo and onsets per second before offering it (he can't be the first to hear a slow one). ~1,200 credits per
  90 s track; measure its LUFS and set `gain` against a known bed (tadar harp: -17.2 LUFS at
  0.08 → a -9.5 LUFS track ≈ 0.04).

## Keys - where each one lives (read before saying "I have no key")
Never print a key, never write one into a file in the repo, never ask him for one that is listed here.
- **OpenAI (GPT: Terra, SOL, Luna, image models through OpenAI)** - two working keys:
  - **Local scripts / tools:** `OPENAI_API_KEY` in `C:/workspace/aspect/aspect-agent-server/.env`. The one in
    `BoostMind/.env` is **revoked** (401 on every call - it looks valid, it isn't). `sol.js` reads the cwd's `.env`
    first, so always pass `--env "C:/workspace/aspect/aspect-agent-server/.env"`. Call it from a script under
    `BoostMind/scripts/` that reads that path (ad-hoc `grep` of a key out of another project gets blocked).
  - **His own key** (he gave it 2026-10-24, "use it"): Google Secret Manager on boostmind-b052c as **`WIKI_OPENAI_KEY`** -
    it runs the live wiki chat (`techietech-api/wiki.js`, `defineSecret('WIKI_OPENAI_KEY')`). In a local script:
    `KEY=$(gcloud secrets versions access latest --secret=WIKI_OPENAI_KEY --project=boostmind-b052c)` into a variable,
    never echoed. The project's `OPENAI_API_KEY` secret belongs to something else - never overwrite it.
  - Models: `gpt-5.6-terra` (his pick for chat and Hebrew copy), `gpt-5.6-sol`; `node ~/.claude/skills/sol-leonardo/scripts/sol.js --models --env ...` lists them.
- **Leonardo:** `LEONARDO_API_KEY` in `zoomcut/.env` - his official account (`tools/leonardo.mjs` reads it by itself; aspect-agent-server/.env only as a fallback).
- **ElevenLabs, NVIDIA (eye contact), the Drop, Instagram / Facebook / TikTok / YouTube / X:** `zoomcut/.env`.
- **Gmail** (sending): aspect-agent-server/.env; **Telegram:** xplace-auto-bidder/.env.
- **Secrets the deployed functions use** (`gcloud secrets list --project boostmind-b052c`): GMAIL_USER, GMAIL_APP_PASSWORD,
  WIKI_OPENAI_KEY, LEONARDO_API_KEY, MAPS_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY (not ours to touch).

### ElevenLabs - the whole toolbox (learned 2026-10-27, haredit-2; docs + github.com/elevenlabs/skills)
He said "I don't think you are utilizing all of its power with annotation". What it can do, measured:
- **Speech: `eleven_v4`** (`POST /v1/text-to-speech/<voice>`, `language_code: "he"`, `voice_settings {stability 0.3,
  similarity_boost 0.75}` - v4 takes only those two; lower stability = more emotion). In Hebrew v4 beat v3: "מלכי
  עלתה על השיש" came out exact on v4, "מרקי ... לשייש" on v3. Always transcribe a generated line before using it.
- **Audio tags = the annotation**: inline, in brackets, where the delivery changes - `[panicked, out of breath]`,
  `[whining]`, `[straining, frustrated]`, `[flat, matter-of-fact]`, `[shouting away from the phone]`, `[sighs]`,
  `[crying]`, `[whispers]`, `[laughs]`, `[sarcastic]`, `[excited]`; combine them (`[calm again, into the phone]`).
  Punctuation directs too: `...` = a pause, CAPITALS = stress, `—`/`-` = cut off. Tags are NOT read aloud (checked).
- **Text to Dialogue** (`POST /v1/text-to-dialogue`, `inputs: [{text, voice_id}]`, `model_id eleven_v4|eleven_v3`,
  `language_code`, `settings {stability}`, `seed`): a whole multi-voice scene in one file, up to 10 voices / 2,000
  chars; interruptions = a dash at the cut + `[jumping in]` on the next turn. Use it when the lines overlap each other;
  separate lines when he needs to move each one (usually - every sound its own item).
- **`audio_effects`** on TTS and dialogue: `filter_preset_id` (Phone, Low Quality Phone, Bright Phone, Old Radio,
  Cheap Microphone, Robot), `environment_id` (Small Room, Big Room, Hall, Tunnel, Street, Valley, Forest),
  `background_noise_id` (Call center, Café, City, Keyboard), `distance`, `pan` (`GET /v1/audio-effects/catalog`).
  We generate CLEAN and put the phone on in the editor (`filter: phone`, live, adjustable) - bake it only if he asks.
- **Sound effects** (`POST /v1/sound-generation`, `model_id eleven_text_to_sound_v2`, `duration_seconds` 0.5-30,
  `prompt_influence` 0.5, `loop: true` for a bed): specific prompts that combine elements and context ("a boy with a
  plaster leg cast clumsily climbing a wooden kitchen cabinet: wood creaking, doors banging, a heavy thud"). One file
  per event (each its own item he can move), plus one looping bed under the whole scene.
- **Voice Design refuses children** (`/v1/text-to-voice/design` -> 403 "safety guidelines" for "a 12-year-old girl") -
  never rephrase around it. A young character = a young ADULT library voice + `pitch` 1.1 on the item (live): Hebrew
  library voices `GET /v1/shared-voices?language=he&age=young` - Zina (female, `Tbj9UQjXon5RB9MPEyc2`), Dorian (male).
  Crying / screaming kids come from sound effects (generic vocalisations), never a designed child voice.
- **The other side of a chaotic call** (haredit-2, his favourite thing in it - "super funny, though nonchalant"):
  **NO words from the caller - only a mumble** (his rule, 2026-10-27: "no need to hear her daughter speak, only the
  mumble and the sounds"; the sigal mumble at pitch 1.35 for a girl, `filter: phone`), and **the house events LOUD**
  (gains 0.6-0.9 on a crash / crying / climbing, 2-3x a bed) - in HIS pauses, each answering the line before; under the whole call a looping chaos bed;
  on top the events, each timed to a word (a crash, then the crying, right before "מי בוכה שם?"); all through
  `filter: phone`; the caller deadpan while the house burns, Hani calm over it. Assets: `_assets/haredit/calls/`.

## Leonardo - every picture we make (sets, portraits, logos, stickers, posters' art)
`node zoomcut/tools/leonardo.mjs image <prompt.txt> <out.jpg> <flare|sunburst> MEDIUM 1024x1024` and
`... portrait <his-frame.jpg> <prompt.txt> <out.jpg> flare MEDIUM 0.6 1024x1024` (repaints from a reference: his face,
wig, beard kept; 0.5 when the scene changes a lot). **Key: his official Leonardo account's key in `zoomcut/.env` (`LEONARDO_API_KEY`, set 2026-10-26 - he: "this should be the official API key we are using for our editor to run everything"); the script reads ONLY it - no fallback; the aspect project runs on its own Leonardo key and the two never cross (his ask, 2026-10-27). Never another key.**
- **Models - only these two** (his taste, 2026-10-20: "I'm loving more the sunburst and flare models"):
  `flare` = `openai/gpt-image-2.5-flare` - photoreal people, portraits from his frames, sets, event photos;
  `sunburst` = `openai/gpt-image-2.5-sunburst` - logos / emblems, products, die-cut stickers, flat graphics.
- **Cheap (his rule):** MEDIUM and the smallest size that works - 1024x1024, 1536x1024 for a wide one. Never HIGH /
  HD / 2x unless he asks. Paid 2026-10-23: sunburst square $0.021, flare portrait $0.024, flare 1536x1024 $0.033.
- Run several at once (`&` + `wait`), look at every result before using it. About 10 queued at once is the cap -
  beyond it "RATE_LIMIT_EXCEEDED / Too many pending generations": send batches of ~8 and retry the refused ones.
- **Real politicians as tarot cards / costumes, when he asks** (2026-10-25: "create a BB tarot and Gadi tarot and
  Bennett and Yair Lapid"): reference = the Wikipedia lead photo (`action=query&prop=pageimages&piprop=original`,
  a UA header, resized to 1024), `portrait ref.jpg prompt.txt out.jpg flare MEDIUM 0.6|0.8 1024x1536`, both
  strengths, pick per person; the card carries a "תמונת AI" tag; refs + results stay git-ignored.
- **No words in the picture** (Hebrew breaks): ask for "no text" and put the words on in HTML / a text layer.
- A logo or sticker: ask for it on a flat white / mint background, then `tools/cutout_logo.py in.jpg out.png`.
- A real person's face never - his own face, from his frames. No real politicians at invented events.
- **A character based on a REAL person** (he worries about being sued, 2026-10-21): the character gets a fully fictional
  name - in the hook, on the site, on the poster ("נהור (ציון) מינוף", not the real surname); the site gets
  `<meta name="robots" content="noindex">` so a search for the real name never lands on it; faces are his own
  (Leonardo from his frames), never the real person's; nothing collected or charged.

## Characters - the multiverse (his ask, 2026-10-23)
Every recurring character has a profile in the studio (left rail → **Characters**): name, portrait, who they are,
personality, catchphrases, look, voice preset, **pace** (words per minute), writing rules, relations, their website,
their videos and their assets. It's where he learns about them and briefs a session ("Copy brief for a session").
**A new character is not done until it is in every place of workflow step 12** (profile, the world's site, their
own site, the wiki, the chat agent - tested).
- **Data:** `zoomcut/characters/<id>/character.json` (format: the fields above - see any existing one; `index.json`
  orders them and names the worlds). Images stay where they are and are referenced by path (`assets.portraits /
  backgrounds / logos / sounds`, `portrait`). Pictures copied into a character folder are gitignored (his face, public repo).
- **Every video:**
  - Before you build it, find its characters on the page (`GET /api/characters`).
  - **A new character gets a profile first:** `POST /api/characters/<id> {patch: {...}}` with name, world, role and brief
    from the script, a portrait from his frame (or Leonardo `portrait` from it), the look and the voice preset.
  - Then the video lists them: project.json `"characters": [ids]`. The builders fill it (Zoom: the participants;
    one camera: the series' character). Check it, and add a guest character by hand.
  - Use the profile when writing for the character: the catchphrases, the writing rules (e.g. Yotam speaks in the first
    person; the sites never say parody) and the relations.
- **Writing for a character:** read `zoomcut/characters/<id>/profile.md` first. It's the same text as the page's "Copy
  profile for a session": who they are, what they do, how they talk (and their pace), what's funny about them, the
  rules, the people around them, and what their videos already did. After changing a profile, run
  `node zoomcut/tools/character_profiles.mjs` so the files match (the page always builds it live).
- **Pace** comes from the Reader by itself. Measuring a character (⏱ by the name) or typing their pace updates the
  profile. The name must match the character's `name` / `aka`.
- After a video is done, add anything new you learned about the character to their profile (a new catchphrase, a
  new set, the website's new page). The page is the one place that knows them.

## The Shlomiverse, the links page, his images - read `wiki.md`
His world on the web is filled from this studio: **שלומיוורס** (https://boostmind-b052c.web.app/wiki/ - every
character, every video, a chat with each one in their own voice), the **links page** in all his bios
(https://boostmind-b052c.web.app/links/), and **his own analytics** (/stats/). A new character or a finished video
reaches them only through step 11.
- **Profile photo:** https://boostmind-b052c.web.app/links/shlomi.jpg (880x880, studio with the wigs) ·
  older: https://boostmind-b052c.web.app/links/profile.jpg
- **Facebook cover:** https://boostmind-b052c.web.app/links/img/fb-cover.jpg (1640x624) · sharp:
  https://boostmind-b052c.web.app/links/img/fb-cover-2x.jpg - made from his real portraits (`scripts/wiki/fb-cover.html`).
- Deep links for posts and end cards: `/wiki/#/c/<character>`, `/wiki/#/v/<video>`, `/wiki/#/chat?with=<character>`.

## Recipes - read the one you need
Under the hood two engines exist: `lesson.py` (one camera - almost everything) and `zoomcut.py` (a Zoom grid of
separately filmed characters). Pick by the footage; never name things after a series in the UI.

| What he recorded | Recipe | Engine |
|---|---|---|
| several characters, one file each, a meeting / call grid | `recipes/zoom-call.md` | zoomcut.py |
| one person talking to camera - rabbi lesson, guru podcast (tadar), news anchor, keynote | `recipes/monologue.md` | lesson.py |
| one person reacting to a voice we don't see - a Zoom at his desk, a phone call on speaker, an office day (Hani) | `recipes/offscreen-voice.md` | lesson.py |
| a silent stare + her thoughts as voice-over (Gen Z), cinematic | `recipes/genz-thoughts.md` | lesson.py |
A new kind of video: start from the closest recipe and the closest earlier project, then write its recipe file when
he signs off.

## More
- `layers.md` - **the project format**: layer kinds, items, ops, builders, export. The contract for filling a video.
- `wiki.md` - **the Shlomiverse, the links page, his profile / cover images, his analytics**: addresses, step 11,
  the chat, his rules for those pages.
- `publishing.md` - **posting to his socials**: what each platform takes (caption, hashtags, limits), how to write
  the post, how to prepare it for him.
- `editor.md` - how the editor, the live cut, layers, the background render and the export work (read before
  changing code).
- `reference.md` - every episode.json setting, the tools (Leonardo, sound kit, eye contact, sending), gotchas.
