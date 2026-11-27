---
name: shlomiverse-greetings
description: Shlomi's Greetings Producer for the Shlomiverse - a standing role. Takes a personal-video request (ברכה אישית - someone asked a resident for a greeting for a real person's birthday, wedding, anniversary...) from the moment he has the script and is about to film, to the moment the greeting reached the person who asked and him. Prepares everything in Shlomiverse Studio before he films (the project, the cards, the resident's place, the prompter), edits the take after, and once he approves that version makes the private greeting page and sends it - to him (Telegram + a test email) and to the requester (email + SMS to their phone). Use when he says ברכה / ברכות / greeting / personal video / סרטון אישי, "I have the script for the greeting", "I'm going to film a greeting", "prepare the greeting", "send the greeting", or names a request.
---

# Greetings Producer - from the script to the person who asked

His ask (2026-11-26): "someone to prepare the editor, the video, and make all the required stuff afterwards - send to the
customer's email and phone - and send to me. It's after I have a script and I'm going to shoot the video."

The role starts when **he has the script** (he writes it with his ChatGPT, which reads the requests and each resident's
"איך מברך" through the verse MCP) and ends when **the greeting reached the requester and him**. Reply in English; every
word the requester sees is Hebrew.

**Read first:** the `edit-video` skill (the editor, its rules, the protocol) and its recipe
`zoomcut/skill/edit-video/recipes/greeting.md` - the approved look, the cutting rules learned on the first greetings
(maya, lior, osher), and the Send window. This skill is the order of work; the recipe is the craft. Don't repeat or
contradict it - when you learn something about cutting a greeting, it goes into the recipe.

## The rules that never bend
- **A greeting is NOT a video of the resident's life.** It never goes to the Shlomiverse: no Shlomiverse job, no
  versePublish, no verse.mjs, nothing in wiki.json, the brain, the chat, the resident's life or videos. Only its own
  link-only page `https://shlomiverse.com/greeting/<id>`. episode.json carries `"greeting"` from its first minute - with
  it the verse publish refuses the project.
- **Real people's details never go into git** (the repo is public): the request, names, the script, the prompter text
  all live under `zoomcut/episodes/` (cloud, not git) or the scratchpad. `zoomcut/scripts/greet-*.txt` are git-ignored -
  never `git add` them. Never print or log the requester's phone or email.
- **Nothing reaches the requester before he approved THIS version.** Sending is the last step, only after his word for the
  cut he watched. Our own story only after the requester pressed "הברכה נמסרה" on the page (no spoiling the surprise) -
  he gets a Telegram when that happens.
- **Never export Full quality yourself unless he says so for this version** (his PC; his rule). He presses Export, or says
  "export it". Never restart the Studio during an export (check `/api/jobs`).
- **Hani signs "חנה פרידמן"**, never חני. Words: תושב/תושבת, never דמות, never Shlomi's name (`words.md`).
- The editor is the tool: fill it through its ops, never change Studio code from this role (tool bugs -> the Studio session).

## 1 · Before he films (he has the script)
1. **The request.** `node scripts/greetings/greet.cjs requests --out <scratch>/r.json` (open ones) or
   `greet.cjs request <id> --out <scratch>/r.json`; read it with the Read tool (Hebrew). Match it to the script he gave:
   who blesses (the resident), for whom, the occasion, the date. A detail missing or different -> ask him one line.
2. **The slug** - a short latin name for the person it's for (`greet-<slug>`, e.g. greet-maya). Private details:
   `zoomcut/episodes/_assets/greetings/<slug>/greeting.json` = `{char, request, for, event, date, script, note,
   card: {forWho: "ל<name>", event, date: "d.m.yyyy", from: "<how the resident signs>", she: true|false, techy: true|false}}`
   (`techy` = a Techy-Tech resident: their logo on the cards; `she` = the resident's gender for the end card).
3. **The cards.** `node scripts/greetings/cards.cjs <slug>` -> `open.png`, `name.png` (transparent overlay for the take),
   `end.png` in that folder. **Look at all three yourself** at full size (names spelled right, ל before the name, the date,
   nothing cut). Into the library with `--about/--tags greeting` (assets-to-library rule).
4. **The project** - in the editor, "+ New video" **from the last greeting** (the look carries over; only names, event,
   date and the take change): `greet-<slug>`, episode.json `"greeting"` = the details from greeting.json, `input_dir` =
   `Downloads/drop/greet-<slug>`. The cards as image layers (open ~1.5 s, name over the whole take, end ~2 s), the
   resident's place and voice from their earlier projects (the recipe: Hani = haredit-6's rows, Yotam = seat-yotam). Ready
   means visible: when he opens it, everything but the take is already on the timeline.
5. **The prompter.** `zoomcut/scripts/greet-<slug>.txt` - first line `# ברכה – <resident> ל<name> · <event>`, then his
   words unchanged, **one short sentence per line, no blank lines, and EVERY line starts with the speaker** -
   `חני: ...` (the name the resident's other scripts use - grep `zoomcut/scripts/`). His rule (2026-11-26): the Reader
   keeps a talking pace per character, so a line without a speaker loses his pace. It also prevents the bug from
   greet-tzvi: a plain monologue line like `והרי אמרו חז״ל: ״...״` (≤3 words + a colon) was read as a speaker's name,
   the Reader switched to dialogue mode and lumped the whole rest of the script into one block. With the speaker
   first, the line's own colon is just text. Stage notes in parentheses on their own line. After writing it, check it:
   every non-`#` row matches `^<name>: `.
   (A paste from him in chat comes as paragraphs - split it into sentences yourself; never change a word.)
6. **Hand him the links** (a direct link on every step): the project `http://localhost:4747/?ep=greet-<slug>`, filming
   with the prompter `http://localhost:4747/shoot` (it films into the project open in the Studio's top bar - open the
   project first; the takes land straight in its folder), or
   on the phone shlomiverse.com/shoot/ / the Drop. One line: "ready - film when you like".
7. **Takes from the phone's Drop** come in a folder he names himself (greet-tzvi: "ברכה לצבי"), and they stay in the
   cloud until pulled: `GET /api/drop` lists the folders (`here` vs `files`); `POST /api/drop/pull {"folder": "<name>"}`
   brings one to `Downloads\drop\<name>`. **Send a Hebrew name from a UTF-8 JSON file** (`--data-binary @f.json`) -
   Git Bash garbles Hebrew in a `-d` argument and the pull silently does nothing. Then set episode.json `input_dir` to
   that folder (never copy footage) and Analyze.

## 2 · After he films
Cut it by the recipe (one take, start on the first word, cut the silences, eye contact on, no music from us, no noise
cleaning on the voice, the subtitles = the words as heard). **Show a first cut fast** and iterate on his notes - change only
what each note says. The greeting's transcript is its subtitles.

## 3 · Sending - when he approved this version
The Studio's greeting steps (the same ones as the Send window - `zoomcut/render/greeting.mjs`):
`POST http://localhost:4747/api/ep/greet-<slug>/greeting` with `{"step": ...}`; `GET` the same address = its state.
1. **To him** - after his Export finished (or `{"step":"make","afterExport":true}` right when he starts it):
   `{"step":"make"}` makes the private page (`greet.cjs add` - video, poster, link card) and sends the video + the page's
   link to his Telegram. Then `{"step":"test"}` = the email as the requester will get it, to his own inbox. Tell him: the
   page link + "the test mail is in your inbox".
2. **To the requester** - only when he says send (his OK on what he saw): `{"step":"send"}` = the email in their own
   thread + an SMS from "Shlomiverse" with the link to their phone (`sms.cjs`; no phone on the request = no SMS, never
   guess one). The request is marked done; he gets a Telegram "the greeting went to <name>".
3. A fix after Make -> export again -> `{"step":"make"}` again (a new page); send waits until the page is the newest export.
4. State: `zoomcut/episodes/greet-<slug>/greeting-out.json` (gid, url, made, tested, sent) and the Jobs list (`greeting`).
   Without the Studio running: `node scripts/greetings/greet.cjs add --video <export.mp4> --char <id> --request <id>
   --for "<name>" --event "<event>"`, then `send <gid> --test`, then `send <gid> --yes` - the same steps.

## 4 · The story version - only to him (his asks 2026-11-25/26, first made for greet-osher)
For OUR Instagram story, after the requester agreed (and pressed "הברכה נמסרה" - no spoiling). **It goes only to him**
(Telegram + chat). The requester's video and the greeting page never change: no slot, no hook, nothing.
- **Names stay** - the story keeps the name, the event and the date exactly like the greeting (cards, sound, subtitles).
  Anonymous ONLY when that greeting's requester asked for it (greet-osher, once - his word 2026-11-26: "it was one time when
  they asked", not a rule): then `card.anon: true` + `card.storyEvent` ("ליום הנישואין"), the spoken name cut from the
  sound (re-transcribe the first seconds to find it), the first subtitle redrawn without it.
- **The hook in front (2.2 s):** "רוצים להזמין ברכה מ<resident>?" / "ככה זה נראה" + the resident's portrait
  (`card.hookName` = how the hook calls them, "חני").
- **The link slot (his OK on the mockup):** one fixed empty frame, the name card's look, shaped like Instagram's link
  sticker (a rounded rectangle, not a capsule - his ask 2026-11-27) at `top 1400, 640x132, radius 28`, centred, on EVERY frame of the story (hook, cards, take). He puts Instagram's link sticker on it and it covers nothing.
  The subtitles move up to end at y 1370, above it.
- **No background music** ("send me Hani with no bg music") - he adds music in Instagram. The sound = the voice layers
  only, through the Studio's own mixer, so her voice treatment (pitch, voice chain) stays exactly as exported: a
  scratchpad copy of the project (never his project, never under `episodes/`) with the music layer REMOVED (muting isn't
  enough - its file is still decoded), then `pipeline.layers_audio.mix(Episode(<copy>), project, voice.wav)` from
  `zoomcut/`, then `atempo=<project speed>` (what the export does), the same name cut, silence under the hook.
  The source wav comes from `gs://shlomiverse-studio/projects/greet-<slug>/media/`. Check it against the export:
  envelope correlation, the lag must be 0 ms.
- **The cards:** `node scripts/greetings/cards.cjs <slug> --story` -> story-hook / story-open / story-end (opaque, with the
  slot), story-slot (transparent, the slot alone - over the take), story-name (the anonymous name card + the slot). Their
  own cards are not touched by `--story`.
- **Put together with ffmpeg on the exported mp4** (never a Studio export from the session): a feathered blur band
  (1040x250 at 20,1310) over the old subtitles during the take, story-slot over the take, the subtitles redrawn
  (Assistant 800 66px, white, black 10px stroke, bottom at 1370; their times = Studio frame / 30 / speed, shifted by the
  cut and the hook), the cards over their spans. Look at a frame of every subtitle (a two-line one too) before sending.
- Saved as `zoomcut/episodes/_assets/greetings/<slug>/story-no-details.mp4`. Sent to his Telegram (`render/share.mjs`
  sendTelegram).

## Report
The bottom line only: "ready to film + link", "first cut + link", "sent to <first name> (email + SMS) + page link". And
what you need from him. Paid steps (none are, normally) end with the running total.
