// 2.23: the end of the content, New Game+, paying the builders, and the daily summary.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s25/';
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
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const settle = async () => { for (let i = 0; i < 14; i++) { await p.waitForTimeout(350); if (!(await p.$('#modal:not(.hidden)'))) break; if (await p.$('[data-m="ngp-cont"]')) break; const cs = await p.$('[data-m="c-save"]'); if (cs) { await cs.click(); continue; } const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn'); if (c) await c.click(); } };
  await settle();
  // a new hero: nothing done yet, and the daily summary fills in as deeds are done
  const fresh = await p.evaluate(() => { const s = JSON.parse(localStorage.gs); return { st: G.contentState(s).list.map((x) => x.k + ':' + x.have + '/' + x.of), days: !!s.days }; });
  ok(fresh.st.join() === 'level:1/50,bosses:0/78,estate:0/24,land:0/6,town:0/11' && fresh.days, 'a new hero has the whole road ahead (' + fresh.st.join(' ') + ')');
  // the builders: a met challenge waits to be paid for
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.level = 12; s.gold = 5000; s.town = { open: true, own: { gym: true }, on: ['gym'], tier: { gym: 0 }, base: { gym: 0 }, cnt: {}, ready: { gym: true }, goldSeen: 5000 }; localStorage.gs = JSON.stringify(s); });
  await p.reload(); await p.waitForTimeout(1200); await settle();
  const pay = await p.evaluate(() => { const s = JSON.parse(localStorage.gs); const st = G.townState(G.normalize(s, G.today()), 'gym'); return { ready: st.ready, pay: st.pay, tier: st.tier }; });
  ok(pay.ready && pay.pay === 180 && pay.tier === 0, 'a met challenge waits for the builders (' + JSON.stringify(pay) + ')');
  const paid = await p.evaluate(() => { const s = JSON.parse(localStorage.gs); G.normalize(s, G.today()); const g0 = s.gold; const r = G.townPay(s, 'gym'); return { r, tier: s.town.tier.gym, spent: g0 - s.gold, ready: !!s.town.ready.gym }; });
  ok(paid.r && !paid.r.err && paid.tier === 1 && paid.spent === pay.pay && !paid.ready, 'paying the builders makes the reward his and sets the next challenge');
  // everything done: the statue, and the offer
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.gs);
    s.level = 50; s.delve.n = 78; s.gold = 100;
    Object.keys(G.ESTATE).forEach((k) => { s.estate.tiers[k] = 5; if (G.ESTATE[k].wing) s.estate.wings[k] = true; });
    s.estate.land = 6;
    s.town = { open: true, own: {}, on: [], tier: {}, base: {}, cnt: {}, ready: {}, goldSeen: 100 }; Object.keys(G.TOWN).forEach((k) => { s.town.own[k] = true; s.town.tier[k] = 5; });
    s.hero.name = 'Oldhand'; localStorage.gs = JSON.stringify(s);
  });
  await p.reload(); await p.waitForTimeout(1500);
  // a deed so save() runs
  for (let i = 0; i < 20 && !(await p.$('[data-m="ngp-cont"]')); i++) { await p.waitForTimeout(400); const c = await p.$('#modal:not(.hidden) [data-m="close"].btn, #modal:not(.hidden) .btn.prime:not([data-m="ngp-ask"])'); if (c && !(await p.$('[data-m="ngp-cont"]'))) await c.click(); else if (!c) { await p.evaluate(() => { const b = document.querySelector('[data-act="done"], .qrow [data-act="tick"]'); if (b) b.click(); }); } }
  const offer = await p.evaluate(() => ({ txt: (document.querySelector('#modal') || {}).innerText || '', s: JSON.parse(localStorage.gs) }));
  await p.screenshot({ path: OUT + 'end-offer.png' });
  ok(/EVERYTHING DONE/.test(offer.txt) && /New Game\+/.test(offer.txt) && /Keep going/.test(offer.txt), 'everything done brings the offer: New Game+ or keep going');
  ok(offer.s.complete && offer.s.complete.on && offer.s.decor.owned.indexOf('victor') >= 0, 'and the Victor’s Statue');
  // New Game+
  await p.click('[data-m="ngp-ask"]'); await p.waitForTimeout(500);
  { const tx = await p.evaluate(() => document.body.innerText); ok(/begin new game\+\?/i.test(tx), 'New Game+ asks first'); if (!/begin new game/i.test(tx)) console.log('SHEET TEXT', tx.slice(0, 300)); }
  const q0 = offer.s.quests.length, birds0 = offer.s.npcs.filter((n) => n.kind === 'bird').length, set0 = JSON.stringify([offer.s.settings.remindHour, offer.s.settings.sound, offer.s.settings.nudgeDays]);
  await p.click('[data-m="ngp-go"]'); await p.waitForTimeout(1500); await settle();
  const ng = await p.evaluate(() => { const s = JSON.parse(localStorage.gs); return { level: s.level, gold: s.gold, n: s.delve ? s.delve.n : null, q: s.quests.length, birds: s.npcs.filter((n) => n.kind === 'bird').length, legacy: s.legacy, owned: s.decor.owned, placed: (s.house && s.house.items || []).filter((it) => it.k === 'relic').map((it) => it.r), settings: JSON.stringify([s.settings.remindHour, s.settings.sound, s.settings.nudgeDays]), name: s.hero.name, backup: Object.keys(localStorage).filter((k) => /before-ngp/.test(k)).length }; });
  console.log(JSON.stringify(Object.assign({}, ng, { legacy: ng.legacy && ng.legacy.length })), 'before:', q0, birds0, set0);
  ok(ng.level === 1 && ng.gold === 0 && !ng.n, 'New Game+ starts the hero over');
  ok(ng.q === q0 && ng.birds === birds0 && ng.settings === set0 && ng.name === 'Oldhand', 'his deeds, birds, settings and name come with him');
  ok(ng.legacy && ng.legacy.length === 1 && ng.legacy[0].name === 'Oldhand' && ng.legacy[0].level === 50 && ng.owned.indexOf('legacy1') >= 0, 'the old hero is remembered, and his statue is his');
  ok(ng.backup === 1, 'a copy of the old save was kept first');
  const img = await p.evaluate(async () => { const c = await window.__relicImage('legacy1'); if (!c) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return { w: c.width, h: c.height, n }; });
  ok(img && img.n > 300, 'the statue is drawn from his own figure (' + JSON.stringify(img) + ')');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await b.close();
})();
