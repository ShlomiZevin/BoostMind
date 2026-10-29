# Dorit's book cover for printing at true size (300 dpi), to glue onto a real book: a JPG per size + an A4 PDF with
# a cut line. Both sizes are 2:3 like the cover: 14x21 cm (the usual Israeli paperback) and 6x9 inch (trade paperback).
import pathlib, sys
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding="utf-8")
here = pathlib.Path(__file__).parent
OUT = pathlib.Path(r"C:\Users\shazbak\Downloads\דורית-בחירות\book-print")
OUT.mkdir(parents=True, exist_ok=True)
DPI = 300
mm = lambda v: round(v / 25.4 * DPI)
A4 = (mm(210), mm(297))
src = Image.open(here / "cover-2x.png").convert("RGB")
for name, (w_mm, h_mm) in {"14x21cm": (140, 210), "6x9inch": (152.4, 228.6)}.items():
    w, h = mm(w_mm), mm(h_mm)
    im = src.resize((w, h), Image.LANCZOS)
    im.save(OUT / f"dorit-book-cover-{name}.jpg", quality=95, dpi=(DPI, DPI))
    page = Image.new("RGB", A4, "white")
    x, y = (A4[0] - w) // 2, (A4[1] - h) // 2
    page.paste(im, (x, y))
    ImageDraw.Draw(page).rectangle([x - 1, y - 1, x + w, y + h], outline=(150, 150, 150), width=1)
    page.save(OUT / f"dorit-book-cover-{name}-A4.pdf", resolution=DPI)
    print(name, f"{w}x{h}px")
