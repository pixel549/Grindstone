import * as THREE from 'three';
import { HeroKit, Hero, GRIPS } from './hero3d.js';
window.GRIPS = GRIPS;
const W = 1400, H = 700;
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true;
document.body.style.margin = 0; document.body.appendChild(r.domElement);
const sc = new THREE.Scene(); sc.background = new THREE.Color(0x15110d);
sc.add(new THREE.HemisphereLight(0xfff1dc, 0x2a2018, 1.15));
const key = new THREE.DirectionalLight(0xffe4c0, 2.3); key.position.set(-3, 5, 4); key.castShadow = true; Object.assign(key.shadow.camera, { left: -8, right: 8, top: 4, bottom: -1 }); key.shadow.mapSize.set(2048, 2048); sc.add(key);
const fl = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.MeshStandardMaterial({ color: 0x3a2e24 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; sc.add(fl);
const cam = new THREE.PerspectiveCamera(22, W / H, 0.1, 100);
const kit = new HeroKit('../3d/q/');
const heroes = [];
window.RUN = async (specs, clip, t, camSpec) => {
  heroes.forEach((h) => sc.remove(h.root)); heroes.length = 0;
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]; const h = new Hero(kit); await h.build(s.look, s.gear || {});
    h.root.position.set((i - (specs.length - 1) / 2) * 1.25, 0, 0); h.root.rotation.y = s.ry != null ? s.ry : 0.35;
    if (s.axes) { ['hand_r','hand_l'].forEach((n) => { const ax = new THREE.AxesHelper(0.35 / 1); ax.material.depthTest = false; ax.renderOrder = 9; h.root.updateMatrixWorld(true); const b = h.boneBy[n]; const ws = new THREE.Vector3(); b.getWorldScale(ws); ax.scale.setScalar(1 / ws.x); b.add(ax); }); }
    sc.add(h.root); h.play(s.clip || clip, { fade: 0 }); h.mixer.update(s.t != null ? s.t : t); heroes.push(h);
  }
  const c = camSpec || { y: 1.0, d: 9.5, ty: 0.95 };
  cam.position.set(c.x || 0, c.y, c.d); cam.lookAt(c.tx || 0, c.ty, 0); cam.updateProjectionMatrix();
  r.render(sc, cam);
  return heroes.map((h) => h.height().toFixed(2));
};
window.READY = true;
window.CAL = async (clip, t, sex) => {
  const h = new Hero(kit); await h.build({ sex: sex || 'm', skin: '#e3b48f', hair: 'bald', hairColour: '#222', beard: 'none' }, {});
  sc.add(h.root); h.play(clip, { fade: 0 }); h.mixer.update(t); h.root.updateMatrixWorld(true);
  const out = {};
  for (const side of ['r', 'l']) {
    const hand = h.boneBy['hand_' + side];
    const P = (n) => hand.worldToLocal(h.boneBy[n + '_' + side].getWorldPosition(new THREE.Vector3()));
    const i1 = P('index_01'), p1 = P('pinky_01'), m1 = P('middle_01'), m2 = P('middle_02'), i2 = P('index_02'), p2 = P('pinky_02'), r2 = P('ring_02'), th = P('thumb_02');
    const dir = i1.clone().sub(p1).normalize();
    const pt = new THREE.Vector3().add(i1).add(p1).add(m1).add(i2).add(m2).add(r2).add(p2).multiplyScalar(1 / 7);
    const nrm = i1.clone().cross(p1).normalize();
    const ws = new THREE.Vector3(); hand.getWorldScale(ws);
    out[side] = { dir: dir.toArray().map((v) => +v.toFixed(3)), pt: pt.toArray().map((v) => +v.toFixed(4)), nrm: nrm.toArray().map((v) => +v.toFixed(3)), m1: m1.toArray().map((v) => +v.toFixed(4)), th: th.toArray().map((v) => +v.toFixed(4)), ws: +ws.x.toFixed(4) };
  }
  sc.remove(h.root);
  return out;
};
window.WEPS = async () => {
  heroes.forEach((h) => sc.remove(h.root)); heroes.length = 0;
  const w = await kit.get('weapons.glb'); const g = new THREE.Group(); sc.add(g);
  w.scene.children.forEach((c, i) => { const o = c.clone(true); const bb = new THREE.Box3().setFromObject(o); const L = bb.max.y - bb.min.y; o.scale.multiplyScalar(1 / L); o.position.set((i % 12) * 1.1 - 6, i < 12 ? 1.6 : 0.2, 0); g.add(o); o.add(new THREE.AxesHelper(0.4)); });
  cam.position.set(0, 1.4, 12); cam.lookAt(0, 1.2, 0); cam.fov = 40; cam.updateProjectionMatrix(); r.render(sc, cam);
  return w.scene.children.map((c) => c.name);
};
window.HELD = () => heroes.map((h) => { const o = h.held.main; if (!o) return null; const b = new THREE.Box3().setFromObject(o); return { min: b.min.toArray().map((v) => +v.toFixed(2)), max: b.max.toArray().map((v) => +v.toFixed(2)), vis: o.visible, kids: o.children.length, s: o.scale.x.toFixed(3), inner: o.children[0] && o.children[0].scale.x.toFixed(3) }; });
window.CAL2 = async (clip, t, sex, upDeg) => {
  const h = new Hero(kit); await h.build({ sex: sex || 'm', skin: '#e3b48f', hair: 'bald', hairColour: '#222', beard: 'none' }, {});
  sc.add(h.root); h.play(clip, { fade: 0 }); h.mixer.update(t); h.root.updateMatrixWorld(true);
  const hand = h.boneBy.hand_r; const q = hand.getWorldQuaternion(new THREE.Quaternion());
  const a = (upDeg || 30) * Math.PI / 180; const w = new THREE.Vector3(0, Math.sin(a), Math.cos(a));
  const loc = w.clone().applyQuaternion(q.clone().invert());
  // and where hand-local +Z / +Y / +X point in the world
  const ax = (v) => new THREE.Vector3(...v).applyQuaternion(q).toArray().map((x) => +x.toFixed(2));
  sc.remove(h.root);
  return { want: loc.toArray().map((x) => +x.toFixed(3)), Xw: ax([1, 0, 0]), Yw: ax([0, 1, 0]), Zw: ax([0, 0, 1]) };
};
