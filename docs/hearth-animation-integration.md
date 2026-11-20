# Hearth animation integration guide

Status: asset audit complete; runtime integration is the next implementation task.
Scope: integrate the two successfully collected animation packs into the existing 2D Hearth renderer without changing the visual language, tile scale, movement, collision, or quest interactions.

## 1. Source packs and staging

The latest Actions artifact is `seven-eves-asset-collection`. It contains a nested `seven-eves-results.zip`; the animation payload is under `animated_assets_downloads/`.

Keep the original ZIPs and extracted third-party source files outside the public repository (for example, local `assets/third_party_staging/`, gitignored). Do not commit raw packs, previews, manifests or source sprite sheets. Commit only this integration guide and code that loads local, licence-permitted game assets.

### PVFX Foundry 1.2

- Source: https://pimen.itch.io/pvfx-foundry
- Licence: CC0-1.0 (verify the included licence/provenance in the staged copy when importing).
- Extracted payload: `pvfx-foundry/pvfx-foundry-thirteen-spritesheets_extracted/`.
- Contains effect families for projectiles, impacts, status, arcane/magic, ambient weather, fire, shadows and other visual effects.
- Every effect has `lit` and/or `strict` render tiers and `grid` and `packed` sheet layouts. Prefer `strict/grid` for the first browser implementation: fixed cells make cropping straightforward. Use `lit/grid` only when the lighting treatment fits the scene. Do not assume every effect has every tier/layout.
- Read `pack.json` and the per-effect `manifest.json`; do not build a hard-coded catalogue from filenames.

### SpritePilot Environment Pack

- Source: https://spritepilot.com/free-game-assets
- Licence: CC0-1.0 (as stated in `environment-pack.json` and `LICENSE.txt`).
- Extracted payload: `spritepilot-environment/extracted/spritepilot-environment-pack/`.
- Nine environmental animations, supplied at 16px and 32px: banner (8 frames, 10 fps), crumbling block (10, 10 fps), door (9, 10 fps), lava (12, 8 fps), spike trap (8, 8 fps), tall grass (12, 8 fps), wall torch (8, 10 fps), water (8, 8 fps), waterfall (16, 16 fps).
- `environment-pack.json` is the source of truth for frame count, FPS, looping, tiling, frame dimensions and file paths. Each PNG is a single horizontal strip, frames left-to-right.

## 2. Renderer constraints

The Hearth is a Canvas 2D renderer in `assets/hearth2d.js` (`House2D`), with a 32px world tile (`T = 32`) and a single existing animation/update loop. Extend that renderer; do not introduce DOM image elements, CSS animations, per-sprite timers, or a second global animation loop.

- Load image assets through the existing asynchronous `House2D._load()` lifecycle and retain references in an animation asset registry.
- Advance frames from the renderer's existing elapsed-time/tick value. Frame selection must be deterministic for a given elapsed time and animation definition; no independent `setInterval` per object.
- Use `ctx.imageSmoothingEnabled = false` (or the renderer's equivalent) for pixel art.
- Use 32px SpritePilot strips for direct 1:1 world-tile placement. If using 16px strips, scale by exactly 2 with nearest-neighbour sampling. Never fractional-scale or interpolate pixel art.
- Preserve each effect's intended pivot/anchor. Effects must not shift position as frames change.
- Missing files, malformed metadata or failed image loads must fail soft: render the existing static prop/old effect and keep the Hearth usable.
- Respect current visibility/active-tab behaviour. Pause or skip expensive effect drawing when the Hearth is inactive or off-screen; do not alter the existing background widget clip capture pipeline.

## 3. SpritePilot strip playback

For a strip with frame width `fw`, frame height `fh`, and zero-based frame index `i`:

```js
const sx = i * fw;
ctx.drawImage(image, sx, 0, fw, fh, dx, dy, dw, dh);
```

For time-based playback:

```js
const frame = loop
  ? Math.floor(elapsedMs * fps / 1000) % frameCount
  : Math.min(frameCount - 1, Math.floor(elapsedMs * fps / 1000));
```

Use a stable per-object phase offset for ambient variety (e.g. banners/grass), but keep all copies of a single tiled water/lava surface on the same frame so seams remain coherent. A one-shot animation must stop on its final frame; a looping animation wraps.

Suggested first placements:
- Wall torch: replace/overlay suitable static wall torches; anchor to wall and keep it behind foreground wall trim.
- Water and lava: animate matching ground/water tiles only; all adjacent tiles share a frame index and tile seamlessly.
- Waterfall: use the 16-frame strip, aligned to the top edge of the fall; place above the pool surface and below foreground props.
- Tall grass: optional yard decoration, behind characters when the character is in front of it; keep collision unchanged.
- Banner: optional wall/yard decoration; anchor at its existing prop tile.
- Door: only use where the current door art and interaction hotspot match; preserve the existing door state and tap target.
- Spike trap and crumbling block: treat as explicit world props only if/when gameplay state supports them. Do not add damage, collision, or destruction mechanics as a side effect of adding animation.

## 4. PVFX Foundry playback

PVFX is for transient effects and small ambient overlays, not for replacing the Hearth's LPC characters or its tile/prop artwork.

### Grid sheets (recommended initial path)

- Cell size is the effect canvas size, recorded as `source_size` in the manifest.
- Grid has exactly 8 columns; frames are row-major from frame 0.
- For frame `n`: `sx = (n % 8) * w`, `sy = Math.floor(n / 8) * h`.
- Stop at the manifest's declared frame count; the final row can contain unused transparent cells.
- Use the manifest `pivot` as the draw anchor.

### Packed sheets (later optimisation)

Packed sheets trim each frame. They cannot be cropped using a regular grid. Read each frame's `sheet.x`, `sheet.y`, `sheet.width`, `sheet.height`, plus its trimmed pivot/scale from the manifest. The trimmed pivot can legitimately lie outside the visible crop. A `visible_bounds: null` frame is transparent for its duration.

### Timing, loops and orientation

- Use exact rational frame durations from each manifest (`numerator_ms / denominator)); do not assume one global FPS.
- Read `loop_mode`: `loop` repeats; `none` is a one-shot and the sequence includes its empty terminal frame.
- Effects with a build-up specify `impact_ms` in `pack.json`; trigger the gameplay event at that timestamp, not at an arbitrary frame.
- Projectile flight effects point right (+x). Rotate/translate the projectile to its travel vector and play the matching impact at the hit point with the same rotation.
- Cast effects use `impact_ms` as the release moment.
- Ambient rain/snow/cloud drift/falling leaves and sandstorm are seamless tiled fields; render as repeating overlays with consistent frame phase. Fog banks, dark mist and fire walls are horizontally tiled ground bands. Other effects should clamp at their edges.
- Start with grid sheets and only add packed-sheet support when there is a demonstrated memory/performance benefit.

## 5. Visual and gameplay rules

1. Keep the established Grindstone pixel-art treatment: nearest-neighbour, crisp edges, restrained palette and no smoothing/glow effects that make the 32px world look blurry.
2. Preserve the current scene order: ground/background; ground effects; static props; animated props; NPCs/hero; foreground occluders; transient combat/interaction FX; UI/speech bubbles. Adjust individual anchors to match existing prop layering.
3. Ambient effects should be subtle and sparse. Avoid animating every eligible tile; group water/lava surfaces and cap simultaneous ambient overlays.
4. Transient effects should be short-lived, pooled/reused where practical, and removed when complete. Bound the active FX list and avoid allocating canvases or cropping arrays every frame.
5. Effects are visual only. Do not modify quest state, NPC schedules, collision, pathfinding, object interactions, damage, rewards or persistence.
6. Respect reduced-motion/accessibility preferences if the app gains such a setting; in its absence, keep loops low-key and pause them when the scene is inactive.
7. Keep sprite sheets and third-party staging assets out of the APK until selected and copied into the permitted production asset directory. Do not bundle the entire PVFX pack.

## 6. Implementation sequence

1. Add a small animation metadata loader/validator and image registry to `House2D`; no gameplay changes.
2. Implement one shared strip/grid frame sampler driven by the existing render clock.
3. Integrate SpritePilot first: wall torch, water, waterfall and tall grass as opt-in visual overlays on existing compatible props/tiles. Keep a static fallback for every location.
4. Add a generic PVFX one-shot/loop effect player using manifest timing and pivots; initially test a small set (spark/impact, coin/glint, dust/smoke) in isolated debug/test scenes.
5. Add a debug gallery or test harness to preview every selected effect at native pixel scale, verify loop boundaries, anchors, alpha and frame timing.
6. Profile on a phone-sized viewport. Confirm no meaningful frame-time regression, no visible seams, no drifting anchors, and no changes to interaction hotspots.
7. Only then select additional effects and promote approved individual assets into the production asset directory.

## 7. Acceptance checklist

- [ ] No third-party source archive or raw full pack committed to the public repo.
- [ ] Metadata and image loading fail soft; missing assets preserve static visuals.
- [ ] SpritePilot strips play at declared FPS/frame counts and loop correctly.
- [ ] PVFX grid frames use 8 columns, manifest cell size, frame count, pivot and exact duration.
- [ ] Packed PVFX frames (if enabled) use per-frame sheet rectangles and trimmed pivots.
- [ ] One-shots finish; loops wrap; tiled surfaces do not visibly seam.
- [ ] Existing NPC/hero animation, collision, taps, doors, quest markers, dialogue and widget capture remain unchanged.
- [ ] Performance is checked on-device before enabling effects broadly.

## 8. Known collection gap

The latest collector run reports 2/3 animation packs complete. PVFX Foundry and SpritePilot Environment Pack are verified complete and present in the artifact. Mini Meadow is incomplete: two PNG preview/source attachments were saved, but one or more source downloads failed. It is not an animation integration dependency and should remain marked incomplete until its actual source pack is retrieved.
