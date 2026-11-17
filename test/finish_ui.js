// 2.20.1: finishes. A piece of the estate, once at a level, can be bought in other colours, tried on first, and worn or swapped.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s222/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const cx_ = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true }); const p = await cx_.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    window.__frames = null;
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.0', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {},
      heraldInfo: () => JSON.stringify({ perm: true, write: true, cals: [{ id: 7, name: 'Findmyshift roster', account: 'feed' }, { id: 3, name: 'Grindstone', account: 'gmail' }] }), rosterEvents: () => JSON.stringify(window.__roster || []), backupWrite: (j, n) => { window.__bk = [j.length, n]; return 'ok: Downloads/Grindstone/' + n; }, backupPick: (cb) => { window.__pick = cb; }, askCalendar: () => {}, heraldArm: () => {}, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: true, sig: '', age: -1 }), widgetFrames: (j) => { window.__frames = JSON.parse(j); return true; }, interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  // first run: creator
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(800); await shot('h01-creator');
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(600);
  await p.click('[data-m="c-save"]');
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(350); if (!(await p.$('#modal:not(.hidden)'))) break; const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn'); if (c) await c.click().catch(() => {}); }
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const tap = async (sel) => { const el = await p.$(sel); if (!el) { console.log('MISSING ' + sel); fails++; return false; } await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(450); return true; };
  const closeSheet = async () => { await tap('#modal .btn[data-m="close"]'); };
  const save = () => p.evaluate(() => JSON.parse(localStorage.gs));
  const set = async (fn) => { await p.evaluate(fn); await p.evaluate(() => window.onResume()); await p.waitForTimeout(500); };
  await set(() => { const s = JSON.parse(localStorage.gs); s.gold = 5000; s.level = 10; s.estate.tiers.desk = 4; s.estate.tiers.walls = 2; s.estate.tiers.couch = 3; localStorage.gs = JSON.stringify(s); });
  await p.reload(); await p.waitForTimeout(2000);
  await tap('[data-act="tab"][data-v="hearth"]'); await p.waitForTimeout(2500);
  const st = () => p.evaluate(() => JSON.parse(localStorage.gs));
  const sheetOpen = async (k) => { await p.evaluate((k) => document.querySelector('[data-act="estate"][data-k="' + k + '"]').scrollIntoView({ block: 'center' }), k); await tap('[data-act="estate"][data-k="' + k + '"]'); await p.waitForTimeout(900); };
  await sheetOpen('desk');
  const cells = await p.evaluate(() => [...document.querySelectorAll('#modal .fin')].map((c) => c.innerText.replace(/\s+/g, ' ')));
  ok(cells.length === 13 && /As built/.test(cells[0]) && /Gilt ◈ 2700/.test(cells.join('|')) && /Walnut ◈ 405/.test(cells.join('|')), 'a level-5 desk offers 12 finishes plus as built; walnut ◈405, gilt ◈2700 (what the next level costs): ' + cells.slice(0, 3).join(' | '));
  const inked = await p.evaluate(() => [...document.querySelectorAll('#modal canvas.finc')].filter((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }).length);
  ok(inked === 13, 'each swatch is the desk itself, drawn in that finish (' + inked + ' drawn)');
  const hues = await p.evaluate(() => { const avg = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return [r / n, g / n, b / n].map(Math.round); };
    const cs = [...document.querySelectorAll('#modal canvas.finc')]; return { base: avg(cs[0]), sage: avg(cs.find((c) => c.dataset.fin === 'sage')), gilt: avg(cs.find((c) => c.dataset.fin === 'gilt')) }; });
  ok(hues.sage[1] > hues.base[1] - 5 && hues.sage[0] < hues.base[0] && hues.gilt[0] + hues.gilt[1] > hues.base[0] + hues.base[1], 'sage is greener and gilt brighter and warmer than as built: ' + JSON.stringify(hues));
  await p.evaluate(() => document.querySelector('#modal .fins').scrollIntoView({ block: 'start' })); await shot('f01-sheet', 300);
  await tap('#modal .fin[data-v="gilt"]'); await p.waitForTimeout(1600);
  const bar = await p.evaluate(() => document.querySelector('.h3-prev') ? document.querySelector('.h3-prev').innerText.replace(/\s+/g, ' ') : '');
  ok(/Gilt/.test(bar) && /Regal finish/.test(bar) && /2700/.test(bar), 'tapping one tries it on in the house, with its price: ' + bar);
  await shot('f02-try-gilt', 300);
  await tap('.h3-prev [data-act="pv-fin"][data-v="-1"]'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => /Ebony/.test(document.querySelector('.h3-prev').innerText)), 'the arrows step through the finishes');
  await tap('.h3-prev [data-act="pv-fin"][data-v="1"]'); await p.waitForTimeout(500);
  const g0 = (await st()).gold;
  await tap('.h3-prev [data-act="fin-buy"]'); await p.waitForTimeout(900);
  let s = await st();
  ok(s.gold === g0 - 2700 && s.estate.fin.desk && s.estate.fin.desk.on === 'gilt' && s.estate.fin.desk.t === 4 && s.log[0].n === 'Desk: Gilt finish' && s.log[0].g === -2700, 'buying it costs 2700, puts it on and logs it');
  ok(await p.evaluate(() => /\bon\b/i.test(document.querySelector('.h3-prev').innerText)), 'the bar now says it is on');
  await shot('f03-gilt-on', 600);
  await tap('.h3-prev [data-act="pv-done"]'); await p.waitForTimeout(900);
  await tap('#modal .fin[data-v="walnut"]'); await p.waitForTimeout(1200);
  await tap('.h3-prev [data-act="fin-buy"]'); await p.waitForTimeout(700);
  s = await st();
  ok(s.estate.fin.desk.on === 'walnut' && s.estate.fin.desk.own.join() === 'gilt,walnut', 'a second finish: bought and worn, the first still owned');
  await tap('.h3-prev [data-act="pv-done"]'); await p.waitForTimeout(900);
  await tap('#modal .fin[data-v="gilt"]'); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => !!document.querySelector('.h3-prev [data-act="fin-use"]')), 'an owned finish offers Use, not a price');
  const g1 = (await st()).gold;
  await tap('.h3-prev [data-act="fin-use"]'); await p.waitForTimeout(700);
  s = await st();
  ok(s.estate.fin.desk.on === 'gilt' && s.gold === g1, 'switching back is free');
  await tap('.h3-prev [data-act="pv-done"]'); await p.waitForTimeout(900);
  await tap('#modal .fin[data-v=""]'); await p.waitForTimeout(1200);
  await tap('.h3-prev [data-act="fin-use"]'); await p.waitForTimeout(700);
  ok((await st()).estate.fin.desk.on === null, 'and "as built" takes it off');
  await tap('.h3-prev [data-act="pv-done"]'); await p.waitForTimeout(800);
  await tap('#modal .fin[data-v="gilt"]'); await p.waitForTimeout(1000); await tap('.h3-prev [data-act="fin-use"]'); await p.waitForTimeout(600);
  await tap('.h3-prev [data-act="pv-done"]'); await p.waitForTimeout(800);
  await p.evaluate(() => { const c = document.querySelector('#modal .scrim'); if (c) c.click(); }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => /Gilded bureau · Gilt/i.test(document.querySelector('[data-act="estate"][data-k="desk"]').innerText.replace(/\s+/g, ' '))), 'the estate list shows the finish it wears');
  // walls: the house's own walls take a finish too
  await sheetOpen('walls');
  await tap('#modal .fin[data-v="sage"]'); await p.waitForTimeout(1500); await shot('f04-walls-sage', 300);
  await tap('.h3-prev [data-act="fin-buy"]'); await p.waitForTimeout(700);
  s = await st();
  ok(s.estate.fin.walls && s.estate.fin.walls.on === 'sage' && s.log[0].g === -155, 'walls can be finished (sage, ◈' + -s.log[0].g + ', tier ' + s.estate.tiers.walls + ')');
  await tap('.h3-prev [data-act="pv-done"]'); await p.waitForTimeout(800);
  await p.evaluate(() => { const c = document.querySelector('#modal .scrim'); if (c) c.click(); }); await p.waitForTimeout(800);
  await p.evaluate(() => { const c = document.querySelector('#h3slot'); if (c) c.scrollIntoView(); }); await shot('f05-house', 900);
  // an upgrade brings new art and a fresh set
  // 2.20.3: the next level of a piece needs the hero's level and its stat
  await set(() => { const s = JSON.parse(localStorage.gs); s.level = 10; s.stats.INT = 300; s.stats.DIS = 50; s.estate.tiers.sink = 1; localStorage.gs = JSON.stringify(s); });
  let lk = await p.evaluate(() => ({ desk: G.estateNext(JSON.parse(localStorage.gs), 'desk'), sink: G.estateNext(JSON.parse(localStorage.gs), 'sink') }));
  ok(!lk.desk.ok && lk.desk.lock === 'level' && lk.desk.lvl === 40, 'the level-6 desk waits for hero level 40 (2.23): ' + lk.desk.why);
  ok(!lk.sink.ok && lk.sink.lock === 'stat' && /Needs 80 Discipline \(you have 50\)/.test(lk.sink.why), 'the level-3 sink waits on Discipline (the dishes): ' + lk.sink.why);
  await p.evaluate(() => document.querySelector('[data-act="estate"][data-k="sink"]').scrollIntoView({ block: 'center' }));
  ok(await p.evaluate(() => /80 DIS/i.test(document.querySelector('[data-act="estate"][data-k="sink"] .elock').innerText)), 'the list row says what it is waiting on (80 DIS)');
  await sheetOpen('sink');
  const lad = await p.evaluate(() => [...document.querySelectorAll('#modal .tl')].map((r) => r.innerText.replace(/\s+/g, ' ')).join(' | '));
  ok(/Lv 8 80 DIS/i.test(lad) && /Lv 40 1000 DIS/i.test(lad) && /Needs 80 Discipline/.test(await p.evaluate(() => document.querySelector('#modal').innerText)), 'the ladder shows what every level asks for: ' + lad.slice(0, 160));
  await shot('f06-sink-locked', 300);
  await p.evaluate(() => { const c = document.querySelector('#modal .scrim'); if (c) c.click(); }); await p.waitForTimeout(400);
  await set(() => { const s = JSON.parse(localStorage.gs); s.level = 40; s.gold = 20000; localStorage.gs = JSON.stringify(s); });
  lk = await p.evaluate(() => G.estateNext(JSON.parse(localStorage.gs), 'desk'));
  ok(!lk.ok && lk.lock === 'stat' && lk.sv === 1000, 'at level 40 it still wants 1000 Intellect: ' + lk.why);
  await set(() => { const s = JSON.parse(localStorage.gs); s.stats.INT = 1000; G.buyEstate(s, 'desk'); localStorage.gs = JSON.stringify(s); });
  s = await st();
  ok(s.estate.tiers.desk === 5 && G_fin(s) === null, 'after the upgrade the new desk wears no finish');
  await sheetOpen('desk');
  const c5 = await p.evaluate(() => [...document.querySelectorAll('#modal .fin')].map((c) => c.innerText.replace(/\s+/g, ' ')).join('|'));
  ok(/Gilt ◈ 4050/.test(c5) && !/yours/.test(c5), 'and the level-6 set is its own, priced off that level: ' + (c5.match(/Gilt[^|]*/) || [''])[0]);
  await p.evaluate(() => { const c = document.querySelector('#modal .scrim'); if (c) c.click(); }); await p.waitForTimeout(400);
  await tap('[data-act="tab"][data-v="records"]'); await tap('[data-act="sub"][data-v="settings"]');
  ok(await p.evaluate(() => !document.querySelector('[data-act="home-style"]') && !/Home style/i.test(document.querySelector('#main').innerText)), 'the house-wide style setting is gone');
  console.log(errs.length ? errs.join('\n') : 'no page errors'); if (errs.length) fails++;
  await b.close(); process.exit(fails ? 1 : 0);
})();
function G_fin(s) { const F = s.estate.fin.desk; return F && F.t === s.estate.tiers.desk ? F.on : null; }
