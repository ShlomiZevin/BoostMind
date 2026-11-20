// The Shlomiverse's social layer, wired into the wiki page (/wiki/): the page calls HOOK.* at its seams, this file fills
// them. Loaded as a module after the wiki's own script; if the wiki rendered first, it routes again.
import { T } from './copy.js';
import { loader } from './ui.js';
import { st, onState, needFan } from './state.js';
import { openPlayer, openGame, closePlayer, followBtn, paintFollow, setBack } from './player.js';
import { openStory, closeStory, storyRing, onStories, setStoryBack, paintStoryRing } from './stories.js';
import { communityPage, businessPage, homeBand, onIdeas, stickerCard, nearest, chatIdeaCard } from './community.js';
import { renderTop, yourVerse, homeSlot, stickersSlot, heroHi, notesPage, mePage, savedPage, myCharactersPage, myStickersPage, requestCard, signinCard, refresh, setCurrent } from './pages.js';
import { installPage } from './push.js';
import { mountHome as recordsHome, unmountHome as recordsOff, recordsPage } from './records.js';
import { startRowArrows } from './rows.js';
import { startPlays } from './plays.js';
import { archivePage, archiveCard } from './archive.js';
import { appBoot } from './install.js';
import { simPage, mountBand, quizCard } from './sim.js';
import { mountLive } from './livestrip.js';
import { mountTz } from './tzhome.js';
import { adSlot } from './ads.js';
import { citizenPage } from './citizen.js';
import { shellAfterRoute } from './shell.js';   // APP SHELL: the tab bar, the slim top bar (gates.js APP_SHELL)
import { videosFeed, feedAfterRoute } from './feed.js';   // APP SHELL: the videos feed on phones
import { gamesFeed, gamesToggle, feedToggle, gfeedAfterRoute } from './gfeed.js';   // APP SHELL: the games feed on phones
appBoot();

Object.assign(HOOK, {
  openPlayer,
  openGame,
  openStory,
  videosFeed,   // APP SHELL: /videos on a phone (the wiki page asks only under html.app)
  gamesFeed, gamesToggle, feedToggle,   // APP SHELL: /games on a phone, and the feed / grid switch (games, videos)
  T,   // APP SHELL round 2: the copy, for the few words the wiki page draws itself (the videos grid, the chat's row)
  closeOverlays: () => {
    const a = closePlayer(), b = closeStory();
    // back onto the home kept from under a video / game opened straight from a link: its records were never filled in
    if ((a || b) && location.pathname === '/') setTimeout(recordsHome, 0);
    // a video opened from the chat: back to that conversation
    if (a && HOOK.chatReturn) { const mode = HOOK.chatReturn; HOOK.chatReturn = null; setTimeout(() => openChat(mode), 0); }
    return a || b;
  },
  followBtn: (char) => followBtn(char, 'btn'),
  storyRing,
  yourVerse,
  heroHi,
  homeSlot,
  stickersSlot,
  adSlot,        // the sponsored banner on a character's page (ads.js)
  requestCard,
  signinCard,
  stickerCard,   // [[sticker:ID]] in a chat reply
  ideaCard: chatIdeaCard,   // [[idea:KIND|TEXT]] in a chat reply: the visitor's idea, ready to send
  quizCard,      // [[quiz]] in a chat reply: the character suggests the simulation test (sim.js)
  archiveCard,   // [[archive]] in a chat reply: a video it didn't find - the archive (archive.js)
  nearestId: nearest,
  // the chat sends the account with each question (3 in total without an account, 10 a day signed in), and signs in from its note
  chatToken: () => (st.user ? st.user.getIdToken() : Promise.resolve(null)),
  myUid: () => (st.user ? st.user.uid : null),   // the chat's invite link (bring a friend)
  chatSignIn: () => needFan('chat'),
  afterRoute(page, id) {
    // where the video page / stories go back to: the page under them
    const h = location.pathname + location.search;
    const back = /^\/(v|story|play)\//.test(h) ? '/' : h;
    setBack(back); setStoryBack(back);
    setCurrent(page, id);
    feedAfterRoute(page); gfeedAfterRoute(); shellAfterRoute();   // APP SHELL
    document.body.dataset.page = page || 'home';
    // the signed-in home has a solid top bar (no hero under it)
    renderTop();
    paintFollow();
    if (page === 'notes') document.title = `${T.notesTitle} · שלומיוורס`;
    if (!page) mountLive();   // the live strip: a drop video of the last 7 days (livestrip.js) - before the simulation band, which steps aside for it
    if (!page) mountBand();   // "אתם חיים בסימולציה?" under the question box (sim.js)
    if (!page) mountTz();   // "עכשיו בחרדות" under the stories (tzhome.js - only once ציפציפ answers)
    if (!page) recordsHome(); else if (page !== 'records' && !/^\/(v|story|play)\//.test(h)) recordsOff();   // "שיאי היום": the home's rows, and its own page
  },
});
window.chatHeadCopy?.();   // APP SHELL: a chat drawn before HOOK.T arrived (a straight link to /chat) gets its header's words
// the account's pages wait for Firebase to say who this is: the loader until then, never a "sign in" card that flips a
// second later (round 4, his note 2026-11-07: three screens on a refresh) - onState's refresh() draws them once it knows
const known = (fn) => (...a) => (st.ready ? fn(...a) : loader());
pages.notes = known(notesPage);
pages.me = known(mePage);
pages.saved = known(savedPage);
pages.community = communityPage;
pages.business = businessPage;
onIdeas(() => refresh());
pages['my-characters'] = known(myCharactersPage);
pages['my-stickers'] = known(myStickersPage);
pages.install = installPage;
pages.simulation = simPage;
pages.citizenship = citizenPage;
pages.archive = archivePage;   // הארכיון - every Instagram post, for residents (archive.js)
pages.records = recordsPage;   // שיאי היום, the full board (records.js)
// ישיבת זום · טקי-טק (meeting.js) - hidden: no link anywhere, the server answers only the owner; its file loads only here
pages.meeting = () => { import('./meeting.js').then((m) => { if (document.getElementById('mt')) m.mountMeeting(); }); return `<div class="mt" id="mt">${loader()}</div>`; };

onState(() => { renderTop(); paintFollow(); refresh(); });
startRowArrows();   // a computer: arrows on the rows that move sideways (rows.js)
startPlays();       // the watch count on every video card and in the player (plays.js)
onStories(() => { refresh(); paintStoryRing(); });

// the wiki rendered before this module arrived (the Firebase SDK loads first). On the home: fill in only the account parts
// (the greeting, their block under the hero) - redrawing the whole page reloaded the wall of faces, and he saw the site
// "load twice". Any other page routes again, now with the follow buttons and the rest.
if (window.WIKI_READY) {
  const atHome = location.pathname === '/';
  if (atHome && document.getElementById('home-slot')) { if (HOOK.afterRoute) HOOK.afterRoute(''); refresh(true); }
  else { if (typeof closeVideo === 'function') closeVideo(); route(); }
}
console.debug('[verse] ready', st.user ? 'signed in' : 'signed out');

// the floating "talk to the characters" button hides while the footer (its links) is on screen
const foot = document.querySelector('body > footer'), fab = document.getElementById('fab');
if (foot && fab && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => fab.classList.toggle('vx-hide', e.isIntersecting)).observe(foot);
