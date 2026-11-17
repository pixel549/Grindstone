// 2.24: the town walked round. Talking (keepers, companions, folk, signs), going in and out, building a companion's
// cottage and a room in it with the house tools, settling them in, the gate home, and that it all saves.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s26/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const cx_ = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true }); const p = await cx_.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.0', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {}, heraldInfo: () => JSON.stringify({ perm: false, cals: [] }), rosterEvents: () => '[]',
      backupWrite: () => 'ok', widgetInfo: () => JSON.stringify({ placed: false }), interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(600);
  await p.click('[data-m="c-save"]');
  const settle = async () => { for (let i = 0; i < 14; i++) { await p.waitForTimeout(350); if (!(await p.$('#modal:not(.hidden)'))) break; const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn'); if (c) await c.click().catch(() => {}); } };
  await settle();
  const tap = async (sel) => { const el = await p.$(sel); if (!el) { console.log('MISSING ' + sel); fails++; return false; } await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(450); return true; };
  const save = () => p.evaluate(() => JSON.parse(localStorage.gs));
  const set = async (fn) => { await p.evaluate(fn); await p.evaluate(() => window.onResume()); await p.waitForTimeout(500); };
  // a hero at level 12 with the town open, the gym and the track, two companions in and one looking for work
  await set(() => {
    const s = JSON.parse(localStorage.gs); s.gold = 5000; s.level = 12; s.total = 50; s.town = { open: true, own: { gym: 1, track: 1 }, on: ['gym', 'track'] };
    s.npcs.filter((n) => n.comp).slice(0, 3).forEach((n) => { n.status = 'resident'; });
    [['pedlar', 'Peria', 120, 'waiting'], ['bard', 'Caeldric', 220, 'resident']].forEach((w) => s.npcs.push({ id: 'w-' + w[0], kind: 'human', name: w[1], look: G.randomLook(), garb: 'plain', hat: 'none', about: 'Sells string and gossip.', status: w[3], via: { type: 'gold', gold: w[2] }, role: 'scout', el: 'storm' }));
    delete s.season; localStorage.gs = JSON.stringify(s);
  });
  await settle();
  await tap('[data-act="tab"][data-v="hearth"]');
  await tap('#subtabs .sub[data-v="town"]');
  await p.waitForSelector('#t2slot.ready', { timeout: 20000 }); await p.waitForTimeout(1200);
  await shot('m01-town');
  ok(await p.evaluate(() => !!window.__town.inst && window.__town.inst.scene === 'town' && document.querySelectorAll('[data-act="town"]').length === 11), 'the map sits over the list of buildings');
  const ppl = await p.evaluate(() => window.__town.inst.people.map((a) => a.id));
  ok(ppl.indexOf('n:w-bard') >= 0 && ppl.indexOf('n:w-pedlar') >= 0 && ppl.indexOf('k:gym') >= 0 && ppl.some((x) => x.indexOf('f:') === 0), 'companions, the one looking for work, a keeper and townsfolk are all about (' + ppl.length + ')');

  // ---- talking: the box, a page at a time ----
  const talk = async (id, walk) => {
    if (!walk) await p.evaluate((i) => { const t = window.__town.inst, a = t.people.find((x) => x.id === i); if (!a || a.p.scene !== t.scene) return; a.path = []; const [cx, cy] = t._cellOf(a), c = t._nearestOk(cx, cy + 1); if (c) { t.hero.x = c[0] * 32 + 16; t.hero.y = c[1] * 32 + 16; t.hero.path = []; } }, id);
    await p.evaluate((i) => window.__town.inst.talkTo(i), id); for (let i = 0; i < 100; i++) { await p.waitForTimeout(200); if (await p.evaluate(() => window.__talk.open)) break; } await p.waitForTimeout(300); };
  const page = () => p.evaluate(() => ({ name: document.querySelector('#talk .talk-name').textContent, text: document.querySelector('#talk .talk-text').textContent, ch: [...document.querySelectorAll('#talk .tk')].map((b) => b.dataset.tk), open: window.__talk.open }));
  const closeTalk = async () => { for (let i = 0; i < 8; i++) { if (!(await page()).open) return; const pg0 = await page(); if (pg0.ch.length) { await tap('#talk .tk:last-child'); continue; } await tap('#talk .talk-box'); } };
  const through = async () => { for (let i = 0; i < 12; i++) { const pg = await page(); if (!pg.open || pg.ch.length) { await p.waitForTimeout(400); return pg; } await tap('#talk .talk-box'); } return page(); };
  await talk('n:w-bard', true);
  let pg = await page();
  ok(pg.open && pg.name === 'Caeldric' && /plot/i.test(pg.text), 'tapping a companion walks him over and opens the box: ' + pg.text.slice(0, 60));
  await shot('m02-talk');
  pg = await through();
  ok(pg.ch.indexOf('home:w-bard') >= 0, 'the last page offers to build their cottage');
  const g0 = (await save()).gold;
  await tap('#talk [data-tk="home:w-bard"]');
  let s = await save();
  ok(s.homes && s.homes['w-bard'] && s.homes['w-bard'].built && s.gold === g0 - 250 && s.homes['w-bard'].house.rooms.length === 1, 'the cottage is built for ◈ 250, one bedroom');
  await p.waitForTimeout(600); pg = await page();
  ok(pg.open && /roof/i.test(pg.text), 'they say thanks');
  await closeTalk();
  ok(await p.evaluate(() => window.__town.inst.objs.some((o) => o.lot && o.lot.id === 'home:w-bard')), 'the cottage stands on the map');
  await shot('m03-cottage', 900);

  // ---- someone looking for work ----
  await talk('n:w-pedlar'); pg = await through();
  ok(pg.ch.indexOf('invite:w-pedlar') >= 0, 'the pedlar asks for work, and the price');
  await tap('#talk [data-tk="invite:w-pedlar"]');
  s = await save();
  ok(s.npcs.find((n) => n.id === 'w-pedlar').status === 'resident' && s.homes['w-pedlar'] && !s.homes['w-pedlar'].built, 'they join, with no rooms of his house wanted, and get a plot of their own');
  await closeTalk();

  // ---- townsfolk: hints, then small talk; the gossip sells what the dungeon can't stand ----
  const folk = await p.evaluate(() => window.__town.inst.people.filter((a) => a.id.indexOf('f:') === 0).map((a) => a.id));
  let heardHint = false, gossiped = false, barks = 0;
  for (const f of folk.concat(folk.slice(0, 3))) {
    await talk(f); const hint0 = await p.evaluate(() => !!(window.__talk.d && window.__talk.d.hint && window.__talk.d.hint !== 'gossip')); pg = await through();
    if (pg.ch.indexOf('gossip') >= 0) { const gg = (await save()).gold; await tap('#talk [data-tk="gossip"]'); await p.waitForTimeout(500); const pg2 = await page(); gossiped = /can’t stand/.test(pg2.text) && (await save()).gold < gg; await closeTalk(); continue; }
    if (hint0) heardHint = true; else barks++;
    await closeTalk();
  }
  ok(heardHint && barks > 0, 'townsfolk pass on hints, then fall back on small talk (' + barks + ' barks)');
  ok(gossiped || !(await p.evaluate(() => G.gossipFor(JSON.parse(localStorage.gs)))), 'a drink for the gossip tells what the next dungeon can’t stand');

  // ---- into the gym by tapping its door ----
  const tapWorld = async (wx, wy) => {
    const xy = await p.evaluate(([x, y]) => { const t = window.__town.inst, v = t.view, r = t.canvas.getBoundingClientRect(); return [r.left + (v.ox + x * v.k) / t.dpr, r.top + (v.oy + y * v.k) / t.dpr]; }, [wx, wy]);
    await p.touchscreen.tap(xy[0], xy[1]);
  };
  await p.evaluate(() => { const t = window.__town.inst; t.goScene('town', [5, 19]); });
  await p.waitForTimeout(800);
  await tapWorld(5 * 32 + 16, 15 * 32);
  for (let i = 0; i < 30; i++) { await p.waitForTimeout(300); if (await p.evaluate(() => window.__town.inst.scene === 'in:gym')) break; }
  ok(await p.evaluate(() => window.__town.inst.scene === 'in:gym' && /Brannoc/.test(document.querySelector('#t2where').innerText)), 'tapping the gym walks him to its door and in');
  await shot('m04-gym', 900);
  await talk('k:gym'); pg = await through();
  ok(/Brannoc/.test(pg.name) && pg.ch.indexOf('card:gym') >= 0 && pg.ch.indexOf('close:gym') >= 0, 'the keeper sets out the challenge, with the ladder and closing up on offer');
  await tap('#talk [data-tk="bye"]');
  await tap('[data-act="t2-out"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => window.__town.inst.scene === 'town'), 'Leave puts him back on Mill Lane');

  // ---- visiting the cottage, and building with the house tools ----
  await talk('n:w-bard'); pg = await through();
  ok(pg.ch.indexOf('visit:w-bard') >= 0 && /lounge/i.test((await p.evaluate(() => window.__talk.d.pages.join(' ')))), 'the bard wants a lounge, and asks him in');
  await tap('#talk [data-tk="visit:w-bard"]');
  await p.waitForTimeout(1500);
  ok(await p.evaluate(() => /Caeldric’s house/.test(document.querySelector('#main').innerText) && window.__house.inst && window.__house.inst.o.house.rooms.length === 1), 'inside: the hearth view shows their house, one room');
  await shot('m05-visit', 900);
  const mine0 = (await save()).house.rooms.length;
  const G_ROOM = (r) => 10 + 5 * (r.x1 - r.x0 + 1) * (r.y1 - r.y0 - 2);
  await tap('[data-act="h3-build"]');
  await tap('[data-act="b-room"]');
  await p.evaluate(() => { const b = document.querySelector('#modal [data-m="nr-purpose"][data-v="lounge"]'); if (b) b.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#modal [data-m="nr-preset"]')].find((x) => +x.dataset.w * (+x.dataset.d + 3) >= 20); if (b) b.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('#modal [data-m="nr-go"]'); if (b) b.click(); });
  await p.waitForTimeout(300);
  const g1 = (await save()).gold;
  await p.evaluate(() => window.__house.inst.o.onBuildTap({ x: 5, y: 5, item: null, room: null, kind: 'out' }));
  await p.waitForTimeout(1400);
  s = await save();
  const lounge = s.homes['w-bard'].house.rooms.find((r) => r.purpose === 'lounge');
  ok(s.homes['w-bard'].house.rooms.length === 2 && lounge && s.house.rooms.length === mine0 && s.homes['w-bard'].house.items.some((it) => it.k === 'bed'), 'a lounge goes into their house; the bed stays put; his own house is untouched');
  ok(!!s.homes['w-bard'].settled && s.gold === g1 - G_ROOM(lounge) + 110, 'with the lounge in, the bard settles in and chips in ◈ 110 (the room paid from his purse)');
  ok(await p.evaluate(() => /SETTLED IN/.test((document.querySelector('#modal:not(.hidden)') || { innerText: '' }).innerText)), 'and says so');
  await shot('m06-build', 200);
  await settle();
  await tap('[data-act="b-done"]');
  await tap('[data-act="visit-back"]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !document.querySelector('.visit-bar') && !!document.querySelector('#t2slot') && window.__town.inst.scene === 'town'), 'Back to town, standing at their door');
  ok(await p.evaluate(() => { const S0 = JSON.parse(localStorage.gs); G.normalize(S0, G.today()); return G.compFor(Object.assign(S0, { delve: Object.assign(S0.delve, { comp: 'w-bard' }) })).settled === true; }), 'a settled companion fights a little harder');

  // ---- the gate home ----
  await p.evaluate(() => window.__town.inst.goScene('town', [21, 42]));
  await p.waitForTimeout(500);
  await p.evaluate(() => window.__town.inst.walkTo(21, 45));
  for (let i = 0; i < 20; i++) { await p.waitForTimeout(300); if (await p.evaluate(() => window.__talk.open)) break; }
  pg = await through();
  ok(pg.ch.indexOf('home') >= 0, 'walking out the south gate offers the road home');
  await tap('#talk [data-tk="home"]');
  ok(await p.evaluate(() => document.querySelector('#subtabs .sub.on').dataset.v === '' && !!document.querySelector('#h3slot')), 'and takes him home');

  // ---- it all keeps ----
  await p.reload(); await p.waitForTimeout(1500); await settle();
  s = await save();
  ok(s.homes['w-bard'].built && s.homes['w-bard'].house.rooms.length === 2 && s.homes['w-pedlar'], 'homes keep across a restart');
  await tap('[data-act="tab"][data-v="hearth"]'); await tap('#subtabs .sub[data-v="town"]');
  await p.waitForSelector('#t2slot.ready', { timeout: 20000 });
  ok(true, 'the town comes back after a restart');
  errs.forEach((e) => console.log(e));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
