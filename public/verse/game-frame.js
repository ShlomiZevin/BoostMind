// The Shlomiverse game protocol, the game's side. Every game in the verse loads it in its <head>:
//   <script src="/verse/game-frame.js"></script>
// and takes its top offset from one variable, so it keeps a strip free for what the platform adds:
//   --safe-t: calc(env(safe-area-inset-top, 0px) + var(--verse-top, 0px));
// Inside the verse's game page (/wiki/#/play/<id>,
// verse/player.js openGame) the page answers this script's hello, and then:
//   - <html> gets class "in-verse" (a game hides its own share / like / "back to the site" with .verse-hide);
//   - in full screen --verse-top = the height of the strip where the verse puts the character's face and
//     "יציאה ממסך מלא" (0 in the frame, where the profile and buttons sit outside the game) - html.verse-full, and a
//     `verseframe` event with { top } for canvas games that draw their own HUD (window.VerseFrame.top);
//   - links that leave the game open in the whole tab, never inside the frame; a link back to the game's own hub
//     (/hani-games/, ../) goes to the verse's games page instead.
// Daily records: at game over the game reports its final score - one line, `window.VerseFrame && VerseFrame.score(n)` -
// and game.json says what it is called: "record": { "unit": "נקודות", "better": "high" } ("low" for a time). The verse
// keeps the day's table, shows it on the home and on the game page, and celebrates a new record.
// Every play goes through the verse (sign-in, records): a game opened on its own address forwards to its page there.
// ?solo=1 (or ?notrack=1, or localhost) keeps it on its own - for testing.
(() => {
  const root = document.documentElement;
  window.VerseFrame = { inVerse: false, top: 0, score() {} };
  if (window.top === window) {
    const q = new URLSearchParams(location.search), parts = location.pathname.split('/').filter(Boolean);
    const solo = q.has('solo') || q.has('notrack') || /^(localhost|127\.)/.test(location.hostname);
    if (!solo && parts.length >= 2 && /-games$/.test(parts[0])) location.replace(`/wiki/#/play/${parts[0]}-${parts[1]}`);
    return;
  }
  window.VerseFrame.score = (n) => { if (window.VerseFrame.inVerse && Number(n) > 0) parent.postMessage({ verse: 'score', value: Number(n) }, '*'); };
  const css = document.createElement('style');
  css.textContent = 'html.in-verse .verse-hide{display:none!important}';
  document.head.appendChild(css);
  const set = (top) => {
    top = Math.max(0, Math.round(Number(top) || 0));
    window.VerseFrame.inVerse = true;
    window.VerseFrame.top = top;
    root.classList.add('in-verse');
    root.classList.toggle('verse-full', top > 0);
    root.style.setProperty('--verse-top', top + 'px');
    dispatchEvent(new CustomEvent('verseframe', { detail: { top } }));
  };
  addEventListener('message', (e) => { const d = e.data; if (d && d.verse === 'frame' && e.source === parent) set(d.top); });
  parent.postMessage({ verse: 'hello' }, '*');

  const home = new URL('./', location.href).pathname;   // the game's own folder
  const hub = new URL('../', location.href).pathname;   // its hub (/hani-games/)
  document.addEventListener('click', (e) => {
    if (!window.VerseFrame.inVerse || e.defaultPrevented) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin === location.origin && url.pathname.startsWith(home) && url.pathname !== hub) return;   // inside the game
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    e.preventDefault();
    window.open(url.origin === location.origin && url.pathname === hub ? '/wiki/#/games' : url.href, '_top');
  }, true);
})();
