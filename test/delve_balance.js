// Balance table for the delve: which dungeons each kind of hero clears, with and without buffs.
global.window = {};
require('../assets/core.js');
require('../assets/delve.js');
const G = window.G;

const PRIM = { weapon: 'STR', head: 'VIT', body: 'END', charm: 'DIS' }, SEC = { weapon: 'END', head: 'STR', body: 'VIT', charm: 'INT' };
const item = (slot, art, tier, scale, extra) => { const b = {}; b[PRIM[slot]] = G.RARITY[tier].m * scale; if (tier >= 2) b[SEC[slot]] = Math.ceil(b[PRIM[slot]] / 2); return Object.assign({ slot: slot, art: art, name: slot, tier: tier, bonus: b }, extra || {}); };
if (process.env.TA) { G.delveTune.a = +process.env.TA; G.delveTune.b = +process.env.TB; }
const heroes = {
  fresh: { level: 2, xp: 0, eq: { weapon: item('weapon', 'blade', 0, 1) } },
  week1: { level: 5, xp: 150, eq: { weapon: item('weapon', 'blade', 0, 2), head: item('head', 'helm', 1, 2), body: item('body', 'coat', 0, 2) } },
  month1: { level: 12, xp: 600, eq: { weapon: item('weapon', 'blade', 2, 3), head: item('head', 'helm', 2, 3), body: item('body', 'armour', 2, 3), charm: item('charm', 'pendant', 1, 3) } },
  month3: { level: 25, xp: 2000, eq: { weapon: item('weapon', 'blade', 3, 6), head: item('head', 'helm', 3, 6), body: item('body', 'armour', 3, 6), charm: item('charm', 'pendant', 3, 6) } },
  year: { level: 45, xp: 6000, eq: { weapon: item('weapon', 'blade', 4, 10), head: item('head', 'helm', 4, 10), body: item('body', 'armour', 4, 10), charm: item('charm', 'pendant', 4, 10) } },
};
const B = (type, di) => ({ type: type, amt: G.BUFFS[type].amt[di] });
const packs = {
  none: [],
  light: [B('edge', 2), B('fed', 1)],
  heavy: [B('edge', 3), B('fed', 3), B('sure', 2), B('ready', 2), B('STR', 3), B('VIT', 2)],
};
function run(h, buffs, n, seed) {
  const base = {}; G.STATS.forEach((k) => { base[k] = G.statVal(h.xp); });
  const inp = { name: 'Jake', level: h.level, base: base, eq: h.eq, buffs: buffs, orders: { potion: { m: 'below', p: 35 }, arts: 'all', ev: {} }, seed: seed, n: n, attempt: 0 };
  return G.simRun(inp, {}, false);
}
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const NMAX = +(process.env.NMAX || 16), STEP = +(process.env.STEP || 1);
const rows = [];
Object.keys(heroes).forEach((hk) => Object.keys(packs).forEach((pk) => {
  let line = (hk + '/' + pk).padEnd(14);
  for (let n = 0; n < NMAX * STEP; n += STEP) {
    let wins = 0, pctSum = 0;
    seeds.forEach((sd) => { const o = run(heroes[hk], packs[pk], n, sd); if (o.res === 'clear') wins++; else pctSum += o.bossHp ? o.bossLeft / o.bossHp : 1.5; });
    line += (wins === seeds.length ? '  ✓ ' : wins ? ' ' + wins + '/8' : '  · ').padStart(5);
  }
  rows.push(line);
}));
console.log('dungeon        ' + Array.from({ length: NMAX }, (_, i) => String(i).padStart(5)).join(''));
console.log(rows.join('\n'));
// one sample log
const o = run(heroes.week1, packs.light, 1, 3);
console.log('\n' + o.dungeon.name + ' — ' + o.res + (o.short ? ' — ' + o.short : ''));
o.log.forEach((l) => console.log('  [' + String(l.hp).padStart(3) + ' HP] ' + l.s));
// determinism
const a = JSON.stringify(run(heroes.month1, packs.heavy, 5, 9).log), b = JSON.stringify(run(heroes.month1, packs.heavy, 5, 9).log);
console.log('\ndeterministic:', a === b);
// does the right tool matter?
const m1 = heroes.month1;
const withW = (art, el) => Object.assign({}, m1, { eq: Object.assign({}, m1.eq, { weapon: Object.assign({}, m1.eq.weapon, { art: art, el: el }) }) });
const tally = (h, n) => { let w = 0, left = 0; seeds.forEach((sd) => { const o = run(h, packs.light, n, sd); if (o.res === 'clear') w++; else left += o.bossHp ? o.bossLeft / o.bossHp : 1; }); return w + '/8'; };
[[8, 'frost (weak fire)'], [9, 'fen (weak fire)'], [12, 'spire (weak rot)'], [7, 'crypt (weak holy)']].forEach((x) => {
  const n = x[0], D = G.dungeonFor(1, n);
  console.log(('d' + n + ' ' + x[1]).padEnd(22), 'blade', tally(withW('blade'), n), '| blade+' + D.weak, tally(withW('blade', D.weak), n), '| axe', tally(withW('axe'), n), '| blunt', tally(withW('blunt'), n), '| polearm', tally(withW('polearm'), n), '| staff', tally(withW('staff'), n), '| blade+' + D.el, tally(withW('blade', D.el), n));
});
