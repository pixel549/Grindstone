#!/usr/bin/env python3
"""Replace the window sprite in world.png without rebuilding the full LPC atlas.

Run from the repository root:
    python3 tools2d/patch_window.py
"""
import json
import os
from PIL import Image

from bake_world import square_window

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', '2d')

with open(os.path.join(OUT, 'world.json'), encoding='utf-8') as f:
    sprites = json.load(f)

if 'window' not in sprites:
    raise SystemExit("world.json has no 'window' sprite entry")

x, y, w, h = sprites['window']
window = square_window()
if window.size != (w, h):
    raise SystemExit(
        f"Window dimensions changed: atlas expects {w}x{h}, generator made "
        f"{window.width}x{window.height}"
    )

atlas_path = os.path.join(OUT, 'world.png')
atlas = Image.open(atlas_path).convert('RGBA')
atlas.paste(window, (x, y))
atlas.save(atlas_path)
print(f"Patched square-topped window at ({x}, {y}), {w}x{h}.")
