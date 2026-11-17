const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT = '/home/claude/grindstone/test/s4/';
require('fs').mkdirSync(OUT, { recursive: true });
const hourArg = process.argv[2] || '14';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.clock.setFixedTime(new Date(`2026-11-07T${hourArg}:10:00`));
  await p.goto('file:///home/claude/grindstone/assets/index.html');
  await p.waitForTimeout(400);
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + hourArg + '-' + n + '.png' }); };
  const stage = async (n, ms = 2600) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + hourArg + '-' + n + '.png', clip: { x: 0, y: 96, width: 393, height: 292 } }); };
  await p.click('[data-m="c-save"]'); await p.click('[data-m="again"]'); await p.waitForTimeout(1200); await p.click('[data-m="equip-close"]');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('grindstone')); s.gold = 9000; s.level = 15; localStorage.setItem('grindstone', JSON.stringify(s)); window.onResume(); });
  await p.click('[data-tab="shop"]'); await p.$eval('#main', el => el.scrollTop = 560); await shot('01-shop');
  for (const k of ['telescope', 'firepit', 'armchair', 'guitar', 'arcade', 'neon', 'portrait', 'map', 'mountedfish', 'fishtank', 'record']) {
    await p.click(`[data-act="decor-info"][data-k="${k}"]`); await p.waitForTimeout(250);
    if (k === 'telescope') await shot('02-info');
    await p.click('[data-m="d-buy"]'); await p.waitForTimeout(250);
    if (await p.$('#modal:not(.hidden) .sheet')) await p.click('.scrim', { position: { x: 20, y: 20 } });
  }
  // earn every milestone
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('grindstone')); Object.assign(s.homeTally.counts, { lawn: 5, fridge: 8, _train: 20, _study: 15 }); s.claimed = 1; s.bestStreak = 7; s.chestsOpened = 10; localStorage.setItem('grindstone', JSON.stringify(s)); window.onResume(); });
  await p.click('[data-tab="home"]');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('grindstone')); localStorage.setItem('grindstone', JSON.stringify(s)); });
  // trigger a save so unlocks fire
  await p.click('[data-act="decorate"]'); await p.click('.scrim', { position: { x: 20, y: 20 } });
  await p.evaluate(() => { document.querySelector('[data-act="room"][data-k="yard"]').click(); });
  await p.waitForTimeout(400);
  // any save() call: toggle nothing -> use rename via creator save
  await p.click('[data-tab="settings"]'); await p.click('[data-act="creator"]'); await p.click('[data-m="c-save"]');
  await shot('03-unlock', 1300);
  for (let i = 0; i < 9; i++) { if (await p.$('.dlg [data-m="close"]')) { await p.click('.dlg [data-m="close"]'); await p.waitForTimeout(500); } }
  await p.click('[data-tab="home"]');
  await p.click('[data-act="decorate"]'); await shot('04-decorate', 500);
  await p.click('[data-m="d-slot"][data-s="yardA"]'); await shot('05-slot', 500);
  await p.click('.scrim', { position: { x: 20, y: 20 } });
  const placed = await p.evaluate(() => JSON.parse(localStorage.getItem('grindstone')).decor);
  console.log(JSON.stringify(placed));
  for (const sk of ['yardA', 'yardB', 'loungeF', 'studyF', 'gymF', 'loungeW']) {
    const has = await p.evaluate((sk) => !!document.querySelector('#h-dc-' + sk), sk);
    if (!has) continue;
    await p.evaluate((sk) => { const a = 'd:' + sk; Home._go(a, true); }, sk);
    await stage('06-act-' + sk);
  }
  await p.evaluate(() => Home.focus('bedroom')); await stage('07-bedroom', 1500);
  await p.evaluate(() => Home.focus('study')); await stage('07-study', 1500);
  await p.click('[data-tab="shop"]'); await p.$eval('#main', el => el.scrollTop = 560); await shot('08-shop-after');
  console.log(errs.length ? errs.join('\n') : 'no JS errors');
  await b.close();
})();
