# Dorit's tarot cards for printing at true size (300 dpi): one PNG per card + A4 PDF sheets with cut lines.
#   poker = 63x88 mm (to glue onto a regular playing card), tarot = 70x120 mm (a real tarot card's size)
import pathlib, sys
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding="utf-8")
here = pathlib.Path(__file__).parent
OUT = pathlib.Path(r"C:\Users\shazbak\Downloads\דורית-בחירות\tarot-print")
DPI = 300
mm = lambda v: round(v / 25.4 * DPI)
CARDS = ["pundit", "conjunction", "venus", "farewell", "clash", "tower", "wheel", "israel", "sevenswords", "fourcups", "bibi-b", "gadi-a", "bennett-b", "lapid-b"]
A4 = (mm(210), mm(297))
GAP = mm(3)


def fitted(name, w, h):
    card = Image.open(here / "final" / f"{name}.png").convert("RGBA")
    edge = (238, 227, 199)                                       # card cream fills the spare room
    s = min(w / card.width, h / card.height)
    c = card.resize((round(card.width * s), round(card.height * s)), Image.LANCZOS)
    bg = Image.new("RGBA", (w, h), edge + (255,))
    bg.alpha_composite(c, ((w - c.width) // 2, (h - c.height) // 2))
    return bg.convert("RGB")


for kind, (cw, ch) in {"poker-63x88mm": (63, 88), "tarot-70x120mm": (70, 120)}.items():
    w, h = mm(cw), mm(ch)
    d = OUT / kind
    d.mkdir(parents=True, exist_ok=True)
    cols = (A4[0] + GAP) // (w + GAP)
    rows = (A4[1] + GAP) // (h + GAP)
    per = cols * rows
    x0 = (A4[0] - cols * w - (cols - 1) * GAP) // 2
    y0 = (A4[1] - rows * h - (rows - 1) * GAP) // 2
    pages = []
    for i, name in enumerate(CARDS):
        im = fitted(name, w, h)
        im.save(d / f"{name}.png", dpi=(DPI, DPI))
        if i % per == 0:
            pages.append(Image.new("RGB", A4, "white"))
        pg, k = pages[-1], i % per
        x, y = x0 + (k % cols) * (w + GAP), y0 + (k // cols) * (h + GAP)
        pg.paste(im, (x, y))
        ImageDraw.Draw(pg).rectangle([x - 1, y - 1, x + w, y + h], outline=(150, 150, 150), width=1)   # the cut line
    pages[0].save(OUT / f"dorit-tarot-{kind}-A4.pdf", save_all=True, append_images=pages[1:], resolution=DPI)
    print(kind, f"{w}x{h}px", f"{per} per A4 page,", len(pages), "pages")
