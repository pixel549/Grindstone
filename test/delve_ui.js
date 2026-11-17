// The delve: dungeon card, a watched run with prompts, results, records, orders, buffs, a solo run and the phone's pending run.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s11/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '1.8', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {},
      heraldInfo: () => JSON.stringify({ perm: false, write: false, cals: [] }), askCalendar: () => {}, heraldArm: () => {}, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: false }), widgetFrames: () => true, interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  const clear = async () => { for (let i = 0; i < 8; i++) { await p.waitForTimeout(500); const c = await p.$('#modal:not(.hidden) .band [data-m="close"], #modal:not(.hidden) .dlg [data-m="close"]'); if (!c) break; await c.click(); } };
  const st = () => p.evaluate(() => { const s = JSON.parse(localStorage.gs); const d = s.delve; return { gold: s.gold, n: d.n, day: d.day, pending: !!d.pending, rec: (d.rec[d.n] || []).length + '/' + Object.keys(d.rec).length, orders: d.orders, last: d.last && { res: d.last.res, solo: d.last.solo, seen: d.last.seen, lines: (d.last.log || []).length, killer: d.last.killer } }; });
  await p.click('[data-m="c-save"]'); await p.click('[data-m="pet-save"]');  /* 2.26: the pets step */
  await p.click('[data-m="again"]'); await p.waitForTimeout(1000); await p.click('[data-m="equip-close"]'); await p.waitForTimeout(1200); await clear();
  // a few days of deeds: some stat XP, a level or two, today's buffs
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.gs), now = Date.now();
    ['STR', 'END', 'VIT', 'DIS', 'INT'].forEach((k) => { s.stats[k] = 120; });
    s.level = 4;
    const q = (n) => s.quests.find((x) => x.name === n);
    [['Strength training', 2], ['Mow the lawn', 30], ['Grocery shop', 5], ['Log my meals', 1]].forEach(([n, h]) => { const x = q(n); s.log.unshift({ t: now - h * 3600e3, d: new Date(now - h * 3600e3).toISOString().slice(0, 10), q: x.id, n: x.name, i: x.icon, x: [5, 10, 20, 35, 60][x.diff - 1], g: 5, s: x.stat }); });
    localStorage.gs = JSON.stringify(s); window.onResume();
  });
  await p.click('[data-act="tab"][data-v="delve"]');
  await shot('01-dungeon');
  await p.evaluate(() => document.querySelector('.hsheet').scrollIntoView({ block: 'start' }));
  await shot('02-hero');
  await p.waitForTimeout(900); await clear(); await p.click('[data-act="tab"][data-v="quests"]'); await shot('03-buffs');
  await p.click('[data-act="delve-buff"]'); await shot('04-buff-pick'); await p.click('.scrim', { position: { x: 20, y: 20 } });
  await p.click('[data-act="tab"][data-v="delve"]');
  // a watched run: let it play, answer whatever it asks
  await p.click('[data-act="delve-go"]');
  console.log('started:', JSON.stringify(await st()));
  await shot('05-run-start', 2500);
  let prompts = 0;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(1200);
    const opt = await p.$('[data-m="run-pick"]');
    if (opt) { prompts++; if (prompts === 1) await shot('06-prompt'); await p.click('[data-m="run-pick"]'); continue; }
    const done = await p.$('[data-m="run-done"]');
    if (done) break;
    if (i >= 3) { const sk = await p.$('[data-m="run-skip"]'); if (sk) await p.click('[data-m="run-skip"]').catch(() => {}); }
  }
  await shot('07-run-end', 800);
  console.log('prompts answered:', prompts, 'after run:', JSON.stringify(await st()));
  await p.click('[data-m="run-done"]');
  await shot('08-after');
  await p.evaluate(() => { const r = document.querySelector('[data-act="delve-rec"]'); if (r) r.click(); });
  await p.evaluate(() => { const r = document.querySelector('.recd'); if (r) r.scrollIntoView({ block: 'center' }); });
  await shot('09-record');
  await p.evaluate(() => { const o = document.querySelector('.ord'); if (o) o.scrollIntoView({ block: 'center' }); }); await shot('10-orders');
  // can't go twice
  console.log('set out button today:', !!(await p.$('[data-act="delve-go"]')));
  // tomorrow: the phone started a solo run at 8 pm while the app was shut
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); const y = new Date(Date.now() - 86400e3); s.delve.day = y.toISOString().slice(0, 10); s.delve.pending = { t: Date.now() - 600e3, day: new Date().toISOString().slice(0, 10), eq: s.eq, answers: {}, manual: false, why: 'fallback' }; localStorage.gs = JSON.stringify(s); window.onResume(); });
  console.log('after pending:', JSON.stringify(await st()));
  await p.waitForTimeout(900); await clear(); await p.click('[data-act="tab"][data-v="quests"]'); await shot('11-today-band');
  await p.click('[data-act="tab"][data-v="delve"]'); await shot('12-solo-banner');
  await p.click('[data-act="delve-watch"]'); await p.waitForTimeout(500); await p.click('[data-m="run-skip"]'); await shot('13-replay', 600);
  await p.click('[data-m="run-done"]');
  // and if nobody sends him: the fallback with the app open
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.delve.day = null; s.delve.autoAt = '00:00'; localStorage.gs = JSON.stringify(s); window.onResume(); window.__delve.soloRun(); });
  console.log('fallback solo:', JSON.stringify(await st()), 'toast:', await p.evaluate(() => document.querySelector('#toast').textContent));
  // auto-equip
  await p.click('[data-act="delve-auto"]'); await p.waitForTimeout(300);
  console.log('auto-equip toast:', await p.evaluate(() => document.querySelector('#toast').textContent));
  await p.click('[data-act="tab"][data-v="records"]'); await p.click('[data-act="sub"][data-v="delves"]'); await shot('14-trophies');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
