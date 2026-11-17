// Packs the Quaternius hero (Universal Base Characters + Modular Outfits + UAL + Medieval Weapons, CC0)
// into small meshopt/webp GLBs under assets/3d/q/. Skin and hair textures are flattened to grey so the
// app can tint them to any colour.
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, resample, textureCompress, mergeDocuments, unpartition, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const M = process.env.MIRROR || '/home/claude/dl/Dallolz_moorfall-assets/';
const EXTRA = process.env.EXTRA || '/home/claude/work/';
const OUT = process.env.OUT || '/home/claude/grindstone/assets/3d/q/';
fs.mkdirSync(OUT + 'tex', { recursive: true });

// grey-out a texture so that (texture × colour) gives that colour on average
async function greyed(buf, target) {
  const img = sharp(buf).removeAlpha().greyscale();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const vals = []; for (let i = 0; i < data.length; i += 7) if (data[i] > 24) vals.push(data[i]);
  vals.sort((a, b) => a - b); const med = vals[vals.length >> 1] || 128;
  const k = (target * 255) / med;
  const outB = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0, j = 0; i < data.length; i++, j += 3) { const v = Math.min(255, Math.round(data[i] * k)); outB[j] = outB[j + 1] = outB[j + 2] = v; }
  return sharp(outB, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}
async function finish(doc, name, opts = {}) {
  const po = { keepLeaves: !!opts.keepLeaves, keepAttributes: !!opts.keepAttributes };
  const steps = [dedup(), prune(po), prune(po), weld()];
  if (doc.getRoot().listTextures().length) steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }));
  if (opts.resample) steps.unshift(resample());
  steps.push(quantize(), reorder({ encoder: MeshoptEncoder }), prune(po));
  await doc.transform(...steps);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(OUT + name, doc);
  console.log(name, (fs.statSync(OUT + name).size / 1024).toFixed(0) + ' KB');
}
async function greyMats(doc, test, target) {
  for (const m of doc.getRoot().listMaterials()) {
    if (!test.test(m.getName())) continue;
    const t = m.getBaseColorTexture(); if (!t || t.getExtras().greyed) continue;
    t.setImage(await greyed(Buffer.from(t.getImage()), target)).setMimeType('image/png'); t.setExtras({ greyed: true });
  }
}

// 1) bodies: skin + hair greyed (eyebrows share the hair material)
for (const [src, dst] of [['Superhero_Male', 'body_m'], ['Superhero_Female', 'body_f']]) {
  const doc = await io.read(M + 'characters/' + src + '.glb');
  await greyMats(doc, /Superhero/, 0.8); await greyMats(doc, /Hair/, 0.72);
  doc.getRoot().listAnimations().forEach((a) => { a.listChannels().forEach((c) => c.dispose()); a.listSamplers().forEach((x) => x.dispose()); a.dispose(); });
  await finish(doc, dst + '.glb');
}
// 2) outfits: the exposed skin (MI_Regular_*) greyed the same way so hands and neck match the face
for (const o of ['Male_Peasant', 'Male_Ranger', 'Female_Peasant', 'Female_Ranger']) {
  const doc = await io.read(M + 'outfits/' + o + '.glb');
  await greyMats(doc, /Regular/, 0.8);
  doc.getRoot().listAnimations().forEach((a) => { a.listChannels().forEach((c) => c.dispose()); a.listSamplers().forEach((x) => x.dispose()); a.dispose(); });
  await finish(doc, o.toLowerCase() + '.glb');
}
// 3) hair: tiny, untextured (the app gives them the body's hair material)
{
  const doc = new Document(); const scene = doc.createScene('hair');
  for (const h of ['Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_SimpleParted', 'Hair_Long', 'Hair_Buns', 'Hair_Beard']) {
    const d = await io.read(M + 'hair/' + h + '.glb');
    const map = mergeDocuments(doc, d); const s = map.get(d.getRoot().listScenes()[0]);
    const holder = doc.createNode(h); s.listChildren().forEach((c) => { s.removeChild(c); holder.addChild(c); }); scene.addChild(holder);
  }
  doc.getRoot().listScenes().filter((s) => s !== scene).forEach((s) => s.dispose());
  doc.getRoot().setDefaultScene(scene);
  await doc.transform(unpartition());
  await finish(doc, 'hair.glb', { keepAttributes: true }); // untextured here, textured by the head's material in the app: keep the UVs
}
// 4) animations: only the clips Grindstone plays, no meshes
const CLIPS = {
  UAL1: ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sword_Idle', 'Sword_Attack', 'Punch_Jab', 'Punch_Cross', 'Hit_Chest', 'Hit_Head', 'Death01', 'Roll', 'Interact',
    'PickUp_Table', 'Spell_Simple_Idle_Loop', 'Spell_Simple_Shoot', 'Idle_Torch_Loop', 'Crouch_Fwd_Loop', 'Crouch_Idle_Loop', 'Dance_Loop', 'Sitting_Idle_Loop', 'Idle_Talking_Loop', 'Jump_Start', 'Jump_Land'],
  UAL2: ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Regular_Combo', 'Sword_Block', 'Idle_Shield_Loop', 'Shield_OneShot', 'Chest_Open', 'Consume', 'Hit_Knockback',
    'Yes', 'Idle_FoldArms_Loop', 'Melee_Hook', 'OverhandThrow', 'TreeChopping_Loop', 'Farm_Watering', 'Farm_Harvest', 'Walk_Carry_Loop', 'LayToIdle', 'Idle_No_Loop'],
};
for (const [f, keep] of Object.entries(CLIPS)) {
  const doc = await io.read(M + 'animations/' + f + '.glb'); const r = doc.getRoot();
  const killAnim = (a) => { a.listChannels().forEach((c) => c.dispose()); a.listSamplers().forEach((x) => x.dispose()); a.dispose(); };
  r.listAnimations().forEach((a) => { if (keep.indexOf(a.getName()) < 0) killAnim(a); });
  // same rig everywhere: rotations carry the motion; only the pelvis moves
  r.listAnimations().forEach((a) => a.listChannels().forEach((ch) => {
    const p = ch.getTargetPath(), n = ch.getTargetNode() && ch.getTargetNode().getName();
    if (p === 'scale' || (p === 'translation' && n !== 'pelvis')) { const smp = ch.getSampler(); ch.dispose(); if (smp) smp.dispose(); }
  }));
  r.listNodes().forEach((n) => { if (n.getMesh()) { n.setMesh(null); n.setSkin(null); } });
  r.listMeshes().forEach((m) => { m.listPrimitives().forEach((pr) => { pr.listAttributes().forEach((a) => a.dispose()); if (pr.getIndices()) pr.getIndices().dispose(); pr.dispose(); }); m.dispose(); }); r.listSkins().forEach((s) => s.dispose());
  r.listMaterials().forEach((m) => m.dispose()); r.listTextures().forEach((t) => t.dispose());
  await finish(doc, 'anim_' + f.toLowerCase() + '.glb', { resample: true, keepLeaves: true });
}
// 5) weapons: one file, one named root per weapon
{
  const doc = new Document(); const scene = doc.createScene('weapons');
  const add = async (path, name) => {
    const d = await io.read(path); const map = mergeDocuments(doc, d); const s = map.get(d.getRoot().listScenes()[0]);
    const holder = doc.createNode(name); s.listChildren().forEach((c) => { s.removeChild(c); holder.addChild(c); }); scene.addChild(holder);
  };
  for (const w of fs.readdirSync(M + 'weapons').filter((x) => x.endsWith('.glb'))) await add(M + 'weapons/' + w, w.replace('.glb', ''));
  for (const w of fs.readdirSync(EXTRA + 'wpn').filter((x) => x.endsWith('.glb'))) await add(EXTRA + 'wpn/' + w, w.replace('.glb', ''));
  doc.getRoot().listScenes().filter((s) => s !== scene).forEach((s) => s.dispose());
  doc.getRoot().setDefaultScene(scene);
  await doc.transform(unpartition());
  await finish(doc, 'weapons.glb');
}
// 6) alternate outfit dyes, loaded on demand
for (const n of ['T_Ranger_3_BaseColor', 'T_Peasant_2_BaseColor']) {
  await sharp(EXTRA + 'tex/' + n + '_1k.png').webp({ quality: 82 }).toFile(OUT + 'tex/' + n.replace('T_', '').replace('_BaseColor', '').toLowerCase() + '.webp');
}
console.log('dyes', fs.readdirSync(OUT + 'tex').map((f) => f + ' ' + (fs.statSync(OUT + 'tex/' + f).size / 1024 | 0) + 'KB').join(', '));
