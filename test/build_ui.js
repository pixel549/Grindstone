// 2.1: the likeness redo, build mode (move, rooms, doors, buying and placing), Ruby and Kermit, a new person moving in on a vow.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s14/';
fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.625 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.1', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {},
      heraldInfo: () => JSON.stringify({ perm: false, write: false, cals: [] }), askCalendar: () => {}, heraldArm: () => {}, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: false }), widgetFrames: () => true, interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  // a 2.0 save: looks set, a relic out in the lounge, no house layout yet
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => {
    const t = G.today(), s = G.normalize(null, t);
    s.lookSet = true; s.look = Object.assign(s.look, { sex: 'f', hair: 'long', beard: 'none', extra: 'none', hairColour: '#4a2f1f', skin: '#e3b48f' });
    s.hero.name = 'Jake'; s.gold = 900; s.level = 6; delete s.season; s.created = G.addDays(t, -40);
    s.decor = { owned: ['plant', 'map'], placed: { loungeF: 'plant', studyW: 'map' } };
    delete s.house; delete s.houseV; delete s.npcs; delete s.npcsV; delete s.lookV;
    localStorage.gs = JSON.stringify(s);
  });
  await p.reload();
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  // 1. the likeness, again
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(900);
  const title = await p.evaluate(() => document.querySelector('#modal h3').innerText);
  ok(/better likeness/i.test(title), 'likeness redo opens on a 2.0 save: ' + title);
  const pre = await p.evaluate(() => ({ hair: document.querySelector('[data-k="hair"].on').dataset.v, beard: document.querySelector('[data-k="beard"].on').dataset.v, extra: document.querySelector('[data-k="extra"].on').dataset.v }));
  ok(pre.hair === 'bald' && pre.beard === 'beard' && pre.extra === 'glasses', 'prefilled bald, beard, glasses: ' + JSON.stringify(pre));
  await shot('b01-likeness');
  await p.click('[data-m="c-save"]');
  await p.waitForTimeout(500);
  const after = await p.evaluate(() => { const s = JSON.parse(localStorage.gs); return { look: s.look, lv: s.lookV, gold: s.gold, level: s.level, ask: s.lookAsk }; });
  ok(after.lv === 1 && !after.ask && after.gold === 900 && after.level === 6 && after.look.hair === 'bald', 'saved, progress kept: ' + JSON.stringify({ lv: after.lv, gold: after.gold, level: after.level, hair: after.look.hair }));
  const relics = await p.evaluate(() => JSON.parse(localStorage.gs).house.items.filter((i) => i.k === 'relic').map((i) => i.r + '@' + i.x + ',' + i.y));
  ok(relics.length === 2, '2.0 relics carried into the layout: ' + relics.join(' '));
  const clear = async () => { for (let i = 0; i < 8; i++) { await p.waitForTimeout(300); const open = await p.$('#modal:not(.hidden)'); if (!open) return; const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn'); if (c) await c.click().catch(() => {}); else await p.click('#modal .scrim').catch(() => {}); } };
  await clear();
  // 2. the hearth, and build mode
  await p.click('[data-act="tab"][data-v="hearth"]');
  await p.waitForFunction(() => window.__house.inst && window.__house.inst.hero && document.querySelector('.h3-stage.ready'), null, { timeout: 30000 });
  await shot('b02-hearth-stars', 1200);
  await p.click('[data-act="h3-build"]');
  await p.waitForSelector('#bld .bld-tools');
  // tap a cell on the canvas, as a finger would
  const cellAt = async (cx, cy) => p.evaluate(([cx, cy]) => {
    const h = window.__house.inst, v = h.view, r = h.canvas.getBoundingClientRect(), d = h.dpr || 1;
    return { x: r.left + (v.ox + (cx * 32 + 16) * v.k) / d, y: r.top + (v.oy + (cy * 32 + 16) * v.k) / d };
  }, [cx, cy]);
  const look = async (cx, cy) => { await p.evaluate(([cx, cy]) => { const h = window.__house.inst; h.cam.x = cx * 32 + 16; h.cam.y = cy * 32 + 16; h.cam.manual = 1e9; }, [cx, cy]); await p.waitForTimeout(250); };
  const tap = async (cx, cy) => { const c = await cellAt(cx, cy); await p.mouse.click(c.x, c.y); await p.waitForTimeout(280); };
  const msg = () => p.evaluate(() => document.querySelector('.bld-msg').innerText);
  // move the armchair: pick it up, try a wall, then somewhere good
  await look(13, 9);
  await tap(15, 8);
  ok(/armchair/i.test(await msg()), 'picked up the armchair: ' + await msg());
  await shot('b03-armchair-picked');
  await tap(14, 2);
  ok(/wall/i.test(await msg()), 'refuses a wall: ' + await msg());
  await tap(10, 10);
  const ac = await p.evaluate(() => JSON.parse(localStorage.gs).house.items.find((i) => i.k === 'armchair'));
  ok(ac.x === 10 && ac.y === 10, 'armchair moved to 10,10: ' + ac.x + ',' + ac.y);
  await shot('b04-armchair-moved');
  await p.click('[data-act="b-undo"]'); await p.waitForTimeout(300);
  const ac2 = await p.evaluate(() => JSON.parse(localStorage.gs).house.items.find((i) => i.k === 'armchair'));
  ok(ac2.x === 15 && ac2.y === 8, 'undo puts it back: ' + ac2.x + ',' + ac2.y);
  // 3. a room for the birds, in the yard
  await p.click('[data-act="b-room"]');
  await p.waitForSelector('#modal:not(.hidden) [data-m="nr-go"]');
  await p.click('[data-m="nr-preset"][data-w="12"]'); await p.waitForTimeout(150);
  await p.click('[data-m="nr-preset"][data-w="5"]'); await p.waitForTimeout(150);
  for (let i = 0; i < 2; i++) { await p.click('[data-m="nr-size"][data-d="w"][data-v="1"]'); await p.waitForTimeout(120); }
  await p.click('[data-m="nr-purpose"][data-v="birdroom"]'); await p.waitForTimeout(150);
  await shot('b05a-room-shop');
  const gold0 = await p.evaluate(() => JSON.parse(localStorage.gs).gold);
  await p.click('[data-m="nr-go"]'); await p.waitForTimeout(250);
  await look(10, 20);
  await tap(10, 20);
  ok(/Bought: 7 × 3 bird room for 115 gold, door included/.test(await msg()), 'bought by size: ' + await msg());
  ok(gold0 - await p.evaluate(() => JSON.parse(localStorage.gs).gold) === 115, 'and paid for');
  await tap(9, 20);
  await p.waitForSelector('#modal:not(.hidden) #rm-name');
  await p.fill('#rm-name', 'Bird room');
  await p.click('[data-m="rm-style"][data-v="timber"]'); await p.waitForTimeout(300);
  await shot('b05-room-sheet');
  await p.click('[data-m="rm-save"]'); await p.waitForTimeout(300);
  const room = await p.evaluate(() => JSON.parse(localStorage.gs).house.rooms.find((r) => r.name === 'Bird room'));
  ok(room && room.style === 'timber' && room.x0 === 7 && room.y1 === 22, 'bird room built: ' + JSON.stringify(room));
  // doors
  await p.click('[data-act="b-tool"][data-v="door"]');
  await tap(13, 20);
  const doors = await p.evaluate(() => JSON.parse(localStorage.gs).house.doors.filter((d) => (d[0] === 10 && d[1] === 22) || (d[0] === 13 && d[1] === 20)).length);
  ok(doors === 2, 'two doors in: ' + doors);
  await tap(7, 17);
  ok(/corner/i.test(await msg()), 'no doors in corners: ' + await msg());
  await shot('b06-doors');
  // 4. buy and place bird gear
  await p.click('[data-act="b-add"]'); await p.waitForSelector('#modal:not(.hidden) .row.furn'); await p.waitForTimeout(700);
  await shot('b07-catalogue');
  const goldBefore = await p.evaluate(() => JSON.parse(localStorage.gs).gold);
  await p.click('[data-m="b-buy"][data-k="perch"]'); await p.waitForTimeout(300);
  await tap(9, 19);
  await p.click('[data-act="b-add"]'); await p.waitForSelector('#modal:not(.hidden) .row.furn');
  await p.click('[data-m="b-buy"][data-k="nightcage"]'); await p.waitForTimeout(300);
  await tap(11, 21);
  await p.click('[data-act="b-add"]'); await p.waitForSelector('#modal:not(.hidden) .row.furn');
  await p.click('[data-m="b-buy"][data-k="playgym"]'); await p.waitForTimeout(300);
  await tap(11, 19);
  await p.click('[data-act="b-add"]'); await p.waitForSelector('#modal:not(.hidden) .row.furn');
  await p.click('[data-m="b-buy"][data-k="swing"]'); await p.waitForTimeout(300);
  await tap(8, 21);
  await p.click('[data-act="b-add"]'); await p.waitForSelector('#modal:not(.hidden) .row.furn');
  await p.click('[data-m="b-buy"][data-k="dish"]'); await p.waitForTimeout(300);
  await tap(12, 21);
  const gear = await p.evaluate(() => JSON.parse(localStorage.gs).house.items.filter((i) => ['perch', 'nightcage', 'playgym', 'swing', 'dish'].indexOf(i.k) >= 0).map((i) => i.k + '@' + i.x + ',' + i.y));
  const goldAfter = await p.evaluate(() => JSON.parse(localStorage.gs).gold);
  ok(gear.length === 5, 'bird gear placed: ' + gear.join(' '));
  ok(goldBefore - goldAfter === 40 + 90 + 120 + 30 + 10, 'paid ' + (goldBefore - goldAfter) + ' gold');
  // store the dish, then put it back out from storage (it is still selected from being placed; tapping it again would put it down)
  if (!(await p.$('[data-act="b-store"]'))) await tap(12, 21);
  await p.click('[data-act="b-store"]'); await p.waitForTimeout(300);
  await p.click('[data-act="b-add"]'); await p.waitForSelector('#modal:not(.hidden) [data-m="b-put"][data-k="dish"]');
  await p.click('[data-m="b-put"][data-k="dish"]'); await p.waitForTimeout(300);
  await tap(9, 21);
  const dish = await p.evaluate(() => JSON.parse(localStorage.gs).house.items.find((i) => i.k === 'dish'));
  ok(dish && dish.x === 9 && dish.y === 21, 'stored and put back out: ' + (dish && dish.x + ',' + dish.y));
  await shot('b08-bird-room-built');
  await p.click('[data-act="b-done"]'); await p.waitForTimeout(500);
  // 5. Ruby and Kermit
  await p.click('[data-act="hh-page"]'); await p.waitForTimeout(900);
  await shot('b09-household');
  await p.click('[data-m="hh-npc"][data-k="kermit"]'); await p.waitForSelector('#modal:not(.hidden) [data-m="npc-home"]');
  const rid = room.id;
  await p.click(`[data-m="npc-home"][data-v="${rid}"]`); await p.waitForTimeout(300);
  await p.click('#modal .btn.prime'); await p.waitForTimeout(300);
  if (!(await p.$('#modal:not(.hidden) [data-m="hh-npc"][data-k="ruby"]'))) { await p.click('[data-act="hh-page"]'); await p.waitForTimeout(700); }
  await p.click('[data-m="hh-npc"][data-k="ruby"]'); await p.waitForSelector('#modal:not(.hidden) [data-m="npc-home"]');
  await p.click(`[data-m="npc-home"][data-v="${rid}"]`); await p.waitForTimeout(400);
  const banish = await p.evaluate(() => document.querySelector('#modal').innerText);
  ok(/won.t have her/i.test(banish), 'Kermit banishes Ruby from his room');
  await shot('b10-ruby-card');
  await p.click('[data-m="npc-home"][data-v="aviary"]'); await p.waitForTimeout(300);
  await p.click('#modal .btn.prime'); await p.waitForTimeout(300);
  // look at the bird room with the birds in it
  await p.evaluate(() => { const h = window.__house.inst; for (let i = 0; i < 80; i++) h._updateBirds(0.1); h.cam.x = 10 * 32 + 16; h.cam.y = 19.5 * 32; h.cam.manual = 1e9; h.k = 3; });
  await shot('b11-kermit-at-home', 800);
  // 6. someone moves in on a vow
  if (!(await p.$('#modal:not(.hidden) [data-m="hh-new"]'))) { await p.click('[data-act="hh-page"]'); await p.waitForTimeout(700); }
  await p.click('[data-m="hh-new"]'); await p.waitForSelector('#modal:not(.hidden) #n-about'); await p.waitForTimeout(900);
  await p.fill('#c-name', 'Mum');
  await p.click('[data-m="c-set"][data-k="sex"][data-v="f"]'); await p.waitForTimeout(200);
  await p.fill('#n-about', 'My mum');
  await p.click('[data-m="n-garb"][data-v="coat"]'); await p.waitForTimeout(200);
  await p.click('[data-m="n-via"][data-v="vow"]'); await p.waitForTimeout(600);
  const about = await p.inputValue('#n-about');
  ok(about === 'My mum', 'about survives a re-render: ' + about);
  await shot('b12-npc-editor');
  await p.click('[data-m="n-save"]'); await p.waitForTimeout(500);
  const mum = await p.evaluate(() => JSON.parse(localStorage.gs).npcs.find((n) => n.name === 'Mum'));
  ok(mum && mum.status === 'waiting' && mum.via.type === 'vow', 'Mum is waiting on a vow');
  await p.click('[data-act="tab"][data-v="quests"]'); await p.click('[data-act="sub"][data-v="vows"]'); await p.waitForTimeout(300);
  await p.click('[data-act="new-vow"]'); await p.waitForSelector('#v-title');
  await p.fill('#v-title', 'Ring Mum every Sunday for a month');
  await p.click('[data-m="v-kind"][data-v="manual"]'); await p.waitForTimeout(200);
  await p.selectOption('#v-npc', mum.id);
  await shot('b13-vow-editor');
  await p.click('[data-m="v-save"]'); await p.waitForTimeout(400);
  const rowTxt = await p.evaluate(() => [...document.querySelectorAll('.trial')].map((x) => x.innerText).find((t) => /ring mum/i.test(t)));
  ok(/Mum moves in/i.test(rowTxt || ''), 'the vow shows who moves in: ' + (rowTxt || '').replace(/\n/g, ' ').slice(0, 90));
  // fulfil it from the Hearth so we see her arrive
  const gid = await p.evaluate(() => JSON.parse(localStorage.gs).goals.find((g) => /Ring Mum/.test(g.title)).id);
  await p.click(`[data-act="vow"][data-id="${gid}"]`); await p.waitForSelector('[data-m="v-fulfil"]');
  await p.click('[data-m="v-fulfil"]'); await p.waitForTimeout(900);
  const notice = await p.evaluate(() => document.querySelector('#modal').innerText);
  ok(/Mum has moved into the hearth/.test(notice), 'vow notice says she moved in');
  await shot('b14-vow-notice');
  await clear();
  await p.click('[data-act="tab"][data-v="hearth"]'); await p.waitForTimeout(400);
  await p.waitForTimeout(2500);
  const res = await p.evaluate(() => window.__house.inst.npcs.map((a) => a.id + (a.sheets ? '+' : '-')));
  ok(res.length === 1 && /\+$/.test(res[0]), 'Mum is in the house with a sprite: ' + res.join());
  await p.evaluate(() => { const h = window.__house.inst, a = h.npcs[0]; h.cam.x = a.x; h.cam.y = a.y - 20; h.cam.manual = 1e9; h.k = 3; h._say(a, ['☕'], 30); });
  await shot('b15-mum-at-home', 600);
  // 7. stars off and on
  await p.click('[data-act="h3-stars"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => JSON.parse(localStorage.gs).settings.stars === false && !window.__house.inst.starsOn), 'stars toggle off');
  await p.click('[data-act="h3-stars"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__house.inst.starsOn), 'and back on');
  // 8. a reload keeps it all
  await p.reload(); await p.waitForTimeout(1500);
  const kept = await p.evaluate(() => { const s = JSON.parse(localStorage.gs); return { rooms: s.house.rooms.length, items: s.house.items.length, npcs: s.npcs.filter((n) => n.id.indexOf('w-') !== 0).length, strangers: s.npcs.filter((n) => n.id.indexOf('w-') === 0 && n.status === 'waiting').length, ask: !!s.lookAsk }; });
  ok(kept.rooms === 6 && kept.npcs === 7 && kept.strangers >= 1 && !kept.ask, 'reload keeps the layout and household: ' + JSON.stringify(kept));
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); window.__whole = s; });
  console.log(errs.join('\n') || 'no errors');
  if (errs.length) process.exitCode = 1;
  await b.close();
})();
