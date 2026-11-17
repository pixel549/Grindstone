// The 2D Hearth: the house at different states, thoughts, tapping things, the portraits and the widget clip.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s13/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.625 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    window.__frames = null;
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.0', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {},
      heraldInfo: () => JSON.stringify({ perm: false, write: false, cals: [] }), askCalendar: () => {}, heraldArm: () => {}, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: true, sig: '', age: -1 }), widgetFrames: (j) => { window.__frames = JSON.parse(j); return true; }, interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  // first run: creator
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(800); await shot('h01-creator');
  await p.click('[data-m="c-set"][data-k="sex"][data-v="m"]'); await p.click('[data-m="c-set"][data-k="hair"][data-v="bald"]'); await p.click('[data-m="c-set"][data-k="beard"][data-v="beard"]'); await p.click('[data-m="c-set"][data-k="extra"][data-v="glasses"]');
  await p.click('[data-m="c-set"][data-k="skin"][data-v="#f3d2b5"]'); await p.click('[data-m="c-set"][data-k="hairColour"][data-v="#4a2f1f"]'); await p.waitForTimeout(900); await shot('h02-creator-jake');
  await p.click('[data-m="c-save"]');
  const clear = async () => { for (let i = 0; i < 12; i++) { await p.waitForTimeout(400); const open = await p.$('#modal:not(.hidden)'); if (!open) return; const html = await p.evaluate(() => document.querySelector('#modal').innerText.slice(0, 80).replace(/\n/g, ' ')); console.log('modal:', html); const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn'); if (c) await c.click().catch(() => {}); else await p.click('#modal .scrim').catch(() => {}); } };
  await clear();
  // a neglected house: lawn 3 weeks, fridge 5 days, dishes piling
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.gs), t = G.today();
    s.homeSeed = { lawn: G.addDays(t, -21), fridge: G.addDays(t, -5), dishes: G.addDays(t, -3), birds: G.addDays(t, -1), aviary: G.addDays(t, -9), laundry: G.addDays(t, -2) };
    s.created = G.addDays(t, -40); s.gold = 500; s.level = 5; G.STATS.forEach((k) => { s.stats[k] = Math.max(s.stats[k] | 0, 300); });
    localStorage.gs = JSON.stringify(s); window.onResume();
  });
  await clear();
  await p.click('[data-act="tab"][data-v="hearth"]');
  await p.waitForFunction(() => window.__house.inst && window.__house.inst.hero && document.querySelector('.h3-stage.ready'), null, { timeout: 30000 });
  await shot('h03-hearth', 1500);
  // walk him to the lawn and let him fret
  await p.evaluate(() => { const h = window.__house.inst; h._place('lawnlook', true); h._think(); });
  await shot('h04-lawn-fret', 900);
  // tap the grass
  await p.evaluate(() => window.__house.inst._emit('lawn'));
  await shot('h05-lawn-sheet', 600);
  const lawnSheet = await p.evaluate(() => document.querySelector('#modal .sheet') && document.querySelector('#modal .sheet').innerText);
  console.log('LAWN SHEET:\n' + lawnSheet);
  await p.mouse.click(196, 30); await p.waitForTimeout(300);
  await p.evaluate(() => window.__house.inst._emit('fridge'));
  await shot('h06-fridge-sheet', 600);
  console.log('FRIDGE SHEET:\n' + await p.evaluate(() => document.querySelector('#modal .sheet').innerText));
  // complete grocery shop from the sheet: he celebrates, the fridge thought clears
  await p.click('#modal [data-m="f-complete"]');
  await shot('h07-after-shop', 900);
  // zoom out to the whole lot
  await p.click('[data-act="h3-zoom"]'); await p.click('[data-act="h3-zoom"]').catch(() => {});
  await p.evaluate(() => { window.__house.inst.k = 1; });
  await shot('h08-overview', 700);
  // estate: buy some upgrades and preview
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.estate.tiers = { walls: 2, floors: 2, fridge: 3, couch: 2, bed: 2, yard: 2, aviary: 2, desk: 2, stove: 2, sink: 2 }; s.estate.wings = { pool: true, shed: true }; s.estate.tiers.pool = 2; s.estate.tiers.shed = 1; s.homeSeed.lawn = G.today(); localStorage.gs = JSON.stringify(s); window.onResume(); });
  await p.evaluate(() => { window.__house.inst.k = 0; window.__house.inst._place('couch', true); });
  await shot('h09-upgraded', 900);
  await p.evaluate(() => { window.__house.inst.k = 1; });
  await shot('h10-upgraded-overview', 600);
  // portraits
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.gs);
    const mk = (id, slot, base, art, tier) => ({ id: id, slot: slot, base: base, art: art, name: base, tier: tier, bonus: { STR: 1 + tier }, lvl: 1 });
    s.inv = [mk(901, 'weapon', 'Longsword', 'blade', 3), mk(902, 'body', 'Cuirass', 'armour', 3), mk(903, 'head', 'Helm', 'helm', 3), mk(904, 'charm', 'Locket', 'pendant', 2)];
    s.eq = { weapon: 901, head: 903, body: 902, charm: 904 };
    localStorage.gs = JSON.stringify(s); window.onResume();
  });
  await p.click('[data-act="tab"][data-v="status"]'); await p.waitForTimeout(400);
  await p.click('[data-act="sub"][data-v="equip"]'); await p.waitForSelector('.h3hero.live canvas.lpcport', { timeout: 10000 }); await shot('h11-equip', 600);
  await p.click('[data-act="tab"][data-v="delve"]'); await p.waitForTimeout(800);
  await p.evaluate(() => { const e = document.querySelector('.dv-hero'); if (e) e.scrollIntoView({ block: 'center' }); }); await shot('h12-delve', 600);
  // the house in armour, and the widget clip
  await p.click('[data-act="tab"][data-v="hearth"]'); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__house.inst.k = 0; window.__house.inst._place('bag', true); });
  await shot('h13-armour-house', 900);
  await p.click('[data-act="tab"][data-v="quests"]');
  await p.evaluate(() => { window.__frames = null; window.__wcam(); });
  await p.waitForFunction(() => window.__frames, null, { timeout: 30000 }).catch(() => {});
  const fr = await p.evaluate(() => window.__frames && { n: window.__frames.frames.length, interval: window.__frames.interval, spot: window.__frames.spot, thought: window.__frames.thought, first: window.__frames.frames[0] });
  if (fr) { fs.writeFileSync(OUT + 'h14-widget.jpg', Buffer.from(fr.first, 'base64')); console.log('CLIP', fr.n, fr.interval, fr.spot, JSON.stringify(fr.thought)); } else console.log('NO CLIP');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
