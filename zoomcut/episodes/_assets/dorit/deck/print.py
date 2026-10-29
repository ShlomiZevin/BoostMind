# "טארוט מרקורי" for printing at true size (300 dpi): PNG per card + A4 PDFs with cut lines.
#   poker = 63x88 mm (glued onto a regular playing card), tarot = 70x120 mm. The back is there for the other side.
import pathlib, sys
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding="utf-8")
here = pathlib.Path(__file__).parent
OUT = pathlib.Path(r"C:\Users\shazbak\Downloads\דורית-בחירות\tarot-print\טארוט-מרקורי")
DPI = 300
mm = lambda v: round(v / 25.4 * DPI)
A4 = (mm(210), mm(297))
GAP = mm(3)
FILL = (58, 11, 107)            # her deck's purple, around the card where a playing card is wider
CARDS = ["fourcups", "sevenswords", "wheel", "back"]


def fitted(name, w, h):
    card = Image.open(here / "final" / f"{name}.png").convert("RGBA")
    s = min(w / card.width, h / card.height)
    c = card.resize((round(card.width * s), round(card.height * s)), Image.LANCZOS)
    bg = Image.new("RGBA", (w, h), FILL + (255,))
    bg.alpha_composite(c, ((w - c.width) // 2, (h - c.height) // 2))
    return bg.convert("RGB")


def sheet(images, w, h, path):
    cols = (A4[0] + GAP) // (w + GAP)
    rows = (A4[1] + GAP) // (h + GAP)
    per = cols * rows
    x0 = (A4[0] - cols * w - (cols - 1) * GAP) // 2
    y0 = (A4[1] - rows * h - (rows - 1) * GAP) // 2
    pages = []
    for i, im in enumerate(images):
        if i % per == 0:
            pages.append(Image.new("RGB", A4, "white"))
        k = i % per
        x, y = x0 + (k % cols) * (w + GAP), y0 + (k // cols) * (h + GAP)
        pages[-1].paste(im, (x, y))
        ImageDraw.Draw(pages[-1]).rectangle([x - 1, y - 1, x + w, y + h], outline=(150, 150, 150), width=1)
    pages[0].save(path, save_all=True, append_images=pages[1:], resolution=DPI)


for kind, (cw, ch) in {"poker-63x88mm": (63, 88), "tarot-70x120mm": (70, 120)}.items():
    w, h = mm(cw), mm(ch)
    d = OUT / kind
    d.mkdir(parents=True, exist_ok=True)
    ims = {n: fitted(n, w, h) for n in CARDS}
    for n, im in ims.items():
        im.save(d / f"{n}.png", dpi=(DPI, DPI))
    sheet([ims[n] for n in CARDS], w, h, OUT / f"mercury-tarot-{kind}-A4.pdf")
    sheet([ims["fourcups"], ims["back"]], w, h, OUT / f"four-of-cups-front-back-{kind}-A4.pdf")
    print(kind, f"{w}x{h}px")
