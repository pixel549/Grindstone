# Location background artwork

Optional generated interior backgrounds are loaded by `Town2D` from this directory.

## File names

Use the scene key from `G.TMAP.inside`, with a PNG extension:

- `library.png`
- `bank.png`
- `tavern.png`
- `chapel.png`
- `gym.png`
- `baths.png`
- `market.png`
- `apothecary.png`
- `dojo.png`
- `track.png`
- `tower.png`
- `oracle.png` (reserved for the Oracle's bespoke sanctum; the scene key is `in_oracle`)

Place files in `assets/2d/locations/`. Missing files automatically use the original tile-based interior.

## Canvas and composition

- World-space canvas: **352 × 288 px** (11 × 9 tiles at 32 px per tile).
- Generate in an **11:9 aspect ratio** where possible. Any PNG dimensions are accepted; the runtime centre-crops to 11:9 without stretching and scales with nearest-neighbour rendering.
- Include the room architecture, floor, walls and static furniture in the background.
- Keep the bottom-centre doorway/exit visually clear. The player enters from that position.
- Keep a clear standing area near the centre for the player and the keeper.
- Do not include characters, dialogue, UI, text, buttons, markers or selection effects. Characters and UI are rendered separately.
- Keep the pixel scale consistent with Grindstone's existing 32 px tile world. No smoothing or anti-aliasing.

## Runtime behaviour

The image replaces the static interior artwork only. Town movement, collision, room boundaries, keeper NPCs, player animation, interactions and exit handling remain controlled by the game. Existing prop definitions remain available for collision and gameplay. If an image is missing or fails to load, the original tile-based room is drawn instead.
