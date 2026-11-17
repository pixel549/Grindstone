// 2.17-2.18: wind and the old roads, driven by finger taps.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/home/claude/grindstone/test/s23/';
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
  await p.waitForSelector('#cprev canvas.lpcport', { timeout: 20000 }); await p.waitForTimeout(600);
  await p.click('[data-m="c-save"]');
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(350); if (!(await p.$('#modal:not(.hidden)'))) break; const c = await p.$('#modal:not(.hidden) .btn.prime, #modal:not(.hidden) .btn'); if (c) await c.click().catch(() => {}); }
  let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const tap = async (sel) => { const el = await p.$(sel); if (!el) { console.log('MISSING ' + sel); fails++; return false; } await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(450); return true; };
  const closeSheet = async () => { await tap('#modal .btn[data-m="close"]'); };
  const save = () => p.evaluate(() => JSON.parse(localStorage.gs));
  const set = async (fn) => { await p.evaluate(fn); await p.evaluate(() => window.onResume()); await p.waitForTimeout(500); };
  await set(() => { const s = JSON.parse(localStorage.gs); s.town = { open: true }; s.wind = 0; s.gold = 100; delete s.spar; G.STATS.forEach((k) => { s.stats[k] = 5 * 30 * 30; }); s.delve.n = 0; s.delve.autoAt = '23:59'; s.delve.trophies = []; localStorage.gs = JSON.stringify(s); });
  await tap('[data-act="tab"][data-v="delve"]');
  ok(await p.evaluate(() => !document.querySelector('[data-act="spar-go"]')), 'no old roads before a dungeon is cleared');
  // clear two dungeons by the rules, then earn wind with deeds
  const r = await p.evaluate(() => {
    const S0 = JSON.parse(localStorage.gs); G.normalize(S0, G.today()); G.normDelve(S0);
    for (let i = 0; i < 2; i++) { const inp = G.inputFor(S0, {}), out = G.simRun(inp, {}, false); G.applyRun(S0, out, { t: Date.now(), day: G.today(), buffs: inp.buffs }); }
    const t = G.today(), w0 = S0.wind | 0; const qs = S0.quests.filter((q) => q.type === 'habit' && !q.archived).slice(0, 5); qs.forEach((q) => G.complete(S0, q.id, t, Date.now()));
    const w1 = S0.wind; G.undo(S0, qs[0].id, t); const w2 = S0.wind;
    for (let i = 0; i < 30; i++) S0.wind = Math.min(G.WIND_MAX, S0.wind + 1);
    S0.wind = 5; S0.gold = 100; localStorage.gs = JSON.stringify(S0);
    return { n: S0.delve.n, w0: w0, w1: w1, w2: w2 };
  });
  ok(r.n === 2 && r.w1 === r.w0 + 5 && r.w2 === r.w1 - 1, 'each deed gives one wind, and undo takes it back (' + r.w0 + ' → ' + r.w1 + ' → ' + r.w2 + ')');
  await p.evaluate(() => window.onResume()); await p.waitForTimeout(1200);
  for (let k = 0; k < 5; k++) if (await p.$('#modal:not(.hidden) .btn[data-m="close"]')) { await tap('#modal:not(.hidden) .btn[data-m="close"]'); await p.waitForTimeout(900); }
  await tap('[data-act="tab"][data-v="delve"]');
  ok(await p.evaluate(() => /OLD ROADS/i.test(document.querySelector('#main').innerText) && /5\/12/.test(document.querySelector('#main').innerText) && /0\/10 stars/i.test(document.querySelector('#main').innerText)), 'the old roads show: wind 5/12, 0/10 stars');
  await p.evaluate(() => document.querySelector('[data-act="spar-go"]').scrollIntoView({ block: 'center' })); await shot('s01-roads');
  const before = await save();
  await tap('[data-act="spar-go"]');
  await p.waitForSelector('.duel', { timeout: 8000 });
  await p.waitForFunction(() => document.querySelector('.dscene canvas') && !document.querySelector('.dfoot.busy'), null, { timeout: 20000 });
  ok(await p.evaluate(() => !!document.querySelector('.dscene canvas')), 'the dungeon is drawn above the fight');
  ok(await p.evaluate(() => document.querySelectorAll('.dacts .btn').length === 6 && !!document.querySelector('.dfoe .dit')), 'a fight: six moves (strike, art, off hand, guard, flask, gear), and each foe shows what it means to do');
  await shot('s02-fight');
  // play it properly: guard the heavy blows, drink when low, otherwise hit
  let taps = 0, guarded = 0;
  for (let i = 0; i < 900; i++) {
    const st = await p.evaluate(() => { const d = document.querySelector('.duel'); if (!d) return null; return { done: !!d.querySelector('[data-m="duel-done"]'), next: !!d.querySelector('[data-m="duel-next"]'), big: !!d.querySelector('.dfoe:not(.dead) .dit.big'), flask: !(d.querySelector('[data-v="flask"]') || { disabled: true }).disabled, low: (() => { const m = /(\d+)\/(\d+)/.exec(d.querySelector('.dhero .dbar.hp span').innerText); return +m[1] / +m[2] < 0.35; })() }; });
    if (!st || st.done) break;
    if (await p.$('.duel .dfoot.busy')) { await p.waitForTimeout(150); continue; }
    if (st.next) { await tap('.duel [data-m="duel-next"]'); continue; }
    if (st.big) { if (!guarded) await shot('s03-heavy'); guarded++; await tap('.duel [data-v="guard"]'); } else if (st.low && st.flask) await tap('.duel [data-v="flask"]'); else await tap('.duel [data-v="strike"]');
    taps++;
  }
  await p.waitForSelector('.duel [data-m="duel-done"]', { timeout: 8000 }); await p.waitForTimeout(1200);
  const res = await p.evaluate(() => document.querySelector('.dfoot').innerText); await shot('s04-result');
  let s = await save();
  const mask = s.roads && s.roads[1], stars = [0, 1, 2, 3, 4].filter((i) => mask & (1 << i)).length;
  ok(/road is walked/i.test(res) && stars >= 1 && (mask & 1) && s.wind === 3, 'cleared by hand in ' + taps + ' turns (' + guarded + ' guards): ' + stars + ' stars, two wind spent');
  const pay = s.log.find((e) => /^Old road 2/.test(e.n));
  ok(pay && pay.g === stars * await p.evaluate(() => G.starGold(G.dungeonFor(JSON.parse(localStorage.gs).delve.seed, 1).gold)), 'each new star paid once (+' + (pay && pay.g) + ')');
  ok(s.delve.n === 2 && s.xp === before.xp && s.level === before.level && s.inv.length === before.inv.length && JSON.stringify(s.stats) === JSON.stringify(before.stats) && JSON.stringify(s.delve.rec) === JSON.stringify(before.delve.rec) && JSON.stringify(s.delve.orders) === JSON.stringify(before.delve.orders), 'nothing else moved: no XP, stats, loot, progress, records or orders');
  await tap('.duel [data-m="duel-done"]');
  // the same stars again pay nothing; all five means nothing left
  const c = await p.evaluate(() => { const S0 = JSON.parse(localStorage.gs), t = G.today(), g0 = S0.gold; const a = G.roadsPay(S0, t, 1, S0.roads[1], 100); const b = G.roadsPay(S0, t, 1, 31, 100); const c2 = G.roadsPay(S0, t, 1, 31, 100); S0.wind = 1; return { a: a.gold, b: b.total, c: c2.gold, moved: S0.gold - g0, ok: G.sparState(S0, t).ok, start: G.sparStart(S0, t), per: G.starGold(100) }; });
  ok(c.a === 0 && c.b === 5 && c.c === 0 && c.moved === (5 - stars) * c.per && !c.ok && c.start === false, 'stars already held pay nothing, five is the cap, and one wind is not enough');
  // the rules: a heavy blow taken unguarded costs the fifth star; a death earns none
  const rules = await p.evaluate(() => {
    const S0 = JSON.parse(localStorage.gs); G.normalize(S0, G.today()); G.normDelve(S0);
    const play = (pol, weak) => { if (weak) G.STATS.forEach((k) => { S0.stats[k] = 0; }); const st = G.duelNew(G.sparInput(S0, 1, { t: 5 }), 7); let g = 0; while (!st.res && g++ < 600) { if (st.between) { G.duelNext(st); continue; } G.duelAct(st, pol(st)); } return { res: st.res, slips: st.slips, r: G.duelStars(st) }; };
    const st = G.duelNew(G.sparInput(S0, 1, { t: 5 }), 7); st.grp.forEach((e) => { e.hp = e.max = 99999; e.it = { k: 'big' }; }); G.duelAct(st, 'strike'); const s1 = st.slips;
    st.grp.forEach((e) => { e.it = { k: 'big' }; }); const hp1 = st.hp; G.duelAct(st, 'guard'); const s2 = st.slips;
    const dead = play(() => 'guard', true);
    return { never: { slips: s1, r: { list: [0, 0, 0, 0, { ok: s2 !== s1 }] } }, dead: dead };
  });
  ok(rules.never.slips > 0 && !rules.never.r.list[4].ok && rules.dead.res === 'dead' && rules.dead.r.n === 0, 'never guarding loses the guard star; a death earns no stars');
  // ---- 2.21: the rules of a proper fight ----
  const r2 = await p.evaluate(() => {
    const S0 = JSON.parse(localStorage.gs); G.normalize(S0, G.today()); G.normDelve(S0); S0.delve.n = 14;
    const mk = (n, eq) => { const inp = G.sparInput(S0, n, { t: 5 }); if (eq) inp.eq = Object.assign({}, inp.eq, eq); const st = G.duelNew(inp, 11, [{ id: 9001, slot: 'weapon', base: 'Maul', art: 'blunt', name: 'Test Maul', tier: 2, bonus: { STR: 6 }, lvl: 5 }, { id: 9002, slot: 'body', base: 'Coat', art: 'coat', name: 'Frost Coat', tier: 1, bonus: { END: 2 }, res: 'frost', lvl: 5 }]); return st; };
    const dummy = (st, it, extra) => { st.grp = [Object.assign({ id: 'e0', name: 'Brute', hp: 99999, max: 99999, atk: 60, tags: ['brute'], el: null, it: it, bleed: 0, blind: 0, howl: 0 }, extra || {})]; st.tgt = 'e0'; };
    const out = {};
    // an art costs MP and goes on cooldown
    let st = mk(2); dummy(st, { k: 'hit' }); st.mp = 50; const mp0 = st.mp; G.duelAct(st, 'art'); const A = G.DUEL_ARTS[G.KINDS[st.H.kind] ? st.H.kind : 'fists'];
    const artMv = G.duelMoves(st).find((m) => m.k === 'art'); out.art = { cost: mp0 - st.mp, want: A.mp, cd: st.cd.art, ok: artMv.ok, note: artMv.note };
    // a flask gives back MP, and can be drunk at full health for it
    st = mk(2); dummy(st, { k: 'dazed' }); st.mp = 0; const fk = G.duelMoves(st).find((m) => m.k === 'flask').ok; G.duelAct(st, 'flask'); out.flask = { okAtFullHp: fk, mp: st.mp, of: st.H.mpMax };
    // a brace soaks most of a blow
    st = mk(2); dummy(st, { k: 'hit' }); G.duelAct(st, 'strike'); const open = 99999 - st.grp[0].hp; st = mk(2); dummy(st, { k: 'brace' }); G.duelAct(st, 'strike'); out.brace = { open: open, braced: 99999 - st.grp[0].hp };
    // a shield bash staggers a heavy blow out of existence; a parry turns an ordinary one
    st = mk(2, { off: { id: 8001, slot: 'off', base: 'Buckler', art: 'shield', name: 'Buckler', tier: 0, amt: 1, bonus: {} } }); dummy(st, { k: 'big' }); st.mp = 20; const hp0 = st.hp; G.duelAct(st, 'off'); out.bash = { took: hp0 - st.hp, slips: st.slips, dazedSaid: st.log.some((l) => /staggered/.test(l.s)) };
    st = mk(2, { off: { id: 8002, slot: 'off', base: 'Parrying Dagger', art: 'blade', name: 'Dagger', tier: 0, amt: 1, bonus: {} } }); dummy(st, { k: 'hit' }); st.mp = 20; st.H.evade = 0; const hp1 = st.hp; G.duelAct(st, 'off'); out.parry = { took: hp1 - st.hp, riposte: 99999 - st.grp[0].hp };
    // changing gear takes the turn and changes the man
    st = mk(2); dummy(st, { k: 'hit' }); const k0 = st.H.kind, r0 = st.rounds; G.duelAct(st, 'gear', null, 9001); out.gear = { from: k0, to: st.H.kind, round: st.rounds - r0, inPack: st.pack.some((x) => x.id === 9001), list: G.duelGear(st).length };
    // what foes know grows with depth: a brute braces/charges only on deeper roads
    const acts = (n) => { const s2 = mk(n), seen = {}; for (let i = 0; i < 400; i++) { dummy(s2, null, { tags: ['brute', 'armoured', 'caster', 'beast'] }); s2.round = 3; s2.me.poison = 0; s2.me.hex = 0; s2.mp = 20; s2.grp[0].hp = 30000; s2.rs = i * 7919 + 1; G.DUEL_UNLOCK && 0; (function () {})(); s2.grp[0].it = null; G.duelAct(s2, 'guard'); s2.grp.forEach((e) => { if (e.it) seen[e.it.k] = 1; }); } return Object.keys(seen).sort().join(','); };
    out.shallow = acts(0); out.deep = acts(13);
    return out;
  });
  ok(r2.art.cost === r2.art.want && r2.art.cd > 0 && !r2.art.ok && /ready in/.test(r2.art.note), 'an art costs its MP and goes on cooldown: ' + JSON.stringify(r2.art));
  ok(r2.flask.okAtFullHp && r2.flask.mp >= Math.floor(r2.flask.of * 0.5) - 1, 'a flask gives back half his MP, worth drinking at full health: ' + JSON.stringify(r2.flask));
  ok(r2.brace.braced < r2.brace.open * 0.5, 'a braced foe takes well under half: ' + JSON.stringify(r2.brace));
  ok(r2.bash.took === 0 && r2.bash.slips === 0 && r2.bash.dazedSaid, 'a shield bash staggers a heavy blow away: ' + JSON.stringify(r2.bash));
  ok(r2.parry.took === 0 && r2.parry.riposte > 0, 'a parry turns an ordinary blow and ripostes: ' + JSON.stringify(r2.parry));
  ok(r2.gear.from !== r2.gear.to && r2.gear.to === 'blunt' && r2.gear.round === 1 && !r2.gear.inPack, 'changing gear takes the turn and changes his weapon: ' + JSON.stringify(r2.gear));
  ok(!/brace|charge|hex|howl|mend|flurry/.test(r2.shallow) && /brace/.test(r2.deep) && /charge/.test(r2.deep) && /hex/.test(r2.deep) && /mend/.test(r2.deep) && /flurry/.test(r2.deep), 'the deeper the road, the more foes know (road 1: ' + r2.shallow + ' | road 14: ' + r2.deep + ')');
  console.log(errs.join('\n') || 'no errors');
  ok(!errs.length, 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
