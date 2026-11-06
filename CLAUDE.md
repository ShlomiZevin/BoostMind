# BoostMind - the Shlomiverse | שלומי זוין

This repo and its Firebase project (`boostmind-b052c`) are **the Shlomiverse**: Shlomi's comedy world and the business
built on it - the links page (his bio link), the characters' wiki, the characters' sites, Hani's games, the stats, and
Shlomiverse Studio (`zoomcut/`, was "Sketch Studio"), the editor he makes his videos with.

**Only the Shlomiverse lives here** (since 2026-10-31). Everything else has its own repo and Firebase project, so a
Shlomiverse deploy never touches it:

| What | Repo | Project / address |
|---|---|---|
| Client proposals, the Boostart "about me" page, XPLACE outreach, the `proposal-doc` skill, old demo sources | `c:\workspace\boostart` | `boostart-pro` → https://pro.boostart.io/ |
| Wholos (the app, its server, landing page, marketing - `MARKETING.md`, `BRAND-PLAYBOOK.md`) | `c:\workspace\wholos` | `wholos-app` → wholos.com |
| The Vault, the Chavushim book, Fleet's data | `c:\workspace\shlomi-tools` | `shlomi-tools` |
| Veyra (was `findom/`) | `c:\workspace\veyra` | `veyra-queens` |
| The trip planner and its chat server | `c:\workspace\trip-planner` | `boostart-trips` |

Old links to any of them redirect from here (`firebase.json`). Work on one of them happens in its repo - read its
CLAUDE.md. Don't add anything that isn't the Shlomiverse to this repo or project.

The Shlomiverse's address is **shlomiverse.com** (same site as boostmind-b052c.web.app, so old links keep working).
Push notifications and the "add to home screen" app belong to that address.

**Until Wholos's switch is finished** its live pages (`public/wholos*`, `public/marketing*`, `public/matzav*`,
`brand-strip`, `meeting-sergio`, `trial-options`, `uploads`, `wellbeing`, `breathe`) stay in `public/` as frozen
copies, because wholos.com is still served from this site; `public/home.html` sends wholos.com to `/wholos/`. Don't
edit them here - Wholos work happens in `c:\workspace\wholos`.

## A new page or site - every session, every time

Shlomi found new sites missing from his lists because some sessions never added them. **A new page under
`public/` (or a site elsewhere) is not done until it is listed:**
- **/all/** - his private index of everything: `python scripts/all/catalog.py`, then
  `firebase deploy --only functions:stats` from `techietech-api/`.
- **A character's site / part of his comedy world (the Shlomiverse):** also the sites strip of the links page
  (`public/links/index.html`), the character's record (`site`, through Shlomiverse Studio or `content.mjs put`) and
  its world (a series record), and the sites table in `zoomcut/skill/edit-video/wiki.md`.
- **A form that sends anything** (an order, a booking, a question, a CV) needs a Google account first - his rule,
  so every sender's email reaches /backstage/ (אנשים): load `/verse/site-signin.js`, `await SiteSignIn.ensure('<site>')`,
  send its token as `authorization: Bearer`; add the site to `SITE_NAMES` in `techietech-api/index.js` and `SITES` in
  `public/backstage/index.html`.
- **A game for a character** (Hani's playhouse or anyone in the verse): load the `make-verse-game` skill
  (`zoomcut/skill/make-verse-game/`) - games live at /hani-games/<slug>/ or /<character>-games/<slug>/ (on the character's wiki page), never on Plaxzy.
- **A finished video** reaches the wiki and the links page by itself when it is published from Shlomiverse Studio
  (a "Shlomiverse" job, through the Shlomiverse's publish API - the list of videos lives in the database since
  2026-11-05); one that missed it: `POST http://localhost:4747/api/ep/<id>/site`, or `node zoomcut/render/verse.mjs <id>`.

## AI keys - every call is counted on Backstage → הוצאות (his rule, 2026-11-06)

Backstage shows what the AI costs by asking OpenAI / ElevenLabs what each key spent - nothing is counted by us, so a
call made with the wrong key is spent but never seen (or shows as someone else's). **Any OpenAI call a session makes
for the Shlomiverse - an image, a mockup, copy, Terra/SOL, a transcript, a script you write yourself - uses the
design key: `OPENAI_API_KEY` in `scripts/design.env`** (git-ignored; missing on a computer → `node scripts/design-env.mjs`
writes it from Secret Manager). Read it from that file inside your script; never print it.
- Never the Aspect key (`aspect-agent-server/.env`), never Plaxzy's (`~/.plaxzy/openai-env.sh`), never `BoostMind/.env`
  (revoked) - their spend doesn't show as the verse's.
- The studio's own code and its tools (`zoomcut/tools/leonardo.mjs`, `elevenlabs_music.mjs`) use `zoomcut/.env` - the
  studio's OpenAI + ElevenLabs keys; that counts as the studio. ElevenLabs from a session = that same key.
- The live site's features use their Secret Manager keys (`VERSE_SITE_OPENAI_KEY`, `WIKI_OPENAI_KEY` for the chat,
  `MIND_OPENAI_KEY`); a new live feature takes the site key, or a new key named `shlomiverse-<area>` in the OpenAI
  project "Shlomiverse" (costs.js reads the area from the name).
- **Piko** (shlomiverse.com/piko/, `techietech-api/piko.js`, API: `techietech-api/piko-api.md`) - his own picture + video
  maker: OpenAI on `VERSE_PIKO_OPENAI_KEY` (key `shlomiverse-piko`), videos on EvoLink (`EVOLINK_API_KEY`, Seedance 2.0 Mini -
  takes real faces, ~5x cheaper than Leonardo). Other tools call the same API with their own key (`scripts/piko/client.mjs`).
- Already wired: `openai.js` - the OpenAI helper, any model (the openai-leonardo skill, in `zoomcut/skill/openai-leonardo`; a computer installs it once with `node zoomcut/skill/openai-leonardo/install.mjs`; inside this folder it always takes the design key), `oai-image.js` (stories, games),
  `clean-words.mjs`, `build.py`, `reel.py` and the design scripts under `scripts/`.

## Plans for his approval - Backstage → תוכניות (since 2026-11-06)

A plan, brief, draft or set of mockups for something new in the Shlomiverse goes to **Backstage → תוכניות**, not to
a loose file: he reads it there, comments on any part (a heading, a mockup, a table row) and approves or asks for changes.
A plan = a folder with `index.html` (mockups as `<img src="img/NAME">`) + `img/` - **start from `scripts/plans/template/`**
(mobile first: he reads it on his phone; check it at 360px, no sideways scroll). Mockups by GPT Image (his rule).
`OWNER_KEY=<his key> node scripts/plans/plan.mjs publish <folder> --id <plan-id> --title-file t.txt --summary-file s.txt`
(Hebrew through files), `... comments <plan-id> --out c.md` (read it before building), `... reply <plan-id> --file r.txt --to <comment id>`.
Re-publishing the same id = a new version, back to "waiting for him". Private: Firestore `plans` + the private bucket
`shlomiverse-studio/plans/` (techietech-api/plans.js). Build only what he approved.

## Content - the database, never git (his rule, 2026-11-05)

He works from two computers; **nothing either one has or lacks may break the site.** Everything the Shlomiverse shows -
videos, characters, profiles, family links, portraits, games, sites, stories - lives in the database (one record each;
portraits = files in the bucket), and the site + the chat are composed from it on the server. **Characters and worlds
have no files at all since 2026-11-06** (no character.json / profile.md / index.json): Shlomiverse Studio and
`content.mjs put | profile` read and write the records. One door (versePublish):
`node scripts/wiki/push.cjs` after build.py (sends only what this computer's files changed; never removes, never blanks,
stops when behind git) or `node scripts/verse/content.mjs put | portrait | hide | log` from anywhere. **Read the
`shlomiverse-content` skill** (zoomcut/skill/shlomiverse-content) before adding or changing any content;
`content.mjs log` answers "who changed what".

## Deploy

```bash
bash scripts/deploy.sh
```

One step, about 20 seconds: it pulls Hani's games from live first (they are released from another machine -
`scripts/hani_games_pull.py`, downloads only what changed), deploys hosting, and checks the games' no-cache header.
Never run a bare `firebase deploy --only hosting` here - it can put old game files back.

Other sessions deploy this same folder, so a draft waiting for Shlomi's approval stays out of `public/`.
