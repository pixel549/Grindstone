// 2.25: "it's been too long" reminders, in the app: the section on a quest's card (off by default, a suggestion from
// his own history, the count, repeats), the cap, the Today chip, the overdue list with its snoozes and ✓, the note's
// tap opening the list, the phone's own snoozes counting, and the settings.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s27/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const cx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true }); const p = await cx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    window.__seen = 0;
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.0', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {}, heraldInfo: () => JSON.stringify({ perm: false, cals: [] }), rosterEvents: () => '[]',
      backupWrite: () => 'ok', widgetInfo: () => JSON.stringify({ placed: false }), interpInfo: () => JSON.stringify({ on: false }),
      remindMarks: () => localStorage.getItem('marks') || '{}', overdueSeen: () => { window.__seen++; },
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(600);
  await p.click('[data-m="c-save"]');
  const settle = async () => { for (let i = 0; i < 14; i++) { await p.waitForTimeout(350); if (!(await p.$('#modal:not(.hidden)'))) break; const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn'); if (c) await c.click().catch(() => {}); } };
  await settle();
  const tap = async (sel) => { const el = await p.$(sel); if (!el) { console.log('MISSING ' + sel); fails++; return false; } await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(400); return true; };
  const save = () => p.evaluate(() => JSON.parse(localStorage.gs));
  const set = async (fn, arg) => { await p.evaluate(fn, arg); await p.evaluate(() => window.onResume()); await p.waitForTimeout(500); };
  // Three habits: training done every other day for three weeks (last 4 days ago), mowing weekly (last 9 days ago),
  // and a to-do. Nothing has a reminder yet.
  await set(() => {
    const s = JSON.parse(localStorage.gs), t = G.today(), add = (id, name, icon, type) => s.quests.push({ id: id, name: name, icon: icon, type: type, stat: 'STR', diff: 2, days: [1, 1, 1, 1, 1, 1, 1], cap: 0 });
    add(9001, 'Lift heavy things', '🏋️', 'habit'); add(9002, 'Mow the back lawn', '🌿', 'habit'); add(9003, 'Cert IV assessment', '📚', 'todo');
    s.qhist = s.qhist || {}; s.qlast = s.qlast || {};
    s.qhist[9001] = []; for (let i = 22; i >= 4; i -= 2) s.qhist[9001].push(G.addDays(t, -i)); s.qlast[9001] = G.addDays(t, -4);
    s.qhist[9002] = [G.addDays(t, -30), G.addDays(t, -23), G.addDays(t, -16), G.addDays(t, -9)]; s.qlast[9002] = G.addDays(t, -9);
    localStorage.gs = JSON.stringify(s);
  });
  await settle();
  ok(!(await save()).quests.some((q) => q.remind), 'nothing has a reminder until he turns one on');
  ok(!(await p.$('.chips [data-act="overdue"]')), 'and Today has no overdue chip');

  // ---- the quest's own card ----
  await p.evaluate(() => { window.gotoFromWidget('quests:all'); });
  await p.waitForTimeout(500);
  await tap('.row[data-act="edit"]:has-text("Lift heavy things")');
  let txt = await p.evaluate(() => document.querySelector('#modal .sheet').innerText);
  ok(/Remind me/i.test(txt) && /0 of 12 on/.test(txt) && /about every 2 days/.test(txt) && /reminder at 3 would fit/.test(txt), 'the card offers it, off, with a suggestion from his history: every 2 days, so 3');
  await tap('#modal [data-m="e-rem"]');
  txt = await p.evaluate(() => document.querySelector('#modal .sheet').innerText);
  ok(/3 days/.test(txt) && /1 of 12 on/.test(txt) && /That’s about right/.test(txt), 'turned on, it starts at the suggestion');
  await tap('#modal [data-m="e-rem-rep"][data-v="2"]');
  await shot('r01-card');
  await tap('#modal [data-m="e-save"]');
  let s = await save();
  let q = s.quests.find((x) => x.id === 9001);
  ok(q.remind && q.remind.d === 3 && q.remind.rep === 2 && q.remind.from === await p.evaluate(() => G.today()), 'saved: 3 days, then every 2 days');

  // the lawn: no history in the suggestion's favour, so try the suggestion button; then the to-do at the default
  await tap('.row[data-act="edit"]:has-text("Mow the back lawn")');
  await tap('#modal [data-m="e-rem"]');
  await tap('#modal [data-m="e-rem-d"][data-v="-1"]'); await tap('#modal [data-m="e-rem-d"][data-v="-1"]');
  txt = await p.evaluate(() => document.querySelector('#modal .sheet').innerText);
  ok(/Suggested: 9/.test(txt) && !!(await p.$('#modal [data-m="e-rem-use"]')), 'moved off the suggestion, it offers it back');
  await tap('#modal [data-m="e-rem-use"]');
  await tap('#modal [data-m="e-save"]');
  await tap('.row[data-act="edit"]:has-text("Cert IV")');
  await tap('#modal [data-m="e-rem"]');
  await tap('#modal [data-m="e-save"]');
  s = await save();
  ok(s.quests.find((x) => x.id === 9002).remind.d === 9 && s.quests.find((x) => x.id === 9003).remind.d === 3, 'the lawn at 9, the to-do at 3');

  // ---- Today: one chip ----
  await p.evaluate(() => { window.gotoFromWidget('quests:today'); });
  await p.waitForTimeout(500);
  const chip = await p.evaluate(() => { const c = document.querySelector('.chips [data-act="overdue"]'); return c ? c.innerText : ''; });
  ok(/Lift heavy things 4d/.test(chip) && /Mow the back lawn 9d/.test(chip) && !/Cert/.test(chip) && chip.indexOf('Mow') < chip.indexOf('Lift'), 'Today shows one chip, longest gap first: ' + chip);
  await shot('r02-today');

  // ---- the list: snooze, ✓ ----
  await tap('.chips [data-act="overdue"]');
  txt = await p.evaluate(() => document.querySelector('#modal .sheet').innerText);
  ok(/Been too long/i.test(txt) && /3 of 12 reminders on/.test(txt) && /Overdue/i.test(txt) && /Keeping an eye on/i.test(txt) && /Cert IV/.test(txt), 'the list: overdue first, then the ones being watched, with the count');
  ok(await p.evaluate(() => window.__seen > 0), 'looking at the list clears the phone’s note');
  await shot('r03-list');
  await tap('#modal [data-m="od-snz"][data-k="9002"][data-v="3"]');
  s = await save();
  ok(s.quests.find((x) => x.id === 9002).remind.snz === await p.evaluate(() => G.addDays(G.today(), 3)), 'snoozed the lawn for 3 days');
  txt = await p.evaluate(() => document.querySelector('#modal .sheet').innerText);
  ok(/Snoozed/i.test(txt) && /Mow the back lawn/.test(txt), 'it moves to Snoozed');
  const g0 = s.gold;
  await tap('#modal [data-m="od-do"][data-k="9001"]');
  await p.waitForTimeout(500);
  s = await save();
  ok(s.gold > g0 && s.qlast[9001] === await p.evaluate(() => G.today()), '✓ logs it, and the clock restarts');
  await settle();
  const chip2 = await p.evaluate(() => { const c = document.querySelector('.chips [data-act="overdue"]'); return c ? c.innerText : ''; });
  ok(!chip2, 'nothing overdue left on Today');

  // ---- the phone's own snooze (from the note's button) counts too ----
  await set(() => { const s = JSON.parse(localStorage.gs); s.quests.find((q) => q.id === 9002).remind.snz = null; localStorage.gs = JSON.stringify(s); });
  ok(/Mow/.test(await p.evaluate(() => (document.querySelector('.chips [data-act="overdue"]') || { innerText: '' }).innerText)), 'unsnoozed, the lawn is back');
  await set(() => { localStorage.marks = JSON.stringify({ snz: { 9002: G.addDays(G.today(), 1) }, ping: {} }); });
  ok(!(await p.$('.chips [data-act="overdue"]')), 'a snooze from the note’s button hides it in the app too');
  await p.evaluate(() => { localStorage.marks = '{}'; });

  // ---- tapping the note opens the list ----
  await p.evaluate(() => window.onResume()); await p.waitForTimeout(300);
  await p.evaluate(() => window.gotoFromWidget('overdue'));
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => /Been too long/i.test((document.querySelector('#modal:not(.hidden) .sheet') || { innerText: '' }).innerText)), 'tapping the note opens the list');
  await settle();

  // ---- a habit that slips is offered a reminder, set to the suggestion ----
  await set(() => {
    const s = JSON.parse(localStorage.gs), t = G.today();
    s.quests.push({ id: 9004, name: 'Swim some laps', icon: '🏊', type: 'habit', stat: 'END', diff: 2, days: [1, 1, 1, 1, 1, 1, 1], cap: 0 });
    s.qhist[9004] = []; for (let i = 26; i >= 8; i -= 2) s.qhist[9004].push(G.addDays(t, -i)); s.qlast[9004] = G.addDays(t, -8);
    localStorage.gs = JSON.stringify(s);
  });
  await p.evaluate(() => { window.gotoFromWidget('quests:today'); }); await p.waitForTimeout(400);
  const slip = await p.evaluate(() => { const c = document.querySelector('.chips [data-act="slip"]'); return c ? c.innerText : ''; });
  ok(/Swim some laps has slipped · 8d/.test(slip), 'Today offers a reminder for the habit that slipped: ' + slip);
  await tap('.chips [data-act="slip"]');
  txt = await p.evaluate(() => document.querySelector('#modal .sheet').innerText);
  ok(/every 2 days/.test(txt) && /been 8 days/.test(txt) && /Remind me at 3/i.test(txt), 'the offer: usually every 2 days, it’s been 8, remind at 3');
  await shot('r05-slip');
  await tap('#modal [data-m="slip-yes"]');
  s = await save();
  ok(s.quests.find((x) => x.id === 9004).remind && s.quests.find((x) => x.id === 9004).remind.d === 3, 'yes: the reminder is on, at 3');
  ok(!(await p.$('.chips [data-act="slip"]')) && /Swim some laps 8d/.test(await p.evaluate(() => (document.querySelector('.chips [data-act="overdue"]') || { innerText: '' }).innerText)), 'the offer goes; it’s overdue now, so it’s in the ⏰ chip');
  // saying no
  await set(() => {
    const s = JSON.parse(localStorage.gs), t = G.today();
    s.quests.push({ id: 9005, name: 'Stretch it out', icon: '🧘', type: 'habit', stat: 'VIT', diff: 1, days: [1, 1, 1, 1, 1, 1, 1], cap: 0 });
    s.qhist[9005] = [G.addDays(t, -30), G.addDays(t, -27), G.addDays(t, -24), G.addDays(t, -21)]; s.qlast[9005] = G.addDays(t, -21);
    localStorage.gs = JSON.stringify(s);
  });
  await p.evaluate(() => { window.gotoFromWidget('quests:today'); }); await p.waitForTimeout(400);
  ok(/Stretch it out/.test(await p.evaluate(() => (document.querySelector('.chips [data-act="slip"]') || { innerText: '' }).innerText)), 'the next one that slipped is offered');
  await tap('.chips [data-act="slip"]');
  await tap('#modal [data-m="slip-no"]');
  s = await save();
  ok(!s.quests.find((x) => x.id === 9005).remind && s.remindNo[9005] === await p.evaluate(() => G.today()) && !(await p.$('.chips [data-act="slip"]')), 'no: no reminder, and it stops asking');

  // ---- the week in review: what went overdue, and ⏰ on what slipped ----
  await set(() => {
    const s = JSON.parse(localStorage.gs), t = G.today(), ws = G.weekStart(t);
    s.quests.push({ id: 9006, name: 'Clean the bathroom', icon: '🧽', type: 'habit', stat: 'DIS', diff: 1, days: [1, 1, 1, 1, 1, 1, 1], cap: 0 });
    s.qhist[9006] = [G.addDays(ws, -20), G.addDays(ws, -13), G.addDays(ws, -6)]; s.qlast[9006] = G.addDays(ws, -6);
    s.log.unshift({ t: 1, d: G.addDays(ws, -6), q: 9006, n: 'Clean the bathroom', i: '🧽', x: 5, g: 6, s: 'DIS' });
    localStorage.gs = JSON.stringify(s);
  });
  await p.evaluate(() => { window.gotoFromWidget('quests:today'); }); await p.waitForTimeout(400);
  await tap('.chips [data-act="review"]');
  txt = await p.evaluate(() => document.querySelector('#modal .sheet').innerText);
  ok(/Went overdue/i.test(txt) && /Swim some laps/i.test(txt) && /still overdue/i.test(txt), 'the week lists what went overdue, and whether it still is');
  ok(!!(await p.$('#modal [data-m="rv-remind"][data-k="9005"]')) && !(await p.$('#modal [data-m="rv-remind"][data-k="9004"]')), 'what slipped and has no reminder has a ⏰ button (even one he said no to on Today); what has one shows ⏰');
  await shot('r06-review');
  await tap('#modal [data-m="rv-remind"][data-k="9005"]');
  s = await save();
  ok(!!s.quests.find((x) => x.id === 9005).remind && /Week|This week/i.test(await p.evaluate(() => document.querySelector('#modal .sheet').innerText)), '⏰ puts a reminder on it, and the week stays open');
  await tap('#modal .btn.prime[data-m="close"]');
  await set(() => { const s = JSON.parse(localStorage.gs); [9004, 9005, 9006].forEach((id) => { const q = s.quests.find((x) => x.id === id); if (q) delete q.remind; }); localStorage.gs = JSON.stringify(s); });

  // ---- 2.25.2: an odd cycle (a 35-day script), typed rather than tapped 28 times ----
  await p.evaluate(() => { window.gotoFromWidget('quests:all'); }); await p.waitForTimeout(400);
  await tap('#fab');
  await p.fill('#e-name', 'Renew the 35-day script');
  await tap('#modal [data-m="e-type"][data-v="habit"]');
  await tap('#modal [data-m="e-rest-custom"]');
  ok(await p.evaluate(() => document.querySelector('#e-rest-n') && document.querySelector('#e-rest-n').value === '35'), 'Comes round › Every… opens a day picker, at 35');
  await tap('#modal [data-m="e-rest-step"][data-v="7"]'); await tap('#modal [data-m="e-rest-step"][data-v="-7"]');
  await p.fill('#e-rest-n', '35');
  await tap('#modal [data-m="e-rem"]');
  ok(await p.evaluate(() => document.querySelector('#e-rem-n') && document.querySelector('#e-rem-n').value === '35'), 'with no history, the reminder starts at the cycle: 35');
  await p.fill('#e-rem-n', '33');
  await tap('#modal [data-m="e-rem-rep"][data-v="1"]');
  const d20 = await p.evaluate(() => G.addDays(G.today(), -20));
  ok(await p.evaluate(() => document.querySelector('#e-rem-last') && document.querySelector('#e-rem-last').value === ''), 'a new quest: Last done is blank (it would count from today)');
  await p.fill('#e-rem-last', d20);
  await shot('r07-cycle');
  await tap('#modal [data-m="e-save"]');
  s = await save();
  let sc = s.quests.find((x) => x.name === 'Renew the 35-day script');
  ok(sc && sc.type === 'habit' && sc.rest === 35 && sc.remind && sc.remind.d === 33 && sc.remind.rep === 1, 'saved: comes round every 35 days, reminder at 33 then daily');
  ok(s.qlast[sc.id] === d20 && (await p.evaluate((id) => { const S0 = JSON.parse(localStorage.gs); return G.remindState(S0, S0.quests.find((q) => q.id === id), G.today()).left; }, sc.id)) === 13, 'last done 20 days ago: the note comes in 13 days, not 33');
  await tap('.row[data-act="edit"]:has-text("Renew the 35-day script")');
  ok(await p.evaluate(() => document.querySelector('#e-rest-n').value === '35' && document.querySelector('#e-rem-n').value === '33' && document.querySelector('#modal [data-m="e-rest-custom"]').classList.contains('on')), 'reopened, the card shows Every… 35 and the reminder at 33');
  await tap('#modal [data-m="e-rem-d"][data-v="7"]');
  ok(await p.evaluate(() => document.querySelector('#e-rem-n').value === '40'), '+7 is a week a tap');
  await p.evaluate(() => { const c = document.querySelector('#modal .scrim'); if (c) c.click(); });
  await p.waitForTimeout(300);
  await set(() => { const s = JSON.parse(localStorage.gs); s.quests = s.quests.filter((q) => q.name !== 'Renew the 35-day script'); localStorage.gs = JSON.stringify(s); });

  // ---- the cap ----
  await set(() => { const s = JSON.parse(localStorage.gs); for (let i = 0; i < 10; i++) s.quests.push({ id: 9100 + i, name: 'Extra ' + i, icon: '•', type: 'habit', stat: 'DIS', diff: 1, days: [1, 1, 1, 1, 1, 1, 1], cap: 0, remind: i < 9 ? { d: 5, rep: 0, from: G.today() } : undefined }); localStorage.gs = JSON.stringify(s); });
  ok((await p.evaluate(() => G.remindCount(JSON.parse(localStorage.gs)))) === 12, 'twelve on (' + (await p.evaluate(() => JSON.parse(localStorage.gs).quests.filter((q) => q.remind).map((q) => q.id).join(','))) + ')');
  await p.evaluate(() => { window.gotoFromWidget('quests:all'); }); await p.waitForTimeout(400);
  await tap('.row[data-act="edit"]:has-text("Extra 9")');
  txt = await p.evaluate(() => document.querySelector('#modal .sheet').innerText);
  ok(/12 of 12 on/.test(txt), 'the card shows the count at the cap');
  await tap('#modal [data-m="e-rem"]');
  ok(!(await p.$('#modal [data-m="e-rem-d"]')) && await p.evaluate(() => /limit/.test(document.querySelector('#toast') ? document.querySelector('#toast').innerText : document.body.innerText)), 'the thirteenth is refused, with why');
  await p.evaluate(() => { const c = document.querySelector('#modal [data-m="close"]') || document.querySelector('#modal .scrim'); if (c) c.click(); });
  await settle();

  // ---- settings ----
  await p.evaluate(() => { window.gotoFromWidget('records:settings'); }); await p.waitForTimeout(500);
  txt = await p.evaluate(() => document.querySelector('#main').innerText);
  ok(/It’s been too long/i.test(txt) && /12 of 12 quests have a reminder/.test(txt) && /9 am/.test(txt), 'settings: the note, its hour (9 am), and the count');
  if (await p.$('[data-act="overdue-hour"][data-v="1"]')) { await tap('[data-act="overdue-hour"][data-v="1"]'); ok((await save()).settings.overdueHour === 10, 'the hour moves'); }
  await tap('[data-act="overdue-toggle"]');
  ok((await save()).settings.overdue === false, 'and the note can be turned off (the reminders stay)');
  await shot('r04-settings');
  errs.forEach((e) => console.log(e));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await b.close();
})();
