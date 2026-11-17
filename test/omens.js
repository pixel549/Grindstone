// Random saves through G.widgetOmens; OmensCheck.java replays them through Omens.java and compares.
global.window = {};
require('../assets/core.js');
const G = window.G, fs = require('fs');
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const out = [];
for (let n = 0; n < 160; n++) {
  const end = G.addDays('2026-11-07', -Math.floor(rnd() * 40));
  const s = G.normalize(null, end);
  s.created = G.addDays(end, -Math.floor(rnd() * 70));
  s.quests.forEach((q) => { if (rnd() < 0.15) q.home = null; if (rnd() < 0.08) q.archived = true; });
  ['lawn', 'birds', 'aviary', 'fridge', 'dishes', 'laundry', 'gym', 'study'].forEach((k) => { if (rnd() < 0.3) s.homeSeed[k] = G.addDays(end, -Math.floor(rnd() * 30)); });
  const span = Math.floor(rnd() * 25), keen = rnd() < 0.5 ? 2.2 + rnd() : rnd();
  let now = Date.parse(G.addDays(end, -span) + 'T08:00:00');
  for (let d = span; d >= 0; d--) {
    const day = G.addDays(end, -d);
    s.quests.forEach((q) => { if (rnd() < keen * 0.35) { G.complete(s, q.id, day, now); now += 60000; } });
    if (rnd() < 0.1) s.log.unshift({ t: now, d: day, r: 1, g: -80, n: 'Fancy coffee', i: '☕' });
    now += 86400000;
  }
  const at = rnd() < 0.3 ? G.addDays(end, Math.floor(rnd() * 12)) : end;
  out.push({ s: s, t: at, out: G.widgetOmens(s, at) });
}
fs.writeFileSync(__dirname + '/omens.json', JSON.stringify(out));
const modes = out.reduce((a, o) => { a[o.out.mode] = (a[o.out.mode] || 0) + 1; return a; }, {});
console.log(out.length + ' saves written', JSON.stringify(modes));
