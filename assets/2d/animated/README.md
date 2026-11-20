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

## Selected sheet checksums (SHA-256)

- `water-32px_strip8.png`: `c0a6205197bb5ac702066f98ffdaced859f66cf9f33ee42d182f234fba1135d5`
- `tall-grass-32px_strip12.png`: `5c6eba998a6f4ff566d51e53e31328f764a149169049a3471b33d663cd499235`
- `wall-torch-32px_strip8.png`: `d95666604d1a4fa865e8ff70203bf903becf70f408dc28dd0f10fe48550797d9`
- `hit-spark-strict-grid.png`: `be7e52a9529af3160b81dc0c5dee9bc03d48a1258102045fd4c74606957f16e0`

The PVFX checksum matches the source pack's `pack.json` entry for the strict/grid sheet.
