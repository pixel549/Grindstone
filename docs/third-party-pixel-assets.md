# Third-party pixel-art asset sources

This file records approved third-party assets for Grindstone's town-location and residential art pipeline.

## Integration direction

Grindstone's commercial/service locations use bespoke, full-scene backgrounds created specifically for the game. These packs are **modular prop and furnishing sources**, not replacement shop-scene backgrounds.

NPCs remain independent of the background. Dialogue portraits/expressions are a separate layer from the full-body character sprites.

## Approved free downloads

### Frostbrook Town Interiors — free sample

- Source: https://chuckyassets.itch.io/frostbrook-town-interiors-free-sample
- Download: `FrostbrookTownInteriors_FreeSample_v1.0.zip`
- Contents: 19 props including tavern counter, barrel, bench, table, animated lantern, anvil, animated forge hearth, quench trough, shop goods, shelves, sacks, noticeboard, chapel pew/candles and floor pieces.
- Available sizes: 16, 32 and 48 px; shadow and shadowless variants.
- Intended use: individual props/furnishings, especially hearth and shop details.
- Licence: personal and commercial game use; edits permitted; do not resell or redistribute the files; do not use for AI training.

### Frostbrook Snow Village — free sample

- Source: https://chuckyassets.itch.io/frostbrook-snow-village-free-sample
- Download: `Frostbrook_FreeSample_v1.0.zip`
- Contents: 17 props/tiles including snowy pine, snowman, bench, lantern post, sled, crate, four-frame campfire, fence pieces, cocoa stall, bookshelf, chair and ground/floor tiles.
- Available sizes: 16, 32 and 48 px; shadow and shadowless variants.
- Intended use: selected outdoor props and residential furnishing references. Do not let the winter theme dictate Grindstone's bespoke location art.
- Licence: free use in personal and commercial games; do not resell or redistribute the files.

### 500+ Portrait Expressions — Seveneves.ai

- Source: https://sevenevesai.itch.io/500-portrait-expressions-pixel-art-pack
- Download: `assets.zip`
- Contents: 32 characters with 16 expressions each (500+ portraits), including merchant, blacksmith, wizard, farmer, elder, witch and others.
- Intended use: dialogue portrait/reaction options, subject to a visual-style review before adoption. This is not a replacement for independent full-body NPC sprites.
- Licence: free personal and commercial use; modification permitted; no attribution required; do not resell or redistribute independently.
- Disclosure: AI-assisted graphics.

### Raven Fantasy — Green Forest (free)

- Source: https://clockworkraven.itch.io/raven-fantasy-pixel-art-tileset-green-forest
- Download: `Raven Fantasy - Pixel Art Tileset - Green Forest v2.zip`
- Contents: fantasy forest tiles and environmental props, including animated fire, campfire, water and waterfall elements.
- Available sizes: 16, 32, 48 and 64 px.
- Intended use: selectively inspect for standalone natural/environmental props and effects. Do not use its forest scene/tiles as a substitute for bespoke vendor backgrounds.
- Licence: personal and commercial project use; modification permitted; do not distribute or sell the asset pack separately without the creator's permission.
- Disclosure: creator states no generative AI was used.

## Deliberately excluded

- Raven Fantasy Interiors: paid ($15 USD minimum); do not acquire without explicit approval.
- Raven's 48x48 character starter pack: not selected for the current NPC workflow because its resolution/format does not match the preferred character assets.
- Other previously reviewed character packs: rejected for resolution, appearance or stylistic mismatch.

## Repository and licensing handling

The Grindstone repository is public. The source ZIPs and raw third-party sprite sheets must therefore **not** be committed or mirrored here where the asset licences prohibit redistribution. Download the packs from their creator pages and keep the original files in a local, untracked asset-staging folder. Only integrate permitted, appropriately edited individual assets into the game build after checking the applicable licence and confirming they fit the established Grindstone pixel-art treatment.

Suggested local staging folder: `assets/third_party_staging/` (keep it out of Git). Keep this manifest and the creator/source links in the repository.
