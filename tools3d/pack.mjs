// Packs the KayKit pieces Grindstone uses into compact GLBs (meshopt-compressed).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, reorder, mergeDocuments, unpartition, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'fs';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const SRC = process.env.KAYKIT || '../../assets-src/'; // folder holding the three KayKit repos
const OUT = new URL('../assets/3d/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const F = SRC + 'KayKit-Furniture-Bits-1.0/addons/kaykit_furniture_bits/Assets/gltf/';
const R = SRC + 'KayKit-Restaurant-Bits-1.0/addons/kaykit_restaurant_bits/Assets/gltf/';
const A = SRC + 'KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/';
const PROPS = {
  [F]: ['armchair', 'armchair_pillows', 'bed_double_A', 'bed_single_A', 'book_set', 'book_single', 'cabinet_medium_decorated', 'cabinet_small', 'cabinet_small_decorated', 'cactus_medium_A', 'cactus_small_A', 'cactus_small_B',
    'chair_A', 'chair_A_wood', 'couch_pillows', 'lamp_standing', 'lamp_table', 'pictureframe_large_A', 'pictureframe_large_B', 'pictureframe_medium', 'pictureframe_small_A', 'pictureframe_small_B', 'pictureframe_small_C',
    'pillow_A', 'pillow_B', 'rug_oval_A', 'rug_rectangle_stripes_A', 'rug_rectangle_B', 'shelf_B_large_decorated', 'shelf_B_small_decorated', 'shelf_B_large', 'table_low', 'table_medium', 'table_small'],
  [R]: ['bowl_dirty', 'bowl', 'crate', 'crate_carrots', 'crate_tomatoes', 'crate_cheese', 'crate_lettuce', 'crate_potatoes', 'dishrack_plates', 'dishrack', 'floor_kitchen', 'fridge_A', 'kitchencabinet', 'kitchencabinet_half',
    'kitchencounter_sink_backsplash', 'kitchencounter_straight_A_backsplash', 'kitchencounter_straight_A_decorated', 'kitchentable_A', 'jar_A_large', 'jar_B_medium', 'ketchup', 'mustard', 'pan_A', 'plate', 'plate_dirty',
    'pot_A_stew', 'pot_A', 'stove_multi', 'wall', 'wall_doorway', 'wall_window_open', 'wall_window_closed', 'wall_half', 'food_dinner', 'papertowel', 'door_A'],
  [A + 'Assets/gltf/']: ['sword_1handed', 'axe_1handed', 'axe_2handed', 'sword_2handed', 'staff', 'wand', 'dagger', 'shield_badge_color', 'shield_round', 'mug_full', 'spellbook_open'],
};
// 1) props: one document, each source scene becomes a named root node
const props = new (await import('@gltf-transform/core')).Document();
const scene = props.createScene('props');
for (const [dir, names] of Object.entries(PROPS)) {
  for (const n of names) {
    const doc = await io.read(dir + n + '.gltf');
    const map = mergeDocuments(props, doc);
    const src = doc.getRoot().listScenes()[0];
    const merged = map.get(src);
    const holder = props.createNode(n);
    merged.listChildren().forEach((c) => { merged.removeChild(c); holder.addChild(c); });
    scene.addChild(holder);
  }
}
props.getRoot().listScenes().filter((s) => s !== scene).forEach((s) => s.dispose());
props.getRoot().setDefaultScene(scene);
await props.transform(unpartition(), dedup(), weld(), prune(), quantize(), reorder({ encoder: MeshoptEncoder }));
props.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(OUT + 'props.glb', props);
console.log('props.glb', (fs.statSync(OUT + 'props.glb').size / 1024).toFixed(0), 'KB', props.getRoot().listTextures().length, 'textures');
// 2) characters with only the animations we use
const KEEP = ['Idle', 'Walking_A', 'Running_A', 'Sit_Chair_Idle', 'Sit_Floor_Idle', 'Lie_Idle', 'Interact', 'PickUp', 'Use_Item', 'Cheer', 'Unarmed_Melee_Attack_Punch_A',
  '1H_Melee_Attack_Chop', '2H_Melee_Idle', 'Spellcasting', 'Jump_Full_Short', 'Hit_A'];
for (const c of ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded']) {
  const doc = await io.read(A + 'Characters/gltf/' + c + '.glb');
  doc.getRoot().listAnimations().forEach((a) => { if (KEEP.indexOf(a.getName()) < 0) a.dispose(); });
  await doc.transform(resample(), dedup(), prune({ keepLeaves: true }), quantize(), reorder({ encoder: MeshoptEncoder }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(OUT + c.toLowerCase() + '.glb', doc);
  console.log(c, (fs.statSync(OUT + c.toLowerCase() + '.glb').size / 1024).toFixed(0), 'KB', doc.getRoot().listAnimations().length, 'anims', doc.getRoot().listMeshes().map(m => m.getName()).join(','));
}
