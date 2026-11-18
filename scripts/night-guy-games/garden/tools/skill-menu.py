# make-verse-game skill: the start-screen (menu) rule, his ask 18 Nov 2026
import os
K = os.path.expanduser('~/.claude/skills/make-verse-game')
def edit(f, a, b):
    p = os.path.join(K, f); s = open(p, encoding='utf-8').read()
    assert a in s, f + ': ' + a[:80]
    open(p, 'w', encoding='utf-8').write(s.replace(a, b, 1))

edit('SKILL.md', """   - **The way back to the games lives ONLY on that start screen, and it is the verse's button, not yours**: put
     `<span data-verse-back-btn></span>` in the main menu (poster / "שחקו" / "איך משחקים") and game-frame.js draws the same
     orange "חזרה למשחקים" pill with the planet in every game, only inside the verse - never style your own. It returns to
     the feed at this game.""",
"""   - **The way back to the games lives ONLY on that start screen, and EACH GAME PAINTS ITS OWN** (his rule, 18 Nov 2026 -
     the verse's orange pill was "ugly as hell"; older games keep it, new games never use it): a "חזרה למשחקים" button in the
     game's own menu style WITH the Shlomiverse logo on it (`v2/site/verse/logo-512.png` as a reference when painting it),
     `class="... verse-only" data-verse-back` (game-frame.js turns it into the way back and shows it only in the verse; add
     `html:not(.in-verse) .verse-only{display:none!important}` to the game's CSS too). Outside the verse its slot holds the
     character link (`verse-hide`). The whole start screen follows "The start screen (menu)" in `rules.md`. It returns to
     the feed at this game.""")

edit('rules.md', """- Start screen: the game's cover art as the hero, the title, one line of what it is, ONE big main button ("שחקו"),
  a quieter "איך משחקים", the record, and a small footer (back to the hub, sound). Not a stack of equal buttons.
  He called a plain menu "terrible" - the start screen is the game's shop window. In the verse it also holds the way
  back to the games - the verse's own button, `<span data-verse-back-btn></span>` (game-frame.js draws it, never style your own) - only there; exits during play go back to
  this start screen. Never a floating button, never a reserved top strip.""",
"""- **The start screen (menu)** - his rule, 18 Nov 2026 ("I don't like our menus", the card-picture + paragraph + stacked
  buttons layout). The flow: the verse's games feed -> "לשחק" -> the game's OWN start screen. Every game designs its own,
  in its own world, by these rules (worked example: `public/night-guy-games/garden/`, design B in
  `scripts/night-guy-games/garden/menu/`):
  - **Designed first**: GPT draws 3 start-screen mockups (A / B / C stamped big) from the game's tall key art + title art,
    each a different direction (full-bleed glow / buttons painted as things from the game's world / arcade); he picks.
  - **The painting IS the screen**: a tall key art (1024x1536, the character from the portrait, sunburst HIGH; open sky at
    the top for the title, open ground at the bottom for the buttons) as the full-screen background, a dark fade only
    behind the buttons. On a wide screen the painting at full height in the middle on the game's dark colour.
  - **Zones, top to bottom**: the title art (top, big) -> the character's face, nothing over it -> the buttons. No
    paragraph of text, no tagline plaque over the art (it covered his face on small phones).
  - **The buttons**: ONE big main "שחקו" (the biggest thing after the title, gently breathing) -> ONE row of two equal
    buttons side by side, a clear gap between them: "איך משחקים" + "חזרה למשחקים" (in the verse) / the character link
    (outside it) -> a footer row: sound in one corner, the record badge in the other (+ levels / modes as one more row
    only if the game has them). Never buttons stacked one on another, never more than these.
  - **Painted pieces, words in code**: the buttons are blank painted pieces in the game's material (a sheet: big sign,
    plaque, record badge with its icon, round sound button, the back button with the Shlomiverse logo), the Hebrew
    written over them in code (Rubik 900, a light face with a dark engraved shadow) so every letter is exact. Cut the
    sheet by its shapes when the pieces differ in size (a grid cut mixes them). Mute = the same piece greyed + a slash.
  - **Sized from the screen**: widths in `min(vw, px, vh)`, fonts in `clamp(px, vh, px)`, gaps `clamp(10px, 2vh, 20px)`;
    it must fit a 320x568 phone AND the verse's short frame (~380 px tall) without scrolling or cutting.
  - **Check** at 320x568, 390x844, desktop and inside the verse (add `in-verse` to `<html>` in the test): every button on
    screen, >= 44 px tall, >= 10 px apart, nothing over the character's face; read the screenshots yourself.
  Exits during play go back to this start screen. Never a floating button, never a reserved top strip.""")
print('ok')
