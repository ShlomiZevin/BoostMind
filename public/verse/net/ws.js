// Shlomiverse Online - the future transport: our own Cloud Run relay ("verse-net"), for when a game becomes a hit and the
// Realtime Database's per-GB price or its ~1,000 writes/s stop making sense (PLAN: scripts/multiplayer/PLAN.md, part 3).
// NOT BUILT. To build it: a ~300-line Node `ws` server (rooms, codes, one quick slot per game, presence, turn checks,
// the same caps as database.rules.json), region europe-west1 / me-west1, session affinity on, reached directly on
// wss://<service>.run.app (Firebase Hosting can't proxy WebSockets); it verifies the verse's Firebase ID token on connect.
// Then this file returns the SAME object as rtdb.js open() - createRoom / joinRoom / codeRoom / quick / unqueue / watch /
// setRoom / setMe / move / send / serverTime / leave / closeRoom / presence / isOpen / now / uid - and net/index.js
// picks it per game (game.json "online": { "transport": "ws" }) or for all (/net/transport). No game changes.
export async function open() {
  throw Object.assign(new Error('ws transport not built yet - use rtdb'), { code: 'no_transport' });
}
