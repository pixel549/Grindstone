// A storyboard for the cold-viewer check: a whole run watched with the log hidden (tap the scene), frames saved
// every ~2 s, and the log saved separately as the answer key.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/home/claude/grindstone/test/story/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 411, height: 891 }, deviceScaleFactor: 2 });
  await p.addInitScript(() => { window.Native = { load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.6', canNotify: () => true, askNotify: () => {}, hasOracleKey: () => false, heraldInfo: () => '{}', widgetInfo: () => '{}', interpInfo: () => '{}' }; });
  await p.goto('http://localhost:8765/index.html');
  await p.click('[data-m="c-save"]'); await p.click('[data-m="pet-save"]');  /* 2.26: the pets step */
  await p.click('[data-m="again"]'); await p.waitForTimeout(800); await p.click('[data-m="equip-close"]');
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(400); const c = await p.$('#modal:not(.hidden) .band [data-m="close"], #modal:not(.hidden) .dlg [data-m="close"]'); if (!c) break; await c.click(); }
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.gs);
    ['STR', 'END', 'VIT', 'DIS', 'INT'].forEach((k) => { s.stats[k] = 300; });
    s.level = 9; s.welcomed = true; s.town = { open: true }; s.delve.n = 2; s.delve.orders.potion = { m: 'below', p: 50 }; s.delve.orders.ev = { 2: { c0: 'equip', f0: 'drink', k0: 'a' } };
    const c = s.npcs.find((n) => n.comp === 'fighter'); c.status = 'resident'; c.joined = '2026-10-01'; s.delve.comp = c.id;
    localStorage.gs = JSON.stringify(s); window.onResume();
  });
  await p.click('[data-act="tab"][data-v="delve"]'); await p.waitForTimeout(500);
  
  await p.click('[data-act="delve-go"]'); await p.waitForTimeout(600);
  await p.click('.rp-scene'); // just watch
  let f = 0;
  for (let i = 0; i < 70; i++) {
    await p.waitForTimeout(1800);
    await p.screenshot({ path: OUT + 's' + String(f++).padStart(2, '0') + '.png', clip: { x: 0, y: 0, width: 411, height: 700 } });
    if (await p.$('[data-m="run-pick"]')) { await p.click('[data-m="run-pick"]'); continue; }
    if (await p.$('[data-m="run-done"]')) break;
  }
  const key = await p.evaluate(() => { const s = JSON.parse(localStorage.gs); return { log: (s.delve.last.log || []).map((l) => l.s), res: s.delve.last.res }; });
  fs.writeFileSync(OUT + 'answer-key.json', JSON.stringify(key, null, 1));
  console.log('frames', f, 'result', key.res, 'lines', key.log.length);
  await b.close();
})();
