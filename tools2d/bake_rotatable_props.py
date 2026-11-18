#!/usr/bin/env python3
"""Generate original four-direction furniture sprites for Grindstone.

Run from the repository root:
    python3 tools2d/bake_rotatable_props.py

Writes assets/2d/rotatable_props.png and rotatable_props.json.
Each prop has separately drawn N/E/S/W views; this deliberately does not
rotate a single sprite, because fronts, backs, handles and visible faces differ.
Requires Pillow.
"""
import json
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "2d")
SIZE = 48
OUTLINE = (36, 26, 32, 255)
PAL = {
    "wood": (132, 83, 49, 255), "wood_l": (177, 119, 70, 255),
    "wood_d": (82, 49, 36, 255), "wood_hi": (211, 158, 96, 255),
    "iron": (75, 78, 88, 255), "iron_l": (133, 139, 145, 255),
    "cream": (220, 205, 169, 255), "cloth": (73, 112, 91, 255),
    "cloth_l": (112, 151, 116, 255), "cloth_d": (43, 73, 64, 255),
    "white": (225, 224, 207, 255), "blue": (90, 139, 171, 255),
    "blue_d": (47, 82, 112, 255), "black": (38, 42, 48, 255),
    "glass": (116, 173, 185, 255), "gold": (205, 166, 83, 255),
}

def rect(d, xy, c): d.rectangle(xy, fill=PAL[c] if isinstance(c, str) else c)
def line(d, xy, c, w=1): d.line(xy, fill=PAL[c] if isinstance(c, str) else c, width=w)
def poly(d, pts, c): d.polygon(pts, fill=PAL[c] if isinstance(c, str) else c)

def furniture(kind, face):
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Face is the side facing the viewer. Each view is drawn from its own
    # geometry so asymmetric details (backs, handles, doors) change correctly.
    if kind in ("table_round", "table_rect", "kitchen_table", "workbench"):
        if kind == "table_round":
            d.ellipse((8, 10, 39, 35), fill=PAL["wood_d"])
            d.ellipse((8, 7, 39, 32), fill=PAL["wood"])
            d.arc((9, 8, 38, 31), 190, 345, fill=PAL["wood_hi"], width=2)
            rect(d, (13, 19, 16, 31), "wood_d"); rect(d, (31, 19, 34, 31), "wood_d")
            if face in ("N", "S"): line(d, (10, 25, 37, 25), "wood_l")
            else: line(d, (23, 9, 23, 33), "wood_l")
        else:
            poly(d, [(7,13),(35,13),(41,20),(13,20)], "wood_hi")
            poly(d, [(13,20),(41,20),(41,25),(13,25)], "wood")
            poly(d, [(7,13),(13,20),(13,25),(7,18)], "wood_d")
            # Legs shift with the visible front edge.
            for x in (13, 34): rect(d, (x, 24, x+3, 37), "wood_d")
            if face == "N":
                line(d, (9, 14, 35, 14), "wood_l")
            elif face == "S":
                line(d, (13, 24, 40, 24), "wood_hi", 2)
            elif face == "E":
                line(d, (39, 20, 39, 25), "wood_hi", 2)
            else:
                line(d, (8, 14, 8, 19), "wood_l", 2)
            if kind == "workbench":
                rect(d, (17, 14, 28, 17), "iron")
                line(d, (18, 14, 27, 14), "iron_l")
                rect(d, (31, 9, 35, 12), "gold")
    elif kind in ("chair_dining", "chair_office", "armchair"):
        # Seat and four legs.
        rect(d, (12, 17, 34, 33), "wood_d")
        rect(d, (13, 17, 33, 30), "wood")
        rect(d, (15, 19, 31, 27), "wood_l")
        for x in (13, 31): rect(d, (x, 29, x+2, 39), "wood_d")
        # Chair back is opposite the facing direction.
        if face == "S":
            rect(d, (12, 7, 34, 17), "wood_d"); rect(d, (14, 8, 32, 15), "wood_l")
        elif face == "N":
            rect(d, (12, 31, 34, 41), "wood_d"); rect(d, (14, 32, 32, 39), "wood_l")
        elif face == "E":
            rect(d, (6, 15, 16, 35), "wood_d"); rect(d, (7, 17, 13, 32), "wood_l")
        else:
            rect(d, (31, 15, 41, 35), "wood_d"); rect(d, (34, 17, 40, 32), "wood_l")
        if kind == "armchair":
            rect(d, (10, 18, 15, 30), "cloth_d"); rect(d, (31, 18, 36, 30), "cloth_d")
            rect(d, (14, 19, 32, 29), "cloth"); rect(d, (16, 20, 29, 23), "cloth_l")
        if kind == "chair_office":
            rect(d, (21, 30, 26, 38), "iron")
            rect(d, (16, 37, 31, 40), "iron")
            rect(d, (13, 39, 17, 41), "black"); rect(d, (29, 39, 33, 41), "black")
    elif kind == "fridge":
        # Tall appliance; door and handle are always on its front.
        rect(d, (11, 5, 36, 40), "black")
        rect(d, (13, 6, 34, 38), "white")
        if face == "S":
            line(d, (13, 18, 34, 18), "iron_l")
            rect(d, (30, 10, 32, 16), "iron")
            rect(d, (30, 22, 32, 28), "iron")
            rect(d, (15, 8, 27, 10), "white")
        elif face == "N":
            line(d, (13, 27, 34, 27), "iron_l")
            rect(d, (16, 29, 18, 35), "iron")
        elif face == "E":
            rect(d, (18, 7, 37, 38), "white")
            poly(d, [(37,7),(41,10),(41,39),(37,38)], "iron")
            rect(d, (34, 17, 36, 25), "iron")
        else:
            rect(d, (11, 7, 30, 38), "white")
            poly(d, [(11,7),(7,10),(7,39),(11,38)], "iron")
            rect(d, (12, 17, 14, 25), "iron")
        rect(d, (14, 39, 18, 41), "iron"); rect(d, (30, 39, 34, 41), "iron")
    elif kind == "cabinet":
        rect(d, (9, 8, 38, 39), "wood_d")
        rect(d, (11, 10, 36, 37), "wood")
        if face in ("N", "S"):
            rect(d, (23, 10, 24, 37), "wood_d")
            rect(d, (14, 18, 16, 21), "gold"); rect(d, (31, 18, 33, 21), "gold")
            line(d, (13, 11, 34, 11), "wood_hi")
        elif face == "E":
            rect(d, (12, 11, 35, 36), "wood_l")
            rect(d, (31, 21, 34, 24), "gold")
            poly(d, [(35,10),(40,13),(40,36),(35,37)], "wood_d")
        else:
            rect(d, (12, 11, 35, 36), "wood_l")
            rect(d, (13, 21, 16, 24), "gold")
            poly(d, [(12,10),(7,13),(7,36),(12,37)], "wood_d")
        rect(d, (13, 39, 17, 41), "wood_d"); rect(d, (31, 39, 35, 41), "wood_d")
    elif kind == "sofa":
        rect(d, (6, 13, 41, 37), "wood_d")
        rect(d, (8, 14, 39, 34), "cloth_d")
        rect(d, (12, 17, 35, 31), "cloth")
        rect(d, (13, 18, 23, 25), "cloth_l"); rect(d, (25, 18, 34, 25), "cloth_l")
        if face == "S":
            rect(d, (7, 8, 40, 17), "cloth_d"); line(d, (9, 10, 38, 10), "cloth_l")
        elif face == "N":
            rect(d, (7, 32, 40, 40), "cloth_d")
        elif face == "E":
            rect(d, (32, 9, 41, 39), "cloth_d")
        else:
            rect(d, (6, 9, 15, 39), "cloth_d")
        rect(d, (9, 35, 14, 38), "wood_d"); rect(d, (34, 35, 39, 38), "wood_d")
    return im

PROPS = {
    "table_round": {"label":"Round table", "footprint":[1,1]},
    "table_rect": {"label":"Rectangular table", "footprint":[2,1]},
    "kitchen_table": {"label":"Kitchen table", "footprint":[2,1]},
    "workbench": {"label":"Workbench", "footprint":[2,1]},
    "chair_dining": {"label":"Dining chair", "footprint":[1,1]},
    "chair_office": {"label":"Office chair", "footprint":[1,1]},
    "armchair": {"label":"Armchair", "footprint":[1,1]},
    "sofa": {"label":"Sofa", "footprint":[2,1]},
    "fridge": {"label":"Fridge", "footprint":[1,1]},
    "cabinet": {"label":"Cabinet", "footprint":[1,1]},
}
FACES = ("N", "E", "S", "W")

def outlined(im):
    alpha = im.getchannel("A")
    grown = alpha.filter(ImageFilter.MaxFilter(3))
    edge = Image.new("RGBA", im.size, OUTLINE)
    edge.putalpha(grown)
    edge.alpha_composite(im)
    return edge

def main():
    os.makedirs(OUT, exist_ok=True)
    cell = 48
    atlas = Image.new("RGBA", (cell * 4, cell * len(PROPS)), (0,0,0,0))
    meta = {"cell_size":[cell,cell], "directions":list(FACES), "props":{}}
    for row, (key, info) in enumerate(PROPS.items()):
        meta["props"][key] = {"label":info["label"], "footprint":info["footprint"], "directions":{}}
        for col, face in enumerate(FACES):
            sprite = outlined(furniture(key, face))
            atlas.alpha_composite(sprite, (col*cell, row*cell))
            meta["props"][key]["directions"][face] = [col*cell, row*cell, cell, cell]
    atlas.save(os.path.join(OUT, "rotatable_props.png"), optimize=True)
    with open(os.path.join(OUT, "rotatable_props.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")
    print("Wrote 40 directional sprites to assets/2d/rotatable_props.png")

if __name__ == "__main__":
    main()
