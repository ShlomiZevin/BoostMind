# Sketch Studio online - one studio, any computer

**His ask (2026-11-02):** "the projects live online and the tool lives online, maybe in the Shlomiverse, so I can move
between computers. All the keys online, somewhere easy (maybe the Vault). An asset library somewhere general that I
reach from any computer. Publish to any social from any computer." Also: "אני רוצה שכל אחד יכול לעלות" - unclear,
**ask him first** (every computer can upload? other people - family, cast - upload takes to a project?).

Read first: `zoomcut/skill/edit-video/SKILL.md` + `editor.md` (how the studio works), `zoomcut/render/server.mjs`
(the server: projects, jobs, exports), `render/publish.mjs` (the socials), `render/drop.mjs` (iPhone uploads),
memory `project_sketch_studio.md`. A second session may be building edge-nudging in the editor UI at the same time
(`plans/edge-nudge.md`) - you own the server / storage side, it owns the timeline UI.

## What exists today (measured 2026-11-02)
- The studio = `node render/server.mjs` on his Windows PC, http://localhost:4747 (Express + Vite middleware, React UI).
  Exports: Remotion + ffmpeg + Python (`pipeline/`, faster-whisper, background removal, NVIDIA Maxine for eye contact).
- Projects: `zoomcut/episodes/<id>/` - **68 GB, 40 projects**. Most of it is `work/` (caches, rebuildable) and `out/`
  (exports). What a project IS: `project.json`, `episode.json`, `publish.json`, `captions.txt`, `media/` (his takes,
  voices, music), `input/` (raw footage). Media is git-ignored (public repo, his face/voice).
- Shared assets: `episodes/_assets/` (531 MB), characters `zoomcut/characters/` (9 MB, portraits git-ignored).
- Keys: `zoomcut/.env`, 34 lines - OpenAI, ElevenLabs, Leonardo, NVIDIA, Drop key, Instagram/Facebook, TikTok,
  YouTube, X, GoDaddy. **Some rotate**: TikTok's refresh token is replaced on every refresh, IG/FB tokens carry an
  expiry and get renewed - the code writes them back. Two computers with two copies = one of them breaks the other.
- The Vault (`c:\workspace\shlomi-tools\vault`, https://shlomi-vault.web.app) encrypts in the browser with his
  password - a server can't read it without that password. Good for his eyes, wrong for a machine.
- GCP project `boostmind-b052c` already holds Secret Manager secrets (e.g. `WIKI_OPENAI_KEY`) and GCS buckets (the
  wiki content). He's signed in to gcloud on this PC.
- Ideas (the Ideas page) live in `zoomcut/ideas/ideas.json`, git-ignored, this PC only. Jobs history:
  `episodes/_jobs.json`, this PC only.

## Recommended plan (propose it to him, agree, then build - in phases, each one usable on its own)
**Phase 1 - the data in the cloud, the studio on whichever computer he sits at** (the big win, fast):
1. **Keys -> GCP Secret Manager** (`boostmind-b052c`), one secret per key. The studio reads them at startup with his
   gcloud login (no file to copy); a rotated token is written back as a new secret version, so every computer sees
   the new one. `zoomcut/.env` becomes an optional local override. Tell him in one line why not the Vault (a machine
   can't open it), and offer a mirror into the Vault for his own eyes if he wants.
2. **Projects -> a private GCS bucket** (e.g. `gs://shlomiverse-studio`), synced per project: pull on open, push on
   save (the essential files + media by hash; never `work/` caches). **A lock per project** - "open on the office PC
   since 14:02 - take it over?" - so two computers never write the same project.
3. **Asset library -> the same bucket** (`_assets/`, characters, music, sounds, logos) + an **Assets page** in the
   studio's left rail (like Ideas / Characters): search, preview, drop into a project. Ideas and the Jobs history
   move to the cloud too.
4. **A new computer in one step**: `zoomcut/setup.ps1` - checks Node/Python/ffmpeg, installs deps, gcloud sign-in,
   pulls keys and the project list. Test it for real on a clean folder.
5. Publishing then works from any computer by itself (same keys, same projects).

**Phase 2 - the tool itself online** (decide with him after Phase 1 works): the editor served from the cloud behind
his Google sign-in (e.g. studio.shlomiverse.com), exports and Analyze on Cloud Run (GPU for Whisper / Maxine).
Bigger, slower, costs per export - Phase 1 already gives "any computer".

## His rules that bind this work
- Never restart the studio while a job runs (check `/api/jobs` running + busy are empty). Never export Full quality
  yourself. Test on hidden `_name` projects, delete them after. Never write into a project he's editing.
- Never print a key. The repo is PUBLIC: nothing secret, no face images, no media into git.
- Ask before anything costs money beyond pennies, and before a live Firebase deploy.
- Reply in English; a direct link on every step when he has to click something (console pages etc.).
- Migrating the 68 GB: copy, verify, and only then switch - the local folders stay as they are until he says so.
- Commit and push your own work when a phase is done.

## Status (2026-11-02) - Phase 1 built, waiting for his "switch"
His answers: "everyone can upload" = **any computer of his** (not other people). Cloud scope: **everything** (he
approved ~$1.70/month); then on seeing the breakdown, the scratch is left out (`*.f32` 13 GB, `work/pieces` 13.7 GB).
- Bucket `gs://shlomiverse-studio` (me-west1, private, 7-day soft delete). Keys: one secret `studio-keys` (37 keys,
  incl. email / Telegram that used to come from other repos) - one secret, not one per key (that was ~$3/month).
- Library: only what his layered videos use (his rule) - 382 items, 172 MB. The Assets page in the rail.
- The copy (tools/cloud_copy.mjs) + check (tools/cloud_verify.mjs: md5, or CRC32C on gcloud's composite uploads).
- His PC's sync stays OFF until he says; then: `episodes/_cloud/config.json` = `{"sync": "on"}` + restart the studio
  (when no job runs). The local folders are untouched either way.
- Known limit: the iPhone Drop comes down on whichever computer's studio is running (its own poller) - the takes
  reach the cloud when a project that uses them is opened there.
- Phase 2 (the editor itself online, studio.shlomiverse.com, exports on Cloud Run) - not started; decide with him.
