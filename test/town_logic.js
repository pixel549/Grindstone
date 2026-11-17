// 2.24: the town's layout and the companions' homes, without a browser. Every door can be reached from the gate with
// everything built; nothing stands on a road it shouldn't; each keeper can be talked to from the doorstep; homes follow
// who lives with him; the builder's view of a cottage changes the cottage and the purse and nothing else.
require('../assets/core.js'); require('../assets/delve.js'); require('../assets/town.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const M = G.TMAP, t = '2026-11-16';

// the walk grid with every lot built, as town2d.js lays it out
function grid(builtAll) {
  const gr = G.townGround(), w = new Uint8Array(M.w * M.h);
  for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) w[y * M.w + x] = gr[y * M.w + x] === 3 || !x || !y || x === M.w - 1 || y === M.h - 1 ? 0 : 1;
  M.gate.forEach((c) => { w[c[1] * M.w + c[0]] = 1; });
  M.props.forEach((p) => { const x0 = p[1] - Math.floor((p[3] - 1) / 2); for (let i = 0; i < p[3]; i++) w[p[2] * M.w + x0 + i] = 0; });
  const lots = Object.values(M.lots).concat(M.plots);
  if (builtAll) lots.forEach((L) => { for (let y = L.y; y < L.y + L.h; y++) for (let x = L.x; x < L.x + L.w; x++) w[y * M.w + x] = 0; });
  return { w, lots };
}
const { w, lots } = grid(true);
const seen = new Uint8Array(M.w * M.h), q = [M.spawn[1] * M.w + M.spawn[0]]; seen[q[0]] = 1;
for (let i = 0; i < q.length; i++) { const c = q[i], x = c % M.w, y = (c / M.w) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const n = (y + dy) * M.w + x + dx; if (x + dx >= 0 && x + dx < M.w && y + dy >= 0 && y + dy < M.h && w[n] && !seen[n]) { seen[n] = 1; q.push(n); } }); }
const shut = lots.filter((L) => { const d = [L.x + L.dc, L.y + L.h]; return !seen[d[1] * M.w + d[0]]; });
ok(!shut.length, 'with everything built, every one of ' + lots.length + ' doors can be reached from the gate' + (shut.length ? ' (not ' + shut.map((L) => L.x + ',' + L.y).join(' ') + ')' : ''));
// no two lots overlap, and none sits on a road
const cells = {}; let clash = 0, onRoad = 0; const gr = G.townGround();
lots.forEach((L) => { for (let y = L.y; y < L.y + L.h; y++) for (let x = L.x; x < L.x + L.w; x++) { if (cells[x + ',' + y]) clash++; cells[x + ',' + y] = 1; if (gr[y * M.w + x] === 1 || gr[y * M.w + x] === 2) onRoad++; } });
ok(!clash && !onRoad, 'lots neither overlap nor sit on a road (' + clash + ', ' + onRoad + ')');
ok(M.plots.length === 16 && Object.keys(M.lots).length === Object.keys(G.TOWN).length, '16 plots, and a lot for every town building');
// the inside of each building: the keeper can be reached from the doorstep
Object.keys(M.inside).forEach((k) => {
  const I = M.inside[k], W = M.inW, H = M.inH, wk = new Uint8Array(W * H);
  for (let y = 2; y < H - 1; y++) for (let x = 0; x < W; x++) wk[y * W + x] = 1;
  wk[M.exit[1] * W + M.exit[0]] = 1;
  I.props.forEach((p) => { for (let j = 0; j < (p[4] || 1); j++) for (let i = 0; i < p[3]; i++) if (p[2] - j >= 2) wk[(p[2] - j) * W + p[1] + i] = 0; });
  wk[I.keeper[1] * W + I.keeper[0]] = 0;
  const sn = new Uint8Array(W * H), qq = [M.exit[1] * W + M.exit[0]]; sn[qq[0]] = 1;
  for (let i = 0; i < qq.length; i++) { const c = qq[i], x = c % W, y = (c / W) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const n = (y + dy) * W + x + dx; if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H && wk[n] && !sn[n]) { sn[n] = 1; qq.push(n); } }); }
  let near = false; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = I.keeper[0] + dx, y = I.keeper[1] + dy; if (x >= 0 && y >= 0 && x < W && y < H && sn[y * W + x]) near = true; }
  if (!near) ok(false, 'the ' + k + ' keeper can be reached');
});
ok(true, 'every keeper can be reached from the doorstep');

// ---- homes ----
let S = G.normalize(null, t);
S.gold = 10000;
['bard', 'smith'].forEach((k, i) => S.npcs.push({ id: 'w-' + k, kind: 'human', name: 'N' + i, status: 'resident', via: { type: 'gold', gold: 200 } }));
S.npcs.push({ id: 'w-hermit', kind: 'human', name: 'H', status: 'waiting', via: { type: 'gold', gold: 900 } });
S = G.normalize(S, t); G.normDelve(S);
ok(S.homes['w-bard'] && S.homes['w-smith'] && !S.homes['w-hermit'] && !S.homes.ruby && S.homes['w-bard'].plot !== S.homes['w-smith'].plot, 'residents get plots of their own; the waiting and the birds don’t');
ok(!G.npcInvite(S, 'w-hermit'), 'inviting someone needs no rooms in his house');
G.homesNorm(S);
ok(!!S.homes['w-hermit'], 'and they get a plot');
const mine = JSON.stringify(S.house), g0 = S.gold;
let r = G.homeBuild(S, 'w-bard', t);
ok(!r.err && r.cost === 250 && S.gold === g0 - 250 && S.homes['w-bard'].house.rooms.length === 1, 'the first cottage costs 250');
r = G.homeBuild(S, 'w-smith', t);
ok(r.cost === 400, 'the next costs 400');
ok(G.homeBuild(S, 'w-smith', t).err, 'a cottage can’t be built twice');
const V = G.homeProxy(S, 'w-bard'), g1 = S.gold;
const add = G.roomAdd(V, 2, 2, 7, 8, { purpose: 'lounge' });
ok(!add.err && S.gold === g1 - add.cost && S.homes['w-bard'].house.rooms.length === 2 && JSON.stringify(S.house) === mine, 'building through the cottage’s view changes the cottage and the purse, not his house');
ok(G.furnOwned(V, 'renojob') === 0 && G.furnOwned(V, 'aviary') === 0 && G.furnOwned(V, 'bed') === 1, 'a cottage has a bed but no restoration job or aviary');
const st = G.homeSettle(S, t);
ok(st.length === 1 && st[0].id === 'w-bard' && st[0].gift === 100 && G.homeSettled(S, 'w-bard'), 'the bard has a lounge, settles in and gives back half his price');
ok(!G.homeSettle(S, t).length, 'settling in happens once');
const c = G.compFor(Object.assign({}, S, { delve: Object.assign({}, S.delve, { comp: 'w-bard' }) }));
ok(c.settled && Math.abs(c.m - 0.35) < 1e-9, 'a settled tagalong fights at 0.35');
S.npcs = S.npcs.filter((n) => n.id !== 'w-smith'); G.homesNorm(S);
ok(!S.homes['w-smith'], 'moving out frees their plot');
const ng = G.normalize(G.newGamePlus(S, t), t);
ok(!Object.keys(ng.homes).length, 'New Game+ starts the town’s homes afresh');

// ---- talk ----
const ppl = G.townPeople(S, t);
let empty = 0;
ppl.forEach((p) => { const d = G.townTalk(S, p.id, t, { people: ppl }); if (!d || !d.pages.length || !d.choices.length) empty++; });
ok(!empty, 'everyone in town has something to say (' + ppl.length + ' people)');
['lot:chapel', 'plot:15', 'gate'].forEach((id) => ok(G.townTalk(S, id, t).pages.length > 0, id + ' has words on it'));
ok(G.townHints(S, t).some((h) => /^boss:/.test(h.key)), 'the hints include what the next boss does');
const gp = G.gossipFor(S);
if (gp) { const gg = S.gold, gr2 = G.townGossip(S); ok(!gr2.err && S.gold === gg - gp.price && !G.gossipFor(S), 'the gossip’s tip costs ◈ ' + gp.price + ' and is told once'); }
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
