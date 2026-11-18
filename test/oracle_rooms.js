// The Oracle's separate chambers: unlocks, prerequisites, six-tier upgrades and no edits to the Hearth layout.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/oracle-rooms/';
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
      widgetInfo: () => JSON.stringify({ placed: false }), widgetFrames: () => true, interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const clear = async () => { for (let i = 0; i < 10; i++) { await p.waitForTimeout(350); const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn[data-m="close"]'); if (!c) break; await c.click().catch(() => {}); } };
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  await p.waitForSelector('[data-m="c-save"]', { timeout: 30000 });
  await p.click('[data-m="c-save"]');
  await p.waitForTimeout(500);
  await p.click('[data-m="pet-save"]').catch(() => {});
  await p.waitForTimeout(500);
  await p.click('[data-m="again"]').catch(() => {});
  await p.waitForTimeout(700);
  await p.click('[data-m="equip-close"]').catch(() => {});
  await clear();
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.gs);
    s.gold = 25000; s.level = 50;
    G.STATS.forEach((k) => { s.stats[k] = 1500; });
    localStorage.gs = JSON.stringify(s); window.onResume();
  });
  await p.click('[data-act="tab"][data-v="hearth"]');
  await p.waitForSelector('#h3slot.ready', { timeout: 180000 });
  ok(!!(await p.$('.oracle-entry')), 'Hearth has an entrance to the Oracle’s chambers');
  const roomCount = await p.evaluate(() => JSON.parse(localStorage.gs).house.rooms.length);
  await p.click('.oracle-entry');
  ok((await p.$('.or-room-tab')).length === 4, 'four distinct chambers are shown');
  ok(!!(await p.$('.oracle-scene.oracleSanctum')), 'the Sanctum has its own room scene');
  await p.click('[data-m="oracle-room-select"][data-k="oracleArchive"]');
  ok(await p.$eval('[data-m="oracle-room-buy"]', el => el.disabled), 'the Archive stays locked until the Sanctum exists');
  ok(/Needs the sanctum first/i.test(await p.$eval('.or-req', el => el.textContent)), 'the Archive explains its prerequisite');
  await p.click('[data-m="oracle-room-select"][data-k="oracleSanctum"]');
  await p.click('[data-m="oracle-room-buy"]');
  await p.waitForTimeout(250);
  let state = await p.evaluate(() => JSON.parse(localStorage.gs));
  ok(state.estate.wings.oracleSanctum && state.estate.tiers.oracleSanctum === 0, 'the Sanctum can be built and persists as estate progress');
  ok(state.house.rooms.length === roomCount, 'Oracle chambers do not alter the editable Hearth rooms');
  await p.click('[data-m="oracle-room-select"][data-k="oracleArchive"]');
  await p.click('[data-m="oracle-room-buy"]');
  await p.waitForTimeout(250);
  state = await p.evaluate(() => JSON.parse(localStorage.gs));
  ok(state.estate.wings.oracleArchive, 'the Archive unlocks after the Sanctum');
  await p.click('[data-m="oracle-room-select"][data-k="oracleObservatory"]');
  await p.click('[data-m="oracle-room-buy"]');
  await p.waitForTimeout(250);
  state = await p.evaluate(() => JSON.parse(localStorage.gs));
  ok(state.estate.wings.oracleObservatory, 'the Observatory unlocks after the Archive');
  await p.click('[data-m="oracle-room-select"][data-k="oracleReliquary"]');
  await p.click('[data-m="oracle-room-buy"]');
  await p.waitForTimeout(250);
  state = await p.evaluate(() => JSON.parse(localStorage.gs));
  ok(state.estate.wings.oracleReliquary, 'the Reliquary unlocks after the Sanctum');
  await p.click('[data-m="oracle-room-select"][data-k="oracleSanctum"]');
  await p.click('[data-m="oracle-room-preview"][data-v="1"]');
  ok(!!(await p.$('.oracle-scene.oracleSanctum.oracle-tier-1')), 'tier preview changes the Sanctum’s visual state');
  await p.click('[data-m="oracle-room-buy"]');
  await p.waitForTimeout(250);
  state = await p.evaluate(() => JSON.parse(localStorage.gs));
  ok(state.estate.tiers.oracleSanctum === 1, 'upgrading a chamber advances its tier');
  ok(!!(await p.$('[data-m="oracle-sanctum-talk"]')), 'the altar still opens the Oracle conversation');
  console.log(errs.length ? errs.join('\n') : 'no page or console errors');
  await b.close();
})();
