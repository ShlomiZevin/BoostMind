// What has a way in on the site (his ask, 2026-11-07: "turn it all off, keep the code ready to turn on and reachable for me -
// I'll go over everything, we fix it and release again"). Off for everyone: the simulation test's home band and chat card, the
// citizenship banner and the status sheet's citizenship buttons. HIS account still sees every way in, as it will be. The pages
// themselves stay at their address (/simulation, /citizenship). Release one = true here, copy to public/ and deploy
// (the chat's suggestion of the test: SIM_IN_CHAT in techietech-api/wiki.js).
// RELEASED 2026-11-08 after five rounds of his notes (his "make it live on the website"): all five open for everyone. The
// emails about it (verseMeta/mail.cz) wait for his call.
import { st } from './state.js';
const SIM_OPEN = true;
const CZ_OPEN = true;
const NEXT_BAR = true;   // the phone top bar he chose on plan open-cz-sim (option 3 + his notes) - his eyes only until he approves
const FLY_OPEN = true;   // the flight in as a game instead of the video (his idea 2026-11-07, verse/fly.js) - a draft for him to play first
const ABOUT_OPEN = true;   // "מה סיפרתם לנו" on the אני page (plan cz-sim-r3, verse/about.js) - his eyes only until he goes over it
const HIM = new Set(['rJLlCV393shl7njhzWZmoaE15Yp2']);   // shlomi@boostart.io
// a test browser sees what he sees (localStorage vx-preview = 1) - only for the sessions' phone checks and screenshots
const peek = () => { try { return localStorage.getItem('vx-preview') === '1'; } catch (e) { return false; } };
export const him = () => !!(st.user && HIM.has(st.user.uid)) || peek();
export const simOpen = () => SIM_OPEN || him();
export const czOpen = () => CZ_OPEN || him();
export const nextBar = () => NEXT_BAR || him();
export const flyOpen = () => FLY_OPEN || him();
export const aboutOpen = () => ABOUT_OPEN || him();
