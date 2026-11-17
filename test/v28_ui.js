// 2.8: weeklies, minimums, targets, the roster, seasons, collections, backups and the strength split, driven by finger taps.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s20/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const cx_ = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true }); const p = await cx_.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    window.__frames = null;
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.0', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {},
      heraldInfo: () => JSON.stringify({ perm: true, write: true, cals: [{ id: 7, name: 'Findmyshift roster', account: 'feed' }, { id: 3, name: 'Grindstone', account: 'gmail' }] }), rosterEvents: () => JSON.stringify(window.__roster || []), backupWrite: (j, n) => { window.__bk = [j.length, n]; return 'ok: Downloads/Grindstone/' + n; }, backupPick: (cb) => { window.__pick = cb; }, askCalendar: () => {}, heraldArm: () => {}, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: true, sig: '', age: -1 }), widgetFrames: (j) => { window.__frames = JSON.parse(j); return true; }, interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  // first run: creator
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(800); await shot('h01-creator');
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(600);
  await p.click('[data-m="c-save"]');
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(350); if (!(await p.$('#modal:not(.hidden)'))) break; const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn'); if (c) await c.click().catch(() => {}); }
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const tap = async (sel) => { const el = await p.$(sel); if (!el) { console.log('MISSING ' + sel); fails++; return false; } await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(450); return true; };
  const closeSheet = async () => { await tap('#modal .btn[data-m="close"]'); };
  const save = () => p.evaluate(() => JSON.parse(localStorage.gs));
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.gold = 500; s.level = 5; s.created = G.addDays(G.today(), -40); G.STATS.forEach((k) => { s.stats[k] = 700; }); delete s.season; localStorage.gs = JSON.stringify(s); window.onResume(); });
  await p.waitForTimeout(600);

  // ---- rules, in the page's own copy of the game ----
  const R = await p.evaluate(() => {
    const t = G.today(), s = G.normalize(null, t); G.normDelve(s); s.gold = 100;
    const o = { slots3: s.trials.list.length, base: G.weeklySlots(s) };
    s.level = 13; G.weeklyTopUp(s, t); o.slots5 = s.trials.list.length; o.extras = s.trials.list.filter((g) => g.bonus).length;
    o.costs = []; const id = s.trials.list[4].id; let cur = id;
    for (let i = 0; i < 3; i++) { o.costs.push(G.weeklyCost(s)); const e = G.weeklyReroll(s, cur, t, Date.now()); if (e) { o.err = e; break; } cur = s.trials.list[4].id; }
    o.gold = s.gold; o.since = !!s.trials.list[4].since; o.dupes = new Set(s.trials.list.map((g) => JSON.stringify(g.filter))).size === s.trials.list.length;
    const q = s.quests.find((x) => x.name === 'Swim'); const r = G.complete(s, q.id, t, Date.now(), { min: true }); o.min = [r.xp, r.gold, s.log[0].m, q.count];
    const at = (d, h, m) => { const x = new Date(d + 'T00:00'); x.setHours(h, m); return x.getTime(); };
    const days = G.rosterDigest([{ t: 'RC', s: at(t, 6, 45), e: at(t, 9, 0) }, { t: 'RC', s: at(t, 14, 30), e: at(t, 22, 0) }, { t: 'x', s: at(G.addDays(t, 1), 14, 30), e: at(G.addDays(t, 1), 21, 30) }, { t: 'RDO', a: true, s: Date.parse(G.addDays(t, 2) + 'T00:00:00Z'), e: Date.parse(G.addDays(t, 3) + 'T00:00:00Z') }, { t: 'Curtis off', a: true, s: Date.parse(G.addDays(t, 1) + 'T00:00:00Z'), e: Date.parse(G.addDays(t, 2) + 'T00:00:00Z') }, { t: 'O/N', s: at(G.addDays(t, 4), 21, 0), e: at(G.addDays(t, 5), 7, 0) }]);
    s.settings.rosterCal = '7'; s.roster = { at: 1, days: days };
    o.kinds = [0, 1, 2, 3, 4, 5, 6].map((i) => G.dayKind(s, G.addDays(t, i)) || '-').join(','); o.mins = days[t].mins; o.on = [days[G.addDays(t, 4)].mins, days[G.addDays(t, 5)].mins];
    const m = { unit: 'time', better: 'lower', target: 300 }; o.parse = [G.markParse(m, '4:58'), G.markParse(m, '5m02'), G.markParse(m, '297'), G.markParse(m, 'abc'), G.markFmt(m, 298)];
    o.season = [G.seasonKey('2026-11-11'), G.seasonKey('2027-01-20'), G.seasonEnd('2026-12-05'), G.seasonName('2026-summer')];
    const s2 = G.normalize(null, '2026-11-11'); s2.stats.STR = 2000; s2.level = 12; const pay = G.seasonClaim(s2, '2026-11-11'); o.pay = [G.seasonState(s2, '2026-11-11').tier, pay.length, G.seasonClaim(s2, '2026-11-11').length];
    o.lawn = [G.lawnDays(14, '2026-10-01'), G.lawnDays(14, '2026-07-01')];
    const hero = (ws) => { const i = G.inputFor(s); return G.heroFrom(i); }; o.fresh = (() => { const f = G.normalize(null, t); G.normDelve(f); const h = G.heroFrom(G.inputFor(f)); return [h.hpMax > 60 && h.hpMax < 110, h.atk > 4 && h.atk < 16]; })();
    return o;
  });
  ok(R.slots3 === 3 && R.base === 3 && R.slots5 === 5 && R.extras === 2, 'three weeklies to start, five by level 13, the added ones are extras');
  ok(R.costs.join() === '0,10,20' && R.gold === 70 && R.since && R.dupes, 'swaps cost nothing, then 10, then 20; a swapped-in offer counts from now; no two offers alike: ' + R.costs.join() + (R.err ? ' ' + R.err : ''));
  ok(R.min.join() === '18,20,1,1', 'the minimum pays half (18 XP, 20 gold of 35 and 40), is marked, and still counts as done: ' + R.min.join());
  ok(R.kinds === 'long,work,off,off,work,work,-' && R.mins === 585 && R.on.join() === '180,420', 'roster: a split 9.75 h day is long, a 7 h shift is work, RDO and gaps are off, someone else’s all-day note is ignored, an overnight is split at midnight: ' + R.kinds + ' ' + R.on.join());
  ok(JSON.stringify(R.parse) === '[298,302,297,null,"4:58"]', 'targets read 4:58, 5m02 and 297, refuse nonsense, and print 4:58');
  ok(R.season.join() === '2026-spring,2026-summer,2027-02-28,Summer 2026/27' && R.pay[0] >= 1 && R.pay[0] === R.pay[1] && R.pay[2] === 0, 'seasons: spring runs to the end of November, summer spans the new year; steps are paid once: ' + R.season.join() + ' ' + R.pay.join());
  ok(R.lawn.join() === '14,9', 'the lawn grows at full rate in spring and slower in winter');
  ok(R.fresh[0] && R.fresh[1], 'a new hero is about as strong as he always was');

  // ---- Today: chips, the light list, the minimum ----
  await p.evaluate(() => { const t = G.today(), at = (d, h, m) => { const x = new Date(d + 'T00:00'); x.setHours(h, m); return x.getTime(); }; window.__roster = [{ t: 'RC', s: at(t, 6, 45), e: at(t, 9, 0), a: false }, { t: 'RC', s: at(t, 14, 30), e: at(t, 22, 0), a: false }]; });
  await p.click('[data-act="tab"][data-v="records"]'); await p.waitForTimeout(250); await p.click('[data-act="sub"][data-v="settings"]'); await p.waitForTimeout(250);
  await tap('[data-act="roster-pick"]'); await tap('[data-m="roster-set"][data-id="7"]');
  ok((await save()).settings.rosterName === 'Findmyshift roster', 'the roster calendar is linked from Settings by a finger tap');
  await tap('[data-act="backup-now"]'); ok(await p.evaluate(() => window.__bk && /^grindstone-\d{4}-\d\d-\d\d\.json$/.test(window.__bk[1]) && window.__bk[0] > 500), 'Back up now writes the save to a dated file');
  await tap('[data-act="backup-pick"]');
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.level = 9; window[window.__pick](JSON.stringify(s)); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /Restore this backup/i.test(document.querySelector('#modal').innerText) && /Level 9/i.test(document.querySelector('#modal').innerText)), 'a picked file is checked and asks before replacing anything');
  await tap('#modal [data-m="close"].btn');
  await p.click('[data-act="tab"][data-v="quests"]'); await p.waitForTimeout(400); await shot('a1-today');
  const today = await p.evaluate(() => document.querySelector('#main').innerText);
  ok(/Weeklies 0\/3/.test(today) && /Long shift/.test(today) && /LET OFF TODAY/i.test(today) && !/affliction|No training yet/i.test(today), 'Today is a strip of chips: weeklies, the long shift, no omens; the dishes are let off');
  ok(await p.evaluate(() => document.querySelectorAll('#main img.pxe').length > 5), 'icons are drawn as pixels');
  ok(/0\/2/.test(today), 'only the needed dailies are counted on a long day');
  await tap('[data-act="complete-min"]');
  ok((await save()).log[0].m === 1, 'the min button logs the bare minimum');
  // ---- 2.9: the list wears down; gear effects; sound switch ----
  const wd = await p.evaluate(() => { const s = JSON.parse(localStorage.gs), id = s.log[0].q; return { gone: !document.querySelector('#main .row[data-id="' + id + '"]'), fold: (document.querySelector('.fold') || {}).innerText || '', left: (document.querySelector('.planhd .pn') || {}).innerText || '' }; });
  ok(wd.gone && /1 done today/.test(wd.fold) && /^\d+\/\d+$/.test(wd.left.trim()), 'a finished task drops off the list; the fold counts it and the bar says how many are left: ' + wd.fold.replace(/\n/g, ' ') + ' / ' + wd.left);
  await tap('[data-act="fold-done"]');
  ok(await p.evaluate(() => { const s = JSON.parse(localStorage.gs), id = s.log[0].q; return !!document.querySelector('#main .row[data-id="' + id + '"]'); }), 'opening the fold brings it back into reach');
  await tap('[data-act="fold-done"]');
  const fx = await p.evaluate(() => { const s = G.normalize(null, G.today()); G.normDelve(s); let all = true, some = 0; const r = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    for (let i = 0; i < 60; i++) { const it = G.rollItem(s, 2, r); if (!G.fxOf(it) && !(G.MINOR[it.slot] && it.tier < 3)) all = false; } for (let i = 0; i < 200; i++) { const it = G.rollItem(s, 0, r); if (it.tier === 0 && it.fx) all = false; if (it.tier === 1 && it.fx) some++; }
    const inp = G.inputFor(s), base = G.heroFrom(inp), eq = Object.assign({}, inp.eq, { charm: { id: 9e6, slot: 'charm', tier: 2, bonus: {}, fx: 'flask' }, body: { id: 9e6 + 1, slot: 'body', tier: 2, bonus: {}, fx: 'hale' } }), h = G.heroFrom(inp, eq);
    return { all: all, some: some, flask: h.flasks - base.flasks, hp: h.hpMax / base.hpMax }; });
  ok(fx.some > 0 && fx.flask === 1 && Math.abs(fx.hp - 1.1) < 0.02, 'rare gear always carries an effect, common never, uncommon sometimes; a Brimming charm is one more flask, a Hale coat a tenth more health');
  await tap('[data-act="review"]'); ok(await p.evaluate(() => /STUCK/i.test(document.querySelector('#modal').innerText) && /SLIPPED/i.test(document.querySelector('#modal').innerText)), 'the week in review opens'); await shot('a2-review'); await closeSheet();
  await tap('[data-act="season"]'); ok(await p.evaluate(() => document.querySelectorAll('#modal .strack div').length === 10), 'the season track shows ten steps'); await shot('a3-season'); await closeSheet();

  // ---- 2.10: requests, the trader, wants, boons ----
  const H = await p.evaluate(() => {
    const t = G.today(), s = G.normalize(null, t); G.normDelve(s); s.created = G.addDays(t, -30); const o = {};
    // a human resident, and a chore nobody has done lately
    s.npcs.push({ id: 'n-x', kind: 'human', name: 'Mira', look: G.randomLook ? G.randomLook() : {}, status: 'resident', via: { type: 'gold', gold: 0 }, role: 'healer', el: 'holy', about: '', bond: 0 });
    let a = null, day = t; for (let i = 0; i < 40 && !a; i++) { day = G.addDays(t, i); a = G.asksTick(s, day, Date.parse(day + 'T08:00:00')); }
    o.asked = !!a; if (a) { const q = s.quests.find((x) => x.id === a.q); o.again = G.asksTick(s, day, 1) === null;
      for (let k = 0; k < a.n; k++) s.log.unshift({ t: Date.parse(day + 'T09:00:00') + k, d: day, q: q.id, n: q.name, x: 10, g: 5, s: q.stat });
      const g0 = s.gold, r = G.asksSync(s, day, Date.parse(day + 'T10:00:00')); o.paid = r.length === 1 && s.gold - g0 === a.gold && r[0].npc.bond === 1 && s.asks.list.length === 0; }
    s.level = 40; G.wanderersCheck(s); s.gold = 99999;
    // 2.24: they move in for the gold alone; the storeroom is wanted in their own cottage in town
    s.house.rooms[0].purpose = 'store';
    o.wants = G.npcWants(s, 'w-pedlar').map((w) => w.ok).join();
    o.pedlar2 = G.npcInvite(s, 'w-pedlar');
    let inDay = null; for (let i = 0; i < 40 && !inDay; i++) { const d = G.addDays(t, 50 + i); for (let k = 1; k <= 7; k++) s.log.unshift({ t: 1, d: G.addDays(d, -k), q: 1, x: 1 }); if (G.traderTick(s, d)) inDay = d; }
    if (inDay) { const it = s.trader.stock[0], g0 = s.gold; o.buy = G.traderBuy(s, it.id, inDay) === null && s.gold === g0 - it.price && s.inv.some((x) => x.id === it.id) && s.trader.stock.length === 3; o.sell = G.sellFor(s, it, inDay) === Math.round(G.sellValue(it) * 1.3) && G.sellFor(s, it, G.addDays(inDay, 1)) === G.sellValue(it); }
    o.trader = !!inDay;
    s.delve.trophies = [1, 2, 3, 4, 5, 6, 7]; o.due = G.perksDue(s); const off = G.perkOffer(s); o.offer = off.length; o.pick = G.perkPick(s, off[0]) && G.perksDue(s) === 1 && !G.perkPick(s, 'nonsense');
    s.delve.perks = {}; const h0 = G.heroFrom(G.inputFor(s)); s.delve.perks = { flask: 1, wind: 2 }; const h1 = G.heroFrom(G.inputFor(s)); o.boon = h1.flasks - h0.flasks === 1 && h1.hpMax > h0.hpMax * 1.1;
    s.delve.trophies = new Array(34).fill(1); s.delve.perks = {}; o.late = G.perksDue(s);
    return o;
  });
  ok(H.asked && H.again && H.paid, 'someone in the house asks for a slipping deed, once a day at most; doing it pays and counts as a favour: ' + JSON.stringify([H.asked, H.again, H.paid]));
  ok(H.wants === 'false' && H.pedlar2 === null, 'the pedlar moves in for the gold alone; a storeroom in his house doesn’t count towards their own');
  ok(H.trader && H.buy && H.sell, 'the trader calls at a busy house, sells from four pieces, and pays 30% over for that day only');
  ok(H.due === 2 && H.offer === 3 && H.pick && H.boon && H.late === 10, 'a boon for every third clear (every fifth after eight), one of three, and they change the hero');
  // ---- 2.11: seven slots, minor pieces, watching means choosing ----
  const E = await p.evaluate(() => {
    const s = G.normalize(null, G.today()); G.normDelve(s); const o = { slots: G.SLOTS.length };
    const r = (() => { let a = 3; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    let minorOk = true, seen = {}; for (let i = 0; i < 300; i++) { const it = G.rollItem(s, 0, r); seen[it.slot] = 1; if (G.MINOR[it.slot] && (Object.keys(it.bonus).length || !G.minorText(it) || it.res)) minorOk = false; if (!G.MINOR[it.slot] && !Object.keys(it.bonus).length) minorOk = false; }
    o.minorOk = minorOk; o.all = G.SLOTS.every((k) => seen[k]);
    const inp = G.inputFor(s), h0 = G.heroFrom(inp), h1 = G.heroFrom(inp, Object.assign({}, inp.eq, { hands: { id: 1e7, slot: 'hands', art: 'glove', tier: 4, bonus: {}, amt: 5 }, feet: { id: 1e7 + 1, slot: 'feet', art: 'boot', tier: 2, bonus: {}, amt: 3 } }));
    o.glove = Math.abs(h1.atk / h0.atk - 1.1) < 0.005; o.boot = Math.abs(h1.evade - h0.evade - 0.03) < 0.001;
    // a dungeon with a choice in it: watching always asks, even with a standing order; Skip (auto) uses the order
    let n = 1, D = null; for (; n < 30; n++) { D = G.dungeonFor(s.delve.seed, n); if (D.events.some((e) => e.kind === 'fork' || e.kind === 'chest' || e.kind === 'shrine')) break; }
    G.STATS.forEach((k) => { s.stats[k] = 4000; }); s.level = 30; s.delve.n = n;
    const i2 = G.inputFor(s), w = G.simRun(i2, {}, true); o.asks = !!w.pause;
    if (w.pause) { s.delve.orders.ev[n] = {}; s.delve.orders.ev[n][w.pause.id] = w.pause.options[0].v; const i3 = G.inputFor(s), w2 = G.simRun(i3, {}, true), a = G.simRun(i3, { __auto: true }, true), u = G.simRun(i3, {}, false);
      o.still = !!w2.pause && w2.pause.id === w.pause.id && JSON.stringify(w2.pause.was) === JSON.stringify(w.pause.options[0].v); o.auto = !(a.pause && a.pause.id === w.pause.id); o.away = !u.pause; }
    return o;
  });
  ok(E.slots === 7 && E.all && E.minorOk, 'seven slots; off hand, gloves and boots carry one small effect and no stat points, the old four carry stats');
  ok(E.glove && E.boot, 'legendary gloves are 10% more damage, rare boots 3% more dodge');
  ok(E.asks && E.still && E.auto && E.away, 'watching, he asks every time (and says what was chosen last time); Skip or being away uses the order: ' + JSON.stringify([E.asks, E.still, E.auto, E.away]));
  // ---- weeklies and targets ----
  await p.click('[data-act="sub"][data-v="vows"]'); await p.waitForTimeout(300);
  const before = (await save()).trials.list.map((g) => g.title).join('|');
  await tap('[data-act="wk-swap"]');
  const sv = await save();
  ok(sv.trials.list.map((g) => g.title).join('|') !== before && sv.trials.rerolls === 1 && sv.gold === 500 + sv.log.filter((e) => e.g > 0).reduce((a, e) => a + e.g, 0), 'the first swap is free and changes the offer');
  await tap('[data-act="mark-new"]'); await tap('[data-m="mk-idea"]'); await tap('[data-m="mk-save"]');
  await tap('[data-act="mark"]');
  for (const v of ['5:31', '5:12', '4:58']) { await p.fill('#mk-v', v); await tap('[data-m="mk-log"]'); }
  await shot('a4-target');
  const mk = (await save()).marks[0];
  ok(mk && mk.log.length === 3 && mk.done && mk.target === 300, 'a target takes three attempts and is met by 4:58: ' + JSON.stringify(mk));
  ok(await p.evaluate(() => !!document.querySelector('#modal svg.spark polyline')), 'attempts are graphed against the target');
  await closeSheet();

  // ---- the delve: where his strength comes from ----
  await p.click('[data-act="tab"][data-v="delve"]'); await p.waitForTimeout(2500); await shot('a5-delve');
  const pw = await p.evaluate(() => { const el = document.querySelector('.pw'); return el ? el.innerText : ''; });
  ok(/Stats \d+%/.test(pw), 'the Delve page shows the split: ' + pw.replace(/\n/g, ' '));
  // ---- collections ----
  await p.click('[data-act="tab"][data-v="records"]'); await p.waitForTimeout(250); await p.click('[data-act="sub"][data-v="delves"]'); await p.waitForTimeout(300); await shot('a6-collection');
  ok(await p.evaluate(() => document.querySelectorAll('[data-act="coll"]').length === 9 && !!document.querySelector('[data-act="export-runs"]')), 'collections list nine sets (2.23: the road to the end), and the run export is still there');
  await tap('[data-act="coll"][data-v="beasts"]'); ok(await p.evaluate(() => /\? \? \?/.test(document.querySelector('#modal').innerText)), 'the bestiary hides what he has not met'); await closeSheet();
  // ---- the house: rain and lights don't break the frame ----
  await p.click('[data-act="tab"][data-v="hearth"]');
  await p.waitForFunction(() => window.__house.inst && window.__house.inst.hero && document.querySelector('.h3-stage.ready'), null, { timeout: 30000 });
  await p.evaluate(() => window.__house.inst.setWeather('rain', true)); await shot('a7-rain', 900);
  console.log(errs.join('\n') || 'no errors');
  ok(!errs.length, 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
