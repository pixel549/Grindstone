// 2.19: your week, bonus buffs, and the stats page in the delve, driven by finger taps.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s24/';
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
  const closeCards = async () => { for (let k = 0; k < 5; k++) if (await p.$('#modal:not(.hidden) .btn[data-m="close"]')) { await tap('#modal:not(.hidden) .btn[data-m="close"]'); await p.waitForTimeout(600); } };
  await set(() => { const s = JSON.parse(localStorage.gs); s.town = { open: true }; delete s.plan; delete s.weather; delete s.life; localStorage.gs = JSON.stringify(s); });

  // ---- the stats page says what each stat does in the delve ----
  await tap('[data-act="tab"][data-v="status"]');
  const lines = await p.evaluate(() => [...document.querySelectorAll('.adl')].map((x) => x.innerText));
  ok(lines.length === 5 && /attack/.test(lines.join()) && /health/.test(lines.join()) && /defence/.test(lines.join()) && /flask/.test(lines.join()) && /MP/.test(lines.join()), 'each stat says what it does in the delve');
  await p.evaluate(() => document.querySelectorAll('.adl')[2].scrollIntoView({ block: 'center' })); await shot('l01-stats');

  // ---- the questionnaire ----
  await tap('[data-act="tab"][data-v="quests"]'); await tap('#subtabs .sub[data-v="today"]');
  ok(await p.evaluate(() => !!document.querySelector('.lifecard')), 'a card offers to fit the plan to your week');
  await tap('.lifecard [data-act="life"]'); await shot('l02-life');
  const wd = await p.evaluate(() => (new Date(G.today() + 'T12:00').getDay() + 6) % 7);
  const binDay = (wd + 1) % 7;   // bins collected tomorrow, out tonight
  await tap(`#modal [data-m="life-pick"][data-k="bin"][data-v="${binDay}"]`);
  await tap('#modal [data-m="life-pick"][data-k="eve"][data-v="true"]');
  await tap('#modal [data-m="life-pick"][data-k="payEvery"][data-v="14"]');
  await p.evaluate(() => { document.querySelector('#life-pay').value = G.addDays(G.today(), -14); });
  await tap(`#modal [data-m="life-pick"][data-k="shop"][data-v="${(wd + 3) % 7}"]`);
  ok(await p.evaluate(() => document.querySelector('#life-pay').value === G.addDays(G.today(), -14)), 'the payday date survives picking another answer');
  await shot('l03-life-filled');
  await tap('#modal [data-m="life-save"]');
  let s = await save();
  ok(s.life.asked && s.life.bin === binDay && s.life.eve === true && s.life.payEvery === 14 && s.life.payLast && s.life.shop === (wd + 3) % 7, 'saved: bins, payday, shop day');
  ok(await p.evaluate(() => !document.querySelector('.lifecard')), 'the card goes once answered');

  // ---- what it does: bins tonight and the budget on payday make the plan; the dentist never does ----
  const r = await p.evaluate(() => {
    const S0 = JSON.parse(localStorage.gs); G.normalize(S0, G.today()); G.normDelve(S0);
    const mk = (n, st) => { const q = G.newQuest(S0, { name: n, icon: 'x', type: 'habit', stat: st, diff: 2 }); S0.quests.push(q); return q; };
    const bins = mk('Take the bins out', 'DIS'), dent = mk('Dentist', 'VIT'), bud = mk('Check the bank and budget', 'INT');
    delete S0.plan; const t = G.today(), st = G.planState(S0, t), ids = st.plan.ids;
    const tomorrow = G.addDays(t, 2); delete S0.plan; S0.log = S0.log.slice();
    const later = G.planRank ? null : null;
    // a weekly that asks for the bins twice gets brought down to once
    S0.trials.list.push({ id: 'trx', kind: 'count', title: 'Take the bins out × 2', filter: { type: 'quest', id: bins.id }, target: 2, gold: 40, start: S0.trials.week, end: G.addDays(S0.trials.week, 6), progress: 0 });
    G.weekliesFit(S0, t);
    const fixed = S0.trials.list.find((g) => g.id === 'trx');
    return { bins: ids.indexOf(bins.id) >= 0, why: st.plan.why[bins.id], bud: ids.indexOf(bud.id) >= 0, dent: ids.indexOf(dent.id) >= 0, off: G.lifeOn(S0, bins, G.addDays(t, 3)), fixed: fixed.target + ' ' + fixed.title, cap: G.questWeekCap(S0, dent, t) };
  });
  ok(r.bins && r.why === 'bin night' && r.bud && !r.dent && r.off === 'off' && r.cap === 0, 'bin night and payday make the plan; the dentist never does (' + JSON.stringify(r) + ')');
  ok(r.fixed === '1 Take the bins out, once', 'a weekly asking for the bins twice comes down to once');

  // ---- bonus buffs: all dailies, every pick ----
  await set(() => { const s = JSON.parse(localStorage.gs); delete s.plan; delete s.bonus; localStorage.gs = JSON.stringify(s); });
  await tap('[data-act="tab"][data-v="quests"]'); await tap('#subtabs .sub[data-v="today"]');
  for (let i = 0; i < 14; i++) {
    const id = await p.evaluate(() => { const st = G.planState(JSON.parse(localStorage.gs), G.today()); const q = st.dailies.concat(st.items).find((x) => !st.fin(x)); return q ? q.id : null; });
    if (!id) break;
    await tap(`.row[data-id="${id}"] [data-act="complete"]`); await p.waitForTimeout(350);
    await closeCards();
  }
  await p.waitForTimeout(2000);
  const toastTxt = await p.evaluate(() => [...document.querySelectorAll('.toast')].map((x) => x.innerText).join(' | '));
  s = await save();
  ok(s.bonus && s.bonus.dailies && s.bonus.plan && s.bonus.dailies.type === 'ready' && s.bonus.plan.type === 'edge', 'both bonus buffs earned (' + toastTxt.slice(0, 160) + ')');
  await tap('[data-act="tab"][data-v="delve"]');
  const bf = await p.evaluate(() => { const hd = [...document.querySelectorAll('.hd')].find((x) => /Buffs up now/i.test(x.innerText)); hd && hd.scrollIntoView({ block: 'start' }); return { hd: hd ? hd.innerText : '', all: document.querySelector('#main').innerText }; });
  ok(/\+ bonus/i.test(bf.hd) && /All dailies done/i.test(bf.all) && /Every pick done/i.test(bf.all), 'the delve lists them as bonus buffs');
  await shot('l04-buffs');
  const inD = await p.evaluate(() => { const S0 = JSON.parse(localStorage.gs); const i = G.inputFor(S0, {}); return i.buffs.filter((b) => b.bonus).length; });
  ok(inD >= 2, 'and they go into the next run (' + inD + ')');

  // ---- the old roads: one foe a strike, unless it's an axe's cleave ----
  const one = await p.evaluate(() => {
    const S0 = JSON.parse(localStorage.gs); G.normalize(S0, G.today()); G.normDelve(S0); S0.delve.n = 3;
    const st = G.duelNew(G.sparInput(S0, 2, { t: 9 }), 3);
    st.grp = [0, 1, 2].map((k) => ({ id: 'e' + k, name: 'Rat', hp: 999, max: 999, atk: 1, tags: [], el: null, it: { k: 'hit' } })); st.tgt = 'e1';
    st.H.fx = {}; G.duelAct(st, 'strike', 'e1');
    const hit = st.grp.filter((e) => e.hp < 999).map((e) => e.id);
    st.H.kind = 'axe'; st.mp = 20; st.artUsed = false; G.duelAct(st, 'art', 'e0');
    return { hit: hit, after: st.grp.filter((e) => e.hp < 999).length };
  });
  ok(one.hit.length === 1 && one.hit[0] === 'e1' && one.after === 3, 'a strike hits the one you picked; an axe’s cleave hits them all');
  console.log(errs.join('\n') || 'no errors');
  ok(!errs.length, 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
