# Rotatable prop artwork

This branch adds a bespoke directional furniture set for Grindstone.

## Generate the atlas

From the repository root, with Pillow installed:

```bash
python3 tools2d/bake_rotatable_props.py
```

The generator writes:

- `assets/2d/rotatable_props.png` — transparent atlas, four columns in N/E/S/W order.
- `assets/2d/rotatable_props.json` — cell coordinates, prop labels, cardinal direction keys and tile footprints.

## Included props

Each prop is drawn separately for north, east, south and west. The script does not rotate one base sprite to fake the other views.

- Round table
- Rectangular table
- Kitchen table
- Workbench
- Dining chair
- Office chair
- Armchair
- Sofa
- Fridge
- Cabinet

## Integration status

This is an art-generation pass, not yet a claim that every prop is wired into the room editor. The generated atlas and metadata need to be reviewed at native size, then connected to the game's existing placement, rotation, depth sorting and collision systems. In particular, confirm the directional footprint and anchor in the renderer before replacing any existing furniture keys.

The existing world atlas remains untouched by this generator, so this work cannot silently change the current Hearth or town artwork.
