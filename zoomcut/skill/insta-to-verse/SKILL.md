---
name: insta-to-verse
description: Bring Shlomi's OLD Instagram reels into the Shlomiverse wiki (shlomiverse.com/wiki) - pick by likes, download, transcribe, burn in subtitles, find the character (an unknown one = ask him on Telegram, then a profile + an OpenAI portrait), put the reel on the character's page at its real date (history, never "latest"), push live (no deploy). Use whenever he says Instagram videos to the verse / wiki, old videos, historical videos, "complete the verse", import reels, the next reel, or answers a Telegram question about who a character is.
---

# Instagram reels -> the Shlomiverse

He has ~1,300 reels on Instagram (@shlomizevin) from 2023 on; the wiki only had the editor's videos. This fills in the
history. **Read [[wiki.md]] in the edit-video skill too** (the wiki, the fan copy, the chat, the push).

## Everything you make goes into the editor's library - labelled, right away (his rule, 2026-11-02)
Any background, music, sound effect, picture, icon, emoji, sticker or clip you CREATE for a video goes into the asset
library (`zoomcut/library/`, the studio's Assets page) the moment it exists, with every label that matters - so nothing
is ever tagged in bulk again (his words: "so we won't get another time these things to tag").
- The makers do it themselves: `node tools/leonardo.mjs image|portrait|sfx|loop|video ... --about "<what it is, for
  which video>" --tags "<mood, place, use, character, style>" --project <id> [--kind background|picture|icon]`,
  `node tools/elevenlabs_music.mjs <out.mp3> <secs> "<prompt>" --about "..." --tags "..." --project <id>`.
- Anything else (a frame you cut, a sound you edited, a file from elsewhere): `node tools/library_add.mjs <file>
  --about "..." --tags "..." --project <id> [--kind ...]`.
- `--no-library` only for a throwaway test. Before you finish: `node tools/library_add.mjs --unlabelled` must be empty
  for what you made.
- Labels = what someone would search for later: what it shows / sounds like, the mood, the place, the character, the
  kind of video (Zoom call, rabbi monologue, news, trailer...), the series. Hebrew words welcome.

## His rules (2026-10-31)
- **Likes are the bar: over 1,000** (views need an Instagram reconnect with the insights permission - not done).
- **Order: newest first** (his call after reel #2, 2026-10-31 - the first two went by most likes).
- **Only reels posted before 2026-10-17** - from then on he builds the verse with the editor; those come in by Publish.
- **A batch:** `bash scripts/insta/batch.sh [N=10] [MIN_LIKES=1000] [BEFORE=2026-10-17] [AFTER=]` - the next N, newest
  first, skipping everything `state.json` knows (done, asked, skipped, no file). Other bars are just arguments: recent
  ones under 1,000 likes = `bash scripts/insta/batch.sh 10 0 2026-10-17 2026-06-01`. Refresh the list first when he
  wants new reels or fresh likes: `node scripts/insta/list.mjs` (media.json). Every downloaded reel stays in
  scripts/insta/work/<id>/ (video, words, subtitled web.mp4), so nothing is downloaded or paid for twice.
- **Every report ends with the running spend** (ledger scripts/insta/work/spend.json - his ask, 2026-11-01).
- **The progress page** (his ask, 2026-11-01): `python scripts/insta/progress.py "<what runs now>"` after every step ->
  scripts/insta/work/progress.html (open in his browser, reloads every 15 s): now-running line, total + per-kind spend,
  wiki counts, what waits for him, last-year progress, who the covers show, the cost log. Log every paid step in spend.json.
- **Subtitles burned in** (he means subtitles, not captions).
- **History, not news:** an imported reel keeps its Instagram date and `archive: true` - never in the wiki home's or
  the links page's "latest" rows. The home page is for what he makes now.
- **An unknown character -> ask him on Telegram** (he gets the notification, comes back to the session and answers with
  name / world / background). Never invent a name. "אמא של יוסי" never goes on the wiki (his rule).
- **Batches as he asks** ("do 10 more"); report the cost per batch.
- **Telegram only when you need something from him** (an unknown character, a name) - never for reports or FYI (his words, 2026-10-31).
- Profile pictures: OpenAI direct, GPT Image 2.5 flare (or sunburst), **LOW**, MEDIUM at most, never HIGH / Leonardo.

## Steps for one reel (from c:\workspace\BoostMind)
1. **The list** (refresh now and then): `node scripts/insta/list.mjs` -> `scripts/insta/work/media.json` (every post,
   likes, comments, date). Next reel = the NEWEST `timestamp` < 2026-10-17 with `like_count` > 1000, not in `scripts/insta/state.json`.
2. **Prepare:** `zoomcut/.venv/Scripts/python scripts/insta/reel.py <media-id>` -> `scripts/insta/work/<id>/`:
   video, frames, `words.json` (local Hebrew model), `ear.json` (OpenAI second ear), `who.json` (Terra's guess),
   `web.mp4` with subtitles + `poster.jpg`, `cost.json`. `--redo subs` (etc.) re-runs a step.
   Look at `strip.jpg` and a still of `web.mp4` before going on.
   **Twins:** right after the words, `twin` compares them with every editor episode (free). His recent reels were
   made in Shlomiverse Studio and are on the wiki already (the 2026-10-15 reel = the `follow-up` episode); a match stops
   the run, `state.json` -> `twin` - go to the next reel.
3. **Who is it?** Terra reads the burned-in text but **cannot name his characters** (it called the Rosenblum teacher
   "a dad" twice). If the look clearly matches a character in `zoomcut/characters` (same costume/setting as its
   portrait and its other reels), use it. Otherwise: `node scripts/insta/ask.mjs <media-id>` (the subtitled reel +
   guess + question to his Telegram; `state.json` -> asked) and stop until he answers.
4. **A new character** (after his answer): **always an AI portrait, in the same batch** (his words, 2026-11-01: "of
   course create nice profile with AI" - a cropped reel frame is NOT a profile picture; it is only the reference).
   **The look = the Techy-Tech team headshots** (public/techietech/team/*.jpg): photoreal studio headshot, head and
   shoulders, centered, eyes open looking into the camera, plain light-grey seamless background (a role setting is fine
   when it says who they are: Rosenblum's chalkboard), soft even light, his funny look kept (hair, glasses, facial hair,
   the face) as a believable real person - nothing looks like a costume. Women he plays: "smooth clean-shaven feminine
   face, no stubble". Ignore the reel's face filter (say so; for a googly-eyes filter say "normal human eyes").
   The script that made 24 at once: scripts/insta/portraits.py (STYLE text + one English description per character,
   ref = a clean frame crop above the burned-in text, 4 in parallel):
   `node zoomcut/tools/leonardo.mjs portrait <frame>[,<frame2>] <prompt.txt> <out.jpg> flare MEDIUM 0.6 1024x1024`
   (~$0.021 each). Keep the frame as `frame.jpg` next to `portrait.jpg`. A fix he asks for ("black hair", "an old polo")
   = the generated picture as the ref at 0.85 + "the same photo, unchanged, except ...".
   **Check `scripts/wiki/portraits/<id>.jpg` first** - it wins over the character folder on the wiki; some characters
   already have a good AI portrait there (copy it into the character folder so the studio shows it too).
   **A profile = who they ARE, not a moment from a reel** (Rosenblum, 2026-10-31: a finger-on-lips "shh" was "not a
   teacher's profile"): their role, looking at the camera, no gestures. Never write "wig" in a prompt; never a reference
   with closed eyes; his real age (Rosenblum 55-60).
   **Look-alikes:** Daniel and Vova both wear a black cap, glasses and a beard. Daniel = the victim who never finishes
   a sentence (Zoom calls); Vova = the veteran Russian, cynical, very professional, hates organizational nonsense and
   HR - a dry monologue, often with a mug. Judge by attitude, not the cap (a Vova reel was taken for Daniel, 2026-10-31).
   **Music only, no speech** (a song under on-screen text): no subtitles - mark every words.json line `doubt`,
   `--redo subs`; put the on-screen texts in `on_screen` and leave `transcript` empty.
   **A real public figure he imitates:** when the burned-in text NAMES the person ("אף אחד: עומר קולי…", "איך אנשים
   שונים…: מתן ניסטור") that name IS the answer - create the character with it, don't ask (his words, 2026-10-31:
   "all of them have the name of the person I mimic on top"; Oded Kattash, Matan Nistor, Alon Gonen, Danny Buller,
   Alex Daniel, Dor Eckstein, Omer Koli - each in a world of their own, linked when they share a reel). The older
   pun names he chose stay (Yuval "(כסא) נוח הררי", Nahor "(ציון) מינוף", Lior "סליים"). Ask only when no name shows.
   Profile through the studio:
   `POST localhost:4747/api/characters/<id> {"patch": {...}}` - name, name_en, aka, world, role, brief (his words),
   personality, catchphrases, speech, behavior, comedy, look, portrait, assets.portraits, color, sources - it saves to
   the database (catalogCharacters, the only copy since 2026-11-06; or `node scripts/verse/content.mjs put character
   <id> --file patch.json`). A new world = a series record: `content.mjs put series <url-id> --file w.json` with
   title, world (the studio's world name), name, blurb, brief (shlomiverse-content skill).
5. **A new character first** (if the reel has one): profile + portrait as in step 4, then its copy (bio) and the
   character page: `python scripts/wiki/copy_brief.py --only-missing`, Terra (openai.js run from the repo - it takes the
   design key `scripts/design.env`, which Backstage counts) - `python scripts/wiki/merge_copy.py <answer.md>` puts only
   the NEW character / world copy onto their records (keeps existing bios unless --force; videos stay in copy.json).
   No build / push needed for a character. Publish the reel only after the character exists.
6. **Onto the site - `versePublish`, no build / push / deploy** (since 2026-11-05 the site's video list is Firestore
   `catalogVideos`, one record per video; files in gs://shlomiverse-media/wiki/v/):
   `zoomcut/.venv/Scripts/python scripts/insta/to_wiki.py <media-id> <character-id>[,...] [--title "..."] [--teaser "..."]`
   uploads web.mp4 + poster.jpg, then writes the record (`ig-<id>`, cast, the reel's real date + post time,
   `archive: true`, the permalink, the transcript, and `onScreen` = who.json's burned-in text - the chat and Terra
   read it before the speech, the only words a music-only meme has; never append it to the transcript). The site and the chat have it at once. Terra on the server writes
   the title / teaser / the chat's card unless you pass them - **his own words always go in `--title`**. `--dry` first
   shows the record and writes nothing. It also records the reel in `scripts/wiki/reels.json` - our import record (the
   duplicate check in reel.py), it no longer feeds the site.
   - **Every video has at least one character** (his rule, 2026-11-05): always pass the cast. Sent none, Terra picks
     it (`castBy: 'ai'`, or `'none'` = nobody) - to_wiki.py prints `!! cast by ...`; fix it by running again with the cast.
   - **Never** push videos with build.py / push.cjs, and don't edit copy.json for videos - it doesn't reach the site.
   - **Change a live reel** (title, cast): run to_wiki.py again with the new cast / `--title` - the API updates only
     the fields sent, and a call without a title never blanks the one there. `{op: 'get', id}` shows the record.
   - **Off the site:** `{op: 'hide', id, hidden: true}` (he also has /backstage/ → סרטונים) - nothing else removes one.
   - The API: POST `https://europe-west1-boostmind-b052c.cloudfunctions.net/versePublish`, header
     `authorization: Key <key>` (not Bearer - Google's front door rejects it); the key is read at run time from
     `gcloud secrets versions access latest --secret=VERSE_PUBLISH_KEY --project boostmind-b052c` - never print,
     save or commit it.
   Check live: `https://shlomiverse.com/c/<id>`; the home page must NOT show the reel.
7. **The chat knows it - a reel is not done until this passes (his ask, 2026-10-31).** Every reel goes into the chat's
   brain (the character's bible + every reel's card and words; versePublish writes the reel's card), so 3
   minutes after publishing, on the LIVE function:
   - **the guide** answers about the character and links the reel (`[[char:<id>]]`, `[[video:ig-<id>]]`);
   - **a new character also chats as themself**, like every other character (the "לדבר עם..." button on their page,
     the `with=<id>` link). Their voice comes from their profile (speech, catchphrases, personality - the database record) - from one reel
     it is thin, so when later reels of them come in, add the new lines and habits to the profile (studio endpoint).
   Once per batch, ~4 minutes after publishing, one question (the first one costs ~$0.11 - never poll in a loop):
   ```bash
   printf '%s' '{"mode":"<id>|guide","r":"session-test","messages":[{"role":"user","content":"..."}]}' > "$TEMP/b.json"
   curl -s -X POST https://europe-west1-boostmind-b052c.cloudfunctions.net/wikiChat -H "content-type: application/json" \
     -H "origin: https://shlomiverse.com" --data-binary @"$TEMP/b.json"
   ```
   `r: "session-test"` marks the test in his chat logs. Read the answers (Hebrew mangles in the console - write to a
   file and Read it). Reel #1: Rosenblum answered whispering "אתה מהכיתה של רעות? תן לי לראות… תנסה לחשוב", and the guide
   linked him and his reel. One question each (~$0.01 cached, ~$0.10 not).

## Traps found on reel #1
- The local model with its voice filter (VAD) on heard 1 of 5 lines - his in-character mumble over room noise. reel.py
  runs it **without** the filter.
- OpenAI's second ear also drops real lines (missed "תנסה לחשוב" on a re-run) - a line is cut only when both doubt it.
- libass needs `Encoding -1` in the style, or Hebrew punctuation lands on the wrong side of the line.
- The editor's venv has no `requests`; reel.py uses urllib.
- Many top reels are "אף אחד:" memes: the joke is the burned-in text, speech is short or none - that's fine.

## Costs (measured 2026-10-31, after 27 reels - $3.10 in all)
| Step | Cost |
|---|---|
| download, local transcription, subtitles, push | free |
| OpenAI second ear (gpt-4o-transcribe, $0.006/min) | ~$0.006 |
| Terra fix (corrects the words) | ~$0.01-0.03 |
| Terra "who is it" | ~$0.02 |
| fan copy, one Terra run per batch | ~$0.03 a batch |
| picture, new character | $0 (a frame of the reel) - a generated one $0.013-0.02 |
| **the live chat test** | **~$0.11 the first question after a push (the brain, ~60K tokens, isn't cached yet), ~$0.013 after** |
A reel: ~$0.04-0.05. **The chat test was the biggest cost of the day ($1.74 of $3.10)** - polling it every 40 s
until it knew the reel. So: ONE question per batch (not per reel), asked once ~4 minutes after the push - no polling
loop; a new character gets one more. Hosting ~3-15 MB a reel.
