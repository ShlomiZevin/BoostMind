# Dorit's OWN tarot deck ("טארוט מרקורי") - Rider-Waite style, her purple-gold border, HER face on the main figure
import pathlib
here = pathlib.Path(__file__).parent
CARD = ("A single tarot card in the classic Rider-Waite style: hand-drawn black ink outlines, flat muted watercolour fills "
        "(mustard-yellow sky, ochre, brick red, cornflower blue), but with a purple and gold ornate border and little gold stars "
        "in the corners, a small blank cartouche at the top and a blank title banner at the bottom (both left empty). The card "
        "stands straight and fills most of the frame, on a plain flat light-mint (#CDEBDD) background around it. No text, no "
        "letters, no numbers anywhere. ")
FACE = ("The main figure is a plump middle-aged woman with exactly the face of the person in the reference photo - the same "
        "round face, short curly messy brown hair, bold eyebrows and big eyes, gold hoop earrings - drawn in the same tarot "
        "ink-and-watercolour style. ")
P = {
  "fourcups": CARD + FACE + "Card 'Four of Cups': she sits cross-legged under a tree in a purple dress with her arms folded, sulking and bored, three golden cups standing on the grass in front of her, a hand coming out of a small cloud offering her a fourth cup that she ignores.",
  "sevenswords": CARD + FACE + "Card 'Seven of Swords': she tiptoes away from a colourful camp of tents in a purple dress, carrying five swords in her arms and looking back over her shoulder with a sly smile, two swords left stuck in the ground behind her.",
  "wheel": CARD + FACE + "Card 'Wheel of Fortune': a great wheel floating in the clouds with blue ballot boxes fixed all around its rim; on top of the wheel sits a sphinx whose head is her face, looking smug; angels in the corners, ballot papers flying off.",
}
for k, v in P.items():
    (here / f"{k}.txt").write_text(v, encoding="utf-8")
print(len(P))
