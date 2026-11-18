# Grindstone Art Style Guide

**Status:** Working art-direction standard  
**Applies to:** 2D world art, characters, NPCs, props, tilesets, effects and future bespoke locations  
**Primary reference:** Existing `assets/2d/world.png`, `assets/2d/world.json`, `tools2d/bake_world.py`, `tools2d/bake_extras.py` and the LPC character pipeline.

This guide is intended to keep new artwork visually consistent with the existing game. It is a practical production standard, not a requirement that every location use the same colours or mood.

---

## 1. Core visual identity

Grindstone uses **hand-crafted fantasy pixel art**: readable silhouettes, compact clusters of colour, tactile materials and deliberate environmental storytelling. The shared art style creates visual consistency; it does not impose one mood or palette on every location.

The Hearth and town are intended to feel **cozy, welcoming and lived-in**. Dungeons, wilderness, ruins and other locations are free to be unsettling, hostile, bleak, strange, grand, eerie or otherwise distinct. Each place should have its own atmosphere, lighting, material treatment and palette appropriate to its purpose. A dungeon should not be made cozy just to match the Hearth. What ties locations together is the game's pixel craft, scale, outline discipline, perspective and readable design—not a universal colour scheme.

### The five principles

1. **Readable first.** An object must be recognisable at its actual in-game size.
2. **Pixel-authentic.** Pixels are deliberate blocks, not a low-resolution filter over smooth artwork.
3. **Consistent construction.** Match the existing tile scale, outline treatment, lighting direction and sprite conventions.
4. **Material has character.** Wood, stone, cloth, iron, foliage and magic should have distinct visual treatments.
5. **Atmosphere through detail.** Use composition, lighting accents and carefully placed highlights rather than excessive gradients, noise or particle clutter.

## 2. Scale, grid and proportions

- The 2D world uses a **32 × 32 pixel tile** as its basic map unit (`T = 32` in `assets/hearth2d.js`).
- Floors and repeating terrain should normally be designed to fit a 32 × 32 tile, or an exact multiple of it.
- Walls, furniture, trees, buildings and other props may be larger than one tile. Do not squash a large object into 32 × 32 if its existing in-game footprint needs more room.
- Preserve the source artwork's intended proportions. Do not resize sprites non-uniformly.
- Align tile edges and repeating patterns exactly to the tile grid.
- For sprites that occupy multiple tiles, document their pixel dimensions and in-game footprint.
- Character artwork follows the existing LPC character pipeline; do not assume that every character frame is 32 × 32. Match the dimensions and frame layout expected by that pipeline.

**Pixel scaling:** Use integer scaling only. Enlarge pixel art with nearest-neighbour sampling. Never use bilinear, bicubic or other smoothing filters on pixel-art sprites.

## 3. Outlines and edge treatment

The existing custom world-art pipeline uses a dark outline colour of **RGB (36, 26, 32)**, hex **#241A20**.

- Use a clean, generally **one-pixel dark outline** around standalone props and bespoke objects where the existing art uses one.
- Keep the outline visually consistent on all sides. Avoid accidental two- or three-pixel thick borders.
- Do not outline every internal colour boundary. Use shading and colour separation inside the sprite.
- Small details may use selective dark pixels rather than a complete outline where that improves readability.
- Avoid pure black for ordinary outlines; use the established warm near-black.
- Keep outlines inside the sprite's intended silhouette and allow enough transparent padding to prevent clipping.

The current baking scripts do not apply outlines in exactly the same way: `bake_world.py` uses a 3 × 3 alpha dilation, while `bake_extras.py` uses a four-neighbour outline. New assets should be inspected at native size after baking. The intended visual result is a consistent one-pixel edge, not blind adherence to one algorithm.

## 4. Palette and lighting

### Existing palette anchors

Use the existing sprite atlas as the primary colour reference. The following colours are established in the current project:

| Purpose | Reference |
|---|---|
| Main outline | `#241A20` |
| Wood base | RGB `(150, 104, 62)` |
| Wood highlight | RGB `(186, 136, 84)` |
| Wood shadow | RGB `(104, 70, 44)` |
| Stone base | RGB `(150, 146, 140)` |
| Stone highlight | RGB `(186, 182, 176)` |
| Stone shadow | RGB `(110, 106, 102)` |
| Gold base | RGB `(220, 160, 53)` |
| Gold highlight | RGB `(255, 214, 100)` |
| Gold shadow | RGB `(150, 102, 0)` |
| Cloth reference | RGB `(130, 60, 70)` |
| Iron reference | RGB `(128, 132, 142)` |

These are reference colours, not a restriction to a tiny fixed palette. Sample the existing atlas before introducing a new material or region-specific palette.

### Palette rules

- Prefer a small, coherent ramp for each material: shadow, base, highlight and (where needed) a bright accent.
- Keep shadows coloured; avoid simply adding black.
- Keep highlights controlled. Large areas of pure white or saturated colour should be rare.
- Use warm browns, muted greens, aged stone, iron greys and restrained golds where they suit the location. The Hearth and town will generally favour warmer, softer and more inviting combinations.
- Other locations may use colder, harsher, darker, more saturated or more oppressive palettes when that supports their identity. Dungeons may lean into cold stone, sickly greens, deep reds, desaturated blues or near-monochrome schemes, for example.
- Strong cyan, violet, crimson or spectral colours are welcome wherever the setting calls for them; they do not need to be limited to magical accents in otherwise warm scenes.
- Do not force a location's palette to match the Hearth. Maintain material readability and coherent ramps within each scene instead.
- Do not apply a global colour tint to an asset if it makes different materials indistinguishable.

### Lighting

- Default world-object lighting is consistent, readable top-left illumination, with darker lower/right edges where appropriate.
- Use a clear light source for special scenes: candles, braziers, windows, magical objects and similar elements.
- A glow should illuminate nearby pixels or surfaces subtly; it should not erase the object's outline or turn into a large blurry halo.
- Prefer pixel clusters and stepped light falloff over smooth airbrush gradients.

## 5. Pixel technique and material language

- Build shapes from intentional pixel clusters. Avoid isolated single pixels unless they represent a highlight, glint, particle or tiny feature.
- Use stepped diagonals and controlled curves. Avoid noisy, randomly jagged edges.
- Suggest texture with a few deliberate marks rather than covering surfaces in speckle.
- Keep neighbouring colour clusters large enough to survive the game's displayed scale.

Material cues:

- **Wood:** warm mid-browns, visible grain used sparingly, lighter top/left edges and dark joints or gaps.
- **Stone:** desaturated greys or earthy greys, irregular seams, chips and restrained value variation.
- **Iron and steel:** cool grey ramps, dark recesses and small sharp highlights; avoid broad white shine.
- **Cloth:** larger, softer colour areas, folds indicated with a few stepped shadow shapes.
- **Glass and crystal:** strong silhouette, dark or coloured edge, a small bright reflection and limited internal facets.
- **Foliage:** layered greens with distinct light and shadow clusters; avoid a single flat green mass.
- **Fire and magic:** bright centres, controlled colour ramps and a small number of readable animated pixels.

## 6. Characters and NPCs

- Characters must use the existing LPC-compatible character pipeline unless a deliberate, documented alternative is approved.
- Match the project's existing frame dimensions, row/direction ordering, animation names and transparency conventions.
- Keep a consistent head-to-body proportion, feet position and visual centre across every frame.
- The feet/ground contact point must not jump between animation frames. This is especially important for idle and walk cycles.
- Preserve the character's silhouette across directions so the player can recognise them at small size.
- Clothing, hair and equipment should use the same material palette and outline treatment as the world.
- Important NPCs may have distinctive silhouettes, colours or accessories, but should not look like they came from a different art style.
- Do not bake dialogue, names, UI labels or speech bubbles into character sprites.

### Animation

- Use consistent frame dimensions and alignment throughout a sequence.
- Idle animations should be subtle: breathing, robe movement, a small head movement, flickering light or similar.
- Walk cycles should have stable feet contact and believable alternating movement.
- Effects must not cause the base character to shift position.
- Check animations at actual game speed and at native resolution; a contact sheet alone is not enough.

## 7. Props, furniture and world objects

- Props should have a clear silhouette and a readable front, side or top plane appropriate to the game's top-down view.
- Keep the established lighting direction and one-pixel outline treatment where applicable.
- Preserve transparent backgrounds; do not include a baked checkerboard or solid background.
- Include enough transparent padding for outlines and effects.
- Large objects should have a documented anchor/foot position so they sit correctly in the world.
- Multi-part objects (for example, a table with items on it) should be designed so their layers can be drawn in the correct depth order.
- For interactive objects, keep the visual sprite separate from hitboxes, interaction markers and UI.
- Tiered objects should remain recognisably the same object across tiers. Upgrades may add material quality, ornament, gold or gems, but should not unexpectedly change the object's footprint or identity.

## 8. Rotatable props and directional artwork

Some furniture and appliances are intended to be rotated by the player when arranging a room. If a prop is suitable for rotation, its artwork must support **all four cardinal directions**:

- Draw dedicated north-facing, east-facing, south-facing and west-facing versions.
- Do not rely on rotating one top-down sprite in code unless the object is genuinely rotationally symmetrical. Directional furniture often has different visible faces, legs, handles, cushions, doors, controls or shadows.
- Keep the object's footprint, anchor point and interaction/collision footprint documented for each direction. If the footprint changes with orientation, define that explicitly.
- Keep lighting direction, outline thickness, palette and pixel scale consistent across all four versions.
- Ensure details that establish the object's front remain correct in each direction. For example, a fridge door handle, chair back, table apron or cabinet front must move to the appropriate visible face.
- Use a consistent naming convention such as `chair.north`, `chair.east`, `chair.south`, `chair.west`; follow the renderer's existing key format if it already defines one.
- If a prop is not meaningfully rotatable (for example, a wall-mounted painting or a built-in fireplace), do not create redundant directional variants.
- Check every direction in the actual room renderer, including depth sorting, collision and placement preview.

**Minimum requirement:** if a table, chair, fridge, cabinet or other relevant free-standing prop can be rotated in the editor, all four directional art views must exist before the prop is considered complete.

## 9. Tilesets, rooms and environment art

- Floor tiles must tile seamlessly on all intended edges. Test a repeated 3 × 3 or larger patch, not just one tile in isolation.
- Wall pieces must have consistent thickness, top/side faces, corners and joins.
- Design wall caps, corners, doorways and transitions as a coherent set.
- Room objects must respect the existing top-down perspective and depth sorting.
- Keep foreground edges and wall faces visually distinct so characters and furniture can appear in front of the correct surfaces.
- Avoid baked shadows that conflict with dynamic or separately layered shadows.
- A bespoke room may introduce its own palette and decorative language, but it must retain the same pixel scale, outline discipline and material logic.

### Location-specific art direction

Every major location should have a short visual brief of its own. Define its mood, dominant materials, palette, lighting, architecture and signature details before producing a large asset set.

**The Hearth and town — cozy and welcoming**
- Warm, inviting light; comfortable interiors; natural timber, softened stone, textiles, plants and signs of everyday use.
- Friendly visual rhythms, approachable silhouettes and small decorative details that make the settlement feel inhabited.
- Avoid making every surface pristine. Wear and age should add warmth rather than menace.

**Dungeons and hostile places — atmosphere is allowed to turn**
- These locations do not need to feel cozy or use the Hearth's warm palette.
- Use architecture, negative space, scale, lighting and colour to communicate danger, isolation, age, corruption or uncertainty.
- Uneven stone, oppressive ceilings, deep shadows, harsh directional light, damp surfaces, decay, strange growths and unsettling silhouettes are all valid where appropriate.
- Different dungeon types should not all look alike. A crypt, overgrown ruin, mine, ancient machine complex and corrupted cavern should each have a recognisable visual identity.

**The Oracle's Sanctum — quiet, ancient and ceremonial**
- A distinct underground space, separate from the editable Hearth layout.
- Old, cool stone for the room structure, with selective candlelight and restrained magical illumination.
- A strong altar silhouette as the visual focal point.
- Small, purposeful magical accents around the shrine or Oracle; avoid filling the whole room with glow.
- Details that imply age and use: worn steps, repaired stone, wax drips, old cloth, carved marks and offerings.
- The Oracle should be recognisable at a glance and visually grounded in the same world as the player character.

These are mood and palette directions, not separate rendering styles. All locations retain the same pixel scale, deliberate cluster work, material readability and technical sprite conventions.

## 10. Effects, lighting and particles

- Effects should communicate an event or state clearly: glow, fire, dust, magic, impact, reward or damage.
- Keep particles small and sparse enough that they do not obscure characters or interaction targets.
- Use stepped animation and palette ramps that match the sprite art.
- Separate the effect from the underlying object when it needs independent animation or depth sorting.
- Do not use large soft glows as a substitute for pixel-art lighting.

## 11. UI art versus world art

The app interface has its own established visual language: dark near-black panels, ivory text, restrained antique gold and serif display typography (see CSS variables in `assets/style.css`).

- Keep UI icons crisp and consistent with the interface.
- Do not automatically apply the world-sprite outline to UI icons.
- Do not bake UI text, buttons, labels or panels into world sprites.
- World art and interface art should complement one another, but they are not required to use identical rendering techniques.

## 12. Asset production and integration

### Preferred source files

- Keep original artwork separate from baked atlases.
- Use transparent PNG for raster sprite source art.
- Keep source images at native pixel resolution.
- For generated artwork, request a transparent background and isolated assets wherever possible.
- If a generated image contains multiple objects or frames, split and clean them into individual assets before integration.
- Never assume a generated sprite sheet has perfectly uniform frame spacing; inspect and correct it.

### Naming and metadata

- Follow the existing key conventions in `assets/2d/world.json` (for example, `floor.0`, `wall.stone`, `fence.picket`, `x.candles`).
- Use clear, stable, lowercase keys with dots for meaningful variants or tiers.
- Keep atlas coordinates in the JSON metadata generated by the existing baking process; do not hand-edit atlas coordinates without a clear reason.
- Document dimensions, anchor/foot point, animation frame count, frame order and any special rendering requirements.
- Avoid renaming existing sprite keys unless all references are updated.

### Generated-art cleanup

AI-generated artwork is a starting point, not automatically production-ready game art. Before it enters the game:
1. Remove background remnants and stray pixels.
2. Correct the silhouette and pixel clusters by hand or with a pixel-aware script.
3. Reduce accidental colours and inconsistent lighting.
4. Apply the correct outline treatment.
5. Align frames and anchors.
6. Check that no semi-transparent fringe or resampling blur remains.
7. Test the result in the actual game scene.

### Baking

- Use the existing `tools2d/bake_world.py` and `tools2d/bake_extras.py` conventions where appropriate.
- Preserve the current atlas metadata format and sprite keys expected by the renderer.
- Do not replace or re-bake the full world atlas just to add one small asset unless necessary.
- Keep source art and generated atlas outputs in sync.
- Record any new external source and its licence/attribution in the appropriate project documentation.

## 13. Quality assurance checklist

An asset is ready to commit only when the relevant checks pass:

- [ ] It reads clearly at native in-game size.
- [ ] It uses the correct pixel scale and integer scaling.
- [ ] Its outline is consistent with the existing art.
- [ ] Its palette and lighting fit the intended material and scene.
- [ ] There are no blurred edges, accidental semi-transparent pixels or background remnants.
- [ ] Transparent padding is sufficient; nothing is clipped.
- [ ] Tiles repeat seamlessly, if applicable.
- [ ] Animation frames align and do not jitter, if applicable.
- [ ] Its anchor, footprint and depth order are correct in-game.
- [ ] If rotatable, north, east, south and west artwork exists and has been checked in-game.
- [ ] Sprite keys and metadata match the renderer.
- [ ] It has been inspected in the actual app, not only in an image editor or contact sheet.
- [ ] Source/licence information is recorded where required.

## 14. Initial repository asset audit

The first source-level review of the current `main` art pipeline found the following. This is a technical/source audit; raster-level visual approval still requires opening the PNG atlases at native size and in the running game.

### Existing strengths

- `tools2d/bake_world.py` uses the established `#241A20` outline colour and the documented wood, stone, gold, cloth and iron palette anchors for bespoke additions.
- `tools2d/bake_extras.py` uses the same outline colour and matching palette anchors. Its custom assets are drawn directly at pixel resolution rather than being blurred or vector-rendered.
- `tools2d/bake_town.py` builds the town atlas from LPC Revised building art, applies distinct facade recolours and draws compact pixel-signage. Its building metadata also records door position and blocking depth.
- `tools2d/bake_mobs.py` uses the LPC character pipeline and 64-pixel animation frames for the delve enemies, with animation metadata stored in `delve.json`. This is consistent with the project's existing character pipeline rather than an unrelated sprite format.
- The town, world and delve atlases have separate metadata files, keeping sprite coordinates and animation definitions out of the rendering code.

### Gaps and follow-up checks

- The current `world.json` furniture keys (including `fridge.0`–`fridge.5`, `ktable.*`, `ctable.*`, `chair.dining` and `deskchair`) describe existing variants/tiers, not a complete north/east/south/west directional set. Do not treat these sprites as fully rotatable until four directional views have been created and wired into the renderer.
- The world baking scripts do not apply one identical outline operation to every source sprite. Some bespoke props are explicitly outlined, while many LPC source crops are retained as supplied. This is not automatically a defect: inspect the actual atlas and compare each asset with its neighbours before adding or thickening outlines.
- Town buildings are recoloured source artwork with custom signs; check the final PNG at native size for colour banding, recolour masks that affect unintended areas, and signage that remains legible in the game view.
- Delve enemies use LPC-derived layered art and a common animation pipeline. Check frame alignment, feet/ground contact, weapon offsets and outline consistency across the full enemy set, especially larger attack frames.
- The PNG atlases must receive a visual review at native resolution and in-game before they can be marked visually approved. Metadata and generator code alone cannot establish that there are no stray pixels, edge artefacts or palette mismatches.

**Audit status:** Source conventions are broadly aligned with the guide. Rotatable furniture is a known art/metadata gap. Raster-level visual approval remains outstanding; do not describe the current atlases as fully visually signed off until they have been inspected.

## 15. Prompt brief for new artwork

Use this as the default brief when creating new Grindstone assets:

> Create original Grindstone game artwork in the project's established hand-crafted fantasy pixel-art style. Match the existing game's 32-pixel world tile scale and established sprite proportions. Follow the requested location's own mood and art direction; do not automatically make every scene warm, cozy or earthy. Use deliberate pixel clusters, readable silhouettes, coherent material palettes, appropriate scene lighting and a one-pixel warm near-black outline (#241A20) where appropriate. Use crisp hard pixel edges and integer-scale detail. Keep the background fully transparent and include safe transparent padding. Do not use anti-aliasing, blur, smooth gradients, painterly texture, 3D rendering, vector shapes, text, watermarks or a checkerboard background. Preserve the requested object's exact proportions and provide clean, game-ready artwork that can be inspected and aligned before atlas integration.

**Always append the asset-specific requirements:** exact dimensions, number of frames, view direction, animation, palette exceptions, anchor point and whether the asset must tile.

---

## 16. Reference files

When making or reviewing art, inspect these project files first:

- `assets/2d/world.png` — current world sprite atlas.
- `assets/2d/world.json` — sprite keys and atlas rectangles.
- `tools2d/bake_world.py` — main world-art construction and outline helpers.
- `tools2d/bake_extras.py` — additional hand-drawn assets and palette references.
- `assets/hearth2d.js` — tile size, rendering, actor and depth conventions.
- `assets/lpchero.js` (if present) — character sprite pipeline and LPC frame conventions.
- `assets/style.css` — interface palette and typography.

If a technical convention in this guide conflicts with the actual renderer or current asset pipeline, inspect the code and update the guide rather than forcing assets into an incompatible format.
