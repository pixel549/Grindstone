// 2.23: a year on one hero. The weeks are built from Jake's real deeds (tools/sim/data/jake_week.json: his 8-14 Nov 2026 week,
// 68 different deeds, 147 in all), scaled: lapsed 0.3x, ordinary 0.7x (about 100 a week), keen 1x. The hero is the learning
// player (lib.js smartRun), delving each evening, and he spends like a player who wants everything:
//   - five stars on each old road the week its dungeon falls (five stars pays what the clear did)
//   - sells what he won't wear (keeps the best six spares), puts a fifth of his income into coffers
//   - buys the cheapest thing that's open: an estate tier, land, a town building, the builders for a met challenge
// It reports pace by half-year, level, where the gold came from, and when each kind of content runs out.
//   node tools/sim/year.js [ordinary|keen|lapsed] [runs] ['{"delve":{"a":1.7}, "need":[80,40]}']
process.env.TZ = process.env.TZ || 'Australia/Perth';
const L = require('./lib.js'), { G, addDays } = L;
const J = JSON.parse(L.fs.readFileSync(__dirname + '/data/jake_week.json', 'utf8'));
const MULT = { lapsed: 0.3, ordinary: 0.7, keen: 1.0 };
const START = '2026-11-16', WEEKS = +(process.env.WEEKS || 52);

function makeSave(seed) {
  const s = L.newSave(START, seed);
  s.quests = J.quests.map((q) => Object.assign({}, q, { count: 0, countOn: null, doneOn: null, archived: false }));
  return G.normalize(s, START);
}
function planJake(w0, mult, r) {
  const out = [];
  for (let k = 0; k < 7; k++) {
    const day = addDays(w0, k);
    J.rates.forEach((e) => {
      const per = (e.perWeek / 7) * mult, cap = e.type === 'habit' ? 4 : 1;
      let n = Math.floor(per); if (r() < per - n) n++;
      n = Math.min(cap, n);
      for (let i = 0; i < n; i++) out.push({ day: day, time: e.times.length ? e.times[Math.floor(r() * e.times.length)] : '12:00', id: e.id });
    });
  }
  return out.sort((a, b) => (a.day + a.time < b.day + b.time ? -1 : 1));
}
// Everything there is to finish: the estate to its top tier, all the land, every town building mastered.
function sinksLeft(s) {
  let n = 0;
  Object.keys(G.ESTATE).forEach((k) => { if (!G.estateNext(s, k).max) n++; });
  if (!G.landNext(s).max) n++;
  Object.keys(G.TOWN).forEach((k) => { const st = G.townState(s, k); if (!st.own || !st.max) n++; });
  return n;
}
function spend(s, led) {
  const keep = (s._purse | 0);   // what's set aside for coffers isn't his to spend on the estate
  for (let guard = 0; guard < 60; guard++) {
    const opts = [];
    Object.keys(G.ESTATE).forEach((k) => { const n = G.estateNext(s, k); if (!n.max && n.ok) opts.push([n.cost, () => G.buyEstate(s, k)]); });
    const ln = G.landNext(s); if (!ln.max && ln.ok) opts.push([ln.cost, () => G.buyLand(s)]);
    if (G.townGate(s).open) {
      Object.keys(G.TOWN).forEach((k) => {
        const st = G.townState(s, k);
        if (!st.own && st.ok) opts.push([G.TOWN[k].cost, () => G.townBuy(s, k)]);
        if (st.ready && s.gold >= st.pay) opts.push([st.pay, () => G.townPay(s, k)]);
      });
    }
    if (!opts.length) return;
    opts.sort((a, b) => a[0] - b[0]);
    if (s.gold - keep < opts[0][0]) return;
    const g0 = s.gold; opts[0][1](); led.spent += Math.max(0, g0 - s.gold);
  }
}
// Keep the open buildings working on challenges: close a mastered one, open one that isn't.
function townManage(s) {
  if (!s.town) return;
  const T = s.town;
  T.on.slice().forEach((k) => { const st = G.townState(s, k); if (st.max) G.townToggle(s, k); });
  Object.keys(G.TOWN).forEach((k) => { const st = G.townState(s, k); if (st.own && !st.max && !st.on && T.on.length < G.townSlots(s)) G.townToggle(s, k); });
}
function sellSpares(s, led, day) {
  const worn = new Set(Object.values(s.eq).filter(Boolean));
  const spare = s.inv.filter((it) => !worn.has(it.id)).sort((a, b) => G.power(b) - G.power(a));
  spare.slice(6).forEach((it) => { const g = G.sellFor(s, it, day); s.gold += g; led.sales += g; G.townNote(s, 'sold', 1); s.inv = s.inv.filter((x) => x.id !== it.id); });
}

function year(scen, seed, cfg) {
  const s = makeSave(1000 + seed), r = L.rng(seed * 7919 + 1), rr = L.rng(seed + 77);
  const led = { deeds: 0, clears: 0, roads: 0, sales: 0, spent: 0 };
  const wrap = (fn, k) => function () { const g0 = s.gold, o = fn.apply(this, arguments); led[k] += Math.max(0, s.gold - g0); return o; };
  const complete = wrap(G.complete, 'deeds');
  const rows = [];
  let done = null;
  for (let w = 0; w < WEEKS; w++) {
    const w0 = addDays(START, 7 * w), deeds = planJake(w0, MULT[scen], r);
    let cl = 0;
    for (let k = 0; k < 7; k++) {
      const day = addDays(w0, k), T = L.at(day, '21:15');
      deeds.filter((d) => d.day === day).forEach((d) => complete(s, d.id, day, L.at(day, d.time)));
      G.callingsCheck(s, new Date(T));
      const n0 = s.delve.n, g0 = s.gold;
      L.delveNow(s, T, rr, null);
      led.clears += Math.max(0, s.gold - g0);
      for (let n = n0; n < s.delve.n; n++) { const g = 5 * G.starGold(G.dungeonFor(s.delve.seed, n).gold); s.gold += g; led.roads += g; cl++; }
      sellSpares(s, led, day);
      G.townTick(s); townManage(s); spend(s, led); G.townTick(s); townManage(s);
      if (!done && s.level >= 50 && s.delve.n >= 78 && sinksLeft(s) === 0) done = w + 1;
    }
    // what the sim doesn't play but a player does: the week's weeklies (the dojo counts them) and household requests (the chapel)
    G.townNote(s, 'wk', { lapsed: 1, ordinary: 2, keen: 3 }[scen]);
    s.asks = s.asks || {}; s.asks.kept = (s.asks.kept | 0) + { lapsed: 1, ordinary: 3, keen: 4 }[scen];
    rows.push({ w: w + 1, cl: cl, lvl: s.level, n: s.delve.n, left: sinksLeft(s), gold: s.gold, led: Object.assign({}, led) });
  }
  const why = {}; Object.keys(G.ESTATE).forEach((k) => { const n = G.estateNext(s, k); if (!n.max && n.lock) why[n.lock] = (why[n.lock] || 0) + 1; });
  Object.keys(G.TOWN).forEach((k) => { const st = G.townState(s, k); if (!st.own && st.why) why['town:' + st.why.split(' ')[0]] = (why['town:' + st.why.split(' ')[0]] || 0) + 1; else if (st.own && !st.max) why['town:' + k + ':' + st.tier] = 1; });
  return { rows, done, s, why: JSON.stringify(why) };
}

function main() {
  const scen = process.argv[2] || 'ordinary', runs = +(process.argv[3] || 2), cfg = JSON.parse(process.argv[4] || '{}');
  if (cfg.delve) Object.assign(G.delveTune, cfg.delve);
  L.POLICY.gold = cfg.coffers != null ? cfg.coffers : 0.15; L.POLICY.drain = false;
  const all = [];
  for (let i = 0; i < runs; i++) all.push(year(scen, i + 1, cfg));
  const m = (f) => Math.round((all.reduce((a, x) => a + f(x), 0) / all.length) * 100) / 100;
  const half = (a, b) => m((x) => x.rows.slice(a, b).reduce((t, r) => t + r.cl, 0) / (b - a));
  const atW = (w, k) => m((x) => x.rows[Math.min(w, x.rows.length) - 1][k]);
  const first = (pred) => all.map((x) => { const r = x.rows.find(pred); return r ? r.w : '>' + WEEKS; }).join('/');
  const led = (k) => m((x) => x.rows[x.rows.length - 1].led[k]);
  console.log(scen + ' (' + runs + ' runs) ' + JSON.stringify(cfg));
  console.log('  dungeons a week: weeks 1-13', half(0, 13), '| 14-26', half(13, 26), '| 27-39', half(26, 39), '| 40-52', half(39, 52), '| first half', half(0, 26), '| second half', half(26, 52));
  console.log('  level at weeks 13/26/39/52:', [13, 26, 39, 52].map((w) => atW(w, 'lvl')).join(' / '), '| dungeon:', [13, 26, 39, 52].map((w) => atW(w, 'n')).join(' / '));
  const tot = led('deeds') + led('clears') + led('roads') + led('sales');
  console.log('  gold in a year: deeds', led('deeds'), '| clears', led('clears'), '| roads', led('roads'), '| sales', led('sales'), '| spent on the estate, land and town', led('spent'), '| deeds share', Math.round(100 * led('deeds') / tot) + '%');
  console.log('  pieces not finished at weeks 13/26/39/52:', [13, 26, 39, 52].map((w) => atW(w, 'left')).join(' / '), '(of', sinksLeft(makeSave(1)) + ') | gold in hand at the end', m((x) => x.s.gold), '| level-locked or stat-locked at the end:', all[0].why);
  console.log('  weeks until: level 50', first((r) => r.lvl >= 50), '| dungeon 78 (every boss met)', first((r) => r.n >= 78), '| nothing left to buy', first((r) => r.left === 0), '| everything done', all.map((x) => x.done || '>' + WEEKS).join('/'));
  return all;
}
if (require.main === module) main();
module.exports = { year, planJake, makeSave, sinksLeft };
