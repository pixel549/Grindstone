// One line per config: power shares at 13 weeks (ordinary, strong) and pacing over 12 weeks. node tools/sim/rebal.js '<cfg json>' [runs]
'use strict';
const T = require('./tune.js'), L = require('./lib.js'), S = require('./shares.js');
const { G, addDays } = L;
const cfg = JSON.parse(process.argv[2] || '{}'), RUNS = +(process.argv[3] || 8), WK = +(process.env.WK || 13);
const roster = JSON.parse(L.fs.readFileSync(__dirname + '/data/roster.json')), R = L.rosterDays(roster), rd = Object.keys(R).sort();
T.apply(cfg);
const out = { cfg: cfg };
['ordinary', 'strong'].forEach((eff) => {
  const END = addDays(T.START, WK * 7 - 1), pct = {}; S.SRC.forEach((k) => { pct[k] = 0; }); let depth = 0;
  for (let i = 0; i < RUNS; i++) {
    const seed = 1000 + i, r = L.rng(seed * 7919 + 13), deeds = [];
    for (let w0 = T.START, w = 1; w0 <= END; w0 = addDays(w0, 7), w++) deeds.push(...L.planWeek(w0, eff, R, rd[0], rd[rd.length - 1], r, w).filter((d) => d.day <= END));
    const run = L.play({ start: T.START, end: END, seed: seed * 2654435761, deeds: deeds });
    const sh = S.sharesOf(run.s, L.at(END, '21:15')), tot = S.SRC.reduce((a, k) => a + Math.max(0, sh.val[k]), 0) || 1;
    S.SRC.forEach((k) => { pct[k] += Math.max(0, sh.val[k]) / tot; }); depth += run.s.delve.n;
  }
  out[eff] = S.SRC.map((k) => k + ' ' + Math.round(100 * pct[k] / RUNS)).join(', ') + ' | depth ' + (depth / RUNS).toFixed(1);
});
if (!process.env.NOPACE) { const e = T.evaluate(cfg, RUNS, ['ordinary', 'strong', 'lapsed']); out.pace = ['ordinary', 'strong', 'lapsed'].map((k) => k + ' ' + e[k].steady + '/wk zero' + e[k].zeroWeeks + '% d' + e[k].depth.med).join(' | '); out.weekly = e.ordinary.weekly.join(' '); }
console.log(JSON.stringify(out));
