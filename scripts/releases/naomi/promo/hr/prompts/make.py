"""Fill the shared heads with each option's headline + direction -> prompts/story-A.txt ... cover-C.txt"""
import os
here = os.path.dirname(os.path.abspath(__file__))
H = {
    "A": '"אונבורדינג יש." on line one and "בונדינג אין." on line two',
    "B": '"דור ה־Z עוזב לכם" on line one and "אחרי שלושה שבועות?" on line two',
    "C": '"למה הקליטה" on line one and "לא מחזיקה?" on line two',
}
STORY = {
    "A": "Direction A - EDITORIAL CLEAN: a warm cream background, the headline big in deep burgundy above the video card, gold hairline accents, the stamp in gold. Minimal, premium, calm.",
    "B": "Direction B - BOLD HOOK: a deep burgundy background with a soft radial glow, the headline huge in white as the hero above the video card, the stamp gold, the kicker pill outlined in gold. Strong, confident, one clear message.",
    "C": "Direction C - MODERN CORPORATE: an off-white background with one large soft burgundy curved shape sweeping behind the lower half of the video card, the headline in deep burgundy, a small gold badge feel, crisp sans-serif type like a LinkedIn ad from a premium consultancy.",
}
PANEL = {
    "A": "a calm cream rounded panel (slightly transparent edge) spanning the width, the kicker small in gold, the headline big in deep burgundy, the gold stamp overlapping the panel's top corner, the name label small under the headline.",
    "B": "a deep burgundy band with a soft gradient fading up into the photo, the headline huge in white, the kicker in gold above it, the gold stamp overlapping the band's top edge on one side, the name label in cream.",
    "C": "the kicker on a small burgundy pill, the headline in white on a solid burgundy ribbon / label that runs across the poster, the gold stamp pinned at the ribbon's end, the name label on a thin cream strip under it.",
}
sh = open(os.path.join(here, "story-head.txt"), encoding="utf-8").read()
ch = open(os.path.join(here, "cover-head.txt"), encoding="utf-8").read()
for k in "ABC":
    open(os.path.join(here, f"story-{k}.txt"), "w", encoding="utf-8").write(sh.replace("%HEADLINE%", H[k]) + "\n" + STORY[k] + "\n")
    open(os.path.join(here, f"cover-{k}.txt"), "w", encoding="utf-8").write(ch.replace("%HEADLINE%", H[k]).replace("%PANEL%", PANEL[k]) + "\n")
