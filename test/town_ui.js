// 2.13: more land and the town, driven by finger taps.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s21/';
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
  const set = async (fn) => { await p.evaluate(fn); await p.evaluate(() => window.onResume()); await p.waitForTimeout(500); };
  const notice = async (re, msg) => { await p.waitForTimeout(900); ok(await p.evaluate((r) => new RegExp(r).test((document.querySelector('#modal:not(.hidden)') || { innerText: '' }).innerText), re), msg); await tap('#modal .btn[data-m="close"]'); };
  await set(() => { const s = JSON.parse(localStorage.gs); s.gold = 500; s.level = 5; s.created = G.addDays(G.today(), -40); G.STATS.forEach((k) => { s.stats[k] = 700; }); delete s.season; localStorage.gs = JSON.stringify(s); });

  // ---- before it opens: the road, and what it takes ----
  await tap('[data-act="tab"][data-v="hearth"]');
  ok(await p.evaluate(() => document.querySelectorAll('#subtabs .sub').length === 2), 'the hearth has Home and Town');
  await tap('#subtabs .sub[data-v="town"]');
  ok(await p.evaluate(() => /road to town/i.test(document.querySelector('#main').innerText) && /Reach level 8/.test(document.querySelector('#main').innerText) && !document.querySelector('[data-act="town"]')), 'the town is shut, and says what opens it');
  await shot('t01-road');
  await tap('[data-act="tab"][data-v="quests"]');
  await tap('[data-act="tab"][data-v="hearth"]');
  ok(await p.evaluate(() => /road to town/i.test(document.querySelector('#main').innerText)), 'the tab remembers the town page');

  // ---- it opens ----
  await set(() => { const s = JSON.parse(localStorage.gs); s.gold = 60000; s.level = 50; s.estate.wings.garden = true; s.estate.tiers.garden = 0; s.npcs.slice(0, 3).forEach((n) => { n.status = 'resident'; }); delete s.season; localStorage.gs = JSON.stringify(s); });
  await p.evaluate(() => { const b = document.querySelector('[data-act="tab"][data-v="quests"]'); b.click(); });
  await notice('ROAD TO TOWN IS OPEN', 'a notice says the road is open');
  await tap('[data-act="tab"][data-v="hearth"]');
  ok(await p.evaluate(() => document.querySelectorAll('[data-act="town"]').length === 11 && /For sale/i.test(document.querySelector('#main').innerText)), 'eleven buildings for sale');
  await p.waitForFunction(() => window.__town && window.__town.inst && window.__town.inst.people.length > 0, null, { timeout: 30000 });
  const townVoices = await p.evaluate(() => {
    const t = window.__town.inst; t.t = 100; t.barkLock = 0;
    t.people.forEach((a) => { a.bub = null; a.barkNext = 0; a.talking = 0; });
    t._update(0.1);
    return { active: t.people.filter((a) => a.bub).length, lock: t.barkLock };
  });
  ok(townVoices.active <= 1 && townVoices.lock > 100, 'town NPCs take turns speaking without overlapping bubbles');
  await shot('t02-forsale');
  await tap('[data-act="town"][data-k="gym"]'); await shot('t03-gym');
  ok(await p.evaluate(() => /Gain 1 Strength/.test(document.querySelector('#modal').innerText) && /\+3% damage/.test(document.querySelector('#modal').innerText)), 'the sheet shows the ladder and the rewards');
  await tap('#modal [data-m="town-buy"]');
  let s = await save();
  ok(s.town.own.gym && s.town.on.indexOf('gym') >= 0 && s.gold === 60000 - 600, 'bought the gym, and it opened');
  await tap('[data-act="town"][data-k="baths"]'); await tap('#modal [data-m="town-buy"]');
  await tap('[data-act="town"][data-k="bank"]'); await tap('#modal [data-m="town-buy"]');
  s = await save();
  ok(s.town.own.bank && s.town.on.length === 2 && s.town.on.indexOf('bank') < 0, 'a third building is bought but stays closed: two places');
  await tap('[data-act="town"][data-k="bank"]');
  ok(await p.evaluate(() => { const b = document.querySelector('#modal [data-m="town-toggle"]'); return b && b.disabled; }), 'cannot open a third while two are open');
  await closeSheet(); await shot('t04-town');

  // ---- growth while open, and a challenge met ----
  const r = await p.evaluate(() => {
    const S0 = JSON.parse(localStorage.gs); G.normalize(S0, G.today()); G.normDelve(S0);
    const q = S0.quests.find((x) => x.stat === 'STR' && !x.archived), t = G.today(), x0 = S0.stats.STR, g0 = S0.gold;
    const c = G.complete(S0, q.id, t, Date.now()), x1 = S0.stats.STR;
    G.undo(S0, q.id, t);
    const qv = S0.quests.find((x) => x.stat === 'INT' && !x.archived), c2 = G.complete(S0, qv.id, t, Date.now());
    return { grow: c.grow, gain: x1 - x0, xp: c.xp, back: S0.stats.STR === x0, other: c2.grow, town: G.inputFor(S0, {}).town };
  });
  ok(r.grow > 0 && r.gain === r.xp + r.grow && r.back && r.other === 0, 'Strength grows faster with the gym open (' + r.xp + ' + ' + r.grow + '), undo takes it back, other stats are untouched');
  await set(() => { const s = JSON.parse(localStorage.gs); s.stats.STR = 5 * 13 * 13; localStorage.gs = JSON.stringify(s); });
  await p.evaluate(() => { document.querySelector('[data-act="tab"][data-v="quests"]').click(); });
  // STR 21 → 23: the first challenge (1) is met, and one point counts toward the second (2)
  await p.evaluate(() => { const q = document.querySelector('.row[data-act="done"], [data-act="done"]'); if (q) q.click(); });
  await p.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) { if (await p.$('#modal:not(.hidden) .btn[data-m="close"]')) { const tx = await p.evaluate(() => document.querySelector('#modal').innerText); if (/CHALLENGE MET/.test(tx)) { ok(/Gym, 1 of 5/.test(tx) && /\+3% damage/.test(tx), 'a card says the gym challenge is met'); } await tap('#modal:not(.hidden) .btn[data-m="close"]'); await p.waitForTimeout(900); } }
  s = await save();
  ok(s.town.tier.gym === 0 && s.town.ready && s.town.ready.gym, 'a met challenge waits for the builders to be paid');
  await tap('[data-act="tab"][data-v="hearth"]'); await tap('[data-act="town"][data-k="gym"]');
  ok(await p.evaluate(() => /Pay the builders/.test(document.querySelector('#modal').innerText) && !!document.querySelector('#modal [data-m="town-pay"]')), 'the gym says what the builders want');
  await tap('#modal [data-m="town-pay"]'); await p.waitForTimeout(400);
  s = await save();
  ok(s.town.tier.gym === 1 && s.town.base.gym === 22, 'tier 1 kept, and the next challenge counts from where the last ended (' + s.town.tier.gym + ', ' + s.town.base.gym + ')');
  ok(await p.evaluate(() => { const S0 = JSON.parse(localStorage.gs); G.normalize(S0, G.today()); G.normDelve(S0); const i = G.inputFor(S0, {}); return i.town.dmg === 3 && /"dmg":3/.test(G.runSig(i)); }), 'the delve gets +3% damage, and the run signature knows');
  await tap('[data-act="tab"][data-v="hearth"]');
  ok(await p.evaluate(() => /Gain 2 Strength: 1\/2/i.test(document.querySelector('#main').innerText) && /Yours for good/i.test(document.querySelector('#main').innerText)), 'the card shows the second challenge part done');
  await shot('t05-progress');
  await tap('[data-act="town"][data-k="gym"]');
  ok(await p.evaluate(() => /throws away 1 of 2/.test(document.querySelector('#modal').innerText)), 'closing warns what is lost');
  await tap('#modal [data-m="town-toggle"]');
  await tap('[data-act="town"][data-k="gym"]'); await tap('#modal [data-m="town-toggle"]');
  s = await save();
  ok(s.town.tier.gym === 1 && s.town.base.gym === 23 && s.town.on.indexOf('gym') >= 0, 'closed and reopened: the reward stays, the count starts again');

  // ---- counts from the delve: only a clear counts ----
  const d = await p.evaluate(() => {
    const S0 = JSON.parse(localStorage.gs); G.normalize(S0, G.today()); G.normDelve(S0);
    S0.town.own.tower = S0.town.own.apothecary = true; S0.town.on = ['tower', 'apothecary']; S0.town.base = { tower: 0, apothecary: 0 };
    G.STATS.forEach((k) => { S0.stats[k] = 5 * 40 * 40; });
    const inp = G.inputFor(S0, {}), out = G.simRun(inp, {}, false), k0 = S0.town.cnt.kills;
    G.applyRun(S0, out, { t: Date.now(), day: G.today(), buffs: inp.buffs });
    const won = (out.stages || []).filter((x) => x[1] === 'won').length;
    return { res: out.res, kills: S0.town.cnt.kills - k0, won: won, drank: out.drank, fl: S0.town.cnt.flasks, heal: G.heroFrom(inp, inp.eq).heal, got: G.townTick(S0).map((x) => x.k + x.tier) };
  });
  ok(d.res === 'clear' && d.kills === d.won && d.kills > 0 && d.fl === d.drank && d.heal === 1.1, 'a clear counts its foes (' + d.kills + ') and flasks (' + d.fl + '); the open apothecary makes flasks heal more');

  // ---- more land ----
  await tap('#subtabs .sub[data-v=""]');
  await p.waitForFunction(() => window.__house.inst && window.__house.inst.hero && document.querySelector('.h3-stage.ready'), null, { timeout: 30000 });
  ok(await p.evaluate(() => !!document.querySelector('[data-act="land"]')), 'More land is listed under Expansions');
  await tap('[data-act="land"]'); await shot('t06-land');
  await tap('#modal [data-m="land-buy"]');
  s = await save();
  ok(s.estate.land === 1 && s.gold < 60000 - 1500, 'bought the paddock next door');
  await p.waitForTimeout(800);
  const w1 = await p.evaluate(() => { const h = window.__house.inst; return { wt: h.geom.wt, ht: h.geom.ht, k24: h.geom.kind(24, 5), far: h.geom.kind(40, 10), out: h.geom.kind(45, 10), stat: h.stat ? h.stat.width : 0 }; });
  ok(w1.wt === 46 && w1.k24 === 'out' && w1.far === 'out' && w1.out === null, 'the world is 46 wide, the old fence line is open ground, and the new fence holds');
  const room = await p.evaluate(() => { const S0 = JSON.parse(localStorage.gs); G.normalize(S0, G.today()); const a = G.roomAdd(S0, 20, 17, 30, 24, {}); const b = G.roomAdd(S0, 40, 3, 46, 10, {}); const n = S0.house.rooms.length; const S1 = JSON.parse(JSON.stringify(S0)); G.normalize(S1, G.today()); if (!a.err) localStorage.gs = JSON.stringify(S0); return { a: a.err || null, b: b.err || null, kept: S1.house.rooms.length === n, lim: G.roomLimit(S0) }; });
  ok(!room.a && /fence/.test(room.b || '') && room.kept && room.lim === 20, 'a room can straddle the old fence line, not the new one, and survives a reload; 20 rooms now');
  await p.evaluate(() => window.onResume()); await p.waitForTimeout(900); await p.evaluate(() => { document.querySelector('#main').scrollTop = 0; const h = window.__house.inst; h.cam.x = 34 * 32; h.cam.y = 14 * 32; h.cam.manual = 30; }); await shot('t07-paddock', 1200);
  await set(() => { const s = JSON.parse(localStorage.gs); s.gold = 120000; s.level = 50; s.town.on = []; s.town.base = {}; localStorage.gs = JSON.stringify(s); });
  for (let i = 0; i < 5; i++) { await tap('[data-act="land"]'); await tap('#modal [data-m="land-buy"]'); await p.waitForTimeout(500); }
  s = await save();
  ok(s.estate.land === 6, 'all six lots bought');
  const w6 = await p.evaluate(() => { const h = window.__house.inst; const t0 = performance.now(); let n = 0; return new Promise((res) => { const f = () => { n++; if (performance.now() - t0 > 1500) res({ wt: h.geom.wt, ht: h.geom.ht, fps: Math.round(n / 1.5), scenery: h.objs.filter((o) => o.scenery).length, stat: h.stat ? [h.stat.width, h.stat.height] : null }); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); });
  ok(w6.wt === 70 && w6.ht === 63 && w6.scenery > 20 && w6.stat && w6.stat[0] === 70 * 32, 'the whole estate: 70 × 63 tiles, with trees on it (' + w6.scenery + ' bits of scenery, ' + w6.fps + ' fps here)');
  await tap('[data-act="land"]');
  ok(await p.evaluate(() => /all yours/i.test(document.querySelector('#modal').innerText) && !document.querySelector('#modal [data-m="land-buy"]')), 'nothing left to buy');
  await closeSheet();
  await p.evaluate(() => { document.querySelector('#main').scrollTop = 0; const h = window.__house.inst; h.cam.x = 60 * 32; h.cam.y = 50 * 32; h.cam.manual = 30; }); await shot('t08-estate-far', 1200);
  await p.evaluate(() => { const h = window.__house.inst; if (h.setZoom) h.setZoom(0); h.cam.x = 20 * 32; h.cam.y = 12 * 32; h.cam.manual = 30; }); await shot('t09-estate-home', 1200);
  const z = await p.evaluate(() => { const h = window.__house.inst; h.setZoom(0); const seq = []; for (let i = 0; i < 5; i++) seq.push(h.zoom()); return { seq: seq, fit: h._fitK() }; });
  ok(z.seq.indexOf(-1) >= 0 && z.seq[z.seq.indexOf(-1) + 1] === 0 && z.fit < 1, 'the zoom button has a step that shows the whole estate (' + z.seq.join(',') + ')');
  await p.evaluate(() => { const h = window.__house.inst; h.setZoom(0); while (h.zoom() !== -1) { /* out to the lot */ } }); await shot('t10-estate-whole', 1200);
  await tap('[data-act="h3-zoom"]');
  ok(await p.evaluate(() => window.__house.inst.fit === false), 'tapping zoom again comes back in');
  console.log(errs.join('\n') || 'no errors');
  ok(!errs.length, 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
