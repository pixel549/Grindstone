// 2.22: thirteen themes and their bosses, the atlas behind them, one new dungeon a day, old saves and the new gold.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s24/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const cx_ = await b.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true }); const p = await cx_.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => {
    window.__frames = null;
    window.Native = {
      load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.0', canNotify: () => true,
      askNotify: () => {}, hasOracleKey: () => false, share: () => {}, copy: () => {},
      heraldInfo: () => JSON.stringify({ perm: true, write: true, cals: [{ id: 7, name: 'Findmyshift roster', account: 'feed' }, { id: 3, name: 'Grindstone', account: 'gmail' }] }), rosterEvents: () => JSON.stringify(window.__roster || []), backupWrite: (j, n) => { window.__bk = [j.length, n]; return 'ok: Downloads/Grindstone/' + n; }, backupPick: (cb) => { window.__pick = cb; }, askCalendar: () => {}, heraldArm: () => {}, heraldSync: () => '{}',
      widgetInfo: () => JSON.stringify({ placed: true, sig: '', age: -1 }), widgetFrames: (j) => { window.__frames = JSON.parse(j); return true; }, interpInfo: () => JSON.stringify({ on: false }),
    };
  });
  await p.goto('http://localhost:8765/index.html');
  const shot = async (n, ms = 400) => { await p.waitForTimeout(ms); await p.screenshot({ path: OUT + n + '.png' }); };
  // first run: creator
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(800); await shot('h01-creator');
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const settle = async () => { for (let i = 0; i < 14; i++) { await p.waitForTimeout(350); if (!(await p.$('#modal:not(.hidden)'))) break; const cs = await p.$('[data-m="c-save"]'); if (cs) { await cs.click(); continue; } const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn'); if (c) await c.click(); } };
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(350); if (!(await p.$('#modal:not(.hidden)'))) break; const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn'); if (c) await c.click(); }
  // every theme's foes and bosses have a sprite in the atlas
  const art = await p.evaluate(async () => {
    const m = await (await fetch('2d/delve.json')).json(), miss = [], seen = new Set();
    G.THEMES.forEach((T) => { T.bosses.forEach((B) => { if (!B.vis || !m[B.vis[0]]) miss.push(T.k + ' boss ' + B.names[0]); }); });
    for (let n = 0; n < 78; n++) { const D = G.dungeonFor(99, n); seen.add(D.theme + '|' + D.boss.vis[0]); }
    const lpc = Object.keys(m).filter((k) => m[k].lpc), bad = lpc.filter((k) => ['idle', 'hurt', 'atk'].some((s) => !Array.isArray(m[k][s]) || m[k][s].length !== 8));
    return { distinct: seen.size, themes: G.THEMES.length, bosses: G.THEMES.reduce((a, T) => a + T.bosses.length, 0), miss, lpc: lpc.length, bad, names: [0, 13, 26, 39, 65, 78].map((n) => G.dungeonFor(99, n).boss.name), laps: [12, 13, 26, 78].map((n) => G.dungeonFor(99, n).name) };
  });
  console.log(JSON.stringify(art));
  ok(art.themes === 13 && art.bosses === 78 && art.distinct === 78, 'thirteen themes, six bosses each, 78 different ones in the first 78 dungeons');
  ok(!art.miss.length, 'every boss has a sprite in the atlas ' + art.miss.join(', '));
  ok(art.lpc >= 70 && !art.bad.length, 'every humanoid strip is in the cropped format');
  ok(!/Reborn/.test(art.names.slice(0, 5).join()) && /Reborn/.test(art.names[5]), 'a boss comes back Reborn only on the seventh lap');
  ok(/^the Deeper /.test(art.laps[1]) && /^the Deepest /.test(art.laps[2]) && /^the Endless /.test(art.laps[3]) && !/^the Deeper/.test(art.laps[0]), 'laps are thirteen dungeons long, six to a year');
  // a boss's trick is worded for its element
  const mt = await p.evaluate(() => { const out = []; for (let n = 0; n < 78; n++) { const b = G.dungeonFor(5, n).boss; if (b.mech === 'poison' || b.mech === 'breath') out.push(b.el + ':' + b.mt); } return out; });
  ok(mt.every((x) => !/^(fire|frost|storm|holy):.*\brot\b/.test(x)), 'no fire, frost, storm or holy boss "oozes rot"');
  // the crawl draws a new humanoid boss
  const drew = await p.evaluate(async () => {
    const s = JSON.parse(localStorage.gs); ['STR', 'END', 'VIT', 'DIS', 'INT'].forEach((k) => { s.stats[k] = 2000; }); s.level = 30; s.delve.n = 1; s.delve.seed = 777;
    const inp = G.inputFor(s, {}); inp.n = 1; const out = G.simRun(inp, {}, false);
    const el = document.createElement('div'); el.className = 'tscene'; el.style.cssText = 'position:fixed;left:0;top:0;width:393px;height:280px;z-index:999;background:#000'; document.body.appendChild(el);
    const c = new Crawl(el, { base: '2d/', D: out.dungeon, look: G.normLook(s.look), eq: inp.eq, comp: null }); await c.ready;
    const i = out.log.findIndex((l) => l.k === 'boss'); c.fastForward(out.log.slice(0, i)); c.play(out.log[i]); window.__c = c;
    await new Promise((r) => setTimeout(r, 4300));
    const b = c.foes.find((f) => f.boss); const kind = b && b.kind; c.dispose(); el.remove(); return { kind, theme: out.dungeon.theme };
  });
  ok(drew.theme === 'hold' && drew.kind === 'brigandking', 'the Brigands’ Hold boss is the brigand king sprite (' + JSON.stringify(drew) + ')');
  // gold
  const gold = await p.evaluate(() => ({ diff: G.DIFF.map((d) => d.gold), sell: G.sellValue({ tier: 4, lvl: 8 }), worth: G.itemValue({ tier: 4, lvl: 8 }), star: G.starGold(300), base: G.dungeonFor(1, 10).gold }));
  console.log(JSON.stringify(gold));
  ok(gold.diff.join() === '6,12,24,40,70', 'deeds pay double');
  ok(Math.abs(gold.sell - gold.worth / 3) <= 1, 'selling fetches a third of the worth');
  ok(gold.star === 60 && gold.base === 220, 'a star pays a fifth of the clear; a clear pays 40 + 18n');
  // an old save: what he knew about the dungeon he's on (and later) goes; earlier ones stay
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.delve.n = 5; delete s.delve.tv; s.delve.known = { 3: { boss: true }, 5: { k0a: 20 }, 6: { x: 1 } }; s.delve.orders.ev = { 4: { k0: 'a' }, 5: { k0: 'b' } }; localStorage.gs = JSON.stringify(s); });
  await p.reload(); await p.waitForTimeout(1200); await settle();
  const mig = await p.evaluate(() => { const s = JSON.parse(localStorage.gs); return { tv: s.delve.tv, known: Object.keys(s.delve.known), ev: Object.keys(s.delve.orders.ev) }; });
  console.log(JSON.stringify(mig));
  ok(mig.tv === 2 && mig.known.join() === '3' && mig.ev.join() === '4', 'an old save forgets the re-laid-out dungeons from the current one on');
  // one new dungeon a day
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.delve.opens = G.addDays(G.today(), 1); localStorage.gs = JSON.stringify(s); });
  await p.reload(); await p.waitForTimeout(1200); await settle();
  await p.click('#tabs [data-act="tab"][data-v="delve"]'); await p.waitForTimeout(900);
  const shut = await p.evaluate(() => ({ go: !!document.querySelector('[data-act="delve-go"]'), txt: (document.querySelector('#main') || document.body).innerText, due: G.autoDue(JSON.parse(localStorage.gs), new Date(new Date().setHours(23, 59))) }));
  await p.screenshot({ path: OUT + 'shut.png' });
  ok(!shut.go && /opens tomorrow/.test(shut.txt), 'the day after a clear there is no Set out button, and it says when the way opens');
  ok(shut.due === false, 'and he does not set out on his own');
  await p.evaluate(() => { const s = JSON.parse(localStorage.gs); s.delve.opens = G.today(); localStorage.gs = JSON.stringify(s); });
  await p.reload(); await p.waitForTimeout(1200); await settle();
  ok(await p.evaluate(() => G.delveOpens(JSON.parse(localStorage.gs)) === null), 'on the day it opens, it is open');
  // 2.22.1: no gold-tier gear before level 15, and nothing guaranteed legendary
  const leg = await p.evaluate(() => { let early = 0, mid = 0; for (let i = 0; i < 3000; i++) { if (G.rollItem({ level: 8, seq: 0 }, 4).tier === 4) early++; if (G.rollItem({ level: 30, seq: 0 }, 4).tier === 4) mid++; }
    const D = G.dungeonFor(3, 17), caches = D.events.filter((e) => e.loot).map((e) => e.loot.tier); return { early, mid, caches }; });
  console.log(JSON.stringify(leg));
  ok(leg.early === 0 && leg.mid > 0 && leg.mid < 3000, 'no legendaries at level 8; at level 30 some, never all');
  ok(leg.caches.every((t) => t < 4), 'nothing found in dungeon 17 is legendary');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await b.close();
})();
