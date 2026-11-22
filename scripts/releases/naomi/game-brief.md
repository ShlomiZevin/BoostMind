# Game brief - Naomi's game (release `naomi`)
From: the Video Release Manager (session "Shlomiverse VRM"). To: the Game Creator (role `shlomiverse-game-creator`, craft
`make-verse-game`). Report to me at each gate with `SendMessage` (ideas → concept picture → plan → playable draft → ready).

## What Shlomi asked (2026-11-22, his words)
"I'm turning back the doctor, and I want a game that she created, like for handling emotions and stuff ... a parody that she
will be creating." Plus his standing rules: "In the verse we do everything as real persons, with depth, information and data.
The parody is real life parody." And: nothing public before the video is released.

## Who she is (read the real thing - don't work from this summary)
Resident `naomi-tzipora` - ד״ר נעמי־ציפורה בן־נון־פרידמן־שטרנבך, a woman ~50: psychiatrist, integrative psychotherapist,
NLP/CBT/TMI/EMDR coach and "דולה מוסמכת של רגשות". She treats emotions like babies being born (contractions, dilation,
skin-to-skin, incubator, first bonding) and reads them with "המחוג הפנימי" (the inner needle: movement, direction, stuck,
re-tuned). Totally sure of herself, never winks; treats an intermediate emotional "success" as a huge win even when the actual
problem hasn't started being solved. Tagline: "לכל רגש יש תאריך לידה".
- Profile + sheet: `node scripts/verse/content.mjs profile naomi-tzipora --out p.md`, `get character naomi-tzipora --out n.json`.
- Her live site (her brand, her products, her method's 5 stages, the program, the book): https://shlomiverse.com/dr-naomi/
  (`public/dr-naomi/` - logo in `brand/`, colours from it).
- Her products: the book "המחוג שבלב", the method "המחוג הפנימי", the clinic, the organizations program "מאונבורדינג לבונדינג"
  (young employees' bonding + managers' "השהיית תגובה"), the podcast + radio hour "השעה הרגשית", and **DoulaSense AI** - "in
  development", her AI that detects emotional births (a waitlist on her site).
- Her 2025 reels (14, on `/c/naomi-tzipora`; list + transcripts: `scripts/releases/naomi/private/reels.md`) - her real
  situations and lines: emotion donation, emotional surrogacy, a vacuum birth of an emotion, a caller who wants to return an
  emotion he adopted, a teacher who wants to abort an emotion, emotional eating on Independence Day, a lecture at Techy-Tech.
- The new video (private script, `scripts/releases/naomi/private/script.md` - never quote it anywhere public): a guest on a
  podcast, a case from "a very well-known high-tech company" - a 24-year-old gets "מה הסטטוס עם המשימה?" from his manager →
  anxiety attack, ChatGPT, HR complaint, resignation; "onboarding - but where is the bonding?"; she teaches the manager
  "response pause"; two weeks later he writes "I don't know how to start the task" - a huge success. Next stage: "how do you
  ask an employee to start working". (Her term in the video "אוטיזם תעסוקתי" stays out of the game.)

## The game
- **A game SHE made** - a real product of hers, published by her clinic, exactly like a real wellness / emotion app-game made
  by an expert of her kind (onboarding, levels, a progress screen with "data", her voice coaching the player, her logo and name
  as the maker). Could be her app, a DoulaSense AI "beta", her method's companion game, or her program's tool for managers -
  your call with the ideas.
- The craft rules of make-verse-game hold: a **proven simple mobile mechanic** in our own version (never one already taken - the
  list is in the skill, step 2), the player's action carries her idea, a game that needs thinking, a tutorial, phone first,
  Hebrew RTL in her voice.
- Where it lives: `public/naomi-games/<slug>/` (+ workshop `scripts/naomi-games/<slug>/`), `game.json` with `character:
  "naomi-tzipora"`, `"status": "draft"` until release day. On release: a card on her site (`public/dr-naomi/`) and her
  resident page through `game.json`.
- Two-player is welcome if it fits (a manager and an employee?), never required.

## My lean (one view, not a constraint)
The strongest material is her worldview applied to everyday work and life: emotions as babies to be delivered safely,
messages that must be "paused" before they hurt, a needle to be tuned. A game where the player DOES that (delivers, pauses,
tunes) on a known loop will carry her better than a game about her.

## Timing and cost
- Nothing public before the video: the game is a draft only he can see until release day; it goes live in my release order
  (with the video or as the next day's "after" story). I post stories and brief marketing - hand me the cover, title art, a
  story picture and 2-3 Hebrew lines.
- AI ≤ 5¢ per call where it can be (pictures GPT Image 2.6 MEDIUM; HIGH only for characters / cover / title art per the skill);
  report the running spend at each gate.

## On another computer (the private files are not in git - the repo is public)
- `git pull`, then `node scripts/skills-link.mjs` (links the roles as skills).
- The private files (the script, the reels list + transcripts, her captions, the shoot sheet, the cover art) and her portraits:
  `gcloud storage cp -r gs://shlomiverse-private/releases/naomi/private/* scripts/releases/naomi/private/` and
  `gcloud storage cp gs://shlomiverse-private/releases/naomi/portraits/* zoomcut/characters/naomi-tzipora/` (never commit them).
- **Never run `bash scripts/deploy.sh` from a computer that doesn't have `public/dr-naomi/img/`** (her photos are git-ignored;
  a deploy without them takes them off her live site). Release-day deploys go through me (the VRM).
