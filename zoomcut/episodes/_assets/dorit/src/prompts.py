# Leonardo prompts for Dorit Mercury (dorit-1): one .txt per picture, run by gen.sh
import pathlib
here = pathlib.Path(__file__).parent

CLIP = ("Cheap glossy 3D clip-art in the style of a 2005 PowerPoint presentation made by an enthusiastic aunt - "
        "bright saturated colours, shiny bevels, a little cheesy. Centred, filling most of the frame, on a plain flat "
        "light-mint (#CDEBDD) background, no shadow on the background, no border. No text, no letters, no numbers, no words. ")

P = {
  "set": ("A real photograph of an ordinary Israeli astrologer's home office in a Ra'anana apartment that she has dressed up "
          "as her own TV 'election night studio'. Vertical frame, shot straight on from seated eye height, the middle and "
          "lower part of the frame is empty space where a person will sit (a plain beige wall there, nothing important). "
          "Upper part of the wall: a huge printed astrological natal chart wheel (12 houses, planet glyphs, no letters) "
          "mounted like a TV studio screen, lit by two cheap LED panel lights on stands at the sides. On the right a "
          "flip-chart easel with abstract hand-drawn red and blue marker arrows and circles. On the left a side table with a "
          "lace doily and a glass crystal ball, a potted monstera, a shelf of astrology books with blank spines. Warm "
          "afternoon window light, beige walls, slightly cluttered, very ordinary middle-class Israeli apartment. Nobody in "
          "the shot. No text, no letters, no logos, no numbers."),
  "portrait": ("A tacky 'professional' portrait of the person in the reference photo as a senior Israeli astrologer and "
          "numerologist - keep the same face, the same short curly messy brown hair, the same bold eyebrows, big eyes and "
          "round face. Head and shoulders, chin up, a confident know-it-all look straight into the lens with one eyebrow "
          "raised, holding reading glasses up in one hand like a professor. A loud purple blouse, a gold scarf printed with "
          "zodiac signs, big gold hoop earrings and a chunky gold Taurus pendant. Background: a cheap dark-blue photo "
          "backdrop printed with stars and a big zodiac wheel. Looks like a 2012 local-newspaper advert photo: direct flash, "
          "over-sharpened, over-saturated. No text, no watermark."),
  "logo": ("A cheap self-made business logo emblem for an astrologer: a round purple badge with a gold zodiac wheel ring "
          "around it, the planet Mercury symbol in the centre inside a crescent moon, little gold stars and a tiny crystal "
          "ball at the bottom. Glossy 2010 clip-art style with a heavy bevel and shine. Centred on a plain flat light-mint "
          "(#CDEBDD) background. No text, no letters, no words."),
  "polls": CLIP + "A TV-news style vertical bar chart of election polls (coloured bars only, no numbers, no labels), with a huge thick red hand-drawn marker X scribbled across the whole chart.",
  "conjunction": CLIP + "Two cartoon planets with cute faces hugging tightly cheek to cheek: Saturn (golden, with its rings) and Neptune (deep blue), little hearts and stars around them.",
  "house10": CLIP + "An astrological natal chart wheel divided into 12 equal segments with planet glyphs, the one segment at the top coloured bright red and circled twice with a thick hand-drawn red marker, a red marker arrow pointing at it.",
  "libra": CLIP + "Golden balance scales with two pans, tipping slightly to one side, a little sparkle on the gold.",
  "venus": CLIP + "The planet Venus as a cute pink cartoon planet with a worried face, driving backwards in a tiny red car, the reversing lights on, motion lines in front of the car.",
  "farewell": ("A cheesy glittering 'good morning'-style greeting image that Israeli aunts forward on WhatsApp: a bouquet of "
          "red roses, a sunset over the sea, two white doves flying away, an open door with light, heavy glitter and "
          "sparkles everywhere, a lace frame. Square. No text, no letters, no words."),
  "bull": CLIP + "A stubborn angry cartoon bull with big horns, snorting steam from its nose, one front hoof scraping the ground, ready to charge.",
  "goat": CLIP + "A stubborn cartoon mountain goat (Capricorn) with big curved horns and a little beard, standing on its hind legs with arms crossed, wearing a small olive-green military beret, looking offended.",
  "clash": CLIP + "A cartoon bull and a cartoon mountain goat butting heads, horns locked, a yellow comic impact star between their heads; in the corner a small pale-blue ringed planet with a face (Uranus) watching them, arms crossed, offended.",
  "ball": CLIP + "A crystal ball on a gold stand, filled with thick grey storm fog, a crack across the glass, nothing visible inside, a tiny rain cloud above it.",
  "wedding": CLIP + "A wedding cake topper on the top tier of a white wedding cake: a fluffy white lamb wearing a bridal veil next to a black scorpion in a tiny tuxedo and bow tie; a huge thick red hand-drawn marker X across both of them.",
  "puzzle": CLIP + "A jigsaw puzzle that cannot be completed: mismatched pieces of different colours and shapes jammed together, gaps everywhere, one piece being forced in with a cartoon hammer, a few pieces flying off.",
  "again": CLIP + "An endless line of identical blue ballot boxes going far into the distance, and a tired cartoon desk calendar with sweat drops whose pages are flying off.",
  "israel": CLIP + "A cartoon bull wearing a blue and white superhero cape, bucking wildly on a coin-operated playground spring rider, flailing, very unstable.",
}
for k, v in P.items():
    (here / f"{k}.txt").write_text(v, encoding="utf-8")
print(len(P), "prompts")
