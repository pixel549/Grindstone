#!/usr/bin/env python3
"""Check the shipped LPC hero manifest against its PNG sheets.

Run from the repository root with:
    python3 tools2d/audit_hero.py

This is a structural audit only: it checks referenced files and sheet geometry,
not the visual quality or alignment of the artwork itself.
"""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

ANIMS = {
    "walk": (9, 4),
    "idle": (2, 4),
    "sit": (3, 4),
    "emote": (3, 4),
    "slash": (6, 4),
    "thrust": (8, 4),
    "spellcast": (7, 4),
    "jump": (5, 4),
    "climb": (6, 1),
    "hurt": (6, 1),
}
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def png_size(path: Path) -> tuple[int, int]:
    """Read PNG dimensions without requiring Pillow or another dependency."""
    with path.open("rb") as image:
        header = image.read(24)
    if len(header) != 24 or header[:8] != PNG_SIGNATURE or header[12:16] != b"IHDR":
        raise ValueError("not a valid PNG header")
    return struct.unpack(">II", header[16:24])


def main() -> int:
    root = Path(__file__).resolve().parent.parent / "assets" / "2d" / "hero"
    manifest_path = root / "index.json"
    if not manifest_path.is_file():
        print(f"ERROR: missing {manifest_path}")
        return 1

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    items = manifest.get("items", {})
    folders = manifest.get("folder", {})
    referenced: set[str] = set()
    errors: list[str] = []
    standard_refs = 0
    custom_refs = 0
    layer_count = 0

    def check(path_text: str, expected: tuple[int, int], label: str) -> None:
        path = root / path_text
        referenced.add(path_text)
        if not path.is_file():
            errors.append(f"missing {label}: {path_text}")
            return
        try:
            actual = png_size(path)
        except (OSError, ValueError) as exc:
            errors.append(f"invalid {label} {path_text}: {exc}")
            return
        if actual != expected:
            errors.append(f"wrong dimensions for {label} {path_text}: {actual}, expected {expected}")

    for item_id, item in items.items():
        variants = item.get("variants") or []
        recoloured = item.get("rec") is not None
        if not recoloured and not variants and item.get("layers"):
            errors.append(f"{item_id}: non-recoloured item has no variants")

        for body, layers in item.get("layers", {}).items():
            for layer in layers:
                layer_count += 1
                for anim in layer.get("anims", []):
                    if anim not in ANIMS:
                        errors.append(f"{item_id}/{body}: unknown animation {anim}")
                        continue
                    frames, rows = ANIMS[anim]
                    folder = folders.get(anim, anim)
                    choices = [None] if recoloured else variants
                    for variant in choices:
                        if recoloured:
                            path = layer["base"] + folder + ".png"
                        else:
                            path = layer["base"] + folder + "/" + str(variant).replace(" ", "_") + ".png"
                        check(path, (frames * 64, rows * 64), f"{item_id}/{body}/{anim}")
                        standard_refs += 1

        for custom_id, custom in item.get("custom", {}).items():
            anim = custom.get("anim")
            if anim not in ANIMS:
                errors.append(f"{item_id}/{custom_id}: unknown custom animation {anim}")
                continue
            frames, rows = ANIMS[anim]
            size = int(custom.get("size", 0))
            if size <= 0:
                errors.append(f"{item_id}/{custom_id}: invalid frame size {size}")
                continue
            for layer in custom.get("layers", []):
                for filename in layer.get("files", []):
                    path = layer["base"] + filename
                    check(path, (frames * size, rows * size), f"{item_id}/{custom_id}")
                    custom_refs += 1

    shipped_pngs = {
        p.relative_to(root).as_posix()
        for p in root.rglob("*.png")
    }
    unreferenced = sorted(shipped_pngs - referenced)
    if unreferenced:
        errors.extend(f"unreferenced PNG: {path}" for path in unreferenced)

    print(f"Hero items: {len(items)}")
    print(f"Layer definitions: {layer_count}")
    print(f"Standard sheet references checked: {standard_refs}")
    print(f"Custom combat sheet references checked: {custom_refs}")
    print(f"PNG files found: {len(shipped_pngs)}")
    if errors:
        print(f"FAIL: {len(errors)} problem(s)")
        for error in errors:
            print(f" - {error}")
        return 1
    print("PASS: every shipped hero PNG is referenced and has the expected frame dimensions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
