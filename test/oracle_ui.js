// 2.27: the Oracle in the app (talking, judging, hide offers, fresh lines), putting quests away, bigger reward props
// whose stars go once seen, and the nightmare stage. The AI connection is mocked (Native.aiAsk).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s29/';
fs.mkdirSync(OUT, { recursive: true });
const JAKE = fs.existsSync('/tmp/jake/save2.json') ? fs.readFileSync('/tmp/jake/save2.json', 'utf8') : null;
const native = (seed) => {
  if (seed && !localStorage.gs) localStorage.gs = seed;
  window.__asks = [];
  window.Native = {
    load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.0', canNotify: () => false, askNotify: () => {},
    share: () => {}, copy: () => {}, heraldInfo: () => '{}', rosterEvents: () => '[]', backupWrite: () => 'ok', widgetInfo: () => JSON.stringify({ placed: false }), remindMarks: () => '{}', overdueSeen: () => {},
    interpInfo: () => JSON.stringify({ on: true, provider: 'groq', base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b' }), hasOracleKey: () => true,
    aiAsk: (sys, user, max, cb) => {
      window.__asks.push({ sys: sys, user: user, max: max });
      const id = (name) => { const m = user.match(new RegExp('"(\\d+)\\|' + name + '\\|')); return m ? +m[1] : 0; };
      let out = '{}';
      if (/Player: Rolled/.test(user)) out = 'Ouch. {"say":"Rest it. I’d hold the swimming and running for a fortnight.","actions":[{"do":"hide","ids":[' + id('Swim') + ',' + id('Run') + '],"days":14,"hold":true,"why":"rolled ankle"},{"do":"add","name":"Ankle circles","icon":"🦶","type":"daily"}]}';
      else if (/The quest:/.test(user)) out = /Hydrate properly/.test(user) ? '{"diff":1,"stat":"VIT","cap":3,"why":"A glass of water."}' : '{"diff":2,"stat":"VIT","cap":1,"why":"Gentle rehab."}';
      else if (/"goal"|The goal:/.test(user)) out = '{"gold":150,"chest":false,"why":"Steady, not heroic."}';
      else if (/The target:/.test(user)) out = '{"gold":120,"chest":true,"why":"A real stretch."}';
      else if (/barks/.test(sys)) out = '{"lines":{"folk":["Saw you hobbling. Ice, mate."]}}';
      else if (/usual gap/.test(user)) out = '{"hints":[]}';
      setTimeout(() => window.__aiDone(cb, true, out), 80);
    },
  };
};
(async () => {
  const b = await chromium.launch();
  const cx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true, timezoneId: 'Australia/Perth' });
  let p = await cx.newPage();
  const errs = [];
  const watch = (pg) => { pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text()); }); };
  watch(p);
  await p.clock.setFixedTime(new Date('2026-11-17T10:00:00+08:00'));
  await p.addInitScript(native, null);
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const tap = async (sel) => { const el = await p.$(sel); if (!el) { console.log('MISSING ' + sel); fails++; return false; } await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(400); return true; };
  const sheet = () => p.evaluate(() => { const m = document.querySelector('#modal:not(.hidden) .sheet, #modal:not(.hidden) .dlg'); return m ? m.innerText : ''; });
  const save = () => p.evaluate(() => JSON.parse(localStorage.gs));
  const set = async (fn, arg) => { await p.evaluate(fn, arg); await p.evaluate(() => window.onResume()); await p.waitForTimeout(400); };
  const clear = async () => {
    for (let i = 0, quiet = 0; i < 14 && quiet < 2; i++) {
      await p.waitForTimeout(400);
      if (!(await p.$('#modal:not(.hidden) .sheet, #modal:not(.hidden) .dlg, #modal:not(.hidden) .band'))) { quiet++; continue; }
      quiet = 0;
      const c = await p.$('#modal:not(.hidden) .btns .btn.prime, #modal:not(.hidden) .btns [data-m="close"]');
      if (c) await c.click().catch(() => {}); else await p.evaluate(() => window.handleBack());
    }
  };
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(400);
  await p.click('[data-m="c-save"]'); await p.click('[data-m="pet-save"]');
  await clear();
  // nine days since training
  await set(() => { const s = JSON.parse(localStorage.gs); s.lastTraining = G.addDays(G.today(), -9); localStorage.gs = JSON.stringify(s); });
  await p.evaluate(() => window.gotoFromWidget('quests:today')); await clear();
  let main = await p.evaluate(() => document.querySelector('#main').innerText);
  ok(/9 days since training/.test(main) && (await p.$('.chips [data-act="oracle-chat"]')), 'Today: nine days since training, and the Oracle’s chip');

  // ---- the Oracle's upgradeable rooms ----
  await p.click('[data-act="tab"][data-v="hearth"]'); await p.waitForTimeout(500);
  ok(await p.$('[data-act="oracle-sanctum"]'), 'the Hearth has a separate entrance to the Oracle rooms');
  await tap('[data-act="oracle-sanctum"]');
  txt = await sheet();
  ok(/The Sanctum/.test(txt) && /Restoration · tier 1\/5/.test(txt) && /The Archive/.test(txt), 'the basement opens on the first chamber with the other rooms visible');
  await tap('#modal [data-m="oracle-room"][data-k="archive"]');
  ok(/Reach level 10/.test(await sheet()), 'the Archive is visible but level-locked');
  await set(() => { const s = JSON.parse(localStorage.gs); s.level = 10; s.gold = 10000; s.oracleRooms = { tier: { sanctum: 1, archive: 0, observatory: 0, scriptorium: 0 } }; localStorage.gs = JSON.stringify(s); });
  await tap('#modal [data-m="oracle-room"][data-k="archive"]');
  ok(/Improve The Sanctum to tier 2/.test(await sheet()), 'the Archive also requires the Sanctum to be restored');
  await tap('#modal [data-m="oracle-room"][data-k="sanctum"]');
  await tap('#modal [data-m="oracle-room-upgrade"][data-k="sanctum"]');
  ok(/Restoration · tier 2\/5/.test(await sheet()), 'the Sanctum can be upgraded for gold');
  await tap('#modal [data-m="oracle-room"][data-k="archive"]');
  await tap('#modal [data-m="oracle-room-upgrade"][data-k="archive"]');
  ok(/Restoration · tier 1\/5/.test(await sheet()), 'the Archive can then be built');
  s = await save();
  ok(s.oracleRooms.tier.sanctum === 2 && s.oracleRooms.tier.archive === 1, 'room tiers are saved');

  // ---- task sorting and personal order ----
  await p.evaluate(() => window.handleBack()); await p.waitForTimeout(250);
  await set(() => {
    const s = JSON.parse(localStorage.gs);
    s.quests.push(G.newQuest(s, { name: 'AA Sort easy', icon: '🧪', type: 'todo', stat: 'INT', diff: 4 }));
    s.quests.push(G.newQuest(s, { name: 'ZZ Sort hard', icon: '🧪', type: 'todo', stat: 'STR', diff: 5 }));
    localStorage.gs = JSON.stringify(s);
  });
  await p.evaluate(() => window.gotoFromWidget('quests:all')); await p.waitForTimeout(350);
  ok(await p.$('#q-sort') && await p.$('#q-filter') && await p.$('#q-diff'), 'All has sort, task and challenge controls');
  await p.selectOption('#q-filter', 'todo'); await p.selectOption('#q-sort', 'difficulty'); await p.waitForTimeout(250);
  let orderText = await p.$eval('#main', (el) => el.innerText);
  ok(orderText.indexOf('AA Sort easy') >= 0 && orderText.indexOf('ZZ Sort hard') > orderText.indexOf('AA Sort easy'), 'challenge sorting puts the easier task first');
  await p.selectOption('#q-sort', 'manual'); await p.waitForTimeout(250);
  s = await save();
  const easyId = s.quests.find((q) => q.name === 'AA Sort easy').id;
  const hardId = s.quests.find((q) => q.name === 'ZZ Sort hard').id;
  let beforeOrder = await p.$eval('#main .row[data-act="edit"] .rn', (els) => els.map((el) => el.innerText));
  ok(beforeOrder.indexOf('AA Sort easy') < beforeOrder.indexOf('ZZ Sort hard'), 'new tasks start available in the personal order');
  await tap('#main [data-act="quest-move"][data-id="' + easyId + '"][data-v="1"]');
  const afterOrder = await p.$eval('#main .row[data-act="edit"] .rn', (els) => els.map((el) => el.innerText));
  ok(afterOrder.indexOf('ZZ Sort hard') < afterOrder.indexOf('AA Sort easy'), 'the up/down controls persist a manual reorder');
  s = await save();
  ok(!s.quests.find((q) => q.id === easyId).archived && !s.quests.find((q) => q.id === hardId).archived, 'newly created tasks are active, not archived');

  // ---- talking ----
  await tap('.chips [data-act="oracle-chat"]');
  ok(/goes to Groq/.test(await sheet()), 'the chat says where it goes');
  await p.fill('#oc-in', 'Rolled my ankle this morning.');
  await tap('#modal [data-m="oc-send"]');
  await p.waitForTimeout(400);
  let txt = await sheet();
  ok(/Rest it/.test(txt) && /Hold Swim and Run for 2 weeks/.test(txt) && /Add “Ankle circles”/.test(txt), 'it answers, and proposes a hold and a new quest');
  const ask = await p.evaluate(() => window.__asks.find((a) => /Player: Rolled/.test(a.user)));
  ok(ask && /\|Swim\|h\|END/.test(ask.user) && ask.max === 900, 'it was told the quests (compactly)');
  let s = await save();
  ok(!s.quests.some((q) => q.away), 'nothing changes until he taps Do it');
  await shot('o01-chat');
  await tap('#modal [data-m="oc-do"][data-a="0"]');
  await tap('#modal [data-m="oc-do"][data-a="1"]');
  await p.waitForTimeout(400);
  s = await save();
  const swim = s.quests.find((q) => q.name === 'Swim'), runq = s.quests.find((q) => q.name === 'Run'), circ = s.quests.find((q) => q.name === 'Ankle circles');
  ok(swim.away && swim.away.why === 'hold' && runq.away && runq.away.back === '2026-12-01', 'Swim and Run on hold until 1 Dec');
  ok(circ && circ.judged === 'oracle' && circ.stat === 'VIT' && circ.diff === 2, 'Ankle circles added, and judged by the Oracle');
  ok(/done/i.test(await sheet()), 'the actions show as done');
  await p.evaluate(() => window.handleBack()); await p.waitForTimeout(300);
  main = await p.evaluate(() => document.querySelector('#main').innerText);
  ok(!/days since training/.test(main) && /2 put away/.test(main), 'Today: no training nag while it’s held, and “2 put away”');
  await tap('[data-act="fold-hidden"]');
  ok(/Swim · held/.test(await p.evaluate(() => document.querySelector('#main').innerText)), 'the hidden list says when');

  // ---- on the card ----
  await tap('.resting [data-act="edit"]');
  txt = await sheet();
  ok(/On hold until/i.test(txt) && /streaks protected/.test(txt) && /rolled ankle/.test(txt), 'its card says it’s on hold');
  ok(!(await p.$('#modal [data-m="e-stat"]')) && !(await p.$('#modal [data-m="e-diff"]')) && /Judged/i.test(txt), 'no picking the stat or difficulty: it’s judged');
  await tap('#modal [data-m="aw-end"]');
  s = await save();
  ok(!s.quests.find((q) => q.id === swim.id).away || s.quests.find((q) => q.id === swim.id).away.back === '2026-11-17', 'brought back');
  await tap('#modal [data-m="aw-hold"]');
  await tap('#modal [data-m="aw-set"][data-v="7"]');
  s = await save();
  ok(s.quests.find((q) => q.id === swim.id).away.back === '2026-11-24' && s.quests.find((q) => q.id === swim.id).away.why === 'hold', 'and put away again from the card: a week, held');
  await shot('o02-card', 600);
  await p.evaluate(() => window.handleBack()); await p.waitForTimeout(300);

  // ---- judging a new quest ----
  await p.evaluate(() => document.querySelector('#fab').click()); await p.waitForTimeout(400);
  txt = await sheet();
  ok(/when you save it/i.test(txt) && !(await p.$('#modal [data-m="e-stat"]')), 'a new quest: judged when saved');
  await p.fill('#e-name', 'Ankle rehab band');
  await tap('#modal [data-m="e-type"][data-v="habit"]');
  await tap('#modal [data-m="e-save"]');
  await p.waitForTimeout(500);
  s = await save();
  let rq = s.quests.find((q) => q.name === 'Ankle rehab band');
  ok(rq && rq.judged === 'oracle' && rq.stat === 'VIT' && rq.cap === 1 && rq.judgedWhy === 'Gentle rehab.', 'the Oracle judged it: ' + JSON.stringify(rq && [rq.stat, rq.diff, rq.cap, rq.judged]));
  // renaming is a new thing to judge
  await p.evaluate((id) => window.gotoFromWidget('quests:all'), rq.id); await p.waitForTimeout(400);
  await p.evaluate(() => { const r = [...document.querySelectorAll('.row[data-act="edit"]')].find((x) => /Ankle rehab band/.test(x.textContent)); r.click(); }); await p.waitForTimeout(400);
  await p.fill('#e-name', 'Hydrate properly');
  await tap('#modal [data-m="e-save"]');
  await p.waitForTimeout(500);
  rq = (await save()).quests.find((q) => q.id === rq.id);
  ok(rq.diff === 1 && rq.cap === 3 && rq.judgedWhy === 'A glass of water.', 'renamed, it’s judged again (no keeping a hard quest’s pay)');

  // ---- the offer to hide it after a go ----
  await set(() => { const s = JSON.parse(localStorage.gs), t = G.today(); const q = G.newQuest(s, { name: 'Mow the back lawn', icon: '🌿', type: 'habit', stat: 'END', diff: 2, cap: 1 }); q.judged = 'rules'; s.quests.push(q); s.qhist[q.id] = [G.addDays(t, -42), G.addDays(t, -28), G.addDays(t, -14)]; localStorage.gs = JSON.stringify(s); });
  await p.evaluate(() => window.gotoFromWidget('quests:today')); await clear();
  const mowId = (await save()).quests.find((q) => q.name === 'Mow the back lawn').id;
  await tap('[data-act="complete"][data-id="' + mowId + '"]');
  await p.waitForTimeout(1800);
  txt = await sheet();
  if (!/Put it away/.test(txt)) console.log('SHEET:', String(txt).slice(0,200));
  ok(/Put it away for a while/i.test(txt) && /every 14 days/i.test(txt) && /12 days/i.test(txt), 'after a go: put it away for 12 days? (usually every 14)');
  await shot('o03-offer');
  await tap('#modal [data-m="ho-step"][data-v="1"]');
  await tap('#modal [data-m="ho-every"]');
  s = await save();
  ok(s.quests.find((q) => q.id === mowId).rest === 13, '“After every go”: it now hides 13 days after each mow');

  // ---- goals and targets: the bounty is judged ----
  await p.evaluate(() => window.gotoFromWidget('quests:vows')); await p.waitForTimeout(400);
  await tap('[data-act="new-vow"]');
  ok(!(await p.$('#modal [data-m="v-gold"]')) && !(await p.$('#modal [data-m="v-chest"]')) && /Oracle sets the bounty/.test(await sheet()), 'a goal: no setting its gold or coffer');
  await p.fill('#v-title', 'Ten rehab sessions');
  await tap('#modal [data-m="v-save"]');
  await p.waitForTimeout(500);
  s = await save();
  const goal = s.goals.find((g) => g.title === 'Ten rehab sessions');
  ok(goal && goal.reward.gold === 150 && goal.judged === 'oracle', 'the Oracle set it: 150 gold');
  await tap('[data-act="mark-new"]');
  ok(!(await p.$('#modal [data-m="mk-gold"]')), 'a target: likewise');
  await p.fill('#mk-name', 'Plank hold'); await tap('#modal [data-m="mk-unit"][data-v="time"]'); await tap('#modal [data-m="mk-better"][data-v="higher"]'); await p.fill('#mk-target', '2:00');
  await tap('#modal [data-m="mk-save"]');
  await p.waitForTimeout(500);
  s = await save();
  const mk = s.marks.find((m) => m.name === 'Plank hold');
  ok(mk && mk.gold === 120 && mk.chest, 'the target’s bounty: 120 gold and a coffer');

  // ---- settings ----
  await p.evaluate(() => window.gotoFromWidget('records:settings')); await p.waitForTimeout(400);
  main = await p.evaluate(() => document.querySelector('#main').innerText);
  ok(/Fresh lines for everyone/.test(main) && /How often things come round/.test(main) && /judges new quests/.test(main), 'settings: the Oracle’s background jobs, and the judging');
  await p.waitForTimeout(8500);   // the day's background asks
  s = await save();
  ok(s.barks && s.barks.day === '2026-11-17' && s.barks.lines.folk && s.hintsAt === '2026-11-17', 'once a day it writes fresh lines; once a week, the hints');

  // ---- Jake's house: reward props, their stars, and the nightmare a month on ----
  if (JAKE) {
    const cx2 = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true, timezoneId: 'Australia/Perth' });
    const p2 = await cx2.newPage(); watch(p2);
    await p2.clock.setFixedTime(new Date('2026-11-17T11:00:00+08:00'));
    await p2.addInitScript(native, JAKE);
    await p.close(); p = p2;
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1500); await clear();
    const sz = await p.evaluate(() => window.__relicImage('flamingo').then((c) => [c.width, c.height]));
    ok(sz[1] >= 34 && sz[0] >= 12, 'the flamingo is a proper size now: ' + sz.join('×'));
    const pl = await p.evaluate(() => window.__relicImage('plant').then((c) => [c.width, c.height]));
    ok(pl[1] >= 36, 'and the pot plant: ' + pl.join('×'));
    await p.click('[data-act="tab"][data-v="hearth"]'); await p.waitForTimeout(3500);
    const starred = () => p.evaluate(() => { const h = window.__house.inst; h.cam.x = 6 * 32; h.cam.y = 18 * 32; h.cam.manual = 1e9; return new Promise((r) => setTimeout(() => r((h.starPts || []).map((x) => x.id)), 600)); });
    ok((await starred()).indexOf('relic:flamingo') >= 0, 'the flamingo has its star');
    await p.evaluate(() => window.__house.inst._emit('relic:flamingo')); await p.waitForTimeout(400);
    await clear();
    ok((await starred()).indexOf('relic:flamingo') < 0 && (await save()).seenTaps['relic:flamingo'], 'tapped once, the star’s gone');
    await shot('o04-yard');
    // a month on
    const p3 = await cx2.newPage(); watch(p3);
    await p3.clock.setFixedTime(new Date('2026-12-20T11:00:00+08:00'));
    await p3.addInitScript(native, null);
    await p.close(); p = p3;
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1500); await clear();
    await p.evaluate(() => window.gotoFromWidget('quests:today')); await clear();
    main = await p.evaluate(() => document.querySelector('#main').innerText);
    ok(/new ecosystem|jungle with eyes|biohazard|plotting your death/i.test(main), 'a month on, Today names the nightmare');
    await p.click('[data-act="tab"][data-v="hearth"]'); await p.waitForTimeout(3500);
    const dire = await p.evaluate(() => Object.keys(window.__house.inst.o.state.dire || {}));
    ok(dire.length >= 3, 'and the house is drawing it: ' + dire.join(', '));
    await p.evaluate(() => { const h = window.__house.inst; h.cam.x = 4 * 32; h.cam.y = 18 * 32; h.cam.manual = 1e9; });
    await shot('o05-nightmare', 900);
  }

  errs.forEach((e) => console.log(e));
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
})();
