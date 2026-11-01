# Shlomiverse v2 - local build

The plan: `Documents\shlomiverse-v2-design\PLAN.md` (phases, decisions). Mockups he approved: the same folder and
`phase1\`. **Everything here runs locally only** until Shlomi approves going live. Nothing in this folder is deployed by
`scripts/deploy.sh` (it deploys `public/`), and `techietech-api/index.js` loads `verse.js` only inside the emulator.

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

## Go live (only with his OK)

1. Web config: `firebase apps:sdkconfig web` -> `LIVE_CONFIG` in `v2/site/verse/fb.js` (authDomain `shlomiverse.com`).
   Firebase Auth: Google provider on, `shlomiverse.com` in the authorized domains.
2. Secret `VERSE_VAPID_PRIVATE` = the private key in `techietech-api/.env.local` (he must allow creating secrets).
   The public half is already in `fb.js` and `verse.js`.
3. `techietech-api/index.js`: drop the `FUNCTIONS_EMULATOR` condition; `firebase deploy --only functions:verse,functions:verseOnComment,functions:verseOwner,functions:verseAutoAnnounce` from `techietech-api/`. Tell boostmind-dd first (shared folder).
4. Firestore: add `v2/firestore.rules` blocks to the root `firestore.rules`, the indexes to a root `firestore.indexes.json`
   (+ `firebase.json`), TTL on `quota.exp`; `firebase deploy --only firestore`.
5. Bucket `shlomiverse-media`: CORS GET from shlomiverse.com (the sticker grabs the video frame into a canvas), and the
   functions' service account may write `verse/`.
6. Deploy `functions:stats` too (analytics.js knows the new actions). Copy `v2/site/*` into `public/` (`stats/index.html`:
   re-apply onto the current `public/stats/index.html` if it changed since its `.base-md5`). `wiki/index.html`: re-apply the hooks onto the current `public/wiki/index.html` if it
   changed since `.base-md5`. Then `bash scripts/deploy.sh`.
7. New videos announce themselves: `verseAutoAnnounce` checks the wiki's list every 15 minutes and notifies the followers of
   any new (non-archive) video; its first run only records what exists (no back-catalogue flood). The owner page's
   "סרטון חדש" stays for sending again.
8. List it: `/all/` (`python scripts/all/catalog.py`), and test push on an iPhone from the home-screen icon.

Not built yet (lower priority in the plan): the cast strip and the "Script" tab on the video page.
