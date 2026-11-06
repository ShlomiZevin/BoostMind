---
name: openai-leonardo
description: The OpenAI helper - ask any GPT-5.x model (Terra, SOL, Luna) for wording, Hebrew copy, naming, positioning or a second opinion, and generate real images with Leonardo AI. Use whenever the user says "consult SOL", "ask SOL", "ask Terra", "consult Terra", "תתייעץ עם טרה", "תתייעץ עם סול", "שאל את סול", asks for a second opinion from OpenAI/GPT, wants Hebrew copy or naming polished, or asks for images, illustrations, artwork, backgrounds, hero shots, posters, icons or slide visuals to be generated — including for a deck, a brochure, a landing page or a React project. Also use before writing marketing or presentation copy in Hebrew.
---

# OpenAI + Leonardo (was "SOL + Leonardo" / sol.js until 2026-11-06)

Two external services, one workflow: **a GPT model (Terra, SOL...) writes the words and the art brief, Leonardo renders the picture.** `openai.js` is the OpenAI helper - any model, picked with `--model` (the old `sol.js` still works and runs the same thing). The OpenAI key: **inside `C:\workspace\BoostMind` (the Shlomiverse) `openai.js` always takes its design key, `scripts\design.env`** (Backstage → הוצאות counts it; missing → `node scripts/design-env.mjs`; 2026-11-06) - don't pass `--env` there. Elsewhere (aspect) it lives in `C:\workspace\aspect\aspect-agent-server\.env` (`OPENAI_API_KEY`). **The Leonardo key is his official account's, in `C:\workspace\BoostMind\zoomcut\.env` (`LEONARDO_API_KEY`, 2026-10-26) - `leo.js` picks the key by project: inside `C:\workspace\BoostMind` only that key; anywhere else (aspect) that project's own `.env`, then aspect-agent-server's. The two projects never share a Leonardo key (his ask, 2026-10-27).** The scripts find both automatically.

Scripts are at `~/.claude/skills/openai-leonardo/scripts/` (the skill lives in the repo, `c:/workspace/BoostMind/zoomcut/skill/openai-leonardo`; a computer gets it with `node zoomcut/skill/openai-leonardo/install.mjs`). Both are standalone Node — no install, no project dependency.

---

## For a Sketch Studio video: the editor's library (his rule, 2026-11-02)
An image, icon, sound or music made for one of his videos (anything that ends up in Sketch Studio) is made with
`c:/workspace/BoostMind/zoomcut/tools/leonardo.mjs` / `tools/elevenlabs_music.mjs` and labelled on the spot:
`--about "<what it is, for which video>" --tags "<mood, place, use, character, style>" --project <id>` - it goes into
the editor's asset library (the studio's Assets page) at once. A file made another way: `node tools/library_add.mjs
<file> --about ... --tags ...`. Decks, landing pages and other projects' images stay as they are.

## The one rule that breaks everything: never put Hebrew through the console

On this machine (Windows, Git Bash) Hebrew is mangled in **both** directions:
- A Hebrew prompt in a shell heredoc arrives as broken bytes → the API rejects the JSON.
- A Hebrew answer printed to stdout comes back as `?????` even when the response is perfect.

So: **write the prompt to a file, read the answer from a file with the Read tool.** Never `cat` a Hebrew result, never `echo` a Hebrew prompt, never `python -c print(...)` it. This is not a style preference — it costs a full round trip every time it is forgotten.

---

## Asking GPT (Terra, SOL, Luna...)

```bash
node ~/.claude/skills/openai-leonardo/scripts/openai.js --in brief.txt --out answer.md
node ~/.claude/skills/openai-leonardo/scripts/openai.js --in brief.txt --out answer.md --model gpt-5.6-terra --effort high
node ~/.claude/skills/openai-leonardo/scripts/openai.js --models      # what this key can actually reach
node ~/.claude/skills/openai-leonardo/scripts/openai.js --in brief.txt --out answer.md --image home.png --image ideas.png   # SOL looks at screenshots (design critique)
```

Then read `answer.md` with the **Read** tool.

### Which model
| model | for |
|---|---|
| `gpt-5.6-sol` | **default.** Wording, naming, Hebrew copy, positioning, second opinions. |
| `gpt-5.6-terra` | Longer analytical work, structure, critique of a plan. |
| `gpt-5.6-luna` | Alternative voice — worth a second pass when SOL's answer feels safe. |
| `gpt-5.5-pro` / `gpt-5.4-pro` | Slow and expensive; only for a genuinely hard judgement call. |

Run `--models` rather than assuming — the roster on this key changes.

### Writing a brief that gets a usable answer
SOL returns filler when asked an open question. Structure that works:

1. **Role + register**, one line: `אתה יועץ ניסוח ומיתוג בעברית. תשובות קצרות וחדות. בלי הקדמות.`
2. **Context** — who the audience is and what they fear or want. This is what makes the answer specific rather than generic.
3. **Numbered tasks**, each with an exact output shape (`6 הצעות, כל אחת בשורה אחת, ואז שורה אחת עם ההמלצה שלך`).
4. **What to avoid** — name the clichés explicitly, or you will get them.

Ask for a recommendation *plus* the alternatives, never only the alternatives — a list without a pick is work handed back.

### Judging what comes back
SOL is a consultant, not an authority. Disagree in the report when its pick is weaker; say why. The user asked for a second opinion, not a second decision-maker.

---

## Leonardo — generating images

```bash
node ~/.claude/skills/openai-leonardo/scripts/leo.js --balance
node ~/.claude/skills/openai-leonardo/scripts/leo.js --prompt-file brief.txt --out hero.jpg --size wide
node ~/.claude/skills/openai-leonardo/scripts/leo.js --batch slides.json --out-dir ./public/img
node ~/.claude/skills/openai-leonardo/scripts/leo.js --batch slides.json --out-dir ./public/img --only hero,foundations
```

`slides.json` is `[{ "key": "hero", "prompt": "...", "model": "...", "size": "..." }, ...]`. Files land as `<out-dir>/<key>.jpg`. Run `--balance` first on any batch — it prints credits, the model table and the legal sizes.

### Models
| model | ~$ | honours aspect? | Hebrew type | for |
|---|---|---|---|---|
| **`gpt-image-2`** | 0.097 | ✅ | **best** | **The default.** Clean, graphic, and the strongest Hebrew typography of the set. |
| `nano-banana-pro` | 0.209 | ❌ always square | very good | Second choice for type. Richest rendering. 20–40s, sometimes 90. |
| `flux-pro-2.0` | 0.042 | ✅ | untested | Cheap drafts of a non-square frame. Strong geometry. |
| `nano-banana-2` | 0.039 | ❌ always square | good | Cheap square drafts. |
| `lucid-origin` | 0.030 | untested | untested | Cheapest. Flat vector and simple marks. |

**`gpt-image-2` is genuinely excellent at set text — good enough to hand it a whole brochure's copy and have it lay the piece out.** That is a real option, not a stunt. It is still not the right route when the wording must be *exact and repeatable* (see below).

### ASPECT RATIO — the expensive one
**The two Gemini-backed models silently ignore the requested dimensions and return 2048×2048.** The API echoes back the size you *asked for*, so nothing looks wrong until the image lands in a 16:9 slot. Measured 2026-09-10 on all four: `gpt-image-2` and `flux-pro-2.0` honoured 2048×1152; both nano-bananas returned square.

So: **anything non-square goes to `gpt-image-2` or `flux-pro-2.0`.** Reach for a nano-banana only when the frame is square or when Hebrew text inside the image is the priority. `leo.js` measures the real bytes and prints a `WARNING` when a model ignored the request — trust that line over the `OK` line above it.

### Sizes
Both axes must come from the API's list, or the request fails with a truncated `VALIDATION_ERROR`. Named pairs: `square` 1024×1024 · `portrait` 1024×1536 · `story` 768×1376 · `story_hd` 1536×2752 · `poster` 1696×2528 · `wide` 2048×1152 (exact 16:9) · `wide_sm` 1344×768 · `banner` 2048×768. `leo.js` validates before spending and names the nearest legal value.

### Format
Leonardo serves **JPEG**, whatever you call the destination. `leo.js` rewrites a `.png` target to `.jpg` rather than writing JPEG bytes into a file some tools then refuse to open.

Draft on `flux-pro-2.0` (cheap, honours aspect), final on `gpt-image-2`.

### Text in images — it works, and it is a first-class route
The old guidance that "Leonardo cannot do typography" is wrong. All three of `gpt-image-2`, `nano-banana-pro` and `nano-banana-2` render a Hebrew headline **and** a Hebrew sub-line correctly. `gpt-image-2` is the strongest by a clear margin — it will set a full page of Hebrew copy, not just a headline.

**But judge it at full size.** Small Hebrew looks misspelled in a downscaled preview — it looked equally "misspelled" in an HTML render that provably held the right string. Do not reject a model from a thumbnail.

Render text in HTML over a text-free background instead when it must be **exact and repeatable**: a logo, a URL, a price, legal wording, or the same template thirty times.

### Prompts that produce pictures rather than CSS
An earlier project asked for "flat geometric shapes in the deck's colours" and got exactly that — a bar, a wedge, a rectangle — which read on the page as more CSS than image. The user's reaction was *"I don't see any image."*

**Scenes, not diagrams.** A photographic or illustrative situation with a subject, a light source and a mood.

- Reserve dead space for type **inside the photograph** (e.g. "the left 36% of the frame is quiet and unlit") rather than painting a scrim over it afterwards.
- Ban any colour that competes with a signal colour used in the design.
- Keep one style spine across a whole set — same light, same lens, same palette — or the images will not read as a family.

**The shipping test:** hide the type, show the image for two seconds. If the viewer names a generic category ("warehouse photo") instead of the idea the image is meant to carry, regenerate.

### Reference images
`--reference logo.png` uploads a brand cue. Strength is `LOW` on purpose — `MID` and above make the model try to redraw the reference instead of taking colour from it.

---

## Working together

The strong pattern, and the reason these live in one skill:

1. Ask **SOL** for the art brief in the target language and register — it writes better scene descriptions than a bare prompt, and catches clichés.
2. Feed that brief to **Leonardo** as `--prompt-file`.
3. Review at full size, then iterate the brief, not the model.

---

## Gotchas already paid for

- `public: false` is **required** in the request body — omitting it returns a bare `VALIDATION_ERROR` on several models.
- `nano-banana-pro` maps to the API id `gemini-image-2`. The scripts handle this; hand-rolled calls do not.
- The response reports the **requested** dimensions, never the produced ones. Only measuring the bytes tells the truth — see ASPECT RATIO above.
- Poll `v1/generations/:id`. `v2` only queues.
- Downloads need a browser User-Agent (the CDN 403s Node's default) and a re-encoded path (an em-dash in a prompt becomes a filename that returns an 87-byte error page). The scripts check the byte size to catch it.
- Generate **sequentially**. A parallel burst queues behind itself and makes failures impossible to attribute.
- A `FAILED` generation may still be charged — Leonardo quotes the price at queue time. The error message carries the quoted cost; report it rather than silently retrying.
