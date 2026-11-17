// The herald's UI with a stand-in for the Android bridge (the matching itself is tested in HeraldTest.java).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT = '/home/claude/grindstone/test/s8/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    const cals = [{ id: 3, name: 'you@example.com', account: 'you@example.com', sync: true, visible: true }, { id: 9, name: 'Grindstone', account: 'you@example.com', sync: false, visible: true }];
    let perm = false;
    window.__pending = [];
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '1.5', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {},
      heraldInfo: () => JSON.stringify({ perm, write: perm, cals: perm ? cals : [] }),
      askCalendar: () => { perm = true; setTimeout(() => window.onHeraldPerm(true), 30); },
      heraldArm: () => { window.__armed = (window.__armed || 0) + 1; },
      heraldEnableSync: (id) => { const c = cals.find((x) => String(x.id) === id); if (c) c.sync = true; return !!c; },
      copy: (t) => { window.__copied = t; },
      // stand-in for Herald.sync(live): credits titles that exactly name a quest, the rest go unclaimed
      heraldSync: () => {
        const s = JSON.parse(localStorage.getItem('gs')); if (!window.__pending.length) return '{}';
        const t = G.today(), done = []; let xp = 0, gold = 0, un = 0, levels = 0, level = s.level;
        window.__pending.splice(0).forEach((title, i) => {
          const m = title.match(/^(.*?)\s*×(\d+)$/); const name = m ? m[1] : title, n = m ? +m[2] : 1;
          const q = s.quests.find((x) => x.name === name);
          if (!q) { s.herald.unclaimed.push({ k: 'k' + Date.now() + i, text: name, n, t: Date.now() }); un++; return; }
          let c = 0; for (let j = 0; j < n; j++) { const r = G.complete(s, q.id, t, Date.now() + j); if (!r) break; s.log[0].h = 1; xp += r.xp; gold += r.gold; levels += r.levels; level = r.level; c++; }
          done.push({ q: q.id, n: q.name, c, want: n });
        });
        s.herald.last = Date.now();
        localStorage.setItem('gs', JSON.stringify(s));
        return JSON.stringify({ changed: true, done, xp, gold, levels, level, unclaimed: un });
      },
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 450) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  const clear = async () => { for (let i = 0; i < 8; i++) { await p.waitForTimeout(600); const c = await p.$('#modal:not(.hidden) .band [data-m="close"], #modal:not(.hidden) .dlg [data-m="close"]'); if (!c) break; await c.click(); } };
  await p.click('[data-m="c-save"]'); await p.click('[data-m="pet-save"]');  /* 2.26: the pets step */
  await p.click('[data-m="again"]'); await p.waitForTimeout(1200); await p.click('[data-m="equip-close"]'); await clear();
  // turn the herald on
  await p.click('[data-act="tab"][data-v="records"]'); await p.click('[data-act="sub"][data-v="settings"]');
  await p.evaluate(() => { document.querySelector('[data-act="herald-toggle"]').scrollIntoView({ block: 'center' }); });
  await shot('01-settings-off');
  await p.click('[data-act="herald-toggle"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelector('[data-act="herald-toggle"]').scrollIntoView({ block: 'start' }); document.getElementById('main').scrollTop -= 60; });
  await shot('02-settings-on');
  console.log('herald state:', await p.evaluate(() => JSON.stringify({ on: JSON.parse(localStorage.gs).herald.on, cal: JSON.parse(localStorage.gs).herald.cal, armed: window.__armed })));
  await p.click('[data-act="herald-sync-on"]'); await p.waitForTimeout(300);
  console.log('sync warning gone:', !(await p.$('[data-act="herald-sync-on"]')));
  await p.click('[data-act="herald-copy"]');
  console.log('copied:', (await p.evaluate(() => window.__copied)).split('\n').slice(0, 4).join(' | '), '...');
  // Claude logs three deeds; the calendar changes while the app is open
  await p.click('[data-act="tab"][data-v="quests"]'); await p.click('[data-act="sub"][data-v="today"]');
  await p.evaluate(() => { window.__pending.push('Swim', 'Log my meals ×2', 'Played guitar for 30 min'); window.heraldPoll(); });
  await shot('03-today-after', 300);
  console.log('toast:', await p.evaluate(() => (document.querySelector('#toast') || {}).textContent));
  await p.click('[data-act="herald-claim"]'); await shot('04-claim-sheet');
  await p.click('.pick:has-text("Read")'); await p.waitForTimeout(300);
  console.log('after claim:', await p.evaluate(() => { const s = JSON.parse(localStorage.gs); const q = s.quests.find((x) => x.name === 'Read'); return JSON.stringify({ unclaimed: s.herald.unclaimed.length, aliases: q.aliases.slice(-1), count: q.count }); }));
  await shot('05-claimed');
  // deeds that arrived while the app was shut
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.herald.news = [{ changed: true, done: [{ n: 'Mow the lawn', c: 1 }, { n: 'Drink enough water', c: 1 }], xp: 30, gold: 18, unclaimed: 0, t: Date.now() }]; localStorage.gs = JSON.stringify(s); window.onResume(); });
  await shot('06-news');
  await clear();
  await p.click('[data-act="tab"][data-v="records"]'); await p.click('[data-act="sub"][data-v="deeds"]'); await shot('07-deeds');
  await p.click('[data-act="tab"][data-v="quests"]'); await p.click('[data-act="sub"][data-v="today"]');
  if (!(await p.$('.row[data-act="edit"]:has-text("Swim")'))) { await p.click('[data-act="fold-done"]'); await p.waitForTimeout(300); }   // 2.9: done today, so it is in the fold
  await p.click('.row[data-act="edit"]:has-text("Swim")'); await shot('08-editor');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
