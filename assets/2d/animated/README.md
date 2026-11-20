# Curated animated sprites

Only the four reviewed runtime sheets in this folder are shipped. The complete third-party archives remain in the GitHub Actions artifact/local staging and are not copied into the app.

## SpritePilot Environment Pack
- Source: https://spritepilot.com/free-game-assets
- Licence: CC0-1.0 (see `SPRITEPILOT-LICENSE.txt`)
- Selected: 32px water, tall grass and wall torch horizontal strips.
- Timing/layout is recorded in `manifest.json`; strips are left-to-right.

## PVFX Foundry 1.2.0
- Source: https://nerijs.itch.io/pvfx-foundry
- Licence: CC0-1.0 (see `PVFX-LICENSE.txt` and the selected frame manifest)
- Selected: strict-tier grid version of `impacts/hit-spark`.
- Eight 64x64 cells, row-major, eight columns, 80ms per frame; pivot [32,32].
- The final frame is intentionally transparent. Keep its duration.

Do not copy the full source packs or unreviewed variants into this runtime folder. Preserve these source links and licence files if the selected assets are moved or renamed.
