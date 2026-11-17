const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT = '/home/claude/grindstone/test/s3/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await p.clock.setFixedTime(new Date('2026-11-07T13:10:00'));
  await p.goto('file:///home/claude/grindstone/assets/index.html');
  await p.waitForTimeout(400);
  await p.click('[data-m="c-save"]'); await p.click('[data-m="again"]'); await p.waitForTimeout(1200); await p.click('[data-m="equip-close"]');
  const setState = (fn) => p.evaluate(fn);
  const crop = async (n) => { await p.waitForTimeout(2600); await p.screenshot({ path: OUT + n + '.png', clip: { x: 0, y: 96, width: 393, height: 292 } }); };
  // neglected, day
  await setState(() => { const s = JSON.parse(localStorage.getItem('grindstone')); const t = G.today(); s.created = G.addDays(t, -30);
    s.homeSeed = { lawn: G.addDays(t, -25), fridge: G.addDays(t, -14), dishes: G.addDays(t, -5), laundry: G.addDays(t, -12), aviary: G.addDays(t, -16), birds: G.addDays(t, -3) };
    localStorage.setItem('grindstone', JSON.stringify(s)); window.onResume(); });
  for (const a of ['sink', 'couch', 'reno', 'birds']) { await p.evaluate((a) => Home._go(a, true), a); await crop('bad-' + a); }
  // thriving
  await setState(() => { const s = JSON.parse(localStorage.getItem('grindstone')); const t = G.today(); s.homeSeed = {}; s.level = 31; s.homeTally.counts.reno = 30;
    s.quests.forEach(q => { if (q.home && q.home !== 'reno') { if (q.type === 'habit') { q.count = 1; q.countOn = t; } else q.doneOn = t; } }); s.lastTraining = t;
    localStorage.setItem('grindstone', JSON.stringify(s)); window.onResume(); });
  for (const a of ['cook', 'couch', 'birds', 'bag']) { await p.evaluate((a) => Home._go(a, true), a); await crop('good-' + a); }
  await p.$eval('#main', el => el.scrollTop = 330); await p.waitForTimeout(300); await p.screenshot({ path: OUT + 'list.png' });
  console.log(errs.length ? errs.join('\n') : 'no JS errors');
  await b.close();
})();
