# Shlomiverse v2

The plan: `Documents\shlomiverse-v2-design\PLAN.md` (phases, decisions). Mockups he approved: the same folder and
`phase1\`. **Live since 2026-11-01** on shlomiverse.com. `v2/site/` is the working copy: change it here, check it locally
with `node v2/dev.mjs`, then copy the changed files into `public/` and `bash scripts/deploy.sh` (`scripts/deploy.sh`
deploys only `public/`). The functions: `firebase deploy --only functions:verse,...` from `techietech-api/`.

## Run it

```bash
node v2/dev.mjs
```

- The site: http://localhost:5050/wiki/ (`v2/site/` lies over `public/`; `/` goes to `/wiki/`)
- Shlomi's page "מאחורי הקלעים": http://localhost:5050/backstage/ (his /stats/ owner key; /verse-owner/ forwards there)
- Emulator UI: http://localhost:4000 (who signed in, Firestore, stored stickers)

It starts Firebase's emulators (sign-in, Firestore, functions, storage) as project `demo-shlomiverse`, so nothing touches
boostmind-b052c. Sign-in is the emulator's pretend Google screen (any name). Local data is kept in `v2/.emu/` between
runs. Needs the portable Java in `%USERPROFILE%\.local\jre21` (the Firestore and Storage emulators are Java programs).
The OpenAI key comes from `zoomcut/.env` at start (character replies, moderation, stickers cost real money: a sticker is
one gpt-image-2.5 call at medium). Analytics stay local (a stub `t.js`).

## What is where

| | |
|---|---|
| `v2/site/wiki/index.html` | the wiki page + small `HOOK.*` seams (copied from `public/wiki/index.html`, base md5 in `.base-md5`); also `NOT_IN_HERO`, the impressions he keeps off the floating faces (re-apply it at go-live too) |
| `v2/site/verse/` | the social layer, ES modules, no build: `main.js` wires it, `state.js` accounts, `player.js` the video page + comments + sticker, `stories.js`, `pages.js` (your verse, the bell, me, contact card), `push.js` (push + the home-screen guide), `copy.js` (every line, Terra), `verse.css` (the one design system), icons |
| `v2/site/sw.js`, `manifest.webmanifest` | push + "add to home screen" (root of shlomiverse.com) |
| `v2/site/verse/community.js` | the community (#/community: ideas wall with +1, ask a character, ask for a video, "something isn't working"), the home band, the business page (#/business) |
| `v2/site/verse/genders.json` | each character's Hebrew gender (m/f/p) for "מקליד/ה", "הצטרף/ה" - `node scripts/v2-design/genders.mjs` after new characters |
| `v2/site/stats/` | /stats/ with the community box and the new actions (copied from `public/stats/`, base md5 in `.base-md5`) |
| `v2/site/backstage/` | his page "מאחורי הקלעים" (mockups `Documents/shlomiverse-v2-design/backstage/`): stories, "a new video is up", hide comments / stickers / ideas, every message by type with its way back |
| `techietech-api/verse.js` | `verse` (one callable for every fan action), `verseOnComment` (the @character answers, reply notifications), `verseOwner` |
| `techietech-api/wiki.js` | shared with the chat (boostmind-dd's session owns it): `_stream`, `_canon`, the gated CONTACT text |
| `v2/firestore.rules`, `firestore.indexes.json`, `storage.rules` | for the emulator now; merged into the root files at go-live |
| `scripts/v2-design/` | the mockups, the icon, the Terra copy pass |

Data (Firestore): `fans/{uid}` (+ `saves`, `likes`, `stamps`, `votes`, `notes`), `comments`, `stickers`, `stories`, `videoStats`,
`pushSubs`, `quota`, `requests` (kind: video / contact / business / bug), `ideas`, `announced`. Fans only read; every write goes through the functions.

## Live (2026-11-01)

Done: the web config in `fb.js`, shlomiverse.com in Firebase Auth's authorized domains (www forwards there), the secret
`VERSE_VAPID_PRIVATE`, `verse.js` always loaded (`verseOnComment` runs in me-west1, Firestore's region), the fans' rules
and indexes in the root `firestore.rules` / `firestore.indexes.json` (TTL on `quota.exp`), `v2/site/*` copied into
`public/`, `/all/` lists the pages and the functions. `verseAutoAnnounce`'s first run only recorded the existing videos.
Still to do by hand: test push on an iPhone from the home-screen icon.

Not built yet (lower priority in the plan): the cast strip and the "Script" tab on the video page.
