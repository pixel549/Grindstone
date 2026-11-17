// 2.7 by finger: the room shop, the quest library, quests that rest, quests with no buff, the pixel skin.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s17/';
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
      heraldInfo: () => JSON.stringify({ perm: false, write: false, cals: [] }), askCalendar: () => {}, heraldArm: () => {}, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: true, sig: '', age: -1 }), widgetFrames: (j) => { window.__frames = JSON.parse(j); return true; }, interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  // first run: creator
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(800); await shot('h01-creator');
  await p.click('[data-m="c-set"][data-k="sex"][data-v="m"]'); await p.click('[data-m="c-set"][data-k="hair"][data-v="bald"]'); await p.click('[data-m="c-set"][data-k="beard"][data-v="beard"]'); await p.click('[data-m="c-set"][data-k="extra"][data-v="glasses"]');
  await p.click('[data-m="c-set"][data-k="skin"][data-v="#f3d2b5"]'); await p.click('[data-m="c-set"][data-k="hairColour"][data-v="#4a2f1f"]'); await p.waitForTimeout(900); await shot('h02-creator-jake');
  await p.click('[data-m="c-save"]');
  const clear = async () => { for (let i = 0; i < 12; i++) { await p.waitForTimeout(400); const open = await p.$('#modal:not(.hidden)'); if (!open) return; const html = await p.evaluate(() => document.querySelector('#modal').innerText.slice(0, 80).replace(/\n/g, ' ')); console.log('modal:', html); const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn'); if (c) await c.click().catch(() => {}); else await p.click('#modal .scrim').catch(() => {}); } };
  await clear();
  // a neglected house: lawn 3 weeks, fridge 5 days, dishes piling
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.gs), t = G.today();
    s.homeSeed = { lawn: G.addDays(t, -21), fridge: G.addDays(t, -5), dishes: G.addDays(t, -3), birds: G.addDays(t, -1), aviary: G.addDays(t, -9), laundry: G.addDays(t, -2) };
    s.created = G.addDays(t, -40); s.gold = 500; s.level = 5;
    localStorage.gs = JSON.stringify(s); window.onResume();
  });
  await clear();
  await p.click('[data-act="tab"][data-v="hearth"]');
  await p.waitForFunction(() => window.__house.inst && window.__house.inst.hero && document.querySelector('.h3-stage.ready'), null, { timeout: 30000 });
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const tapSel = async (sel) => { const el = await p.waitForSelector(sel, { timeout: 5000 }); await el.scrollIntoViewIfNeeded(); const bx = await el.boundingBox(); await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.waitForTimeout(350); };
  const save = () => p.evaluate(() => JSON.parse(localStorage.gs));
  ok(await p.evaluate(() => getComputedStyle(document.body).fontFamily.indexOf('Pixelify') >= 0 && document.fonts.check("16px 'Pixelify Sans'")), 'the pixel typeface is loaded and in use');
  // ---- buy a 2 × 2 room by finger
  await p.waitForTimeout(800);
  await tapSel('.h3-ctl button');
  await tapSel('[data-act="b-room"]');
  ok(await p.$('#modal .sheet [data-m="nr-go"]'), 'the room shop opens (and stays open) on a finger tap');
  await tapSel('[data-m="nr-preset"][data-w="1"]');
  await tapSel('[data-m="nr-size"][data-d="w"][data-v="1"]'); await tapSel('[data-m="nr-size"][data-d="d"][data-v="1"]');
  await tapSel('[data-m="nr-purpose"][data-v="store"]');
  const g0 = (await save()).gold, n0 = (await save()).house.rooms.length;
  await tapSel('[data-m="nr-go"]');
  const spot = await p.evaluate(() => { const h = window.__house.inst, c = h.canvas, d = h.dpr || 1; h.cam.x = 5 * 32; h.cam.y = 20 * 32; h.cam.manual = 1e9; return new Promise((res) => setTimeout(() => { const r = c.getBoundingClientRect(); res({ x: r.left + ((5 * 32 + 16) * h.view.k + h.view.ox) / d, y: r.top + ((20 * 32 + 16) * h.view.k + h.view.oy) / d }); }, 300)); });
  await p.touchscreen.tap(spot.x, spot.y); await p.waitForTimeout(500);
  const s1 = await save(), nr = s1.house.rooms[s1.house.rooms.length - 1];
  ok(s1.house.rooms.length === n0 + 1 && nr.x1 - nr.x0 + 1 === 2 && nr.y1 - nr.y0 - 2 === 2 && nr.purpose === 'store', 'a 2 × 2 storeroom is built: ' + JSON.stringify(nr));
  ok(g0 - s1.gold === 30, 'for 30 gold (10 + 5 a tile): ' + (g0 - s1.gold));
  ok(s1.house.doors.some((d) => d[0] >= nr.x0 && d[0] <= nr.x1 && d[1] >= nr.y0 && d[1] <= nr.y1), 'with a door already in one of its walls');
  ok(/Bought: 2 × 2 storeroom/.test(await p.evaluate(() => document.querySelector('.bld-msg').innerText)), 'and the bar says so');
  await shot('v01-room-bought');
  await tapSel('[data-act="b-done"]');
  // ---- the library
  await tapSel('[data-act="tab"][data-v="quests"]');
  await tapSel('#fab'); await tapSel('[data-m="lib-open"]');
  await tapSel('[data-m="lib-cat"][data-v="deep"]');
  await shot('v02-library');
  const key = 'deep|Clean the oven';
  await tapSel(`[data-m="lib-add"][data-k="${key}"]`);
  let q = (await save()).quests.find((x) => x.name === 'Clean the oven');
  ok(q && q.type === 'habit' && q.rest === 90 && q.diff === 4, 'Clean the oven added as a quarterly habit: ' + JSON.stringify(q && [q.type, q.rest, q.diff]));
  await tapSel('[data-m="lib-hide"][data-k="deep|Clean the windows"]');
  ok((await save()).libHidden.indexOf('Clean the windows') >= 0 && !(await p.$('[data-m="lib-add"][data-k="deep|Clean the windows"]')), 'Clean the windows hidden');
  await tapSel('.sheet .btns [data-m="close"]');
  // ---- do it: it rests
  await tapSel(`.row:has-text("Clean the oven") [data-act="complete"]`);
  await p.waitForTimeout(600);
  for (let i = 0; i < 6; i++) { const m = await p.$('#modal:not(.hidden) .btn'); if (!m) break; await m.click().catch(() => {}); await p.waitForTimeout(400); }
  ok(await p.evaluate(() => { const s = JSON.parse(localStorage.gs), q = s.quests.find((x) => x.name === 'Clean the oven'); return G.restLeft(q, G.addDays(G.today(), 1)) === 89 && !G.canComplete(q, G.addDays(G.today(), 30)) && G.canComplete(q, G.addDays(G.today(), 90)); }), 'done today, it rests 90 days and then comes round again');
  // tomorrow it's under Resting
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs), q = s.quests.find((x) => x.name === 'Clean the oven'); q.countOn = G.addDays(G.today(), -1); localStorage.gs = JSON.stringify(s); window.onResume(); });
  await p.waitForTimeout(500);
  for (let i = 0; i < 6; i++) { const m = await p.$('#modal:not(.hidden) .btn'); if (!m) break; await m.click().catch(() => {}); await p.waitForTimeout(400); }
  ok(await p.evaluate(() => !document.querySelector('.resting') && /1 resting/.test(document.querySelector('.fold').innerText)), 'the day after it is off the list: the fold says one is resting');
  await tapSel('[data-act="fold-done"]');
  ok(await p.evaluate(() => !!document.querySelector('.resting') && /Clean the oven · 89d/.test(document.querySelector('.resting').innerText)), 'opened, the fold shows it with 89 days to go');
  await shot('v03-today');
  // ---- buffs: small and often-repeated deeds give none by default; anything can be set to none
  ok(await p.evaluate(() => { const s = JSON.parse(localStorage.gs), f = (n) => G.questBuff(s.quests.find((x) => x.name === n), 'DIS', s.quests.find((x) => x.name === n).diff - 1).type; return f('Drink enough water') === null && f('Log my meals') === null && f('Swim') === 'sure' && f('Mow the lawn') === 'sure' && f('Study') === 'keen'; }), 'water and meal-logging give no buff; a swim, the lawn and study still do');
  ok(await p.evaluate(() => { const s = JSON.parse(localStorage.gs); return ['Study', 'Swim', 'Strength training', 'Do the dishes', 'Feed the birds'].every((n) => s.quests.some((q) => q.name === n)) && !s.quests.some((q) => /Cert IV/.test(q.name)); }), 'starter quests have their plainer names');
  // an old save is renamed, and the old wording stays as an alias for the herald
  ok(await p.evaluate(() => { const s = JSON.parse(localStorage.gs); const q = s.quests.find((x) => x.name === 'Study'); q.name = 'Cert IV study block'; q.aliases = ['cert iv']; delete s.namesV; const n = G.normalize(s, G.today()), r = n.quests.find((x) => x.id === q.id); return r.name === 'Study' && r.aliases.indexOf('cert iv study block') >= 0 && r.aliases.indexOf('cert iv') >= 0; }), 'an old save’s “Cert IV study block” becomes “Study”, old name kept as an alias');
  // ---- settings: the widget's status is on show
  await tapSel('[data-act="tab"][data-v="records"]');
  await p.evaluate(() => { const b = [...document.querySelectorAll('[data-act="sub"]')].find((x) => /settings/i.test(x.innerText)); if (b) b.click(); });
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => !/Home-screen widget/i.test(document.querySelector('#main').innerText) && !document.querySelector('[data-act="widget-now"]')), '2.9: the hearth widget is shelved, so Settings no longer mentions it');
  // strangers at the gate
  const wd = await p.evaluate(() => { const s = G.normalize(null, G.today()); s.level = 9; s.gold = 130; s.house = Object.assign(s.house || {}, { rooms: [{ purpose: 'store', x0: 0, y0: 0, x1: 2, y1: 2 }, { purpose: 'lounge', x0: 0, y0: 4, x1: 3, y1: 7 }] }); const a = G.wanderersCheck(s), again = G.wanderersCheck(s); const e1 = G.npcInvite(s, 'w-bard'), e2 = G.npcInvite(s, 'w-pedlar');
    return { came: a.map((n) => n.id), again: again.length, names: new Set(s.npcs.map((n) => n.name).concat([s.hero.name])).size === s.npcs.length + 1, e1: e1, e2: e2, gold: s.gold, st: s.npcs.find((n) => n.id === 'w-pedlar').status, next: G.wandererNext(s)[1], digits: getComputedStyle(document.body).fontFamily }; });
  ok(wd.came.join() === 'w-pedlar,w-bard' && wd.again === 0 && wd.names, 'two strangers have turned up by level 9 (2.23: they come over fifty levels now), once each, with names of their own: ' + JSON.stringify(wd.came));
  ok(/more gold/.test(wd.e1) && wd.e2 === null && wd.gold === 10 && wd.st === 'resident' && wd.next === 10, 'the pedlar moves in for 120 gold, the bard waits for the money, the next is due at level 10');
  ok(await p.evaluate(() => { const c = document.createElement('canvas').getContext('2d'); c.font = "500 40px 'Pixelify Sans'"; const five = c.measureText('5').width; c.font = '500 40px monospace'; return document.fonts.check("500 16px 'Pixelify Sans'", '5') && five > 0; }), 'digits have their own face loaded');
  await shot('v04-settings');
  console.log(errs.join('\n') || 'no errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
})();
