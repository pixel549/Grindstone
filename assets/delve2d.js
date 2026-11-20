/* Grindstone — the delve, played out. A strip of dungeon rooms, one per stage of the run, in the dungeon's own colours.
 * The hero walks it with whoever came along, and each line of the run's log becomes a beat on screen: the fight it
 * describes (swings, hits, flasks, the companion's part), the chest, the fountain, the trap, the boss rising.
 * The run itself is decided in delve.js; this only shows it, so watching and skipping end in the same place.
 * Art: Universal LPC people and monsters (tools2d/bake_mobs.py), LPC Revised tiles, small beasts and props by hand. */
(function (root) {
  'use strict';
  const T = 32, FEET = 58, ROWS = 9, SPEED = 110, TRAVEL = 190;
  const COMP_LAG = 260;   // 2.21.1: how far behind him the companion walks on the old roads (ms)
  const EL_C = { fire: '#ff7a3a', frost: '#9fd8ff', storm: '#ffe066', rot: '#9bcf4f', holy: '#fff2a0' };
  // 2.7 dressing: more to look at in each room (all painted once onto the static layer, so it costs nothing per frame).
  const DRESS = {
    crypt: { props: ['bones', 'x.grave', 'x.candles', 'barrel', 'candelabra', 'x.armour', 'cobweb'], wall: ['x.banner', 'x.antlers'], mote: ['#cfc8a0', 0, 3, 0.22] },
    frost: { props: ['rock', 'crate', 'x.grave', 'bones', 'barrel'], wall: ['x.antlers', 'x.shield'], mote: ['#ffffff', 0, 22, 0.5] },
    fen: { props: ['rock', 'bones', 'barrel', 'x.cauldron', 'x.pumpkins', 'x.lilypot'], wall: ['x.fish', 'x.antlers'], mote: ['#9fe07a', 0, -6, 0.35] },
    forge: { props: ['barrel', 'crate', 'x.anvil', 'x.campfire', 'rock', 'x.barrow'], wall: ['x.shield', 'x.banner'], mote: ['#ff9a3a', 2, -26, 0.6] },
    vault: { props: ['barrel', 'crate', 'chest', 'x.trophy', 'bones', 'x.books'], wall: ['x.map', 'x.shield'], mote: ['#7fc8e8', 0, 30, 0.35] },
    spire: { props: ['x.scope', 'x.globe', 'x.books', 'x.chess', 'candelabra', 'crate'], wall: ['x.map', 'x.banner', 'x.shelf'], mote: ['#b9c8ff', 3, -4, 0.4] },
    sanctum: { props: ['x.armour', 'x.trophy', 'x.vase', 'x.candles', 'candelabra'], wall: ['x.banner', 'x.shield'], mote: ['#ffe08a', 0, -8, 0.5] },
    hold: { props: ['barrel', 'crate', 'chest', 'x.campfire', 'x.barrow', 'x.chess'], wall: ['x.map', 'x.shield', 'x.antlers'], mote: ['#ffb060', 1, -10, 0.3] },
    wood: { props: ['rock', 'x.cauldron', 'x.pumpkins', 'bones', 'x.scarecrow', 'x.lilypot'], wall: ['x.antlers', 'x.fish'], mote: ['#c8ff8a', 2, -6, 0.45] },
    ward: { props: ['barrel', 'bones', 'x.cauldron', 'x.books', 'crate', 'x.vase'], wall: ['x.shelf', 'x.map'], mote: ['#c8d890', 0, 4, 0.3] },
    warren: { props: ['bones', 'rock', 'x.campfire', 'barrel', 'x.barrow', 'crate'], wall: ['x.antlers', 'x.shield'], mote: ['#ff9a5a', 1, -14, 0.35] },
    keep: { props: ['x.armour', 'crate', 'barrel', 'candelabra', 'x.trophy', 'x.chess'], wall: ['x.banner', 'x.shield'], mote: ['#c8d8ff', 0, 10, 0.3] },
    manor: { props: ['candelabra', 'x.vase', 'x.books', 'x.chess', 'x.pumpkins', 'x.grave'], wall: ['x.map', 'x.shelf', 'x.banner'], mote: ['#d8c8ff', 0, -4, 0.35] },
  };
  const ROOM_TITLE = { fight: 'Guard room', trap: 'Trapped hall', fountain: 'Old fountain', secret: 'Something hidden', fork: 'The way splits', chest: 'Strongroom', boss: 'The lair', goblin: 'A goblin’s corner', toll: 'The toll gate', wanderer: 'A place to rest', shrine: 'Old shrine', rest: 'A quiet nook', lair: 'The den' };
  const THEME = {
    crypt: { floor: 'floor.0', wall: 'wall.stone', ft: ['#3d4a3c', 0.5], wt: ['#2c332b', 0.45], deco: ['bones', 'cobweb', 'candelabra', 'bones'], dark: 0.62 },
    frost: { floor: 'floor.2', wall: 'wall.stone', ft: ['#a9d0ee', 0.66], wt: ['#8db6d6', 0.45], deco: ['rock', 'cobweb', 'rock'], dark: 0.45 },
    fen: { floor: 'floor.dirt', wall: 'wall.timber', ft: ['#4d6b33', 0.5], wt: ['#33442a', 0.55], deco: ['rock', 'bones', 'barrel'], dark: 0.58, puddle: '#2e3d22' },
    forge: { floor: 'floor.rubber', wall: 'wall.brick', ft: ['#3a2420', 0.35], wt: ['#5a2418', 0.45], deco: ['barrel', 'crate', 'rock'], dark: 0.55, lava: true },
    vault: { floor: 'floor.3', wall: 'wall.stone', ft: ['#2f6670', 0.5], wt: ['#244c55', 0.5], deco: ['barrel', 'crate', 'bones'], dark: 0.6, puddle: '#1d4450' },
    spire: { floor: 'floor.4', wall: 'wall.stone', ft: ['#34406a', 0.62], wt: ['#4a5a8e', 0.5], deco: ['candelabra', 'crate', 'rock'], dark: 0.55 },
    sanctum: { floor: 'floor.4', wall: 'wall.5', ft: ['#e8cf8a', 0.25], wt: ['#c9a960', 0.25], deco: ['candelabra', 'candelabra'], dark: 0.4 },
    hold: { floor: 'floor.timber', wall: 'wall.timber', ft: ['#6a4a30', 0.45], wt: ['#4a3424', 0.5], deco: ['barrel', 'crate', 'barrel'], dark: 0.55 },
    wood: { floor: 'floor.dirt', wall: 'wall.timber', ft: ['#3f5a2c', 0.55], wt: ['#2c3a22', 0.6], deco: ['rock', 'bones', 'cobweb'], dark: 0.6, puddle: '#26361e' },
    ward: { floor: 'floor.1', wall: 'wall.0', ft: ['#b8b89a', 0.4], wt: ['#8a8a70', 0.45], deco: ['bones', 'barrel', 'cobweb'], dark: 0.5, puddle: '#4a4a30' },
    warren: { floor: 'floor.dirt', wall: 'wall.stone', ft: ['#5a4030', 0.5], wt: ['#3e2e22', 0.55], deco: ['bones', 'rock', 'barrel'], dark: 0.6 },
    keep: { floor: 'floor.0', wall: 'wall.stone', ft: ['#3a3e48', 0.55], wt: ['#22252c', 0.5], deco: ['candelabra', 'crate', 'cobweb'], dark: 0.6 },
    manor: { floor: 'floor.timber', wall: 'wall.4', ft: ['#4a2a3a', 0.5], wt: ['#3a2030', 0.5], deco: ['candelabra', 'cobweb', 'candelabra'], dark: 0.62 },
  };
  // How each foe looks: a baked sprite, and a tint for the theme.
  const MOBVIS = {
    'Grave Whelps': ['imp', '#8a9a80'], 'Bone Sentry': ['skel'], 'Ossuary Rats': ['rat'], 'Shroud Wisps': ['wisp'], 'Crypt Knight': ['skelknight'],
    'Rime Wolves': ['wolfman', '#d6ecff'], 'Frost Troll': ['troll', '#cfe8ff'], 'Icebound Husks': ['zombie', '#a8d8ff'], 'Snow Harpies': ['harpy', '#eaf6ff'],
    'Bog Leeches': ['leech'], 'Mire Hag': ['hag'], 'Fly Swarm': ['swarm', '#1e1e1e'], 'Reed Stalker': ['lizard'],
    'Ember Imps': ['imp', '#ff7a3a'], 'Slag Golem': ['troll', '#5a4a44'], 'Cinder Hounds': ['wolfman', '#c8502a'], 'Forge Acolytes': ['acolyte'],
    'Brine Crabs': ['crab'], 'Drowned Sailors': ['zsailor'], 'Gull Fiends': ['harpy', '#cfd6dc'], 'Kelp Witch': ['witch'],
    'Spark Kites': ['kite'], 'Copper Warden': ['knight', '#d08850'], 'Storm Adepts': ['adept'], 'Gargoyles': ['gargoyle', '#8a8a92'],
    'Mimic': ['crab', '#8a5a2a'], 'Toll Warden': ['knight', '#7a6a55'], 'Goblin': ['goblin'], 'Wanderer': ['acolyte', '#9a8a6a'],
    'Choir Wraiths': ['wisp', '#ffe9a0'], 'Gilded Templar': ['knight', '#ffd76a'], 'Censer Swarm': ['swarm', '#c8a050'], 'Penitents': ['zpenitent'],
    // 2.22: the new dungeons, and one more apiece for the first seven
    'Ghouls': ['thrall', '#9aa58a'], 'Ice Reavers': ['mercenary', '#bfe0ff'], 'Bog Ratmen': ['ratman', '#7a8a5a'], 'Forge Hands': ['thug', '#d07a4a'],
    'Wreckers': ['cutthroat', '#6a8aa0'], 'Tower Guards': ['manatarms', '#d08850'], 'Zealots': ['chaplain', '#ffe08a'],
    'Bandits': ['bandit'], 'Cutthroats': ['cutthroat'], 'Hired Thug': ['thug'], 'Sellsword': ['mercenary'], 'Poisoner': ['fence', '#5a7a4a'], 'Watch Dogs': ['wolfman', '#8a6a4a'],
    'Hexers': ['hexer'], 'Hare-folk': ['harefolk'], 'Wolf-wives': ['wolfwife'], 'Woodwose': ['woodwose'], 'Will-o’-Wisps': ['wisp', '#b8ff9a'],
    'Plague Doctors': ['plaguedoctor'], 'Ratmen': ['ratman'], 'Bloated Dead': ['bloat', '#a8b878'], 'Orderlies': ['orderly'], 'Plague Flies': ['swarm', '#3a4a2a'],
    'Goblins': ['goblin'], 'Orc Raiders': ['orc'], 'Orc Spearwives': ['orcshe'], 'Wartotaur': ['wartotaur'], 'Orc Shaman': ['orcshaman'],
    'Men-at-Arms': ['manatarms'], 'Black Knight': ['blackknight'], 'Squires': ['squire'], 'Chaplains': ['chaplain'], 'Executioner': ['executioner'],
    'Thralls': ['thrall'], 'Vampire Spawn': ['vampspawn'], 'The Creature': ['creature'], 'Jack-o’-Lanterns': ['jack'], 'Bat Swarm': ['swarm', '#2a1a2a'],
  };
  // tints chosen to stand out from their own floor (a pale troll on pale ice read as a ghost)
  const BOSSVIS = { crypt: ['zking'], frost: ['troll', '#6f9cc8'], fen: ['boar', '#5a3d2e'], forge: ['minotaur', '#ff9a6a'], vault: ['skelpirate'], spire: ['archon', '#3a5fb0'], sanctum: ['templarking', '#b8862a'] };
  // 2.20: every dungeon gets its own face from its seed: a floor and wall from the theme's pool, the tint turned a little round the
  // wheel, a different brightness, and its own handful of props. Same theme, never quite the same place.
  const LOOKPOOL = {
    crypt: { f: ['floor.0', 'floor.1', 'floor.dirt'], w: ['wall.stone', 'wall.0'] }, frost: { f: ['floor.2', 'floor.1', 'floor.0'], w: ['wall.stone', 'wall.0'] },
    fen: { f: ['floor.dirt', 'floor.timber', 'floor.2'], w: ['wall.timber', 'wall.stone'] }, forge: { f: ['floor.rubber', 'floor.0', 'floor.dirt'], w: ['wall.brick', 'wall.stone'] },
    vault: { f: ['floor.3', 'floor.0', 'floor.1'], w: ['wall.stone', 'wall.brick'] }, spire: { f: ['floor.4', 'floor.1', 'floor.3'], w: ['wall.stone', 'wall.0'] },
    sanctum: { f: ['floor.4', 'floor.1', 'floor.5'], w: ['wall.5', 'wall.stone', 'wall.4'] },
    hold: { f: ['floor.timber', 'floor.dirt', 'floor.0'], w: ['wall.timber', 'wall.brick'] }, wood: { f: ['floor.dirt', 'floor.2', 'floor.timber'], w: ['wall.timber', 'wall.stone'] },
    ward: { f: ['floor.1', 'floor.3', 'floor.0'], w: ['wall.0', 'wall.brick', 'wall.stone'] }, warren: { f: ['floor.dirt', 'floor.rubber', 'floor.0'], w: ['wall.stone', 'wall.timber'] },
    keep: { f: ['floor.0', 'floor.4', 'floor.1'], w: ['wall.stone', 'wall.brick', 'wall.0'] }, manor: { f: ['floor.timber', 'floor.5', 'floor.4'], w: ['wall.4', 'wall.5', 'wall.timber'] },
  };
  function lookOf(th, D) {
    const L = D && D.look; if (!L) return th;
    const P = LOOKPOOL[D.theme] || LOOKPOOL.crypt, R = window.Recolor, pick = (a, x) => a[Math.floor(x * a.length) % a.length];
    const turn = (L.c - 0.5) * 0.1, sat = 0.85 + L.d * 0.35;
    const tint = (t, v) => [R ? R.shift(t[0], turn, sat, v) : t[0], t[1]];
    const deco = th.deco.filter((_, i) => ((L.d * 977 + i * 31) % 1) < 0.75); if (!deco.length) deco.push(th.deco[0]);
    return Object.assign({}, th, { floor: pick(P.f, L.a), wall: pick(P.w, L.b), ft: tint(th.ft, 0.9 + L.b * 0.25), wt: tint(th.wt, 0.9 + L.a * 0.25), deco: deco, dark: Math.max(0.3, Math.min(0.7, th.dark + (L.c - 0.5) * 0.1)) });
  }
  const byTags = (t) => { t = t || []; const h = (k) => t.indexOf(k) >= 0; return h('swarm') && h('flier') ? ['swarm'] : h('undead') ? ['zombie'] : h('caster') ? ['adept'] : h('armoured') ? ['knight'] : h('flier') ? ['harpy'] : h('beast') ? ['wolfman'] : ['zombie']; };
  // How each kind of weapon swings, and what a companion carries.
  const ATK = { blade: 'slash', axe: 'slash', blunt: 'slash', fists: 'slash', polearm: 'thrust', staff: 'thrust' };
  const kindOf = (w) => (w ? (ATK[w.art] ? w.art : 'blade') : 'fists');
  const CGEAR = { fighter: { base: 'Longsword', art: 'blade', tier: 1 }, scout: { base: 'Harpoon', art: 'polearm', tier: 2 } };
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };

  class Crawl {
    constructor(el, o) {
      this.el = el;
      this.o = o;
      this.D = o.D;
      this.th = lookOf(THEME[o.D.theme] || THEME.crypt, o.D);
      this.alive = true;
      this.t = 0;
      this.beats = []; this.fx = []; this.nums = []; this.parts = []; this.spikes = []; this.foes = [];
      this.banner = null;
      // cosmetic randomness (sparks, idle timing) from the run's own seed, so the same run plays the same way
      this.rnd = rnd(((o.seed >>> 0) ^ (o.D.n * 2654435761)) >>> 0);
      this.trace = []; this.clock = 0; this.lt = 0;
      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'display:block;width:100%;height:100%';
      el.appendChild(this.canvas);
      this.g = this.canvas.getContext('2d');
      this.cam = 0; this.camY = 0; this.fork = {};
      this.hero = { x: 1.8 * T, y: 5.1 * T, dir: 'right', anim: 'idle', ft: 0, flash: 0, hp: null, hpMax: null };
      this.ready = this._load().then(() => { this._layout(); this._raf = requestAnimationFrame((t) => this._frame(t)); return this; });
    }
    dispose() { this.alive = false; cancelAnimationFrame(this._raf); if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas); }

    // ------------------------------------------------------------ loading
    _load() {
      const base = this.o.base || '2d/';
      if (root.Animated2D) root.Animated2D.init(base + 'animated/manifest.json');
      const img = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; });
      const mobs = Promise.all([img(base + 'delve.png'), fetch(base + 'delve.json').then((r) => r.json())]).then(([a, m]) => { this.mob = a; this.mobm = m; });
      const world = root.House2D.assets(base).then((a) => { this.atlas = a.atlas; this.spr = a.spr; });
      const hero = this._actor(this.o.look, this.o.eq, true, this.o.kind || kindOf(this.o.eq && this.o.eq.weapon)).then((a) => Object.assign(this.hero, a));
      return Promise.all([mobs, world, hero, this._buildComp()]);
    }
    // 2.21.1: a change of gear mid-fight on the old roads: the hero is redressed in place (same spot, same pose), and his
    // weapon's element colours his bolts. The sheets build in the background and swap in when they're ready.
    reGear(eq) {
      if (!this.hero || !root.LPC) return Promise.resolve();
      this.o.eq = Object.assign({}, eq); this.o.el = eq && eq.weapon ? eq.weapon.el : null;
      const ticket = (this._gearTicket = (this._gearTicket || 0) + 1);
      return this._actor(this.o.look, this.o.eq, true, kindOf(eq && eq.weapon)).then((a) => {
        if (ticket !== this._gearTicket || !this.hero) return;
        Object.assign(this.hero, a); this.hero.wpn = a.wpn || null;
        this._sparks(this.hero.x, this.hero.y - 30, '#d8c39a', 8, true);
      }).catch(() => null);
    }
    // LPC sheets for someone, and how they swing what they're holding: weapons that swing big bring frames of their own.
    _actor(look, gear, kit, kind) {
      const LPC = root.LPC, d = LPC.dress(look || {}, gear || {}, { kit: kit });
      return LPC.build(d.spec, d.body, ['walk', 'idle', 'slash', 'thrust', 'spellcast', 'hurt']).then((h) => {
        // rarer kit is a touch brighter and richer: the best piece worn sets how much
        const R = root.Recolor, top = gear ? Math.max.apply(null, [-1].concat(Object.keys(gear).map((k) => (gear[k] && gear[k].tier != null ? gear[k].tier : -1)))) : -1, bst = R && top >= 1 ? R.tierBoost(top) : null;
        if (bst) Object.keys(h.sheets).forEach((k) => { const c = h.sheets[k]; if (c && c.getContext) { const g = c.getContext('2d', { willReadFrequently: true }), id = g.getImageData(0, 0, c.width, c.height); R.recolorData(id.data, bst); g.putImageData(id, 0, 0); } });
        const a = { sheets: h.sheets, atk: ATK[kind] || 'slash', bolt: kind === 'staff', wpn: null };
        const L = LPC.state, sp = d.spec.find((x) => /^w_/.test(x.id) && x.id !== 'w_scythe'), it = sp && L.idx.items[sp.id];
        if (!it) return a;
        if (!it.custom) {
          if (!LPC.has(sp.id, d.body, a.atk)) a.atk = ['slash', 'thrust'].find((k) => LPC.has(sp.id, d.body, k)) || a.atk;
          return a;
        }
        const cs = Object.keys(it.custom).map((k) => it.custom[k]), c = cs.find((x) => x.anim === a.atk) || cs[0];
        a.atk = c.anim;
        const v = sp.v ? String(sp.v).replace(/ /g, '_') + '.png' : null;
        return Promise.all(c.layers.map((l) => new Promise((res) => {
          const f = l.files.indexOf(v) >= 0 ? v : l.files[0], i = new Image();
          i.onload = () => res({ z: l.z, im: i }); i.onerror = () => res(null); i.src = L.base + l.base + f;
        }))).then((ims) => { a.wpn = { anim: c.anim, size: c.size, layers: ims.filter(Boolean) }; return a; });
      });
    }
    _buildComp() {
      const c = this.o.comp;
      if (!c || c.sulk) return Promise.resolve();
      this.comp = { x: 0.7 * T, y: 5.1 * T - 22, dir: 'right', anim: 'idle', ft: 0, flash: 0, bird: c.bird ? c.id : null, role: c.role, el: c.el, name: c.name };
      if (c.bird) { this.comp.y = 5.1 * T - 44; return Promise.resolve(); }
      const w = CGEAR[c.role] || null, gear = Object.assign({}, c.gear || {}, { weapon: w });
      return this._actor(c.look, gear, !!w, w ? w.art : 'fists').then((a) => {
        Object.assign(this.comp, a);
        if (c.role === 'mage' || c.role === 'healer') this.comp.atk = 'spellcast';
      }).catch(() => { this.comp = null; });
    }
    // A monster's frames, tinted for the theme once and kept.
    _mobSprite(kind, tint) {
      const key = kind + '|' + (tint || '');
      this._mc = this._mc || {};
      if (this._mc[key]) return this._mc[key];
      const m = this.mobm[kind];
      if (!m) return null;
      if (!tint) return (this._mc[key] = { img: this.mob, m: m });
      // 2.22: an LPC strip is [x, y, frames, w, h, ox, oy, size], each frame cropped to what it uses
      const rects = m.lpc ? [m.idle, m.hurt, m.atk].map((b) => [b[0], b[1], b[3] * b[2], b[4]]) : m.frames.map((f) => f.slice());
      let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
      rects.forEach((r) => { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[0] + r[2]); y1 = Math.max(y1, r[1] + r[3]); });
      const c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0;
      const g = c.getContext('2d');
      rects.forEach((r) => g.drawImage(this.mob, r[0], r[1], r[2], r[3], r[0] - x0, r[1] - y0, r[2], r[3]));
      g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.5; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height);
      const mm = JSON.parse(JSON.stringify(m)), sh = (b) => { b[0] -= x0; b[1] -= y0; };
      if (m.lpc) [mm.idle, mm.hurt, mm.atk].forEach(sh); else mm.frames.forEach(sh);
      return (this._mc[key] = { img: c, m: mm });
    }

    // ------------------------------------------------------------ the floor plan
    // Rooms of every size on a map (delve.js decides where; this stands them up). Each room keeps its own floor line, so
    // everything staged in it (the fight, the chest, the fountain) is placed from the room, not from the dungeon.
    _layout() {
      const M = this.D.map;
      this.rooms = M.rooms.map((o) => {
        const r = Object.assign({}, o, { x1: o.x0 + o.w - 1 });
        r.fy = (o.y0 + 2.1 + o.d * 0.5) * T;   // where people stand
        r.px = (o.x0 + o.w * 0.55) * T;         // the middle of the action
        return r;
      });
      this.W = M.w * T; this.Hw = M.h * T;
      this.rooms.forEach((r) => {
        if ((r.kind === 'fight' || r.kind === 'lair') && r.e) this._spawnFoes(r, { n: r.e.name, tags: r.e.tags, c: r.e.count });
        else if (r.kind === 'toll') this._spawnFoes(r, { n: 'Toll Warden', tags: ['armoured'], c: 1 });
        else if (r.kind === 'goblin' || r.kind === 'wanderer') this._spawnFoes(r, { n: r.kind === 'goblin' ? 'Goblin' : 'Wanderer', tags: [], c: 1 }).forEach((f) => { f.npc = true; f.x = r.px + 0.6 * T; });
      });
      this.chests = this.rooms.filter((r) => r.kind === 'chest').map((r) => ({ room: r, x: r.px, y: r.fy - 8, open: false }));
      this._static();
      this.room = this.rooms[0];
      const H = this.hero, C = this.comp, r0 = this.room;
      H.x = (r0.x0 + 1.8) * T; H.y = r0.fy;
      if (C) { C.x = (r0.x0 + 0.7) * T; C.y = r0.fy - (C.bird ? 44 : 22); }
      this.cam = this._camFor(H.x, this._vw(), this.W, 0.5); this.camY = this._camFor(H.y, this._vh(), this.Hw, 0.55);
    }
    // keeps a point near the middle of the view, and the view inside the map (a map smaller than the view is centred)
    _camFor(p, view, total, at) { return total <= view ? (total - view) / 2 : clamp(p - view * at, 0, total - view); }
    // a standing place in a room: the floor line moved down or up, but kept on the floor
    _fy(r, dy) { return clamp(r.fy + (dy || 0), (r.y0 + 2.45) * T, (r.y0 + 1.75 + r.d) * T); }
    // The room a line of the log happens in. At a fork the lines that follow the choice are in the way he chose.
    _roomFor(L) {
      if (L.st == null) return null;
      const r0 = this._roomOf(L.st);
      if (r0 && r0.kind === 'fork') {
        const p = this.fork[L.st];
        if (p && L.k !== 'walk') return this.rooms.find((r) => r.id === r0.id + p) || r0;
      }
      return r0;
    }
    // the corridors from one room to another, as lists of points (pixels) in the order he walks them
    _route(from, to) {
      const L = this.D.map.links, prev = { [from.id]: null }, q = [from.id];
      while (q.length) {
        const id = q.shift();
        if (id === to.id) break;
        L.forEach((l) => {
          const nx = l.a === id ? l.b : l.b === id ? l.a : null;
          if (nx && !(nx in prev)) { prev[nx] = { id: id, l: l, back: l.b === id }; q.push(nx); }
        });
      }
      const legs = [];
      for (let at = prev[to.id]; at; at = prev[at.id]) {
        const pts = at.l.pts.map((p) => [p[0] * T, p[1] * T]);
        legs.unshift(at.back ? pts.reverse() : pts);
      }
      return legs;
    }
    // Walking to another room: out of one door, along the corridor, in at the next. Returns how long it takes, and
    // leaves everything the room's own beat does to start after that (this.defer).
    // withComp (the old roads): the companion walks the same route a step behind him, door by door, instead of being left behind
    _travel(to, withComp) {
      const H = this.hero, C = this.comp;
      const pts = [].concat.apply([], this._route(this.room, to));
      if (!pts.length) return 0;
      const last = pts[pts.length - 1], inward = [last[0] + Math.sign(to.px - last[0]) * 0.0, last[1]];
      pts.push(inward);
      let t = 0, px = H.x, py = H.y;
      pts.forEach((p, i) => {
        const dur = Math.hypot(p[0] - px, p[1] - py) / TRAVEL * 1000;
        const go = () => { H.tx = p[0]; H.ty = p[1]; H.speed = TRAVEL; };
        if (i === 0) go(); else this._at(t, go);
        if (withComp && C) this._at(t + COMP_LAG, () => { C.tx = p[0]; C.ty = p[1] - (C.bird ? 24 : 0); C.speed = TRAVEL; C.swoop = null; });
        t += dur; px = p[0]; py = p[1];
      });
      H.pl = { x: px, y: py };
      if (C) C.pl = { x: px - (C.bird ? 0.7 : 1.1) * T, y: py - (C.bird ? 44 : 22) };
      return Math.round(t) + 120;
    }
    _roomOf(st) { return this.rooms.find((r) => r.st === st) || null; }
    _spawnFoes(r, e, opt) {
      opt = opt || {};
      const vis = e.boss ? (this.D.boss && this.D.boss.vis) || BOSSVIS[this.D.theme] || ['zombie'] : MOBVIS[e.n] || byTags(e.tags);
      const kind = this.mobm[vis[0]] || vis[0] === 'swarm' ? vis[0] : 'zombie', tint = vis[1] || null, m = this.mobm[kind];
      const count = e.boss ? 1 : Math.min(e.c || 1, kind === 'swarm' ? 3 : m && m.px ? 6 : 4);
      const out = [], bx = r.x0 + r.w * 0.7;
      for (let i = 0; i < count; i++) {
        const col = Math.floor(i / 2), row = i % 2, two = count > 1;
        const x = e.boss ? bx : opt.add ? bx - 1.8 - col * 0.9 : r.x0 + r.w * 0.6 + col * 1.1;
        const y = this._fy(r, opt.add ? (row ? 30 : -30) : two ? (row ? 16 : -14) : 0);
        const f = { kind: kind, tint: tint, room: r, boss: !!e.boss, add: !!opt.add, name: e.n, x: x * T, y: y, alive: true, anim: 'idle', ft: this.rnd() * 3, flash: 0, hit: 0, scale: e.boss ? 2 : 1, die: 0, alpha: opt.rise ? 0 : 1, rising: opt.rise ? 0.001 : 0 };
        out.push(f); this.foes.push(f);
      }
      return out;
    }
    _tinted(key, tint) {
      this._tc = this._tc || {};
      const k = key + tint[0] + tint[1];
      if (this._tc[k]) return this._tc[k];
      const r = this.spr[key];
      if (!r) return null;
      const c = document.createElement('canvas'); c.width = r[2]; c.height = r[3];
      const g = c.getContext('2d');
      g.drawImage(this.atlas, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
      g.globalCompositeOperation = 'source-atop'; g.globalAlpha = tint[1]; g.fillStyle = tint[0]; g.fillRect(0, 0, r[2], r[3]);
      return (this._tc[k] = c);
    }
    _static() {
      const th = this.th, M = this.D.map, c = this.stat || (this.stat = document.createElement('canvas'));
      c.width = this.W; c.height = this.Hw;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#070608'; g.fillRect(0, 0, c.width, c.height);
      const fl = this._tinted(th.floor, th.ft), wl = this._tinted(th.wall, th.wt);
      const R = rnd(this.D.n * 31 + 7);
      const tile = (img, tx, ty) => { if (img) g.drawImage(img, 0, 0, 32, 32, tx * T, ty * T, 32, 32); };
      // each corridor as the rectangles it covers, in tiles (two wide, bending where the points do)
      const strips = [];
      M.links.forEach((l) => {
        for (let i = 0; i + 1 < l.pts.length; i++) {
          const a = l.pts[i], b = l.pts[i + 1];
          if (a[1] === b[1]) strips.push([Math.min(a[0], b[0]), a[1] - 1, Math.max(a[0], b[0]), a[1] + 1]);
          else strips.push([a[0] - 1, Math.min(a[1], b[1]) - 1, a[0] + 1, Math.max(a[1], b[1]) + 1]);
        }
      });
      // walls round the corridors, then the rooms over the top, then the corridor floors over both (that's the doorway)
      g.fillStyle = '#1c181f';
      strips.forEach((q) => g.fillRect((q[0] - 1) * T, (q[1] - 1) * T, (q[2] - q[0] + 2) * T, (q[3] - q[1] + 2) * T));
      this.torches = [];
      this.puddles = [];
      this.rooms.forEach((r) => {
        const x0 = r.x0, y0 = r.y0, w = r.w, d = r.d;
        g.fillStyle = '#1c181f'; g.fillRect((x0 - 1) * T, (y0 + 2) * T, (w + 2) * T, (d + 1) * T);
        for (let x = x0 - 1; x <= x0 + w; x++) if (wl) g.drawImage(wl, 0, 0, 32, 64, x * T, y0 * T, 32, 64);
        for (let y = y0 + 2; y < y0 + 2 + d; y++) for (let x = x0; x < x0 + w; x++) tile(fl, x, y);
        g.fillStyle = 'rgba(10,8,12,0.35)'; g.fillRect(x0 * T, (y0 + 2) * T, w * T, 6);
        g.fillStyle = '#2b2733'; g.fillRect((x0 - 1) * T, (y0 + 2 + d) * T, (w + 2) * T, 3);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect((x0 + w) * T - 6, (y0 + 2) * T, 6, d * T); g.fillRect(x0 * T, (y0 + 2) * T, 6, d * T);
      });
      strips.forEach((q) => { for (let y = q[1]; y < q[3]; y++) for (let x = q[0]; x < q[2]; x++) tile(fl, x, y); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(q[0] * T, q[1] * T, (q[2] - q[0]) * T, (q[3] - q[1]) * T); });
      // props: the dungeon's own first, then the house atlas
      const deco = (k, x, y) => {
        const p = this.mobm[k], r = this.spr[k];
        if (p && p.frames) { const f = p.frames[0]; g.drawImage(this.mob, f[0], f[1], f[2], f[3], Math.round(x - f[2] / 2), Math.round(y - f[3]), f[2], f[3]); }
        else if (r) g.drawImage(this.atlas, r[0], r[1], r[2], r[3], Math.round(x - r[2] / 2), Math.round(y - r[3]), r[2], r[3]);
      };
      this.rooms.forEach((r, i) => {
        const x0 = r.x0 * T, x1 = (r.x1 + 1) * T, top = r.y0 * T;
        for (let x = x0 + 1.5 * T; x < x1 - T; x += 4 * T) { const tr = this.spr.torch; if (tr) this.torches.push([x + tr[2] / 2, top + 34, Math.round(x), top + 26]); }
        const fx = () => x0 + (1 + R() * (r.w - 2)) * T, fyy = () => top + (3 + R() * (r.d - 1)) * T;
        if (th.puddle) for (let k = 0; k < 2; k++) {
          const px = fx(), py = fyy(), rx = 14 + R() * 18, ry = 5 + R() * 4;
          this.puddles.push({ x: px, y: py, rx: rx, ry: ry, phase: R() * 1.5 });
          g.fillStyle = th.puddle; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        }
        if (th.lava) for (let k = 0; k < 2; k++) { const lx = fx(), ly = fyy(); g.strokeStyle = '#ff6a20'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 10, ly + 4); g.lineTo(lx + 18, ly + 2); g.lineTo(lx + 26, ly + 8); g.stroke(); }
        if (i && r.kind !== 'boss' && R() < 0.8) deco(th.deco[Math.floor(R() * th.deco.length)], x0 + (R() < 0.5 ? 1.0 : r.w - 1.4) * T, top + (R() < 0.5 ? 3.1 : r.d + 1.6) * T);
        if (r.kind === 'enter') deco('stairs', x0 + 1.2 * T, top + 4.2 * T);
        if (r.kind === 'fountain') deco('fountain', r.px, top + 3.9 * T);
        if (r.kind === 'trap') deco('plate', r.px, r.fy + 14);
        if (r.kind === 'secret') { const p = this.mobm.crack.frames[0]; g.drawImage(this.mob, p[0], p[1], p[2], p[3], Math.round(r.px), top + 22, p[2], p[3]); }
        if (r.kind === 'fork') { g.fillStyle = 'rgba(215,180,90,0.14)'; g.beginPath(); g.arc(r.px, r.fy, 1.6 * T, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(215,180,90,0.5)'; g.lineWidth = 2; g.stroke(); }
        if (r.kind === 'boss') deco('altar', x0 + (r.w - 1.8) * T, top + 3.4 * T);
        if (r.kind === 'shrine') { deco('altar', r.px, top + 3.5 * T); deco('candelabra', r.px - 1.7 * T, top + 3.3 * T); deco('candelabra', r.px + 1.7 * T, top + 3.3 * T); }
        if (r.kind === 'rest') deco('x.campfire', r.px, top + 3.9 * T);
        if (r.kind === 'goblin') { deco('x.barrow', r.px + 1.9 * T, top + 3.9 * T); deco('crate', r.px - 1.8 * T, top + 3.3 * T); deco('barrel', r.px - 2.6 * T, top + 3.3 * T); }
        if (r.kind === 'toll') { deco('barrel', x0 + 1.1 * T, top + 3.3 * T); deco('barrel', x1 - 1.4 * T, top + 3.3 * T); }
        if (r.kind === 'wanderer') { deco('x.campfire', r.px - 1.6 * T, top + 3.9 * T); deco('bones', r.px + 2 * T, top + 3.5 * T); }
        if (r.kind === 'lair') { deco('bones', x0 + 1.2 * T, top + 3.6 * T); deco('bones', x1 - 1.6 * T, top + 4.2 * T); }
      });
      // more dressing: floor wear, things along the back wall and in the near corners, something hung between the torches
      const DR = DRESS[this.D.theme] || DRESS.crypt, R2 = rnd(this.D.n * 57 + 3);
      this.rooms.forEach((r, i) => {
        const x0 = r.x0 * T, top = r.y0 * T, fw = r.w * T, fh = r.d * T, fy0 = top + 2 * T;
        for (let n = Math.round(r.w * r.d / 3); n > 0; n--) { // cracks and scuffs
          const cx = x0 + 4 + R2() * (fw - 12), cy = fy0 + 8 + R2() * (fh - 12), len = 3 + Math.floor(R2() * 6);
          g.fillStyle = R2() < 0.7 ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.07)';
          for (let q = 0, px = cx, py = cy; q < len; q++) { g.fillRect(Math.round(px), Math.round(py), 1, 1); px += R2() < 0.6 ? 1 : 0; py += R2() < 0.5 ? 1 : R2() < 0.3 ? -1 : 0; }
        }
        if (r.kind === 'boss') { g.fillStyle = 'rgba(160,40,40,0.18)'; g.fillRect(x0 + fw * 0.2, fy0 + fh * 0.3, fw * 0.6, fh * 0.5); g.strokeStyle = 'rgba(220,170,80,0.3)'; g.lineWidth = 1; g.strokeRect(x0 + fw * 0.2 + 2.5, fy0 + fh * 0.3 + 2.5, fw * 0.6 - 5, fh * 0.5 - 5); }
        // back-wall and corner slots, away from where the fighting happens
        const slots = [];
        for (let sx = 0.7; sx < r.w - 0.5; sx += 1.3) if (Math.abs(x0 + sx * T - r.px) > 1.1 * T) slots.push([x0 + sx * T, top + 3.05 * T]);
        let want = i === 0 ? 1 : Math.max(1, Math.min(5, Math.round(r.w * r.d / 9)));
        while (want-- > 0 && slots.length) { const sl = slots.splice(Math.floor(R2() * slots.length), 1)[0]; deco(DR.props[Math.floor(R2() * DR.props.length)], sl[0], sl[1]); }
        // on the wall, between torches
        if (r.w >= 4) for (let wx = x0 + 3.5 * T; wx < x0 + fw - T; wx += 4 * T) if (r.kind === 'boss' || R2() < 0.55) deco(DR.wall[Math.floor(R2() * DR.wall.length)], wx, top + 50);
      });
    }

    // ------------------------------------------------------------ beats
    // Every beat is scheduled on a logical clock (ms since the run began), and everything shown that carries a number
    // goes in this.trace, so the tests can check it against the run: same seed, same trace.
    _at(ms, f) { this.beats.push({ at: this.t + (ms + (this.defer || 0)) / 1000, f: f }); }
    _tr(ms, o) { o.at = Math.round(this.lt + ms + (this.defer || 0)); this.trace.push(o); }
    _walkTo(a, x, y, speed) {
      const sp = speed || SPEED;
      if (this.defer && a.pl) { // he is still on his way into the room: this starts when he gets there
        const ty = y == null ? a.pl.y : y, d = Math.hypot(x - a.pl.x, ty - a.pl.y) / sp * 1000;
        this._at(0, () => { a.tx = x; a.ty = ty; a.speed = sp; });
        a.pl = { x: x, y: ty };
        return d;
      }
      a.tx = x; a.ty = y == null ? a.y : y; a.speed = sp;
      return Math.hypot(x - a.x, a.ty - a.y) / sp * 1000;
    }
    _anim(a, k, dur) { a.anim = k; a.ft = 0; a.until = dur ? this.t + dur / 1000 : 0; }
    _num(x, y, txt, col, big) { if (txt !== '' && txt != null) this.nums.push({ x: x, y: y, txt: String(txt), col: col || '#fff', t: 0, big: !!big }); }
    _say(a, txt, dur) { if (a) a.bub = { txt: txt, until: this.t + (dur || 1600) / 1000 }; }
    _sparks(x, y, col, n, up) { const r = this.rnd; for (let i = 0; i < (n || 10); i++) this.parts.push({ x: x, y: y, vx: (r() - 0.5) * 70, vy: (up ? -50 : -30) - r() * 40, t: 0, life: 0.5 + r() * 0.5, col: col }); }
    // The hero's HP as shown over his head, set at the moment the run says it changed.
    // 2.22: onHp (set by the run screen) hears every change as it lands, so the bars up top drop blow by blow with the one over his head
    _hp(ms, v, max) { v = Math.max(0, v); this._tr(ms, { k: 'hp', v: v }); this._at(ms, () => { this.hero.hp = v; if (max) this.hero.hpMax = max; if (this.onHp) this.onHp(v, this.hero.hpMax); }); }
    // Plays a beat: one line of the log, or a few that belong together (a boss's tricks and how the fight ended).
    // Returns how long it takes (0 while still loading). Each line is shown in the log when its beat has finished.
    play(lines) {
      if (!this.rooms) return 0;
      if (!Array.isArray(lines)) lines = [lines];
      let ms = 0;
      lines.forEach((L) => { if (!L.join) ms += this._play(L); });
      return ms;
    }
    _play(L) {
      const H = this.hero, C = this.comp;
      if (C) C.hold = false;
      this.lt = this.clock;
      let ms;
      // a quiet patch-up between stages: show it as the beat starts
      if (L.pre) {
        const p = L.pre;
        this._at(0, () => { if (C && !C.bird) this._anim(C, 'spellcast', 600); this._sparks(H.x, H.y - 30, '#8cff9a', 8, true); this._num(H.x - 22, H.y - 40, '+' + p.h, '#8cff9a'); });
        this._tr(0, { k: 'num', who: 'heal', v: p.h });
        this._hp(0, p.hp);
      }
      if (L.k === 'enter') { H.hp = L.hp; H.hpMax = L.hpMax; this._tr(0, { k: 'hp', v: L.hp }); ms = Math.max(1400, this._walkTo(H, (this.room.x0 + this.room.w * 0.45) * T, this.room.fy) + 300); }
      else {
        if (L.path) this.fork[L.st] = L.path;
        let lead = 0;
        const r0 = this._roomFor(L);
        if (r0 && r0 !== this.room) { lead = this._travel(r0); this.room = r0; const tt = ROOM_TITLE[r0.kind]; if (tt) this._at(Math.max(0, lead - 500), () => { this.card = { txt: tt, t: 0 }; }); }
        this.defer = lead;
        const fx = L.fx;
        if (fx && fx.foe && fx.ev && fx.ev.length && (L.k === 'fight' || L.k === 'death' || L.k === 'win' || L.k === 'fork')) ms = this._fight(L);
        else if (L.k === 'walk') ms = this._walk(L);
        else if (L.k === 'fork') ms = this._wayEnd(L);
        else if (L.k === 'arrive') ms = this._arrive(L);
        else if (L.k === 'tele') ms = this._tele(L);
        else if (L.k === 'goblin' || L.k === 'toll' || L.k === 'wanderer' || L.k === 'shrine') ms = this._event(L);
        else if (L.k === 'chest') ms = this._chest(L);
        else if (L.k === 'fountain') ms = this._fountain(L);
        else if (L.k === 'trap') ms = this._trap(L);
        else if (L.k === 'secret') ms = this._secret(L);
        else if (L.k === 'boss') ms = this._boss(L);
        else if (L.k === 'death') { this._hp(0, L.hp); this._at(0, () => this._die()); ms = 2200; }
        else ms = 1200;
        ms += lead; this.defer = 0; H.pl = null; if (C) C.pl = null;
      }
      ms = Math.round(ms);
      // where the beat leaves him: the line's HP (the tests check nothing had to be corrected here)
      this._tr(ms, { k: 'end', shown: this._shownAt(ms), line: L.hp, lk: L.k });
      this._at(ms, () => { H.hp = L.hp; H.hpMax = L.hpMax; if (this.onHp) this.onHp(L.hp, L.hpMax); });
      this.clock += ms;
      return ms;
    }
    // The HP the trace says is on screen at a moment of this beat.
    _shownAt(ms) { let v = null; const t = this.lt + ms; this.trace.forEach((o) => { if (o.k === 'hp' && o.at <= t) v = o.v; }); return v; }
    _walk(L) {
      const H = this.hero, C = this.comp, r = this.room;
      const t = this._walkTo(H, (r.x0 + Math.min(2.4, r.w * 0.28)) * T, r.fy);
      if (/patches (him|her) up/.test(L.s) && C) {
        const h = Number((L.s.match(/\+(\d+)/) || [0, 0])[1]);
        this._at(t, () => { this._anim(C, C.atk || 'spellcast', 700); this._sparks(H.x, H.y - 30, '#8cff9a', 12, true); this._num(H.x - 22, H.y - 40, '+' + h, '#8cff9a'); });
        this._tr(t, { k: 'num', who: 'heal', v: h });
        this._hp(t, L.hp);
        return t + 1200;
      }
      if (/hauls (him|her) back up/.test(L.s)) { this._revive(0); this._hp(650, L.hp); return 1700; }
      if (/glints/.test(L.s)) this._at(t * 0.6, () => { this._sparks(r.px, (r.y0 + 1.25) * T, '#fff6c0', 8); this._say(H, '…', 800); });
      return Math.max(900, t + 300);
    }
    // Everything still to come, at once (Skip): the same beats, run straight through.
    // Run every scheduled beat now, in order.
    settle() {
      for (let guard = 0; this.beats.length && guard < 5000; guard++) {
        this.beats.sort((a, b) => a.at - b.at);
        const b = this.beats.shift();
        if (b.at > this.t) this.t = b.at;
        b.f();
      }
    }
    fastForward(lines) {
      if (!this.rooms) return;
      const flush = () => this.settle();
      flush();
      const groups = [];
      (lines || []).forEach((L) => { const g = groups[groups.length - 1]; if (g && g[g.length - 1].join) g.push(L); else groups.push([L]); });
      groups.forEach((g) => { this.play(g); flush(); });
      this.nums = []; this.parts = []; this.fx = [];
      [this.hero, this.comp].forEach((a) => { if (a && a.tx != null) { a.x = a.tx; a.y = a.ty; a.tx = null; } if (a) a.swoop = null; });
      this.foes.forEach((f) => { f.rising = 0; f.alpha = f.alive ? 1 : 0; });
      this.cam = this._camFor(this.hero.x, this._vw(), this.W, 0.5); this.camY = this._camFor(this.hero.y - 20, this._vh(), this.Hw, 0.55);
      this.defer = 0;
    }
    // A fight, blow by blow, exactly as the run had it (fx.ev). Sprites stand for the foes in the log; a crowd of
    // eight rats is drawn as a few, each sprite carrying the HP of the ones it stands for.
    _fight(L) {
      const H = this.hero, C = this.comp, fx = L.fx, r = this.room, boss = !!fx.foe.boss, won = L.k !== 'death';
      let foes = this.foes.filter((f) => f.room === r && f.alive && (boss ? f.boss : !f.boss && !f.add));
      if (!foes.length) foes = this._spawnFoes(r, fx.foe, {});
      const hp = {}, max = {}, spr = {};
      const bind = (list, sprites) => {
        list.forEach((f, i) => { hp[f.id] = f.hp; max[f.id] = f.hp; spr[f.id] = sprites[i % sprites.length]; });
        sprites.forEach((s) => { s.ids = list.filter((f) => spr[f.id] === s).map((f) => f.id); s.max = s.ids.reduce((t, id) => t + max[id], 0); s.cur = s.max; });
      };
      bind(fx.foes || [], foes);
      const B = boss ? foes[0] : null;
      if (B) { this.bossHp = 1; this._tr(0, { k: 'boss', v: B.max, of: B.max }); }
      const front = Math.min.apply(null, foes.map((f) => f.x));
      const stand = (x) => this._walkTo(H, x, r.fy);
      const sx = B ? B.x - 2.4 * T : front - 1.5 * T, t0 = stand(sx) + 150;
      if (C) { C.hold = true; if (C.bird) this._walkTo(C, sx - 0.7 * T, r.fy - 46); else if (C.role === 'mage' || C.role === 'healer') this._walkTo(C, sx - 1.3 * T, r.fy - 22); else this._walkTo(C, sx - 0.95 * T, this._fy(r, 24)); }
      const ev = fx.ev, rounds = Math.max(1, ev.filter((e) => e.t === 'r').length);
      // long fights play faster, so a boss fight stays watchable; every blow is still shown
      const step = clamp(Math.round((boss ? 9000 : 4800) / rounds), boss ? 300 : 280, boss ? 820 : 760);
      const OFF = { h: 0.42, drink: 0.4, c: 0.52, bleed: 0.58, enrage: 0.62, adds: 0.62, in: 0.8, rev: 0.94 };
      let rt = t0 - step, swung = -1;
      const where = (id) => spr[id] || foes[0];
      ev.forEach((e) => {
        if (e.t === 'r') { rt += step; return; }
        const at = Math.round(rt + OFF[e.t] * step);
        if (e.t === 'h') {
          const s = where(e.to);
          if (swung !== rt) {
            swung = rt;
            this._at(rt + step * 0.05, () => {
              H.dir = 'right'; this._anim(H, H.atk || 'slash', Math.min(540, step * 0.9));
              if (H.bolt) this.fx.push({ kind: 'bolt', x: H.x + 18, y: H.y - 36, tx: s.x, ty: s.y - 28 * s.scale, t: -0.06, life: 0.3, col: EL_C[this.o.el] || '#bfa6ff' });
            });
          }
          this._blow(at, s, e, '#ffffff', 'h', hp);
          if (e.art) this._at(at, () => this._num(H.x + 18, H.y - 92, 'ART', '#bfa6ff', true));
        } else if (e.t === 'c' || e.t === 'bleed') {
          const s = where(e.to);
          if (e.t === 'c') this._at(at - step * 0.2, () => this._compSwing(s));
          this._blow(at, s, e, e.t === 'bleed' ? '#ff8080' : C && C.role === 'mage' ? EL_C[C.el] || '#c9b2ff' : '#ffd27a', 'c', hp);
        } else if (e.t === 'drink') {
          this._at(at, () => { this.fx.push({ kind: 'flask', x: H.x + 8, y: H.y - 44, t: 0, life: 0.9 }); this._sparks(H.x, H.y - 30, '#ff8aa0', 8, true); this._num(H.x - 22, H.y - 40, '+' + e.h, '#8cff9a'); });
          this._tr(at, { k: 'num', who: 'heal', v: e.h });
          this._hp(at, e.hp);
        } else if (e.t === 'enrage') {
          this._at(at, () => { if (B) { B.rage = true; this._anim(B, 'atk', 400); this._sparks(B.x, B.y - 60, '#ff3a2a', 20, true); this._num(B.x, B.y - 140, 'ENRAGED', '#ff5a3a', true); } });
        } else if (e.t === 'adds') {
          const ads = this._spawnFoes(r, { n: e.n, tags: e.tags, c: e.ids.length }, { add: true, rise: true });
          ads.forEach((a) => { a.alpha = 0; a.hidden = true; });
          bind(e.ids.map((id) => ({ id: id, hp: e.hp })), ads);
          this._at(at, () => ads.forEach((a) => { a.hidden = false; a.rising = 0.001; this._sparks(a.x, a.y - 20, '#c9c2b8', 8, true); }));
        } else if (e.t === 'in') {
          const by = e.by.map(where).filter((s, i, a) => a.indexOf(s) === i);
          this._at(at - step * 0.25, () => by.slice(0, 2).forEach((s) => { if (s.alive) this._anim(s, 'atk', Math.min(460, step)); }));
          if (e.br && B) this._at(at - step * 0.2, () => this.fx.push({ kind: 'breath', x: B.x - 30, y: B.y - 70, tx: H.x, ty: H.y - 30, t: 0, life: Math.min(0.8, step / 1000 * 1.4), col: EL_C[this.D.el] || '#ffffff' }));
          if (e.ps) this._at(at, () => { for (let i = 0; i < 5; i++) this.parts.push({ x: H.x + (this.rnd() - 0.5) * 40, y: H.y - this.rnd() * 30, vx: 0, vy: -10, t: 0, life: 1, col: '#7fbf3a', big: true }); });
          this._at(at, () => { if (e.d > 0) { H.flash = 0.2; if (H.hpMax && e.d >= H.hpMax * 0.12) this.shake = 0.18; this._num(H.x + 22, H.y - 40, '-' + e.d, '#ff6a6a'); } else this._num(H.x + 22, H.y - 40, 'blocked', '#9fb3c8'); });
          this._tr(at, { k: 'num', who: 'in', v: e.d });
          this._hp(at, e.hp);
        } else if (e.t === 'rev') {
          this._revive(at);
          this._hp(at + 650, e.hp);
        }
      });
      const end = rt + step + 200;
      if (!won) { this._at(end, () => this._die()); return end + 2400; }
      this._at(end, () => { foes.forEach((f) => { if (f.alive) this._kill(f); }); if (B) { this.bossHp = 0; this._victory(); } this._anim(H, 'idle'); C && (C.hold = false); });
      return end + (boss ? 2600 : 700);
    }
    // 2.20: everything still on its way arrives now (every pending beat runs, and he and his companion stand where they were going).
    // The old roads call this before each move, so a quick hand can never start a walk from the middle of the last one.
    land() {
      if (!this.rooms) return;
      this.settle();
      [this.hero, this.comp].forEach((a) => { if (a) { if (a.swoop) { a.x = a.swoop.x0; a.y = a.swoop.y0; } if (a.tx != null) { a.x = a.tx; a.y = a.ty; a.tx = null; } a.swoop = null; a.pl = null; } });
      // 2.21.1: in a fight the companion stands where it was put, whatever happened on the way
      const C = this.comp; if (C && C.home && this.dz && Math.hypot(C.x - C.home.x, C.y - C.home.y) > 1.5 * T) { C.x = C.home.x; C.y = C.home.y; }
      this.defer = 0; this.nums = []; this.parts = []; this.fx = [];
      this.foes.forEach((f) => { f.rising = 0; if (f.alive) f.alpha = 1; });
      this.cam = this._camFor(this.hero.x, this._vw(), this.W, 0.5); this.camY = this._camFor(this.hero.y - 20, this._vh(), this.Hw, 0.55);
    }
    // ---- 2.19 the old roads by hand: the same scene, driven a round at a time ----
    // Walk to the room of stage `st` and face what's there. list: [{ id, hp }] one per foe. Returns ms until he's set.
    duelEnter(st, foe, list) {
      if (!this.rooms) return 0;
      this.land();
      const H = this.hero, C = this.comp; this.lt = this.clock; if (C) C.hold = false;
      let lead = 0; const r0 = this._roomOf(st);
      if (r0 && r0 !== this.room) { if (C) C.hold = true; lead = this._travel(r0, true); this.room = r0; const tt = ROOM_TITLE[r0.kind]; if (tt) this._at(Math.max(0, lead - 500), () => { this.card = { txt: tt, t: 0 }; }); }
      this.defer = lead;
      const r = this.room, boss = !!foe.boss;
      let foes = this.foes.filter((f) => f.room === r && f.alive && (boss ? f.boss : !f.boss && !f.add));
      if (!foes.length) foes = this._spawnFoes(r, foe, {});
      const hp = {}, spr = {};
      list.forEach((f, i) => { hp[f.id] = f.hp; spr[f.id] = foes[i % foes.length]; });
      foes.forEach((s) => { s.ids = list.filter((f) => spr[f.id] === s).map((f) => f.id); s.max = s.ids.reduce((t, id) => t + hp[id], 0); s.cur = s.max; });
      const B = boss ? foes[0] : null; if (B) this.bossHp = 1;
      this.dz = { hp: hp, spr: spr, foes: foes, r: r, B: B };
      const front = Math.min.apply(null, foes.map((f) => f.x)), sx = B ? B.x - 2.4 * T : front - 1.5 * T;
      const t0 = this._walkTo(H, sx, r.fy) + 150;
      if (C) {
        C.hold = true;
        const hx = C.bird ? sx - 0.7 * T : C.role === 'mage' || C.role === 'healer' ? sx - 1.3 * T : sx - 0.95 * T, hy = C.bird ? r.fy - 46 : C.role === 'mage' || C.role === 'healer' ? r.fy - 22 : this._fy(r, 24);
        C.home = { x: hx, y: hy };
        if (lead) { this.defer = lead + COMP_LAG; this._walkTo(C, hx, hy); this.defer = lead; }
        else this._walkTo(C, hx, hy);
      }
      this._at(t0, () => { H.dir = 'right'; });
      const ms = Math.round(lead + t0); this.defer = 0; H.pl = null; if (C) C.pl = null; this.clock += ms;
      return ms;
    }
    // One round of blows. ev: [{ t: 'h'|'c', to, d, art } | { t: 'drink', h } | { t: 'guard' } | { t: 'enrage' } | { t: 'adds', n, tags, ids, hp } | { t: 'in', by, d, big, br, guard }]
    duelRound(ev, hpAfter) {
      const z = this.dz; if (!z || !this.rooms) return 0;
      this.land();
      const H = this.hero, C = this.comp, B = z.B; this.lt = this.clock;
      const where = (id) => z.spr[id] || z.foes[0];
      let at = 0;
      (ev || []).forEach((e) => {
        if (e.t === 'h') {
          const s = where(e.to), t0 = at;
          this._at(t0, () => { H.dir = 'right'; this._anim(H, H.atk || 'slash', 420); if (H.bolt) this.fx.push({ kind: 'bolt', x: H.x + 18, y: H.y - 36, tx: s.x, ty: s.y - 28 * s.scale, t: -0.06, life: 0.3, col: EL_C[this.o.el] || '#bfa6ff' }); });
          this._blow(t0 + 220, s, e, '#ffffff', 'h', z.hp);
          if (e.art) this._at(t0 + 220, () => this._num(H.x + 18, H.y - 92, 'ART', '#bfa6ff', true));
          at += 300;
        } else if (e.t === 'c') { const s = where(e.to); this._at(at, () => this._compSwing(s)); this._blow(at + 200, s, e, C && C.role === 'mage' ? EL_C[C.el] || '#c9b2ff' : '#ffd27a', 'c', z.hp); at += 300; }
        else if (e.t === 'drink') { this._at(at, () => { this.fx.push({ kind: 'flask', x: H.x + 8, y: H.y - 44, t: 0, life: 0.9 }); this._sparks(H.x, H.y - 30, '#ff8aa0', 8, true); this._num(H.x - 22, H.y - 40, '+' + e.h, '#8cff9a'); }); at += 450; }
        else if (e.t === 'guard') { this._at(at, () => this._num(H.x, H.y - 70, 'GUARD', '#9fb3c8', true)); at += 250; }
        else if (e.t === 'enrage') { this._at(at, () => { if (B) { B.rage = true; this._anim(B, 'atk', 400); this._sparks(B.x, B.y - 60, '#ff3a2a', 20, true); this._num(B.x, B.y - 140, 'ENRAGED', '#ff5a3a', true); } }); at += 350; }
        else if (e.t === 'adds') {
          const ads = this._spawnFoes(z.r, { n: e.n, tags: e.tags, c: e.ids.length }, { add: true, rise: true });
          ads.forEach((a) => { a.alpha = 0; a.hidden = true; });
          e.ids.forEach((id, i) => { z.hp[id] = e.hp; z.spr[id] = ads[i % ads.length]; });
          ads.forEach((s) => { s.ids = e.ids.filter((id) => z.spr[id] === s); s.max = s.ids.length * e.hp; s.cur = s.max; });
          const t0 = at; this._at(t0, () => ads.forEach((a) => { a.hidden = false; a.rising = 0.001; this._sparks(a.x, a.y - 20, '#c9c2b8', 8, true); })); at += 400;
        // 2.21: the old roads' extra beats: labels (STAGGERED, BLEEDING, HEXED…), bleeding ticks, a foe mended, the flare, a swap
        } else if (e.t === 'tag') {
          const s = e.who === 'hero' ? null : where(e.to);
          this._at(at, () => { if (s) { if (s.alive) this._num(s.x, s.y - (s.boss ? 150 : 72) * (s.scale || 1), e.s, e.c || '#fff', true); } else this._num(H.x, H.y - 96, e.s, e.c || '#fff', true); }); at += 220;
        } else if (e.t === 'dot') { const s = where(e.to); this._blow(at, s, e, '#d8432a', 'h', z.hp); at += 200; }
        else if (e.t === 'fheal') {
          const s = where(e.to), t0 = at;
          this._at(t0, () => { z.hp[e.to] = (z.hp[e.to] || 0) + e.h; if (s.ids) s.cur = s.ids.reduce((t, id) => t + Math.max(0, z.hp[id]), 0); if (s.alive) { this._num(s.x, s.y - 56 * (s.scale || 1), '+' + e.h, '#9fd36a', false); this._sparks(s.x, s.y - 30, '#9fd36a', 8, true); } }); at += 260;
        } else if (e.t === 'flare') { this._at(at, () => { this.flashC = { t: 0.4, col: '#fff3b0' }; this._sparks(H.x + 10, H.y - 50, '#fff3b0', 18, true); this._num(H.x, H.y - 96, 'FLARE', '#fff3b0', true); }); at += 320; }
        else if (e.t === 'swap') { this._at(at, () => { this._num(H.x, H.y - 96, 'SWAP', '#d8c39a', true); this._sparks(H.x, H.y - 30, '#d8c39a', 6, true); }); at += 300; }
        else if (e.t === 'wind') { const s = where(e.by); this._at(at, () => { if (s.alive) this._num(s.x, s.y - (s.boss ? 130 : 60), e.br ? '...' : '!', '#e0a94a', true); }); at += 200; }
        else if (e.t === 'in') {
          const by = (e.by || []).map(where).filter((s, i, a) => a.indexOf(s) === i), t0 = at;
          this._at(t0, () => by.slice(0, 3).forEach((s) => { if (s.alive) this._anim(s, 'atk', 380); }));
          if (e.br && B) this._at(t0, () => this.fx.push({ kind: 'breath', x: B.x - 30, y: B.y - 70, tx: H.x, ty: H.y - 30, t: 0, life: 0.5, col: EL_C[this.D.el] || '#ffffff' }));
          this._at(t0 + 260, () => { if (e.d > 0) { H.flash = 0.2; if (e.big && !e.guard) this.shake = 0.22; this._num(H.x + 22, H.y - 40, '-' + e.d, e.big && !e.guard ? '#ff3a2a' : '#ff6a6a', e.big && !e.guard); } else this._num(H.x + 22, H.y - 40, 'dodged', '#9fb3c8'); });
          at += 420;
        }
      });
      this._hp(Math.max(0, at - 150), hpAfter);
      this.clock += at;
      return at;
    }
    duelEnd(res, last) {
      const z = this.dz, H = this.hero, C = this.comp; if (!z) return;
      if (res === 'dead') { this._at(200, () => this._die()); return; }
      this._at(150, () => { z.foes.forEach((f) => { if (f.alive) this._kill(f); }); this.foes.forEach((f) => { if (f.room === z.r && f.alive) this._kill(f); }); if (z.B && last) { this.bossHp = 0; this._victory(); } this._anim(H, 'idle'); if (C) C.hold = false; });
    }
    // One blow landing: the number, the flash, the HP it takes off, and the fall when that's the last of them.
    _blow(at, s, e, col, who, hp) {
      hp[e.to] -= e.d;
      const left = s.ids.reduce((t, id) => t + Math.max(0, hp[id]), 0), dead = left <= 0;
      this._tr(at, { k: 'num', who: who, v: e.d, to: e.to });
      if (s.boss) this._tr(at, { k: 'boss', v: left, of: s.max });
      this._at(at, () => {
        s.cur = left; s.flash = 0.18; s.hit = 0.22; s.hitFx = { t: 0 };
        if (who === 'h') this.fx.push({ kind: 'slashfx', x: s.x - 4, y: s.y - 26 * s.scale, t: 0, life: 0.22 });
        this._num(s.x + (who === 'c' ? 12 : -4), s.y - (s.boss ? 118 : 50) - (who === 'c' ? 8 : 0), e.d, col, s.boss);
        if (s.boss) this.bossHp = left / s.max;
        if (dead) { this.shake = s.boss ? 0.5 : 0.16; this._kill(s); } else if (s.boss && e.d >= s.max * 0.12) this.shake = 0.14;
      });
    }
    _compSwing(tg) {
      const C = this.comp;
      if (!C || !tg) return;
      C.dir = 'right';
      if (C.bird) { const h = C.home && Math.hypot(C.x - C.home.x, C.y - C.home.y) > 1.5 * T ? C.home : null; if (h) { C.x = h.x; C.y = h.y; C.tx = null; } C.swoop = { x0: C.x, y0: C.y, x1: tg.x - 6, y1: tg.y - 28 * tg.scale, t: 0 }; return; }
      if (C.role === 'mage') {
        this._anim(C, 'spellcast', 520);
        this.fx.push({ kind: 'bolt', x: C.x + 12, y: C.y - 36, tx: tg.x, ty: tg.y - 28 * tg.scale, t: 0, life: 0.25, col: EL_C[C.el] || '#bfa6ff' });
        return;
      }
      this._anim(C, C.atk || 'slash', 480);
    }
    _kill(f) {
      if (!f || !f.alive) return;
      f.alive = false;
      const m = this.mobm[f.kind];
      if (f.kind === 'swarm') { this._sparks(f.x, f.y - 20, f.tint || '#333', 18); f.die = 1.6; return; }
      f.die = 0.001;
      if (m && m.lpc) { f.anim = 'hurt'; f.ft = 0; } else this._sparks(f.x, f.y - 10, '#c9c2b8', 6);
    }
    _die() { const H = this.hero; this._anim(H, 'hurt'); H.dead = true; this.banner = { txt: 'YOU DIED', col: '#b0261f', t: 0 }; }
    _revive(at) {
      const H = this.hero, C = this.comp;
      this._at(at, () => { this._anim(H, 'hurt', 650); });
      this._at(at + 650, () => { if (C && !C.bird) this._anim(C, 'spellcast', 640); this._sparks(H.x, H.y - 20, '#8cff9a', 18, true); this._num(H.x, H.y - 78, 'Back up!', '#8cff9a', true); this._anim(H, 'idle'); });
    }
    _victory() { this.banner = { txt: 'PREY SLAUGHTERED', col: '#d7b45a', t: 0 }; this._sparks(this.hero.x, this.hero.y - 40, '#ffd75a', 24, true); }
    _chest(L) {
      const H = this.hero, ch = this.chests.find((c) => c.room === this.room), it = L.item;
      const t = this._walkTo(H, ch ? ch.x - 1.1 * T : H.x, this.room.fy) + 150;
      if (L.leave) { this._at(t, () => { H.dir = 'right'; this._say(H, '🙅', 900); }); return t + 1000; }
      if (L.mimic) { this._at(t, () => { if (ch) { ch.open = true; this._sparks(ch.x, ch.y - 16, '#ff5a3a', 14, true); } this._say(H, '❗', 1000); this.shake = 0.2; }); return t + 1100; }
      if (L.trick) {
        if (L.trick === 'safe') this._at(t, () => this._say(H, '❗', 900));
        else { this._at(t, () => { H.flash = 0.25; this._anim(H, 'hurt', 380); this._num(H.x + 22, H.y - 40, '-' + L.hurt, '#ff6a6a'); }); this._tr(t, { k: 'num', who: 'in', v: L.hurt }); }
        this._hp(t, L.hp);
        return t + 1000;
      }
      this._at(t, () => { if (ch) { ch.open = true; this._sparks(ch.x, ch.y - 16, '#ffd75a', 10, true); } });
      if (ch && it) this._at(t + 250, () => this.fx.push({ kind: 'item', x: ch.x, y: ch.y - 22, t: 0, life: 1.6, col: ['#bbbbbb', '#7fd36b', '#6aa8ff', '#b07aff', '#ffb43a'][it.tier] || '#fff', i: { weapon: '⚔️', head: '⛑️', body: '🛡️', charm: '📿', offhand: '🛡️' }[it.slot] || '✦' }));
      if (it && /put it on/.test(L.s)) this._hp(t + 900, L.hp, L.hpMax);
      if (it && /put it on/.test(L.s)) this._at(t + 900, () => {
        H.flash = 0.4; this._sparks(H.x, H.y - 30, '#ffd75a', 16, true);
        const eq = Object.assign({}, this.o.eq); eq[it.slot] = it; this.o.eq = eq;
        this._actor(this.o.look, eq, true, kindOf(eq.weapon)).then((a) => Object.assign(H, a)).catch(() => {});
      });
      return t + 1700;
    }
    // 2.20: he walks into a room before he is asked anything about it
    _arrive(L) {
      const H = this.hero, r = this.room, k = r.kind;
      let t;
      if (k === 'chest') { const ch = this.chests.find((c) => c.room === r); t = this._walkTo(H, ch ? ch.x - 1.1 * T : r.px, r.fy) + 150; this._at(t, () => { H.dir = 'right'; this._say(H, '🤔', 900); }); return t + 600; }
      if (k === 'fork') { t = this._walkTo(H, r.px, this._fy(r, 30)) + 100; this._at(t, () => this._say(H, '➡️', 900)); return t + 700; }
      if (k === 'fountain') { t = this._walkTo(H, r.px, this._fy(r, 0)) + 150; this._at(t, () => { H.dir = 'up'; this._say(H, '🤔', 900); }); return t + 600; }
      t = this._walkTo(H, r.px - 1.7 * T, r.fy) + 150;
      this._at(t, () => { H.dir = 'right'; this._say(H, k === 'goblin' ? '👺' : k === 'toll' ? '✋' : k === 'wanderer' ? '🩸' : '🕯️', 1000); });
      return t + 700;
    }
    // goblin, toll, wanderer, shrine: what happened, shown where it happened
    _event(L) {
      const H = this.hero, r = this.room;
      const t = this._walkTo(H, r.px - 1.5 * T, r.fy) + 100;
      this._at(t, () => { H.dir = 'right'; });
      this._outcome(L, t + 150, r.px, r.fy);
      return t + 1500;
    }
    // the same, at the end of one of the ways at a fork (the fight, if there was one, was played already)
    _wayEnd(L) {
      const H = this.hero, r = this.room;
      const t = this._walkTo(H, r.px - 0.6 * T, this._fy(r, L.heal || L.prize ? 0 : 30)) + 100;
      if (!L.heal && !L.prize && !L.ft) { this._at(t, () => this._say(H, '➡️', 900)); this._hp(t, L.hp); return t + 1000; }
      this._outcome(L, t + 100, r.px, r.fy);
      return t + 1400;
    }
    _outcome(L, t, x, y) {
      const H = this.hero, col = L.ft === 'good' ? '#8cff9a' : L.ft === 'bad' ? '#c58aff' : '#c9c2b8';
      if (L.heal) { this._at(t, () => { this._sparks(H.x, H.y - 30, '#8cff9a', 12, true); this._num(H.x - 22, H.y - 40, '+' + L.heal, '#8cff9a'); }); this._tr(t, { k: 'num', who: 'heal', v: L.heal }); }
      if (L.hurt) { this._at(t, () => { this._sparks(H.x, H.y - 30, '#b06aff', 14); H.flash = 0.25; this._anim(H, 'hurt', 380); this._num(H.x + 22, H.y - 40, '-' + L.hurt, '#c58aff'); }); this._tr(t, { k: 'num', who: 'in', v: L.hurt }); }
      if (L.prize || L.item || L.traded) this._at(t + 200, () => this.fx.push({ kind: L.prize === 'flask' ? 'flaskpop' : L.prize === 'gold' ? 'goldpop' : 'item', x: x, y: y - 26, t: 0, life: 1.4, col: '#ffd75a', i: L.prize === 'lore' ? '📜' : '✦' }));
      if (!L.heal && !L.hurt) this._at(t, () => { this._sparks(x, y - 24, col, 10, true); if (L.paid) this._num(H.x, H.y - 60, '-' + L.paid + 'g', '#ffd27a'); });
      this._at(t + 150, () => this._say(H, L.ft === 'bad' ? '😖' : L.ft === 'good' ? '😊' : '🤔', 1000));
      this._hp(t + 100, L.hp);
    }
    // thrown back to the start: everything that fell has risen again
    _tele(L) {
      const H = this.hero, C = this.comp, r0 = this.rooms[0];
      this.room = r0;   // the walk that follows starts from the entrance
      this._at(0, () => { this.flashC = { t: 0, col: '#b9a6ff' }; this._sparks(H.x, H.y - 30, '#b9a6ff', 26, true); this._say(H, '🌀', 1000); });
      this._at(600, () => {
        H.x = (r0.x0 + 1.8) * T; H.y = r0.fy; H.tx = null; H.pl = null;
        if (C) { C.x = (r0.x0 + 0.7) * T; C.y = r0.fy - (C.bird ? 44 : 22); C.tx = null; C.swoop = null; }
        this.cam = this._camFor(H.x, this._vw(), this.W, 0.5); this.camY = this._camFor(H.y, this._vh(), this.Hw, 0.55);
        this._sparks(H.x, H.y - 30, '#b9a6ff', 26, true);
        this.foes.forEach((f) => { if (!f.boss && !f.add && !f.npc && !f.alive) { f.alive = true; f.die = 0; f.alpha = 1; f.anim = 'idle'; f.ft = this.rnd() * 3; } });
      });
      this._hp(700, L.hp);
      return 1500;
    }
    _fountain(L) {
      const H = this.hero, r = this.room, fx0 = r.px, fy = (r.y0 + 3.5) * T;
      const t = this._walkTo(H, fx0, this._fy(r, 0)) + 150;
      this._at(t, () => { H.dir = 'up'; });
      if (L.ft === 'good') { const h = Number((L.s.match(/restores (\d+)/) || [0, 0])[1]); this._at(t + 300, () => { this._sparks(fx0, fy, '#8cff9a', 14, true); this._num(H.x - 22, H.y - 40, '+' + h, '#8cff9a'); }); this._tr(t + 300, { k: 'num', who: 'heal', v: h }); this._hp(t + 300, L.hp); }
      else if (L.ft === 'bad') { const d = Number((L.s.match(/loses (\d+)/) || [0, 0])[1]); this._at(t + 300, () => { this._sparks(fx0, fy, '#b06aff', 16); H.flash = 0.25; this._num(H.x + 22, H.y - 40, '-' + d, '#c58aff'); this._say(H, '🤢', 1200); }); this._tr(t + 300, { k: 'num', who: 'in', v: d }); this._hp(t + 300, L.hp); }
      else if (L.ft === 'spotted') this._at(t + 200, () => this._say(H, '❗', 1200));
      else this._at(t + 200, () => this._say(H, '🤔', 900));
      this._at(t + 1300, () => { H.dir = 'right'; });
      return t + 1600;
    }
    _trap(L) {
      const H = this.hero, r = this.room, px = r.px;
      const t = this._walkTo(H, px - 1.6 * T, r.fy) + 100;
      if (L.trap === 'safe') {
        const who = this.comp && / screeched at | spotted .*, so /.test(L.s) && L.s.indexOf(', so ') > 0 ? this.comp : H;
        this._at(t, () => this._say(who, '❗', 1000));
        this._at(t + 400, () => this._walkTo(H, px, this._fy(r, 34)));
        this._at(t + 1000, () => this._walkTo(H, px + 1.8 * T, r.fy));
        return t + 1800;
      }
      this._at(t, () => this._walkTo(H, px, this._fy(r, 8)));
      const d = Number((L.s.match(/losing (\d+)/) || [0, 0])[1]);
      this._at(t + 600, () => { this.spikes.push({ x: px, y: this._fy(r, 22), t: 0 }); H.flash = 0.25; this._anim(H, 'hurt', 380); this._num(H.x + 22, H.y - 40, '-' + d, '#ff6a6a'); });
      this._tr(t + 600, { k: 'num', who: 'in', v: d });
      this._hp(t + 600, L.hp);
      this._at(t + 1100, () => { this._anim(H, 'idle'); this._walkTo(H, px + 1.6 * T, r.fy); });
      return t + 1800;
    }
    _secret(L) {
      const H = this.hero, r = this.room, x = r.px + 0.3 * T;
      const t = this._walkTo(H, x, this._fy(r, -1.6 * T)) + 150;
      this._at(t, () => { H.dir = 'up'; this._sparks(x, (r.y0 + 1.4) * T, '#fff6c0', 10); });
      this._at(t + 400, () => { const k = L.prize; this.fx.push({ kind: k === 'flask' ? 'flaskpop' : k === 'gold' ? 'goldpop' : 'item', x: x, y: (r.y0 + 2.2) * T, t: 0, life: 1.4, col: '#ffd75a', i: k === 'lore' ? '📜' : '✦' }); });
      this._at(t + 1300, () => { H.dir = 'right'; this._walkTo(H, x + T, r.fy); });
      return t + 1800;
    }
    _boss(L) {
      const H = this.hero, r = this.room, B = this.foes.find((f) => f.boss && f.room === r && f.alive);
      if (L.fx && L.fx.rise) {
        const t = this._walkTo(H, (r.x0 + r.w * 0.3) * T, r.fy) + 200;
        this._at(t, () => {
          const b = this._spawnFoes(r, L.fx.foe, { rise: true })[0];
          this.bossName = L.fx.foe.n; this.bossHp = 1;
          this._sparks(b.x, b.y - 40, EL_C[this.D.el] || '#ffffff', 28, true);
        });
        return t + 2200;
      }
      return L.mech ? 0 : 900; // a boss's tricks play inside the fight itself (the lines are joined to it)
    }

    // ------------------------------------------------------------ the loop
    _vw() { return this.canvas.width / (this.k || 1); }
    _vh() { return this.canvas.height / (this.k || 1); }
    _frame(now) {
      if (!this.alive) return;
      this._raf = requestAnimationFrame((t) => this._frame(t));
      const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
      this.last = now;
      if (document.hidden) return;
      const p0 = performance.now();
      this._resize();
      this._update(dt);
      this._render();
      // for profiling: how long each frame took to draw, and the gap between frames (type Crawl.stats() in DevTools)
      const st = Crawl._st || (Crawl._st = { work: [], gap: [] });
      st.work.push(performance.now() - p0); st.gap.push(dt * 1000);
      if (st.work.length > 600) { st.work.shift(); st.gap.shift(); }
    }
    _resize() {
      const r = this.el.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      this.dpr = dpr;
      this.k = Math.max(1, Math.min(3, Math.round(h / (ROWS * T))));
    }
    _update(dt) {
      this.t += dt;
      const due = this.beats.filter((b) => b.at <= this.t).sort((a, b) => a.at - b.at);
      this.beats = this.beats.filter((b) => b.at > this.t);
      due.forEach((b) => b.f());
      const H = this.hero, C = this.comp;
      const move = (a) => {
        if (a.tx == null) return false;
        const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), sp = (a.speed || SPEED) * dt;
        if (d <= sp) { a.x = a.tx; a.y = a.ty; a.tx = null; return false; }
        a.x += dx / d * sp; a.y += dy / d * sp;
        a.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        return true;
      };
      // the companion keeps up (unless it's busy biting something)
      if (C && !C.swoop && !C.hold && H.tx != null) { C.tx = H.tx - (C.bird ? 0.7 : 1.1) * T; C.ty = H.ty - (C.bird ? 44 : 22); C.speed = (H.speed || SPEED) * 1.05; }
      [H, C].forEach((a) => {
        if (!a) return;
        a.ft += dt;
        if (a.flash > 0) a.flash -= dt;
        if (a === H) { if (this.shake > 0) this.shake -= dt; if (this.card) this.card.t += dt; }
        if (move(a)) { if (a.anim !== 'walk') { a.anim = 'walk'; a.until = 0; } }
        else if (a.anim === 'walk') { a.anim = 'idle'; if (a === C || !H.tx) a.dir = 'right'; }
        if (a.until && this.t >= a.until && !a.dead) { a.anim = 'idle'; a.until = 0; }
        if (a.bub && this.t > a.bub.until) a.bub = null;
      });
      if (C && C.swoop) { const s = C.swoop; s.t += dt / 0.5; const u = Math.min(1, s.t), k = u < 0.5 ? u * 2 : 2 - u * 2; C.x = lerp(s.x0, s.x1, k); C.y = lerp(s.y0, s.y1, k) - Math.sin(u * Math.PI) * 10; if (u >= 1) { C.swoop = null; C.x = s.x0; C.y = s.y0; } }
      this.foes.forEach((f) => {
        f.ft += dt;
        if (f.flash > 0) f.flash -= dt;
        if (f.hit > 0) f.hit -= dt;
        if (f.hitFx) { f.hitFx.t += dt; if (f.hitFx.t >= 0.64) f.hitFx = null; }
        if (f.rising) { f.rising += dt / 1.1; f.alpha = Math.min(1, f.rising); if (f.rising >= 1) { f.rising = 0; f.alpha = 1; } }
        if (f.die) { f.die += dt; if (f.die > 1.6) f.alpha = Math.max(0, 1 - (f.die - 1.6) / 0.6); }
        if (f.until && this.t >= f.until && f.alive) { f.anim = 'idle'; f.until = 0; }
      });
      this.nums.forEach((n) => { n.t += dt; });
      this.nums = this.nums.filter((n) => n.t < 1.1);
      this.parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.big) p.vy += 60 * dt; });
      this.parts = this.parts.filter((p) => p.t < p.life);
      this.fx.forEach((f) => { f.t += dt; });
      this.fx = this.fx.filter((f) => f.t < f.life);
      this.spikes.forEach((s) => { s.t += dt; });
      this.spikes = this.spikes.filter((s) => s.t < 1.2);
      if (this.banner) this.banner.t += dt;
      if (this.flashC) { this.flashC.t += dt; if (this.flashC.t > 1.1) this.flashC = null; }
      const wx = this._camFor(H.x, this._vw(), this.W, 0.5), wy = this._camFor(H.y - 20, this._vh(), this.Hw, 0.55), kk = Math.min(1, dt * 3.5);
      this.cam += (wx - this.cam) * kk; this.camY += (wy - this.camY) * kk;
    }
    _drawLPC(g, a) {
      const A = root.LPC.ANIM[a.anim] || root.LPC.ANIM.idle, sheet = a.sheets[a.anim] || a.sheets.idle, anim = a.sheets[a.anim] ? a.anim : 'idle';
      const row = A.rows === 1 ? 0 : { up: 0, left: 1, down: 2, right: 3 }[a.dir] || 3, ft = a.ft;
      const f = anim === 'walk' ? 1 + Math.floor(ft * 11) % 8 : anim === 'idle' ? Math.floor(ft * 1.6) % 2 : Math.min(A.n - 1, Math.floor(ft * (anim === 'hurt' ? 9 : 12)));
      const dx = Math.round(a.x - 32), dy = Math.round(a.y - FEET), w = a.wpn && a.wpn.anim === anim ? a.wpn : null;
      const over = (front) => { if (!w) return; const S = w.size, off = (S - 64) / 2; w.layers.forEach((l) => { if ((l.z >= 10) === front) g.drawImage(l.im, f * S, row * S, S, S, dx - off, dy - off, S, S); }); };
      over(false);
      g.drawImage(sheet, f * 64, row * 64, 64, 64, dx, dy, 64, 64);
      over(true);
      if (a.flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(0.8, a.flash * 4); g.drawImage(sheet, f * 64, row * 64, 64, 64, dx, dy, 64, 64); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
    }
    _drawFoe(g, f) {
      if (f.alpha <= 0 || f.hidden) return;
      g.globalAlpha = f.alpha;
      if (f.kind === 'swarm') {
        g.fillStyle = f.tint || '#222';
        if (f.alive) for (let i = 0; i < 13; i++) { const a = f.ft * 3 + i * 2.4, r = 5 + (i % 5) * 2.4; g.fillRect(Math.round(f.x + Math.cos(a * (1 + (i % 3) * 0.3)) * r), Math.round(f.y - 26 + Math.sin(a * 1.3) * r * 0.7), 1, 1); }
        g.globalAlpha = 1; return;
      }
      const S = this._mobSprite(f.kind, f.tint);
      if (!S) { g.globalAlpha = 1; return; }
      const m = S.m, sc = f.scale, rise = f.rising ? (1 - f.rising) * 20 * sc : 0, glow = f.flash > 0 ? Math.min(0.9, f.flash * 5) : f.rage && Math.sin(this.t * 10) > 0 ? 0.3 : 0;
      g.fillStyle = 'rgba(10,8,12,0.35)'; g.beginPath(); g.ellipse(f.x, f.y, 10 * sc, 3 * sc, 0, 0, Math.PI * 2); g.fill();
      let sx, sy, sw, sh, dx, dy, dw, dh;
      if (m.lpc) {
        let box = m.idle, fr = Math.floor(f.ft * 1.6) % 2;
        if (f.anim === 'atk') { box = m.atk; fr = Math.min(m.atk[2] - 1, Math.floor(f.ft * 12)); }
        else if (f.anim === 'hurt') { box = m.hurt; fr = Math.min(box[2] - 1, Math.floor(f.ft * 9)); }
        const off = (box[7] - 64) / 2;
        sx = box[0] + fr * box[3]; sy = box[1]; sw = box[3]; sh = box[4]; dw = sw * sc; dh = sh * sc;
        dx = Math.round(f.x + (box[5] - 32 - off) * sc + (f.hit > 0 ? 3 : 0)); dy = Math.round(f.y + (box[6] - FEET - off) * sc + rise);
      } else {
        const fr = m.frames[Math.floor(f.ft * 4) % m.frames.length], flier = f.kind === 'wisp' || f.kind === 'kite', fall = f.die ? Math.min(1, f.die * 2) : 0;
        sx = fr[0]; sy = fr[1]; sw = fr[2]; sh = fr[3]; dw = sw * sc; dh = sh * sc;
        dx = Math.round(f.x - dw / 2 + (f.hit > 0 ? 3 : 0)); dy = Math.round(f.y - dh - (flier ? 22 - fall * 20 - Math.sin(f.ft * 5) * 1.5 : 0) + rise);
        if (f.die && !flier) { dy += Math.round(dh * 0.4); dh = Math.round(dh * 0.6); }
      }
      g.drawImage(S.img, sx, sy, sw, sh, dx, dy, dw, dh);
      if (glow) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = glow * f.alpha; g.drawImage(S.img, sx, sy, sw, sh, dx, dy, dw, dh); g.globalCompositeOperation = 'source-over'; }
      if (f.hitFx && root.Animated2D) root.Animated2D.draw(g, 'hit-spark', f.x, f.y - 28 * sc, f.hitFx.t, { scale: sc > 1 ? 0.9 : 0.78 });
      g.globalAlpha = 1;
    }
    _render() {
      const g = this.g, k = this.k, W = this.canvas.width, Hh = this.canvas.height, dp = this.dpr || 1;
      const shk = this.shake > 0 ? Math.min(1, this.shake * 5) * 2 * k : 0;
      const H = this.hero, C = this.comp, ox = -Math.round(this.cam * k) + Math.round(Math.sin(this.t * 95) * shk), oy = -Math.round(this.camY * k) + Math.round(Math.cos(this.t * 83) * shk * 0.6);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#070608'; g.fillRect(0, 0, W, Hh);
      g.imageSmoothingEnabled = false;
      g.setTransform(k, 0, 0, k, ox, oy);
      { const sx = Math.max(0, Math.floor(this.cam) - 1), sy = Math.max(0, Math.floor(this.camY) - 1), sw = Math.min(this.W - sx, Math.ceil(this._vw()) + 3), sh = Math.min(this.Hw - sy, Math.ceil(this._vh()) + 3); if (sw > 0 && sh > 0) g.drawImage(this.stat, sx, sy, sw, sh, sx, sy, sw, sh); }
      this.torches.forEach((p) => {
        const ax = p[0], ay = p[1] + 27;
        const animated = root.Animated2D && root.Animated2D.draw(g, 'wall-torch', ax, ay, this.t);
        if (!animated) { const tr = this.spr.torch; if (tr) g.drawImage(this.atlas, tr[0], tr[1], tr[2], tr[3], p[2], p[3], tr[2], tr[3]); }
      });
      if (root.Animated2D) this.puddles.forEach((p) => {
        g.save(); g.beginPath(); g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2); g.clip();
        root.Animated2D.draw(g, 'water', p.x, p.y, this.t, { phase: p.phase });
        g.restore();
      });
      this.chests.forEach((c) => {
        const r = this.spr.chest;
        if (!r) return;
        g.drawImage(this.atlas, r[0], r[1], r[2], r[3], Math.round(c.x - r[2] / 2), Math.round(c.y - r[3]), r[2], r[3]);
        if (c.open) { g.fillStyle = '#140d06'; g.fillRect(Math.round(c.x - 12), Math.round(c.y - r[3] + 3), 24, 6); g.fillStyle = 'rgba(255,215,90,0.35)'; g.beginPath(); g.ellipse(c.x, c.y - 24, 11, 6, 0, 0, Math.PI * 2); g.fill(); }
      });
      this.spikes.forEach((s) => { const p = this.mobm.spikes.frames[0], up = Math.min(1, s.t * 8) * (s.t > 0.8 ? Math.max(0, 1 - (s.t - 0.8) * 3) : 1), h = Math.max(1, Math.round(p[3] * up)); g.drawImage(this.mob, p[0], p[1], p[2], h, Math.round(s.x - p[2] / 2), Math.round(s.y - h), p[2], h); });
      // everyone, back to front (a bird flies over the lot)
      const list = this.foes.map((f) => ({ y: f.y, f: f }));
      list.push({ y: H.y + 0.1, a: H });
      if (C) list.push({ y: C.bird ? 1e6 : C.y, a: C });
      list.sort((a, b) => a.y - b.y).forEach((o) => {
        if (o.f) return this._drawFoe(g, o.f);
        const a = o.a;
        if (a.bird) {
          const r = this.spr[a.bird + '.' + (a.swoop || a.tx != null ? 'fly' + (Math.floor(this.t * 10) % 2) : 'perch' + (Math.floor(this.t * 1.3) % 3 === 0 ? 1 : 0))];
          if (r) g.drawImage(this.atlas, r[0], r[1], r[2], r[3], Math.round(a.x - r[2] / 2), Math.round(a.y - r[3] + (a.tx == null && !a.swoop ? Math.sin(this.t * 2) * 2 : 0)), r[2], r[3]);
          return;
        }
        if (!a.sheets) return;
        g.fillStyle = 'rgba(10,8,12,0.35)'; g.beginPath(); g.ellipse(a.x, a.y, 9, 3, 0, 0, Math.PI * 2); g.fill();
        this._drawLPC(g, a);
      });
      // the dark: a light round the hero, a glow at each torch
      g.setTransform(1, 0, 0, 1, 0, 0);
      // the dark is drawn at a quarter of the resolution and scaled up (it's all soft gradients, so nobody can tell,
      // and it's a sixteenth of the pixels to fill on a phone)
      const Q = 4, dk = this.dk || (this.dk = document.createElement('canvas')), dw = Math.ceil(W / Q), dh = Math.ceil(Hh / Q);
      if (dk.width !== dw || dk.height !== dh) { dk.width = dw; dk.height = dh; }
      const d = dk.getContext('2d');
      d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, dw, dh);
      d.fillStyle = 'rgba(6,5,8,' + this.th.dark + ')'; d.fillRect(0, 0, dw, dh);
      d.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r0, r1, a) => { x /= Q; y /= Q; r0 /= Q; r1 /= Q; if (x < -r1 || x > dw + r1) return; const gg = d.createRadialGradient(x, y, r0, x, y, r1); gg.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gg.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = gg; d.fillRect(x - r1, y - r1, r1 * 2, r1 * 2); };
      hole(ox + H.x * k, oy + (H.y - 30) * k, 24 * k, 160 * k, 1);
      this.torches.forEach((p) => hole(ox + p[0] * k, oy + (p[1] + 20) * k, 0, 70 * k, 0.55));
      this.foes.forEach((f) => { if (f.boss && f.alpha > 0) hole(ox + f.x * k, oy + (f.y - 50) * k, 0, 120 * k, 0.85 * f.alpha); });
      g.imageSmoothingEnabled = true;
      g.drawImage(dk, 0, 0, dw * Q, dh * Q);
      g.imageSmoothingEnabled = false;
      // torch glow: one soft sprite, drawn at each torch
      const glow = this._glow || (this._glow = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gg = x.createRadialGradient(32, 32, 0, 32, 32, 32); gg.addColorStop(0, 'rgba(255,150,60,1)'); gg.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = gg; x.fillRect(0, 0, 64, 64); return c; })());
      g.globalCompositeOperation = 'lighter';
      g.imageSmoothingEnabled = true;
      this.torches.forEach((p, i) => {
        const tx = ox + p[0] * k, ty = oy + p[1] * k, R2 = 48 * k;
        if (tx < -R2 || tx > W + R2) return;
        g.globalAlpha = 0.13 + Math.sin(this.t * 7 + i * 1.7) * 0.025;
        g.drawImage(glow, tx - R2, ty - R2, R2 * 2, R2 * 2);
      });
      g.globalAlpha = 1;
      g.imageSmoothingEnabled = false;
      g.globalCompositeOperation = 'source-over';
      // the air: dust, snow, embers or spores, by theme (worked out from the clock, so it's the same every time)
      { const M = (DRESS[this.D.theme] || DRESS.crypt).mote; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = M[0];
        for (let i = 0; i < 26; i++) {
          const sx = (i * 137.5 + this.t * (M[1] + (i % 5) * 2) * k + Math.sin(this.t * 0.7 + i) * 6 * k) % W, sy = (((i * 89.3 + this.t * M[2] * k * (0.6 + (i % 4) * 0.2)) % Hh) + Hh) % Hh;
          g.globalAlpha = M[3] * (0.45 + 0.55 * Math.abs(Math.sin(this.t * 1.3 + i * 2.1)));
          g.fillRect(Math.round((sx + W) % W), Math.round(sy), i % 3 ? k : 2 * k, i % 3 ? k : 2 * k);
        }
        g.globalAlpha = 1;
        // the name of the room, as he walks in
        if (this.card && this.card.t < 1.8) { const c = this.card, a = c.t < 0.2 ? c.t / 0.2 : c.t > 1.4 ? (1.8 - c.t) / 0.4 : 1, fs = Math.round(11 * k);
          g.globalAlpha = a; g.font = '600 ' + fs + "px 'Pixelify Sans', monospace"; g.textAlign = 'center';
          const tw = g.measureText(c.txt).width + 14 * k; g.fillStyle = 'rgba(11,8,6,0.82)'; g.fillRect(Math.round(W / 2 - tw / 2), Math.round(10 * k), Math.round(tw), Math.round(18 * k));
          g.fillStyle = '#a67f2b'; g.fillRect(Math.round(W / 2 - tw / 2), Math.round(10 * k), Math.round(tw), k); g.fillRect(Math.round(W / 2 - tw / 2), Math.round(27 * k), Math.round(tw), k);
          g.fillStyle = '#ffd873'; g.fillText(c.txt, W / 2, Math.round(23 * k)); g.globalAlpha = 1; g.textAlign = 'left'; } }
      // effects, bright over the dark
      g.setTransform(k, 0, 0, k, ox, oy);
      this.fx.forEach((f) => {
        const u = f.t / f.life;
        if (f.t < 0) return;
        if (f.kind === 'bolt') { const x = lerp(f.x, f.tx, u), y = lerp(f.y, f.ty, u); g.fillStyle = f.col; g.globalAlpha = 0.95; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); g.globalAlpha = 0.4; g.beginPath(); g.arc(lerp(f.x, f.tx, u * 0.8), lerp(f.y, f.ty, u * 0.8), 2, 0, Math.PI * 2); g.fill(); }
        else if (f.kind === 'slashfx') { g.strokeStyle = 'rgba(255,255,255,' + (1 - u) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y, 14, -1.2 + u, 0.9 + u); g.stroke(); }
        else if (f.kind === 'breath') { for (let i = 0; i < 8; i++) { const v = Math.min(1, u * 1.4 - i * 0.05); if (v <= 0) continue; g.fillStyle = f.col; g.globalAlpha = 0.5 * (1 - u); g.beginPath(); g.arc(lerp(f.x, f.tx, v) + Math.sin(i * 3) * 6, lerp(f.y, f.ty, v) + Math.cos(i * 2) * 6, 4 + v * 6, 0, Math.PI * 2); g.fill(); } }
        else if (f.kind === 'flask' || f.kind === 'flaskpop' || f.kind === 'goldpop') { const p = this.mobm[f.kind === 'goldpop' ? 'gold' : 'flask'].frames[0]; g.globalAlpha = Math.min(1, (1 - u) * 3); g.drawImage(this.mob, p[0], p[1], p[2], p[3], Math.round(f.x - p[2] / 2), Math.round(f.y - u * 16), p[2], p[3]); }
        else if (f.kind === 'item') { g.globalAlpha = Math.min(1, (1 - u) * 3) * 0.45; g.fillStyle = f.col; g.beginPath(); g.arc(f.x, f.y - u * 14, 9, 0, Math.PI * 2); g.fill(); g.globalAlpha = Math.min(1, (1 - u) * 3); g.font = '11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.i, f.x, f.y - u * 14); }
        g.globalAlpha = 1;
      });
      this.parts.forEach((p) => { g.fillStyle = p.col; g.globalAlpha = Math.max(0, 1 - p.t / p.life) * (p.big ? 0.4 : 1); if (p.big) { g.beginPath(); g.arc(p.x, p.y, 4, 0, Math.PI * 2); g.fill(); } else g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); g.globalAlpha = 1; });
      // numbers, bubbles, the boss's bar, the banner (in screen pixels, so they read on a phone)
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      // HP bars: his (with the number), and one over each foe that's taken a hit; names under the party
      const bar = (x, y, w, f, col) => { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(x - w / 2 - dp, y - dp, w + 2 * dp, 4 * dp + 2 * dp); g.fillStyle = col; g.fillRect(x - w / 2, y, w * clamp(f, 0, 1), 4 * dp); };
      if (H.hpMax && H.hp != null && !H.dead) {
        const x = ox + H.x * k, y = oy + (H.y - 60) * k;
        bar(x, y, 34 * dp, H.hp / H.hpMax, H.hp / H.hpMax < 0.3 ? '#d8432f' : '#5fbf4a');
        g.font = '700 ' + Math.round(10 * dp) + 'px \'Pixelify Sans\', monospace'; g.lineWidth = 3 * dp; g.strokeStyle = 'rgba(0,0,0,0.85)';
        const ht = Math.max(0, H.hp) + '/' + H.hpMax; g.strokeText(ht, x, y - 7 * dp); g.fillStyle = '#e9f5e0'; g.fillText(ht, x, y - 7 * dp);
      }
      this.foes.forEach((f) => {
        if (!f.alive || f.hidden || f.boss || !f.max || f.cur == null || f.cur >= f.max || f.alpha <= 0) return;
        bar(ox + f.x * k, oy + (f.y - 52 * f.scale) * k, 24 * dp, f.cur / f.max, '#c0392b');
      });
      g.font = Math.round(9 * dp) + 'px \'Pixelify Sans\', monospace';
      [[H, this.o.name || ''], [C, C && C.name]].forEach(([a, nm]) => {
        if (!a || !nm || a.dead) return;
        const x = ox + a.x * k, y = oy + (a.y + (a.bird ? 6 : 8)) * k;
        g.lineWidth = 3 * dp; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(nm, x, y); g.fillStyle = a === H ? '#f0e2b6' : '#cfe3ff'; g.fillText(nm, x, y);
      });
      this.nums.forEach((n) => {
        const u = n.t / 1.1, x = ox + n.x * k, y = oy + (n.y - u * 18) * k;
        g.globalAlpha = Math.min(1, (1 - u) * 2.5);
        g.font = '700 ' + Math.round((n.big ? 15 : 13) * dp) + 'px \'Pixelify Sans\', monospace';
        g.lineWidth = 3 * dp; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(n.txt, x, y);
        g.fillStyle = n.col; g.fillText(n.txt, x, y);
        g.globalAlpha = 1;
      });
      [H, C].forEach((a) => {
        if (!a || !a.bub) return;
        const x = ox + a.x * k, y = oy + (a.y - (a.bird ? 24 : 64)) * k;
        g.fillStyle = 'rgba(250,246,236,0.95)'; g.beginPath(); g.arc(x, y, 11 * dp, 0, Math.PI * 2); g.fill();
        g.font = Math.round(12 * dp) + 'px sans-serif'; g.fillStyle = '#000'; g.fillText(a.bub.txt, x, y + dp);
      });
      if (this.bossName && this.foes.some((f) => f.boss && f.alpha > 0)) {
        const bw = Math.min(W * 0.72, 360 * dp), bx = (W - bw) / 2, by = Hh - 14 * dp;
        g.font = '500 ' + Math.round(13 * dp) + 'px \'Pixelify Sans\', monospace'; g.textBaseline = 'bottom'; g.fillStyle = '#e8dcc0';
        g.fillText(this.bossName, W / 2, by - 4 * dp);
        g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(bx, by, bw, 6 * dp);
        g.fillStyle = '#8b1e1e'; g.fillRect(bx, by, bw * clamp(this.bossHp == null ? 1 : this.bossHp, 0, 1), 6 * dp);
        g.strokeStyle = '#6b5a35'; g.lineWidth = 1; g.strokeRect(bx - 0.5, by - 0.5, bw + 1, 6 * dp + 1);
        g.textBaseline = 'middle';
      }
      if (this.flashC) { const f = this.flashC, a = f.t < 0.6 ? f.t / 0.6 : Math.max(0, (1.1 - f.t) / 0.5); g.globalAlpha = Math.min(0.85, a); g.fillStyle = f.col; g.fillRect(0, 0, W, Hh); g.globalAlpha = 1; }
      if (this.banner) {
        const b = this.banner, a = Math.min(1, b.t / 0.8);
        g.fillStyle = 'rgba(0,0,0,' + 0.55 * a + ')'; g.fillRect(0, Hh * 0.36, W, Hh * 0.26);
        g.globalAlpha = a; g.font = Math.round(Math.min(Hh * 0.13, W / (b.txt.length * 0.75))) + 'px \'Pixelify Sans\', monospace'; g.fillStyle = b.col;
        g.fillText(b.txt, W / 2, Hh * 0.49); g.globalAlpha = 1;
      }
    }
  }
  // Frame timings from the last ~600 frames: draw cost (work) and frame-to-frame gap, in ms.
  Crawl.stats = () => {
    const st = Crawl._st || { work: [], gap: [] };
    const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? Math.round(b[Math.floor((b.length - 1) * p)] * 100) / 100 : null; };
    const g = st.gap.filter((x) => x > 0);
    return { frames: st.work.length, workMedian: q(st.work, 0.5), workP95: q(st.work, 0.95), gapMedian: q(g, 0.5), gapP95: q(g, 0.95), fps: g.length ? Math.round(1000 / q(g, 0.5)) : null, over16ms: g.filter((x) => x > 17.5).length };
  };
  Crawl.resetStats = () => { Crawl._st = { work: [], gap: [] }; };
  root.Crawl = Crawl;
})(typeof window !== 'undefined' ? window : globalThis);
