// The Shlomiverse's social layer, wired into the wiki page (/wiki/): the page calls HOOK.* at its seams, this file fills
// them. Loaded as a module after the wiki's own script; if the wiki rendered first, it routes again.
import { T } from './copy.js';
import { st, onState, needFan } from './state.js';
import { openPlayer, openGame, closePlayer, followBtn, paintFollow, setBack } from './player.js';
import { openStory, closeStory, storyRing, onStories, setStoryBack } from './stories.js';
import { communityPage, businessPage, homeBand, onIdeas } from './community.js';
import { renderTop, yourVerse, homeSlot, heroHi, notesPage, mePage, savedPage, myCharactersPage, myStickersPage, requestCard, signinCard, refresh, setCurrent } from './pages.js';
import { installPage } from './push.js';

Object.assign(HOOK, {
  openPlayer,
  openGame,
  openStory,
  closeOverlays: () => {
    const a = closePlayer(), b = closeStory();
    // a video opened from the chat: back to that conversation
    if (a && HOOK.chatReturn) { const mode = HOOK.chatReturn; HOOK.chatReturn = null; setTimeout(() => openChat(mode), 0); }
    return a || b;
  },
  followBtn: (char) => followBtn(char, 'btn'),
  storyRing,
  yourVerse,
  heroHi,
  homeSlot,
  requestCard,
  signinCard,
  // the chat sends the account with each question (3 in total without an account, 10 more signed in), and signs in from its note
  chatToken: () => (st.user ? st.user.getIdToken() : Promise.resolve(null)),
  chatSignIn: () => needFan('chat'),
  afterRoute(page, id) {
    // where the video page / stories go back to: the page under them
    const h = location.hash || '#/';
    const back = /^#\/(v|story|play)\//.test(h) ? '#/' : h;
    setBack(back); setStoryBack(back);
    setCurrent(page, id);
    document.body.dataset.page = page || 'home';
    // the signed-in home has a solid top bar (no hero under it)
    renderTop();
    paintFollow();
    if (page === 'notes') document.title = `${T.notesTitle} · שלומיוורס`;
  },
});
pages.notes = notesPage;
pages.me = mePage;
pages.saved = savedPage;
pages.community = communityPage;
pages.business = businessPage;
onIdeas(() => refresh());
pages['my-characters'] = myCharactersPage;
pages['my-stickers'] = myStickersPage;
pages.install = installPage;

onState(() => { renderTop(); paintFollow(); refresh(); });
onStories(() => refresh());

// the wiki rendered before this module arrived (the Firebase SDK loads first). On the home: fill in only the account parts
// (the greeting, their block under the hero) - redrawing the whole page reloaded the wall of faces, and he saw the site
// "load twice". Any other page routes again, now with the follow buttons and the rest.
if (window.WIKI_READY) {
  const atHome = !(location.hash.slice(1) || '/').split('?')[0].split('/')[1];
  if (atHome && document.getElementById('home-slot')) { if (HOOK.afterRoute) HOOK.afterRoute(''); refresh(true); }
  else { if (typeof closeVideo === 'function') closeVideo(); route(); }
}
console.debug('[verse] ready', st.user ? 'signed in' : 'signed out');

// the floating "talk to the characters" button hides while the footer (its links) is on screen
const foot = document.querySelector('body > footer'), fab = document.getElementById('fab');
if (foot && fab && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => fab.classList.toggle('vx-hide', e.isIntersecting)).observe(foot);
