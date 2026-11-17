// 2.2: delve as often as you like, companions from the household, onward after a clear, the nothing-changed warning.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s15/';
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
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.2', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {},
      heraldInfo: () => JSON.stringify({ perm: false, write: false, cals: [] }), askCalendar: () => {}, heraldArm: () => {}, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: false }), widgetFrames: () => true, interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  // a strong-ish hero with a healer in the house, a frost mage, and the birds unfed for ages
  await p.evaluate(() => {
    const t = G.today(), s = G.normalize(null, t), now = Date.now();
    s.lookSet = true; s.lookV = 1; s.hero.name = 'Jake'; s.look = Object.assign(s.look, { sex: 'm', hair: 'bald', beard: 'beard', extra: 'glasses' });
    ['STR', 'END', 'VIT', 'DIS', 'INT'].forEach((k) => { s.stats[k] = 400; });
    s.level = 9; s.gold = 300; s.welcomed = true;
    // the healer's calling answered: vitality deeds on six days of each of the last two weeks
    const heal = s.npcs.find((n) => n.comp === 'healer'); heal.name = 'Mum';
    const mage = s.npcs.find((n) => n.comp === 'mage'); mage.name = 'Sam'; mage.status = 'resident'; mage.el = 'frost';
    const vit = s.quests.find((x) => x.stat === 'VIT'), w0 = G.addDays(t, -((new Date().getDay() + 6) % 7));
    [-14, -7].forEach((o) => { for (let i = 0; i < 6; i++) { const d = G.addDays(w0, o + i), tt = new Date(d + 'T12:00:00').getTime(); s.log.push({ t: tt, d: d, q: vit.id, n: vit.name, i: vit.icon, x: 5, g: 2, s: 'VIT' }); } });
    const q = (n) => s.quests.find((x) => x.name === n);
    [['Strength training', 2], ['Mow the lawn', 30], ['Grocery shop', 5], ['Log my meals', 1]].forEach(([n, h]) => { const x = q(n); s.log.unshift({ t: now - h * 3600e3, d: new Date(now - h * 3600e3).toISOString().slice(0, 10), q: x.id, n: x.name, i: x.icon, x: [5, 10, 20, 35, 60][x.diff - 1], g: 5, s: x.stat }); });
    s.log.sort((a, b) => b.t - a.t);
    localStorage.gs = JSON.stringify(s);
  });
  await p.reload(); await p.waitForTimeout(1200);
  const arrived = await p.evaluate(() => { const s = JSON.parse(localStorage.gs); return { healer: s.npcs.find((n) => n.comp === 'healer').status, fighter: s.npcs.find((n) => n.comp === 'fighter').status, log: s.log.find((e) => /arrives/.test(e.n)) }; });
  ok(arrived.healer === 'resident' && arrived.fighter === 'waiting' && arrived.log, 'healer arrived on load from two weeks of vitality, fighter still waiting: ' + JSON.stringify(arrived));
  const clear = async () => { for (let i = 0; i < 8; i++) { await p.waitForTimeout(300); const open = await p.$('#modal:not(.hidden)'); if (!open) return; const c = (await p.$('#modal:not(.hidden) .btn[data-m="close"]')) || (await p.$('#modal:not(.hidden) [data-m="close"]')); if (c) await c.click().catch(() => {}); else await p.click('#modal .scrim', { position: { x: 10, y: 10 } }).catch(() => {}); } };
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  await shot('c00-boot', 300);
  console.log('modal:', await p.evaluate(() => { const m = document.querySelector('#modal:not(.hidden)'); return m ? m.innerText.slice(0, 200) + ' | ' + [...m.querySelectorAll('[data-m]')].map((x) => x.dataset.m).join(',') : 'none'; }));
  await clear();
  const st = () => p.evaluate(() => { const s = JSON.parse(localStorage.gs), d = s.delve; return { n: d.n, runs: d.runs, comp: d.comp, recs: (d.rec[d.n] || []).length, last: d.last && { res: d.last.res, comp: d.last.comp } }; });
  await p.click('[data-act="tab"][data-v="delve"]'); await p.waitForTimeout(500);
  ok(await p.$('[data-act="delve-comp"]') != null, 'companion row on the delve page');
  ok(/Going alone/.test(await p.evaluate(() => document.querySelector('[data-act="delve-comp"]').innerText)), 'starts out alone');
  // pick a companion
  await p.click('[data-act="delve-comp"]'); await p.waitForSelector('#modal:not(.hidden) [data-m="comp-set"]'); await p.waitForTimeout(800);
  const pick = await p.evaluate(() => [...document.querySelectorAll('#modal [data-m="comp-set"]')].map((r) => r.innerText.replace(/\s+/g, ' ')));
  ok(pick.some((t) => /Ruby/.test(t) && /Biter/.test(t)) && pick.some((t) => /Kermit/.test(t) && /Lookout/.test(t)) && pick.some((t) => /Mum/.test(t) && /Healer/.test(t)) && pick.some((t) => /Sam/.test(t) && /Mage/.test(t)), 'picker lists the birds and the companions who are here');
  const away = await p.evaluate(() => document.querySelector('#modal').innerText);
  ok(/not here yet/i.test(away) && /Sparring partner/i.test(away) && /Scout/i.test(away), 'and the ones still on their way');
  await shot('c01-picker');
  await p.click('[data-m="comp-set"][data-v="c-healer"]'); await p.waitForTimeout(500);
  ok((await st()).comp === 'c-healer', 'Mum (the healer) chosen');
  await p.evaluate(() => document.querySelector('[data-act="delve-comp"]').scrollIntoView({ block: 'center' }));
  await shot('c02-with-mum', 900);
  // run, skip to the end
  const runOnce = async (btn) => {
    await p.click(btn); await p.waitForSelector('.runp');
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(250);
      const q = await p.$('[data-m="run-pick"]'); if (q) { await q.click(); continue; }
      const sk = await p.$('[data-m="run-skip"]'); if (sk) { await sk.click(); continue; }
      if (await p.$('[data-m="run-done"]')) break;
    }
  };
  await runOnce('[data-act="delve-go"]');
  const log1 = await p.evaluate(() => document.querySelector('.rp-log').innerText);
  ok(/with Mum/.test(log1), 'the run log has Mum in it');
  await shot('c03-run-with-mum');
  const s1 = await st();
  ok(s1.runs === 1 && s1.last.comp === 'Mum', 'run banked with the companion: ' + JSON.stringify(s1));
  const cleared = s1.last.res === 'clear';
  if (cleared) {
    // 2.22: one new dungeon a day, so no Onward after a clear: the way down opens tomorrow
    ok(await p.$('[data-m="run-again"]') == null && /opens tomorrow/.test(await p.evaluate(() => document.querySelector('#modal').innerText)), 'no Onward after a clear: the next dungeon opens tomorrow');
    await shot('c04-opens-tomorrow');
  } else console.log('NOTE first run lost; skipping onward');
  await p.click('[data-m="run-done"]'); await p.waitForTimeout(500);
  // a fall leaves Go again there; a clear shuts the way till tomorrow
  ok(cleared ? (await p.$('[data-act="delve-go"]')) == null : (await p.$('[data-act="delve-go"]')) != null, cleared ? 'no Set out the day of a clear' : 'can go again the same day');
  // make him lose, then check the nothing-changed warning
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.delve.n = 25; s.delve.comp = ''; delete s.delve.opens; localStorage.gs = JSON.stringify(s); window.onResume(); });
  await p.click('[data-act="tab"][data-v="delve"]'); await p.waitForTimeout(400);
  await runOnce('[data-act="delve-go"]');
  const lost = await st();
  ok(lost.last.res === 'died', 'a dungeon far too deep beats him');
  await p.click('[data-m="run-done"]'); await p.waitForTimeout(500);
  const warn = await p.evaluate(() => document.querySelector('#main').innerText);
  ok(/Nothing's changed since he fell/.test(warn), 'warns that nothing has changed');
  await shot('c05-nothing-changed');
  // bring the healer: the warning goes
  await p.click('[data-act="delve-comp"]'); await p.waitForSelector('#modal:not(.hidden) [data-m="comp-set"]');
  await p.click('[data-m="comp-set"][data-v="c-healer"]'); await p.waitForTimeout(500);
  ok(!/Nothing's changed/.test(await p.evaluate(() => document.querySelector('#main').innerText)), 'changing the companion clears the warning');
  // Ruby sulks when the birds have been neglected for ages
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs), q = s.quests.find((x) => x.home === 'birds'); if (q) { const old = Date.now() - 20 * 86400e3; s.log.unshift({ t: old, d: new Date(old).toISOString().slice(0, 10), q: q.id, n: q.name, i: q.icon, x: 5, g: 1, s: q.stat }); } s.delve.comp = 'ruby'; localStorage.gs = JSON.stringify(s); window.onResume(); });
  await p.click('[data-act="tab"][data-v="delve"]'); await p.waitForTimeout(600);
  const rubyRow = await p.evaluate(() => document.querySelector('[data-act="delve-comp"]').innerText);
  ok(/sulking/i.test(rubyRow), 'Ruby sulks when unfed: ' + rubyRow.replace(/\s+/g, ' '));
  await p.evaluate(() => document.querySelector('[data-act="delve-comp"]').scrollIntoView({ block: 'center' }));
  await shot('c06-ruby-sulks', 900);
  // the household: companions with their callings
  await p.click('[data-act="tab"][data-v="hearth"]'); await p.waitForTimeout(400);
  await p.click('[data-act="hh-page"]'); await p.waitForTimeout(900);
  await p.waitForSelector('#modal:not(.hidden) .row.npc.comp'); const hh = await p.evaluate(() => document.querySelector('#modal').innerText);
  ok(/Companions/i.test(hh) && /Strength sessions on 2 days a week, 4 weeks running/i.test(hh) && /Study or reading on 4 days a week, 5 weeks running/i.test(hh) === false, 'companions listed with what brings the missing ones (mage is here)');
  await p.evaluate(() => document.querySelector('.row.npc.comp').scrollIntoView({ block: 'start' }));
  await shot('c07-companions', 600);
  await p.click('[data-m="hh-npc"][data-k="c-fighter"]'); await p.waitForSelector('#modal:not(.hidden) .cpips');
  await shot('c08-fighter-card', 600);
  await p.click('#modal .btn[data-m="close"]'); await p.waitForTimeout(300);
  if (!(await p.$('#modal:not(.hidden) [data-m="hh-npc"][data-k="c-healer"]'))) { await p.click('[data-act="hh-page"]'); await p.waitForSelector('#modal:not(.hidden) .row.npc.comp'); }
  await p.click('[data-m="hh-npc"][data-k="c-healer"]'); await p.waitForSelector('#modal:not(.hidden) [data-m="npc-edit"]');
  const hc = await p.evaluate(() => document.querySelector('#modal').innerText);
  ok(/Steady hands/.test(hc) && /Fresh poultice/.test(hc), 'healer card shows her buffs: ' + (hc.match(/Buffs[\s\S]{0,80}/) || [''])[0].replace(/\s+/g, ' '));
  await shot('c09-healer-card', 600);
  await p.click('#modal .btn[data-m="close"]'); await p.waitForTimeout(300);
  // a strength session: the toast tracks the sparring partner's calling
  await p.click('[data-act="tab"][data-v="quests"]'); await p.waitForTimeout(400);
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); window.__strId = s.quests.find((x) => x.stat === 'STR' && !x.archived).id; });
  const strId = await p.evaluate(() => window.__strId);
  const btn = await p.$(`[data-act="complete"][data-id="${strId}"]`);
  if (btn) { await btn.click(); await p.waitForTimeout(400); const tt = await p.evaluate(() => (document.querySelector('#toast') || {}).innerText || ''); ok(/Sparring partner: [12]\/2 this week/.test(tt), 'deed toast tracks the calling: ' + tt.replace(/\s+/g, ' ')); await shot('c10-toast'); }
  else console.log('NOTE no done button for the strength quest today');
  // a deed can also fulfil this week's trial: close whatever that put up
  for (let i = 0; i < 3; i++) { const b2 = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) [data-m="close"].btn'); if (!b2) break; await b2.click(); await p.waitForTimeout(400); }
  // the editor: a mage picks an element, no arrival or role choices for companions
  await p.click('[data-act="tab"][data-v="hearth"]'); await p.click('[data-act="hh-page"]'); await p.waitForTimeout(500);
  await p.click('[data-m="hh-npc"][data-k="c-mage"]'); await p.waitForSelector('#modal:not(.hidden) [data-m="npc-edit"]');
  await p.click('[data-m="npc-edit"]'); await p.waitForSelector('#modal:not(.hidden) [data-m="n-el"]'); await p.waitForTimeout(600);
  ok(!(await p.$('[data-m="n-via"]')) && !(await p.$('[data-m="n-role"]')), 'companion editor has no arrival or role choices');
  await p.click('[data-m="n-el"][data-v="holy"]'); await p.waitForTimeout(300);
  await p.click('[data-m="n-save"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => JSON.parse(localStorage.gs).npcs.find((n) => n.comp === 'mage').el === 'holy'), 'mage switched to holy');
  // someone you design yourself can tag along, at a quarter of a companion's strength
  if (!(await p.$('#modal:not(.hidden) [data-m="hh-new"]'))) { for (let i = 0; i < 3; i++) { const b2 = await p.$('#modal:not(.hidden) [data-m="close"]'); if (!b2) break; await b2.click(); await p.waitForTimeout(300); } await p.click('[data-act="hh-page"]'); await p.waitForTimeout(500); }
  await p.click('[data-m="hh-new"]'); await p.waitForSelector('#modal:not(.hidden) #n-about'); await p.waitForTimeout(500);
  ok(!!(await p.$('[data-m="n-role"]')), 'designed people get a role for tagging along');
  await p.click('[data-m="n-role"][data-v="scout"]'); await p.waitForTimeout(200);
  ok(/tag along at 25%/.test(await p.evaluate(() => document.querySelector('#modal').innerText)), 'the editor says they come at 25%');
  await p.fill('#c-name', 'Priya'); await p.click('[data-m="n-save"]'); await p.waitForTimeout(400);
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs), n = s.npcs.find((x) => x.name === 'Priya'); if (n) { n.status = 'resident'; localStorage.gs = JSON.stringify(s); window.onResume(); } });
  await p.click('[data-act="tab"][data-v="delve"]'); await p.waitForTimeout(300);
  await p.click('[data-act="delve-comp"]'); await p.waitForSelector('#modal:not(.hidden) [data-m="comp-set"]');
  const pk = await p.evaluate(() => document.querySelector('#modal').innerText);
  ok(/Priya/.test(pk), 'and they’re offered for the delve: ' + ((pk.match(/Priya[^\n]*\n?[^\n]*/) || [''])[0]).replace(/\s+/g, ' '));
  const priya = await p.evaluate(() => { const s = JSON.parse(localStorage.gs), n = s.npcs.find((x) => x.name === 'Priya'); s.delve.comp = n.id; const c = G.compFor(s, Date.now()); return { m: c.m, tag: c.tag, role: c.role }; });
  ok(priya.m === 0.25 && priya.tag && priya.role === 'scout', 'a tagalong scout at 25%: ' + JSON.stringify(priya));
  console.log(errs.join('\n') || 'no errors');
  if (errs.length) process.exitCode = 1;
  await b.close();
})();
