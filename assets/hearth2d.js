/* Grindstone — the Hearth in 2D. A top-down LPC house, cut away so you can see in, laid out however Jake builds it,
 * whose state mirrors his real chores. The hero wanders it: goes to what he's neglecting and frets about it, potters at
 * what's fine, thinks back on what he's done today (in emoji, over his head). Whoever else lives there wanders too, and
 * Ruby and Kermit get on with being parrots. Tap anything with a star to see the quest behind it.
 * Art: LPC Revised (ElizaWy) for the house, Universal LPC for the people (see lpchero.js), the birds drawn by hand. */
(function (root) {
  'use strict';
  const T = 32, FEET = 58;
  let WT = 34, HT = 27, WW = WT * T, WH = HT * T;   // 2.13: the world grows as he buys land (set in _layout)
  const SEASON = (d) => { const m = d.getMonth(); return m === 11 || m <= 1 ? 'summer' : m <= 4 ? 'autumn' : 'spring'; }; // Albany doesn't do snow
  const WING_WALLS = { garage: ['wall.tin', 'wall.tin', 'wall.brick', 'wall.brick', 'wall.4', 'wall.5'], shed: ['wall.timber', 'wall.tin', 'wall.timber', 'wall.stone', 'wall.4', 'wall.5'] };
  const WING_FLOORS = { garage: ['floor.dirt', 'floor.0', 'floor.0', 'floor.rubber', 'floor.5', 'floor.5'], shed: ['floor.dirt', 'floor.dirt', 'floor.timber', 'floor.2', 'floor.5', 'floor.5'] };
  const WINGS = ['garage', 'pool', 'shed', 'garden', 'grill', 'pond', 'tower'];
  // what he frets at, for each chore
  // which tags show which conditions (tap id -> chores that colour it)
  const TAG_FEAT = { sink: ['dishes'], laundry: ['laundry'], fridge: ['fridge'], aviary: ['aviary', 'birds'], bag: ['gym'], weights: ['gym'], desk: ['study'], bookshelf: ['study'], lawn: ['lawn'] };
  const FEAT_K = { lawn: ['lawnlook'], birds: ['aviary', 'dish'], aviary: ['aviary'], fridge: ['fridge'], dishes: ['sink'], laundry: ['washer', 'line'], gym: ['bag', 'weights'], study: ['desk', 'bookshelf'], reno: ['renojob', 'workbench'] };
  const ANIM_FPS = { walk: 11, idle: 1.6, sit: 0, emote: 4, slash: 10, thrust: 10, spellcast: 9, jump: 9, climb: 8, hurt: 8 };
  const DIRS = { up: 0, left: 1, down: 2, right: 3 };
  const NPC_IDLE = ['☕', '📖', '🎵', '💭', '🍪', '🌿', '🧶', '🎲', '📺', '🙂'];
  // Meals pull the household to the table; bedtime sends them to bed (the hero stays up a bit later).
  const MEALS = [[7, 8.25, '🥣'], [12.25, 13, '🥪'], [18, 19.25, '🍽️']];
  const mealNow = (h) => { const m = MEALS.find((x) => h >= x[0] && h < x[1]); return m ? m[2] : null; };
  const bedtime = (h, hero) => (hero ? h >= 22.5 || h < 6 : h >= 22 || h < 6.5);
  const TOPICS = ['☕', '📺', '⚽', '🎮', '🌧️', '🍕', '📚', '🦜', '🏡', '💼', '🎣', '🎵', '🌊', '🚗', '🐟', '🧶', '🌻', '🍰'];
  const REACT = ['😂', '🤔', '👍', '😮', '🙄', '❤️', '😆', '🤷', '😅', '👌'];
  const SEATS = ['ktable', 'chair', 'greenchair', 'throne'];
  const BEDS = ['bed', 'sparebed'];
  const px = (c) => c * T + T / 2;
  const rnd = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };
  const G = () => root.G;
  // which piece of the estate a sprite key belongs to: 'desk.3' → desk, 'aviary.2.b' → aviary, 'wall.4' → walls, a fence → yard
  function estOfKey(k) {
    const p = k.split('.')[0], E = G() && G().ESTATE;
    if (!E) return null;
    if (p === 'wall' || p === 'floor') return /^(wall|floor)\.\d$/.test(k) ? p + 's' : null;
    if (p === 'fence') return 'yard';
    return E[p] && /^[a-z]+\.\d/.test(k) ? p : null;
  }
  const hourNow = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  const isNight = (h) => h >= 19.5 || h < 6.5;
  const pickW = (arr) => { let tot = arr.reduce((a, c) => a + c.w, 0), x = Math.random() * tot; for (let i = 0; i < arr.length; i++) { x -= arr[i].w; if (x <= 0) return arr[i]; } return arr[0] || null; };

  class House2D {
    constructor(el, o) {
      this.el = el;
      this.o = Object.assign({ base: '2d/', state: {}, mind: {}, estate: { t: {}, w: {} }, house: null, npcs: [], oraclePortal: false, oracleBarks: [] }, o || {});
      this.alive = true;
      this.active = true;
      this.t = 0;
      this.k = 0; // zoom: device pixels per art pixel (0 = auto)
      this.cam = { x: 13 * T, y: 10 * T, manual: 0 };
      this.preview = null;
      this.focusK = null;
      this.fx = [];
      this.relics = {};
      this.edit = null;
      this.starsOn = this.o.stars !== false;
      this.npcs = [];
      this.birds = [];
      this.bad = {}; // spots he couldn't reach lately
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'h2d';
      this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
      el.appendChild(this.canvas);
      this.g = this.canvas.getContext('2d');
      this.season = SEASON(new Date());
      this._bind();
      this.ready = this._load().then(() => {
        this._layout();
        this._resize();
        const bed = bedtime(hourNow(), true) && this._beds(this.hero)[0];
        if (bed) { this._place(bed, true, { sleep: true }); this.hero.next = 60; }
        else { this._place(this.spots.couch ? 'couch' : this._anySpot(), true); this.hero.next = 0.5; }
        this._syncNpcs();
        this._raf = requestAnimationFrame((t) => this._frame(t));
        if (this.o.onReady) this.o.onReady();
        return this;
      }).catch((e) => { if (this.o.onError) this.o.onError(e); throw e; });
    }

    // ---------------------------------------------------------------- loading
    _load() {
      return Promise.all([House2D.assets(this.o.base), this._buildHero()]).then(([a]) => { this.atlas = a.atlas; this.spr = a.spr; });
    }
    _buildHero() {
      const look = this.o.look || {}, gear = this.o.gear || {};
      const d = root.LPC.dress(look, gear, { kit: false }), ds = root.LPC.dress(look, gear, { kit: false, tool: 'scythe' });
      const sig = JSON.stringify([d.spec, d.body]);
      if (this.hero && this.heroSig === sig) return Promise.resolve();
      return Promise.all([root.LPC.build(d.spec, d.body), root.LPC.build(ds.spec, ds.body, ['walk'])]).then(([h, s]) => {
        this.heroSig = sig;
        const prev = this.hero;
        this.hero = Object.assign(prev || this._actor('hero'), { sheets: h.sheets, scythe: s.sheets.walk });
      });
    }
    _actor(id) { return { id: id, x: 13 * T + 16, y: 7 * T + 16, dir: 'down', anim: 'idle', ft: 0, path: [], spot: null, next: 1, think: 3, bub: null }; }
    setLook(look, gear) { this.o.look = look; this.o.gear = gear; return this._buildHero(); }
    has(k) { return !!(this.spr && this.spr[k]); }

    // ---------------------------------------------------------------- state from the app
    tier(k) {
      if (this.preview && this.preview.key === k) return this.preview.tier;
      const e = this.o.estate || { t: {}, w: {} };
      if (WINGS.indexOf(k) >= 0 && !(e.w && e.w[k])) return -1;
      return (e.t && e.t[k]) | 0;
    }
    setState(s) { this.o.state = s || {}; if (this.atlas) this._layout(); }
    setMind(m) { this.o.mind = m || {}; }
    setEstate(e) { this.o.estate = e || { t: {}, w: {} }; if (this.atlas) this._layout(); }
    setHouse(h) { this.o.house = h; if (this.atlas) { this._layout(); this._settle(); } }
    setNpcs(list) { this.o.npcs = list || []; if (this.atlas) this._syncNpcs(); }
    setDecor() { /* relics live in the house now */ }
    setEdit(e) {
      const was = !!this.edit;
      this.edit = e || null;
      if (!!this.edit !== was) { this.staticDirty = true; if (this.atlas) this._layout(); }
    }
    setStars(on) { this.starsOn = !!on; }
    setOraclePortal(on) { if (this.o.oraclePortal !== !!on) { this.o.oraclePortal = !!on; if (this.atlas) this._layout(); } }
    setOracleBarks(lines) { this.o.oracleBarks = Array.isArray(lines) ? lines.slice() : []; }
    previewItem(k, t, fin) { this.preview = { key: k, tier: t, fin: fin }; this._layout(); this.focus(k); }
    endPreview() { this.preview = null; this._layout(); this.unfocus(); }
    setActive(a) { this.active = !!a; if (a) this._resize(); }
    dispose() { this.alive = false; cancelAnimationFrame(this._raf); window.removeEventListener('resize', this._onResize); if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas); }

    // ---------------------------------------------------------------- the map
    _house() { return this.o.house || (G() && G().houseDefault ? Object.assign(G().houseDefault(), { live: null }) : { rooms: [], doors: [], items: [] }); }
    _sprOf(it, f) {
      if (f.relic) return null;
      if (f.est) {
        const t = Math.max(0, this.tier(f.est));
        return f.cage ? f.est + '.' + t + '.b' : f.est + '.' + t;
      }
      return f.s.indexOf('*') >= 0 ? f.s.replace('*', this.season) : f.s;
    }
    _layout() {
      const S = this.o.state || {}, H = this._house(), Gm = G();
      const pv = this.preview && this.preview.key;
      const lot = this.tier('garden') >= 0 || ['garden', 'grill', 'pond', 'tower'].indexOf(pv) >= 0;
      const land = this.o.estate && this.o.estate.land && this.o.estate.land.lv ? this.o.estate.land : null;
      const geom = this.geom = Gm.houseGeom(H, land || lot);
      if (geom.wt !== WT || geom.ht !== HT) { WT = geom.wt; HT = geom.ht; WW = WT * T; WH = HT * T; this.stat = null; }
      this.lotOpen = lot;
      const objs = [], walls = [];
      const add = (o) => { objs.push(o); return o; };
      const reno = S.reno == null ? 3 : S.reno;
      this.spots = {};
      this.objById = {};
      const roomOfCell = (x, y) => { const i = geom.at(x, y); return i >= 0 ? H.rooms[i] : null; };
      H.items.forEach((it) => {
        const f = Gm.furnOf(it);
        if (!f) return;
        let live = it.live !== false;
        if (f.free && f.free.wing && pv === f.free.wing) live = true; // trying the pool on
        if (f.reno && reno > 0) live = false;
        const ghost = !live;
        if (ghost) return; // things he doesn't own yet stay out of sight, in the layout editor too
        const flip = !!it.flip;
        const key = this._sprOf(it, f);
        let sw = 20, sh = 20;
        if (key) { const r = this.spr[key]; if (r) { sw = r[2]; sh = r[3]; } }
        else if (f.relic) { const im = this._relicImg(f.relic); if (im) { sw = im.width; sh = im.height; } }
        let ax, ay, room = null;
        if (f.at === 'wall') { room = roomOfCell(it.x, it.y); if (!room) return; ax = (it.x + f.w / 2) * T; ay = (room.y0 + 2) * T + (f.dy || 0); }
        else {
          room = roomOfCell(it.x, it.y);
          ax = (it.x + f.w / 2) * T; ay = (it.y + f.h) * T + (f.dy || 0);
          if (f.fill && sw <= (f.w - 1) * T + 4) {
            const cw = Math.max(1, Math.ceil((sw - 2) / T));
            ax = flip ? (it.x + f.w - cw / 2) * T : (it.x + cw / 2) * T;
            for (let c = 0; c < f.w - cw; c++) {
              const cx = flip ? it.x + c : it.x + cw + c;
              add({ s: 'counter', ax: cx * T + T / 2, ay: (it.y + f.h) * T, item: it.id, id: f.tap, ghost: ghost });
            }
          }
        }
        const ob = { s: key, relic: f.relic, ax: ax, ay: ay, sw: sw, sh: sh, id: f.tap || null, item: it.id, k: it.k, flip: flip, flat: !!f.flat, ghost: ghost, wall: f.at === 'wall', f: f, room: room ? room.id : null, est: f.est };
        if (f.flatBelow) ob.flat = this.tier(f.est) < (f.est === 'garden' ? 3 : 9);
        if (f.at === 'wall') walls.push(ob); else add(ob);
        this.objById[it.id] = ob;
        if (f.cage) add({ s: f.est + '.' + Math.max(0, this.tier(f.est)) + '.f', ax: ax, ay: ay + 1, front: true, id: f.tap, item: it.id, ghost: ghost, flip: flip });
        if (ghost) return;
        // the state of things
        if (it.k === 'sink') { const dl = S.dishes || 0; if (dl > 0.15) add({ over: 1, id: 'sink', item: it.id, s: 'dishes.' + (dl >= 0.75 ? 2 : dl >= 0.4 ? 1 : 0), ax: ax + 10, ay: ay - 8, z: 1, flies: dl >= 1 }); }
        if (it.k === 'basket') { const ll = S.laundry || 0; if (ll > 0.15) add({ over: 1, id: 'laundry', item: it.id, s: 'clothespile.' + (ll >= 0.75 ? 2 : ll >= 0.4 ? 1 : 0), ax: ax + 12, ay: ay + 8 }); }
        if (it.k === 'line' && (S.laundry || 0) >= 0.4) ob.s = 'line.empty';
        if (it.k === 'aviary') { const al = S.aviary || 0; if (al > 0.15) add({ over: 1, id: 'aviary', item: it.id, s: 'droppings.' + (al >= 0.75 ? 2 : al >= 0.4 ? 1 : 0), ax: ax, ay: ay - 8, z: 1 }); }
        if (it.k === 'bag' && (S.gym || 0) >= 0.45) add({ over: 1, id: 'bag', item: it.id, s: 'cobweb', ax: ax + 6, ay: ay - 40, z: 2 });
        if (it.k === 'desk' && (S.study || 0) >= 0.45) add({ over: 1, id: 'desk', item: it.id, s: 'cobweb', ax: ax + Math.min(40, sw / 2) - 6, ay: ay - sh + 18, z: 2 });
        if (it.k === 'renojob') add({ over: 1, id: 'reno', item: it.id, s: 'painttins', ax: ax + (flip ? -26 : 26), ay: ay + 4 });
        // where he (or they) can do something with it
        if (f.use) {
          const u = f.use;
          const ux = flip ? it.x + f.w - 1 - u.x : it.x + u.x, uy = (f.at === 'wall' ? room.y0 : it.y) + u.y;
          let seat = null;
          if (u.seat) seat = [ax + (flip ? -u.seat[0] : u.seat[0]), ay + u.seat[1]];
          if (u.swim) seat = [ax, ay - Math.max(14, Math.round(sh * 0.6))];
          const dir = flip && (u.d === 'left' || u.d === 'right') ? (u.d === 'left' ? 'right' : 'left') : u.d;
          const sk = this.spots[it.k] ? it.k + '#' + it.id : it.k;
          this.spots[sk] = { k: sk, kind: it.k, item: it.id, cell: [ux, uy], inside: !!u.in, dir: dir, anim: u.a, frame: u.f, seat: seat, seatSy: u.front ? ay + 0.3 : null, ax: ax, ay: ay, icon: u.i, leisure: u.l || 0, swim: !!u.swim, perch: !!u.perch, room: roomOfCell(ux, uy) ? roomOfCell(ux, uy).id : null, sit: u.a === 'sit' };
        }
      });
      // fences round the plot
      const yt = Math.max(0, this.tier('yard'));
      const fenceK = ['fence.broken', 'fence.wood', 'fence.picket', 'fence.picket', 'fence.gold', 'fence.golden'][yt];
      // with more land bought the fence runs right round it, and the one between the plot and the side lot comes down
      const FX = land ? land.x1 + 1 : 24, FY = land ? land.y1 + 1 : 26;
      for (let x = 0; x <= FX; x++) add({ s: fenceK, ax: px(x), ay: FY * T + 28, fence: true });
      for (let y = 1; y <= FY; y++) {
        add({ s: fenceK, ax: 4, ay: y * T + 28, side: true, fence: true });
        if (land) add({ s: fenceK, ax: FX * T + 4, ay: y * T + 28, side: true, fence: true });
        else if (!lot || y < 19 || y > 22) add({ s: fenceK, ax: 24 * T + 28, ay: y * T + 28, side: true, fence: true });
      }
      // the lawn: open grass in the plot
      const blocked = new Uint8Array(WT * HT);
      H.items.forEach((it) => {
        const o = this.objById[it.id];
        if (!o || o.ghost) return;
        const ft = Gm.footOf(it, o.f);
        if (!ft) return;
        for (let y = ft[1]; y <= ft[3]; y++) for (let x = ft[0]; x <= ft[2]; x++) if (x >= 0 && y >= 0 && x < WT && y < HT) blocked[y * WT + x] = o.flat ? 2 : 1;
      });
      // The Oracle's pillar belongs to the player's Hearth, not a companion's visit.
      // Reserve a clear outdoor cell so the player can walk up to it from any house layout.
      const previousOracle = this.oracle;
      this.oracle = null;
      if (this.o.oraclePortal) {
        const candidates = [], heroCell = this.hero ? this._cellOf(this.hero) : null;
        for (let y = 16; y <= Math.min(HT - 2, 24); y++) for (let x = 17; x <= Math.min(WT - 2, 24); x++) {
          const i = y * WT + x;
          const underHero = heroCell && heroCell[0] === x && heroCell[1] === y;
          const underPerson = this.npcs.some((n) => { const p = this._cellOf(n); return p[0] === x && p[1] === y; });
          if (!underHero && !underPerson && geom.kind(x, y) === 'out' && geom.open(x, y) && !blocked[i]) candidates.push({ x: x, y: y, d: Math.pow(x - 22, 2) + Math.pow(y - 20, 2) });
        }
        candidates.sort((a, b) => a.d - b.d);
        const cell = candidates[0];
        if (cell) {
          blocked[cell.y * WT + cell.x] = 1;
          const ax = px(cell.x), ay = (cell.y + 1) * T;
          this.oracle = previousOracle && previousOracle.x === ax && previousOracle.y === ay ? previousOracle : { x: ax, y: ay, bub: null, next: 18 + Math.random() * 18, lastBark: '' };
          add({ s: 'x.oracleportal', ax: ax, ay: ay, sw: 38, sh: 54, id: 'oracle', cell: [cell.x, cell.y], oraclePortal: true });
        }
      }
      this.blocked = blocked;
      const lawnCells = [], isLawn = new Uint8Array(WT * HT);
      for (let y = Gm.PLOT.y0; y <= Gm.PLOT.y1; y++) for (let x = Gm.PLOT.x0; x <= Gm.PLOT.x1; x++) {
        if (geom.kind(x, y) !== 'out' || blocked[y * WT + x]) continue;
        lawnCells.push([x, y]); isLawn[y * WT + x] = 1;
      }
      this.lawnCells = lawnCells; this.isLawn = isLawn;
      this.lawnRect = this._bestRect(isLawn);
      if (this.lawnRect) {
        const L = this.lawnRect;
        this.spots.lawnlook = { k: 'lawnlook', kind: 'lawnlook', cell: [Math.floor((L.x0 + L.x1) / 2), Math.floor((L.y0 + L.y1) / 2)], dir: 'down', anim: 'idle', icon: '🌿', leisure: 0, feat: 'lawn' };
        this.spots.mow = { k: 'mow', kind: 'mow', cell: [L.x0, L.y0], dir: 'right', anim: 'walk', mow: true, icon: '🌿', leisure: 0.6, feat: 'lawn' };
      }
      const lv = S.lawn || 0, R = rnd(7);
      const tufts = lv < 0.15 ? 0 : Math.round(lawnCells.length * (lv < 0.45 ? lv * 0.9 : 0.4 + lv * 1.1) * 0.55);
      for (let i = 0; i < tufts && lawnCells.length; i++) {
        const c = lawnCells[Math.floor(R() * lawnCells.length)];
        const big = lv >= 1 ? (R() < 0.5 ? 3 : 2) : lv >= 0.7 ? (R() < 0.4 ? 2 : 1) : lv >= 0.45 ? (R() < 0.3 ? 1 : 0) : 0;
        const fern = lv >= 1 && R() < 0.12;
        add({ id: 'lawn', s: fern ? 'fern.' + this.season : 'tuft.' + this.season + '.' + big, ax: c[0] * T + 4 + Math.floor(R() * 24), ay: c[1] * T + 8 + Math.floor(R() * 22), sway: R() * 6 });
      }
      if (lv >= 0.7) for (let i = 0; i < 8 && lawnCells.length; i++) { const c = lawnCells[Math.floor(R() * lawnCells.length)]; add({ id: 'lawn', s: 'flower.' + this.season + '.' + (i % 2), ax: c[0] * T + 8 + Math.floor(R() * 16), ay: c[1] * T + 16 }); }
      // the side lot, until it's bought
      if (!lot) {
        const W = rnd(11), L = Gm.LOT;
        for (let i = 0; i < 46; i++) add({ id: 'garden', s: 'tuft.' + this.season + '.' + (1 + Math.floor(W() * 3)), ax: (L.x0 + W() * 8) * T, ay: (2 + W() * 23) * T, sway: W() * 6 });
        for (let i = 0; i < 4; i++) add({ s: 'rock', ax: (26 + W() * 6) * T, ay: (3 + W() * 20) * T });
        add({ id: 'garden', s: 'sign', ax: 26 * T, ay: 18 * T + 20 });
      }
      // the land past the old fence: a few trees, bushes and flowers, wherever nothing's been built
      if (land) {
        const W = rnd(23), near = (x, y, d) => { for (let yy = y - d; yy <= y + d; yy++) for (let xx = x - d; xx <= x + d; xx++) if (geom.at(xx, yy) >= 0) return true; return false; };
        for (let y = 2; y <= land.y1 - 1; y++) for (let x = 2; x <= land.x1 - 1; x++) {
          const r = W(), j = W();
          if ((x <= 33 && y <= 26) || r > 0.05) continue;   // the home plot and the side lot stay clear
          if (geom.kind(x, y) !== 'out' || blocked[y * WT + x]) continue;
          if (r < 0.012) { if (!near(x, y, 2)) { add({ s: 'tree.' + this.season, ax: x * T + 16, ay: y * T + 30, scenery: true }); blocked[y * WT + x] = 1; } }
          else if (r < 0.026) { if (!near(x, y, 1)) add({ s: 'bush.' + this.season, ax: x * T + 16, ay: y * T + 28, scenery: true }); }
          else add({ s: 'flower.' + this.season + '.' + (j < 0.5 ? 0 : 1), ax: x * T + 6 + Math.floor(j * 20), ay: y * T + 18, scenery: true });
        }
      }
      this.objs = objs; this.wallItems = walls;
      this._grid();
      this._birdHomes();
      this._critterHomes();
      this.staticDirty = true;
    }
    // The biggest open stretch of lawn, for mowing (no taller than four rows, no wider than twelve).
    _bestRect(isLawn) {
      let best = null;
      for (let y0 = 0; y0 < HT; y0++) for (let x0 = 0; x0 < WT; x0++) {
        if (!isLawn[y0 * WT + x0]) continue;
        let maxW = 12;
        for (let y1 = y0; y1 < Math.min(HT, y0 + 4); y1++) {
          let w = 0;
          while (w < maxW && x0 + w < WT && isLawn[y1 * WT + x0 + w]) w++;
          maxW = Math.min(maxW, w);
          if (!maxW) break;
          const a = maxW * (y1 - y0 + 1);
          if (!best || a > best.a) best = { x0: x0, y0: y0, x1: x0 + maxW - 1, y1: y1, a: a };
        }
      }
      return best;
    }
    _grid() {
      const Wk = this.walk = new Uint8Array(WT * HT), geom = this.geom;
      for (let y = 0; y < HT; y++) for (let x = 0; x < WT; x++) if (geom.open(x, y) && this.blocked[y * WT + x] !== 1) Wk[y * WT + x] = 1;
      // wall things that stand out onto the floor (the fireplace)
      this.wallItems.forEach((o) => {
        if (o.ghost || !o.f.block) return;
        const r = this.geom.rooms.find((rr) => rr.id === o.room);
        if (!r) return;
        const it = this._item(o.item);
        for (let y = r.y0 + 2; y < r.y0 + 2 + o.f.block; y++) for (let x = it.x; x < it.x + o.f.w; x++) Wk[y * WT + x] = 0;
      });
      Object.keys(this.spots).forEach((k) => { const s = this.spots[k], c = s.cell; if (s.inside && geom.open(c[0], c[1])) Wk[c[1] * WT + c[0]] = 1; });
    }
    _item(id) { return this._house().items.find((t) => t.id === id); }
    _ok(x, y) { return x >= 0 && y >= 0 && x < WT && y < HT && this.walk[y * WT + x] === 1; }
    _path(sx, sy, tx, ty) {
      if (!this._ok(tx, ty)) return null;
      if (sx === tx && sy === ty) return [];
      const N = WT * HT, came = new Int32Array(N).fill(-1), g = new Float32Array(N).fill(1e9), open = [sy * WT + sx], inOpen = new Uint8Array(N);
      g[sy * WT + sx] = 0; inOpen[sy * WT + sx] = 1;
      const h = (i) => Math.abs((i % WT) - tx) + Math.abs(((i / WT) | 0) - ty);
      const goal = ty * WT + tx;
      let guard = 0;
      while (open.length && guard++ < 6000) {
        let bi = 0;
        for (let i = 1; i < open.length; i++) if (g[open[i]] + h(open[i]) < g[open[bi]] + h(open[bi])) bi = i;
        const cur = open.splice(bi, 1)[0];
        inOpen[cur] = 0;
        if (cur === goal) break;
        const cx = cur % WT, cy = (cur / WT) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
          if (!this._ok(nx, ny) || !this.geom.step(cx, cy, nx, ny)) continue;
          const ni = ny * WT + nx, ng = g[cur] + 1;
          if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; if (!inOpen[ni]) { open.push(ni); inOpen[ni] = 1; } }
        }
      }
      if (came[goal] < 0) return null;
      const out = [];
      for (let i = goal; i !== sy * WT + sx && i >= 0; i = came[i]) out.unshift([i % WT, (i / WT) | 0]);
      return out;
    }
    _nearestOk(x, y) {
      for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (this._ok(x + dx, y + dy)) return [x + dx, y + dy];
      }
      return null;
    }
    // After a rebuild: anyone standing somewhere that's gone, or headed for something that's moved, starts again.
    _settle() {
      [this.hero].concat(this.npcs).forEach((a) => {
        if (!a) return;
        const [cx, cy] = this._cellOf(a.x, a.y);
        const sp = a.spot && this.spots[a.spot.k];
        const moved = a.spot && (!sp || sp.cell[0] !== a.spot.s.cell[0] || sp.cell[1] !== a.spot.s.cell[1]);
        const goalGone = a.goal && a.goal.k && !this.spots[a.goal.k];
        if (!this._ok(cx, cy)) { const c = this._nearestOk(cx, cy); if (c) { a.x = px(c[0]); a.y = px(c[1]); } }
        if (moved || goalGone || (a.path && a.path.length)) { a.spot = null; a.seated = null; a.sleep = null; a.meal = null; a.dozing = false; a.path = []; a.goal = null; a.anim = 'idle'; a.next = 0.3 + Math.random(); }
      });
    }

    // ---------------------------------------------------------------- the static layer (floors, walls)
    // 2.20.1: the finish a piece of the estate wears (one being tried on wins), and which piece a sprite belongs to
    _fin(est) {
      if (this.preview && this.preview.key === est && this.preview.fin !== undefined) return this.preview.fin;
      return ((this.o.estate || {}).f || {})[est] || null;
    }
    // Where to draw a sprite from: the atlas, or a recoloured copy of it when its piece has a finish on.
    _src(k) {
      const r = this.spr[k];
      if (!r) return null;
      const est = estOfKey(k), f = est ? this._fin(est) : null, F = f && G() && G().FINISHES ? G().FINISHES[f] : null;
      if (!F || !root.Recolor) return { im: this.atlas, x: r[0], y: r[1], r: r };
      this._fc = this._fc || {};
      const ck = k + '|' + f;
      if (!this._fc[ck]) this._fc[ck] = root.Recolor.tile(this.atlas, F.s, r[2], r[3], r[0], r[1]);
      return { im: this._fc[ck], x: 0, y: 0, r: r };
    }
    _drawSpr(g, k, x, y, flip) {
      const S = this._src(k);
      if (!S) return null;
      const r = S.r;
      if (flip) { g.save(); g.translate(x + r[2], y); g.scale(-1, 1); g.drawImage(S.im, S.x, S.y, r[2], r[3], 0, 0, r[2], r[3]); g.restore(); }
      else g.drawImage(S.im, S.x, S.y, r[2], r[3], x, y, r[2], r[3]);
      return r;
    }
    _tile(g, k, x0, y0, x1, y1) {
      const S = this._src(k);
      if (!S) return;
      const r = S.r;
      for (let y = y0; y < y1; y += r[3]) for (let x = x0; x < x1; x += r[2]) g.drawImage(S.im, S.x, S.y, Math.min(r[2], x1 - x), Math.min(r[3], y1 - y), x, y, Math.min(r[2], x1 - x), Math.min(r[3], y1 - y));
    }
    _roomLook(r) {
      const st = (G().ROOM_STYLES || {})[r.style] || {};
      if (st.wing) { const t = Math.max(0, this.tier(st.wing)); return { wall: WING_WALLS[st.wing][t], floor: WING_FLOORS[st.wing][t] }; }
      if (st.wall) return { wall: st.wall, floor: st.floor };
      return { wall: 'wall.' + Math.max(0, this.tier('walls')), floor: 'floor.' + Math.max(0, this.tier('floors')) };
    }
    _static() {
      const c = this.stat || (this.stat = document.createElement('canvas'));
      c.width = WW; c.height = WH;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const se = this.season, yt = Math.max(0, this.tier('yard')), geom = this.geom, H = this._house();
      // ground: grass everywhere, dust and patches on the cheap yards
      const R = rnd(3);
      for (let y = 0; y < HT; y++) for (let x = 0; x < WT; x++) {
        let k = 'grass.' + se + '.' + Math.floor(R() * 3);
        const r = R();
        if (geom.kind(x, y) === 'out' && x <= 24 && (yt === 0 || (yt === 1 && r < 0.3))) k = 'dirt.' + se;
        this._tile(g, k, x * T, y * T, x * T + T, y * T + T);
      }
      // garden paths from the doors that open outside, once the yard's posh
      if (yt >= 4) H.doors.forEach((d) => {
        if (geom.kind(d[0], d[1]) !== 'bottom' || geom.kind(d[0], d[1] + 1) !== 'out') return;
        for (let y = d[1] + 1; y <= d[1] + 4 && geom.kind(d[0], y) === 'out'; y++) this._tile(g, 'floor.4', d[0] * T + 4, y * T, d[0] * T + 28, y * T + T);
      });
      // rooms
      H.rooms.forEach((r) => {
        const L = this._roomLook(r);
        this._tile(g, L.floor, r.x0 * T, (r.y0 + 2) * T, (r.x1 + 1) * T, (r.y1 + 1) * T);
        for (let x = r.x0; x <= r.x1; x++) {
          if (geom.isDoor(x, r.y0)) { this._tile(g, L.floor, x * T, r.y0 * T, x * T + T, r.y0 * T + 64); g.fillStyle = 'rgba(20,14,24,0.35)'; g.fillRect(x * T, r.y0 * T, 3, 64); g.fillRect(x * T + T - 3, r.y0 * T, 3, 64); }
          else this._tile(g, L.wall, x * T, r.y0 * T, x * T + T, r.y0 * T + 64);
        }
        g.fillStyle = 'rgba(20,14,24,0.22)';
        for (let x = r.x0; x <= r.x1; x++) if (!geom.isDoor(x, r.y0)) g.fillRect(x * T, (r.y0 + 2) * T, T, 5); // shadow under the wall
      });
      // wall tops
      const top = '#2b2733', lip = '#1b1720', edge = '#4a4452';
      const band = (x, y, w, h, l) => { g.fillStyle = top; g.fillRect(x, y, w, h); g.fillStyle = edge; g.fillRect(x, y, w, 1); if (l) { g.fillStyle = lip; g.fillRect(x, y + h - l, w, l); } };
      H.rooms.forEach((r) => {
        for (let x = r.x0; x <= r.x1; x++) if (!geom.isDoor(x, r.y0)) band(x * T, r.y0 * T - 2, T, 10);
        for (let y = r.y0; y <= r.y1; y++) {
          if (!geom.isDoor(r.x0, y)) band(r.x0 * T - 1, y * T, 9, T);
          if (!geom.isDoor(r.x1, y)) band((r.x1 + 1) * T - 8, y * T, 9, T);
        }
        for (let x = r.x0; x <= r.x1; x++) if (!geom.isDoor(x, r.y1)) band(x * T, (r.y1 + 1) * T - 16, T, 16, 7);
      });
      this.staticDirty = false;
    }

    // ---------------------------------------------------------------- the hero's little life
    _cellOf(x, y) { return [Math.floor(x / T), Math.floor(y / T)]; }
    _anySpot() { const ks = Object.keys(this.spots); return ks.length ? ks[0] : null; }
    _cap(k) {
      const s = this.spots[k];
      if (!s) return 0;
      if (s.kind === 'bed') { const ob = this.objById[s.item]; return ob && ob.sw >= 90 ? 2 : 1; }
      return 1;
    }
    _users(k, a) { return [this.hero].concat(this.npcs).filter((x) => x && x !== a && ((x.spot && x.spot.k === k) || (x.goal && x.goal.k === k))); }
    _spotOk(k, a) {
      const s = this.spots[k];
      if (!s) return false;
      if (this.bad[k] && this.bad[k] > this.t) return false;
      if (s.feat === 'reno' && s.kind === 'renojob' && (this.o.state.reno == null || this.o.state.reno > 0)) return false;
      if (!this._ok(s.cell[0], s.cell[1])) return false;
      return this._users(k, a).length < this._cap(k); // somebody else is using it
    }
    // Seats at the dining table (the table itself, and chairs pulled up near it).
    _tableSeats(a) {
      const ks = Object.keys(this.spots), tables = ks.filter((k) => this.spots[k].kind === 'ktable').map((k) => this.spots[k].cell);
      return ks.filter((k) => {
        const s = this.spots[k];
        if (SEATS.indexOf(s.kind) < 0 || !this._spotOk(k, a)) return false;
        return s.kind === 'ktable' || !tables.length || tables.some((c) => Math.abs(c[0] - s.cell[0]) + Math.abs(c[1] - s.cell[1]) <= 5);
      });
    }
    _beds(a) {
      const home = a && a.npc && a.npc.home;
      // nobody climbs into his bed unless they live in that room (a partner, say)
      const ks = Object.keys(this.spots).filter((k) => BEDS.indexOf(this.spots[k].kind) >= 0 && this._spotOk(k, a) && (a === this.hero || this.spots[k].kind !== 'bed' || (home && this.spots[k].room === home)));
      // the hero has his own bed; the household prefers a bed in their own room, then the spare
      return ks.sort((x, y) => {
        const sx = this.spots[x], sy = this.spots[y];
        const score = (sp) => (a === this.hero ? (sp.kind === 'bed' ? 0 : 1) : (home && sp.room === home ? 0 : sp.kind === 'sparebed' ? 1 : 2));
        return score(sx) - score(sy);
      });
    }
    // Where someone lying in a bed has their head: on the pillow (left or right in a double).
    _pillow(itemId, slot) {
      const ob = this.objById[itemId];
      if (!ob) return null;
      const dbl = ob.sw >= 90, y0 = ob.ay - ob.sh;
      return { x: Math.round(dbl ? ob.ax + (slot ? 1 : -1) * ob.sw * 0.22 : ob.ax), y: Math.round(y0 + Math.max(16, ob.sh * 0.26)), sy: ob.ay + 0.6 };
    }
    // Where to draw someone, and where their bubble goes.
    _pos(a) {
      if (a.sleep) return { x: a.sleep.x, y: a.sleep.y, sy: a.sleep.sy, top: a.sleep.y - 6 };
      const x = a.seated ? a.seated.x : a.x, y = a.seated ? a.seated.y : a.y;
      return { x: x, y: y, sy: a.seated && a.seated.sy != null ? Math.max(y, a.seated.sy) : y, top: y - (a.kid === 'baby' ? 32 : a.kid ? 44 : a.seated ? 50 : 60) };
    }
    _featOf(s) { if (s.feat) return s.feat; const f = G().FURN[s.kind]; return f && f.feat ? f.feat : null; }
    // What next: frets over the worst-kept chores, otherwise potters and lounges.
    _choose() {
      const S = this.o.state || {}, cands = [], H = this.hero, hr = hourNow();
      if (bedtime(hr, true)) { const b = this._beds(H)[0]; if (b) return { k: b, sleep: true }; }
      const meal = mealNow(hr);
      if (meal && Math.random() < 0.85) { const seats = this._tableSeats(H); if (seats.length) return { k: seats[Math.floor(Math.random() * seats.length)], meal: meal }; }
      Object.keys(FEAT_K).forEach((f) => {
        const lv = S[f] || 0;
        if (f === 'reno' || lv < 0.4) return;
        Object.keys(this.spots).forEach((k) => { const s = this.spots[k]; if (FEAT_K[f].indexOf(s.kind) >= 0 && this._spotOk(k, H)) cands.push({ k: k, w: 2 + lv * 6, fret: f }); });
      });
      Object.keys(this.spots).forEach((k) => {
        const s = this.spots[k];
        if (!this._spotOk(k, H) || !s.leisure) return;
        const f = this._featOf(s), lv = f ? S[f] || 0 : 0;
        if (lv >= 0.4 && f !== 'reno') return; // he only frets at those
        if (s.mow && (S.lawn || 0) > 0.25) return;
        cands.push({ k: k, w: s.leisure * (s.kind === 'renojob' ? 2 : 1) });
      });
      const cur = H.spot && H.spot.k;
      return pickW(cands.filter((c) => c.k !== cur)) || (this.spots.couch ? { k: 'couch' } : null);
    }
    _go(a, k, fret, extra) {
      const s = this.spots[k];
      if (!s) return false;
      const [cx, cy] = this._cellOf(a.x, a.y);
      const path = this._path(cx, cy, s.cell[0], s.cell[1]);
      if (!path) { this.bad[k] = this.t + 45; return false; }
      a.spot = null; a.goal = Object.assign({ k: k, s: s, fret: fret }, extra || {}); a.path = path; a.anim = 'walk'; a.seated = null; a.sleep = null; a.meal = null;
      if (!path.length) this._arrive(a, a.goal);
      return true;
    }
    _place(k, settle, extra) {
      const H = this.hero, s = k && this.spots[k];
      if (!s) { const c = this._nearestOk(13, 10) || [13, 10]; H.x = px(c[0]); H.y = px(c[1]); H.path = []; H.spot = null; H.anim = 'idle'; H.next = 2; return; }
      H.x = px(s.cell[0]); H.y = px(s.cell[1]); H.path = []; H.chat = null;
      this._arrive(H, Object.assign({ k: k, s: s }, extra || {}), settle);
    }
    _arrive(a, goal, settle) {
      const s = goal.s, f = this._featOf(s), lv = f ? (this.o.state[f] || 0) : 0;
      a.goal = null;
      a.sleep = null; a.meal = null; a.dozing = false;
      // chatting: face whoever it was, and start talking if they're still there
      if (goal.chatWith) { a.spot = null; a.seated = null; a.anim = 'idle'; a.ft = 0; const b = goal.chatWith; const pa = this._pos(b); a.dir = Math.abs(pa.x - a.x) > Math.abs(pa.y - a.y) ? (pa.x > a.x ? 'right' : 'left') : pa.y > a.y ? 'down' : 'up'; if (!b.chat && !b.sleep && Math.hypot(pa.x - a.x, pa.y - a.y) < 80) this._startChat(a, b); else a.next = 1; return; }
      if (goal.birds) { a.spot = null; a.seated = null; a.anim = 'idle'; a.dir = s.dir; a.next = 7 + Math.random() * 5; a.think = 0.4; a.birdsT = true; return; }
      a.spot = { k: goal.k, s: s, fret: goal.fret || (f && f !== 'reno' && lv >= 0.4 ? f : null) };
      a.dir = s.dir;
      a.seated = s.seat ? { x: s.seat[0], y: s.seat[1], sy: s.seatSy } : null;
      a.ft = 0;
      // a chair pulled up beside the table: turn to face it
      if (goal.meal && SEATS.indexOf(s.kind) > 0 && a.seated) {
        const tb = this.objs.find((o) => o.k === 'ktable' && !o.ghost && !o.front);
        if (tb) { const dx = tb.ax - s.ax, dy = (tb.ay - tb.sh / 2) - s.ay; if (Math.abs(dx) > Math.abs(dy)) { a.dir = dx > 0 ? 'right' : 'left'; a.seated.x += dx > 0 ? -3 : 3; } }
      }
      if (goal.sleep) {
        if (BEDS.indexOf(s.kind) >= 0) { a.sleep = this._pillow(s.item, this._users(goal.k, a).filter((x) => x.sleep).length); a.seated = null; }
        else a.dozing = true;
        a.anim = a.sleep ? 'idle' : 'sit'; a.spot.fret = null; a.next = 60; a.think = 1.5;
        return;
      }
      if (goal.meal) { a.meal = goal.meal; a.anim = s.sit ? 'sit' : 'idle'; a.spot.fret = null; a.next = 22 + Math.random() * 14; a.think = 0.8 + Math.random() * 2; return; }
      if (a !== this.hero) {
        if (goal.tut) { a.anim = 'idle'; a.spot.fret = goal.tut; a.next = 5 + Math.random() * 3; a.think = 0.4; return; }
        a.anim = s.sit ? 'sit' : s.anim === 'walk' ? 'idle' : a.spot.fret ? 'idle' : s.anim; a.spot.fret = null; a.next = 10 + Math.random() * 14; a.think = 1 + Math.random() * 3;
        return;
      }
      if (a.spot.fret) { a.anim = 'idle'; a.next = 7 + Math.random() * 5; a.think = settle ? 0.2 : 0.6; }
      else if (s.mow) { a.anim = 'walk'; a.mow = { row: 0 }; a.next = 14 + Math.random() * 6; a.think = 2.5; }
      else { a.anim = s.anim; a.next = 9 + Math.random() * 10; a.think = 1.2 + Math.random() * 2; }
    }
    // For the widget: something he does facing us (or side-on), so the clip shows his face.
    pickActivity() {
      let c = null;
      for (let i = 0; i < 14; i++) { const x = this._choose(); if (x && this.spots[x.k].dir !== 'up' && !this.spots[x.k].mow) { c = x; break; } }
      const k = c ? c.k : this.spots.armchair ? 'armchair' : this._anySpot();
      this._place(k, true);
    }
    walkTo(cx, cy) {
      const H = this.hero, [sx, sy] = this._cellOf(H.x, H.y);
      const p = this._path(sx, sy, cx, cy);
      if (!p || !p.length) return false;
      H.spot = null; H.seated = null; H.path = p; H.anim = 'walk'; H.goal = { k: null, s: { cell: [cx, cy], dir: 'down', anim: 'emote' } }; H.next = 30;
      return true;
    }
    // 2.24: he's just come in from the street: stand him at the front door, looking in, and settle the camera there
    arriveAt() {
      const d = this._frontDoor(), H = this.hero;
      if (!d || !H) return;
      Object.assign(H, { x: px(d[0]), y: px(d[1]) + 6, path: [], spot: null, seated: null, sleep: null, meal: null, dozing: false, goal: null, anim: 'idle', dir: 'up', next: 1.2 });
      this.cam.x = H.x; this.cam.y = H.y - 24; this.cam.manual = 0; this.focusK = null;
    }
    celebrate() {
      if (!this.hero) return;
      const H = this.hero;
      H.party = 2.2; H.ft = 0;
      this._say(H, ['🎉'], 2.4, 'good');
      this._burst(H.seated ? H.seated.x : H.x, (H.seated ? H.seated.y : H.y) - 30);
    }
    _burst(x, y) { for (let i = 0; i < 18; i++) this.fx.push({ x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 20, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 40, t: 0, life: 1.2 + Math.random() * 0.6, c: Math.random() < 0.5 ? '#ffd75a' : '#fff6c0' }); }
    // Someone new moves in: they walk in through the front door to cheers.
    welcome(id) {
      const a = this.npcs.find((n) => n.id === id) || this.birds.find((b) => b.id === id);
      if (!a) return;
      this._say(a, ['👋'], 3, 'good');
      this._burst(a.x, a.y - 30);
      if (this.hero) this._say(this.hero, ['🎉'], 2.6, 'good');
      this.focusK = 'npc:' + id; this.cam.manual = 0;
      setTimeout(() => { if (this.focusK === 'npc:' + id) this.focusK = null; }, 4000);
    }
    // ---------------------------------------------------------------- thoughts
    _say(a, icons, dur, tone) { a.bub = { icons: icons, t: 0, dur: dur || 3.2, tone: tone || '' }; }
    _sayText(a, text, dur, tone) { a.bub = { text: String(text || '').slice(0, 150), t: 0, dur: dur || 5.2, tone: tone || '' }; }
    _updateOracle(dt) {
      const a = this.oracle;
      if (!a || !this.o.oraclePortal || this.capturing || this.edit) return;
      if (this.o.oracleBusy && this.o.oracleBusy()) { a.next = Math.max(a.next, 4); return; }
      if ((a.next -= dt) > 0) return;
      const occupied = !!(this.hero && this.hero.bub) || this.npcs.some((n) => n.bub) || this.birds.some((b) => b.bub);
      if (occupied) { a.next = 3 + Math.random() * 3; return; }
      const bank = this.o.oracleBarks || [], pool = bank.filter((line) => line && line !== a.lastBark);
      const line = pool[Math.floor(Math.random() * pool.length)] || bank[0];
      if (line) { a.lastBark = line; this._sayText(a, line, 6.5); }
      a.next = 78 + Math.random() * 42;
    }
    _think() {
      const H = this.hero, M = this.o.mind || {}, chores = M.chores || {}, done = M.done || [], due = M.due || [];
      const opts = [];
      if (H.sleep || H.dozing) {
        const worst = Object.keys(chores).map((k) => chores[k]).filter((c) => c.state >= 1).sort((a, b) => b.level - a.level)[0];
        const dream = Math.random() < 0.3 ? (worst ? [worst.icon, '💭'] : done.length ? [done[Math.floor(Math.random() * done.length)].icon, '💭'] : null) : null;
        this._say(H, dream || ['💤'], 3.4, dream && worst ? 'bad' : '');
        return { i: dream || ['💤'] };
      }
      if (H.meal) opts.push({ w: 5, i: [H.meal, '😋'] });
      const sp = H.spot && H.spot.s, f = H.spot && (H.spot.fret || (sp && this._featOf(sp)));
      if (f && chores[f] && chores[f].state >= 1) opts.push({ w: 9, i: [chores[f].icon, chores[f].state >= 2 ? '💢' : '❗'], tone: 'bad' });
      else if (f && chores[f] && chores[f].today) opts.push({ w: 6, i: [chores[f].icon, '✔️'], tone: 'good' });
      if (sp && sp.icon && !(H.spot && H.spot.fret)) opts.push({ w: 3, i: [sp.icon, '💭'] });
      const worst = Object.keys(chores).map((k) => chores[k]).filter((c) => c.state >= 1).sort((a, b) => b.level - a.level)[0];
      if (worst && !(f && chores[f] === worst)) opts.push({ w: 2.5 + worst.state * 2, i: [worst.icon, '❓'], tone: 'bad' });
      if (done.length) { const d = done[Math.floor(Math.random() * done.length)]; opts.push({ w: 3, i: [d.icon, '✨'], tone: 'good' }); }
      if (due.length) { const d = due[Math.floor(Math.random() * due.length)]; opts.push({ w: 1.6, i: [d.icon, '⏳'] }); }
      if (!opts.length) opts.push({ w: 1, i: [H.seated ? '😌' : '🎵'] });
      const pick = pickW(opts);
      this._say(H, pick.i, 3.4, pick.tone);
      return pick;
    }

    // ---------------------------------------------------------------- moving about
    _walk(a, dt, speed) {
      const c = a.path[0], tx = px(c[0]), ty = px(c[1]);
      const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), sp = (speed || 46) * dt;
      if (Math.abs(dx) > Math.abs(dy)) a.dir = dx > 0 ? 'right' : 'left'; else if (d > 0.1) a.dir = dy > 0 ? 'down' : 'up';
      if (d <= sp) { a.x = tx; a.y = ty; a.path.shift(); } else { a.x += dx / d * sp; a.y += dy / d * sp; }
      if (!a.path.length && a.goal) this._arrive(a, a.goal);
    }
    _update(dt) {
      const H = this.hero;
      this.t += dt;
      H.ft += dt;
      if (H.party > 0) { H.party -= dt; if (H.party <= 0) H.ft = 0; }
      if (H.path && H.path.length) { this._walk(H, dt); return; }
      // mowing: up and down the lawn
      if (H.spot && H.spot.s.mow && !H.spot.fret && this.lawnRect) {
        const M = H.mow, L = this.lawnRect;
        const row = L.y0 + (M.row % (L.y1 - L.y0 + 1)), dirR = M.row % 2 === 0;
        const tx = px(dirR ? L.x1 : L.x0), ty = px(row);
        const dx = tx - H.x, dy = ty - H.y, d = Math.hypot(dx, dy), sp = 30 * dt;
        H.dir = Math.abs(dy) > 1 ? (dy > 0 ? 'down' : 'up') : dx > 0 ? 'right' : 'left';
        if (d <= sp) { H.x = tx; H.y = ty; M.row++; } else { H.x += dx / d * sp; H.y += dy / d * sp; }
      }
      if (H.chat) return; // he's talking to someone
      H.next -= dt; H.think -= dt;
      if (H.think <= 0 && !this.capturing) { this._think(); H.think = H.sleep ? 5 + Math.random() * 4 : 6 + Math.random() * 5; }
      if (H.next <= 0) {
        const hr = hourNow();
        if ((H.sleep || H.dozing) && bedtime(hr, true)) { H.next = 60; return; }
        if (H.sleep && !bedtime(hr, true)) this._say(H, ['🥱'], 2.6);
        if (H.meal && mealNow(hr) && Math.random() < 0.5) { H.next = 10; return; }
        H.next = 3;
        for (let i = 0; i < 5; i++) { const c = this._choose(); if (!c || this._go(H, c.k, c.fret, { sleep: c.sleep, meal: c.meal })) break; }
      }
    }

    // ---------------------------------------------------------------- the household
    _syncNpcs() {
      const want = (this.o.npcs || []).filter((n) => n.status === 'resident');
      // people
      const humans = want.filter((n) => n.kind === 'human');
      this.npcs = this.npcs.filter((a) => humans.some((n) => n.id === a.id));
      humans.forEach((n) => {
        const gear = G().npcGear(n), look = G().normLook(n.look);
        const d = root.LPC.dress(look, gear, { kit: false }), sig = JSON.stringify([d.spec, d.body]);
        let a = this.npcs.find((x) => x.id === n.id);
        if (!a) {
          a = this._actor(n.id); a.npc = n; a.next = 0.5 + Math.random() * 2; a.think = 4 + Math.random() * 6;
          const door = this._frontDoor(); a.x = px(door[0]); a.y = px(door[1]);
          this.npcs.push(a);
          if (this.ready && bedtime(hourNow())) { const b = this._beds(a)[0]; if (b) { const sp = this.spots[b]; a.x = px(sp.cell[0]); a.y = px(sp.cell[1]); this._arrive(a, { k: b, s: sp, sleep: true }); } }
        }
        a.npc = n;
        a.kid = look.age === 'kid' || look.age === 'baby' ? look.age : null;   // 2.26: kids and little ones, smaller and slower
        a.guest = !!n.guest && !n.lives;   // visiting from the calendar: they go home at night
        if (a.sig === sig) return;
        a.sig = sig;
        root.LPC.build(d.spec, d.body, a.kid ? ['walk', 'idle'] : ['walk', 'idle', 'sit', 'emote', 'thrust', 'spellcast', 'slash']).then((h) => { if (a.sig !== sig) return; if (a.gone) a.hid = h.sheets; else a.sheets = h.sheets; }).catch(() => {});
      });
      // the birds
      const birds = want.filter((n) => n.kind === 'bird');
      this.birds = this.birds.filter((b) => birds.some((n) => n.id === b.id));
      birds.forEach((n) => {
        let b = this.birds.find((x) => x.id === n.id);
        if (!b) { b = { id: n.id, x: 0, y: 0, sy: 0, at: null, fly: null, next: Math.random() * 2, think: 5 + Math.random() * 8, ph: Math.random() * 6, bub: null, flip: n.id === 'kermit' }; this.birds.push(b); }
        b.npc = n;
      });
      this._birdHomes();
    }
    _frontDoor() {
      const H = this._house(), g = this.geom;
      for (const d of H.doors) if (g.kind(d[0], d[1]) === 'bottom' && g.kind(d[0], d[1] + 1) === 'out' && this._ok(d[0], d[1] + 1)) return [d[0], d[1] + 1];
      return this._nearestOk(12, 17) || [12, 17];
    }
    // What someone in the household does next.
    _npcPlan(a) {
      const hr = hourNow(), S = this.o.state || {}, home = a.npc && a.npc.home, H = this.hero;
      if (bedtime(hr)) {
        const b = this._beds(a)[0];
        if (b) return { act: 'spot', k: b, sleep: true };
        const sofa = Object.keys(this.spots).find((k) => ['couch', 'armchair'].indexOf(this.spots[k].kind) >= 0 && this._spotOk(k, a));
        return sofa ? { act: 'spot', k: sofa, sleep: true } : null;
      }
      const meal = mealNow(hr);
      if (meal) { const seats = this._tableSeats(a); if (seats.length) return { act: 'spot', k: seats[Math.floor(Math.random() * seats.length)], meal: meal }; }
      const opts = [];
      const free = (o) => o && o !== a && !(o.path && o.path.length) && !o.sleep && !o.dozing && !o.chat && !o.goal && (o === H || o.sheets);
      const pals = this.npcs.filter(free);
      if (pals.length) opts.push({ w: 2.2, act: 'chat', b: pals[Math.floor(Math.random() * pals.length)] });
      if (free(H) && !(H.spot && (H.spot.fret || H.spot.s.mow || H.spot.s.swim || H.spot.s.perch))) opts.push({ w: 1.3, act: 'chat', b: H });
      Object.keys(this.spots).forEach((k) => {
        const s = this.spots[k];
        if (!this._spotOk(k, a) || s.mow || s.perch || s.kind === 'lawnlook' || BEDS.indexOf(s.kind) >= 0) return;
        const f = this._featOf(s), lv = f ? S[f] || 0 : 0;
        let w = s.sit ? 1.5 : s.leisure ? 0.9 : 0;
        if (!w) return;
        if (s.swim) w = 0.5;
        if (lv >= 0.4 && f !== 'reno') { opts.push({ w: 0.25 + lv * 0.5, act: 'spot', k: k, tut: f }); return; } // tut at the mess, not tidy it
        if (home && s.room === home) w *= 3;
        opts.push({ w: w, act: 'spot', k: k });
      });
      if (this.birds.length) opts.push({ w: 0.9, act: 'birds' });
      opts.push({ w: 0.8, act: 'wander' });
      return pickW(opts);
    }
    _startChat(a, b) {
      const M = this.o.mind || {}, chores = M.chores || {};
      const nag = b === this.hero ? Object.keys(chores).map((k) => chores[k]).filter((c) => c.state >= 1).sort((x, y) => y.level - x.level)[0] : null;
      const c = { a: a, b: b, i: 0, n: 4 + Math.floor(Math.random() * 3), next: 0.2, topic: nag && Math.random() < 0.5 ? null : TOPICS[Math.floor(Math.random() * TOPICS.length)], nag: nag };
      a.chat = c; b.chat = c;
      const pa = this._pos(a), pb = this._pos(b);
      if (!b.seated && !b.sleep) b.dir = Math.abs(pa.x - pb.x) > Math.abs(pa.y - pb.y) ? (pa.x > pb.x ? 'right' : 'left') : pa.y > pb.y ? 'down' : 'up';
      if (!b.seated && b.anim !== 'walk' && b !== this.hero) b.anim = 'idle';
      (this.chats = this.chats || []).push(c);
    }
    _updateChats(dt) {
      (this.chats || []).forEach((c) => {
        c.next -= dt;
        if (c.next > 0 || this.capturing) return;
        if (c.i >= c.n || c.b.sleep || (c.b.path && c.b.path.length)) { c.done = true; return; }
        const sp = c.i % 2 === 0 ? c.a : c.b;
        let ic;
        if (c.i === 0) ic = c.topic ? [c.topic, '💬'] : [c.nag.icon, '❓'];
        else if (c.i === 1 && !c.topic) ic = ['😅'];
        else ic = [Math.random() < 0.35 ? TOPICS[Math.floor(Math.random() * TOPICS.length)] : REACT[Math.floor(Math.random() * REACT.length)]];
        this._say(sp, ic, 2, '');
        if (sp === c.a) { c.a.anim = c.a.seated ? c.a.anim : 'emote'; c.a.ft = 0; }
        c.i++; c.next = 1.9;
      });
      (this.chats || []).filter((c) => c.done).forEach((c) => {
        c.a.chat = null; c.b.chat = null;
        if (!c.a.seated && c.a.anim === 'emote') c.a.anim = 'idle';
        c.a.next = 1 + Math.random() * 3; c.b.next = Math.max(c.b.next, 2);
        if (c.b === this.hero) this.hero.think = Math.max(this.hero.think, 3);
      });
      this.chats = (this.chats || []).filter((c) => !c.done);
    }
    _updateNpcs(dt) {
      this._updateChats(dt);
      const hr = hourNow();
      this.npcs.forEach((a) => {
        a.ft += dt;
        // 2.26: visitors go home for the night (their sheets put away, so nothing else sees them) and come back by day
        if (a.guest && !this.capturing) {
          if (bedtime(hr) && !a.gone) { a.gone = true; a.hid = a.sheets; a.sheets = null; a.path = []; a.spot = null; a.seated = null; a.goal = null; a.chat = null; a.bub = null; }
          else if (!bedtime(hr) && a.gone) { a.gone = false; a.sheets = a.hid; a.hid = null; const door = this._frontDoor(); a.x = px(door[0]); a.y = px(door[1]); a.next = 0.5; }
          if (a.gone) return;
        }
        if (a.npc && a.npc.ev && !a.bub && !a.sleep && !a.chat && !this.capturing) {
          a.evT = (a.evT == null ? 3 + Math.random() * 8 : a.evT) - dt;
          if (a.evT <= 0) { this._say(a, [a.npc.ev.icon], 2.6); a.evT = 14 + Math.random() * 14; }
        }
        if (a.path && a.path.length) {
          this._walk(a, dt, a.kid === 'baby' ? 17 : a.kid ? 30 : 40);
          // a wave in passing
          if (!a.bub && !this.capturing) [this.hero].concat(this.npcs).forEach((o) => {
            if (!o || o === a || o.sleep || a.bub) return;
            const po = this._pos(o), key = [a.id, o.id].sort().join('|');
            if (Math.hypot(po.x - a.x, po.y - a.y) < 34 && !((this.greet = this.greet || {})[key] > this.t)) {
              this.greet[key] = this.t + 60; this._say(a, ['👋'], 1.6); if (!o.bub && !o.chat) this._say(o, ['👋'], 1.6);
            }
          });
          return;
        }
        if (a.chat) return;
        a.next -= dt; a.think -= dt;
        if (a.think <= 0 && !this.capturing) {
          const chore = a.spot && a.spot.fret && (this.o.mind && this.o.mind.chores || {})[a.spot.fret];
          if (a.npc && !a.sleep && !a.dozing && !a.meal && !chore && !a.birdsT) {
            const occupied = !!(this.hero && this.hero.bub) || this.npcs.some((n) => n !== a && n.bub) || this.birds.some((b) => b.bub);
            if (this.t < (this.barkLock || 0) || occupied) { a.think = 2.5 + Math.random() * 2.5; }
            else {
              const bank = G().npcBarks ? G().npcBarks(a.npc) : [];
              const pool = bank.filter((line) => line && line !== a.lastBark);
              const line = pool.length ? pool[Math.floor(Math.random() * pool.length)] : bank[0];
              if (line) { a.lastBark = line; this._sayText(a, line, 5.2); this.barkLock = this.t + 10 + Math.random() * 7; }
              a.think = 22 + Math.random() * 20;
            }
          } else {
            let ic;
            if (a.sleep || a.dozing) ic = ['💤'];
            else if (a.meal) ic = [Math.random() < 0.6 ? a.meal : '😋'];
            else if (chore) ic = [chore.icon || '🧹', Math.random() < 0.5 ? '😬' : '🤢'];
            else if (a.birdsT) ic = ['🦜', '❤️'];
            else ic = [a.spot && a.spot.s.icon && Math.random() < 0.55 ? a.spot.s.icon : NPC_IDLE[Math.floor(Math.random() * NPC_IDLE.length)]];
            this._say(a, ic, 3, chore ? 'bad' : '');
            a.think = a.sleep ? 6 + Math.random() * 6 : 10 + Math.random() * 10;
          }
        }
        if (a.next > 0) return;
        if ((a.sleep || a.dozing) && bedtime(hr)) { a.next = 60; return; }
        if (a.meal && mealNow(hr) && Math.random() < 0.7) { a.next = 12; return; }
        if (a.sleep) this._say(a, ['🥱'], 2.4);
        a.birdsT = false;
        const c = this._npcPlan(a);
        a.next = 6 + Math.random() * 6;
        if (!c) return;
        const [cx, cy] = this._cellOf(a.x, a.y);
        const walkTo = (tgt, goal) => {
          if (!tgt || !this._ok(tgt[0], tgt[1])) return false;
          const p = this._path(cx, cy, tgt[0], tgt[1]);
          if (!p) return false;
          a.spot = null; a.seated = null; a.sleep = null; a.meal = null; a.dozing = false; a.path = p; a.anim = 'walk'; a.goal = goal;
          if (!p.length) this._arrive(a, goal);
          return true;
        };
        if (c.act === 'chat') {
          const pb = this._pos(c.b), [bx, by] = this._cellOf(pb.x, pb.y);
          const cand = [[bx - 1, by], [bx + 1, by], [bx, by + 1], [bx, by - 1]].filter((x) => this._ok(x[0], x[1]));
          for (const t of cand) if (walkTo(t, { k: null, chatWith: c.b, s: { cell: t, dir: 'down', anim: 'idle' } })) { c.b.next = Math.max(c.b.next, a.path.length / 1.2 + 4); return; }
          return;
        }
        if (c.act === 'birds') {
          const b = this.birds[Math.floor(Math.random() * this.birds.length)];
          let t = null;
          if (b.at && b.at.kind === 'cage') { const av = Object.keys(this.spots).find((k) => this.spots[k].kind === 'aviary'); if (av) t = this.spots[av].cell; }
          if (!t) { const [bx, by] = this._cellOf(b.x, b.y + 12); t = this._nearestOk(bx, by); }
          if (t) walkTo(t, { k: null, birds: true, s: { cell: t, dir: b.x < px(t[0]) - 8 ? 'left' : b.x > px(t[0]) + 8 ? 'right' : 'up', anim: 'idle' } });
          return;
        }
        if (c.act === 'wander') {
          const r = this.geom.rooms.find((rr) => rr.id === (a.npc && a.npc.home)) || this.geom.rooms[Math.floor(Math.random() * this.geom.rooms.length)];
          const t = Math.random() < 0.3 && this.lawnRect ? [this.lawnRect.x0 + Math.floor(Math.random() * (this.lawnRect.x1 - this.lawnRect.x0 + 1)), this.lawnRect.y0 + Math.floor(Math.random() * (this.lawnRect.y1 - this.lawnRect.y0 + 1))]
            : r ? [r.x0 + 1 + Math.floor(Math.random() * Math.max(1, r.x1 - r.x0 - 1)), r.y0 + 2 + Math.floor(Math.random() * Math.max(1, r.y1 - r.y0 - 2))] : null;
          walkTo(t, { k: null, s: { cell: t, dir: 'down', anim: 'idle' } });
          return;
        }
        this._go(a, c.k, null, { sleep: c.sleep, meal: c.meal, tut: c.tut });
      });
    }

    // ---------------------------------------------------------------- Ruby and Kermit
    // Where each bird can perch: inside the aviary, or round the room they live in (on their gear, the furniture, the floor).
    _birdHomes() {
      if (!this.birds || !this.birds.length || !this.objs) return;
      const H = this._house(), Gm = G();
      const aviary = this.objs.find((o) => o.k === 'aviary' && !o.ghost && !o.front);
      const roomOf = (id) => this.geom.rooms.find((r) => r.id === id);
      const perchesIn = (room) => {
        const out = [];
        this.objs.concat(this.wallItems).forEach((o) => {
          if (o.ghost || !o.item || o.front || o.fence) return;
          const inRoom = room ? o.room === room.id : !o.room;
          if (!inRoom) return;
          const f = o.f;
          if (!f) return;
          const x0 = Math.round(o.ax - o.sw / 2), y0 = Math.round(o.ay - o.sh);
          if (f.perch) f.perch.forEach((p) => out.push({ x: x0 + (o.flip ? o.sw - p[0] : p[0]), y: y0 + p[1], sy: o.ay + 0.4, item: o.item, kind: f.night ? 'night' : f.food ? 'food' : f.toy ? 'toy' : 'perch', swing: !!f.swingy, ring: !!f.ring }));
          else if (!o.flat && !o.wall && o.sh >= 20 && f.c !== 'wing' && o.k !== 'aviary') out.push({ x: Math.round(o.ax + ((o.item * 37) % 9 - 4) * Math.min(12, o.sw / 3) / 8), y: y0 + 1, sy: o.ay + 0.4, item: o.item, kind: 'top' });
        });
        const R = rnd(room ? room.x0 * 31 + room.y0 * 7 : 5);
        if (room) for (let i = 0; i < 3; i++) {
          const fx = room.x0 + 1 + Math.floor(R() * Math.max(1, room.x1 - room.x0 - 1)), fy = room.y0 + 2 + Math.floor(R() * Math.max(1, room.y1 - room.y0 - 2));
          if (this._ok(fx, fy)) out.push({ x: fx * T + 16, y: fy * T + 22, sy: fy * T + 22, kind: 'floor' });
        }
        return out;
      };
      const cage = () => {
        if (!aviary) return null;
        const t = Math.max(0, this.tier('aviary')), w = [40, 48, 96, 112][Math.min(3, t)], h = [48, 56, 72, 80][Math.min(3, t)];
        const left = aviary.ax - w / 2, base = aviary.ay, sy = aviary.ay + 0.3;
        const pts = [];
        const n = t >= 2 ? 4 : 2;
        for (let i = 0; i < n; i++) pts.push({ x: left + 12 + (w - 24) * (n === 1 ? 0.5 : i / (n - 1)), y: base - 6, sy: sy, kind: 'cage' });
        pts.push({ x: left + w * 0.3, y: base - h * 0.5, sy: sy, kind: 'cage' }, { x: left + w * 0.7, y: base - h * 0.62, sy: sy, kind: 'cage' });
        return pts;
      };
      const gearRooms = H.rooms.map((r) => ({ r: r, n: perchesIn(r).filter((p) => p.kind !== 'top' && p.kind !== 'floor').length })).sort((a, b) => b.n - a.n);
      // Ruby's night cage, wherever it is
      this.nightPts = [];
      H.rooms.forEach((r) => perchesIn(r).forEach((p) => { if (p.kind === 'night') this.nightPts.push(p); }));
      const kerm = this.birds.find((b) => b.id === 'kermit');
      const kHome = kerm && kerm.npc.home !== 'aviary' ? roomOf(kerm.npc.home) : null;
      this.birds.forEach((b) => {
        let home = b.npc.home, pts = null, room = null;
        if (home === 'aviary') pts = cage();
        else room = roomOf(home);
        if (!pts && !room) room = gearRooms.length && gearRooms[0].n ? gearRooms[0].r : roomOf('lounge') || H.rooms[0];
        b.banished = false;
        if (!pts && room) {
          // Kermit's room is Kermit's. Ruby gets the rooms either side.
          if (b.id === 'ruby' && kHome && kHome.id === room.id) {
            b.banished = true;
            const others = H.rooms.filter((r) => r.id !== room.id).map((r) => ({ r: r, d: Math.abs(r.x0 - room.x0) + Math.abs(r.y0 - room.y0) })).sort((a, c) => a.d - c.d);
            pts = others.length ? perchesIn(others[0].r) : [];
          } else pts = perchesIn(room);
        }
        if (!pts || !pts.length) pts = cage() || [{ x: px(12), y: px(17) + 6, sy: px(17) + 6, kind: 'floor' }];
        b.pts = pts; b.room = room ? room.id : null;
        if (!b.at || !pts.some((p) => p.x === b.at.x && p.y === b.at.y)) { const p = pts[Math.floor(Math.random() * pts.length)]; b.at = p; b.x = p.x; b.y = p.y; b.sy = p.sy; b.fly = null; }
      });
    }
    _updateBirds(dt) {
      if (!this.birds.length) return;
      const S = this.o.state || {}, hungry = (S.birds || 0) >= 0.45, night = isNight(hourNow());
      const ruby = this.birds.find((b) => b.id === 'ruby'), kerm = this.birds.find((b) => b.id === 'kermit');
      this.birds.forEach((b) => {
        b.ph += dt;
        if (b.fly) {
          const F = b.fly;
          F.t += dt / F.dur;
          const u = Math.min(1, F.t), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          b.x = F.x0 + (F.x1 - F.x0) * e; b.y = F.y0 + (F.y1 - F.y0) * e - Math.sin(u * Math.PI) * F.arc;
          b.flip = F.x1 < F.x0;
          if (u >= 1) { b.fly = null; b.x = b.at.x; b.y = b.at.y; b.sy = b.at.sy; b.land = 0.4; }
          return;
        }
        if (b.land > 0) b.land -= dt;
        b.flap = hungry ? Math.sin(b.ph * 9) > 0.4 : b.land > 0 || (b.hop > 0);
        if (b.hop > 0) b.hop -= dt;
        b.next -= dt; b.think -= dt;
        // Ruby, at night, wants her night cage
        const sleeping = night && ((b.id === 'ruby' && b.at && b.at.kind === 'night') || (b.id === 'kermit' && b.at && b.at.kind !== 'floor'));
        if (b.think <= 0 && !this.capturing) {
          let ic;
          if (sleeping) ic = '💤';
          else if (b.id === 'kermit' && ruby && ruby.banished && Math.random() < 0.7) ic = '💢';
          else if (b.id === 'ruby' && b.banished && Math.random() < 0.6) ic = '😤';
          else if (hungry) ic = Math.random() < 0.5 ? '🌰' : (S.birds || 0) >= 1 ? '💢' : '❗';
          else if (b.at && b.at.kind === 'toy') ic = b.at.ring ? '🔔' : '🎵';
          else if (b.at && b.at.kind === 'food') ic = '😋';
          else ic = b.id === 'ruby' ? ['😈', '🦜', '🎵', '❤️'][Math.floor(Math.random() * 4)] : ['🦜', '🎵', '👀', '🌿'][Math.floor(Math.random() * 4)];
          this._say(b, [ic], 2.6, ic === '💢' || ic === '❗' ? 'bad' : '');
          b.think = sleeping ? 9 : 7 + Math.random() * 9;
        }
        if (b.at && b.at.swing) b.x = b.at.x + Math.sin(b.ph * 2.4) * 2;
        if (b.next > 0) return;
        b.next = sleeping ? 30 : (hungry ? 3 : 6) + Math.random() * 9;
        // where next
        let pool = b.pts;
        if (b.id === 'ruby' && night && this.nightPts && this.nightPts.length) pool = this.nightPts; // bedtime
        if (b.id === 'ruby' && night && b.at && b.at.kind === 'night') return;
        let opts = pool.filter((p) => p !== b.at && !this.birds.some((o) => o !== b && o.at === p));
        if (!opts.length) return;
        const want = opts.map((p) => {
          let w = p.kind === 'toy' ? 2.2 : p.kind === 'food' ? (hungry ? 6 : 1.2) : p.kind === 'night' ? (b.id === 'ruby' ? (night ? 80 : 0.6) : 0) : p.kind === 'floor' ? 0.5 : 1;
          if (b.id === 'kermit' && ruby && ruby.banished) w *= 1 + 1 / (1 + Math.hypot(p.x - ruby.x, p.y - ruby.y) / 60);
          return { p: p, w: w };
        });
        const pick = pickW(want);
        if (!pick) return;
        const p = pick.p, d = Math.hypot(p.x - b.x, p.y - b.y);
        b.at = p;
        if (d < 3) return;
        if (d < 28 && p.kind === 'cage') { b.fly = { x0: b.x, y0: b.y, x1: p.x, y1: p.y, t: 0, dur: 0.35, arc: 5 }; b.sy = p.sy; return; }
        b.fly = { x0: b.x, y0: b.y, x1: p.x, y1: p.y, t: 0, dur: Math.max(0.5, Math.min(2.4, d / 110)), arc: Math.min(40, 10 + d * 0.2) };
        b.sy = p.kind === 'cage' ? p.sy : 1e6;
      });
      // people nearby: Ruby bites them, Kermit shows off
      if (!this.capturing) this.birds.forEach((b) => {
        if (b.fly || (b.reactAt || 0) > this.t) return;
        const near = [this.hero].concat(this.npcs.filter((n) => n.sheets)).find((o) => { if (!o || o.sleep || o.dozing) return false; const p = this._pos(o); return Math.hypot(p.x - b.x, p.y - 18 - b.y) < (b.at && b.at.kind === 'cage' ? 70 : 44); });
        if (!near) return;
        b.reactAt = this.t + 14 + Math.random() * 10;
        if (b.id === 'ruby' && Math.random() < 0.6) { this._say(b, ['😈'], 1.8, 'bad'); this.fx.push({ x: b.x, y: b.y - 6, t: 0, life: 1, txt: '💥' }); this._say(near, [Math.random() < 0.2 ? '🩸' : '😣'], 2, 'bad'); }
        else { this._say(b, [b.id === 'ruby' ? '❤️' : '🦜'], 1.8); b.hop = 0.35; if (!near.bub) this._say(near, ['😄'], 1.8, 'good'); }
      });
      if (hungry && Math.random() < dt * 0.12 && !this.capturing) { const b = this.birds[Math.floor(Math.random() * this.birds.length)]; this.fx.push({ x: b.x, y: b.y - 18, t: 0, life: 1.4, txt: (S.birds || 0) >= 1 ? '💢' : '❗' }); }
    }
    // ---------------------------------------------------------------- critters (a cat by its basket, chooks by the coop...)
    // Purely for company: each animal home that's placed has one animal pottering about near it.
    _critterHomes() {
      const old = this.critters || [], next = [];
      this.objs.forEach((ob) => {
        if (!ob.f || !ob.f.pet || ob.ghost || ob.item == null) return;
        const was = old.find((c) => c.item === ob.item);
        const hc = this._nearestOk(Math.floor(ob.ax / T), Math.floor((ob.ay - 4) / T));
        if (!hc) return;
        const hx = hc[0] * T + 16, hy = hc[1] * T + 22;
        if (was && was.hx === hx && was.hy === hy) { next.push(was); return; }
        next.push({ item: ob.item, kind: ob.f.pet, hx: hx, hy: hy, x: hx, y: hy, tx: null, ty: null, wait: Math.random() * 3, fr: 0, ft: 0, flip: false, n: ob.f.n });
      });
      this.critters = next;
    }
    _critterClear(x0, y0, x1, y1) {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (!this._ok(Math.floor(x / T), Math.floor(y / T))) return false; }
      return true;
    }
    _updateCritters(dt) {
      (this.critters || []).forEach((c) => {
        if (c.tx == null) {
          if ((c.wait -= dt) > 0) return;
          const far = Math.hypot(c.x - c.hx, c.y - c.hy) > 3.5 * T;
          const tx = far ? c.hx : c.x + (Math.random() * 2 - 1) * 2.5 * T, ty = far ? c.hy : c.y + (Math.random() * 2 - 1) * 1.8 * T;
          if (Math.hypot(tx - c.hx, ty - c.hy) < 4.5 * T && this._critterClear(c.x, c.y, tx, ty)) { c.tx = tx; c.ty = ty; c.flip = tx < c.x; } else c.wait = 0.4;
          return;
        }
        const d = Math.hypot(c.tx - c.x, c.ty - c.y), sp = (c.kind === 'dog' ? 34 : c.kind === 'frog' ? 16 : 24) * dt;
        if (d <= sp) { c.x = c.tx; c.y = c.ty; c.tx = null; c.fr = 0; c.wait = 1 + Math.random() * (c.kind === 'cat' ? 9 : 4); return; }
        c.x += (c.tx - c.x) / d * sp; c.y += (c.ty - c.y) / d * sp;
        if ((c.ft += dt) > 0.16) { c.ft = 0; c.fr = 1 - c.fr; }
      });
    }
    _drawCritter(g, c) {
      const key = 'x.' + c.kind + '.' + c.fr, r = this.spr[key];
      if (!r) return;
      g.fillStyle = 'rgba(15,10,18,0.22)'; g.fillRect(Math.round(c.x - r[2] / 2 + 2), Math.round(c.y - 1), r[2] - 4, 2);
      this._drawSpr(g, key, Math.round(c.x - r[2] / 2), Math.round(c.y - r[3] + 1), c.flip);
    }
    _drawBird(g, b) {
      const night = isNight(hourNow());
      let fr;
      if (b.fly) fr = 'fly' + (Math.floor(this.t * 10) % 2);
      else if (b.flap) fr = 'flap0';
      else fr = 'perch' + ((Math.floor(b.ph * 1.3) % 3 === 0) ? 1 : 0);
      if (night && !b.fly && b.at && (b.at.kind === 'night' || b.id === 'kermit')) fr = 'perch0';
      const key = b.id + '.' + fr;
      const hop = b.hop > 0 ? Math.sin((0.35 - b.hop) / 0.35 * Math.PI) * 4 : 0;
      if (!b.fly && b.at && b.at.kind === 'floor') { g.fillStyle = 'rgba(15,10,18,0.25)'; g.fillRect(Math.round(b.x - 4), Math.round(b.y), 8, 2); }
      this._drawSpr(g, key, Math.round(b.x - 7), Math.round(b.y - 13 - hop), b.flip);
    }

    // ---------------------------------------------------------------- drawing
    _resize() {
      // 2.9: pixel art doesn't need every device pixel. On a dense screen (the A54 is 2.6x) the scene is drawn at two canvas
      // pixels to the world pixel instead of three and stretched by the page, which is under half the pixels to fill per
      // frame and looks the same. What is seen (about 344 world pixels across) doesn't change.
      const r = this.el.getBoundingClientRect(), dev = Math.min(3, window.devicePixelRatio || 1);
      const k0 = Math.max(1, Math.round((r.width * dev) / 400)), dpr = this.o.fullRes ? dev : dev * Math.min(k0, 2) / k0;
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      this.dpr = dpr;
    }
    // 2.13: with more land the world outgrows the closest whole-number zoom, so there's one more step out: all of it
    _fitK() { return Math.min(this.canvas.width / WW, this.canvas.height / WH); }
    _scale() {
      if (this.fit) { const f = this._fitK(); if (f < 1) return f; }
      if (this.k) return this.k;
      const w = this.canvas.width;
      return Math.max(1, Math.round(w / 400)); // about 12 tiles across
    }
    zoom() {
      const opts = [0, 1, 2, 3, 4].filter((v, i) => i === 0 || v * 300 <= this.canvas.width * 1.4);
      if (this.fit) { this.fit = false; this.k = 0; return 0; }
      const i = opts.indexOf(this.k);
      if (i === opts.length - 1 && this._fitK() < 1) { this.fit = true; return -1; }
      this.k = opts[(i + 1) % opts.length]; return this.k;
    }
    setZoom(k) { this.k = k | 0; this.fit = false; }
    follow() { this.cam.manual = 0; this.focusK = null; }
    _camTarget() {
      const H = this.hero;
      if (this.focusK) {
        if (this.focusK.indexOf('npc:') === 0) { const id = this.focusK.slice(4), a = this.npcs.find((n) => n.id === id), b = this.birds.find((x) => x.id === id); if (a) { const p = this._pos(a); return [p.x, p.y - 24]; } if (b) return [b.x, b.y - 24]; }
        const o = this._find(this.focusK); if (o) return [o.ax, o.ay - 24];
      }
      const p = this._pos(H);
      return [p.x, H.sleep ? p.y : p.y - 24];
    }
    _frame(now) {
      if (!this.alive) return;
      this._raf = requestAnimationFrame((t) => this._frame(t));
      if (!this.active || document.hidden) { this.last = now; return; }
      const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
      if (dt < 1 / (this.o.fps || 62) && this.last) return;   // 2.9: up to 60 frames a second (was 30)
      this.last = now;
      this._resize();
      this._update(dt);
      this._updateNpcs(dt);
      this._updateOracle(dt);
      this._updateBirds(dt);
      this._updateCritters(dt);
      if (this.cam.manual > 0) this.cam.manual -= dt; else if (!this.edit || this.focusK) { const [tx, ty] = this._camTarget(); this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 3); this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 3); }
      this.render(this.g, this.canvas.width, this.canvas.height, this._scale(), this.cam.x, this.cam.y);
    }
    _find(k) {
      const ids = { floors: 'couch', walls: 'fireplace', dishes: 'sink', laundry: 'washer', birds: 'aviary', gym: 'bag', study: 'desk', reno: 'couch' };
      const id = ids[k] || k;
      if (id === 'lawn' || id === 'yard') { const L = this.lawnRect; return L ? { ax: (L.x0 + L.x1 + 1) / 2 * T, ay: (L.y1 + 1) * T } : { ax: px(11), ay: px(19) }; }
      if (id === 'garage' || id === 'shed') { const r = this.geom.rooms.find((rr) => rr.style === id); if (r) return { ax: (r.x0 + r.x1 + 1) / 2 * T, ay: (r.y1 + 1) * T - 8 }; }
      const all = this.objs.concat(this.wallItems);
      return all.find((o) => o.item && !o.front && (o.k === id || o.est === id)) || all.find((o) => o.id === id && o.s) || null;
    }
    focus(k) { this.focusK = k; this.cam.manual = 0; this.flash = { k: k, t: 0 }; }
    unfocus() { this.focusK = null; this.flash = null; }
    _clampCam(cx, cy, W, H, k) {
      const vw = W / k, vh = H / k;
      cx = vw >= WW ? WW / 2 : Math.max(vw / 2, Math.min(WW - vw / 2, cx));
      cy = vh >= WH ? WH / 2 : Math.max(vh / 2, Math.min(WH - vh / 2, cy));
      return [cx, cy];
    }
    _drawObj(g, ob, flashOn) {
      if (ob.relic) { this._relic(g, ob); return; }
      if (ob.oraclePortal) {
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.1);
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(132,91,220,' + (0.08 + pulse * 0.12) + ')';
        g.beginPath(); g.ellipse(ob.ax, ob.ay - 27, 21 + pulse * 3, 27 + pulse * 3, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
      const r = this.spr[ob.s];
      if (!r) { if (ob.oraclePortal) this._drawOraclePortal(g, ob); return; }
      const x = Math.round(ob.ax - r[2] / 2), y = Math.round(ob.ay - r[3]);
      if (ob.ghost) g.globalAlpha = 0.32;
      if (ob.sway) { g.save(); const a = Math.sin(this.t * 1.3 + ob.sway) * 0.05; g.translate(ob.ax, ob.ay); g.transform(1, 0, a, 1, 0, 0); g.translate(-ob.ax, -ob.ay); this._drawSpr(g, ob.s, x, y); g.restore(); }
      else this._drawSpr(g, ob.s, x, y, ob.flip);
      g.globalAlpha = 1;
      if (ob.ghost) return;
      if (flashOn && this.flash && ob.item && (ob.est === this.flash.k || ob.k === this.flash.k || this._find(this.flash.k) === ob)) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35; this._drawSpr(g, ob.s, x, y, ob.flip); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      if (ob.fire) { const fi = Math.floor(this.t * 7) % 3, fr = this.spr['fire.' + fi]; if (fr) this._drawSpr(g, 'fire.' + fi, Math.round(ob.ax - fr[2] / 2), Math.round(ob.ay - 30)); }
      if (ob.flies) for (let f = 0; f < 4; f++) { const a = this.t * 3 + f * 1.7; g.fillStyle = '#1a1a1a'; g.fillRect(Math.round(ob.ax + Math.cos(a) * 10), Math.round(ob.ay - 22 + Math.sin(a * 1.3) * 6), 1, 1); }
      if (ob.s && /\.5(\.b|\.f)?$/.test(ob.s) && Math.sin(this.t * 3 + ob.ax) > 0.6) { g.fillStyle = '#ffffff'; const sx = x + ((ob.ax * 7 + Math.floor(this.t)) % Math.max(1, r[2])), sy = y + ((ob.ay * 3 + Math.floor(this.t * 1.3)) % Math.max(1, r[3])); g.fillRect(sx, sy, 1, 1); g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3); }
    }
    _drawOraclePortal(g, ob) {
      const x = Math.round(ob.ax - 18), y = Math.round(ob.ay - 54);
      const rect = (col, a, b, w, h) => { g.fillStyle = col; g.fillRect(x + a, y + b, w, h); };
      // Crisp 1px charcoal outline, worn stone frame, and a violet-blue aperture.
      rect('#241d28', 5, 2, 28, 48); rect('#241d28', 2, 10, 34, 38); rect('#241d28', 9, 0, 18, 5);
      rect('#756b78', 8, 5, 22, 39); rect('#a69a8c', 10, 5, 17, 2); rect('#514653', 6, 9, 26, 36);
      rect('#21182f', 11, 11, 14, 30); rect('#563b83', 13, 12, 10, 27); rect('#7654b0', 15, 13, 6, 24);
      rect('#b38ce8', 16, 14, 2, 20); rect('#4d79a8', 12, 17, 2, 13); rect('#b38ce8', 23, 18, 1, 10);
      rect('#d7bd83', 7, 8, 2, 3); rect('#d7bd83', 27, 8, 2, 3); rect('#514653', 8, 43, 20, 5);
      rect('#241d28', 1, 46, 36, 6); rect('#8e8174', 3, 45, 32, 4); rect('#c0a77f', 5, 45, 28, 1);
      const sparkle = Math.floor(this.t * 3) % 3;
      rect('#e3d0ff', 16 + sparkle * 2, 8 + (sparkle % 2) * 3, 1, 1);
      rect('#9ac9e8', 10 + sparkle * 4, 22 - (sparkle % 2) * 4, 1, 1);
    }
    render(g, W, H, k, cx, cy, o) {
      o = o || {};
      if (this.staticDirty || !this.stat) this._static();
      [cx, cy] = o.free ? [cx, cy] : this._clampCam(cx, cy, W, H, k);
      const ox = Math.round(W / 2 - cx * k), oy = Math.round(H / 2 - cy * k);
      this.view = { ox: ox, oy: oy, k: k };
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#0d0b09'; g.fillRect(0, 0, W, H);
      g.imageSmoothingEnabled = false;
      g.setTransform(k, 0, 0, k, ox, oy);
      // only the part of the ground that's on screen (the estate can be several screens across), and only what stands there
      const vx0 = Math.max(0, Math.floor(-ox / k)), vy0 = Math.max(0, Math.floor(-oy / k)), vx1 = Math.min(WW, Math.ceil((W - ox) / k)), vy1 = Math.min(WH, Math.ceil((H - oy) / k));
      if (vx1 > vx0 && vy1 > vy0) g.drawImage(this.stat, vx0, vy0, vx1 - vx0, vy1 - vy0, vx0, vy0, vx1 - vx0, vy1 - vy0);
      const seen = (ob) => ob.ax > vx0 - 120 && ob.ax < vx1 + 120 && ob.ay > vy0 - 40 && ob.ay < vy1 + 160;
      const flashOn = this.flash && Math.floor(this.t * 4) % 2 === 0;
      // what hangs on the walls
      this.wallItems.forEach((w) => { w.fire = w.f && w.f.fire; this._drawObj(g, w, flashOn); });
      // everything that stands on the floor, back to front
      const H0 = this.hero, hy = this._pos(H0).sy;
      const list = this.objs.filter((ob) => (ob.s || ob.relic) && !ob.hidden && seen(ob));
      const items = list.map((ob) => ({ y: ob.flat ? ob.ay - 4000 : ob.ay + (ob.z || 0) * 0.01 + (ob.front ? 0.5 : 0), ob: ob }));
      items.push({ y: hy + (H0.spot && H0.spot.s.swim ? -0.5 : 0) + 0.2, actor: H0 });
      this.npcs.forEach((a) => { if (a.sheets) items.push({ y: this._pos(a).sy + 0.15, actor: a }); });
      this.birds.forEach((b) => items.push({ y: b.fly ? 1e6 : b.sy, bird: b }));
      (this.critters || []).forEach((c) => items.push({ y: c.y + 0.1, crit: c }));
      items.sort((a, b) => a.y - b.y);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.actor) { this._drawActor(g, it.actor); continue; }
        if (it.bird) { this._drawBird(g, it.bird); continue; }
        if (it.crit) { this._drawCritter(g, it.crit); continue; }
        this._drawObj(g, it.ob, flashOn);
      }
      this._drawNightmare(g);   // 2.27
      // sparks
      this.fx = this.fx.filter((f) => (f.t += 1 / 30) < f.life);
      this.fx.forEach((f) => { if (f.txt) return; f.x += f.vx / 30; f.y += f.vy / 30; f.vy += 60 / 30; g.fillStyle = f.c; g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); });
      if (!this.edit) this._drawWeather(g);
      if (this.edit) this._drawEdit(g);
      else if (this.starsOn && !o.noStars) this._drawStars(g);
      // time of day
      const hr = hourNow();
      const night = hr >= 20.5 || hr < 5 ? 1 : hr >= 18.5 ? (hr - 18.5) / 2 : hr < 6.5 ? (6.5 - hr) / 1.5 : 0;
      if (night > 0 && !o.noNight && !this.edit) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = 'rgba(16,20,52,' + (0.38 * night).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'lighter';
        this.wallItems.concat(this.objs).forEach((ob) => {
          if (ob.ghost || !ob.f || !ob.f.light) return;
          const lx = ob.ax, ly = ob.f.fire ? ob.ay - 14 : ob.ay - ob.sh * 0.78, rr = ob.f.light;
          const sx = ox + lx * k, sy = oy + ly * k, R = rr * k;
          const gr = g.createRadialGradient(sx, sy, 0, sx, sy, R);
          gr.addColorStop(0, 'rgba(255,150,60,' + (0.22 * night).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,150,60,0)');
          g.fillStyle = gr; g.fillRect(sx - R, sy - R, R * 2, R * 2);
        });
        g.globalCompositeOperation = 'source-over';
      }
      // overlays in screen space: thoughts, bird squawks
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (!this.edit) this._drawBubbles(g, ox, oy, k);
      this.fx.forEach((f) => { if (!f.txt) return; const a = 1 - f.t / f.life; g.globalAlpha = Math.min(1, a * 2); g.font = Math.round(7 * k) + 'px sans-serif'; g.textAlign = 'center'; g.fillText(f.txt, ox + f.x * k, oy + (f.y - f.t * 8) * k); g.globalAlpha = 1; });
    }
    // A pulsing star at the top right of anything you can tap for its quests.
    // 2.8: rain outside on wet days, and a string of lights along the walls in December. Both worked out from the clock.
    setWeather(w, festive) { this.o.weather = w || null; this.o.festive = !!festive; }
    _drawWeather(g) {
      const geom = this.geom; if (!geom) return;
      if (this.o.festive) {
        const cols = ['#e2483d', '#f2c14e', '#4fb477', '#4f8fe0'], ph = Math.floor(this.t * 2);
        geom.rooms.forEach((r) => {
          const y = r.y0 * T + 5;
          for (let x = r.x0 * T + 5, i = 0; x < (r.x1 + 1) * T - 4; x += 9, i++) {
            g.fillStyle = '#2a2018'; g.fillRect(x - 4, y + (i % 2 ? 1 : 0), 9, 1);
            g.globalAlpha = (i + ph) % 3 === 0 ? 0.45 : 1; g.fillStyle = cols[i % 4]; g.fillRect(x, y + 1 + (i % 2), 2, 2); g.globalAlpha = 1;
          }
        });
      }
      if (this.o.weather === 'rain') {
        g.fillStyle = 'rgba(190,215,255,0.7)';
        for (let i = 0, n = Math.round(150 * Math.min(6, (WW * WH) / (1088 * 864))); i < n; i++) {
          const y = ((i * 71.37) % WH + this.t * (230 + (i % 5) * 18)) % WH, x = (((i * 193.71) % WW) - y * 0.18 + WW) % WW;
          if (geom.at(Math.floor(x / T), Math.floor(y / T)) >= 0) continue;   // not through the roof
          g.fillRect(Math.round(x), Math.round(y), 1, 5);
        }
      }
    }
    _drawStars(g) {
      const placed = this.starPts = [];
      const ph = this.t;
      const chores = (this.o.mind && this.o.mind.chores) || {};
      const condOf = (id) => {
        const ks = TAG_FEAT[id];
        if (!ks) return null;
        let best = null;
        ks.forEach((k) => { const c = chores[k]; if (c && (!best || c.state > best.state || (c.state === best.state && c.level > best.level))) best = c; });
        return best;
      };
      // what a tag says: flies and a stink where it's gone bad, a sparkle where it's up to date, a star (tap me) otherwise
      const signal = (x, y, c) => {
        g.save();
        if (c.state >= 1) {
          const n = c.state === 2 ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const a = ph * (5 + i) + i * 2.1 + x * 0.07, fx = x + Math.cos(a) * (6 + i * 2), fy = y + Math.sin(a * 1.3) * (4 + i);
            g.fillStyle = '#16120f'; g.fillRect(Math.round(fx), Math.round(fy), 2, 2);
            g.fillStyle = 'rgba(210,210,220,0.55)'; g.fillRect(Math.round(fx) - 1 + (Math.sin(a * 9) > 0 ? 1 : 0), Math.round(fy) - 1, 1, 1);
          }
          const lines = c.state === 2 ? 3 : 1;
          for (let i = 0; i < lines; i++) for (let j = 0; j < 14; j++) {
            const u = ((ph * 0.8 + i * 0.33) % 1), yy = y + 4 - j - u * 6, al = Math.max(0, 0.7 - j / 18) * (c.state === 2 ? 1 : 0.6);
            g.fillStyle = 'rgba(150,200,90,' + al.toFixed(2) + ')'; g.fillRect(Math.round(x - 5 + i * 5 + Math.sin(j * 0.8 + ph * 3 + i) * 1.6), Math.round(yy), 1, 1);
          }
        } else {
          for (let i = 0; i < 3; i++) {
            const tw = 0.5 + 0.5 * Math.sin(ph * 4 + i * 2.2), sx = Math.round(x - 5 + i * 5 + (i === 1 ? 2 : 0)), sy = Math.round(y - 5 - (i % 2) * 4 + 2);
            g.fillStyle = 'rgba(255,240,170,' + (0.35 + 0.65 * tw).toFixed(2) + ')';
            g.fillRect(sx, sy, 1, 1);
            if (tw > 0.55) { g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3); }
          }
        }
        g.restore();
      };
      const seenIt = this.o.seen || {};
      const star = (x, y, id) => {
        if (placed.some((p) => p.id === id && Math.abs(p.x - x) + Math.abs(p.y - y) < 72)) return;
        const cond = condOf(id);
        if (!cond && seenIt[id]) return;   // 2.27: nothing to say about it, and he's seen it: no star
        placed.push({ x: x, y: y, id: id });
        if (cond && (cond.state >= 1 || cond.level <= 0.12)) { signal(x, y, cond); return; }
        const pulse = 0.5 + 0.5 * Math.sin(ph * 3 + x * 0.05);
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(255,210,90,' + (0.18 + 0.22 * pulse).toFixed(3) + ')';
        g.beginPath(); g.arc(x, y, 4 + pulse * 2.5, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
        this._drawSpr(g, 'star.' + (pulse > 0.55 ? 1 : 0), Math.round(x - 5), Math.round(y - 5));
      };
      this.wallItems.concat(this.objs).forEach((ob) => {
        if (!ob.id || !ob.item || ob.ghost || ob.front || ob.over || ob.s === 'counter' || ob.hidden) return;
        if (ob.k === 'renojob' && (this.o.state.reno == null || this.o.state.reno > 0)) return;
        const x0 = ob.ax - ob.sw / 2, y0 = ob.ay - ob.sh;
        star(Math.round(x0 + ob.sw - 2), Math.round(y0 + 3), ob.id);
      });
      if (this.lawnRect) { const L = this.lawnRect; star((L.x1 + 1) * T - 6, L.y0 * T + 8, 'lawn'); }
      if (!this.lotOpen) star(26 * T + 10, 18 * T - 8, 'garden');
    }
    // 2.27: a chore long past bad goes nightmarish: its room bruises dark and breathes, black stuff creeps out from it,
    // it drips, and things in the gloom open their eyes now and then.
    _drawNightmare(g) {
      const D = (this.o.state && this.o.state.dire) || {};
      if (!Object.keys(D).some((k) => D[k]) || this.edit) return;
      const t = this.t, H = this._house(), rooms = {}, spots = [];
      this.wallItems.concat(this.objs).forEach((ob) => {
        if (!ob.id || ob.ghost || ob.hidden || ob.s === 'counter' || ob.over) return;
        const fs = TAG_FEAT[ob.id];
        if (!fs || !fs.some((f) => D[f])) return;
        if (!isFinite(ob.ax) || !isFinite(ob.ay) || !isFinite(ob.sh) || !isFinite(ob.sw)) return;
        spots.push({ x: ob.ax, y: ob.ay - ob.sh / 2, w: Math.max(ob.sw, 20), h: Math.max(ob.sh, 20), seed: (ob.item | 0) * 7.3, base: ob.ay });
        if (ob.room) rooms[ob.room] = 1;
      });
      // the ground itself rots: a bruised wash, black veins that pulse, and splits in it
      const rot = (x0, y0, w, h, seed) => {
        g.fillStyle = 'rgba(26,3,34,' + (0.36 + 0.08 * Math.sin(t * 1.2 + seed)).toFixed(3) + ')'; g.fillRect(x0, y0, w, h);
        const n = Math.max(3, Math.round(w * h / 2600));
        g.lineWidth = 1;
        for (let i = 0; i < n; i++) {
          const r1 = Math.abs(Math.sin(seed * 7.1 + i * 12.9)), r2 = Math.abs(Math.sin(seed * 3.3 + i * 4.7));
          let x = x0 + r1 * w, y = y0 + r2 * h;
          g.strokeStyle = 'rgba(70,0,80,' + (0.5 + 0.35 * Math.sin(t * 2 + i)).toFixed(2) + ')';
          g.beginPath(); g.moveTo(x, y);
          for (let j = 0; j < 7; j++) { x += Math.cos(seed + i * 2.1 + j * 0.9) * 6; y += Math.sin(seed * 1.7 + i + j * 1.3) * 4; if (x < x0 || x > x0 + w || y < y0 || y > y0 + h) break; g.lineTo(x, y); }
          g.stroke();
          g.fillStyle = 'rgba(5,0,8,0.8)'; g.fillRect(Math.round(x0 + r2 * w), Math.round(y0 + r1 * h), 5, 1); g.fillRect(Math.round(x0 + r2 * w) + 2, Math.round(y0 + r1 * h) + 1, 4, 1);
        }
      };
      if (D.lawn && this.lawnRect) {
        const L = this.lawnRect, x0 = L.x0 * T, y0 = L.y0 * T, w = (L.x1 - L.x0 + 1) * T, h = (L.y1 - L.y0 + 1) * T;
        rot(x0, y0, w, h, 3.1);
        for (let i = 0; i < 6; i++) spots.push({ x: x0 + ((i * 97 + 31) % Math.max(1, w)), y: y0 + ((i * 53 + 17) % Math.max(1, h)), w: 26, h: 18, seed: i * 13.7, base: y0 + ((i * 53 + 17) % Math.max(1, h)) + 9, lawn: 1 });
      }
      (H.rooms || []).forEach((r) => {
        if (!rooms[r.id]) return;
        rot(r.x0 * T, (r.y0 + 2) * T, (r.x1 - r.x0 + 1) * T, (r.y1 - r.y0 - 2) * T, r.x0 * 1.3 + r.y0);
      });
      spots.forEach((p) => {
        const R = Math.max(p.w, p.h) * 1.1, gr = g.createRadialGradient(p.x, p.y, 2, p.x, p.y, R);
        gr.addColorStop(0, 'rgba(6,0,10,0.82)'); gr.addColorStop(0.6, 'rgba(20,0,28,0.45)'); gr.addColorStop(1, 'rgba(8,0,12,0)');
        g.fillStyle = gr; g.fillRect(p.x - R, p.y - R, R * 2, R * 2);
        // creeping black tendrils along the floor
        g.strokeStyle = 'rgba(10,0,16,0.9)'; g.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const a = p.seed + i * 0.9, len = 20 + 8 * Math.sin(t * 0.7 + i + p.seed);
          g.beginPath(); g.moveTo(p.x, p.base);
          for (let j = 1; j <= 6; j++) { const u = j / 6; g.lineTo(p.x + Math.cos(a) * len * u * 1.6 + Math.sin(t * 2 + j + i) * 1.5, p.base + Math.sin(a) * len * u * 0.5 + Math.cos(t * 1.7 + j) * 1); }
          g.stroke();
        }
        // drips
        if (!p.lawn) for (let i = 0; i < 3; i++) {
          const dx = Math.round(p.x - p.w / 3 + i * p.w / 3), dl = 3 + Math.round(5 * ((Math.sin(t * 0.9 + i * 2 + p.seed) + 1) / 2));
          g.fillStyle = 'rgba(40,0,46,0.9)'; g.fillRect(dx, Math.round(p.y - p.h / 2), 1, dl); g.fillRect(dx - 1, Math.round(p.y - p.h / 2) + dl, 3, 2);
        }
        // eyes in the gloom: open, blink, gone, back
        for (let e = 0; e < 2; e++) {
          const ph = (t * 0.45 + p.seed + e * 1.9) % 6;
          if (ph > 4.2 || (ph > 1.4 && ph < 1.55)) continue;
          const ex = Math.round(p.x + Math.cos(p.seed * 3 + e * 2.4) * p.w * 0.55), ey = Math.round(p.y + Math.sin(p.seed * 5 + e * 1.7) * p.h * 0.4);
          g.fillStyle = 'rgba(255,40,40,0.35)'; g.fillRect(ex - 2, ey - 1, 9, 4);
          g.fillStyle = '#ff3b30'; g.fillRect(ex, ey, 2, 1); g.fillRect(ex + 4, ey, 2, 1);
          g.fillStyle = '#ffd0c8'; g.fillRect(ex + (Math.sin(t + e) > 0 ? 1 : 0), ey, 1, 1); g.fillRect(ex + 4 + (Math.sin(t + e) > 0 ? 1 : 0), ey, 1, 1);
        }
      });
    }
    // Build mode: the grid, the rooms, what's picked up, where doors are.
    _drawEdit(g) {
      const E = this.edit, H = this._house(), geom = this.geom;
      const t = this.t, pulse = 0.5 + 0.5 * Math.sin(t * 5);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(255,240,200,0.10)';
      g.beginPath();
      for (let y = 0; y < HT; y++) for (let x = 0; x < WT; x++) { const kd = geom.kind(x, y); if (kd) { g.rect(x * T + 0.5, y * T + 0.5, T - 1, T - 1); } }
      g.stroke();
      H.rooms.forEach((r) => {
        const on = E.room === r.id;
        if (on && E.tool === 'rmove') { g.fillStyle = 'rgba(255,215,90,' + (0.08 + 0.1 * pulse).toFixed(2) + ')'; g.fillRect(r.x0 * T, r.y0 * T, (r.x1 - r.x0 + 1) * T, (r.y1 - r.y0 + 1) * T); }
        g.strokeStyle = on ? 'rgba(255,215,90,' + (0.6 + 0.4 * pulse).toFixed(2) + ')' : 'rgba(255,240,200,0.35)';
        g.lineWidth = on ? 2 : 1;
        g.strokeRect(r.x0 * T + 1, r.y0 * T + 1, (r.x1 - r.x0 + 1) * T - 2, (r.y1 - r.y0 + 1) * T - 2);
      });
      if (E.tool === 'door' || E.tool === 'room') {
        H.rooms.forEach((r) => {
          g.fillStyle = 'rgba(255,240,200,0.07)';
          for (let x = r.x0 + 1; x < r.x1; x++) { g.fillRect(x * T + 2, r.y0 * T + 2, T - 4, 2 * T - 4); g.fillRect(x * T + 2, r.y1 * T + 2, T - 4, T - 4); }
          for (let y = r.y0 + 2; y < r.y1; y++) { g.fillRect(r.x0 * T + 2, y * T + 2, T - 4, T - 4); g.fillRect(r.x1 * T + 2, y * T + 2, T - 4, T - 4); }
        });
      }
      H.doors.forEach((d) => { g.fillStyle = 'rgba(110,220,130,' + (E.tool === 'door' ? 0.45 : 0.22) + ')'; g.fillRect(d[0] * T + 4, d[1] * T + 4, T - 8, T - 8); });
      if (E.sel != null) {
        const it = H.items.find((x) => x.id === E.sel), f = it && G().furnOf(it);
        if (f) {
          const ft = G().footOf(it, f);
          const y0 = f.at === 'wall' ? (geom.rooms[geom.at(it.x, it.y)] || { y0: it.y }).y0 : ft[1];
          g.fillStyle = 'rgba(255,215,90,' + (0.15 + 0.15 * pulse).toFixed(2) + ')';
          g.fillRect(ft[0] * T, y0 * T, (ft[2] - ft[0] + 1) * T, (ft[3] - y0 + 1) * T);
          g.strokeStyle = '#ffd75a'; g.lineWidth = 2; g.strokeRect(ft[0] * T + 1, y0 * T + 1, (ft[2] - ft[0] + 1) * T - 2, (ft[3] - y0 + 1) * T - 2);
          const ob = this.objById[it.id];
          if (ob && ob.s) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25 + 0.2 * pulse; this._drawSpr(g, ob.s, Math.round(ob.ax - ob.sw / 2), Math.round(ob.ay - ob.sh), ob.flip); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
        }
      }
      if (E.draft) {
        const [x, y] = E.draft;
        g.strokeStyle = '#ffd75a'; g.lineWidth = 2;
        g.strokeRect(x * T + 2, y * T + 2, T - 4, T - 4);
        g.beginPath(); g.moveTo(x * T + 16, y * T - 6); g.lineTo(x * T + 16, y * T + 38); g.moveTo(x * T - 6, y * T + 16); g.lineTo(x * T + 38, y * T + 16); g.stroke();
      }
      if (E.mark && E.mark.until > Date.now()) {
        g.fillStyle = E.mark.bad ? 'rgba(230,60,60,' + (0.3 + 0.3 * pulse).toFixed(2) + ')' : 'rgba(110,220,130,' + (0.3 + 0.3 * pulse).toFixed(2) + ')';
        E.mark.cells.forEach((c) => g.fillRect(c[0] * T + 1, c[1] * T + 1, T - 2, T - 2));
      }
    }
    _relic(g, ob) {
      const im = this._relicImg(ob.relic);
      if (!im) return;
      if (ob.ghost) g.globalAlpha = 0.32;
      g.drawImage(im, Math.round(ob.ax - im.width / 2), Math.round(ob.ay - im.height));
      g.globalAlpha = 1;
      if (ob.sw !== im.width) { ob.sw = im.width; ob.sh = im.height; }
    }
    _relicImg(k) {
      if (this.relics[k] !== undefined) return this.relics[k];
      this.relics[k] = null;
      const f = this.o.relicImage;
      if (!f) return null;
      Promise.resolve(f(k)).then((im) => { this.relics[k] = im || null; }).catch(() => {});
      return null;
    }
    _drawActor(g, a) {
      const sh = a.sheets;
      if (!sh) return;
      if (a.sleep) {
        const sp = a.sleep, idle = sh.idle || sh.walk, bob = Math.round(Math.sin(this.t * 1.1 + a.x) * 0.6);
        g.drawImage(idle, 16, 2 * 64 + (a.kid ? 20 : 12), 32, 22, sp.x - 16, sp.y - 12 + bob, 32, 22);
        return;
      }
      let anim = a.party > 0 ? 'jump' : a.anim, dir = DIRS[a.dir] == null ? 2 : DIRS[a.dir];
      if (!sh[anim]) anim = a.seated && sh.sit ? 'sit' : 'idle';
      let sheet = sh[anim] || sh.idle;
      const A = root.LPC.ANIM[anim] || root.LPC.ANIM.idle;
      let f;
      if (anim === 'walk') {
        const moving = (a.path && a.path.length) || (a.spot && a.spot.s.mow && !a.spot.fret);
        f = moving ? 1 + Math.floor(a.ft * ANIM_FPS.walk) % 8 : 0;
        if (a.spot && a.spot.s.mow && !a.spot.fret && a.scythe) sheet = a.scythe;
      } else if (anim === 'sit') f = a.spot && a.spot.s.frame != null ? a.spot.s.frame : 0;
      else if (anim === 'idle') f = Math.floor(a.ft * ANIM_FPS.idle) % 2;
      else if (anim === 'jump') f = Math.floor(a.ft * ANIM_FPS.jump) % A.n;
      else { const cyc = A.n + 6; f = Math.floor(a.ft * (ANIM_FPS[anim] || 8)) % cyc; if (f >= A.n) f = 0; } // swing, pause, swing
      const row = A.rows === 1 ? 0 : dir;
      const x = Math.round((a.seated ? a.seated.x : a.x) - 32), y = Math.round((a.seated ? a.seated.y : a.y) - FEET);
      const swim = a.spot && a.spot.s.swim && !a.path.length;
      if (!a.seated) { g.fillStyle = 'rgba(15,10,18,0.28)'; g.beginPath(); g.ellipse(x + 32, y + FEET, a.kid === 'baby' ? 5 : a.kid ? 7 : 9, a.kid ? 2 : 3, 0, 0, Math.PI * 2); g.fill(); }
      if (swim) {
        const bob = Math.round(Math.sin(this.t * 2.2) * 1);
        g.drawImage(sheet, f * 64, row * 64, 64, 40, x, y + 12 + bob, 64, 40);
        g.fillStyle = 'rgba(120,210,240,0.55)'; g.fillRect(x + 20, y + 48 + bob, 24, 2);
        return;
      }
      if (a.kid === 'baby') { const z = 0.7, fx = (a.seated ? a.seated.x : a.x), fy = (a.seated ? a.seated.y : a.y); g.drawImage(sheet, (f % A.n) * 64, row * 64, 64, 64, Math.round(fx - 32 * z), Math.round(fy - FEET * z), Math.round(64 * z), Math.round(64 * z)); return; }
      g.drawImage(sheet, (f % A.n) * 64, row * 64, 64, 64, x, y, 64, 64);
    }
    _drawBubbles(g, ox, oy, k) {
      const H = this.hero;
      const u0 = this.clipU || Math.max(2.6 * (this.dpr || 1) / 1.6, k * 1.25);
      const draw = (a, hx, hy, b, small) => {
        const u = small ? u0 * 0.78 : u0;
        const al = Math.min(1, b.t * 5, (b.dur - b.t) * 3);
        const font = Math.max(7, Math.round((b.text ? 7.2 : 11) * u));
        let lines = [];
        if (b.text) {
          const maxW = 112 * u;
          g.font = '600 ' + font + 'px sans-serif';
          String(b.text).split(/\\s+/).forEach((word) => {
            const last = lines.length - 1, test = last >= 0 ? lines[last] + ' ' + word : word;
            if (last < 0 || g.measureText(test).width > maxW) lines.push(word); else lines[last] = test;
          });
          if (lines.length > 4) { lines = lines.slice(0, 4); lines[3] = lines[3].replace(/[.,;:]?$/, '…'); }
        }
        const bw = b.text ? Math.min(120 * u, Math.max(48 * u, ...lines.map((line) => { g.font = '600 ' + font + 'px sans-serif'; return g.measureText(line).width + 14 * u; }))) : (b.icons.length > 1 ? 30 : 20) * u;
        const bh = b.text ? (lines.length * font * 1.25 + 10 * u) : 18 * u;
        const sx = Math.round(ox + (hx + 3) * k - bw / 2), sy = Math.round(oy + (hy - 4) * k - bh - 8 * u);
        g.globalAlpha = al;
        g.fillStyle = b.tone === 'bad' ? '#fbe9e4' : b.tone === 'good' ? '#f1f6e2' : '#faf6ec';
        g.strokeStyle = b.tone === 'bad' ? '#8b1e2b' : '#3c3230'; g.lineWidth = Math.max(1, k * 0.8);
        const r = 6 * u;
        g.beginPath(); g.moveTo(sx + r, sy); g.arcTo(sx + bw, sy, sx + bw, sy + bh, r); g.arcTo(sx + bw, sy + bh, sx, sy + bh, r); g.arcTo(sx, sy + bh, sx, sy, r); g.arcTo(sx, sy, sx + bw, sy, r); g.closePath(); g.fill(); g.stroke();
        [[3, 4, 2.4], [0, 8, 1.6]].forEach(([dx, dy, rr]) => { g.beginPath(); g.arc(sx + dx * u, sy + bh + dy * u, rr * u, 0, Math.PI * 2); g.fill(); g.stroke(); });
        g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (b.text) {
          g.font = '600 ' + font + 'px sans-serif';
          lines.forEach((line, i) => g.fillText(line, sx + bw / 2, sy + 5 * u + font * (i + 0.55) * 1.25, bw - 10 * u));
        } else {
          g.font = Math.round(11 * u) + 'px sans-serif';
          if (b.icons.length > 1) { g.fillText(b.icons[0], sx + bw * 0.32, sy + bh * 0.54); g.font = Math.round(8.5 * u) + 'px sans-serif'; g.fillText(b.icons[1], sx + bw * 0.74, sy + bh * 0.56); }
          else g.fillText(b.icons[0], sx + bw / 2, sy + bh * 0.54);
        }
        g.globalAlpha = 1;
      };
      const tick = (a) => { if (a.bub && (a.bub.t += 1 / 30) >= a.bub.dur) a.bub = null; return a.bub; };
      this.birds.forEach((b) => { if (tick(b)) draw(b, b.x, b.y - 8, b.bub, true); });
      this.npcs.forEach((a) => { if (a.sheets && tick(a)) { const p = this._pos(a); draw(a, p.x, p.top, a.bub, true); } });
      if (this.oracle && tick(this.oracle)) draw(this.oracle, this.oracle.x, this.oracle.y - 52, this.oracle.bub, true);
      if (tick(H)) { const p = this._pos(H); draw(H, p.x, p.top, H.bub); }
    }

    // ---------------------------------------------------------------- taps, drags and pinches
    _bind() {
      const c = this.canvas, P = new Map();
      let start = null, moved = false, pinch = null;
      const pt = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * (this.dpr || 1), y: (e.clientY - r.top) * (this.dpr || 1) }; };
      c.addEventListener('pointerdown', (e) => {
        P.set(e.pointerId, pt(e)); moved = false;
        if (P.size === 1) start = { p: pt(e), cam: { x: this.cam.x, y: this.cam.y }, t: performance.now() };
        if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: this._scale() }; }
        try { c.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
      });
      c.addEventListener('pointermove', (e) => {
        if (!P.has(e.pointerId)) return;
        P.set(e.pointerId, pt(e));
        if (P.size === 2 && pinch) {
          const [a, b] = [...P.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
          const raw = pinch.k * d / pinch.d, nk = Math.max(1, Math.min(5, Math.round(raw)));
          if (raw < 0.7 && this._fitK() < 1) this.fit = true;   // pinched right in: the whole estate
          else if (nk !== this._scale() || this.fit) { this.fit = false; this.k = nk; }
          moved = true; return;
        }
        if (!start) return;
        const p = pt(e), k = this._scale(), dx = p.x - start.p.x, dy = p.y - start.p.y;
        if (Math.hypot(dx, dy) > 10 * (this.dpr || 1)) moved = true;
        if (moved) { const [cx, cy] = this._clampCam(start.cam.x - dx / k, start.cam.y - dy / k, c.width, c.height, k); this.cam.x = cx; this.cam.y = cy; this.cam.manual = this.edit ? 1e9 : 8; this.focusK = null; }
      });
      const up = (e) => {
        const was = P.has(e.pointerId);
        P.delete(e.pointerId);
        if (P.size < 2) pinch = null;
        if (!was || P.size) return;
        if (!moved && start) this._tap(pt(e));
        start = null;
      };
      c.addEventListener('pointerup', up);
      // A finger tap is followed by a made-up mouse click at the same spot. By then a window may have opened under the finger,
      // and that click would land on its backdrop and shut it again. Cancelling touchend stops the click being made at all.
      c.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
      c.addEventListener('pointercancel', (e) => { P.delete(e.pointerId); start = null; pinch = null; });
      this._onResize = () => this._resize();
      window.addEventListener('resize', this._onResize);
    }
    _hitObj(wx, wy, o) {
      o = o || {};
      let best = null;
      const consider = (ob) => {
        if (o.any) { if (!ob.item) return; } else if (!ob.id || ob.ghost) return;
        const r = ob.s && this.spr[ob.s], w = ob.sw || (r ? r[2] : 16), h = ob.sh || (r ? r[3] : 16);
        const x0 = ob.ax - w / 2, y0 = ob.ay - h, slack = 3;
        if (wx >= x0 - slack && wx <= x0 + w + slack && wy >= y0 - slack && wy <= ob.ay + slack) {
          const score = ob.ay + (ob.flat ? -500 : 0) + (ob.wall ? -300 : 0) + (ob.front ? 0.5 : 0) + (ob.id === 'lawn' && !ob.item ? -1000 : 0);
          if (!best || score > best.score) best = { ob: ob, score: score };
        }
      };
      this.objs.forEach(consider);
      this.wallItems.forEach(consider);
      return best ? best.ob : null;
    }
    _tap(p) {
      const v = this.view;
      if (!v || !this.hero) return;
      const wx = (p.x - v.ox) / v.k, wy = (p.y - v.oy) / v.k;
      const cx = Math.floor(wx / T), cy = Math.floor(wy / T);
      if (this.edit) {
        const ob = this._hitObj(wx, wy, { any: true });
        const ri = this.geom.at(cx, cy), room = ri >= 0 ? this.geom.rooms[ri] : null;
        if (this.o.onBuildTap) this.o.onBuildTap({ x: cx, y: cy, item: ob ? ob.item : null, room: room ? room.id : null, kind: this.geom.kind(cx, cy) });
        return;
      }
      // a star is a button: tapping on one beats whoever happens to be standing or sitting in front of that prop
      let sbest = null, sd = 1e9;
      (this.starPts || []).forEach((q) => { const d = Math.hypot(wx - q.x, wy - q.y); if (d < 11 && d < sd) { sd = d; sbest = q; } });
      if (sbest) { this._emit(sbest.id); return; }
      // people and birds first
      const near = (x, y, w, h) => Math.abs(wx - x) < w && wy > y - h && wy < y + 4;
      const H = this.hero, hp = this._pos(H), hx = hp.x, hy = H.sleep ? hp.y + 10 : hp.y;
      for (const b of this.birds) if (near(b.x, b.y, 9, 16)) { if (b.id === 'ruby') { this._say(b, ['😈'], 2, 'bad'); this.fx.push({ x: b.x, y: b.y - 6, t: 0, life: 1, txt: '💥' }); } else this._say(b, ['🦜'], 2); b.flapT = 1; b.hop = 0.35; this._emit('npc:' + b.id); return; }
      for (const c of (this.critters || [])) if (near(c.x, c.y, 11, 15)) { this.fx.push({ x: c.x, y: c.y - 14, t: 0, life: 1.2, txt: c.kind === 'frog' ? '🎵' : '💕' }); c.tx = null; c.wait = 1.5; this._emit('pet:' + c.item); return; }
      for (const a of this.npcs) { const p = this._pos(a); if (a.sheets && near(p.x, a.sleep ? p.y + 10 : p.y, 12, a.sleep ? 22 : 48)) { this._say(a, [a.sleep ? '💤' : '👋'], 2); this._emit('npc:' + a.id); return; } }
      if (near(hx, hy, 13, H.sleep ? 22 : 50)) { this._emit('hero'); return; }
      const ob = this._hitObj(wx, wy);
      if (ob && ob.oraclePortal) { this._approach(ob.cell[0], ob.cell[1], () => this._emit('oracle'), 1); return; }
      if (ob) { this._emit(ob.id); return; }
      if (this.isLawn && cx >= 0 && cy >= 0 && cx < WT && cy < HT && this.isLawn[cy * WT + cx]) { this._emit('lawn'); return; }
      if (!this.lotOpen && cx >= 25 && cx <= 32) { this._emit('garden'); return; }
      if (cx >= 0 && cy >= 0 && cx < WT && cy < HT && this._ok(cx, cy)) this.walkTo(cx, cy);
    }
    _emit(id) { if (this.o.onTap) this.o.onTap(id); }

    // ---------------------------------------------------------------- the widget's clip
    // Somewhere nearby he can walk to from where he stands, a few cells away.
    _planRoam(maxCells) {
      const H = this.hero, [sx, sy] = this._cellOf(H.x, H.y), cands = [];
      Object.keys(this.spots).forEach((k) => {
        const s = this.spots[k];
        if (!this._spotOk(k, H) || !s.leisure || s.mow || s.dir === 'up' || (H.spot && H.spot.k === k)) return;
        const p = this._path(sx, sy, s.cell[0], s.cell[1]);
        if (p && p.length >= 3 && p.length <= maxCells) cands.push({ k: k, w: 1 + p.length / 4 });
      });
      return cands.length ? pickW(cands) : null;
    }
    // A short loop for the widget: he does something, then walks somewhere else and settles (the camera follows him).
    captureClip(o) {
      o = Object.assign({ w: 540, h: 240, k: 2, quality: 0.8, roam: true }, o || {});
      const H = this.hero;
      if (!H || !this.atlas) return Promise.resolve(null);
      if (H.path && H.path.length) this.pickActivity();
      this.capturing = true;
      const c = document.createElement('canvas'); c.width = o.w; c.height = o.h;
      const g = c.getContext('2d');
      const roam = o.roam && !H.sleep && !H.dozing ? this._planRoam(9) : null;
      const anim = H.anim, A = root.LPC.ANIM[anim] || root.LPC.ANIM.idle;
      const n = roam ? 30 : anim === 'idle' ? 12 : anim === 'sit' ? 12 : Math.max(12, Math.min(24, A.n + 6));
      const dt = roam || anim === 'idle' || anim === 'sit' ? 0.1 : 1 / 10;
      const frames = [];
      const mind = this._think();
      H.bub.dur = 999; H.bub.t = 1;
      const startSpot = H.spot ? H.spot.s.kind || H.spot.k : null;
      let walking = false;
      this.clipU = o.k * 1.4;
      const nb = this.npcs.map((a) => a.bub); this.npcs.forEach((a) => { a.bub = null; });
      for (let i = 0; i < n; i++) {
        if (roam && i === 8) { this._go(H, roam.k); walking = !!(H.path && H.path.length); H.ft = 0; }
        this.t += dt; H.ft += dt;
        if (walking) {
          this._walk(H, dt, 110);
          if (!H.path || !H.path.length) { walking = false; H.ft = 0; this._think(); if (H.bub) { H.bub.dur = 999; H.bub.t = 1; } }
        }
        if (H.spot && H.spot.s.mow) H.ft = i * dt;
        this._updateBirds(dt);
      this._updateCritters(dt);
        this.birds.forEach((b) => { b.bub = null; });
        const lean = { left: -26, right: 26 }[H.dir] || 0, hpos = this._pos(H), hx = hpos.x + lean, hy = hpos.y - (H.sleep ? 10 : 48);
        this.render(g, o.w, o.h, o.k, hx, hy, { noNight: true, noStars: true });
        frames.push(c.toDataURL('image/jpeg', o.quality).split(',')[1]);
      }
      H.bub = null;
      this.npcs.forEach((a, i) => { a.bub = nb[i]; });
      this.capturing = false;
      this.clipU = 0;
      return Promise.resolve({ frames: frames, interval: Math.round(dt * 1000), spot: startSpot, to: roam ? roam.k : null, thought: mind.i });
    }
  }
  const ASSETS = {};
  // The world atlas, loaded once and shared (the house, the portraits, the widget).
  House2D.assets = (base) => {
    base = base || '2d/';
    if (!ASSETS[base]) {
      const atlas = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('world.png')); i.src = base + 'world.png'; });
      ASSETS[base] = Promise.all([atlas, fetch(base + 'world.json').then((r) => r.json())]).then(([a, m]) => ({ atlas: a, spr: m }));
      ASSETS[base].catch(() => { delete ASSETS[base]; });
    }
    return ASSETS[base];
  };
  // A slice of the house behind a portrait: the estate's wall and floor at the portrait's scale.
  House2D.backdrop = (g, W, H, k, wallT, floorT, wallK, floorK) => House2D.assets().then(({ atlas, spr }) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0d0b09'; g.fillRect(0, 0, W, H);
    const fy = Math.round(H - 16 * k);
    const tile = (key, y0, y1) => {
      const r = spr[key];
      if (!r) return;
      const tw = r[2] * k, th = r[3] * k, x0 = Math.round(W / 2 - Math.ceil(W / 2 / tw + 1) * tw);
      for (let y = y0; y < y1; y += th) for (let x = x0; x < W; x += tw) g.drawImage(atlas, r[0], r[1], r[2], r[3], x, y, tw, th);
    };
    const fk = floorK || 'floor.' + floorT, wk = wallK || 'wall.' + wallT;
    tile(fk, fy, H);
    const wr = spr[wk];
    if (wr) tile(wk, fy - wr[3] * k, fy);
    g.fillStyle = 'rgba(20,14,24,0.3)'; g.fillRect(0, fy, W, Math.max(2, k * 2));
    g.fillStyle = '#2b2733'; g.fillRect(0, 0, W, Math.max(0, fy - (wr ? wr[3] * k : 0)));
    const v = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(10,9,8,0)'); v.addColorStop(1, 'rgba(10,9,8,0.8)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  });
  // A sprite from the atlas onto a little canvas, for the catalogue.
  // scheme: a finish's recolour, to show the piece in it
  House2D.thumb = (c, key, k, scheme) => House2D.assets().then(({ atlas, spr }) => {
    const r = spr[key];
    if (!r) return;
    k = k || Math.max(1, Math.min(3, Math.floor(Math.min(c.width / r[2], c.height / r[3]))));
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = false;
    const im = scheme && root.Recolor ? root.Recolor.tile(atlas, scheme, r[2], r[3], r[0], r[1]) : null;
    const dx = Math.round((c.width - r[2] * k) / 2), dy = Math.round(c.height - r[3] * k);
    if (im) g.drawImage(im, 0, 0, r[2], r[3], dx, dy, r[2] * k, r[3] * k);
    else g.drawImage(atlas, r[0], r[1], r[2], r[3], dx, dy, r[2] * k, r[3] * k);
  });
  root.House2D = House2D;
})(typeof window !== 'undefined' ? window : globalThis);
