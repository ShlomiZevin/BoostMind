# BoostMind - the Shlomiverse | שלומי זוין

This repo and its Firebase project (`boostmind-b052c`) are **the Shlomiverse**: Shlomi's comedy world and the business
built on it - the links page (his bio link), the characters' wiki, the characters' sites, Hani's games, the stats, and
Sketch Studio (`zoomcut/`), the editor he makes his videos with.

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
  (`public/links/index.html`), the character's profile in Sketch Studio (`site.url`) and its world in
  `zoomcut/characters/index.json`, and the sites table in `zoomcut/skill/edit-video/wiki.md`.
- **A finished video** reaches the wiki and the links page by itself when it is published from Sketch Studio
  (a "Shlomiverse" job); one that missed it: `python scripts/wiki/publish_site.py <episode-id>`.

## Deploy

```bash
bash scripts/deploy.sh
```

One step, about 20 seconds: it pulls Hani's games from live first (they are released from another machine -
`scripts/hani_games_pull.py`, downloads only what changed), deploys hosting, and checks the games' no-cache header.
Never run a bare `firebase deploy --only hosting` here - it can put old game files back.

Other sessions deploy this same folder, so a draft waiting for Shlomi's approval stays out of `public/`.
