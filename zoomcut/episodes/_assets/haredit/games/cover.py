# Game covers (1200x900) for /hani-games/: Shlomi's art + logo, a soft shadow under the logo so it reads on busy art
import sys
from PIL import Image, ImageFilter
def cover(art, logo, out, w, cx, top, shadow=0.55):
    a = Image.open(art).convert('RGBA'); l = Image.open(logo).convert('RGBA')
    l = l.resize((w, round(l.height * w / l.width)), Image.LANCZOS)
    x = round(cx - w / 2)
    sh = Image.new('RGBA', l.size, (20, 10, 0, 0)); sh.putalpha(l.getchannel('A').point(lambda v: int(v * shadow)))
    pad = 40; big = Image.new('RGBA', (l.width + 2 * pad, l.height + 2 * pad), (0, 0, 0, 0)); big.paste(sh, (pad, pad))
    big = big.filter(ImageFilter.GaussianBlur(14))
    a.alpha_composite(big, (x - pad, top - pad + 8)); a.alpha_composite(l, (x, top))
    a.convert('RGB').save(out, quality=88); print(out)
if __name__ == '__main__':  # the published covers (his pick, 2026-10-29: Ketoret logo top-right, Nisei on the laptop lid)
    d = sys.argv[1]
    cover(f'{d}/art-ketoret.jpg', f'{d}/logo-ketoret.png', 'public/hani-games/ketoret/cover.jpg', 600, 862, 24)
    cover(f'{d}/art-nisei.jpg', f'{d}/logo-nisei.png', 'public/hani-games/nisei-nissim/cover.jpg', 660, 638, 612)
