// Rooms: buy any size, resize, move, sell; props sized to their sprite; locked props don't get in the way.
// Run: TZ=Australia/Perth node test/rooms.js
global.window = global; require('../assets/core.js');
const G = window.G;
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const fresh = () => { const s = G.normalize({}, G.today()); s.gold = 5000; s.level = 20; G.STATS.forEach((k) => { s.stats[k] = 2000; }); return s; };
// every placed thing must pass whyNot, doors must be on walls, rooms mustn't overlap
function sane(s, tag) {
  const live = G.houseLive(s), G2 = G.houseGeom(s.house, true), keep = [];
  s.house.items.forEach((it) => { const w = G.whyNot(s, it, it.x, it.y, it.id, { geom: G2, lot: true, items: keep, live }); ok(!w, tag + ': ' + it.k + ' at ' + it.x + ',' + it.y + ' -> ' + w); keep.push(it); });
  const R = s.house.rooms;
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) ok(!(R[i].x0 <= R[j].x1 && R[i].x1 >= R[j].x0 && R[i].y0 <= R[j].y1 && R[i].y1 >= R[j].y0), tag + ': rooms overlap');
  const before = JSON.stringify(s.house.doors); G.doorsTidy(s); ok(before === JSON.stringify(s.house.doors), tag + ': stray doors');
  R.forEach((r) => ok(r.paid >= 0 && G.ROOM_PURPOSES[r.purpose], tag + ': room ' + r.id + ' has paid/purpose'));
}
{ // props fit their sprite
  const s = fresh(), t0 = G.furnOf({ k: 'ktable' });
  ok(t0.w === 2 && t0.h === 1, 'tier-0 table is 2×1, got ' + t0.w + '×' + t0.h);
  s.estate.tiers.ktable = 3; G.setEst(s);
  const t3 = G.furnOf({ k: 'ktable' });
  ok(t3.w === 3 && t3.h === 2, 'tier-3 table is 3×2');
  s.estate.tiers.ktable = 0; G.setEst(s);
  sane(s, 'fresh');
}
{ // prices and the starting rooms
  ok(G.roomPrice(5, 3) === 85 && G.roomPrice(12, 12) === 730 && G.roomPrice(1, 1) === 15, 'prices');
  const s = fresh();
  s.house.rooms.forEach((r) => ok(r.paid === 85, 'starting room ' + r.id + ' counts as a 5×3'));
}
{ // buy a 1×1 and a 12×12; refuse 13; refuse overlap; refuse when poor
  const s = fresh(), g0 = s.gold;
  s.house.rooms = s.house.rooms.filter((r) => r.id === 'bedroom');
  s.house.doors = []; G.doorsTidy(s);
  let r = G.roomAdd(s, 10, 1, 10, 4); ok(!r.err && G.roomDims(r.room).w === 1 && G.roomDims(r.room).d === 1, '1×1 bought: ' + r.err);
  ok(s.gold === g0 - 15, '1×1 costs 15');
  r = G.roomAdd(s, 12, 8, 23, 22); ok(!r.err && G.roomDims(r.room).w === 12 && G.roomDims(r.room).d === 12, '12×12 bought: ' + r.err);
  ok(G.roomAdd(s, 1, 1, 13, 4).err, '13 wide refused');
  ok(G.roomAdd(s, 1, 1, 6, 17).err, '13 deep refused');
  ok(G.roomAdd(s, 17, 1, 20, 5).err, 'overlap refused');
  s.gold = 10; ok(/costs/.test(G.roomAdd(s, 1, 10, 5, 13).err || ''), 'poor refused');
  sane(s, 'bought');
}
{ // resize: pay the difference, get half back, items outside go to storage
  const s = fresh(), id = 'bedroom';
  G.roomDel(s, 'laundry'); // room to grow into
  const g0 = s.gold, r0 = s.house.rooms.find((r) => r.id === id), z0 = G.roomDims(r0);
  let r = G.roomResize(s, id, z0.w, 8); ok(!r.err, 'grow: ' + r.err);
  ok(s.gold === g0 - (G.roomPrice(z0.w, 8) - 85), 'growing costs the difference (' + (g0 - s.gold) + ')');
  const g1 = s.gold; r = G.roomResize(s, id, 3, 3); ok(!r.err, 'shrink: ' + r.err);
  ok(s.gold === g1 + Math.floor((G.roomPrice(z0.w, 8) - G.roomPrice(3, 3)) / 2), 'shrinking returns half');
  ok(!s.house.items.some((it) => it.k === 'bed'), 'the bed no longer fits and is in storage');
  ok(G.houseStored(s).some((o) => o.k === 'bed'), 'and shows up in storage');
  sane(s, 'resized');
  ok(G.roomResize(s, id, 13, 3).err, 'too wide refused');
  s.gold = 0; ok(G.roomResize(s, id, 12, 12).err, 'poor refused');
}
{ // move: things and doors travel; things where it lands go to storage
  const s = fresh(), id = 'kitchen', k = s.house.rooms.find((r) => r.id === id);
  const fr = s.house.items.find((i) => i.k === 'fridge'), fx = fr.x, fy = fr.y;
  s.house.rooms = s.house.rooms.filter((r) => r.id === 'kitchen' || r.id === 'lounge'); s.house.doors = s.house.doors.filter((d) => d[1] === 4 || d[1] === 5);
  const r = G.roomMove(s, id, 1, 14);
  ok(!r.err, 'move: ' + r.err);
  const fr2 = s.house.items.find((i) => i.k === 'fridge');
  ok(fr2 && fr2.x === fx && fr2.y === fy + 13, 'fridge travelled with it');
  ok(!s.house.doors.some((d) => d[0] === 9 && d[1] === 4), 'the lounge side of its door is gone too');
  sane(s, 'moved');
  ok(G.roomMove(s, id, 20, 1).err, 'moving onto the lounge is refused');
  ok(G.roomMove(s, id, 30, 1).err, 'moving past the fence is refused');
}
{ // sell: half back, things stored, can't sell the last
  const s = fresh(), g0 = s.gold, r = G.roomDel(s, 'laundry');
  ok(!r.err && r.refund === 42 && s.gold === g0 + 42, 'sold for half of 85');
  ok(!s.house.items.some((i) => i.k === 'washer'), 'washer stored');
  sane(s, 'sold');
  while (s.house.rooms.length > 1) G.roomDel(s, s.house.rooms[0].id);
  ok(G.roomDel(s, s.house.rooms[0].id).err, 'last room stays');
}
{ // purposes
  const s = fresh(); ok(!G.roomSet(s, 'study', { purpose: 'birdroom' }), 'purpose set');
  ok(s.house.rooms.find((r) => r.id === 'study').name === 'Bird room', 'untouched name follows the purpose');
  ok(G.roomSet(s, 'study', { purpose: 'nonsense' }), 'bad purpose refused');
}
{ // a locked thing doesn't block placing; when it unlocks it moves out of the way
  const s = fresh(); s.estate.wings = {}; s.house.items = s.house.items.filter((i) => i.k !== 'pool');
  const pool = { id: 999, k: 'pool', x: 10, y: 22 }; s.house.items.push(pool);
  ok(!G.houseLive(s)[999], 'pool is locked');
  const w = G.whyNot(s, { k: 'crate', x: 0, y: 0 }, 11, 23); ok(!w, 'crate can go where the locked pool waits: ' + w);
  s.house.items.push({ id: 1000, k: 'crate', x: 11, y: 23 });
  s.estate.wings.pool = true; s.estate.tiers.pool = 0; G.setEst(s); G.houseSettle(s);
  sane(s, 'unlocked');
}
console.log(checks + ' checks, ' + fails + ' failures'); process.exit(fails ? 1 : 0);
