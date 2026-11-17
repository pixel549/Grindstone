// 2.17-2.18: wind and the old roads, driven by finger taps.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s2x/';
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
  await set(() => { const s = JSON.parse(localStorage.gs); s.town = { open: true }; s.wind = 0; s.gold = 100; delete s.spar; G.STATS.forEach((k) => { s.stats[k] = 5 * 30 * 30; }); s.delve.n = 0; s.delve.trophies = []; localStorage.gs = JSON.stringify(s); });
  await tap('[data-act="tab"][data-v="delve"]');
  ok(await p.evaluate(() => !document.querySelector('[data-act="spar-go"]')), 'no old roads before a dungeon is cleared');
  // clear two dungeons by the rules, then earn wind with deeds
  const r = await p.evaluate(() => {
    const S0 = JSON.parse(localStorage.gs); G.normalize(S0, G.today()); G.normDelve(S0);
    for (let i = 0; i < 2; i++) { const inp = G.inputFor(S0, {}), out = G.simRun(inp, {}, false); G.applyRun(S0, out, { t: Date.now(), day: G.today(), buffs: inp.buffs }); }
    const t = G.today(), w0 = S0.wind | 0; const qs = S0.quests.filter((q) => q.type === 'habit' && !q.archived).slice(0, 5); qs.forEach((q) => G.complete(S0, q.id, t, Date.now()));
    const w1 = S0.wind; G.undo(S0, qs[0].id, t); const w2 = S0.wind;
    for (let i = 0; i < 30; i++) S0.wind = Math.min(G.WIND_MAX, S0.wind + 1);
    S0.wind = 5; S0.gold = 100; localStorage.gs = JSON.stringify(S0);
    return { n: S0.delve.n, w0: w0, w1: w1, w2: w2 };
  });
  ok(r.n === 2 && r.w1 === r.w0 + 5 && r.w2 === r.w1 - 1, 'each deed gives one wind, and undo takes it back (' + r.w0 + ' → ' + r.w1 + ' → ' + r.w2 + ')');
  await p.evaluate(() => window.onResume()); await p.waitForTimeout(1200);
  for (let k = 0; k < 5; k++) if (await p.$('#modal:not(.hidden) .btn[data-m="close"]')) { await tap('#modal:not(.hidden) .btn[data-m="close"]'); await p.waitForTimeout(900); }
  await tap('[data-act="tab"][data-v="delve"]');
  ok(await p.evaluate(() => /OLD ROADS/i.test(document.querySelector('#main').innerText) && /5\/12/.test(document.querySelector('#main').innerText) && /0\/10 stars/i.test(document.querySelector('#main').innerText)), 'the old roads show: wind 5/12, 0/10 stars');
  await p.evaluate(() => document.querySelector('[data-act="spar-go"]').scrollIntoView({ block: 'center' })); await shot('s01-roads');
  const before = await save();
  await tap('[data-act="spar-go"]');
  await p.waitForSelector('.duel', { timeout: 8000 });
  await p.waitForFunction(() => document.querySelector('.dscene canvas') && !document.querySelector('.dfoot.busy'), null, { timeout: 20000 });
  // spam: tap strike as fast as the page lets us, and walk next the moment it shows; sample where the hero stands
  const bad = []; let samples = 0;
  const sample = () => p.evaluate(() => {
    const st = window.__dbg.duel, sc = st && st.scene; if (!sc || !sc.rooms) return null;
    const T = 32, H = sc.hero, inRoom = sc.rooms.some((r) => H.x >= (r.x0) * T - 4 && H.x <= (r.x0 + r.w) * T + 4 && H.y >= (r.y0 + 1.6) * T - 4 && H.y <= (r.y0 + 2 + r.d) * T + 4);
    const onLink = sc.D.map.links.some((l) => { for (let i = 0; i + 1 < l.pts.length; i++) { const a = l.pts[i], b = l.pts[i + 1]; const x0 = Math.min(a[0], b[0]) * T - 20, x1 = Math.max(a[0], b[0]) * T + 20, y0 = Math.min(a[1], b[1]) * T - 20, y1 = Math.max(a[1], b[1]) * T + 20; if (H.x >= x0 && H.x <= x1 && H.y >= y0 && H.y <= y1) return true; } return false; });
    return { x: Math.round(H.x), y: Math.round(H.y), tx: H.tx == null ? null : Math.round(H.tx), ty: H.ty == null ? null : Math.round(H.ty), ok: inRoom || onLink, st: st.i, busy: !!st.busy, room: sc.room.id, rooms: sc.rooms.map((r) => [r.id, r.st, r.x0, r.y0, r.w, r.d].join(':')), links: sc.D.map.links.map((l) => l.a + '>' + l.b + ' ' + JSON.stringify(l.pts)) };
  });
  for (let i = 0; i < 2500; i++) {
    const act = await p.evaluate(() => { const d = document.querySelector('.duel'); if (!d) return 'gone'; if (d.querySelector('[data-m="duel-done"]')) return 'done'; const n = d.querySelector('[data-m="duel-next"]'); if (n) { n.click(); return 'next'; } if (Math.random() < 0.3 && d.querySelector('.dwalk')) { d.querySelector('.dscene').click(); return 'hurry'; } const s = d.querySelector('[data-v="strike"]'); if (s && !s.disabled) { s.click(); return 'strike'; } return 'wait'; });
    if (act === 'done' || act === 'gone') break;
    await p.waitForTimeout(30);
    const sm = await sample(); samples++;
    if (sm && !sm.ok) bad.push([i, act, sm]);
  }
  console.log('samples', samples, 'out of bounds', bad.length); if (bad[0]) { const m = bad[0][2]; console.log(JSON.stringify({ x: m.x, y: m.y, tx: m.tx, ty: m.ty, room: m.room, st: m.st })); console.log(m.rooms.join(' | ')); console.log(m.links.join('\n')); }
  await shot('walls'); console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
