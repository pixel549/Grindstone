# Character and sprite pipeline audit — 2.27.0

**Baseline:** `main` at 2.27.0, versionCode 55  
**Scope:** structural audit of the hero/NPC sprite pipeline and a first visual pass over the house, town and dungeon atlases.  
**Status:** phase 1 complete; no production artwork has been replaced.

## Findings

### There are two hero-rendering paths

- `assets/lpchero.js` is the active LPC compositor. It reads `assets/2d/hero/index.json`, loads the layered PNG sheets, applies the LPC palettes and assembles the hero, children and people/NPCs.
- `assets/hearth2d.js` uses those LPC sheets for the people moving around the house. `assets/app.js` uses `LPC.dress()` / `LPC.build()` for the character creator, the hero portrait, and people/NPC portraits.
- `assets/art.js` is a separate procedural SVG rig. In the current app it remains the synchronous silhouette/loading fallback and supplies several vector UI illustrations. `assets/home.js` retains legacy side-on scene code that uses the SVG rig; the current app still uses `Home.decorSvg()` for relic illustrations, but that older scene is not the active 2D Hearth.

**Implication:** the main character art is not one pipeline from end to end. The LPC sprite is the real in-game character, but the fallback and legacy renderer have a visibly different vector/chibi treatment. A broad replacement of the LPC sheets is not justified by this audit. The better first target is to make the fallback and preview states visually consistent with the LPC character, then review specific high-visibility equipment combinations.

### Structural integrity of the shipped LPC hero sheets

The new `tools2d/audit_hero.py` checks the manifest against every shipped PNG without third-party Python packages. Run it from the repository root:

```sh
python3 tools2d/audit_hero.py
```

Audit of the 2.27.0 APK assets:

- 88 item definitions in `index.json`.
- 210 body/layer definitions.
- 1,387 PNG files; every PNG is referenced by the manifest.
- 1,979 standard sheet references checked across variants.
- 38 custom combat-sheet references checked.
- No missing files, invalid PNG headers, or unexpected frame dimensions.

Standard sheets use 64 × 64 cells. The compositor expects 9 walk frames, 2 idle frames, 3 sit/emote frames, 6 slash frames, 8 thrust frames, 7 spellcast frames and 5 jump frames; climb and hurt use one direction row. The audit confirms the shipped dimensions match those expectations. Oversized weapon sheets use their declared 128- or 192-pixel cells and the same animation frame counts.

Some layers intentionally do not have every animation. In particular, child clothing is walk-only; `lpchero.js` repeats its first walking frame for a static child pose. This is an explicit fallback, not a missing-file defect. The audit therefore checks declared references and geometry rather than requiring every item to implement every animation.

### Other sprite atlases

- `assets/2d/delve.png` / `delve.json` contain the dungeon characters, enemies and combat effects, consumed by `assets/delve2d.js`.
- `assets/2d/town.png` / `town.json` contain the town building facades, consumed by `assets/town2d.js`.
- `assets/2d/world.png` / `world.json` contain the house, furniture, yard and expansion art, consumed by `assets/hearth2d.js`. This atlas mixes LPC-derived material with hand-drawn additions, so future additions need to be checked against the existing pixel scale, palette and outline weight.

The atlases were inspected at sheet level, but this pass did not exhaustively render every character/equipment combination or every NPC/enemy animation in-app.

## Recommended order for the next art pass

1. Replace or restyle the procedural SVG silhouette used while LPC portraits are loading or unavailable, so the fallback does not jump to a different art style.
2. Build a repeatable character-combination gallery from the existing compositor: male/female body types, skin and hair palettes, hair/beards, armour tiers, coats/robes, headgear, weapons and shields.
3. Use that gallery to identify actual clipping, layer-order, recolouring or animation-frame defects before drawing replacement sprites.
4. Review children and calendar-created people separately; their reduced animation coverage is intentional but should remain visually coherent in idle and movement.
5. Only then rework individual hero, companion, NPC or enemy assets, preserving transparent backgrounds, anchors, filenames and frame dimensions.

## Limits of this pass

- No original art files were overwritten and no runtime rendering code was changed.
- The audit verifies file references and image dimensions, not pixel-level alignment, animation quality or visual appeal.
- No Android device or emulator was available for this pass. The visual review used the shipped atlas assets; the character-combination gallery and on-device checks remain outstanding.
