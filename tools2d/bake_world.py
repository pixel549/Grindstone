#!/usr/bin/env python3
"""Bakes the 2D hearth's world sprites into assets/2d/world.png + world.json.

Sources: LPC Revised (github.com/ElizaWy/LPC; CC-BY 3.0 / OGA-BY 3.0) for tiles and furniture, plus a few
things LPC never drew (punching bag, weights, aviary, washing line, the parrots, a lean-to...) drawn here in the
same palette. Every estate item gets six tiers: 0-3 from distinct sprites (or a shabby/plain pass over one),
4 = gilded, 5 = gilded and gem-studded.

Run:  LPCR=/path/to/ElizaWy_LPC python3 tools2d/bake_world.py  [--sheet contact.png]
"""
import colorsys, json, os, random, sys
from PIL import Image, ImageDraw, ImageFilter

E = os.environ.get('LPCR', '/home/claude/dl/ElizaWy_LPC') + '/'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', '2d')
SPR = {}   # key -> RGBA image
META = {}  # key -> extra info (e.g. anchor offsets)

GOLD = [(46, 37, 51), (109, 74, 0), (150, 102, 0), (220, 140, 53), (255, 201, 90), (255, 255, 97)]
OUTL = (36, 26, 32, 255)


def src(p, box=None):
    im = Image.open(E + p).convert('RGBA')
    return im.crop(box) if box else im


def put(key, im, **meta):
    SPR[key] = im
    if meta:
        META[key] = meta


def trim(im):
    b = im.getbbox()
    return im.crop(b) if b else im


def blank(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def square_window():
    """A square-topped 32x59 stone window; deliberately no arch or rounded crown."""
    im = blank(32, 59)
    d = ImageDraw.Draw(im)
    d.rectangle((3, 2, 28, 56), fill=OUTL)
    d.rectangle((4, 3, 27, 55), fill=(132, 134, 140))
    d.rectangle((6, 5, 25, 52), fill=(78, 80, 88))
    # Four panes and straight stone mullions.
    d.rectangle((8, 7, 14, 26), fill=(91, 145, 170))
    d.rectangle((17, 7, 23, 26), fill=(57, 105, 135))
    d.rectangle((8, 30, 14, 49), fill=(57, 105, 135))
    d.rectangle((17, 30, 23, 49), fill=(39, 77, 105))
    d.rectangle((15, 6, 16, 50), fill=(174, 174, 166))
    d.rectangle((7, 27, 24, 29), fill=(174, 174, 166))
    d.line((9, 8, 13, 8), fill=(164, 205, 216))
    d.line((9, 9, 9, 22), fill=(132, 184, 204))
    d.line((18, 8, 21, 8), fill=(116, 168, 190))
    d.line((7, 3, 26, 3), fill=(204, 205, 196))
    d.line((4, 4, 4, 53), fill=(186, 187, 180))
    d.line((27, 4, 27, 54), fill=(82, 84, 92))
    # Flat, square-cornered sill.
    d.rectangle((2, 51, 29, 57), fill=OUTL)
    d.rectangle((3, 51, 28, 54), fill=(165, 166, 160))
    d.line((3, 51, 28, 51), fill=(220, 216, 198))
    return im


def stack(*parts):
    """Compose (image, x, y) parts onto the smallest canvas holding them all."""
    W = max(x + im.width for im, x, y in parts)
    H = max(y + im.height for im, x, y in parts)
    c = blank(W, H)
    for im, x, y in parts:
        c.alpha_composite(im, (x, y))
    return c


def lum(p):
    return (0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]) / 255


def gild(im, full=False):
    """Wood, metal, stone and other dull pixels become gold; saturated fabric keeps its colour."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            woody = 0.02 <= h <= 0.14 and s < 0.75
            dull = s < 0.28
            if full or woody or dull:
                L = lum((r, g, b))
                i = min(5, int(L * 6.2))
                px[x, y] = GOLD[i] + (a,)
    return out


def gems(im, seed=1, n=None):
    """Scatter little gems (white, cyan, rose) across the opaque interior."""
    out = im.copy()
    px = out.load()
    rnd = random.Random(seed)
    spots = [(x, y) for y in range(2, out.height - 2) for x in range(2, out.width - 2)
             if px[x, y][3] and px[x - 2, y][3] and px[x + 2, y][3] and px[x, y - 2][3] and px[x, y + 2][3]]
    if not spots:
        return out
    n = n or max(3, len(spots) // 90)
    for x, y in rnd.sample(spots, min(n, len(spots))):
        col = rnd.choice([(255, 255, 255), (150, 240, 255), (255, 170, 220)])
        px[x, y] = col + (255,)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            r, g, b, a = px[x + dx, y + dy]
            px[x + dx, y + dy] = (min(255, (r + col[0]) // 2 + 30), min(255, (g + col[1]) // 2 + 30), min(255, (b + col[2]) // 2 + 30), a)
    return out


def shabby(im, seed=2, amt=0.55):
    """Faded, dirty and a little broken."""
    out = im.copy()
    px = out.load()
    rnd = random.Random(seed)
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            L = lum((r, g, b)) * 255
            r, g, b = [int(c * (1 - amt) + L * amt) for c in (r, g, b)]
            r, g, b = int(r * 0.86 + 12), int(g * 0.84 + 8), int(b * 0.78)
            px[x, y] = (r, g, b, a)
    # stains
    for _ in range(max(2, out.width * out.height // 260)):
        x, y = rnd.randrange(out.width), rnd.randrange(out.height)
        for dx in range(rnd.randint(1, 3)):
            if x + dx < out.width and px[x + dx, y][3]:
                r, g, b, a = px[x + dx, y]
                px[x + dx, y] = (int(r * 0.7), int(g * 0.66), int(b * 0.6), a)
    return out


def tint(im, rgb, amt=0.5):
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a:
                L = lum((r, g, b)) * 1.25
                px[x, y] = (int(r * (1 - amt) + rgb[0] * L * amt), int(g * (1 - amt) + rgb[1] * L * amt), int(b * (1 - amt) + rgb[2] * L * amt), a)
    return out


def recol(im, fn):
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            p = px[x, y]
            if p[3]:
                px[x, y] = fn(p)
    return out


def outline(im, col=OUTL):
    a = im.split()[3]
    grown = a.filter(ImageFilter.MaxFilter(3))
    o = Image.new('RGBA', im.size, col)
    o.putalpha(grown)
    o.alpha_composite(im)
    return o


def pad(im, l=1, t=1, r=1, b=1):
    c = blank(im.width + l + r, im.height + t + b)
    c.alpha_composite(im, (l, t))
    return c


def hflip(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)


def tiers(key, t0, t1, t2, t3, seed=3, full_gold=False):
    for i, im in enumerate((t0, t1, t2, t3)):
        put(f'{key}.{i}', im)
    g = gild(t3, full_gold)
    put(f'{key}.4', g)
    put(f'{key}.5', gems(g, seed))


# ---------------------------------------------------------------- drawing helpers (things LPC lacks)
def draw(w, h, fn):
    im = blank(w, h)
    fn(ImageDraw.Draw(im), im)
    return im


def shade_rect(d, box, base, light=None, dark=None):
    x0, y0, x1, y1 = box
    light = light or tuple(min(255, int(c * 1.25)) for c in base)
    dark = dark or tuple(int(c * 0.7) for c in base)
    d.rectangle(box, fill=base)
    d.line([(x0, y0), (x1, y0)], fill=light)
    d.line([(x0, y0), (x0, y1)], fill=light)
    d.line([(x0, y1), (x1, y1)], fill=dark)
    d.line([(x1, y0), (x1, y1)], fill=dark)


def bag(base, chain=(110, 110, 120), frame=False, sack=False):
    def f(d, im):
        if frame:
            d.rectangle((2, 2, 4, 63), fill=(60, 60, 70)); d.rectangle((25, 2, 27, 63), fill=(60, 60, 70))
            d.rectangle((2, 2, 27, 4), fill=(70, 70, 82))
        d.line([(15, 3), (15, 15)], fill=chain, width=1)
        d.line([(14, 4), (14, 14)], fill=tuple(int(c * 0.7) for c in chain))
        if sack:
            d.ellipse((7, 14, 23, 50), fill=base)
            d.polygon([(10, 16), (20, 16), (15, 11)], fill=tuple(int(c * 0.8) for c in base))
            for y in range(20, 48, 5):
                d.line([(9, y), (21, y + 1)], fill=tuple(int(c * 0.85) for c in base))
        else:
            d.rounded_rectangle((8, 14, 22, 52), radius=5, fill=base)
            d.rectangle((9, 16, 11, 50), fill=tuple(min(255, int(c * 1.3)) for c in base))
            d.rectangle((20, 16, 21, 50), fill=tuple(int(c * 0.7) for c in base))
            d.line([(8, 22), (22, 22)], fill=tuple(int(c * 0.6) for c in base))
            d.line([(8, 44), (22, 44)], fill=tuple(int(c * 0.6) for c in base))
        d.ellipse((9, 56, 21, 60), fill=(20, 14, 20, 90))
    return outline(draw(30, 64, f))


def dumbbell(d, x, y, col, bar=(150, 150, 160)):
    d.rectangle((x + 2, y + 2, x + 9, y + 3), fill=bar)
    d.rectangle((x, y, x + 2, y + 5), fill=col)
    d.rectangle((x + 9, y, x + 11, y + 5), fill=col)


def weights(tier):
    def f(d, im):
        if tier == 0:  # paint tins on a broomstick
            d.line([(2, 14), (40, 14)], fill=(150, 110, 60), width=2)
            for x in (2, 32):
                shade_rect(d, (x, 10, x + 8, 22), (200, 200, 205))
                d.rectangle((x + 1, 13, x + 7, 17), fill=(90, 140, 200))
        elif tier == 1:  # rusty dumbbells on the floor
            for i, (x, y) in enumerate(((4, 14), (20, 17), (12, 22))):
                dumbbell(d, x, y, (130, 70, 40), (140, 100, 70))
        else:  # bench + rack
            shade_rect(d, (2, 20, 40, 25), (60, 50, 70))
            d.rectangle((6, 25, 8, 30), fill=(70, 70, 80)); d.rectangle((34, 25, 36, 30), fill=(70, 70, 80))
            if tier >= 3:
                d.rectangle((44, 2, 46, 30), fill=(80, 80, 92)); d.rectangle((60, 2, 62, 30), fill=(80, 80, 92))
                d.line([(40, 8), (66, 8)], fill=(170, 170, 180), width=2)
                for x in (40, 62):
                    d.rectangle((x, 3, x + 3, 13), fill=(40, 40, 46))
                for y in (18, 24):
                    dumbbell(d, 45, y, (40, 40, 46))
            dumbbell(d, 10, 12, (50, 50, 58)); dumbbell(d, 26, 12, (50, 50, 58))
    w = 68 if tier >= 3 else 44
    return outline(draw(w, 32, f))


def cage(w, h, frame, mesh, tarp=None, roof=None):
    """Back and front halves of an aviary; the birds go between them."""
    def back(d, im):
        d.rectangle((0, 8, w - 1, h - 1), fill=(0, 0, 0, 0))
        for x in range(2, w - 2, 4):
            d.line([(x, 10), (x, h - 10)], fill=mesh + (130,))
        for y in range(10, h - 10, 4):
            d.line([(2, y), (w - 3, y)], fill=mesh + (110,))
        d.rectangle((2, h - 12, w - 3, h - 4), fill=(120, 100, 70))  # floor tray
        d.line([(4, h - 22), (w - 5, h - 22)], fill=(110, 80, 50), width=2)  # perch
        d.line([(6, h - 34), (w // 2, h - 34)], fill=(110, 80, 50), width=2)
        d.rectangle((0, 8, 2, h - 1), fill=frame); d.rectangle((w - 3, 8, w - 1, h - 1), fill=frame)
        d.rectangle((0, 8, w - 1, 10), fill=frame)
        if roof:
            d.polygon([(0, 9), (w // 2, 0), (w - 1, 9)], fill=roof)
    def front(d, im):
        for x in range(1, w - 1, 4):
            d.line([(x, 14), (x, h - 2)], fill=mesh + (150,))
        d.rectangle((0, h - 3, w - 1, h - 1), fill=frame)
        d.rectangle((0, 8, 1, h - 1), fill=frame); d.rectangle((w - 2, 8, w - 1, h - 1), fill=frame)
        if tarp:
            d.polygon([(0, 8), (w - 1, 8), (w - 1, h // 2), (w // 2, h // 2 + 6), (0, h // 3)], fill=tarp + (235,))
    return draw(w, h, back), draw(w, h, front)


def parrot(body, wing, belly, beak, frame):
    """An eclectus, 10x12. frame 0 perched, 1 wings up."""
    def f(d, im):
        if frame == 1:
            d.polygon([(1, 2), (4, 5), (2, 7)], fill=wing); d.polygon([(9, 2), (6, 5), (8, 7)], fill=wing)
        d.ellipse((3, 1, 7, 5), fill=body)   # head
        d.ellipse((2, 4, 8, 10), fill=body)  # body
        d.rectangle((4, 6, 6, 9), fill=belly)
        d.point((6, 3), fill=beak); d.point((7, 3), fill=beak); d.point((5, 2), fill=(20, 20, 20))
        d.line([(4, 10), (5, 11)], fill=wing); d.line([(6, 10), (6, 11)], fill=wing)
    return outline(draw(10, 12, f), (30, 20, 25, 255))


def washer():
    def f(d, im):
        shade_rect(d, (1, 4, 26, 34), (228, 230, 235))
        d.rectangle((1, 4, 26, 9), fill=(205, 208, 215))
        d.ellipse((6, 13, 21, 28), fill=(90, 100, 120)); d.ellipse((8, 15, 19, 26), fill=(120, 170, 220))
        d.rectangle((19, 6, 23, 7), fill=(80, 200, 120))
    return outline(draw(28, 36, f))


def washing_line(clothes):
    def f(d, im):
        d.rectangle((1, 6, 3, 40), fill=(120, 90, 60)); d.rectangle((92, 6, 94, 40), fill=(120, 90, 60))
        d.line([(2, 8), (93, 8)], fill=(220, 220, 220))
        for i, (col, wd, ht) in enumerate(clothes):
            x = 10 + i * 20
            d.rectangle((x, 9, x + wd, 9 + ht), fill=col)
            d.rectangle((x, 9, x + wd, 10), fill=tuple(min(255, int(c * 1.2)) for c in col))
            d.point((x + 1, 8), fill=(250, 250, 250)); d.point((x + wd - 1, 8), fill=(250, 250, 250))
    return outline(draw(96, 44, f))


def folding(book=False):
    def f(d, im):
        shade_rect(d, (0, 2, 41, 12), (170, 175, 185))
        for x in (3, 37):
            d.line([(x, 12), (x - 2, 22)], fill=(110, 110, 120)); d.line([(x + 1, 12), (x + 3, 22)], fill=(110, 110, 120))
        if book:
            d.rectangle((14, 0, 26, 5), fill=(140, 40, 40)); d.line([(15, 1), (25, 1)], fill=(240, 230, 210))
    return outline(draw(42, 24, f))


def esky():
    def f(d, im):
        shade_rect(d, (1, 6, 28, 22), (230, 232, 236))
        shade_rect(d, (0, 2, 29, 7), (40, 110, 190))
        d.rectangle((10, 0, 19, 2), fill=(240, 240, 240))
    return outline(draw(30, 24, f))


def leanto(w, h, roof, post=(110, 80, 50)):
    def f(d, im):
        d.polygon([(0, 10), (w - 1, 2), (w - 1, 12), (0, 20)], fill=roof)
        for x in range(0, w, 6):
            d.line([(x, 10 - x * 8 // w), (x, 20 - x * 8 // w)], fill=tuple(int(c * 0.8) for c in roof))
        d.rectangle((2, 16, 4, h - 1), fill=post); d.rectangle((w - 5, 8, w - 3, h - 1), fill=post)
    return outline(draw(w, h, f))


def tower(tier):
    stone = [(130, 100, 70), (150, 115, 80), (150, 145, 140), (140, 135, 130)][min(tier, 3)]
    w, h = 64, 128
    def f(d, im):
        if tier <= 1:  # timber platform / lookout
            for x in (6, 52):
                d.rectangle((x, 30, x + 5, h - 2), fill=(115, 85, 55))
            for y in range(40, h - 6, 16):
                d.line([(8, y), (54, y + 10)], fill=(95, 70, 45), width=2)
            shade_rect(d, (0, 22, 63, 32), (150, 110, 70))
            if tier == 1:
                d.polygon([(0, 22), (32, 2), (63, 22)], fill=(120, 60, 40))
        else:
            shade_rect(d, (8, 24, 55, h - 2), stone)
            for y in range(28, h - 4, 8):
                for x in range(10 + (y // 8 % 2) * 6, 54, 12):
                    d.rectangle((x, y, x + 10, y + 6), outline=tuple(int(c * 0.75) for c in stone))
            for x in range(4, 60, 10):
                shade_rect(d, (x, 10, x + 6, 22), stone)
            shade_rect(d, (4, 18, 59, 26), stone)
            d.rectangle((26, 48, 37, 60), fill=(30, 25, 30))
            if tier >= 3:
                d.line([(32, 0), (32, 12)], fill=(90, 70, 50))
                d.polygon([(33, 1), (46, 4), (33, 8)], fill=(170, 30, 40))
    return outline(draw(w, h, f))


def pool_round(w, h, rim, water=(70, 170, 210)):
    def f(d, im):
        d.ellipse((0, 0, w - 1, h - 1), fill=rim)
        d.ellipse((3, 3, w - 4, h - 4), fill=water)
        d.arc((6, 5, w - 8, h - 8), 200, 280, fill=(200, 240, 255))
    return outline(draw(w, h, f))


def pond(w, h, edge=(120, 110, 100), water=(50, 120, 140), fish=1, rocks=False, lilies=False):
    rnd = random.Random(w * h)
    def f(d, im):
        d.ellipse((0, 2, w - 1, h - 1), fill=edge)
        d.ellipse((3, 4, w - 4, h - 4), fill=water)
        for i in range(fish):
            x, y = rnd.randrange(8, w - 12), rnd.randrange(8, h - 8)
            d.ellipse((x, y, x + 5, y + 2), fill=(240, 140, 40)); d.point((x + 6, y + 1), fill=(240, 140, 40))
        if lilies:
            for i in range(3):
                x, y = rnd.randrange(6, w - 10), rnd.randrange(6, h - 8)
                d.ellipse((x, y, x + 6, y + 4), fill=(70, 140, 60))
        if rocks:
            for x in (2, w - 10):
                d.ellipse((x, 0, x + 9, 7), fill=(150, 150, 150))
    return outline(draw(w, h, f))


def cobweb():
    def f(d, im):
        c = (230, 230, 240, 170)
        d.line([(0, 0), (12, 12)], fill=c); d.line([(0, 0), (14, 4)], fill=c); d.line([(0, 0), (4, 14)], fill=c)
        d.arc((-6, -6, 10, 10), 0, 90, fill=c); d.arc((-10, -10, 16, 16), 0, 90, fill=c)
    return draw(16, 16, f)


def pile(cols, n, seed=4):
    rnd = random.Random(seed)
    w = 14 + n * 4
    def f(d, im):
        for i in range(n * 3):
            x, y = rnd.randrange(0, w - 10), rnd.randrange(max(0, 10 - n), 14)
            c = rnd.choice(cols)
            d.ellipse((x, y, x + 9, y + 5), fill=c)
    return outline(draw(w, 20, f))


def dishes(n, seed=5):
    rnd = random.Random(seed)
    def f(d, im):
        for i in range(n):
            x = 2 + (i % 4) * 6 + rnd.randrange(0, 2)
            h = 2 + (i // 4) * 3
            for k in range(rnd.randint(2, 4)):
                y = 14 - h - k * 2
                d.ellipse((x, y, x + 7, y + 3), fill=(236, 236, 228)); d.line([(x + 1, y + 2), (x + 6, y + 2)], fill=(190, 190, 185))
            if n > 8 and i % 3 == 0:
                d.point((x + 3, 14 - h - 1), fill=(120, 150, 60))
    return outline(draw(30, 18, f))


def droppings(n, seed=6):
    rnd = random.Random(seed)
    def f(d, im):
        for i in range(n):
            x, y = rnd.randrange(0, 30), rnd.randrange(0, 8)
            d.point((x, y), fill=(245, 245, 240)); d.point((x + 1, y), fill=(200, 200, 190))
    return draw(32, 10, f)


def bubble():
    def f(d, im):
        d.rounded_rectangle((0, 0, 37, 21), radius=8, fill=(250, 246, 236), outline=(60, 50, 50))
        d.ellipse((12, 22, 17, 26), fill=(250, 246, 236), outline=(60, 50, 50))
        d.ellipse((9, 27, 12, 30), fill=(250, 246, 236), outline=(60, 50, 50))
    return draw(38, 31, f)


def stones(n=3, seed=7):
    rnd = random.Random(seed)
    def f(d, im):
        for i in range(n):
            x, y = rnd.randrange(0, 18), i * 10 + rnd.randrange(0, 3)
            d.ellipse((x, y, x + 12, y + 7), fill=(150, 145, 135)); d.arc((x, y, x + 12, y + 7), 180, 300, fill=(185, 180, 170))
    return outline(draw(32, 32, f))


def fence_seg(col, posts=True, broken=False, cap=None):
    def f(d, im):
        dark = tuple(int(c * 0.7) for c in col)
        d.line([(0, 10), (31, 10)], fill=col, width=2); d.line([(0, 20), (31, 20)], fill=col, width=2)
        if broken:
            d.line([(14, 20), (31, 26)], fill=col, width=2)
        for x in (2, 12, 22) if posts else (2,):
            if broken and x == 12:
                continue
            d.rectangle((x, 4, x + 4, 28), fill=col); d.line([(x + 4, 4), (x + 4, 28)], fill=dark)
            d.polygon([(x, 4), (x + 2, 1), (x + 4, 4)], fill=cap or col)
    return outline(draw(32, 30, f))


def chandelier(gold=(220, 170, 60)):
    def f(d, im):
        d.line([(16, 0), (16, 8)], fill=(90, 80, 70))
        d.ellipse((4, 8, 28, 16), outline=gold)
        for x in (4, 10, 16, 22, 28):
            d.rectangle((x - 1, 4, x, 9), fill=(245, 240, 220)); d.point((x, 2), fill=(255, 210, 90)); d.point((x, 3), fill=(255, 150, 50))
    return outline(draw(32, 18, f))


def painttins():
    def f(d, im):
        for x, c in ((1, (200, 60, 50)), (10, (60, 120, 200))):
            shade_rect(d, (x, 4, x + 7, 13), (205, 205, 210)); d.rectangle((x + 1, 6, x + 6, 9), fill=c)
        d.polygon([(18, 13), (30, 9), (31, 13)], fill=(220, 220, 200))
    return outline(draw(32, 15, f))


# ---------------------------------------------------------------- tiles
def tiles():
    # floors: concrete, lino, boards, parquet, marble, gold
    concrete = src('Structure/Floor/Tile B.png', (32, 64, 64, 96))
    concrete = shabby(concrete, 11, 0.6)
    put('floor.0', concrete)
    put('floor.1', src('Structure/Floor/Tile A.png', (0, 0, 32, 32)))
    put('floor.2', src('Structure/Floor/Wood Floor A.png', (32, 0, 64, 96)))
    put('floor.3', src('Structure/Floor/Herringbone A.png', (64, 0, 96, 96)))
    put('floor.4', src('Structure/Floor/Diamond Tile A.png', (0, 0, 32, 32)))
    put('floor.5', gems(gild(src('Structure/Floor/Diamond Tile A.png', (192, 0, 224, 32)), True), 9, 2))
    put('floor.dirt', src('Structure/Floor/Gritty Dirt.png', (0, 0, 32, 32)))
    put('floor.rubber', src('Structure/Floor/Tile B.png', (64, 96, 96, 128)))
    put('floor.timber', src('Structure/Floor/Wood Floor A.png', (0, 0, 32, 96)))
    # wall faces, 32 x 64 (trim, face, skirting)
    def face(tex, trim=(74, 52, 46), skirt=(74, 52, 46), panel=None, cracks=False):
        c = blank(32, 64)
        for y in range(0, 64, tex.height):
            c.alpha_composite(tex, (0, y))
        d = ImageDraw.Draw(c)
        if cracks:
            d.line([(6, 14), (9, 22), (7, 30)], fill=(150, 140, 130)); d.line([(22, 36), (26, 44)], fill=(150, 140, 130))
        if panel is not None:
            c.alpha_composite(panel, (0, 64 - panel.height))
        d.rectangle((0, 0, 31, 2), fill=trim); d.line([(0, 3), (31, 3)], fill=tuple(int(v * 0.7) for v in trim))
        d.rectangle((0, 61, 31, 63), fill=skirt)
        return c
    plaster = src('Structure/Walls/Grainy Plain Wall.png', (96, 8, 128, 40))
    put('wall.0', shabby(face(plaster, cracks=True), 12, 0.3))
    paint = src('Structure/Walls/Painted Walls.png', (1056 + 32, 8, 1088 + 32, 40))
    put('wall.1', face(paint))
    pan = src('Structure/Walls/Half-Wall Paneling A.png', (0, 32, 32, 64))
    put('wall.2', face(paint, panel=pan))
    stripe = src('Structure/Walls/Striped Wallpaper A.png', (960 + 32, 8, 992 + 32, 40))
    stripe = tint(stripe, (150, 30, 40), 0.65)
    dpan = src('Structure/Walls/Half-Wall Paneling A.png', (0, 0, 32, 32))
    put('wall.3', face(stripe, trim=(170, 130, 60), skirt=(170, 130, 60), panel=dpan))
    marble = src('Structure/Walls/Diamond Wallpaper.png', (32, 8, 64, 40))
    put('wall.4', face(marble, trim=GOLD[4], skirt=GOLD[3], panel=gild(pan, True)))
    put('wall.5', gems(face(marble, trim=GOLD[5], skirt=GOLD[4], panel=gild(pan, True)), 13, 6))
    put('wall.brick', face(src('Structure/Walls/Brick Wall A.png', (96, 96, 128, 128)), trim=(90, 60, 50), skirt=(90, 60, 50)))
    put('wall.stone', face(src('Structure/Walls/Jagged Stone Walls.png', (128, 8, 160, 40))))
    siding = src('Structure/Walls/Siding, Plain.png', (32, 8, 64, 40))
    put('wall.timber', face(siding))
    put('wall.tin', face(recol(siding, lambda p: (int(lum(p) * 190) + 20, int(lum(p) * 195) + 22, int(lum(p) * 205) + 28, p[3]))))
    # outdoors, by season (terrain sheets share a layout)
    for season in ('spring', 'summer', 'autumn', 'winter'):
        t = src(f'Terrain/terrain_{season}.png')
        for i in range(3):
            put(f'grass.{season}.{i}', t.crop((96 + i * 32, 32, 128 + i * 32, 64)))
        put(f'dirt.{season}', t.crop((96, 96, 128, 128)))
        put(f'water.{season}', t.crop((416, 512, 448, 544)))
        p = src(f'Terrain/plants_{season}.png')
        put(f'tuft.{season}.0', trim(p.crop((256, 32, 288, 64))))
        put(f'tuft.{season}.1', trim(p.crop((288, 0, 320, 64))))
        put(f'tuft.{season}.2', trim(p.crop((352, 0, 384, 64))))
        put(f'tuft.{season}.3', trim(p.crop((416, 0, 448, 64))))
        put(f'bush.{season}', trim(p.crop((64, 0, 96, 32))))
        put(f'fern.{season}', trim(p.crop((96, 64, 160, 128))))
        tr = src(f'Terrain/trees_{season}.png')
        put(f'tree.{season}', trim(tr.crop((128, 0, 224, 144))))
        wf = src(f'Terrain/wildflowers_{season}.png')
        put(f'flower.{season}.0', trim(wf.crop((0, 0, 16, 16))))
        put(f'flower.{season}.1', trim(wf.crop((16, 32, 32, 48))))
    put('treeshadow', trim(src('Terrain/trees_spring.png', (0, 0, 96, 64))))
    put('soil', src('Terrain/tilled_soil.png', (0, 0, 96, 96)))
    put('stones', stones())


# ---------------------------------------------------------------- furniture & fittings
def furniture():
    F = 'Objects/Furniture/'
    S = 'Objects/Small Items/'
    crate = src(F + 'Crate.png', (0, 0, 32, 32))
    # --- kitchen
    fridge = src(F + 'Fridge.png', (0, 0, 32, 64))
    tiers('fridge', esky(), trim(src(F + 'Fridge.png', (0, 26, 32, 64))), fridge, stack((fridge, 0, 0), (hflip(fridge), 30, 0)), 21)
    oven = src(F + 'Oven, Modern.png', (0, 0, 32, 64))
    pot = trim(src(S + 'Buckets.png', (5, 5, 26, 29)))
    burner = stack((crate, 0, 8), (src(S + 'Kitchen Clutter A.png', (133, 38, 155, 59)), 5, 0))
    tiers('stove', burner, shabby(oven, 22), oven, stack((oven, 0, 0), (oven, 32, 0)), 22)
    counter = stack((src(F + 'Countertop.png', (64, 140, 96, 160)), 0, 0), (src(F + 'Countertop.png', (64, 160, 96, 176)), 0, 20))
    put('counter', counter)
    put('counter.dish', stack((src(F + 'Countertop.png', (64, 140, 96, 160)), 0, 0), (src(F + 'Countertop.png', (64, 192, 96, 208)), 0, 20)))
    sinkA = src(F + 'Sink, Countertop.png', (0, 0, 32, 32))
    basin = src(F + 'Sink, Countertop.png', (32, 0, 64, 32))
    inset = src(F + 'Sink, Countertop.png', (0, 32, 32, 64))
    crates = stack((crate, 0, 10), (pot, 6, 0))
    bowl = trim(inset)
    tap = trim(sinkA)
    tiers('sink', crates, stack((shabby(counter, 23), 0, 0), (shabby(bowl, 24), (32 - bowl.width) // 2, 2)),
          stack((counter, 0, 0), (bowl, (32 - bowl.width) // 2, 2)),
          stack((counter, 0, 0), (counter, 32, 0), (trim(basin), 16, -4)), 23)
    # dining table + chairs
    camp = folding()
    wob = shabby(trim(src(F + 'Table, Ornate Wood.png', (0, 32, 64, 64))), 25)
    kt = trim(src(F + 'Table, Rough Wood.png', (8, 22, 88, 64)))
    farm = stack((trim(src(F + 'Table, Rough Wood.png', (8, 86, 88, 128))), 0, 6), (trim(src(F + 'Lighting, Floor.png', (64, 0, 96, 64))).crop((8, 0, 24, 18)), 32, 0))
    tiers('ktable', camp, wob, kt, farm, 24)
    put('dishshelf', src(F + 'Cabinet.png', (32, 96, 64, 192)))
    put('bookshelf', src(F + 'Cabinet.png', (64, 96, 128, 192)))
    put('bookshelf.small', src(F + 'Cabinet.png', (64, 96, 96, 192)))
    # --- lounge
    sofa = lambda x, y: trim(src(F + 'Seating/Sofa, Casual A.png', (x, y, x + 96, y + 32)))
    back_g, back_b, back_n = sofa(0, 64), sofa(320, 64), sofa(160, 192)
    put('sofa.front', sofa(0, 16))
    chester = trim(src(F + 'Seating/Loveseat, Small - Formal A.png', (64, 129, 128, 160)))
    tiers('couch', shabby(sofa(320, 192), 31, 0.7), sofa(320, 192), back_b, stack((chester, 0, 0), (chester, 60, 0)), 31)
    arm = lambda x, y: trim(src(F + 'Seating/Chair, Sofa A.png', (x, y, x + 32, y + 32)))
    tiers('armchair', trim(src(F + 'Seating/Chair, Dining B.png', (192, 0, 224, 32))), shabby(arm(0, 128), 32), arm(0, 64), trim(src(F + 'Seating/Chair, Sofa C.png', (0, 64, 32, 96))), 32)
    put('throne', trim(src(F + 'Seating/Thrones.png', (1, 85, 31, 160))))
    end = lambda x, y: trim(src(F + 'End Table.png', (x, y, x + 32, y + 32)))
    drum = trim(src(F + 'Barrel.png', (2, 10, 30, 47)))
    tiers('ctable', drum, end(0, 0), trim(src(F + 'Table, Ornate Wood.png', (0, 32, 64, 64))), trim(src(F + 'Table, Ornate Wood.png', (0, 0, 32, 32))), 33)
    put('fireplace', trim(src(F + 'Fireplace.png', (6, 112, 90, 190))))
    for i in range(3):
        put(f'fire.{i}', trim(src(S + 'Fire, Fireplace.png', (i * 32, 72, i * 32 + 32, 100))))
    rug = src(F + 'Rugs/Swirling Vine Rug.png', (0, 64, 160, 128))
    rug = recol(rug, lambda p: (int(p[0] * .72), int(p[1] * .48), int(p[2] * .42), p[3]))
    put('rug', rug)
    put('painting.0', trim(src('Objects/Wall Items/Paintings, Landscape.png', (0, 64, 96, 96))))
    put('painting.1', trim(src('Objects/Wall Items/Paintings, Landscape.png', (64, 0, 128, 32))))
    put('painting.2', trim(src('Objects/Wall Items/Paintings, Landscape.png', (0, 0, 32, 32))))
    put('plant.0', trim(src(F + 'Planter.png', (64, 0, 96, 96))))
    put('plant.1', trim(src(F + 'Planter.png', (128, 0, 160, 96))))
    put('lamp', trim(src(F + 'Lighting, Floor.png', (0, 64, 32, 128))))
    put('candelabra', trim(src(F + 'Lighting, Floor.png', (64, 0, 96, 64))))
    put('chandelier', chandelier())
    put('ladder', trim(src(F + 'Ladder.png', (32, 0, 96, 96))))
    put('painttins', painttins())
    put('clock', trim(src(F + 'Clock, Grandfather.png', (0, 0, 32, 96))))
    put('window', square_window())
    put('torch', trim(src('Objects/Wall Items/Lighting, Wall.png', (72, 20, 88, 60))))
    put('walllamp', trim(src('Objects/Wall Items/Lighting, Wall.png', (4, 2, 28, 34))))
    put('curtains', trim(src('Objects/Wall Items/Curtains.png', (0, 32, 192, 96))))
    # --- bedroom
    pallet = trim(src(F + 'Beds/Single Beds B.png', (6, 23, 58, 98)))
    single = trim(src(F + 'Beds/Single Beds B.png', (259, 6, 315, 98)))
    singleR = trim(src(F + 'Beds/Single Beds B.png', (0, 224 + 6, 64, 224 + 98)))
    double = stack((single, 0, 0), (single, single.width - 10, 0))
    poster = double.copy()
    d = ImageDraw.Draw(poster)
    for x in (0, poster.width - 4):
        d.rectangle((x, 0, x + 3, poster.height - 1), fill=(110, 60, 40))
    d.rectangle((0, 0, poster.width - 1, 5), fill=(140, 30, 40))
    tiers('bed', pallet, single, double, outline(poster), 41)
    boxes = stack((trim(src(S + 'Boxes.png', (32, 0, 64, 32))), 0, 14), (trim(src(S + 'Boxes.png', (32, 32, 64, 64))), 18, 22), (trim(src(S + 'Boxes.png', (32, 0, 64, 32))), 6, 0))
    tall = trim(src(F + 'Countertop.png', (0, 0, 32, 128)))
    dresser = trim(src(F + 'Dresser.png', (32, 0, 64, 64)))
    tiers('wardrobe', boxes, dresser, trim(src(F + 'Cabinet.png', (0, 0, 32, 64))), trim(src(F + 'Desk, Office.png', (192, 0, 256, 96))), 42)
    tiers('bedside', crate, end(0, 64), end(0, 128), stack((end(0, 160), 0, 12), (trim(src(S + 'Lighting, Table.png', (4, 0, 28, 31))), 4, 0)), 43)
    put('basket', trim(src(S + 'Baskets A.png', (1, 2, 31, 25))))
    for i, n in enumerate((1, 3, 6)):
        put(f'clothespile.{i}', pile([(200, 80, 70), (80, 110, 170), (230, 230, 220), (90, 140, 90), (160, 140, 110)], n, 40 + i))
    put('washer', washer())
    put('mirror', trim(src(F + 'Mirror, Standing.png', (14, 2, 53, 64))))
    # --- study & gym
    planks = stack((crate, 0, 12), (crate, 44, 12), (trim(src(F + 'Table, Rough Wood.png', (8, 150, 88, 192))), 0, 0))
    tiers('desk', planks, folding(True), trim(src(F + 'Desk, Office.png', (128, 80, 192, 128))), trim(src(F + 'Desk, Office.png', (0, 0, 128, 64))), 51)
    put('deskchair', trim(src(F + 'Seating/Chair, Office.png', (0, 0, 32, 32))))
    tiers('bag', bag((150, 120, 80), sack=True), bag((110, 50, 45)), bag((170, 40, 40)), bag((40, 40, 46), frame=True), 52)
    tiers('weights', weights(0), weights(1), weights(2), weights(3), 53)
    put('cobweb', cobweb())
    # --- kitchen extras
    for i, n in enumerate((0, 5, 12)):
        put(f'dishes.{i}', dishes(max(1, n), 60 + i))
    # --- yard
    av = [((90, 80, 70), (120, 120, 120), (60, 80, 120)), ((70, 70, 80), (170, 170, 180), None), ((60, 70, 60), (160, 170, 160), None), ((120, 80, 50), (190, 170, 140), None)]
    sizes = [(40, 48), (48, 56), (96, 72), (112, 80)]
    for i in range(6):
        k = min(i, 3)
        fr, me, tp = av[k]
        w, h = sizes[k]
        b, f = cage(w, h, fr, me, tp, roof=(120, 50, 40) if k == 3 else None)
        if i >= 4:
            b, f = gild(b, True), gild(f, True)
            if i == 5:
                b = gems(b, 70, 12)
        put(f'aviary.{i}.b', b); put(f'aviary.{i}.f', f)
    for fr in range(2):
        put(f'ruby.{fr}', parrot((200, 30, 40), (150, 20, 30), (90, 60, 160), (20, 20, 20), fr))
        put(f'kermit.{fr}', parrot((60, 170, 60), (40, 120, 50), (60, 170, 60), (240, 150, 40), fr))
    for i, n in enumerate((0, 8, 22)):
        put(f'droppings.{i}', droppings(max(1, n), 70 + i))
    put('seedtray', outline(draw(12, 6, lambda d, im: (d.ellipse((0, 0, 11, 5), fill=(150, 110, 70)), d.ellipse((2, 1, 9, 3), fill=(220, 190, 110))))))
    put('line', washing_line([((200, 70, 70), 8, 12), ((90, 120, 200), 10, 16), ((240, 240, 230), 8, 10), ((90, 150, 90), 12, 14)]))
    put('line.empty', washing_line([]))
    put('fence.broken', fence_seg((130, 100, 70), broken=True))
    put('fence.wood', fence_seg((140, 105, 70)))
    put('fence.picket', fence_seg((240, 240, 235)))
    put('fence.gold', fence_seg((240, 240, 235), cap=GOLD[4]))
    put('fence.golden', gems(gild(fence_seg((200, 200, 200)), True), 80, 2))
    put('gardenlamp', trim(src(F + 'Lighting, Outdoors.png', (0, 0, 32, 96))))
    put('hedge', trim(src('Terrain/plants_spring.png', (0, 64, 32, 128))))
    put('rock', trim(src('Terrain/Rocks, Grasslands.png', (128, 32, 160, 64))))
    put('sign', outline(draw(24, 30, lambda d, im: (d.rectangle((10, 12, 13, 29), fill=(110, 80, 50)), shade_rect(d, (0, 2, 23, 13), (220, 200, 150)), d.text((3, 2), 'SALE', fill=(150, 40, 30))))))
    put('mat', outline(draw(30, 14, lambda d, im: (d.rectangle((0, 0, 29, 13), fill=(140, 90, 50)), d.rectangle((3, 3, 26, 10), outline=(170, 120, 70))))))
    put('bubble', bubble())
    # --- wings
    tiers('garage', leanto(96, 64, (150, 150, 155)), leanto(96, 64, (180, 185, 190)), leanto(96, 64, (160, 80, 60)), leanto(96, 64, (60, 60, 70)), 90)
    tiers('shed', leanto(80, 56, (120, 100, 70)), leanto(80, 56, (170, 175, 180)), leanto(80, 56, (140, 100, 60)), leanto(80, 56, (110, 60, 40)), 91)
    put('workbench', trim(src(F + 'Workbench, Carpentry.png', (0, 0, 96, 64))))
    put('sawhorse', trim(src(F + 'Sawhorse.png', (0, 0, 32, 32))))
    put('lumber', trim(src(S + 'Lumber.png', (130, 10, 159, 31))))
    pa = src('Structure/Misc/Pool A.png')
    resort = stack((pa, 0, 0), (pa, 64, 0))
    d = ImageDraw.Draw(resort)
    tiers('pool', pool_round(40, 30, (230, 120, 180)), pool_round(70, 48, (140, 150, 160)), pa, resort, 92)
    beds = src('Terrain/tilled_soil.png', (0, 0, 96, 96))
    veg = [trim(src(S + 'Food/Vegetables A.png', (0, 0, 16, 16))), trim(src(S + 'Food/Vegetables A.png', (16, 0, 32, 16))), trim(src(S + 'Food/Vegetables B.png', (0, 0, 16, 16)))]
    def bedwith(n):
        c = beds.copy()
        for i in range(n):
            c.alpha_composite(veg[i % len(veg)], (14 + (i % 4) * 18, 18 + (i // 4) * 24))
        return c
    weedy = beds.copy()
    for i in range(6):
        weedy.alpha_composite(SPR['tuft.spring.0'], (random.Random(i).randrange(0, 70), random.Random(i + 9).randrange(0, 60)))
    orchard = stack((bedwith(8), 0, 64), (SPR['tree.spring'], 0, 0))
    tiers('garden', weedy, bedwith(4), bedwith(8), orchard, 93)
    forge = trim(src(F + 'Smithing/Furnace A.png', (0, 0, 64, 64)))
    kettle = trim(src(F + 'Cauldron.png', (0, 0, 32, 32)))
    tiers('grill', stack((forge, 0, 0)), stack((kettle, 0, 8), (esky(), 30, 16)), stack((counter, 0, 28), (oven, 32, 0), (counter, 64, 28)), stack((trim(src(F + 'Fireplace.png', (106, 13, 182, 87))), 0, 0)), 94)
    tiers('pond', pond(32, 20, fish=1), pond(56, 32, fish=2), pond(80, 44, fish=4, lilies=True), pond(104, 56, fish=6, lilies=True, rocks=True), 95)
    tiers('tower', tower(0), tower(1), tower(2), tower(3), 96)


# ---------------------------------------------------------------- Ruby, Kermit and their kit
PARROT = {
    'perch0': [
        "..............",
        "......oooo....",
        ".....oHHHHo...",
        "....oHHHreKo..",
        "....oHHHHHKko.",
        "....ohHHHHoko.",
        "...oBBhHHCo...",
        "...oWBBBCCo...",
        "..oWWWBCCCo...",
        "..oEWWWCCCo...",
        "..oEEWWbCo....",
        ".oTTEEWbo.....",
        "oTto.oFoFo....",
        ".oo...........",
    ],
    'perch1': [
        "..............",
        "..............",
        "......oooo....",
        ".....oHHHHo...",
        "....oHHHreKo..",
        "....oHHHHHKko.",
        "...oBhHHHHoko.",
        "...oWBBhHCo...",
        "..oWWWBCCCo...",
        "..oEWWWCCCo...",
        "..oEEWWbCo....",
        ".oTTEEWbo.....",
        "oTto.oFoFo....",
        ".oo...........",
    ],
    'flap0': [
        "..oEE.........",
        ".oEWWo.oooo...",
        ".oWWWoHHHHo...",
        "..oWWHHHreKo..",
        "...oWHHHHHKko.",
        "....ohHHHHoko.",
        "...oUBhHHCo...",
        "...oUBBBCCo...",
        "...oBBBBCCo...",
        "...oBBBBCCo...",
        "...ooBBbCo....",
        ".oTTooBbo.....",
        "oTto.oFoFo....",
        ".oo...........",
    ],
    'fly0': [
        "..............",
        "......oEo.....",
        ".....oEWWo....",
        ".....oWWWo.oo.",
        "......oWWooHHo",
        "..oo..oBBHreKo",
        ".oTTBBBBhHHHko",
        "oTtTBBCCCCHoo.",
        ".oo.oBCCCCo...",
        ".....ooooo....",
        "..............",
        "..............",
        "..............",
        "..............",
    ],
    'fly1': [
        "..............",
        "..............",
        "..............",
        "...........oo.",
        "..........oHHo",
        "..oo..ooooHreKo"[:14],
        ".oTTBBBBhHHHko",
        "oTtTBBCCCCHoo.",
        ".oo.oUUCCCo...",
        ".....oWWWWo...",
        "......oEEWo...",
        ".......oEo....",
        "..............",
        "..............",
    ],
}
RUBY = {'o': (40, 16, 24), 'H': (214, 38, 40), 'h': (170, 24, 32), 'B': (196, 30, 36), 'b': (150, 22, 30), 'C': (86, 58, 168), 'W': (160, 26, 36),
        'E': (60, 96, 205), 'T': (190, 32, 40), 't': (240, 200, 70), 'K': (28, 28, 30), 'k': (60, 56, 56), 'e': (20, 20, 20), 'r': (250, 225, 150), 'F': (120, 116, 124), 'U': (86, 58, 168)}
KERMIT = {'o': (20, 40, 22), 'H': (86, 206, 70), 'h': (60, 168, 54), 'B': (74, 190, 62), 'b': (52, 150, 48), 'C': (120, 214, 82), 'W': (56, 160, 52),
          'E': (54, 100, 210), 'T': (70, 180, 60), 't': (236, 220, 80), 'K': (246, 156, 40), 'k': (30, 30, 30), 'e': (20, 20, 20), 'r': (240, 150, 40), 'F': (120, 116, 124), 'U': (214, 40, 40)}


def pixmap(rows, pal):
    h, w = len(rows), max(len(r) for r in rows)
    im = blank(w, h)
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in pal:
                px[x, y] = pal[ch] + (255,)
    return im


def star(frame):
    rows = ["...o...", "...o...", "..ooo..", "ooooooo", "..ooo..", ".oo.oo.", ".o...o."] if frame == 0 else \
           [".......", "...o...", "...o...", ".ooooo.", "..ooo..", "..o.o..", "......."]
    im = pixmap(rows, {'o': (255, 226, 120)})
    glow = im.filter(ImageFilter.MaxFilter(3))
    g = Image.new('RGBA', im.size, (255, 200, 80, 0)); g.putalpha(glow.split()[3].point(lambda a: a // 3))
    c = pad(g, 1, 1, 1, 1); c.alpha_composite(pad(im, 1, 1, 1, 1))
    c.putpixel((4, 4), (255, 255, 240, 255))
    return c


WOOD = (140, 96, 56)
WOODD = (100, 66, 38)


def perch_stand():
    def f(d, im):
        d.rectangle((9, 22, 14, 23), fill=WOODD)
        d.rectangle((3, 24, 20, 26), fill=WOOD)
        d.rectangle((11, 6, 12, 23), fill=WOOD)
        d.rectangle((2, 5, 21, 7), fill=WOOD); d.line([(2, 7), (21, 7)], fill=WOODD)
        d.ellipse((15, 9, 20, 13), fill=(220, 200, 160)); d.rectangle((16, 10, 19, 11), fill=(200, 160, 80))
    return outline(draw(24, 28, f))


def play_gym():
    def f(d, im):
        shade_rect(d, (2, 30, 37, 35), (200, 180, 140))
        for x in (6, 33):
            d.rectangle((x, 8, x + 1, 30), fill=WOOD)
        d.rectangle((4, 7, 35, 9), fill=WOOD)
        for y in range(12, 30, 4):
            d.line([(14, y), (20, y)], fill=WOODD)
        d.line([(14, 10), (14, 30)], fill=WOOD); d.line([(20, 10), (20, 30)], fill=WOOD)
        d.ellipse((24, 12, 30, 18), outline=(230, 190, 60)); d.line([(27, 9), (27, 12)], fill=(160, 160, 160))
        d.rectangle((25, 22, 30, 26), fill=(80, 150, 210)); d.rectangle((26, 23, 29, 25), fill=(240, 90, 90))
    return outline(draw(40, 38, f))


def swing():
    def f(d, im):
        for x in (2, 25):
            d.rectangle((x, 2, x + 1, 32), fill=WOOD)
        d.rectangle((1, 1, 27, 3), fill=WOOD)
        d.line([(9, 3), (9, 20)], fill=(180, 180, 180)); d.line([(19, 3), (19, 20)], fill=(180, 180, 180))
        d.rectangle((8, 20, 20, 22), fill=WOODD)
        for i, c in enumerate([(240, 80, 80), (250, 210, 70), (80, 160, 230)]):
            d.ellipse((10 + i * 3, 15, 12 + i * 3, 17), fill=c)
        d.rectangle((0, 32, 28, 34), fill=WOODD)
    return outline(draw(29, 36, f))


def rope_ladder():
    def f(d, im):
        for x in (2, 17):
            d.line([(x, 2), (x, 34)], fill=(200, 170, 110), width=2)
        for y in range(5, 34, 5):
            d.rectangle((3, y, 17, y + 1), fill=WOOD)
        d.rectangle((0, 0, 20, 2), fill=(90, 90, 96))
    return outline(draw(21, 36, f))


def bell_toy():
    def f(d, im):
        d.rectangle((6, 2, 7, 22), fill=WOOD); d.rectangle((1, 22, 12, 24), fill=WOODD)
        d.rectangle((6, 2, 12, 3), fill=WOOD)
        d.line([(11, 3), (11, 7)], fill=(160, 160, 160))
        d.pieslice((8, 7, 14, 15), 180, 360, fill=(240, 200, 60)); d.rectangle((8, 11, 14, 12), fill=(240, 200, 60)); d.point((11, 13), fill=(120, 90, 30))
        for i, c in enumerate([(230, 70, 70), (80, 170, 230), (110, 200, 90)]):
            d.rectangle((2 + i * 3, 12 + i * 2, 4 + i * 3, 14 + i * 2), fill=c)
    return outline(draw(15, 26, f))


def forager():
    def f(d, im):
        shade_rect(d, (1, 6, 22, 17), (190, 150, 100))
        d.polygon([(1, 6), (5, 2), (26, 2), (22, 6)], fill=(210, 170, 120))
        for x, c in ((6, (240, 220, 180)), (11, (230, 90, 90)), (15, (90, 160, 220)), (19, (240, 220, 180))):
            d.line([(x, 1), (x + 2, 6)], fill=c)
        d.text((5, 7), '?', fill=(120, 80, 40))
    return outline(draw(27, 19, f))


def bird_bath():
    def f(d, im):
        d.rectangle((10, 12, 15, 24), fill=(160, 155, 150)); d.rectangle((6, 24, 19, 27), fill=(140, 135, 130))
        d.ellipse((0, 4, 25, 14), fill=(175, 170, 165)); d.ellipse((3, 6, 22, 12), fill=(90, 170, 210))
        d.arc((5, 7, 14, 11), 190, 300, fill=(210, 240, 255))
    return outline(draw(26, 28, f))


def seed_dish(full=True):
    def f(d, im):
        d.ellipse((0, 2, 13, 8), fill=(70, 120, 190)); d.ellipse((2, 2, 11, 6), fill=(220, 190, 110) if full else (60, 90, 150))
        if full:
            for x, y in ((4, 3), (7, 4), (9, 3)):
                d.point((x, y), fill=(150, 100, 50))
    return outline(draw(14, 10, f))


def night_cage():
    def f(d, im):
        d.ellipse((2, 0, 33, 22), fill=(0, 0, 0, 0), outline=(200, 200, 205))
        for x in range(4, 33, 4):
            d.line([(x, 8), (x, 40)], fill=(200, 200, 205))
        d.rectangle((2, 10, 33, 40), outline=(200, 200, 205))
        d.line([(4, 26), (31, 26)], fill=WOOD, width=2)
        d.rectangle((1, 40, 34, 44), fill=(90, 90, 100))
        d.polygon([(2, 10), (18, 1), (33, 10), (33, 30), (20, 26), (2, 32)], fill=(70, 60, 130, 235))
        d.line([(2, 10), (18, 1), (33, 10)], fill=(110, 100, 170))
    return outline(draw(36, 46, f))


def birdhouse():
    def f(d, im):
        d.rectangle((9, 18, 11, 44), fill=WOODD)
        shade_rect(d, (3, 8, 17, 20), (170, 120, 70))
        d.polygon([(1, 9), (10, 1), (19, 9)], fill=(160, 50, 40))
        d.ellipse((8, 11, 12, 15), fill=(30, 20, 20)); d.line([(10, 17), (10, 18)], fill=WOODD)
    return outline(draw(20, 46, f))


def sundial():
    def f(d, im):
        d.rectangle((8, 10, 15, 24), fill=(170, 165, 158)); d.rectangle((4, 24, 19, 27), fill=(150, 145, 138))
        d.ellipse((1, 4, 22, 12), fill=(190, 185, 178)); d.polygon([(11, 1), (11, 8), (17, 8)], fill=(200, 160, 60))
    return outline(draw(23, 28, f))


def statue():
    def f(d, im):
        shade_rect(d, (4, 30, 23, 37), (160, 156, 150))
        d.ellipse((7, 10, 20, 30), fill=(185, 182, 176)); d.ellipse((10, 3, 19, 12), fill=(185, 182, 176))
        d.polygon([(19, 6), (24, 8), (19, 10)], fill=(150, 146, 140)); d.point((16, 6), fill=(90, 90, 90))
        d.polygon([(7, 20), (2, 28), (10, 26)], fill=(160, 156, 150))
    return outline(draw(26, 38, f))


def chimes():
    def f(d, im):
        d.ellipse((2, 2, 16, 6), fill=WOOD)
        for i, x in enumerate((4, 7, 10, 13)):
            d.line([(x, 6), (x, 8)], fill=(170, 170, 170)); d.rectangle((x - 1, 8, x, 16 + (i % 2) * 4), fill=(200, 200, 215))
        d.line([(9, 0), (9, 2)], fill=(170, 170, 170))
    return outline(draw(18, 22, f))


def birds_and_kit():
    for k, pal in (('ruby', RUBY), ('kermit', KERMIT)):
        for fr, rows in PARROT.items():
            put(f'{k}.{fr}', outline(pixmap([r.ljust(14, '.')[:14] for r in rows], pal), pal['o'] + (255,)) if False else pixmap([r.ljust(14, '.')[:14] for r in rows], pal))
    for i in range(2):
        put(f'star.{i}', star(i))
    put('bird.perch', perch_stand())
    put('bird.gym', play_gym())
    put('bird.swing', swing())
    put('bird.ladder', rope_ladder())
    put('bird.bell', bell_toy())
    put('bird.forager', forager())
    put('bird.bath', bird_bath())
    put('bird.dish', seed_dish())
    put('bird.nightcage', night_cage())
    put('orn.birdhouse', birdhouse())
    put('orn.sundial', sundial())
    put('orn.statue', statue())
    put('orn.chimes', chimes())
    F = 'Objects/Furniture/'
    put('chair.dining', trim(src(F + 'Seating/Chair, Dining B.png', (0, 0, 32, 32))))
    put('chair.green', trim(src(F + 'Seating/Chair, Sofa A.png', (0, 64, 32, 96))))
    put('table.round', trim(src(F + 'Table, Ornate Wood.png', (0, 0, 32, 32))))
    put('crate', src(F + 'Crate.png', (0, 0, 32, 32)))
    put('barrel', trim(src(F + 'Barrel.png', (2, 10, 30, 47))))
    put('chest', src(F + 'Chest.png', (0, 0, 32, 32)))


def pack():
    """Shelf-pack every sprite into one sheet (1px gap)."""
    items = sorted(SPR.items(), key=lambda kv: (-kv[1].height, -kv[1].width, kv[0]))
    W = 1024
    x = y = rowh = 0
    pos = {}
    for k, im in items:
        if x + im.width > W:
            x = 0; y += rowh + 1; rowh = 0
        pos[k] = (x, y)
        x += im.width + 1
        rowh = max(rowh, im.height)
    H = y + rowh
    sheet = blank(W, H)
    for k, im in items:
        sheet.alpha_composite(im, pos[k])
    meta = {k: [pos[k][0], pos[k][1], SPR[k].width, SPR[k].height] + ([META[k]] if k in META else []) for k in SPR}
    return sheet, meta


def contact(path):
    keys = sorted(SPR)
    W, x, y, rowh = 1400, 0, 0, 0
    pos = []
    for k in keys:
        im = SPR[k]
        w, h = max(im.width * 2, 60), im.height * 2 + 12
        if x + w > W:
            x = 0; y += rowh + 6; rowh = 0
        pos.append((x, y)); x += w + 6; rowh = max(rowh, h)
    o = Image.new('RGBA', (W, y + rowh + 6), (58, 56, 64, 255))
    d = ImageDraw.Draw(o)
    for k, (px, py) in zip(keys, pos):
        im = SPR[k]
        o.alpha_composite(im.resize((im.width * 2, im.height * 2), Image.NEAREST), (px, py + 12))
        d.text((px, py), k[:16], fill=(255, 255, 160))
    o.save(path)


if __name__ == '__main__':
    tiles()
    furniture()
    birds_and_kit()
    sheet, meta = pack()
    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, 'world.png'), optimize=True)
    json.dump(meta, open(os.path.join(OUT, 'world.json'), 'w'), separators=(',', ':'))
    print(len(SPR), 'sprites', sheet.size, os.path.getsize(os.path.join(OUT, 'world.png')) // 1024, 'KB')
    if '--sheet' in sys.argv:
        contact(sys.argv[sys.argv.index('--sheet') + 1])
