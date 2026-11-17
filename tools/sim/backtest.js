// Backtest: the one real week on record (2–8 Nov, Fitness Tracker), then forward on the real roster (Findmyshift,
// to 17 Dec) at each effort level, through the real game code. Monte Carlo over dungeon seeds and deed placement.
//   TZ=Australia/Perth node tools/sim/backtest.js [runs] [--json out.json] [--end YYYY-MM-DD]
'use strict';
const L = require('./lib.js');
const { G, addDays } = L;
const args = process.argv.slice(2);
const RUNS = Number(args.find((a) => /^\d+$/.test(a)) || 120);
const outJson = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const END = args.includes('--end') ? args[args.indexOf('--end') + 1] : '2026-12-13';
// CFG='<json>': play it with other numbers (as tune.js takes them), e.g. 2.4's for a before/after
if (process.env.CFG) require('./tune.js').apply(JSON.parse(process.env.CFG));
const roster = JSON.parse(L.fs.readFileSync(__dirname + '/data/roster.json'));
const R = L.rosterDays(roster);
const rdays = Object.keys(R).sort(), FIRST = rdays[0], LAST = rdays[rdays.length - 1];
const real = L.trackerDeeds(JSON.parse(L.fs.readFileSync(__dirname + '/data/tracker.json')));
const START = '2026-11-02', PROJ = '2026-11-09';

const SCEN = {
  asLogged: (w) => 'asLogged', ordinary: () => 'ordinary', strong: () => 'strong', lapsed: () => 'lapsed',
  // ordinary, with one bad week in the middle: does he climb back out?
  slip: (w) => (w === 3 ? 'lapsed' : 'ordinary'),
};
function deedsFor(scen, seed) {
  const r = L.rng(seed * 7919 + 13), out = real.slice();
  for (let w0 = PROJ, wk = 1; w0 <= END; w0 = addDays(w0, 7), wk++) out.push(...L.planWeek(w0, SCEN[scen](wk), R, FIRST, LAST, r, wk).filter((d) => d.day <= END));
  return out;
}
const weeks = [];
for (let w0 = START; w0 <= END; w0 = addDays(w0, 7)) weeks.push(w0);
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) * p)] : null; };

const result = { runs: RUNS, start: START, end: END, rosterTo: LAST, tune: Object.assign({}, G.CALLING_TUNE), callings: JSON.parse(JSON.stringify(G.CALLINGS)), scen: {} };
const t0 = Date.now();
Object.keys(SCEN).forEach((sc) => {
  const perWeek = weeks.map(() => ({ cleared: [], depth: [], m: [] }));
  const arrive = { healer: [], scout: [], fighter: [], mage: [] }, longDays = { healer: [], scout: [], fighter: [], mage: [] };
  let stallMax = [], example = null;
  for (let i = 0; i < RUNS; i++) {
    const seed = 1000 + i;
    const run = L.play({ start: START, end: END, seed: seed * 2654435761, deeds: deedsFor(sc, seed) });
    const ld = { healer: 0, scout: 0, fighter: 0, mage: 0 };
    let stall = 0, worst = 0;
    run.days.forEach((d) => {
      const wi = weeks.findIndex((w, j) => d.day >= w && (j === weeks.length - 1 || d.day < weeks[j + 1]));
      const W = perWeek[wi];
      W.cleared[i] = (W.cleared[i] | 0) + d.cleared;
      W.depth[i] = d.n;
      d.arrived.forEach((k) => arrive[k].push(wi + 1));
      Object.keys(d.cs).forEach((k) => { if (d.cs[k].long) ld[k]++; });
      stall = d.cleared ? 0 : stall + 1; worst = Math.max(worst, stall);
    });
    Object.keys(ld).forEach((k) => longDays[k].push(ld[k]));
    G.CALLING_ORDER.forEach((k) => { if (!run.days.some((d) => d.arrived.indexOf(k) >= 0)) arrive[k].push(null); });
    stallMax.push(worst);
    if (i === 0) example = run.days.map((d) => ({ day: d.day, n: d.n, cleared: d.cleared, arrived: d.arrived, here: Object.keys(d.cs).filter((k) => d.cs[k].here), long: Object.keys(d.cs).filter((k) => d.cs[k].long), level: d.level, buffs: d.buffs }));
  }
  const S = {
    weeks: weeks.map((w, j) => ({ w: w, real: w < PROJ, load: L.weekLoad(R, w, FIRST, LAST), cleared: { med: med(perWeek[j].cleared.map((x) => x | 0)), p10: q(perWeek[j].cleared.map((x) => x | 0), 0.1), p90: q(perWeek[j].cleared.map((x) => x | 0), 0.9), mean: perWeek[j].cleared.reduce((a, x) => a + (x | 0), 0) / RUNS }, depth: med(perWeek[j].depth) })),
    arrive: {}, longDays: {}, stallMax: { med: med(stallMax), p90: q(stallMax, 0.9) }, example: example,
  };
  G.CALLING_ORDER.forEach((k) => {
    const got = arrive[k].filter((x) => x != null);
    S.arrive[k] = { pct: Math.round((100 * got.length) / RUNS), medWeek: med(got) };
    S.longDays[k] = med(longDays[k]);
  });
  result.scen[sc] = S;
  process.stderr.write(sc + ' done ' + ((Date.now() - t0) / 1000).toFixed(0) + 's\n');
});
if (outJson) L.fs.writeFileSync(outJson, JSON.stringify(result, null, 1));
// a readable summary
Object.keys(result.scen).forEach((sc) => {
  const S = result.scen[sc];
  console.log('\n== ' + sc + '  (median of ' + RUNS + ' runs)');
  console.log('week        roster(h/hard/cap)  cleared(med p10-p90 mean)  depth');
  S.weeks.forEach((w) => console.log(w.w + (w.real ? '*' : ' ') + '  ' + String(w.load.hours).padStart(3) + 'h ' + w.load.hard + ' ' + String(w.load.cap).padStart(2) + '        ' + w.cleared.med + ' ' + w.cleared.p10 + '-' + w.cleared.p90 + ' ' + w.cleared.mean.toFixed(2) + '            ' + w.depth));
  console.log('arrivals: ' + G.CALLING_ORDER.map((k) => k + ' ' + S.arrive[k].pct + '% (wk ' + S.arrive[k].medWeek + ')').join(', '));
  console.log('long-buff days: ' + G.CALLING_ORDER.map((k) => k + ' ' + S.longDays[k]).join(', ') + '   longest stall: ' + S.stallMax.med + 'd (p90 ' + S.stallMax.p90 + ')');
});
