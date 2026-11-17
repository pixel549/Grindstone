// 2.26: people from the calendar, kids, pets and the AI helper, in the app. The first run (hero, pets, the calendar,
// the names in it, designing a kid and a grown-up), the Today chips, a person's card with its countdown, visitors in
// the house (smaller, slower kids; their event bubbles; gone at night), the household and settings rows, and the one
// AI connection for any provider (a key per provider; the Oracle asking through it).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s28/';
fs.mkdirSync(OUT, { recursive: true });
const DAY = '2026-11-17T10:00:00+08:00', NIGHT = '2026-11-17T23:30:00+08:00';
const native = () => {
  const D = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  window.__asks = [];
  window.__interp = JSON.parse(localStorage.getItem('interp') || '{"on":false}');
  window.Native = {
    load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.0', canNotify: () => true,
    askNotify: () => {}, share: () => {}, copy: () => {}, rosterEvents: () => '[]', backupWrite: () => 'ok', widgetInfo: () => JSON.stringify({ placed: false }), remindMarks: () => '{}', overdueSeen: () => {},
    heraldInfo: () => JSON.stringify({ perm: true, cals: [{ id: 3, name: 'Family', account: 'me' }, { id: 5, name: 'Work roster', account: 'me' }] }),
    peopleEvents: (ids) => JSON.stringify(String(ids).split(',').indexOf('3') < 0 ? [] : [
      { t: "Paul's birthday", s: D(6), e: D(7), a: true }, { t: "Emma's 5th birthday", s: D(12), e: D(13), a: true },
      { t: 'Dinner with Sarah', s: Date.now() + 86400000 * 2, e: Date.now() + 86400000 * 2 + 3600000, a: false },
      { t: 'Leo turns 1', s: D(3), e: D(4), a: true }, { t: 'Team meeting', s: Date.now() + 3600000, e: Date.now() + 7200000, a: false }]),
    interpInfo: () => JSON.stringify(window.__interp),
    interpSet: (j) => { const o = JSON.parse(j); window.__interp = { on: true, provider: o.provider, base: o.base, model: o.model }; localStorage.setItem('interp', JSON.stringify(window.__interp)); window.__keys = (window.__keys || []).concat([o.key]); },
    interpTest: (cb) => setTimeout(() => window.__interpTested(cb, null), 50), interpForget: () => { window.__interp = { on: false }; localStorage.removeItem('interp'); },
    hasOracleKey: () => !!window.__interp.on,
    aiAsk: (sys, user, max, cb) => { window.__asks.push({ sys: sys, user: user, max: max }); setTimeout(() => window.__aiDone(cb, true, /three trials/.test(user) ? JSON.stringify({ trials: [] }) : 'The Oracle hears you.'), 60); },
  };
};
(async () => {
  const b = await chromium.launch();
  const cx = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true, timezoneId: 'Australia/Perth' });
  let p = await cx.newPage();
  const errs = [];
  const watch = (pg) => { pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text()); }); };
  watch(p);
  await p.clock.setFixedTime(new Date(DAY));
  await p.addInitScript(native);
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const tap = async (sel) => { const el = await p.$(sel); if (!el) { console.log('MISSING ' + sel); fails++; return false; } await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(450); return true; };
  const sheet = () => p.evaluate(() => { const m = document.querySelector('#modal:not(.hidden) .sheet, #modal:not(.hidden) .dlg'); return m ? m.innerText : ''; });
  const save = () => p.evaluate(() => JSON.parse(localStorage.gs));
  const clear = async () => {
    for (let i = 0, quiet = 0; i < 14 && quiet < 2; i++) {
      await p.waitForTimeout(450);
      if (!(await p.$('#modal:not(.hidden) .sheet, #modal:not(.hidden) .dlg, #modal:not(.hidden) .band'))) { quiet++; continue; }
      quiet = 0;
      const c = await p.$('#modal:not(.hidden) .btns .btn.prime, #modal:not(.hidden) .btns [data-m="close"]');
      if (c) await c.click().catch(() => {}); else await p.evaluate(() => window.handleBack());
    }
  };

  // ---- the first run ----
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(500);
  await tap('[data-m="c-save"]');
  let txt = await sheet();
  ok(/Any animals at home/i.test(txt) && (await p.$$('#modal input.pet-name')).length === 2, 'after the hero: pets, with the two parrots to start');
  await p.evaluate(() => window.handleBack());
  ok(/Any animals at home/i.test(await sheet()), 'the pets step can’t be backed out of');
  await tap('#modal [data-m="pet-add"][data-v="cat"]');
  await p.fill('#modal input.pet-name[data-i="2"]', 'Mittens');
  await tap('#modal [data-m="pet-del"][data-i="0"]');
  ok(!(await p.$('#modal [data-m="pet-add"][data-v="ruby"][disabled]')) && (await p.$('#modal [data-m="pet-add"][data-v="kermit"][disabled]')), 'one of each parrot: the green one can’t be added twice, the red one can come back');
  await shot('p01-pets');
  await tap('#modal [data-m="pet-save"]');
  txt = await sheet();
  ok(/Your calendar/i.test(txt), 'then the calendar');
  await tap('#modal [data-m="fr-cal"]');
  ok(/People in your calendar/i.test(await sheet()) && (await p.$$('#modal [data-m="pc-tog"].toggle')).length === 2, 'its calendars to pick from');
  await tap('#modal [data-m="pc-tog"][data-id="3"].toggle');
  await tap('#modal [data-m="pc-done"]');
  txt = await sheet();
  const order = await p.$$eval('#modal .row.pf .rn', (els) => els.map((e) => e.firstChild.textContent.trim()));
  ok(/Who’s this/i.test(txt) && JSON.stringify(order) === JSON.stringify(['Leo', 'Paul', 'Emma', 'Sarah']), 'the names in it, big days first; the meeting isn’t anyone: ' + order.join(', '));
  ok(/about 5/.test(txt) && /about 1/.test(txt), 'with the ages the titles give');
  await shot('p02-found');
  await tap('#modal [data-m="pf-design"][data-k="emma"]');
  txt = await sheet();
  ok(/Who’s Emma/i.test(txt) && (await p.$('#modal [data-m="p-age"][data-v="kid"].on')) && /Boy/.test(txt) && /Girl/.test(txt) && !/Beard/i.test(txt), 'designing Emma: a kid already (from “5th birthday”), boy or girl, no beard');
  await tap('#modal [data-m="p-lead"][data-v="14"]');
  await shot('p03-emma', 900);
  await tap('#modal [data-m="p-save"]');
  ok(/Who’s this/i.test(await sheet()) && (await p.$$('#modal .row.pf')).length === 3, 'back to the list, one fewer');
  await tap('#modal [data-m="pf-design"][data-k="leo"]');
  ok(await p.$('#modal [data-m="p-age"][data-v="baby"].on'), 'Leo (turning 1) starts as a little one');
  await tap('#modal [data-m="p-save"]');
  await tap('#modal [data-m="pf-design"][data-k="paul"]');
  ok(await p.$('#modal [data-m="p-age"][data-v="adult"].on'), 'Paul is a grown-up');
  await p.fill('#p-also', 'Paulie');
  await tap('#modal [data-m="p-save"]');
  await tap('#modal [data-m="pf-no"][data-k="sarah"]');
  txt = await sheet();
  ok(/Welcome home/i.test(txt), 'with no one left, the welcome');
  let s = await save();
  ok(JSON.stringify(s.people.map((x) => [x.name, x.age, x.cal.lead])) === JSON.stringify([['Emma', 'kid', 14], ['Leo', 'baby', 7], ['Paul', 'adult', 7]]) && s.people[2].also[0] === 'Paulie', 'saved: Emma (a kid, a fortnight ahead), Leo, Paul (also Paulie)');
  ok(s.peopleNo.sarah === 'no' && s.pets.length === 1 && s.pets[0].name === 'Mittens' && s.npcs.filter((n) => n.kind === 'bird').map((n) => n.name).join() === 'Kermit', 'Sarah’s not a person; Mittens and Kermit live here');
  ok(s.house.items.some((i) => i.k === 'x_catbed' && i.id === s.pets[0].item), 'Mittens has her basket');
  const todos = s.quests.filter((q) => q.cal).map((q) => q.name);
  ok(todos.some((x) => /^Organise Leo’s birthday/.test(x)) && todos.some((x) => /^Get Leo a present/.test(x)) && todos.some((x) => /^Sort a present for Paul/.test(x)) && todos.some((x) => /^Organise Emma’s birthday/.test(x)) && !todos.some((x) => /Emma a present/.test(x)),
    'to-dos for what’s close (Emma’s party, 12 days out, but not her present yet): ' + todos.join(' · '));
  await clear();

  // ---- Today ----
  await p.evaluate(() => window.gotoFromWidget('quests:today')); await clear();
  const chip = await p.$eval('.chips [data-act="person"]', (e) => e.textContent).catch(() => '');
  ok(/Leo’s here/.test(chip) && /in 3 days/.test(chip) && /\+2/.test(chip), 'a chip says who’s here (the soonest first): ' + chip);
  ok(!(await p.$('.chips [data-act="people"]')), 'and no names left to look at');
  await shot('p04-today');
  await tap('.chips [data-act="person"]');
  txt = await sheet();
  ok(/3 days/.test(txt) && /Leo’s birthday \(1\)/i.test(txt) && /Here now, staying until 20 Nov/.test(txt) && /a week ahead/i.test(txt), 'their card counts down to the day: ' + txt.replace(/\s+/g, ' ').slice(0, 220));
  await shot('p05-card', 900);
  await tap('#modal .btns [data-m="close"]');

  // ---- the house ----
  await clear();
  await p.click('[data-act="tab"][data-v="hearth"]'); await p.waitForTimeout(3500);
  let acts = await p.evaluate(() => window.__house.inst.npcs.filter((a) => a.guest).map((a) => ({ id: a.npc.name, kid: a.kid, sheets: !!a.sheets, ev: a.npc.ev && a.npc.ev.icon })));
  ok(acts.length === 3 && acts.every((a) => a.sheets && a.ev === '🎂'), 'Emma, Leo and Paul are in the house, with their event to note: ' + JSON.stringify(acts));
  ok(acts.find((a) => a.id === 'Leo').kid === 'baby' && acts.find((a) => a.id === 'Emma').kid === 'kid' && !acts.find((a) => a.id === 'Paul').kid, 'Leo’s a little one, Emma a kid');
  const tops = await p.evaluate(() => { const h = window.__house.inst; return h.npcs.filter((a) => a.guest).map((a) => [a.npc.name, a.y - h._pos(a).top]); });
  ok(tops.find((x) => x[0] === 'Leo')[1] < tops.find((x) => x[0] === 'Emma')[1] && tops.find((x) => x[0] === 'Emma')[1] < tops.find((x) => x[0] === 'Paul')[1], 'and stand that much shorter: ' + JSON.stringify(tops));
  const strip = await p.$$eval('.hhs .hh .hn', (els) => els.map((e) => e.textContent));
  ok(['Emma', 'Leo', 'Paul'].every((x) => strip.some((y) => y.trim() === x)), 'the At home strip shows them: ' + strip.join(', '));
  await p.evaluate(() => window.__house.inst._emit('npc:' + JSON.parse(localStorage.gs).people.find((x) => x.name === 'Emma').id));
  await p.waitForTimeout(500);
  txt = await sheet();
  ok(/Emma/i.test(txt) && /days/.test(txt), 'tapping one opens their card: ' + txt.replace(/\s+/g, ' ').slice(0, 160));
  await tap('#modal .btns [data-m="close"]');
  const petId = (await save()).pets[0].item;
  await p.evaluate((id) => window.__house.inst._emit('pet:' + id), petId);
  await p.waitForTimeout(300);
  ok(/Mittens/.test(await p.evaluate(() => (document.querySelector('#toast') || {}).textContent || '')), 'tapping the cat says it’s Mittens');
  await shot('p06-house', 600);

  // ---- household and settings ----
  await clear();
  await p.evaluate(() => document.querySelector('[data-act="hh-page"]').click()); await p.waitForTimeout(800);
  txt = await sheet();
  ok(/From your calendar/i.test(txt) && /Leo/i.test(txt) && /here now/i.test(txt) && /Pets/i.test(txt) && /Kermit, Mittens/i.test(txt), 'the household lists them, and the pets: ' + txt.replace(/\s+/g, ' ').slice(-400));
  await tap('#modal [data-m="hh-person"]');
  await tap('#modal [data-m="p-edit"]');
  await tap('#modal [data-m="p-mode"][data-v="never"]');
  await tap('#modal [data-m="p-save"]');
  s = await save();
  const never = s.people.find((x) => x.cal.mode === 'never');
  ok(never && !(await p.evaluate((id) => window.__house.inst ? 0 : 0, never.id)), 'someone set to “never”: ' + (never && never.name));
  await p.evaluate(() => window.gotoFromWidget('records:settings')); await p.waitForTimeout(500);
  txt = await p.evaluate(() => document.querySelector('#main').innerText);
  ok(/AI helper/i.test(txt) && /Not connected/.test(txt) && /Groq, Gemini, OpenRouter, GitHub, Mistral/.test(txt) && /People and pets/i.test(txt) && /1 picked · 3 people/.test(txt), 'settings: the AI helper (not connected) and people and pets');

  // ---- the AI helper ----
  await tap('[data-act="interp-open"]');
  txt = await sheet();
  ok(/AI helper/i.test(txt) && /Groq\s*FREE/i.test(txt) && /Claude\s*PAID/i.test(txt) && !/Cerebras/.test(txt), 'the providers, free ones marked, Claude paid, Cerebras gone (it wants a card now)');
  await tap('#modal [data-m="interp-prov"][data-v="gemini"]');
  ok((await p.$eval('#interp-model', (e) => e.value)) === 'gemini-3.8-flash' && /Google may use/.test(await sheet()) && /paste your Gemini key/.test(await p.$eval('#interp-key', (e) => e.placeholder)), 'Gemini: its model, its privacy note, its key');
  await p.fill('#interp-key', 'AIza-test');
  await tap('#modal [data-m="interp-save"]');
  await p.waitForTimeout(300);
  ok(/It works/.test(await sheet()) && (await p.evaluate(() => window.__interp.provider)) === 'gemini', 'saved and tested');
  await tap('#modal [data-m="interp-prov"][data-v="groq"]');
  await tap('#modal [data-m="interp-save"]');
  ok(/Paste your Groq key first/.test(await sheet()), 'switching provider needs that provider’s key (the Gemini one isn’t sent to Groq)');
  await p.evaluate(() => window.handleBack()); await p.waitForTimeout(300);
  await p.evaluate(() => window.gotoFromWidget('records:settings')); await p.waitForTimeout(500);
  txt = await p.evaluate(() => document.querySelector('#main').innerText);
  ok(/Gemini · gemini-3\.8-flash/.test(txt) && /Free\./.test(txt), 'settings shows the connection');
  await tap('[data-act="oracle-test"]');
  await p.waitForTimeout(400);
  const asks = await p.evaluate(() => window.__asks);
  ok(asks.length === 1 && asks[0].max === 60, 'the test goes through the shared connection');
  await shot('p07-settings');

  // ---- night: the visitors go home ----
  const p2 = await cx.newPage(); watch(p2);
  await p2.clock.setFixedTime(new Date(NIGHT));
  await p2.addInitScript(native);
  await p.close(); p = p2;
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1500);
  await clear();
  await p.click('[data-act="tab"][data-v="hearth"]'); await p.waitForTimeout(3500);
  acts = await p.evaluate(() => window.__house.inst.npcs.filter((a) => a.guest).map((a) => ({ n: a.npc.name, gone: !!a.gone, sheets: !!a.sheets })));
  ok(acts.length >= 1 && acts.every((a) => a.gone && !a.sheets), 'at night the visitors have gone home: ' + JSON.stringify(acts));

  errs.forEach((e) => console.log(e));
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
})();
