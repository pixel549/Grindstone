// Grindstone 2.24: the town as a place. A map he walks round, buildings he goes into, people he talks to,
// and plots where his companions' homes go up (the only part of town he builds himself).
// Loaded after core.js and delve.js; adds to window.G. No drawing here (that's town2d.js), so node can test it.
(function (root) {
  'use strict';
  const G = root.G;
  const T = 32;

  // ---------------------------------------------------------------- small helpers
  const hash = (str) => { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => { let a = hash(seed) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
  const pick = (a, r) => a[Math.floor((r ? r() : Math.random()) * a.length) % a.length];
  const lc = (x) => (x ? x.charAt(0).toLowerCase() + x.slice(1) : x);
  const uc = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  const dayNum = (t) => Math.floor(Date.parse(t + 'T00:00:00Z') / 864e5) | 0;
  const theName = (n) => n.replace(/^the /, 'the ');

  // ---------------------------------------------------------------- the map
  // 44 × 46 tiles. North: the big four (library, counting house, tavern, chapel) on Market Street; the square and four
  // more on Mill Lane; the dojo, the track, the watch house and the pond on Pond Row; then two rows of homes on Hearth
  // Row and Cobble Row; the road home leaves through the south gate.
  const TW = 44, TH = 46;
  const STREETS = [['Market Street', 9], ['Mill Lane', 18], ['Pond Row', 27], ['Hearth Row', 34], ['Cobble Row', 41]];
  // x, y: the facade's top-left tile; w × h tiles; f: its sprite (town.json, or the world atlas for the tower); dc: the door's column
  const LOTS = {
    library: { x: 2, y: 2, w: 8, h: 7, f: 'b.library', dc: 2 },
    bank: { x: 11, y: 2, w: 8, h: 7, f: 'b.bank', dc: 2 },
    tavern: { x: 24, y: 2, w: 8, h: 7, f: 'b.tavern', dc: 2 },
    chapel: { x: 33, y: 2, w: 8, h: 7, f: 'b.chapel', dc: 2 },
    gym: { x: 2, y: 12, w: 6, h: 6, f: 'b.gym', dc: 3 },
    baths: { x: 9, y: 12, w: 6, h: 6, f: 'b.baths', dc: 3 },
    market: { x: 29, y: 12, w: 6, h: 6, f: 'b.market', dc: 3 },
    apothecary: { x: 36, y: 12, w: 6, h: 6, f: 'b.apothecary', dc: 3 },
    dojo: { x: 2, y: 21, w: 6, h: 6, f: 'b.dojo', dc: 3 },
    track: { x: 9, y: 22, w: 5, h: 5, f: 'b.track', dc: 4 },
    tower: { x: 25, y: 23, w: 2, h: 4, f: 'w:tower.3', dc: 1 },
  };
  // Sixteen home plots, nearest the high road first. Each is a 5 × 5 cottage with its door on the right.
  const PLOTS = [];
  [29, 36].forEach((y) => [16, 23, 11, 28, 6, 33, 1, 38].forEach((x) => PLOTS.push({ x: x, y: y, w: 5, h: 5, dc: 4 })));
  const GATE = [[21, 45], [22, 45]], SPAWN = [21, 44];
  const door = (L) => [L.x + L.dc, L.y + L.h];   // where you stand to go in: the cell below the door
  const streetOf = (y) => { let best = STREETS[0]; STREETS.forEach((s) => { if (Math.abs(s[1] - y) < Math.abs(best[1] - y)) best = s; }); return best[0]; };

  // Ground: 0 grass, 1 road, 2 cobbles, 3 water, 4 the running track. Fixed, so worked out once.
  let GROUND = null;
  function townGround() {
    if (GROUND) return GROUND;
    const g = new Uint8Array(TW * TH);
    const set = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < TW && y < TH) g[y * TW + x] = v; };
    STREETS.forEach((s) => set(1, s[1], TW - 2, s[1] + 1, 1));
    set(21, 9, 22, TH - 1, 1);
    set(16, 11, 27, 17, 2);
    for (let y = 21; y <= 26; y++) for (let x = 14; x <= 19; x++) if (x === 14 || x === 19 || y === 21 || y === 26) g[y * TW + x] = 4;
    set(31, 22, 38, 25, 3);
    GROUND = g;
    return g;
  }
  // Things that stand about the town for good: [sprite, cell x, cell y, cells it blocks across (centred on x), nudge x px]
  // Sprites ending in * take the season.
  const PROPS = (() => {
    const P = [];
    const add = (s, x, y, bw, dx) => P.push([s, x, y, bw == null ? 1 : bw, dx | 0]);
    // the tree line round the edge
    for (let x = 1; x < TW - 1; x += 3) add('tree.*', x, 1, 1);
    for (let y = 4; y < TH - 2; y += 3) { if (!STREETS.some((s) => y >= s[1] - 1 && y <= s[1] + 2)) { add('tree.*', 0, y, 1); add('tree.*', TW - 1, y, 1); } }
    for (let x = 1; x < TW - 1; x += 3) if (x < 19 || x > 24) add('tree.*', x, TH - 1, 1);
    // the square
    add('x.fountain', 21, 14, 2, 16);
    [[17, 12], [26, 12], [17, 16], [26, 16]].forEach((c) => add('x.bench', c[0], c[1]));
    [[16, 11], [27, 11], [16, 17], [27, 17]].forEach((c) => add('gardenlamp', c[0], c[1]));
    [[19, 13], [24, 13]].forEach((c) => add('x.flowerbed', c[0], c[1]));
    add('x.well', 19, 16);
    // by the tavern and the market
    add('barrel', 32, 7); add('barrel', 32, 8); add('crate', 10, 8);
    add('crate', 28, 12); add('barrel', 28, 13); add('x.pumpkins', 28, 16);
    // lamps on the corners of the high road
    [[20, 20], [23, 20], [20, 29 - 1], [23, 29 - 1], [20, 43], [23, 43]].forEach((c) => add('gardenlamp', c[0], c[1]));
    // round the pond and the watch house
    add('tree.*', 30, 21); add('tree.*', 39, 21); add('rock', 39, 25); add('x.duckhouse', 30, 25);
    add('x.armour', 24, 26); add('x.shield', 27, 26);
    // the dojo yard and the track
    add('x.signpost', 20, 44); add('x.mailbox', 23, 44);
    add('hedge', 8, 21); add('hedge', 8, 25);
    return P;
  })();

  // ---------------------------------------------------------------- inside the buildings
  // 11 wide × 9 deep: two rows of wall, six of floor, the doorstep in the middle of the bottom wall.
  // props: [sprite, cell x, base row, cells it blocks across, rows it blocks (1)]; keeper: [x, y]; the counter sits in front of them.
  const IN_W = 11, IN_H = 9, EXIT = [5, 8];
  const INSIDE = {
    gym: { floor: 'floor.rubber', wall: 'wall.brick', keeper: [5, 3], props: [['weights.3', 1, 3, 3], ['weights.4', 7, 3, 3], ['bag.3', 1, 6, 1], ['bag.2', 9, 6, 1], ['x.trophy', 5, 2, 1], ['x.banner', 3, 2, 1], ['x.banner', 7, 2, 1], ['mat', 5, 7, 0]] },
    track: { floor: 'floor.timber', wall: 'wall.timber', keeper: [5, 3], props: [['x.trophy', 2, 2, 1], ['x.trophy', 8, 2, 1], ['x.map', 5, 2, 1], ['x.bench', 1, 6, 1], ['x.bench', 9, 6, 1], ['crate', 9, 3, 1], ['basket', 1, 3, 1]] },
    baths: { floor: 'floor.4', wall: 'wall.stone', keeper: [5, 3], props: [['pool.2', 1, 7, 3, 3], ['pool.2', 7, 7, 3, 3], ['plant.0', 1, 3, 1], ['plant.1', 9, 3, 1], ['x.lilypot', 0, 4, 1], ['x.lilypot', 10, 4, 1]] },
    library: { floor: 'floor.2', wall: 'wall.3', keeper: [5, 4], props: [['bookshelf', 1, 2, 2], ['bookshelf', 8, 2, 2], ['bookshelf.small', 3, 2, 1], ['bookshelf.small', 7, 2, 1], ['desk.3', 5, 5, 4], ['x.globe', 1, 6, 1], ['candelabra', 9, 6, 1], ['x.books', 3, 6, 1]] },
    dojo: { floor: 'floor.timber', wall: 'wall.timber', keeper: [5, 3], props: [['x.armour', 1, 2, 1], ['x.armour', 9, 2, 1], ['x.shield', 3, 2, 1], ['x.shield', 7, 2, 1], ['x.banner', 5, 2, 1], ['bag.1', 1, 6, 1], ['weights.2', 8, 6, 2], ['mat', 5, 5, 0]] },
    apothecary: { floor: 'floor.dirt', wall: 'wall.stone', keeper: [5, 3], props: [['x.cauldron', 2, 3, 1], ['bookshelf.small', 9, 2, 1], ['x.vase', 1, 6, 1], ['plant.1', 9, 6, 1], ['x.candles', 3, 6, 1], ['basket', 8, 3, 1]] },
    market: { floor: 'floor.0', wall: 'wall.timber', keeper: [5, 3], props: [['crate', 1, 3, 1], ['crate', 2, 3, 1], ['barrel', 9, 3, 1], ['barrel', 8, 3, 1], ['x.pumpkins', 1, 6, 1], ['basket', 9, 6, 1], ['x.shelf', 5, 2, 1]] },
    tavern: { floor: 'floor.timber', wall: 'wall.brick', keeper: [2, 3], props: [['fireplace', 8, 2, 3], ['table.round', 6, 5, 1], ['table.round', 9, 5, 1], ['chair.dining', 5, 5, 1], ['chair.dining', 7, 5, 1], ['x.gametable', 3, 6, 1], ['barrel', 1, 2, 1], ['barrel', 4, 2, 1], ['candelabra', 5, 2, 1]] },
    bank: { floor: 'floor.5', wall: 'wall.3', keeper: [5, 3], props: [['chest', 1, 3, 1], ['chest', 2, 3, 1], ['chest', 9, 3, 1], ['clock', 8, 3, 1], ['x.trophy', 3, 2, 1], ['x.vase', 1, 6, 1], ['x.vase', 9, 6, 1], ['desk.4', 5, 5, 4]] },
    tower: { floor: 'floor.0', wall: 'wall.stone', keeper: [5, 3], props: [['x.scope', 8, 3, 1], ['x.map', 3, 2, 1], ['x.armour', 1, 3, 1], ['x.shield', 9, 2, 1], ['crate', 1, 6, 1], ['crate', 9, 6, 1], ['x.banner', 6, 2, 1]] },
    chapel: { floor: 'floor.4', wall: 'wall.stone', keeper: [5, 3], props: [['candelabra', 3, 3, 1], ['candelabra', 7, 3, 1], ['x.candles', 5, 2, 1], ['x.banner', 1, 2, 1], ['x.banner', 9, 2, 1], ['x.bench', 2, 5, 1], ['x.bench', 4, 5, 1], ['x.bench', 6, 5, 1], ['x.bench', 8, 5, 1], ['x.vase', 1, 7, 1], ['x.vase', 9, 7, 1]] },
  };
  // The counter between him and the keeper (not the tavern's: the bar's on the left; not the library's or the bank's: there's a desk)
  Object.keys(INSIDE).forEach((k) => { const I = INSIDE[k]; if (k !== 'library' && k !== 'bank') I.props.push(['counter', I.keeper[0], I.keeper[1] + 1, 1]); if (k === 'tavern') I.props.push(['counter', 3, 4, 1]); });

  // ---------------------------------------------------------------- the people who keep the buildings
  const KEEPERS = {
    gym: { name: 'Brannoc', sex: 'm', garb: 'work', hat: 'none', build: 'broad', hello: 'Back again? Good. The iron missed you.',
      barks: ['Lift it, put it down, lift it again. That is the whole secret.', 'Chalk is on the shelf. Don’t eat it. The last bloke did.', 'Strength is slow. So is a glacier, and look what they did to the valleys.', 'Nobody ever regretted the set they finished.'] },
    track: { name: 'Edda', sex: 'f', garb: 'work', hat: 'hood', hello: 'Laps don’t run themselves. I’ve checked.',
      barks: ['Four hundred paces a lap. I’ve counted. Twice.', 'Run when it’s raining. Nobody’s watching and you feel heroic.', 'Slow is fine. Slow and often is better than fast and once.', 'The wind’s against you both ways. Character building.'] },
    baths: { name: 'Mother Wenna', sex: 'f', garb: 'robe', hat: 'none', hello: 'In you go. Mind the hot end.',
      barks: ['Half the town’s aches come through that door. Half the gossip too.', 'Eat something green today. I can tell when you haven’t.', 'Water first. Then we’ll talk about your problems.', 'Rest is part of the work, love.'] },
    library: { name: 'Aldous', sex: 'm', garb: 'finery', hat: 'none', extra: 'glasses', hello: 'Shh. No, that one was a friendly shh.',
      barks: ['Books don’t bite. The overdue notices do.', 'One page a day is three hundred and sixty-five a year. Sneaky, isn’t it?', 'The good bit is always two chapters past where people stop.', 'Knowledge is power. Also it is heavy. Lift with your knees.'] },
    dojo: { name: 'Master Ren', sex: 'm', garb: 'plain', hat: 'none', hello: 'Bow. Good. Now again, like you mean it.',
      barks: ['Discipline is doing it on the day you don’t want to. Every other day is easy.', 'Again. Slower. Now again.', 'The week is the kata. Finish the form.', 'A plan you keep beats a plan you admire.'] },
    apothecary: { name: 'Hessa', sex: 'f', garb: 'robe', hat: 'hood', hello: 'Don’t touch the green one.',
      barks: ['Everything is poison if you’re brave enough with it.', 'Drink it while it’s hot. Or don’t. I’m not your mother.', 'A flask in time saves a long walk home.', 'The purple one is for emergencies. The orange one causes them.'] },
    market: { name: 'Coyle', sex: 'm', garb: 'oilskin', hat: 'hat', hello: 'Buying, selling, haggling. Mostly haggling.',
      barks: ['Everything is worth something to somebody. Usually me.', 'That spare sword under your bed? Coin. Bring it.', 'I never cheat a customer. I just educate them.', 'Fresh pumpkins! Well. Pumpkins.'] },
    tavern: { name: 'Marta', sex: 'f', garb: 'plain', hat: 'none', hello: 'Ale’s cold, stew’s hot, and the bard is paid to stop.',
      barks: ['Pull up a stool. Wipe it first.', 'Nobody goes down a dungeon alone in my day. Take a mate.', 'I’ve heard every story in this town twice. Yours are new.', 'Tab’s on the slate. The slate is very long.'] },
    bank: { name: 'Pym', sex: 'm', garb: 'coat', hat: 'tricorn', hello: 'Every coin has a story. Most of them are about me counting it.',
      barks: ['Interest is just patience with a ledger.', 'Earn it, spend it, it all counts. I only care that it moved.', 'Gold is like fitness. It compounds, and so does neglect.', 'Please don’t lean on the vault. It gets nervous.'] },
    tower: { name: 'Captain Hale', sex: 'f', garb: 'armour', hat: 'none', hello: 'Quiet night. I hate quiet nights.',
      barks: ['Every foe you fell is one less I have to watch for.', 'Keep your eyes open down there. Snares love a hurry.', 'The ones that hide are worse than the ones that shout.', 'Watch the shadows. Then watch the shadows behind those.'] },
    chapel: { name: 'Sister Agnes', sex: 'f', garb: 'robe', hat: 'none', hello: 'Sit. Breathe. The rest will keep.',
      barks: ['Small kindnesses, kept often. That is the whole sermon.', 'Do the thing they asked. It means more than you think.', 'Grace is just effort nobody saw.', 'The bells ring at six. Mostly at six.'] },
  };
  // What each challenge counts, in plain words, for the keepers to say
  const METER_TIP = {
    STR: 'Strength comes from strength deeds: the lifts, the swims, the long walks with something heavy.',
    dEND: 'Any endurance deed counts: a run, a swim, the beach. Every one is a step.',
    level: 'Levels come from everything you log. Keep the days full and it climbs.',
    INT: 'Study and reading raise Intellect. A page counts.',
    wk: 'Finish your weeklies. Every one you complete counts here.',
    flasks: 'Drink a flask on a run that clears a dungeon and it counts. A run that falls doesn’t.',
    sold: 'Sell your spare gear (Status › Pack). Every piece counts.',
    party: 'Clear a dungeon with a companion at your side.',
    earned: 'Any gold you earn counts, even if you spend it straight away.',
    kills: 'Foes struck down on a run that clears a dungeon count.',
    asks: 'Keep your household’s requests. They ask; you do it; it counts.',
  };

  // ---------------------------------------------------------------- townsfolk and their small talk
  const FOLK_BARKS = [
    'Lovely day for it. Whatever it is.', 'My nan says the dungeons were smaller in her day.', 'Have you tried the pies at the tavern? Don’t.',
    'They say the fountain grants wishes. Mine was for the fountain to stop splashing me.', 'Busy, busy. Always busy.', 'Morning! Or is it? I’ve lost track.',
    'If you see a goat, it isn’t mine.', 'The wind off the water’s got teeth today.', 'I used to delve. Then I took an arrow to the… well, the shin. Hurt like anything.',
    'Mind the puddles. Some of them are deeper than they look.', 'Do you ever just stand in the square and breathe? I do. Then I get moved on.', 'My cousin says hello. You don’t know him.',
    'Saw a bird the size of a cat yesterday. Green, loud, opinionated.', 'Town’s getting bigger. I liked it smaller. I also like it bigger.', 'Keep your boots dry and your purse full.',
    'Somebody’s been building. I can smell the sawdust.', 'I’m waiting for someone. I’ve forgotten who.', 'Every day you show up counts. My dad said that. He showed up a lot.',
    'You’re the one who goes down the holes, aren’t you? Brave. Or something.', 'Rain’s coming. My knee says so.', 'Don’t feed the ducks bread. Feed them peas. They’re fussy.',
    'Bit of a walk from your place, isn’t it? Good for you, mind.', 'I’d help you with the dungeons but I’m very busy standing here.', 'They’ll put a statue of you up one day. Pigeons permitting.',
    'Have you eaten? You look like you haven’t eaten.',
  ];
  const FOLK_GARB = ['plain', 'plain', 'plain', 'work', 'oilskin', 'coat', 'robe'];
  const FOLK_HAT = ['none', 'none', 'none', 'hood', 'hat'];
  const CALLING_BARKS = {
    healer: ['Drink some water. Yes, now. I’ll wait.', 'You’re looking after yourself. I can see it.', 'Bandages are easier than apologies.'],
    scout: ['I know a shortcut. It is longer, but it is prettier.', 'Legs good? Lungs good? Then we go.', 'Out there is better than in here. Mostly.'],
    fighter: ['Spar later? I’ll go easy. I won’t.', 'Shoulders back. Chin down. Hit first.', 'I’ve been sharpening things. All of them.'],
    mage: ['I read something fascinating. It would take three days to explain.', 'Magic is just study with better lighting.', 'Shh, I’m thinking. That was the thought.'],
  };
  const HOME_BARKS = ['Feels like home now. Thank you.', 'Pop in any time. Wipe your feet.', 'Best little house on the row, this.', 'I sleep better under my own roof.', 'Come and see what I’ve done with the place.'];
  // Ambient speech for household companions. Keep each voice rooted in their calling, then let their own home life show through.
  function npcBarks(n) {
    if (!n) return ['Lovely weather for staying in.'];
    const role = n.comp || n.role, voice = CALLING_BARKS[role] || [];
    const home = HOME_BARKS;
    return voice.concat(home, n.about && String(n.about).length > 35 ? [String(n.about)] : []);
  }

  // ---------------------------------------------------------------- companions' homes
  // Every companion who lives with him (people, not the birds) gets a plot on Hearth Row or Cobble Row. He builds the
  // cottage, then whatever rooms they want, with the same tools as his own house.
  const HOME_BASE = 250, HOME_STEP = 150, HOME_MAX = 2500;
  const isHome = (n) => n && n.kind === 'human' && n.status === 'resident';
  function homesNorm(s) {
    if (!s.homes || typeof s.homes !== 'object' || Array.isArray(s.homes)) s.homes = {};
    const live = {};
    (s.npcs || []).forEach((n) => { if (isHome(n)) live[n.id] = n; });
    Object.keys(s.homes).forEach((id) => { if (!live[id]) delete s.homes[id]; });
    const used = {};
    Object.keys(s.homes).forEach((id) => {
      const h = s.homes[id];
      if (!h || typeof h !== 'object' || !(h.plot >= 0 && h.plot < PLOTS.length) || used[h.plot]) { delete s.homes[id]; return; }
      used[h.plot] = 1;
      h.built = typeof h.built === 'string' ? h.built : null;
      h.settled = typeof h.settled === 'string' ? h.settled : null;
      if (h.built) {
        const H = h.house && typeof h.house === 'object' ? h.house : null;
        if (!H || !Array.isArray(H.rooms) || !H.rooms.length) h.house = homeFresh();
        else { H.doors = Array.isArray(H.doors) ? H.doors : []; H.items = Array.isArray(H.items) ? H.items : []; H.bought = H.bought && typeof H.bought === 'object' ? H.bought : {}; H.seq = H.seq | 0; H.npc = 1; }
      } else h.house = null;
    });
    Object.keys(live).forEach((id) => {
      if (s.homes[id]) return;
      let p = 0; while (used[p]) p++;
      if (p >= PLOTS.length) return;
      used[p] = 1;
      s.homes[id] = { plot: p, built: null, settled: null, house: null };
    });
    return s.homes;
  }
  // A one-room cottage: a bedroom with a bed and a way in.
  function homeFresh() {
    const H = { rooms: [{ id: 'r1', name: 'Bedroom', style: 'house', purpose: 'bedroom', paid: G.roomPrice(7, 4), x0: 9, y0: 9, x1: 15, y1: 15 }], doors: [[13, 15], [14, 15]], items: [], bought: {}, seq: 1, npc: 1 };
    [['bed', 10, 11], ['bedside', 13, 11], ['window', 14, 9]].forEach((d) => { H.seq += 1; H.items.push({ id: H.seq, k: d[0], x: d[1], y: d[2] }); });
    return H;
  }
  const homeOf = (s, id) => (s.homes && s.homes[id]) || null;
  const homesBuilt = (s) => Object.keys(s.homes || {}).filter((id) => s.homes[id].built).length;
  const homeCost = (s) => Math.min(HOME_MAX, HOME_BASE + HOME_STEP * homesBuilt(s));
  function homeBuild(s, id, t) {
    homesNorm(s);
    const h = homeOf(s, id), n = (s.npcs || []).find((x) => x.id === id);
    if (!h || !n) return { err: 'They have nowhere to build' };
    if (h.built) return { err: 'It’s already built' };
    const cost = homeCost(s);
    if (s.gold < cost) return { err: 'Need ' + (cost - s.gold) + ' more gold' };
    s.gold -= cost;
    h.built = t || G.today();
    h.house = homeFresh();
    return { cost: cost, plot: h.plot };
  }
  // The estate a companion's home is drawn with: no wings, no extra land, everything at the third step so it looks lived in.
  const HOME_TIER = 2;
  function homeEstate() {
    const tiers = {};
    Object.keys(G.ESTATE).forEach((k) => { if (!G.ESTATE[k].wing) tiers[k] = HOME_TIER; });
    return { tiers: tiers, wings: {}, spent: 0, land: 0 };
  }
  function homeEstate3D() {
    const t = {}; Object.keys(G.ESTATE).forEach((k) => { if (!G.ESTATE[k].wing) t[k] = HOME_TIER; });
    return { t: t, w: {}, land: { lv: 0, lot: false, x1: 32, y1: 25, wt: 34, ht: 27 }, f: {} };
  }
  // The game state as the house tools see it while he's building one of their homes: their house, a plain estate,
  // no relics; everything else (the gold above all) is his. Changes go straight through to s.
  function homeProxy(s, id) {
    const h = homeOf(s, id);
    if (!h || !h.house || typeof Proxy === 'undefined') return null;
    const est = homeEstate(), decor = Object.assign({}, s.decor || {}, { owned: [], placed: {} });
    return new Proxy(s, {
      get: (o, k) => (k === 'house' ? h.house : k === 'estate' ? est : k === 'decor' ? decor : k === '__home' ? id : o[k]),
      set: (o, k, v) => { if (k === 'house') h.house = v; else if (k !== 'estate' && k !== 'decor') o[k] = v; return true; },
    });
  }
  // What a companion wants of their home, met when every line is ok (the list itself lives with the rest of the
  // strangers' wants, in core). Callings and people Jake made up have a want or two of their own here.
  const CALLING_WANTS = { 'c-healer': [['kitchen', 12, 1]], 'c-scout': [['store', 9, 1]], 'c-fighter': [['gym', 12, 1]], 'c-mage': [['study', 12, 1]] };
  function homeWants(s, id) {
    const n = (s.npcs || []).find((x) => x.id === id);
    if (!n || n.kind !== 'human') return [];
    if (String(id).indexOf('w-') === 0) return G.npcWants(s, id);
    const h = homeOf(s, id), rooms = (h && h.house && h.house.rooms) || [], out = [];
    const tiles = (r) => (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
    (CALLING_WANTS[id] || []).forEach((p) => {
      const have = rooms.filter((r) => r.purpose === p[0] && tiles(r) >= p[1]).length, nm = G.ROOM_PURPOSES[p[0]].n.toLowerCase();
      out.push({ text: 'A ' + nm + ' of ' + p[1] + ' tiles or more', ok: have >= p[2] });
    });
    if (!out.length) out.push({ text: 'A bedroom', ok: rooms.some((r) => r.purpose === 'bedroom') });
    return out;
  }
  const homeSettled = (s, id) => { const h = homeOf(s, id); return !!(h && h.settled); };
  // Called as things are saved: anyone whose home now has everything they asked for settles in, once, with a thank-you.
  function homeSettle(s, t) {
    const out = [];
    Object.keys(s.homes || {}).forEach((id) => {
      const h = s.homes[id], n = (s.npcs || []).find((x) => x.id === id);
      if (!h.built || h.settled || !n) return;
      const w = homeWants(s, id);
      if (!w.length || w.some((x) => !x.ok)) return;
      h.settled = t || G.today();
      const gift = n.via && n.via.type === 'gold' ? Math.round((n.via.gold | 0) / 2) : 150;
      s.gold += gift;
      out.push({ id: id, name: n.name, gift: gift });
    });
    return out;
  }
  const SETTLED_TEXT = 'they fight a little harder, and say thanks with some gold';

  // ---------------------------------------------------------------- who's in town, and where
  const KEEPER_LOOK = (k) => {
    const K = KEEPERS[k], L = G.randomLook(rng('keeper:' + k));
    L.sex = K.sex; if (K.build) L.build = K.build; if (K.extra) L.extra = K.extra;
    L.skin = G.LOOKS.skin[hash('skin:' + k) % 6];   // the keepers are townsfolk, not visitors from the deep
    if (K.sex === 'f') L.beard = 'none';
    return L;
  };
  const owned = (s) => Object.keys(G.TOWN).filter((k) => s.town && s.town.own && s.town.own[k]);
  function townPeople(s, t) {
    t = t || G.today();
    const out = [], own = owned(s);
    own.forEach((k) => {
      const K = KEEPERS[k], I = INSIDE[k];
      out.push({ id: 'k:' + k, kind: 'keeper', k: k, name: K.name, look: KEEPER_LOOK(k), garb: K.garb, hat: K.hat, scene: 'in:' + k, at: I.keeper.slice(), dir: 'down', still: true, barks: K.barks });
    });
    // townsfolk: a few more as the town grows; new faces each day
    const nf = Math.min(12, 3 + own.length + Math.floor((s.level | 0) / 12)), G0 = townGround(), roads = [];
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) if (G0[y * TW + x] === 1 || G0[y * TW + x] === 2) roads.push([x, y]);
    for (let i = 0; i < nf; i++) {
      const r = rng('folk:' + t + ':' + i), look = G.randomLook(r);
      const c = roads[Math.floor(r() * roads.length)];
      out.push({ id: 'f:' + i, kind: 'folk', name: G.randomName(r), look: look, garb: pick(FOLK_GARB, r), hat: pick(FOLK_HAT, r), scene: 'town', at: c.slice(), roam: 8, barks: FOLK_BARKS });
    }
    // companions, at their plots; the ones looking for work, in the square
    homesNorm(s);
    (s.npcs || []).forEach((n) => {
      if (n.kind !== 'human') return;
      if (n.status === 'resident') {
        const h = homeOf(s, n.id); if (!h) return;
        const P = PLOTS[h.plot], d = door(P);
        out.push({ id: 'n:' + n.id, kind: 'comp', npc: n.id, name: n.name, look: n.look, garb: n.garb, hat: n.hat, scene: 'town', at: [d[0] - 1, d[1]], roam: 3, barks: npcBarks(n) });
      } else if (n.via && n.via.type === 'gold') {
        const i = out.filter((p) => p.kind === 'wand').length;
        out.push({ id: 'n:' + n.id, kind: 'wand', npc: n.id, name: n.name, look: n.look, garb: n.garb, hat: n.hat, scene: 'town', at: [[18, 14], [25, 14], [20, 16], [23, 12]][i % 4], roam: 2, barks: npcBarks(n) });
      }
    });
    if (G.traderHere && G.traderHere(s, t)) {
      const L = G.randomLook(rng('trader')); L.sex = 'm'; L.beard = 'bushy';
      out.push({ id: 'trader', kind: 'trader', name: 'The trader', look: L, garb: 'oilskin', hat: 'tricorn', scene: 'town', at: [27, 14], dir: 'left', still: true, barks: ['I buy what people need and sell what they forgot they wanted.', 'Coin changes hands. I make sure it changes mine first.', 'No, I don’t know where the trader goes on Tuesdays.', 'A fair price is one we both agree to. Eventually.'] });
    }
    return out;
  }

  // What stands on each lot right now: a building, an empty plot with a sign, or a cottage.
  function townLots(s) {
    homesNorm(s);
    const out = [];
    Object.keys(LOTS).forEach((k) => {
      const L = LOTS[k], own = !!(s.town && s.town.own && s.town.own[k]);
      out.push({ id: own ? 'b:' + k : 'lot:' + k, k: k, x: L.x, y: L.y, w: L.w, h: L.h, f: own ? L.f : null, door: door(L), built: own, name: G.TOWN[k].name, icon: G.TOWN[k].icon });
    });
    const byPlot = {};
    Object.keys(s.homes || {}).forEach((id) => { byPlot[s.homes[id].plot] = id; });
    PLOTS.forEach((P, i) => {
      const id = byPlot[i], h = id ? s.homes[id] : null, n = id ? (s.npcs || []).find((x) => x.id === id) : null;
      out.push({ id: h && h.built ? 'home:' + id : 'plot:' + i, plot: i, npc: id || null, x: P.x, y: P.y, w: P.w, h: P.h, f: h && h.built ? 'home.' + (i % 6) : null, door: door(P), built: !!(h && h.built), name: n ? n.name + '’s ' + (h && h.built ? 'house' : 'plot') : 'An empty plot', taken: !!id });
    });
    return out;
  }

  // ---------------------------------------------------------------- what people say
  // Hints, in the order they matter. Each: { key, pages }. Townsfolk hand them out, one each, and fall back on small talk.
  function townHints(s, t) {
    t = t || G.today();
    const out = [], add = (key, pages) => out.push({ key: key, pages: pages });
    // buildings waiting on their builders
    Object.keys(G.TOWN).forEach((k) => { const st = G.townState(s, k); if (st.own && st.ready) add('pay:' + k, ['The builders at the ' + lc(G.TOWN[k].name) + ' are leaning on their shovels.', 'You met the challenge. Pay them ◈ ' + st.pay + ' and the reward is yours for good.']); });
    // the dungeon ahead
    const d = s.delve;
    if (d && G.dungeonFor) {
      const D = G.dungeonFor(d.seed, d.n), B = D.boss;
      const how = { adds: 'calls its friends in when it’s hurting. Save something for the second half.', breath: 'breathes ' + (G.ELEMENTS[B.el] ? G.ELEMENTS[B.el].n.toLowerCase() : 'something nasty') + ' every third round. Have a flask ready.', poison: 'wears you down a little every round. Hit hard and finish it quick.', enrage: 'goes mad once it’s hurt. Keep your guard up at the end.' }[B.mech];
      if (how) add('boss:' + d.n, ['My cousin went into ' + theName(D.name) + '. Came back pale.', 'Said the thing at the bottom, ' + B.name + ', ' + how]);
    }
    // the next stranger on the road
    const W = (G.WANDERERS || []).find((w) => w[1] > (s.level | 0) && !(s.npcs || []).some((n) => n.id === 'w-' + w[0]));
    if (W) add('wand:' + W[0], ['A ' + lc(W[3]) + ' came through asking after you.', 'Said they’d be back when you’re level ' + W[1] + '. ' + W[8]]);
    (s.npcs || []).filter((n) => n.kind === 'human' && n.status === 'waiting' && n.via && n.via.type === 'gold').forEach((n) => add('look:' + n.id, ['There’s someone in the square looking for work. ' + n.name + ', I think.', 'Worth a word, if you’ve the coin.']));
    // buildings to buy
    const sale = Object.keys(G.TOWN).filter((k) => !(s.town && s.town.own && s.town.own[k]));
    const can = sale.find((k) => G.townState(s, k).ok), next = sale.slice().sort((a, b) => G.TOWN[a].lvl - G.TOWN[b].lvl)[0];
    if (can) add('buy:' + can, ['They’re selling the plot for the ' + lc(G.TOWN[can].name) + ' for ◈ ' + G.TOWN[can].cost + '.', 'You’ve the coin. While it’s open: ' + lc(G.townState(s, can).active) + '.']);
    else if (next) add('lvl:' + next, ['They say a ' + lc(G.TOWN[next].name) + ' goes up on the empty lot once you’re level ' + G.TOWN[next].lvl + '.', 'It’ll want ◈ ' + G.TOWN[next].cost + ' when it does.']);
    // companions without a roof, or wanting something
    Object.keys(s.homes || {}).forEach((id) => {
      const h = s.homes[id], n = (s.npcs || []).find((x) => x.id === id); if (!n) return;
      if (!h.built) add('roof:' + id, [n.name + ' is sleeping rough on their plot on ' + streetOf(PLOTS[h.plot].y + 5) + '.', 'A cottage there costs ◈ ' + homeCost(s) + '. Have a word with them.']);
      else if (!h.settled) { const w = homeWants(s, id).find((x) => !x.ok); if (w) add('want:' + id, [n.name + ' was telling me what they want for their place.', lc(w.text) + '. Their words.']); }
    });
    // the open challenges, how they count
    Object.keys(G.TOWN).forEach((k) => { const st = G.townState(s, k); if (st.on && !st.max && !st.ready && METER_TIP[G.TOWN[k].meter]) add('tip:' + k, ['The ' + lc(G.TOWN[k].name) + ' wants you to ' + lc(st.ask) + '. You’re at ' + st.prog + ' of ' + st.goal + '.', METER_TIP[G.TOWN[k].meter]]); });
    // the trader
    if (G.traderHere && G.traderHere(s, t)) add('trader', ['The trader’s set up by the market today.', 'He pays thirty per cent over the odds for anything you sell while he’s here.']);
    else add('trader-how', ['The trader only calls on a busy house.', 'Deeds on four of the last seven days, they say, and he turns up about two days in five.']);
    return out;
  }
  // How much a drink costs the town gossip, who knows what the next dungeon can't stand
  const gossipPrice = (s) => 10 + 2 * ((s.delve && s.delve.n) | 0);
  function gossipFor(s) {
    const d = s.delve; if (!d || !G.dungeonFor) return null;
    const k = d.known && d.known[d.n];
    if (k && (k.lore || k.boss)) return null;
    return { name: G.dungeonFor(d.seed, d.n).name, price: gossipPrice(s) };
  }
  function townGossip(s) {
    const g = gossipFor(s); if (!g) return { err: 'Nothing new to tell' };
    if (s.gold < g.price) return { err: 'Need ' + (g.price - s.gold) + ' more gold' };
    s.gold -= g.price;
    const d = s.delve; d.known = d.known || {}; const k = d.known[d.n] = d.known[d.n] || {}; k.lore = true;
    const D = G.dungeonFor(d.seed, d.n);
    return { price: g.price, el: D.weak, name: D.name };
  }

  const say = (name, pages, choices, o) => Object.assign({ name: name, pages: pages.filter(Boolean), choices: choices || [['Goodbye', 'bye']] }, o || {});
  // o.heard: hint keys already given this visit (so people move on to small talk)
  // 2.27: the Oracle's fresh lines for the day (oracle.js), about half the time; the written ones otherwise
  function fresh(s, key, seed) {
    if (!G.barkFor) return null;
    const r = rng(seed + '|fresh')();
    return r < 0.55 ? G.barkFor(s, key, Math.floor(r * 1000)) : null;
  }
  function townTalk(s, id, t, o) {
    t = t || G.today(); o = o || {};
    const heard = o.heard || {}, day = dayNum(t);
    const ppl = o.people || townPeople(s, t);
    const P = ppl.find((p) => p.id === id);
    // an empty lot in town
    if (id.indexOf('lot:') === 0) {
      const k = id.slice(4), D = G.TOWN[k], st = G.townState(s, k);
      if (!D) return null;
      const why = st.why ? st.why + '.' : 'Yours for ◈ ' + D.cost + '.';
      return say('Signpost', ['“Reserved for a ' + D.name.toUpperCase() + '. Apply to the council.”', 'While it’s open: ' + lc(st.active) + '. Meet its challenges and the rewards are yours for good.', why],
        st.ok ? [['Buy it · ◈ ' + D.cost, 'buy:' + k], ['Leave it', 'bye']] : [['Leave it', 'bye']], { sign: true });
    }
    if (id.indexOf('plot:') === 0) {
      const i = +id.slice(5), lot = townLots(s).find((l) => l.plot === i);
      if (lot && lot.npc) return townTalk(s, 'n:' + lot.npc, t, o);
      return say('Signpost', ['“Plot ' + (i + 1) + ', ' + streetOf(PLOTS[i].y + 5) + '. To let.”', 'When someone comes to live with you, a plot like this is theirs to build on.'], null, { sign: true });
    }
    if (id === 'gate') return say('Signpost', ['“HOME ↓”', 'The road back to your own front door.'], [['Go home', 'home'], ['Stay a while', 'bye']], { sign: true });
    if (!P) return null;
    if (o.inside) { const d = townTalk(s, id, t, Object.assign({}, o, { inside: false })); if (d) d.choices = d.choices.filter((c) => c[1].indexOf('visit:') !== 0); return d; }
    // the keepers
    if (P.kind === 'keeper') {
      const k = P.k, D = G.TOWN[k], st = G.townState(s, k), K = KEEPERS[k], b = fresh(s, 'k:' + k, id + t + (o.n | 0)) || pick(K.barks, rng(id + t + (o.n | 0)));
      if (st.ready) return say(K.name, [K.hello, 'You did it. ' + uc(lc(D.ask(st.goal))) + ': done.', 'The builders want ◈ ' + st.pay + ' to sign it off. Then ' + lc(st.reward) + ' is yours for good.'],
        [['Pay them · ◈ ' + st.pay, 'pay:' + k], ['Show me the ladder', 'card:' + k], ['Later', 'bye']]);
      if (!st.on) {
        const full = s.town.on.length >= G.townSlots(s);
        return say(K.name, [b, 'We’re shut for now. ' + (st.max ? 'You’ve had everything I can give, but open us and ' + lc(st.active) + '.' : 'Open us up and the next challenge starts counting: ' + lc(st.ask) + '.'),
          full ? 'You’ve got ' + G.townSlots(s) + ' buildings open already. Close one first.' : null], full ? [['Show me the ladder', 'card:' + k], ['Goodbye', 'bye']] : [['Open up', 'open:' + k], ['Show me the ladder', 'card:' + k], ['Not now', 'bye']]);
      }
      if (st.max) return say(K.name, [b, 'Every challenge here is met. ' + st.earned.join(', ') + '.', 'While we’re open: ' + lc(st.active) + '.'], [['Close up', 'close:' + k], ['Goodbye', 'bye']]);
      return say(K.name, [heard['k:' + k] ? b : K.hello, 'Challenge ' + (st.tier + 1) + ' of ' + G.TOWN_TIERS + ': ' + lc(st.ask) + '. You’re at ' + st.prog + ' of ' + st.goal + '.', METER_TIP[D.meter] || null, 'Meet it and ' + lc(st.reward) + ' is yours for good.'],
        [['Show me the ladder', 'card:' + k], ['Close up', 'close:' + k], ['Goodbye', 'bye']], { hint: 'k:' + k });
    }
    if (P.kind === 'trader') return say('The trader', ['Fine wares! Finer prices! Well. Prices.', 'I’ll pay thirty per cent over the odds for anything you sell today. Bring me your spares.'], [['Show me', 'trader'], ['Goodbye', 'bye']]);
    // companions and the ones looking for work
    if (P.kind === 'comp' || P.kind === 'wand') {
      const n = (s.npcs || []).find((x) => x.id === P.npc); if (!n) return null;
      const W = String(n.id).indexOf('w-') === 0 ? (G.WANDERERS || []).find((w) => 'w-' + w[0] === n.id) : null;
      if (P.kind === 'wand') {
        const want = homeWants(s, n.id).map((w) => lc(w.text));
        return say(n.name, [W ? W[8] : (n.about || 'Looking for work.'), 'I’m ' + n.name + (W ? ', a ' + lc(W[3]) : '') + '. I’d come delving with you, for ◈ ' + n.via.gold + ' and a roof of my own.',
          'You’d build me a cottage on one of the plots down Hearth Row' + (want.length ? ', and in time I’d want ' + want.join(' and ') + '.' : '.')],
          [['Take them on · ◈ ' + n.via.gold, 'invite:' + n.id], ['Not now', 'bye']]);
      }
      const h = homeOf(s, n.id), C = n.comp && G.CALLINGS[n.comp];
      if (h && !h.built) return say(n.name, ['I’ve got plot ' + (h.plot + 1) + ' on ' + streetOf(PLOTS[h.plot].y + 5) + '. Nothing on it but weeds and a sign.', 'Put a roof over my head? ◈ ' + homeCost(s) + ' gets a cottage: a bedroom, a bed and a door.'],
        [['Build it · ◈ ' + homeCost(s), 'home:' + n.id], ['Later', 'bye']]);
      const bark = fresh(s, 'n:' + n.id, id + t + (o.n | 0)) || pick((C ? CALLING_BARKS[n.comp] : []).concat(HOME_BARKS, n.about ? [n.about] : []), rng(id + t + (o.n | 0)));
      if (h && !h.settled) {
        const w = homeWants(s, n.id), left = w.filter((x) => !x.ok);
        return say(n.name, [heard[id] ? bark : 'Home’s coming along.', left.length ? 'What I’d really like is ' + lc(left[0].text) + '.' : 'It’s got everything I asked for.', w.length - left.length + ' of ' + w.length + ' done. Once it’s all there I’ll settle in: ' + SETTLED_TEXT + '.'],
          [['Go inside', 'visit:' + n.id], ['Goodbye', 'bye']], { hint: id });
      }
      return say(n.name, [bark], [['Go inside', 'visit:' + n.id], ['Goodbye', 'bye']]);
    }
    // townsfolk: the first one most days knows a thing or two about the next dungeon; the rest pass on what they've heard
    if (P.kind === 'folk') {
      const i = +id.slice(2), g = i === day % 3 ? gossipFor(s) : null;
      if (g && !heard['gossip']) return say(P.name, ['Psst. Over here.', 'I hear things about ' + theName(g.name) + '. What it can’t stand, for one. A drink loosens the memory.'], [['Buy them a drink · ◈ ' + g.price, 'gossip'], ['No thanks', 'bye']], { hint: 'gossip' });
      const hints = townHints(s, t).filter((h) => !heard[h.key]);
      if (hints.length && !heard[id]) { const h = hints[(i + day) % hints.length]; return say(P.name, h.pages, null, { hint: h.key, also: id }); }
      return say(P.name, [fresh(s, 'folk', id + t + (o.n | 0)) || pick(FOLK_BARKS, rng(id + t + (o.n | 0)))]);
    }
    return null;
  }

  Object.assign(G, {
    TMAP: { w: TW, h: TH, gate: GATE, spawn: SPAWN, lots: LOTS, plots: PLOTS, streets: STREETS, props: PROPS, inside: INSIDE, inW: IN_W, inH: IN_H, exit: EXIT },
    KEEPERS, townGround, townLots, townPeople, townTalk, townHints, townGossip, gossipFor, npcBarks,
    homesNorm, homeOf, homeCost, homeBuild, homeFresh, homeWants, homeSettle, homeSettled, homeProxy, homeEstate3D, streetOf,
  });
})(typeof window !== 'undefined' ? window : globalThis);
