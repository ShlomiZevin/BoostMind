# ElevenLabs - voices that act (and the rest of the sound)

Read before making any voice line, narration or voice-over. Learnt on Naomi's game (השהיית תגובה, 22 Nov 2026): his verdict on
flat text-to-speech was "terrible, robotic ... it should be empathic", and Hebrew words came out wrong until the spelling was
fixed. Facts from the official docs (elevenlabs.io/docs: best-practices/prompting/eleven-v3, overview/models,
api-reference/text-to-speech/convert, capabilities/text-to-speech/eleven-v4), checked 22 Nov 2026, plus what our own takes showed.
Key: `ELEVENLABS_API_KEY` in `zoomcut/.env`. Worked example: `scripts/naomi-games/pause/tools/voice.mjs` + `stt-check.py`.

## Model - Hebrew
- **`eleven_v4`** for Hebrew (100,000 chars per request; the docs call it a net upgrade over v3 and recommend it). `eleven_v3`
  also speaks Hebrew (5,000 chars). **Multilingual v2 and Flash do NOT speak Hebrew** - never use them for Hebrew.
- Always send `language_code: "he"` (it pins the language and the number reading).
- `GET /v1/models` lists the account's models and their languages - check there when unsure.

## Acting - audio tags (the difference between an actor and a robot)
- A **delivery note in square brackets, in English, before the words**, like a director's note to an actor:
  `[warm, gentle, soothing, like a therapist opening a session]`, `[deeply moved, emotional]`, `[gently concerned, compassionate]`,
  `[urgent but gentle whisper]`, `[tender, kindly disappointed]`. Several in one bracket with commas. The mood carries on until the
  next tag, so a line can change mid-way: `... זה מרגש. [softly] וזה גם אמיץ.`
- **Gestures**: `[sighs]`, `[exhales]`, `[exhales slowly]`, `[laughs]`, `[clears throat]`, `[gasps]`, `[whispers]`, `[softly]`,
  `[pause]`, `[long pause]`. Officially listed emotions include `[sad]`, `[curious]`, `[excited]`, `[sarcastic]`, `[crying]`,
  `[mischievously]`; free descriptions work too (the docs' own: `[Warm, conversational tone, faint amusement]`).
- Describe the VOICE, not a sound effect - a tag can be taken as a request for an effect.
- **Pauses**: a dash `—` gives a clean pause; `...` gives a pause WITH hesitation (good for emotion, bad for authority); commas give
  breathing; CAPS give emphasis (Latin only). No `<break>` / SSML on v3/v4.
- Write each line's delivery **per moment of the game / beat of the script** (a TAG per kind of moment, a full SPOKEN line where
  a sigh or pause makes it human) - never one tag for everything.

### What went wrong in our takes (his notes, 22 Nov 2026)
- **Breathy / whispery / exhaling / sighing tags sound EROTIC** on a woman's voice ("the sounds sound erotic") - for a therapist,
  coach or narrator use a clear, warm, professional voice: `[clear, warm, professional, confident, natural pace, full voice, ...]`
  plus the moment's emotion (`pleased`, `concerned`, `genuinely moved`). Keep `[whispers]`, `[sighs]`, `[exhales]` for scenes that
  really need them, never as "softness".
- **Don't add pauses inside a sentence** - `...` and dashes split words ("זה סקין טו סקין ... רגשי") and sound stilted. Speak `...`
  as a comma (the written line on screen can keep it); let the voice find its own pace.
- **v4 sometimes repeats a phrase or word** ("ילד מרגיש הכל. ילד מרגיש הכל.", "רגע, רגע") - catch it with speech-to-text
  (transcript longer than the line / words don't match) and re-take that line with a new `seed`; loop until every clip passes.
  Automated: `stt-check.py` prints `BAD: ids`, `voice.mjs --ids <ids> --seed <n>` re-takes only those.
- **Keep the tag SHORT - shorter than the line** (2-4 words: `[smug, self-satisfied, pleased]`). A long character description in
  the tag before a short Hebrew line made v4 repeat the line 2-5 times (12 of 25 lines); the same lines with a 3-word tag all
  passed. Put the character into 2-3 strong words.
- **Don't burn credit on re-take loops** (his rule): one pass, one speech-to-text check, at most one re-take of the failed lines
  - if many fail, the cause is the prompt (tag length, pauses, spelling), fix that instead of re-rolling.
- A character's voice is a CHARACTER, not a generic "nice" voice: Naomi's coach = "a therapist full of herself" (`smug,
  self-satisfied`) - that is where the comedy is.

## Settings
- `voice_settings: { stability: 0.5, similarity_boost: 0.75 }` for a clear professional voice (0.35 for a big emotional scene).
  **Lower stability = more emotional range (and more glitches); high (0.8+) = monotone** - that was the robotic take.
- `style` stays 0; `speed` and `use_speaker_boost` are not reliable on v4 - leave them out (slow the delivery with tags/dashes).
- `seed` (0-4294967295) for a repeatable take (best effort). For a long voice-over split into parts, send `previous_text` /
  `next_text` (or `previous_request_ids`, same model) so the parts flow.
- Output: `?output_format=mp3_44100_128` (default). Each identical request can be regenerated 2 times free - make 2-3 takes of an
  important line and keep the best.

## Voice choice
- A voice **trained in Hebrew** reads Hebrew best (account: "Danit - Natural Israeli Hebrew" `s0T0DT6EAPeX57MQpn3I`, female; the
  "HE ..." male voices). In the voice library filter Language = Hebrew. A voice with a wide emotional range takes tags better; if a
  tag is read aloud, that voice doesn't fit that delivery - change the voice, not the tag.
- **ElevenLabs' default voices expire on 31 Dec 2026** - don't build on them; use library voices added to the account.
- A coach / narrator / announcer doesn't have to be the resident (his call for Naomi's game: "a therapist voice ... it will be funny").

## Hebrew spelling - נִקּוּד (vowel marks)
Hebrew is written without vowels, so the model guesses - and sometimes guesses wrong (our takes: "השהיה" came out "השעיה",
"השהיית" came out "קשה ה...", "ה״נו״" came out "האנו", "ילד... מרגיש" came out "ילד, ילד"). The docs say nothing about nikud; what worked:
- **Add nikud only on the word that was misread** (partial nikud): `סְקִין טוּ סְקִין`, `בְּכָל`, `ה״נוּ״`. Full-sentence nikud is
  not needed and can make it stiff.
- If a word still comes out wrong with nikud, **reword it** (השהיה -> עצירה) - the line on screen can stay as written while the
  spoken text differs (keep a SPOKEN map).
- English words inside Hebrew: write them in Hebrew letters with nikud (`סְקִין`), or as the English word if the voice knows it.
- Gershayim / quotes inside a word (ה״נו״) and `...` right after a word can make it repeat or swallow sounds - check those lines.
- Numbers: write them as words when the reading matters (שלוש, not 3).
- v4 also reads IPA between slashes (`/ʃalom/`) for one hard word - untested in Hebrew yet; try it before rewording a name.

## Check every clip - speech-to-text
Run every clip through the Hebrew model (`zoomcut/models/he-turbo`, faster-whisper; see `stt-check.py`): the words must come back
right and no tag may be spoken. Re-take what fails (nikud on the word, or reword). Keep the clip length in mind - a tagged line
with sighs runs 30-60% longer than flat TTS; leave room for it in the game's timing.

## Sound effects and music
- Effects: `node zoomcut/tools/leonardo.mjs sfx <prompt.txt> <out.mp3> <secs>` (ElevenLabs sound-effects), loops with `loop`,
  music `node zoomcut/tools/elevenlabs_music.mjs <out.mp3> <secs> "<prompt>"` - describe the place and the feel, "seamless loop,
  no vocals". At most 5 requests at once (batches of 3-4). Level everything (`ffmpeg ... loudnorm=I=-16`).
- Out of credit: `node zoomcut/tools/elevenlabs.mjs balance` shows usage; past the usage-billing threshold every call fails with
  `quota_exceeded` - ask him to raise it; meanwhile take effects / music from the libraries (asset library, Plaxzy studio library,
  other verse games) with his OK.
