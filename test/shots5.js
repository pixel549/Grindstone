const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT = '/home/claude/grindstone/test/s5/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.clock.setFixedTime(new Date('2026-11-07T15:10:00'));
  await p.goto('file:///home/claude/grindstone/assets/index.html');
  await p.waitForTimeout(400);
  await p.click('[data-m="c-save"]'); await p.click('[data-m="again"]'); await p.waitForTimeout(1200); await p.click('[data-m="equip-close"]');
  const stage = async (n, ms = 2600) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png', clip: { x: 0, y: 96, width: 393, height: 292 } }); };
  const layouts = [
    { yardA: 'hammock', yardB: 'bbq', loungeF: 'arcade', loungeW: 'shield', studyF: 'fishtank', studyW: 'starchart', bedW: 'banner', gymF: 'dummy', gymW: 'weaponrack' },
    { yardA: 'vegpatch', yardB: 'gnome', loungeF: 'record', loungeW: 'mountedfish', studyF: 'floorlamp', gymF: 'plant' },
    { yardB: 'flamingo' },
  ];
  for (let L = 0; L < layouts.length; L++) {
    await p.evaluate((pl) => { const s = JSON.parse(localStorage.getItem('grindstone')); s.decor.owned = Object.keys(G.DECOR); s.decor.placed = pl; localStorage.setItem('grindstone', JSON.stringify(s)); window.onResume(); }, layouts[L]);
    for (const sk of Object.keys(layouts[L])) {
      await p.evaluate((sk) => Home._go('d:' + sk, true), sk);
      await p.evaluate((sk) => { const r = { yardA: 'yard', yardB: 'yard', loungeF: 'living', loungeW: 'living', studyF: 'study', studyW: 'study', bedW: 'bedroom', gymF: 'gym', gymW: 'gym' }[sk]; }, sk);
      await stage(`${L}-${sk}-${layouts[L][sk]}`);
    }
  }
  console.log(errs.length ? errs.join('\n') : 'no JS errors');
  await b.close();
})();
