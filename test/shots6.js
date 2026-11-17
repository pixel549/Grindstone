const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT = '/home/claude/grindstone/test/s6/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  let calls = 0;
  // mock the Claude API
  await p.route('https://api.anthropic.com/v1/messages', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const raw = route.request().postData() || (route.request().postDataBuffer() || '').toString();
    let req = null; try { req = JSON.parse(raw); } catch (e) { req = null; }
    console.log('oracle request', route.request().method(), raw ? raw.length + ' bytes' : 'no body', req ? req.model : '');
    const isTest = req ? req.max_tokens === 20 : (calls++ === 0);
    const swim = { id: 1 };
    const text = isTest ? 'The Oracle hears you.' : JSON.stringify([
      { title: 'The Tide Waits', lore: 'Swim three times. The water does not care for excuses.', filter: { type: 'quest', id: swim.id }, target: 3, gold: 60 },
      { title: 'Purge the Overgrowth', lore: 'Mow the lawn before it files for independence.', filter: { type: 'home', home: 'lawn' }, target: 1, gold: 45 },
      { title: 'Feed the Mind', lore: 'Two study blocks. The certificate will not finish itself.', filter: { type: 'stat', stat: 'INT' }, target: 2, gold: 30 }]);
    await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ content: [{ type: 'text', text }] }) });
  });
  await p.clock.setFixedTime(new Date('2026-11-07T14:10:00'));
  await p.goto('file:///home/claude/grindstone/assets/index.html');
  const clear = async () => { for (let i = 0; i < 8; i++) { await p.waitForTimeout(800); const c = await p.$('#modal:not(.hidden) .band [data-m="close"], #modal:not(.hidden) .dlg [data-m="close"]'); if (!c) break; await shot('notice-' + i, 0); await c.click(); } };
  const shot = async (n, ms = 450) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  await shot('01-creator', 700);
  await p.click('[data-m="c-save"]'); await shot('02-welcome');
  await p.click('[data-m="again"]'); await p.waitForTimeout(1300); await shot('03-reveal');
  await p.click('[data-m="equip-close"]'); await shot('04-today');
  // complete a few quests → level up
  const ids = await p.$$eval('[data-act="complete"]', els => els.map(e => e.dataset.id));
  for (const id of ids.slice(0, 6)) { await p.click(`[data-act="complete"][data-id="${id}"]`); await p.waitForTimeout(600); if (await p.$('.band .bn')) { await shot('05-levelup', 200); await p.click('.band [data-m="close"]'); await p.waitForTimeout(300); } while (await p.$('.band [data-m="close"]')) { await shot('05b-notice', 100); await p.click('.band [data-m="close"]'); await p.waitForTimeout(300); } }
  await clear(); await shot('06-today-done');
  // build a lived-in save
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('grindstone')); const t = G.today();
    s.gold = 2600; s.level = 9; s.created = G.addDays(t, -40);
    s.homeSeed = { lawn: G.addDays(t, -25), fridge: G.addDays(t, -8), laundry: G.addDays(t, -3), aviary: G.addDays(t, -16) };
    s.lastTraining = G.addDays(t, -5);
    for (let i = 0; i < 8; i++) s.inv.push(G.rollItem(s, i % 5 === 4 ? 3 : 1));
    s.decor.owned.push('armchair', 'telescope', 'gnome');
    localStorage.setItem('grindstone', JSON.stringify(s)); window.onResume();
  });
  await clear();
  await p.click('[data-act="tab"][data-v="status"]'); await shot('07-attr');
  await p.click('[data-act="sub"][data-v="equip"]'); await shot('08-equip');
  await p.click('.irow:not(:has(.tag.on))'); await shot('09-item');
  await p.click('[data-m="equip"]'); await p.click('[data-act="eqslot"][data-v="head"]'); const ir = await p.$('.irow:not(:has(.tag.on))'); if (ir) { await ir.click(); await p.click('[data-m="equip"]'); }
  await p.click('[data-act="eqslot"][data-v="body"]'); const ir2 = await p.$('.irow:not(:has(.tag.on))'); if (ir2) { await ir2.click(); await p.click('[data-m="equip"]'); }
  await shot('10-equip-geared');
  await p.click('[data-act="sub"][data-v="relics"]'); await shot('11-relics');
  await p.click('[data-act="tab"][data-v="hearth"]'); await shot('12-hearth');
  await p.click('.cond'); await shot('13-hearth-sheet'); await p.click('.scrim', { position: { x: 20, y: 20 } });
  await p.click('[data-act="tab"][data-v="quests"]'); await p.click('[data-act="sub"][data-v="vows"]'); await shot('14-vows');
  await p.click('[data-act="new-vow"]'); await p.fill('#v-title', 'Swim 300m under five minutes'); await p.click('[data-m="v-kind"][data-v="manual"]'); await p.click('[data-m="v-win"][data-v="date"]'); await p.fill('#v-reward', 'New goggles'); await p.click('[data-m="v-gold"][data-v="25"]'); await p.click('[data-m="v-chest"]'); await shot('15-vow-editor');
  await p.click('[data-m="v-save"]');
  await p.click('[data-act="new-vow"]'); await p.fill('#v-title', 'Six swims'); await p.selectOption('#v-filter', { label: '🏊 Swim' }); await p.click('[data-m="v-target"][data-v="1"]'); await p.fill('#v-reward', 'Takeaway night'); await p.click('[data-m="v-save"]');
  await clear();
  await shot('16-vows-list');
  // oracle
  await p.click('[data-act="tab"][data-v="records"]'); await p.click('[data-act="sub"][data-v="settings"]'); await shot('17-settings');
  await p.fill('#key-in', 'sk-ant-test'); await p.click('[data-act="key-save"]'); await p.click('[data-act="oracle-test"]'); await shot('18-oracle-test', 900);
  await p.click('[data-act="oracle"]'); await p.waitForTimeout(1200); await clear(); await p.click('[data-act="tab"][data-v="quests"]'); await p.click('[data-act="sub"][data-v="vows"]'); await shot('19-oracle-trials');
  await p.click('[data-act="tab"][data-v="goods"]'); await shot('20-coffers');
  await p.click('[data-act="sub"][data-v="relics"]'); await shot('21-relic-shop');
  await p.click('[data-act="tab"][data-v="records"]'); await p.click('[data-act="sub"][data-v="feats"]'); await shot('22-feats');
  await p.click('[data-act="sub"][data-v="deeds"]'); await shot('23-deeds');
  await p.click('[data-act="tab"][data-v="quests"]'); await p.click('[data-act="sub"][data-v="today"]'); await p.click('#fab'); await shot('24-editor');
  console.log(errs.length ? errs.join('\n') : 'no JS errors');
  await b.close();
})();
