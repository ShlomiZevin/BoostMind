// What has a way in on the site (his ask, 2026-11-07: "turn it all off, keep the code ready to turn on and reachable for me -
// I'll go over everything, we fix it and release again"). Off for everyone: the simulation test's home band and chat card, the
// citizenship banner and the status sheet's citizenship buttons. HIS account still sees every way in, as it will be. The pages
// themselves stay at their address (/simulation, /citizenship). Release one = true here, copy to public/ and deploy
// (the chat's suggestion of the test: SIM_IN_CHAT in techietech-api/wiki.js).
import { st } from './state.js';
const SIM_OPEN = false;
const CZ_OPEN = false;
const NEXT_BAR = false;   // the phone top bar he chose on plan open-cz-sim (option 3 + his notes) - his eyes only until he approves
const HIM = new Set(['rJLlCV393shl7njhzWZmoaE15Yp2']);   // shlomi@boostart.io
// a test browser sees what he sees (localStorage vx-preview = 1) - only for the sessions' phone checks and screenshots
const peek = () => { try { return localStorage.getItem('vx-preview') === '1'; } catch (e) { return false; } };
export const him = () => !!(st.user && HIM.has(st.user.uid)) || peek();
export const simOpen = () => SIM_OPEN || him();
export const czOpen = () => CZ_OPEN || him();
export const nextBar = () => NEXT_BAR || him();
