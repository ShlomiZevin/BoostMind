# Convert generated PNGs in web/img/queens to web-sized JPEGs (the site references .jpg).
# Usage: python scripts/optimize-images.py
from pathlib import Path
from PIL import Image
d = Path(__file__).resolve().parent.parent / 'web' / 'img' / 'queens'
for png in sorted(d.glob('*.png')):
    im = Image.open(png).convert('RGB')
    im.thumbnail((720, 1080) if 'avatar' not in png.stem else (320, 320))
    out = png.with_suffix('.jpg')
    im.save(out, 'JPEG', quality=84, optimize=True, progressive=True)
    print(f'{out.name}: {out.stat().st_size // 1024} KB')
