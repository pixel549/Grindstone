// The crawl plays exactly what the run decided: across seeded runs, the numbers it shows add up to the log's totals,
// the HP over his head matches the run at every blow and every beat, and the same seed plays back identically.
// Run with the dev server up: node test/crawl_trace.js [runs]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const RUNS = Number(process.argv[2] || 24);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 851 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await p.addInitScript(() => { window.Native = { load: () => '', save: () => {}, haptic: () => {}, version: () => '2.6', canNotify: () => true, askNotify: () => {}, hasOracleKey: () => false, heraldInfo: () => '{}', widgetInfo: () => '{}', interpInfo: () => '{}' }; });
  await p.goto('http://localhost:8765/index.html');
  await p.waitForFunction(() => window.G && window.Crawl && window.LPC);
  const res = await p.evaluate(async (RUNS) => {
    const fails = [], stats = { runs: 0, beats: 0, fights: 0, nums: 0, checks: 0 };
    const ok = (c, m) => { stats.checks++; if (!c && fails.length < 20) fails.push(m); };
    const comps = [null, { id: 'f', name: 'Bram', role: 'fighter', m: 1 }, { id: 'h', name: 'Sefa', role: 'healer', m: 0.9 }, { id: 'm', name: 'Ione', role: 'mage', el: 'fire', m: 1.2 }, { id: 'ruby', name: 'Ruby', role: 'biter', m: 1, bird: true }, { id: 's', name: 'Wren', role: 'scout', m: 0.7 }];
    async function playRun(inp, out, comp) {
      const el = document.createElement('div'); el.style.cssText = 'position:fixed;left:0;top:0;width:393px;height:260px';
      document.body.appendChild(el);
      const c = new Crawl(el, { base: '2d/', D: out.dungeon, seed: inp.seed, name: 'Jake', look: G.normLook({}), eq: inp.eq, comp: comp && Object.assign({ look: G.normLook({}), gear: {} }, comp) });
      await c.ready;
      const groups = [];
      out.log.forEach((L) => { const g = groups[groups.length - 1]; if (g && g[g.length - 1].join) g.push(L); else groups.push([L]); });
      const beats = [];
      groups.forEach((g) => { const a = c.trace.length; const ms = c.play(g); c.settle(); beats.push({ g: g, tr: c.trace.slice(a), ms: ms }); });
      const trace = c.trace.slice();
      c.dispose(); el.remove();
      return { beats: beats, trace: trace };
    }
    for (let i = 0; i < RUNS; i++) {
      const L = 3 + (i % 14), r = G.delveRng(7000 + i), eq = {}, st = { level: L, seq: 0 };
      G.SLOTS.forEach((sl) => { for (let k = 0; k < 80; k++) { const it = G.rollItem(st, Math.min(4, L >> 2), r); if (it.slot === sl) { eq[sl] = it; break; } } });
      const base = {}; G.STATS.forEach((k) => { base[k] = 10 + Math.floor(L * (0.6 + r() * 0.5)); });
      const comp = comps[i % comps.length];
      const inp = { name: 'Jake', f: false, level: L, base: base, eq: eq, buffs: [], orders: { potion: { m: 'below', p: 35 }, arts: 'all', ev: {} }, seed: 4242 + i, n: i % 12, attempt: 0, known: {}, comp: comp };
      const out = G.simRun(inp, {}, false);
      const A = await playRun(inp, out, comp);
      stats.runs++;
      A.beats.forEach((B) => {
        stats.beats++;
        const L2 = B.g[B.g.length - 1];
        // every beat ends on the line's HP without needing a correction
        const end = B.tr.find((o) => o.k === 'end');
        ok(end && end.shown === L2.hp, 'beat ' + L2.k + ' ends showing ' + (end && end.shown) + ', line says ' + L2.hp);
        const fx = L2.fx;
        if (fx && fx.ev && fx.ev.length) {
          stats.fights++;
          const nums = B.tr.filter((o) => o.k === 'num');
          stats.nums += nums.length;
          const sum = (who) => nums.filter((o) => o.who === who).reduce((t, o) => t + o.v, 0);
          ok(sum('h') === fx.hd, 'hero hits shown ' + sum('h') + ' = run ' + fx.hd);
          ok(sum('c') === fx.cd, 'companion hits shown ' + sum('c') + ' = run ' + fx.cd);
          const inc = fx.ev.filter((e) => e.t === 'in').reduce((t, e) => t + e.d, 0);
          ok(sum('in') === inc, 'blows taken shown ' + sum('in') + ' = run ' + inc);
          // per foe: killed foes took exactly their HP
          const per = {}; nums.forEach((o) => { if (o.to) per[o.to] = (per[o.to] | 0) + o.v; });
          fx.ev.filter((e) => e.k).forEach((e) => { const mx = (fx.foes.find((f) => f.id === e.to) || {}).hp || (fx.ev.find((x) => x.t === 'adds') || {}).hp; ok(per[e.to] === mx, 'killed ' + e.to + ' shown ' + per[e.to] + ' of ' + mx); });
          // HP over his head at each blow = the run's HP after that blow
          const hpShown = B.tr.filter((o) => o.k === 'hp').map((o) => o.v);
          const hpRun = (L2.pre ? [L2.pre.hp] : []).concat(fx.ev.filter((e) => e.t === 'in' || e.t === 'drink' || e.t === 'rev').map((e) => Math.max(0, e.hp)));
          ok(JSON.stringify(hpShown) === JSON.stringify(hpRun), 'hp sequence matches (' + hpShown.length + ' vs ' + hpRun.length + ')');
          if (fx.foe.boss) { const bs = B.tr.filter((o) => o.k === 'boss').pop(); ok(bs && bs.v === (L2.k === 'win' ? 0 : L2.bossLeft), 'boss bar ends at ' + (bs && bs.v) + ', run says ' + (L2.k === 'win' ? 0 : L2.bossLeft)); }
        }
      });
      // same seed, same playback
      if (i < 6) { const A2 = await playRun(JSON.parse(JSON.stringify(inp)), G.simRun(JSON.parse(JSON.stringify(inp)), {}, false), comp); ok(JSON.stringify(A2.trace) === JSON.stringify(A.trace), 'run ' + i + ': same seed plays back identically (' + A.trace.length + ' entries)'); }
    }
    return { fails: fails, stats: stats };
  }, RUNS);
  console.log(JSON.stringify(res.stats));
  res.fails.forEach((f) => console.log('FAIL', f));
  console.log(res.fails.length || errs.length ? 'FAIL' : 'PASS', errs.join('\n'));
  await b.close();
  process.exit(res.fails.length || errs.length ? 1 : 0);
})();
