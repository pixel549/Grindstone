/* Grindstone — game rules.
 * complete() / canComplete() / dueOn() / need() are mirrored in Game.java so the
 * home-screen widget can tick quests off without opening the app. Keep them in sync. */
(function (root) {
  'use strict';

  const STATS = ['STR', 'END', 'VIT', 'DIS', 'INT'];
  const STAT_INFO = {
    STR: { name: 'Strength', short: 'STR', blurb: 'Weights, lifting, building' },
    END: { name: 'Endurance', short: 'END', blurb: 'Cardio, yard work, scrubbing' },
    VIT: { name: 'Vitality', short: 'VIT', blurb: 'Food, water, recovery' },
    DIS: { name: 'Discipline', short: 'DIS', blurb: 'Routines, tidying, self-control' },
    INT: { name: 'Intellect', short: 'INT', blurb: 'Study, admin, planning' },
  };
  const TRAINING = { STR: true, END: true };
  const DIFF = [
    // 2.22: gold doubled (was 3, 6, 12, 20, 35) so deeds, not dungeons, are where most of his gold comes from
    { name: 'Trivial', xp: 5, gold: 6 },
    { name: 'Easy', xp: 10, gold: 12 },
    { name: 'Medium', xp: 20, gold: 24 },
    { name: 'Hard', xp: 35, gold: 40 },
    { name: 'Epic', xp: 60, gold: 70 },
  ];
  const TYPES = ['daily', 'habit', 'todo'];
  const LOG_MAX = 300;

  const need = (L) => 80 + 36 * (L - 1);   // 2.23: 36 (was 40), so an ordinary year of granular deeds reaches level 50
  const statVal = (xp) => 10 + Math.floor(Math.sqrt((xp || 0) / 5));
  const statNextAt = (xp) => { const b = statVal(xp) - 10 + 1; return 5 * b * b; };
  const statPrevAt = (xp) => { const b = statVal(xp) - 10; return 5 * b * b; };

  // ---------- dates (local time, YYYY-MM-DD) ----------
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const fmt = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (ds) => { const p = ds.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const today = (now) => fmt(now || new Date());
  const addDays = (ds, n) => { const d = parse(ds); return fmt(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
  const dayIdx = (ds) => (parse(ds).getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  const daysBetween = (a, b) => {
    const x = a.split('-').map(Number), y = b.split('-').map(Number);
    return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 86400000);
  };

  // ---------- quests ----------
  const clampDiff = (d) => Math.max(1, Math.min(5, d | 0 || 2));
  const findQ = (s, id) => s.quests.find((q) => q.id === id);
  const habitCount = (q, t) => (q.countOn === t ? q.count | 0 : 0);

  function dueOn(q, t) {
    // 2.16: a daily can come round every few days instead (fresh bird food every third day): once done, it's off the
    // list until that many days have passed
    if (q.type === 'daily' && q.rest > 1 && q.doneOn) { const n = daysBetween(q.doneOn, t); if (n > 0 && n < q.rest) return false; }
    if (!q.days || q.days.length !== 7) return true;
    return !!q.days[dayIdx(t)];
  }

  // A habit that comes round every N days: how many days until it's back (0: it's there to do).
  function restLeft(q, t) {
    if (!q || q.type !== 'habit' || !(q.rest > 1) || !q.countOn || q.countOn === t || !(q.count > 0)) return 0;
    return Math.max(0, q.rest - daysBetween(q.countOn, t));
  }
  function canComplete(q, t) {
    if (!q || q.archived) return false;
    if (restLeft(q, t) > 0) return false;
    if (q.type === 'habit') return !(q.cap > 0) || habitCount(q, t) < q.cap;
    if (q.type === 'todo') return !q.doneOn;
    return q.doneOn !== t;
  }

  // opts.min: the bare-minimum version (2.8). Half the XP and gold, rounded up; counts in full for streaks, upkeep and callings.
  function complete(s, id, t, now, opts) {
    const q = findQ(s, id);
    if (!canComplete(q, t)) return null;
    if (q.type === 'habit') {
      if (q.countOn !== t) { q.count = 0; q.countOn = t; }
      q.count += 1;
    } else {
      q.doneOn = t;
    }
    if (isAway(q, t)) { if (q.away.why === 'hold') holdLogSet(s, q, q.away.from, t); q.away.back = t; }   // 2.27: done, so it's back
    const d0 = DIFF[clampDiff(q.diff) - 1], mn = !!(opts && opts.min);
    const d1 = mn ? { xp: Math.ceil(d0.xp / 2), gold: Math.ceil(d0.gold / 2) } : d0;
    // 2.13 the town: an open building makes its stat grow faster, and the counting house adds to the gold
    const tp = s.town ? townPerks(s) : null, grow = tp && tp.grow[q.stat] ? Math.max(1, Math.round(d1.xp * tp.grow[q.stat])) : 0;
    const d = { xp: d1.xp, gold: tp && tp.deedGold ? Math.round(d1.gold * (1 + tp.deedGold / 100)) : d1.gold };
    s.xp += d.xp;
    s.gold += d.gold;
    s.stats[q.stat] = (s.stats[q.stat] || 0) + d.xp + grow;
    townNote(s, 'd' + q.stat, 1);
    s.wind = Math.min(WIND_MAX, (s.wind | 0) + 1);   // 2.17
    s.total += 1;
    if (TRAINING[q.stat]) s.lastTraining = t;
    if (s.lastActive !== t) {
      s.streak = s.lastActive === addDays(t, -1) ? s.streak + 1 : 1;
      s.lastActive = t;
    }
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    let levels = 0;
    while (s.xp >= need(s.level)) { s.xp -= need(s.level); s.level += 1; s.chests += 1; levels += 1; }
    const le = { t: now, d: t, q: q.id, n: q.name, i: q.icon, x: d.xp, g: d.gold, s: q.stat, k: Number(now).toString(36) + Math.random().toString(36).slice(2, 7) };
    if (mn) le.m = 1;
    if (grow) le.b = grow;
    s.log.unshift(le);
    if (s.log.length > LOG_MAX) s.log.length = LOG_MAX;
    dayNote(s, t, q, d.xp, d.gold, 1);
    return { xp: d.xp, gold: d.gold, stat: q.stat, levels: levels, level: s.level, min: mn, grow: grow };
  }

  // 2.25: deeds the phone logs while the app is shut (the calendar herald, the widget, the evening note) are done by
  // Game.java, which can't see the town or the days. It marks them nat: 1; here they get what complete() would have
  // given: the counting house's cut, the town's growth, the town's tally, the wind, and their day in s.days.
  function settleNative(s, noDays) {
    if (!Array.isArray(s.log) || !Array.isArray(s.quests)) return 0;
    let n = 0;
    s.log.slice().reverse().forEach((e) => {
      if (!e || !e.nat) return;
      delete e.nat; n++;
      const q = findQ(s, e.q);
      if (!q) return;
      if (e.d && isAway(q, e.d) && e.d >= q.away.from) { if (q.away.why === 'hold') holdLogSet(s, q, q.away.from, e.d); q.away.back = e.d; }   // 2.27: done from the phone, so it's back
      const d0 = DIFF[clampDiff(q.diff) - 1], tp = s.town ? townPerks(s) : null;
      const gold = tp && tp.deedGold ? Math.round(d0.gold * (1 + tp.deedGold / 100)) : d0.gold;
      const grow = tp && tp.grow && tp.grow[q.stat] ? Math.max(1, Math.round((e.x | 0) * tp.grow[q.stat])) : 0;
      if (gold !== (e.g | 0)) { s.gold = Math.max(0, (s.gold | 0) + gold - (e.g | 0)); e.g = gold; }
      if (grow) { s.stats[q.stat] = (s.stats[q.stat] || 0) + grow; e.b = grow; }
      townNote(s, 'd' + q.stat, 1);
      s.wind = Math.min(WIND_MAX, (s.wind | 0) + 1);
      if (!noDays) dayNote(s, e.d, q, e.x | 0, e.g | 0, 1);
    });
    return n;
  }

  // 2.23: the log keeps only the newest 300 entries (under a fortnight at Jake's pace), so every day is also kept in brief,
  // for good: s.days[day] = [deeds, xp, gold, STR, END, VIT, DIS, INT], and s.qlast[quest] = the last day it was done.
  // About 30 KB a year. Anything that looks back further than the log reaches uses these.
  function dayNote(s, t, q, xp, gold, sign) {
    if (!s.days || typeof s.days !== 'object') s.days = {};
    const r = s.days[t] || (s.days[t] = [0, 0, 0, 0, 0, 0, 0, 0]), i = STATS.indexOf(q.stat);
    r[0] = Math.max(0, r[0] + sign); r[1] = Math.max(0, r[1] + sign * xp); r[2] = Math.max(0, r[2] + sign * gold); if (i >= 0) r[3 + i] = Math.max(0, r[3 + i] + sign);
    if (!s.qlast || typeof s.qlast !== 'object') s.qlast = {};
    if (sign > 0) { if (!s.qlast[q.id] || s.qlast[q.id] < t) s.qlast[q.id] = t; }
    // 2.25: and each quest's last dozen days, for how often he really does it (the reminders' suggestion)
    if (!s.qhist || typeof s.qhist !== 'object') s.qhist = {};
    if (sign > 0 && q.id != null) { const h = s.qhist[q.id] || (s.qhist[q.id] = []); if (h.indexOf(t) < 0) { h.push(t); h.sort(); if (h.length > QHIST_MAX) h.splice(0, h.length - QHIST_MAX); } }
  }
  const QHIST_MAX = 42;   // 2.27: six weeks of a daily (the long-day rule); suggestions still read the last dozen
  // App-only: reverse today's most recent completion of a quest.
  function undo(s, id, t) {
    const idx = s.log.findIndex((e) => e.q === id && e.d === t);
    if (idx < 0) return false;
    const e = s.log[idx];
    const wasSeen = !!s.homeTally && (s.seen || []).indexOf(sig(e)) >= 0;
    if (s.goals) unsyncGoal(s, e);
    s.log.splice(idx, 1);
    if (wasSeen) s.seen = s.seen.filter((x) => x !== sig(e));
    const q = findQ(s, id);
    if (q) {
      if (q.type === 'habit') { if (q.countOn === t) q.count = Math.max(0, q.count - 1); } else q.doneOn = null;
      if (q.home && wasSeen && s.homeTally.counts[q.home]) s.homeTally.counts[q.home] -= 1;
    }
    if (wasSeen) {
      const c = s.homeTally.counts;
      if (c._all) c._all -= 1;
      if (TRAINING[e.s] && c._train) c._train -= 1;
      if (e.s === 'INT' && c._study) c._study -= 1;
    }
    s.gold = Math.max(0, s.gold - e.g);
    if (s.days && s.days[t]) dayNote(s, t, { id: id, stat: e.s }, e.x, e.g, -1);
    if (s.qlast && s.qlast[id] === t && !s.log.some((x) => x.q === id && x.d === t)) { const prev = s.log.find((x) => x.q === id); if (prev) s.qlast[id] = prev.d; else delete s.qlast[id]; }
    if (s.qhist && s.qhist[id] && !s.log.some((x) => x.q === id && x.d === t)) s.qhist[id] = s.qhist[id].filter((d) => d !== t);
    s.wind = Math.max(0, (s.wind | 0) - 1);
    if (s.town) { s.town.cnt.earned = Math.max(0, s.town.cnt.earned - e.g); s.town.goldSeen = Math.min(s.town.goldSeen, s.gold); townNote(s, 'd' + e.s, -1); }
    s.stats[e.s] = Math.max(0, (s.stats[e.s] || 0) - e.x - (e.b | 0));
    s.total = Math.max(0, s.total - 1);
    s.xp -= e.x;
    while (s.xp < 0 && s.level > 1) { s.level -= 1; s.xp += need(s.level); if (s.chests > 0) s.chests -= 1; }
    if (s.xp < 0) s.xp = 0;
    if (!s.log.some((x) => x.q != null && x.d === t)) {
      s.streak = Math.max(0, s.streak - 1);
      s.lastActive = s.streak > 0 ? addDays(t, -1) : null;
    }
    if (TRAINING[e.s] && s.lastTraining === t && !s.log.some((x) => x.d === t && TRAINING[x.s] && x.q != null)) {
      const prev = s.log.find((x) => x.q != null && TRAINING[x.s]);
      s.lastTraining = prev ? prev.d : null;
    }
    return true;
  }

  const shownStreak = (s, t) => (s.lastActive === t || s.lastActive === addDays(t, -1) ? s.streak : 0);

  // ---------- hero ----------
  const RANKS = [[1, 'Fledgling'], [5, 'Seasoned'], [10, 'Veteran'], [20, 'Elite'], [30, 'Master'], [45, 'Mythic']];
  const CLASSES = { STR: 'Bruiser', END: 'Wayfarer', VIT: 'Herbalist', DIS: 'Warden', INT: 'Scholar' };
  function title(s) {
    let rank = RANKS[0][1];
    RANKS.forEach((r) => { if (s.level >= r[0]) rank = r[1]; });
    let top = null;
    STATS.forEach((k) => { if ((s.stats[k] || 0) > 0 && (!top || s.stats[k] > s.stats[top])) top = k; });
    return rank + ' ' + (top ? CLASSES[top] : 'Wanderer');
  }
  function lifetimeXp(s) { let x = s.xp; for (let L = 1; L < s.level; L++) x += need(L); return x; }

  // ---------- gear ----------
  // 2.11: an off hand, gloves and boots. The three new ones are minor slots: half the stat bonus of the old four.
  const SLOTS = ['weapon', 'off', 'head', 'body', 'hands', 'feet', 'charm'];
  const MINOR = { off: true, hands: true, feet: true };
  const SLOT_NAME = { weapon: 'Weapon', off: 'Off hand', head: 'Head', body: 'Body', hands: 'Hands', feet: 'Feet', charm: 'Charm' };
  const RARITY = [
    { k: 'common', n: 'Common', c: '#a8a294', w: 55, m: 1 },
    { k: 'uncommon', n: 'Uncommon', c: '#90b868', w: 28, m: 2 },
    { k: 'rare', n: 'Rare', c: '#699adb', w: 12, m: 3 },
    { k: 'epic', n: 'Epic', c: '#b07fe0', w: 4.2, m: 4 },
    { k: 'legendary', n: 'Legendary', c: '#f2bd45', w: 0.8, m: 6 },
  ];
  const BASES = {
    weapon: [
      ['Longsword', 'blade', 'STR'], ['Greatsword', 'blade', 'STR'], ['Rapier', 'blade', 'END'], ['Sabre', 'blade', 'END'],
      ['Dirk', 'blade', 'INT'], ['Hatchet', 'axe', 'DIS'], ['Bearded Axe', 'axe', 'STR'], ['Warhammer', 'blunt', 'STR'],
      ['Mace', 'blunt', 'VIT'], ['Cudgel', 'blunt', 'DIS'], ['Glaive', 'polearm', 'END'], ['Halberd', 'polearm', 'DIS'],
      ['Harpoon', 'polearm', 'END'], ['Boathook', 'polearm', 'VIT'], ['Lantern Staff', 'staff', 'INT'], ['Driftwood Staff', 'staff', 'VIT'],
    ],
    head: [
      ['Hood', 'hood', 'END'], ['Cowl', 'hood', 'INT'], ['Tricorn', 'hat', 'DIS'], ['Wide-brim Hat', 'hat', 'END'],
      ['Helm', 'helm', 'STR'], ['Bascinet', 'helm', 'VIT'], ['Circlet', 'crown', 'INT'], ['Crown', 'crown', 'DIS'], ['Half-mask', 'mask', 'VIT'],
    ],
    body: [
      ['Greatcoat', 'coat', 'END'], ['Oilskin', 'coat', 'VIT'], ['Duster', 'coat', 'DIS'], ['Hauberk', 'armour', 'STR'],
      ['Cuirass', 'armour', 'STR'], ['Brigandine', 'armour', 'VIT'], ['Robes', 'robe', 'INT'], ['Vestments', 'robe', 'DIS'], ['Gambeson', 'light', 'END'],
    ],
    off: [['Buckler', 'shield', 'VIT'], ['Kite Shield', 'shield', 'END'], ['Tower Shield', 'shield', 'STR'], ['Storm Lantern', 'lamp', 'INT'], ['Tome', 'book', 'INT'], ['Parrying Dagger', 'blade', 'DIS']],
    hands: [['Gauntlets', 'glove', 'STR'], ['Leather Gloves', 'glove', 'END'], ['Hand Wraps', 'glove', 'DIS'], ['Bracers', 'glove', 'VIT'], ['Scribe’s Mitts', 'glove', 'INT']],
    feet: [['Greaves', 'boot', 'VIT'], ['Sea Boots', 'boot', 'END'], ['Riding Boots', 'boot', 'STR'], ['Sandals', 'boot', 'DIS'], ['Soft Shoes', 'boot', 'INT']],
    charm: [
      ['Signet Ring', 'pendant', 'STR'], ['Locket', 'pendant', 'VIT'], ['Talisman', 'pendant', 'INT'], ['Rosary', 'pendant', 'DIS'],
      ['Compass', 'pendant', 'END'], ['Phial', 'phial', 'VIT'], ['Pocket Watch', 'pendant', 'DIS'], ['Shark-tooth Charm', 'pendant', 'STR'],
    ],
  };
  const PREFIX = [
    ['Worn', 'Patched', 'Dented', 'Rusted', 'Plain'],
    ['Sturdy', 'Tempered', 'Oiled', 'Well-made', 'Fine'],
    ['Gilded', 'Salt-etched', 'Moonlit', 'Blackened', 'Runed'],
    ['Hallowed', 'Ashen', 'Abyssal', 'Tidebound', 'Wailing'],
    ['Eldritch', 'Sovereign', 'Starborn', 'Unbroken', "Drowned King's"],
  ];
  const SUFFIX = {
    STR: ['of the Ox', 'of Iron', 'of Might'],
    END: ['of the Tide', 'of the Long Road', 'of Breath'],
    VIT: ['of the Hearth', 'of Plenty', 'of Mending'],
    DIS: ['of the Steward', 'of Order', 'of the Vigil'],
    INT: ['of the Scholar', 'of Lore', 'of the Lantern'],
  };

  const nextId = (s) => (s.seq = (s.seq | 0) + 1);
  const ELEMS = ['fire', 'frost', 'storm', 'rot', 'holy'];
  const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];

  // 2.22: legendaries (the gold ones) wait for the level they're made at: none before 15, then their weight climbs to the full
  // 0.8 by level 30 and on to 1.2. Jake had 27 of them at level 8, from chests whose floor had reached legendary itself.
  const legWeight = (lvl) => RARITY[4].w * Math.max(0, Math.min(1.5, ((lvl || 1) - 14) / 16));
  function rollItem(s, floorTier, rnd, legW) {
    rnd = rnd || Math.random;
    floorTier = Math.min(3, floorTier | 0);   // nothing is ever guaranteed legendary
    const lw = legW != null ? legW : legWeight(s && s.level);
    const pool = RARITY.slice(floorTier).map((r, i) => (floorTier + i === 4 ? Object.assign({}, r, { w: lw }) : r));
    let x = rnd() * pool.reduce((a, r) => a + r.w, 0);
    let tier = lw > 0 ? RARITY.length - 1 : RARITY.length - 2;
    for (let i = 0; i < pool.length; i++) { x -= pool[i].w; if (x < 0) { tier = floorTier + i; break; } }
    const slot = pick(SLOTS, rnd);
    const b = pick(BASES[slot], rnd);
    const prim = rnd() < 0.6 ? b[2] : pick(STATS, rnd);
    const scale = 1 + Math.floor(s.level / GEAR_TUNE.per);
    const bonus = {};
    if (!MINOR[slot]) bonus[prim] = RARITY[tier].m * scale;
    if (tier >= 2 && !MINOR[slot]) bonus[pick(STATS.filter((k) => k !== prim), rnd)] = Math.ceil(bonus[prim] / 2);
    const name = pick(PREFIX[tier], rnd) + ' ' + b[0] + ' ' + pick(SUFFIX[prim], rnd);
    const it = { id: nextId(s), slot: slot, base: b[0], art: b[1], name: name, tier: tier, bonus: bonus, lvl: s.level };
    if (MINOR[slot]) it.amt = tier + 1;   // minor slots carry one small effect of their own, not stat points (see minorText)
    // Elements for the delve: weapons can carry one, armour and charms can resist one. Likelier the rarer it is.
    if (rnd() < [0.1, 0.2, 0.35, 0.55, 0.75][tier]) { const e = pick(ELEMS, rnd); if (slot === 'weapon') it.el = e; else if (!MINOR[slot]) it.res = e; }
    fxRoll(it, rnd);
    return it;
  }

  // 2.9: an effect on the better pieces, so a drop is about more than its numbers. Rare and up always carry one; uncommon
  // sometimes. One per piece; they all act in the delve (heroFrom and the fight in delve.js read `it.fx`).
  const GEAR_FX = {
    weapon: { opener: ['Opener', 'The first blow of every fight lands for 60% more'], slayer: ['Bossbane', '20% more damage to bosses'], reaper: ['Cornered', '25% more damage while he is below half health'], packs: ['Crowd-work', '20% more damage while more than one foe stands'] },
    head: { keen: ['Quick-eyed', '5% more chance to dodge'], wise: ['Clear-headed', 'A fifth more MP'], scout: ['Wary', 'Better at spotting traps and hidden things'] },
    body: { bulwark: ['Braced', 'The first hit of every fight does half'], thick: ['Thick', '10% less damage taken'], hale: ['Hale', 'A tenth more health'] },
    off: { bulwark: ['Braced', 'The first hit of every fight does half'], scout: ['Wary', 'Better at spotting traps and hidden things'], thick: ['Thick', '10% less damage taken'] },
    hands: { opener: ['Opener', 'The first blow of every fight lands for 60% more'], reaper: ['Cornered', '25% more damage while he is below half health'] },
    feet: { keen: ['Quick-eyed', '5% more chance to dodge'], hale: ['Hale', 'A tenth more health'] },
    charm: { flask: ['Brimming', 'One more flask'], lucky: ['Lucky', '15% more gold from a clear'], tonic: ['Potent', 'Flasks heal half his health, not two-fifths'] },
  };
  const fxOf = (it) => (it && it.fx && GEAR_FX[it.slot] && GEAR_FX[it.slot][it.fx] ? GEAR_FX[it.slot][it.fx] : null);
  function fxRoll(it, rnd) { const ks = Object.keys(GEAR_FX[it.slot] || {}); if (ks.length && (MINOR[it.slot] ? it.tier >= 3 : it.tier >= 2 || (it.tier === 1 && rnd() < 0.25))) it.fx = ks[Math.floor(rnd() * ks.length) % ks.length]; }
  // 2.8: gear grows a step every `per` levels (was 5). See delve.js TUNE for the other half of the rebalance.
  const GEAR_TUNE = { per: 20 };
  // What a minor piece does, by its kind: gloves hit harder, boots dodge, and the off hand depends on what's in it.
  // 2.20.1: [what it adds to, per tier step, unit, what it is]: "+3% dodge", "+2% damage reduction"
  const MINOR_FX = { glove: ['dmg', 2, '% damage'], boot: ['evade', 1, '% dodge'], shield: ['def', 2, ' defence'], lamp: ['sense', 1, ' to spotting traps and secrets'], book: ['mp', 5, '% MP'], blade: ['guard', 1, '% damage reduction'] };
  const minorOf = (it) => (it && it.amt && MINOR_FX[it.art] ? { k: MINOR_FX[it.art][0], v: MINOR_FX[it.art][1] * it.amt } : null);
  // v: show this amount instead (a difference, say), signed
  const minorText = (it, v) => { const m = minorOf(it); if (!m) return ''; v = v == null ? m.v : v; return (v < 0 ? '−' : '+') + Math.abs(v) + MINOR_FX[it.art][2]; };
  // a gear effect's name and what it does, by its key (the same key means the same thing in any slot)
  const fxInfo = (k) => { for (const sl in GEAR_FX) if (GEAR_FX[sl][k]) return GEAR_FX[sl][k]; return null; };
  const power = (it) => Object.keys(it.bonus || {}).reduce((a, k) => a + it.bonus[k], 0) + (it.amt | 0);
  // what a piece is worth to a trader selling it; selling one back fetches a quarter (2.22: was the full worth, which made his
  // unworn pack worth 21,000 gold, twice everything else he'd earned)
  const itemValue = (it) => 8 * RARITY[it.tier].m * RARITY[it.tier].m * (1 + Math.floor((it.lvl || 1) / 5));
  const sellValue = (it) => Math.max(2, Math.round(itemValue(it) / 3));   // 2.23: a third (2.22: a quarter); late in the year, what he won't wear pays for the town
  const itemById = (s, id) => s.inv.find((i) => i.id === id) || null;
  const equipped = (s, slot) => (s.eq[slot] != null ? itemById(s, s.eq[slot]) : null);
  function gearBonus(s, stat) {
    let n = 0;
    SLOTS.forEach((sl) => { const it = equipped(s, sl); if (it && it.bonus[stat]) n += it.bonus[stat]; });
    return n;
  }
  const gearScore = (s) => SLOTS.reduce((a, sl) => { const it = equipped(s, sl); return a + (it ? power(it) : 0); }, 0);

  // ---------- shop ----------
  const CHESTS = [
    { k: 'iron', name: 'Iron-bound Coffer', cost: 120, floor: 0, blurb: 'Any rarity. Mostly honest junk.' },
    { k: 'gilded', name: 'Gilded Coffer', cost: 450, floor: 2, blurb: 'Rare or better, sworn on the merchant’s life.' },
  ];

  // ---------- home base ----------
  // Linkable features: a quest tagged with q.home = key keeps that part of the house tidy.
  const HOME = {
    lawn: { name: 'Lawn', icon: '🌿', th: [14, 28], words: ['Trim', 'Shaggy', 'Jungle'], room: 'yard', verb: 'mowed' },
    birds: { name: 'Bird feeding', icon: '🦜', th: [1, 2], words: ['Fed & happy', 'Peckish', 'Furious'], room: 'aviary', verb: 'fed' },
    aviary: { name: 'Aviary', icon: '🧽', th: [8, 15], words: ['Spotless', 'Messy', 'Filthy'], room: 'aviary', verb: 'cleaned' },
    fridge: { name: 'Fridge', icon: '🛒', th: [8, 14], words: ['Stocked', 'Running low', 'Empty'], room: 'kitchen', verb: 'restocked' },
    dishes: { name: 'Dishes', icon: '🍽️', th: [2, 4], words: ['Clean', 'Piling up', 'Biohazard'], room: 'kitchen', verb: 'done' },
    laundry: { name: 'Laundry', icon: '🧺', th: [8, 14], words: ['Fresh', 'Overflowing', 'Mountain'], room: 'bedroom', verb: 'done' },
    reno: { name: 'Renovation', icon: '🔨', progress: true, per: 5, max: 5, room: 'living', verb: 'worked on' },
  };
  // Driven automatically by what you do, no linking needed.
  const HOME_AUTO = {
    gym: { name: 'Home gym', icon: '🏋️', th: [4, 8], words: ['Sweaty', 'Dusty', 'Cobwebbed'], room: 'gym' },
    study: { name: 'Study', icon: '📚', th: [3, 7], words: ['Studious', 'Gathering dust', 'Forgotten'], room: 'study' },
  };
  const RENO_STAGES = ['Bare plaster', 'Fresh paint', 'New rug', 'Art on the walls', 'Plants & lamps', 'Chandelier'];

  function featureLast(s, k) {
    let best = null;
    const bump = (d) => { if (d && (!best || d > best)) best = d; };
    s.quests.forEach((q) => {
      if (q.home !== k) return;
      bump(q.type === 'habit' ? (q.count > 0 ? q.countOn : null) : q.doneOn);
    });
    for (let i = 0; i < s.log.length; i++) {
      const e = s.log[i];
      if (e.q == null) continue;
      const q = findQ(s, e.q);
      if (q && q.home === k) { bump(e.d); break; } // log is newest-first
    }
    return best;
  }

  function lastStatDate(s, pred) {
    let best = null;
    for (let i = 0; i < s.log.length; i++) { const e = s.log[i]; if (e.q != null && pred(e.s)) { best = e.d; break; } }
    s.quests.forEach((q) => {
      if (!pred(q.stat)) return;
      const d = q.type === 'habit' ? (q.count > 0 ? q.countOn : null) : q.doneOn;
      if (d && (!best || d > best)) best = d;
    });
    return best;
  }

  function stateFor(def, days) { return days >= def.th[1] ? 2 : days >= def.th[0] ? 1 : 0; }
  // Albany's year: grass grows fastest in spring (the 14 days on the tin), slower in summer and autumn, slowest in winter.
  const SEASONS = ['summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter', 'winter', 'winter', 'spring', 'spring', 'spring', 'summer'];
  const seasonOf = (t) => SEASONS[+String(t).slice(5, 7) - 1] || 'spring';
  const GROWTH = { spring: 1, summer: 0.85, autumn: 0.8, winter: 0.65 };
  const lawnDays = (days, t) => Math.floor(days * GROWTH[seasonOf(t)]);

  // 2.27: what a chore's called once it's gone well past bad (twice its afflicted mark, and at least three days past it)
  const DIRE_WORD = { lawn: 'A jungle with eyes', birds: 'Plotting your death', aviary: 'A biohazard', fridge: 'Sentient', dishes: 'A new ecosystem', laundry: 'Fighting back', gym: 'Haunted', study: 'Cursed' };
  function homeState(s, t) {
    const out = {};
    const base = s.created || t;
    Object.keys(HOME).forEach((k) => {
      const def = HOME[k];
      const linked = s.quests.filter((q) => q.home === k && !q.archived);
      const last = featureLast(s, k);
      if (def.progress) {
        const n = (s.homeTally && s.homeTally.counts[k]) || 0;
        const stage = Math.min(def.max, Math.floor(n / def.per));
        out[k] = { linked: linked.length > 0, count: n, stage: stage, toNext: stage >= def.max ? 0 : (stage + 1) * def.per - n,
          recent: !!last && daysBetween(last, t) <= 1, last: last, word: RENO_STAGES[stage], state: 0 };
        return;
      }
      if (!linked.length) { out[k] = { linked: false, state: 0, days: null, word: 'Not tracked' }; return; }
      let eff = last;
      const seed = s.homeSeed[k];
      if (seed && (!eff || seed > eff)) eff = seed;
      if (!eff) eff = base;
      if (linked.every((q) => q.away)) { const b = linked.map((q) => q.away.back).sort()[0]; if (b > eff) eff = b > t ? t : b; }   // 2.27: put away, so not neglected
      // a job that only comes round every few days isn't late until it's back and waiting
      const slack = linked.every((q) => q.type === 'daily' && q.rest > 1) ? Math.min.apply(null, linked.map((q) => q.rest)) - 1 : 0;
      const days = Math.max(0, daysBetween(eff, t)), dd = k === 'lawn' ? lawnDays(days, t) : Math.max(0, days - slack);
      const st = stateFor(def, dd), dire = st === 2 && dd >= Math.max(def.th[1] * 2, def.th[1] + 3);   // 2.27: long past afflicted, it's a nightmare
      out[k] = { linked: true, state: st, days: days, last: eff, word: dire ? DIRE_WORD[k] || 'Ruined' : def.words[st], known: !!(last || seed), dire: dire };
    });
    const auto = (k, last) => {
      const def = HOME_AUTO[k];
      const eff = last || s.homeSeed[k] || base;
      const days = Math.max(0, daysBetween(eff, t));
      const st = stateFor(def, days), dire = st === 2 && days >= Math.max(def.th[1] * 2, def.th[1] + 3);
      out[k] = { linked: true, auto: true, state: st, days: days, last: eff, word: dire ? DIRE_WORD[k] || 'Ruined' : def.words[st], today: last === t, known: !!(last || s.homeSeed[k]), dire: dire };
    };
    { const b = trainQuiet(s, t); auto('gym', b && b > t ? t : laterDay(s.lastTraining, b)); }   // 2.27: a hold on training
    auto('study', lastStatDate(s, (k) => k === 'INT'));
    return out;
  }

  const sig = (e) => e.k || e.t + '|' + e.q + '|' + e.n;
  // Processes deeds not seen before (including ones ticked off on the widget): updates the
  // home tallies and vow progress, recounts this week's trials, and finds finished goals.
  function syncAll(s, t) {
    if (!Array.isArray(s.seen)) s.seen = s.log.filter((e) => e.q != null && e.t <= ((s.homeTally && s.homeTally.lastT) || 0)).map(sig);
    const seen = new Set(s.seen), c = s.homeTally.counts;
    const fresh = s.log.filter((e) => e.q != null && !seen.has(sig(e))).reverse();
    let newest = null;
    fresh.forEach((e) => {
      const q = findQ(s, e.q);
      if (q && q.home) { c[q.home] = (c[q.home] || 0) + 1; newest = q.home; }
      c._all = (c._all || 0) + 1;
      if (TRAINING[e.s]) c._train = (c._train || 0) + 1;
      if (e.s === 'INT') c._study = (c._study || 0) + 1;
      (s.goals || []).forEach((g) => { if (g.kind === 'count' && !g.done && e.t >= (g.since || 0) && inWindow(g, e.d) && goalMatches(s, g, e)) g.progress += 1; });
      if (e.t > s.homeTally.lastT) s.homeTally.lastT = e.t;
    });
    s.seen = s.log.filter((e) => e.q != null).map(sig);
    const done = [];
    if (s.trials) s.trials.list.forEach((g) => { if (!g.done) g.progress = s.log.filter((e) => e.q != null && e.t >= (g.since || 0) && inWindow(g, e.d) && goalMatches(s, g, e)).length; });
    (s.goals || []).concat(s.trials ? s.trials.list : []).forEach((g) => { if (!g.done && g.kind !== 'manual' && g.progress >= g.target) { g.done = t; done.push(g); if (s.trials && s.trials.list.indexOf(g) >= 0) { townNote(s, 'wk', 1); bonusWeekly(s, g, Date.now(), t); } } });
    return { newest: newest, done: done };
  }
  const syncTally = (s) => syncAll(s, today()).newest;


  // ---------- furniture ----------
  // type: where it can go. w: how wide it is (a spot must be at least this wide).
  const DECOR = {
    flamingo: { name: "Lawn Flamingo", type: 'yard', w: 14, price: 60, lv: 1, blurb: "Plastic, pink, and never once washed.", bonus: {VIT: 1}, bonus: {VIT: 1} },
    plant: { name: "Potted Monstera", type: 'floor', w: 24, price: 90, lv: 1, blurb: "Thrives on neglect. Its keeper takes notes.", bonus: {VIT: 1}, bonus: {VIT: 1} },
    floorlamp: { name: "Floor Lamp", type: 'floor', w: 20, price: 120, lv: 2, blurb: "A steady light for long evenings of reading you swear you will do.", bonus: {INT: 1}, bonus: {INT: 1} },
    map: { name: "Old Sea Chart", type: 'wall', w: 46, price: 200, lv: 3, blurb: "Coastlines drawn by someone who had clearly never seen the sea.", bonus: {END: 1}, bonus: {END: 1} },
    vegpatch: { name: "Kitchen Garden", type: 'yard', w: 44, price: 250, lv: 3, blurb: "Tended soil yields humble fruit, and the occasional heroic tomato.", bonus: {VIT: 2}, bonus: {VIT: 2} },
    mountedfish: { name: "Mounted Trophy Fish", type: 'wall', w: 46, price: 250, lv: 5, blurb: "It was this big. Larger, with each retelling.", bonus: {STR: 1}, bonus: {STR: 1} },
    firepit: { name: "Fire Pit", type: 'yard', w: 40, price: 300, lv: 5, blurb: "Embers that warm the bones and invite poor decisions with marshmallows.", bonus: {END: 2}, bonus: {END: 2} },
    shield: { name: "Shield for the Wall", type: 'wall', w: 32, price: 300, lv: 6, blurb: "Bears the arms of a house that never existed. Looks the part.", bonus: {STR: 2}, bonus: {STR: 2} },
    armchair: { name: "Wingback Armchair", type: 'floor', w: 40, price: 350, lv: 4, blurb: "Sit, and the mind wanders farther than the legs ever will.", bonus: {INT: 2}, bonus: {INT: 2} },
    guitar: { name: "Three-Chord Guitar", type: 'floor', w: 18, price: 400, lv: 6, blurb: "Knows three chords. Plays them with total conviction.", bonus: {VIT: 2}, bonus: {VIT: 2} },
    record: { name: "Gramophone", type: 'floor', w: 30, price: 450, lv: 7, blurb: "Old songs for old rooms. Dancing is not optional.", bonus: {DIS: 2}, bonus: {DIS: 2} },
    fishtank: { name: "Glass Aquarium", type: 'floor', w: 40, price: 500, lv: 8, blurb: "Three fish circle forever, contemplating nothing. Instructive.", bonus: {INT: 2}, bonus: {INT: 2} },
    telescope: { name: "Brass Telescope", type: 'yard', w: 30, price: 600, lv: 10, blurb: "For counting stars and ignoring the lawn.", bonus: {INT: 3}, bonus: {INT: 3} },
    neon: { name: "Fairy-Light Sign", type: 'wall', w: 48, price: 700, lv: 9, blurb: "It hums a little. It says GRIND. Fair enough.", bonus: {DIS: 3}, bonus: {DIS: 3} },
    portrait: { name: "Self-Portrait", type: 'wall', w: 34, price: 800, lv: 12, blurb: "Painted in oils by an artist paid in exposure.", bonus: {DIS: 4}, bonus: {DIS: 4} },
    arcade: { name: "Arcade Cabinet", type: 'floor', w: 34, price: 900, lv: 12, blurb: "One more credit. Always one more credit.", bonus: {VIT: 3}, bonus: {VIT: 3} },
    gnome: { name: "Garden Gnome", type: 'yard', w: 16, unlock: 'groundskeeper', blurb: "For keeping the lawn down. He watches it so you can sit.", bonus: {DIS: 2}, bonus: {DIS: 2} , pref: 'yard' },
    bbq: { name: "Barbecue", type: 'yard', w: 40, unlock: 'stocked', blurb: "For keeping the fridge full. Smells of Sunday.", bonus: {VIT: 3}, bonus: {VIT: 3} , pref: 'yard' },
    hammock: { name: "Hammock", type: 'yard', w: 84, unlock: 'treat', blurb: "For actually taking a reward. Rest is part of the work.", bonus: {VIT: 3}, bonus: {VIT: 3} , pref: 'yard' },
    dummy: { name: "Practice Dummy", type: 'floor', w: 26, unlock: 'ironwill', blurb: "For twenty training sessions. It never complains.", bonus: {STR: 3}, bonus: {STR: 3} , pref: 'gym' },
    banner: { name: "House Banner", type: 'wall', w: 30, unlock: 'onaroll', blurb: "For seven days in a row. Hang it somewhere obvious.", bonus: {DIS: 3}, bonus: {DIS: 3} , pref: 'living' },
    starchart: { name: "Star Chart", type: 'wall', w: 40, unlock: 'bookworm', blurb: "For all that reading. The night sky, labelled.", bonus: {INT: 3}, bonus: {INT: 3} , pref: 'study' },
    weaponrack: { name: "Weapon Rack", type: 'wall', w: 48, unlock: 'hoarder', blurb: "For opening ten coffers. Somewhere to put it all.", bonus: {STR: 3}, bonus: {STR: 3} , pref: 'gym' },
    // 2.23: earned at the end of the content, not bought. The Victor's Statue is the hero who finished, in gold; an old hero's
    // statue is one he finished with before, in stone, standing in a New Game+ yard (s.legacy). Drawn from the hero's own look.
    victor: { name: "The Victor's Statue", type: 'yard', w: 40, statue: 'gold', blurb: 'Everything Grindstone has, done. Cast in gold, in his own likeness.', bonus: {}, pref: 'yard' },
    legacy1: { name: 'Statue of an old hero', type: 'yard', w: 40, statue: 'stone', legacy: 1, blurb: 'The hero who came before, in stone.', bonus: {}, pref: 'yard' },
    legacy2: { name: 'Statue of an old hero', type: 'yard', w: 40, statue: 'stone', legacy: 2, blurb: 'The hero who came before that, in stone.', bonus: {}, pref: 'yard' },
    legacy3: { name: 'Statue of an old hero', type: 'yard', w: 40, statue: 'stone', legacy: 3, blurb: 'An older hero, in stone.', bonus: {}, pref: 'yard' },
    legacy4: { name: 'Statue of an old hero', type: 'yard', w: 40, statue: 'stone', legacy: 4, blurb: 'An older hero, in stone.', bonus: {}, pref: 'yard' },
    legacy5: { name: 'Statue of an old hero', type: 'yard', w: 40, statue: 'stone', legacy: 5, blurb: 'An older hero, in stone.', bonus: {}, pref: 'yard' },
    legacy6: { name: 'Statue of an old hero', type: 'yard', w: 40, statue: 'stone', legacy: 6, blurb: 'The oldest of them, in stone.', bonus: {}, pref: 'yard' },
  };
  const DECOR_SLOTS = [
    { k: 'yardA', room: 'yard', type: 'yard', w: 86, name: 'Yard, under the washing line' },
    { k: 'yardB', room: 'yard', type: 'yard', w: 44, name: 'Yard, by the fence' },
    { k: 'loungeF', room: 'living', type: 'floor', w: 44, name: 'Lounge floor' },
    { k: 'loungeW', room: 'living', type: 'wall', w: 50, name: 'Lounge wall' },
    { k: 'studyF', room: 'study', type: 'floor', w: 44, name: 'Study floor' },
    { k: 'studyW', room: 'study', type: 'wall', w: 50, name: 'Study wall' },
    { k: 'bedW', room: 'bedroom', type: 'wall', w: 50, name: 'Bedroom wall' },
    { k: 'gymF', room: 'gym', type: 'floor', w: 40, name: 'Gym floor' },
    { k: 'gymW', room: 'gym', type: 'wall', w: 80, name: 'Gym wall' },
  ];
  const cnt = (s, k) => (s.homeTally && s.homeTally.counts[k]) || 0;
  const MILESTONES = {
    groundskeeper: { name: 'Groundskeeper', desc: 'Mow the lawn 5 times', goal: 5, n: (s) => cnt(s, 'lawn') },
    stocked: { name: 'Well stocked', desc: 'Do the grocery shop 8 times', goal: 8, n: (s) => cnt(s, 'fridge') },
    treat: { name: 'Treat yourself', desc: 'Claim a real-life reward', goal: 1, n: (s) => s.claimed || 0 },
    ironwill: { name: 'Iron will', desc: 'Complete 20 training quests', goal: 20, n: (s) => cnt(s, '_train') },
    onaroll: { name: 'On a roll', desc: 'Hit a 7-day streak', goal: 7, n: (s) => s.bestStreak || 0 },
    bookworm: { name: 'Bookworm', desc: 'Complete 15 Intellect quests', goal: 15, n: (s) => cnt(s, '_study') },
    hoarder: { name: 'Hoarder', desc: 'Open 10 chests', goal: 10, n: (s) => s.chestsOpened || 0 },
  };
  const fits = (key, slotK) => { const d = DECOR[key], sl = DECOR_SLOTS.find((x) => x.k === slotK); return !!(d && sl && d.type === sl.type && d.w <= sl.w); };
  const placedAt = (s, key) => Object.keys(s.decor.placed).find((k) => s.decor.placed[k] === key) || null;
  function placeDecor(s, key, slotK) {
    if (!fits(key, slotK) || s.decor.owned.indexOf(key) < 0) return false;
    const from = placedAt(s, key);
    if (from) delete s.decor.placed[from];
    s.decor.placed[slotK] = key;
    return true;
  }
  function autoPlace(s, key) {
    const pref = DECOR[key] && DECOR[key].pref;
    const free = DECOR_SLOTS.filter((sl) => !s.decor.placed[sl.k] && fits(key, sl.k))
      .sort((a, b) => (b.room === pref) - (a.room === pref) || a.w - b.w)[0];
    if (free) s.decor.placed[free.k] = key;
    return free ? free.k : null;
  }
  // Puts a new relic out somewhere sensible.
  function relicOut(s, key) {
    const near = { yard: 'line', gym: 'bag', living: 'couch', study: 'desk' }[DECOR[key] && DECOR[key].pref] || (DECOR[key] && DECOR[key].type === 'yard' ? 'line' : 'couch');
    const it = s.house.items.find((t) => t.k === near);
    return houseAuto(s, 'relic', key, it ? [it.x + 1, it.y + 2] : null);
  }
  // Grants any milestone furniture that's newly earned. Returns the item keys.
  function checkUnlocks(s) {
    const got = [];
    Object.keys(DECOR).forEach((key) => {
      const m = DECOR[key].unlock && MILESTONES[DECOR[key].unlock];
      if (!m || s.decor.owned.indexOf(key) >= 0) return;
      if (m.n(s) >= m.goal) { s.decor.owned.push(key); if (s.house) relicOut(s, key); got.push(key); }
    });
    return got;
  }

  function relicBonus(s, stat) {
    let n = 0;
    (s.decor ? s.decor.owned : []).forEach((k) => { const b = DECOR[k] && DECOR[k].bonus; if (b && b[stat]) n += b[stat]; });
    return n;
  }

  // ---------- overdue chores cost stats in the delve (2.8: one word for it everywhere; these were 'afflictions' with names of their own) ----------
  const AFFLICT = {
    lawn: { name: 'Lawn', was: 'Overgrowth', lore: 'The grass is getting long. Kermit thinks it looks fine.', pen: { VIT: 1 } },
    fridge: { name: 'Fridge', was: 'Famine', lore: 'Not much left in there. One jar of something is holding the fort.', pen: { VIT: 2 } },
    dishes: { name: 'Dishes', was: 'Rot', lore: 'The pile by the sink is getting ambitious.', pen: { VIT: 1 } },
    laundry: { name: 'Laundry', was: 'Squalor', lore: 'The basket is full and the floor is helping out.', pen: { DIS: 1 } },
    birds: { name: 'Bird feeding', was: 'Hunger of the Wards', lore: 'Ruby and Kermit would like breakfast. They have mentioned it.', pen: { DIS: 1 } },
    aviary: { name: 'Aviary', was: 'Filth', lore: 'The aviary could do with a clean.', pen: { DIS: 1 } },
    gym: { name: 'Training', was: 'Atrophy', lore: 'The weights have been keeping to themselves lately.', pen: { STR: 2, END: 1 } },
    study: { name: 'Study', was: 'Torpor', lore: 'The books are right where you left them.', pen: { INT: 2 } },
  };
  // Penalties from afflictions that have fully built up (state 2).
  function penalties(s, H) {
    const out = {};
    Object.keys(AFFLICT).forEach((k) => {
      if (!H[k] || !H[k].linked || H[k].state !== 2) return;
      const p = AFFLICT[k].pen;
      Object.keys(p).forEach((st) => { out[st] = (out[st] || 0) + p[st]; });
    });
    return out;
  }
  function statTotal(s, k, pen) { return Math.max(1, statVal(s.stats[k]) + gearBonus(s, k) + relicBonus(s, k) - ((pen && pen[k]) || 0)); }

  // ---------- item lore ----------
  const LORE = {
    Longsword: 'A straight blade of honest make. It asks only that you keep showing up.',
    Greatsword: 'Too heavy for sense, which is rather the point.',
    Rapier: 'A needle for the patient. Rewards a hundred small efforts.',
    Sabre: 'Curved for the long ride. Favoured by those who go the distance.',
    Dirk: 'A short blade for quiet work done well.',
    Hatchet: 'For splitting wood and the day into manageable pieces.',
    'Bearded Axe': 'The beard is on the blade. Probably.',
    Warhammer: 'Doubts are best flattened.',
    Mace: 'Blunt, honest, and unconcerned with finesse.',
    Cudgel: 'A stick, essentially. A very committed stick.',
    Glaive: 'Long reach for long campaigns.',
    Halberd: 'Axe, spear and hook, for the indecisive warrior.',
    Harpoon: 'Worn smooth by brine. Favoured by those who wait for the tide.',
    Boathook: 'Pulls things closer. Goals, mostly.',
    'Lantern Staff': 'Its flame burns brighter with every page turned.',
    'Driftwood Staff': 'Shaped by the sea, which never stops working.',
    Hood: 'Keeps the rain off and the world at a distance.',
    Cowl: 'Worn by those who think in the dark.',
    Tricorn: 'A hat with opinions about discipline.',
    'Wide-brim Hat': 'Shade for the long road. Mysterious, a little.',
    Helm: 'Iron between you and the excuses.',
    Bascinet: 'A close-fitting helm. Breathing is advised.',
    Circlet: 'A thin band that sharpens the mind, or at least the posture.',
    Crown: 'Heavy is the head. Do the dishes anyway.',
    'Half-mask': 'Hides the face, not the effort.',
    Greatcoat: 'Long, dark and dramatic. Built for walking into the wind.',
    Oilskin: 'Sheds rain and complaints alike.',
    Duster: 'Worn by drifters who finish what they start.',
    Hauberk: 'Ringed mail. Every link a promise kept.',
    Cuirass: 'A breastplate for those who take the hits and keep going.',
    Brigandine: 'Plates hidden in cloth. Strength without show.',
    Robes: 'Loose, flowing, and full of pockets for notes.',
    Vestments: 'Garb of order and quiet ritual.',
    Gambeson: 'Quilted padding. Humble, warm, underrated.',
    'Signet Ring': 'Seals letters and resolutions.',
    Locket: 'Holds a likeness of someone worth getting up for.',
    Talisman: 'Carved with a sigil of focus. Mostly decorative. Mostly.',
    Rosary: 'Beads for counting days, reps, or blessings.',
    Compass: 'Always points somewhere. Usually forward.',
    Phial: 'Something glows within. Best not to drink it.',
    'Pocket Watch': 'Ticks loudly whenever you procrastinate.',
    'Shark-tooth Charm': 'A souvenir of the deep. Bites back.',
  };
  const RAR_LORE = ['', 'Well cared for.', 'Its make is uncommonly fine.', 'Echoes with faint, old power.', 'Few have held its like. Fewer have kept it.'];
  const itemLore = (it) => (LORE[it.base] || 'An item of uncertain provenance.') + (RAR_LORE[it.tier] ? ' ' + RAR_LORE[it.tier] : '');

  // ---------- vows (your goals) and weekly trials (automatic goals) ----------
  const weekStart = (t) => addDays(t, -dayIdx(t));
  const clampN = (n, a, b) => Math.max(a, Math.min(b, n));
  function goalMatches(s, g, e) {
    if (e.q == null) return false;
    const f = g.filter || { type: 'any' };
    if (f.type === 'quest') return e.q === f.id;
    if (f.type === 'stat') return f.stat === 'TRAIN' ? !!TRAINING[e.s] : e.s === f.stat;
    if (f.type === 'home') { const q = findQ(s, e.q); return !!(q && q.home === f.home); }
    return true;
  }
  const inWindow = (g, d) => d >= g.start && (!g.end || d <= g.end);
  function allGoals(s) { return s.goals.concat(s.trials ? s.trials.list : []); }
  const syncGoals = (s, t) => syncAll(s, t).done;
  function unsyncGoal(s, e) { // called on undo, before the entry leaves the log
    if ((s.seen || []).indexOf(sig(e)) < 0) return;
    (s.goals || []).forEach((g) => { if (!g.done && g.kind === 'count' && e.t >= (g.since || 0) && inWindow(g, e.d) && goalMatches(s, g, e) && g.progress > 0) g.progress -= 1; });
  }
  function goalState(g, t) {
    if (g.done) return 'done';
    if (g.end && t > g.end) return 'lapsed';
    return 'open';
  }

  // ---------- weeklies (2.8) ----------
  // The old three trials and "offers" are one thing now: a row of weekly offers. Three to start; more open with level and a
  // full house. Any offer not yet fulfilled can be swapped: the first swap each week is free, then 10, 20, 40... gold.
  // Offers past the third are extras: nothing is lost by leaving them, they ask a little more and pay more.
  const WEEKLY_BASE = 3, WEEKLY_MAX = 8, WEEKLY_LEVELS = [6, 12, 20, 30];
  function weeklySlots(s) {
    let n = WEEKLY_BASE;
    WEEKLY_LEVELS.forEach((l) => { if (s.level >= l) n += 1; });
    if ((s.npcs || []).filter((x) => x.kind === 'human' && x.status === 'resident').length >= 3) n += 1;
    return Math.min(WEEKLY_MAX, n);
  }
  function weeklyNext(s) {
    if (weeklySlots(s) >= WEEKLY_MAX) return null;
    const l = WEEKLY_LEVELS.find((x) => s.level < x);
    const house = (s.npcs || []).filter((x) => x.kind === 'human' && x.status === 'resident').length < 3;
    return [l ? 'level ' + l : null, house ? 'three people living at the hearth' : null].filter(Boolean).join(', or ') || null;
  }
  const wrng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
  const whash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const fkey = (f) => f.type + ':' + (f.id != null ? f.id : f.stat || f.home || '');
  const PER_GOLD = { STR: 12, END: 12, INT: 10, VIT: 10, DIS: 6 };
  // Everything that could be offered this week, sized from the last four weeks: [group, offer]
  function weeklyPool(s, t) {
    const ws = weekStart(t), since = addDays(ws, -28);
    const recent = s.log.filter((e) => e.q != null && e.d >= since && e.d < ws);
    const from = s.created && s.created > since ? s.created : since;
    const weeks = clampN(Math.ceil(daysBetween(from, ws) / 7), 1, 4);
    const avg = (pred) => recent.filter(pred).length / weeks;
    const P = [];
    const tn = clampN(Math.round(avg((e) => TRAINING[e.s]) * 1.2 + 0.4), 2, 7);
    P.push(['body', { title: `Train ${tn} times`, lore: 'Strength or Endurance, it all counts.', filter: { type: 'stat', stat: 'TRAIN' }, target: tn, gold: 12 * tn }]);
    const H = homeState(s, t);
    Object.keys(AFFLICT).filter((k) => HOME[k] && H[k] && H[k].linked && H[k].state >= 1).sort((a, b) => H[b].state - H[a].state || H[b].days - H[a].days).slice(0, 3).forEach((k) => {
      const q = s.quests.find((x) => x.home === k && !x.archived);
      P.push(['home', { title: `Catch up: ${q ? q.name : HOME[k].name}`, lore: 'Once this week is enough.', filter: { type: 'home', home: k }, target: 1, gold: 40 }]);
    });
    STATS.forEach((k) => {
      const n = clampN(Math.round(avg((e) => e.s === k) * 1.2 + 0.4), k === 'DIS' ? 3 : 2, k === 'DIS' ? 14 : 10);
      P.push([k === 'DIS' ? 'home' : k === 'INT' || k === 'VIT' ? 'mind' : 'stat', { title: `${n} ${STAT_INFO[k].name} deeds`, lore: `Anything that trains ${STAT_INFO[k].name} counts.`, filter: { type: 'stat', stat: k }, target: n, gold: PER_GOLD[k] * n }]);
    });
    s.quests.filter((q) => !q.archived && q.type !== 'todo').forEach((q) => {
      const a = avg((e) => e.q === q.id);
      const cap = questWeekCap(s, q, t);   // 2.19: what his week allows (the bins go out once; nothing that needs booking)
      if (cap < 1) return;
      const n = clampN(Math.round(a * 1.15 + 0.4), 1, cap);
      if (n < 2) { P.push(['quest', { cap: cap, title: `${q.name}, once`, lore: a > 0 ? 'Just the once this week.' : 'One you have not done lately. Once is enough.', filter: { type: 'quest', id: q.id }, target: 1, gold: Math.max(15, DIFF[clampDiff(q.diff) - 1].gold * 2) }]); return; }
      P.push(['quest', { cap: cap, title: `${q.name} × ${n}`, lore: 'This one deed, that many times.', filter: { type: 'quest', id: q.id }, target: n, gold: n * Math.max(5, Math.round(DIFF[clampDiff(q.diff) - 1].gold * 0.9)) }]);
    });
    const an = clampN(Math.round(avg(() => true) * 1.1 + 0.4), 5, 60);
    P.push(['any', { title: `${an} deeds of any kind`, lore: 'Everything counts.', filter: { type: 'any' }, target: an, gold: 2 * an }]);
    return P;
  }
  function weeklyMint(tr, o, extra, now) {
    tr.seq = (tr.seq | 0) + 1;
    const g = Object.assign({}, o, { id: 'tr' + tr.seq, kind: 'count', start: tr.week, end: addDays(tr.week, 6), progress: 0, lastT: 0, done: null });
    if (extra) { g.bonus = true; g.target = Math.min(o.cap || 99, Math.max(g.target, Math.ceil(g.target * 1.2))); g.gold = Math.round(o.gold * (g.target / o.target) * 1.5); if (tr.list.length >= 5) g.chest = true; g.title = /, once$/.test(g.title) ? (g.target > 1 ? g.title.replace(/, once$/, ' × ' + g.target) : g.title) : g.title.replace(/\d+/, String(g.target)); }
    if (now) g.since = now;
    return g;
  }
  function weeklyDraw(s, t, tr, rnd, groups) {
    const have = {}; tr.list.forEach((g) => { have[fkey(g.filter || { type: 'any' })] = 1; });
    (tr.spent || []).forEach((k) => { have[k] = 1; });
    let pool = weeklyPool(s, t).filter((c) => !have[fkey(c[1].filter)]);
    if (groups) { const g = pool.filter((c) => groups.indexOf(c[0]) >= 0); if (g.length) pool = g; }
    return pool.length ? pool[Math.floor(rnd() * pool.length)][1] : null;
  }
  // Fills empty slots (a new week, or a slot that has just opened).
  // `now` set: the new offers count from now (a slot that opens mid-week mustn't arrive already done).
  function weeklyTopUp(s, t, now) {
    const tr = s.trials, want = weeklySlots(s);
    if (!tr || tr.week !== weekStart(t)) return 0;
    const rnd = wrng(whash(tr.week + ':' + (s.created || '') + ':' + tr.list.length + ':' + (tr.seq | 0)));
    let added = 0;
    while (tr.list.length < want) {
      const o = weeklyDraw(s, t, tr, rnd, null);
      if (!o) break;
      tr.list.push(weeklyMint(tr, o, tr.list.length >= WEEKLY_BASE, now || null)); added += 1;
    }
    return added;
  }
  function makeTrials(s, t) {
    const ws = weekStart(t);
    const tr = { week: ws, source: 'auto', bonus: false, list: [], seq: 0, rerolls: 0, spent: [] };
    const rnd = wrng(whash(ws + ':' + (s.created || '')));
    // the first three keep their old shape: one for the body, one for the house, one for mind or vigour
    [['body'], ['home'], ['mind']].forEach((grp) => { const o = weeklyDraw(s, t, tr, rnd, grp); if (o) tr.list.push(weeklyMint(tr, o, false, null)); });
    s.trials = tr; weeklyTopUp(s, t);
    return tr;
  }
  const weeklyCost = (s) => { const n = (s.trials && s.trials.rerolls) | 0; return n === 0 ? 0 : Math.min(320, 10 * Math.pow(2, n - 1)); };
  // Swap one offer for another. Returns why not, or null. The new one counts from now, so it can't arrive half done.
  function weeklyReroll(s, id, t, now) {
    const tr = s.trials, i = tr ? tr.list.findIndex((g) => g.id === id) : -1;
    if (i < 0) return 'No such offer';
    if (tr.list[i].done) return 'Already fulfilled';
    const cost = weeklyCost(s);
    if (s.gold < cost) return 'Need ' + (cost - s.gold) + ' more gold';
    const old = tr.list[i];
    tr.spent = (tr.spent || []).concat([fkey(old.filter || { type: 'any' })]);
    const rnd = wrng(whash(tr.week + ':rr:' + (tr.rerolls | 0) + ':' + id));
    const rest = { week: tr.week, list: tr.list.filter((g) => g !== old), spent: tr.spent };
    const o = weeklyDraw(s, t, rest, rnd, null);
    if (!o) { tr.spent.pop(); return 'Nothing else to offer this week'; }
    s.gold -= cost; tr.rerolls = (tr.rerolls | 0) + 1;
    const g = weeklyMint(tr, o, !!old.bonus, now);
    if (old.bonus && old.chest) g.chest = true;
    tr.list[i] = g;
    return null;
  }

  // ---------- seasons (2.8) ----------
  // A season is three months (Albany's: summer is December to February). XP earned in it climbs a ten-step track that
  // pays gold on odd steps and a coffer on even ones; at the turn the track starts again and the old one goes in the book.
  const SEASON_STEP = 600, SEASON_TIERS = 10;
  function seasonKey(t) { const y = +String(t).slice(0, 4), m = +String(t).slice(5, 7), se = seasonOf(t); return (se === 'summer' && m <= 2 ? y - 1 : y) + '-' + se; }
  function seasonEnd(t) { const y = +String(t).slice(0, 4), m = +String(t).slice(5, 7); const em = m === 12 ? 2 : m <= 2 ? 2 : m <= 5 ? 5 : m <= 8 ? 8 : 11, ey = m === 12 ? y + 1 : y; return fmt(new Date(ey, em, 0)); }
  const seasonName = (key) => { const p = String(key).split('-'); return p[1].charAt(0).toUpperCase() + p[1].slice(1) + ' ' + p[0] + (p[1] === 'summer' ? '/' + String(+p[0] + 1).slice(2) : ''); };
  function seasonNorm(s, t) {
    const key = seasonKey(t), life = lifetimeXp(s);
    if (!Array.isArray(s.seasons)) s.seasons = [];
    if (!s.season || typeof s.season !== 'object' || !s.season.key) s.season = { key: key, base: life, paid: 0 };
    if (s.season.key !== key) {
      const xp = Math.max(0, life - s.season.base);
      s.seasons.push({ key: s.season.key, xp: xp, tier: Math.min(SEASON_TIERS, Math.floor(xp / SEASON_STEP)) });
      if (s.seasons.length > 40) s.seasons.shift();
      s.season = { key: key, base: life, paid: 0 };
    }
    if (s.season.base > life) s.season.base = life;
  }
  function seasonState(s, t) {
    const xp = Math.max(0, lifetimeXp(s) - s.season.base), tier = Math.min(SEASON_TIERS, Math.floor(xp / SEASON_STEP));
    return { key: s.season.key, name: seasonName(s.season.key), xp: xp, tier: tier, into: tier >= SEASON_TIERS ? SEASON_STEP : xp - tier * SEASON_STEP, step: SEASON_STEP, tiers: SEASON_TIERS, left: Math.max(0, daysBetween(t, seasonEnd(t))), paid: s.season.paid | 0 };
  }
  const seasonReward = (i) => (i === SEASON_TIERS ? { gold: 300, chest: 2 } : i % 2 ? { gold: 40 + 20 * i, chest: 0 } : { gold: 0, chest: 1 });
  // Pays any steps reached and not yet paid. Returns what was handed over.
  function seasonClaim(s, t) {
    const st = seasonState(s, t), out = [];
    for (let i = (s.season.paid | 0) + 1; i <= st.tier; i++) { const r = seasonReward(i); s.gold += r.gold; s.chests += r.chest; s.season.paid = i; out.push(Object.assign({ tier: i }, r)); }
    return out;
  }
  // Wet days by season, the same for a given date every time it is asked.
  function weatherOn(t, hour) {
    const p = { winter: 0.5, autumn: 0.3, spring: 0.28, summer: 0.08 }[seasonOf(t)];
    let h = 2166136261; const str = 'w' + t; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    const a = ((h >>> 0) % 1000) / 1000, from = 5 + ((h >>> 10) % 12), len = 3 + ((h >>> 16) % 8);
    return a < p && hour >= from && hour < from + len ? 'rain' : null;
  }

  // ---------- the work roster (2.8) ----------
  // Shifts come from a calendar on the phone as [{ t: title, s: start ms, e: end ms, a: all day }]. Each day becomes
  // { mins: minutes worked, first: minutes past midnight of the first start, last: of the last finish, off: a rostered day off }.
  // Timed events are shifts; all-day events count only if they say RDO or day off (other people's all-day notes are ignored).
  const OFF_RE = /\b(rdo|day off|annual leave|leave)\b/i;
  function rosterDigest(evs) {
    const days = {}, get = (d) => days[d] || (days[d] = { mins: 0, first: null, last: null, off: false });
    (evs || []).forEach((e) => {
      if (!e || !isFinite(e.s)) return;
      if (e.a) { // all-day: the calendar keeps these at midnight UTC
        if (!OFF_RE.test(e.t || '')) return;
        const n = Math.max(1, Math.round(((e.e || e.s) - e.s) / 864e5));
        for (let i = 0; i < n && i < 31; i++) get(new Date(e.s + i * 864e5).toISOString().slice(0, 10)).off = true;
        return;
      }
      if (OFF_RE.test(e.t || '')) { get(today(new Date(e.s))).off = true; return; }
      let a = e.s; const end = Math.max(e.s, Math.min(e.e || e.s, e.s + 20 * 3600e3));
      while (a < end) { // split at midnight, so an overnight counts on both days
        const d0 = new Date(a), next = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1).getTime(), b = Math.min(end, next);
        const day = get(today(d0)), m0 = d0.getHours() * 60 + d0.getMinutes(), m1 = m0 + Math.round((b - a) / 60000);
        day.mins += m1 - m0; day.first = day.first == null ? m0 : Math.min(day.first, m0); day.last = day.last == null ? m1 : Math.max(day.last, m1);
        a = b;
      }
    });
    return days;
  }
  // 'off' | 'work' | 'long' | null (no roster, or nothing known about that day). Long: at least `hours` worked (9 unless
  // set), or thirteen hours from first start to last finish (a split shift eats the day whatever it adds up to).
  function dayKind(s, t) {
    const R = s.roster, d = R && R.days && R.days[t];
    if (!R || !R.days || !s.settings.rosterCal) return null;
    if (!d) return Object.keys(R.days).some((k) => k > t) ? 'off' : null;   // a gap between shifts is a day off; past the end of the roster, nobody knows
    if (d.mins <= 0) return d.off ? 'off' : null;
    const hrs = s.settings.longHours || 9;
    return d.mins >= hrs * 60 || d.last - d.first >= 13 * 60 ? 'long' : 'work';
  }
  const hm = (m) => { const h = Math.floor(m / 60) % 24, mi = m % 60; return (h % 12 || 12) + (mi ? ':' + pad(mi) : '') + (h < 12 ? ' am' : ' pm'); };
  // On a long day only the dailies marked as needed (q.core) stay on the list; the rest are let off.
  // 2.27: hidden ones are let off too, and a daily he keeps doing on long days stays on them without being marked
  const excused = (s, q, t) => q.type === 'daily' && (isAway(q, t) || (!q.core && dayKind(s, t) === 'long' && !(q.longOff ? null : longKeep(s, q, t))));

  // ---------- 2.27: keeping what he keeps doing, on long days ----------
  // Over the last six weeks of long shifts (the roster is read that far back), a daily done on at least three in four of
  // the ones it was due (and at least three of them) stays on the list on long days. q.core still keeps it regardless;
  // q.longOff lets it off regardless.
  const LONG_KEEP = { days: 42, min: 3, share: 0.75 };
  const longCache = { s: null, key: '', map: null };
  function longKeepMap(s, t) {
    const key = t + '|' + s.log.length + '|' + (s.log[0] ? s.log[0].k : '') + '|' + (s.roster ? s.roster.at : '') + '|' + s.quests.length;
    if (longCache.s === s && longCache.key === key) return longCache.map;
    const longs = [], map = {};
    for (let i = 1; i <= LONG_KEEP.days; i++) { const d = addDays(t, -i); if (dayKind(s, d) === 'long') longs.push(d); }
    if (longs.length >= LONG_KEEP.min) s.quests.forEach((q) => {
      if (q.type !== 'daily' || q.archived) return;
      const done = {};
      ((s.qhist && s.qhist[q.id]) || []).forEach((d) => { done[d] = 1; });
      s.log.forEach((e) => { if (e.q === q.id && e.d) done[e.d] = 1; });
      const due = longs.filter((d) => !q.days || q.days[dayIdx(d)]);
      const n = due.filter((d) => done[d]).length;
      if (due.length >= LONG_KEEP.min && n / due.length >= LONG_KEEP.share) map[q.id] = { done: n, of: due.length };
    });
    longCache.s = s; longCache.key = key; longCache.map = map;
    return map;
  }
  const longKeep = (s, q, t) => (q && q.type === 'daily' ? longKeepMap(s, t || today())[q.id] || null : null);

  // ---------- 2.27: hiding and holds ----------
  // q.away = { from, back, why: 'hide' | 'hold', note }: off every list, every reminder and every chore's clock until
  // `back`, the day it returns. A hold also protects: the calling's weeks wait, the training nudge and the gym wait, and
  // the weeklies leave it alone (for an injury, being sick or away). Hiding after every go is q.rest, as before.
  const isAway = (q, t) => !!(q && q.away && q.away.back && t < q.away.back);
  const isHeld = (q, t) => isAway(q, t) && q.away.why === 'hold';
  function awayNorm(q, t) {
    const a = q.away;
    if (!a || typeof a !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(a.back || '') || (t && daysBetween(a.back, t) > 60)) { delete q.away; return; }
    q.away = { from: /^\d{4}-\d{2}-\d{2}$/.test(a.from || '') && a.from <= a.back ? a.from : a.back, back: a.back, why: a.why === 'hold' ? 'hold' : 'hide', note: String(a.note || '').slice(0, 60) };
  }
  // the holds, kept for the callings: [{ q, stat, from, to }] (to: the day it ends or ended)
  function holdLogSet(s, q, from, to) {
    if (!Array.isArray(s.holdLog)) s.holdLog = [];
    const h = s.holdLog.find((x) => x.q === q.id && x.from === from);
    if (h) h.to = to; else s.holdLog.push({ q: q.id, stat: q.stat, from: from, to: to });
  }
  function awaySet(s, ids, back, hold, note, t) {
    t = t || today();
    const out = [];
    (ids || []).forEach((id) => {
      const q = findQ(s, Number(id));
      if (!q || q.archived || !(back > t)) return;
      if (isHeld(q, t)) holdLogSet(s, q, q.away.from, t);
      q.away = { from: t, back: back, why: hold ? 'hold' : 'hide', note: String(note || '').slice(0, 60) };
      if (hold) holdLogSet(s, q, t, back);
      out.push(q);
    });
    s.trainQuiet = trainQuiet(s, t);   // for the phone's training nudge
    return out;
  }
  // bring them back now
  function awayEnd(s, ids, t) {
    t = t || today();
    const out = [];
    (ids || []).forEach((id) => {
      const q = findQ(s, Number(id));
      if (!q || !isAway(q, t)) return;
      if (q.away.why === 'hold') holdLogSet(s, q, q.away.from, t);
      q.away.back = t;
      out.push(q);
    });
    s.trainQuiet = trainQuiet(s, t);
    return out;
  }
  const awayList = (s, t) => s.quests.filter((q) => !q.archived && isAway(q, t)).sort((a, b) => (a.away.back < b.away.back ? -1 : a.away.back > b.away.back ? 1 : 0));
  // days in the week from ws that a hold on stat covered (up to today)
  function heldDays(s, stat, ws, t) {
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      if (d > t) break;
      if ((s.holdLog || []).some((h) => h.stat === stat && h.from <= d && d < h.to)) n++;
    }
    return n;
  }
  // a training quest on hold: the nudge, the chip and the gym wait until it's back, then count from then
  function trainQuiet(s, t) {
    let back = null;
    s.quests.forEach((q) => { if (!q.archived && TRAINING[q.stat] && q.away && q.away.why === 'hold' && q.away.from <= t && (!back || q.away.back > back)) back = q.away.back; });
    return back;
  }
  function trainGap(s, t) {
    const b = trainQuiet(s, t);
    if (b && b > t) return null;
    const last = laterDay(s.lastTraining, b);
    return last ? daysBetween(last, t) : null;
  }
  // 2.27: after a go, put it away for a while? From his own gaps, or the Oracle's idea of how often it comes round (q.hint).
  // Firm ones (a script that can't be filled sooner) hide for exactly that long; the rest a little less, so they're back
  // before they're due.
  function hideSuggest(s, q, t) {
    t = t || today();
    if (!q || q.archived || q.type === 'todo' || q.rest > 1 || q.hideAsk === 'no' || (isDay(q.hideAskAt) && daysBetween(q.hideAskAt, t) < 30)) return null;
    let base = null, firm = false, src = null;
    if (q.hint && q.hint.days >= 2) { base = q.hint.days; firm = !!q.hint.firm; src = 'oracle'; }
    else {
      const h = ((s.qhist && s.qhist[q.id]) || []).slice(-12);
      if (h.length >= 3) { const iv = []; for (let i = 1; i < h.length; i++) iv.push(daysBetween(h[i - 1], h[i])); iv.sort((a, b) => a - b); base = iv[Math.floor(iv.length / 2)]; src = 'history'; }
    }
    if (!(base >= 5)) return null;
    const days = Math.min(365, firm ? base : base - Math.max(1, Math.round(base * 0.15)));
    return { days: days, every: base, firm: firm, src: src, why: q.hint && q.hint.why ? q.hint.why : '' };
  }

  // ---------- 2.27: judging new quests and goals ----------
  // Difficulty, stat and rewards aren't his to set (they'd be farmed): the Oracle judges them (oracle.js) and, with no
  // AI connected, these rules do: the library's own values for anything in it, otherwise keywords and numbers.
  const JUDGE_KW = [
    [/swim|\brun\b|running|jog|walk|hike|bike|cycl|surf|paddle|kayak|rowing|cardio|steps|beach|skipping|parkrun/i, 'END'],
    [/lift|weights|gym|strength|push-?ups?|pull-?ups?|squat|deadlift|bench|press|climb|bag work|boxing|spar|kettlebell|plank|chin-?ups?/i, 'STR'],
    [/read|study|course|cert|learn|lecture|essay|assessment|assignment|journal|language|practi[cs]e|piano|guitar|coding|revise|exam|research/i, 'INT'],
    [/eat|meal|water|sleep|bed by|stretch|yoga|meds|medication|script|doctor|dentist|physio|vitamin|breakfast|lunch|dinner|cook|fruit|veg|walk the|meditat/i, 'VIT'],
  ];
  const wordsOf = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1 && ['the', 'and', 'or', 'a', 'my', 'to', 'of', 'do', 'go'].indexOf(w) < 0);
  function libraryMatch(name) {
    const L = root.G && root.G.LIBRARY;
    if (!L) return null;
    const a = wordsOf(name);
    if (!a.length) return null;
    let best = null, bs = 0;
    L.forEach((c) => c.items.forEach((i) => {
      const b = wordsOf(i[0]), common = a.filter((w) => b.indexOf(w) >= 0).length, sc = common / Math.max(a.length, b.length);
      if (sc > bs) { bs = sc; best = i; }
    }));
    return bs >= 0.6 ? best : null;
  }
  function judgeRules(o) {
    const name = String(o.name || ''), lib = libraryMatch(name);
    let stat, diff, src, why;
    if (lib) { stat = lib[3]; diff = lib[4]; src = 'library'; why = 'As “' + lib[0] + '” in the library.'; }
    else {
      const kw = JUDGE_KW.find((k) => k[0].test(name));
      stat = kw ? kw[1] : 'DIS';
      diff = 2;
      const mins = name.match(/(\d+)\s*(?:min|minute)/i), hrs = name.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour)/i), km = name.match(/(\d+(?:\.\d+)?)\s*km/i);
      const m = mins ? +mins[1] : hrs ? +hrs[1] * 60 : null;
      if (m != null) diff = m < 15 ? 1 : m < 45 ? 2 : m < 90 ? 3 : 4;
      if (km) diff = Math.max(diff, +km[1] >= 10 ? 4 : +km[1] >= 5 ? 3 : 2);
      if (/\b(quick|small|tiny|one page|a glass|ten minutes?)\b/i.test(name)) diff = Math.min(diff, 1);
      if (/\b(deep clean|marathon|whole|entire|overhaul|big)\b/i.test(name)) diff = Math.min(4, diff + 1);
      src = 'rules'; why = kw ? 'Sounds like ' + STAT_INFO[stat].name.toLowerCase() + '.' : 'No AI connected, so a middling guess.';
    }
    diff = clampDiff(diff);
    const cap = o.type === 'habit' ? (o.rest > 1 ? 1 : diff >= 3 ? 1 : diff === 2 ? 2 : 3) : 0;
    return { stat: STATS.indexOf(stat) >= 0 ? stat : 'DIS', diff: diff, cap: cap, src: src, why: why };
  }
  // a goal or target's gold and coffer: what it asks, how fast
  function judgeGoalRules(g, t) {
    t = t || today();
    if (g.kind === 'mark') return { gold: 100, chest: false, src: 'rules', why: 'No AI connected, so the usual.' };
    if (g.kind === 'manual') return { gold: 100, chest: false, src: 'rules', why: 'No AI connected, so the usual.' };
    const n = Math.max(1, g.target | 0), days = g.end ? Math.max(1, daysBetween(t, g.end) + 1) : 60, rate = n / days;
    const gold = Math.max(25, Math.min(500, Math.round((n * 8 * (rate >= 1 ? 1.5 : rate >= 0.5 ? 1.2 : 1)) / 5) * 5));
    return { gold: gold, chest: gold >= 200, src: 'rules', why: n + ' to do' + (g.end ? ' in ' + days + ' days' : '') + '.' };
  }

  // ---------- targets (2.8): a number to beat, by a date ----------
  // { id, name, unit: 'time' (seconds) | 'num', better: 'lower' | 'higher', target, by: date | null, log: [{ d, v }], done, gold, chest, text }
  function marksNorm(s) {
    s.marks = (Array.isArray(s.marks) ? s.marks : []).filter((m) => m && m.name && isFinite(m.target)).map((m) => ({
      id: Number(m.id) || nextId(s), name: String(m.name).slice(0, 60), unit: m.unit === 'time' ? 'time' : 'num', better: m.better === 'higher' ? 'higher' : 'lower',
      target: Number(m.target), by: m.by || null, log: (Array.isArray(m.log) ? m.log : []).filter((a) => a && a.d && isFinite(a.v)).slice(-200), done: m.done || null,
      gold: clampN(m.gold | 0, 0, 2000), chest: !!m.chest, text: String(m.text || '').slice(0, 60), start: m.start || null }));
  }
  const markBest = (m) => (m.log.length ? m.log.reduce((b, a) => (m.better === 'lower' ? Math.min(b, a.v) : Math.max(b, a.v)), m.log[0].v) : null);
  const markHit = (m, v) => (m.better === 'lower' ? v <= m.target : v >= m.target);
  // "4:52" or "292" or "4m52" -> seconds; plain numbers stay numbers. null if it can't be read.
  function markParse(m, str) {
    const x = String(str || '').trim().replace(',', '.');
    if (!x) return null;
    if (m.unit === 'time') {
      const p = x.split(/[:m]/).map((y) => y.replace(/s$/, '').trim());
      if (p.length === 2 && p[0] !== '' && isFinite(+p[0]) && isFinite(+(p[1] || 0))) return Math.round((+p[0] * 60 + +(p[1] || 0)) * 10) / 10;
      if (p.length === 3 && p.every((y) => isFinite(+y))) return +p[0] * 3600 + +p[1] * 60 + +p[2];
    }
    return isFinite(+x) && +x >= 0 ? +x : null;
  }
  function markFmt(m, v) {
    if (v == null) return '–';
    if (m.unit !== 'time') return String(Math.round(v * 100) / 100);
    const mm = Math.floor(v / 60), ss = v - mm * 60;
    return mm + ':' + (ss < 10 ? '0' : '') + (Math.round(ss * 10) / 10);
  }
  // Log an attempt. Returns { hit: reached the target for the first time, pb: a personal best }.
  function markLog(s, id, v, t, now) {
    const m = (s.marks || []).find((x) => x.id === id);
    if (!m || !isFinite(v)) return null;
    const before = markBest(m);
    m.log.push({ d: t, v: v }); if (m.log.length > 200) m.log.shift();
    const pb = before == null || (m.better === 'lower' ? v < before : v > before);
    let hit = false;
    if (!m.done && markHit(m, v)) {
      hit = true; m.done = t; s.gold += m.gold; if (m.chest) s.chests += 1;
      s.log.unshift({ t: now, d: t, v: 1, n: 'Target met: ' + m.name + ' (' + markFmt(m, v) + ')', i: '🎯', x: 0, g: m.gold });
    }
    return { hit: hit, pb: pb, m: m };
  }

  // What the Oracle (Claude) gets: a compact picture of the last four weeks.
  function oracleSummary(s, t) {
    const since = addDays(t, -28);
    const counts = {};
    s.log.forEach((e) => { if (e.q != null && e.d >= since) counts[e.q] = (counts[e.q] || 0) + 1; });
    const H = homeState(s, t);
    return {
      today: t, weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIdx(t)], level: s.level,
      stats: STATS.reduce((o, k) => { o[STAT_INFO[k].name] = statVal(s.stats[k]); return o; }, {}),
      quests: s.quests.filter((q) => !q.archived).map((q) => ({ id: q.id, name: q.name, stat: q.stat, type: q.type, home: q.home || undefined, done_last_28_days: counts[q.id] || 0 })),
      hearth: Object.keys(AFFLICT).filter((k) => H[k] && H[k].linked).map((k) => ({ key: k, affliction: AFFLICT[k].name, days_since: H[k].days, state: ['fine', 'building', 'afflicted'][H[k].state] })),
      days_since_training: s.lastTraining ? daysBetween(s.lastTraining, t) : null,
      vows: s.goals.filter((g) => !g.done).map((g) => g.title),
    };
  }
  const ORACLE_SYSTEM = 'You set weekly goals ("trials") for a personal RPG habit tracker. The player is Australian; use Australian spelling. ' +
    'Speak as an ancient, observant Oracle: cryptic but clear, quietly solemn, dryly funny, never grandiose for its own sake. ' +
    'Read the player’s actual progress and the last four weeks closely. Notice patterns, acknowledge effort without gushing, and gently name what is being neglected. ' +
    'Make each trial feel like a deliberate reading of this player, not a generic productivity prompt. Never invent progress or circumstances. ' +
    'Keep targets achievable but a stretch, and respect that the player does shift work. ' +
    'Reply with ONLY a JSON array of exactly 3 objects, no prose. Each object: ' +
    '{"title": max 5 words, "lore": max 22 words and must say plainly what to do, ' +
    '"filter": {"type":"quest","id":<a quest id from the data>} or {"type":"stat","stat":"STR"|"END"|"VIT"|"DIS"|"INT"|"TRAIN"} or {"type":"home","home":<a hearth key from the data>}, ' +
    '"target": integer 1-20 (completions needed this week), "gold": integer 10-150}.';
  function parseOracle(s, text, t) {
    const a = text.indexOf('['), b = text.lastIndexOf(']');
    if (a < 0 || b <= a) throw new Error('Claude’s answer couldn’t be read (no list came back).');
    const arr = JSON.parse(text.slice(a, b + 1));
    if (!Array.isArray(arr) || !arr.length) throw new Error('Claude sent back an empty list.');
    const ws = weekStart(t);
    const list = arr.slice(0, 3).map((g, i) => {
      let f = g.filter || {};
      if (f.type === 'quest' && !findQ(s, Number(f.id))) f = { type: 'any' };
      else if (f.type === 'quest') f = { type: 'quest', id: Number(f.id) };
      else if (f.type === 'stat' && STATS.concat(['TRAIN']).indexOf(f.stat) < 0) f = { type: 'any' };
      else if (f.type === 'home' && !HOME[f.home]) f = { type: 'any' };
      else if (['quest', 'stat', 'home'].indexOf(f.type) < 0) f = { type: 'any' };
      return { id: 'or' + i, kind: 'count', title: String(g.title || 'A Trial').slice(0, 40), lore: String(g.lore || '').slice(0, 160), filter: f,
        target: clampN(Math.round(Number(g.target) || 1), 1, 20), gold: clampN(Math.round(Number(g.gold) || 30), 10, 150), start: ws, end: addDays(ws, 6), progress: 0, lastT: 0, done: null };
    });
    return { week: ws, source: 'oracle', bonus: false, list: list, seq: 0, rerolls: (s.trials && s.trials.week === ws && s.trials.rerolls) | 0, spent: [] };
  }

  // ---------- hero looks ----------
  const LOOKS = {
    sex: ['m', 'f'],
    skin: ['#f3d2b5', '#e3b48f', '#c98e66', '#a26a45', '#7a4a2e', '#4f2f1f', '#a9bfb1', '#9aa6d6'],
    hair: ['bald', 'cropped', 'parted', 'long', 'buns', 'shorn', 'messy', 'ponytail', 'curly', 'afro', 'mohawk', 'bob', 'spiky', 'dreads', 'balding'],
    hairColour: ['#1c1714', '#4a2f1f', '#7b4a2a', '#c48a3f', '#e8d27a', '#dedad2', '#8a8a8a', '#a8382a', '#3f6fb5', '#7a46b0'],
    beard: ['none', 'beard', 'stubble', 'trimmed', 'bushy', 'moustache'],
    eyes: ['round', 'narrow', 'sleepy'],
    ears: ['round', 'pointed'],
    extra: ['none', 'scar', 'eyepatch', 'glasses', 'freckles'],
    outfit: ['#5a6e8a', '#8a4a3a', '#4f6b4a', '#6a5a8a', '#8a7a5a', '#3d3a44', '#2f6b6b', '#9a6a2a'],
    build: ['regular', 'broad'],
    cls: ['knight', 'barbarian', 'mage', 'rogue', 'rogue_hooded'],
  };
  const NAME_A = ['Al', 'Bran', 'Cor', 'Dun', 'El', 'Fen', 'Gar', 'Hal', 'Is', 'Jor', 'Kael', 'Lor', 'Mor', 'Nor', 'Os', 'Per', 'Quill', 'Ros', 'Sel', 'Tor', 'Ul', 'Var', 'Wen', 'Yr', 'Ash', 'Brom', 'Cael', 'Dra'];
  const NAME_B = ['dric', 'wen', 'ric', 'mund', 'is', 'a', 'ek', 'an', 'eth', 'ira', 'orn', 'us', 'ia', 'ald', 'ys', 'ion', 'ard', 'elle', 'ock', 'ith'];
  function randomName(rnd) { rnd = rnd || Math.random; return pick(NAME_A, rnd) + pick(NAME_B, rnd); }
  function randomLook(rnd) {
    rnd = rnd || Math.random;
    const L = {};
    Object.keys(LOOKS).forEach((k) => { L[k] = pick(LOOKS[k], rnd); });
    if (rnd() < 0.55) L.extra = 'none';
    if (rnd() < 0.3 || L.sex === 'f') L.beard = 'none';
    L.cls = L.sex === 'f' ? 'rogue' : 'knight';
    return L;
  }
  // older saves used a longer list of hair and beards (drawn in 2D); map them onto the modelled ones
  const OLD_HAIR = { buzz: 'cropped', short: 'parted', swept: 'parted', ponytail: 'long', mohawk: 'shorn', bun: 'buns' };
  function normLook(L) {
    L = Object.assign({}, L || {});
    if (OLD_HAIR[L.hair]) L.hair = OLD_HAIR[L.hair];
    if (L.beard && L.beard !== 'none' && LOOKS.beard.indexOf(L.beard) < 0) L.beard = 'beard';
    if (LOOKS.sex.indexOf(L.sex) < 0) L.sex = L.cls === 'rogue' || L.cls === 'rogue_hooded' ? 'f' : 'm';
    Object.keys(LOOKS).forEach((k) => { if (LOOKS[k].indexOf(L[k]) < 0) L[k] = LOOKS[k][0]; });
    if (L.age !== 'kid' && L.age !== 'baby') delete L.age;   // 2.26: kids and little ones (people from the calendar)
    if (L.legs !== 'pants' && L.legs !== 'skirt') delete L.legs;
    return L;
  }

  // ---------- state ----------
  const DEFAULT_QUESTS = [
    ['Swim', '🏊', 'habit', 'END', 4, { cap: 1 }],
    ['Strength training', '🏋️', 'habit', 'STR', 4, { cap: 1 }],
    ['Run', '🏃', 'habit', 'END', 4, { cap: 1 }],
    ['Stretch', '🧘', 'habit', 'VIT', 1, { cap: 1 }],
    ['Drink enough water', '💧', 'daily', 'VIT', 1],
    ['Log my meals', '🍳', 'habit', 'VIT', 1, { cap: 3 }],
    ['Cook a proper meal', '🥦', 'habit', 'VIT', 2, { cap: 2 }],
    ['Grocery shop', '🛒', 'habit', 'VIT', 3, { cap: 1, rest: 3, home: 'fridge' }],
    ['Feed the birds', '🦜', 'daily', 'DIS', 2, { home: 'birds' }],
    ['Do the dishes', '🍽️', 'daily', 'DIS', 2, { home: 'dishes' }],
    ['Clean the aviary', '🧹', 'daily', 'DIS', 3, { days: [0, 0, 0, 0, 0, 1, 0], home: 'aviary' }],
    ['Mow the lawn', '🌿', 'habit', 'DIS', 4, { cap: 1, rest: 7, home: 'lawn' }],
    ['Do a load of washing', '🧺', 'habit', 'DIS', 2, { cap: 1, home: 'laundry' }],
    ['Work on the house', '🔨', 'habit', 'DIS', 4, { cap: 1, home: 'reno' }],
    ['Study', '📚', 'habit', 'INT', 3, { cap: 2 }],
    ['Read', '📖', 'habit', 'INT', 2, { cap: 1 }],
    ['Clear the inbox', '📧', 'habit', 'DIS', 1, { cap: 1 }],
  ];
  // v1 saves: link the starter quests that match, add the new household ones.
  const HOME_MIGRATE = {
    'Feed & water Ruby and Kermit': 'birds', 'Dishes done': 'dishes', 'Clean the aviary': 'aviary', 'An hour on the reno': 'reno',
  };
  const HOME_ADD = ['Grocery shop', 'Mow the lawn', 'Do a load of washing'];

  // Other ways of saying each starter deed, so the herald recognises what Claude logs. Learned wordings get added too.
  const ALIASES = {
    'Swim': ['swim session', 'swim', 'pool session', 'beach swim', 'laps'],
    'Strength training': ['weights / cable session', 'weights', 'cable', 'gym', 'lifting', 'strength session', 'resistance bands', 'cable machine'],
    'Run': ['run or beach session', 'run', 'jog', 'beach run', 'run swim run', 'beach session'],
    'Stretch': ['stretch & mobility', 'stretch', 'stretching', 'mobility', 'yoga'],
    'Drink enough water': ['drink 2l of water', 'water', 'drank water', 'hydration', '2l of water'],
    'Log my meals': ['log meals', 'logged meals', 'meal logged', 'food logged', 'logged food', 'breakfast', 'lunch', 'dinner', 'snack', 'meal'],
    'Cook a proper meal': ['proper vegie-heavy meal', 'vegie meal', 'veggie meal', 'vegie heavy meal', 'salad'],
    'Grocery shop': ['groceries', 'grocery shopping', 'food shop', 'big shop', 'restocked the fridge'],
    'Feed the birds': ['feed & water ruby and kermit', 'fed the birds', 'feed the birds', 'fed ruby and kermit', 'fed the parrots', 'birds fed'],
    'Do the dishes': ['dishes done', 'dishes', 'washing up', 'did the dishes', 'dishwasher', 'washed up'],
    'Clean the aviary': ['aviary', 'cleaned the aviary', 'aviary clean'],
    'Mow the lawn': ['mowed', 'mowing', 'mowed the lawn', 'lawn'],
    'Do a load of washing': ['laundry', 'washing', 'load of washing', 'hung out the washing'],
    'Work on the house': ['an hour on the reno', 'reno', 'renovation', 'renos', 'house reno'],
    'Study': ['cert iv study block', 'study', 'studied', 'cert iv', 'coursework', 'assessment', 'pre reading', 'cert iv study'],
    'Read': ['read for 20 minutes', 'reading', 'read', 'read a book'],
    'Clear the inbox': ['review my emails', 'emails', 'email review', 'reviewed emails', 'inbox', 'inbox zero', 'email triage'],
  };

  // 2.7: plainer names for the starter quests (the old wording stays on as an alias, so the herald still knows it), and a few values rethought.
  const RENAMED = {'Swim session': 'Swim', 'Weights / cable session': 'Strength training', 'Run or beach session': 'Run', 'Stretch & mobility': 'Stretch', 'Drink 2L of water': 'Drink enough water', 'Proper vegie-heavy meal': 'Cook a proper meal', 'Feed & water Ruby and Kermit': 'Feed the birds', 'Dishes done': 'Do the dishes', 'An hour on the reno': 'Work on the house', 'Cert IV study block': 'Study', 'Read for 20 minutes': 'Read', 'Review my emails': 'Clear the inbox'};
  const REVALUED = { 'Drink enough water': [2, 1], 'Clear the inbox': [2, 1], 'Run': [3, 4] }; // [was, now]
  const DEFAULT_REWARDS = [
    ['Fancy coffee', '☕', 80],
    ['Guilt-free gaming session', '🎮', 150],
    ['Takeaway night', '🍔', 400],
    ['Buy that thing I want', '🛍️', 1500],
  ];

  function newQuest(s, o) {
    return normQuest({ id: nextId(s), name: o.name, icon: o.icon, type: o.type, stat: o.stat, diff: o.diff, days: o.days, cap: o.cap, rest: o.rest, home: o.home, min: o.min, aliases: ALIASES[o.name] ? ALIASES[o.name].slice() : [] });
  }

  function normQuest(q) {
    q.id = Number(q.id);
    q.name = String(q.name || 'Untitled quest').slice(0, 80);
    q.icon = String(q.icon || '•').slice(0, 8);
    if (TYPES.indexOf(q.type) < 0) q.type = 'daily';
    if (STATS.indexOf(q.stat) < 0) q.stat = 'DIS';
    q.diff = clampDiff(q.diff);
    const d = Array.isArray(q.days) && q.days.length === 7 ? q.days : [1, 1, 1, 1, 1, 1, 1];
    q.days = d.map((v) => (v ? 1 : 0));
    q.cap = Math.max(0, Math.min(20, q.cap | 0));
    q.rest = q.type === 'habit' || q.type === 'daily' ? Math.max(0, Math.min(365, q.rest | 0)) : 0; // comes round every N days (0: any day); 2.27: dailies too, to a year
    q.count = q.count | 0;
    q.countOn = q.countOn || null;
    q.doneOn = q.doneOn || null;
    q.archived = !!q.archived;
    q.home = HOME[q.home] ? q.home : null;
    q.core = !!q.core;
    q.min = typeof q.min === 'string' ? q.min.trim().slice(0, 60) : '';
    q.buff = typeof q.buff === 'string' && /^[A-Za-z]{2,8}$/.test(q.buff) ? q.buff : null;
    q.aliases = Array.isArray(q.aliases) ? q.aliases.map((a) => String(a).toLowerCase().trim().slice(0, 60)).filter((a, i, l) => a && l.indexOf(a) === i).slice(-16) : [];
    remindNorm(q);
    awayNorm(q);   // 2.27
    q.longOff = !!q.longOff;
    if (q.hint && !(q.hint.days >= 1 && q.hint.days <= 365)) delete q.hint;
    if (q.hideAsk !== 'no') delete q.hideAsk;
    if (!/^(oracle|rules|library|hand)$/.test(q.judged || '')) delete q.judged;
    return q;
  }

  // ---------- 2.25: "it's been too long" reminders ----------
  // Per quest, off unless he turns it on: q.remind = { d: remind once it's gone d days undone, rep: then every rep days
  // (0: just the once), from: the day it was turned on (counts as the last time, if it's never been done), snz: snoozed
  // until, ping: the day it was last in the phone's note }. The phone keeps its own pings and snoozes too (the note's
  // buttons can't reach the save safely while the app's open); those come in as `marks` and the later date wins.
  // Mirrored in Overdue.java: keep them the same.
  const REMIND_MAX = 12;
  const isDay = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const laterDay = (a, b) => (isDay(a) ? (isDay(b) && b > a ? b : a) : isDay(b) ? b : null);
  function remindNorm(q) {
    const r = q.remind;
    if (!r || typeof r !== 'object') { delete q.remind; return; }
    q.remind = { d: clampN(r.d | 0 || 3, 1, 365), rep: clampN(r.rep | 0, 0, 30), from: isDay(r.from) ? r.from : today(), snz: isDay(r.snz) ? r.snz : null, ping: isDay(r.ping) ? r.ping : null };
  }
  function remindState(s, q, t, marks) {
    const r = q && q.remind;
    if (!r || q.archived || (q.type === 'todo' && q.doneOn)) return null;
    const done = s.qlast && s.qlast[q.id], last = isDay(done) ? done : r.from;
    const m = marks || {}, ping = laterDay(r.ping, m.ping && m.ping[q.id]), snz = laterDay(r.snz, m.snz && m.snz[q.id]);
    const gap = Math.max(0, daysBetween(last, t)), over = gap >= r.d, snoozed = !!(snz && t < snz);
    // pinged since he last did it (and since it was turned on); a snooze that has run out wipes the slate, so it says so again
    const pinged = !!(ping && ping > last && ping >= r.from && !(snz && ping < snz && t >= snz));
    const due = over && !snoozed && (!pinged || (r.rep > 0 && daysBetween(ping, t) >= r.rep));
    return { id: q.id, q: q, name: q.name, icon: q.icon, gap: gap, d: r.d, rep: r.rep, last: last, done: isDay(done) ? done : null, over: over, snoozed: snoozed, snz: snz, ping: ping, due: due, left: Math.max(0, r.d - gap) };
  }
  const remindList = (s, t, marks) => s.quests.map((q) => remindState(s, q, t, marks)).filter(Boolean);
  const overdueList = (s, t, marks) => remindList(s, t, marks).filter((x) => x.over && !x.snoozed && !isAway(findQ(s, x.id), t)).sort((a, b) => b.gap - a.gap || a.id - b.id);
  const remindCount = (s) => s.quests.filter((q) => q.remind && !q.archived && !(q.type === 'todo' && q.doneOn)).length;
  // "Overdue: training 4d, mow lawn 9d, Cert IV 3d"
  const overdueLine = (list) => 'Overdue: ' + list.map((x) => x.name + ' ' + x.gap + 'd').join(', ');
  // How often he really does it, from its last dozen days: the median gap, plus a quarter of it (at least a day) for slack.
  function remindSuggest(s, q) {
    const h = ((s.qhist && s.qhist[q.id]) || []).slice(-12);
    if (h.length < 3) return null;
    const iv = [];
    for (let i = 1; i < h.length; i++) iv.push(daysBetween(h[i - 1], h[i]));
    iv.sort((a, b) => a - b);
    const mid = iv.length >> 1, every = iv.length % 2 ? iv[mid] : (iv[mid - 1] + iv[mid]) / 2;
    return { every: every, n: clampN(Math.round(every + Math.max(1, every / 4)), 2, 60), times: h.length };
  }
  const REMIND_DEFAULT = { daily: 3, habit: 7, todo: 3 };
  // on: false to turn it off. Returns an error string, or null.
  function remindSet(s, id, on, d, rep, t) {
    const q = findQ(s, id);
    if (!q) return 'No such quest';
    if (!on) { delete q.remind; return null; }
    if (!q.remind && remindCount(s) >= REMIND_MAX) return REMIND_MAX + ' reminders is the limit. Turn one off first';
    const sg = remindSuggest(s, q), keep = q.remind;
    q.remind = { d: d || (keep && keep.d) || (sg ? sg.n : q.type === 'habit' && q.rest > 1 ? q.rest : REMIND_DEFAULT[q.type] || 3), rep: rep != null ? rep : keep ? keep.rep : 0, from: keep ? keep.from : t || today(), snz: keep ? keep.snz : null, ping: keep ? keep.ping : null };
    remindNorm(q);
    return null;
  }
  // The last day on or before d that it was done, from its recent days (null if that's older than the dozen kept).
  function lastDoneBy(s, q, d) {
    const h = (s.qhist && s.qhist[q.id]) || [];
    for (let i = h.length - 1; i >= 0; i--) if (h[i] <= d) return h[i];
    return null;
  }
  // The week in review: each reminder that went overdue between ws and we (up to today), by the same rule as remindState,
  // day by day: { q, days: days it was overdue, max: the longest it got, still: overdue at the week's end (or now) }.
  function overdueWeek(s, ws, we, t) {
    const end = we < t ? we : t, out = [];
    s.quests.forEach((q) => {
      const r = q.remind;
      if (!r || q.archived) return;
      let days = 0, max = 0, still = false;
      for (let d = ws; d <= end; d = addDays(d, 1)) {
        if (d < r.from) continue;
        if (q.type === 'todo' && q.doneOn && q.doneOn <= d) { still = false; continue; }
        const gap = Math.max(0, daysBetween(lastDoneBy(s, q, d) || r.from, d));
        still = gap >= r.d;
        if (still) { days++; max = Math.max(max, gap); }
      }
      if (days) out.push({ q: q, id: q.id, days: days, max: max, still: still });
    });
    return out.sort((a, b) => b.days - a.days || b.max - a.max);
  }
  // Something with a rhythm that's gone well past it, with no reminder yet: offer one, set to the suggestion. One quest
  // at a time on Today, never one he's said no to in the last 60 days, and nothing once the 12 are taken.
  const SLIP_QUIET = 60;
  function slipOffers(s, t) {
    if (remindCount(s) >= REMIND_MAX) return [];
    const no = s.remindNo || {};
    return s.quests.map((q) => {
      if (q.archived || q.remind || q.type === 'todo' || isAway(q, t) || (q.away && daysBetween(q.away.back, t) < 7) || (no[q.id] && daysBetween(no[q.id], t) < SLIP_QUIET)) return null;
      const sg = remindSuggest(s, q), last = s.qlast && s.qlast[q.id];
      if (!sg || !isDay(last)) return null;
      const gap = daysBetween(last, t);
      if (gap < Math.max(sg.n + 1, Math.ceil(sg.every * 1.75))) return null;
      return { q: q, id: q.id, gap: gap, every: sg.every, n: sg.n, ratio: gap / Math.max(1, sg.every) };
    }).filter(Boolean).sort((a, b) => b.ratio - a.ratio || b.gap - a.gap);
  }
  function remindDecline(s, id, t) { if (!s.remindNo || typeof s.remindNo !== 'object') s.remindNo = {}; s.remindNo[id] = t || today(); }
  function remindSnooze(s, id, days, t) {
    const q = findQ(s, id);
    if (!q || !q.remind) return false;
    q.remind.snz = addDays(t || today(), clampN(days | 0, 1, 14));
    return true;
  }

  function fresh(t) {
    const s = { v: 1, seq: 0, created: t, hero: { name: randomName(), title: '' }, look: randomLook(), quests: [], rewards: [], log: [], inv: [], chests: 1, homeV: 2, chestsOpened: 0, claimed: 0, namesV: 2, libHidden: [] };
    DEFAULT_QUESTS.forEach((d) => {
      const o = { name: d[0], icon: d[1], type: d[2], stat: d[3], diff: d[4] };
      Object.assign(o, d[5] || {});
      s.quests.push(newQuest(s, o));
    });
    DEFAULT_REWARDS.forEach((r) => s.rewards.push({ id: nextId(s), name: r[0], icon: r[1], cost: r[2] }));
    return s;
  }

  function normalize(s, t) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.quests)) s = fresh(t);
    s.v = 1;
    s.hero = Object.assign({ name: 'Jake', title: '' }, s.hero || {});
    const num = { level: 1, xp: 0, gold: 0, chests: 0, streak: 0, bestStreak: 0, total: 0, seq: 1000 };
    Object.keys(num).forEach((k) => { if (typeof s[k] !== 'number' || !isFinite(s[k])) s[k] = num[k]; });
    if (s.level < 1) s.level = 1;
    ['lastActive', 'lastTraining'].forEach((k) => { if (typeof s[k] !== 'string') s[k] = null; });
    if (typeof s.created !== 'string') s.created = t;
    const st = s.stats || {};
    s.stats = {};
    STATS.forEach((k) => { s.stats[k] = Math.max(0, st[k] | 0); });
    ['log', 'inv', 'rewards'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    s.quests = s.quests.filter((q) => q && typeof q === 'object').map(normQuest);
    // Finished to-dos drop off after a month.
    s.quests = s.quests.filter((q) => !(q.type === 'todo' && q.doneOn && daysBetween(q.doneOn, t) > 30));
    const eq = s.eq || {};
    s.eq = {};
    SLOTS.forEach((sl) => { s.eq[sl] = eq[sl] != null && s.inv.some((i) => i.id === eq[sl]) ? eq[sl] : null; });
    s.settings = Object.assign({ nudge: true, nudgeDays: 3, oracleModel: 'claude-haiku-5-5', remind: true, remindHour: 18, overdue: true, overdueHour: 9, longHours: 9, backup: true, sound: true, calWrite: true, weather: true }, s.settings || {});
    if (s.weather && (typeof s.weather !== 'object' || typeof s.weather.max !== 'number')) delete s.weather;
    if (s.plan && (typeof s.plan !== 'object' || !Array.isArray(s.plan.ids))) delete s.plan;
    if (!s.roster || typeof s.roster !== 'object' || !s.roster.days) s.roster = null;
    let maxId = 0;
    s.quests.concat(s.inv, s.rewards).forEach((o) => { if (o.id > maxId) maxId = o.id; });
    if (s.seq < maxId) s.seq = maxId;
    s.look = normLook(s.look || randomLook());
    s.homeSeed = s.homeSeed && typeof s.homeSeed === 'object' ? s.homeSeed : {};
    if (!s.homeTally || typeof s.homeTally !== 'object') s.homeTally = { lastT: 0, counts: {} };
    if (typeof s.homeTally.lastT !== 'number') s.homeTally.lastT = 0;
    if (!s.homeTally.counts || typeof s.homeTally.counts !== 'object') s.homeTally.counts = {};
    if (!(s.homeV >= 1)) {
      s.quests.forEach((q) => { if (!q.home && HOME_MIGRATE[q.name]) q.home = HOME_MIGRATE[q.name]; });
      DEFAULT_QUESTS.forEach((d) => {
        if (HOME_ADD.indexOf(d[0]) < 0) return;
        const home = d[5].home;
        if (s.quests.some((q) => q.home === home)) return;
        const o = { name: d[0], icon: d[1], type: d[2], stat: d[3], diff: d[4] };
        Object.assign(o, d[5]);
        s.quests.push(newQuest(s, o));
      });
    }
    if (!(s.homeV >= 2)) {
      s.homeTally = { lastT: 0, counts: {} }; // recount from the log, now with training/study buckets
      if (typeof s.chestsOpened !== 'number') s.chestsOpened = s.inv.length;
      if (typeof s.claimed !== 'number') s.claimed = s.log.filter((e) => e.r).length;
    }
    s.homeV = 2;
    if (!(s.namesV >= 2)) {
      s.quests.forEach((q) => {
        const nn = RENAMED[q.name];
        if (!nn || s.quests.some((o) => o !== q && o.name === nn)) return;
        const old = q.name.toLowerCase();
        q.aliases = (q.aliases || []).filter((a) => a !== old).concat([old]).slice(-16);
        (ALIASES[nn] || []).forEach((a) => { if (q.aliases.indexOf(a) < 0 && q.aliases.length < 16) q.aliases.push(a); });
        q.name = nn;
        const rv = REVALUED[nn];
        if (rv && q.diff === rv[0]) q.diff = rv[1];
        if (nn === 'Mow the lawn' && !q.rest) q.rest = 7;
      });
      s.quests.forEach((q) => { if (q.name === 'Mow the lawn' && q.type === 'habit' && !q.rest) q.rest = 7; });
      s.namesV = 2;
    }
    if (!Array.isArray(s.libHidden)) s.libHidden = [];
    if (typeof s.since25 !== 'string') s.since25 = t; // the day 2.5 (grace, the tuned delve) first ran
    if (!s.decor || typeof s.decor !== 'object') s.decor = { owned: ['plant'], placed: { loungeF: 'plant' } };
    if (!Array.isArray(s.decor.owned)) s.decor.owned = [];
    s.decor.owned = s.decor.owned.filter((k, i, a) => DECOR[k] && a.indexOf(k) === i);
    const pl = s.decor.placed && typeof s.decor.placed === 'object' ? s.decor.placed : {};
    s.decor.placed = {};
    Object.keys(pl).forEach((sk) => { if (fits(pl[sk], sk) && s.decor.owned.indexOf(pl[sk]) >= 0 && !placedAt(s, pl[sk])) s.decor.placed[sk] = pl[sk]; });
    if (typeof s.chestsOpened !== 'number') s.chestsOpened = 0;
    // 2.23: the daily summary, filled in once from whatever the log still holds
    const noDaysYet = !s.days || typeof s.days !== 'object';
    settleNative(s, noDaysYet);   // 2.25: before the backfill, which would count them too
    if (noDaysYet) { s.days = {}; s.qlast = {}; (s.log || []).slice().reverse().forEach((e) => { if (e.q != null && e.d) dayNote(s, e.d, { id: e.q, stat: e.s }, e.x | 0, e.g | 0, 1); }); }
    if (!s.qlast || typeof s.qlast !== 'object') s.qlast = {};
    // 2.25, once: deeds from the calendar and the widget never reached s.days, s.qlast or s.qhist (2.23 to 2.24).
    // Every day the log fully covers is rebuilt from it; the oldest day in the log may be cut short, so it's left alone.
    if (!s.daysFix && Array.isArray(s.log)) {
      const L = s.log.filter((e) => e.q != null && isDay(e.d)), oldest = L.length ? L[L.length - 1].d : null;
      const keepD = s.days, keepH = s.qhist && typeof s.qhist === 'object' ? s.qhist : {};
      const by = {};
      L.forEach((e) => { if (e.d !== oldest) (by[e.d] = by[e.d] || []).push(e); });
      Object.keys(by).forEach((d) => { delete keepD[d]; });
      s.qhist = keepH;
      L.slice().reverse().forEach((e) => {
        if (by[e.d]) dayNote(s, e.d, { id: e.q, stat: e.s }, e.x | 0, e.g | 0, 1);
        else { if (!s.qlast[e.q] || s.qlast[e.q] < e.d) s.qlast[e.q] = e.d; const h = s.qhist[e.q] || (s.qhist[e.q] = []); if (h.indexOf(e.d) < 0) { h.push(e.d); h.sort(); } }
      });
      s.daysFix = 1;
    }
    if (!s.remindNo || typeof s.remindNo !== 'object' || Array.isArray(s.remindNo)) s.remindNo = {};
    Object.keys(s.remindNo).forEach((k) => { if (!isDay(s.remindNo[k]) || daysBetween(s.remindNo[k], t) >= SLIP_QUIET) delete s.remindNo[k]; });
    if (!s.qhist || typeof s.qhist !== 'object') s.qhist = {};
    Object.keys(s.qhist).forEach((k) => { const h = s.qhist[k]; if (!Array.isArray(h)) { delete s.qhist[k]; return; } s.qhist[k] = h.filter(isDay).sort().filter((d, i, a) => a.indexOf(d) === i).slice(-QHIST_MAX); });
    if (typeof s.claimed !== 'number') s.claimed = 0;
    if (!Array.isArray(s.goals)) s.goals = [];
    if (!s.trials || s.trials.week !== weekStart(t) || !Array.isArray(s.trials.list)) s.trials = makeTrials(s, t);
    // The herald (deeds from the Grindstone calendar). Java owns seen/news/unclaimed; we only tidy the shape.
    const hr = s.herald && typeof s.herald === 'object' ? s.herald : {};
    s.herald = Object.assign({ on: false, cal: -1, calName: '', since: 0, notify: true, last: 0 }, hr);
    ['seen', 'news', 'unclaimed'].forEach((k) => { if (!Array.isArray(s.herald[k])) s.herald[k] = []; });
    s.herald.unclaimed = s.herald.unclaimed.filter((u) => u && u.k && u.text);
    if (typeof s.herald.cal !== 'number') s.herald.cal = Number(s.herald.cal) >= 0 ? Number(s.herald.cal) : -1;
    if (!(s.heraldV >= 1)) {
      s.quests.forEach((q) => { if (!q.aliases.length && ALIASES[q.name]) q.aliases = ALIASES[q.name].slice(); });
      if (!s.quests.some((q) => /e-?mail|inbox/i.test(q.name))) {
        const d = DEFAULT_QUESTS.find((x) => x[0] === 'Clear the inbox');
        s.quests.push(newQuest(s, Object.assign({ name: d[0], icon: d[1], type: d[2], stat: d[3], diff: d[4] }, d[5])));
      }
    }
    s.heraldV = 1;
    // The estate. v1: everyone starts in the shabby default (Jake chose a fresh start).
    const es = s.estate && typeof s.estate === 'object' ? s.estate : {};
    s.estate = { tiers: es.tiers && typeof es.tiers === 'object' ? es.tiers : {}, wings: es.wings && typeof es.wings === 'object' ? es.wings : {}, spent: es.spent | 0, land: Math.max(0, Math.min(6, es.land | 0)) };
    s.estate.fin = es.fin && typeof es.fin === 'object' ? es.fin : {};
    if (!(s.estateV >= 1)) s.estate = { tiers: {}, wings: {}, spent: 0, land: 0 };
    s.estateV = 1;
    Object.keys(s.estate.tiers).forEach((k) => { if (!ESTATE[k]) delete s.estate.tiers[k]; else s.estate.tiers[k] = Math.max(0, Math.min(5, s.estate.tiers[k] | 0)); });
    Object.keys(s.estate.wings).forEach((k) => { if (!ESTATE[k] || !ESTATE[k].wing) delete s.estate.wings[k]; else s.estate.wings[k] = true; });
    if (!s.estate.fin) s.estate.fin = {};
    Object.keys(s.estate.fin).forEach((k) => {   // 2.20.1 finishes: { t: the level they were made for, own: [...], on }
      const F = s.estate.fin[k];
      if (!ESTATE[k] || !F || typeof F !== 'object') { delete s.estate.fin[k]; return; }
      const own = Array.isArray(F.own) ? F.own.filter((f, i, a) => FINISHES[f] && a.indexOf(f) === i) : [];
      s.estate.fin[k] = { t: F.t | 0, own: own, on: own.indexOf(F.on) >= 0 ? F.on : null };
    });
    if (s.settings) delete s.settings.homeStyle;   // 2.20.0's house-wide style, replaced by finishes bought piece by piece
    setEst(s);
    houseNorm(s);
    townNorm(s);
    restatSave(s);
    lifeNorm(s);
    weekliesFit(s, today());
    // the widget is shelved (2.9), so its to-do goes too
    s.quests.forEach((q) => { if (q.type === 'todo' && !q.doneOn && q.name === 'Put the Grindstone widget on my home screen') q.archived = true; });
    npcNorm(s, t);
    callingsNorm(s, t);
    if (!(s.lookV >= 1) && s.lookSet) s.lookAsk = true; // 2.1: a second go at his likeness, progress kept
    s.hero.title = title(s);
    if (!(s.fxV >= 1)) { s.fxV = 1; (s.inv || []).concat(SLOTS.map((sl) => s.eq && s.eq[sl]).filter(Boolean)).forEach((it) => { if (it && !it.fx && it.tier >= 2 && GEAR_FX[it.slot]) { const ks = Object.keys(GEAR_FX[it.slot]); it.fx = ks[(it.id | 0) % ks.length]; } }); } // pieces from before 2.9 get theirs
    asksNorm(s); s.npcs.forEach((n) => { n.bond = n.bond | 0; });
    if (s.trader && (typeof s.trader !== 'object' || !Array.isArray(s.trader.stock))) s.trader = null;
    seasonNorm(s, t);
    marksNorm(s);
    if (!(s.coreV >= 1)) { s.coreV = 1; s.quests.forEach((q) => { if (q.type === 'daily' && (q.home === 'birds' || /water/i.test(q.name))) q.core = true; }); } // living things and water don't take days off
    if (!(s.minV >= 1)) { // 2.8: a bare minimum for the ones that are easiest to skip
      s.minV = 1;
      const MIN = { 'Strength training': 'ten minutes, any lift', Swim: 'ten minutes in the water', Run: 'ten minutes, any pace', Study: 'ten minutes or one page', Read: 'one page', 'Cook a proper meal': 'anything not from a packet' };
      s.quests.forEach((q) => { if (!q.min && MIN[q.name]) q.min = MIN[q.name]; });
    }
    if (!s.trials.spent) s.trials.spent = [];
    weeklyTopUp(s, t, Date.now());
    if (root.G && root.G.homesNorm) root.G.homesNorm(s); // 2.24: the companions' homes in town (town.js)
    if (root.G && root.G.peopleNorm) root.G.peopleNorm(s, t); // 2.26: people from the calendar, and pets (people.js)
    // 2.27: what's put away, the holds kept for the callings, and the training hold the phone's nudge reads
    s.quests.forEach((q) => awayNorm(q, t));
    s.holdLog = (Array.isArray(s.holdLog) ? s.holdLog : []).filter((h) => h && isDay(h.from) && isDay(h.to) && h.to >= addDays(t, -70) && STATS.indexOf(h.stat) >= 0);
    s.trainQuiet = trainQuiet(s, t);
    if (s.trainQuiet && s.trainQuiet <= addDays(t, -60)) s.trainQuiet = null;
    return s;
  }

  // ---------- the herald ----------
  // A report the herald couldn't place: Jake picks the quest, and (optionally) we remember the wording.
  function heraldClaim(s, k, qid, learn, t, now) {
    const h = s.herald, i = h.unclaimed.findIndex((u) => u.k === k);
    const q = findQ(s, qid);
    if (i < 0 || !q) return null;
    const u = h.unclaimed[i];
    h.unclaimed.splice(i, 1);
    if (learn) {
      const a = String(u.text).toLowerCase().trim().slice(0, 60);
      if (a && q.aliases.indexOf(a) < 0) { q.aliases.push(a); if (q.aliases.length > 16) q.aliases.shift(); }
    }
    let got = 0, last = null;
    for (let c = 0; c < Math.max(1, u.n | 0); c++) {
      const r = complete(s, qid, t, now + c);
      if (!r) break;
      s.log[0].h = 1;
      got++; last = r;
    }
    return { got: got, r: last, q: q };
  }
  function heraldDismiss(s, k) {
    const i = s.herald.unclaimed.findIndex((u) => u.k === k);
    if (i >= 0) s.herald.unclaimed.splice(i, 1);
  }
  // ---------- the estate: every piece of the house has six tiers, busted to absurd ----------
  const TIER_WORDS = ['Busted', 'Plain', 'Decent', 'Fancy', 'Gilded', 'Absurd'];
  const TIER_COST = [0, 40, 120, 320, 1000, 3000];   // 2.23: the top two dearer (were 800 and 2000): late gold needs somewhere to go
  // 2.20.3: every new level of a piece (new art) needs the hero's level AND the stat that piece grows with, so each look gets lived
  // with for a while (and finishes are worth buying) before the next. Balanced play meets both about together; neglect a stat and
  // its rooms lag. Wings start at their own level and climb two levels a step behind it.
  // 2.23: spread over a year's levels (was 1, 2, 4, 7, 11, 16: a keen hero had every tier open in six weeks)
  const TIER_LEVEL = [1, 3, 8, 16, 28, 40];
  const TIER_STAT = [0, 20, 80, 220, 500, 1000];
  // which stat each piece grows with, and why (shown on its sheet)
  const EST_STAT = {
    walls: ['STR', 'the building work'], floors: ['END', 'the scrubbing'], fridge: ['VIT', 'eating well'], stove: ['VIT', 'cooking'], sink: ['DIS', 'the dishes'],
    ktable: ['VIT', 'sitting down to meals'], couch: ['VIT', 'resting properly'], armchair: ['INT', 'reading in it'], ctable: ['DIS', 'keeping it clear'],
    bed: ['VIT', 'sleep'], wardrobe: ['DIS', 'putting things away'], bedside: ['INT', 'reading before bed'], desk: ['INT', 'study and admin'],
    bag: ['END', 'rounds on it'], weights: ['STR', 'lifting'], aviary: ['DIS', 'feeding the birds'], yard: ['END', 'the yard work'],
    garage: ['STR', 'training'], pool: ['END', 'swimming'], shed: ['STR', 'building things'], garden: ['END', 'digging and weeding'],
    grill: ['VIT', 'cooking'], pond: ['DIS', 'keeping it clean'], tower: ['INT', 'planning'],
  };
  // What a given level of a piece asks for: hero level, and how much of its stat.
  function estateReq(k, t) {
    const d = ESTATE[k], es = EST_STAT[k] || ['DIS', ''];
    if (t <= 0) return { lvl: d.wing ? d.lvl : 1, st: es[0], sv: 0, for: es[1] };
    return { lvl: d.wing ? Math.max(TIER_LEVEL[t], d.lvl + 2 * t) : TIER_LEVEL[t], st: es[0], sv: TIER_STAT[t], for: es[1] };
  }
  // icon, name, area, price multiplier, six tier names. Wings are bought (their first tier), then upgraded the same way.
  const ESTATE = {
    walls: { icon: '🧱', name: 'Walls', area: 'house', mult: 1.6, tiers: ['Cracked plaster', 'Fresh paint', 'Wainscoting', 'Oxblood & brass', 'Marble & gold', 'Diamond-studded walls'] },
    floors: { icon: '🪵', name: 'Floors', area: 'house', mult: 1.6, tiers: ['Bare concrete', 'Cheap lino & carpet', 'Floorboards & tiles', 'Parquet & terracotta', 'Marble', 'Solid gold tiles'] },
    fridge: { icon: '🧊', name: 'Fridge', area: 'kitchen', mult: 1, tiers: ['Esky on the floor', 'Rattling bar fridge', 'Family fridge', 'French-door fridge', 'Gold-plated fridge', 'Diamond-encrusted fridge'] },
    stove: { icon: '🔥', name: 'Stove', area: 'kitchen', mult: 0.8, tiers: ['Camping burner on a crate', 'Second-hand stove', 'Gas cooktop', 'Chef’s range', 'Gilded range', 'Diamond-studded inferno'] },
    sink: { icon: '🚰', name: 'Sink', area: 'kitchen', mult: 0.8, tiers: ['Bucket on milk crates', 'Laminate sink', 'Kitchen sink', 'Butler’s sink', 'Solid gold sink', 'Diamond basin, gold taps'] },
    ktable: { icon: '🍽️', name: 'Dining table', area: 'kitchen', mult: 0.8, tiers: ['Camping table', 'Wobbly table', 'Kitchen table', 'Farmhouse table', 'Gilded banquet table', 'Diamond-crusted dining table'] },
    couch: { icon: '🛋️', name: 'Couch', area: 'lounge', mult: 1, tiers: ['Couch off the verge', 'Op-shop couch', 'Comfy couch', 'Velvet chesterfield', 'Gilded chaise', 'Diamond-studded throne sofa'] },
    armchair: { icon: '🪑', name: 'Armchair', area: 'lounge', mult: 0.7, tiers: ['Camping chair', 'Saggy armchair', 'Armchair', 'Wingback', 'Gilded wingback', 'Diamond recliner'] },
    ctable: { icon: '🫖', name: 'Coffee table', area: 'lounge', mult: 0.6, tiers: ['Cable drum', 'Pine coffee table', 'Coffee table', 'Walnut coffee table', 'Gold coffee table', 'Diamond coffee table'] },
    bed: { icon: '🛏️', name: 'Bed', area: 'bedroom', mult: 1, tiers: ['Mattress on the floor', 'Squeaky single', 'Double bed', 'Four-poster', 'Gilded four-poster', 'Diamond-crusted royal bed'] },
    wardrobe: { icon: '🚪', name: 'Wardrobe', area: 'bedroom', mult: 0.7, tiers: ['Cardboard boxes', 'Flat-pack wardrobe', 'Wardrobe', 'Oak armoire', 'Gilded armoire', 'Diamond armoire'] },
    bedside: { icon: '🕯️', name: 'Bedside table', area: 'bedroom', mult: 0.5, tiers: ['Upturned crate', 'Flat-pack bedside', 'Bedside table', 'Marble-top nightstand', 'Gilded nightstand', 'Diamond nightstand'] },
    desk: { icon: '📜', name: 'Desk', area: 'study', mult: 0.9, tiers: ['Door on two crates', 'Folding desk', 'Desk', 'Writing bureau', 'Gilded bureau', 'Diamond command desk'] },
    bag: { icon: '🥊', name: 'Punching bag', area: 'gym', mult: 0.8, tiers: ['Sack of spuds on a rope', 'Old heavy bag', 'Heavy bag', 'Pro bag on a frame', 'Gold-leaf bag', 'Diamond-studded bag'] },
    weights: { icon: '🏋️', name: 'Weights', area: 'gym', mult: 0.9, tiers: ['Paint tins on a broomstick', 'Rusty dumbbells', 'Bench & dumbbells', 'Full rack', 'Gold-plated iron', 'Diamond-encrusted iron'] },
    aviary: { icon: '🦜', name: 'Aviary', area: 'yard', mult: 1.2, tiers: ['Rusty cage with a tarp', 'Wire cage', 'Aviary', 'Cedar aviary', 'Gilded aviary', 'Diamond palace aviary'] },
    yard: { icon: '🌿', name: 'Yard & fence', area: 'yard', mult: 1.3, tiers: ['Dust bowl, broken fence', 'Patchy lawn', 'Lawn & picket fence', 'Garden lights & hedges', 'Marble paths, gold-capped fence', 'Diamond paths, golden fence'] },
    // expansions
    garage: { icon: '🏗️', name: 'Garage gym', area: 'wings', wing: true, lvl: 4, unlock: 300, mult: 1.4, note: 'The gym moves out of the study into its own building.', tiers: ['Leaky lean-to', 'Tin garage', 'Brick garage gym', 'Pro gym', 'Gilded gym', 'Diamond gym'] },
    pool: { icon: '🏊', name: 'Backyard pool', area: 'wings', wing: true, lvl: 9, unlock: 250, mult: 1.4, note: 'He floats in it after you log a swim.', tiers: ['Inflatable kiddie pool', 'Above-ground pool', 'In-ground pool', 'Resort pool', 'Gold-tiled pool', 'Diamond infinity pool'] },
    shed: { icon: '🔨', name: 'Shed & workshop', area: 'wings', wing: true, lvl: 2, unlock: 150, mult: 1.2, note: 'Where the reno work happens.', tiers: ['Pallet lean-to', 'Tin shed', 'Timber shed', 'Workshop', 'Gilded workshop', 'Diamond workshop'] },
    garden: { icon: '🥕', name: 'Bigger lot & garden', area: 'wings', wing: true, lvl: 6, unlock: 400, mult: 1.4, note: 'More land out the front: veggie beds, and room for more.', tiers: ['Weedy patch', 'Veggie beds', 'Kitchen garden', 'Orchard', 'Gilded orchard', 'Diamond topiary garden'] },
    grill: { icon: '🍖', name: 'Outdoor kitchen', area: 'wings', wing: true, lvl: 12, unlock: 300, mult: 1.3, needs: 'garden', note: 'Needs the bigger lot.', tiers: ['Brick BBQ on the dirt', 'Kettle BBQ & esky', 'Outdoor kitchen', 'Deck & pizza oven', 'Gilded pizza oven', 'Diamond-encrusted pizza oven'] },
    pond: { icon: '🐟', name: 'Koi pond', area: 'wings', wing: true, lvl: 15, unlock: 350, mult: 1.3, needs: 'garden', note: 'Needs the bigger lot.', tiers: ['Puddle with one goldfish', 'Small pond', 'Koi pond', 'Japanese garden pond', 'Gold-lined pond', 'Diamond pond, golden koi'] },
    tower: { icon: '🗼', name: 'Watchtower', area: 'wings', wing: true, lvl: 20, unlock: 600, mult: 1.6, needs: 'garden', note: 'Needs the bigger lot. Purely for brooding.', tiers: ['Rickety platform', 'Timber lookout', 'Stone watchtower', 'Bannered keep', 'Gilded spire', 'Diamond spire with a beacon'] },
  };
  const ESTATE_AREAS = [['house', 'The house'], ['kitchen', 'Kitchen'], ['lounge', 'Lounge'], ['bedroom', 'Bedroom'], ['study', 'Study'], ['gym', 'Gym'], ['yard', 'Yard'], ['wings', 'Expansions']];
  function estateTier(s, k) { const d = ESTATE[k]; if (d.wing && !s.estate.wings[k]) return -1; return s.estate.tiers[k] | 0; }
  // What the next step costs, and whether it can be bought now.
  function estateNext(s, k) {
    const d = ESTATE[k], cur = estateTier(s, k), nt = cur + 1;
    if (nt > 5) return { tier: 6, max: true };
    let cost = d.wing && cur < 0 ? d.unlock : Math.round(TIER_COST[nt] * d.mult / 5) * 5;
    const rq = estateReq(k, Math.max(0, nt)), lvl = rq.lvl, have = s.stats[rq.st] | 0;
    let why = null, lock = null;
    if (d.needs && !s.estate.wings[d.needs]) { why = 'Needs the ' + ESTATE[d.needs].name.toLowerCase() + ' first'; lock = 'needs'; }
    else if (s.level < lvl) { why = 'Reach level ' + lvl; lock = 'level'; }
    else if (have < rq.sv) { why = 'Needs ' + rq.sv + ' ' + STAT_INFO[rq.st].name + ' (you have ' + have + ')'; lock = 'stat'; }
    else if (s.gold < cost) { why = 'Need ' + (cost - s.gold) + ' more gold'; lock = 'gold'; }
    return { tier: Math.max(0, nt), name: d.tiers[Math.max(0, nt)], cost: cost, lvl: lvl, st: rq.st, sv: rq.sv, have: have, lock: lock, ok: !why, why: why, unlock: d.wing && cur < 0 };
  }
  function buyEstate(s, k) {
    const n = estateNext(s, k);
    if (n.max || !n.ok) return null;
    s.gold -= n.cost;
    if (n.unlock) { s.estate.wings[k] = true; s.estate.tiers[k] = 0; } else s.estate.tiers[k] = n.tier;
    s.estate.spent = (s.estate.spent | 0) + n.cost;
    setEst(s);
    houseSettle(s);
    return n;
  }
  // 2.20.1: finishes. Once a piece is at a level, the same art can be bought in other colours (recolor.js does the work).
  // They belong to that level: an upgrade brings new art and a fresh set, so a cheap finish bought early can't ride up.
  // Grades wear the rarity colours, and the grander ones are a touch brighter and richer, the way rarer gear is.
  // s: per material family (wood, stone/metal, cloth; green and water are left alone so plants stay plants) — see recolor.js.
  const FINISHES = {
    limed: { n: 'Limed', g: 1, note: 'Pale, washed timber', s: { wood: { s: 0.35, v: 1.18 }, cloth: { s: 0.8 } } },
    walnut: { n: 'Walnut', g: 1, note: 'Dark stained wood, warmer stone', s: { wood: { dh: -0.012, s: 1.08, v: 0.68 }, stone: { h: 0.075, ds: 0.07, v: 0.9 } } },
    honey: { n: 'Honey oak', g: 1, note: 'Light, warm wood', s: { wood: { dh: 0.01, s: 0.92, v: 1.14 }, stone: { v: 1.05 } } },
    sage: { n: 'Sage', g: 2, note: 'Green-grey paint', s: { wood: { h: 0.27, s: 0.5, v: 0.95 }, stone: { h: 0.3, ds: 0.06 }, cloth: { dh: -0.05 } } },
    sea: { n: 'Sea glass', g: 2, note: 'Teal paint and driftwood', s: { wood: { h: 0.52, s: 0.5, v: 0.97 }, stone: { h: 0.5, ds: 0.07 }, cloth: { dh: 0.14 } } },
    slate: { n: 'Slate', g: 2, note: 'Blue-grey and cool', s: { wood: { h: 0.6, s: 0.3, v: 0.8 }, stone: { h: 0.6, ds: 0.06, v: 0.95 } } },
    terracotta: { n: 'Terracotta', g: 2, note: 'Clay red, sun-baked', s: { wood: { dh: -0.03, s: 1.18, v: 0.92 }, stone: { h: 0.06, ds: 0.1, v: 1.02 }, cloth: { dh: 0.08 } } },
    dusk: { n: 'Dusk', g: 3, note: 'Violet lacquer', s: { wood: { h: 0.74, s: 0.55, v: 0.9 }, stone: { h: 0.7, ds: 0.1 }, cloth: { dh: -0.12 }, all: { s: 1.06 } } },
    oxblood: { n: 'Oxblood', g: 3, note: 'Deep red lacquer, dark brass', s: { wood: { h: 0.99, s: 1.1, v: 0.72 }, stone: { h: 0.1, ds: 0.18, v: 0.86 }, cloth: { h: 0.98, s: 1.1 }, all: { s: 1.06 } } },
    ebony: { n: 'Ebony & brass', g: 3, note: 'Near-black wood, brass fittings', s: { wood: { s: 0.5, v: 0.45 }, stone: { h: 0.11, ds: 0.3, v: 1.05 }, all: { s: 1.06 } } },
    gilt: { n: 'Gilt', g: 4, note: 'Gold leaf on everything that will take it', s: { wood: { h: 0.115, s: 1.35, v: 1.12 }, stone: { h: 0.12, ds: 0.42, v: 1.08 }, cloth: { s: 1.1, v: 1.02 }, all: { s: 1.08, v: 1.04 } } },
    royal: { n: 'Royal', g: 4, note: 'Purple and gold, as kings had it', s: { wood: { h: 0.78, s: 0.9, v: 0.8 }, stone: { h: 0.12, ds: 0.4, v: 1.08 }, cloth: { h: 0.78, s: 1.15 }, all: { s: 1.08, v: 1.03 } } },
  };
  const FIN_ORDER = ['limed', 'walnut', 'honey', 'sage', 'sea', 'slate', 'terracotta', 'dusk', 'oxblood', 'ebony', 'gilt', 'royal'];
  // m: the share of what the next level costs. Regal costs the upgrade itself: a fancier look while the next level is locked.
  const FIN_GRADE = [null, { n: 'Plain', m: 0.15 }, { n: 'Fine', m: 0.3 }, { n: 'Grand', m: 0.6 }, { n: 'Regal', m: 1 }];
  function finishCost(s, k, f) {
    const d = ESTATE[k], t = estateTier(s, k);
    if (!d || t < 0 || !FINISHES[f]) return null;
    // priced off the next level: Regal costs what the upgrade would, so gold held while a level is locked has somewhere to go
    const basis = t >= 5 ? TIER_COST[5] * 1.5 * d.mult : TIER_COST[t + 1] * d.mult;
    return Math.max(5, Math.round(basis * FIN_GRADE[FINISHES[f].g].m / 5) * 5);
  }
  // A piece's finishes at the level it's at now (an older level's are gone with the old art).
  function finishState(s, k) { const t = estateTier(s, k), F = s.estate.fin && s.estate.fin[k]; return F && F.t === t ? { t: t, own: F.own.slice(), on: F.on } : { t: t, own: [], on: null }; }
  function finishList(s, k) {
    const F = finishState(s, k);
    return FIN_ORDER.map((f) => Object.assign({ k: f, cost: finishCost(s, k, f), own: F.own.indexOf(f) >= 0, on: F.on === f }, FINISHES[f]));
  }
  function buyFinish(s, k, f) {
    const d = ESTATE[k], F = finishState(s, k);
    if (!d || !FINISHES[f]) return { err: 'No such finish' };
    if (F.t < 0) return { err: 'Build it first' };
    if (F.own.indexOf(f) >= 0) { F.on = f; s.estate.fin[k] = F; return { cost: 0, had: true }; }
    const c = finishCost(s, k, f);
    if (s.gold < c) return { err: 'Need ' + (c - s.gold) + ' more gold' };
    s.gold -= c; s.estate.spent = (s.estate.spent | 0) + c;
    F.own.push(f); F.on = f; s.estate.fin[k] = F;
    return { cost: c };
  }
  // Wear an owned finish, or null for the piece as built.
  function setFinish(s, k, f) { const F = finishState(s, k); if (F.t < 0 || (f && F.own.indexOf(f) < 0)) return false; F.on = f || null; s.estate.fin[k] = F; return true; }
  function finishesOn(s) { const o = {}; Object.keys(s.estate.fin || {}).forEach((k) => { if (!ESTATE[k]) return; const F = finishState(s, k); if (F.on) o[k] = F.on; }); return o; }

  // Something's just come into play (a wing, a bigger sprite): if it now lands on something, shuffle it to a free spot, or put it in storage.
  function houseSettle(s) {
    const keep = [], G = houseGeom(s.house, landOf(s).lv ? landOf(s) : true), live = houseLive(s);
    s.house.items.slice().forEach((it) => {
      if (!live[it.id]) { keep.push(it); return; }
      if (!whyNot(s, it, it.x, it.y, it.id, { geom: G, lot: true, items: keep, live: live })) { keep.push(it); return; }
      const prev = s.house.items;
      s.house.items = keep.concat(prev.filter((t) => t !== it && keep.indexOf(t) < 0 && !live[t.id]));
      const spot = findSpot(s, it, [it.x, it.y]);
      s.house.items = prev;
      if (spot) { it.x = spot[0]; it.y = spot[1]; keep.push(it); }
    });
    s.house.items = keep;
  }
  function estateFor3D(s) {
    const t = {}, w = {};
    Object.keys(ESTATE).forEach((k) => { if (ESTATE[k].wing) { if (s.estate.wings[k]) { w[k] = true; t[k] = s.estate.tiers[k] | 0; } } else t[k] = s.estate.tiers[k] | 0; });
    return { t: t, w: w, land: landOf(s), f: finishesOn(s) };
  }

  // ---------- the hearth in 3D, and the widget ----------
  // 0 = pristine, 1 = dire, per chore; reno = restoration rank.
  // How bad it looks, in steps: spotless until it's due, then visibly behind, worse halfway to afflicted, and at its worst once afflicted.
  // (A lawn mown a fortnight ago still looks mown; it doesn't creep up from the day after.)
  function neglectOf(h, def) {
    if (!h || !h.linked || h.days == null) return 0;
    const a = def.th[0], b = def.th[1], x = h.days;
    return x >= b ? 1 : x >= (a + b) / 2 ? 0.72 : x >= a ? 0.45 : 0;
  }
  function houseLevels(s, t) {
    const hs = homeState(s, t), o = {};
    ['lawn', 'birds', 'aviary', 'fridge', 'dishes', 'laundry', 'gym', 'study'].forEach((k) => { o[k] = Math.round(neglectOf(hs[k], HOME[k] || HOME_AUTO[k]) * 100) / 100; });
    o.reno = hs.reno.linked ? hs.reno.stage : 3;
    o.dire = {};   // 2.27: the nightmare stage, for the house to draw
    Object.keys(hs).forEach((k) => { if (hs[k] && hs[k].dire) o.dire[k] = true; });
    return o;
  }
  // What the hero carries, from what's equipped. Two-handers leave the off hand empty.
  function heroGear(s) {
    const cls = s.look.cls || 'knight', w = itemById(s, s.eq.weapon), hd = itemById(s, s.eq.head), bd = itemById(s, s.eq.body);
    let main = null, off = null;
    if (w) {
      const two = w.base === 'Greatsword' || w.art === 'polearm' || w.art === 'staff';
      if (cls === 'knight') { main = two ? 'great' : 'sword'; off = two ? null : w.base === 'Dirk' || w.base === 'Rapier' ? 'blade' : w.art === 'blunt' ? 'round' : 'shield'; }
      else if (cls === 'barbarian') { main = two ? 'great' : 'axe'; off = two ? null : w.art === 'axe' ? 'axe' : 'round'; }
      else if (cls === 'mage') { main = two ? 'staff' : 'wand'; off = two ? null : 'book'; }
      else { main = two ? 'great' : w.art === 'blade' ? 'knife' : 'crossbow'; off = main === 'knife' ? 'knife' : null; }
    }
    return { hat: !!hd, cape: !!bd, main: main, off: off };
  }
  function widgetSig(s, t) { return JSON.stringify([houseLevels(s, t), s.house.rooms, s.house.doors, s.house.items, s.npcs.filter((n) => n.status === 'resident'), s.look, s.eq, estateFor3D(s)]); }

  // The widget's three stats. Slacking (anything afflicted, or two things building): what's been left longest.
  // Doing well: what you've been doing. Mirrored in Omens.java, so keep the two in step (test/omens.js checks).
  const OMEN_KEYS = ['lawn', 'birds', 'aviary', 'fridge', 'dishes', 'laundry', 'gym', 'study'];
  function shortName(n) { n = String(n || ''); return n.length > 22 ? n.slice(0, 21).trim() + '…' : n; }
  function widgetOmens(s, t) {
    const hs = homeState(s, t), feats = [];
    OMEN_KEYS.forEach((k, i) => {
      const h = hs[k];
      if (!h || !h.linked) return;
      const def = HOME[k] || HOME_AUTO[k];
      feats.push({ i: i, h: h, def: def, ratio: h.days / def.th[1] });
    });
    const worst = (a, b) => (b.ratio - a.ratio) || (b.h.days - a.h.days) || (a.i - b.i);
    const building = feats.filter((f) => f.h.state >= 1);
    if (building.some((f) => f.h.state === 2) || building.length >= 2) {
      return { mode: 'slack', items: feats.slice().sort(worst).slice(0, 3).map((f) => ({
        icon: f.def.icon, label: f.def.name, value: f.h.days + (f.h.days === 1 ? ' day' : ' days'), tone: f.h.state === 2 ? 'bad' : f.h.state === 1 ? 'warn' : 'ok' })) };
    }
    const items = [];
    const streak = shownStreak(s, t);
    if (streak >= 3) items.push({ icon: '🔥', label: 'Streak', value: streak + ' days', tone: 'good' });
    const week = addDays(t, -6), by = {}, order = [];
    s.log.forEach((e) => {
      if (e.q == null || e.r || !e.d || e.d < week || e.d > t) return;
      const k = String(e.q);
      if (!by[k]) { by[k] = { n: 0, name: e.n, icon: e.i, last: e.t || 0 }; order.push(k); }
      by[k].n++;
    });
    order.map((k) => by[k]).filter((x) => x.n >= 2).sort((a, b) => (b.n - a.n) || (b.last - a.last))
      .forEach((x) => items.push({ icon: x.icon || '⚔', label: shortName(x.name), value: '×' + x.n + ' this week', tone: 'good' }));
    feats.filter((f) => f.h.known && f.h.days === 0 && !f.h.auto).forEach((f) => items.push({ icon: f.def.icon, label: f.def.name, value: 'tended today', tone: 'good' }));
    if (items.length < 3) items.push({ icon: '✦', label: 'Level ' + s.level, value: s.xp + '/' + need(s.level) + ' XP', tone: 'good' });
    if (items.length < 3) items.push({ icon: '◈', label: 'Gold', value: String(s.gold), tone: 'good' });
    if (items.length < 3) items.push({ icon: '⚔', label: 'Deeds done', value: String(s.total), tone: 'good' });
    return { mode: 'well', items: items.slice(0, 3) };
  }

  // ---------- the hearth's mind: what the hero frets over, and what he's pleased he did ----------
  // When a quest was last done (its own record, then the log, newest first).
  function questLast(s, q) {
    let best = q.type === 'habit' ? (q.count > 0 ? q.countOn : null) : q.doneOn;
    for (let i = 0; i < s.log.length; i++) { const e = s.log[i]; if (e.q === q.id) { if (!best || e.d > best) best = e.d; break; } }
    return best;
  }
  function heroMind(s, t) {
    const hs = homeState(s, t), chores = {};
    OMEN_KEYS.forEach((k) => {
      const h = hs[k];
      if (!h || !h.linked) return;
      const def = HOME[k] || HOME_AUTO[k];
      chores[k] = { icon: def.icon, name: def.name, state: h.state, level: Math.round(neglectOf(h, def) * 100) / 100, days: h.days, today: !!h.known && h.days === 0, dire: !!h.dire };
    });
    const seen = {}, done = [];
    s.log.forEach((e) => { if (e.q != null && !e.r && e.d === t && !seen[e.q]) { seen[e.q] = 1; done.push({ icon: e.i || '⚔', name: e.n }); } });
    const due = s.quests.filter((q) => !q.archived && q.type === 'daily' && dueOn(q, t) && q.doneOn !== t).map((q) => ({ icon: q.icon, name: q.name }));
    return { chores: chores, done: done.slice(0, 8), due: due.slice(0, 8) };
  }

  // ================= the house as Jake lays it out =================
  // The world is 34×27 tiles of 32px. A room is a rectangle: two rows of wall face along the top, then floor,
  // then a bottom row that's half floor, half wall. Doors are cells in a wall. Furniture sits on whole cells.
  const WT = 34, HT = 27;
  // 2.13: more land. Each step pushes the fence out, east then south, till it's an estate. The first one takes down the
  // fence between the plot and the side lot, so a house can run right across.
  const LANDS = [
    // 2.23: one every eight levels, the last at 48, and dearer as gold comes in faster (was levels 8 to 32)
    { name: 'The paddock next door', x1: 44, y1: 25, cost: 1500, lvl: 8 },
    { name: 'The back field', x1: 44, y1: 37, cost: 4000, lvl: 16 },
    { name: 'The long acre', x1: 56, y1: 37, cost: 8000, lvl: 24 },
    { name: 'The orchard block', x1: 56, y1: 49, cost: 14000, lvl: 32 },
    { name: 'The far paddocks', x1: 68, y1: 49, cost: 22000, lvl: 40 },
    { name: 'The whole estate', x1: 68, y1: 61, cost: 32000, lvl: 48 },
  ];
  function landOf(s) {
    const lv = Math.max(0, Math.min(LANDS.length, (s.estate && s.estate.land) | 0)), lot = !!(s.estate && s.estate.wings.garden);
    if (!lv || !lot) return { lv: 0, lot: lot, x1: 32, y1: 25, wt: WT, ht: HT };
    const L = LANDS[lv - 1];
    return { lv: lv, lot: true, x1: L.x1, y1: L.y1, wt: L.x1 + 2, ht: L.y1 + 2 };
  }
  function landNext(s) {
    const lv = landOf(s).lv;
    if (lv >= LANDS.length) return { max: true, lv: lv };
    const L = LANDS[lv];
    let why = null;
    if (!s.estate.wings.garden) why = 'Needs the bigger lot first';
    else if (s.level < L.lvl) why = 'Reach level ' + L.lvl;
    else if (s.gold < L.cost) why = 'Need ' + (L.cost - s.gold) + ' more gold';
    return { lv: lv + 1, name: L.name, cost: L.cost, lvl: L.lvl, ok: !why, why: why, w: L.x1, h: L.y1 };
  }
  function buyLand(s) {
    const n = landNext(s);
    if (n.max || !n.ok) return null;
    s.gold -= n.cost; s.estate.land = n.lv; s.estate.spent = (s.estate.spent | 0) + n.cost;
    return n;
  }
  // The fenced rectangle a tile sits in (for keeping a new room inside the fence).
  function landRect(s, x) {
    const L = landOf(s);
    if (L.lv) return { x0: 1, y0: 1, x1: L.x1, y1: L.y1 };
    return x >= LOT.x0 && L.lot ? LOT : PLOT;
  }
  const roomLimit = (s) => ROOM_LIMIT + 4 * landOf(s).lv;
  const PLOT = { x0: 1, y0: 1, x1: 23, y1: 25 }, LOT = { x0: 25, y0: 1, x1: 32, y1: 25 }, GATE = { x: 24, y0: 19, y1: 22 };
  const ROOM_STYLES = {
    house: { name: 'House', note: 'Walls and floors follow your estate upgrades' },
    timber: { name: 'Timber', wall: 'wall.timber', floor: 'floor.timber' },
    brick: { name: 'Brick', wall: 'wall.brick', floor: 'floor.2' },
    stone: { name: 'Stone', wall: 'wall.stone', floor: 'floor.3' },
    tin: { name: 'Tin and dirt', wall: 'wall.tin', floor: 'floor.dirt' },
    garage: { name: 'Garage', wing: 'garage', note: 'Follows the garage upgrades' },
    shed: { name: 'Shed', wing: 'shed', note: 'Follows the shed upgrades' },
  };
  // Furniture. at: in (indoors), out, any, wall. w,h: footprint in cells. s: sprite (est: tiered by the estate).
  // dy: nudges the sprite's base (px). use: where he stands to use it (cells from the footprint's top-left) and what he does.
  // tap: which thing sheet it opens. g: gold, if it's for sale. free: given by progress (reno rank, yard tier, a wing).
  const FURN_RAW = {
    // the kitchen
    fridge: { n: 'Fridge', i: '🧊', c: 'core', at: 'in', w: 2, h: 1, est: 'fridge', dy: 2, fill: 1, tap: 'fridge', feat: 'fridge', use: { x: 0, y: 1, d: 'up', a: 'idle', i: '🧀', l: 0.9 } },
    stove: { n: 'Stove', i: '🔥', c: 'core', at: 'in', w: 2, h: 1, est: 'stove', dy: 2, fill: 1, tap: 'stove', use: { x: 0, y: 1, d: 'up', a: 'thrust', i: '🍳', l: 0.9 } },
    sink: { n: 'Sink', i: '🚰', c: 'core', at: 'in', w: 2, h: 1, est: 'sink', dy: 2, fill: 1, tap: 'sink', feat: 'dishes', use: { x: 0, y: 1, d: 'up', a: 'thrust', i: '🧽', l: 0.5 } },
    ktable: { n: 'Dining table', i: '🍽️', c: 'core', at: 'in', w: 3, h: 2, est: 'ktable', dy: -6, tap: 'ktable', use: { x: 1, y: -1, d: 'down', a: 'sit', f: 2, seat: [0, -26], i: '🥣', l: 0.8 }, seats: 1 },
    dishshelf: { n: 'Dish rack', i: '🍽️', c: 'core', at: 'in', w: 1, h: 1, s: 'dishshelf', tap: 'sink' },
    counter: { n: 'Bench top', i: '🪵', c: 'furn', at: 'in', w: 1, h: 1, s: 'counter', g: 15, free: { reno: 0, n: 1 } },
    // the lounge
    fireplace: { n: 'Fireplace', i: '🔥', c: 'core', at: 'wall', w: 4, s: 'fireplace', dy: 30, block: 1, tap: 'fireplace', light: 70, fire: 1 },
    couch: { n: 'Couch', i: '🛋️', c: 'core', at: 'in', w: 4, h: 1, est: 'couch', dy: 4, tap: 'couch', use: { x: 2, y: 1, d: 'up', a: 'sit', f: 1, seat: [0, -13], i: '🔥', l: 3 } },
    armchair: { n: 'Armchair', i: '🪑', c: 'core', at: 'in', w: 1, h: 1, est: 'armchair', dy: -2, tap: 'armchair', use: { x: 0, y: 1, d: 'down', a: 'sit', f: 2, seat: [0, 5], i: '🍵', l: 1.4 } },
    ctable: { n: 'Coffee table', i: '🫖', c: 'core', at: 'in', w: 2, h: 1, est: 'ctable', dy: -12, tap: 'ctable' },
    renojob: { n: 'The restoration', i: '🔨', c: 'core', at: 'in', w: 2, h: 1, s: 'ladder', dy: 4, tap: 'reno', feat: 'reno', reno: 1, use: { x: 1, y: 1, d: 'up', a: 'slash', i: '🔨', l: 0.5 } },
    torch: { n: 'Wall torch', i: '🕯️', c: 'wall', at: 'wall', w: 1, s: 'torch', dy: -20, light: 30, g: 20, free: { reno: 0, n: 2 } },
    window: { n: 'Window', i: '🪟', c: 'wall', at: 'wall', w: 1, s: 'window', dy: -10, g: 30, free: { reno: 0, n: 2 } },
    // the bedroom
    bed: { n: 'Bed', i: '🛏️', c: 'core', at: 'in', w: 3, h: 4, est: 'bed', dy: -8, tap: 'bed', use: { x: 0, y: 2, in: 1, d: 'down', a: 'sit', f: 2, seat: [0, 2], i: '💤', l: 1 } },
    wardrobe: { n: 'Wardrobe', i: '🚪', c: 'core', at: 'in', w: 2, h: 1, est: 'wardrobe', dy: 2, tap: 'wardrobe', use: { x: 1, y: 1, d: 'up', a: 'idle', i: '👕', l: 0.3 } },
    bedside: { n: 'Bedside table', i: '🕯️', c: 'core', at: 'in', w: 1, h: 1, est: 'bedside', dy: -2, tap: 'bedside' },
    // the study (and the gym, until there's a garage)
    desk: { n: 'Desk', i: '📜', c: 'core', at: 'in', w: 4, h: 1, est: 'desk', dy: 2, tap: 'desk', feat: 'study', use: { x: 2, y: 1, d: 'up', a: 'sit', f: 1, seat: [0, 8], i: '✍️', l: 1 } },
    bookshelf: { n: 'Bookshelf', i: '📚', c: 'core', at: 'in', w: 2, h: 1, s: 'bookshelf', tap: 'bookshelf', feat: 'study', use: { x: 1, y: 1, d: 'up', a: 'idle', i: '📖', l: 1.2 } },
    bag: { n: 'Punching bag', i: '🥊', c: 'core', at: 'any', w: 1, h: 1, est: 'bag', dy: -6, tap: 'bag', feat: 'gym', use: { x: 1, y: 0, d: 'left', a: 'slash', i: '🥊', l: 0.8 } },
    weights: { n: 'Weights', i: '🏋️', c: 'core', at: 'any', w: 2, h: 1, est: 'weights', dy: -2, tap: 'weights', feat: 'gym', use: { x: 0, y: 0, in: 1, d: 'down', a: 'spellcast', i: '🏋️', l: 0.8 } },
    // the laundry
    washer: { n: 'Washing machine', i: '🧺', c: 'core', at: 'in', w: 1, h: 1, s: 'washer', tap: 'laundry', feat: 'laundry', use: { x: 0, y: 1, d: 'up', a: 'spellcast', i: '🧺', l: 0.4 } },
    basket: { n: 'Washing basket', i: '🧺', c: 'core', at: 'in', w: 1, h: 1, s: 'basket', dy: 2, tap: 'laundry' },
    mirror: { n: 'Mirror', i: '🪞', c: 'furn', at: 'in', w: 1, h: 1, s: 'mirror', g: 40, free: { reno: 0, n: 1 } },
    // the yard
    line: { n: 'Washing line', i: '👕', c: 'core', at: 'out', w: 4, h: 1, s: 'line', dy: -8, tap: 'laundry', feat: 'laundry', use: { x: 2, y: 1, d: 'up', a: 'spellcast', i: '👕', l: 0.4 } },
    aviary: { n: 'Aviary', i: '🦜', c: 'core', at: 'out', w: 4, h: 3, est: 'aviary', dy: -2, tap: 'aviary', feat: 'birds', cage: 1, use: { x: 4, y: 1, d: 'left', a: 'thrust', i: '🦜', l: 1.4 } },
    tree: { n: 'Tree', i: '🌳', c: 'out', at: 'out', w: 2, h: 1, s: 'tree.*', dy: -12, g: 30, free: { reno: 0, n: 2 } },
    bush: { n: 'Shrub', i: '🌿', c: 'out', at: 'out', w: 1, h: 1, s: 'bush.*', g: 10 },
    hedge: { n: 'Hedge', i: '🌲', c: 'out', at: 'out', w: 1, h: 1, s: 'hedge', dy: -4, g: 20, free: { yard: 3, n: 2 } },
    gardenlamp: { n: 'Garden lamp', i: '🏮', c: 'out', at: 'out', w: 1, h: 1, s: 'gardenlamp', dy: 4, light: 34, g: 30, free: { yard: 3, n: 2 } },
    stones: { n: 'Stepping stones', i: '🪨', c: 'out', at: 'out', w: 1, h: 1, s: 'stones', flat: 1, g: 5, free: { reno: 0, n: 2 } },
    rock: { n: 'Rock', i: '🪨', c: 'out', at: 'out', w: 1, h: 1, s: 'rock', g: 5 },
    mat: { n: 'Doormat', i: '🟫', c: 'furn', at: 'any', w: 1, h: 1, s: 'mat', flat: 1, dy: -9, g: 5, free: { reno: 0, n: 2 } },
    // the restoration turns these up
    rug: { n: 'Rug', i: '🟥', c: 'furn', at: 'in', w: 5, h: 2, s: 'rug', flat: 1, g: 60, free: { reno: 2, n: 1 } },
    painting0: { n: 'Landscape', i: '🖼️', c: 'wall', at: 'wall', w: 3, s: 'painting.0', dy: -26, g: 60, free: { reno: 3, n: 1 } },
    painting1: { n: 'Still life', i: '🖼️', c: 'wall', at: 'wall', w: 2, s: 'painting.1', dy: -22, g: 45 },
    painting2: { n: 'Little portrait', i: '🖼️', c: 'wall', at: 'wall', w: 1, s: 'painting.2', dy: -22, g: 30, free: { reno: 3, n: 1 } },
    plant: { n: 'Pot plant', i: '🪴', c: 'furn', at: 'any', w: 1, h: 1, s: 'plant.0', dy: -4, g: 25, free: { reno: 4, n: 1 } },
    plant2: { n: 'Leafy plant', i: '🪴', c: 'furn', at: 'any', w: 1, h: 1, s: 'plant.1', dy: -4, g: 25 },
    lamp: { n: 'Floor lamp', i: '💡', c: 'furn', at: 'in', w: 1, h: 1, s: 'lamp', dy: -4, light: 30, g: 35, free: { reno: 4, n: 1 } },
    candelabra: { n: 'Candelabra', i: '🕯️', c: 'furn', at: 'in', w: 1, h: 1, s: 'candelabra', dy: 6, light: 26, g: 50, free: { reno: 5, n: 2 } },
    // furniture for sale
    chair: { n: 'Dining chair', i: '🪑', c: 'furn', at: 'any', w: 1, h: 1, s: 'chair.dining', g: 20, free: { reno: 0, n: 2 }, use: { x: 0, y: 0, in: 1, d: 'down', a: 'sit', f: 2, seat: [0, -3], front: 1, i: '☕', l: 0.6 } },
    greenchair: { n: 'Green chair', i: '🪑', c: 'furn', at: 'any', w: 1, h: 1, s: 'chair.green', g: 30, use: { x: 0, y: 0, in: 1, d: 'down', a: 'sit', f: 2, seat: [0, -3], front: 1, i: '☕', l: 0.6 } },
    sparebed: { n: 'Spare bed', i: '🛏️', c: 'furn', at: 'in', w: 2, h: 3, s: 'bed.1', dy: -4, g: 80, use: { x: 0, y: 2, in: 1, d: 'down', a: 'sit', f: 2, seat: [0, 0], i: '💤', l: 0.2 } },
    deskchair: { n: 'Desk chair', i: '🪑', c: 'furn', at: 'in', w: 1, h: 1, s: 'deskchair', g: 20 },
    roundtable: { n: 'Round table', i: '⚪', c: 'furn', at: 'any', w: 1, h: 1, s: 'table.round', g: 40 },
    smallshelf: { n: 'Narrow bookshelf', i: '📚', c: 'furn', at: 'in', w: 1, h: 1, s: 'bookshelf.small', g: 40, use: { x: 0, y: 1, d: 'up', a: 'idle', i: '📖', l: 0.5 } },
    clock: { n: 'Grandfather clock', i: '🕰️', c: 'furn', at: 'in', w: 1, h: 1, s: 'clock', g: 70 },
    chest: { n: 'Chest', i: '🧰', c: 'furn', at: 'any', w: 1, h: 1, s: 'chest', g: 60 },
    crate: { n: 'Crate', i: '📦', c: 'furn', at: 'any', w: 1, h: 1, s: 'crate', g: 5 },
    barrel: { n: 'Barrel', i: '🛢️', c: 'furn', at: 'any', w: 1, h: 1, s: 'barrel', g: 15 },
    throne: { n: 'Throne', i: '👑', c: 'furn', at: 'in', w: 1, h: 1, s: 'throne', g: 600, use: { x: 0, y: 0, in: 1, d: 'down', a: 'sit', f: 2, seat: [0, -4], front: 1, i: '👑', l: 0.8 } },
    walllamp: { n: 'Wall lamp', i: '💡', c: 'wall', at: 'wall', w: 1, s: 'walllamp', dy: -24, light: 26, g: 25 },
    // for Ruby and Kermit
    perch: { n: 'Perch stand', i: '🪵', c: 'bird', at: 'any', w: 1, h: 1, s: 'bird.perch', g: 40, perch: [[7, 5], [16, 5]] },
    playgym: { n: 'Play gym', i: '🎪', c: 'bird', at: 'any', w: 2, h: 1, s: 'bird.gym', g: 120, perch: [[12, 7], [28, 7], [17, 20]], toy: 1 },
    swing: { n: 'Swing', i: '🎠', c: 'bird', at: 'any', w: 1, h: 1, s: 'bird.swing', g: 30, perch: [[14, 20]], toy: 1, swingy: 1 },
    ladder: { n: 'Rope ladder', i: '🪜', c: 'bird', at: 'any', w: 1, h: 1, s: 'bird.ladder', g: 25, perch: [[10, 0], [10, 15]], toy: 1 },
    bell: { n: 'Bell toy', i: '🔔', c: 'bird', at: 'any', w: 1, h: 1, s: 'bird.bell', g: 15, perch: [[8, 2]], toy: 1, ring: 1 },
    forager: { n: 'Foraging box', i: '🧩', c: 'bird', at: 'any', w: 1, h: 1, s: 'bird.forager', g: 35, perch: [[13, 2]], toy: 1, food: 1 },
    birdbath: { n: 'Bird bath', i: '⛲', c: 'bird', at: 'any', w: 1, h: 1, s: 'bird.bath', g: 50, perch: [[5, 5], [20, 5]] },
    dish: { n: 'Food dish', i: '🥣', c: 'bird', at: 'any', w: 1, h: 1, s: 'bird.dish', dy: -10, g: 10, perch: [[7, 3]], food: 1, tap: 'aviary' },
    nightcage: { n: 'Night cage', i: '🌙', c: 'bird', at: 'in', w: 1, h: 1, s: 'bird.nightcage', g: 90, perch: [[18, 26]], night: 1, tap: 'aviary' },
    // ornaments
    birdhouse: { n: 'Birdhouse', i: '🏠', c: 'orn', at: 'out', w: 1, h: 1, s: 'orn.birdhouse', g: 45, perch: [[10, 1]] },
    // 2.7: more to save up for. Cosmetic only; lv is the level the merchant starts stocking it at. Sprites from tools2d/bake_extras.py.
    x_catbed: { n: 'Cat basket (and a cat)', i: '🐈', c: 'pet', at: 'any', w: 1, h: 1, s: 'x.catbed', g: 150, lv: 3, pet: 'cat', flat: 1 },
    x_kennel: { n: 'Kennel (and a dog)', i: '🐕', c: 'pet', at: 'out', w: 1, h: 1, s: 'x.kennel', g: 250, lv: 5, pet: 'dog' },
    x_coop: { n: 'Chook house (and a chook)', i: '🐔', c: 'pet', at: 'out', w: 1, h: 1, s: 'x.coop', g: 120, lv: 4, pet: 'chook' },
    x_hutch: { n: 'Hutch (and a rabbit)', i: '🐇', c: 'pet', at: 'any', w: 1, h: 1, s: 'x.hutch', g: 140, lv: 6, pet: 'rabbit' },
    x_duckhouse: { n: 'Duck house (and a duck)', i: '🦆', c: 'pet', at: 'out', w: 1, h: 1, s: 'x.duckhouse', g: 160, lv: 7, pet: 'duck' },
    x_lilypot: { n: 'Lily bowl (and a frog)', i: '🐸', c: 'pet', at: 'any', w: 1, h: 1, s: 'x.lilypot', g: 60, lv: 2, pet: 'frog' },
    x_books: { n: 'Stack of books', i: '📚', c: 'furn', at: 'any', w: 1, h: 1, s: 'x.books', g: 15 },
    x_candles: { n: 'Candles', i: '🕯️', c: 'furn', at: 'any', w: 1, h: 1, s: 'x.candles', g: 15 },
    x_vase: { n: 'Vase of flowers', i: '💐', c: 'furn', at: 'any', w: 1, h: 1, s: 'x.vase', g: 25 },
    x_cactus: { n: 'Cactus', i: '🌵', c: 'furn', at: 'any', w: 1, h: 1, s: 'x.cactus', g: 20 },
    x_beanbag: { n: 'Bean bag', i: '🫘', c: 'furn', at: 'in', w: 1, h: 1, s: 'x.beanbag', g: 45 },
    x_easel: { n: 'Easel', i: '🎨', c: 'furn', at: 'any', w: 1, h: 1, s: 'x.easel', g: 70 },
    x_telly: { n: 'Old telly', i: '📺', c: 'furn', at: 'in', w: 1, h: 1, s: 'x.telly', g: 110, lv: 3 },
    x_guitar: { n: 'Guitar', i: '🎸', c: 'furn', at: 'in', w: 1, h: 1, s: 'x.guitar', g: 90, lv: 4 },
    x_globe: { n: 'Globe', i: '🌍', c: 'fancy', at: 'in', w: 1, h: 1, s: 'x.globe', g: 60, lv: 4 },
    x_tank: { n: 'Fish tank', i: '🐠', c: 'fancy', at: 'in', w: 1, h: 1, s: 'x.tank', g: 120, lv: 6 },
    x_gametable: { n: 'Game table', i: '🎲', c: 'fancy', at: 'in', w: 1, h: 1, s: 'x.gametable', g: 90, lv: 5 },
    x_chess: { n: 'Chess table', i: '♟️', c: 'fancy', at: 'in', w: 1, h: 1, s: 'x.chess', g: 100, lv: 7 },
    x_bonsai: { n: 'Bonsai', i: '🌳', c: 'fancy', at: 'any', w: 1, h: 1, s: 'x.bonsai', g: 80, lv: 8 },
    x_anvil: { n: 'Anvil', i: '⚒️', c: 'fancy', at: 'any', w: 1, h: 1, s: 'x.anvil', g: 120, lv: 6 },
    x_cauldron: { n: 'Cauldron', i: '🧪', c: 'fancy', at: 'any', w: 1, h: 1, s: 'x.cauldron', g: 140, lv: 8 },
    x_scope: { n: 'Telescope', i: '🔭', c: 'fancy', at: 'any', w: 1, h: 1, s: 'x.scope', g: 200, lv: 9 },
    x_trophy: { n: 'Trophy', i: '🏆', c: 'fancy', at: 'any', w: 1, h: 1, s: 'x.trophy', g: 150, lv: 10 },
    x_armour: { n: 'Suit of armour', i: '🛡️', c: 'fancy', at: 'in', w: 1, h: 1, s: 'x.armour', g: 300, lv: 12 },
    x_egg: { n: 'Dragon egg', i: '🥚', c: 'fancy', at: 'any', w: 1, h: 1, s: 'x.egg', g: 999, lv: 20 },
    x_rugbear: { n: 'Hide rug', i: '🟫', c: 'furn', at: 'in', w: 2, h: 1, s: 'x.rugbear', g: 85, lv: 5, flat: 1 },
    x_rugblue: { n: 'Royal rug', i: '🟦', c: 'fancy', at: 'in', w: 2, h: 1, s: 'x.rugblue', g: 180, lv: 9, flat: 1 },
    x_banner: { n: 'Banner', i: '🚩', c: 'wall', at: 'wall', w: 1, h: 1, s: 'x.banner', g: 50, dy: -20 },
    x_shield: { n: 'Shield and swords', i: '🛡️', c: 'wall', at: 'wall', w: 1, h: 1, s: 'x.shield', g: 120, lv: 6, dy: -22 },
    x_fish: { n: 'Mounted fish', i: '🐟', c: 'wall', at: 'wall', w: 1, h: 1, s: 'x.fish', g: 60, lv: 3, dy: -26 },
    x_map: { n: 'World map', i: '🗺️', c: 'wall', at: 'wall', w: 2, h: 1, s: 'x.map', g: 70, lv: 4, dy: -22 },
    x_shelf: { n: 'Knick-knack shelf', i: '🪆', c: 'wall', at: 'wall', w: 2, h: 1, s: 'x.shelf', g: 80, lv: 5, dy: -26 },
    x_antlers: { n: 'Antlers', i: '🦌', c: 'wall', at: 'wall', w: 1, h: 1, s: 'x.antlers', g: 95, lv: 7, dy: -24 },
    x_flowerbed: { n: 'Flower bed', i: '🌷', c: 'out', at: 'out', w: 1, h: 1, s: 'x.flowerbed', g: 30 },
    x_pumpkins: { n: 'Pumpkin patch', i: '🎃', c: 'out', at: 'out', w: 1, h: 1, s: 'x.pumpkins', g: 35 },
    x_bench: { n: 'Garden bench', i: '🪑', c: 'out', at: 'out', w: 1, h: 1, s: 'x.bench', g: 40 },
    x_mailbox: { n: 'Letterbox', i: '📮', c: 'out', at: 'out', w: 1, h: 1, s: 'x.mailbox', g: 25 },
    x_signpost: { n: 'Signpost', i: '🪧', c: 'out', at: 'out', w: 1, h: 1, s: 'x.signpost', g: 30 },
    x_gnome: { n: 'Garden gnome', i: '🧙', c: 'orn', at: 'out', w: 1, h: 1, s: 'x.gnome', g: 45 },
    x_barrow: { n: 'Wheelbarrow', i: '🛒', c: 'out', at: 'out', w: 1, h: 1, s: 'x.barrow', g: 55 },
    x_campfire: { n: 'Campfire', i: '🔥', c: 'out', at: 'out', w: 1, h: 1, s: 'x.campfire', g: 60, lv: 3, light: 34 },
    x_birdtable: { n: 'Bird table', i: '🐦', c: 'orn', at: 'out', w: 1, h: 1, s: 'x.birdtable', g: 65, lv: 2 },
    x_grave: { n: 'Old headstone', i: '🪦', c: 'orn', at: 'out', w: 1, h: 1, s: 'x.grave', g: 66, lv: 4 },
    x_scarecrow: { n: 'Scarecrow', i: '🎃', c: 'out', at: 'out', w: 1, h: 1, s: 'x.scarecrow', g: 90, lv: 5 },
    x_hive: { n: 'Beehive', i: '🐝', c: 'out', at: 'out', w: 1, h: 1, s: 'x.hive', g: 110, lv: 5 },
    x_hammock: { n: 'Hammock', i: '🏝️', c: 'out', at: 'out', w: 2, h: 1, s: 'x.hammock', g: 130, lv: 6 },
    x_well: { n: 'Well', i: '🪣', c: 'orn', at: 'out', w: 1, h: 1, s: 'x.well', g: 180, lv: 7 },
    x_snowman: { n: 'Snowman', i: '⛄', c: 'orn', at: 'out', w: 1, h: 1, s: 'x.snowman', g: 75, lv: 8 },
    x_fountain: { n: 'Fountain', i: '⛲', c: 'orn', at: 'out', w: 2, h: 1, s: 'x.fountain', g: 400, lv: 12 },
    sundial: { n: 'Sundial', i: '☀️', c: 'orn', at: 'out', w: 1, h: 1, s: 'orn.sundial', g: 80 },
    statue: { n: 'Parrot statue', i: '🗿', c: 'orn', at: 'any', w: 1, h: 1, s: 'orn.statue', g: 150 },
    chimes: { n: 'Wind chimes', i: '🎐', c: 'orn', at: 'any', w: 1, h: 1, s: 'orn.chimes', dy: -40, g: 30, hang: 1 },
    // the expansions
    pool: { n: 'Pool', i: '🏊', c: 'wing', at: 'out', w: 4, h: 3, est: 'pool', dy: -4, tap: 'pool', free: { wing: 'pool' }, flatBelow: 3, use: { x: 2, y: -1, d: 'down', a: 'idle', swim: 1, i: '🏊', l: 1.2 } },
    garden: { n: 'Veggie garden', i: '🥕', c: 'wing', at: 'out', w: 3, h: 3, est: 'garden', tap: 'garden', free: { wing: 'garden' }, flatBelow: 3, use: { x: 1, y: 3, d: 'up', a: 'thrust', i: '🥕', l: 1 } },
    grill: { n: 'Outdoor kitchen', i: '🍖', c: 'wing', at: 'out', w: 3, h: 2, est: 'grill', dy: -4, tap: 'grill', free: { wing: 'grill' }, use: { x: 1, y: 2, d: 'up', a: 'thrust', i: '🍖', l: 0.8 } },
    pond: { n: 'Koi pond', i: '🐟', c: 'wing', at: 'out', w: 3, h: 3, est: 'pond', dy: -16, tap: 'pond', free: { wing: 'pond' }, flatBelow: 9, use: { x: 1, y: 3, d: 'up', a: 'sit', f: 0, i: '🐟', l: 1 } },
    tower: { n: 'Watchtower', i: '🗼', c: 'wing', at: 'out', w: 3, h: 2, est: 'tower', dy: -4, tap: 'tower', free: { wing: 'tower' }, use: { x: 1, y: 2, d: 'down', a: 'idle', seat: [0, -86], perch: 1, i: '🔭', l: 0.8 } },
    workbench: { n: 'Workbench', i: '🔨', c: 'wing', at: 'in', w: 3, h: 1, s: 'workbench', dy: -12, tap: 'shed', feat: 'reno', free: { wing: 'shed' }, use: { x: 1, y: 1, d: 'up', a: 'thrust', i: '🔨', l: 0.9 } },
    sawhorse: { n: 'Sawhorse', i: '🪚', c: 'wing', at: 'any', w: 1, h: 1, s: 'sawhorse', dy: -10, free: { wing: 'shed' } },
    lumber: { n: 'Timber offcuts', i: '🪵', c: 'wing', at: 'any', w: 1, h: 1, s: 'lumber', dy: -8, free: { wing: 'shed' } },
  };
  const FURN = FURN_RAW;
  // Footprint (w, h in cells) of each tiered prop at each tier, from its sprite (tools/footprints.js regenerates it).
  const FOOT = {ktable:[[2,1],[2,1],[3,2],[3,2],[3,2],[3,2]],couch:[[3,1],[3,1],[3,1],[4,1],[4,1],[4,1]],armchair:[[1,1],[1,1],[1,1],[1,1],[1,1],[1,1]],ctable:[[1,1],[1,1],[2,1],[1,1],[1,1],[1,1]],bed:[[2,3],[2,4],[3,4],[3,4],[3,4],[3,4]],wardrobe:[[1,1],[1,1],[1,1],[2,1],[2,1],[2,1]],bedside:[[1,1],[1,1],[1,1],[1,1],[1,1],[1,1]],desk:[[3,1],[2,1],[2,1],[4,1],[4,1],[4,1]],bag:[[1,1],[1,1],[1,1],[1,1],[1,1],[1,1]],weights:[[2,1],[2,1],[2,1],[2,1],[2,1],[2,1]],aviary:[[2,2],[2,2],[3,3],[4,3],[4,3],[4,3]],pool:[[2,1],[3,2],[3,3],[5,3],[5,3],[5,3]],garden:[[3,2],[3,2],[3,2],[3,3],[3,3],[3,3]],grill:[[2,2],[2,1],[3,2],[3,2],[3,2],[3,2]],pond:[[1,1],[2,2],[3,2],[4,3],[4,3],[4,3]],tower:[[2,2],[2,2],[2,2],[2,2],[2,2],[2,2]]};
  let curEst = { tiers: {}, wings: {} };
  const setEst = (s) => { if (s && s.estate) curEst = s.estate; };
  const tierDims = {};
  // The catalogue entry for a prop as it stands now: tiered props take the size of their current sprite.
  function furnNow(k) {
    const f = FURN[k];
    if (!f || !f.est || !FOOT[k]) return f;
    const t = Math.max(0, Math.min(5, (curEst.tiers[f.est] | 0)));
    const key = k + t;
    if (tierDims[key]) return tierDims[key];
    const d = FOOT[k][t], g = Object.assign({}, f, { w: d[0], h: d[1] });
    if (f.use) { g.use = Object.assign({}, f.use); g.use.x = Math.max(0, Math.min(d[0] - 1, f.use.x)); if (f.use.y > 0) g.use.y = f.use.y - (f.h - d[1]); }
    tierDims[key] = g;
    return g;
  }
  const FURN_CATS = [['pet', 'Animals'], ['bird', 'For the parrots'], ['furn', 'Furniture'], ['fancy', 'Curios and trophies'], ['wall', 'On the walls'], ['orn', 'Ornaments'], ['out', 'The yard']];
  // The house as it was in 2.0. Wing pieces wait, unseen, in their spots until they're bought.
  const DEFAULT_ROOMS = [['kitchen', 'Kitchen', 1, 1, 8, 7], ['lounge', 'Lounge', 9, 1, 16, 15], ['bedroom', 'Bedroom', 17, 1, 23, 7], ['study', 'Study', 1, 8, 8, 15], ['laundry', 'Laundry', 17, 8, 23, 15]];
  const DEFAULT_DOORS = [[8, 4], [9, 4], [8, 5], [9, 5], [16, 4], [17, 4], [16, 5], [17, 5], [8, 11], [9, 11], [8, 12], [9, 12], [16, 11], [17, 11], [16, 12], [17, 12], [12, 15], [13, 15]];
  const DEFAULT_ITEMS = [
    ['fridge', 1, 3], ['counter', 3, 3], ['stove', 4, 3], ['sink', 6, 3], ['dishshelf', 8, 3], ['ktable', 3, 5], ['chair', 2, 6], ['chair', 6, 6], ['window', 4, 1],
    ['fireplace', 11, 1], ['torch', 10, 1], ['torch', 15, 1], ['ctable', 12, 5], ['couch', 11, 6], ['armchair', 15, 8], ['renojob', 10, 8],
    ['rug', 11, 11], ['plant', 9, 14], ['lamp', 16, 14], ['candelabra', 10, 3], ['candelabra', 15, 3],
    ['bed', 20, 3], ['wardrobe', 17, 3], ['bedside', 19, 3], ['window', 21, 1], ['painting2', 19, 1],
    ['desk', 1, 10], ['bookshelf', 5, 10], ['bag', 2, 13], ['weights', 5, 13],
    ['washer', 18, 10], ['basket', 19, 10], ['mirror', 22, 10], ['painting0', 19, 8],
    ['mat', 12, 16], ['mat', 13, 16], ['stones', 12, 17], ['stones', 13, 18], ['aviary', 1, 17], ['line', 17, 18], ['tree', 16, 25],
    ['gardenlamp', 6, 16], ['gardenlamp', 17, 16], ['hedge', 22, 16], ['hedge', 8, 25], ['pool', 10, 22],
    ['garden', 26, 17], ['grill', 25, 9], ['pond', 29, 12], ['tower', 29, 5], ['tree', 31, 25],
  ];
  // Where the wings go when they're built, if there's room.
  const WING_ROOMS = {
    garage: { name: 'Garage gym', rect: [1, 20, 6, 25], doors: [[6, 23]], move: { bag: [2, 22], weights: [4, 23] } },
    shed: { name: 'Shed', rect: [18, 21, 23, 25], doors: [[18, 24]], add: [['workbench', 19, 23], ['sawhorse', 22, 24], ['lumber', 18, 23]] },
  };
  // 2.0's relic slots, for carrying placed relics across.
  const OLD_SLOTS = { yardA: [18, 20], yardB: [7, 25], loungeF: [9, 12], loungeW: [16, 1], studyF: [7, 14], studyW: [4, 8], bedW: [17, 1], gymF: [7, 12], gymW: [1, 8] };

  const relicW = (d) => (Math.max(14, Math.min(56, Math.round(d.w * 0.62))) > 32 ? 2 : 1);
  // The catalogue entry for a placed thing (relics come from DECOR).
  function furnOf(it) {
    if (!it) return null;
    if (it.k !== 'relic') return furnNow(it.k) || null;
    const d = DECOR[it.r];
    if (!d) return null;
    return { n: d.name, i: '✨', c: 'relic', at: d.type === 'wall' ? 'wall' : d.type === 'yard' ? 'out' : 'any', w: relicW(d), h: 1, relic: it.r, dy: d.type === 'wall' ? -6 : -8, tap: 'relic:' + it.r };
  }
  // How many of a thing he has: the fittings, what progress has turned up, and what he's bought.
  const NOT_HOME = { renojob: 1, aviary: 1, line: 1 };
  function furnOwned(s, k, r, ctx) {
    if (k === 'relic') return s.decor.owned.indexOf(r) >= 0 ? 1 : 0;
    const f = FURN[k];
    if (!f) return 0;
    if (s.house && s.house.npc && NOT_HOME[k]) return 0;   // 2.24: a companion's cottage has no restoration job or aviary
    if (f.c === 'core') return 1;
    let n = (s.house && s.house.bought && s.house.bought[k]) | 0;
    const fr = f.free;
    if (fr) {
      if (fr.wing) { if (s.estate.wings[fr.wing]) n += fr.n || 1; }
      else if (fr.yard != null) { if ((s.estate.tiers.yard | 0) >= fr.yard) n += fr.n || 1; }
      else if (fr.reno != null) { const lv = fr.reno <= 0 ? 0 : ctx && ctx.reno != null ? ctx.reno : renoStage(s); if (lv >= fr.reno) n += fr.n || 1; }
    }
    return n;
  }
  function renoStage(s) { try { const h = homeState(s, today()).reno; return h.linked ? h.stage : 3; } catch (e) { return 3; } }
  const sameThing = (it, k, r) => it.k === k && (k !== 'relic' || it.r === r);
  // Which placed things are real: the first N of each kind, where N is how many he owns. The rest wait, unseen.
  function houseLive(s) {
    const seen = {}, out = {}, ctx = { reno: renoStage(s) };
    const lot = !!s.estate.wings.garden;
    s.house.items.forEach((it) => {
      if (!lot && it.x >= LOT.x0) return; // the side lot's not his yet
      const key = it.k === 'relic' ? 'relic:' + it.r : it.k;
      if (seen[key] == null) seen[key] = furnOwned(s, it.k, it.r, ctx);
      if (seen[key] > 0) { seen[key]--; out[it.id] = true; }
    });
    return out;
  }
  // What he owns that isn't placed anywhere.
  function houseStored(s) {
    const out = [], ctx = { reno: renoStage(s) };
    Object.keys(FURN).forEach((k) => {
      const n = furnOwned(s, k, null, ctx) - s.house.items.filter((it) => it.k === k).length;
      if (n > 0) out.push({ k: k, n: n });
    });
    s.decor.owned.forEach((r) => { if (!s.house.items.some((it) => sameThing(it, 'relic', r))) out.push({ k: 'relic', r: r, n: 1 }); });
    return out;
  }

  // What the renderer needs: the layout, with each thing marked real or waiting.
  function houseView(s) {
    const live = houseLive(s);
    return { rooms: s.house.rooms, doors: s.house.doors, items: s.house.items.map((it) => Object.assign({}, it, { live: !!live[it.id] })) };
  }
  // ---------- geometry ----------
  function houseGeom(house, land) {
    // land: what landOf gives, or just true/false for the side lot (the old world)
    const L = land && typeof land === 'object' ? land : { lv: 0, lot: !!land, x1: 32, y1: 25, wt: 34, ht: 27 };
    const WT = L.wt, HT = L.ht, lot = L.lot;
    const N = WT * HT, room = new Int16Array(N).fill(-1), door = new Uint8Array(N);
    const inPlot = L.lv ? (x, y) => x >= 1 && x <= L.x1 && y >= 1 && y <= L.y1
      : (x, y) => (x >= PLOT.x0 && x <= PLOT.x1 && y >= PLOT.y0 && y <= PLOT.y1) || (lot && x >= LOT.x0 && x <= LOT.x1 && y >= LOT.y0 && y <= LOT.y1);
    house.rooms.forEach((r, i) => { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (x >= 0 && y >= 0 && x < WT && y < HT) room[y * WT + x] = i; });
    house.doors.forEach((d) => { if (d[0] >= 0 && d[1] >= 0 && d[0] < WT && d[1] < HT) door[d[1] * WT + d[0]] = 1; });
    const at = (x, y) => (x < 0 || y < 0 || x >= WT || y >= HT ? -2 : room[y * WT + x]);
    // What kind of cell: 'floor' in a room, 'wall' (face rows), 'bottom' (bottom row), 'out' (yard), null (beyond the fence).
    const kind = (x, y) => {
      if (x < 0 || y < 0 || x >= WT || y >= HT) return null;
      const i = room[y * WT + x];
      if (i < 0) return inPlot(x, y) || (lot && x === GATE.x && y >= GATE.y0 && y <= GATE.y1) ? 'out' : null;
      const r = house.rooms[i];
      return y <= r.y0 + 1 ? 'wall' : y === r.y1 ? 'bottom' : 'floor';
    };
    const isDoor = (x, y) => x >= 0 && y >= 0 && x < WT && y < HT && door[y * WT + x] === 1;
    // Can you stand there (ignoring furniture)?
    const open = (x, y) => { const k = kind(x, y); return k === 'floor' || k === 'out' || ((k === 'wall' || k === 'bottom') && isDoor(x, y)); };
    // Can you step from a to b (neighbours)? Crossing between rooms, or in or out, needs a door on one side.
    const step = (ax, ay, bx, by) => open(bx, by) && (at(ax, ay) === at(bx, by) || isDoor(ax, ay) || isDoor(bx, by));
    return { room: room, door: door, at: at, kind: kind, isDoor: isDoor, open: open, step: step, inPlot: inPlot, rooms: house.rooms, wt: WT, ht: HT, land: L };
  }
  function footOf(it, f, house) {
    f = f || furnOf(it);
    if (!f) return null;
    if (f.at === 'wall') return [it.x, it.y, it.x + f.w - 1, it.y + 1 + (f.block || 0)];
    return [it.x, it.y, it.x + f.w - 1, it.y + f.h - 1];
  }
  // Why a thing can't go at x,y (or null if it can). ignore: the thing being moved.
  function whyNot(s, it, x, y, ignore, o) {
    o = o || {};
    setEst(s);
    const H = s.house, f = furnOf(it);
    if (!f) return 'Unknown thing';
    const lot = !!s.estate.wings.garden || o.lot;
    const G = o.geom || houseGeom(H, landOf(s).lv ? landOf(s) : lot);
    const live = o.live || (o.live = houseLive(s));
    const others = (o.items || H.items).filter((t) => t.id !== ignore && live[t.id]); // things he doesn't own yet don't take up room
    if (f.at === 'wall') {
      const ri = G.at(x, y);
      if (ri < 0) return 'Wall things go on a wall';
      const r = H.rooms[ri];
      y = r.y0;
      if (x < r.x0 || x + f.w - 1 > r.x1) return 'Not enough wall';
      for (let cx = x; cx < x + f.w; cx++) if (G.isDoor(cx, r.y0) || G.isDoor(cx, r.y0 + 1)) return 'There’s a doorway there';
      for (const t of others) {
        const tf = furnOf(t);
        if (!tf || tf.at !== 'wall' || G.at(t.x, t.y) !== ri) continue;
        if (t.x <= x + f.w - 1 && t.x + tf.w - 1 >= x) return 'Something’s already hung there';
      }
      if (f.block) for (let cy = r.y0 + 2; cy < r.y0 + 2 + f.block; cy++) for (let cx = x; cx < x + f.w; cx++) {
        if (G.kind(cx, cy) !== 'floor') return 'Not enough room in front';
        if (others.some((t) => { const tf = furnOf(t); if (!tf || tf.flat || tf.at === 'wall') return false; const ft = footOf(t, tf); return cx >= ft[0] && cx <= ft[2] && cy >= ft[1] && cy <= ft[3]; })) return 'Something’s in the way';
      }
      return null;
    }
    let region = null;
    for (let cy = y; cy < y + f.h; cy++) for (let cx = x; cx < x + f.w; cx++) {
      const k = G.kind(cx, cy);
      if (!k) return 'That’s past the fence';
      if (k === 'wall' || k === 'bottom') return 'That’s in a wall';
      if (k === 'out' && cx === GATE.x) return 'Keep the gate clear';
      const rg = G.at(cx, cy);
      if (region === null) region = rg; else if (region !== rg) return 'It would stick through a wall';
      if (k === 'floor' && f.at === 'out') return 'That one lives outside';
      if (k === 'out' && f.at === 'in') return 'That one lives indoors';
      if (G.isDoor(cx, cy)) return 'That would block a door';
    }
    for (const t of others) {
      const tf = furnOf(t);
      if (!tf) continue;
      const ft = footOf(t, tf);
      if (tf.at === 'wall') {
        if (!tf.block || f.flat) continue;
        const rr = H.rooms[G.at(t.x, t.y)];
        if (!rr) continue;
        if (ft[0] <= x + f.w - 1 && ft[2] >= x && rr.y0 + 2 <= y + f.h - 1 && rr.y0 + 1 + tf.block >= y) return 'The ' + tf.n.toLowerCase() + ' is in the way';
        continue;
      }
      if (!!tf.flat !== !!f.flat) continue;
      if (ft[0] <= x + f.w - 1 && ft[2] >= x && ft[1] <= y + f.h - 1 && ft[3] >= y) return 'The ' + tf.n.toLowerCase() + ' is in the way';
    }
    return null;
  }
  const houseSeq = (H) => { H.seq = (H.seq | 0) + 1; return H.seq; };
  // A free spot for something, near prefer if given.
  function findSpot(s, it, prefer) {
    if (prefer && !whyNot(s, it, prefer[0], prefer[1], null, null)) return prefer;
    const f = furnOf(it);
    const G = houseGeom(s.house, landOf(s)), live = houseLive(s);
    const cands = [];
    for (let y = 0; y < G.ht; y++) for (let x = 0; x < G.wt; x++) {
      const k = G.kind(x, y);
      if (f.at === 'wall' ? k !== 'wall' : !(k === 'floor' || k === 'out')) continue;
      if (f.at === 'wall') { const r = s.house.rooms[G.at(x, y)]; if (y !== r.y0) continue; }
      cands.push([x, y]);
    }
    const px = prefer ? prefer[0] : 12, py = prefer ? prefer[1] : 12;
    cands.sort((a, b) => Math.abs(a[0] - px) + Math.abs(a[1] - py) - Math.abs(b[0] - px) - Math.abs(b[1] - py));
    for (const c of cands) if (!whyNot(s, it, c[0], c[1], null, { geom: G, live: live })) return c;
    return null;
  }
  // The rooms he starts with count as bought up to a 5 × 3: selling or shrinking them never pays more than that.
  function startRoom(r) {
    const z = roomDims(r);
    r.purpose = ROOM_START[r.id] || 'none';
    r.paid = Math.min(roomPrice(z.w, z.d), roomPrice(5, 3));
    return r;
  }
  function houseDefault() {
    const H = { rooms: [], doors: DEFAULT_DOORS.map((d) => d.slice()), items: [], bought: {}, seq: 0 };
    DEFAULT_ROOMS.forEach((r) => H.rooms.push(startRoom({ id: r[0], name: r[1], x0: r[2], y0: r[3], x1: r[4], y1: r[5], style: 'house' })));
    DEFAULT_ITEMS.forEach((d) => H.items.push({ id: houseSeq(H), k: d[0], x: d[1], y: d[2] }));
    return H;
  }
  // Tidies the layout: drops anything broken or overlapping, keeps everything else as Jake left it.
  function houseNorm(s) {
    let H = s.house && typeof s.house === 'object' && Array.isArray(s.house.rooms) ? s.house : null;
    const fresh = !H || !(s.houseV >= 1);
    if (H && !fresh) s.house = H;
    if (fresh) {
      H = houseDefault();
      s.house = H;
      // relics he'd put out in 2.0
      const pl = s.decor.placed || {};
      Object.keys(pl).forEach((slot) => {
        const r = pl[slot], at = OLD_SLOTS[slot];
        if (!r || !DECOR[r] || s.decor.owned.indexOf(r) < 0) return;
        const it = { id: 0, k: 'relic', r: r, x: 0, y: 0 };
        const spot = findSpot(s, it, at);
        if (spot) { it.id = houseSeq(H); it.x = spot[0]; it.y = spot[1]; H.items.push(it); }
      });
    }
    if (!fresh && !(s.houseV >= 2)) {
      const kt = H.items.find((it) => it.k === 'ktable');
      [[-1, 1], [3, 1]].forEach((d) => { if (H.items.filter((it) => it.k === 'chair').length < 2 + ((H.bought && H.bought.chair) | 0)) houseAuto(s, 'chair', null, kt ? [kt.x + d[0], kt.y + d[1]] : null); });
    }
    s.houseV = 2;
    H.bought = H.bought && typeof H.bought === 'object' ? H.bought : {};
    Object.keys(H.bought).forEach((k) => { if (!FURN[k] || !FURN[k].g) delete H.bought[k]; else H.bought[k] = Math.max(0, Math.min(40, H.bought[k] | 0)); });
    H.seq = H.seq | 0;
    const ids = {};
    H.rooms = (Array.isArray(H.rooms) ? H.rooms : []).filter((r) => r && typeof r === 'object').map((r, i) => ({
      id: String(r.id || 'r' + i).slice(0, 24), name: String(r.name || 'Room').slice(0, 24), style: ROOM_STYLES[r.style] ? r.style : 'house',
      x0: Math.min(r.x0, r.x1) | 0, y0: Math.min(r.y0, r.y1) | 0, x1: Math.max(r.x0, r.x1) | 0, y1: Math.max(r.y0, r.y1) | 0,
      purpose: r.purpose, paid: r.paid,
    })).map((r) => {
      if (!ROOM_PURPOSES[r.purpose] || r.paid == null) { const keep = r.purpose, rr = startRoom(r); if (ROOM_PURPOSES[keep]) rr.purpose = keep; }
      r.paid = Math.max(0, Math.min(5000, r.paid | 0));
      return r;
    }).filter((r) => { if (ids[r.id] || roomWhy(s, r, r.id)) return false; ids[r.id] = 1; return true; });
    H.doors = (Array.isArray(H.doors) ? H.doors : []).filter((d) => Array.isArray(d) && d.length === 2).map((d) => [d[0] | 0, d[1] | 0]);
    const G = houseGeom(H, landOf(s).lv ? landOf(s) : true);
    H.doors = H.doors.filter((d, i, a) => { const k = G.kind(d[0], d[1]); return (k === 'wall' || k === 'bottom' || k === 'floor') && a.findIndex((e) => e[0] === d[0] && e[1] === d[1]) === i; });
    const items = (Array.isArray(H.items) ? H.items : []).filter((it) => it && typeof it === 'object' && (FURN[it.k] || (it.k === 'relic' && DECOR[it.r])));
    const liveNow = houseLive(s);
    H.items = [];
    const seenId = {};
    items.forEach((it) => {
      const o = { id: it.id | 0, k: it.k, x: it.x | 0, y: it.y | 0 };
      if (it.k === 'relic') o.r = it.r;
      if (it.flip) o.flip = 1;
      if (!o.id || seenId[o.id]) o.id = houseSeq(H);
      if (o.id > H.seq) H.seq = o.id;
      if (FURN[o.k] && FURN[o.k].c === 'core' && H.items.some((t) => t.k === o.k)) return;
      if (o.k === 'relic' && H.items.some((t) => sameThing(t, 'relic', o.r))) return;
      if (FURN[o.k] && FURN[o.k].at === 'wall') { const ri = G.at(o.x, o.y); if (ri >= 0) o.y = H.rooms[ri].y0; }
      if (whyNot(s, o, o.x, o.y, o.id, { geom: G, lot: true, items: H.items, live: liveNow })) {
        // it doesn't fit where it was (a tier changed its size, or a room moved): find it somewhere nearby
        const spot = findSpot(s, o, [o.x, o.y]);
        if (!spot) return;
        o.x = spot[0]; o.y = spot[1];
      }
      seenId[o.id] = 1;
      H.items.push(o);
    });
    return H;
  }
  // ---------- editing (each returns an error string, or null when done) ----------
  function houseMove(s, id, x, y) {
    const it = s.house.items.find((t) => t.id === id);
    if (!it) return 'Gone';
    const f = furnOf(it);
    if (f.at === 'wall') { const G = houseGeom(s.house, landOf(s)), ri = G.at(x, y); if (ri >= 0) y = s.house.rooms[ri].y0; }
    const why = whyNot(s, it, x, y, id);
    if (why) return why;
    it.x = x; it.y = y;
    return null;
  }
  function houseFlip(s, id) { const it = s.house.items.find((t) => t.id === id); if (it) { if (it.flip) delete it.flip; else it.flip = 1; } return null; }
  function houseStore(s, id) {
    const i = s.house.items.findIndex((t) => t.id === id);
    if (i < 0) return 'Gone';
    s.house.items.splice(i, 1);
    return null;
  }
  // Puts out something from storage.
  function housePut(s, k, r, x, y) {
    const st = houseStored(s).find((o) => sameThing(o, k, r));
    if (!st) return 'You haven’t got a spare one';
    const it = { id: 0, k: k, x: x, y: y };
    if (k === 'relic') it.r = r;
    if (FURN[k] && FURN[k].at === 'wall') { const G = houseGeom(s.house, landOf(s)), ri = G.at(x, y); if (ri >= 0) it.y = s.house.rooms[ri].y0; }
    const why = whyNot(s, it, it.x, it.y);
    if (why) return why;
    it.id = houseSeq(s.house);
    s.house.items.push(it);
    return null;
  }
  function houseAuto(s, k, r, prefer) {
    const it = { id: 0, k: k, x: 0, y: 0 };
    if (k === 'relic') it.r = r;
    const spot = findSpot(s, it, prefer);
    if (!spot) return false;
    it.x = spot[0]; it.y = spot[1]; it.id = houseSeq(s.house);
    s.house.items.push(it);
    return true;
  }
  function furnBuy(s, k) {
    const f = FURN[k];
    if (!f || !f.g) return 'Not for sale';
    if (f.lv && s.level < f.lv) return 'The merchant stocks that from level ' + f.lv;
    if (s.gold < f.g) return 'Need ' + (f.g - s.gold) + ' more gold';
    s.gold -= f.g;
    s.house.bought[k] = (s.house.bought[k] | 0) + 1;
    return null;
  }
  // ---------- rooms: bought by the tile, in any size from 1×1 to 12×12 floor tiles ----------
  // A room's size is its floor: width × depth. The walls come with it (two rows of wall face on top, one row along the bottom).
  const ROOM_MAX = 12, ROOM_LIMIT = 16, SELL_BACK = 0.5;
  const ROOM_PURPOSES = {
    none: { n: 'No purpose', i: '▫️' }, kitchen: { n: 'Kitchen', i: '🍳' }, lounge: { n: 'Lounge', i: '🛋️' }, bedroom: { n: 'Bedroom', i: '🛏️' },
    study: { n: 'Study', i: '📚' }, laundry: { n: 'Laundry', i: '🧺' }, gym: { n: 'Gym', i: '🏋️' }, birdroom: { n: 'Bird room', i: '🦜' },
    workshop: { n: 'Workshop', i: '🔨' }, store: { n: 'Storeroom', i: '📦' },
  };
  const ROOM_START = { kitchen: 'kitchen', lounge: 'lounge', bedroom: 'bedroom', study: 'study', laundry: 'laundry', garage: 'gym', shed: 'workshop' };
  const roomPrice = (w, d) => 10 + 5 * w * d;
  const roomDims = (r) => ({ w: r.x1 - r.x0 + 1, d: r.y1 - r.y0 - 2 });
  const roomRect = (x0, y0, w, d) => ({ x0: x0, y0: y0, x1: x0 + w - 1, y1: y0 + d + 2 });
  function roomWhy(s, r, ignore) {
    const z = roomDims(r);
    if (z.w < 1 || z.d < 1) return 'A room needs at least one tile of floor';
    if (z.w > ROOM_MAX || z.d > ROOM_MAX) return 'Twelve by twelve is the biggest room there is';
    const inP = r.x0 >= PLOT.x0 && r.x1 <= PLOT.x1 && r.y0 >= PLOT.y0 && r.y1 <= PLOT.y1;
    const inL = r.x0 >= LOT.x0 && r.x1 <= LOT.x1 && r.y0 >= LOT.y0 && r.y1 <= LOT.y1;
    const Ld = landOf(s);
    if (Ld.lv ? !(r.x0 >= 1 && r.y0 >= 1 && r.x1 <= Ld.x1 && r.y1 <= Ld.y1) : !inP && !inL) return 'Keep it inside the fence';
    for (const o of s.house.rooms) if (o.id !== ignore && o.x0 <= r.x1 && o.x1 >= r.x0 && o.y0 <= r.y1 && o.y1 >= r.y0) return 'It overlaps the ' + o.name.toLowerCase();
    return null;
  }
  const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  // Is this placed thing inside the room's rectangle?
  function itemIn(it, r) {
    const f = furnOf(it);
    if (!f) return false;
    if (f.at === 'wall') return it.x >= r.x0 && it.x + f.w - 1 <= r.x1 && it.y >= r.y0 && it.y <= r.y0 + 1;
    const ft = footOf(it, f);
    return ft[0] >= r.x0 && ft[2] <= r.x1 && ft[1] >= r.y0 && ft[3] <= r.y1;
  }
  function itemTouches(it, r) {
    const f = furnOf(it);
    if (!f) return false;
    const ft = footOf(it, f);
    return ft[0] <= r.x1 && ft[2] >= r.x0 && ft[1] <= r.y1 && ft[3] >= r.y0;
  }
  // Door cells that no longer sit in a wall (or whose other half was left behind) go.
  function doorsTidy(s) {
    const H = s.house, has = (x, y) => H.doors.some((d) => d[0] === x && d[1] === y);
    for (let pass = 0; pass < 3; pass++) {
      const G = houseGeom(H, landOf(s).lv ? landOf(s) : true);
      const before = H.doors.length;
      H.doors = H.doors.filter((d, i, a) => {
        if (a.findIndex((e) => e[0] === d[0] && e[1] === d[1]) !== i) return false;
        const x = d[0], y = d[1], ri = G.at(x, y);
        if (ri < 0) return false;
        const r = H.rooms[ri];
        const side = (x === r.x0 || x === r.x1) && y > r.y0 + 1 && y < r.y1, top = y <= r.y0 + 1, bot = y === r.y1;
        if (!side && !top && !bot) return false;
        const nb = top ? [x, r.y0 - 1] : bot ? [x, y + 1] : [x === r.x0 ? x - 1 : x + 1, y];
        return !(G.at(nb[0], nb[1]) >= 0 && !has(nb[0], nb[1])); // a door into another room needs its other half
      });
      if (H.doors.length === before) break;
    }
  }
  // Doors on both sides of the walls of a rectangle (inside it, and the other halves next door).
  function doorsAround(H, r) {
    const inside = H.doors.filter((d) => inRect(r, d[0], d[1])), seen = {}, out = [];
    let front = inside.slice();
    for (let depth = 0; depth < 2; depth++) {
      const next = [];
      front.forEach((d) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((v) => {
        const x = d[0] + v[0], y = d[1] + v[1], k = x + ',' + y;
        if (inRect(r, x, y) || seen[k] || !H.doors.some((e) => e[0] === x && e[1] === y)) return;
        seen[k] = 1; out.push([x, y]); next.push([x, y]);
      }));
      front = next;
    }
    return { inside: inside, partners: out };
  }
  // Adds a room (opposite corners of its footprint). Costs gold unless o.free. Returns { room, stored } or { err }.
  function roomAdd(s, x0, y0, x1, y1, o) {
    o = o || {};
    const r = { id: 'r' + houseSeq(s.house), name: o.name || 'Room ' + (s.house.rooms.length + 1), style: o.style || 'house', purpose: o.purpose || 'none', paid: 0, x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
    const why = roomWhy(s, r);
    if (why) return { err: why };
    if (s.house.rooms.length >= roomLimit(s)) return { err: roomLimit(s) + ' rooms is plenty' + (landNext(s).max ? '' : ' for this much land') };
    if (r.x0 > PLOT.x1 && !s.estate.wings.garden) return { err: 'Buy the bigger lot first' };
    const z = roomDims(r), cost = o.free ? 0 : roomPrice(z.w, z.d);
    if (s.gold < cost) return { err: 'A ' + z.w + ' × ' + z.d + ' room costs ' + cost + ' gold. You need ' + (cost - s.gold) + ' more' };
    s.gold -= cost; r.paid = cost;
    s.house.rooms.push(r);
    const lost = [];
    // yard things standing where the room now is
    s.house.items = s.house.items.filter((it) => { if (itemTouches(it, r)) { const f = furnOf(it); lost.push(f ? f.n : it.k); return false; } return true; });
    return { room: r, cost: cost, stored: lost.concat(evict(s)) };
  }
  // Sells a room back for half of what was paid for it. Its things go to storage.
  function roomDel(s, id) {
    const r = s.house.rooms.find((x) => x.id === id);
    if (!r) return { err: 'Gone' };
    if (s.house.rooms.length <= 1) return { err: 'You need somewhere to live' };
    const refund = Math.floor((r.paid | 0) * SELL_BACK);
    s.gold += refund;
    s.house.rooms = s.house.rooms.filter((x) => x.id !== id);
    const near = doorsAround({ doors: s.house.doors }, r);
    s.house.doors = s.house.doors.filter((d) => !inRect(r, d[0], d[1]) && !near.partners.some((p) => p[0] === d[0] && p[1] === d[1]));
    doorsTidy(s);
    return { stored: evict(s), refund: refund };
  }
  // Changes a room's floor size, keeping its top-left corner. Pays the difference, or gets half of it back.
  function roomResize(s, id, w, d) {
    const r = s.house.rooms.find((x) => x.id === id);
    if (!r) return { err: 'Gone' };
    const nr = Object.assign({}, r, roomRect(r.x0, r.y0, w, d)), why = roomWhy(s, nr, id);
    if (why) return { err: why };
    const price = roomPrice(w, d), paid = r.paid | 0;
    const diff = price > paid ? price - paid : -Math.floor((paid - price) * SELL_BACK);
    if (diff > s.gold) return { err: 'That costs ' + diff + ' gold. You need ' + (diff - s.gold) + ' more' };
    const mine = s.house.items.filter((it) => itemIn(it, r)).map((it) => it.id);
    const around = doorsAround(s.house, r);
    s.gold -= diff;
    r.x0 = nr.x0; r.y0 = nr.y0; r.x1 = nr.x1; r.y1 = nr.y1; r.paid = price;
    const lost = [];
    s.house.items = s.house.items.filter((it) => {
      const keep = mine.indexOf(it.id) >= 0 ? itemIn(it, r) : !itemTouches(it, r);
      if (!keep) { const f = furnOf(it); lost.push(f ? f.n : it.k); }
      return keep;
    });
    const gone = around.inside.filter((c) => !inRect(r, c[0], c[1]));
    s.house.doors = s.house.doors.filter((c) => !gone.some((g) => g[0] === c[0] && g[1] === c[1]));
    doorsTidy(s);
    return { room: r, diff: diff, stored: lost.concat(evict(s)) };
  }
  // Picks a room up and sets it down with its top-left corner at x0,y0. Its things and its doors go with it.
  function roomMove(s, id, x0, y0) {
    const r = s.house.rooms.find((x) => x.id === id);
    if (!r) return { err: 'Gone' };
    const z = roomDims(r), nr = Object.assign({}, r, roomRect(x0, y0, z.w, z.d)), why = roomWhy(s, nr, id);
    if (why) return { err: why };
    const dx = x0 - r.x0, dy = y0 - r.y0;
    if (!dx && !dy) return { stored: [] };
    const mine = s.house.items.filter((it) => itemIn(it, r)), ids = mine.map((it) => it.id);
    const around = doorsAround(s.house, r), lost = [];
    // whatever stands where it's going (that isn't coming along) goes to storage
    s.house.items = s.house.items.filter((it) => {
      if (ids.indexOf(it.id) >= 0 || !itemTouches(it, nr)) return true;
      const f = furnOf(it); lost.push(f ? f.n : it.k); return false;
    });
    s.house.doors = s.house.doors.filter((c) => !around.partners.some((p) => p[0] === c[0] && p[1] === c[1]));
    s.house.doors = s.house.doors.map((c) => (inRect(r, c[0], c[1]) ? [c[0] + dx, c[1] + dy] : c));
    mine.forEach((it) => { it.x += dx; it.y += dy; });
    r.x0 = nr.x0; r.y0 = nr.y0; r.x1 = nr.x1; r.y1 = nr.y1;
    doorsTidy(s);
    return { room: r, stored: lost.concat(evict(s)) };
  }
  function roomSet(s, id, o) {
    const r = s.house.rooms.find((x) => x.id === id);
    if (!r) return 'Gone';
    if (o.name != null) r.name = String(o.name).trim().slice(0, 24) || r.name;
    if (o.purpose) {
      const pu = ROOM_PURPOSES[o.purpose];
      if (!pu) return 'No such purpose';
      const old = ROOM_PURPOSES[r.purpose] || ROOM_PURPOSES.none;
      if (r.name === old.n || /^Room \d+$/.test(r.name)) r.name = o.purpose === 'none' ? r.name : pu.n;
      r.purpose = o.purpose;
    }
    if (o.style) {
      const st = ROOM_STYLES[o.style];
      if (!st) return 'No such style';
      if (st.wing && !s.estate.wings[st.wing]) return 'Build the ' + ESTATE[st.wing].name.toLowerCase() + ' first';
      r.style = o.style;
    }
    return null;
  }
  // Sends to storage whatever no longer fits where it stands. Returns their names.
  function evict(s) {
    const out = [], keep = [], G = houseGeom(s.house, landOf(s).lv ? landOf(s) : true), live = houseLive(s);
    s.house.items.forEach((it) => {
      const f = furnOf(it);
      if (whyNot(s, it, it.x, it.y, it.id, { geom: G, lot: true, items: keep, live: live })) out.push(f ? f.n : it.k); else keep.push(it);
    });
    s.house.items = keep;
    return out;
  }
  // The cells a door at x,y would take: this wall, and the matching bit of the room next door. Returns { cells } or { err }.
  function doorCells(s, x, y) {
    const H = s.house, G = houseGeom(H, landOf(s)), ri = G.at(x, y);
    if (ri < 0) return { err: 'Tap a wall' };
    const r = H.rooms[ri], cells = [];
    const side = x === r.x0 || x === r.x1, top = y <= r.y0 + 1, bot = y === r.y1;
    if (side && (top || bot)) return { err: 'Not in a corner' };
    const beyond = (bx, by) => {
      const k = G.kind(bx, by);
      if (!k) return { err: 'That would open onto the fence' };
      if (k === 'out') return { ok: true };
      const r2 = H.rooms[G.at(bx, by)];
      return { r2: r2 };
    };
    if (side) {
      cells.push([x, y]);
      const bx = x === r.x0 ? x - 1 : x + 1, b = beyond(bx, y);
      if (b.err) return b;
      if (b.r2) { if (!(bx === b.r2.x0 || bx === b.r2.x1) || y <= b.r2.y0 + 1 || y >= b.r2.y1) return { err: 'That backs onto the ' + b.r2.name.toLowerCase() + '’s corner' }; cells.push([bx, y]); }
    } else if (bot) {
      cells.push([x, y]);
      const b = beyond(x, y + 1);
      if (b.err) return b;
      if (b.r2) { if (b.r2.y0 !== y + 1 || x === b.r2.x0 || x === b.r2.x1) return { err: 'That backs onto the ' + b.r2.name.toLowerCase() + '’s wall end' }; cells.push([x, b.r2.y0], [x, b.r2.y0 + 1]); }
    } else if (top) {
      cells.push([x, r.y0], [x, r.y0 + 1]);
      const b = beyond(x, r.y0 - 1);
      if (b.err) return b;
      if (b.r2) { if (b.r2.y1 !== r.y0 - 1 || x === b.r2.x0 || x === b.r2.x1) return { err: 'That backs onto the ' + b.r2.name.toLowerCase() + '’s wall end' }; cells.push([x, b.r2.y1]); }
    } else return { err: 'Tap a wall, not the floor' };
    return { cells: cells };
  }
  function doorToggle(s, x, y) {
    const d = doorCells(s, x, y);
    if (d.err) return d;
    const H = s.house, has = (c) => H.doors.some((e) => e[0] === c[0] && e[1] === c[1]);
    if (d.cells.every(has)) { H.doors = H.doors.filter((e) => !d.cells.some((c) => c[0] === e[0] && c[1] === e[1])); return { on: false, cells: d.cells }; }
    const before = H.doors.slice();
    d.cells.forEach((c) => { if (!has(c)) H.doors.push(c.slice()); });
    const G = houseGeom(H, landOf(s));
    for (const it of H.items) {
      const f = furnOf(it);
      if (!f) continue;
      if (f.at === 'wall') {
        const ri = G.at(it.x, it.y), rr = H.rooms[ri];
        if (rr && d.cells.some((c) => c[0] >= it.x && c[0] < it.x + f.w && c[1] >= rr.y0 && c[1] <= rr.y0 + 1 + (f.block || 0))) { H.doors = before; return { err: 'Take down the ' + f.n.toLowerCase() + ' first' }; }
        continue;
      }
      const ft = footOf(it, f);
      if (d.cells.some((c) => c[0] >= ft[0] && c[0] <= ft[2] && c[1] >= ft[1] && c[1] <= ft[3])) { H.doors = before; return { err: 'Move the ' + f.n.toLowerCase() + ' out of the doorway first' }; }
    }
    return { on: true, cells: d.cells };
  }
  // A wing's been built: make its room if there's space, and move the kit in.
  function houseWing(s, k) {
    const W = WING_ROOMS[k], notes = [];
    if (W) {
      if (s.house.rooms.some((r) => r.style === k)) return 'Its style is ready in Build mode.';
      const [x0, y0, x1, y1] = W.rect;
      const r = startRoom({ id: k, name: W.name, style: k, x0: x0, y0: y0, x1: x1, y1: y1 });
      const clash = roomWhy(s, r) || s.house.items.some((it) => { const f = furnOf(it); if (!f || f.at === 'wall') return false; const ft = footOf(it, f); return ft[0] <= x1 && ft[2] >= x0 && ft[1] <= y1 && ft[3] >= y0; });
      if (clash) return 'There wasn’t room for it where it usually goes, so draw a room in Build mode and give it the ' + ROOM_STYLES[k].name.toLowerCase() + ' style.';
      s.house.rooms.push(r);
      W.doors.forEach((d) => s.house.doors.push(d.slice()));
      Object.keys(W.move || {}).forEach((mk) => {
        const it = s.house.items.find((t) => t.k === mk);
        if (it) { const was = [it.x, it.y]; if (houseMove(s, it.id, W.move[mk][0], W.move[mk][1])) { it.x = was[0]; it.y = was[1]; } }
      });
      (W.add || []).forEach((a) => { if (!s.house.items.some((t) => t.k === a[0])) houseAuto(s, a[0], null, [a[1], a[2]]); });
      return null;
    }
    // pool, garden, grill, pond, tower: they're waiting in their spots, or come out of storage
    Object.keys(FURN).forEach((fk) => {
      const f = FURN[fk];
      if (!f.free || f.free.wing !== k || s.house.items.some((t) => t.k === fk)) return;
      const d = DEFAULT_ITEMS.find((x) => x[0] === fk);
      if (!houseAuto(s, fk, null, d ? [d[1], d[2]] : null)) notes.push(f.n);
    });
    return notes.length ? 'Find the ' + notes.join(' and ').toLowerCase() + ' a spot in Build mode.' : null;
  }

  // ---------- the household: Ruby, Kermit, and whoever else moves in ----------
  const BIRDS = {
    ruby: { name: 'Ruby', sp: 'Eclectus parrot · hen', blurb: 'Red and purple and very sure of herself. She bites. She loves her night cage.' },
    kermit: { name: 'Kermit', sp: 'Eclectus parrot · cock', blurb: 'Green, with a candy-corn beak. The bird room is his, and Ruby is not welcome in it.' },
  };
  const GARB = {
    plain: { name: 'Plain clothes' },
    work: { name: 'Work leathers', body: { art: 'light', tier: 1 } },
    coat: { name: 'Frock coat', body: { art: 'coat', base: 'Frock', tier: 2 } },
    oilskin: { name: 'Oilskin', body: { art: 'coat', base: 'Oilskin', tier: 1 } },
    robe: { name: 'Robe', body: { art: 'robe', tier: 2 } },
    armour: { name: 'Mail', body: { art: 'armour', base: 'Hauberk', tier: 2 } },
    finery: { name: 'Finery', body: { art: 'coat', base: 'Frock', tier: 4 } },
  };
  const HATS = { none: { name: 'None' }, hood: { name: 'Hood', head: { art: 'hood', tier: 1 } }, hat: { name: 'Hat', head: { art: 'hat', base: 'Cavalier', tier: 1 } }, tricorn: { name: 'Tricorn', head: { art: 'hat', base: 'Tricorn', tier: 2 } }, crown: { name: 'Crown', head: { art: 'crown', base: 'Crown', tier: 4 } } };
  const NPC_ROLES = ['fighter', 'healer', 'scout', 'mage'], NPC_ELS = ['fire', 'frost', 'storm', 'rot', 'holy'];
  const npcGear = (n) => ({ body: (GARB[n.garb] || GARB.plain).body || null, head: (HATS[n.hat] || HATS.none).head || null, weapon: null, charm: null });
  function npcNorm(s, t) {
    if (!Array.isArray(s.npcs)) s.npcs = [];
    if (!(s.npcsV >= 1)) {
      ['ruby', 'kermit'].forEach((k) => { if (!s.npcs.some((n) => n.id === k)) s.npcs.push({ id: k, kind: 'bird', name: BIRDS[k].name, home: 'aviary', status: 'resident', joined: t }); });
    }
    if (!(s.npcsV >= 2)) {
      CALLING_ORDER.forEach((k) => {
        if (s.npcs.some((n) => n.comp === k)) return;
        const look = randomLook(), C = CALLINGS[k];
        s.npcs.push({ id: 'c-' + k, kind: 'human', comp: k, name: randomName(), look: look, garb: C.garb, hat: C.hat, about: C.title, status: 'waiting', via: { type: 'calling' }, role: k, el: 'fire', home: null, joined: null });
      });
    }
    s.npcsV = 2;
    const ids = {};
    s.npcs = s.npcs.filter((n) => n && typeof n === 'object' && n.id && !ids[n.id] && (ids[n.id] = 1)).map((n) => {
      const o = { id: String(n.id).slice(0, 24), kind: n.kind === 'bird' ? 'bird' : 'human', name: String(n.name || 'Someone').slice(0, 24), status: n.status === 'waiting' ? 'waiting' : 'resident', joined: typeof n.joined === 'string' ? n.joined : t };
      o.home = typeof n.home === 'string' && (n.home === 'aviary' || s.house.rooms.some((r) => r.id === n.home)) ? n.home : o.kind === 'bird' ? 'aviary' : null;
      if (o.kind === 'bird') { if (!BIRDS[o.id]) return null; o.status = 'resident'; return o; }
      o.look = normLook(n.look || randomLook());
      o.garb = GARB[n.garb] ? n.garb : 'plain';
      o.hat = HATS[n.hat] ? n.hat : 'none';
      o.about = String(n.about || '').slice(0, 60);
      o.role = NPC_ROLES.indexOf(n.role) >= 0 ? n.role : 'fighter'; // in the delve
      o.el = NPC_ELS.indexOf(n.el) >= 0 ? n.el : 'fire';
      if (CALLINGS[n.comp]) { o.comp = n.comp; o.role = n.comp; o.via = { type: 'calling' }; o.status = n.status === 'resident' ? 'resident' : 'waiting'; return o; }
      const v = n.via && typeof n.via === 'object' ? n.via : { type: 'now' };
      o.via = { type: ['now', 'gold', 'vow'].indexOf(v.type) >= 0 ? v.type : 'now' };
      if (o.via.type === 'gold') o.via.gold = Math.max(10, Math.min(5000, v.gold | 0 || 250));
      if (o.via.type === 'vow') o.via.vow = v.vow != null ? v.vow : null;
      if (o.via.type === 'now') o.status = 'resident';
      return o;
    }).filter(Boolean);
  }
  // ---------- companions: four people who turn up when a habit sticks ----------
  // Each has a calling: a kind of deed (by stat), on so many days a week, so many weeks running. Answering it brings them;
  // answering the whole thing again (another full run of weeks) gives them a long buff, 5 days from the day you finish it.
  // Any one deed of their kind gives a short buff (12 or 24 hours, stacking to three). They're at 60% on their own.
  const CALLINGS = {
    healer: { stat: 'VIT', days: 6, weeks: 2, shortH: 12, title: 'Healer', garb: 'robe', hat: 'none',
      what: 'Look after yourself (vitality deeds: meals, water, stretching, the shop) on 6 days a week, 2 weeks running',
      arrive: 'Two weeks of looking after yourself, and someone noticed.', short: 'Fresh poultice', shortWhat: 'any vitality deed', long: 'Steady hands' },
    scout: { stat: 'END', days: 3, weeks: 3, shortH: 12, title: 'Scout', garb: 'work', hat: 'hood',
      what: 'Endurance (swims, runs, the beach) on 3 days a week, 3 weeks running',
      arrive: 'Three weeks of getting out there. Someone kept pace.', short: 'Light on her feet', shortWhat: 'any endurance session', long: 'Knows the ground' },
    fighter: { stat: 'STR', days: 2, weeks: 4, shortH: 24, title: 'Sparring partner', garb: 'armour', hat: 'none',
      what: 'Strength sessions on 2 days a week, 4 weeks running',
      arrive: 'A month of lifting. Someone wants to spar.', short: 'Warmed up', shortWhat: 'any strength session', long: 'Battle-hardened' },
    mage: { stat: 'INT', days: 4, weeks: 5, shortH: 24, title: 'Mage', garb: 'finery', hat: 'hat',
      what: 'Study or reading on 4 days a week, 5 weeks running',
      arrive: 'Five weeks at the books. Someone came to see what you were reading.', short: 'Fresh ink', shortWhat: 'any study or reading', long: 'Deep study' },
  };
  const CALLING_ORDER = ['healer', 'scout', 'fighter', 'mage'];
  // The numbers that decide how strong a companion is and when; one object so the tuning tools can sweep them.
  const CALLING_TUNE = { base: 0.6, long: 0.3, short: 0.1, shortCap: 3, longDays: 5, grace: 1 };
  const weekOf = (ds) => addDays(ds, -dayIdx(ds));
  const bits = (m) => { let n = 0; for (let i = 0; i < 7; i++) if (m & (1 << i)) n++; return n; };
  const deedStat = (s, e) => e.s || ((findQ(s, e.q) || {}).stat);
  // Which days of each week had a deed of each calling's kind. Recent weeks come straight from the log (so an undo
  // counts); older ones are kept here, because the log only holds the last few hundred entries.
  function callingsNorm(s, t) {
    const C = s.callings && typeof s.callings === 'object' ? s.callings : {};
    const fromLog = {};
    CALLING_ORDER.forEach((k) => { fromLog[k] = {}; });
    s.log.forEach((e) => {
      if (e.q == null || e.b || !e.d) return;
      const st = deedStat(s, e);
      CALLING_ORDER.forEach((k) => { if (CALLINGS[k].stat === st) { const w = weekOf(e.d); fromLog[k][w] = (fromLog[k][w] | 0) | (1 << dayIdx(e.d)); } });
    });
    const w0 = weekOf(t), prev = addDays(w0, -7), oldest = addDays(w0, -7 * 40);
    CALLING_ORDER.forEach((k) => {
      const c = C[k] && typeof C[k] === 'object' ? C[k] : {};
      const wk = c.wk && typeof c.wk === 'object' ? c.wk : {};
      Object.keys(fromLog[k]).forEach((w) => { wk[w] = w >= prev ? fromLog[k][w] : (wk[w] | 0) | fromLog[k][w]; });
      [w0, prev].forEach((w) => { if (!fromLog[k][w]) delete wk[w]; });
      Object.keys(wk).forEach((w) => { if (w < oldest || !/^\d{4}-\d\d-\d\d$/.test(w)) delete wk[w]; else wk[w] = wk[w] & 127; });
      C[k] = { wk: wk };
    });
    s.callings = C;
  }
  // Where a calling stands: this week's tally, the streak, buffs, and how strong that makes them.
  // 2.5 grace (see README, "Missed weeks"): each run of weeks carries one emergency skip. A week that misses the target
  // spends it instead of breaking the run, but doesn't count toward it, so the run takes a week longer. The skip comes
  // back with each completed run. The first deed of the kind after a missed week ("back at it") gives a short buff
  // that lasts twice as long.
  function callingState(s, k, now) {
    now = now || new Date();
    const C = CALLINGS[k], t = today(now), w0 = weekOf(t), wk = (s.callings && s.callings[k] && s.callings[k].wk) || {};
    const met = (w) => bits(wk[w] | 0) >= C.days;
    const grace = CALLING_TUNE.grace | 0;
    // every full run of weeks is a completion: the first brings them, each one after that is a long buff
    const ks = Object.keys(wk).sort();
    let run = 0, skips = grace, w1 = ks.length ? (ks[0] < w0 ? ks[0] : w0) : w0;
    const done = [], held = {}, paused = {};
    for (let guard = 0; w1 <= w0 && guard < 60; guard++, w1 = addDays(w1, 7)) {
      if (met(w1)) { run++; if (run % C.weeks === 0) { done.push(w1); skips = grace; } }
      else if (w1 < w0) {
        if (heldDays(s, C.stat, w1, t) >= 3) paused[w1] = true;   // 2.27: on hold (injured, sick, away): the run waits
        else if (run > 0 && skips > 0) { skips--; held[w1] = true; } else { run = 0; skips = grace; }
      }
    }
    const streak = run;
    const npc0 = (s.npcs || []).find((n) => n.comp === k);
    const since = npc0 && npc0.status === 'resident' && npc0.joined ? weekOf(npc0.joined) : null;
    let longUntil = 0;
    done.forEach((wkS) => {
      if (!since || wkS <= since) return; // that one brought them
      const m = wk[wkS] | 0;
      let n = 0;
      for (let i = 0; i < 7; i++) if (m & (1 << i)) { n++; if (n === C.days) { const end = parse(addDays(wkS, i + CALLING_TUNE.longDays)).getTime() + 86400000 - 1; if (end > longUntil) longUntil = end; break; } }
    });
    if (longUntil <= now.getTime()) longUntil = 0;
    const toward = met(w0) || run ? run % C.weeks : 0; // weeks into the next full run
    // the first day of the kind in a week that follows a missed one
    const backDay = (w) => { if (!grace || met(addDays(w, -7)) || !ks.some((x) => x < w)) return -1; const m = wk[w] | 0; for (let i = 0; i < 7; i++) if (m & (1 << i)) return i; return -1; };
    // short buffs: one per deed of the kind, inside its window
    const T = now.getTime(), shorts = [];
    let back = false;
    for (let i = 0; i < s.log.length && shorts.length < CALLING_TUNE.shortCap; i++) {
      const e = s.log[i];
      if (!e.t || e.t > T) continue;
      if (T - e.t > 2 * C.shortH * 3600e3) break;
      if (e.q == null || e.b || deedStat(s, e) !== C.stat) continue;
      const bw = e.d ? backDay(weekOf(e.d)) : -1, isBack = bw >= 0 && dayIdx(e.d) === bw;
      const hrs = C.shortH * (isBack ? 2 : 1);
      if (T - e.t <= hrs * 3600e3) { shorts.push(e.t + hrs * 3600e3); if (isBack) back = true; }
    }
    const weeks = [];
    for (let i = C.weeks - 1; i >= 0; i--) { const ws = addDays(w0, -7 * i); weeks.push({ w: ws, n: bits(wk[ws] | 0), met: met(ws), held: !!held[ws] || !!paused[ws], paused: !!paused[ws], now: i === 0 }); }
    const npc = (s.npcs || []).find((n) => n.comp === k);
    return { k: k, C: C, streak: streak, need: C.weeks, days: C.days, thisWeek: bits(wk[w0] | 0), weeks: weeks, longUntil: longUntil, shorts: shorts, toward: toward,
      skips: grace ? (run ? skips : grace) : 0, grace: grace, held: Object.keys(held), back: back,
      m: Math.round((CALLING_TUNE.base + (longUntil ? CALLING_TUNE.long : 0) + CALLING_TUNE.short * shorts.length) * 100) / 100, here: !!(npc && npc.status === 'resident') };
  }
  // Before/after: how many days a week each kind of deed got done, in the weeks before a day and the weeks since.
  // Counts days (not deeds), from the calling records (kept 40 weeks, so it outlasts the log). Whole Monday weeks only;
  // the week the pivot falls in is left out of both sides.
  function adherence(s, pivot, weeks, now) {
    weeks = weeks || 6;
    const t = today(now || new Date()), wp = weekOf(pivot), wt = weekOf(t);
    callingsNorm(s, t);
    const firstSeen = CALLING_ORDER.reduce((m, k) => { const ks = Object.keys((s.callings[k] || {}).wk || {}).sort(); return ks.length && (!m || ks[0] < m) ? ks[0] : m; }, null);
    const side = (from, n) => {
      const out = { from: from, weeks: 0, kinds: {} };
      CALLING_ORDER.forEach((k) => { out.kinds[k] = { days: 0, met: 0 }; });
      for (let i = 0; i < n; i++) {
        const w = addDays(from, 7 * i);
        if (w >= wt || (firstSeen && w < firstSeen)) continue; // not finished yet / before any record
        out.weeks++;
        CALLING_ORDER.forEach((k) => { const m = ((s.callings[k] || {}).wk || {})[w] | 0, d = bits(m); out.kinds[k].days += d; if (d >= CALLINGS[k].days) out.kinds[k].met++; });
      }
      CALLING_ORDER.forEach((k) => { const x = out.kinds[k]; x.perWeek = out.weeks ? Math.round((x.days / out.weeks) * 10) / 10 : null; });
      return out;
    };
    const before = side(addDays(wp, -7 * weeks), weeks), after = side(addDays(wp, 7), weeks);
    return { pivot: pivot, weeks: weeks, before: before, after: after, ready: after.weeks >= weeks, thin: before.weeks < 3 };
  }
  // Anyone whose calling's been answered moves in. Returns them.
  function callingsCheck(s, now) {
    now = now || new Date();
    callingsNorm(s, today(now));
    const out = [];
    CALLING_ORDER.forEach((k) => {
      const n = (s.npcs || []).find((x) => x.comp === k);
      if (!n || n.status === 'resident') return;
      const st = callingState(s, k, now);
      if (st.streak >= st.need) { n.status = 'resident'; n.joined = today(now); out.push(n); s.log.unshift({ t: now.getTime(), d: today(now), v: 1, n: CALLINGS[k].title + ' arrives: ' + n.name, i: '🤝', x: 0, g: 0 }); }
    });
    return out;
  }

  // ---------- wanderers: strangers who turn up at the gate as he levels, and move in for gold ----------
  // [key, level, gold, trade, role in the delve, element, garb, hat, a line about them]. They tag along like anyone else in the household.
  // 2.23: they come over a year's levels (the last at 48, was 40)
  const WANDERERS = [
    ['pedlar', 3, 120, 'Pedlar', 'scout', 'storm', 'oilskin', 'hat', 'Sells string and gossip. Knows every back road.'],
    ['bard', 6, 220, 'Bard', 'mage', 'holy', 'finery', 'hat', 'Three songs, all of them about soup.'],
    ['hedgeknight', 10, 380, 'Hedge knight', 'fighter', 'fire', 'armour', 'none', 'No lord, no horse, plenty of opinions.'],
    ['herbalist', 14, 520, 'Herbalist', 'healer', 'rot', 'robe', 'hood', 'Will not say what is in the tea.'],
    ['smith', 18, 700, 'Smith', 'fighter', 'fire', 'plain', 'none', 'Hits things until they are better.'],
    ['hermit', 22, 900, 'Hermit', 'mage', 'frost', 'robe', 'hood', 'Came down the mountain for the company. Regrets it.'],
    ['ranger', 26, 1150, 'Ranger', 'scout', 'storm', 'oilskin', 'hood', 'Sleeps outside by choice.'],
    ['corsair', 30, 1450, 'Corsair', 'fighter', 'storm', 'oilskin', 'tricorn', 'Retired. Mostly.'],
    ['abbess', 34, 1800, 'Abbess', 'healer', 'holy', 'robe', 'none', 'Has seen worse, and tidied it.'],
    ['alchemist', 38, 2200, 'Alchemist', 'mage', 'rot', 'finery', 'tricorn', 'The eyebrows grew back.'],
    ['champion', 43, 2800, 'Champion', 'fighter', 'holy', 'armour', 'none', 'Undefeated since losing that once.'],
    ['exile', 48, 4000, 'Exiled king', 'fighter', 'frost', 'finery', 'crown', 'Brought his own crown. Wants a small room.'],
  ];
  // 2.10: what each stranger wants of the house before moving in (as well as the gold). purpose: [kind, least tiles, how many];
  // rooms: least number of rooms; tiles: least floor in all. Shown as a checklist on their card.
  // 2.24: what they want of their own home in town (it starts as one bedroom), not of his house
  const WANTS = {
    pedlar: { purpose: [['store', 9, 1]] }, bard: { purpose: [['lounge', 16, 1]] }, hedgeknight: { purpose: [['gym', 12, 1]] },
    herbalist: { purpose: [['kitchen', 12, 1]], rooms: 3 }, smith: { purpose: [['workshop', 12, 1]] }, hermit: { purpose: [['study', 9, 1]], tiles: 70 },
    ranger: { purpose: [['store', 9, 1]], rooms: 3 }, corsair: { purpose: [['store', 12, 1]], tiles: 90 }, abbess: { purpose: [['bedroom', 6, 2]] },
    alchemist: { purpose: [['workshop', 20, 1], ['study', 12, 1]] }, champion: { purpose: [['gym', 25, 1]], tiles: 120 }, exile: { purpose: [['bedroom', 30, 1]], rooms: 5, tiles: 160 },
  };
  const roomTiles = (r) => (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
  // [{ text, ok }] for a stranger (by npc id), or [] if they want nothing of the house.
  function npcWants(s, id) {
    const hm = s.homes && s.homes[id], w = WANTS[String(id).replace(/^w-/, '')], rooms = (hm && hm.house && hm.house.rooms) || [], out = [];
    if (!w || String(id).indexOf('w-') !== 0) return out;
    (w.purpose || []).forEach((p) => {
      const have = rooms.filter((r) => r.purpose === p[0] && roomTiles(r) >= p[1]).length, nm = ROOM_PURPOSES[p[0]].n.toLowerCase();
      out.push({ text: (p[2] > 1 ? p[2] + ' ' + nm + 's' : 'A ' + nm) + (p[1] > 1 ? ' of ' + p[1] + ' tiles or more' : ''), ok: have >= p[2] });
    });
    if (w.rooms) out.push({ text: w.rooms + ' rooms in their house (' + rooms.length + ' now)', ok: rooms.length >= w.rooms });
    if (w.tiles) { const tot = rooms.reduce((a, r) => a + roomTiles(r), 0); out.push({ text: w.tiles + ' tiles of floor in all (' + tot + ' now)', ok: tot >= w.tiles }); }
    return out;
  }

  // ---------- requests from the household (2.10) ----------
  // Someone living in the house asks for a real deed, by a day. Two open at most, one new one a day at most. Keeping one
  // pays gold and a point of friendship with whoever asked (every third point, a coffer) and, if the next boss's fear
  // isn't known, they pass on what they've heard. Letting one lapse costs nothing.
  function asksNorm(s) { if (!s.asks || !Array.isArray(s.asks.list)) s.asks = { list: [], day: null, kept: 0 }; }
  const ahash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function asksTick(s, t, now) {
    asksNorm(s);
    const A = s.asks;
    A.list = A.list.filter((a) => !a.done && a.by >= t && s.quests.some((q) => q.id === a.q && !q.archived) && s.npcs.some((n) => n.id === a.from && n.status === 'resident'));
    if (A.day === t) return null;
    A.day = t;
    const h = ahash('ask' + t + (s.created || ''));
    const folk = s.npcs.filter((n) => n.status === 'resident' && !A.list.some((a) => a.from === n.id));
    if (A.list.length >= 2 || !folk.length || h % 10 >= 5) return null;
    const birdJobs = s.quests.some((q) => !q.archived && (q.home === 'birds' || q.home === 'aviary') && !s.log.some((e) => e.q === q.id && daysBetween(e.d, t) <= 2));
    const askers = folk.filter((n) => n.kind !== 'bird' || birdJobs), who = (askers.length ? askers : folk)[(h >>> 4) % (askers.length || folk.length)], H = homeState(s, t), busy = {}; A.list.forEach((a) => { busy[a.q] = 1; });
    let pool = s.quests.filter((q) => !q.archived && q.type !== 'todo' && !busy[q.id] && !(q.rest > 3 && restLeft(q, t) > 2) && !isAway(q, t) && !isAway(q, addDays(t, 3)));   // 2.27: not what's put away
    if (who.kind === 'bird') pool = pool.filter((q) => q.home === 'birds' || q.home === 'aviary');
    if (!pool.length) return null;
    const late = pool.filter((q) => q.home && H[q.home] && H[q.home].state >= 1);
    const stale = pool.filter((q) => !s.log.some((e) => e.q === q.id && daysBetween(e.d, t) <= 2));
    // only ever a nudge towards something that's slipping: late upkeep first, else something not done for three days
    const from = late.length ? late : stale;
    if (!from.length) return null;
    const q = from[(h >>> 9) % from.length];
    const n = q.home || q.rest > 1 || who.kind === 'bird' ? 1 : 2, d0 = DIFF[clampDiff(q.diff) - 1];
    const a = { id: nextId(s), from: who.id, q: q.id, n: n, by: addDays(t, n === 1 ? 2 : 3), since: now, gold: 10 + d0.gold * n * 2, progress: 0, done: null };
    A.list.push(a);
    return a;
  }
  // Counts progress; pays any that are met. Returns [{ ask, npc, chest, hint }].
  function asksSync(s, t, now) {
    asksNorm(s);
    const out = [];
    s.asks.list.forEach((a) => {
      if (a.done) return;
      a.progress = s.log.filter((e) => e.q === a.q && e.t >= a.since).length;
      if (a.progress < a.n) return;
      if (s.town) { const ag = townPerks(s).askGold; if (ag) a.gold = Math.round(a.gold * (1 + ag / 100)); }
      a.done = t; s.gold += a.gold; s.asks.kept = (s.asks.kept | 0) + 1;
      const npc = s.npcs.find((n) => n.id === a.from), r = { ask: a, npc: npc, chest: false, hint: null };
      if (npc) { npc.bond = (npc.bond | 0) + 1; if (npc.bond % 3 === 0) { s.chests += 1; r.chest = true; } }
      const d = s.delve;
      if (d && root.G.dungeonFor && npc && npc.kind === 'human') {
        const k = d.known[d.n] = d.known[d.n] || {};
        if (!k.boss && !k.lore) { k.lore = true; r.hint = root.G.dungeonFor(d.seed, d.n).weak; }
      }
      s.log.unshift({ t: now, d: t, v: 1, n: 'For ' + (npc ? npc.name : 'the house') + ': ' + ((s.quests.find((q) => q.id === a.q) || {}).name || 'a favour'), i: '💛', x: 0, g: a.gold });
      out.push(r);
    });
    s.asks.list = s.asks.list.filter((a) => !a.done);
    return out;
  }

  // ---------- the trader (2.10) ----------
  // Calls on about two days in five, but only at a house that's been kept busy (deeds on four of the last seven days).
  // Brings four pieces no better than the hero's level allows, and pays 30% over the usual for anything sold to him.
  const TRADER_SELL = 1.3, TRADER_BUY = 3;
  function traderTick(s, t) {
    const h = ahash('trader' + t + (s.created || ''));
    let days = 0; for (let i = 1; i <= 7; i++) { const d = addDays(t, -i); if (s.log.some((e) => e.q != null && e.d === d)) days++; }
    const here = h % 5 < 2 && days >= 4;
    if (!here) { if (s.trader && s.trader.day !== t) s.trader = null; return null; }
    if (s.trader && s.trader.day === t) return s.trader;
    let a = h || 1; const rnd = () => { a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const tiers = [1, 1, 2, s.level >= 10 ? 3 : 2], stock = tiers.map((tr) => rollItem(s, tr, rnd));
    stock.forEach((it) => { it.price = Math.max(20, itemValue(it) * TRADER_BUY); });
    s.trader = { day: t, stock: stock };
    return s.trader;
  }
  const traderHere = (s, t) => !!(s.trader && s.trader.day === t);
  const sellFor = (s, it, t) => Math.round(sellValue(it) * (traderHere(s, t) ? TRADER_SELL : 1) * (s.town && s.town.on.indexOf('market') >= 0 ? 1.1 : 1));
  function traderBuy(s, id, t) {
    if (!traderHere(s, t)) return 'He has gone';
    const i = s.trader.stock.findIndex((x) => x.id === id); if (i < 0) return 'Already sold';
    const it = s.trader.stock[i]; if (s.gold < it.price) return 'Need ' + (it.price - s.gold) + ' more gold';
    s.gold -= it.price; s.trader.stock.splice(i, 1); const own = Object.assign({}, it); delete own.price; s.inv.push(own);
    return null;
  }

  function wanderersCheck(s) {
    if (!s.wanderers || typeof s.wanderers !== 'object') s.wanderers = {};
    const out = [];
    WANDERERS.forEach((w) => {
      if (s.level < w[1] || s.wanderers[w[0]]) return;
      s.wanderers[w[0]] = 1;
      if (s.npcs.some((n) => n.id === 'w-' + w[0])) return;
      let nm = randomName();
      for (let i = 0; i < 30 && (nm === (s.hero && s.hero.name) || s.npcs.some((x) => x.name === nm)); i++) nm = randomName();
      const n = { id: 'w-' + w[0], kind: 'human', name: nm, look: randomLook(), garb: w[6], hat: w[7], about: w[3] + '. ' + w[8], status: 'waiting', via: { type: 'gold', gold: w[2] }, role: w[4], el: w[5], home: null, joined: null };
      s.npcs.push(n); out.push(n);
    });
    return out;
  }
  const wandererNext = (s) => WANDERERS.find((w) => !(s.wanderers && s.wanderers[w[0]]) && s.level < w[1]) || null;

  function npcInvite(s, id) {
    const n = s.npcs.find((x) => x.id === id);
    if (!n || n.status !== 'waiting' || n.via.type !== 'gold') return 'Not up for invitation';
    if (s.gold < n.via.gold) return 'Need ' + (n.via.gold - s.gold) + ' more gold';
    if (s.npcs.filter((x) => x.kind === 'human' && x.status === 'resident').length >= 16) return 'Sixteen people is a full house';
    s.gold -= n.via.gold;
    n.status = 'resident'; n.joined = today();
    return null;
  }
  // A vow's been kept: whoever was waiting on it moves in. Returns them.
  function npcVowKept(s, goalId) {
    const out = [];
    s.npcs.forEach((n) => { if (n.status === 'waiting' && n.via.type === 'vow' && n.via.vow === goalId) { n.status = 'resident'; n.joined = today(); out.push(n); } });
    return out;
  }

  // ================= 2.15: which stat a job feeds =================
  // Discipline was swallowing everything that wasn't exercise, food or study. Sweaty jobs now feed Endurance, heavy and
  // building jobs feed Strength, and paperwork and planning feed Intellect. Discipline keeps routines and self-control.
  const RESTAT = {};
  ('Mow the lawn|Clean the aviary|Vacuum|Mop the floors|Clean the bathroom|Clean the toilet|Sweep the floors|Clean the oven|Clean the windows|Wash the walls, doors and skirtings|Whipper-snip the edges|Weed the garden beds|' +
    'Rake leaves / sweep the paths|Pressure-wash the paving|Wash the car|Vacuum and tidy the car|Clean the pool / check the water|Wash the outdoor furniture|Clean the fridge inside and out|Clean the tank or enclosure|Run the errands')
    .split('|').forEach((n) => { RESTAT[n.toLowerCase()] = 'END'; });
  ('Work on the house|Paint or patch a wall|Tidy the shed or garage|Turn the compost|Fertilise or mulch|Plant something|Tend the vegie patch|Hardware shop run|Service the mower and garden tools|Service the bike')
    .split('|').forEach((n) => { RESTAT[n.toLowerCase()] = 'STR'; });
  ('Clear the inbox|Pay the bills|Check the bank and budget|File the paperwork pile|Review subscriptions and cancel one|Life admin power hour|Renew a card, licence or check before it lapses|Back up the important documents|' +
    'Clear the work to-do list|Write up notes / handover properly|Follow up an application or contact|Renew a ticket or check (First Aid, WWCC, registration)|Check the roster and plan the week around it|' +
    'Plan tomorrow tonight|Weekly review and plan|Tidy the head: brain-dump to paper|Plan the week’s meals|Back up the phone and computer|Sort and cull photos|Tidy the notes and to-do apps|Fix that one small thing|Sort the mail')
    .split('|').forEach((n) => { RESTAT[n.toLowerCase()] = 'INT'; });
  const restatOf = (name, stat) => (stat === 'DIS' && RESTAT[String(name || '').toLowerCase()]) || stat;
  DEFAULT_QUESTS.forEach((d) => { d[3] = restatOf(d[0], d[3]); });
  // One-off for a save from before 2.15: move those quests, and the XP they've already earned (as far back as the log goes).
  function restatSave(s) {
    if (s.statV >= 1) return 0;
    s.statV = 1; let moved = 0;
    (s.quests || []).forEach((q) => {
      const to = restatOf(q.name, q.stat); if (to === q.stat) return;
      (s.log || []).forEach((e) => { if (e.q === q.id && e.s === 'DIS' && e.x > 0) { const x = Math.min(s.stats.DIS || 0, e.x + (e.b | 0)); s.stats.DIS -= x; s.stats[to] = (s.stats[to] || 0) + x; e.s = to; moved += x; } });
      q.stat = to;
    });
    return moved;
  }

  // ================= 2.17: wind, and the old roads =================
  // Something to play when there's time to kill, that can't stand in for the work: every deed gives a point of wind,
  // and walking a dungeon he's already cleared (by hand, making the calls) costs two. It pays a little gold, capped
  // by the day, and nothing else: no XP, no stats, no loot, no progress.
  const WIND_MAX = 12, SPAR_COST = 2;
  const windOf = (s) => Math.max(0, Math.min(WIND_MAX, s.wind | 0));
  // 2.18: the old roads are fought by hand and rated out of five. Each star pays once per dungeon, ever.
  const ROAD_STARS = 5;
  const roadMask = (s, n) => ((s.roads && s.roads[n]) | 0) & 31;
  const starBits = (m) => { let c = 0; for (let i = 0; i < ROAD_STARS; i++) if (m & (1 << i)) c++; return c; };
  const roadStars = (s, n) => starBits(roadMask(s, n));
  const starGold = (dGold) => Math.max(10, Math.round((dGold || 0) * 0.2));   // 2.22: five stars pays what the dungeon first did (was three times: at a dungeon a week, the roads would have out-earned everything else)
  function sparState(s, t) {
    const cleared = (s.delve && s.delve.n) | 0;
    let have = 0; for (let n = 0; n < cleared; n++) have += roadStars(s, n);
    return { wind: windOf(s), max: WIND_MAX, cost: SPAR_COST, cleared: cleared, stars: have, of: cleared * ROAD_STARS,
      ok: cleared > 0 && windOf(s) >= SPAR_COST, why: !cleared ? 'Clear a dungeon first' : windOf(s) < SPAR_COST ? 'Out of wind. Every deed gives one' : null };
  }
  // Takes the wind for a walk. Returns false if he hasn't the wind.
  function sparStart(s, t) {
    const st = sparState(s, t); if (!st.ok) return false;
    s.wind = st.wind - SPAR_COST;
    s.spar = { day: t, runs: ((s.spar && s.spar.runs) | 0) + 1 };
    return true;
  }
  // Settles a finished walk: pays for any star he hadn't earned on that dungeon before, and keeps it.
  function roadsPay(s, t, n, mask, dGold) {
    const old = roadMask(s, n), fresh = (mask & 31) & ~old, k = bits(fresh), g = k * starGold(dGold);
    s.roads = s.roads && typeof s.roads === 'object' ? s.roads : {};
    s.roads[n] = old | fresh;
    if (g) { s.gold += g; s.log.unshift({ t: Date.now(), d: t, v: 1, n: 'Old road ' + (n + 1) + ': ' + k + ' new star' + (k > 1 ? 's' : ''), i: '⭐', x: 0, g: g }); }
    return { gold: g, fresh: fresh, n: k, total: bits(old | fresh) };
  }

  // ================= 2.19: his week (the questionnaire) =================
  // A few facts about his week (bin day, payday, the big shop) so the plan and the weeklies fit real life: the bins
  // come up on bin night and only then, the budget on payday, and nothing that needs booking ahead (the dentist, a
  // haircut) is ever put on a list to clear today. Days are 0 = Monday … 6 = Sunday, as dayIdx gives them.
  const LIFE_RE = { bins: /\bbins?\b|rubbish|recycling/i, pay: /pay the bills|\bbills\b|budget|\bbank\b|savings|transfer/i, shop: /grocer|big shop|food shop|shopping list|plan the week.s meals|meal plan/i };
  const SCHED_RE = /appointment|dentist|\bGP\b|check-?up|haircut|barber|eye test|skin check|vet check|blood test|optometrist|car service|service the car|physio(?!.*exercise)/i;
  const LIFE_WHY = { bins: 'bin night', pay: 'payday', shop: 'shop day' };
  function lifeTag(q) {
    const n = (q && q.name) || '';
    if (!/^book\b/i.test(n) && SCHED_RE.test(n)) return 'sched';
    for (const k in LIFE_RE) if (LIFE_RE[k].test(n)) return k;
    return null;
  }
  function lifeNorm(s) {
    const L = s.life && typeof s.life === 'object' ? s.life : {}, d7 = (v) => (v == null || v === '' || !(v >= 0 && v <= 6) ? null : v | 0);
    s.life = { asked: !!L.asked, skip: !!L.skip, bin: d7(L.bin), eve: L.eve !== false, payEvery: [7, 14, 30].indexOf(L.payEvery) >= 0 ? L.payEvery : L.payEvery === 0 ? 0 : null,
      payLast: typeof L.payLast === 'string' && /^\d{4}-\d\d-\d\d$/.test(L.payLast) ? L.payLast : null, shop: d7(L.shop) };
    return s.life;
  }
  function isPayday(s, t) {
    const L = s.life || {}; if (!L.payEvery || !L.payLast) return false;
    if (L.payEvery === 30) { const a = parse(L.payLast), b = parse(t), dim = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate(); return b.getDate() === Math.min(a.getDate(), dim); }
    const n = daysBetween(L.payLast, t); return ((n % L.payEvery) + L.payEvery) % L.payEvery === 0;
  }
  function nextPayday(s, t) { for (let i = 0; i < 40; i++) { const d = addDays(t, i); if (isPayday(s, d)) return d; } return null; }
  // 'on' (today is its day), 'off' (it has a day and this isn't it), 'never' (needs booking ahead), or null (no idea).
  function lifeOn(s, q, t) {
    const tag = lifeTag(q), L = s.life || {}, wd = dayIdx(t);
    if (tag === 'sched') return 'never';
    if (tag === 'bins') return L.bin == null ? null : wd === L.bin || (L.eve && wd === (L.bin + 6) % 7) ? 'on' : 'off';
    if (tag === 'pay') return !L.payEvery || !L.payLast ? null : isPayday(s, t) || isPayday(s, addDays(t, -1)) ? 'on' : 'off';
    if (tag === 'shop') return L.shop == null ? null : wd === L.shop || (/plan|list/i.test(q.name) && wd === (L.shop + 6) % 7) ? 'on' : 'off';   // the list the day before; the shop on the day
    return null;
  }
  // The most times a deed can sensibly be asked for in a week: what its own settings allow, what his week allows
  // (the bins go out once), and what he has actually managed in a week lately.
  function questWeekCap(s, q, t) {
    const tag = lifeTag(q);
    if (tag === 'sched') return 0;
    let cap = q.type === 'daily' ? (q.rest > 1 ? Math.max(1, Math.ceil(7 / q.rest)) : (q.days || []).filter(Boolean).length || 7) : q.rest > 1 ? Math.max(1, Math.floor(7 / q.rest)) : 10;
    if (tag === 'bins' && s.life && s.life.bin != null) cap = 1;
    const ws = weekStart(t), since = addDays(ws, -28), per = [0, 0, 0, 0];
    let any = 0;
    s.log.forEach((e) => { if (e.q === q.id && e.d >= since && e.d < ws) { const w = Math.min(3, Math.floor((daysBetween(e.d, ws) - 1) / 7)); per[w]++; any++; } });
    const mx = Math.max.apply(null, per);
    if (any >= 2 && mx <= 1) cap = Math.min(cap, 1);
    else if (any) cap = Math.min(cap, mx + 1);
    return cap;
  }
  // Weeklies already on offer that ask for more than his week allows are brought down to it.
  function weekliesFit(s, t) {
    const tr = s.trials; if (!tr) return 0;
    let n = 0;
    tr.list.forEach((g) => {
      if (g.done || !g.filter || g.filter.type !== 'quest') return;
      const q = findQ(s, g.filter.id); if (!q) return;
      const cap = Math.max(1, questWeekCap(s, q, t));
      if (g.target > cap) { g.gold = Math.max(10, Math.round(g.gold * cap / g.target)); g.target = cap; g.title = cap === 1 ? q.name + ', once' : q.name + ' × ' + cap; n++; }
    });
    return n;
  }

  // ================= 2.14: today's plan =================
  // One list he can clear: the dailies that are due, plus a handful of habits and to-dos picked for the day he's
  // actually having (day off, work day, long shift) and the weather outside. Everything else stays on offer below.
  const OUT_RE = /swim|\brun\b|walk|bike|\bride\b|hike|surf|paddle|kayak|beach|mow|lawn|garden|weed|wash the car|fishing|camp|daylight|sunrise|sunset|outside|photography|aviary|steps|errand/i;
  const isOut = (q) => (q.out != null ? !!q.out : OUT_RE.test(q.name || ''));
  // w: { d, max, rain (mm), prob (%), wind (km/h) } from the forecast, or null
  function weatherRead(w, t) {
    if (!w || w.d !== t || typeof w.max !== 'number') return null;
    const wet = (w.rain || 0) >= 3 || (w.prob || 0) >= 70, windy = (w.wind || 0) >= 40, cold = w.max < 17, hot = w.max >= 35;
    const bad = wet || windy || hot, good = !bad && w.max >= 19 && w.max <= 32;
    const bits = [Math.round(w.max) + '°'];
    if (wet) bits.push('wet'); else if ((w.prob || 0) >= 40) bits.push('showers about'); else bits.push('dry');
    if (windy) bits.push('windy');
    return { wet: wet, windy: windy, cold: cold, hot: hot, bad: bad, good: good, icon: wet ? '🌧️' : windy ? '💨' : hot ? '🥵' : cold ? '☁️' : '☀️', text: bits.join(', ') };
  }
  const PLAN_SIZE = { off: 6, work: 3, long: 1, none: 4 };
  const planSize = (s, kind) => { const st = s.settings || {}, k = kind || 'none'; const v = st.planN && st.planN[k]; return Math.max(0, Math.min(12, v == null ? PLAN_SIZE[k] : v | 0)); };
  function planScore(s, q, t, kind, wx, hs) {
    let v = 0; const why = [];
    const last = s.log.find((e) => e.q === q.id), days = last ? Math.max(0, daysBetween(last.d, t)) : null;
    v += days == null ? 10 : Math.min(14, days) * 2;
    if (q.type === 'todo') v += 15;
    if (q.home && hs[q.home] && hs[q.home].linked) { if (hs[q.home].state === 2) { v += 50; why.push('overdue'); } else if (hs[q.home].state === 1) { v += 25; why.push('due soon'); } }
    const wk = (types) => s.trials && s.trials.list.some((g) => !g.done && g.kind !== 'manual' && inWindow(g, t) && g.filter && types.indexOf(g.filter.type) >= 0 && goalMatches(s, g, { q: q.id, s: q.stat }));
    if (wk(['quest', 'home'])) { v += 30; why.push('counts for a weekly'); } else if (wk(['stat'])) v += 8;
    if (s.asks && s.asks.list.some((a) => !a.done && a.q === q.id)) { v += 40; why.push('asked for'); }
    if (lifeOn(s, q, t) === 'on') { v += 60; why.push(LIFE_WHY[lifeTag(q)]); }
    if (kind === 'long') { if (q.diff > 2) v -= 60; if (q.home) v -= 30; }
    else if (kind === 'work') { if (q.diff > 3) v -= 40; }
    else if (kind === 'off') { if (q.diff >= 3) v += 10; }
    if (wx && isOut(q)) {
      if (wx.bad) v -= 40; else if (wx.good) { v += 15; why.push('fine out'); }
      if (wx.cold && /swim|surf|paddle|kayak|ocean|dip/i.test(q.name)) v -= 15;
    }
    v += ahash('plan' + t + q.id) % 9;
    return { v: v, why: why[0] || '' };
  }
  function planPool(s, t) {
    return s.quests.filter((q) => !q.archived && !isAway(q, t) && ((q.type === 'habit' && !(restLeft(q, t) > 0)) || (q.type === 'todo' && !q.doneOn)));
  }
  function planRank(s, t, kind, wx, skip) {
    const hs = homeState(s, t), sk = skip || {};
    return planPool(s, t).filter((q) => !sk[q.id] && !(q.type === 'habit' && habitCount(q, t) > 0) && ['never', 'off'].indexOf(lifeOn(s, q, t)) < 0).map((q) => { const r = planScore(s, q, t, kind, wx, hs); return { q: q, v: r.v, why: r.why }; });
  }
  function planPick(ranked, n, have) {
    const out = [], per = {}; (have || []).forEach((q) => { per[q.stat] = (per[q.stat] || 0) + 1; });
    const pool = ranked.slice();
    while (out.length < n && pool.length) {
      pool.sort((a, b) => (b.v - 12 * (per[b.q.stat] || 0)) - (a.v - 12 * (per[a.q.stat] || 0)) || (a.q.id < b.q.id ? -1 : 1));
      const x = pool.shift(); if (x.v - 12 * (per[x.q.stat] || 0) < -20 && out.length) break;   // nothing left that suits the day
      out.push(x); per[x.q.stat] = (per[x.q.stat] || 0) + 1;
    }
    return out;
  }
  // Builds today's plan once, and keeps it: ticking things off must shrink it, not refill it. It's drawn again only
  // if the day turns out different (the roster or the forecast arrives) and nothing on it has been done yet.
  function planFor(s, t) {
    const kind = dayKind(s, t), wx = weatherRead(s.weather, t), key = (kind || 'none') + '|' + (wx ? (wx.bad ? 'b' : wx.good ? 'g' : 'n') + (wx.cold ? 'c' : '') : '-');
    const P = s.plan && s.plan.day === t ? s.plan : null;
    const alive = (id) => s.quests.some((q) => q.id === id && !q.archived);
    if (P) {
      P.ids = P.ids.filter(alive);
      const touched = P.ids.some((id) => s.log.some((e) => e.q === id && e.d === t)) || P.swaps > 0;
      if (P.key === key || touched) return P;
    }
    const picks = planPick(planRank(s, t, kind, wx), planSize(s, kind), []);
    const why = {}; picks.forEach((x) => { if (x.why) why[x.q.id] = x.why; });
    s.plan = { day: t, key: key, kind: kind || null, ids: picks.map((x) => x.q.id), why: why, swaps: 0, paid: P ? !!P.paid : false };
    return s.plan;
  }
  const PLAN_SWAPS = 2;
  // "Not today": trade one planned thing for the next best. Two a day.
  function planSwap(s, t, id0) {
    const P = planFor(s, t), i = P.ids.findIndex((x) => String(x) === String(id0)), id = P.ids[i];
    if (i < 0) return { err: 'Not on the plan' };
    if (P.swaps >= PLAN_SWAPS) return { err: 'Two swaps a day' };
    if (s.log.some((e) => e.q === id && e.d === t)) return { err: 'Already done' };
    const skip = {}; P.ids.forEach((x) => { skip[x] = 1; }); (P.out || []).forEach((x) => { skip[x] = 1; });
    const have = P.ids.filter((x) => x !== id).map((x) => findQ(s, x)).filter(Boolean);
    const next = planPick(planRank(s, t, dayKind(s, t), weatherRead(s.weather, t), skip), 1, have)[0];
    P.out = (P.out || []).concat(id); P.swaps++;
    if (next) { P.ids[i] = next.q.id; if (next.why) P.why[next.q.id] = next.why; } else P.ids.splice(i, 1);
    return { to: next ? next.q : null };
  }
  // Where the plan stands: what's left, and whether the whole thing (due dailies included) is cleared.
  function planState(s, t) {
    const P = planFor(s, t);
    const dailies = s.quests.filter((q) => !q.archived && q.type === 'daily' && dueOn(q, t) && !excused(s, q, t));
    const items = P.ids.map((id) => findQ(s, id)).filter((q) => q && !isAway(q, t));   // 2.27: put away, so off the plan
    const fin = (q) => (q.type === 'daily' || q.type === 'todo' ? q.doneOn === t : habitCount(q, t) > 0);
    const total = dailies.length + items.length, left = dailies.filter((q) => !fin(q)).length + items.filter((q) => !fin(q)).length;
    return { plan: P, dailies: dailies, items: items, total: total, left: left, clear: total > 0 && left === 0, fin: fin, swapsLeft: PLAN_SWAPS - P.swaps, wx: weatherRead(s.weather, t), kind: P.kind };
  }
  // 2.19: three bonus buffs, each in a slot of its own (they don't push a deed's buff off the list).
  // All the day's dailies done; every pick done; a weekly finished (its buff fits what the weekly trained).
  const BONUS = {
    dailies: { n: 'All dailies done', i: '✅', type: 'ready', di: 0, hrs: 24 },
    plan: { n: 'Every pick done', i: '🗒️', type: 'edge', di: 0, hrs: 24 },
    weekly: { n: 'A weekly finished', i: '📜', hrs: 72, di: 2 },
  };
  const WEEKLY_BUFF = { STR: 'edge', END: 'sure', VIT: 'fed', INT: 'keen', DIS: 'ready', TRAIN: 'edge' };
  function bonusGive(s, k, type, now, t, from) {
    const B = BONUS[k], BF = G.BUFFS; if (!BF || !BF[type]) return null;
    s.bonus = s.bonus && typeof s.bonus === 'object' ? s.bonus : {};
    s.bonus[k] = { day: t, t: now, until: now + B.hrs * 3600e3, type: type, amt: BF[type].amt[B.di], from: from || B.n };
    return s.bonus[k];
  }
  function bonusWeekly(s, g, now, t) {
    const f = g.filter || {}, q = f.type === 'quest' ? findQ(s, f.id) : null;
    const type = f.type === 'stat' ? WEEKLY_BUFF[f.stat] : q ? WEEKLY_BUFF[q.stat] : f.type === 'home' ? 'ready' : 'luck';
    return bonusGive(s, 'weekly', type || 'edge', now, t, 'Weekly: ' + g.title);
  }
  // Settles the day's two: gives them when earned, and takes them back if an undo un-earns them the same day.
  function bonusTick(s, t, now) {
    const st = planState(s, t), b = s.bonus || {}, out = [];
    const dl = st.dailies.length > 0 && st.dailies.every(st.fin), pk = st.items.length > 0 && st.items.every(st.fin);
    if (dl && !(b.dailies && b.dailies.day === t)) out.push(['dailies', bonusGive(s, 'dailies', BONUS.dailies.type, now, t)]);
    else if (!dl && b.dailies && b.dailies.day === t) delete s.bonus.dailies;
    if (pk && !(b.plan && b.plan.day === t)) out.push(['plan', bonusGive(s, 'plan', BONUS.plan.type, now, t)]);
    else if (!pk && b.plan && b.plan.day === t) delete s.bonus.plan;
    return out.filter((x) => x[1]);
  }
  // Pays once a day when the plan is cleared. Returns { gold } or null.
  function planClaim(s, t, now) {
    const st = planState(s, t);
    if (!st.clear || st.plan.paid) return null;
    const gold = 10 + 3 * st.total;
    st.plan.paid = true; s.gold += gold; s.planDays = (s.planDays | 0) + 1;
    s.log.unshift({ t: now, d: t, v: 1, n: 'Plan cleared (' + st.total + ')', i: '🗒️', x: 0, g: gold });
    return { gold: gold, n: st.total, days: s.planDays };
  }

  // ================= 2.23: the end of the content, and New Game+ =================
  // About a year of ordinary play (tools/sim/year.js): level 50, every one of the 78 bosses, the estate at its top tier, all the
  // land, every town building mastered. Then he's offered New Game+ (a new hero, his deeds and settings kept, the old one's statue
  // in the new yard) or he keeps going on a hero whose dungeons come round again, Reborn, and keep climbing.
  const END_LEVEL = 50, END_DUNGEON = 78;
  function contentState(s) {
    const est = Object.keys(ESTATE), tw = Object.keys(TOWN), T = s.town;
    const list = [
      { k: 'level', text: 'Reach level ' + END_LEVEL, have: Math.min(s.level, END_LEVEL), of: END_LEVEL },
      { k: 'bosses', text: 'Beat every boss', have: Math.min((s.delve && s.delve.n) | 0, END_DUNGEON), of: END_DUNGEON },
      { k: 'estate', text: 'Finish the estate', have: est.filter((k) => estateNext(s, k).max).length, of: est.length },
      { k: 'land', text: 'Buy all the land', have: landOf(s).lv, of: LANDS.length },
      { k: 'town', text: 'Master the town', have: T ? tw.filter((k) => T.own[k] && (T.tier[k] | 0) >= TOWN_TIERS).length : 0, of: tw.length },
    ];
    list.forEach((x) => { x.ok = x.have >= x.of; });
    return { list: list, done: list.every((x) => x.ok), on: s.complete && s.complete.on };
  }
  // Called as the save changes: the first time everything's done, marks it and gives the Victor's Statue. Returns the state then.
  function contentCheck(s, t) {
    if (s.complete && s.complete.on) return null;
    const st = contentState(s);
    if (!st.done) return null;
    s.complete = { on: t || today(), cont: false };
    if (s.decor.owned.indexOf('victor') < 0) { s.decor.owned.push('victor'); if (s.house) relicOut(s, 'victor'); }
    return st;
  }
  // A new hero. Kept: the deeds and their aliases, the rewards, settings, looks, the herald, the roster, real-life details,
  // the birds, the daily history. Gone: everything earned. The old hero joins s.legacy and stands in the new yard in stone.
  function newGamePlus(s, t) {
    t = t || today();
    const old = JSON.parse(JSON.stringify(s)), f = normalize(null, t);
    f.quests = old.quests.map((q) => Object.assign(q, { count: 0, countOn: null, doneOn: null }));
    f.seq = Math.max(f.seq | 0, old.seq | 0);
    ['rewards', 'settings', 'look', 'lookSet', 'lookV', 'uiV', 'weather', 'herald', 'heraldV', 'roster', 'life', 'days', 'qlast', 'people', 'peopleNo', 'calPeople', 'calTodo', 'petsSet'].forEach((k) => { if (old[k] != null) f[k] = old[k]; });
    f.pets = (old.pets || []).map((p) => Object.assign({}, p, { item: null }));   // 2.26: the pets come too, and get their homes back below
    f.hero = { name: old.hero.name, title: '' };
    if (old.hero.f != null) f.hero.f = old.hero.f;
    const birds = (old.npcs || []).filter((n) => n.kind === 'bird');
    f.npcs = (f.npcs || []).filter((n) => n.kind !== 'bird').concat(birds);
    f.legacy = (old.legacy || []).concat([{ name: old.hero.name, level: old.level, created: old.created, finished: (old.complete && old.complete.on) || t, dungeons: (old.delve && old.delve.n) | 0, look: old.look, gold: old.estate ? old.estate.spent | 0 : 0 }]);
    f.ngp = (old.ngp | 0) + 1;
    f.welcomed = true; f.created = t;
    const out = normalize(f, t);
    const PK = root.G && root.G.PET_KINDS;
    if (PK) (out.pets || []).forEach((p) => { const k = PK[p.sp] && PK[p.sp].furn; if (!k) return; out.house.bought[k] = (out.house.bought[k] | 0) + 1; if (houseAuto(out, k, null, null)) p.item = out.house.seq; });
    out.legacy.slice(-6).forEach((x, i) => { const k = 'legacy' + (i + 1); if (out.decor.owned.indexOf(k) < 0) { out.decor.owned.push(k); if (out.house) relicOut(out, k); } });
    return out;
  }

  // ================= 2.13: the town =================
  // Buildings he buys with gold. A few can be open at a time. An open one helps a little straight away (a stat grows
  // faster, flasks heal more) and sets a challenge; meet it and the reward is his for good, then a longer one is set.
  // Close a building part-way through a challenge and that challenge starts again from nothing.
  const TOWN_TIERS = 5;
  // 2.23: spread from level 8 to 40 (was 8 to 15) and dearer, and each challenge met is only his once he pays the builders
  // (TOWN_PAY x the building's price): gold matters more as the year goes on.
  const TOWN_PAY = [0.3, 0.6, 1, 1.6, 2.5];
  const TOWN = {
    gym: { icon: '🏋️', name: 'Gym', cost: 600, lvl: 8, act: { grow: 'STR' }, meter: 'STR', goals: [1, 2, 3, 3, 4], ask: (n) => 'Gain ' + n + ' Strength', rw: [['dmg', 3]] },
    track: { icon: '🏃', name: 'Running track', cost: 800, lvl: 10, act: { grow: 'END' }, meter: 'dEND', goals: [10, 20, 30, 45, 60], ask: (n) => 'Log ' + n + ' Endurance deeds', rw: [['evade', 1.5]] },
    baths: { icon: '♨️', name: 'Bathhouse', cost: 1100, lvl: 13, act: { grow: 'VIT' }, meter: 'level', goals: [1, 2, 2, 3, 3], ask: (n) => 'Gain ' + n + ' level' + (n > 1 ? 's' : ''), rw: [['hp', 4]] },
    library: { icon: '📚', name: 'Library', cost: 1500, lvl: 16, act: { grow: 'INT' }, meter: 'INT', goals: [1, 2, 3, 3, 4], ask: (n) => 'Gain ' + n + ' Intellect', rw: [['mpRoom', 1]] },
    dojo: { icon: '🥋', name: 'Dojo', cost: 2000, lvl: 19, act: { grow: 'DIS' }, meter: 'wk', goals: [2, 4, 6, 8, 10], ask: (n) => 'Finish ' + n + ' weeklies', rw: [['def', 2]] },
    apothecary: { icon: '⚗️', name: 'Apothecary', cost: 2600, lvl: 22, act: { heal: 10 }, meter: 'flasks', goals: [2, 4, 6, 9, 12], ask: (n) => 'Drink ' + n + ' flasks on the way to clearing dungeons', rw: [['flask', 1], ['heal', 6], ['heal', 6], ['heal', 6], ['flask', 1]] },
    market: { icon: '⚖️', name: 'Market', cost: 3300, lvl: 25, act: { sell: 10 }, meter: 'sold', goals: [5, 10, 15, 20, 25], ask: (n) => 'Sell ' + n + ' pieces of gear', rw: [['clearGold', 6]] },
    tavern: { icon: '🍺', name: 'Tavern', cost: 4100, lvl: 28, act: { comp: 10 }, meter: 'party', goals: [1, 2, 3, 4, 5], ask: (n) => 'Clear ' + n + ' dungeon' + (n > 1 ? 's' : '') + ' with a companion', rw: [['comp', 4]] },
    bank: { icon: '🏦', name: 'Counting house', cost: 5000, lvl: 32, act: { deedGold: 10 }, meter: 'earned', goals: [500, 1000, 2000, 3500, 5000], ask: (n) => 'Earn ' + n + ' gold (spending it is fine)', rw: [['deedGold', 5]] },
    tower: { icon: '🗼', name: 'Watch house', cost: 6000, lvl: 36, act: { sense: 2 }, meter: 'kills', goals: [4, 8, 12, 16, 20], ask: (n) => 'Strike down ' + n + ' foes on the way to clearing dungeons', rw: [['hide', 3]] },
    chapel: { icon: '⛪', name: 'Chapel', cost: 7200, lvl: 40, act: { askGold: 50 }, meter: 'asks', goals: [2, 3, 4, 5, 6], ask: (n) => 'Keep ' + n + ' household requests', rw: [['regen', 2]] },
  };
  const TOWN_ACT = {
    grow: (v) => STAT_INFO[v].name + ' grows 15% faster', heal: (v) => 'Flasks heal ' + v + '% more', sell: (v) => 'Gear sells for ' + v + '% more',
    comp: (v) => 'Companions fight ' + v + '% harder', deedGold: (v) => v + '% more gold from every deed', sense: (v) => '+' + v + ' to spotting snares and secrets',
    askGold: (v) => 'Household requests pay ' + v + '% more',
  };
  const TOWN_RW = {
    dmg: (v) => '+' + v + '% damage', evade: (v) => '+' + v + '% dodge', hp: (v) => '+' + v + '% health', mpRoom: (v) => '+' + v + ' MP back after every room',
    def: (v) => '+' + v + ' defence', flask: (v) => '+' + v + ' flask' + (v > 1 ? 's' : ''), heal: (v) => 'Flasks heal ' + v + '% more', clearGold: (v) => '+' + v + '% gold from every clear',
    comp: (v) => 'Companions fight ' + v + '% harder', deedGold: (v) => '+' + v + '% gold from every deed', hide: (v) => v + '% less damage taken', regen: (v) => 'Heal ' + v + '% of health after every room',
  };
  const TOWN_GROW = 0.15;
  const townReward = (k, i) => { const r = TOWN[k].rw[Math.min(i, TOWN[k].rw.length - 1)]; return TOWN_RW[r[0]](r[1]); };
  function townNorm(s) {
    const T = s.town && typeof s.town === 'object' ? s.town : {};
    const own = {}, tier = {}, base = {}, cnt = {}, ready = {};
    Object.keys(TOWN).forEach((k) => {
      if (T.own && T.own[k]) own[k] = true;
      if (T.ready && T.ready[k] && own[k]) ready[k] = true;
      tier[k] = Math.max(0, Math.min(TOWN_TIERS, (T.tier && T.tier[k]) | 0));
      if (T.base && typeof T.base[k] === 'number' && isFinite(T.base[k])) base[k] = T.base[k];
    });
    ['kills', 'flasks', 'party', 'sold', 'earned', 'wk'].concat(STATS.map((k) => 'd' + k)).forEach((k) => { cnt[k] = Math.max(0, (T.cnt && T.cnt[k]) | 0); });
    let on = (Array.isArray(T.on) ? T.on : []).filter((k, i, a) => own[k] && a.indexOf(k) === i);
    s.town = { open: !!T.open, own: own, on: on, tier: tier, base: base, cnt: cnt, ready: ready, goldSeen: typeof T.goldSeen === 'number' ? T.goldSeen : s.gold | 0 };
    s.town.on = on.slice(0, townSlots(s));
    return s.town;
  }
  // 2.23: a third place opens with four buildings and a fourth with eight (was a third at six), so eleven buildings can be
  // mastered inside a year
  const townSlots = (s) => { const n = Object.keys((s.town && s.town.own) || {}).length; return 2 + (n >= 4 ? 1 : 0) + (n >= 8 ? 1 : 0); };
  // What it takes for the road to town to open.
  function townGate(s) {
    const res = (s.npcs || []).filter((n) => n.status === 'resident').length;
    const ups = Object.keys(s.estate.tiers).reduce((a, k) => a + (s.estate.tiers[k] | 0), 0) + Object.keys(s.estate.wings).length;
    const list = [{ text: 'Reach level 8', ok: s.level >= 8 }, { text: 'Three under your roof, or twelve upgrades to the estate', ok: res >= 3 || ups >= 12, note: res + ' at home · ' + ups + ' upgrades' }];
    return { open: !!(s.town && s.town.open) || list.every((x) => x.ok), list: list };
  }
  function townMeter(s, m) {
    const c = s.town.cnt;
    if (m === 'level') return s.level;
    if (m === 'asks') return (s.asks && s.asks.kept) | 0;
    if (STATS.indexOf(m) >= 0) return statVal(s.stats[m]);
    return c[m] | 0;
  }
  // Where a building stands: its tier, the challenge it has set, and how far along that is.
  function townState(s, k) {
    const d = TOWN[k], T = s.town, tier = T.tier[k] | 0, on = T.on.indexOf(k) >= 0, own = !!T.own[k], max = tier >= TOWN_TIERS, ready = !!(T.ready && T.ready[k]);
    const goal = max ? 0 : d.goals[tier], rw = max ? null : d.rw[Math.min(tier, d.rw.length - 1)];
    const prog = ready ? goal : on && !max && T.base[k] != null ? Math.max(0, Math.min(goal, townMeter(s, d.meter) - T.base[k])) : 0;
    let why = null;
    if (!own) { if (s.level < d.lvl) why = 'Reach level ' + d.lvl; else if (s.gold < d.cost) why = 'Need ' + (d.cost - s.gold) + ' more gold'; }
    const ak = Object.keys(d.act)[0];
    return { k: k, own: own, on: on, tier: tier, max: max, goal: goal, prog: prog, ready: ready, pay: max ? 0 : townPayCost(k, tier), ask: max ? null : d.ask(goal), reward: rw ? TOWN_RW[rw[0]](rw[1]) : null, active: TOWN_ACT[ak](d.act[ak]), ok: !own && !why, why: why,
      earned: d.rw.length === 1 ? (tier ? [TOWN_RW[d.rw[0][0]](Math.round(d.rw[0][1] * tier * 10) / 10)] : []) : townSum(d.rw.slice(0, tier)) };
  }
  const townPayCost = (k, tier) => Math.round(TOWN[k].cost * TOWN_PAY[Math.min(tier, TOWN_PAY.length - 1)] / 10) * 10;
  // 2.23: a met challenge waits for the builders to be paid; then the reward is his and the next challenge is set
  function townPay(s, k) {
    const T = s.town, d = TOWN[k]; if (!T || !d || !T.ready || !T.ready[k]) return { err: 'Nothing to pay for yet' };
    const tier = T.tier[k] | 0, cost = townPayCost(k, tier);
    if (s.gold < cost) return { err: 'Need ' + (cost - s.gold) + ' more gold' };
    s.gold -= cost; T.goldSeen = s.gold;
    const rw = d.rw[Math.min(tier, d.rw.length - 1)];
    T.tier[k] = tier + 1; delete T.ready[k];
    if (T.base[k] != null) T.base[k] += d.goals[tier];
    return { k: k, tier: tier + 1, cost: cost, reward: TOWN_RW[rw[0]](rw[1]), max: tier + 1 >= TOWN_TIERS };
  }
  function townSum(list) {
    const t = {}; list.forEach((r) => { t[r[0]] = (t[r[0]] || 0) + r[1]; });
    return Object.keys(t).map((k) => TOWN_RW[k](Math.round(t[k] * 10) / 10));
  }
  function townBuy(s, k) {
    const st = townState(s, k);
    if (!townGate(s).open || st.own || !st.ok) return null;
    s.gold -= TOWN[k].cost; s.town.own[k] = true; s.town.goldSeen = s.gold;
    if (s.town.on.length < townSlots(s)) townToggle(s, k);
    return st;
  }
  // Open or close a building. Closing one mid-challenge throws that challenge's count away.
  function townToggle(s, k) {
    const T = s.town, i = T.on.indexOf(k);
    if (!T.own[k]) return { err: 'Not yours yet' };
    if (i >= 0) { const lost = townState(s, k).prog; T.on.splice(i, 1); delete T.base[k]; return { on: false, lost: lost }; }
    if (T.on.length >= townSlots(s)) return { err: 'Only ' + townSlots(s) + ' can be open at once. Close one first' };
    T.on.push(k); T.base[k] = townMeter(s, TOWN[k].meter);
    return { on: true };
  }
  // Everything that's his for good, plus what the open buildings lend. { dmg, hp, evade, ... } in the units above.
  function townPerks(s) {
    const p = { dmg: 0, evade: 0, hp: 0, mpRoom: 0, def: 0, flask: 0, heal: 0, clearGold: 0, comp: 0, deedGold: 0, hide: 0, regen: 0, sense: 0, sell: 0, askGold: 0, grow: {} };
    const T = s.town; if (!T) return p;
    Object.keys(TOWN).forEach((k) => {
      const d = TOWN[k], tier = T.tier[k] | 0;
      for (let i = 0; i < tier; i++) { const r = d.rw[Math.min(i, d.rw.length - 1)]; p[r[0]] += r[1]; }
      if (T.on.indexOf(k) >= 0) { const ak = Object.keys(d.act)[0]; if (ak === 'grow') p.grow[d.act.grow] = TOWN_GROW; else p[ak] += d.act[ak]; }
    });
    return p;
  }
  // Called whenever the save changes: opens the town when it's earned, counts gold that's come in, and settles any
  // challenge that's been met. Returns what was won: [{ k, tier, reward }].
  function townTick(s) {
    const T = s.town || townNorm(s), out = [];
    if (!T.open && townGate(s).open) { T.open = true; out.push({ opened: true }); }
    if (s.gold > T.goldSeen) T.cnt.earned += Math.round(s.gold - T.goldSeen);
    T.goldSeen = s.gold;
    T.on.forEach((k) => {
      const d = TOWN[k];
      for (let guard = 0; guard < TOWN_TIERS; guard++) {
        const tier = T.tier[k] | 0; if (tier >= TOWN_TIERS || T.ready[k]) break;
        const now = townMeter(s, d.meter); if (T.base[k] == null) T.base[k] = now;
        if (now - T.base[k] < d.goals[tier]) break;
        const rw = d.rw[Math.min(tier, d.rw.length - 1)];
        T.ready[k] = true;   // 2.23: his once the builders are paid (townPay)
        out.push({ k: k, tier: tier + 1, ready: true, pay: townPayCost(k, tier), reward: TOWN_RW[rw[0]](rw[1]), max: tier + 1 >= TOWN_TIERS });
        break;
      }
    });
    return out;
  }
  // Counts kept for the challenges (foes, flasks, sales). Harmless before the town opens.
  function townNote(s, k, n) { if (s.town && s.town.cnt && s.town.cnt[k] != null) s.town.cnt[k] = Math.max(0, s.town.cnt[k] + (n == null ? 1 : n)); }

  // The list Claude needs: what each deed is called.
  function deedNames(s) { return s.quests.filter((q) => !q.archived && !(q.type === 'todo' && q.doneOn)).map((q) => q.name); }

  root.G = {
    STATS, STAT_INFO, TRAINING, DIFF, TYPES, SLOTS, SLOT_NAME, RARITY, CHESTS,
    need, statVal, statNextAt, statPrevAt,
    today, addDays, dayIdx, daysBetween,
    dueOn, canComplete, restLeft, complete, undo, habitCount, shownStreak, findQ,
    title, lifetimeXp,
    EST_STAT, TIER_LEVEL, TIER_STAT, estateReq, FINISHES, FIN_ORDER, FIN_GRADE, finishCost, finishState, finishList, buyFinish, setFinish, finishesOn,
    MINOR, minorOf, minorText, fxInfo, rollItem, legWeight, GEAR_TUNE, GEAR_FX, fxOf, power, sellValue, itemValue, itemById, equipped, gearBonus, gearScore,
    newQuest, normQuest, normalize, fresh, nextId,
    HOME, HOME_AUTO, RENO_STAGES, homeState, syncTally, syncAll, featureLast,
    LOOKS, randomLook, randomName, normLook,
    DECOR, DECOR_SLOTS, MILESTONES, fits, placedAt, placeDecor, autoPlace, checkUnlocks,
    REMIND_MAX, remindState, remindList, overdueWeek, slipOffers, remindDecline, overdueList, remindCount, overdueLine, remindSuggest, remindSet, remindSnooze, settleNative, relicBonus, AFFLICT, penalties, seasonOf, lawnDays, statTotal, itemLore, weekStart, goalMatches, syncGoals, unsyncGoal, goalState, makeTrials, allGoals, WANTS, npcWants, asksTick, asksSync, traderTick, traderHere, traderBuy, sellFor, TRADER_SELL, seasonKey, seasonName, seasonState, seasonClaim, seasonReward, seasonEnd, weatherOn, rosterDigest, dayKind, excused, hm, DIRE_WORD, longKeep, LONG_KEEP, isAway, isHeld, awaySet, awayEnd, awayList, heldDays, trainQuiet, trainGap, hideSuggest, judgeRules, judgeGoalRules, libraryMatch, QHIST_MAX, marksNorm, markBest, markHit, markParse, markFmt, markLog, weeklySlots, weeklyNext, weeklyTopUp, weeklyCost, weeklyReroll, WEEKLY_BASE, WEEKLY_MAX,
    oracleSummary, ORACLE_SYSTEM, parseOracle,
    ALIASES, heraldClaim, heraldDismiss, deedNames, houseLevels, heroGear, widgetSig, widgetOmens, questLast, heroMind,
    ESTATE, ESTATE_AREAS, TIER_WORDS, estateTier, estateNext, buyEstate, estateFor3D,
    WT, HT, PLOT, LOT, GATE, LANDS, landOf, landNext, buyLand, landRect, roomLimit, ROOM_STYLES, FURN, FURN_RAW, FOOT, setEst, FURN_CATS, furnOf, furnOwned, houseLive, houseStored, houseGeom, footOf, whyNot,
    houseDefault, houseNorm, houseView, relicOut, houseMove, houseFlip, houseStore, housePut, houseAuto, furnBuy, roomWhy, roomAdd, roomDel, roomSet, roomResize, roomMove, roomPrice, roomDims, ROOM_PURPOSES, ROOM_MAX, ROOM_LIMIT, SELL_BACK, houseSettle, doorsTidy, doorCells, doorToggle, houseWing,
    WIND_MAX, SPAR_COST, windOf, sparState, sparStart, roadsPay, roadStars, roadMask, starGold, ROAD_STARS,
    BONUS, bonusTick, bonusWeekly,
    lifeTag, lifeNorm, lifeOn, isPayday, nextPayday, questWeekCap, weekliesFit, LIFE_WHY,
    RESTAT, restatOf, restatSave,
    isOut, weatherRead, planSize, PLAN_SIZE, planFor, planSwap, planState, planClaim, PLAN_SWAPS,
    END_LEVEL, END_DUNGEON, contentState, contentCheck, newGamePlus, TOWN, TOWN_TIERS, townNorm, townSlots, townGate, townState, townBuy, townPay, townPayCost, TOWN_PAY, townToggle, townPerks, townTick, townNote, townReward,
    BIRDS, GARB, HATS, NPC_ROLES, NPC_ELS, npcGear, npcNorm, CALLINGS, CALLING_ORDER, CALLING_TUNE, adherence, callingsNorm, callingState, callingsCheck, npcInvite, npcVowKept, WANDERERS, wanderersCheck, wandererNext,
  };
})(typeof window !== 'undefined' ? window : globalThis);
