# Shlomiverse Online - the verse's multiplayer platform

Plan + his decisions: `scripts/multiplayer/PLAN.md`. First games: the Techy-Tech meetings hub
(`public/techytech-games/meetings/`): Callio (2-player memory, turns) and online versus modes of Meetly / Teamz / Zoomba
(real-time races).

## How it fits together

```
game (iframe)  -- postMessage {verse:'net', op} -->  verse page: net/index.js  (lobby UI, rooms, identity)
  window.VerseNet (game-frame.js)  <-- {verse:'net', ev} --                |
                                                                     transport seam
                                                          net/rtdb.js (now)   net/ws.js (Cloud Run, later - stub)
                                                                 |
                                       Firebase Realtime Database boostmind-b052c-default-rtdb (europe-west1)
                                       locks: database.rules.json (repo root)   cleaner: techietech-api/net.js
```

- A game NEVER opens a socket, never loads Firebase, never knows the transport. It loads only `/verse/game-frame.js`.
- The page (player.js) lazy-loads `net/index.js` on the first `{verse:'net'}` message - other pages pay nothing.
- No function per move: phones read/write the database directly; the `verse` function sees nothing new.
- Signed-in only (his decision): every lobby op runs `needFan('play')` first. Identity = uid + the fan's nick / photo.
- Online matches never go on the daily records (`VerseFrame.score` is for solo runs only).

## The game's API - `window.VerseNet`

| | |
|---|---|
| `await VerseNet.ready()` | `{ available, signedIn, me, invite, flags: { online } }` - available only inside the verse. `flags.online` = the page has `?online=1` or `?room=` (use it to keep online UI hidden until he releases it) |
| `host(key?)` / `quick(key?)` / `lobby(key?)` / `join(code)` | the verse draws the lobby: friend = 4-letter code + "הזמינו" (share sheet, link `/play/<id>?room=CODE`); quick = a waiting screen that keeps waiting until someone comes (cancel any time - no bot, no auto switch); lobby = the chooser. `key` = one of the game's online modes (rooms + the quick slot are per key) |
| `on('start', m)` | `{ room, key, mode, host, hostId, me, players:[{id,nick,photo,seat}], seed, round, turn, turnAt, now }` - also after every rematch (round 2, 3...) with a new seed |
| `send(data, to?)` + `on('msg', {data, from})` | free JSON messages, <= 2 KB, <= 20/s (not echoed to the sender) |
| `move(m)` + `on('move', {m, by})` | turn games: only the player whose turn it is; echoed to everyone in order |
| `state(obj)` + `on('state', obj)` | host only: the shared state (<= 8 KB). The host is the referee for hidden things |
| `VerseNet.turn`, `turnAt`, `isHost`, `myTurn()`, `now()` | whose turn, since when (server time), my turn?, server-aligned clock |
| `setTurn(id)` / `pass(id?)` + `on('turn')` | host sets the turn; a guest's `pass` goes through the host |
| `claim(key)` + `on('claim', {key, by})` | races: resolves to the uid that claimed `key` FIRST - a server transaction, arrival order, fair to the guest |
| `end()` / `rematch()` / `leave()` | host marks the match done; a rematch starts when every player asked; leave = the others get `left` |
| events | `players`, `away` (connection dropped), `back`, `left` (gone for good: closed, or away > 20 s), `rematch` ({by}), `end`, `closed` (lobby cancelled / room gone), `count` (players with this game open) |

Patterns: **turn game + hidden info** (Callio: host keeps the deck, reveals through `state`, guest sends `move`);
**race on the same seed** (Meetly / Teamz: both build the same board from `m.seed`, `claim('r'+n)` decides the round);
**duel on own boards** (Zoomba: `send` attacks + progress, `claim('lost')` = the first board that locked).

## Data (RTDB) and locks

```
/net/open                 kill switch: false = no new rooms / codes / quick slots (flip it in the console or REST)
/rooms/{rid}              game ("<gameId>:<key>"), code, mode, host, max, at, status (wait|play|done|closed), round, seed,
                          turn, turnAt, first, state (string), seats/{n}, players/{uid}{nick,photo,seat,on,left,again},
                          moves/{id}{by,m,t,r}, msgs/{id}{from,to,d,t}, claims/{key}: uid
/codes/{CODE}             {room, uid}   4 letters, no vowels / look-alikes (160k)
/queue/{gameId:key}       ONE waiting slot per game mode {uid, room, t} - taken in one transaction, beat every 15 s
/online/{gameId}/{uid}    presence (onDisconnect) -> "N playing now"
/hosting/{uid}            one open room per user
```

`database.rules.json`: signed-in only; own player slot only (seat claimed first); only the host writes status / seed /
turn / state; moves only by the player whose turn it is; claims once, by a player in the room, while playing; sizes
(2 KB message / move, 8 KB state, 24-char nick); a new room only when your previous one is closed / done / gone.
The page throttles sends (20/s). `verseNetSweep` (every 15 min) deletes rooms waiting > 15 min, playing > 2 h,
done > 10 min, closed > 2 min, and stale codes / hosting / queue slots.

## Run it, test it, deploy it

- Dev: `node v2/dev.mjs` (emulators incl. the database on :9000 - needs Java in `%USERPROFILE%\.local\jre21`), then load
  the rules into the emulator: `curl -X PUT -H "Authorization: Bearer owner" --data-binary @database.rules.json
  "http://127.0.0.1:9000/.settings/rules.json?ns=boostmind-b052c-default-rtdb"` and `curl -X PUT -H "Authorization:
  Bearer owner" -d true ".../net/open.json?ns=boostmind-b052c-default-rtdb"`.
- Tests (two browser contexts = two players): `scripts/techytech-games/meetings/tools/t4-online.js` (Callio: friend
  code, invite link, whole match, rematch, a dropped phone, quick match + cancel, the locks) and `t5-races.js` (the three
  races). `LIVE=1` runs them on shlomiverse.com with two temporary custom-token players (removed at the end).
- Deploy: rules `firebase deploy --only database --project boostmind-b052c`; the cleaner
  `cd techietech-api && firebase deploy --only functions:verseNetSweep --project boostmind-b052c`; the page files
  (`v2/site/verse/net/*`, `game-frame.js`, `player.js`) are copied to `public/verse/` and go with hosting.
- Cost: billed by GB downloaded (10 GB/month free, then $1/GB): a memory match ~30-60 KB, a race ~50-150 KB. Watch it on
  the Firebase console (Realtime Database -> Usage); if a game becomes a hit, build `net/ws.js` (Cloud Run) - no game changes.
