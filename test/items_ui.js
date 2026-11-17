// 2.20.1: every effect a piece has shows on its sheet with its numbers, and the comparison says what really changes.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s221/';
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
  await set(() => {
    const s = JSON.parse(localStorage.gs);
    const it = (o) => Object.assign({ lvl: 6, bonus: {} }, o);
    s.inv = [
      it({ id: 901, slot: 'body', base: 'Duster', art: 'coat', name: 'Well-made Duster of the Vigil', tier: 1, bonus: { DIS: 2 }, res: 'storm' }),
      it({ id: 902, slot: 'body', base: 'Cuirass', art: 'armour', name: 'Abyssal Cuirass of the Ox', tier: 3, bonus: { STR: 4, END: 2 }, fx: 'bulwark', lvl: 7 }),
      it({ id: 903, slot: 'head', base: 'Hood', art: 'hood', name: 'Oiled Hood of Order', tier: 1, bonus: { DIS: 2 }, res: 'storm' }),
      it({ id: 904, slot: 'weapon', base: 'Halberd', art: 'polearm', name: 'Rusted Halberd of the Scholar', tier: 2, bonus: { INT: 3, STR: 2 }, el: 'frost' }),
      it({ id: 905, slot: 'off', base: 'Parrying Dagger', art: 'blade', name: 'Worn Parrying Dagger', tier: 1, amt: 2 }),
      it({ id: 906, slot: 'off', base: 'Buckler', art: 'shield', name: 'Plain Buckler', tier: 0, amt: 1 }),
      it({ id: 907, slot: 'weapon', base: 'Dirk', art: 'blade', name: 'Plain Dirk', tier: 0, bonus: { STR: 1 } }),
    ];
    s.eq = { weapon: 907, body: 901, off: 906 };
    localStorage.gs = JSON.stringify(s);
  });
  const open = async (id) => { await p.evaluate((id) => { const b = document.createElement('div'); b.dataset.act = 'item'; b.dataset.id = id; document.querySelector('#main').appendChild(b); b.click(); }, id); await p.waitForTimeout(500); return p.evaluate(() => document.querySelector('#modal:not(.hidden)') ? document.querySelector('#modal').innerText.replace(/\s+/g, ' ') : ''); };
  await tap('[data-act="tab"][data-v="status"]');
  let t = await open(901); await shot('i01-duster');
  ok(/30% STORM RESISTANCE/i.test(t) && /storm attacks do 30% less to (him|her)/i.test(t), 'the duster says it resists storm, by how much, and what that means');
  await p.evaluate(() => { const c = document.querySelector('#modal .scrim'); if (c) c.click(); }); await p.waitForTimeout(400);
  t = await open(902); await shot('i02-cuirass');
  ok(/loses 30% storm resistance/i.test(t), 'the cuirass says it loses 30% storm resistance: ' + (t.match(/than (his|her) duster.{0,160}/i) || [''])[0]);
  ok(/IN THE DELVE/i.test(t) && /attack \+\d/i.test(t) && /defence \+\d/i.test(t), 'and what moves in a fight (attack and defence up)');
  ok(/mostly better than (his|her) duster/i.test(t), 'better on numbers but with a loss: "mostly better"');
  ok(/Braced/.test(t) && /first hit of every fight does half/i.test(t), 'its effect is named and explained');
  ok(await p.evaluate(() => { const g = [...document.querySelectorAll('#modal .pxg')]; return g.length >= 2 && g.some((x) => x.textContent === '✦') && g.every((x) => x.offsetWidth > 0 && x.offsetHeight > 0); }), 'the ✦ is drawn by hand on the font grid, not left to a fallback font');
  await p.evaluate(() => { const c = document.querySelector('#modal .scrim'); if (c) c.click(); }); await p.waitForTimeout(400);
  // wear a hood that also resists storm: swapping the duster out keeps it
  await set(() => { const s = JSON.parse(localStorage.gs); s.eq.head = 903; localStorage.gs = JSON.stringify(s); });
  t = await open(902); await shot('i03-cuirass-hood');
  ok(/keeps storm resistance \((his|her) hood\)/i.test(t) && !/loses 30% storm/i.test(t), 'with a storm hood on, it says the resistance is kept, and from where');
  await p.evaluate(() => { const c = document.querySelector('#modal .scrim'); if (c) c.click(); }); await p.waitForTimeout(400);
  t = await open(904); await shot('i04-halberd');
  ok(/POLEARM/i.test(t) && /strikes first/i.test(t), 'a weapon says what kind it is and what that kind is good at');
  ok(/frost weapon/i.test(t) && /60% more damage in dungeons weak to frost/i.test(t), 'and its element, with numbers');
  ok(/a polearm instead of a blade/i.test(t) && /frost weapon/i.test(t), 'the comparison says the kind changes and the element is gained');
  await p.evaluate(() => { const c = document.querySelector('#modal .scrim'); if (c) c.click(); }); await p.waitForTimeout(400);
  t = await open(905); await shot('i05-dagger');
  ok(/\+2% damage reduction/i.test(t) && /loses 2 defence/i.test(t), 'minor pieces read cleanly: +2% damage reduction, loses 2 defence');
  await p.evaluate(() => { const c = document.querySelector('#modal .scrim'); if (c) c.click(); }); await p.waitForTimeout(400);
  await tap('[data-act="sub"][data-v="pack"]'); await shot('i06-pack');
  ok(await p.evaluate(() => /storm resist/i.test(document.querySelector('#main').innerText) && /frost weapon/i.test(document.querySelector('#main').innerText)), 'the pack rows show elements and resistances too');
  console.log(errs.length ? errs.join('\n') : 'no page errors'); if (errs.length) fails++;
  await b.close(); process.exit(fails ? 1 : 0);
})();
