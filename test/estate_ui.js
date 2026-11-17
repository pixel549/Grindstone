// The estate shop: list, the tier sheet, preview in the hearth, buying, expansions, and the feature-sheet link.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s10/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '1.7', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {},
      heraldInfo: () => JSON.stringify({ perm: false, write: false, cals: [] }), askCalendar: () => {}, heraldArm: () => {}, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: false }), widgetFrames: () => true,
      interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 450) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  const clear = async () => { for (let i = 0; i < 8; i++) { await p.waitForTimeout(600); const c = await p.$('#modal:not(.hidden) .band [data-m="close"], #modal:not(.hidden) .dlg [data-m="close"]'); if (!c) break; await c.click(); } };
  const st = () => p.evaluate(() => { const s = JSON.parse(localStorage.gs); return { gold: s.gold, level: s.level, estate: s.estate }; });
  await p.click('[data-m="c-save"]'); await p.click('[data-m="pet-save"]');  /* 2.26: the pets step */
  await p.click('[data-m="again"]'); await p.waitForTimeout(1200); await p.click('[data-m="equip-close"]'); await clear();
  // an old save with a decorated house comes in shabby; give him money and levels to spend
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.gold = 1500; s.level = 5; G.STATS.forEach((k) => { s.stats[k] = Math.max(s.stats[k] | 0, 300); }); localStorage.gs = JSON.stringify(s); window.onResume(); });
  console.log('start:', JSON.stringify(await st()));
  await p.click('[data-act="tab"][data-v="hearth"]');
  await p.waitForSelector('#h3slot.ready', { timeout: 180000 });
  await shot('01-hearth-shabby', 2500);
  // estate now lives on the Hearth page itself
  await p.waitForSelector('#h3slot.ready', { timeout: 60000 });
  await shot('02-estate-top', 1500);
  await p.evaluate(() => document.querySelector('[data-act="estate"][data-k="fridge"]').scrollIntoView({ block: 'center' }));
  await shot('03-estate-list');
  await p.click('[data-act="estate"][data-k="fridge"]'); await shot('04-fridge-sheet');
  // try the diamond fridge on
  await p.click('.tl[data-v="5"]');
  await p.waitForFunction(() => window.__house.inst && window.__house.inst.preview && window.__house.inst.preview.tier === 5, null, { timeout: 60000 });
  await shot('05-preview-diamond', 3000);
  await p.click('[data-act="pv-step"][data-v="-1"]'); await p.click('[data-act="pv-step"][data-v="-1"]'); await p.click('[data-act="pv-step"][data-v="-1"]'); await p.click('[data-act="pv-step"][data-v="-1"]');
  await p.waitForFunction(() => window.__house.inst.preview && window.__house.inst.preview.tier === 1, null, { timeout: 60000 });
  await shot('06-preview-next', 2500);
  await p.click('.h3-prev [data-act="estate-buy"]');
  await p.waitForTimeout(800);
  console.log('bought fridge:', JSON.stringify(await st()), 'toast:', await p.evaluate(() => (document.querySelector('#toast') || {}).textContent));
  console.log('3d fridge tier:', await p.evaluate(() => window.__house.inst.tier('fridge')), 'preview:', await p.evaluate(() => window.__house.inst.preview));
  await shot('07-bought', 2500);
  // buy a few more from the list; build the shed and the garage
  for (const k of ['walls', 'floors', 'bed', 'couch', 'yard']) {
    await p.evaluate((k) => document.querySelector('[data-act="estate"][data-k="' + k + '"]').scrollIntoView({ block: 'center' }), k);
    await p.click('[data-act="estate"][data-k="' + k + '"]'); await p.waitForTimeout(250);
    await p.click('#modal [data-m="estate-buy"]'); await p.waitForTimeout(400);
  }
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.gold += 900; localStorage.gs = JSON.stringify(s); window.onResume(); });
  for (const k of ['shed', 'garage']) {
    await p.evaluate((k) => document.querySelector('[data-act="estate"][data-k="' + k + '"]').scrollIntoView({ block: 'center' }), k);
    await p.click('[data-act="estate"][data-k="' + k + '"]'); await p.waitForTimeout(250);
    await shot('08-sheet-' + k);
    await p.click('#modal [data-m="estate-buy"]'); await p.waitForTimeout(400);
  }
  console.log('after spree:', JSON.stringify(await st()));
  console.log('3d:', await p.evaluate(() => { const h = window.__house.inst; return JSON.stringify({ wings: h.wings, garage: h.tier('garage'), lot: h.tier('garden') }); }));
  await p.evaluate(() => { document.querySelector('#main').scrollTop = 0; });
  await shot('09-estate-after', 3500);
  // a locked one (needs the garden), and the pool is above his level
  await p.evaluate(() => document.querySelector('[data-act="estate"][data-k="tower"]').scrollIntoView({ block: 'center' }));
  await shot('10-wings-list');
  await p.click('[data-act="estate"][data-k="tower"]'); await shot('11-tower-sheet');
  await p.click('#modal [data-m="estate-pv"]');
  await p.waitForFunction(() => window.__house.inst.preview && window.__house.inst.preview.key === 'tower', null, { timeout: 60000 });
  await shot('12-tower-preview', 3000);
  await p.click('[data-act="pv-done"]'); await p.waitForTimeout(600);
  console.log('after done: sheet', await p.evaluate(() => !!document.querySelector('#modal .tladder')), 'preview', await p.evaluate(() => window.__house.inst.preview));
  await p.click('.scrim', { position: { x: 20, y: 20 } });
  // the deeds record shows the spending
  await p.click('[data-act="tab"][data-v="records"]'); await p.click('[data-act="sub"][data-v="deeds"]');
  await shot('14-deeds');
  // leaving mid-preview ends it
  await p.click('[data-act="tab"][data-v="hearth"]'); await p.waitForTimeout(500);
  await p.click('[data-act="estate"][data-k="desk"]'); await p.click('.tl[data-v="4"]');
  await p.waitForFunction(() => window.__house.inst.preview, null, { timeout: 60000 });
  await p.click('[data-act="tab"][data-v="quests"]'); await p.waitForTimeout(600);
  console.log('left mid-preview:', await p.evaluate(() => JSON.stringify({ house: window.__house.inst.preview, ui: !!document.querySelector('.h3-prev') })));
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
