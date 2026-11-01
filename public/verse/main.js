// The Shlomiverse's social layer, wired into the wiki page (/wiki/): the page calls HOOK.* at its seams, this file fills
// them. Loaded as a module after the wiki's own script; if the wiki rendered first, it routes again.
import { T } from './copy.js';
import { st, onState } from './state.js';
import { openPlayer, closePlayer, followBtn, paintFollow, setBack } from './player.js';
import { openStory, closeStory, storyRing, onStories, setStoryBack } from './stories.js';
import { communityPage, businessPage, homeBand, onIdeas } from './community.js';
import { renderTop, yourVerse, homeSlot, heroHi, notesPage, mePage, savedPage, myCharactersPage, myStickersPage, requestCard, refresh, setCurrent } from './pages.js';
import { installPage } from './push.js';

Object.assign(HOOK, {
  openPlayer,
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
  afterRoute(page, id) {
    // where the video page / stories go back to: the page under them
    const h = location.hash || '#/';
    const back = /^#\/(v|story)\//.test(h) ? '#/' : h;
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

// the wiki rendered before this module arrived (the Firebase SDK loads first): route again, now with everything
if (window.WIKI_READY) { if (typeof closeVideo === 'function') closeVideo(); route(); }
console.debug('[verse] ready', st.user ? 'signed in' : 'signed out');

// the floating "talk to the characters" button hides while the footer (its links) is on screen
const foot = document.querySelector('body > footer'), fab = document.getElementById('fab');
if (foot && fab && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => fab.classList.toggle('vx-hide', e.isIntersecting)).observe(foot);
