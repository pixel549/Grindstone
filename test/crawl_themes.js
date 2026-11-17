// Each dungeon theme in the crawl: fast-forward a strong run to its boss and take a frame.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s16/';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.addInitScript(() => { window.Native = { load: () => localStorage.getItem('gs') || '', save: (r) => localStorage.setItem('gs', r), haptic: () => {}, version: () => '2.4', canNotify: () => true, askNotify: () => {}, hasOracleKey: () => false, heraldInfo: () => '{}', widgetInfo: () => '{}', interpInfo: () => '{}' }; });
  await p.goto('http://localhost:8765/index.html');
  await p.click('[data-m="c-save"]');
  await p.waitForTimeout(500);
  const seen = {};
  for (let n = 0; n < 14; n++) {
    const th = await p.evaluate(async (n) => {
      const s = JSON.parse(localStorage.gs);
      ['STR', 'END', 'VIT', 'DIS', 'INT'].forEach((k) => { s.stats[k] = 2000; });
      s.level = 30; s.delve.n = n;
      const D = G.dungeonFor(s.delve.seed, n);
      if (window.__seen && window.__seen[D.theme]) return null;
      (window.__seen = window.__seen || {})[D.theme] = 1;
      const inp = G.inputFor(s, {});
      inp.n = n;
      const out = G.simRun(inp, {}, false);
      document.querySelectorAll('.tscene').forEach((x) => x.remove());
      const el = document.createElement('div'); el.className = 'tscene';
      el.style.cssText = 'position:fixed;left:0;top:0;width:393px;height:280px;z-index:999;background:#000';
      document.body.appendChild(el);
      const c = new Crawl(el, { base: '2d/', D: out.dungeon, look: G.normLook(s.look), eq: inp.eq, comp: null });
      await c.ready;
      let i = out.log.findIndex((l) => l.k === 'boss'); if (i < 0) i = out.log.length - 1;
      c.fastForward(out.log.slice(0, i));
      c.play(out.log[i]);
      window.__c = c;
      return { theme: D.theme, name: D.name, res: out.res, lines: out.log.length };
    }, n);
    if (!th) continue;
    await p.waitForTimeout(3600);
    await p.screenshot({ path: OUT + 'theme-' + th.theme + '.png', clip: { x: 0, y: 0, width: 393, height: 280 } });
    console.log(n, JSON.stringify(th));
    await p.evaluate(() => window.__c.dispose());
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
