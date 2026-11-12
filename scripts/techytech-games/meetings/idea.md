# אז אנחנו מסונכרנים - Techy-Tech meeting games (12 Nov 2026)

His words: "a game for the zoom meetings in Techy-Tech" -> picked 2048; "enable choosing between which zoom call - zoom,
google meet or teams - each one a different game"; names Zoomba / Meetly / Teamz (invented, no real brands); add Itay
(Chief of AI, newest videos); "don't waste place on areas which are not the game"; "100% fun in mobile, desktop can look
like mobile"; "make it silently live once ready".

- Hub = laptop desktop (assets/hub.jpg) with 3 app cards, each its own record + "איך משחקים?".
- Zoomba = 2048: צ'ק-אין > סנכרון > יישור קו > פגישת המשך > תמונת מצב > POC > דמו ליום ראשון > ועדת היגוי > פגישה עם
  רונית > פגישה עם גלעד > החלטה! Daniel tile (no merge; a merge next to him = "הוסר מהפגישה" +150); Itay tile (counts down
  7 moves and leaves; leaves at once if the board would lock). Daily seed.
- Meetly = Where's Waldo in a call grid (4x5 .. 8x12), 40 s clock, +5 s per find, -3 s wrong. Tasks: Daniel hand up
  (decoys "דניאל (2)"), Itay leaving, Yaniv not sharing screen, who talks on mute, who fell asleep, empty camera, Gilad.
- Teamz = Flow Free: Hamiltonian path (backbite) cut into pairs = always solvable, full fill required; rows follow the
  phone's shape; 75 s clock, +22 s per board.
- Tutorials per app (Space/Enter next, Esc skip, try-steps). Tests: tools/t1-play.js, tools/t2-phones.js.

## Online (12 Nov 2026) - Shlomiverse Online's first games (platform: v2/site/verse/net/README.md, plan scripts/multiplayer/PLAN.md)
His decisions: Realtime Database behind a seam; signed-in only; random match = keep waiting, cancel allowed, no bot.
- **Callio** (4th app, callio.js): 2-player memory, 4x5 = 10 pairs of Zoom participant tiles; face-down = camera-off tile.
  Pair = go again; miss = turn passes; 20 s a turn (the host passes a turn that runs out). The host is the referee and
  keeps the deck (private random seed, never in the room). "X כבר לא בפגישה - ניצחתם"; rematch (both press); new
  opponent. Solo practice board ("אימון לבד", fewest flips) + a 7-step tutorial (3x2 board).
- **Meetly race** (online.js): same grid on both phones (start seed); first tap on the target takes the round
  (VerseNet.claim = server transaction); a wrong tap locks for 1.5 s; best of 7 (first to 4). No clock.
- **Teamz race**: same board (fixed rows online, not from the phone's shape); first to connect all + fill takes it;
  the opponent's progress as "🔗 x/y"; best of 5 (first to 3). No clock.
- **Zoomba duel**: own boards, same seed; a merge to 6-7 sends Daniel, 8+ Itay to the opponent ("X שלח לך את דניאל");
  HUD = opponent's score + top meeting; the first board that locks loses (claim('lost')).
- All online UI hidden unless ?online=1 or an invite link (?room=) - he decides when it shows. Online never reports records.
- Tests: tools/t4-online.js (Callio), t5-races.js (the races), t6-shots.js (every online screen at 4 sizes), t2 (Callio practice).
