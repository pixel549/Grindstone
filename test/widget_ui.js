// The interpreter's settings and live flow, and the widget clip capture, with a stand-in Android bridge.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s9/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    let interp = { on: false, provider: 'groq', base: '', model: '', err: '', okAt: 0, resting: false };
    window.__mode = 'good'; window.__frames = null; window.__interpCalls = 0;
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '1.6', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {},
      heraldInfo: () => JSON.stringify({ perm: true, write: true, cals: [{ id: 9, name: 'Grindstone', account: 'me', sync: true, visible: true }] }),
      askCalendar: () => {}, heraldArm: () => {}, heraldEnableSync: () => true, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: true, age: window.__frames ? 1000 : -1, sig: window.__frames ? window.__frames.sig : '' }),
      widgetFrames: (j) => { window.__frames = JSON.parse(j); return true; },
      interpInfo: () => JSON.stringify(interp),
      interpSet: (j) => { const o = JSON.parse(j); interp = Object.assign(interp, o, { on: true }); },
      interpForget: () => { interp = { on: false, provider: 'groq', base: '', model: '', err: '', okAt: 0, resting: false }; },
      interpTest: (cb) => setTimeout(() => { interp.okAt = Date.now(); window.__interpTested(cb, ''); }, 200),
      interpret: (j, cb) => {
        window.__interpCalls++;
        const o = JSON.parse(j);
        setTimeout(() => {
          if (window.__mode !== 'good') { window.__interpDone(cb, null); return; } // dead key: nothing happens
          const m = {}, w = o.quests.find((q) => /Weights/.test(q.name));
          o.reports.forEach((r) => { if (/gym|legs/.test(r.text)) m[r.k] = w.id; });
          window.__interpDone(cb, m);
        }, 300);
      },
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 450) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  const clear = async () => { for (let i = 0; i < 8; i++) { await p.waitForTimeout(600); const c = await p.$('#modal:not(.hidden) .band [data-m="close"], #modal:not(.hidden) .dlg [data-m="close"]'); if (!c) break; await c.click(); } };
  await p.click('[data-m="c-save"]'); await p.click('[data-m="pet-save"]');  /* 2.26: the pets step */
  await p.click('[data-m="again"]'); await p.waitForTimeout(1200); await p.click('[data-m="equip-close"]'); await clear();
  // herald on; set up the interpreter
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.herald.on = true; s.herald.cal = 9; localStorage.gs = JSON.stringify(s); window.onResume(); });
  await p.click('[data-act="tab"][data-v="records"]'); await p.click('[data-act="sub"][data-v="settings"]');
  await p.evaluate(() => document.querySelector('[data-act="interp-open"]').scrollIntoView({ block: 'center' }));
  await shot('01-settings');
  await p.click('[data-act="interp-open"]'); await shot('02-sheet');
  await p.fill('#interp-key', 'gsk_test'); await p.click('[data-m="interp-save"]'); await p.waitForTimeout(500);
  console.log('test message:', await p.textContent('#interp-msg'));
  await shot('03-tested');
  await p.click('.scrim', { position: { x: 20, y: 20 } });
  // the herald brings two reports it can't place; the interpreter places one
  await p.click('[data-act="tab"][data-v="quests"]'); await p.click('[data-act="sub"][data-v="today"]');
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.herald.unclaimed.push({ k: 'x1', text: 'Smashed legs at the gym', n: 1, t: Date.now() }, { k: 'x2', text: 'Played guitar', n: 1, t: Date.now() }); localStorage.gs = JSON.stringify(s); window.onResume(); });
  await p.waitForTimeout(800);
  console.log('toast:', await p.evaluate(() => (document.querySelector('#toast') || {}).textContent));
  console.log('after:', await p.evaluate(() => { const s = JSON.parse(localStorage.gs); return JSON.stringify({ left: s.herald.unclaimed.map((u) => u.text + (u.tried ? ' (tried)' : '')), calls: window.__interpCalls }); }));
  await shot('04-today');
  // a dead key: nothing breaks, the report waits
  await p.evaluate(() => { window.__mode = 'dead'; const s = JSON.parse(localStorage.gs); s.herald.unclaimed.push({ k: 'x3', text: 'Gym again', n: 1, t: Date.now() }); localStorage.gs = JSON.stringify(s); window.onResume(); });
  await p.waitForTimeout(800);
  console.log('dead key:', await p.evaluate(() => JSON.stringify({ left: JSON.parse(localStorage.gs).herald.unclaimed.map((u) => u.text), calls: window.__interpCalls })));
  // widget clip gets captured in the background
  const t0 = Date.now();
  await p.waitForFunction(() => window.__frames, null, { timeout: 120000 });
  const fr = await p.evaluate(() => ({ n: window.__frames.frames.length, interval: window.__frames.interval, spot: window.__frames.spot, sig: window.__frames.sig.slice(0, 40) }));
  console.log('widget clip:', JSON.stringify(fr), 'after', Date.now() - t0, 'ms');
  const frames = await p.evaluate(() => window.__frames.frames);
  fs.rmSync(OUT + 'clip', { recursive: true, force: true }); fs.mkdirSync(OUT + 'clip');
  frames.forEach((f, i) => fs.writeFileSync(OUT + 'clip/f' + String(i).padStart(2, '0') + '.jpg', Buffer.from(f, 'base64')));
  console.log('omens now:', await p.evaluate(() => JSON.stringify(G.widgetOmens(JSON.parse(localStorage.gs), G.today()))));
  // still usable afterwards
  await p.click('[data-act="tab"][data-v="hearth"]'); await p.waitForSelector('#h3slot.ready', { timeout: 120000 }); await shot('05-hearth-after-capture', 2500);
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
