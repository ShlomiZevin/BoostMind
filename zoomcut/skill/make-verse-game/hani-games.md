# Hani's playhouse - המשחקייה של חני (shlomiverse.com/hani-games/)

Hani's games (and her family's) have their own home and their own release path. Everything in SKILL.md holds;
this page adds what is special here.

## Where things are
- Live: `https://shlomiverse.com/hani-games/<slug>/` (same site as boostmind-b052c.web.app).
- Code in git: `public/hani-games/<slug>/`; source tools, prompts and promo sources: `scripts/hani-games/`.
- Work on a game right in `public/hani-games/<slug>/` of an up-to-date BoostMind clone (`git pull` first; local server
  `python -m http.server 5301` from `public/hani-games/`; tests `node <slug>/tools/t1-play.js`). The old working copy
  `C:/workspace/hani-games` is retired (2026-11-12): copy anything newer from it into the clone once, then work only there.
- The hub page (`public/hani-games/index.html`: its `GAMES` list, the "בקרוב" cards) and `/stats/` belong to the
  BoostMind session that owns the site - ask it (or Shlomi) to add the card; don't overwrite the hub.

## Releasing a game
- **The live site is exactly what is pushed to git** (his rule, 2026-11-12 - releasing onto live from outside git is
  gone: `deploy-onto-live.js` was deleted after a deploy from the other computer took files off the site). A release =
  the game's whole folder (pictures, sounds, Hani's poses - everything, it is all in git now) committed, `git pull
  --rebase`, `git push`, then `bash scripts/deploy.sh`. The deploy stops by itself if this computer is behind / ahead of
  git or anything under `public/` is not committed (`scripts/deploy_check.py`).
- "בקרוב" (a card before the game is ready) = its `game.json` with `"status": "soon"` + `cover.jpg`, committed and deployed
  the same way.

## Hani herself
- Painted poses from her portrait (calm, talk, surprised, joy...), normalised; the joy pose on a wide canvas so her
  raised hands are never cut. Her figure has to be perfect.
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
