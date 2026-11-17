#!/usr/bin/env python3
"""2.24: the town's buildings, from LPC Revised's houses (Brick House A and B, Paneled House A: Lanea Zimmerman (Sharm) and
Eliza Wyatt (DeathsDarling), OGA-BY 3.0, github.com/ElizaWy/LPC), recoloured so no two look alike, each with a hanging sign
drawn here. Also the square's cobbles, from the same set's terrain. Writes assets/2d/town.png and town.json:
  key -> [x, y, w, h, doorX, body]   doorX: the door's centre in the sprite; body: how many 32px rows at the bottom block.
Run from the repo root:  python3 tools2d/bake_town.py   (env LPCR = the ElizaWy_LPC folder)"""
import os, json, colorsys
from PIL import Image
import numpy as np

E = os.environ.get('LPCR', '/home/claude/dl/ElizaWy_LPC') + '/Structure/Structures/'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', '2d')
BASE = {   # sprite, door centre x, rows that block, where the sign hangs (x, y)
    'A': ('Brick House A.png', 77, 5, (98, 150)),
    'B': ('Brick House B.png', 111, 4, (62, 120)),
    'P': ('Paneled House A.png', 128, 3, (62, 104)),
}

def hsv_arrays(a):
    rgb = a[..., :3].astype(np.float32) / 255.0
    mx, mn = rgb.max(-1), rgb.min(-1)
    v = mx; d = mx - mn; s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(v)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.maximum(d, 1e-6), 0); gc = np.where(m, (mx - g) / np.maximum(d, 1e-6), 0); bc = np.where(m, (mx - b) / np.maximum(d, 1e-6), 0)
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2.0 + rc - bc, 4.0 + gc - rc))
    h = (h / 6.0) % 1.0
    return h * 360, s, v

def recolour(a, mask, hue=None, sat=None, ks=1.0, kv=1.0):
    h, s, v = hsv_arrays(a)
    out = a.copy()
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        hh = (hue if hue is not None else h[y, x]) / 360.0
        ss = min(1, (sat if sat is not None else s[y, x]) * ks)
        vv = min(1, v[y, x] * kv)
        r, g, b = colorsys.hsv_to_rgb(hh, ss, vv)
        out[y, x, :3] = [int(r * 255), int(g * 255), int(b * 255)]
    return out

def masks(kind, a):
    h, s, v = hsv_arrays(a)
    op = a[..., 3] > 0
    warm = (h < 35) | (h > 335)
    if kind == 'A':
        return {'roof': op & (h > 200) & (h < 290) & (v < 0.5), 'wall': op & warm & (s > 0.25)}
    if kind == 'B':
        return {'roof': op & warm & (v < 0.33), 'wall': op & warm & (s > 0.35) & (v >= 0.33)}
    return {'wall': op & (h > 200) & (h < 290) & (s > 0.12) & (v < 0.5), 'roof': op & warm & (s > 0.45)}

# 10x10 sign icons: . clear, d dark, l light, a accent
ICONS = {
    'gym': ['..........', '..........', 'dd......dd', 'dd......dd', 'dddddddddd', 'dddddddddd', 'dd......dd', 'dd......dd', '..........', '..........'],
    'track': ['....aa....', '...aaaa...', '....aa....', '..aaaaa...', '.a.aa..a..', '...aaa....', '..a..a....', '.a....a...', 'a......a..', '..........'],
    'baths': ['....a.....', '...aaa....', '..aaaaa...', '..aaaaa...', '.aaaaaaa..', '.aaalaaa..', '.aaaalaa..', '..aaaaa...', '...aaa....', '..........'],
    'library': ['..........', '.dddddddd.', '.dllldlll.', '.dllldlll.', '.dllldlll.', '.dllldlll.', '.dllldlll.', '.dddddddd.', '..........', '..........'],
    'dojo': ['.........d', '........d.', '.......d..', '......d...', '.....d....', '..a.d.....', '...a......', '..a.a.....', '.a........', '..........'],
    'apothecary': ['...dddd...', '....aa....', '....aa....', '...aaaa...', '..aaaaaa..', '..alaaaa..', '..aaaaaa..', '..aaaaaa..', '...aaaa...', '..........'],
    'market': ['..........', '...dddd...', '..d....d..', '.dddddddd.', '.daaaaaad.', '.daaaaaad.', '.daaaaaad.', '.dddddddd.', '..........', '..........'],
    'tavern': ['..........', '.ddddddd..', '.dlllld.d.', '.daaaad..d', '.daaaad..d', '.daaaad.d.', '.daaaadd..', '.dddddd...', '..........', '..........'],
    'bank': ['....dd....', '...dddd...', '..d.aa.d..', '..d.aa....', '...daad...', '....aa.d..', '..d.aa.d..', '...dddd...', '....dd....', '..........'],
    'tower': ['..........', '.d..d..d..', '.dddddddd.', '.dddddddd.', '..dddddd..', '..dddddd..', '..ddaadd..', '..ddaadd..', '..dddddd..', '..........'],
    'chapel': ['....aa....', '....aa....', '.aaaaaaaa.', '.aaaaaaaa.', '....aa....', '....aa....', '....aa....', '....aa....', '....aa....', '..........'],
    'home': ['....d.....', '...ddd....', '..ddddd...', '.ddddddd..', '..dlllda..', '..dlldda..', '..dlldda..', '..ddddda..', '..........', '..........'],
}
ICOL = {'gym': '#3a3a44', 'track': '#c0392b', 'baths': '#3b8fd0', 'library': '#7a4b2a', 'dojo': '#b03030', 'apothecary': '#3fa060',
        'market': '#d0a030', 'tavern': '#c08020', 'bank': '#d4af37', 'tower': '#606878', 'chapel': '#e8d070', 'home': '#7a5a3a'}

def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def sign(icon):
    im = Image.new('RGBA', (18, 22), (0, 0, 0, 0))
    px = im.load()
    for x in range(2, 16):   # the bracket and chains
        px[x, 0] = (60, 44, 30, 255)
    px[4, 1] = px[4, 2] = px[13, 1] = px[13, 2] = (90, 90, 96, 255)
    for y in range(3, 21):
        for x in range(1, 17):
            edge = y in (3, 20) or x in (1, 16)
            px[x, y] = (74, 52, 34, 255) if edge else (222, 204, 160, 255)
    acc = hexrgb(ICOL[icon])
    for y, row in enumerate(ICONS[icon]):
        for x, ch in enumerate(row):
            if ch == 'd': px[4 + x, 7 + y] = (50, 40, 36, 255)
            elif ch == 'l': px[4 + x, 7 + y] = (250, 244, 228, 255)
            elif ch == 'a': px[4 + x, 7 + y] = acc + (255,)
    return im

# What each building looks like: base, (part, hue, sat, ks, kv) recolours, sign
FACADES = {
    'b.library': ('A', [('roof', 200, 0.35, 1, 1.1), ('wall', 20, 0.12, 1, 1.35)], 'library'),
    'b.bank': ('A', [('roof', 240, 0.12, 1, 0.8), ('wall', 42, 0.28, 1, 1.75)], 'bank'),
    'b.tavern': ('A', [('roof', 28, 0.5, 1, 1.25), ('wall', None, None, 1.05, 1.0)], 'tavern'),
    'b.chapel': ('A', [('roof', 352, 0.55, 1, 1.5), ('wall', 40, 0.05, 1, 2.1)], 'chapel'),
    'b.gym': ('B', [], 'gym'),
    'b.baths': ('B', [('wall', 195, 0.35, 1, 1.25), ('roof', 210, 0.35, 1, 1.4)], 'baths'),
    'b.dojo': ('B', [('wall', 28, 0.45, 1, 0.75), ('roof', 0, 0.75, 1, 1.5)], 'dojo'),
    'b.apothecary': ('B', [('wall', 100, 0.28, 1, 1.0), ('roof', 30, 0.5, 1, 1.0)], 'apothecary'),
    'b.market': ('B', [('wall', 42, 0.55, 1, 1.25), ('roof', 8, 0.7, 1, 1.6)], 'market'),
    'b.track': ('P', [('wall', 120, 0.3, 1, 1.2), ('roof', 0, 0.65, 1, 1.0)], 'track'),
    'home.0': ('P', [], 'home'),
    'home.1': ('P', [('wall', 120, 0.3, 1, 1.15), ('roof', 25, 0.5, 1, 0.7)], 'home'),
    'home.2': ('P', [('wall', 0, 0.45, 1, 1.2), ('roof', 220, 0.2, 1, 0.7)], 'home'),
    'home.3': ('P', [('wall', 42, 0.45, 1, 1.6), ('roof', 140, 0.35, 1, 0.8)], 'home'),
    'home.4': ('P', [('wall', 0, 0.02, 1, 1.5), ('roof', 0, 0.7, 1, 0.75)], 'home'),
    'home.5': ('P', [('wall', 280, 0.3, 1, 1.2), ('roof', 45, 0.5, 1, 1.0)], 'home'),
}

def main():
    out = {}
    pics = []
    for key, (kind, recs, icon) in FACADES.items():
        f, doorX, body, (sx, sy) = BASE[kind]
        a = np.array(Image.open(E + f).convert('RGBA'))
        M = masks(kind, a)
        for part, hue, sat, ks, kv in recs:
            a = recolour(a, M[part], hue, sat, ks, kv)
        im = Image.fromarray(a.astype(np.uint8))
        im.alpha_composite(sign(icon), (sx, sy))
        pics.append((key, im, doorX, body))
    # the square's cobbles: the dirt road's stones, greyed and lightened
    ter = np.array(Image.open(os.environ.get('LPCR', '/home/claude/dl/ElizaWy_LPC') + '/Terrain/terrain_summer.png').convert('RGBA'))
    for i, (tx, ty) in enumerate([(96, 96), (128, 96), (160, 96)]):
        t = ter[ty:ty + 32, tx:tx + 32].copy()
        t = recolour(t, t[..., 3] > 0, 215, 0.12, 1, 1.18)
        pics.append(('g.cobble.%d' % i, Image.fromarray(t.astype(np.uint8)), 0, 0))
    # shelf-pack, 1024 wide
    W, x, y, rowh = 1024, 0, 0, 0
    sheet = Image.new('RGBA', (W, 2048))
    for key, im, doorX, body in sorted(pics, key=lambda t: -t[1].height):
        if x + im.width > W: x, y, rowh = 0, y + rowh + 1, 0
        sheet.alpha_composite(im, (x, y))
        out[key] = [x, y, im.width, im.height, doorX, body]
        x += im.width + 1; rowh = max(rowh, im.height)
    sheet = sheet.crop((0, 0, W, y + rowh))
    sheet.save(os.path.join(OUT, 'town.png'), optimize=True)
    json.dump(out, open(os.path.join(OUT, 'town.json'), 'w'), separators=(',', ':'))
    print('town atlas', sheet.size, len(out), 'facades')

if __name__ == '__main__':
    main()
