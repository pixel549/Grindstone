// 2.14: today's plan, the forecast, and the new library lists, driven by finger taps.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s22/';
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
  const txt = () => p.evaluate(() => document.querySelector('#main').innerText);
  await set(() => { const s = JSON.parse(localStorage.gs); s.town = { open: true }; delete s.plan; delete s.weather; localStorage.gs = JSON.stringify(s); });
  // the roster comes from the phone's calendar: stand in for it
  const roster = async (shifts) => { await p.evaluate((sh) => { const t0 = new Date(G.today() + 'T00:00').getTime(); window.Native.rosterEvents = () => JSON.stringify(sh.map((x) => ({ t: 'Shift', s: t0 + x[0] * 3600e3, e: t0 + x[1] * 3600e3, a: false }))); const s = JSON.parse(localStorage.gs); s.settings.rosterCal = 'x'; localStorage.gs = JSON.stringify(s); }, shifts); await p.evaluate(() => window.onResume()); await p.waitForTimeout(600); };
  await tap('[data-act="tab"][data-v="quests"]'); await tap('#subtabs .sub[data-v="today"]');
  let m = await txt();
  ok(/TODAY.S PLAN/i.test(m) && /PICKED FOR TODAY/i.test(m) && /ALSO ON OFFER/i.test(m), 'the list has a plan, picks, and the rest on offer');
  let s = await save();
  ok(s.plan && s.plan.ids.length === 4 && s.plan.kind === null, 'no roster: four picks');
  await shot('p01-plan');

  // ---- the forecast arrives: a wet day pushes the outdoor jobs off the picks, not off the list ----
  await p.evaluate(() => { const t = G.today(); window.__weather(JSON.stringify({ home: false, daily: { time: [t], temperature_2m_max: [13.2], precipitation_sum: [11], precipitation_probability_max: [95], wind_speed_10m_max: [22] } })); });
  await p.waitForTimeout(500);
  s = await save(); m = await txt();
  const names = (ss) => ss.plan.ids.map((id) => ss.quests.find((q) => q.id === id).name);
  ok(s.weather && s.weather.max === 13.2 && /13°, wet/i.test(m), 'the plan header shows the forecast');
  ok(!names(s).some((n) => /Swim|Run|Mow/.test(n)) && /Swim/.test(m) && /Mow the lawn/.test(m), 'wet day: no swim, run or mowing among the picks (' + names(s).join(', ') + '), but they are still on offer');
  await shot('p02-wet');

  // ---- a day off in good weather: six picks, outdoor ones welcome ----
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs), t = G.today(); s.weather = { d: t, at: Date.now(), max: 24, rain: 0, prob: 5, wind: 10 }; localStorage.gs = JSON.stringify(s); });
  await roster([[58, 63]]);
  s = await save(); m = await txt();
  ok(s.plan.kind === 'off' && s.plan.ids.length === 6 && names(s).some((n) => /Swim|Run|Mow/.test(n)) && /day off/i.test(m) && /fine out/i.test(m), 'day off, fine: six picks with outdoor jobs (' + names(s).join(', ') + ')');
  await shot('p03-off');
  // ---- a long shift: one pick, and nothing hard ----
  await roster([[6, 18], [58, 63]]);
  s = await save();
  ok(s.plan.kind === 'long' && s.plan.ids.length === 1 && s.quests.find((q) => q.id === s.plan.ids[0]).diff <= 2, 'long shift: one easy pick (' + names(s).join(', ') + ')');
  // ---- a work day: three; swap one; then it holds still ----
  await roster([[16, 21.5], [58, 63]]);
  s = await save();
  ok(s.plan.kind === 'work' && s.plan.ids.length === 3, 'work day: three picks (' + names(s).join(', ') + ')');
  const first = s.plan.ids[0];
  await tap('[data-act="plan-swap"]'); await shot('p04-swap');
  await tap(`#modal [data-m="plan-swap-do"][data-id="${first}"]`);
  s = await save();
  ok(s.plan.ids.indexOf(first) < 0 && s.plan.ids.length === 3 && s.plan.swaps === 1, 'swapped one out for the next best');
  await roster([[58, 63]]);
  s = await save();
  ok(s.plan.ids.length === 3 && s.plan.swaps === 1, 'once touched, the plan holds still even if the day changes');

  // ---- clear it ----
  const gold0 = s.gold;
  for (let i = 0; i < 12; i++) {
    const id = await p.evaluate(() => { const st = G.planState(JSON.parse(localStorage.gs), G.today()); const q = st.dailies.concat(st.items).find((x) => !st.fin(x)); return q ? q.id : null; });
    if (!id) break;
    await tap(`.row[data-id="${id}"] [data-act="complete"]`); await p.waitForTimeout(350);
    for (let k = 0; k < 3; k++) if (await p.$('#modal:not(.hidden) .btn[data-m="close"]')) { await tap('#modal:not(.hidden) .btn[data-m="close"]'); await p.waitForTimeout(500); }
  }
  await p.waitForTimeout(2200);
  s = await save(); m = await txt();
  ok(s.plan.paid && s.planDays === 1 && s.log.some((e) => /^Plan cleared/.test(e.n)) && /PLAN CLEARED/i.test(m) && /ALSO ON OFFER/i.test(m), 'plan cleared: paid once, and the rest is still on offer');
  await shot('p05-cleared');
  const again = await p.evaluate(() => { const S0 = JSON.parse(localStorage.gs); return G.planClaim(S0, G.today(), Date.now()); });
  ok(again === null, 'it pays once a day');

  // ---- settings, and the library ----
  await tap('[data-act="tab"][data-v="records"]');
  await p.evaluate(() => { const b = [...document.querySelectorAll('#subtabs .sub')].find((x) => /settings/i.test(x.innerText)); if (b) b.click(); });
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => /TODAY.S PLAN/i.test(document.querySelector('#main').innerText) && document.querySelectorAll('[data-act="plan-n"]').length === 8 && !!document.querySelector('[data-act="weather-toggle"]')), 'settings: picks per kind of day, and the forecast switch');
  await p.evaluate(() => { document.querySelector('[data-act="weather-toggle"]').scrollIntoView({ block: 'center' }); }); await shot('p06-settings');
  const lib = await p.evaluate(() => { const r = G.LIBRARY.find((c) => c.k === 'reflect'), q = G.LIBRARY.find((c) => c.k === 'quit'); const all = [].concat.apply([], G.LIBRARY.map((c) => c.items.map((i) => i[0].toLowerCase()))); return { r: r.items.length, q: q.items.length, dup: all.length - new Set(all).size, qd: q.items.every((i) => i[2] === 'daily') }; });
  ok(lib.r === 18 && lib.q === 18 && lib.dup === 0 && lib.qd, 'the library has 18 reflective prompts and 18 habits to break, with no doubles');
  console.log(errs.join('\n') || 'no errors');
  ok(!errs.length, 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
