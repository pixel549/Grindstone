// Grindstone balance harness: drives the real game code (core.js + delve.js) day by day from a deed timeline,
// the way the phone would, and records what happens. Run under TZ=Australia/Perth.
'use strict';
const path = require('path');
const fs = require('fs');
const A = path.join(__dirname, '..', '..', 'assets');
require(path.join(A, 'core.js'));
require(path.join(A, 'delve.js'));
const G = globalThis.G;

// ---------- dates ----------
const pad = (n) => String(n).padStart(2, '0');
const ds = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const at = (day, hm) => { const [y, m, d] = day.split('-').map(Number); const [h, mi] = hm.split(':').map(Number); return new Date(y, m - 1, d, h, mi).getTime(); };
const addDays = (day, n) => { const [y, m, d] = day.split('-').map(Number); return ds(new Date(y, m - 1, d + n)); };
const dow = (day) => { const [y, m, d] = day.split('-').map(Number); return (new Date(y, m - 1, d).getDay() + 6) % 7; }; // Mon 0
const mins = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

// ---------- the roster: what each day leaves free ----------
// roster.json: [{sum, start:'YYYY-MM-DD HH:MM' | 'YYYY-MM-DD', end}] in Perth time (from the Findmyshift feed).
function rosterDays(roster) {
  const by = {};
  roster.forEach((e) => {
    const day = e.start.slice(0, 10);
    (by[day] = by[day] || []).push(e);
  });
  const out = {};
  Object.keys(by).forEach((day) => {
    const evs = by[day];
    if (evs.some((e) => e.sum === 'RDO')) { out[day] = { type: 'rdo', blocks: [], on: false, cap: 2, hours: 0 }; return; }
    const blocks = evs.filter((e) => e.start.length > 10).map((e) => ({ s: mins(e.start.slice(11)), e: e.end.slice(0, 10) > day ? 24 * 60 : mins(e.end.slice(11)), on: /O\/N/.test(e.sum) }));
    const on = blocks.some((b) => b.on);
    // free windows between 07:00 and 21:30, with 30 min travel either side of a shift (15 min each way, plus changing)
    let free = [[7 * 60, 21 * 60 + 30]];
    blocks.forEach((b) => {
      const s0 = b.s - 30, e0 = b.e + 30, nf = [];
      free.forEach(([a, z]) => { if (e0 <= a || s0 >= z) nf.push([a, z]); else { if (s0 > a) nf.push([a, s0]); if (e0 < z) nf.push([e0, z]); } });
      free = nf;
    });
    const big = free.filter(([a, z]) => z - a >= 90).length, huge = free.some(([a, z]) => z - a >= 300);
    const hours = blocks.reduce((t, b) => t + (b.e - b.s), 0) / 60;
    const type = on ? 'overnight' : blocks.length >= 2 ? 'split' : hours >= 7 ? 'long' : blocks.length && blocks[0].s >= 14 * 60 ? 'pm' : 'short';
    out[day] = { type: type, blocks: blocks, on: on, hours: Math.round(hours * 10) / 10, free: free, cap: Math.min(2, huge ? 2 : big ? 1 : 0) };
  });
  // the morning after an overnight starts at the college: no morning session
  Object.keys(out).forEach((day) => { const prev = out[addDays(day, -1)]; if (prev && prev.on && out[day].cap > 1) out[day].cap = 1; });
  return out;
}
// A roster beyond the feed: the observed days, tiled (labelled as projected wherever it's used).
function rosterFor(R, day, first, last) {
  if (R[day]) return R[day];
  const span = Math.round((Date.parse(last) - Date.parse(first)) / 864e5) + 1;
  let k = Math.round((Date.parse(day) - Date.parse(first)) / 864e5) % span;
  if (k < 0) k += span;
  return Object.assign({ projected: true }, R[addDays(first, k)] || { type: 'free', cap: 2, hours: 0 });
}
// How heavy a Monday week is: rostered hours plus a penalty for each split or overnight day.
function weekLoad(R, w0, first, last) {
  let h = 0, hard = 0, cap = 0;
  for (let i = 0; i < 7; i++) { const r = rosterFor(R, addDays(w0, i), first, last); h += r.hours || 0; if (r.type === 'split' || r.type === 'overnight') hard++; cap += r.cap; }
  return { hours: Math.round(h), hard: hard, cap: cap };
}

// ---------- effort levels: what he means to do in a week ----------
// Sessions (STR, END, INT) need a free window; looking after himself (meals, water) and the birds fit any day.
const EFFORT = {
  strong: { STR: 3, END: 3, INT: 4, vitDays: 7, meals: 3, water: 6, stretch: 3, veg: 5, shop: 1, birds: 7, dishes: 7, wash: 2, emails: 5, lawnEvery: 2, aviary: 1 },
  ordinary: { STR: 2, END: 2, INT: 2, vitDays: 6, meals: 2, water: 4, stretch: 1, veg: 3, shop: 1, birds: 7, dishes: 5, wash: 1, emails: 3, lawnEvery: 3, aviary: 0.5 },
  lapsed: { STR: 0, END: 1, INT: 0, vitDays: 3, meals: 1, water: 1, stretch: 0, veg: 1, shop: 0.5, birds: 7, dishes: 3, wash: 1, emails: 1, lawnEvery: 6, aviary: 0 },
  // the pace of the one real week on record (2–8 Nov): food logged daily, one run, one strength session, no study logged
  asLogged: { STR: 1, END: 1, INT: 0, vitDays: 7, meals: 3, water: 0, stretch: 0, veg: 0, shop: 0, birds: 7, dishes: 4, wash: 1, emails: 0, lawnEvery: 4, aviary: 0 },
};
const Q = {
  STR: ['Strength training'], END: ['Run', 'Swim'], INT: ['Study', 'Read'],
  meals: 'Log my meals', water: 'Drink enough water', stretch: 'Stretch', veg: 'Cook a proper meal', shop: 'Grocery shop',
  birds: 'Feed the birds', dishes: 'Do the dishes', wash: 'Do a load of washing', emails: 'Clear the inbox', lawn: 'Mow the lawn', aviary: 'Clean the aviary',
};
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// Pick n days of the week, spread out (alternate days first), weighted toward days with room.
function pickDays(n, days, r, weight) {
  const pool = days.map((d, i) => ({ d: d, i: i, w: weight(d, i) * (0.75 + r() * 0.5) })).filter((x) => x.w > 0);
  const out = [];
  while (out.length < n && pool.length) {
    pool.forEach((x) => { x.v = x.w * (out.some((o) => Math.abs(o.i - x.i) <= 1) ? 0.35 : 1); });
    pool.sort((a, b) => b.v - a.v);
    out.push(pool.shift());
  }
  return out.map((x) => x.d);
}
// One week of deeds for an effort level on the real roster: [{day, time, q}]
function planWeek(w0, effort, R, first, last, r, weekNo) {
  // 2.22 'keen': Jake's own volume, about 140 deeds a week (a strong, an ordinary and a lapsed week laid over each other)
  if (effort === 'keen') return planWeek(w0, 'strong', R, first, last, r, weekNo).concat(planWeek(w0, 'ordinary', R, first, last, r, weekNo), planWeek(w0, 'lapsed', R, first, last, r, weekNo));
  const E = EFFORT[effort], days = [], cap = {}, out = [];
  for (let i = 0; i < 7; i++) { const d = addDays(w0, i); days.push(d); cap[d] = rosterFor(R, d, first, last).cap; }
  const freeTime = (d, k) => {
    const ro = rosterFor(R, d, first, last), fr = (ro.free || [[7 * 60, 21 * 60 + 30]]).filter(([a, z]) => z - a >= 90);
    const w = fr[Math.min(k, fr.length - 1)] || [17 * 60, 21 * 60];
    const m = w[0] + 20 + Math.floor(r() * Math.max(1, w[1] - w[0] - 80));
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  };
  const used = {};
  ['STR', 'END', 'INT'].forEach((st) => {
    // INT (study, reading) fits a short gap too; training needs a proper window
    const want = E[st];
    const chosen = pickDays(want, days, r, (d) => (st === 'INT' ? 1 + cap[d] : Math.max(0, cap[d] - (used[d] | 0))));
    chosen.forEach((d, i) => { used[d] = (used[d] | 0) + (st === 'INT' ? 0 : 1); out.push({ day: d, time: freeTime(d, (used[d] || 1) - 1), q: Q[st][(weekNo + i) % Q[st].length] }); });
  });
  const vit = pickDays(E.vitDays, days, r, () => 1);
  vit.forEach((d) => {
    for (let k = 0; k < E.meals; k++) out.push({ day: d, time: ['08:10', '12:40', '18:30'][k], q: Q.meals });
  });
  const some = (n, key, t) => pickDays(Math.floor(n) + (r() < n % 1 ? 1 : 0), days, r, () => 1).forEach((d) => out.push({ day: d, time: t, q: Q[key] }));
  some(E.water, 'water', '20:30'); some(E.stretch, 'stretch', '21:00'); some(E.veg, 'veg', '19:00'); some(E.shop, 'shop', '11:30');
  some(E.birds, 'birds', '07:30'); some(E.dishes, 'dishes', '20:00'); some(E.wash, 'wash', '10:00'); some(E.emails, 'emails', '13:00');
  if (E.lawnEvery && weekNo % E.lawnEvery === 0) some(1, 'lawn', '10:30');
  some(E.aviary, 'aviary', '11:00');
  return out;
}

// ---------- the game, played forward ----------
function newSave(startDay, seed) {
  const s = G.normalize(null, startDay);
  G.normDelve(s);
  s.created = startDay;
  s.welcomed = true;
  s.delve.seed = seed >>> 0;
  s.hero.name = 'Jake';
  return s;
}
// Gear: open the chests, buy a coffer when there's gold to spare, wear the best on paper for the next dungeon.
// POLICY.gold: share of gold he puts into coffers (the rest goes on rewards, the house, the people).
const POLICY = { gold: 0.5, smart: true, cap: 400 };
function kitOut(s, r) {
  while (s.chests > 0) { s.chests -= 1; s.inv.push(G.rollItem(s, 0, r)); }
  const gilded = G.CHESTS.find((c) => c.k === 'gilded'), iron = G.CHESTS.find((c) => c.k === 'iron');
  // gold that's come in since last time: his share for gear goes in a purse; the rest is spent elsewhere
  const inc = Math.max(0, s.gold - (s._seenGold | 0));
  s._purse = (s._purse | 0) + inc * POLICY.gold;
  if (POLICY.drain !== false) s.gold -= inc * (1 - POLICY.gold);   // the old tuner: the rest goes on things it doesn't model (year.js spends it)
  while (s._purse >= gilded.cost) { s._purse -= gilded.cost; s.gold -= gilded.cost; s.inv.push(G.rollItem(s, gilded.floor, r)); }
  s._seenGold = s.gold;
  s.eq = G.bestLoadout(s, s.delve.n);
}
// Every way he could go down: alone or with anyone in the house who'll come.
function partyOptions(s) {
  return [''].concat((s.npcs || []).filter((n) => n.status === 'resident').map((n) => n.id));
}
// Run the delve the way a keen player would: try each companion, take the best showing, and push on while it clears.
// 2.22: the player who knows the dungeon. The fights are deterministic and a dungeon is the same until its boss falls, so a
// patient player who retries (Jake: ten to twenty-five tries a day) learns every choice in it: which way at each fork, which
// chests to open, when to kneel, how to drink. This walks the tree of choices (the same ones the app asks when he watches)
// with three flask habits and keeps the best line. POLICY.smart off = the old player, who took the defaults.
function smartRun(inp) {
  // greedy with rollouts: at each choice, try every option, play the rest out on defaults, keep the best; then the next choice.
  // A full search of the tree (every line) was 100x the cost and found the same clears in spot checks on his save.
  const sc = (o) => (o.res === 'clear' ? 1000 + (o.hpLeft || 0) / 1e4 : 0) + o.reached * 10 - (o.bossLeft || 0) / (o.bossHp || 1e9);
  let top = null;
  for (const pol of [{ m: 'below', p: 35 }, { m: 'below', p: 50 }, { m: 'boss' }]) {
    const a = { potion: pol };
    let last = null;
    for (let guard = 0; guard < 40; guard++) {
      const o = G.simRun(inp, a, true);
      if (!o.pause || o.pause.kind === 'potion') { last = o.pause ? G.simRun(inp, a, false) : o; break; }
      let bo = null, bs = -1e9;
      o.pause.options.forEach((op) => { const t = G.simRun(inp, Object.assign({}, a, { [o.pause.id]: op.v }), false), v = sc(t); if (v > bs) { bs = v; bo = op.v; last = v >= bs ? t : last; } });
      a[o.pause.id] = bo;
    }
    if (last && (!top || sc(last) > sc(top))) top = last;
    if (top && top.res === 'clear') break;
  }
  return top;
}
function delveNow(s, T, r, rec) {
  const day = G.today(new Date(T));
  let cleared = 0;
  let retries = 0, lastEq = '';
  for (let guard = 0; guard < 9; guard++) {
    if (G.delveOpens && G.delveOpens(s, day)) break;   // 2.22: one new dungeon a day
    kitOut(s, r);
    let best = null;
    partyOptions(s).forEach((id) => {
      s.delve.comp = id;
      const inp = G.inputFor(s, { t: T });
      const out = POLICY.smart ? smartRun(inp) : G.simRun(inp, {}, false);
      const score = (out.res === 'clear' ? 1000 : 0) + out.reached * 10 - (out.bossLeft || 0) / 1000;
      if (!best || score > best.score) best = { id: id, inp: inp, out: out, score: score };
    });
    s.delve.comp = best.id;
    G.applyRun(s, best.out, { t: T, day: day, buffs: best.inp.buffs, sig: G.runSig(best.inp) });
    if (rec) rec.push({ day: day, n: best.out.dungeon ? s.delve.n - (best.out.res === 'clear' ? 1 : 0) : s.delve.n, res: best.out.res, at: best.out.reached, of: best.out.of, comp: best.inp.comp ? best.inp.comp.name + '@' + best.inp.comp.m : null, buffs: best.inp.buffs.length });
    // 2.20.4: boons, as a keen player takes them (the first of the three offered; they're mostly utility)
    for (let g = 0; g < 4 && G.perksDue && G.perksDue(s) > 0; g++) { const o = G.perkOffer(s); if (!o.length || !G.perkPick(s, o[0])) break; }
    // 2.20.5: like the real player, go again after a fall if it changed something (a stashed piece now worn), up to three times a day
    if (best.out.res !== 'clear') { kitOut(s, r); const eqNow = JSON.stringify(s.eq); if (retries < 3 && eqNow !== lastEq && (best.out.stashed || []).length) { retries++; lastEq = eqNow; continue; } break; }
    cleared++;
  }
  return cleared;
}
// Play a list of deeds through the game from startDay to endDay. Returns a day-by-day record.
function play(opts) {
  const s = newSave(opts.start, opts.seed);
  const r = rng(opts.seed ^ 0x9e3779b9);
  const deeds = opts.deeds.slice().sort((a, b) => (a.day + a.time < b.day + b.time ? -1 : 1));
  const byDay = {};
  deeds.forEach((d) => { (byDay[d.day] = byDay[d.day] || []).push(d); });
  const days = [], runs = [];
  for (let day = opts.start; day <= opts.end; day = addDays(day, 1)) {
    (byDay[day] || []).forEach((d) => {
      const q = s.quests.find((x) => x.name === d.q);
      if (!q) throw new Error('no quest ' + d.q);
      G.complete(s, q.id, day, at(day, d.time));
    });
    const T = at(day, '21:15');
    const arrived = G.callingsCheck(s, new Date(T)).map((n) => n.comp);
    const before = s.delve.n;
    const cleared = opts.delve === false ? 0 : delveNow(s, T, r, runs);
    const cs = {};
    G.CALLING_ORDER.forEach((k) => {
      const st = G.callingState(s, k, new Date(T));
      cs[k] = { here: st.here, streak: st.streak, thisWeek: st.thisWeek, long: st.longUntil > T, shorts: st.shorts.length, m: st.m, toward: st.toward };
    });
    days.push({ day: day, level: s.level, n: s.delve.n, cleared: cleared, before: before, arrived: arrived, cs: cs, buffs: G.activeBuffs(s, T).length });
  }
  return { s: s, days: days, runs: runs };
}

// ---------- reading the real records ----------
// The Fitness Tracker (Drive): Food rows (date, meal), Sessions (date, type), Cardio (date, activity).
function trackerDeeds(tr) {
  const out = [];
  const iso = (d) => { const m = /^(\d{1,2}) (\w{3}) (\d{4})$/.exec(d || ''); if (!m) return null; const mo = 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(m[2]) / 3 + 1; return m[3] + '-' + pad(mo) + '-' + pad(+m[1]); };
  const meals = {};
  tr.food.forEach(([d, meal]) => { const day = iso(d); if (!day || !/Breakfast|Lunch|Dinner/.test(meal)) return; (meals[day] = meals[day] || new Set()).add(meal); });
  Object.keys(meals).forEach((day) => [...meals[day]].slice(0, 3).forEach((m, i) => out.push({ day: day, time: ['08:10', '12:40', '18:30'][i], q: Q.meals, real: true })));
  tr.sessions.forEach(([d, type]) => { const day = iso(d); if (!day) return; if (/Strength/i.test(type)) out.push({ day: day, time: '07:00', q: Q.STR[0], real: true }); });
  const cardioDays = new Set(tr.cardio.map(([d]) => iso(d)).filter(Boolean));
  cardioDays.forEach((day) => out.push({ day: day, time: '09:30', q: Q.END[0], real: true }));
  return out;
}

module.exports = { POLICY, smartRun, partyOptions, G, ds, at, addDays, dow, rosterDays, rosterFor, weekLoad, EFFORT, Q, rng, planWeek, newSave, kitOut, delveNow, play, trackerDeeds, fs, path };
