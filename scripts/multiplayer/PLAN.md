# Shlomiverse Online - play with a friend (plan, 12 Nov 2026)

Status: PLAN ONLY - nothing built, committed or deployed. Read from `c:\workspace\BoostMind` (main, fetched 12 Nov)
and `c:\workspace\plaxzy`.

His words: "a memory game that is fun only multiplayer with invite a friend ... make it a PLATFORM, easy to 1. invite a
friend with a room code / link, 2. just randomly find someone - wait for someone to join ... make sure it won't overload
our regular server (if it's a hit we'll create a dedicated Google Cloud Run for online) ... it is infra, add it to the
infra and to the make-verse-game skill."

---

## Part 1 - in plain words

**What players get (the same in every online game):**
- On the game's page in the verse, a game that has online play shows two buttons under the title card / inside the game:
  **"שחקו עם חבר"** (play with a friend) and **"מצאו יריב"** (find an opponent).
- **Play with a friend**: the verse opens one screen with a big 4-letter room code and **"הזמינו"** (the phone's share
  sheet: WhatsApp etc.) with a link like `shlomiverse.com/play/hani-games-memory?room=KFTR`. The friend taps the link,
  signs in with Google if needed (one tap), and both are in. The host presses "start".
- **Find an opponent**: "looking for an opponent..." with how many people are playing this game now. If nobody comes
  in ~30 seconds: **"play the computer meanwhile"** - and if someone arrives, a bar pops up "דורית is here - play now".
  Nobody is ever stuck on a spinner.
- Same lobby, same words, same look for every game - the game itself only draws the board.
- Rematch, "new opponent", and a clear message if the other player left.

**Why it won't load the regular server:** the moves don't go through our server at all. The phones talk to a separate
Google service built for live games (Firebase **Realtime Database**), with locks ("rules") that say who may write what.
The `verse` function (sign-in, records, comments) sees nothing new. One tiny cleaner runs every 15 minutes to delete
old rooms.

**What it costs:** a memory game is about 40 small moves. That is roughly 30-60 KB of traffic per game. Google gives
10 GB a month free - about **150,000-300,000 memory games a month for $0**, then about $1 per extra ~20,000 games.

**If it becomes a hit:** the games talk to one "net" layer in the verse page, never to Google directly. Swapping that
layer to our own Cloud Run server (like Plaxzy's `plaxzy-net`) is one file in the verse - no game changes.

**First game to prove it:** a 2-player memory (pairs) game with a character, turn by turn. Find a pair = you go again.
Fun only with two: you remember what your opponent flipped too.

**Then it goes into the skill**, so every future game can say `"online"` in game.json and get the whole invite flow.

---

## Part 2 - what exists today (findings, with paths)

### How a game runs inside the verse
- A game is a plain folder `public/<character>-games/<slug>/` with `game.json` (`status: live`) collected by
  `scripts/wiki/build.py` into wiki.json `games`.
- It is played at `/play/<id>` inside an **iframe on the same origin** (`v2/site/verse/player.js` `openGame`, line ~198).
  The iframe has `allow="... clipboard-write; web-share"`.
- The protocol is postMessage, game side `v2/site/verse/game-frame.js` (55 lines): game sends `{verse:'hello'}`, page
  answers `{verse:'frame', top}`; at game over `VerseFrame.score(n)` posts `{verse:'score', value}`; the page
  (`player.js` `P.onMsg`, ~line 301) hands it to `records.js onScore`. A game opened on its own address forwards to
  `/play/<id>`; `?solo=1` / localhost keep it standalone.
- **Sign-in**: Firebase Auth (Google / email code), state in `v2/site/verse/state.js` (`st.user`, `st.fan` with
  `nick`, `photo`; `signedIn()`, `needFan(key)` opens the sign-in sheet). **One free game per device in the whole
  verse** (`localStorage 'verse-free'`, `player.js` `decide()`), then the gate "sign in to play".
- **Daily records**: `records.js` + the `score` / `rank` ops in `techietech-api/verse.js` (~line 297): a transaction on
  `records/<game>_<dayIL>` (top 10) + `players/<uid>`; capped by `spend('score', uid, SCORES_A_DAY)` (a Firestore
  quota doc with an `exp` TTL field). Clients only READ `records/*` live (`onSnapshot`); `firestore.rules` line 167.
- **Backend**: all fan actions go through ONE callable `exports.verse` (`techietech-api/verse.js` line 764:
  `europe-west1, maxInstances: 6, concurrency: 40, 512MiB`) - this is "the regular server". Firestore project
  `boostmind-b052c`. Client Firebase in `v2/site/verse/fb.js` (SDK 12.4.0 from gstatic; emulators on localhost,
  project `demo-shlomiverse`, config `v2/firebase.json`: auth/functions/firestore/storage - no database emulator).
- **Rules**: `firestore.rules` - every verse collection is client read-only (`fans/{uid}` own only, `records`,
  `videoStats`, `comments`...). All writes are by functions. Nothing a client writes directly today (in the verse).
- **Hosting**: Firebase Hosting `public/` via `bash scripts/deploy.sh` (pulls Hani's games first). Hosting cannot proxy
  WebSockets (Plaxzy reaches its relay on a run.app address directly for that reason).

### Realtime / presence / push today
- **Realtime: yes, read-only** - Firestore `onSnapshot` listeners (records boards, `videoStats`, hearts, the bell).
- **Presence: none.** No online/away tracking anywhere.
- **Push: yes** - Web Push (`v2/site/verse/push.js`, `/sw.js`, VAPID key in `fb.js`, `pushSub` op, server `push()`
  in verse.js used by records "someone took your first place"). Useful later for "X invited you".
- **Realtime Database: none** - `firebase database:instances:list --project boostmind-b052c` -> "No database
  instances found". Creating one is a one-time console/CLI step.

### Online code in Plaxzy (a pattern to copy, not code to share)
- **Plaxzy.net** - the game in a sandboxed frame has no network; it posts `net` ops to the page, and the page holds ONE
  WebSocket to the room relay, Cloud Run `plaxzy-net` (project plaxzy12, me-west1). Client:
  `c:\workspace\plaxzy\site\plaxzy-client\src\lib\gameNet.js` (283 lines: reconnect + resume within 20 s grace,
  16 KB message cap, dedicated servers per game). Game side: `site\plaxzy-creator\lib\harness.js` ~line 204
  (`net.check / host / join / quick / leave / lock / send / rooms / on(...)`). Relay source is NOT in a repo (deployed
  tarballs in `gs://plaxzy12_cloudbuild/source/`).
- **PlaxzyMatch** - `plaxzy-studio\studio\net\matchfinder.js` (134 lines) + `README.md`: the matchmaking UX layer -
  quick match that re-rolls when alone 5-9 s, "play the computer while you wait" + "Opponent found · Play now",
  found -> ready -> go handshake with a shared seed + each player's hello, friends rooms, invite link `?room=`,
  rematch. Copied unchanged into ~10 games (Sky Jam, Arctic Icebreaker, Big Diggers, Fleets & Flags, Jet Ski...).
- **NET_OWNERS** - `plaxzy-studio\PROTOCOL.md` ~line 655: the relay admits only `tier:'pro'` games or owners in the
  `NET_OWNERS` env - an allow-list, Plaxzy-specific.
- Game patterns in PROTOCOL.md: **ghost race** (Arctic Icebreaker - each side runs its own game on the same seed,
  sends position ~15/s), **host-authoritative duel** (Nori's Thaw - host runs the world, guest sends input ~30/s),
  **host runs, guest mirrors** (Sky Jam). "Online runs never go on the daily boards."
- **What we take**: the architecture (game -> postMessage -> page owns the connection), the API shape, the
  matchmaking UX (never stuck, play-the-bot-while-waiting, found/ready/go, seed, rematch), the 2-browser test.
  **What we don't take**: plaxzy-net itself (another company's project, allow-listed, source not in a repo).

---

## Part 3 - transport: the recommendation

### Options compared (for our load and our games)
| | Firestore `rooms` (clients write, rules) | **Firebase Realtime Database** | WebRTC P2P (+Firestore signalling) | Cloud Run WebSocket relay |
|---|---|---|---|---|
| Load on the `verse` function | none | **none** | none | none (own service) |
| Latency | 200-600 ms | **~50-150 ms** | lowest when it connects | ~50 ms |
| Presence / "left the game" | no - heartbeats (extra writes) | **built in: `onDisconnect()`** | connection state | built in |
| Fast games (10-30 msgs/s) | no (~1 write/s per doc, billed per write) | **yes** (billed by bytes) | yes | yes |
| Billing | per read/write | **per GB downloaded (10 GB/mo free)** | free + TURN server for ~10-20% of phones | min instance ~$10-30/mo + CPU |
| Ops work | none | **none (one rules file)** | high (NAT, TURN, reconnect) | a server to run, deploy, watch |
| Fits our stack | yes | **yes - same Firebase Auth uid in rules** | partly | new repo/service |

### Recommendation: Firebase Realtime Database now, behind a transport seam
- **One new RTDB instance** in boostmind-b052c, location `europe-west1` (closest RTDB region to Israel), e.g.
  `shlomiverse-net-default-rtdb` (or a named instance `shlomiverse-net`). Phones read/write `rooms/...` directly,
  authenticated with the verse's Firebase Auth, guarded by `database.rules.json`. **No function per move, per join,
  per match.** Presence and "the other player left" come free with `onDisconnect()`; reconnection after a phone
  switches network is automatic in the SDK.
- Why not Firestore: works for turn-based, but no presence (heartbeats = writes), 1-write/s-per-doc ceiling and
  per-op billing make anything faster than a memory game awkward. The platform should serve action games too.
- Why not WebRTC: NAT/TURN failures on Israeli mobile networks, much more code, and still needs signalling.
- Why not Cloud Run now: a service to run and pay for before we know there is load. It is the planned step 2.

### The seam (so Cloud Run later = one file)
```
game (iframe)  --postMessage {verse:'net', op, ...}-->  verse page: net/index.js (lobby UI + rooms logic)
                                                              |
                                                     transport interface
                                                     /                 \
                                    net/rtdb.js (now)          net/ws.js (later: Cloud Run "verse-net")
```
- Games never import Firebase and never know the transport - exactly Plaxzy.net's design. The verse page owns the
  connection, the identity and the lobby UI.
- Transport interface (internal to the verse): `open(gameId) / createRoom(opts) -> code / joinRoom(code) /
  quick(gameId, max) / send(data, to) / setState(patch) / leave() / on('peers'|'msg'|'state'|'closed', fn)`.
- Switching: `game.json "online": { "transport": "ws" }` per game, or a global flag in `verseMeta/net` - so we can
  move one hot game first. The Cloud Run relay would speak the same room protocol (we write our own ~300-line Node
  `ws` server modelled on plaxzy-net; region me-west1 or europe-west1, session affinity on, direct `wss://...run.app`).

### Cost / load estimate (RTDB, Blaze pricing: storage $5/GB-month beyond 1 GB, download $1/GB beyond 10 GB/month)
- **Memory game, 2 players**: join/room setup ~3 KB + ~40 moves x ~150 B x 2 receivers + SDK/TLS overhead
  -> **~30-60 KB per game**. 10 GB free ~ **170k-330k games/month free**; after that ~$0.00005 per game.
- **Fast action game** (20 msgs/s each way, 5 min): ~1.5-2 MB/game -> ~5,000 games/month free, then ~$0.002/game.
  That is the point where a Cloud Run relay starts to pay off.
- Storage: rooms are deleted after the game / by the sweep -> megabytes, effectively $0.
- Limits per instance: 200k simultaneous connections, ~1,000 writes/s sustained - far above what we expect; a hit
  game would move to Cloud Run long before.
- Functions: one scheduled sweep every 15 min (~3k invocations/month, free tier). Optional `netResult` op later.
- Firestore: zero new reads/writes per move.

---

## Part 4 - the platform design

### 4.1 Where it lives
| File | What |
|---|---|
| `v2/site/verse/game-frame.js` (+~60 lines) | the game side: `window.VerseNet` (thin, postMessage only) |
| `v2/site/verse/net/index.js` (new, ~350 lines) | page side: handles the game's ops, room/match logic (found -> ready -> go, seed, rematch, re-roll), identity |
| `v2/site/verse/net/lobby.js` (new, ~250 lines) + CSS in `verse.css` | the ONE shared lobby UI: choose mode, room code, invite/share, waiting screen, "play the computer meanwhile", "X is here - play now", "X left" |
| `v2/site/verse/net/rtdb.js` (new, ~150 lines) | the transport on Firebase RTDB (`firebase-database.js` from the same SDK 12.4.0) |
| `v2/site/verse/fb.js` (+5 lines) | `databaseURL` in the config; `connectDatabaseEmulator` on localhost; lazy-load the database SDK only when a game is online |
| `v2/site/verse/player.js` (+~30 lines) | route `{verse:'net'}` messages to net/index.js; `?room=CODE` deep link; online buttons on the game card |
| `v2/site/verse/copy.js` | the lobby's Hebrew words (Terra, his voice) |
| `database.rules.json` (new) + `firebase.json` `"database"` entry | the locks |
| `v2/firebase.json` | `"database": { "port": 9000 }` emulator |
| `techietech-api/net.js` (new, small) | `verseNetSweep` scheduled function (every 15 min) - deletes stale rooms/queue entries; separate from `verse` |
| `scripts/verse/net-test.mjs` (new) | two-browser Playwright test on the emulators (like Plaxzy's `t5-net.js`) |

Lazy: the database SDK and lobby code load only when the opened game has `"online"` - no cost to other pages.

### 4.2 How a game opts in - `game.json`
```json
"online": {
  "players": 2,            // max players in a room (2 for v1; up to 4 supported)
  "min": 2,                // players needed to start
  "modes": ["friend", "quick"],
  "bot": true,             // the game can play vs the computer (shown while waiting / as fallback)
  "turns": true,           // turn-based helpers on
  "solo": true             // the game also has a normal single-player mode
}
```
build.py copies `online` into wiki.json (like `record`). No `online` = the platform does nothing.

### 4.3 The game's API (`window.VerseNet`, from game-frame.js)
```js
VerseNet.available            // true only inside the verse, game has "online", database reachable
VerseNet.lobby()              // open the verse's shared lobby (friend / quick); resolves when a match starts
VerseNet.host()               // skip the chooser: create a friends room (lobby shows the code + invite)
VerseNet.join(code)           // join by code (the ?room= link does this by itself)
VerseNet.quick()              // random opponent: waiting room + timeout + bot fallback
VerseNet.on('start',  (m) => {})   // { seed, me, players:[{id,nick,photo,seat}], host:true|false, mode:'friend'|'quick' }
VerseNet.on('msg',    (data, from) => {})
VerseNet.on('state',  (state) => {})       // shared room state changed (turn-based)
VerseNet.on('away',   (id) => {})          // the other player's connection dropped (grace 20 s)
VerseNet.on('back',   (id) => {})
VerseNet.on('left',   (id) => {})          // gone for good -> the game shows "you win / X left"
VerseNet.on('botWhileWaiting', () => {})   // player chose "play the computer meanwhile" -> start a bot game
VerseNet.on('found',  (m) => {})           // an opponent arrived during a bot game -> lobby shows "play now"
VerseNet.send(data[, to])                  // JSON, <= 2 KB, <= 20/s
VerseNet.end({ winner, scores })           // match over -> verse shows rematch / new opponent / back
VerseNet.rematch()  VerseNet.leave()
// turn-based helpers (when "turns": true)
VerseNet.turn                 // id of whose turn it is
VerseNet.myTurn()             // boolean
VerseNet.move(m)              // only on my turn: appends m to the room's ordered move log; everyone gets on('move')
VerseNet.on('move', (m, by) => {})
VerseNet.pass(nextId?)        // hand the turn on (default: next seat)
```
- **Identity**: the page fills `players[]` from the verse sign-in: `uid`, `st.fan.nick`, `st.fan.photo` - never the
  Google full name (same rule as records).
- **Authority**: the room's host is the referee for anything hidden (e.g. the memory deck); turn order and the move log
  are enforced by the rules (only the player whose turn it is can append a move).
- **Bot fallback**: the game supplies the bot (`"bot": true`); the platform only decides WHEN (waiting > 30 s, or the
  player taps "play the computer"). Following Plaxzy: the waiting continues in the background, and "found" offers
  "play now".

### 4.4 The data (RTDB) - small and short-lived
```
/net/open: true                              kill switch (rules check it; Shlomi/owner can flip it)
/rooms/{roomId}
   game, code, mode('friend'|'quick'), host(uid), max, createdAt, status('wait'|'play'|'done'), seed
   players/{uid}: { nick, photo, seat, on(bool, onDisconnect=false), ready }
   turn: uid
   state: { ... }                            game-owned shared state (<= 8 KB)
   moves/{pushId}: { by, m, t }              ordered log (turn games)
   msgs/{pushId}: { from, to?, d, t }        free messages (fast games; clients delete as they read / sweep)
/codes/{CODE}: roomId                        4 letters, no vowels/ambiguous letters (like Plaxzy's A-Z x4 = 160k codes)
/queue/{game}: { uid, roomId, t }            quick match: ONE waiting slot per game (2-player)
/online/{game}/{uid}: true                   presence, onDisconnect remove -> "N playing now"
/hosting/{uid}: roomId                       one open room per user
```
- **Quick match = one slot per game, one transaction**: read `/queue/{game}`; empty or stale (> 40 s, host offline) ->
  create a room and put myself in the slot (I wait); someone there -> clear the slot and join their room. Atomic, no
  server, no "two people waiting in two empty rooms" (the bug PlaxzyMatch solves with re-rolls). 3-4 player games:
  the slot stays until the room is full.
- **Code**: a transaction on `/codes/{CODE}` (retry on collision).
- **Start**: when `players` = max and all `ready`, the host writes `status:'play', seed, turn` -> everyone gets `start`.

### 4.5 Abuse and limits (in `database.rules.json` + the sweep)
- Signed-in only (`auth != null`); and the verse's own gate already demands sign-in after the first free game.
- A player writes only `players/{auth.uid}`; only the host writes `status/seed/turn`; `moves` only when
  `turn == auth.uid` and `by == auth.uid`; `msgs.from == auth.uid`; no one writes another room's data.
- Sizes: `d` / `m` strings <= 2 KB (`.validate` on length), `state` <= 8 KB, nick <= 20 chars, `max` <= 4,
  `players` count <= `max`, `status:'wait'` rooms only joinable.
- One open room per user (`/hosting/{uid}`), one queue slot per game.
- TTL: the sweep deletes rooms `wait` > 15 min, `play` > 2 h, `done` > 5 min, codes pointing to missing rooms,
  stale queue slots; clients delete their room on clean end.
- Rate: RTDB rules can't count per second; the page throttles `send` (20/s) and `move`; a rules timestamp check
  (`/rate/{uid}/last` >= now - 40 ms) can be added if abused.
- Kill switch `/net/open` + a Google Cloud **budget alert** on the RTDB SKU (costs.js / Backstage → הוצאות can show
  it next to OpenAI).
- Later if needed: Firebase App Check (reCAPTCHA Enterprise) on the database.
- Online matches never go on the daily records (Plaxzy rule) - optional later: a "wins today" table through one
  `netResult` op (one call per match, not per move).

### 4.6 The shared lobby UI (verse page, one look for every game)
1. Game card (below the frame) for an online game: **"שחקו עם חבר"** + **"מצאו יריב"** (the game may also call
   `VerseNet.lobby()` from its own start screen; the page draws the lobby as a sheet over the frame, never inside it).
2. **Friend**: big code (tap = copy) + **"הזמינו"** -> `navigator.share({ url: /play/<id>?room=CODE, text })` (the
   verse's existing share, player.js `share()`), "waiting for your friend...", then both faces + "start".
3. **Quick**: "looking for an opponent" + "N playing now" + after 30 s "play the computer meanwhile"
   (posts `botWhileWaiting` to the game; a small top bar stays: "still looking..." / "X is here - play now").
4. **Invite link opened**: `/play/<id>?room=CODE` -> if signed out: "<host nick> invites you - sign in to play"
   (Google, one tap; the free-game gate does not apply to an invite - open question 3) -> joins.
5. End: rematch / new opponent / back - the platform's sheet, the game shows its own win screen behind it.
6. Messages: "X left the game", "connection lost - trying again", "room full", "this room has ended".

### 4.7 Testing
- Emulators: add the database emulator (`v2/firebase.json` port 9000) -> `node v2/dev.mjs` serves everything locally.
- `scripts/verse/net-test.mjs`: two Playwright browsers (two emulator users), friend flow (host -> code -> join ->
  start -> moves -> rematch), quick flow (both press, meet in one room), leave/away, a closed tab -> "left" in < 25 s.
- Rules unit test with `@firebase/rules-unit-testing` (cannot write other's slot, cannot move out of turn, size caps).

---

## Part 5 - the first game: 2-player memory (sketch only)

- **Who**: a character to pick with him (ideas: Hani's playhouse - pairs of her household chaos; or the Techy-Tech
  team's faces). Concept pictures first, his pick (skill step 2).
- **Board**: 4x4 (quick, 8 pairs) phone-upright, painted card backs + painted faces; the board ~80% of the screen.
- **Turn**: flip two. Pair -> you score and go again; no pair -> both see both cards ~1.2 s, turn passes. Most pairs
  wins; ties = "תיקו".
- **Why it is only fun with two**: you watch every flip of your opponent - their miss is your free information.
  A light twist for the character (e.g. a "chaos card" that swaps two face-down cards) - decided at the idea step.
- **Net model**: host-authoritative. Host shuffles with the match `seed` and keeps the deck. Player taps i ->
  `VerseNet.move({flip:i})`; host answers in `state` with `{revealed:{i:face}}`, scores and `turn`. Guest never holds
  the deck (no peeking in devtools; host could peek - acceptable for v1). ~40 moves a game.
- **Bot** (solo and while waiting): remembers each seen card with a forgetting chance (easy/normal).
- **Timers**: 20 s per turn; on timeout the turn passes; away > 20 s -> "X left - you win".
- **Online-only feel**: the start screen leads with "play with a friend" / "find an opponent"; "vs computer" quieter.
- Daily record: not for online matches; solo-vs-bot can report pairs-in-fewest-flips to the daily table (optional).

---

## Part 6 - what to add to the skill and the infra docs

### `zoomcut/skill/make-verse-game/SKILL.md`
- Step 2 (idea): "two-player ideas are welcome now - online play is part of the verse".
- Step 3 (game.json): the `online` block.
- Step 5, new item **"Online play - the verse's platform, never your own"**: load nothing but `/verse/game-frame.js`;
  use `VerseNet` (API table); never open sockets / Firebase in the game; the game supplies a bot; the platform draws
  the lobby; online runs don't report `VerseFrame.score`; test with `scripts/verse/net-test.mjs` (two browsers).
- Step 7 (check): play the online flow on two phones (or two browsers) - friend link + quick match + one leaving.

### `zoomcut/skill/make-verse-game/rules.md` - new section "Online"
- Pick the net model: turn-based (moves + host referee), ghost race (same seed, positions ~10-15/s), host-authoritative
  duel (guest sends input) - with the Plaxzy worked examples named.
- Send little: moments + inputs, never the whole world each frame; <= 20 msgs/s; <= 2 KB a message.
- Never stuck: the bot while waiting, "X left" ends the match with a result, rematch in one tap.
- Hidden information stays with the host.
- Online games still need the tutorial (one step about "invite a friend").

### Infra docs
- `BoostMind/CLAUDE.md`: a short "Online play (Shlomiverse Online)" section - RTDB instance, rules file, where the code
  lives, the kill switch, the sweep, how to deploy rules (`firebase deploy --only database`), the cost line on Backstage.
- `v2/site/verse/net/README.md` (the API and the protocol, like `plaxzy-studio/studio/net/README.md`).
- `shlomiverse-content` skill: one line - an online game is still just a game record; nothing extra in the database
  besides `online` in game.json.
- Mind: an item "Shlomiverse Online platform" (type to-do) + "Memory game (2 players)".

---

## Part 7 - build steps and rough size

| # | Step | Size |
|---|---|---|
| 0 | Approval of this plan on Backstage → תוכניות (+ mockups of the lobby by GPT Image) | 0.5 day |
| 1 | Create the RTDB instance (europe-west1), `database.rules.json`, firebase.json entry, emulator; rules unit tests | 0.5 day |
| 2 | `net/rtdb.js` transport + `net/index.js` rooms/codes/quick-slot/presence/handshake/turns | 1-1.5 days |
| 3 | `game-frame.js` `VerseNet` + `player.js` wiring + `?room=` deep link + build.py `online` field | 0.5 day |
| 4 | `net/lobby.js` + CSS + Hebrew copy (Terra) - phone first, 360px | 1 day |
| 5 | `verseNetSweep` (separate small function) + budget alert + kill switch | 0.5 day |
| 6 | Two-browser test `scripts/verse/net-test.mjs` on the emulators | 0.5 day |
| 7 | The memory game (concepts, painted cards, bot, tutorial, sounds) - make-verse-game flow | 2-3 days |
| 8 | Skill + rules + CLAUDE.md + net/README.md | 0.5 day |
| 9 | Live: deploy rules + hosting (`scripts/deploy.sh`) + function; real-phone test with him; draft game first | 0.5 day |
| | **Platform ~4-5 days, first game ~2-3 days** | |
| later | Cloud Run `verse-net` relay (`net/ws.js`) when traffic says so; push "X invited you" to followed friends; "wins today" | 1-2 days |

Note: `v2/site/verse/*` "belongs to the Shlomiverse session" per the skill - steps 2-4 are edits there, to be done by
(or coordinated with) that session.

---

## Part 8 - open questions for Shlomi
1. **Transport now**: (A) Firebase Realtime Database now, Cloud Run later only if it is a hit (recommended) /
   (B) build our own Cloud Run server from day one / (C) Firestore only.
2. **Who may play online**: (A) signed-in only, same as all games (recommended) / (B) the invited friend may play
   one online game without signing in (guest) / (C) anyone, guests everywhere.
3. **The memory game's character**: (A) Hani's playhouse (המשחקייה) / (B) Techy-Tech team / (C) another character -
   you name it / (D) show me 3 concept pictures first.
4. **Waiting with nobody around**: (A) after 30 s offer "play the computer meanwhile", keep looking (recommended) /
   (B) just keep waiting / (C) after 30 s switch to the computer automatically (against the "player decides" rule).

## His decisions (12 Nov 2026)
1. Transport: Firebase Realtime Database now (behind the seam); Cloud Run only if a game is a hit.
2. Who plays online: signed-in only.
3. The first online game: a 2-player memory (משחק זכרון) as a 4th app in the Techy-Tech meetings hub
   (public/techytech-games/meetings/) - the cards are Zoom participant tiles (the cast + crowd webp tiles already there).
4. Random match with nobody around: just keep waiting (no bot, no auto switch); the player may cancel.
