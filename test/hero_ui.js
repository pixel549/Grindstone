// The modelled hero: first-run creator, changing the look, then the portraits in status, kit and delve with gear.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s12/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '1.9', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {},
      heraldInfo: () => JSON.stringify({ perm: false, write: false, cals: [] }), askCalendar: () => {}, heraldArm: () => {}, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: false }), widgetFrames: () => true, interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const live = async () => { await p.waitForFunction(() => { const h = window.__hero; return h && h.sheets && !h.busy && document.querySelector('.h3hero.live canvas'); }, null, { timeout: 60000 }); await p.waitForTimeout(900); };
  const shot = async (n, ms = 300) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  await live(); await shot('01-creator');
  await p.click('[data-m="c-set"][data-k="sex"][data-v="f"]'); await live(); await shot('02-woman');
  await p.click('[data-m="c-set"][data-k="hair"][data-v="buns"]'); await p.click('[data-m="c-set"][data-k="hairColour"][data-v="#a8382a"]'); await p.click('[data-m="c-set"][data-k="skin"][data-v="#7a4a2e"]'); await live(); await shot('03-woman-look');
  await p.click('[data-m="c-set"][data-k="sex"][data-v="m"]'); await p.click('[data-m="c-set"][data-k="hair"][data-v="cropped"]'); await p.click('[data-m="c-set"][data-k="beard"][data-v="beard"]'); await p.click('[data-m="c-set"][data-k="skin"][data-v="#e3b48f"]'); await p.click('[data-m="c-set"][data-k="hairColour"][data-v="#4a2f1f"]'); await live(); await shot('04-man');
  await p.click('[data-m="c-save"]'); await p.click('[data-m="pet-save"]');  /* 2.26: the pets step */
  await p.click('[data-m="again"]').catch(() => {}); await p.waitForTimeout(1000); await p.click('[data-m="equip-close"]').catch(() => {});
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(500); const c = await p.$('#modal:not(.hidden) .band [data-m="close"], #modal:not(.hidden) .dlg [data-m="close"], #modal:not(.hidden) .sheet [data-m="close"]'); if (!c) break; await c.click().catch(() => {}); }
  console.log('sheet after begin:', await p.evaluate(() => window.__delve.ui.sheet));
  // kit: one of each tier
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.gs);
    const mk = (id, slot, base, art, tier, x) => Object.assign({ id: id, slot: slot, base: base, art: art, name: base, tier: tier, bonus: { STR: 1 + tier }, lvl: 1 }, x || {});
    s.inv = [mk(901, 'weapon', 'Longsword', 'blade', 1), mk(902, 'body', 'Gambeson', 'light', 1), mk(903, 'head', 'Hood', 'hood', 0),
      mk(904, 'weapon', 'Greatsword', 'blade', 3, { el: 'fire' }), mk(905, 'body', 'Cuirass', 'armour', 3, { res: 'frost' }), mk(906, 'head', 'Helm', 'helm', 3),
      mk(907, 'weapon', 'Lantern Staff', 'staff', 4), mk(908, 'body', 'Robes', 'robe', 4)];
    s.eq = { weapon: null, head: null, body: null, charm: null };
    localStorage.gs = JSON.stringify(s); window.onResume();
  });
  await p.click('[data-act="tab"][data-v="status"]'); await live(); await shot('05-status-rags');
  const equip = async (w, h, bd) => { await p.evaluate(([w, h, bd]) => { const s = JSON.parse(localStorage.gs); s.eq = { weapon: w, head: h, body: bd, charm: null }; localStorage.gs = JSON.stringify(s); window.onResume(); }, [w, h, bd]); };
  await p.click('[data-act="sub"][data-v="equip"]');
  await equip(901, null, 902); await live(); await shot('06-kit-t1');
  await equip(904, 906, 905); await live(); await shot('07-kit-t3');
  await equip(907, null, 908); await live(); await shot('08-kit-t4');
  await p.click('[data-act="tab"][data-v="delve"]'); await live();
  await p.evaluate(() => { const e = document.querySelector('.dv-hero'); if (e) e.scrollIntoView({ block: 'center' }); }); await shot('09-delve-hero', 600);
  // rebirth as a woman: the house figure follows, the delve says "she"
  await p.click('[data-act="tab"][data-v="records"]'); await p.click('[data-act="sub"][data-v="settings"]'); await p.click('[data-act="creator"]'); await live();
  await p.click('[data-m="c-set"][data-k="sex"][data-v="f"]'); await p.click('[data-m="c-set"][data-k="hair"][data-v="long"]'); await live(); await shot('10-rebirth');
  await p.click('[data-m="c-save"]'); await p.waitForTimeout(500);
  await p.click('[data-act="tab"][data-v="delve"]'); await live();
  await p.evaluate(() => { const e = document.querySelector('.dv-hero'); if (e) e.scrollIntoView({ block: 'center' }); }); await shot('11-delve-she', 600);
  const st = await p.evaluate(() => { const s = JSON.parse(localStorage.gs); return { look: s.look, hd: document.querySelector('.hd') && [...document.querySelectorAll('.hd')].map((e) => e.textContent).find((t) => /stands/.test(t)) }; });
  console.log(JSON.stringify(st));
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
