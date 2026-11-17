// The floor plans: forks come in twos and threes (or not at all), rooms never overlap, corridors join the rooms they say they do, and the
// plan is the same every time for the same seed. Run: node test/dungeon_map.js [seeds]
'use strict';
require('../assets/core.js'); require('../assets/delve.js');
const G = globalThis.G, SEEDS = Number(process.argv[2] || 300);
let fails = 0, checks = 0, forks = 0, sizes = {}, dirs = {}, arity = {}, shapes = new Set(), kinds = {}, noFork = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 20) console.log('FAIL', m); } };
for (let s = 0; s < SEEDS; s++) for (let n = 0; n < 16; n++) {
  const seed = 5000 + s * 7, D = G.dungeonFor(seed, n), M = D.map, tag = seed + '/' + n;
  ok(M && M.rooms.length > 3, 'has a map ' + tag);
  ok(JSON.stringify(G.dungeonFor(seed, n).map) === JSON.stringify(M), 'deterministic ' + tag);
  const fk = D.events.filter((e) => e.kind === 'fork');
  ok(fk.length <= 3, 'forks ' + tag + ' ' + fk.length);
  forks += fk.length; if (!fk.length) noFork++;
  fk.forEach((f) => { ok(f.ways.length === 2 || f.ways.length === 3, 'ways ' + tag); arity[f.ways.length] = (arity[f.ways.length] | 0) + 1; ok(new Set(f.ways.map((w) => w.k)).size === f.ways.length, 'distinct ways ' + tag); });
  D.events.forEach((e) => { kinds[e.kind] = 1; });
  shapes.add(D.events.map((e) => e.kind[0] + (e.ways ? e.ways.length : '')).join(''));
  ok(D.events[0].kind === 'fight', 'a fight first ' + tag);
  ok(D.events.some((e) => e.kind === 'chest'), 'at least one chest ' + tag);
  ok(D.events.every((e, i) => e.kind !== 'fork' || !D.events[i - 1] || D.events[i - 1].kind !== 'fork'), 'forks not back to back ' + tag);
  ok(new Set(D.events.map((e) => e.id)).size === D.events.length, 'unique ids ' + tag);
  ok(M.rooms.length === 2 + D.events.length + fk.reduce((a, f) => a + f.ways.length, 0), 'room count ' + tag);
  const box = (o) => [o.x0 - 1, o.y0, o.x0 + o.w, o.y0 + o.d + 2];
  M.rooms.forEach((a, i) => {
    const A = box(a);
    ok(A[0] >= 0 && A[1] >= 0 && A[2] < M.w && A[3] < M.h, 'inside ' + tag + a.id);
    for (let j = i + 1; j < M.rooms.length; j++) { const B = box(M.rooms[j]); ok(A[2] < B[0] || B[2] < A[0] || A[3] < B[1] || B[3] < A[1], 'overlap ' + tag + a.id + M.rooms[j].id); }
    sizes[a.w + 'x' + a.d] = 1;
  });
  const ids = new Set(M.rooms.map((o) => o.id));
  M.links.forEach((l) => { ok(ids.has(l.a) && ids.has(l.b), 'link ends ' + tag); ok(l.pts.length === 4, 'link pts ' + tag); });
  // every room can be reached from the entrance
  const seen = { enter: 1 }; let grow = true;
  while (grow) { grow = false; M.links.forEach((l) => { if (seen[l.a] && !seen[l.b]) { seen[l.b] = 1; grow = true; } if (seen[l.b] && !seen[l.a]) { seen[l.a] = 1; grow = true; } }); }
  ok(M.rooms.every((o) => seen[o.id]), 'connected ' + tag);
  fk.forEach((f) => { ok(M.forks[f.id] && M.forks[f.id].a !== M.forks[f.id].b, 'fork sides ' + tag); dirs[M.forks[f.id].a] = 1; });
}
ok(arity[2] > 0 && arity[3] > 0 && noFork > 0 && Object.keys(kinds).length >= 10, 'variety: two- and three-way forks, none at all, and every kind of room');
ok(shapes.size > SEEDS * 4, 'dungeons differ: ' + shapes.size + ' shapes in ' + SEEDS * 16);
console.log('ways ' + JSON.stringify(arity) + ', no fork in ' + noFork + ', shapes ' + shapes.size + ', kinds ' + Object.keys(kinds).join());
console.log(checks + ' checks, ' + fails + ' failures; forks ' + forks + '; distinct room sizes ' + Object.keys(sizes).length + '; fork sides ' + Object.keys(dirs).join(','));
process.exit(fails ? 1 : 0);
