const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file:///home/claude/grindstone/assets/index.html');
  await p.waitForTimeout(400);
  const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: `/home/claude/grindstone/test/shots/${n}.png` }); };
  await shot('01-welcome');
  await p.click('[data-m="again"]'); await p.waitForTimeout(1200); await shot('02-reveal');
  await p.click('[data-m="equip-close"]'); await shot('03-today');
  // complete a few quests
  const ids = await p.$$eval('[data-act="complete"]', els => els.map(e => e.dataset.id));
  for (const id of ids.slice(0, 6)) { await p.click(`[data-act="complete"][data-id="${id}"]`); await p.waitForTimeout(550); if (await p.$('.lvlnum')) { await shot('04-levelup'); await p.click('.dlg [data-m="close"]'); } }
  await shot('05-today-progress'); await p.waitForTimeout(5200);
  await p.click('#fab'); await shot('06-editor');
  await p.click('[data-m="e-type"][data-v="habit"]'); await shot('07-editor-habit');
  await p.click('.scrim', { position: { x: 20, y: 20 } });
  await p.click('[data-tab="hero"]'); await shot('08-hero');
  // give gold + chests to see gear
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('grindstone')); s.gold = 2000; s.chests = 0; localStorage.setItem('grindstone', JSON.stringify(s)); window.onResume(); });
  await p.click('[data-tab="shop"]'); await shot('09-shop');
  for (let i = 0; i < 6; i++) { await p.click('[data-act="buy-chest"][data-k="' + (i % 2 ? 'gilded' : 'iron') + '"]'); await p.waitForTimeout(1100); if (i === 1) await shot('10-reveal-gilded'); await p.click('.dlg [data-m="equip-close"]'); await p.click('[data-tab="shop"]'); }
  await p.click('[data-tab="gear"]'); await shot('11-gear');
  await p.click('[data-tab="hero"]'); await shot('12-hero-geared');
  await p.click('[data-tab="settings"]'); await shot('13-settings');
  await p.click('[data-tab="today"]'); await p.click('[data-act="qmode"][data-v="all"]'); await shot('14-all');
  console.log(errs.length ? errs.join('\n') : 'no JS errors');
  await b.close();
})();
