// Where does delve power come from? Plays the game forward at an effort level (as backtest.js does), then at the end
// takes the hero as he stands and asks how deep he gets with every combination of his five sources switched on or off:
// stats (with level), gear, buffs, companion, relics. The Shapley value of each is its share.
//   TZ=Australia/Perth node tools/sim/shares.js [runs] [--weeks 6,13,26]
'use strict';
const L = require('./lib.js');
const { G, addDays } = L;
const args = process.argv.slice(2);
const RUNS = Number(args.find((a) => /^\d+$/.test(a)) || 12);
const WEEKS = (args.includes('--weeks') ? args[args.indexOf('--weeks') + 1] : '6,13,26').split(',').map(Number);
if (process.env.CFG) require('./tune.js').apply(JSON.parse(process.env.CFG));
const roster = JSON.parse(L.fs.readFileSync(__dirname + '/data/roster.json'));
const R = L.rosterDays(roster);
const rdays = Object.keys(R).sort(), FIRST = rdays[0], LAST = rdays[rdays.length - 1];
const START = '2026-11-02';
const SRC = ['stats', 'gear', 'buffs', 'comp', 'relics'];

function variant(s, inp, on) {
  const v = Object.assign({}, inp, { attempt: 0, known: {} });
  const rel = {}; G.STATS.forEach((k) => { rel[k] = G.relicBonus ? G.relicBonus(s, k) : 0; });
  v.base = {}; G.STATS.forEach((k) => { v.base[k] = Math.max(1, (on.stats ? G.statVal(s.stats[k]) : 10) + (on.relics ? rel[k] : 0) - ((inp.pen && inp.pen[k]) || 0)); });
  v.level = on.stats ? inp.level : 1;
  v.eq = on.gear ? inp.eq : {};
  v.buffs = on.buffs ? inp.buffs : [];
  v.comp = on.comp ? inp.comp : null;
  return v;
}
// How deep this hero gets: dungeons cleared in order from the first, plus how far into the one that stops him.
function depth(s, v) {
  let n = 1;
  for (; n < 80; n++) {
    const out = G.simRun(Object.assign({}, v, { n: n }), {}, false);
    if (out.res !== 'clear') return n - 1 + Math.min(0.95, out.reached / (out.of || 1) * 0.9 + (out.bossHp ? 0.1 * (1 - (out.bossLeft || 0) / out.bossHp) : 0));
  }
  return n;
}
function shapley(f) {
  const n = SRC.length, val = {}, fact = [1, 1, 2, 6, 24, 120], cache = {};
  const F = (mask) => (cache[mask] != null ? cache[mask] : (cache[mask] = f(mask)));
  SRC.forEach((k, i) => {
    let sum = 0;
    for (let m = 0; m < (1 << n); m++) {
      if (m & (1 << i)) continue;
      let c = 0; for (let j = 0; j < n; j++) if (m & (1 << j)) c++;
      sum += fact[c] * fact[n - c - 1] / fact[n] * (F(m | (1 << i)) - F(m));
    }
    val[k] = sum;
  });
  return { val: val, full: F((1 << n) - 1), none: F(0) };
}
function sharesOf(s, T) {
  // the best showing he could make tonight: each companion in turn, as a keen player would
  let best = null;
  [''].concat((s.npcs || []).filter((n) => n.status === 'resident').map((n) => n.id)).forEach((id) => {
    s.delve.comp = id; s.eq = G.bestLoadout(s, s.delve.n);
    const inp = G.inputFor(s, { t: T });
    const sh = shapley((mask) => { const on = {}; SRC.forEach((k, i) => { on[k] = !!(mask & (1 << i)); }); return depth(s, variant(s, inp, on)); });
    if (!best || sh.full > best.full) best = sh;
  });
  return best;
}
module.exports = { sharesOf, SRC };
if (require.main === module) {
  const rows = [];
  ['ordinary', 'strong'].forEach((eff) => {
    WEEKS.forEach((wk) => {
      const END = addDays(START, wk * 7 - 1), acc = { full: 0, none: 0 }, pct = {}; SRC.forEach((k) => { acc[k] = 0; pct[k] = 0; });
      let lvl = 0, st = 0;
      for (let i = 0; i < RUNS; i++) {
        const seed = 1000 + i, r = L.rng(seed * 7919 + 13), deeds = [];
        for (let w0 = START, w = 1; w0 <= END; w0 = addDays(w0, 7), w++) deeds.push(...L.planWeek(w0, eff, R, FIRST, LAST, r, w).filter((d) => d.day <= END));
        const run = L.play({ start: START, end: END, seed: seed * 2654435761, deeds: deeds });
        const sh = sharesOf(run.s, L.at(END, '21:15'));
        const tot = SRC.reduce((a, k) => a + Math.max(0, sh.val[k]), 0) || 1;
        SRC.forEach((k) => { acc[k] += sh.val[k]; pct[k] += Math.max(0, sh.val[k]) / tot; });
        acc.full += sh.full; acc.none += sh.none; lvl += run.s.level; st += G.STATS.reduce((a, k) => a + G.statVal(run.s.stats[k]), 0) / 5;
      }
      const row = { effort: eff, weeks: wk, level: +(lvl / RUNS).toFixed(1), stat: +(st / RUNS).toFixed(1), depth: +(acc.full / RUNS).toFixed(1), bare: +(acc.none / RUNS).toFixed(1) };
      SRC.forEach((k) => { row[k] = Math.round(100 * pct[k] / RUNS) + '%'; });
      rows.push(row); console.log(JSON.stringify(row));
    });
  });
}
