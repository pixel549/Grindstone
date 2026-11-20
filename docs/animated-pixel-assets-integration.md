# Animated pixel-art assets — integration instructions

## Purpose

Use the newly collected animation packs to add restrained, readable motion to Grindstone's existing 2D Hearth, Town and Delve scenes. This is an integration guide, not permission to replace the established art direction or to dump entire third-party packs into the APK.

The game uses a 32 px world grid, crisp pixel art, canvas renderers and existing animation loops. Keep the current LPC-inspired world and character art visually dominant. Animated effects should support the scene, not compete with it.

## What was actually collected

The 20 November 2026 Actions artifact contains these animation sources under `animated_assets_downloads/`:

### PVFX Foundry 1.2.0 — complete

- Source: https://nerijs.itch.io/pvfx-foundry
- Licence: CC0-1.0 (see the pack's own `LICENSE.txt` and `THIRD_PARTY_NOTICES.txt`).
- 253 canonical effect IDs, 81 colour variants.
- 1,336 current-version sprite-sheet PNGs across the effects and variants; another 136 PNG sheets are in the preserved legacy releases (1,472 PVFX PNG sheets total).
- Each effect has a machine-readable `pack.json` entry and per-layout manifests/recipes. The current release includes ambient, nature, water, fire, smoke, wind, arcane, holy, shadow, ice, lightning, melee, projectile, impact, explosion, status, UI and sci-fi families.
- Prefer selected, reviewed files only. Do not bundle every tier, layout, colour variant and legacy version into the app.

### SpritePilot Environment Pack — complete

- Source: https://spritepilot.com/free-game-assets
- Licence: CC0-1.0 (see its `LICENSE.txt`).
- Nine assets, each supplied as a 16 px and a 32 px horizontal strip: water, lava, waterfall, wall torch, banner, door, spike trap, crumbling block and tall grass.
- The pack's `environment-pack.json` is the authoritative frame/timing/tile manifest.
- Animation metadata: water 8 frames at 8 fps, lava 12 at 8 fps, waterfall 16 at 16 fps, wall torch 8 at 10 fps, banner 8 at 10 fps, door 9 at 12 fps (one-shot), spike trap 8 at 14 fps (one-shot), crumbling block 10 at 12 fps (one-shot), tall grass 12 at 10 fps.
- Water, lava and waterfall tile seamlessly in both directions. Other effects do not tile unless explicitly marked.

### Mini Meadow 16x16 Tileset — incomplete; do not integrate yet

- The collector found two PNG preview/source-page image links but at least one source download failed. The manifest marks this pack incomplete.
- These files are not proof of a complete tileset. Do not treat them as the pack, do not mark it complete, and do not integrate them until the actual source archive is recovered and verified.

## Important distinction: sprite sheets are not all the same format

### SpritePilot strips

Each PNG is a single horizontal row of equally sized square frames, left to right. Read the frame count, dimensions, FPS, loop and tile flags from `environment-pack.json`; do not guess these from image dimensions or filenames when the manifest is available.

For frame index `i`, crop:
- `x = i * frameWidth`
- `y = 0`
- `width = frameWidth`
- `height = frameHeight`

Choose 32 px strips for objects intended to occupy one 32 px world tile. Use 16 px strips only when the object is deliberately a half-tile detail and its placement/scale is designed for that. Do not upscale a 16 px sheet to 32 px with smoothing.

### PVFX Foundry grid sheets

- Read `source_size`, `frames`, `pivot`, `loop_mode` and each frame's exact rational duration from the adjacent `manifest.json`.
- Grid layout has eight columns, row-major from frame 0.
- For frame `n`, cell origin is `x = (n % 8) * source_width`, `y = floor(n / 8) * source_height`.
- Crop one full `source_size` canvas per frame. Ignore unused cells in the last row.
- The effect pivot is inside that full canvas and is the world anchor for drawing.

Grid sheets are the preferred first implementation because they are straightforward to crop and preserve a stable canvas/pivot.

### PVFX Foundry packed sheets

Packed sheets trim each frame independently. They cannot be played by dividing the image into a regular grid.

Use the matching `manifest.json` for every packed sheet:
- Read each frame's `sheet.x`, `sheet.y`, `sheet.width`, `sheet.height` and `sheet.scale`.
- Place the cropped frame so its `trimmed_pivot` aligns to the effect's declared `pivot`.
- A null `visible_bounds` means that frame is transparent; preserve its duration but draw nothing.
- Do not assume every frame has the same dimensions.

Do not use packed sheets until the renderer has a manifest-aware frame path and tests for pivot alignment. Never try to infer packed frame rectangles from the PNG alone.

### PVFX tiers, variants and timing

- `strict` and `lit` are different pixel treatments of the same effect, not animation speeds. Review both visually and choose one per use. Start with `strict` where the effect must sit cleanly over existing pixel art; use `lit` only where its brighter treatment is wanted.
- Palette variants live under `variants/<variant>/...`; they keep the base effect's frame count, timing, canvas and pivot. They are alternate colourways, not additional animation frames.
- Use the exact duration in the manifest (`numerator_ms / denominator`), or the matching `frame_ms` in `pack.json` where applicable. Do not force every effect to one global FPS.
- Respect `loop_mode`. Looping effects repeat; one-shots stop on their authored final/empty frame and then finish.
- Respect `impact_ms` on charge-up and impact effects. For casts, spawn the projectile at the authored release time. For hits, apply the gameplay hit at the authored impact time, not when the animation merely starts.
- Projectile flight effects point right (+x), stay on their pivot and loop. Move/rotate the effect in world space; play its matching impact effect at the collision point with the same orientation.
- Rain, snowfall, cloud drift, falling leaves and sandstorm are seamless two-axis tiling layers. Fog bank, dark mist and fire wall are horizontal ground bands. Use repeat wrapping only for these documented effects; clamp all others.

## Runtime implementation plan

### 1. Add a small shared animation helper

Create a reusable helper (suggested file: `assets/animated2d.js`) rather than implementing separate frame clocks in `hearth2d.js` and `town2d.js`.

It should:
- Load images asynchronously and cache by URL; avoid duplicate loads.
- Accept a declarative animation definition: image, frame rectangles, frame durations, pivot, loop/one-shot behaviour, optional tile mode.
- Advance from elapsed time supplied by the existing renderer's animation loop. Do not create one timer per sprite.
- Use an elapsed-time accumulator so slow frames do not permanently desynchronise animation; clamp very large elapsed deltas after tab/app suspension.
- Support play, pause, reset, finished state and optional deterministic start offset for ambient loops.
- Draw using the existing canvas context with `imageSmoothingEnabled = false`, integer-aligned source/destination rectangles and the correct pivot.
- Keep animation state separate from save data unless a gameplay interaction genuinely needs persistence.
- Stop advancing when its scene is inactive or the app is backgrounded. Reuse the existing requestAnimationFrame lifecycle.
- Fail gracefully: a missing sheet must leave the existing static prop/fallback visible and must not break scene loading.

Keep the helper renderer-agnostic. Hearth and Town should decide where and when an effect exists; the helper should only load, time and draw frames.

### 2. Add a curated runtime manifest

Create a small first-party manifest (suggested: `assets/2d/animated/manifest.json`) that lists only assets selected for Grindstone. Each entry should include:
- stable ID and source pack;
- relative sheet and metadata paths;
- frame layout/type and dimensions;
- frame count and per-frame timing or FPS;
- loop/one-shot behaviour and tile flags;
- pivot/anchor and intended render layer;
- intended scene/use and whether it is decorative or gameplay-triggered.

Do not point runtime code at the Actions ZIP or at the untracked staging directory. The final APK must contain only the selected runtime sheets and metadata.

### 3. First integration pass — SpritePilot environment

Start with the visually obvious, low-risk environmental assets:
1. Tall grass: optional gentle wind animation for existing outdoor grass patches. Preserve the current growth/condition logic; animation must not change gameplay state.
2. Water: animated pool/pond surface where the existing art has water. Confirm seamless tiling and keep shore edges/static borders separate.
3. Waterfall: use only where a waterfall prop/feature exists; don't invent a new location just to use the asset.
4. Wall torch: replace or layer over an appropriate existing torch/lantern flame, preserving the prop's current collision and interaction footprint.
5. Banner: use for existing town/yard banners or signs only where the dimensions and style fit.
6. Lava: reserve for Delve/environment hazards, not ordinary Hearth/Town scenes.
7. Door, spike trap and crumbling block: integrate only as explicit scene/gameplay states. Doors need open/closed state semantics; traps need armed/triggered/reset states; crumbling blocks need intact/crumbling/gone states. One-shot animation completion must not itself invent or mutate game rules.

For each asset, inspect it at native scale against the current scene before adopting it. A visually mismatched animation should be rejected rather than recoloured or scaled carelessly.

### 4. Second integration pass — PVFX Foundry effects

Build a curated shortlist by category, then review candidate sheets at native scale:
- Hearth/Town ambience: candle flame, small fire, drifting leaves, rain/snow only when season/location logic calls for it, water ripples, small dust/spark effects.
- Interactions: subtle coin/loot glint, completion sparkle, repair/build puff, door/portal activation.
- Delve combat: melee impact, hit spark, slash, projectile flight/impact, fire/ice/lightning effects, smoke/dust, explosion and status effects.
- Oracle: restrained magical glow, rune/sigil or portal activation effects; keep the Oracle's existing authored aesthetic in charge.

Do not add an effect just because it exists. Prefer one readable effect per event, short durations and restrained scale. Avoid stacking multiple full-screen overlays.

### 5. Render order and visual treatment

- Keep world tiles and static props at their current layers.
- Draw ground/weather layers behind actors where appropriate.
- Draw object-bound effects at the object's anchor and correct depth (e.g. flame above a torch, water within its basin).
- Draw actor-attached effects relative to actor position/pivot, not the top-left of the sprite sheet.
- Draw impact/foreground effects after the affected actor only when the effect is meant to occlude them.
- Do not change collision, pathfinding, interaction hitboxes, prop footprints, building layouts or NPC movement to accommodate decorative effects.
- Preserve the current pixel-art treatment: nearest-neighbour sampling, no CSS/image smoothing, no fractional scaling where avoidable. If a source is 16 px on a 32 px world, make the deliberate 2x pixel scale explicit.

### 6. Performance and lifecycle

- Share one loaded image per sheet; do not instantiate one image per placed prop.
- Use a shared clock and update visible/active animations only.
- For repeated ambient props, stagger loop start offsets slightly to avoid obvious synchronised flicker, but keep the offset stable for a scene instance.
- Avoid hundreds of independent particle animations. Cap transient effects and remove one-shots after completion.
- Pause off-screen/inactive scene animations and resume without a giant catch-up burst.
- Do not persist frame counters in the save. Decorative animation is presentation state.
- Respect Android WebView memory limits; load only sheets needed by the current scene, and release references when a scene is destroyed if practical.

## Suggested first test/demo scene

Use a single controlled test scene before enabling animations across the game:
- one water tile (loop/tile);
- one tall-grass patch (loop);
- one wall torch (loop);
- one one-shot impact effect from PVFX;
- one missing-image case to prove fallback behaviour.

Check at phone resolution:
- correct frame order and timing;
- correct tile seams;
- stable pivots (no jitter);
- crisp pixels at the game's zoom levels;
- one-shot completion and cleanup;
- no change to collisions, taps, pathfinding or save data;
- no noticeable frame-rate drop or excess memory use.

## Acceptance checklist

- [ ] SpritePilot strips are sliced using their manifest dimensions and frame counts.
- [ ] PVFX grid frames use eight-column row-major slicing and declared canvas/pivot.
- [ ] PVFX packed frames use per-frame manifest rectangles and trimmed pivots; no grid assumptions.
- [ ] Exact timing, loops, one-shots and impact/release timing are honoured.
- [ ] Tiling is enabled only for explicitly tileable assets.
- [ ] Pixel filtering stays nearest-neighbour and drawing remains aligned to the world grid.
- [ ] Missing assets fall back safely.
- [ ] Inactive scenes pause animation work.
- [ ] No decorative animation changes game rules or save data.
- [ ] The app packages only the curated runtime subset, not the source ZIPs or complete collector output.
- [ ] Licence/provenance is recorded for every selected asset.
- [ ] Existing Hearth, Town, Delve, NPC and interaction tests still pass.

## Source/licence handling

Both complete animation packs currently carry CC0-1.0 declarations. Retain their licence files and source URLs in the asset provenance documentation. The incomplete Mini Meadow material is excluded.

The public repository should contain only the small curated runtime subset actually used by Grindstone, plus its metadata and provenance. Keep the full collector archives and unreviewed source material in Actions artifacts or local untracked staging. Do not commit the complete PVFX archive or all 1,472 PVFX sheets merely because the source is CC0; that would unnecessarily inflate the repository and APK.
