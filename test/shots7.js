// The 3D Hearth inside the app: first run, a lived-in save, taps, class change.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT = '/home/claude/grindstone/test/s7/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.clock.setFixedTime(new Date('2026-11-07T19:10:00'));
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 450) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  const clear = async () => { for (let i = 0; i < 8; i++) { await p.waitForTimeout(700); const c = await p.$('#modal:not(.hidden) .band [data-m="close"], #modal:not(.hidden) .dlg [data-m="close"]'); if (!c) break; await c.click(); } };
  await p.click('[data-m="c-set"][data-k="cls"][data-v="barbarian"]');
  await shot('01-creator');
  await p.click('[data-m="c-save"]');
  await p.click('[data-m="again"]'); await p.waitForTimeout(1300);
  await p.click('[data-m="equip-close"]'); await clear();
  // lived-in, slightly neglected save
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('grindstone')); const t = G.today();
    s.created = G.addDays(t, -40);
    s.homeSeed = { lawn: G.addDays(t, -18), fridge: G.addDays(t, -9), laundry: G.addDays(t, -2), aviary: G.addDays(t, -3), dishes: G.addDays(t, -3), birds: t };
    s.lastTraining = G.addDays(t, -1);
    s.homeTally.counts.reno = 17;
    s.decor.owned.push('weaponrack', 'firepit', 'starchart', 'banner', 'fishtank');
    s.decor.placed = { loungeF: 'plant', gymW: 'weaponrack', yardB: 'firepit', studyW: 'starchart', loungeW: 'banner', studyF: 'fishtank' };
    for (let i = 0; i < 6; i++) s.inv.push(G.rollItem(s, 2));
    const w = s.inv.find((x) => x.slot === 'weapon'), h = s.inv.find((x) => x.slot === 'head'), bd = s.inv.find((x) => x.slot === 'body');
    if (w) s.eq.weapon = w.id; if (h) s.eq.head = h.id; if (bd) s.eq.body = bd.id;
    localStorage.setItem('grindstone', JSON.stringify(s)); window.onResume();
  });
  await clear();
  const t0 = Date.now();
  await p.click('[data-act="tab"][data-v="hearth"]');
  await p.waitForSelector('#h3slot.ready', { timeout: 180000 });
  console.log('hearth ready in', Date.now() - t0, 'ms');
  await shot('02-hearth', 3500);
  console.log('state', await p.evaluate(() => JSON.stringify(window.__house.inst.S)));
  await p.evaluate(() => { document.getElementById('main').scrollTop = 600; }); await shot('03-hearth-list');
  await p.evaluate(() => { document.getElementById('main').scrollTop = 0; });
  // tap the fridge in 3D
  const pt = await p.evaluate(() => {
    const h = window.__house.inst, c = h.renderer.domElement.getBoundingClientRect();
    const v = h.cam.position.clone(); v.set(6.75, 1.4, 1.6); v.project(h.cam);
    return { x: c.left + (v.x + 1) / 2 * c.width, y: c.top + (1 - v.y) / 2 * c.height };
  });
  await p.mouse.click(pt.x, pt.y); await shot('04-tap-fridge', 700);
  await p.click('.scrim', { position: { x: 20, y: 20 } });
  // leave and return: same instance, still alive
  await p.click('[data-act="tab"][data-v="status"]'); await p.waitForTimeout(300);
  const active = await p.evaluate(() => window.__house.inst.active);
  await p.click('[data-act="tab"][data-v="hearth"]');
  console.log('inactive while away:', !active, 'active again:', await p.evaluate(() => window.__house.inst.active), 'canvases:', await p.$$eval('canvas', (c) => c.length));
  await p.click('[data-act="h3-rot"][data-v="1"]'); await shot('05-rotated', 1500);
  // change form to a mage
  await p.click('[data-act="tab"][data-v="records"]'); await p.click('[data-act="sub"][data-v="settings"]');
  await p.click('[data-act="creator"]'); await p.click('[data-m="c-set"][data-k="cls"][data-v="mage"]'); await p.click('[data-m="c-save"]');
  await p.click('[data-act="tab"][data-v="hearth"]');
  await p.waitForFunction(() => window.__house.inst.hero && window.__house.inst.hero.cls === 'mage', null, { timeout: 60000 });
  await p.evaluate(() => { const h = window.__house.inst; h.view.azT = 45 * Math.PI / 180; h.view.zoomT = 2.2; h.hold('couch'); h.view.tx = -5; h.view.tz = 2.5; });
  await shot('06-mage', 2500);
  // quest done in the hearth sheet → cheer
  await p.evaluate(() => window.__house.inst.hold(null));
  await p.click('.cond[data-k="lawn"]'); await p.waitForTimeout(400);
  const done = await p.$('[data-m="f-complete"]'); if (done) { await done.click(); await p.waitForTimeout(600); await clear(); }
  await p.waitForTimeout(800);
  console.log('after mowing:', await p.evaluate(() => JSON.stringify({ lawn: window.__house.inst.S.lawn, mode: window.__house.inst.hero.mode, anim: window.__house.inst.hero.curName })));
  await shot('07-after-mow', 1500);
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
