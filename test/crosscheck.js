// Runs random multi-week scenarios through core.js, writes them out for the Java side to replay.
require('../assets/core.js');
const fs = require('fs');
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
const scenarios = [];
for (let seed = 1; seed <= 40; seed++) {
  const r = rng(seed);
  const start = '2026-10-' + String(1 + Math.floor(r() * 20)).padStart(2, '0');
  let s = G.normalize(null, start);
  // add a few extra quest shapes: unlimited habit, weekday daily, epic todo
  s.quests.push(G.newQuest(s, { name: 'Unlimited', icon: 'x', type: 'habit', stat: 'INT', diff: 1, cap: 0 }));
  s.quests.push(G.newQuest(s, { name: 'Weekdays', icon: 'x', type: 'daily', stat: 'STR', diff: 5, days: [1,1,1,1,1,0,0] }));
  s.quests.push(G.newQuest(s, { name: 'Big todo', icon: 'x', type: 'todo', stat: 'END', diff: 5 }));
  if (seed % 5 === 0) s.quests[2].archived = true;
  const initial = JSON.parse(JSON.stringify(s));
  const ops = [], widget = {};
  let d = start, t = 1700000000000;
  for (let day = 0; day < 45; day++) {
    d = G.addDays(d, r() < 0.15 ? 2 + Math.floor(r() * 3) : 1); // occasional gaps break streaks
    widget[d] = widgetIds(s, d);
    const n = Math.floor(r() * 12);
    for (let k = 0; k < n; k++) {
      const q = s.quests[Math.floor(r() * s.quests.length)];
      t += 60000;
      const res = G.complete(s, q.id, d, t);
      ops.push({ d, id: q.id, t, ok: !!res, levels: res ? res.levels : 0 });
    }
  }
  scenarios.push({ seed, initial, ops, widget, final: s });
}
function widgetIds(s, t) {
  const live = s.quests.filter(q => G.canComplete(q, t));
  return live.filter(q => q.type === 'daily' && G.dueOn(q, t)).concat(live.filter(q => q.type === 'todo'), live.filter(q => q.type === 'habit')).map(q => q.id);
}
fs.writeFileSync('scenarios.json', JSON.stringify(scenarios));
console.log('scenarios:', scenarios.length, 'ops:', scenarios.reduce((a, s) => a + s.ops.length, 0),
  'max level:', Math.max(...scenarios.map(s => s.final.level)), 'max streak:', Math.max(...scenarios.map(s => s.final.bestStreak)));
