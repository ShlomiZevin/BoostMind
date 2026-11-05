---
name: shlomiverse-content
description: How content gets onto the Shlomiverse (shlomiverse.com - the wiki, character pages, the links page, the chat) from ANY computer or session without breaking the site - videos, characters, profiles and bios, family links, portraits / profile pictures, games, sites, stories, hiding something. The site is composed only from the database; every change goes through one door (versePublish). Use whenever a session adds or changes a character, a profile, a picture of a character, a game, a video or a story, runs scripts/wiki/build.py or push.cjs, or when something on the site looks missing / broken ("all the images are gone", "who broke the site", "the video isn't on the page").
---

# Shlomiverse content - one database, one door, two computers

His rule (2026-11-05, after a laptop build took every face but Asaf's off the site): **"I work from two computers and they
must not ruin each other. A new video, a new character, a new profile image - none of it can break the site. It
shouldn't come from git."**

## Where everything lives

| What | Lives in | Written by |
|---|---|---|
| Videos | Firestore `catalogVideos` + `catalogTranscripts`, files `gs://shlomiverse-media/wiki/v/` | versePublish `op: video` (Sketch Studio's Send, `zoomcut/render/verse.mjs`, insta-to-verse, push.cjs adds missed ones) |
| Characters (page + the chat's full profile) | Firestore `catalogCharacters/<id>` | versePublish `op: sync` (push.cjs) / `op: put` (content.mjs) |
| Series (worlds) | `catalogSeries/<id>` | the same |
| Games | `catalogGames/<id>` (from each game's `game.json`) | the same |
| Sites | `catalogSites/<id>` (title, picture, about, whose, topic) | the same |
| Portraits | the FILE `gs://shlomiverse-media/wiki/img/c/<id>.jpg` - a character has a face when its file is there | `content.mjs portrait`, or push.cjs (only a newer file) |
| Stories | Firestore `stories` | `scripts/story.mjs` (verse-story skill); a video story also becomes a video |
| Every change | `catalogLog`: what, which fields, the value before, who (computer + session), when | automatically |

`wiki.json` (the site) and `wiki-brain.json` (the chat) are **composed on the server from the records** after every
change, and again every 15 minutes (`verseHeal` - anything that wrote them behind the records' back is put right).
Nobody writes them by hand, and nothing a computer has or lacks can take anything off the site.

The files in git (`zoomcut/characters/<id>/character.json`, `scripts/wiki/copy.json`, `game.json`, the pages) are the
**workshop** where you write a profile or a bio - they are not the site. They reach the site only as changes.

## The rules the door keeps (techietech-api/content.js)

- **Nothing is ever removed by a sync.** A character, video, game, site or portrait missing on a computer stays live.
  Something leaves the site only by `hide` (and comes back by `show`).
- **Nothing is ever blanked by a sync** - an empty bio / relations / site on a computer keeps the live one. Emptying a
  field on purpose = `content.mjs put ... --clear <field>`.
- **Three-way per field.** A sync writes a field only when that computer's files changed it since the value that
  last came from files. So an edit made through `put` (from the laptop, from a session, from the API) stays until
  someone really edits that same field in the files again.
- **A computer behind git can't push** (push.cjs fetches and stops: "git pull, run build.py again, then push").
- **Files only move forward.** A video / portrait file replaces the live one only if it is different AND newer than
  it (a portrait keeps its original picture's time). An older copy on the other computer never comes back.
- **The site never goes out half-empty**: a compose that would show fewer than half of the characters stops, and the
  live file stays.

## How to do each thing

Run from `c:\workspace\BoostMind`. `git pull` first, always.

**A new character, a bio, family links, a tagline, catchphrases** - write it in the workshop, then send the change:
1. `zoomcut/characters/<id>/character.json` (+ `index.json` `order` for a new one), the copy in `scripts/wiki/copy.json`
   (Terra writes site copy in Hebrew - the sol-leonardo skill). Family links go BOTH ways (each side's `relations`).
2. `python scripts/wiki/build.py` (PYTHONIOENCODING=utf-8) - it writes `scripts/wiki/records.json` + the local preview.
3. `node scripts/wiki/push.cjs --dry` - read the lines: `+ character: x (new)`, `~ character x: bio, relations`.
   Only what you meant to change may appear. Anything else = stop and find out why (an un-pulled file? another session?).
4. `node scripts/wiki/push.cjs` - live in seconds, the chat within 3 minutes. Then commit + push your workshop files.

**A quick fix with no workshop file** (from any computer, even without the repo's portraits):
`node scripts/verse/content.mjs put character <id> --file patch.json` - `patch.json` = `{"tagline": "...", "bio": "..."}`
(Hebrew ALWAYS through a file - the console mangles it). Then put the same change in the workshop files (character.json /
copy.json) and commit, so the workshop matches - a later sync of the old text would otherwise count as an edit.

**A portrait / profile picture:** `node scripts/verse/content.mjs portrait <id> <image>` - cropped 4:5 from the top to
480x600, live at once. Keep the original in `zoomcut/characters/<id>/portrait.jpg` on the computer that made it (git
ignores pictures; the live face is the bucket's file, not the folder's). Changing a face = edit THAT picture, change only
what he asked (feedback_change_only_what_asked).

**A video:** never through these files. Sketch Studio's Send (or `node zoomcut/render/verse.mjs <id>`), insta-to-verse for
old reels; `POST http://localhost:4747/api/ep/<id>/site` for one that missed it. It is a record by id: calling again
never duplicates.

**A story:** `node scripts/story.mjs ...` (verse-story skill). A video story is also a video automatically.

**A game:** its `game.json` (make-verse-game skill), the page deployed (`bash scripts/deploy.sh`), then build.py + push.cjs.

**A site / a new page:** deploy the page (`bash scripts/deploy.sh`), then build.py + push.cjs (it reads the page's
title / picture), then /all/ (CLAUDE.md).

**Take something off / bring it back:** `node scripts/verse/content.mjs hide <kind> <id>` / `show <kind> <id>`
(kind: character | series | game | site; a video: `hide video <id>`).

**Look before you change:** `content.mjs get character <id> --out x.json` (read x.json with the Read tool),
`content.mjs list character`.

## When something on the site looks wrong

1. `node scripts/verse/content.mjs log --limit 50 --out log.json` - every change with the computer / session that made it
   and the value before. That answers "who broke it".
2. Put a field back: `content.mjs put <kind> <id> --file before.json` with the value from the log.
3. Faces missing = a portrait file missing from `wiki/img/c/` (`gcloud storage ls gs://shlomiverse-media/wiki/img/c/`);
   upload it with `content.mjs portrait`.
4. `content.mjs rebuild` composes the site again from the records.

## Never

- Write `wiki.json`, `base.json` or `wiki-brain.json` in the bucket yourself, or copy a whole list from one computer.
- `--allow-...` style overrides, or deleting records in Firestore - hide instead.
- Push from a computer that is behind git, or skip the `--dry` read when you changed profiles.
- Print or commit `VERSE_PUBLISH_KEY` (the scripts read it from `zoomcut/.env`, else Secret Manager).

The code: `techietech-api/content.js` (the rules), `catalog.js` (compose), `publish.js` (the door: ops `put`, `sync`,
`hide`, `get`, `list`, `log`, `uploadUrl` kind `portrait`, `rebuild`, `video`). Tests:
`techietech-api/test/content.emu.mjs` (the real data in a local database = the same site; every rule above).
