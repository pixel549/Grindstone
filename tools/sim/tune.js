// Tuning: score a set of game numbers against the design targets, over 12 weeks (the real week, then the real roster,
// tiled past 17 Dec), Monte Carlo over dungeon seeds and deed placement.
//   TZ=Australia/Perth node tools/sim/tune.js eval '<json cfg>' [runs]
//   TZ=Australia/Perth node tools/sim/tune.js grid [runs] [shard/of]
'use strict';
const L = require('./lib.js');
const { G, addDays } = L;
const roster = JSON.parse(L.fs.readFileSync(__dirname + '/data/roster.json'));
const R = L.rosterDays(roster);
const rdays = Object.keys(R).sort(), FIRST = rdays[0], LAST = rdays[rdays.length - 1];
const real = L.trackerDeeds(JSON.parse(L.fs.readFileSync(__dirname + '/data/tracker.json')));
const START = '2026-11-02', WEEKS = 12, END = addDays(START, 7 * WEEKS - 1);

// The design targets: what a week should be worth, in dungeons cleared.
// 2.20.4: early (weeks 2-4) and late (weeks 9-12) too, so a fast first month and a slow third can't average out to "on target"
// 2.22: keen (Jake's volume) should stay under 1.8, and the sim's player now learns each dungeon (lib.js smartRun)
const TARGET = { keen: 1.8, ordinary: 1.0, strong: 1.35, lapsed: 0.15, heavyRatio: 0.75, recover: 0.8, spread: 6, lumpy: 5, early: 1.4, late: 0.75 };

const BASE = JSON.parse(JSON.stringify({ gearPer: G.GEAR_TUNE.per, delve: G.delveTune, tune: G.CALLING_TUNE, callings: G.CALLINGS, buffs: Object.keys(G.BUFFS).reduce((o, k) => { o[k] = G.BUFFS[k].amt.slice(); return o; }, {}) }));
function apply(cfg) {
  Object.assign(G.delveTune, BASE.delve, cfg.delve || {});
  Object.assign(G.CALLING_TUNE, BASE.tune, cfg.tune || {});
  Object.keys(BASE.callings).forEach((k) => { G.CALLINGS[k].days = BASE.callings[k].days; G.CALLINGS[k].weeks = BASE.callings[k].weeks; G.CALLINGS[k].shortH = BASE.callings[k].shortH; Object.assign(G.CALLINGS[k], (cfg.callings || {})[k] || {}); });
  G.GEAR_TUNE.per = cfg.gearPer || BASE.gearPer;
  const bs = cfg.buffScale == null ? 1 : cfg.buffScale;
  Object.keys(BASE.buffs).forEach((k) => { G.BUFFS[k].amt = BASE.buffs[k].map((a) => (a < 1 ? Math.round(a * bs * 1000) / 1000 : Math.max(1, Math.round(a * (bs < 1 ? bs : 1))))); });
  if (cfg.grace != null) G.CALLING_TUNE.grace = cfg.grace;
}
const SCEN = { keen: () => 'keen', ordinary: () => 'ordinary', strong: () => 'strong', lapsed: () => 'lapsed', slip: (w) => (w === 5 ? 'lapsed' : 'ordinary'), asLogged: () => 'asLogged' };
function deedsFor(scen, seed) {
  const r = L.rng(seed * 7919 + 13), out = real.slice();
  for (let w0 = addDays(START, 7), wk = 1; w0 <= END; w0 = addDays(w0, 7), wk++) out.push(...L.planWeek(w0, SCEN[scen](wk), R, FIRST, LAST, r, wk));
  return out;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const quant = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor((b.length - 1) * p)]; };
function evaluate(cfg, runs, scens) {
  apply(cfg);
  scens = scens || ['ordinary', 'strong', 'lapsed', 'slip'];
  const out = {};
  scens.forEach((sc) => {
    const wk = [], depth = [], maxWeek = [], arrive = { healer: [], scout: [], fighter: [], mage: [] }, heavy = [], light = [], longD = { healer: 0, scout: 0, fighter: 0, mage: 0 };
    for (let i = 0; i < runs; i++) {
      const run = L.play({ start: START, end: END, seed: (i + 1) * 2654435761, deeds: deedsFor(sc, i + 101) });
      const per = new Array(WEEKS).fill(0);
      run.days.forEach((d, j) => { per[Math.floor(j / 7)] += d.cleared; d.arrived.forEach((k) => arrive[k].push(Math.floor(j / 7) + 1)); Object.keys(d.cs).forEach((k) => { if (d.cs[k].long) longD[k]++; }); });
      wk.push(per);
      depth.push(run.s.delve.n);
      maxWeek.push(Math.max.apply(null, per.slice(1)));
      for (let w = 1; w < WEEKS; w++) { const ld = L.weekLoad(R, addDays(START, 7 * w), FIRST, LAST); (ld.cap <= 9 ? heavy : light).push(per[w]); }
    }
    const weekly = [];
    for (let w = 0; w < WEEKS; w++) weekly.push(mean(wk.map((p) => p[w])));
    const steady = mean(weekly.slice(1)); // after the real week
    out[sc] = {
      steady: Math.round(steady * 100) / 100, weekly: weekly.map((x) => Math.round(x * 100) / 100),
      zeroWeeks: Math.round(100 * mean(wk.map((p) => p.slice(1).filter((x) => x === 0).length / (WEEKS - 1)))),
      depth: { p10: quant(depth, 0.1), med: quant(depth, 0.5), p90: quant(depth, 0.9) }, lumpy: quant(maxWeek, 0.9),
      heavy: Math.round(mean(heavy) * 100) / 100, light: Math.round(mean(light) * 100) / 100,
      arrive: Object.keys(arrive).reduce((o, k) => { const a = arrive[k]; o[k] = { pct: Math.round((100 * a.length) / runs), med: a.length ? quant(a, 0.5) : null }; return o; }, {}),
      longDays: Object.keys(longD).reduce((o, k) => { o[k] = Math.round(longD[k] / runs); return o; }, {}),
      recover: sc === 'slip' ? Math.round(mean(wk.map((p) => (p[5] + p[6]) / 2)) * 100) / 100 : undefined,
    };
  });
  return out;
}
// One number for "how far off target": squared misses, scaled so each target matters about equally.
function score(m) {
  let e = 0;
  const sq = (x) => x * x;
  e += sq((m.ordinary.steady - TARGET.ordinary) / 0.25);
  e += sq((m.strong.steady - TARGET.strong) / 0.3);
  e += sq(Math.max(0, m.lapsed.steady - TARGET.lapsed) / 0.15);
  e += sq(Math.max(0, TARGET.heavyRatio - m.ordinary.heavy / Math.max(0.01, m.ordinary.light)) / 0.15);
  e += sq(Math.max(0, TARGET.recover - m.slip.recover) / 0.25);
  e += sq(Math.max(0, m.ordinary.depth.p90 - m.ordinary.depth.p10 - TARGET.spread) / 3);
  e += sq(Math.max(0, m.ordinary.lumpy - TARGET.lumpy) / 1);
  e += sq(Math.max(0, m.strong.lumpy - TARGET.lumpy) / 1);
  const W = m.ordinary.weekly || [], early = (W[1] + W[2] + W[3]) / 3, late = (W[8] + W[9] + W[10] + W[11]) / 4;
  e += sq(Math.max(0, early - TARGET.early) / 0.3);
  e += sq(Math.max(0, TARGET.late - late) / 0.2);
  return Math.round(e * 100) / 100;
}
module.exports = { evaluate, score, apply, TARGET, BASE, START, END, WEEKS };

if (require.main === module) {
  const [cmd, a1, a2, a3] = process.argv.slice(2);
  if (cmd === 'eval') {
    const cfg = JSON.parse(a1 || '{}'), runs = Number(a2 || 60);
    const m = evaluate(cfg, runs, ['ordinary', 'strong', 'lapsed', 'slip', 'asLogged']);
    console.log(JSON.stringify({ cfg: cfg, score: score(m), m: m }, null, 1));
  } else if (cmd === 'grid') {
    const runs = Number(a1 || 30), [shard, of] = (a2 || '0/1').split('/').map(Number);
    const grid = [];
    const G2 = process.env.GRID ? JSON.parse(process.env.GRID) : { lootB: [1.5, 1], lootA: [3], b: [0.12, 0.08], a: [0.5], perType: [3, 2], buffScale: [1, 0.7] };
    for (const lootB of G2.lootB) for (const lootA of G2.lootA) for (const db of G2.b) for (const da of G2.a) for (const perType of G2.perType) for (const buffScale of G2.buffScale) for (const mb of (G2.maxBuffs || [8]))
      grid.push({ delve: { a: da, b: db, lootA: lootA, lootB: lootB, perType: perType, maxBuffs: mb, pick: mb < 8 ? 'strong' : 'new' }, buffScale: buffScale });
    const mine = grid.filter((_, i) => i % of === shard);
    mine.forEach((cfg) => { const m = evaluate(cfg, runs); console.log(JSON.stringify({ cfg: cfg, score: score(m), arr: m.strong.arrive, ord: m.ordinary.steady, str: m.strong.steady, lap: m.lapsed.steady, rec: m.slip.recover, heavy: m.ordinary.heavy, light: m.ordinary.light, spread: [m.ordinary.depth.p10, m.ordinary.depth.p90], lumpy: [m.ordinary.lumpy, m.strong.lumpy], zero: m.ordinary.zeroWeeks })); });
  }
}
