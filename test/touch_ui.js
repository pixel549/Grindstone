// Finger taps (touch emulation at the A54 size): every starred prop must open its window and keep it open.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s14/';
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
    s.created = G.addDays(t, -40); s.gold = 500; s.level = 5;
    localStorage.gs = JSON.stringify(s); window.onResume();
  });
  await clear();
  await p.click('[data-act="tab"][data-v="hearth"]');
  await p.waitForFunction(() => window.__house.inst && window.__house.inst.hero && document.querySelector('.h3-stage.ready'), null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  const MODE = process.env.MODE || 'both';
  if (MODE === 'guardonly') await p.evaluate(() => { const c = window.__house.inst.canvas; c.addEventListener('touchend', (e) => { Object.defineProperty(e, 'cancelable', { value: false }); }, true); });
  const ids = await p.evaluate(() => [...new Set((window.__house.inst.starPts || []).map((q) => q.id))]);
  let ok = 0, bad = [];
  for (const id of ids) {
    const q = await p.evaluate((id) => {
      const h = window.__house.inst, c = h.canvas, d = h.dpr || 1;
      let s = h.starPts.find((q) => q.id === id); if (!s) return null;
      const k = h.view.k;
      h.cam.x = s.x; h.cam.y = s.y; h.cam.manual = 1e9;
      return new Promise((res) => setTimeout(() => { const r = c.getBoundingClientRect(); s = h.starPts.find((q) => q.id === id); res(s ? { x: r.left + (s.x * h.view.k + h.view.ox) / d, y: r.top + (s.y * h.view.k + h.view.oy) / d, top: r.top, bot: r.bottom } : null); }, 250));
    }, id);
    if (!q || q.y < q.top || q.y > q.bot || q.x < 0 || q.x > 393) { bad.push(id + ' (unreachable ' + JSON.stringify(q) + ')'); continue; }
    await p.touchscreen.tap(q.x, q.y); await p.waitForTimeout(500);
    const r = await p.evaluate(() => { const m = document.querySelector('#modal'); return { open: !m.classList.contains('hidden') && !!m.querySelector('.sheet, .dlg'), h: (m.querySelector('h3') || {}).innerText }; });
    if (r.open) ok++; else bad.push(id);
    console.log(id.padEnd(14), r.open ? 'opens: ' + r.h : 'NOTHING');
    if (r.open) { await p.waitForTimeout(300); await p.touchscreen.tap(196, 130); await p.waitForTimeout(300); const still = await p.evaluate(() => !document.querySelector('#modal').classList.contains('hidden')); if (still) { console.log('  (did not close on backdrop tap)'); await p.evaluate(() => document.querySelector('#modal .scrim').click()); await p.waitForTimeout(200); } }
  }
  console.log(MODE, 'opened', ok, 'of', ids.length, 'failed:', bad.join(', ') || 'none');
  console.log(errs.join('\n'));
  await b.close();
})();
