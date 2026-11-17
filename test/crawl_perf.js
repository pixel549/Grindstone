// How heavy the crawl is to draw: play a run at a phone-sized viewport and read Crawl.stats(), with Chrome's CPU
// throttling at 1x, 4x and 6x (Lighthouse uses 4x on a fast desktop to stand in for a mid-tier phone).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const out = [];
  for (const rate of [1, 4, 6]) {
    const p = await b.newPage({ viewport: { width: 411, height: 891 }, deviceScaleFactor: 2.625 });
    await p.addInitScript(() => { window.Native = { load: () => '', save: () => {}, haptic: () => {}, version: () => '2.6', canNotify: () => true, askNotify: () => {}, hasOracleKey: () => false, heraldInfo: () => '{}', widgetInfo: () => '{}', interpInfo: () => '{}' }; });
    await p.goto('http://localhost:8765/index.html');
    await p.waitForFunction(() => window.G && window.Crawl);
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: rate });
    await p.evaluate(async () => {
      const L = 8, r = G.delveRng(31), st = { level: L, seq: 0 }, eq = {};
      G.SLOTS.forEach((sl) => { for (let k = 0; k < 80; k++) { const it = G.rollItem(st, 2, r); if (it.slot === sl) { eq[sl] = it; break; } } });
      const base = {}; G.STATS.forEach((k) => { base[k] = 18; });
      const comp = { id: 'm', name: 'Ione', role: 'mage', el: 'fire', m: 1 };
      const inp = { name: 'Jake', f: false, level: L, base: base, eq: eq, buffs: [], orders: { potion: { m: 'below', p: 35 }, arts: 'all', ev: {} }, seed: 99, n: 3, attempt: 0, known: {}, comp: comp };
      const o = G.simRun(inp, {}, false);
      const el = document.createElement('div'); el.style.cssText = 'position:fixed;left:0;top:0;width:411px;height:280px'; document.body.appendChild(el);
      const c = new Crawl(el, { base: '2d/', D: o.dungeon, seed: 99, name: 'Jake', look: G.normLook({}), eq: eq, comp: Object.assign({ look: G.normLook({}), gear: {} }, comp) });
      await c.ready;
      window.__c = c;
      const groups = []; o.log.forEach((L2) => { const g = groups[groups.length - 1]; if (g && g[g.length - 1].join) g.push(L2); else groups.push([L2]); });
      Crawl.resetStats();
      (async () => { for (const g of groups) { const ms = c.play(g); await new Promise((res) => setTimeout(res, ms)); } })();
    });
    await p.waitForTimeout(rate === 1 ? 15000 : 20000);
    const s = await p.evaluate(() => Crawl.stats());
    out.push(Object.assign({ cpu: rate + 'x' }, s));
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
