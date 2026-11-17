// The watchable crawl: a run plays out in the scene above the log, pauses at its questions, skips to the end,
// and a replay draws the same dungeon. Frames are saved through the run for a look.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s16/';
fs.mkdirSync(OUT, { recursive: true });
const ARGS = process.argv.slice(2);
const N = ARGS[0] != null ? Number(ARGS[0]) : 0, COMP = ARGS[1] || 'fighter', FRAMES = Number(ARGS[2] || 60);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.4', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {},
      heraldInfo: () => JSON.stringify({ perm: false, write: false, cals: [] }), askCalendar: () => {}, heraldArm: () => {}, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: false }), widgetFrames: () => true, interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const clear = async () => { for (let i = 0; i < 8; i++) { await p.waitForTimeout(500); const c = await p.$('#modal:not(.hidden) .band [data-m="close"], #modal:not(.hidden) .dlg [data-m="close"]'); if (!c) break; await c.click(); } };
  await p.click('[data-m="c-save"]'); await p.click('[data-m="pet-save"]');  /* 2.26: the pets step */
  await p.click('[data-m="again"]'); await p.waitForTimeout(1000); await p.click('[data-m="equip-close"]'); await clear();
  // a strong hero with a weapon, the companion asked for already in the house, and the dungeon asked for
  const info = await p.evaluate(([N, COMP]) => {
    const s = JSON.parse(localStorage.gs), now = Date.now();
    ['STR', 'END', 'VIT', 'DIS', 'INT'].forEach((k) => { s.stats[k] = 400; });
    s.level = 12; s.welcomed = true; s.town = { open: true };
    s.delve.n = N;
    const c = s.npcs.find((n) => n.comp === COMP || n.id === COMP);
    if (c) { c.status = 'resident'; c.joined = new Date(now - 864e5).toISOString().slice(0, 10); s.delve.comp = c.id; }
    if (c && c.kind === 'bird') { s.birds = s.birds || {}; }
    localStorage.gs = JSON.stringify(s); window.onResume();
    const D = G.dungeonFor(s.delve.seed, N);
    return { theme: D.theme, name: D.name, events: D.events.map((e) => e.kind).join(','), comp: c ? c.name + ' (' + (c.comp || c.kind) + ')' : 'none' };
  }, [N, COMP]);
  console.log('dungeon', JSON.stringify(info));
  await p.click('[data-act="tab"][data-v="delve"]');
  await p.waitForTimeout(600);
  
  await p.click('[data-act="delve-go"]');
  await p.waitForTimeout(400);
  const hasScene = await p.evaluate(() => !!document.querySelector('.rp-scene canvas'));
  console.log('scene mounted:', hasScene);
  let prompts = 0, f = 0;
  for (let i = 0; i < FRAMES; i++) {
    await p.waitForTimeout(900);
    await p.screenshot({ path: OUT + 'f' + String(f++).padStart(3, '0') + '.png', clip: { x: 0, y: 0, width: 393, height: 520 } });
    const opt = await p.$('[data-m="run-pick"]');
    if (opt) { prompts++; await p.click('[data-m="run-pick"]'); continue; }
    if (await p.$('[data-m="run-done"]')) { await p.waitForTimeout(1500); await p.screenshot({ path: OUT + 'f' + String(f++).padStart(3, '0') + '.png' }); break; }
  }
  const end = await p.evaluate(() => ({ done: !!document.querySelector('[data-m="run-done"]'), lines: document.querySelectorAll('.rp-log .rl').length, res: JSON.parse(localStorage.gs).delve.last && JSON.parse(localStorage.gs).delve.last.res }));
  console.log('prompts', prompts, 'frames', f, JSON.stringify(end));
  if (!end.done) {
    await p.click('[data-m="run-skip"]').catch(() => {});
    for (let i = 0; i < 6; i++) { await p.waitForTimeout(600); const o = await p.$('[data-m="run-pick"]'); if (o) { await o.click(); await p.waitForTimeout(300); await p.click('[data-m="run-skip"]').catch(() => {}); } }
    await p.waitForTimeout(1200);
    await p.screenshot({ path: OUT + 'skip-end.png' });
  }
  // a replay of the same run draws the same dungeon
  await p.click('[data-m="run-done"]').catch(() => {});
  await p.waitForTimeout(500);
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); if (s.delve.last) s.delve.last.seen = false; localStorage.gs = JSON.stringify(s); window.onResume(); });
  await p.waitForTimeout(600);
  const w = await p.$('[data-act="delve-watch"]');
  if (w) {
    await w.click(); await p.waitForTimeout(3500);
    await p.screenshot({ path: OUT + 'replay.png', clip: { x: 0, y: 0, width: 393, height: 520 } });
    console.log('replay scene:', await p.evaluate(() => !!document.querySelector('.rp-scene canvas')));
    await p.click('[data-m="run-skip"]').catch(() => {});
    await p.waitForTimeout(1200);
    await p.screenshot({ path: OUT + 'replay-skip.png', clip: { x: 0, y: 0, width: 393, height: 520 } });
    await p.click('[data-m="run-done"]').catch(() => {});
    console.log('after close, scenes left:', await p.evaluate(() => document.querySelectorAll('.rp-scene').length));
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
