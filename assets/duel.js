/* Grindstone 2.18 → 2.21: the old roads, fought by hand. A turn-based fight through a dungeon he's already cleared: the same
 * foes and the same man (his real stats and kit), but he picks every move, and the foes show what they're about to do.
 * A run is rated out of five stars. Each star pays once per dungeon, ever, so there is only so much to be had here.
 *
 * 2.21: a proper fight. Weapon arts (one per kind of weapon) and off-hand skills cost MP and go on cooldown; flasks give
 * back health and MP; a turn can be spent changing a piece of gear from the pack. Foes do more than hit: what they can do
 * comes from what they are (beasts flurry and howl, brutes charge, armoured things brace, casters hex, drain and mend,
 * fliers take off, the undead poison), and the deeper the road the more of it they know and the harder they hit.
 * Everything a foe will do is shown before he chooses. The fresh delves don't use any of this: they stay automatic.
 *
 * Pure rules: no DOM. The state is plain data; duelAct moves it on by one of his turns. */
(function () {
  'use strict';
  const G = (typeof window !== 'undefined' && window && window.G) || globalThis.G, R = Math.round;
  // Tuning (tools: /tmp/duelsim-style bot runs; see README 2.21). No buffs come down an old road, so foes are trimmed:
  // mob: their health, boss: a boss's, e0/e1/cap: how hard they hit, rising with depth to a cap; rest: health back between fights.
  const T = { mob: 0.85, boss: 0.7, e0: 0.65, e1: 0.02, cap: 0.9, rest: 0.25 };
  const ease = (n) => Math.min(T.cap, T.e0 + T.e1 * n);
  const STARS = [
    { k: 'clear', text: 'Clear it' },
    { k: 'hale', text: 'Finish with half your health or more' },
    { k: 'dry', text: 'Drink no flasks' },
    { k: 'swift', text: 'Finish within par' },
    { k: 'guard', text: 'Never take a heavy blow unguarded' },
  ];
  // His weapon's art, by kind: what it costs, how many rounds before it's ready again, what it does.
  const ARTS = {
    blade: { n: 'Rend', mp: 4, cd: 3, short: 'bleeds 3 rounds', tip: 'A deep cut (×1.8) that bleeds for three rounds.' },
    axe: { n: 'Cleave', mp: 5, cd: 3, short: 'hits them all', tip: 'Cuts through every foe at once (×0.9 each).' },
    blunt: { n: 'Shatter', mp: 4, cd: 3, short: 'breaks a brace, staggers', tip: 'A crushing blow (×1.6) that ignores a brace and staggers: whatever it meant to do, it doesn’t.' },
    polearm: { n: 'Impale', mp: 3, cd: 2, short: 'staggers · ×2 fliers', tip: 'A long thrust (×1.4, ×2.8 on fliers) that reaches the airborne and staggers.' },
    staff: { n: 'Nova', mp: 6, cd: 3, short: 'blasts them all', tip: 'A burst of his element at every foe (×1.1 each). Reaches the airborne.' },
    fists: { n: 'Haymaker', mp: 0, cd: 4, short: 'staggers', tip: 'A wild swing (×1.3) that staggers.' },
  };
  // What the off hand gives him, by the piece in it.
  const OFF = {
    shield: { n: 'Bash', mp: 2, cd: 3, short: 'staggers', tip: 'A knock with the shield (×0.6) that staggers: cancels a wind-up, a charge, even the blow itself.' },
    blade: { n: 'Parry', mp: 1, cd: 2, short: 'turns a blow', tip: 'Turns the next ordinary blow this round and ripostes (×0.8). Heavy blows can’t be parried.' },
    lamp: { n: 'Flare', mp: 2, cd: 4, short: 'blinds them', tip: 'Blinds every foe for two rounds: four blows in ten go wide.' },
    book: { n: 'Mend', mp: 5, cd: 4, short: 'heals a quarter', tip: 'Reads a verse that closes wounds: a quarter of his health back.' },
  };
  // What foes can do beyond hitting and winding up, who does it, and from which dungeon on.
  const UNLOCK = { flurry: 2, brace: 2, charge: 4, venom: 4, hex: 6, drain: 6, mend: 6, howl: 9, fly: 9 };
  const FOE_ACTS = { flurry: ['beast', 'swarm'], brace: ['armoured', 'brute'], charge: ['brute'], venom: ['undead', 'beast'], hex: ['caster'], drain: ['caster'], mend: ['caster', 'undead'], howl: ['beast'], fly: ['flier'] };
  const HEAVY = { big: 1, ram: 1, dive: 1 };
  const rnd = (st) => { let t = (st.rs = (st.rs + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const vary = (st) => 0.9 + 0.2 * rnd(st);
  const has = (e, list) => (e.tags || []).some((t) => list.indexOf(t) >= 0);

  // pack: the pieces in his pack, for changing gear mid-fight (the run's own copy: nothing he swaps here changes his real kit)
  function duelNew(inp, seed, pack) {
    const D = G.dungeonFor(inp.seed, inp.n), eq = Object.assign({}, inp.eq), H = G.heroFrom(inp, eq);
    const worn = G.SLOTS.map((sl) => eq[sl] && eq[sl].id).filter((x) => x != null);
    const enc = D.events.map((e, i) => Object.assign({ st: i }, e)).filter((e) => e.kind === 'fight').concat([Object.assign({ st: D.events.length }, D.boss)]).map((f) => ({ st: f.st, name: f.name, tags: f.tags || [], el: f.el, hp: Math.max(1, R(f.hp * (f.kind === 'boss' ? T.boss : T.mob))), atk: f.atk, count: f.count || 1, boss: f.kind === 'boss', mech: f.mech || null, bite: f.bite || null, vis: f.vis || null, add: f.add ? Object.assign({}, f.add, { hp: Math.max(1, R(f.add.hp * T.mob)) }) : null }));
    const perRound = Math.max(1, H.atk * 1.1);
    const par = enc.reduce((a, f) => a + Math.ceil((f.hp * f.count) / perRound * 1.35) + (f.boss ? 3 : 2), 0);
    const st = { n: inp.n, name: D.name, icon: D.icon, weak: D.weak, gold: D.gold, H: H, inp: inp, eq: eq, pack: (pack || []).filter((it) => it && it.slot && worn.indexOf(it.id) < 0),
      hero: inp.name, hp: H.hpMax, mp: H.mpMax, flasks: H.flasks, enc: enc, i: -1, grp: [], round: 0, rounds: 0, par: par, ease: ease(inp.n), deep: inp.n,
      drank: 0, slips: 0, guard: false, counter: false, parry: false, cd: { art: 0, off: 0 }, me: { poison: 0, pd: 0, hex: 0 }, swaps: 0, artUsed: false,
      log: [], res: null, rs: (seed | 0) || 1, tgt: null, between: false };
    next(st);
    return st;
  }
  const living = (st) => st.grp.filter((e) => e.hp > 0);
  const say = (st, s, c) => { st.log.push({ s: s, c: c || '' }); if (st.log.length > 40) st.log.shift(); };
  const foe = (f, k, id) => ({ id: id, name: f.name, hp: f.hp, max: f.hp, atk: f.atk, tags: f.tags || [], el: f.el, boss: !!f.boss, it: null, it2: null, bleed: 0, bd: 0, blind: 0, howl: 0 });
  function next(st) {
    st.i++; st.round = 0; st.guard = false; st.counter = false; st.parry = false; st.artUsed = false; st.between = false; st.enraged = false;
    st.cd = { art: 0, off: 0 }; st.me = { poison: 0, pd: 0, hex: 0 };
    const f = st.enc[st.i];
    st.grp = [];
    for (let k = 0; k < f.count; k++) st.grp.push(foe(f, k, 'e' + k));
    st.tgt = st.grp[0].id;
    say(st, f.boss ? f.name + ' bars the way.' : (f.count > 1 ? f.count + ' ' + f.name : 'A ' + f.name) + ' in the dark.', 'hd');
    intents(st);
  }
  // What each foe means to do this round. Wind-ups, charges and take-offs are a round of setting up, then the blow lands.
  function intents(st) {
    const f = st.enc[st.i], round = st.round + 1, L = living(st);
    let winding = L.some((e) => e.it && (e.it.k === 'wind' || e.it.k === 'charge'));
    L.forEach((e) => {
      const prev = e.it ? e.it.k : null;
      e.it2 = null;
      if (prev === 'wind') { e.it = { k: 'big', breath: !!e.it.breath }; return; }
      if (prev === 'charge') { e.it = { k: 'ram' }; return; }
      if (prev === 'fly') { e.it = { k: 'dive' }; e.fcd = 3; return; }
      if (e.boss && f.mech === 'breath' && round % 3 === 2) { e.it = { k: 'wind', breath: true }; winding = true; return; }
      const opts = [['hit', 5]];
      if (!winding && round > 1) opts.push(['wind', e.boss ? 1.6 : 1.1]);
      const can = (a) => st.deep >= UNLOCK[a] && has(e, FOE_ACTS[a]);
      if (can('flurry')) opts.push(['flurry', 2]);
      if (can('brace') && prev !== 'brace') opts.push(['brace', has(e, ['armoured']) ? 1.6 : 0.8]);
      if (can('charge') && !winding && round > 1) opts.push(['charge', 1.2]);
      if (can('venom') && st.me.poison <= 0) opts.push(['venom', 1.2]);
      if (can('hex') && st.me.hex <= 0) opts.push(['hex', 1.3]);
      if (can('drain') && st.mp >= 2) opts.push(['drain', 1]);
      let hurtAlly = null;
      if (can('mend') && !(e.mcd > 0)) { L.forEach((a) => { if (a.hp < a.max * 0.6 && (!hurtAlly || a.hp / a.max < hurtAlly.hp / hurtAlly.max)) hurtAlly = a; }); if (hurtAlly) opts.push(['mend', 1.8]); }
      if (can('howl') && L.length >= 2 && !e.howl) opts.push(['howl', 1.2]);
      if (can('fly') && prev !== 'dive' && !(e.fcd > 0)) opts.push(['fly', 1.2]);
      let x = rnd(st) * opts.reduce((a, o) => a + o[1], 0), k = 'hit';
      for (let i = 0; i < opts.length; i++) { x -= opts[i][1]; if (x < 0) { k = opts[i][0]; break; } }
      if (k === 'wind' || k === 'charge') winding = true;
      e.it = k === 'mend' ? { k: k, tgt: hurtAlly.id } : { k: k };
      // from dungeon 13, a boss in its second half does two things a round
      if (e.boss && st.deep >= 12 && e.hp <= e.max / 2 && !HEAVY[k] && k !== 'wind' && k !== 'charge' && k !== 'fly') e.it2 = { k: has(e, ['beast']) && st.deep >= UNLOCK.flurry ? 'flurry' : 'hit' };
    });
  }
  const elemTaken = (H, el) => { let m = 1; if (el && H.res && H.res[el]) m *= 1 - ((G.ELEM_TUNE && G.ELEM_TUNE.res) || 0.3); if (el) m *= 1 - (H.ward || 0); return m; };
  function mult(st, t) {
    const H = st.H, kind = G.KINDS[H.kind] || G.KINDS.fists, E = G.ELEM_TUNE || { weak: 1.6, same: 0.5 }; let m = 1;
    if (H.el && H.el === st.weak) m *= E.weak; else if (H.el && H.el === t.el) m *= E.same;
    if (kind.good.some((g) => (t.tags || []).indexOf(g) >= 0)) m *= H.kind === 'blunt' ? 1.5 : 1.3;
    if (kind.bad.some((g) => (t.tags || []).indexOf(g) >= 0)) m *= 0.75;
    return m;
  }
  const artOf = (st) => ARTS[st.H.kind] || ARTS.fists;
  const offOf = (st) => { const o = st.eq && st.eq.off; return o ? OFF[o.art] || null : null; };
  // What he can do right now: [{ k, label, note, tip, ok }]
  function duelMoves(st) {
    const H = st.H, staff = H.kind === 'staff', A = artOf(st), O = offOf(st);
    return [
      { k: 'strike', label: staff ? 'Cast' : 'Strike', note: (staff ? (st.mp >= 2 ? '2 MP' : 'no MP: half') : (G.KINDS[H.kind] || G.KINDS.fists).n) + (st.counter ? ' · +30%' : '') + (st.me.hex > 0 ? ' · hexed' : ''), tip: 'An ordinary blow at the one you’ve picked.', ok: true },
      { k: 'art', label: A.n, note: st.cd.art ? 'ready in ' + st.cd.art : (A.mp ? A.mp + ' MP · ' : '') + A.short, tip: A.tip + (A.mp ? ' ' + A.mp + ' MP,' : '') + ' then ' + A.cd + ' rounds to recover.', ok: !st.cd.art && st.mp >= A.mp, cd: st.cd.art },
      { k: 'off', label: O ? O.n : 'Off hand', note: !O ? 'nothing held' : st.cd.off ? 'ready in ' + st.cd.off : O.mp + ' MP · ' + O.short, tip: O ? O.tip + ' ' + O.mp + ' MP, then ' + O.cd + ' rounds to recover.' : 'A shield, a parrying dagger, a lamp or a book in the off hand gives him a second skill.', ok: !!O && !st.cd.off && st.mp >= O.mp, cd: st.cd.off },
      { k: 'guard', label: 'Guard', note: 'take less · next blow +30%', tip: 'Takes about half from ordinary blows and a third from heavy ones (a charge still hurts), and his next blow lands 30% harder.', ok: true },
      { k: 'flask', label: 'Flask', note: st.flasks + ' left · HP+MP', tip: 'Gives back 40% of his health and half his MP.', ok: st.flasks > 0 && (st.hp < H.hpMax || st.mp < H.mpMax) },
      { k: 'gear', label: 'Gear', note: 'swap a piece · a turn', tip: 'Change one piece for something in the pack. It takes his turn.', ok: duelGear(st).length > 0 },
    ];
  }
  // What he could change into: the pack, boiled down to what's worth a turn (per slot: the strongest, and the best of each
  // element or resistance, and of each kind of weapon or off-hand piece).
  function duelGear(st) {
    const out = [], seen = {};
    const key = (it) => it.slot === 'weapon' ? 'w:' + (G.KINDS[it.art] ? it.art : 'blade') + ':' + (it.el || '') : it.slot === 'off' ? 'o:' + it.art : (it.slot === 'hands' || it.slot === 'feet') ? it.slot : it.slot + ':' + (it.res || '');
    (st.pack || []).slice().sort((a, b) => G.power(b) - G.power(a)).forEach((it) => {
      const k = key(it); if (seen[k]) return;
      const cur = st.eq[it.slot];
      if (cur && key(cur) === k && G.power(cur) >= G.power(it)) return;   // worn already does this as well or better
      seen[k] = 1; out.push(it);
    });
    const order = ['weapon', 'off', 'body', 'head', 'charm', 'hands', 'feet'];
    return out.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot) || G.power(b) - G.power(a)).slice(0, 24);
  }
  function stagger(st, t) {
    if (!t || t.hp <= 0) return;
    const was = t.it && t.it.k;
    t.it = { k: 'dazed' }; t.it2 = null;
    st.ev.push({ t: 'tag', to: t.id, s: 'STAGGERED', c: '#ffd27a' });
    say(st, t.name + ' is staggered' + (was === 'wind' || was === 'charge' || HEAVY[was] ? ' out of it.' : '.'), 'g');
  }
  function duelAct(st, act, tgt, arg) {
    if (st.res || st.between) return st;
    const mv = duelMoves(st).find((m) => m.k === act);
    if (!mv || !mv.ok) return st;
    let swap = null;
    if (act === 'gear') { swap = duelGear(st).find((x) => x.id === arg); if (!swap) return st; }
    let H = st.H;
    const f = st.enc[st.i], C = H.comp, cm = C ? C.m : 0;
    st.round++; st.rounds++; st.guard = false; st.parry = false; st.ev = [];
    let targets = living(st);
    const want = targets.find((e) => e.id === (tgt || st.tgt));
    if (want) targets = [want].concat(targets.filter((e) => e !== want));
    const hurt = (t, d, who, o) => {
      o = o || {};
      if (t.it && t.it.k === 'brace' && !o.shatter) d *= 0.4;
      if (t.it && t.it.k === 'fly' && !o.reach) d *= 0.4;
      const real = Math.min(t.hp, Math.max(1, R(d))); t.hp -= real;
      st.ev.push({ t: o.dot ? 'dot' : /adds$/.test(who) ? 'c' : 'h', to: t.id, d: real, art: !!o.art });
      say(st, who + ' ' + real + (t.hp <= 0 ? '. ' + t.name + ' falls.' : '.'), t.hp <= 0 ? 'kill' : '');
    };
    const reach = H.kind === 'polearm' || H.kind === 'staff';
    if (act === 'strike' || act === 'art') {
      const A = artOf(st);
      let dmg = H.atk * vary(st);
      if (H.fx.opener && st.round === 1) dmg *= 1.6;
      if (H.fx.slayer && f.boss) dmg *= 1.2;
      if (H.fx.reaper && st.hp < H.hpMax / 2) dmg *= 1.25;
      if (H.fx.packs && targets.length > 1) dmg *= 1.2;
      if (st.counter) dmg *= 1.3;
      if (st.me.hex > 0) dmg *= 0.7;
      if (act === 'strike') {
        if (H.kind === 'staff') { if (st.mp >= 2) st.mp -= 2; else dmg *= 0.5; }
        const t = targets[0];
        hurt(t, dmg * mult(st, t), 'He hits for', { reach: reach });
        if (H.fx.packs && targets[1] && targets[1].hp > 0) hurt(targets[1], dmg * mult(st, targets[1]) * 0.25, 'It carries on for', { reach: reach });
      } else {
        st.mp -= A.mp; st.cd.art = A.cd + 1; st.artUsed = true;
        const k = G.KINDS[H.kind] ? H.kind : 'fists', t = targets[0];
        if (k === 'axe') targets.slice().forEach((x) => hurt(x, dmg * mult(st, x) * 0.9, 'His cleave lands for', { art: true }));
        else if (k === 'staff') targets.slice().forEach((x) => hurt(x, dmg * mult(st, x) * 1.1, 'His nova burns for', { art: true, reach: true }));
        else if (k === 'blade') { hurt(t, dmg * mult(st, t) * 1.8, 'He rends for', { art: true }); if (t.hp > 0) { t.bleed = 3; t.bd = Math.max(1, R(H.atk * 0.25 * mult(st, t))); st.ev.push({ t: 'tag', to: t.id, s: 'BLEEDING', c: '#d8432a' }); } }
        else if (k === 'blunt') { hurt(t, dmg * mult(st, t) * 1.6, 'He shatters it for', { art: true, shatter: true }); stagger(st, t); }
        else if (k === 'polearm') { hurt(t, dmg * mult(st, t) * (has(t, ['flier']) ? 2.8 : 1.4), 'He impales it for', { art: true, reach: true }); stagger(st, t); }
        else { hurt(t, dmg * mult(st, t) * 1.3, 'A haymaker for', { art: true }); stagger(st, t); }
      }
      st.counter = false;
    } else if (act === 'off') {
      const O = offOf(st), t = targets[0];
      st.mp -= O.mp; st.cd.off = O.cd + 1;
      const art = st.eq.off.art;
      if (art === 'shield') { hurt(t, H.atk * vary(st) * 0.6 * mult(st, t), 'He bashes it for', {}); stagger(st, t); }
      else if (art === 'blade') { st.parry = true; st.ev.push({ t: 'tag', who: 'hero', s: 'PARRY', c: '#9fb3c8' }); say(st, 'He sets his blade to turn the next blow.', 'g'); }
      else if (art === 'lamp') { living(st).forEach((e) => { e.blind = 2; }); st.ev.push({ t: 'flare' }); say(st, 'He throws up the lamp’s flare. They can’t see.', 'g'); }
      else if (art === 'book') { const h = Math.min(H.hpMax - st.hp, R(H.hpMax * 0.25 * (H.heal || 1))); st.hp += h; st.ev.push({ t: 'drink', h: h, book: true }); say(st, 'He reads a mending verse: +' + h + ' HP.', 'heal'); }
      st.counter = false;
    } else if (act === 'guard') { st.guard = true; st.counter = true; st.ev.push({ t: 'guard' }); say(st, 'He sets his guard.', 'g'); }
    else if (act === 'flask') {
      const h = Math.min(H.hpMax - st.hp, R(H.hpMax * (H.fx.tonic ? 0.5 : 0.4) * (H.heal || 1))), m = Math.min(H.mpMax - st.mp, R(H.mpMax * 0.5));
      st.hp += h; st.mp += m; st.flasks--; st.drank++; st.counter = false;
      st.ev.push({ t: 'drink', h: h, m: m }); say(st, 'He drinks: +' + h + ' HP' + (m ? ', +' + m + ' MP' : '') + '.', 'heal');
    } else if (act === 'gear') {
      const old = st.eq[swap.slot];
      st.eq[swap.slot] = swap; st.pack = st.pack.filter((x) => x !== swap); if (old) st.pack.push(old);
      H = st.H = G.heroFrom(st.inp, st.eq);
      st.hp = Math.min(st.hp, H.hpMax); st.mp = Math.min(st.mp, H.mpMax); st.swaps++; st.counter = false;
      st.ev.push({ t: 'swap', slot: swap.slot, item: swap });
      say(st, 'He ' + (old ? 'swaps his ' + old.base.toLowerCase() + ' for ' : 'takes up ') + swap.name + '.', 'g');
    }
    // the companion
    if (C && (C.role === 'fighter' || C.role === 'mage' || C.role === 'biter') && living(st).length) {
      const ts = living(st), frac = C.role === 'fighter' ? 0.3 : C.role === 'mage' ? 0.28 : 0.22;
      (C.role === 'mage' ? ts.slice(0, 2) : [ts[0]]).forEach((t, i, a) => { let m = 1; if (C.role === 'mage') { if (C.el && C.el === st.weak) m = 1.6; else if (C.el && C.el === t.el) m = 0.5; if (a.length > 1) m *= 0.8; } if (C.role === 'biter' && (t.tags || []).indexOf('beast') >= 0) m *= 1.25; hurt(t, H.atk * frac * cm * m, (C.name || 'His companion') + ' adds', { reach: C.role === 'mage' }); });
    }
    // the boss turns
    const boss = st.grp.find((e) => e.boss && e.hp > 0);
    if (boss && !st.enraged && boss.hp <= boss.max / 2) {
      st.enraged = true;
      if (f.mech === 'enrage') { boss.atk *= 1.5; st.ev.push({ t: 'enrage' }); say(st, boss.name + ' flies into a rage.', 'warn'); }
      if (f.mech === 'adds' && f.add) { for (let k = 0; k < f.add.count; k++) st.grp.push(Object.assign(foe(f.add, k, 'a' + k), { it: { k: 'hit' } })); st.ev.push({ t: 'adds', n: f.add.name, tags: f.add.tags || [], ids: Array.from({ length: f.add.count }, (_, k) => 'a' + k), hp: f.add.hp }); say(st, boss.name + ' calls for help: ' + f.add.count + ' ' + f.add.name + '.', 'warn'); }
    }
    // their turn
    let took = 0; const inc = { t: 'in', by: [], d: 0, big: false, br: false, guard: st.guard };
    const blow = (e, mul, o) => {
      if (!o.heavy && rnd(st) < (H.evade || 0)) { say(st, 'He slips ' + e.name + '’s blow.', 'g'); return 0; }
      if (e.blind > 0 && !o.breath && rnd(st) < 0.4) { say(st, e.name + ' swings blind and misses.', 'g'); return 0; }
      if (st.parry && o.parry) { st.parry = false; const t = e; hurt(t, H.atk * vary(st) * 0.8 * mult(st, t), 'He turns ' + e.name + '’s blow and ripostes for', {}); st.ev.push({ t: 'tag', to: e.id, s: 'PARRIED', c: '#9fb3c8' }); return 0; }
      let d = e.atk * st.ease * vary(st) * 40 / (40 + (o.breath ? H.def / 2 : H.def)) * elemTaken(H, e.el) * (H.hide || 1) * (e.howl > 0 ? 1.3 : 1) * mul;
      if (C && C.role === 'fighter') d *= 1 - 0.15 * cm;
      if (H.fx.thick) d *= 0.9;
      if (st.guard) d *= o.gm;
      d = Math.max(1, R(d)); took += d; inc.by.push(e.id); if (o.heavy) inc.big = true; if (o.breath) inc.br = true;
      if (o.heavy && !st.guard) st.slips++;
      return d;
    };
    const doIt = (e, it) => {
      if (e.hp <= 0) return;
      const k = it.k, gd = st.guard ? ' (guarded)' : '';
      if (k === 'dazed') { say(st, e.name + ' reels.', 'g'); return; }
      if (k === 'wind') { st.ev.push({ t: 'wind', by: e.id, br: !!it.breath }); say(st, e.name + (it.breath ? ' draws a long breath.' : ' winds up.'), 'warn'); return; }
      if (k === 'charge') { st.ev.push({ t: 'wind', by: e.id }); say(st, e.name + ' lowers its head and paws the ground.', 'warn'); return; }
      if (k === 'fly') { st.ev.push({ t: 'tag', to: e.id, s: 'AIRBORNE', c: '#bfe6ff' }); say(st, e.name + ' takes to the air.', 'warn'); return; }
      if (k === 'brace') { st.ev.push({ t: 'tag', to: e.id, s: 'BRACED', c: '#9fb3c8' }); say(st, e.name + ' braces behind its guard.', ''); return; }
      if (k === 'howl') { living(st).forEach((a) => { a.howl = 3; }); st.ev.push({ t: 'tag', to: e.id, s: 'HOWL', c: '#ff8a5a' }); say(st, e.name + ' howls, and the others take heart.', 'warn'); return; }
      if (k === 'hex') { st.me.hex = 3; st.ev.push({ t: 'tag', who: 'hero', s: 'HEXED', c: '#b07fe0' }); say(st, e.name + ' hexes him: his blows weaken.', 'bad'); return; }
      if (k === 'drain') { const m = Math.min(st.mp, 4), h = Math.min(e.max - e.hp, R(e.max * 0.06)); st.mp -= m; e.hp += h; st.ev.push({ t: 'tag', who: 'hero', s: '-' + m + ' MP', c: '#6f95cc' }); if (h) st.ev.push({ t: 'fheal', to: e.id, h: h }); say(st, e.name + ' drains ' + m + ' MP from him.', 'bad'); return; }
      if (k === 'mend') { const a = living(st).find((x) => x.id === it.tgt) || living(st).slice().sort((x, y) => x.hp / x.max - y.hp / y.max)[0]; if (!a) return; const h = Math.min(a.max - a.hp, R(a.max * (a.boss ? 0.1 : 0.18))); a.hp += h; e.mcd = 4; st.ev.push({ t: 'fheal', to: a.id, h: h }); say(st, e.name + ' mends ' + (a === e ? 'itself' : a.name) + ': +' + h + '.', 'warn'); return; }
      let d = 0;
      if (k === 'big') { d = blow(e, it.breath ? 2.4 : 2.2, { heavy: true, breath: !!it.breath, gm: 0.3 }); if (d) say(st, e.name + (it.breath ? ' breathes: ' : ' lands a heavy blow: ') + d + gd + '.', st.guard ? 'd' : 'bad'); return; }
      if (k === 'ram') { d = blow(e, 2.0, { heavy: true, gm: 0.6 }); if (d) say(st, e.name + ' charges into him: ' + d + gd + '.', st.guard ? 'd' : 'bad'); return; }
      if (k === 'dive') { d = blow(e, 2.0, { heavy: true, gm: 0.3 }); if (d) say(st, e.name + ' dives on him: ' + d + gd + '.', st.guard ? 'd' : 'bad'); return; }
      if (k === 'flurry') { let tot = 0, n = 0; for (let j = 0; j < 3; j++) { const x = blow(e, 0.45, { parry: true, gm: 0.45 }); if (x) { tot += x; n++; } } if (tot) say(st, e.name + ' flurries: ' + n + ' hits for ' + tot + gd + '.', 'd'); return; }
      if (k === 'venom') { d = blow(e, 0.7, { parry: true, gm: 0.45 }); if (d) { st.me.poison = 3; st.me.pd = Math.max(1, R(H.hpMax * 0.03 * elemTaken(H, e.el || 'rot'))); st.ev.push({ t: 'tag', who: 'hero', s: 'POISONED', c: '#9fd36a' }); say(st, e.name + ' bites: ' + d + gd + ', and the venom takes hold.', 'bad'); } return; }
      d = blow(e, 1, { parry: true, gm: 0.45 }); if (d) say(st, e.name + ' hits: ' + d + gd + '.', 'd');
    };
    living(st).forEach((e) => { doIt(e, e.it || { k: 'hit' }); if (e.it2) doIt(e, e.it2); });
    if (boss && boss.hp > 0 && f.mech === 'poison') { const p = Math.max(1, R(H.hpMax * 0.03 * elemTaken(H, f.el))); took += p; say(st, (f.bite || 'The rot bites') + ': ' + p + '.', 'd'); }
    if (st.me.poison > 0) { took += st.me.pd; st.me.poison--; say(st, 'Venom: ' + st.me.pd + '.', 'd'); }
    inc.d = took; if (inc.by.length || took) st.ev.push(inc);
    st.hp = Math.max(0, st.hp - took);
    // bleeding foes
    living(st).forEach((e) => { if (e.bleed > 0) { e.bleed--; hurt(e, e.bd, e.name + ' bleeds', { dot: true, shatter: true, reach: true }); } });
    if (st.hp <= 0) { st.res = 'dead'; say(st, 'He goes down.', 'bad'); return st; }
    // the round turns over: cooldowns, and what wears off
    st.cd.art = Math.max(0, st.cd.art - 1); st.cd.off = Math.max(0, st.cd.off - 1); st.me.hex = Math.max(0, st.me.hex - 1);
    st.grp.forEach((e) => { e.blind = Math.max(0, (e.blind | 0) - 1); e.howl = Math.max(0, (e.howl | 0) - 1); e.mcd = Math.max(0, (e.mcd | 0) - 1); e.fcd = Math.max(0, (e.fcd | 0) - 1); });   // a mender needs three rounds between mends, a flier two on the ground after a dive
    if (!living(st).length) {
      if (st.i >= st.enc.length - 1) { st.res = 'clear'; say(st, f.name + ' falls again.', 'hd'); return st; }
      // catch his breath: a little health, the town's mending, a healer's hands
      let h = H.hpMax * (T.rest + (H.regen || 0)); if (C && C.role === 'healer') h += H.hpMax * 0.08 * cm;
      h = Math.min(H.hpMax - st.hp, R(h)); st.hp += h; st.mp = Math.min(H.mpMax, st.mp + 2 + (H.mpRoom || 0));
      st.between = true; say(st, 'The way is clear.' + (h ? ' He catches his breath: +' + h + ' HP.' : ''), 'heal');
      return st;
    }
    if (!living(st).some((e) => e.id === st.tgt)) st.tgt = living(st)[0].id;
    intents(st);
    return st;
  }
  function duelNext(st) { if (st.between && !st.res) next(st); return st; }
  // The rating for a finished run: [{ k, text, ok }], and how many.
  function duelStars(st) {
    const won = st.res === 'clear';
    const ok = { clear: won, hale: won && st.hp >= st.H.hpMax / 2, dry: won && st.drank === 0, swift: won && st.rounds <= st.par, guard: won && st.slips === 0 };
    const list = STARS.map((x) => ({ k: x.k, text: x.k === 'swift' ? 'Finish within ' + st.par + ' rounds (took ' + st.rounds + ')' : x.text, ok: !!ok[x.k] }));
    return { list: list, n: list.filter((x) => x.ok).length, mask: list.reduce((a, x, i) => a | (x.ok ? 1 << i : 0), 0) };
  }
  // What a foe's intent means, for the screen: [icon, words, kind] (kind: '', 'warn', 'big' for a heavy blow to guard)
  function duelIntent(st, e, it) {
    it = it || e.it; if (!it) return null;
    const tg = it.tgt && st.grp.find((x) => x.id === it.tgt);
    return ({
      hit: ['⚔️', 'will hit', ''], wind: it.breath ? ['🌬️', 'drawing breath', 'warn'] : ['⏳', 'winding up', 'warn'],
      big: it.breath ? ['💥', 'BREATH: guard', 'big'] : ['💥', 'HEAVY BLOW: guard', 'big'], charge: ['🐂', 'lowering its head', 'warn'], ram: ['💥', 'CHARGE: guard or stagger', 'big'],
      fly: ['🪽', 'taking off: only reach lands', 'warn'], dive: ['💥', 'DIVING: guard', 'big'], flurry: ['🌀', 'flurry: 3 quick hits', ''], brace: ['🛡️', 'bracing: hits do little', 'warn'],
      venom: ['🐍', 'venomous bite', ''], hex: ['🌑', 'will hex you', 'warn'], drain: ['💧', 'will drain MP', ''], mend: ['✚', 'will mend ' + (tg ? (tg === e ? 'itself' : tg.name) : 'an ally'), 'warn'],
      howl: ['📯', 'howling', 'warn'], dazed: ['💫', 'dazed', ''],
    })[it.k] || ['⚔️', 'will hit', ''];
  }
  Object.assign(G, { DUEL_TUNE: T, DUEL_STARS: STARS, DUEL_ARTS: ARTS, DUEL_OFF: OFF, DUEL_UNLOCK: UNLOCK, duelNew, duelAct, duelNext, duelMoves, duelStars, duelGear, duelIntent });
})();
