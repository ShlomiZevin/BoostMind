# Hani's playhouse - המשחקייה של חני (shlomiverse.com/hani-games/)

Hani's games (and her family's) have their own home and their own release path. Everything in SKILL.md holds;
this page adds what is special here.

## Where things are
- Live: `https://shlomiverse.com/hani-games/<slug>/` (same site as boostmind-b052c.web.app).
- Code in git: `public/hani-games/<slug>/`; source tools, prompts and promo sources: `scripts/hani-games/`.
- The working copy on the second PC: `C:/workspace/hani-games/<slug>/` (local server
  `python -m http.server 5301` there; tests `node <slug>/tools/t1-play.js`).
- The hub page (`public/hani-games/index.html`: its `GAMES` list, the "בקרוב" cards) and `/stats/` belong to the
  BoostMind session that owns the site - ask it (or Shlomi) to add the card; don't overwrite the hub.

## Releasing a game
- **Only with the playhouse's release tool**, from the working copy: `MSYS_NO_PATHCONV=1 node tools/deploy-onto-live.js
  <slug>` (`--dry` first). It clones the LIVE hosting version, adds only that game's folder, keeps
  `/hani-games/** no-cache`, and releases. `--soon` puts only the card (game.json status "soon" + cover) for "בקרוב".
- Never a bare `firebase deploy` for a game. `bash scripts/deploy.sh` on the main PC first pulls every game from live
  (`scripts/hani_games_pull.py`) - so a game edited only in `public/hani-games/` and not released would be overwritten
  by the live copy. Release with the tool, then copy the code into git.
- After a release: `git` - copy `index.html`, `game.js`, `game.json` (and any data json) into
  `public/hani-games/<slug>/` in a BoostMind worktree, commit, rebase on `origin/main`, push.

## Hani herself
- Painted poses from her portrait (calm, talk, surprised, joy...), normalised; the joy pose on a wide canvas so her
  raised hands are never cut. Her figure has to be perfect.
- **Pictures made from her face never go into git** (each game folder's `.gitignore`).
- Her speech goes in a bottom strip with her pose, never over the game.
- Her family must match the tree (read the profiles): Avraham Moshe (אברך), the kids by age (Shterni, Brachi, Sruli,
  Yanky, Ruchami, Malki, Shloimi - each with their look), the גיסה Shindy, Erez her team lead at Techy-Tech. Use only
  kids whose look is defined, and say their look in every prompt they appear in.
- Kosher world: modest poses, niggunim only (her real sounds at `/hani-games/sounds/`, list in `sounds.json` - play
  them from the site, don't copy them in), crowds of men only, no crosses or other symbols, no smartphones (a kosher
  phone).
- "נס בתוך נס!" moments matter to him - a big golden banner.
- Records keys: `hani-games:<slug>:best` (plain number - the hub shows it) etc.

## Promo
- Hani at the center of every promo picture; text never under an image; "משחק חדש במשחקייה!"; bottom 15% free.
- `game.json` badges usually "ניגונים בלבד", "לכל המשפחה".
