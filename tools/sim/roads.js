// 2.21: old roads balance. Plays the pacing sim forward, snapshots the hero at weeks 2/4/8/12, and fights a middle road and
// the newest road with three bots: naive (strike, guard heavy blows, drink when low), casual (+ arts, the weakest foe first)
// and smart (picks the weapon for each fight, staggers wind-ups, uses the off hand). DT='{json}' overrides G.DUEL_TUNE.
process.env.TZ = 'Australia/Perth';
const L = require('./lib.js'), { G, addDays } = L;
require('../../assets/duel.js');
if (process.env.DT) Object.assign(G.DUEL_TUNE, JSON.parse(process.env.DT));
const roster = JSON.parse(L.fs.readFileSync(__dirname + '/data/roster.json'));
const R = L.rosterDays(roster), rd = Object.keys(R).sort(), FIRST = rd[0], LAST = rd[rd.length - 1];
const HEAVY = { big: 1, ram: 1, dive: 1 };
function naive(st) { const L0 = st.grp.filter((e) => e.hp > 0), M = Object.fromEntries(G.duelMoves(st).map((m) => [m.k, m]));
  if (L0.some((e) => HEAVY[e.it.k] || (e.it2 && HEAVY[e.it2.k]))) return ['guard'];
  if (st.hp < st.H.hpMax * 0.35 && M.flask.ok) return ['flask'];
  return ['strike']; }
function casual(st) { const L0 = st.grp.filter((e) => e.hp > 0), M = Object.fromEntries(G.duelMoves(st).map((m) => [m.k, m]));
  if (L0.some((e) => HEAVY[e.it.k] || (e.it2 && HEAVY[e.it2.k]))) return ['guard'];
  if (st.hp < st.H.hpMax * 0.35 && M.flask.ok) return ['flask'];
  const t = L0.slice().sort((a, b) => a.hp - b.hp)[0];
  if (M.art.ok) return ['art', t.id];
  if (M.off.ok && rnd0() < 0.5) return ['off', t.id];
  return ['strike', t.id]; }
let _r = 7; const rnd0 = () => ((_r = (_r * 16807) % 2147483647) / 2147483647);
function smart(st) {
  const L0 = st.grp.filter((e) => e.hp > 0), M = Object.fromEntries(G.duelMoves(st).map((m) => [m.k, m])), H = st.H, hp = st.hp / H.hpMax;
  const off = st.eq.off && st.eq.off.art, kind = G.KINDS[H.kind] ? H.kind : 'fists', artStag = kind === 'blunt' || kind === 'polearm' || kind === 'fists', reach = kind === 'polearm' || kind === 'staff';
  const heavyFoe = L0.find((e) => HEAVY[e.it.k] || (e.it2 && HEAVY[e.it2.k])), windFoe = L0.find((e) => e.it.k === 'wind' || e.it.k === 'charge');
  // a swap at the boss: resist its element, or a weapon of its weakness
  const f = st.enc[st.i];
  // a good player picks the weapon for the fight: kind against these tags, element against this place
  if (st.round === 0 && M.gear.ok && !st._picked) { st._picked = st.i;
    const val = (w) => { const E = Object.assign({}, st.eq, { weapon: w }), h = G.heroFrom(st.inp, E), k = G.KINDS[h.kind] || G.KINDS.fists; let m = 1; if (h.el && h.el === st.weak) m *= 1.6; else if (h.el && h.el === f.el) m *= 0.5; if (k.good.some((g) => f.tags.indexOf(g) >= 0)) m *= h.kind === 'blunt' ? 1.5 : 1.3; if (k.bad.some((g) => f.tags.indexOf(g) >= 0)) m *= 0.75; if (f.count > 1 && (h.kind === 'axe' || h.kind === 'staff')) m *= 1.2; return h.atk * m; };
    const cur = val(st.eq.weapon), best = G.duelGear(st).filter((it) => it.slot === 'weapon').map((it) => [it, val(it)]).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > cur * 1.15) return ['gear', null, best[0].id]; }
  if (st._picked !== st.i) st._picked = st.i;
  if (f.boss && st.round <= 1 && M.gear.ok && !st._armed) { st._armed = 1; const g = G.duelGear(st).find((it) => (it.res && it.res === f.el && !(st.eq[it.slot] && st.eq[it.slot].res === f.el)) || (it.slot === 'weapon' && it.el === st.weak && !(st.eq.weapon && st.eq.weapon.el === st.weak) && G.power(it) >= G.power(st.eq.weapon || { bonus: {} }) * 0.7 && false)); if (g) return ['gear', null, g.id]; }
  if (heavyFoe) { if (M.off.ok && off === 'shield') return ['off', heavyFoe.id]; if (M.art.ok && artStag) return ['art', heavyFoe.id]; return ['guard']; }
  if (hp < 0.35 && M.flask.ok) return ['flask'];
  if (hp < 0.55 && M.off.ok && off === 'book') return ['off'];
  if (windFoe && windFoe.hp > windFoe.max * 0.3) { if (M.off.ok && off === 'shield') return ['off', windFoe.id]; if (M.art.ok && artStag) return ['art', windFoe.id]; }
  if (M.off.ok && off === 'lamp' && L0.filter((e) => e.it.k === 'flurry' || e.it.k === 'hit').length >= 2) return ['off'];
  if (M.off.ok && off === 'blade' && L0.some((e) => e.it.k === 'hit' || e.it.k === 'flurry' || e.it.k === 'venom')) return ['off'];
  // pick a target: a mender first, then the weakest that isn't braced or out of reach
  const ok = (e) => e.it.k !== 'brace' && (reach || e.it.k !== 'fly');
  const t = L0.find((e) => e.it.k === 'mend' && ok(e)) || L0.filter(ok).sort((a, b) => a.hp - b.hp)[0];
  if (M.art.ok && (((kind === 'axe' || kind === 'staff') && L0.length >= 2) || (t && kind !== 'axe' && kind !== 'staff'))) return ['art', t ? t.id : null];
  if (!t) return [hp < 0.8 && M.flask.ok && st.mp < 4 ? 'flask' : 'guard'];
  if (st.mp < (G.DUEL_ARTS[kind].mp) && hp < 0.6 && M.flask.ok) return ['flask'];
  return ['strike', t.id];
}
function fight(inp, pack, pol, seed) {
  const st = G.duelNew(inp, seed, pack); let g = 0;
  while (!st.res && g++ < 900) { if (st.between) { G.duelNext(st); continue; } const a = pol(st); const r0 = st.rounds; G.duelAct(st, a[0], a[1] || st.tgt, a[2]); if (st.rounds === r0) G.duelAct(st, 'guard'); }
  return st;
}
// realistic heroes: play the pacing sim forward and snapshot
const snaps = {};
const s = L.newSave ? L.newSave('2026-08-03') : null;
const r = L.rng(11);
const start = '2026-08-03';
const at = { 2: 1, 4: 1, 8: 1, 12: 1 };
for (let w = 0; w < 12; w++) {
  const w0 = addDays(start, 7 * w), deeds = L.planWeek(w0, 'ordinary', R, FIRST, LAST, r, w + 1);
  for (let k = 0; k < 7; k++) { const day = addDays(w0, k); deeds.filter((d) => d.day === day).forEach((d) => { const q = s.quests.find((x) => x.name === d.q && !x.archived) || s.quests.find((x) => x.stat === (L.Q[d.q] || {}).stat && !x.archived); if (q) G.complete(s, q.id, day, L.at(day, d.time)); }); L.delveNow(s, L.at(day, '21:15'), r, null); }
  if (at[w + 1]) snaps[w + 1] = JSON.parse(JSON.stringify(s));
}
for (const wk of Object.keys(snaps)) {
  const S0 = snaps[wk], top = S0.delve.n - 1; L.kitOut(S0, r);
  for (const n of [Math.max(0, Math.floor(top / 2)), top]) {
    const inp = G.sparInput(S0, n, { t: 5 }), pack = S0.inv;
    const res = { naive: [], casual: [], smart: [] };
    for (const [nm, pol] of [['naive', naive], ['casual', casual], ['smart', smart]]) for (let sd = 1; sd <= 30; sd++) { const st = fight(inp, pack, pol, sd * 977); res[nm].push(st); }
    const sum = (a) => { const w = a.filter((x) => x.res === 'clear'); return (w.length / a.length * 100).toFixed(0).padStart(3) + '% ' + (w.length ? (w.reduce((t, x) => t + G.duelStars(x).n, 0) / w.length).toFixed(1) : '-') + '★ ' + (a.reduce((t, x) => t + x.rounds, 0) / a.length).toFixed(0) + 'r/' + a[0].par; };
    console.log(('week ' + wk + ' L' + S0.level + ' road ' + (n + 1) + '/' + (top + 1)).padEnd(26), '| naive', sum(res.naive), '| casual', sum(res.casual), '| smart', sum(res.smart));
  }
}
if (process.env.DIAG) {
  for (const [wk, which] of [[4, 'top'], [12, 'top'], [12, 'mid']]) {
    const S0 = snaps[wk], top = S0.delve.n - 1, n = which === 'top' ? top : Math.floor(top / 2);
    const inp = G.sparInput(S0, n, { t: 5 });
    const st = fight(inp, S0.inv, process.env.POL === 'casual' ? casual : smart, 977);
    const H = st.H;
    console.log('\nweek', wk, which, 'road', n + 1, 'res', st.res, 'at fight', st.i + 1, '/', st.enc.length, 'flasks left', st.flasks, 'hpMax', H.hpMax, 'atk', Math.round(H.atk), 'def', Math.round(H.def), 'mp', H.mpMax, 'kind', H.kind, 'off', st.eq.off && st.eq.off.art, 'ease', st.ease);
    console.log(' foes:', st.enc.map((f) => f.name + ' x' + f.count + ' hp' + f.hp + ' atk' + Math.round(f.atk) + ' [' + f.tags.join(',') + ']' + (f.mech ? ' ' + f.mech : '')).join(' | '));
    console.log(' last log:', st.log.slice(-8).map((l) => l.s).join(' / '));
  }
}
