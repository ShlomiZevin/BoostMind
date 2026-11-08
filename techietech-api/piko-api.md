# Piko API

The server behind Piko (shlomiverse.com/piko/): pictures from GPT Image 2.5 (with reference images) and videos from
Seedance 2.0 Mini or Fast (a start frame, optionally an end frame, with sound). Shlomi's app and his other tools
(startdoing.co.il) use this same API. Code: `piko.js`.

This page online (always the deployed version): https://shlomiverse.com/piko/api/docs

## Base URL and sign-in

`https://shlomiverse.com/piko/api` (or the function directly: `https://europe-west1-boostmind-b052c.cloudfunctions.net/piko`)

Every call sends one of:
- `Authorization: Key pk_...` - another tool's own key. Make one with `node scripts/piko/client.mjs add <name>`
  (shown once; add `--library` if what it makes should go into the Shlomiverse asset library too). Revoke with
  `node scripts/piko/client.mjs revoke <name>`. **Keep the key on that tool's server, never in a web page.**
- `Authorization: Bearer <Firebase ID token>` - Shlomi's own Google account (the Piko app).

Browsers may call it from shlomiverse.com, boostmind-b052c.web.app, startdoing.co.il (and www.) and localhost.
Errors come back as `{ "error": "<code>" }` with the HTTP status: `auth` 401, `balance` 402 (not enough EvoLink credit),
`prompt` / `image` / `too_many_refs` / `end_needs_start` 400, `image_too_big` 413, `too_many` 429.

## Pictures in

Wherever a picture goes in (`refs`, `start`, `end`), it can be:
- a data URL or plain base64 (`"data:image/jpeg;base64,..."`), up to 12 MB (send ~1536 px JPEGs)
- `{ "url": "https://..." }` - Piko downloads it
- `{ "job": "<id>" }` - a picture made earlier by the same caller

## Calls

| Call | What |
|---|---|
| `GET /config` | models, sizes, qualities, max references, the two video models with their $ per second, who you are |
| `GET /balance` | EvoLink credit left: `{ credits, usd, usdPerCredit }` (`?fresh=1` asks EvoLink now) |
| `POST /transcribe` | a recording → `{ text, prompt }`: the words, and a clean prompt - in English for `mode: video` (Seedance reads English best), in the language spoken for `mode: image` |
| `POST /images` | start a picture → the job (201) |
| `POST /videos` | start a video → the job (201) |
| `GET /jobs/:id` | the job; poll every few seconds until `status` is `done` or `failed` |
| `GET /jobs?limit=40&before=<created ms>` | your jobs, newest first (`more: true` if there are older ones) |
| `DELETE /jobs/:id` | off the list (the file stays in the library) |
| `GET /presets` / `PUT /presets` | the caller's saved setups `[{ id, name, mode: "image" | "video", params }]` (PUT the whole list; Piko's buttons) |

### POST /transcribe
```json
{ "audio": "<base64>", "mime": "audio/webm", "mode": "video", "hasStart": true, "hasEnd": false, "refs": 0, "language": "he" }
```
`mode`: `video` | `image`. `language`: `he` (default) or `auto`. Audio: webm, mp4/m4a, mp3, ogg or wav, up to 9 MB.

### POST /images
```json
{ "prompt": "האיש מהתמונה כפיראט על סיפון ספינה", "refs": ["data:image/jpeg;base64,..."], "model": "flare", "size": "story", "quality": "low", "count": 2 }
```
`model`: `flare` (default) | `sunburst`. `size`: `story` (864×1536, 9:16 - default) | `portrait` (1024×1536) | `square` | `landscape`.
`quality`: `low` (default, ~$0.005) | `medium` | `high`. `refs`: up to 16 reference images. The prompt goes to GPT Image as written (Hebrew is fine). `count`: 1-4 pictures made side by
side (default 1) - the answer is the first job plus `jobs` (all of them, one `batch`). Takes ~20-60 s.

### POST /videos
```json
{ "prompt": "הילדים עולים על הספינה ומפליגים כמו פיראטים", "start": "data:image/jpeg;base64,...", "end": null, "model": "fast", "duration": 6, "quality": "480p", "ratio": "adaptive" }
```
`model` - which Seedance 2.0:

| `model` | For | 6 s at 480p | 6 s at 720p |
|---|---|---|---|
| `mini` (default) | **drafts** - cheap and quick; faces may drift a little from the photo | ~$0.11 | ~$0.24 |
| `fast` | **keeping faces** - the people stay as they are in the start photo; ~3x the price | ~$0.34 | ~$0.72 |

(Face test, 2026-11-08: same photo + prompt, ArcFace similarity to the photo 0.63 with `mini`, 0.80 with `fast`.)
The exact $ per second of each comes from `GET /config` → `video.models[]` (`{ id, name, note, default, usdPerSecond: { 480p, 720p } }`).
`duration`: 4-15 s (default 6). `quality`: `480p` (default) | `720p`. `ratio`: `9:16` (default) or `adaptive` (follows the start
picture), `16:9`, `1:1`, `4:3`, `3:4`, `21:9`. Sound is always on. The answer also carries `jobs: [the job]`. No `start` = a video from text only. A Hebrew prompt is translated to English for the model. Real faces are
fine (both models). Takes ~1-2 min (`fast` a little longer). Refused (402) when EvoLink's balance is below the video's price.

### The job
```json
{ "id": "...", "kind": "video", "status": "done", "progress": 100, "prompt": "...", "params": { "model": "mini", "duration": 6, "quality": "480p", "ratio": "adaptive" },
  "url": "https://storage.googleapis.com/...", "poster": "https://...", "w": 496, "h": 864, "dur": 6.08,
  "usd": 0.111, "estimate": 0.111, "created": 1794000000000, "done": 1794000100000, "error": null, "library": "8916fd98fdd2" }
```
`status`: `queued` → `working` → (`running` → `saving`, videos) → `done` | `failed`. `url` / `poster` are signed links,
good for 6 hours - ask for the job again for fresh ones. `usd` is what the provider charged (EvoLink for videos; for
pictures, OpenAI's list price of the tokens used).

## Costs

Backstage → הוצאות shows Piko: OpenAI on its own key `shlomiverse-piko` (pictures, transcription, prompt rewrite -
read from OpenAI), EvoLink per job as EvoLink reported it, per client, and the EvoLink balance.
