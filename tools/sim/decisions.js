// Decision audit: every choice the delve asks, made both (all) ways, everything else held fixed, across 1,000+
// heroes at the dungeon they're actually fighting for (the frontier). A choice where one answer is at least as good
// nearly always isn't a choice.
//   TZ=Australia/Perth node tools/sim/decisions.js [heroes] [--json out.json]
'use strict';
const path = require('path');
require(path.join(__dirname, '..', '..', 'assets', 'core.js'));
require(path.join(__dirname, '..', '..', 'assets', 'delve.js'));
const G = globalThis.G;
const args = process.argv.slice(2);
const HEROES = Number(args.find((a) => /^\d+$/.test(a)) || 700);
const outJson = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

const BUFFPOOL = [['edge', 3], ['edge', 1], ['sure', 3], ['fed', 1], ['fed', 2], ['ready', 1], ['keen', 1], ['ward', 2], ['STR', 2], ['VIT', 1]];
const COMPS = [null, null, { id: 'f', name: 'F', role: 'fighter', m: 0.8 }, { id: 'h', name: 'H', role: 'healer', m: 0.8 }, { id: 's', name: 'S', role: 'scout', m: 0.7 }, { id: 'm', name: 'M', role: 'mage', el: 'fire', m: 0.9 }, { id: 'ruby', name: 'Ruby', role: 'biter', m: 1, bird: true }, { id: 'kermit', name: 'Kermit', role: 'lookout', m: 1, bird: true }, { id: 't', name: 'T', role: 'fighter', m: 0.25, tag: true }];
function hero(i) {
  const r = G.delveRng(90001 + i * 7), L = 2 + Math.floor(r() * 16), st = { level: L, seq: 0 }, eq = {};
  G.SLOTS.forEach((sl) => { if (r() < 0.12) return; for (let k = 0; k < 80; k++) { const it = G.rollItem(st, Math.min(4, Math.floor(L / 5)), r); if (it.slot === sl) { eq[sl] = it; break; } } });
  const base = {}; G.STATS.forEach((k) => { base[k] = 10 + Math.floor(L * (0.4 + r() * 0.6)); });
  const buffs = BUFFPOOL.filter(() => r() < 0.45).map(([type, di]) => ({ type: type, amt: G.BUFFS[type].amt[di] }));
  return { name: 'He', f: false, level: L, base: base, eq: eq, buffs: buffs, orders: { potion: null, arts: 'all', ev: {} }, seed: (12345 + i * 101) >>> 0, n: 0, attempt: 0, known: {}, comp: COMPS[Math.floor(r() * COMPS.length)] };
}
// How far a run got: stages, plus how much of the boss came off, plus a clear.
const prog = (o) => (o.res === 'clear' ? 100 : 0) + o.reached + (o.bossHp ? 1 - (o.bossLeft || 0) / o.bossHp : 0);
const run = (inp, ans) => G.simRun(inp, ans || {}, false);
function frontier(inp) {
  let f = -1;
  for (let n = 0; n < 40; n++) { const o = run(Object.assign({}, inp, { n: n })); if (o.res !== 'clear') break; f = n; }
  return f;
}
// The choices, and their answers. (Potion orders and weapon arts are standing orders; the rest are asked on the spot.)
const DECISIONS = {
  potion: { opts: [['below 35%', { potion: { m: 'below', p: 35 } }], ['below 50%', { potion: { m: 'below', p: 50 } }], ['save for boss', { potion: { m: 'boss' } }]], has: () => true },
  arts: { opts: [['always', null, 'all'], ['boss only', null, 'boss'], ['never', null, 'none']], has: () => true },
  chest: { opts: [['put it on', { c0: 'equip' }], ['stash it', { c0: 'stash' }]], has: (D) => D.events.some((e) => e.id === 'c0') },
  fountain: { opts: [['drink', { f0: 'drink' }], ['leave it', { f0: 'skip' }]], has: (D) => D.events.some((e) => e.kind === 'fountain') },
  fork: { opts: [['left (fight, gold)', { k0: 'a' }], ['right (trap)', { k0: 'b' }]], has: (D) => D.events.some((e) => e.kind === 'fork') },
};
const res = {};
Object.keys(DECISIONS).forEach((k) => { res[k] = { cases: 0, opts: DECISIONS[k].opts.map((o) => ({ label: o[0], clear: 0, prog: 0, best: 0, worst: 0, gold: 0 })), dom: null, byCtx: {} }; });
let cases = 0;
for (let i = 0; i < HEROES; i++) {
  const h = hero(i), F = frontier(h);
  // the dungeon he's stuck on, and the one he only just clears
  [F + 1, Math.max(0, F)].forEach((n, ci) => {
    const inp = Object.assign({}, h, { n: n }), D = G.dungeonFor(inp.seed, n);
    cases++;
    Object.keys(DECISIONS).forEach((k) => {
      const Dk = DECISIONS[k];
      if (!Dk.has(D)) return;
      // the chest only matters when the find is better than what he has on
      if (k === 'chest') { const it = D.events.find((e) => e.id === 'c0').loot, cur = inp.eq.weapon; if (cur && G.power(it) <= G.power(cur)) return; }
      const outs = Dk.opts.map((o) => {
        const x = o[2] ? Object.assign({}, inp, { orders: Object.assign({}, inp.orders, { arts: o[2] }) }) : inp;
        let out = run(x, o[1] ? JSON.parse(JSON.stringify(o[1])) : {});
        // the chest is a two-attempt choice: a stashed find comes home after a fall and can be worn next time
        if (k === 'chest' && out.res !== 'clear') {
          const kept = (out.stashed || [])[0];
          const eq2 = Object.assign({}, x.eq); if (kept) eq2[kept.slot] = kept;
          const out2 = run(Object.assign({}, x, { eq: eq2, attempt: 1 }), o[1] ? JSON.parse(JSON.stringify(o[1])) : {});
          return { p: prog(out2) - 0.5, c: out2.res === 'clear', g: out2.gold };
        }
        return { p: prog(out), c: out.res === 'clear', g: out.gold };
      });
      const R = res[k];
      R.cases++;
      const ctx = ci === 0 ? 'stuck' : 'clearing';
      R.byCtx[ctx] = R.byCtx[ctx] || { cases: 0, clear: Dk.opts.map(() => 0) };
      R.byCtx[ctx].cases++;
      const bestP = Math.max.apply(null, outs.map((o) => o.p)), worstP = Math.min.apply(null, outs.map((o) => o.p));
      outs.forEach((o, j) => { const S = R.opts[j]; S.clear += o.c ? 1 : 0; S.prog += o.p >= 100 ? o.p - 100 : o.p; S.gold += o.g; if (o.p === bestP) S.best++; if (o.p === worstP && bestP !== worstP) S.worst++; R.byCtx[ctx].clear[j] += o.c ? 1 : 0; });
      R.same = (R.same | 0) + (bestP === worstP ? 1 : 0);
    });
  });
}
// dominance: an answer that's at least as good in ≥ 95% of the cases where the choice mattered
Object.keys(res).forEach((k) => {
  const R = res[k], mattered = R.cases - (R.same | 0);
  R.mattered = mattered;
  R.opts.forEach((o) => { o.clearPct = Math.round((1000 * o.clear) / Math.max(1, R.cases)) / 10; o.bestPct = Math.round((1000 * o.best) / Math.max(1, R.cases)) / 10; o.worstPct = Math.round((1000 * o.worst) / Math.max(1, mattered)) / 10; });
  const dom = R.opts.find((o) => mattered > 0 && o.worst / mattered <= 0.05 && o.best >= R.cases * 0.95);
  R.dom = dom ? dom.label : null;
});
const out = { heroes: HEROES, cases: cases, tune: Object.assign({}, G.delveTune), res: res };
if (outJson) require('fs').writeFileSync(outJson, JSON.stringify(out, null, 1));
console.log('heroes', HEROES, 'cases', cases);
Object.keys(res).forEach((k) => {
  const R = res[k];
  console.log('\n' + k + ': ' + R.cases + ' cases, mattered in ' + R.mattered + (R.dom ? '   DOMINANT: ' + R.dom : ''));
  R.opts.forEach((o) => console.log('  ' + o.label.padEnd(20) + ' clears ' + String(o.clearPct).padStart(5) + '%   best-or-tied ' + String(o.bestPct).padStart(5) + '%   worst when it mattered ' + String(o.worstPct).padStart(5) + '%'));
  Object.keys(R.byCtx).forEach((c) => console.log('    ' + c + ' (' + R.byCtx[c].cases + '): clears ' + R.byCtx[c].clear.map((x) => Math.round((100 * x) / R.byCtx[c].cases) + '%').join(' / ')));
});
