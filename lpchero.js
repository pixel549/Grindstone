/* Grindstone — the LPC hero. Composites Universal LPC layers (baked by tools2d/bake_hero.py into 2d/hero/)
 * into animation sheets for a look and the gear worn, recolouring them with the LPC palettes.
 * Used by the 2D hearth, the portraits, the creator and the widget clip. */
(function (root) {
  'use strict';
  const ANIM = {
    walk: { n: 9, rows: 4 }, idle: { n: 2, rows: 4 }, sit: { n: 3, rows: 4 }, emote: { n: 3, rows: 4 },
    slash: { n: 6, rows: 4 }, thrust: { n: 8, rows: 4 }, spellcast: { n: 7, rows: 4 }, jump: { n: 5, rows: 4 },
    climb: { n: 6, rows: 1 }, hurt: { n: 6, rows: 1 },
  };
  const DIR = { up: 0, left: 1, down: 2, right: 3 };
  // When a layer has no frames for an animation, wear this instead (the jackets don't sit down, for one).
  const FALLBACK = { frock: 'shirt_l', trench: 'shirt_l', tabard: 'shirt_l', robe: 'tabard', belt: null, cape: null, charm: null, gem: null };
  const VAR_COLOUR = { 'dark gray': 'charcoal', gray: 'gray', 'forest green': 'forest', blue: 'navy', red: 'maroon', brown: 'walnut' };

  // ---------- the app's looks, in LPC terms ----------
  const SKIN = ['light', 'amber', 'taupe', 'bronze', 'brown', 'black', 'pale_green', 'lavender'];
  const HAIRC = ['black', 'dark_brown', 'chestnut', 'ginger', 'blonde', 'platinum', 'gray', 'red', 'blue', 'purple'];
  const OUTFIT = ['bluegray', 'maroon', 'forest', 'purple', 'tan', 'charcoal', 'teal', 'brown'];
  const METAL = ['iron', 'steel', 'steel', 'silver', 'gold'];
  const RCLOTH = ['walnut', 'forest', 'navy', 'purple', 'maroon'];

  const L = { base: '2d/hero/', idx: null, ready: null, imgs: {}, tint: {} };

  function init(base) {
    if (L.ready) return L.ready;
    if (base) L.base = base;
    L.ready = fetch(L.base + 'index.json').then((r) => r.json()).then((j) => { L.idx = j; return L; });
    L.ready.catch(() => { L.ready = null; });
    return L.ready;
  }
  function img(src) {
    if (!L.imgs[src]) L.imgs[src] = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = L.base + src; });
    return L.imgs[src];
  }
  const hex = (h) => { h = h.replace('#', ''); return (parseInt(h.slice(0, 2), 16) << 16) | (parseInt(h.slice(2, 4), 16) << 8) | parseInt(h.slice(4, 6), 16); };
  // Palette swap: every base ramp the sprite might be drawn in maps onto the target ramp (same as the generator).
  function colourMap(material, target, base) {
    const P = L.idx.palettes, B = L.idx.bases;
    let tp = P[material];
    if (target && target.indexOf(':') > 0) { const s = target.split(':'); tp = P[s[0]]; target = s[1]; }
    const pal = P[material];
    base = base || B[material];
    if (!pal || !tp || !target || !tp[target] || !pal[base]) return null;
    if (target === base && tp === pal) return null;
    const dst = tp[target][0].map(hex), m = new Map();
    pal[base].forEach((ramp) => {
      const src = ramp.map(hex);
      src.forEach((c, i) => { if (!m.has(c)) m.set(c, dst[dst.length === src.length ? i : Math.min(dst.length - 1, Math.round(i * (dst.length - 1) / Math.max(1, src.length - 1)))]); });
    });
    return m;
  }
  function recolour(image, maps) {
    const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
    const g = c.getContext('2d'); g.drawImage(image, 0, 0);
    if (!maps.length) return c;
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      let k = (p[i] << 16) | (p[i + 1] << 8) | p[i + 2];
      for (let j = 0; j < maps.length; j++) { const v = maps[j].get(k); if (v !== undefined) { k = v; break; } }
      p[i] = k >> 16; p[i + 1] = (k >> 8) & 255; p[i + 2] = k & 255;
    }
    g.putImageData(d, 0, 0);
    return c;
  }
  function layerImage(src, rec, colours) {
    const key = src + '|' + JSON.stringify(colours || {});
    if (L.tint[key]) return L.tint[key];
    L.tint[key] = img(src).then((im) => {
      const maps = [];
      if (rec && colours) {
        if (rec.material) { const m = colourMap(rec.material, colours.main, rec.base); if (m) maps.push(m); }
        else Object.keys(rec).forEach((slot) => { const s = rec[slot]; if (s && s.material && colours[slot]) { const m = colourMap(s.material, colours[slot], s.base); if (m) maps.push(m); } });
      }
      return recolour(im, maps);
    });
    return L.tint[key];
  }
  function has(id, body, anim) {
    const it = L.idx.items[id];
    const ls = it && it.layers[body];
    return !!ls && ls.some((l) => l.anims.indexOf(anim) >= 0);
  }
  // spec: [{ id, c: {main|color_1…: palette}, v: variant }]
  function sheet(spec, body, anim) {
    const A = ANIM[anim];
    const draws = [];
    spec.forEach((s0) => {
      let s = s0;
      // 2.26: kids' clothes only come walking; stood still, they wear the first walking frame
      if (!has(s.id, body, anim) && body === 'child' && has(s.id, body, 'walk')) {
        const it = L.idx.items[s.id], v = s.v && it.variants.indexOf(s.v) >= 0 ? s.v : it.variants[0];
        it.layers[body].forEach((l) => {
          if (l.anims.indexOf('walk') < 0) return;
          const src = it.rec ? l.base + (L.idx.folder.walk || 'walk') + '.png' : l.base + (L.idx.folder.walk || 'walk') + '/' + String(v).replace(/ /g, '_') + '.png';
          draws.push({ z: l.z, p: layerImage(src, it.rec, s.c), still: true });
        });
        return;
      }
      for (let hop = 0; hop < 3 && !has(s.id, body, anim); hop++) {
        const fb = FALLBACK[s.id];
        if (!fb) return;
        const col = s.v ? VAR_COLOUR[s.v] || s.v : (s.c && s.c.main) || 'charcoal';
        s = fb === 'tabard' ? { id: 'tabard', v: L.idx.items.tabard.variants.indexOf(col) >= 0 ? col : 'walnut' } : { id: fb, c: { main: col } };
      }
      if (!has(s.id, body, anim)) return;
      const it = L.idx.items[s.id];
      it.layers[body].forEach((l) => {
        if (l.anims.indexOf(anim) < 0) return;
        const folder = L.idx.folder[anim] || anim;
        const v = s.v && it.variants.indexOf(s.v) >= 0 ? s.v : it.variants[0];
        const src = it.rec ? l.base + folder + '.png' : l.base + folder + '/' + String(v).replace(/ /g, '_') + '.png';
        draws.push({ z: l.z, p: layerImage(src, it.rec, s.c) });
      });
    });
    draws.sort((a, b) => a.z - b.z);
    return Promise.all(draws.map((d) => d.p.catch(() => null))).then((ims) => {
      const c = document.createElement('canvas'); c.width = A.n * 64; c.height = A.rows * 64;
      const g = c.getContext('2d');
      ims.forEach((im, i) => {
        if (!im) return;
        if (!draws[i].still) { g.drawImage(im, 0, 0); return; }
        for (let r = 0; r < A.rows; r++) for (let f = 0; f < A.n; f++) g.drawImage(im, 0, (A.rows === 1 ? 2 : r) * 64, 64, 64, f * 64, r * 64, 64, 64);
      });
      return c;
    });
  }
  // All the sheets a hero needs.
  function build(spec, body, anims) {
    anims = anims || Object.keys(ANIM);
    return init().then(() => Promise.all(anims.map((a) => sheet(spec, body, a))).then((cs) => {
      const out = { body: body, sheets: {} };
      anims.forEach((a, i) => { out.sheets[a] = cs[i]; });
      return out;
    }));
  }

  // ---------- look + gear -> layers ----------
  function pick(arr, i) { return arr[Math.max(0, Math.min(arr.length - 1, i | 0))]; }
  function idxOf(arr, v, d) { const i = arr.indexOf(v); return i < 0 ? d : i; }
  // look: the app's look; gear: { weapon, head, body, charm } items or null; o.kit: show weapon and shield.
  // 2.26: kids and little ones (the LPC child body; the house draws little ones smaller). No gear, no beards.
  const KID_HAIR = { cropped: 'parted', parted: 'parted', shorn: 'parted', balding: 'parted', spiky: 'swoop', mohawk: 'swoop', messy: 'swoop', long: 'long', ponytail: 'long', buns: 'long', dreads: 'long', bob: 'bob', curly: 'curly', afro: 'curly' };
  const KID_SHIRT = { bluegray: 'blue', maroon: 'red', forest: 'green', purple: 'lavender', tan: 'white', charcoal: 'gray', teal: 'lightblue', brown: 'brown' };
  const KID_SKIRT = { bluegray: 'darkblue', maroon: 'maroon', forest: 'green', purple: 'lavender', tan: 'pink', charcoal: 'black', teal: 'lightblue', brown: 'red' };
  function dressKid(look, LOOKS) {
    const skin = LOOKS ? pick(SKIN, idxOf(LOOKS.skin, look.skin, 0)) : 'light';
    const hairc = LOOKS ? pick(HAIRC, idxOf(LOOKS.hairColour, look.hairColour, 1)) : 'dark_brown';
    const out = LOOKS ? pick(OUTFIT, idxOf(LOOKS.outfit, look.outfit, 0)) : 'bluegray';
    const skirt = look.legs ? look.legs === 'skirt' : look.sex === 'f';
    const s = [{ id: 'body', c: { main: skin } }, { id: 'head_c', c: { color_1: skin, color_2: 'brown' } },
      skirt ? { id: 'skirt_c', v: KID_SKIRT[out] } : { id: 'pants_c', v: out === 'brown' ? 'darkblue' : 'brown' }, { id: 'shirt_c', v: KID_SHIRT[out] }];
    if (look.extra === 'glasses') s.push({ id: 'glasses', v: 'black' });
    const h = KID_HAIR[look.hair];
    if (h) s.push({ id: 'hair_c_' + h, c: { main: hairc } });
    return { body: 'child', spec: s, kid: look.age };
  }
  function dress(look, gear, o) {
    o = o || {};
    look = look || {};
    gear = gear || {};
    const LOOKS = (root.G && root.G.LOOKS) || null;
    if (look.age === 'kid' || look.age === 'baby') return dressKid(look, LOOKS);
    const f = look.sex === 'f', body = f ? 'female' : 'male';
    const skin = LOOKS ? pick(SKIN, idxOf(LOOKS.skin, look.skin, 0)) : 'light';
    const hairc = LOOKS ? pick(HAIRC, idxOf(LOOKS.hairColour, look.hairColour, 1)) : 'dark_brown';
    const shirt = LOOKS ? pick(OUTFIT, idxOf(LOOKS.outfit, look.outfit, 0)) : 'bluegray';
    const s = [{ id: 'body', c: { main: skin } }, { id: f ? 'head_f' : 'head_m', c: { color_1: skin, color_2: 'brown' } }];
    const B = gear.body, H = gear.head, W = gear.weapon, C = gear.charm;
    const bt = B ? B.tier | 0 : -1, ht = H ? H.tier | 0 : -1;
    // clothes and armour
    if (!B) s.push({ id: 'shirt_s', c: { main: shirt } }, { id: 'pants', c: { main: 'walnut' } }, { id: 'shoes', c: { main: 'leather' } });
    else {
      const m = pick(METAL, bt), rc = pick(RCLOTH, bt), armour = B.art === 'armour', coat = B.art === 'coat';
      const plateLegs = armour && bt >= 3;
      s.push({ id: plateLegs ? 'legs_armour' : 'pants', c: { main: plateLegs ? m : pick(['walnut', 'brown', 'charcoal', 'navy', 'black'], bt) } });
      if (armour && bt >= 3) s.push({ id: 'feet_armour', c: { main: m } });
      else s.push({ id: bt >= 1 || armour || coat ? 'boots' : 'shoes', c: { main: bt >= 3 ? 'black' : 'brown' } });
      if (B.art === 'robe') {
        if (f) s.push({ id: 'robe', v: pick(['brown', 'forest green', 'blue', 'purple', 'red'], bt) });
        else s.push({ id: 'shirt_l', c: { main: shirt } }, { id: 'tabard', v: pick(['walnut', 'forest', 'navy', 'purple', 'maroon'], bt) });
      } else {
        s.push({ id: 'shirt_l', c: { main: coat ? 'charcoal' : shirt } });
        if (B.art === 'light') s.push({ id: 'leather', c: { color_1: pick(['leather', 'tan', 'brown', 'charcoal', 'black'], bt), color_2: m } });
        else if (coat) s.push(B.base === 'Oilskin' ? { id: 'trench', v: bt >= 3 ? 'dark gray' : 'gray' } : { id: 'frock', v: pick(['walnut', 'forest', 'navy', 'purple', 'maroon'], bt) });
        else if (armour) s.push({ id: B.base === 'Hauberk' ? 'mail' : B.base === 'Brigandine' ? 'legion' : 'plate', c: { main: m } });
      }
      if (armour && bt >= 3) s.push({ id: 'arms_armour', c: { main: m } });
      else if (bt >= 2 || armour) s.push({ id: 'bracers', c: { main: m } });
      if (armour && bt >= 2) s.push({ id: 'gloves', c: { main: m } });
      if (armour && bt >= 2) s.push({ id: 'pauldrons', c: { main: 'metal:' + (bt >= 4 ? 'gold' : m) } });
      if (bt >= 3) s.push({ id: 'cape', c: { main: bt >= 4 ? 'maroon' : 'navy' } });
    }
    // face
    const beard = !f && look.beard && look.beard !== 'none' ? 'beard_' + look.beard : null;
    if (beard && L.idx && L.idx.items[beard]) s.push({ id: beard, c: { main: hairc } });
    if (look.extra === 'glasses') s.push({ id: 'glasses', v: 'black' });
    if (look.extra === 'eyepatch') s.push({ id: 'eyepatch', v: 'black' });
    // hair, unless a hood or a great helm swallows it
    const hidesHair = H && (H.art === 'hood' || (H.art === 'helm' && ht >= 3));
    const hair = look.hair && look.hair !== 'bald' ? 'hair_' + look.hair : null;
    if (hair && !hidesHair && (!L.idx || L.idx.items[hair])) s.push({ id: hair, c: { main: hairc } });
    if (H) {
      const m = pick(METAL, ht);
      if (H.art === 'hood') s.push({ id: 'hood', c: { main: pick(['walnut', 'forest', 'navy', 'purple', 'maroon'], ht) } });
      else if (H.art === 'hat') s.push(H.base === 'Tricorn' ? { id: 'tricorne', v: pick(['brown', 'brown', 'black', 'navy', 'maroon'], ht) } : { id: 'cavalier', v: pick(['brown', 'brown', 'forest', 'black', 'maroon'], ht) });
      else if (H.art === 'helm') {
        if (H.base === 'Bascinet') s.push({ id: ht >= 3 ? 'bascinet' : 'bascinet_r', c: { main: m } });
        else { const id = pick(['kettle', 'nasal', 'barbuta', 'armet', 'greathelm'], ht); s.push(id === 'kettle' ? { id: id, c: { color_1: m, color_2: 'brown' } } : { id: id, c: { main: m } }); }
      } else if (H.art === 'crown') s.push(H.base === 'Crown' ? { id: 'crown', v: pick(['crown_gray', 'crown_gray', 'crown_blue', 'crown_red', 'crown_gold'], ht) } : { id: 'tiara', v: pick(['tiara_bronze', 'tiara_bronze', 'tiara_silver', 'tiara_silver', 'tiara_gold'], ht) });
      else if (H.art === 'mask') s.push({ id: 'mask', v: pick(['dark', 'dark', 'black', 'black', 'white'], ht) });
    }
    if (C) { const ct = C.tier | 0; s.push(C.art === 'phial' ? { id: 'gem', v: pick(['green', 'blue', 'purple', 'red', 'orange'], ct) } : { id: 'charm', v: pick(['iron', 'steel', 'silver', 'gold'], ct) }); }
    // arms, for portraits
    if (o.kit && W) {
      const wt = W.tier | 0, b = W.base;
      const two = b === 'Greatsword' || W.art === 'polearm' || W.art === 'staff';
      const wmap = {
        Longsword: { id: 'w_arming', v: pick(['iron', 'steel', 'steel', 'silver', 'gold'], wt) }, Greatsword: { id: 'w_longsword' }, Rapier: { id: 'w_rapier' }, Sabre: { id: 'w_saber' }, Dirk: { id: 'w_dagger' },
        Hatchet: { id: 'w_waraxe' }, 'Bearded Axe': { id: 'w_waraxe' }, Warhammer: { id: 'w_mace' },   // 2.21.1: the tool axe and hammer had walking frames only, so they vanished in a fight
        Mace: { id: 'w_mace' }, Cudgel: { id: 'w_mace' },
        Glaive: { id: 'w_halberd' }, Halberd: { id: 'w_halberd' }, Harpoon: { id: 'w_spear', v: pick(['dark', 'medium', 'medium', 'light', 'light'], wt) }, Boathook: { id: 'w_spear', v: 'dark' },
        'Lantern Staff': { id: 'w_crystal', v: pick(['orange', 'orange', 'blue', 'blue', 'purple'], wt) }, 'Driftwood Staff': { id: 'w_gnarled', v: pick(['dark', 'medium', 'medium', 'light', 'light'], wt) },
      };
      if (wmap[b]) s.push(wmap[b]);
      if (!two && b !== 'Dirk' && b !== 'Rapier') {
        if (W.art === 'blade') s.push({ id: 's_heater' }, { id: 's_paint', c: { main: pick(['walnut', 'forest', 'navy', 'purple', 'maroon'], wt) } }, { id: 's_trim', c: { main: pick(METAL, wt) } });
        else s.push({ id: 's_round', v: pick(['brown', 'brown', 'black', 'silver', 'gold'], wt) });
      }
    }
    if (o.tool === 'can') s.push({ id: 't_can' });
    if (o.tool === 'scythe') s.push({ id: 'w_scythe' });
    return { body: body, spec: s };
  }

  // A standing portrait: walk frame 0, facing down, drawn at an integer scale onto a canvas.
  function frame(sheets, anim, dir, i) {
    const A = ANIM[anim], c = sheets.sheets[anim];
    if (!c) return null;
    const row = A.rows === 1 ? 0 : dir;
    return { img: c, sx: (i % A.n) * 64, sy: row * 64 };
  }

  root.LPC = { init: init, build: build, sheet: sheet, dress: dress, frame: frame, ANIM: ANIM, DIR: DIR, SKIN: SKIN, HAIRC: HAIRC, has: has, state: L };
})(typeof window !== 'undefined' ? window : globalThis);
