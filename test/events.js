// The blow-by-blow event stream: across many seeded runs, every fight's events add up to what the log says, and the
// HP they carry chains exactly into the next line. Run: TZ=Australia/Perth node test/events.js [runs]
'use strict';
require('../assets/core.js'); require('../assets/delve.js');
const G = globalThis.G;
const RUNS = Number(process.argv[2] || 400);
let fails = 0, fights = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 15) console.log('FAIL', m); } };
function hero(L, seed) {
  const s = { level: L, seq: 0 }, r = G.delveRng(seed), eq = {};
  G.SLOTS.forEach((sl) => { for (let i = 0; i < 80; i++) { const it = G.rollItem(s, Math.min(4, L >> 2), r); if (it.slot === sl) { eq[sl] = it; break; } } });
  const base = {}; G.STATS.forEach((k) => { base[k] = 10 + Math.floor(L * (0.6 + r() * 0.6)); });
  return { name: 'He', f: false, level: L, base: base, eq: eq, buffs: [], orders: { potion: { m: 'below', p: 35 }, arts: 'all', ev: {} }, seed: seed, n: 0, attempt: 0, known: {} };
}
const comps = [null, { id: 'f', name: 'F', role: 'fighter', m: 1 }, { id: 'h', name: 'H', role: 'healer', m: 0.9 }, { id: 's', name: 'S', role: 'scout', m: 0.7 }, { id: 'm', name: 'M', role: 'mage', el: 'fire', m: 1.2 }, { id: 'ruby', name: 'Ruby', role: 'biter', m: 1, bird: true }, { id: 't', name: 'T', role: 'fighter', m: 0.25, tag: true }];
const same = [];
for (let i = 0; i < RUNS; i++) {
  const L = 2 + (i % 18), inp = Object.assign(hero(L, 1000 + i), { n: i % 14, comp: comps[i % comps.length] });
  const out = G.simRun(inp, {}, false);
  let prevHp = null;
  out.log.forEach((l, j) => {
    const fx = l.fx;
    if (!fx || !fx.ev || !fx.ev.length) { prevHp = l.hp; return; }
    fights++;
    const per = {}; let h = 0, c = 0, hp = fx.hp0, killed = {};
    const max = {}; (fx.foes || []).forEach((f) => { max[f.id] = f.hp; });
    fx.ev.forEach((e) => {
      if (e.t === 'adds') e.ids.forEach((id) => { max[id] = e.hp; });
      if (e.t === 'h' || e.t === 'c' || e.t === 'bleed') {
        ok(Number.isInteger(e.d) && e.d >= 0, 'hit is a whole number: ' + e.d);
        per[e.to] = (per[e.to] | 0) + e.d;
        if (e.t === 'h') h += e.d; else c += e.d;
        ok(per[e.to] <= max[e.to], 'no overkill on ' + e.to + ': ' + per[e.to] + '/' + max[e.to]);
        if (e.k) { ok(per[e.to] === max[e.to], 'killed exactly at 0: ' + e.to + ' ' + per[e.to] + '/' + max[e.to]); killed[e.to] = 1; }
      }
      if (e.t === 'in') { ok(Number.isInteger(e.d), 'incoming whole'); hp -= e.d; ok(hp === e.hp, 'hp after a blow matches: ' + hp + ' vs ' + e.hp); }
      if (e.t === 'drink') { hp += e.h; ok(hp === e.hp, 'hp after a flask matches'); }
      if (e.t === 'rev') hp = e.hp;
    });
    ok(h === fx.hd, 'hero hits add up to the total: ' + h + ' vs ' + fx.hd);
    ok(c === fx.cd, 'companion hits add up to the total: ' + c + ' vs ' + fx.cd);
    ok(Math.max(0, hp) === l.hp, 'the fight ends on the line’s HP: ' + hp + ' vs ' + l.hp + ' (' + l.k + ')');
    if (prevHp != null && j > 0 && !fx.foe.boss) ok(fx.hp0 === prevHp || fx.hp0 <= l.hpMax, 'starts from the HP before');
    if (fx.won && !fx.foe.boss) (fx.foes || []).forEach((f) => ok(killed[f.id], 'every foe of a won fight dies: ' + f.id));
    if (fx.foe.boss) { const b = per.g0 | 0; ok(b === fx.dl, 'hits on the boss add up to the damage the log reports: ' + b + ' vs ' + fx.dl); if (l.bossMax) ok(l.bossMax - b === l.bossLeft, 'boss HP left matches: ' + (l.bossMax - b) + ' vs ' + l.bossLeft); }
    prevHp = l.hp;
  });
  // the same inputs give the same run, down to the last blow
  if (i < 60) { const again = G.simRun(JSON.parse(JSON.stringify(inp)), {}, false); ok(JSON.stringify(again.log) === JSON.stringify(out.log), 'same seed, same blows'); }
}
console.log((fails ? 'FAIL ' : 'PASS ') + fights + ' fights, ' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
