const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT = '/home/claude/grindstone/test/s2/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  await p.goto('file:///home/claude/grindstone/assets/index.html');
  await shot('01-creator', 600);
  await p.click('[data-m="c-random"]'); await p.click('[data-m="c-save"]');
  await shot('02-welcome');
  await p.click('[data-m="again"]'); await p.waitForTimeout(1200); await shot('03-reveal');
  await p.click('[data-m="equip-close"]'); await shot('04-home-fresh', 1500);
  // neglected household
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('grindstone'));
    const t = G.today();
    s.created = G.addDays(t, -30);
    s.homeSeed = { lawn: G.addDays(t, -25), fridge: G.addDays(t, -14), dishes: G.addDays(t, -5), laundry: G.addDays(t, -12), aviary: G.addDays(t, -16), birds: G.addDays(t, -3), gym: G.addDays(t, -10), study: G.addDays(t, -9) };
    localStorage.setItem('grindstone', JSON.stringify(s)); window.onResume();
  });
  await p.waitForTimeout(300);
  const acts = [['chill', 'yard'], ['birds', 'aviary'], ['fridge', 'kitchen'], ['laundry', 'bedroom'], ['lift', 'gym'], ['desk', 'study']];
  for (const [a, room] of acts) {
    await p.evaluate(([a]) => { Home._go(a, true); }, [a]);
    await p.waitForTimeout(2500);
    await shot('05-neglect-' + a, 0);
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.$eval('#main', el => el.scrollTop = 400); await shot('06-household');
  await p.$eval('#main', el => el.scrollTop = 0);
  await p.click('[data-act="feature"][data-k="lawn"]'); await shot('07-feature-lawn', 700);
  await p.click('.scrim', { position: { x: 20, y: 20 } });
  // thriving household
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('grindstone'));
    const t = G.today();
    s.homeSeed = {}; s.level = 26; s.homeTally.counts.reno = 27;
    s.quests.forEach(q => { if (q.home && q.home !== 'reno') { if (q.type === 'habit') { q.count = 1; q.countOn = t; } else q.doneOn = t; } });
    s.lastTraining = t;
    localStorage.setItem('grindstone', JSON.stringify(s)); window.onResume();
  });
  for (const [a] of [['cook'], ['couch'], ['lawn'], ['bed']]) {
    await p.evaluate(([a]) => { Home._go(a, true); }, [a]);
    await p.waitForTimeout(2500);
    await shot('08-good-' + a, 0);
  }
  await p.click('[data-tab="hero"]'); await shot('09-hero', 600);
  // give gear and view item
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('grindstone')); s.gold = 3000; localStorage.setItem('grindstone', JSON.stringify(s)); window.onResume(); });
  await p.click('[data-tab="shop"]');
  for (let i = 0; i < 5; i++) { await p.click('[data-act="buy-chest"][data-k="gilded"]'); await p.waitForTimeout(1100); await p.click('.dlg [data-m="equip-close"]'); await p.click('[data-tab="shop"]'); }
  await p.click('[data-tab="hero"]'); await shot('10-hero-geared', 600);
  const it = await p.$('[data-act="item"]'); if (it) { await it.click(); await shot('11-item', 500); await p.click('.scrim', { position: { x: 20, y: 20 } }); }
  await p.click('[data-act="creator"]'); await shot('12-creator-edit', 500); await p.click('.scrim', { position: { x: 20, y: 20 } });
  await p.click('[data-tab="today"]'); await p.click('#fab'); await p.$eval('.sheet', el => el.scrollTop = 900); await shot('13-editor-home', 400);
  console.log(errs.length ? errs.join('\n') : 'no JS errors');
  await b.close();
})();
