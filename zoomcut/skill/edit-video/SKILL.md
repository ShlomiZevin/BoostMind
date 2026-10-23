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
4. **Make the project** - the editor's "+ New video" (`POST /api/new {name, template: "zoom" | ..., folder, from}`;
   `from` = the closest earlier one-camera project: its set, music, voice, eye contact, look, subtitle style).
   `input_dir` points at his folder - never copy footage. Every new project is a layered one from the first minute
   (an empty project.json) and opens in the one editor with a **"New video"** step:
   - Zoom: the footage files with a thumbnail each - pick who is in each (Dialogue / Listening). The analysis starts
     by itself once every file has its person (`POST /api/ep/<slug>/files` per pick; it answers `waiting: n` until
     the last one).
   - One camera: the takes, and **Analyze**.
5. **Analyze through the server** (`POST /api/p/<slug>/build {action: "analyze"}`, wait on `/api/ep/<slug>/job`),
   never a parallel CLI run, and only when `GET /api/jobs` → `busy` is empty. The analysis (zoomcut.py / lesson.py)
   ends by writing the project's layers; they appear in the same editor. Then **fill the layers** (hook text, end
   poster, backgrounds, voice cleaning, effects, sounds) with ops - read `layers.md`; copy the look of the closest
   earlier project as ops.
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
- **He can always re-trim the cut himself - in the one editor, in every kind of video** (asked 6 times, last
  2026-10-22: "make sure I can drag videos to start before them and after them... always on partial videos"): every
  cut piece's edge drags out to take more of the original take, or in to take less. Zoom: the drag becomes a line
  fix (the analysis re-times the line, picture / voice / subtitles together). One camera: the drag re-cuts the take
  (`/api/ep/<id>/trim`, seconds) - picture, voice and subtitles follow, everything after shifts. A layer you make
  yourself: the item's edge pulls back footage up to the take's start / end.
  **The whole-take rule for any session:** a video item points at the WHOLE take (`asset` = the take, `in` = where the
  piece starts in it). Never a file cut down to the piece - then there is nothing to pull back.
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
  PROJECTS, not scripts** - a script with no project never shows ("I don't see it here"). So, in this order:
  1. **Script** - `POST /api/scripts {name: "<id>"}` then `PUT /api/scripts/<id> {text}` (first line `# <title>`, a
     `# על המסך – ...` note above each line that gets a sticker / card).
  2. **Project, at once** - make the footage folder (`Downloads\<series>\<n>`, empty is fine), then
     `POST /api/new {name: "<series>-<n>", folder, from: "<last project of the series>"}`; set its `script` to the id
     and its Hebrew `title` (the copy still points at the old script). Tell him: "refresh the Reader, pick <id>".
  3. **Fill it while he films** - the pictures (stickers via Leonardo, cut out; the end card; the story posters) AND
     the project's layers in episode.json `overlays`, each tied to her words (`from_words` / `to_words`, a list of
     alternatives each) so the analysis places them where she says it: hook (draft), ticker, every sticker, the verse
     card, the mid-video polaroid, the blinking CTA, the end card (`poster`, `fade_in` 1.5, from her last line, no
     `to_words` = to the end), `music.lift`; the files in `media/` + episode.json `media`. What needs the takes
     (re-take overlaps, the end-card hold, the fade to black) goes in `_todo` for right after Analyze.
  4. Footage arrives -> Analyze -> do the `_todo` -> review -> hand over.
  Example: tadar-6 (spiritual-4, elections).
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

## Leonardo - every picture we make (sets, portraits, logos, stickers, posters' art)
`node zoomcut/tools/leonardo.mjs image <prompt.txt> <out.jpg> <flare|sunburst> MEDIUM 1024x1024` and
`... portrait <his-frame.jpg> <prompt.txt> <out.jpg> flare MEDIUM 0.6 1024x1024` (repaints from a reference: his face,
wig, beard kept; 0.5 when the scene changes a lot). Key from aspect-agent-server/.env (read by the script).
- **Models - only these two** (his taste, 2026-10-20: "I'm loving more the sunburst and flare models"):
  `flare` = `openai/gpt-image-2.5-flare` - photoreal people, portraits from his frames, sets, event photos;
  `sunburst` = `openai/gpt-image-2.5-sunburst` - logos / emblems, products, die-cut stickers, flat graphics.
- **Cheap (his rule):** MEDIUM and the smallest size that works - 1024x1024, 1536x1024 for a wide one. Never HIGH /
  HD / 2x unless he asks. Paid 2026-10-23: sunburst square $0.021, flare portrait $0.024, flare 1536x1024 $0.033.
- Run several at once (`&` + `wait`), look at every result before using it.
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
- **Pace** comes from the Reader by itself. Measuring a character (⏱ by the name) or typing their pace updates the
  profile. The name must match the character's `name` / `aka`.
- After a video is done, add anything new you learned about the character to their profile (a new catchphrase, a
  new set, the website's new page). The page is the one place that knows them.

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
