# Leonardo prompts for Dorit's tarot cards, her studio and her own (bad) profile selfie - one .txt per picture
import pathlib
here = pathlib.Path(__file__).parent

CARD = ("A single tarot card in the classic Rider-Waite style: hand-drawn black ink outlines, flat muted watercolour "
        "fills (mustard-yellow sky, ochre, brick red, cornflower blue), a simple ornate border, a small blank cartouche at "
        "the top and a blank title banner at the bottom (both left empty). The card stands straight and fills most of the "
        "frame, on a plain flat light-mint (#CDEBDD) background around it. No text, no letters, no numbers anywhere. ")
FACE = ("The man on the card has exactly the face of the person in the reference photo - the same face, hair, hairline, "
        "age and expression - drawn in the same tarot ink-and-watercolour style. ")

P = {
  # the four politicians (portrait from their official photos)
  "bibi": CARD + FACE + "Card 'Justice': he sits crowned on a stone throne between two grey pillars, in a red royal robe, holding golden balance scales (Libra) high in one hand and an upright sword in the other; the scales tip to one side. Behind him a purple curtain, a small Libra symbol in the sky.",
  "gadi": CARD + FACE + "A king card: he sits on a stone throne carved with bull heads, wearing a royal robe over an olive-green army general's uniform and a small olive beret; at his feet on one side a stubborn bull, on the other side a mountain goat with curved horns, the two animals glaring at each other.",
  "bennett": CARD + FACE + "Card 'The Emperor': he sits on a grey stone throne carved with ram heads (Aries), a small knitted kippah on his head, a red robe over armour, holding a golden sceptre and an orb, barren orange mountains behind him.",
  "lapid": CARD + FACE + "A Scorpio card: he stands in a night desert in a dark-blue robe holding a golden cup, a large black scorpion at his feet with its tail raised, the scorpion constellation glowing in the dark sky, a brooding serious look.",
  # the other cards (no real faces)
  "pundit": CARD + "Card 'The Fool': a TV news pundit in a grey suit and tie, staring proudly at a bar chart of election polls he holds up, cheerfully stepping off the edge of a cliff without looking, a small white dog barking at him, bright yellow sky.",
  "conjunction": CARD + "Two planets meeting in the night sky - golden ringed Saturn and deep-blue Neptune - merging together inside the top segment of a great astrological wheel drawn across the sky, rays of light pouring down; below, a tiny bearded sage with a telescope looks up astonished.",
  "venus": CARD + "The goddess Venus in a pink robe walking backwards across a garden, looking back over her shoulder, worried; a trail of footprints going the wrong way, the planet Venus in the sky with a small backwards arrow.",
  "farewell": CARD + "Card 'Six of Swords': a ferryman rowing a small boat away across the sea at sunset with a cloaked passenger who waves goodbye, six swords standing upright in the boat, white doves flying away, the shore left behind.",
  "clash": CARD + "Card 'The Chariot' gone wrong: an empty stone chariot being pulled in opposite directions by a bull and a mountain goat, their horns locked, sparks flying; in the sky above, a pale-blue ringed planet (Uranus) frowning down at them.",
  "tower": CARD + "Card 'The Tower': a tall government building on a rock struck by lightning, flames from the windows, jigsaw puzzle pieces and office chairs flying out of it, two tiny men in suits falling, dark stormy sky.",
  "wheel": CARD + "Card 'Wheel of Fortune': a great wheel floating in the clouds with blue ballot boxes fixed all around its rim, spinning round and round, a tired sphinx sitting on top, little ballot papers flying off.",
  "sevenswords": CARD + "Card 'Seven of Swords': a sly man in a red cap tiptoeing away from a colourful camp of tents, carrying five swords in his arms and looking back over his shoulder, two swords left stuck in the ground behind him, yellow sky.",
  "fourcups": CARD + "Card 'Four of Cups': a young man sitting cross-legged under a tree with arms folded, bored and sulking, three golden cups standing on the grass in front of him, a hand coming out of a small cloud offering him a fourth cup that he ignores.",
  "israel": CARD +"A mighty bull (Taurus) bucking wildly on rocky ground under a stormy sky, a blue-and-white banner tied to its horns flapping, the Taurus constellation glowing above, everything shaking and unstable.",
  # her studio (all her videos) - ridiculous, tacky; one frontal blank board for each video's own map
  "studio": ("A real photograph of a ridiculous, over-the-top kitsch home 'astrology TV studio' that a loud Israeli aunt set up in "
          "her Ra'anana apartment living room. Vertical frame, shot straight on from seated eye height; the lower middle of the "
          "frame is open space where she will sit. Purple painted walls, gold star-print curtains, a purple LED strip along the "
          "ceiling, gold tinsel, a cheap ring light on a stand, a plastic zodiac wheel wall clock, a giant crystal ball on a "
          "leopard-print tablecloth, plastic flowers in a gold vase, gold cat figurines, a big hamsa, fairy lights, a framed "
          "certificate, an old CRT TV with a doily on top. On the wall in the upper middle a large plain blank white board, "
          "perfectly frontal and evenly lit, nothing on it. Tacky, cluttered, sincere, funny. Nobody in the shot. No text, no "
          "letters, no logos, no numbers."),
  # her profile picture - a selfie she took herself, badly
  "selfie": ("A bad selfie of the person in the reference photo taken by herself on her phone - keep the same face, the same short "
          "curly messy brown hair, bold eyebrows, big eyes and round face. She holds the phone too low so it looks up her chin and "
          "nostrils, the top of her head is cut off, motion blur from her hand shaking, the phone's flash blasting her face shiny, "
          "a blurry thumb covering a corner of the lens, slightly tilted. She wears a loud purple blouse and big gold hoop earrings, "
          "a proud know-it-all half smile. Behind her a purple living-room ceiling with a cheap chandelier. Low-quality phone photo, "
          "grainy, out of focus. No text."),
}
for k, v in P.items():
    (here / f"{k}.txt").write_text(v, encoding="utf-8")
print(len(P), "prompts")
