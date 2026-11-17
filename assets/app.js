/* Grindstone — UI. Tabbed menus in a dark-fantasy register.
 * State lives in Android SharedPreferences via window.Native (localStorage in a plain browser). */
(function () {
  'use strict';
  const N = window.Native || null;
  const SI = G.STAT_INFO, DIFF = G.DIFF, RAR = G.RARITY, STATS = G.STATS;
  const $ = (q, el) => (el || document).querySelector(q);
  const $$ = (q, el) => Array.from((el || document).querySelectorAll(q));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TABS = [
    ['status', 'Status', [['attr', 'Attributes'], ['equip', 'Equipment'], ['pack', 'Pack'], ['relics', 'Relics']]],
    ['quests', 'Quests', [['today', 'Today'], ['all', 'All'], ['vows', 'Goals']]],
    ['hearth', 'Hearth', [['', 'Home'], ['town', 'Town']]],
    ['delve', 'Delve', []],
    ['goods', 'Goods', [['coffers', 'Coffers'], ['relics', 'Relics'], ['rewards', 'Rewards']]],
    ['records', 'Records', [['deeds', 'Deeds'], ['feats', 'Feats'], ['delves', 'Collection'], ['settings', 'Settings']]],
  ];
  const SLOT_LABEL = { weapon: 'Armament', off: 'Off hand', head: 'Helm', body: 'Armour', hands: 'Gloves', feet: 'Boots', charm: 'Talisman' };
  const EMOJI = ['🏊', '🏋️', '🏃', '🚴', '🧘', '🥾', '💧', '🍳', '🥦', '🍎', '😴', '🧹', '🧺', '🍽️', '🛒', '🌿', '🔨', '🪴', '🦜', '📚', '📖', '✍️', '💻', '📞', '🧾', '🚗', '🦷', '⚔️'];
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const DAYS3 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const STATE_C = ['#c8b27a', '#d9a24a', '#c0414c'];
  const STATE_W = ['Up to date', 'Due', 'Overdue'];
  const LOOK_LABELS = {
    sex: { m: 'Man', f: 'Woman' },
    hair: { bald: 'Bald', cropped: 'Cropped', parted: 'Parted', long: 'Long', buns: 'Knotted', shorn: 'Shorn', messy: 'Messy', ponytail: 'Ponytail', curly: 'Curly', afro: 'Afro', mohawk: 'Mohawk', bob: 'Bob', spiky: 'Spiky', dreads: 'Dreads', balding: 'Balding' },
    beard: { none: 'Clean', beard: 'Beard', stubble: 'Stubble', trimmed: 'Trimmed', bushy: 'Bushy', moustache: 'Moustache' },
    extra: { none: 'Nothing', glasses: 'Glasses', eyepatch: 'Eyepatch', scar: 'Scar', freckles: 'Freckles' },
    build: { regular: 'Lean', broad: 'Broad' },
    cls: { knight: 'Knight', barbarian: 'Barbarian', mage: 'Mage', rogue: 'Rogue', rogue_hooded: 'Hooded' },
  };
  const DEFAULT_MODEL = 'claude-haiku-5-5';

  let S = null;
  // delve copy is written for 'he'
  const HE = (t) => (G.pron ? G.pron(!!(S && S.look && S.look.sex === 'f'), t) : t);
  const UI = { tab: 'quests', sub: { status: 'attr', quests: 'today', hearth: '', delve: '', goods: 'coffers', records: 'deeds' }, run: null, preview: null, sheet: null, edit: null, onOk: null, undo: null,
    pct: null, eqSlot: 'weapon', unlocks: [], goalDone: [], look: null };
  let lastDay = G.today();
  let toastTimer = null;
  const oracleCbs = {};

  // ---------- persistence ----------
  function load() {
    let raw = '';
    try { raw = N ? N.load() : localStorage.getItem('grindstone') || ''; } catch (e) { raw = ''; }
    let parsed = null;
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
    S = G.normalize(parsed, G.today());
    S.uiV = 3;
    G.normDelve(S);
    resolvePending();
    const came = G.callingsCheck(S), wand = G.wanderersCheck(S);
    save();
    if (came.length) setTimeout(() => companionsArrived(came), 1200);
    if (wand.length) setTimeout(() => wanderersArrived(wand), came.length ? 5000 : 1800);
  }
  function wanderersArrived(list) {
    const sq = G.townGate(S).open, where = sq ? 'in the town square' : 'at the gate', see = sq ? 'Have a word (Hearth › Town).' : 'See the household.';
    toast(list.length === 1 ? `A stranger is ${where}: ${list[0].name}, ${list[0].about.split('.')[0].toLowerCase()}. ${see}` : `${list.length} strangers are ${where}. ${see}`);
  }
  function companionsArrived(list) {
    list.forEach((n, i) => setTimeout(() => toast(`${G.CALLINGS[n.comp].arrive} ${n.name}, your ${G.CALLINGS[n.comp].title.toLowerCase()}, has moved in.`), i * 3200));
    if (UI.tab === 'hearth' && !UI.sheet) render();
    npcArrived(list);
  }
  function save() {
    const sync = G.syncAll(S, G.today());
    if (sync.done.length) settle(sync.done);
    const got = G.checkUnlocks(S);
    if (got.length) UI.unlocks.push.apply(UI.unlocks, got);
    asksSettle();
    townSettle();
    homeSettleUI();
    planSettle();
    endSettle();
    const paid = G.seasonClaim(S, G.today());
    if (paid.length) { const g = paid.reduce((a, r) => a + r.gold, 0), c = paid.reduce((a, r) => a + r.chest, 0); setTimeout(() => toast(`${G.seasonName(S.season.key)}, step ${paid[paid.length - 1].tier}: ${[g ? g + ' gold' : '', c ? (c > 1 ? c + ' coffers' : 'a coffer') : ''].filter(Boolean).join(' and ')}.`), 2600); }
    S.hero.title = G.title(S);
    const raw = JSON.stringify(S);
    try { if (N) N.save(raw); else localStorage.setItem('grindstone', raw); } catch (e) { toast('Could not save: ' + e.message); }
    if (UI.goalDone.length || UI.unlocks.length) setTimeout(flushQueue, 700);
    if (N && N.widgetInfo) scheduleWidgetClip(3000);
  }
  // 2.9 sound: short square-wave blips, made on the spot (no files). Off when the setting is off or the phone is on silent.
  const Sfx = (() => {
    let ac = null, quietAt = 0, quiet = false;
    const TUNES = { tick: [[660, 0, 0.07], [880, 0.07, 0.09]], min: [[520, 0, 0.09]], level: [[523, 0, 0.09], [659, 0.09, 0.09], [784, 0.18, 0.09], [1047, 0.27, 0.2]], coffer: [[392, 0, 0.08], [523, 0.08, 0.08], [784, 0.16, 0.18]], coin: [[988, 0, 0.05], [1319, 0.05, 0.12]], bad: [[196, 0, 0.16]], swap: [[440, 0, 0.05], [554, 0.05, 0.07]] };
    function play(name) {
      try {
        if (!S || !S.settings.sound || !TUNES[name]) return;
        if (Date.now() - quietAt > 4000) { quietAt = Date.now(); quiet = !!(N && N.quiet && N.quiet()); }
        if (quiet) return;
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ac = ac || new AC(); if (ac.state === 'suspended') ac.resume();
        const t0 = ac.currentTime + 0.01;
        TUNES[name].forEach((n) => {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = 'square'; o.frequency.value = n[0];
          g.gain.setValueAtTime(0.0001, t0 + n[1]); g.gain.linearRampToValueAtTime(0.06, t0 + n[1] + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
          o.connect(g); g.connect(ac.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + n[2] + 0.02);
        });
      } catch (e) { /* silence is fine */ }
    }
    return { play: play };
  })();
  const buzz = (k) => { try { if (N && N.haptic) N.haptic(k); } catch (e) { /* no haptics */ } };
  // 2.9: a deed ticked here goes into the Grindstone calendar too (marked, so the herald never reads it back).
  function calWrite(le) {
    try {
      if (!le || !S.settings.calWrite || !N || !N.heraldWrite || !S.herald.on || !(S.herald.cal >= 0)) return;
      const id = N.heraldWrite(String(S.herald.cal), le.n + (le.m ? ' (minimum)' : ''), String(le.t));
      if (id && id !== '-1') le.ce = id;
    } catch (e) { /* the calendar can do without */ }
  }
  function calUnwrite(qid, day) { try { const le = S.log.find((e) => e.q === qid && e.d === day); if (le && le.ce && N && N.heraldUnwrite) N.heraldUnwrite(String(le.ce)); } catch (e) { /* leave it */ } }
  const H = () => G.homeState(S, G.today());
  const isTrial = (g) => S.trials.list.indexOf(g) >= 0;

  function settle(done) {
    const now = Date.now(), t = G.today();
    done.forEach((g) => {
      if (isTrial(g)) {
        S.gold += g.gold;
        if (g.chest) S.chests += 1;
        S.log.unshift({ t: now, d: t, v: 1, n: 'Weekly: ' + g.title, i: '⚔️', x: 0, g: g.gold });
        UI.goalDone.push({ kind: 'trial', title: g.title, gold: g.gold, chest: !!g.chest });
      } else {
        const r = g.reward || {};
        if (r.gold) S.gold += r.gold;
        if (r.chest) S.chests += 1;
        S.log.unshift({ t: now, d: t, v: 1, n: 'Goal reached: ' + g.title, i: '🕯️', x: 0, g: r.gold || 0 });
        const moved = G.npcVowKept(S, g.id);
        UI.goalDone.push({ kind: 'vow', title: g.title, reward: r, moved: moved.map((n) => n.name) });
        if (moved.length) npcArrived(moved);
      }
    });
    const core = S.trials.list.filter((g) => !g.bonus);
    if (!S.trials.bonus && core.length && core.every((g) => g.done)) {
      S.trials.bonus = true; S.chests += 1;
      UI.goalDone.push({ kind: 'bonus' });
    }
  }

  // ---------- render ----------
  // 2.20.3: when something fails to draw, say so on the page (with enough to find it) instead of leaving the old screen up
  function snagCard(where, e) {
    try { console.error('snag in ' + where, e); } catch (x) {}
    const st = String((e && e.stack) || '').split('\n').slice(1, 3).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^ )]*\//g, '')).join(' · ');
    return `<div class="omen blood snag"><b>Part of this page (${esc(where)}) didn’t draw.</b><br>${esc((e && e.message) || String(e))}<br><small>${esc(st)}</small><br><small>A screenshot of this is all Claude needs. The rest of the app still works.</small></div>`;
  }
  function render() {
    if (UI.tab !== 'hearth') { UI.preview = null; if (UI.build) { UI.build = null; if (HOUSE.inst) { HOUSE.inst.setEdit(null); HOUSE.inst.setZoom(0); } } }
    if (UI.visit && (UI.tab !== 'hearth' || UI.sub.hearth)) visitEnd(false);
    if (UI.tab !== 'hearth' || UI.sub.hearth !== 'town') talkClose();
    renderTop();
    const tab = TABS.find((x) => x[0] === UI.tab);
    $('#tabs').innerHTML = TABS.map((x) => `<button class="tab ${x[0] === UI.tab ? 'on' : ''}" data-act="tab" data-v="${x[0]}">${x[1]}</button>`).join('');
    $('#subtabs').classList.toggle('none', !tab[2].length);
    $('#subtabs').innerHTML = tab[2].map((x) => `<button class="sub ${UI.sub[UI.tab] === x[0] ? 'on' : ''}" data-act="sub" data-v="${x[0]}">${x[1]}</button>`).join('');
    const v = UI.tab + ':' + (UI.sub[UI.tab] || '');
    const views = {
      'status:attr': viewAttr, 'status:equip': viewEquip, 'status:pack': viewPack, 'status:relics': viewRelics,
      'quests:today': viewToday, 'quests:all': viewAll, 'quests:vows': viewVows,
      'hearth:': viewHearth, 'hearth:town': viewTown, 'delve:': viewDelve,
      'goods:coffers': viewCoffers, 'goods:relics': viewRelicShop, 'goods:rewards': viewRewards,
      'records:deeds': viewDeeds, 'records:feats': viewFeats, 'records:delves': viewTrophies, 'records:settings': viewSettings,
    };
    let html;
    try { html = (views[v] || viewToday)(); } catch (e) { html = snagCard(v, e); }
    $('#main').innerHTML = UI.tab === 'delve' ? HE(html) : html;
    $('#fab').classList.toggle('hidden', !(UI.tab === 'quests' && UI.sub.quests !== 'vows'));
    mountHouse();
    mountTown();
    mountHeroes();
    mountNpcPortraits(); mountPeoplePortraits();
  }

  function renderTop() {
    const need = G.need(S.level);
    const pct = Math.min(100, Math.round((S.xp / need) * 100));
    const start = UI.pct == null || pct < UI.pct ? pct : UI.pct;
    $('#top').innerHTML = `<div class="hdr">
      <div class="sig">${Art.SIGIL}</div>
      <div class="hm"><div class="hn">${esc(S.hero.name)}</div><div class="ht">${esc(G.title(S))} · Level ${S.level}</div>
        <div class="xp"><i style="width:${start}%"></i></div></div>
      <div class="hr"><div><span class="gl">◈</span> ${S.gold}</div><div class="dim">✦ ${G.shownStreak(S, G.today())} · ${S.xp}/${need}</div>
        ${S.chests > 0 ? `<div class="coffer-pip" data-act="goto" data-v="status:equip">${S.chests} COFFER${S.chests > 1 ? 'S' : ''}</div>` : ''}</div>
    </div>`;
    UI.pct = pct;
    if (start !== pct) requestAnimationFrame(() => requestAnimationFrame(() => { const i = $('#top .xp i'); if (i) i.style.width = pct + '%'; }));
  }

  // ================= STATUS =================
  // 2.19: what each stat does once he's in the dark, worked out from the same numbers the delve uses
  function statDelve(k, v) {
    const T = G.delveTune || { ws: 3.5, hv: 12, we: 2 }, d = v - 10, sg = (x, u) => (x >= 0 ? '+' : '−') + Math.abs(Math.round(x * 10) / 10) + (u || '');
    const kind = G.kindOf(G.equipped(S, 'weapon'));
    if (k === 'STR') return `${sg(T.ws * d)} attack${kind === 'staff' ? ' with a melee weapon (your staff uses Intellect)' : ''} · ${T.ws} a point`;
    if (k === 'VIT') return `${sg(T.hv * d)} health · ${T.hv} a point`;
    if (k === 'END') return `${sg(T.we * d)} defence and ${sg(1.2 * d, '%')} dodge · ${T.we} and 1.2% a point`;
    if (k === 'DIS') { const f = Math.max(2, Math.min(6, 2 + Math.floor(d / 6))); return `${f} flask${f > 1 ? 's' : ''} a run (one more every 6 points, up to 6) · better at seeing ambushes and snares coming`; }
    if (k === 'INT') return `${6 + 2 * v} MP${kind === 'staff' ? ` · ${sg(T.ws * d)} attack with your staff` : ''} · better at spotting traps and secrets`;
    return '';
  }
  function viewAttr() {
    const t = G.today(), hs = H(), pen = G.penalties(S, hs);
    const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
    let h = `<div class="stat-top"><div class="sil-wrap hero3d" data-ready="1" id="sil">${Art.silhouette(S)}</div><div>
      <div class="who"><div class="nm">${esc(S.hero.name)}</div><div class="tt">${esc(G.title(S))}</div></div>
      ${kv('Level', S.level)}${kv('Experience', `${S.xp}<small> / ${G.need(S.level)}</small>`)}${kv('Gold', S.gold)}
      ${kv('Streak', `${G.shownStreak(S, t)}<small> best ${S.bestStreak}</small>`)}${kv('Deeds', S.total)}${kv('Gear', G.gearScore(S))}</div></div>`;
    h += '<div class="hd">Attributes<small>⚔️ what each does in the delve, counted from 10</small></div>';
    STATS.forEach((k) => {
      const xp = S.stats[k], base = G.statVal(xp), gear = G.gearBonus(S, k), rel = G.relicBonus(S, k), p = pen[k] || 0;
      const lo = G.statPrevAt(xp), hi = G.statNextAt(xp), pct = Math.round(((xp - lo) / (hi - lo)) * 100);
      const parts = [`base ${base}`];
      if (gear) parts.push(`<span class="up">gear +${gear}</span>`);
      if (rel) parts.push(`<span class="up">relics +${rel}</span>`);
      Object.keys(G.AFFLICT).forEach((a) => { const f = hs[a]; if (f && f.linked && f.state === 2 && G.AFFLICT[a].pen[k]) parts.push(`<em>${G.AFFLICT[a].name} overdue −${G.AFFLICT[a].pen[k]}</em>`); });
      parts.push(`${hi - xp} XP to next`);
      h += `<div class="attr" style="--c:var(--${k})"><div class="attr-top"><div class="an">${SI[k].name}<small>${SI[k].blurb}</small></div><div class="av ${p ? 'neg' : ''}">${G.statTotal(S, k, pen)}</div></div>
        <div class="ab"><i style="width:${pct}%"></i></div><div class="abd">${parts.join(' · ')}</div><div class="adl">⚔️ ${esc(statDelve(k, G.statTotal(S, k, pen)))}</div></div>`;
    });
    const aff = Object.keys(G.AFFLICT).filter((a) => hs[a] && hs[a].linked && hs[a].state === 2);
    if (aff.length) h += `<div class="hd blood">Overdue<small>costing you in the delve until done</small></div>` + aff.map((a) => `<div class="row" data-act="goto" data-v="hearth:"><div class="rb"><div class="rn" style="color:var(--blood2)">${G.AFFLICT[a].name}</div><div class="rs">${Object.keys(G.AFFLICT[a].pen).map((k) => `−${G.AFFLICT[a].pen[k]} ${SI[k].name}`).join(' · ')}</div></div></div>`).join('');
    return h;
  }

  function viewEquip() {
    const sl = UI.eqSlot;
    const slots = G.SLOTS.map((k) => {
      const it = G.equipped(S, k);
      return `<div class="eslot ${k === sl ? 'sel' : ''}" data-act="eqslot" data-v="${k}"><div class="box">${it ? Art.icon(it) : Art.slotIcon(k)}</div>
        <div class="el"><small>${SLOT_LABEL[k]}</small><b style="--rc:${it ? RAR[it.tier].c : ''}">${it ? esc(it.base) : '<span class="dim" style="font-style:italic">Empty</span>'}</b></div></div>`;
    }).join('');
    const items = S.inv.filter((i) => i.slot === sl).sort((a, b) => (S.eq[sl] === b.id) - (S.eq[sl] === a.id) || b.tier - a.tier || G.power(b) - G.power(a));
    const cur = G.equipped(S, sl);
    const list = items.map((it) => {
      const on = S.eq[sl] === it.id, better = !on && (!cur || G.power(it) > G.power(cur));
      return `<div class="irow" style="--rc:${RAR[it.tier].c}" data-act="item" data-id="${it.id}"><div class="box">${Art.icon(it)}</div>
        <div style="min-width:0"><div class="in">${esc(it.name)}${on ? '<span class="tag on">EQUIPPED</span>' : better ? '<span class="tag">BETTER</span>' : ''}</div>
        <div class="im">${RAR[it.tier].n} · ${itemStats(it)}</div></div>
        <div class="ip">${G.power(it)}<small>POWER</small></div></div>`;
    }).join('');
    const commons = S.inv.filter((i) => i.tier === 0 && G.SLOTS.every((k) => S.eq[k] !== i.id));
    return `${S.chests > 0 ? `<div class="banner"><div class="t">${S.chests} coffer${S.chests > 1 ? 's' : ''} await<small>Earned by levelling up</small></div><button class="btn small prime" data-act="open-chest">Open</button></div>` : ''}
      <div class="eq-top"><div class="sil-wrap hero3d" data-ready="1" id="sil">${Art.silhouette(S)}</div><div class="eslots">${slots}</div></div>
      <div class="hd">${SLOT_LABEL[sl]}<small>${items.length} carried</small></div>
      ${list || `<div class="empty">No ${SLOT_LABEL[sl].toLowerCase()} in your possession. Coffers hold such things.</div>`}
      <button class="btn wide" style="margin-top:14px" data-act="goto" data-v="status:pack">Everything he carries · ${S.inv.length} ›</button>`;
  }

  // 2.11: the pack. Everything he owns in one list, by slot, what's worn marked. Tag pieces and sell the tagged ones.
  function viewPack() {
    const P = UI.pack = UI.pack || { on: false, ids: {} }, t = G.today();
    const worn = (it) => S.eq[it.slot] === it.id;
    Object.keys(P.ids).forEach((id) => { if (!S.inv.some((i) => String(i.id) === id && !worn(i))) delete P.ids[id]; });
    const tagged = S.inv.filter((i) => P.ids[i.id]), sum = tagged.reduce((a, i) => a + G.sellFor(S, i, t), 0);
    const row = (it) => { const on = worn(it), cur = G.equipped(S, it.slot), d = cur && !on ? G.power(it) - G.power(cur) : 0;
      return `<div class="irow ${P.ids[it.id] ? 'tagged' : ''}" style="--rc:${RAR[it.tier].c}" data-act="${P.on ? 'pack-tag' : 'item'}" data-id="${it.id}"><div class="box">${Art.icon(it)}</div>
        <div style="min-width:0;flex:1"><div class="in">${esc(it.name)}${on ? '<span class="tag on">WORN</span>' : !cur || d > 0 ? '<span class="tag">BETTER</span>' : ''}</div>
        <div class="im">${RAR[it.tier].n} · ${itemStats(it)}${G.fxOf(it) ? ' · ✦ ' + esc(G.fxOf(it)[0]) : ''}</div></div>
        ${P.on ? (on ? '<div class="pk lock">worn</div>' : `<div class="pk ${P.ids[it.id] ? 'on' : ''}">${P.ids[it.id] ? '✓' : ''}</div>`) : `<div class="ip">${G.sellFor(S, it, t)}<small>GOLD</small></div>`}</div>`; };
    const groups = G.SLOTS.map((sl) => { const L = S.inv.filter((i) => i.slot === sl).sort((a, b) => worn(b) - worn(a) || b.tier - a.tier || G.power(b) - G.power(a)); return L.length ? `<div class="hd">${SLOT_LABEL[sl]}<small>${L.length}</small></div>` + L.map(row).join('') : ''; }).join('');
    const bar = P.on
      ? `<div class="packbar"><span>${tagged.length} tagged · ${sum} gold</span><button class="btn small" data-act="pack-commons">Tag spare commons</button><button class="btn small" data-act="pack-off">Cancel</button><button class="btn small prime" data-act="pack-sell" ${tagged.length ? '' : 'disabled'}>Sell</button></div>`
      : `<div class="packbar"><span>${S.inv.length} pieces${G.traderHere(S, t) ? ' · trader’s prices' : ''}</span><button class="btn small" data-act="pack-on">Tag to sell</button></div>`;
    return bar + (groups || '<div class="empty">Nothing in the pack yet. Coffers and the delve fill it.</div>');
  }

  function viewRelics() {
    const owned = S.decor.owned;
    const total = Object.keys(G.DECOR).filter((k) => !G.DECOR[k].statue || owned.indexOf(k) >= 0).length;
    return `<div class="omen" style="text-align:center">${owned.length} of ${total} relics found. Each lends its strength while you hold it.</div>
      ${owned.map((k) => relicRow(k)).join('') || '<div class="empty">No relics yet.</div>'}
      <div class="btns"><button class="btn" data-act="goto" data-v="goods:relics">Seek more at the merchant</button></div>`;
  }
  // 2.11: what a piece gives, in one line; and how it compares with what's worn in that slot.
  // 2.20.1: every effect a piece has is shown, with its numbers (elements and resistances were missing).
  const itemStats = (it) => Object.keys(it.bonus || {}).map((k) => `+${it.bonus[k]} ${SI[k].short}`).concat(G.minorText(it) ? [G.minorText(it)] : [], G.elemText(it) ? [G.elemText(it)] : []).join(' ') || 'no bonus';
  const KIND_OF = (it) => (it && it.slot === 'weapon' ? (G.KINDS[it.art] ? it.art : 'blade') : null);
  // The full account of a piece: stats, then a line for each thing it does with what that means.
  function itemBody(it) {
    const rows = [], row = (t, d) => rows.push(`<div class="fxl"><b>${esc(t)}</b>${d ? `<small>${esc(HE(d))}</small>` : ''}</div>`);
    const k = KIND_OF(it); if (k) { const K = G.KINDS[k]; row(K.n, K.blurb); }
    if (G.minorText(it)) row(G.minorText(it), null);
    const f = G.fxOf(it); if (f) row('✦ ' + f[0], f[1]);
    const e = G.elemText(it, true); if (e) row(e[0], e[1]);
    return `<div class="bonus">${bonusLine(it.bonus)}</div>${rows.length ? `<div class="fxls">${rows.join('')}</div>` : ''}`;
  }
  function cmpHtml(it, cur, inp) {
    if (cur === undefined) cur = G.equipped(S, it.slot);
    if (cur && cur.id != null && cur.id === it.id) return '';
    const parts = [], up = (t) => parts.push(`<i class="up">${esc(t)}</i>`), dn = (t) => parts.push(`<i class="dn">${esc(t)}</i>`), mu = (t) => parts.push(`<i class="mu">${esc(t)}</i>`);
    // the hero as he stands, and with this piece on instead: what actually changes in a fight
    inp = inp || G.inputFor(S);
    const eqA = Object.assign({}, inp.eq), eqB = Object.assign({}, inp.eq); if (cur) eqA[it.slot] = cur; else delete eqA[it.slot]; eqB[it.slot] = it;
    const A = G.heroFrom(inp, eqA), B = G.heroFrom(inp, eqB);
    G.STATS.forEach((k) => { const d = ((it.bonus || {})[k] | 0) - (((cur || {}).bonus || {})[k] | 0); if (d) (d > 0 ? up : dn)(`${d > 0 ? '+' : '−'}${Math.abs(d)} ${SI[k].short}`); });
    const ma = G.minorOf(it), mb = G.minorOf(cur);
    if (ma && mb && ma.k === mb.k) { const d = ma.v - mb.v; if (d) (d > 0 ? up : dn)(G.minorText(it, d)); }
    else { if (ma) up(G.minorText(it)); if (mb) dn('loses ' + G.minorText(cur).slice(1)); }
    const ka = KIND_OF(it), kb = KIND_OF(cur);
    if (ka && kb && ka !== kb) mu(`a ${G.KINDS[ka].n.toLowerCase()} instead of a ${G.KINDS[kb].n.toLowerCase()}`);
    // effects: by what he ends up with, so a duplicate of something another piece already gives says so
    const fxs = (H) => Object.keys(H.fx || {}).filter((k) => H.fx[k]);
    fxs(B).filter((k) => !A.fx[k]).forEach((k) => up('✦ ' + G.fxInfo(k)[0]));
    fxs(A).filter((k) => !B.fx[k]).forEach((k) => { const f = G.fxInfo(k); dn(`loses ✦ ${f[0]} (${f[1].charAt(0).toLowerCase() + f[1].slice(1)})`); });
    if (it.fx && A.fx[it.fx] && G.fxOf(it) && !(cur && cur.fx === it.fx)) mu(`✦ ${G.fxOf(it)[0]}: already has it`);
    const R = Math.round(G.ELEM_TUNE.res * 100), en = (e) => G.ELEMENTS[e].n.toLowerCase();
    G.EL_KEYS.forEach((e) => {
      if (B.res[e] && !A.res[e]) up(`+${R}% ${en(e)} resistance`);
      else if (A.res[e] && !B.res[e]) dn(`loses ${R}% ${en(e)} resistance`);
      else if (A.res[e] && cur && cur.res === e && it.res !== e) { const o = G.SLOTS.find((sl) => sl !== it.slot && eqA[sl] && eqA[sl].res === e); mu(`keeps ${en(e)} resistance${o ? ' (his ' + eqA[o].base.toLowerCase() + ')' : ''}`); }
      else if (it.res === e && A.res[e] && !(cur && cur.res === e)) mu(`${en(e)} resistance: already has it`);
    });
    if (A.el !== B.el) { if (B.el) up(`${G.ELEMENTS[B.el].i} ${en(B.el)} weapon`); if (A.el) dn(`loses ${G.ELEMENTS[A.el].i} ${en(A.el)} weapon`); }
    // the fight numbers that move
    const nums = [['hpMax', 'HP', ''], ['atk', 'attack', ''], ['def', 'defence', ''], ['evade', 'dodge', '%', 100], ['mpMax', 'MP', ''], ['flasks', 'flasks', ''], ['wary', 'spotting traps', ''], ['keen', 'spotting secrets', '']];
    const dl = nums.map((n) => { const m = n[3] || 1, d = Math.round((B[n[0]] || 0) * m) - Math.round((A[n[0]] || 0) * m); return d ? `<i class="${d > 0 ? 'up' : 'dn'}">${n[1]} ${d > 0 ? '+' : '−'}${Math.abs(d)}${n[2]}</i>` : ''; }).filter(Boolean);
    const ups = parts.filter((x) => x.indexOf('"up"') > 0).length, dns = parts.filter((x) => x.indexOf('"dn"') > 0).length;
    const name = cur ? esc(cur.base.toLowerCase()) : '';
    const d = G.power(it) - (cur ? G.power(cur) : 0);
    const head = !cur ? ['up', 'Nothing worn in that slot'] : d > 0 ? ['up', (dns ? 'Mostly better' : 'Better') + ' than his ' + name] : d < 0 ? ['dn', (ups ? 'Mostly worse' : 'Worse') + ' than his ' + name]
      : ups && dns ? ['', 'A trade-off against his ' + name] : ups ? ['up', 'Better than his ' + name] : dns ? ['dn', 'Worse than his ' + name] : ['', 'About even with his ' + name];
    return HE(`<div class="cmp"><b class="${head[0]}">${head[1]}</b><span>${parts.join(' ') || 'the same numbers'}</span>`
      + `<div class="cmpd"><small>In the delve</small> ${dl.join(' ') || '<i>no change to his numbers</i>'}</div></div>`);
  }
  // 2.9: the piece's effect, if it has one
  function fxLine(it, long) { const f = G.fxOf(it); return f ? `<span class="fx">✦ ${esc(f[0])}${long === false ? '' : ': ' + esc(f[1].charAt(0).toLowerCase() + f[1].slice(1))}</span>` : ''; }
  function bonusLine(b) { return Object.keys(b || {}).map((k) => `<span style="color:var(--${k})">+${b[k]} ${SI[k].name}</span>`).join(' '); }
  function relicRow(k) {
    const d = G.DECOR[k];
    return `<div class="relic" data-act="relic" data-k="${k}"><div class="rp">${Home.decorSvg(k, S)}</div><div style="min-width:0"><div class="rn2">${esc(d.name)}</div>
      <div class="rb2">${bonusLine(d.bonus)}</div><div class="rl">${esc(d.blurb)}</div></div></div>`;
  }

  function openItem(id) {
    const it = G.itemById(S, id);
    if (!it) return;
    const cur = G.equipped(S, it.slot), isEq = cur && cur.id === it.id;
    let cmp = '';
    if (!isEq) cmp = cmpHtml(it);
    UI.sheet = null;
    openSheet(`<div style="text-align:center"><div class="big-icon">${Art.icon(it)}</div>
      <div class="rar" style="color:${RAR[it.tier].c}">${RAR[it.tier].n} ${SLOT_LABEL[it.slot]}</div>
      <h3 style="color:${RAR[it.tier].c};margin:6px 0 2px;text-transform:none;font-size:19px;letter-spacing:.04em">${esc(it.name)}</h3>
      ${itemBody(it)}
      <p class="lore" style="margin:8px 6px 0">${esc(G.itemLore(it))}</p>${cmp}
      <div class="dim" style="font-style:italic;font-size:14px;margin-top:6px">Found at level ${it.lvl}</div></div>
      <div class="btns"><button class="btn blood" data-m="sell" data-id="${it.id}">Sell · ${G.sellFor(S, it, G.today())}${G.traderHere(S, G.today()) ? ' (trader)' : ''}</button>
      ${isEq ? `<button class="btn" data-m="unequip" data-id="${it.id}">Remove</button>` : `<button class="btn prime" data-m="equip" data-id="${it.id}">Equip</button>`}</div>`, 'item');
  }

  function equip(id) { const it = G.itemById(S, id); if (!it) return; S.eq[it.slot] = it.id; UI.eqSlot = it.slot; save(); buzz(0); }
  function flashSil() { const d = $('#sil'); if (!d) return; d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash'); }

  function openChest() {
    if (S.chests <= 0) { goto('goods:coffers'); return; }
    S.chests -= 1;
    const it = G.rollItem(S, 0);
    S.inv.push(it);
    S.chestsOpened = (S.chestsOpened || 0) + 1;
    S.welcomed = true;
    save(); render(); Sfx.play('coffer');
    chestAnim(it, false);
  }
  function buyChest(k) {
    const c = G.CHESTS.find((x) => x.k === k);
    if (!c) return;
    if (S.gold < c.cost) { toast(`${c.cost - S.gold} gold short.`); return; }
    S.gold -= c.cost;
    const it = G.rollItem(S, c.floor);
    S.inv.push(it);
    S.chestsOpened = (S.chestsOpened || 0) + 1;
    save(); render();
    chestAnim(it, k === 'gilded');
  }
  function chestAnim(it, gilded) {
    buzz(0);
    openDialog(`<div class="chest-stage"><div class="cs shake">${Art.CHEST(gilded)}</div><p class="lore" style="margin-top:10px">The lock gives way…</p></div>`, 'chest', true);
    setTimeout(() => { if (UI.sheet === 'chest') reveal(it); }, 1000);
  }
  function reveal(it) {
    const r = RAR[it.tier];
    buzz(it.tier >= 3 ? 2 : 1);
    const cur = G.equipped(S, it.slot);
    let cmp = `<p class="lore" style="font-size:14.5px">Your first ${SLOT_LABEL[it.slot].toLowerCase()}.</p>`;
    if (cur) cmp = cmpHtml(it, cur);
    openDialog(`<div class="reveal"><div class="rar" style="color:${r.c}">${r.n} ${SLOT_LABEL[it.slot]}</div>
      <div class="big-icon" style="box-shadow:inset 0 0 0 3px #0a0908, inset 0 0 0 4px ${r.c}66, 0 0 30px ${r.c}44">${Art.icon(it)}</div>
      <h3 style="color:${r.c};text-transform:none;font-size:19px;letter-spacing:.04em;margin:4px 0 2px">${esc(it.name)}</h3>
      ${itemBody(it)}<p class="lore" style="font-size:15px;margin:6px 0 4px">${esc(G.itemLore(it))}</p>${cmp}
      <div class="btns"><button class="btn blood" data-m="reveal-sell" data-id="${it.id}">Sell · ${G.sellFor(S, it, G.today())}</button><button class="btn" data-m="close">Keep</button><button class="btn prime" data-m="equip-close" data-id="${it.id}">Equip</button></div>
      ${S.chests > 0 ? `<div class="btns" style="margin-top:8px"><button class="btn" data-m="again">Open another (${S.chests})</button></div>` : ''}</div>`, 'reveal');
  }

  function showLevelUp(r) {
    buzz(2); Sfx.play('level');
    const m = $('#modal');
    m.className = 'centred';
    m.innerHTML = `<div class="scrim" data-m="close"></div><div class="band"><div class="bk">LEVEL RISEN</div><div class="bn">${r.level}</div><div class="bt">${esc(G.title(S))}</div>
      <p class="lore" style="margin:8px 0 0">${r.levels > 1 ? r.levels + ' coffers are' : 'A coffer is'} yours.</p>
      <div class="btns"><button class="btn" data-m="close">Later</button><button class="btn prime" data-m="again">Open</button></div></div>`;
    UI.sheet = 'lvl';
  }

  // ================= QUESTS =================
  function daysLabel(d) {
    const s = d.join('');
    if (s === '1111111') return 'Daily';
    if (s === '1111100') return 'Weekdays';
    if (s === '0000011') return 'Weekends';
    return d.map((v, i) => (v ? DAYS3[i] : null)).filter(Boolean).join(' ');
  }
  // What doing this leaves behind for the next delve: up now (with the time left) or not up.
  function buffChip(q) {
    if (q.archived) return '';
    const di = Math.max(0, Math.min(G.DIFF.length - 1, (q.diff | 0) - 1)), qb = G.questBuff(q, q.stat, di), B = G.BUFFS[qb.type];
    if (!B) return '';
    if (!BUFFS_NOW || BUFFS_NOW.at !== Math.floor(Date.now() / 30000)) BUFFS_NOW = { at: Math.floor(Date.now() / 30000), list: G.activeBuffs(S, Date.now()) };
    const up = BUFFS_NOW.list.find((b) => b.q === q.id);
    return `<div class="bq ${up ? 'up' : ''}" data-act="delve-buff" data-id="${q.id}">${B.i} ${esc(B.n)}${up ? ' ' + esc(B.what(B.amt[di])) + ' · ' + hoursLeft(up.until) + ' left' : ''}</div>`;
  }
  let BUFFS_NOW = null;
  function questRow(q, t, mode, tag) {
    const can = G.canComplete(q, t);
    const cnt = q.type === 'habit' ? G.habitCount(q, t) : 0;
    const sub = [`<span class="st">${SI[q.stat].short}</span>`, `+${DIFF[q.diff - 1].xp}`];
    const rl = G.restLeft(q, t);
    if (q.type === 'habit' && q.rest > 1) sub.push(rl ? `back in ${rl} day${rl === 1 ? '' : 's'}` : restWord(q.rest));
    else if (q.type === 'habit') sub.push(q.cap > 1 ? `${cnt}/${q.cap} today` : q.cap ? (cnt ? 'done today' : 'once a day') : cnt ? `×${cnt}` : 'repeatable');
    if (q.type === 'daily' && q.rest > 1) sub.push('every ' + q.rest + ' days');
    if (q.type === 'daily' && (mode === 'all' || q.days.join('') !== '1111111')) sub.push(daysLabel(q.days));
    if (q.home) sub.push((G.AFFLICT[q.home] && G.AFFLICT[q.home].name) || G.HOME[q.home].name);
    if (q.archived) sub.push('archived');
    if (tag) sub.push(`<span class="ptag">${esc(tag)}</span>`);
    let btn;
    if (mode === 'all') btn = '<span class="dim" style="font:400 20px var(--cin);padding:0 8px">›</span>';
    else if (!can && rl) btn = `<span class="dim" style="font:italic 13.5px var(--gar);padding:0 4px">resting</span>`;
    else if (!can) btn = `<button class="chk on" data-act="undo" data-id="${q.id}"></button>`;
    else if (q.type === 'habit' && cnt) btn = `<button class="chk" data-act="complete" data-id="${q.id}"><span>${cnt}</span></button>`;
    else btn = `<button class="chk" data-act="complete" data-id="${q.id}"></button>`;
    const minBtn = mode !== 'all' && can && q.min ? `<button class="minb" data-act="complete-min" data-id="${q.id}" title="${esc(q.min)}">min</button>` : '';
    return `<div class="row ${mode !== 'all' && !can ? 'done' : ''}" style="--c:var(--${q.stat})" data-act="edit" data-id="${q.id}">
      <div class="ri">${esc(q.icon)}</div><div class="rb"><div class="rn">${esc(q.name)}</div><div class="rs">${sub.join(' · ')}</div>${mode !== 'all' && can && q.min ? `<div class="rmin">or at least: ${esc(q.min)} (half)</div>` : ''}${buffChip(q)}</div>${minBtn}${btn}</div>`;
  }
  // 2.9: the list wears down. Anything finished for today (or resting until it comes round again) drops off; what is
  // left is what is still to do. A fold at the bottom keeps the finished ones in reach, for undo or another go.
  const wantsHtml = (id) => { const w = G.homeWants ? G.homeWants(S, id) : G.npcWants(S, id); return w.length ? `<div class="wants">${w.map((x) => `<span class="${x.ok ? 'ok' : ''}">${x.ok ? '✓' : '·'} ${esc(x.text)}</span>`).join('')}</div>` : ''; };
  const dayName = (d) => (d === G.today() ? 'today' : d === G.addDays(G.today(), 1) ? 'tomorrow' : new Date(d + 'T00:00').toLocaleDateString('en-AU', { weekday: 'long' }));
  // 2.10: what the household has asked for
  function asksBlock() {
    const L = S.asks.list.filter((a) => !a.done);
    if (!L.length) return '';
    return `<div class="hd">Asked of you<small>no harm in letting one go</small></div>` + L.map((a) => { const n = npcById(a.from), q = S.quests.find((x) => x.id === a.q); if (!n || !q) return '';
      return `<div class="ask"><div class="an">${esc(n.name)} asks</div><div class="aq">${esc(q.icon)} ${esc(q.name)}${a.n > 1 ? ' × ' + a.n : ''} <small>by ${dayName(a.by)}</small></div><div class="ar">${a.progress}/${a.n} · ${a.gold} gold</div></div>`; }).join('');
  }
  function asksSettle() {
    const got = G.asksSync(S, G.today(), Date.now());
    got.forEach((r, i) => setTimeout(() => { Sfx.play('coin'); toast(`${r.npc ? r.npc.name : 'They'} says thanks. +${r.ask.gold} gold${r.chest ? ' and a coffer' : ''}.${r.hint ? ' “They say the thing down there fears ' + G.ELEMENTS[r.hint].n.toLowerCase() + '.”' : ''}`); }, 1600 + i * 3200));
    return got.length;
  }
  function traderBlock() {
    const t = G.today(); if (!G.traderHere(S, t)) return '';
    const st = S.trader.stock;
    return `<div class="hd">The trader is in<small>today only</small></div><p class="lore" style="margin-top:0">He pays 30% over the odds for anything you sell while he’s here.</p>` +
      (st.map((it) => `<div class="irow" style="--rc:${RAR[it.tier].c}"><div class="box">${Art.icon(it)}</div><div style="min-width:0;flex:1"><div class="in">${esc(it.name)}</div>
        <div class="im">${RAR[it.tier].n} ${SLOT_LABEL[it.slot]} · ${itemStats(it)}</div>${fxLine(it)}</div><button class="btn small ${S.gold >= it.price ? 'prime' : ''}" data-act="trader-buy" data-id="${it.id}">◈ ${it.price}</button></div>`).join('') || '<div class="empty">Sold out.</div>');
  }
  // boons from the deep
  function boonBlock() {
    const due = G.perksDue(S), held = S.delve.perks || {}, ks = Object.keys(held).filter((k) => held[k] > 0);
    const clears = (S.delve.trophies || []).length, nextAt = (() => { for (let c = clears + 1; c < clears + 40; c++) if (G.perksDue({ delve: { trophies: { length: c }, perks: held } }) > due) return c - clears; return null; })();
    return `<div class="hd">Boons<small>${due ? 'one to choose' : nextAt ? `the next in ${nextAt} clear${nextAt > 1 ? 's' : ''}` : ''}</small></div>` +
      (due ? `<div class="btns"><button class="btn prime" data-act="boon">Choose a boon</button></div>` : '') +
      (ks.length ? ks.map((k) => `<div class="kv"><span>${esc(G.PERKS[k].n)}${held[k] > 1 ? ' × ' + held[k] : ''}</span><b style="font:500 14px var(--gar)">${esc(G.PERKS[k].d)}</b></div>`).join('') : due ? '' : '<div class="empty">None yet. The deep gives one for every third place cleared.</div>') + townBlock();
  }
  // What the town adds to a run: the rewards he's kept, and what the open buildings lend.
  function townBlock() {
    if (!S.town || !S.town.open) return '';
    const rows = Object.keys(G.TOWN).map((k) => { const st = G.townState(S, k), bits = st.earned.slice(); if (st.on && !G.TOWN[k].act.grow && !G.TOWN[k].act.sell && !G.TOWN[k].act.deedGold && !G.TOWN[k].act.askGold) bits.push(st.active + ' (while open)'); return bits.length ? `<div class="kv"><span>${G.TOWN[k].icon} ${esc(G.TOWN[k].name)}</span><b style="font:500 14px var(--gar)">${esc(bits.join(' · '))}</b></div>` : ''; }).join('');
    return rows ? `<div class="hd" data-act="goto" data-v="hearth:town">From the town<small>Hearth › Town</small></div>` + rows : '';
  }
  function openBoon() {
    const offer = G.perkOffer(S);
    UI.sheet = null;
    openSheet(`<h3>A boon from the deep</h3><p class="lore">Something down there has taken notice. Choose one; it is his for good.</p>` +
      offer.map((k) => `<div class="row" data-m="boon-pick" data-k="${k}"><div class="rb"><div class="rn">${esc(G.PERKS[k].n)}${(S.delve.perks || {})[k] ? ' <small>(held × ' + S.delve.perks[k] + ')</small>' : ''}</div><div class="rs">${esc(G.PERKS[k].d)}</div></div><div class="dim">›</div></div>`).join('') +
      `<div class="btns"><button class="btn" data-m="close">Later</button></div>`, 'boon');
  }
  // 2.14: the list is in two parts. Today's plan is the one to clear: the dailies that are due plus a few things
  // picked for the day he's having. Everything else is still there underneath, on offer.
  function todayList(t, dailies, letOff, habits, todos, resting) {
    const P = G.planState(S, t), pid = {}; P.items.forEach((q) => { pid[q.id] = 1; });
    const fin = (q) => (q.type === 'habit' ? G.habitCount(q, t) > 0 : q.doneOn === t);
    const all = dailies.concat(letOff, habits, todos), done = all.filter(fin), open = (l) => l.filter((q) => !fin(q));
    const d = open(dailies), lo = open(letOff), picked = open(P.items), h = open(habits).filter((q) => !pid[q.id]), td = open(todos).filter((q) => !pid[q.id]);
    const sec = (title, list, small) => (list.length ? section(title, list, t, small, '') : '');
    const kindWord = { off: 'day off', work: 'work day', long: 'long shift' }[P.kind] || '';
    const wx = P.wx ? `${P.wx.icon} ${esc(P.wx.text)}` : '';
    const head = `<div class="planhd"><div><b>Today’s plan</b><small>${[kindWord, wx].filter(Boolean).join(' · ') || 'the list to clear'}</small></div><div class="pn">${P.total - P.left}/${P.total}</div></div>`;
    const pick = picked.length ? `<div class="hd">Picked for today<small>${P.swapsLeft > 0 ? `<span data-act="plan-swap" class="lnk">Swap one (${P.swapsLeft} left)</span>` : 'suits the day'}</small></div>` + picked.map((q) => questRow(q, t, '', P.plan.why[q.id])).join('') : '';
    const cleared = P.clear ? `<div class="alldone">Plan cleared${P.plan.paid ? '' : '.'}${S.planDays > 1 ? ` · ${S.planDays} days so far` : ''}<small>Anything below is a bonus.</small></div>` : !P.total ? '<div class="empty">Nothing planned. Tap + to add a quest.</div>' : '';
    const body = head + sec('Dailies', d, '') + pick + cleared + sec('Let off today', lo, 'long shift: these still pay, but nobody is counting') + sec('Also on offer', h, 'not on the plan, still count') + sec('To-dos', td, '');
    const n = done.length + resting.length;
    const fold = n ? `<div class="fold ${UI.showDone ? 'open' : ''}" data-act="fold-done"><span>${done.length ? done.length + ' done today' : ''}${done.length && resting.length ? ' · ' : ''}${resting.length ? resting.length + ' resting' : ''}</span><i>${UI.showDone ? '▴' : '▾'}</i></div>` +
      (UI.showDone ? done.map((q) => questRow(q, t)).join('') + (resting.length ? `<div class="resting">${resting.map((q) => `<span data-act="edit" data-id="${q.id}">${esc(q.icon)} ${esc(q.name)} · ${G.restLeft(q, t)}d</span>`).join('')}</div>` : '') : '') : '';
    return lifeCard() + asksBlock() + body + fold;
  }
  // ---------- 2.19 his week: a few questions so the plan and the weeklies fit real life ----------
  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function lifeCard() {
    const L = S.life || {};
    if (L.asked || L.skip) return '';
    return `<div class="lifecard"><b>Fit the plan to your week</b><p>Four quick questions (bin day, payday, the big shop) so the bins only come up on bin night and the weeklies ask for what your week allows.</p>
      <div class="btns"><button class="btn small" data-act="life-skip">Not now</button><button class="btn small prime" data-act="life">Set it up</button></div></div>`;
  }
  function lifeSummary() {
    const L = S.life || {}, bits = [];
    if (L.bin != null) bits.push('bins ' + (L.eve ? WD[(L.bin + 6) % 7] + ' night' : WD[L.bin] + ' morning'));
    if (L.payEvery && L.payLast) { const n = G.nextPayday(S, G.today()); bits.push({ 7: 'paid weekly', 14: 'paid fortnightly', 30: 'paid monthly' }[L.payEvery] + (n ? ', next ' + dShort(n) : '')); }
    if (L.shop != null) bits.push('shop ' + WD[L.shop]);
    return bits.join(' · ') || 'Not set: the plan guesses.';
  }
  function openLife() {
    const L = UI.lifeDraft = UI.lifeDraft || Object.assign({}, S.life);
    const pills = (k, opts) => `<div class="pills">${opts.map((o) => `<button class="pill ${String(L[k]) === String(o[0]) ? 'on' : ''}" data-m="life-pick" data-k="${k}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
    const days = WD.map((d, i) => [i, d]);
    openSheet(`<h3>Your week</h3><p class="lore">So the plan and the weeklies fit real life. Change it any time in Settings.</p>
      <div class="lbl">Bin day<small>the day they're collected</small></div>${pills('bin', days.concat([['null', 'Not sure']]))}
      ${L.bin != null ? `<div class="lbl">Out they go</div>${pills('eve', [[true, 'The night before'], [false, 'On the morning']])}` : ''}
      <div class="lbl">How often you're paid</div>${pills('payEvery', [[7, 'Weekly'], [14, 'Fortnightly'], [30, 'Monthly'], [0, 'It varies']])}
      ${L.payEvery ? `<div class="lbl">Your last payday</div><input type="date" class="field" id="life-pay" value="${esc(L.payLast || '')}" max="${G.today()}">` : ''}
      <div class="lbl">Big shop day<small>the plan puts the list the day before</small></div>${pills('shop', days.concat([['null', 'No set day']]))}
      <p class="lore" style="font-size:14px">Anything that has to be booked ahead (the dentist, a haircut, a check-up) is never put on the plan or a weekly. It stays on your list for when it's booked.</p>
      <div class="btns"><button class="btn" data-m="close">Cancel</button><button class="btn prime" data-m="life-save">Save</button></div>`, 'life');
  }
  function lifePick(k, v) {
    const L = UI.lifeDraft; if (!L) return;
    const inp = $('#life-pay'); if (inp) L.payLast = inp.value || null;
    L[k] = v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : Number(v);
    openLife();
  }
  function lifeSave() {
    const L = UI.lifeDraft || {}, inp = $('#life-pay');
    if (inp) L.payLast = inp.value || null;
    S.life = Object.assign({}, S.life, L, { asked: true });
    G.lifeNorm(S); G.weekliesFit(S, G.today());
    if (S.plan && !S.plan.swaps && !S.plan.ids.some((id) => S.log.some((e) => e.q === id && e.d === G.today()))) delete S.plan;
    UI.lifeDraft = null; save(); closeModal(); render(); toast('Your week is set. The plan will follow it.');
  }
  function openPlanSwap() {
    const t = G.today(), P = G.planState(S, t), items = P.items.filter((q) => !P.fin(q));
    openSheet(`<h3>Not today</h3><p class="lore">Pick one to trade for the next best fit. ${P.swapsLeft} swap${P.swapsLeft === 1 ? '' : 's'} left today. It stays on offer below.</p>` +
      items.map((q) => `<div class="row" data-m="plan-swap-do" data-id="${q.id}"><div class="ri">${esc(q.icon)}</div><div class="rb"><div class="rn">${esc(q.name)}</div></div><span class="dim">↻</span></div>`).join('') +
      '<div class="btns"><button class="btn" data-m="close">Close</button></div>', 'plan');
  }
  function planSwapDo(id) {
    const r = G.planSwap(S, G.today(), id);
    if (r.err) { toast(r.err + '.'); return; }
    save(); closeModal(); render();
    toast(r.to ? `Swapped for: ${r.to.name}` : 'Taken off the plan. Nothing else suits today.');
  }
  // Called from save(): pays the once-a-day bonus when the plan is cleared.
  function planSettle() {
    const got = G.bonusTick(S, G.today(), Date.now());
    const r = G.planClaim(S, G.today(), Date.now());
    const bits = got.map((x) => `${G.BONUS[x[0]].n}: ${G.BUFFS[x[1].type].i} ${G.BUFFS[x[1].type].what(x[1].amt)}`);
    if (r) bits.unshift(`Plan cleared: all ${r.n} done. +${r.gold} gold`);
    if (bits.length) { Sfx.play('coin'); setTimeout(() => toast(bits.join(' · ')), 1700); }
  }
  // ---------- the weather (2.14): one forecast a few times a day, to help pick the plan ----------
  function weatherPull(force) {
    if (!S.settings.weather || !N || !N.weather) return;
    const t = G.today(), w = S.weather;
    if (!force && w && w.d === t && Date.now() - (w.at || 0) < 3 * 3600e3) return;
    try { N.weather('__weather'); } catch (e) { /* no network: the plan does without */ }
  }
  window.__weather = function (text) {
    try {
      const j = typeof text === 'string' ? JSON.parse(text) : text, D = j && j.daily; if (!D || !D.time) return;
      const t = G.today(), i = D.time.indexOf(t); if (i < 0) return;
      const num = (a) => (a && typeof a[i] === 'number' ? a[i] : 0);
      S.weather = { d: t, at: Date.now(), max: num(D.temperature_2m_max), rain: num(D.precipitation_sum), prob: num(D.precipitation_probability_max), wind: num(D.wind_speed_10m_max), home: !!j.home };
      save(); if (UI.tab === 'quests' && !UI.sheet) render();
    } catch (e) { /* a bad answer is no answer */ }
  };
  // the rain over the house follows the real forecast when there is one
  function houseWeather() { const w = S.settings.weather ? G.weatherRead(S.weather, G.today()) : null; return w ? (w.wet ? 'rain' : null) : G.weatherOn(G.today(), new Date().getHours()); }
  function weatherSettings() {
    const w = S.weather && S.weather.d === G.today() ? G.weatherRead(S.weather, G.today()) : null, n = (k) => G.planSize(S, k);
    const step = (k, label) => `<div class="set"><div class="l">${label}</div><div class="stepper"><button data-act="plan-n" data-k="${k}" data-v="-1">−</button><span>${n(k)}</span><button data-act="plan-n" data-k="${k}" data-v="1">+</button></div></div>`;
    return `<div class="hd">Today’s plan</div>
      <p class="lore" style="margin-top:0">The plan is the due dailies plus a few picks. How many picks, by the kind of day:</p>
      ${step('off', 'Day off')}${step('work', 'Work day')}${step('long', 'Long shift')}${step('none', 'No roster for the day')}
      <div class="set"><div class="l">Use the forecast<small>${S.settings.weather ? (w ? `Today: ${esc(w.text)}${S.weather.home ? '' : ' (Albany; set a home under Delve for your own spot)'}. Outdoor jobs move down on a wet or windy day, never off the list.` : 'Checked a few times a day. Sends only a rough location to open-meteo.com.') : 'Off: the plan ignores the weather.'}</small></div><button class="toggle ${S.settings.weather ? 'on' : ''}" data-act="weather-toggle"></button></div>`;
  }
  function section(title, list, t, small, empty) {
    return `<div class="hd">${title}${small ? `<small>${small}</small>` : ''}</div>` + (list.length ? list.map((q) => questRow(q, t)).join('') : `<div class="empty">${empty}</div>`);
  }

  // ---------- the season ----------
  function openSeason() {
    const st = G.seasonState(S, G.today());
    UI.sheet = null;
    openSheet(`<h3>${esc(st.name)}</h3><p class="lore">Everything you earn this season climbs the track. ${st.left} day${st.left === 1 ? '' : 's'} left; then it starts again.</p>
      <div class="strack">${Array.from({ length: st.tiers }, (_, i) => { const n = i + 1, r = G.seasonReward(n), got = n <= st.tier; return `<div class="${got ? 'got' : n === st.tier + 1 ? 'next' : ''}"><b>${n}</b><span>${r.chest ? (r.chest > 1 ? r.chest + ' coffers' : 'coffer') : ''}${r.chest && r.gold ? ' + ' : ''}${r.gold ? r.gold + ' gold' : ''}</span>${n === st.tier + 1 ? `<i style="width:${Math.round((st.into / st.step) * 100)}%"></i>` : ''}</div>`; }).join('')}</div>
      <div class="kv"><span>This season</span><b>${st.xp} XP${st.tier < st.tiers ? ` <small>${st.step - st.into} to step ${st.tier + 1}</small>` : ' <small>track finished</small>'}</b></div>
      ${S.seasons.length ? '<div class="lbl">Seasons past</div>' + S.seasons.slice().reverse().map((x) => `<div class="kv"><span>${esc(G.seasonName(x.key))}</span><b>step ${x.tier} <small>${x.xp} XP</small></b></div>`).join('') : ''}
      <div class="btns"><button class="btn" data-m="close">Close</button></div>`, 'season');
  }
  // ---------- the week in review ----------
  function openReview(back) {
    const t = G.today(), ws = G.addDays(G.weekStart(t), back ? -7 : 0), we = G.addDays(ws, 6), cur = !back;
    const L = S.log.filter((e) => e.d >= ws && e.d <= we), deeds = L.filter((e) => e.q != null);
    const days = new Set(deeds.map((e) => e.d)).size, span = cur ? G.daysBetween(ws, t) + 1 : 7;
    const byQ = {}; deeds.forEach((e) => { byQ[e.q] = (byQ[e.q] || 0) + 1; });
    const live = S.quests.filter((q) => !q.archived);
    const stuck = live.filter((q) => byQ[q.id]).sort((a, b) => byQ[b.id] - byQ[a.id]).slice(0, 4);
    // slipped: dailies done on fewer than half the days they were due; habits with a history and nothing this week
    const slipped = [];
    live.forEach((q) => {
      if (q.type === 'daily') { let due = 0; for (let i = 0; i < span; i++) { const d = G.addDays(ws, i); if (G.dueOn(q, d) && !G.excused(S, q, d)) due++; } const done = byQ[q.id] || 0; if (due >= 2 && done < due / 2) slipped.push([q, `${done} of ${due} days`]); }
      else if (q.type === 'habit' && !byQ[q.id] && !(q.rest > 7) && ((S.qlast && S.qlast[q.id] && S.qlast[q.id] < ws) || S.log.some((e) => e.q === q.id && e.d < ws))) slipped.push([q, 'not this week']);
    });
    const hs = H(), over = Object.keys(G.AFFLICT).filter((a) => hs[a] && hs[a].linked && hs[a].state === 2);
    const runs = (S.delve.hist || []).filter((r) => r.d >= ws && r.d <= we), clears = L.filter((e) => e.v && /^Cleared /.test(e.n)).length;
    const wk = S.trials.week === ws ? S.trials.list : [];
    const marks = S.marks.map((m) => [m, m.log.filter((a) => a.d >= ws && a.d <= we)]).filter((x) => x[1].length);
    const odw = G.overdueWeek(S, ws, we, t), full = G.remindCount(S) >= G.REMIND_MAX;
    UI.reviewBack = !!back;
    const rmBtn = (q) => { if (q.remind || full) return ''; const sg = G.remindSuggest(S, q), n = sg ? sg.n : { daily: 3, habit: 7, todo: 3 }[q.type] || 3; return ` <button class="btn tiny" data-m="rv-remind" data-k="${q.id}" data-v="${n}">⏰ ${n}d</button>`; };
    const focus = slipped[0] ? `Next week: ${slipped[0][0].name}. Start with the smallest version of it.` : over[0] ? `Next week: catch up on the ${G.AFFLICT[over[0]].name.toLowerCase()}.` : 'Nothing slipped. Keep the same week going.';
    const range = `${dShort(ws)} to ${dShort(we)}`;
    if (cur) { S.reviewSeen = ws; save(); }
    UI.sheet = null;
    openSheet(`<h3>${cur ? 'This week' : 'Last week'}</h3><p class="lore">${esc(range)}</p>
      <div class="rv4"><div><b>${deeds.length}</b><span>deeds</span></div><div><b>${days}/${span}</b><span>days</span></div><div><b>${deeds.reduce((a, e) => a + e.x, 0)}</b><span>XP</span></div><div><b>${L.reduce((a, e) => a + (e.g > 0 ? e.g : 0), 0)}</b><span>gold</span></div></div>
      <div class="lbl">Stuck</div>${stuck.map((q) => `<div class="kv"><span>${esc(q.icon)} ${esc(q.name)}</span><b>× ${byQ[q.id]}</b></div>`).join('') || '<div class="empty">Nothing logged yet.</div>'}
      <div class="lbl">Slipped${slipped.some((x) => !x[0].remind) && !full ? '<small>⏰ puts a reminder on it, at the suggestion</small>' : ''}</div>${slipped.slice(0, 5).map((x) => `<div class="kv"><span>${esc(x[0].icon)} ${esc(x[0].name)}${x[0].remind ? ' <small>⏰</small>' : ''}</span><b style="color:var(--blood2)">${x[1]}${rmBtn(x[0])}</b></div>`).join('') || '<div class="empty">Nothing.</div>'}
      ${odw.length ? `<div class="lbl">Went overdue<small>reminders, day by day</small></div>${odw.map((x) => `<div class="kv"><span>${esc(x.q.icon)} ${esc(x.q.name)}</span><b style="color:var(--blood2);font:500 15px var(--gar)">${dWord(x.days)} <small>longest ${x.max}d · ${x.still ? (cur ? 'still overdue' : 'still overdue at the week’s end') : 'done since'}</small></b></div>`).join('')}` : ''}
      ${over.length && cur ? `<div class="kv"><span>Overdue now</span><b style="color:var(--blood2);font:500 15px var(--gar)">${over.map((a) => esc(G.AFFLICT[a].name)).join(', ')}</b></div>` : ''}
      ${wk.length ? `<div class="kv"><span>Weeklies</span><b>${wk.filter((g) => g.done).length} of ${wk.length}</b></div>` : ''}
      <div class="kv"><span>Delve</span><b>${clears} cleared${runs.length ? ` <small>${runs.length} run${runs.length > 1 ? 's' : ''}</small>` : ''}</b></div>
      ${marks.map((x) => `<div class="kv"><span>${esc(x[0].name)}</span><b>${G.markFmt(x[0], x[1].reduce((b, a) => (x[0].better === 'lower' ? Math.min(b, a.v) : Math.max(b, a.v)), x[1][0].v))} <small>best of ${x[1].length}</small></b></div>`).join('')}
      <p class="lore" style="margin-top:10px;color:var(--gold2)">${esc(focus)}</p>
      <div class="btns">${cur ? '<button class="btn" data-m="review-last">Last week</button>' : '<button class="btn" data-m="review-this">This week</button>'}<button class="btn prime" data-m="close">Done</button></div>`, 'review');
  }
  function dayChips(t) {
    const out = [], k = G.dayKind(S, t), d = S.roster && S.roster.days[t], tm = G.addDays(t, 1), d2 = S.roster && S.roster.days[tm];
    if (k === 'long') out.push(`<span class="good">Long shift (${Math.round(d.mins / 6) / 10} h): light list</span>`);
    else if (k === 'work') out.push(`<span>Work ${G.hm(d.first)} to ${G.hm(d.last)}</span>`);
    else if (k === 'off') out.push('<span class="good">Day off</span>');
    if (d2 && d2.mins > 0 && d2.first < 8 * 60 && new Date().getHours() >= 15) out.push(`<span>Tomorrow starts ${G.hm(d2.first)}</span>`);
    return out;
  }
  // The roster: pulled from the chosen calendar whenever the app comes to the front.
  // once a day: someone may ask for something; the trader may call
  function houseDay() {
    const t = G.today(), a = G.asksTick(S, t, Date.now()), was = G.traderHere(S, t), tr = G.traderTick(S, t);
    if (a || (tr && !was)) save();
    if (a) { const n = npcById(a.from), q = S.quests.find((x) => x.id === a.q); if (n && q) setTimeout(() => toast(`${n.name} asks: ${q.name}${a.n > 1 ? ', ' + a.n + ' times' : ''} by ${dayName(a.by)}.`), 2200); }
    if (tr && !was) setTimeout(() => toast('The trader has called. He’s under Goods, today only.'), a ? 5600 : 2200);
  }
  function rosterPull() {
    if (!N || !N.rosterEvents || !S.settings.rosterCal) return;
    try {
      const evs = JSON.parse(N.rosterEvents(String(S.settings.rosterCal)) || '[]');
      const days = G.rosterDigest(evs), sigNow = JSON.stringify(days);
      if (!S.roster || JSON.stringify(S.roster.days) !== sigNow) { S.roster = { at: Date.now(), days: days }; save(); }
    } catch (e) { /* the calendar can wait */ }
  }
  function openRosterPick() {
    let cals = [];
    try { const info = N && N.heraldInfo ? JSON.parse(N.heraldInfo()) : {}; cals = info.cals || []; if (N && info.perm === false && N.askCalendar) { N.askCalendar(); toast('Allow the calendar, then come back here.'); return; } } catch (e) { cals = []; }
    UI.sheet = null;
    openSheet(`<h3>Work roster</h3><p class="lore">Pick the calendar your shifts land in. Timed events count as shifts; all-day ones only if they say RDO or leave.</p>
      ${cals.map((c) => `<div class="row" data-m="roster-set" data-id="${c.id}" data-v="${esc(c.name)}"><div class="rb"><div class="rn">${esc(c.name)}</div><div class="rs">${esc(c.account || '')}</div></div>${String(S.settings.rosterCal) === String(c.id) ? '<span class="dim">in use</span>' : ''}</div>`).join('') || '<div class="empty">No calendars found on this phone.</div>'}
      <div class="btns">${S.settings.rosterCal ? '<button class="btn small blood" data-m="roster-set" data-id="" data-v="">Stop using it</button>' : ''}<button class="btn" data-m="close">Close</button></div>`, 'roster');
  }
  function rosterSettings() {
    const on = !!S.settings.rosterCal, t = G.today();
    let next = '';
    if (on && S.roster) { const ds = [0, 1, 2, 3, 4, 5, 6].map((i) => G.addDays(t, i)); next = ds.map((d) => { const k = G.dayKind(S, d); return `<span class="${k === 'long' ? 'bad' : k === 'off' ? 'good' : ''}">${'SMTWTFS'[new Date(d + 'T00:00').getDay()]} ${k === 'long' ? 'long' : k === 'work' ? 'work' : k === 'off' ? 'off' : '?'}</span>`; }).join(''); }
    return `<div class="hd">Work roster</div>
      <div class="set"><div class="l">${on ? esc(S.settings.rosterName || 'Linked') : 'Not linked'}<small>${on ? 'On long-shift days only the dailies you mark as needed stay on the list' : 'Link the calendar your shifts are in and long days get a lighter list'}</small></div><button class="btn small" data-act="roster-pick">${on ? 'Change' : 'Link'}</button></div>
      ${on ? `<div class="set"><div class="l">A long day is<small>hours worked, or a split shift spanning 13</small></div><div class="stepper"><button data-act="long-hours" data-v="-1">−</button><span>${S.settings.longHours} h</span><button data-act="long-hours" data-v="1">+</button></div></div>${next ? `<div class="chips">${next}</div>` : ''}` : ''}`;
  }
  // ---------- backups that outlive the app ----------
  function backupNow(quiet) {
    if (!N || !N.backupWrite) { if (!quiet) exportSave(); return; }
    const r = N.backupWrite(JSON.stringify(S), 'grindstone-' + G.today() + '.json');
    S.settings.backupAt = Date.now(); S.settings.backupSaid = r; save();
    if (!quiet) { toast(/^ok/.test(r) ? 'Saved to ' + r.slice(4) : 'Backup failed: ' + r); render(); }
  }
  function maybeBackup() { if (S.settings.backup && N && N.backupWrite && Date.now() - (S.settings.backupAt || 0) > 7 * 864e5 && S.total > 0) backupNow(true); }
  window.onBackupPicked = function (text) {
    if (text == null) { toast('Nothing was picked, or it could not be read.'); return; }
    let parsed;
    try { parsed = JSON.parse(text); } catch (err) { toast('That file isn’t a Grindstone save.'); return; }
    if (!parsed || !Array.isArray(parsed.quests)) { toast('That file isn’t a Grindstone save.'); return; }
    confirmBox('Restore this backup?', `Level ${parsed.level | 0}, ${(parsed.quests || []).length} quests${parsed.lastActive ? ', last played ' + parsed.lastActive : ''}. It replaces everything here.`, 'Restore', () => {
      S = G.normalize(parsed, G.today()); S.uiV = 3; UI.pct = null; save(); closeModal(); goto('quests:today'); toast('Backup restored.');
    }, true);
  };
  function backupSettings() {
    const at = S.settings.backupAt, said = S.settings.backupSaid || '';
    return `<div class="hd">Backup</div>
      <div class="set"><div class="l">Weekly backup file<small>${N && N.backupWrite ? `Kept in Downloads/Grindstone on this phone, where an uninstall can’t reach it. ${at ? (/^ok/.test(said) ? 'Last saved ' : 'Last try failed ') + dShort(G.today(new Date(at))) + '.' : 'Not saved yet.'}` : 'Needs the phone app'}</small></div><button class="toggle ${S.settings.backup ? 'on' : ''}" data-act="backup-toggle"></button></div>
      <div class="btns"><button class="btn" data-act="backup-now">Back up now</button><button class="btn" data-act="backup-pick">Restore from a file</button></div>
      <div class="set"><div class="l">Share a copy<small>To Drive or email, for a new phone</small></div><button class="btn small" data-act="export">Share</button></div>
      <div class="set"><div class="l">Paste a save</div><button class="btn small" data-act="import">Paste</button></div>`;
  }
  function remindSettings() {
    return `<div class="hd">Sound</div>
      <div class="set"><div class="l">Blips for ticks, levels and coffers<small>Stays quiet while the phone is on silent or vibrate</small></div><button class="toggle ${S.settings.sound ? 'on' : ''}" data-act="sound-toggle"></button></div>
      <div class="hd">What’s left today</div>
      <div class="set"><div class="l">An evening note of open dailies<small>With buttons to tick them off without opening the app</small></div><button class="toggle ${S.settings.remind ? 'on' : ''}" data-act="remind-toggle"></button></div>
      ${S.settings.remind ? `<div class="set"><div class="l">From</div><div class="stepper"><button data-act="remind-hour" data-v="-1">−</button><span>${G.hm(S.settings.remindHour * 60)}</span><button data-act="remind-hour" data-v="1">+</button></div></div>` : ''}
      <div class="hd">It’s been too long</div>
      <div class="set"><div class="l">A daily note of what’s overdue<small>${G.remindCount(S)} of ${G.REMIND_MAX} quests have a reminder. Turn one on from the quest’s own card.</small></div><button class="toggle ${S.settings.overdue !== false ? 'on' : ''}" data-act="overdue-toggle"></button></div>
      ${S.settings.overdue !== false ? `<div class="set"><div class="l">Not before<small>and never during a rostered shift, or within half an hour of one</small></div><div class="stepper"><button data-act="overdue-hour" data-v="-1">−</button><span>${G.hm(S.settings.overdueHour * 60)}</span><button data-act="overdue-hour" data-v="1">+</button></div></div>` : ''}
      <div class="btns"><button class="btn small" data-act="overdue">See them</button></div>`;
  }
  function viewToday() {
    const t = G.today();
    const live = S.quests.filter((q) => !q.archived && !G.isAway(q, t));   // 2.27: what's put away isn't on the list at all
    const dueDailies = live.filter((q) => q.type === 'daily' && G.dueOn(q, t));
    const dailies = dueDailies.filter((q) => !G.excused(S, q, t)), letOff = dueDailies.filter((q) => G.excused(S, q, t));
    const allHabits = live.filter((q) => q.type === 'habit');
    const resting = allHabits.filter((q) => G.restLeft(q, t) > 0).sort((a, b) => G.restLeft(a, t) - G.restLeft(b, t));
    const habits = allHabits.filter((q) => !(G.restLeft(q, t) > 0));
    const todos = live.filter((q) => q.type === 'todo' && (!q.doneOn || q.doneOn === t));
    const dd = dailies.filter((q) => q.doneOn === t).length;
    const todayLog = S.log.filter((e) => e.d === t && e.q != null);
    const now = new Date();
    const gap = G.trainGap(S, t);   // 2.27: quiet while training's on hold
    const hs = H();
    const aff = Object.keys(G.AFFLICT).filter((a) => hs[a] && hs[a].linked && hs[a].state === 2);
    const trialsDone = S.trials.list.filter((g) => g.done).length;
    // 2.8: one strip of chips, not a paragraph of omens. Only what needs attention gets a chip.
    const chips = [];
    chips.push(`<span data-act="goto" data-v="quests:vows">Weeklies ${trialsDone}/${S.trials.list.length}</span>`);
    if (hasKey()) chips.push('<span data-act="oracle-chat">🔮 The Oracle</span>');
    if (aff.length) chips.push(`<span class="bad" data-act="goto" data-v="hearth:">Overdue: ${aff.map((a) => esc(G.AFFLICT[a].name) + (hs[a].dire ? ' (' + esc(hs[a].word.toLowerCase()) + ')' : '')).join(', ')}</span>`);
    if (gap != null && gap >= S.settings.nudgeDays) chips.push(`<span class="bad">${gap} days since training</span>`);
    { const od = G.overdueList(S, t, rmMarks()); if (od.length) chips.push(`<span class="bad" data-act="overdue">⏰ ${od.slice(0, 3).map((x) => esc(x.name) + ' ' + x.gap + 'd').join(' · ')}${od.length > 3 ? ' +' + (od.length - 3) : ''}</span>`); }
    { const so = G.slipOffers(S, t)[0]; if (so) chips.push(`<span data-act="slip" data-id="${so.id}">⏰ ${esc(so.q.name)} has slipped · ${so.gap}d</span>`); }
    { const vs = G.visitorsNow(S, t).filter((v) => !v.lives && v.ev); if (vs.length) { const w = G.evWords(vs[0].ev, t); chips.push(`<span data-act="person" data-id="${esc(vs[0].p.id)}">${w.icon} ${esc(vs[0].p.name)}’s here · ${esc(w.what.replace(new RegExp('^' + vs[0].p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '’s? ', ''), ''))} ${esc(w.when)}${vs.length > 1 ? ' +' + (vs.length - 1) : ''}</span>`); } }
    { const pc = G.peopleCandidates(S, t).filter((x) => x.big); if (pc.length) chips.push(`<span data-act="people">📅 ${esc(pc.slice(0, 2).map((x) => x.name).join(', '))}${pc.length > 2 ? ' +' + (pc.length - 2) : ''} in your calendar</span>`); }   // only names with a big day nag; dinners wait in the list
    chips.push.apply(chips, dayChips(t));
    if (G.traderHere(S, t)) chips.push('<span class="good" data-act="goto" data-v="goods:coffers">The trader is in</span>');
    if (G.perksDue(S)) chips.push('<span class="good" data-act="goto" data-v="delve:">A boon to choose</span>');
    { const st = G.seasonState(S, t); chips.push(`<span data-act="season">${esc(st.name.split(' ')[0])} · step ${st.tier}/${st.tiers}</span>`); }
    { const dow = new Date().getDay(), due = (dow === 0 && new Date().getHours() >= 16) || dow === 1; chips.push(`<span class="${due && S.reviewSeen !== G.weekStart(t) ? 'good' : ''}" data-act="review" data-v="${dow === 1 ? 'last' : ''}">Week in review</span>`); }
    const omens = `<div class="chips">${chips.join('')}</div>`;
    return `<div class="daybar"><div><div class="d">${now.toLocaleDateString('en-AU', { weekday: 'long' }).toUpperCase()}</div><div class="s">${now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })} · ${todayLog.length} deeds · +${todayLog.reduce((a, e) => a + e.x, 0)} XP</div></div>
      <div class="n">${dd}/${dailies.length}<small>dailies</small></div></div>${omens}
      ${heraldBand()}${delveBand()}
      ${todayList(t, dailies, letOff, habits, todos, resting)}${hiddenStrip(t)}`;
  }

  function viewAll() {
    const t = G.today();
    const grp = (type) => S.quests.filter((q) => q.type === type && !q.archived);
    const block = (title, list) => (list.length ? `<div class="hd">${title}<small>${list.length}</small></div>` + list.map((q) => questRow(q, t, 'all')).join('') : '');
    return `<div class="btns" style="margin:4px 0 2px"><button class="btn" data-act="lib-open">📜 The quest library · ${G.libraryCount()} ideas</button></div>` + block('Dailies', grp('daily')) + block('Habits', grp('habit')) + block('To-dos', grp('todo').filter((q) => !q.doneOn)) +
      block('Finished to-dos', grp('todo').filter((q) => q.doneOn)) + block('Archived', S.quests.filter((q) => q.archived)) +
      (S.quests.length ? '' : '<div class="empty">No quests. Tap + to forge one.</div>');
  }

  function doComplete(id, btn, min) {
    const t = G.today();
    const q = G.findQ(S, id);
    if (!q) return;
    const before = G.statVal(S.stats[q.stat]);
    const r = G.complete(S, id, t, Date.now(), min ? { min: true } : null);
    if (!r) return;
    calWrite(S.log[0]); Sfx.play(r.levels > 0 ? 'level' : r.min ? 'min' : 'tick');
    const came = G.callingsCheck(S), wand = r.levels > 0 ? G.wanderersCheck(S) : [];
    save();
    if (came.length) setTimeout(() => companionsArrived(came), r.levels > 0 ? 2600 : 1400);
    if (wand.length) setTimeout(() => wanderersArrived(wand), 4200);
    buzz(1);
    floatText(btn, `+${r.xp}`);
    const after = G.statVal(S.stats[r.stat]);
    let msg = `${r.min ? 'The minimum counts. ' : ''}+${r.xp} XP · +${r.gold} gold · ${SI[r.stat].name}`;
    if (after > before) msg = `${SI[r.stat].name} rises to ${G.statTotal(S, r.stat, G.penalties(S, H()))}`;
    // a companion's calling: progress if they're on their way, their short buff if they're here
    G.CALLING_ORDER.forEach((k) => {
      const C = G.CALLINGS[k], n = S.npcs.find((x) => x.comp === k);
      if (!n || C.stat !== r.stat) return;
      const st = G.callingState(S, k);
      msg += n.status === 'resident' ? ` · ${n.name}: ${C.short}` : ` · ${C.title}: ${st.thisWeek}/${st.days} this week, ${st.streak}/${st.need} weeks`;
    });
    render();
    toast(msg, () => { calUnwrite(id, t); G.undo(S, id, t); save(); render(); toast('Undone.'); });
    if (r.levels > 0) setTimeout(() => showLevelUp(r), 420);
    else if (!came.length && !wand.length) setTimeout(() => maybeHideOffer(id), 1400);   // 2.27
  }
  function undoPrompt(id) {
    const q = G.findQ(S, id);
    if (!q) return;
    confirmBox('Undo?', `Takes back the XP and gold from “${esc(q.name)}”.`, 'Undo', () => {
      calUnwrite(id, G.today());
      if (G.undo(S, id, G.today())) { save(); render(); toast('Undone.'); } else toast('Nothing from today to undo.');
    });
  }

  // ---------- quest editor ----------
  // ---------- the quest library ----------
  const haveQuest = (name) => S.quests.find((q) => q.name.toLowerCase() === name.toLowerCase());
  function libRhythm(d) {
    const o = d[5] || {};
    if (d[2] === 'daily') return 'daily';
    if (d[2] === 'todo') return 'once';
    return o.rest > 1 ? restWord(o.rest) : o.cap > 1 ? 'up to ' + o.cap + ' a day' : 'any day';
  }
  function openLibrary() {
    const L = UI.lib || (UI.lib = { open: null, q: '', hidden: false });
    const hid = S.libHidden || [], find = L.q.trim().toLowerCase();
    let h = `<h3>The quest library</h3><p class="lore" style="margin-top:-4px">${G.libraryCount()} ordinary deeds. Add the ones that are yours, hide the ones that aren’t. Everything can be changed after.</p>
      <input class="field" id="lib-q" placeholder="Search: oven, tax, birds…" value="${esc(L.q)}">`;
    G.LIBRARY.forEach((c) => {
      let items = c.items.filter((d) => L.hidden || hid.indexOf(d[0]) < 0);
      if (find) items = items.filter((d) => d[0].toLowerCase().indexOf(find) >= 0);
      if (find && !items.length) return;
      const mine = c.items.filter((d) => haveQuest(d[0])).length, open = find || L.open === c.k;
      h += `<div class="libc ${open ? 'open' : ''}" data-m="lib-cat" data-v="${c.k}"><span>${c.i} ${esc(c.n)}</span><small>${mine ? mine + ' yours · ' : ''}${items.length}</small></div>`;
      if (!open) return;
      h += items.map((d) => {
        const q = haveQuest(d[0]), gone = hid.indexOf(d[0]) >= 0, k = esc(c.k + '|' + d[0]);
        return `<div class="row lib ${gone ? 'gone' : ''}" style="--c:var(--${d[3]})"><div class="ri">${d[1]}</div><div class="rb"><div class="rn">${esc(d[0])}</div><div class="rs"><span class="st">${SI[d[3]].short}</span> · +${DIFF[d[4] - 1].xp} · ${libRhythm(d)}</div></div>
          ${q ? `<span class="dim" style="font:italic 14px var(--gar)">${q.archived ? 'archived' : 'yours'}</span>` : `<button class="btn small" data-m="lib-hide" data-k="${k}" aria-label="${gone ? 'Show' : 'Hide'}">${gone ? '↺' : '✕'}</button><button class="btn small prime" data-m="lib-add" data-k="${k}">Add</button>`}</div>`;
      }).join('') || '<div class="empty">All hidden.</div>';
    });
    h += `<div class="btns">${hid.length ? `<button class="btn small" data-m="lib-hidden">${L.hidden ? 'Put the hidden away' : 'Show hidden (' + hid.length + ')'}</button>` : ''}<button class="btn" data-m="lib-own">Write my own</button><button class="btn prime" data-m="close">Done</button></div>`;
    const keep = $('#modal .sheet') && UI.sheet === 'library' ? $('#modal .sheet').scrollTop : 0;
    openSheet(h, 'library');
    const sh = $('#modal .sheet'); if (sh && keep) sh.scrollTop = keep;
    const inp = $('#lib-q');
    if (inp) inp.addEventListener('input', () => { L.q = inp.value; clearTimeout(L.tm); L.tm = setTimeout(() => { openLibrary(); const i2 = $('#lib-q'); if (i2) { i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); } }, 250); });
  }
  function libFind(key) { const i = key.indexOf('|'), c = G.LIBRARY.find((x) => x.k === key.slice(0, i)); return c ? c.items.find((d) => d[0] === key.slice(i + 1)) : null; }
  // ---------- 2.25: "it's been too long" ----------
  // The phone's own record of its note (pings, and snoozes from its buttons); the later date wins (G.remindState).
  function rmMarks() { try { return (N && N.remindMarks && JSON.parse(N.remindMarks() || '{}')) || {}; } catch (e) { return {}; } }
  const dWord = (n) => n + (n === 1 ? ' day' : ' days');
  const repWord = (r) => (r ? (r === 1 ? 'then daily' : r === 7 ? 'then weekly' : 'then every ' + r + ' days') : 'just once');
  const fmtEvery = (x) => (Math.round(x * 10) / 10).toString();
  function openOverdue() {
    const t = G.today(), all = G.remindList(S, t, rmMarks()), over = all.filter((x) => x.over && !x.snoozed).sort((a, b) => b.gap - a.gap);
    const snz = all.filter((x) => x.snoozed), soon = all.filter((x) => !x.over).sort((a, b) => a.left - b.left);
    const row = (x, kind) => {
      const q = x.q, can = G.canComplete(q, t);
      const sub = kind === 'over' ? `${dWord(x.gap)} · reminds at ${x.d}, ${repWord(x.rep)}` : kind === 'snz' ? `${dWord(x.gap)} · snoozed until ${dShort(x.snz)}` : `${x.left ? dWord(x.left) + ' to go' : 'due today'} · ${x.done ? 'last done ' + dShort(x.done) : 'not done since ' + dShort(x.last)}`;
      return `<div class="od-row ${kind}"><button class="od-n" data-m="od-edit" data-k="${q.id}"><span class="ic">${esc(q.icon)}</span><span><b>${esc(q.name)}</b><small>${sub}</small></span></button>
        <div class="od-b">${kind === 'over' ? `${can ? `<button class="btn tiny" data-m="od-do" data-k="${q.id}">✓</button>` : ''}<button class="btn tiny" data-m="od-snz" data-k="${q.id}" data-v="1">1d</button><button class="btn tiny" data-m="od-snz" data-k="${q.id}" data-v="3">3d</button>` : ''}</div></div>`;
    };
    const on = S.settings.overdue !== false;
    openSheet(`<h3>Been too long</h3>
      <p class="lore" style="font-size:15px;margin-top:0">${G.remindCount(S)} of ${G.REMIND_MAX} reminders on. ${on ? `One note a day, from ${G.hm(S.settings.overdueHour * 60)}, never in a shift.` : 'The daily note is off (Settings).'} Set them on each quest’s card.</p>
      ${over.length ? `<div class="hd">Overdue<small>${over.length}</small></div>${over.map((x) => row(x, 'over')).join('')}` : '<div class="empty">Nothing overdue.</div>'}
      ${snz.length ? `<div class="hd">Snoozed<small>${snz.length}</small></div>${snz.map((x) => row(x, 'snz')).join('')}` : ''}
      ${soon.length ? `<div class="hd">Keeping an eye on<small>${soon.length}</small></div>${soon.map((x) => row(x, 'soon')).join('')}` : ''}
      <div class="btns"><button class="btn" data-m="close">Close</button></div>`, 'overdue');
    if (N && N.overdueSeen) { try { N.overdueSeen(); } catch (e) { /* fine */ } }
  }
  // 2.25: something with a rhythm has slipped well past it: offer a reminder set to the suggestion
  function openSlip(id) {
    const t = G.today(), so = G.slipOffers(S, t).find((x) => x.id === id);
    if (!so) { toast('That one’s back on track.'); render(); return; }
    openSheet(`<h3>${esc(so.q.icon)} ${esc(so.q.name)} has slipped</h3>
      <p class="lore" style="margin-top:0">You usually do it every ${fmtEvery(so.every)} day${so.every === 1 ? '' : 's'}. It’s been ${dWord(so.gap)}.</p>
      <p class="lore">A reminder would put it in the daily note once it’s gone ${dWord(so.n)} undone, just once each time it slips. You can change that on its card. ${G.remindCount(S)} of ${G.REMIND_MAX} on.</p>
      <div class="btns"><button class="btn" data-m="slip-no" data-k="${so.id}">Not this one</button><button class="btn prime" data-m="slip-yes" data-k="${so.id}" data-v="${so.n}">Remind me at ${so.n}</button></div>`, 'slip');
  }
  function remindOn(id, n) {
    const err = G.remindSet(S, id, true, n, 0, G.today());
    if (err) { toast(err + '.'); return false; }
    save(); const q = G.findQ(S, id);
    toast(`Reminder on: ${q.name}, after ${dWord(q.remind.d)} undone. Change it on its card.`);
    return true;
  }
  // 2.25.2: a number of days, typed or stepped (a day or a week a tap)
  const numPick = (id, val, act) => `<div class="numpick"><button data-m="${act}" data-v="-7">−7</button><button data-m="${act}" data-v="-1">−</button><input class="field" type="number" inputmode="numeric" id="${id}" value="${val}" min="1" max="365"><span>days</span><button data-m="${act}" data-v="1">+</button><button data-m="${act}" data-v="7">+7</button></div>`;
  const restPreset = (n) => REST_OPTS.some((o) => o[0] === (n | 0));
  function remindBlock(e) {
    const q = e.id != null ? G.findQ(S, e.id) : null, sg = q ? G.remindSuggest(S, q) : null, r = e.remind, n = G.remindCount(S) - (q && q.remind ? 1 : 0) + (r ? 1 : 0);
    const said = sg ? `You’ve done it about every ${fmtEvery(sg.every)} day${sg.every === 1 ? '' : 's'} lately (the last ${sg.times} times).` : '';
    const cycle = e.type === 'habit' && (e.rest | 0) > 1 ? (e.rest | 0) : 0;
    let x = `<div class="lbl">Remind me<small>if it’s been too long · ${n} of ${G.REMIND_MAX} on</small></div>
      <div class="set"><div class="l">${r ? 'On' : 'Off'}<small>${r ? 'One note a day lists everything overdue. Logging it any way (here, the widget, the calendar) resets the clock.' : sg ? said + ' A reminder at ' + sg.n + ' would fit.' : cycle ? 'It comes round every ' + cycle + ' days. A reminder at ' + cycle + ' would catch it if it slips past.' : 'For the things you want to keep an eye on.'}</small></div><button class="toggle ${r ? 'on' : ''}" data-m="e-rem"></button></div>`;
    if (!r) return x;
    x += `<div class="lbl">If not done in</div>${numPick('e-rem-n', r.d, 'e-rem-d')}`;
    // 2.25.3: set up part-way through a cycle: when was it last done? (the clock counts from here, not from today)
    if (e.type !== 'todo') { const known = q && S.qlast && S.qlast[q.id], shown = e.remLast || known || ''; x += `<div class="set"><div class="l">Last done<small>${known ? 'From the log. Done since and not logged? Set the day.' : 'Done before you set this up? Set the day, or it counts from today.'}</small></div><input class="field" style="width:auto;margin:0" type="date" id="e-rem-last" value="${shown}" max="${G.today()}"></div>`; }
    if (sg) x += `<div class="lore" style="font-size:14.5px;margin:2px 0 6px">${said} ${sg.n === r.d ? 'That’s about right.' : `Suggested: ${sg.n}. <button class="btn tiny" data-m="e-rem-use" data-v="${sg.n}">Use ${sg.n}</button>`}</div>`;
    else x += `<div class="lore" style="font-size:14.5px;margin:2px 0 6px">${cycle ? `It comes round every ${cycle} days. ${cycle === r.d ? 'The reminder matches.' : `<button class="btn tiny" data-m="e-rem-use" data-v="${cycle}">Use ${cycle}</button>`}` : 'Not enough history yet to suggest a number; it learns from the last dozen times you do it.'}</div>`;
    x += `<div class="lbl">After the first note</div><div class="seg">${[[0, 'Just once'], [1, 'Daily'], [2, '2 days'], [3, '3 days'], [7, 'Weekly']].map((o) => `<button class="${(r.rep | 0) === o[0] ? 'on' : ''}" data-m="e-rem-rep" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
    return x;
  }
  function openEditor(id) {
    const q = id != null ? G.findQ(S, id) : null;
    UI.edit = q ? JSON.parse(JSON.stringify(q)) : { id: null, name: '', icon: '⚔️', type: 'daily', stat: 'DIS', diff: 2, days: [1, 1, 1, 1, 1, 1, 1], cap: 1, archived: false, home: null, aliases: [] };
    UI.awHold = false; UI.awDate = false;
    UI.sheet = null;
    renderEditor();
  }
  const REST_OPTS = [[0, 'Any day'], [2, '2 days'], [3, '3 days'], [7, 'Weekly'], [14, 'Fortnightly'], [30, 'Monthly'], [90, 'Quarterly'], [180, 'Twice a year'], [365, 'Yearly']];
  const restWord = (n) => { const o = REST_OPTS.find((x) => x[0] === (n | 0)); return o ? o[1].toLowerCase() : 'every ' + n + ' days'; };
  function buffWord(q) {
    const qb = G.questBuff(q, q.stat, Math.max(0, (q.diff | 0) - 1)), B = qb.type && G.BUFFS[qb.type];
    return B ? B.i + ' ' + B.n : '∅ No buff, just XP';
  }
  function renderEditor() {
    const e = UI.edit;
    const help = { daily: 'Once a day, on the days you choose. Resets at midnight.', habit: 'Whenever you do it. A daily cap stops the farming.', todo: 'Once. Done is done.' }[e.type];
    const homeOpts = [[null, 'Nothing']].concat(Object.keys(G.HOME).map((k) => [k, k === 'reno' ? 'Restoration' : G.AFFLICT[k].name]));
    openSheet(`<h3>${e.id == null ? 'New quest' : 'Edit quest'}</h3>
      ${e.id == null ? `<div class="btns" style="margin:0 0 10px"><button class="btn" data-m="lib-open">📜 Pick from the library · ${G.libraryCount()} ideas</button></div>` : ''}
      <div class="name-row"><input class="field ic" id="e-icon" value="${esc(e.icon)}" maxlength="8"><input class="field" id="e-name" placeholder="e.g. Swim 1km" value="${esc(e.name)}" maxlength="80"></div>
      <div class="lbl">The herald also knows it as<small>other wordings, comma-separated</small></div><input class="field" id="e-alias" placeholder="e.g. pool session, laps" value="${esc((e.aliases || []).join(', '))}">
      <div class="lbl">The bare minimum<small>optional. On a bad day this counts, for half</small></div><input class="field" id="e-min" placeholder="e.g. ten push-ups, one page" value="${esc(e.min || '')}" maxlength="60">
      <div class="emojis">${EMOJI.map((x) => `<button class="${x === e.icon ? 'on' : ''}" data-m="e-emoji" data-v="${x}">${x}</button>`).join('')}</div>
      <div class="lbl">Type</div>
      <div class="seg">${[['daily', 'Daily'], ['habit', 'Habit'], ['todo', 'To-do']].map((x) => `<button class="${e.type === x[0] ? 'on' : ''}" data-m="e-type" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
      <div class="lore" style="font-size:14.5px;margin-top:6px">${help}</div>
      ${e.type === 'daily' ? `<div class="lbl">Days</div><div class="days">${DAYS.map((d, i) => `<button class="${e.days[i] ? 'on' : ''}" data-m="e-day" data-v="${i}">${d}</button>`).join('')}</div>` : ''}
      
      ${e.type === 'daily' && S.settings.rosterCal ? (() => { const lk = e.id != null ? G.longKeep(S, G.findQ(S, e.id) || e, G.today()) : null; return `<div class="set"><div class="l">Needed even on a long shift<small>${lk && !e.core ? 'Kept on them anyway, from your history (below)' : 'Otherwise it is let off on those days'}</small></div><button class="toggle ${e.core ? 'on' : ''}" data-m="e-core"></button></div>`
        + (lk && !e.core ? `<div class="set"><div class="l">Kept on long days: you did it on ${lk.done} of your last ${lk.of}<small>${e.longOff ? 'Let off anyway' : 'Turn off to let it off on them'}</small></div><button class="toggle ${e.longOff ? '' : 'on'}" data-m="e-longoff"></button></div>` : ''); })() : ''}
      ${judgedBlock(e)}
      ${e.type === 'habit' || e.type === 'daily' ? (() => { const custom = e.restCustom || !restPreset(e.rest); return `<div class="lbl">Comes round<small>after each go it’s hidden this long, then turns up again</small></div><div class="pills">${REST_OPTS.map((o) => `<button class="pill ${!custom && (e.rest | 0) === o[0] ? 'on' : ''}" data-m="e-rest" data-v="${o[0]}">${o[1]}</button>`).join('')}<button class="pill ${custom ? 'on' : ''}" data-m="e-rest-custom">Every…</button></div>${custom ? numPick('e-rest-n', e.rest | 0 || 35, 'e-rest-step') : ''}`; })() : ''}
      ${e.id != null ? `<div class="lbl">On the delve</div><div class="pills"><button class="pill" data-m="e-buff">${buffWord(e)} ›</button></div>` : ''}
      <div class="lbl">Keeps up</div>
      <div class="pills">${homeOpts.map((o) => `<button class="pill ${e.home === o[0] ? 'on' : ''}" data-m="e-home" data-v="${o[0] || ''}">${o[1]}</button>`).join('')}</div>
      ${remindBlock(e)}
      ${awayBlock(e)}
      <div class="btns">${e.id != null ? `<button class="btn small" data-m="e-archive">${e.archived ? 'Restore' : 'Archive'}</button><button class="btn small blood" data-m="e-delete">Delete</button>` : '<button class="btn" data-m="close">Cancel</button>'}<button class="btn prime" data-m="e-save">Save</button></div>`, 'editor');
  }
  function saveEditor() {
    const e = UI.edit;
    e.name = ($('#e-name').value || '').trim();
    e.icon = ($('#e-icon').value || '').trim() || '•';
    e.aliases = ($('#e-alias') ? $('#e-alias').value : (e.aliases || []).join(',')).split(',').map((a) => a.trim()).filter(Boolean);
    if (!e.name) { toast('Name it first.'); return; }
    if (e.type === 'daily' && !e.days.some(Boolean)) { toast('Pick at least one day.'); return; }
    e.min = $('#e-min') ? $('#e-min').value : e.min || '';
    const lastDone = (id) => { if (!e.remind || !e.remLast) return; if (!S.qlast) S.qlast = {}; if (!S.qlast[id] || S.qlast[id] < e.remLast) S.qlast[id] = e.remLast; const h = (S.qhist = S.qhist || {})[id] || (S.qhist[id] = []); if (h.indexOf(e.remLast) < 0) { h.push(e.remLast); h.sort(); } };
    let judge = null;
    if (e.id == null) {
      const j = e.judged === 'library' ? { stat: e.stat, diff: e.diff, cap: e.cap, src: 'library' } : G.judgeRules(e);   // 2.27: judged, not chosen
      const nq = G.newQuest(S, Object.assign({}, e, { stat: j.stat, diff: j.diff, cap: e.type === 'habit' ? j.cap : e.cap }));
      nq.aliases = e.aliases; nq.judged = j.src; if (j.why) nq.judgedWhy = j.why;
      if (e.remind) nq.remind = Object.assign({}, e.remind, { from: G.today() }); G.normQuest(nq); S.quests.push(nq); lastDone(nq.id);
      if (j.src !== 'library') judge = nq.id;
    } else {
      const q = G.findQ(S, e.id);
      if (!q) return closeModal();
      const typeChanged = q.type !== e.type, renamed = q.name.trim().toLowerCase() !== e.name.trim().toLowerCase();
      Object.assign(q, { name: e.name, icon: e.icon, type: e.type, min: e.min || '', core: !!e.core, longOff: !!e.longOff, days: e.days.slice(), rest: e.type === 'habit' || e.type === 'daily' ? e.rest | 0 : 0, archived: !!e.archived, home: e.home || null, aliases: e.aliases });
      if (typeChanged) { q.doneOn = null; q.count = 0; q.countOn = null; }
      if (e.remind) q.remind = Object.assign({}, e.remind, { from: q.remind ? q.remind.from : G.today() }); else delete q.remind;
      lastDone(q.id);
      // a new name or type is a new thing to judge (or "Run" renamed "Drink water" keeps a hard run's pay)
      if (renamed || typeChanged) { const j = G.judgeRules(q); Object.assign(q, { stat: j.stat, diff: j.diff, cap: q.type === 'habit' ? j.cap : q.cap, judged: j.src, judgedWhy: j.why }); if (j.src !== 'library') judge = q.id; }
      G.normQuest(q);
    }
    save(); closeModal(); render();
    if (judge != null) { if (hasKey()) judgeQuest(judge, '', false); else { const jq = G.findQ(S, judge); toast(`Judged by the rules: ${DIFF[jq.diff - 1].name} · ${SI[jq.stat].name}. Connect the AI helper and the Oracle judges instead.`); } }
  }

  // ---------- vows & trials ----------
  function filterText(f) {
    if (!f || f.type === 'any') return 'any quest';
    if (f.type === 'quest') { const q = G.findQ(S, f.id); return q ? `“${q.name}”` : 'a lost quest'; }
    if (f.type === 'home') return f.home === 'reno' ? 'restoration' : `${G.AFFLICT[f.home].name.toLowerCase()} deeds`;
    return f.stat === 'TRAIN' ? 'training quests' : `${SI[f.stat].name} quests`;
  }
  function goalRow(g, trial) {
    const t = G.today(), st = G.goalState(g, t);
    const pct = g.kind === 'manual' ? (g.done ? 100 : 0) : Math.min(100, (g.progress / g.target) * 100);
    const mover = trial ? null : S.npcs.find((n) => n.via && n.via.type === 'vow' && n.via.vow === g.id);
    const reward = trial ? `${g.gold} gold${g.chest ? ' + coffer' : ''}` : [g.reward && g.reward.text, g.reward && g.reward.gold ? `${g.reward.gold} gold` : '', g.reward && g.reward.chest ? 'a coffer' : '', mover ? mover.name + (mover.status === 'resident' ? ' moved in' : ' moves in') : ''].filter(Boolean).join(' · ');
    const left = st === 'done' ? 'Done' : st === 'lapsed' ? 'Missed' : g.kind === 'manual' ? 'Mark it when done' : `${g.progress} / ${g.target}`;
    const right = g.end && st === 'open' ? (g.end === t ? 'ends today' : `until ${new Date(g.end + 'T00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`) : '';
    return `<div class="trial ${st}${trial && g.bonus ? ' extra' : ''}" data-act="${trial ? 'trial' : 'vow'}" data-id="${g.id}"><div class="tt2"><div class="tn">${esc(g.title)}${trial && g.bonus ? ' <small class="xt">extra</small>' : ''}</div>${trial ? `<div class="tr">${esc(reward)}</div>` : ''}</div>
      ${!trial && reward ? `<div class="rw">Reward: ${esc(reward)}</div>` : ''}
      ${trial ? `<div class="lore">${esc(g.lore)}</div>` : `<div class="lore">${g.kind === 'manual' ? 'A deed you will mark yourself.' : `Complete ${filterText(g.filter)} ${g.target} time${g.target > 1 ? 's' : ''}.`}</div>`}
      <div class="pb"><i style="width:${pct}%"></i></div><div class="meta"><span>${left}</span><span>${trial && st === 'open' ? `<button class="btn tiny" data-act="wk-swap" data-id="${g.id}">Swap · ${G.weeklyCost(S) ? '◈ ' + G.weeklyCost(S) : 'free'}</button>` : right}</span></div></div>`;
  }
  function viewVows() {
    const tr = S.trials;
    const active = S.goals.filter((g) => !g.done && G.goalState(g, G.today()) === 'open');
    const past = S.goals.filter((g) => g.done || G.goalState(g, G.today()) !== 'open').slice(-8).reverse();
    const core = tr.list.filter((g) => !g.bonus), nx = G.weeklyNext(S);
    return `<div class="hd">Weeklies<small>${tr.source === 'oracle' ? 'picked by ' + esc(tr.by || 'Claude') : 'new each Monday'}</small></div>
      ${tr.list.map((g) => goalRow(g, true)).join('')}
      <div class="oracle-note">${tr.bonus ? `The first ${core.length} are done. A coffer is in the hall.` : `Do the first ${core.length} for a coffer.`}${tr.list.length > core.length ? ' Extras cost nothing to leave.' : ''}${nx ? ` Another offer opens at ${nx}.` : ''}</div>
      ${hasKey() ? `<div class="btns"><button class="btn" data-act="oracle">Ask the Oracle to pick</button></div>` : ''}
      ${marksBlock()}
      <div class="hd">Goals<small>ones you set yourself</small></div>
      ${active.map((g) => goalRow(g, false)).join('') || '<div class="empty">No goals set.</div>'}
      <div class="btns"><button class="btn prime" data-act="new-vow">Set a goal</button></div>
      ${past.length ? '<div class="hd">Past goals</div>' + past.map((g) => goalRow(g, false)).join('') : ''}`;
  }

  function openVowEditor(id) {
    const g = id != null ? S.goals.find((x) => x.id === id) : null;
    UI.edit = g ? JSON.parse(JSON.stringify(g)) : { id: null, title: '', kind: 'count', filter: { type: 'stat', stat: 'TRAIN' }, target: 5, window: 'none', end: null, reward: { text: '', gold: 0, chest: false } };
    if (g) UI.edit.window = g.end ? (g.end === G.addDays(G.weekStart(G.today()), 6) ? 'week' : 'date') : 'none';
    UI.sheet = null;
    renderVowEditor();
  }
  function filterKey(f) { return !f ? 'any:' : f.type === 'quest' ? 'quest:' + f.id : f.type === 'home' ? 'home:' + f.home : f.type === 'stat' ? 'stat:' + f.stat : 'any:'; }
  function renderVowEditor() {
    const e = UI.edit, existing = e.id != null;
    const opts = [['any:', 'Any quest'], ['stat:TRAIN', 'Training (Strength or Endurance)']].concat(STATS.map((k) => ['stat:' + k, SI[k].name + ' quests']))
      .concat(Object.keys(G.AFFLICT).filter((k) => G.HOME[k]).map((k) => ['home:' + k, `Hearth: ${G.AFFLICT[k].name}`]))
      .concat(S.quests.filter((q) => !q.archived).map((q) => ['quest:' + q.id, `${q.icon} ${q.name}`]));
    const fk = filterKey(e.filter);
    openSheet(`<h3>${existing ? 'Your goal' : 'Set a goal'}</h3>
      <input class="field" id="v-title" placeholder="e.g. Swim 300m in under five minutes" value="${esc(e.title)}" maxlength="60" ${existing ? 'disabled' : ''}>
      ${existing ? '' : `<div class="lbl">How is it measured</div><div class="seg"><button class="${e.kind === 'count' ? 'on' : ''}" data-m="v-kind" data-v="count">Count quests</button><button class="${e.kind === 'manual' ? 'on' : ''}" data-m="v-kind" data-v="manual">I’ll mark it</button></div>`}
      ${e.kind === 'count' && !existing ? `<div class="lbl">What counts</div><select class="field" id="v-filter">${opts.map((o) => `<option value="${esc(o[0])}" ${o[0] === fk ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>
        <div class="lbl">How many times</div><div class="stepper"><button data-m="v-target" data-v="-1">−</button><span>${e.target}</span><button data-m="v-target" data-v="1">+</button></div>` : ''}
      ${!existing ? `<div class="lbl">By when</div><div class="seg"><button class="${e.window === 'week' ? 'on' : ''}" data-m="v-win" data-v="week">This week</button><button class="${e.window === 'date' ? 'on' : ''}" data-m="v-win" data-v="date">A date</button><button class="${e.window === 'none' ? 'on' : ''}" data-m="v-win" data-v="none">No limit</button></div>
        ${e.window === 'date' ? `<input class="field" style="margin-top:8px" type="date" id="v-date" min="${G.today()}" value="${e.end || G.addDays(G.today(), 30)}">` : ''}` : ''}
      <div class="lbl">Your reward</div>
      <input class="field" id="v-reward" placeholder="e.g. New goggles" value="${esc(e.reward.text)}" maxlength="60" ${existing ? 'disabled' : ''}>
      ${existing ? '' : `<div class="pills" style="margin-top:8px">${S.rewards.map((r) => `<button class="pill" data-m="v-rpick" data-v="${esc(r.name)}">${esc(r.icon)} ${esc(r.name)}</button>`).join('')}</div>
      <div class="set"><div class="l">Gold and a coffer<small>${hasKey() ? 'the Oracle sets the bounty when you set the goal' : 'set by the rules when you set the goal: what it asks, and how fast'}</small></div></div>
      ${(() => { const w = S.npcs.filter((n) => n.status === 'waiting' && n.via.type === 'vow' && (n.via.vow == null || !S.goals.some((g) => g.id === n.via.vow && !g.done))); return w.length ? `<div class="lbl">Someone moves in</div><select class="field" id="v-npc"><option value="">No one</option>${w.map((n) => `<option value="${esc(n.id)}" ${e.npc === n.id ? 'selected' : ''}>${esc(n.name)}</option>`).join('')}</select>` : '<p class="lore" style="font-size:14px;margin-top:8px">Want someone to move in as the reward? Design them in Hearth › Household first.</p>'; })()}`}
      <div class="btns">${existing ? `<button class="btn blood" data-m="v-delete">Drop it</button>${!e.done && e.kind === 'manual' ? '<button class="btn prime" data-m="v-fulfil">Done it</button>' : ''}` : '<button class="btn" data-m="close">Cancel</button><button class="btn prime" data-m="v-save">Set it</button>'}</div>`, 'vow');
  }
  function syncVowInputs() {
    const e = UI.edit;
    if ($('#v-title')) e.title = $('#v-title').value;
    if ($('#v-reward')) e.reward.text = $('#v-reward').value;
    if ($('#v-filter')) {
      const [type, v] = $('#v-filter').value.split(':');
      e.filter = type === 'quest' ? { type, id: Number(v) } : type === 'stat' ? { type, stat: v } : type === 'home' ? { type, home: v } : { type: 'any' };
    }
    if ($('#v-date')) e.end = $('#v-date').value || null;
    if ($('#v-npc')) e.npc = $('#v-npc').value || null;
  }
  function saveVow() {
    syncVowInputs();
    const e = UI.edit, t = G.today();
    e.title = (e.title || '').trim();
    if (!e.title) { toast('Name the goal.'); return; }
    let end = null;
    if (e.window === 'week') end = G.addDays(G.weekStart(t), 6);
    if (e.window === 'date') { end = e.end; if (!end || end < t) { toast('Pick a date from today on.'); return; } }
    const gid = G.nextId(S);
    const mover = e.npc && S.npcs.find((n) => n.id === e.npc);
    if (mover) mover.via = { type: 'vow', vow: gid };
    const jr = G.judgeGoalRules({ kind: e.kind, target: e.kind === 'count' ? e.target : 1, end: end }, t);   // 2.27: judged, not chosen
    S.goals.push({ id: gid, kind: e.kind, title: e.title.slice(0, 60), filter: e.kind === 'count' ? e.filter : null, target: e.kind === 'count' ? e.target : 1,
      start: t, end, progress: 0, since: Date.now(), done: null, created: t, reward: { text: (e.reward.text || '').trim().slice(0, 60), gold: jr.gold, chest: jr.chest }, judged: jr.src, judgedWhy: jr.why });
    save(); closeModal(); render(); toast(hasKey() ? 'Goal set. The Oracle is weighing the bounty.' : `Goal set: ${jr.gold} gold${jr.chest ? ' and a coffer' : ''} when you get there.`);
    judgeReward('goal', gid);
  }
  // ---------- targets: a number to beat ----------
  const dShort = (d) => (d === G.today() ? 'today' : new Date(d + 'T00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }));
  function markSpark(m, w, h) {
    const L = m.log.slice(-24); if (!L.length) return '';
    const vs = L.map((a) => a.v).concat([m.target]), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), sp = hi - lo || 1;
    const y = (v) => (m.better === 'lower' ? (v - lo) / sp : 1 - (v - lo) / sp) * (h - 8) + 4;  // better is always up
    const x = (i) => (L.length === 1 ? w / 2 : 4 + (i * (w - 8)) / (L.length - 1));
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><line x1="0" x2="${w}" y1="${y(m.target)}" y2="${y(m.target)}" stroke="#d9ad45" stroke-width="1" stroke-dasharray="3 3"/>
      ${L.length > 1 ? `<polyline fill="none" stroke="#ece4cf" stroke-width="2" points="${L.map((a, i) => x(i) + ',' + y(a.v)).join(' ')}"/>` : ''}
      ${L.map((a, i) => `<rect x="${x(i) - 2}" y="${y(a.v) - 2}" width="4" height="4" fill="${G.markHit(m, a.v) ? '#d9ad45' : '#ece4cf'}"/>`).join('')}</svg>`;
  }
  function markRow(m) {
    const t = G.today(), best = G.markBest(m), left = m.by ? G.daysBetween(t, m.by) : null;
    const sub = m.done ? `Met ${dShort(m.done)}` : [best == null ? 'No attempts yet' : `Best ${G.markFmt(m, best)}`, left == null ? '' : left < 0 ? `${-left} days over` : left === 0 ? 'due today' : `${left} days left`].filter(Boolean).join(' · ');
    return `<div class="trial ${m.done ? 'done' : left != null && left < 0 ? 'lapsed' : ''}" data-act="mark" data-id="${m.id}"><div class="tt2"><div class="tn">${esc(m.name)}</div><div class="tr">${m.better === 'lower' ? 'under' : 'over'} ${G.markFmt(m, m.target)}</div></div>
      <div class="mkr">${markSpark(m, 150, 34)}<div class="lore">${esc(sub)}</div></div></div>`;
  }
  function marksBlock() {
    return `<div class="hd">Targets<small>a number to beat</small></div>${S.marks.map(markRow).join('') || '<div class="empty">Nothing to beat yet.</div>'}
      <div class="btns"><button class="btn" data-act="mark-new">Set a target</button></div>`;
  }
  function openMark(id) {
    const m = S.marks.find((x) => x.id === id); if (!m) return;
    const best = G.markBest(m), rw = [m.text, m.gold ? m.gold + ' gold' : '', m.chest ? 'a coffer' : ''].filter(Boolean).join(' · ');
    UI.sheet = null;
    openSheet(`<h3>${esc(m.name)}</h3>${markSpark(m, 300, 90)}
      <div class="kv"><span>Target</span><b>${m.better === 'lower' ? 'under' : 'over'} ${G.markFmt(m, m.target)}${m.by ? ' by ' + dShort(m.by) : ''}</b></div>
      <div class="kv"><span>Best</span><b>${G.markFmt(m, best)}${best != null && !m.done ? ` <small>(${G.markFmt(m, Math.abs(best - m.target))} to go)</small>` : ''}</b></div>
      ${rw ? `<div class="kv"><span>Reward</span><b style="font:500 15px var(--gar)">${esc(rw)}</b></div>` : ''}
      <div class="lbl">Log an attempt<small>${m.unit === 'time' ? 'minutes:seconds, e.g. 5:12' : 'a number'}</small></div>
      <div class="name-row"><input class="field" id="mk-v" inputmode="${m.unit === 'time' ? 'text' : 'decimal'}" placeholder="${m.unit === 'time' ? '5:12' : '0'}"><button class="btn prime" data-m="mk-log" data-id="${m.id}">Log</button></div>
      ${m.log.length ? `<div class="lbl">Attempts</div><div class="mklog">${m.log.slice(-12).reverse().map((a) => `<span class="${G.markHit(m, a.v) ? 'hit' : ''}">${dShort(a.d)} · ${G.markFmt(m, a.v)}</span>`).join('')}</div>` : ''}
      <div class="btns"><button class="btn small blood" data-m="mk-del" data-id="${m.id}">Delete</button>${m.log.length ? `<button class="btn small" data-m="mk-undo" data-id="${m.id}">Remove last</button>` : ''}<button class="btn" data-m="close">Close</button></div>`, 'mark');
  }
  function openMarkEditor() {
    if (!UI.mk) UI.mk = { name: '', unit: 'time', better: 'lower', target: '', by: '', gold: 100, chest: true, text: '' };
    const e = UI.mk, ideas = [['300 m beach swim', 'time', 'lower', '5:00'], ['Run-swim-run (100 m each)', 'time', 'lower', '5:00'], ['5 km run', 'time', 'lower', '30:00'], ['Push-ups in one go', 'num', 'higher', '30']];
    UI.sheet = null;
    openSheet(`<h3>Set a target</h3>
      <input class="field" id="mk-name" placeholder="e.g. 300 m beach swim" value="${esc(e.name)}" maxlength="60">
      <div class="pills" style="margin-top:8px">${ideas.filter((i) => !S.marks.some((m) => m.name === i[0])).map((i, n) => `<button class="pill" data-m="mk-idea" data-v="${esc(JSON.stringify(i))}">${esc(i[0])}</button>`).join('')}</div>
      <div class="lbl">Measured in</div><div class="seg"><button class="${e.unit === 'time' ? 'on' : ''}" data-m="mk-unit" data-v="time">Time</button><button class="${e.unit === 'num' ? 'on' : ''}" data-m="mk-unit" data-v="num">A number</button></div>
      <div class="lbl">Better is</div><div class="seg"><button class="${e.better === 'lower' ? 'on' : ''}" data-m="mk-better" data-v="lower">Lower</button><button class="${e.better === 'higher' ? 'on' : ''}" data-m="mk-better" data-v="higher">Higher</button></div>
      <div class="lbl">Target<small>${e.unit === 'time' ? 'minutes:seconds' : ''}</small></div><input class="field" id="mk-target" placeholder="${e.unit === 'time' ? '5:00' : '30'}" value="${esc(e.target)}">
      <div class="lbl">By when<small>optional</small></div><input class="field" type="date" id="mk-by" min="${G.today()}" value="${esc(e.by)}">
      <div class="lbl">Your reward<small>optional</small></div><input class="field" id="mk-text" placeholder="e.g. New goggles" value="${esc(e.text)}" maxlength="60">
      <div class="set"><div class="l">Gold and a coffer<small>${hasKey() ? 'the Oracle sets them when you set it, from the target and your best so far' : 'set by the rules when you set it'}</small></div></div>
      <div class="btns"><button class="btn" data-m="close">Cancel</button><button class="btn prime" data-m="mk-save">Set it</button></div>`, 'markedit');
  }
  function syncMark() { const e = UI.mk; if (!e) return; ['name', 'target', 'by', 'text'].forEach((k) => { const el = $('#mk-' + k); if (el) e[k] = el.value; }); }
  function saveMark() {
    syncMark(); const e = UI.mk, name = (e.name || '').trim();
    if (!name) { toast('Name it first.'); return; }
    const tv = G.markParse(e, e.target);
    if (tv == null || tv <= 0) { toast(e.unit === 'time' ? 'Give the target as minutes:seconds, like 5:00.' : 'Give the target as a number.'); return; }
    const jr = G.judgeGoalRules({ kind: 'mark' }), mid = G.nextId(S);   // 2.27: judged, not chosen
    S.marks.push({ id: mid, name: name, unit: e.unit, better: e.better, target: tv, by: e.by || null, log: [], done: null, gold: jr.gold, chest: jr.chest, text: (e.text || '').trim(), start: G.today() });
    G.marksNorm(S); UI.mk = null; save(); closeModal(); render();
    judgeReward('mark', mid);
  }
  function logMark(id) {
    const m = S.marks.find((x) => x.id === id); if (!m) return;
    const v = G.markParse(m, $('#mk-v') ? $('#mk-v').value : '');
    if (v == null) { toast(m.unit === 'time' ? 'Write it as minutes:seconds, like 5:12.' : 'Write it as a number.'); return; }
    const r = G.markLog(S, id, v, G.today(), Date.now());
    save(); buzz(r.hit ? 2 : 1); render(); UI.sheet = null; openMark(id);
    toast(r.hit ? `Target met: ${G.markFmt(m, v)}. ${[m.gold ? m.gold + ' gold' : '', m.chest ? 'a coffer' : ''].filter(Boolean).join(' and ') || 'Well done'}${m.text ? '. Go and claim: ' + m.text : ''}.` : r.pb ? `A new best: ${G.markFmt(m, v)}.` : `Logged ${G.markFmt(m, v)}.`);
  }

  function swapWeekly(id) {
    const cost = G.weeklyCost(S), err = G.weeklyReroll(S, Number.isNaN(+id) ? id : id, G.today(), Date.now());
    if (err) { toast(err); return; }
    buzz(0); Sfx.play('swap'); save(); closeModal(); render();
    toast(cost ? `Swapped for ${cost} gold. The next swap is ${G.weeklyCost(S)}.` : `Swapped. The next swap costs ${G.weeklyCost(S)} gold.`);
  }
  function showTrial(id) {
    const g = S.trials.list.find((x) => x.id === id);
    if (!g) return;
    UI.sheet = null;
    openSheet(`<h3>${esc(g.title)}</h3><p class="lore">${esc(g.lore)}</p><div class="kv"><span>Counts</span><b style="font:500 16px var(--gar)">${esc(filterText(g.filter))}</b></div>
      <div class="kv"><span>Progress</span><b>${g.progress} / ${g.target}</b></div><div class="kv"><span>Reward</span><b>${g.gold} gold${g.chest ? ' and a coffer' : ''}</b></div>
      ${g.since ? '<p class="lore">Swapped in this week: it counts from when it arrived.</p>' : ''}
      <div class="btns"><button class="btn" data-m="close">Close</button>${g.done ? '' : `<button class="btn prime" data-m="wk-swap" data-id="${g.id}">Swap · ${G.weeklyCost(S) ? '◈ ' + G.weeklyCost(S) : 'free'}</button>`}</div>`, 'trial');
  }

  // ---------- oracle (Claude) ----------
  function hasKey() { try { return N && N.hasOracleKey ? N.hasOracleKey() : !!localStorage.getItem('gs_oracle_key'); } catch (e) { return false; } }
  function setKey(k) { if (N && N.setOracleKey) N.setOracleKey(k); else if (k) localStorage.setItem('gs_oracle_key', k); else localStorage.removeItem('gs_oracle_key'); }
  window.__oracleDone = function (id, status, text) { const f = oracleCbs[id]; delete oracleCbs[id]; if (f) f(status, text); };
  // 2.26: through the shared AI connection when the phone has it (any provider); the page's own Claude call is for tests
  const AICBS = {};
  window.__aiDone = function (id, ok, text) { const f = AICBS[id]; delete AICBS[id]; if (f) f(ok, text); };
  function askAI(system, user, max, done) {
    if (N && N.aiAsk) { const id = 'a' + Date.now() + Math.random().toString(36).slice(2, 5); AICBS[id] = done; N.aiAsk(system, user, max, id); return; }
    callOracle({ model: S.settings.oracleModel || DEFAULT_MODEL, max_tokens: max, system: system, messages: [{ role: 'user', content: user }] }, (status, text) => {
      try { done(true, oracleText(status, text)); } catch (e) { done(false, e.message); }
    });
  }
  function callOracle(body, done) {
    const id = 'o' + Date.now() + Math.random().toString(36).slice(2, 5);
    oracleCbs[id] = done;
    if (N && N.oracle) { N.oracle(JSON.stringify(body), id); return; }
    fetch('https://api.anthropic.com/v1/messages', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-api-key': localStorage.getItem('gs_oracle_key') || '', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } })
      .then((r) => r.text().then((t) => window.__oracleDone(id, r.status, t)))
      .catch((e) => window.__oracleDone(id, -1, JSON.stringify({ error: { message: e.message } })));
  }
  function oracleText(status, text) {
    let j = null;
    try { j = JSON.parse(text); } catch (e) { j = null; }
    if (status !== 200) throw new Error((j && j.error && j.error.message) || `The request failed (${status}).`);
    return ((j && j.content) || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  }
  function consultOracle() {
    if (!hasKey()) { toast('Set up the AI helper in Settings first.'); return; }
    openDialog('<div class="rar" style="color:var(--gold)">THE ORACLE</div><p class="lore" style="margin-top:12px">ponders your deeds…</p>', 'oracle', true);
    const who = aiName();
    askAI(G.ORACLE_SYSTEM, 'Player data:\n' + JSON.stringify(G.oracleSummary(S, G.today())) + '\n\nSet this week’s three trials.', 1800, (ok, out) => {
      try {
        if (!ok) throw new Error(out || 'No answer');
        S.trials = G.parseOracle(S, out, G.today()); G.weeklyTopUp(S, G.today(), Date.now());
        S.trials.by = who;
        save(); closeModal(); goto('quests:vows');
        toast('The Oracle has spoken.');
      } catch (e) {
        UI.sheet = null;
        openDialog(`<h3>The Oracle is silent</h3><p>${esc(e.message)}</p><div class="btns"><button class="btn" data-m="close">Close</button></div>`, 'oracle-err');
      }
    });
  }
  function testOracle() {
    toast('Asking…');
    askAI('Reply with exactly the words asked for.', 'Reply with exactly: The Oracle hears you.', 60, (ok, out) => toast(ok ? (String(out).trim() || 'It answered, wordlessly.') : 'Didn’t work: ' + out));
  }


  // ================= HEARTH =================
  const HEARTH_ORDER = ['lawn', 'fridge', 'dishes', 'laundry', 'birds', 'aviary', 'gym', 'study'];
  function daysText(d) { return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; }
  function featDef(k) { return G.HOME[k] || G.HOME_AUTO[k]; }
  // The hearth: the house (its props carry the conditions: flies and stink where it's gone bad, sparkles where it's up to date),
  // who's home, and the estate.
  function viewHearth() {
    if (UI.visit) return viewVisit();
    const res = S.npcs.filter((n) => n.status === 'resident');
    const chip = (n) => `<div class="hh" data-act="npc" data-k="${esc(n.id)}"><canvas class="npcport" width="96" height="96" data-k="${esc(n.id)}"></canvas><div class="hn">${esc(n.name)}</div></div>`;
    let h = h3Slot() + `<div class="legend"><span>✨ up to date</span><span>🪰 due</span><span>💨 overdue</span></div>`;
    h += `<div class="omen" style="text-align:center"><span class="gl">◈ ${S.gold}</span> in the purse · <span class="gl">◈ ${S.estate.spent}</span> sunk into the estate</div>`;
    const vis = G.visitorsNow(S, G.today());   // 2.26: and whoever's visiting from the calendar
    const vchip = (v) => `<div class="hh" data-act="person" data-id="${esc(v.p.id)}"><canvas class="pport" width="96" height="96" data-p="${esc(v.p.id)}"></canvas><div class="hn">${v.ev && !v.lives ? G.EV_ICON[v.ev.kind] + ' ' : ''}${esc(v.p.name)}</div></div>`;
    if (res.length || vis.length) h += `<div class="hd">At home</div><div class="hhs">${res.map(chip).join('')}${vis.map(vchip).join('')}</div>`;
    h += `<div class="btns" style="margin:6px 0"><button class="btn small" data-act="hh-page">👥 Household and companions</button></div>`;
    G.ESTATE_AREAS.forEach((a) => {
      const keys = Object.keys(G.ESTATE).filter((k) => G.ESTATE[k].area === a[0]);
      if (keys.length) h += `<div class="hd">${esc(a[1])}</div>` + keys.map(estateRow).join('') + (a[0] === 'wings' ? landRow() : '');
    });
    return h;
  }

  // The 3D view at the top of both Hearth pages, with the preview bar when you're trying an upgrade on.
  function h3Slot() {
    const P = UI.preview;
    let bar = '';
    if (P && P.fin !== undefined) bar = finBar(P);
    else if (P) {
      const d = G.ESTATE[P.key], cur = G.estateTier(S, P.key), n = G.estateNext(S, P.key), isNext = !n.max && n.tier === P.tier;
      bar = `<div class="h3-prev"><button class="pv" data-act="pv-step" data-v="-1" ${P.tier <= 0 ? 'disabled' : ''} aria-label="Previous tier">‹</button>
        <div class="pvb"><div class="pvn">${esc(d.tiers[P.tier])}</div><div class="pvs">${d.icon} ${esc(d.name)} · ${P.tier + 1} of 6${P.tier === cur ? ' · yours' : ''}</div></div>
        <button class="pv" data-act="pv-step" data-v="1" ${P.tier >= 5 ? 'disabled' : ''} aria-label="Next tier">›</button>
        ${isNext ? `<button class="btn small prime" data-act="estate-buy" data-k="${P.key}" ${n.ok ? '' : 'disabled'}>◈ ${n.cost}</button>` : ''}
        <button class="btn small" data-act="pv-done">Done</button></div>`;
    }
    return `<div class="h3-slot ${P ? 'previewing' : ''} ${UI.build ? 'building' : ''}" id="h3slot"><div class="h3-load">Kindling the hearth…</div>
        <div class="h3-ctl">${UI.build ? '' : `<button data-act="h3-build" aria-label="Build">✎</button>${UI.visit ? '' : `<button class="${S.settings.stars === false ? '' : 'on'}" data-act="h3-stars" aria-label="Stars">☆</button>`}`}<button data-act="h3-follow" aria-label="Find him">◎</button><button data-act="h3-zoom" aria-label="Zoom">⌕</button></div>
        ${UI.build ? `<div class="bld" id="bld">${buildBar()}</div>` : (S.total < 12 ? '<div class="h3-hint">Drag to look round · tap a ☆</div>' : '')}${bar}</div>`;
  }

  // ---------- the estate: upgrades, from a dump to a diamond-encrusted fridge ----------
  // 2.20.1 finishes: the piece at its level, in other colours. The sprite each piece shows, for the swatches:
  const FENCE_K = ['fence.broken', 'fence.wood', 'fence.picket', 'fence.picket', 'fence.gold', 'fence.golden'];
  const estSpr = (k, t) => (k === 'walls' ? 'wall.' + t : k === 'floors' ? 'floor.' + t : k === 'yard' ? FENCE_K[t] : k === 'aviary' ? 'aviary.' + t + '.b' : k + '.' + t);
  const AS_BUILT = { k: null, n: 'As built', g: 0, note: 'The piece the way it came' };
  const finOpts = (k) => [AS_BUILT].concat(G.finishList(S, k));
  const finCol = (g) => (g ? RAR[g].c : 'var(--ivory)');
  function finishBlock(k, cur) {
    const F = G.finishState(S, k), spr = estSpr(k, cur);
    const cell = (f) => { const on = (F.on || null) === f.k, own = !f.k || F.own.indexOf(f.k) >= 0;
      return `<div class="fin ${on ? 'on' : ''}" data-m="fin-pv" data-k="${k}" data-v="${f.k || ''}"><canvas class="finc" width="72" height="72" data-spr="${spr}" data-fin="${f.k || ''}"></canvas>
        <div class="fn" style="color:${finCol(f.g)}">${esc(f.n)}</div><div class="fc">${on ? 'on' : own ? (f.k ? 'yours' : 'free') : '◈ ' + f.cost}</div></div>`; };
    return `<div class="hd">Finishes<small>this level, other colours</small></div>
      <p class="lore" style="font-size:14px;margin-top:0">The same piece, recoloured. ${G.FIN_GRADE.slice(1).map((g, i) => `<b style="color:${RAR[i + 1].c}">${g.n}</b>`).join(' · ')}: grander looks richer and costs more. They stay with this level; an upgrade brings its own set.</p>
      <div class="fins">${finOpts(k).map(cell).join('')}</div>`;
  }
  function paintFinishes() { if (!window.House2D) return; document.querySelectorAll('#modal canvas.finc').forEach((c) => { const f = c.dataset.fin && G.FINISHES[c.dataset.fin]; House2D.thumb(c, c.dataset.spr, null, f ? f.s : null).catch(() => {}); }); }
  function finBar(P) {
    const d = G.ESTATE[P.key], L = finOpts(P.key), F = G.finishState(S, P.key);
    const i = Math.max(0, L.findIndex((f) => f.k === P.fin)), f = L[i], on = (F.on || null) === f.k, own = !f.k || F.own.indexOf(f.k) >= 0;
    const act = on ? '<span class="pvon">On</span>' : own ? `<button class="btn small prime" data-act="fin-use" data-k="${P.key}" data-v="${f.k || ''}">Use</button>`
      : `<button class="btn small ${S.gold >= f.cost ? 'prime' : ''}" data-act="fin-buy" data-k="${P.key}" data-v="${f.k}" ${S.gold >= f.cost ? '' : 'disabled'}>◈ ${f.cost}</button>`;
    return `<div class="h3-prev"><button class="pv" data-act="pv-fin" data-v="-1" ${i <= 0 ? 'disabled' : ''} aria-label="Previous finish">‹</button>
      <div class="pvb"><div class="pvn" style="color:${finCol(f.g)}">${esc(f.n)}</div><div class="pvs">${d.icon} ${esc(d.name)} · ${f.g ? G.FIN_GRADE[f.g].n + ' finish' : 'no finish'}${own && f.k && !on ? ' · yours' : ''}</div></div>
      <button class="pv" data-act="pv-fin" data-v="1" ${i >= L.length - 1 ? 'disabled' : ''} aria-label="Next finish">›</button>${act}
      <button class="btn small" data-act="pv-done">Done</button></div>`;
  }
  function startFinPreview(k, f) {
    const cur = G.estateTier(S, k); if (cur < 0) return;
    UI.preview = { key: k, tier: cur, fin: f || null };
    closeModal(); UI.tab = 'hearth'; UI.sub.hearth = '';
    render(); $('#main').scrollTop = 0;
  }
  function buyFinishUI(k, f) {
    const d = G.ESTATE[k], F = G.FINISHES[f], r = G.buyFinish(S, k, f);
    if (!F || r.err) { toast((r.err || 'Not yet') + '.'); return; }
    if (r.cost) { S.log.unshift({ t: Date.now(), d: G.today(), b: 1, n: d.name + ': ' + F.n + ' finish', i: d.icon, x: 0, g: -r.cost }); Sfx.play('coin'); buzz(1); toast(`${d.name} in ${F.n.toLowerCase()}. ◈ ${r.cost}`); }
    save(); render();
  }
  function useFinishUI(k, f) { if (!G.setFinish(S, k, f || null)) return; save(); render(); }
  function estateLock(n) {
    if (n.max) return '<span class="elock">Absurd</span>';
    if (n.ok) return `<button class="btn small prime">◈ ${n.cost}</button>`;
    if (n.lock === 'level') return `<span class="elock">Level ${n.lvl}</span>`;
    if (n.lock === 'stat') return `<span class="elock">${n.sv} ${SI[n.st].short}</span>`;
    if (n.lock === 'gold') return `<span class="elock short">◈ ${n.cost}</span>`;
    return '<span class="elock">Locked</span>';
  }
  function estateRow(k) {
    const d = G.ESTATE[k], cur = G.estateTier(S, k), n = G.estateNext(S, k);
    const pips = cur < 0 ? '' : `<span class="tpips">${[0, 1, 2, 3, 4, 5].map((i) => `<i class="${i <= cur ? 'on' : ''}"></i>`).join('')}</span>`;
    const fon = cur >= 0 ? G.finishState(S, k).on : null;
    const now = cur < 0 ? 'Not built' : esc(d.tiers[cur]) + (fon ? ` <span style="color:${RAR[G.FINISHES[fon].g].c}">· ${esc(G.FINISHES[fon].n)}</span>` : '');
    return `<div class="row est" data-act="estate" data-k="${k}"><div class="ri">${d.icon}</div><div class="rb"><div class="rn">${esc(d.name)}${pips}</div>
      <div class="rs">${now}${n.max ? '' : ` <span class="dim">→ ${esc(n.name)}</span>`}</div></div>${estateLock(n)}</div>`;
  }
  function viewEstate() {
    const spent = S.estate.spent;
    let h = h3Slot() + `<div class="omen" style="text-align:center"><span class="gl">◈ ${S.gold}</span> in the purse${spent ? ` · ◈ ${spent} sunk into the estate` : ''}</div>`;
    G.ESTATE_AREAS.forEach((a) => {
      const keys = Object.keys(G.ESTATE).filter((k) => G.ESTATE[k].area === a[0]);
      if (keys.length) h += `<div class="hd">${esc(a[1])}</div>` + keys.map(estateRow).join('');
    });
    return h;
  }
  function openEstate(k, keep) {
    const d = G.ESTATE[k];
    if (!d) return;
    const cur = G.estateTier(S, k), n = G.estateNext(S, k);
    let h = `<h3>${d.icon} ${esc(d.name)}</h3>${d.note ? `<p class="lore">${esc(d.note)}</p>` : ''}<div class="tladder">` +
      d.tiers.map((t, i) => { const rq = G.estateReq(k, i), met = S.level >= rq.lvl && (S.stats[rq.st] | 0) >= rq.sv;
        const tc = i === cur ? 'yours' : i < cur ? '' : !n.max && i === n.tier && n.ok ? '◈ ' + n.cost
          : `<span class="treq ${met ? 'met' : ''}"><i class="${S.level >= rq.lvl ? 'ok' : ''}">Lv ${rq.lvl}</i>${rq.sv ? ` <i class="${(S.stats[rq.st] | 0) >= rq.sv ? 'ok' : ''}">${rq.sv} ${SI[rq.st].short}</i>` : ''}</span>`;
        return `<div class="tl ${i === cur ? 'cur' : ''} ${i < cur ? 'past' : ''} ${!n.max && i === n.tier ? 'next' : ''}" data-m="estate-pv" data-k="${k}" data-v="${i}">
        <span class="tn">${i + 1}</span><span class="tw">${esc(t)}</span><span class="tc">${tc}</span></div>`; }).join('') +
      `</div><p class="lore" style="font-size:14px;text-align:center;margin-top:8px">${G.EST_STAT[k] ? `Each level needs the hero's level and <b style="color:var(--${G.EST_STAT[k][0]})">${SI[G.EST_STAT[k][0]].name}</b> (${esc(G.EST_STAT[k][1])}): you have ${S.stats[G.EST_STAT[k][0]] | 0}. ` : ''}Tap any of them to try it on in the hearth.</p>`;
    if (n.max) h += '<p class="lore" style="text-align:center;color:var(--gold2)">It cannot get any more ridiculous.</p><div class="btns"><button class="btn" data-m="close">Close</button></div>';
    else h += `${n.why ? `<p class="lore" style="text-align:center">${esc(n.why)}.</p>` : ''}<div class="btns"><button class="btn" data-m="estate-pv" data-k="${k}" data-v="${n.tier}">Preview</button>
      <button class="btn prime" data-m="estate-buy" data-k="${k}" ${n.ok ? '' : 'disabled'}>${n.unlock ? 'Build' : 'Upgrade'} · ◈ ${n.cost}</button></div>`;
    if (cur >= 0) h += finishBlock(k, cur);
    if (!keep) UI.sheet = null;
    openSheet(h, 'estate');
    paintFinishes();
  }
  function startPreview(k, tier) {
    UI.preview = { key: k, tier: Math.max(0, Math.min(5, tier)) };
    closeModal();
    UI.tab = 'hearth'; UI.sub.hearth = '';
    render(); $('#main').scrollTop = 0;
  }
  function buyEstateUI(k) {
    const d = G.ESTATE[k], n = G.buyEstate(S, k);
    if (!n) { const x = G.estateNext(S, k); toast(x.why ? x.why + '.' : 'Not yet.'); return; }
    S.log.unshift({ t: Date.now(), d: G.today(), b: 1, n: d.name + ': ' + n.name, i: d.icon, x: 0, g: -n.cost });
    const wingNote = n.unlock ? G.houseWing(S, k) : null;
    save(); buzz(1);
    UI.preview = null;
    if (HOUSE.inst) HOUSE.inst.endPreview(true);
    closeModal();
    if (UI.tab === 'hearth') $('#main').scrollTop = 0;
    render();
    const h = HOUSE.inst;
    if (h && UI.tab === 'hearth') h.ready.then(() => { h.focus(k); clearTimeout(HOUSE.focusT); HOUSE.focusT = setTimeout(() => { if (HOUSE.inst === h && !UI.preview) h.unfocus(); }, 3800); });
    toast(n.unlock ? `${d.name}: built.${wingNote ? ' ' + wingNote : ''}` : n.tier === 5 ? `${n.name}. Magnificent. Horrifying.` : `${n.name}. Much better.`);
  }
  // Which upgrade a Hearth condition's sheet points to.
  function estateFor(key) {
    return { fridge: 'fridge', dishes: 'sink', laundry: 'wardrobe', lawn: 'yard', birds: 'aviary', aviary: 'aviary', gym: S.estate.wings.garage ? 'garage' : 'bag', study: 'desk', reno: 'walls' }[key];
  }

  // ================= 2.13: MORE LAND, AND THE TOWN =================
  function landRow() {
    const L = G.landOf(S), n = G.landNext(S);
    const pips = `<span class="tpips">${G.LANDS.map((x, i) => `<i class="${i < L.lv ? 'on' : ''}"></i>`).join('')}</span>`;
    const now = L.lv ? G.LANDS[L.lv - 1].name : S.estate.wings.garden ? 'The plot and the side lot' : 'The plot';
    return `<div class="row est" data-act="land"><div class="ri">🌳</div><div class="rb"><div class="rn">More land${pips}</div>
      <div class="rs">${esc(now)}${n.max ? '' : ` <span class="dim">→ ${esc(n.name)}</span>`}</div></div>${n.max ? '<span class="elock">All of it</span>' : n.ok ? `<button class="btn small prime">◈ ${n.cost}</button>` : /^Reach level/.test(n.why) ? `<span class="elock">Level ${n.lvl}</span>` : /^Need \d/.test(n.why) ? `<span class="elock short">◈ ${n.cost}</span>` : '<span class="elock">Locked</span>'}</div>`;
  }
  function openLand() {
    const L = G.landOf(S), n = G.landNext(S);
    let h = `<h3>🌳 More land</h3><p class="lore">Each purchase pushes the fence out. The first takes down the fence between the plot and the side lot, so the house can run right across. More land also means more rooms: ${G.roomLimit(S)} now.</p><div class="tladder">` +
      G.LANDS.map((x, i) => `<div class="tl ${i === L.lv - 1 ? 'cur' : ''} ${i < L.lv - 1 ? 'past' : ''} ${!n.max && i === n.lv - 1 ? 'next' : ''}"><span class="tn">${i + 1}</span><span class="tw">${esc(x.name)} <small class="dim">${x.x1} × ${x.y1} tiles</small></span><span class="tc">${i < L.lv ? 'yours' : '◈ ' + x.cost + ' · level ' + x.lvl}</span></div>`).join('') + '</div>';
    if (n.max) h += '<p class="lore" style="text-align:center;color:var(--gold2)">There is no more land to buy. It is all yours.</p><div class="btns"><button class="btn" data-m="close">Close</button></div>';
    else h += `${n.why ? `<p class="lore" style="text-align:center">${esc(n.why)}.</p>` : ''}<div class="btns"><button class="btn" data-m="close">Close</button><button class="btn prime" data-m="land-buy" ${n.ok ? '' : 'disabled'}>Buy · ◈ ${n.cost}</button></div>`;
    openSheet(h, 'land');
  }
  function buyLandUI() {
    const n = G.buyLand(S);
    if (!n) { const x = G.landNext(S); toast(x.why ? x.why + '.' : 'Not yet.'); return; }
    S.log.unshift({ t: Date.now(), d: G.today(), b: 1, n: 'Land: ' + n.name, i: '🌳', x: 0, g: -n.cost });
    G.houseSettle(S); save(); buzz(1); Sfx.play('coin'); closeModal(); render();
    if (HOUSE.inst && HOUSE.inst.setZoom) HOUSE.inst.setZoom(0);
    toast(`${n.name} is yours. Drag the view to walk the new fence line.`);
  }
  const townBar = (st) => `<div class="twbar"><i style="width:${st.goal ? Math.round(100 * st.prog / st.goal) : 0}%"></i></div>`;
  function townCard(k) {
    const d = G.TOWN[k], st = G.townState(S, k);
    const pips = `<span class="tpips">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < st.tier ? 'on' : ''}"></i>`).join('')}</span>`;
    let body, tag;
    if (!st.own) { body = `<div class="rs">${esc(st.active)} while open</div>`; tag = st.ok ? `<button class="btn small prime">◈ ${d.cost}</button>` : /^Reach/.test(st.why) ? `<span class="elock">Level ${d.lvl}</span>` : `<span class="elock short">◈ ${d.cost}</span>`; }
    else if (st.max) { body = `<div class="rs">${esc(st.earned.join(' · '))}</div>`; tag = `<span class="elock" style="color:var(--gold2)">${st.on ? 'Open' : 'Mastered'}</span>`; }
    else if (st.ready) { body = `<div class="rs">Challenge met. Pay the builders and it's yours: ${esc(st.reward)}</div>`; tag = `<button class="btn small ${S.gold >= st.pay ? 'prime' : ''}">◈ ${st.pay}</button>`; }
    else if (st.on) { body = `<div class="rs">${esc(st.ask)}: ${st.prog}/${st.goal}</div>${townBar(st)}`; tag = '<span class="elock" style="color:var(--gold2)">Open</span>'; }
    else { body = `<div class="rs dim">Closed. Next: ${esc(st.ask.charAt(0).toLowerCase() + st.ask.slice(1))}</div>`; tag = '<span class="elock">Closed</span>'; }
    return `<div class="row est tw ${st.on ? 'twon' : ''} ${st.own ? '' : 'twsale'}" data-act="town" data-k="${k}"><div class="ri">${d.icon}</div><div class="rb"><div class="rn">${esc(d.name)}${st.own ? pips : ''}</div>${body}</div>${tag}</div>`;
  }
  function viewTown() {
    const gate = G.townGate(S);
    if (!gate.open) {
      return `<div class="hd">The road to town</div><p class="lore">There is a town down the road, with a gym, a library, an apothecary and more. Its buildings make ${esc(S.hero.name)} grow faster while they are open, and set challenges that pay out for good. The road opens when the house is worth walking from.</p>` +
        gate.list.map((x) => `<div class="row"><div class="ri">${x.ok ? '✅' : '🔒'}</div><div class="rb"><div class="rn">${esc(x.text)}</div>${x.note ? `<div class="rs">${esc(x.note)}</div>` : ''}</div></div>`).join('');
    }
    const T = S.town, keys = Object.keys(G.TOWN), own = keys.filter((k) => T.own[k]), slots = G.townSlots(S), tp = G.townPerks(S);
    let top = t2Slot();
    const open = own.filter((k) => T.on.indexOf(k) >= 0), shut = own.filter((k) => T.on.indexOf(k) < 0), sale = keys.filter((k) => !T.own[k]);
    const kept = []; keys.forEach((k) => { G.townState(S, k).earned.forEach((x) => kept.push(x)); });
    let h = top + `<div class="omen" style="text-align:center"><span class="gl">◈ ${S.gold}</span> in the purse · ${open.length} of ${slots} open${slots < 3 ? ' · a third opens with four buildings' : slots < 4 ? ' · a fourth opens with eight' : ''}</div>`;
    if (!own.length) h += `<p class="lore">Buy a building and open it. While it is open it helps a little and sets a challenge. Meet the challenge and the reward is yours for good, then a longer one is set. Close a building part-way and that challenge starts again, so the time to swap is just after one is met.</p>`;
    if (open.length) h += `<div class="hd">Open<small>${open.length}/${slots}</small></div>` + open.map(townCard).join('');
    if (shut.length) h += `<div class="hd">Closed</div>` + shut.map(townCard).join('');
    if (sale.length) h += `<div class="hd">For sale</div>` + sale.map(townCard).join('');
    if (kept.length) h += `<div class="hd">Yours for good</div><p class="lore" style="margin-top:0">${esc(kept.join(' · '))}</p>`;
    h += `<p class="lore" style="font-size:14px;margin-top:14px">Foes and flasks count on the run that clears a dungeon, so each dungeon counts once. Your companions’ homes are on Hearth Row and Cobble Row: talk to them in town.</p>`;
    return h;
  }
  function openTown(k) {
    const d = G.TOWN[k]; if (!d) return;
    const st = G.townState(S, k), full = S.town.on.length >= G.townSlots(S);
    let h = `<h3>${d.icon} ${esc(d.name)}</h3><p class="lore"><b>While open:</b> ${esc(st.active)}.</p><div class="tladder">` +
      d.goals.map((g, i) => { const rw = d.rw[Math.min(i, d.rw.length - 1)]; return `<div class="tl ${i < st.tier ? 'past' : ''} ${i === st.tier && st.own ? 'next' : ''}"><span class="tn">${i + 1}</span><span class="tw">${esc(d.ask(g))}${i === st.tier && st.on ? ` <small class="dim">${st.prog}/${g}</small>` : ''}</span><span class="tc">${esc(G.townReward(k, i))}${i < st.tier ? ' ✓' : ''}</span></div>`; }).join('') + '</div>';
    if (st.ready) h += `<p class="lore" style="text-align:center">The challenge is met. Pay the builders ◈ ${st.pay} and <b>${esc(st.reward)}</b> is yours for good${st.tier + 1 < G.TOWN_TIERS ? ', and the next challenge is set' : ''}.${S.gold < st.pay ? ` You're ${st.pay - S.gold} short.` : ''}</p><div class="btns"><button class="btn" data-m="close">Not yet</button><button class="btn prime" data-m="town-pay" data-k="${k}" ${S.gold >= st.pay ? '' : 'disabled'}>Pay · ◈ ${st.pay}</button></div>`;
    else if (!st.own) h += `${st.why ? `<p class="lore" style="text-align:center">${esc(st.why)}.</p>` : ''}<div class="btns"><button class="btn" data-m="close">Close</button><button class="btn prime" data-m="town-buy" data-k="${k}" ${st.ok ? '' : 'disabled'}>Buy · ◈ ${d.cost}</button></div>`;
    else if (st.on) h += `<p class="lore" style="text-align:center">${st.max ? 'Every challenge here is met. It still helps while it is open.' : st.prog ? `Closing it now throws away ${st.prog} of ${st.goal} on this challenge.` : 'Nothing counted on this challenge yet, so closing it costs nothing.'}</p><div class="btns"><button class="btn" data-m="close">Keep it open</button><button class="btn blood" data-m="town-toggle" data-k="${k}">Close it</button></div>`;
    else h += `<p class="lore" style="text-align:center">${full ? `All ${G.townSlots(S)} places are taken. Close another building first.` : 'The challenge starts counting from the moment it opens.'}</p><div class="btns"><button class="btn" data-m="close">Leave it</button><button class="btn prime" data-m="town-toggle" data-k="${k}" ${full ? 'disabled' : ''}>Open it</button></div>`;
    openSheet(h, 'town');
  }
  function townBuyUI(k) {
    const st = G.townBuy(S, k);
    if (!st) { const x = G.townState(S, k); toast(x.why ? x.why + '.' : 'Not yet.'); return; }
    const d = G.TOWN[k];
    S.log.unshift({ t: Date.now(), d: G.today(), b: 1, n: 'Town: ' + d.name, i: d.icon, x: 0, g: -d.cost });
    save(); buzz(1); Sfx.play('coin'); closeModal(); render();
    toast(S.town.on.indexOf(k) >= 0 ? `${d.name} bought and open.` : `${d.name} bought. Close another to open it.`);
  }
  function townPayUI(k) {
    const r = G.townPay(S, k);
    if (r.err) { toast(r.err + '.'); return; }
    const d = G.TOWN[k];
    S.log.unshift({ t: Date.now(), d: G.today(), b: 1, n: d.name + ': works ' + r.tier + ' of ' + G.TOWN_TIERS + ' paid for', i: d.icon, x: 0, g: -r.cost });
    save(); buzz(1); Sfx.play('coin'); closeModal(); render();
    toast(r.reward + ', for good.' + (r.max ? ' That is the last of them here.' : ' A longer challenge is set.'));
  }
  function townToggleUI(k) {
    const r = G.townToggle(S, k);
    if (r.err) { toast(r.err + '.'); return; }
    save(); closeModal(); render();
    toast(r.on ? `${G.TOWN[k].name} is open.` : `${G.TOWN[k].name} closed.`);
  }
  // 2.23: the first time everything's done, the Victor's Statue and the offer of New Game+
  function endSettle() {
    const st = G.contentCheck(S, G.today());
    if (!st) return;
    S.log.unshift({ t: Date.now(), d: G.today(), v: 1, n: 'Everything done: the Victor’s Statue', i: '🏆', x: 0, g: 0 });
    UI.goalDone.push({ kind: 'complete' });
  }
  function endBody() {
    const nm = esc((S.hero && S.hero.name) || 'He');
    return `<div class="bk">EVERYTHING DONE</div><div class="bt" style="margin-top:12px;font-size:22px">${nm} has seen all of it</div>
      <p class="lore" style="margin-top:8px">Level ${G.END_LEVEL}, all ${G.END_DUNGEON} bosses, the estate, the land, the town. <b>The Victor’s Statue</b>, ${nm} in gold, stands in the yard.</p>
      <p class="lore"><b>New Game+</b>: a new hero starts from nothing. Your deeds, rewards, settings, look and birds come with you, and ${nm} stands in the new yard in stone.</p>
      <p class="lore"><b>Keep going</b>: ${nm} carries on, but there's nothing new from here. The bosses come back Reborn, the Endless dungeons keep climbing and the loot keeps scaling, all from what you've already seen. You can start New Game+ later from Records.</p>`;
  }
  function ngpAsk() {
    const nm = esc((S.hero && S.hero.name) || 'him');
    openSheet(`<h3>Begin New Game+?</h3><p class="lore">${nm}'s level, gold, gear, estate, house, town, companions and dungeons all go. What you've set up for real life stays: your deeds and their history, rewards, settings, look and the birds.</p>
      <p class="lore">${nm} will stand in the new yard as a statue. A copy of this save goes to your backups first.</p>
      <div class="btns"><button class="btn" data-m="close">Not yet</button><button class="btn prime" data-m="ngp-go">Begin again</button></div>`, 'ngp');
  }
  function ngpGo() {
    try { localStorage.setItem('grindstone-before-ngp-' + G.today(), JSON.stringify(S)); } catch (e) { /* too big for the browser store: the backup file still goes */ }
    backupNow(true);
    const old = (S.hero && S.hero.name) || 'He';
    S = G.newGamePlus(S, G.today()); S.uiV = 3; UI.pct = null;
    if (G.normDelve) G.normDelve(S);
    save(); closeModal(); goto('quests:today'); render();
    toast(`New Game+. ${old} stands in the yard.`);
  }
  // Called from save(): opens the town when it's earned and pays out any challenge that's been met.
  function townSettle() {
    const got = G.townTick(S);
    got.forEach((r) => {
      if (r.opened) { UI.goalDone.push({ kind: 'town', head: 'THE ROAD TO TOWN IS OPEN', title: 'There are buildings for sale', note: 'Hearth › Town. Buy one and open it: it helps while it is open, and sets a challenge that pays out for good.' }); return; }
      const d = G.TOWN[r.k];
      S.log.unshift({ t: Date.now(), d: G.today(), v: 1, n: d.name + ' challenge ' + r.tier + ' met', i: d.icon, x: 0, g: 0 });
      UI.goalDone.push({ kind: 'town', head: 'CHALLENGE MET', title: d.name + ', ' + r.tier + ' of ' + G.TOWN_TIERS, note: 'Pay the builders ◈ ' + r.pay + ' in Town and ' + r.reward.charAt(0).toLowerCase() + r.reward.slice(1) + ' is yours for good.' });
    });
    return got.length;
  }

  // ================= THE TOWN, WALKED ROUND (2.24) =================
  // The map sits on top of Hearth › Town; the list of buildings is still underneath it. Tap someone to talk; tap a
  // building to go in; the south gate goes home. Companions' homes are visited (and built) in the hearth's own view.
  const TOWNV = { el: null, inst: null, failed: false, sig: '' };
  window.__town = TOWNV;
  const TALK = { open: false, d: null, page: 0, typed: 0, timer: 0, who: null, heard: {}, n: 0 };
  window.__talk = TALK;
  function townWorld() { return { lots: G.townLots(S), people: G.townPeople(S, G.today()) }; }
  function townSig() { return JSON.stringify([G.townLots(S).map((l) => l.id), G.townPeople(S, G.today()).map((p) => p.id), S.look, gearItems()]); }
  function t2Slot() {
    return `<div class="h3-slot t2-slot" id="t2slot"><div class="h3-load">Walking into town…</div><div class="t2-where" id="t2where"></div>
      <div class="h3-ctl"><button data-act="t2-zoom" aria-label="Zoom">⊕</button><button data-act="t2-follow" aria-label="Find him">◎</button></div>
      ${S.total < 400 ? '<div class="h3-hint">Tap someone to talk · tap a door to go in</div>' : ''}</div>`;
  }
  function mountTown() {
    const slot = $('#t2slot');
    if (!slot) { if (TOWNV.inst) TOWNV.inst.setActive(false); if (TOWNV.el && TOWNV.el.parentNode) TOWNV.el.parentNode.removeChild(TOWNV.el); return; }
    if (TOWNV.failed || !window.Town2D) { slot.classList.add('failed'); const l = slot.querySelector('.h3-load'); if (l) l.textContent = 'The town can’t be drawn on this device.'; return; }
    if (!TOWNV.el) { TOWNV.el = document.createElement('div'); TOWNV.el.className = 'h3-stage'; }
    slot.insertBefore(TOWNV.el, slot.firstChild);
    if (TOWNV.el.classList.contains('ready')) slot.classList.add('ready');
    if (!TOWNV.inst) {
      TOWNV.sig = townSig();
      TOWNV.inst = new window.Town2D(TOWNV.el, {
        base: '2d/', look: G.normLook(S.look), gear: gearItems(), world: townWorld(), scene: UI.townScene || 'town', at: UI.townAt || null,
        onTalk: (id) => talkTo(id), onEnter: townEnter, onLeave: townLeave, onGate: () => talkTo('gate'),
        onScene: (sc) => { UI.townScene = sc; townWhere(sc); townMarks(); },
        busy: () => TALK.open || !!UI.sheet,
        onReady: () => { TOWNV.el.classList.add('ready'); const sl = $('#t2slot'); if (sl) sl.classList.add('ready'); townMarks(); },
        onError: () => { TOWNV.failed = true; if (TOWNV.inst) TOWNV.inst.dispose(); TOWNV.inst = null; mountTown(); },
      });
      TOWNV.inst.ready.catch(() => {});
      return;
    }
    TOWNV.inst.setActive(true);
    const sig = townSig();
    if (sig !== TOWNV.sig) { TOWNV.sig = sig; TOWNV.inst.ready.then((t) => { t.setWorld(townWorld()); t.setLook(G.normLook(S.look), gearItems()); townMarks(); }); }
    else TOWNV.inst.ready.then(() => townMarks());
    townWhere(UI.townScene || 'town');
  }
  // the ! over anyone with something to say: a challenge to pay for, a roof wanted, work wanted, a drink to buy
  function townMarks() {
    const t = TOWNV.inst; if (!t || !t.people) return;
    const ids = [], hints = G.townHints(S, G.today()), more = hints.some((x) => !TALK.heard[x.key]);
    G.townPeople(S, G.today()).forEach((p) => {
      if (p.kind === 'keeper') { const st = G.townState(S, p.k); if (st.ready) ids.push(p.id); }
      else if (p.kind === 'wand' || p.kind === 'trader') ids.push(p.id);
      else if (p.kind === 'comp') { const h = G.homeOf(S, p.npc); if (h && (!h.built || !h.settled) && !TALK.heard[p.id]) ids.push(p.id); }
      else if (p.kind === 'folk' && !TALK.heard[p.id] && more && +p.id.slice(2) < 3) ids.push(p.id);
    });
    t.setMarks(ids);
  }
  function townWhere(sc) {
    const el = $('#t2where'); if (!el) return;
    const k = sc && sc.indexOf('in:') === 0 ? sc.slice(3) : null;
    el.innerHTML = k ? `${G.TOWN[k].icon} ${esc(G.KEEPERS[k].name)}’s ${esc(G.TOWN[k].name.toLowerCase())} <button class="btn small" data-act="t2-out">Leave</button>` : '';
    el.classList.toggle('on', !!k);
  }
  function townEnter(id, L) {
    if (id.indexOf('b:') === 0) { UI.townAt = null; TOWNV.inst.goScene('in:' + id.slice(2)); Sfx.play('tick'); return; }
    if (id.indexOf('home:') === 0) { visitHome(id.slice(5)); }
  }
  function townLeave(k) { const L = G.TMAP.lots[k]; TOWNV.inst.goScene('town', L ? [L.x + L.dc, L.y + L.h] : null); }
  // ---------- the talking: an old-style box at the bottom, a page at a time, then the choices ----------
  function talkEl() {
    let el = document.getElementById('talk');
    if (!el) {
      el = document.createElement('div'); el.id = 'talk'; el.className = 'talk hidden';
      el.innerHTML = '<div class="talk-box"><div class="talk-name"></div><div class="talk-text"></div><div class="talk-ch"></div><div class="talk-more">▼</div></div>';
      document.body.appendChild(el);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const c = ev.target.closest('[data-tk]');
        if (c) { if (performance.now() - TALK.chAt > 350) talkChoose(c.dataset.tk); return; }   // not the tap that was finishing the text
        talkNext();
      });
    }
    return el;
  }
  function talkTo(id, o) {
    const d = G.townTalk(S, id, G.today(), Object.assign({ heard: TALK.heard, n: TALK.n++ }, o || {}));
    if (!d) return;
    talkShow(id, d, o);
  }
  function talkShow(id, d, o) {
    const el = talkEl();
    TALK.open = true; TALK.d = d; TALK.page = 0; TALK.who = id;
    if (d.hint) TALK.heard[d.hint] = 1;
    if (d.also) TALK.heard[d.also] = 1;
    if (id) TALK.heard[id] = 1;
    if (TOWNV.inst && id) TOWNV.inst.hold(id, true);
    el.className = 'talk' + (d.sign ? ' sign' : '');
    el.querySelector('.talk-name').textContent = d.name;
    talkPage();
    buzz(0);
  }
  function talkPage() {
    const el = talkEl(), d = TALK.d, txt = d.pages[TALK.page] || '', last = TALK.page >= d.pages.length - 1;
    const tx = el.querySelector('.talk-text'), ch = el.querySelector('.talk-ch');
    ch.innerHTML = ''; el.querySelector('.talk-more').style.visibility = 'hidden';
    clearInterval(TALK.timer); TALK.typed = 0; tx.textContent = '';
    const done = () => {
      clearInterval(TALK.timer); TALK.typed = txt.length; tx.textContent = txt;
      if (last && d.choices.length && !(d.choices.length === 1 && d.choices[0][1] === 'bye')) { ch.innerHTML = d.choices.map((c) => `<button class="tk" data-tk="${esc(c[1])}">${esc(c[0])}</button>`).join(''); TALK.chAt = performance.now(); }
      else el.querySelector('.talk-more').style.visibility = 'visible';
    };
    TALK.finish = done;
    TALK.timer = setInterval(() => { TALK.typed += 2; if (TALK.typed >= txt.length) done(); else tx.textContent = txt.slice(0, TALK.typed); }, 22);
    if (S.settings.reduceMotion) done();
  }
  function talkNext() {
    const d = TALK.d; if (!d) return;
    if (TALK.typed < (d.pages[TALK.page] || '').length) { TALK.finish(); return; }
    if (TALK.page < d.pages.length - 1) { TALK.page++; talkPage(); return; }
    if (d.choices.length && !(d.choices.length === 1 && d.choices[0][1] === 'bye')) return;   // pick one
    talkClose();
  }
  function talkClose() {
    clearInterval(TALK.timer);
    const el = document.getElementById('talk'); if (el) { el.className = 'talk hidden'; el.querySelector('.talk-ch').innerHTML = ''; }
    if (TOWNV.inst && TALK.who) TOWNV.inst.hold(TALK.who, false);
    TALK.open = false; TALK.d = null;
    townMarks();
  }
  // a line to say after a choice has done its thing
  const talkAfter = (name, line) => setTimeout(() => talkShow(null, { name: name, pages: [line], choices: [['Goodbye', 'bye']] }), 120);
  function townRefresh() { TOWNV.sig = ''; if (TOWNV.inst) TOWNV.inst.ready.then((t) => { t.setWorld(townWorld()); TOWNV.sig = townSig(); townMarks(); }); }
  function talkChoose(act) {
    const name = TALK.d ? TALK.d.name : '', who = TALK.who;
    talkClose();
    const [a, k] = act.split(/:(.*)/s);
    if (a === 'bye') return;
    if (a === 'buy') { const before = !!S.town.own[k]; townBuyUI(k); if (!before && S.town.own[k]) { townRefresh(); talkAfter('Signpost', 'SOLD. The builders get to work, and the ' + G.TOWN[k].name.toLowerCase() + ' goes up by morning. Well. By now.'); } return; }
    if (a === 'pay') { townPayUI(k); return; }
    if (a === 'open' || a === 'close') { townToggleUI(k); return; }
    if (a === 'card') { openTown(k); return; }
    if (a === 'invite') {
      const n = npcById(k), err = G.npcInvite(S, k);
      if (err) { toast(err + '.'); return; }
      G.homesNorm(S);
      S.log.unshift({ t: Date.now(), d: G.today(), b: 1, n: n.name + ' joins you', i: '🤝', x: 0, g: -n.via.gold });
      save(); buzz(2); Sfx.play('coin'); npcArrived([n]); townRefresh(); render();
      const h = G.homeOf(S, k);
      talkAfter(n.name, 'Done. I’ll be on plot ' + (h ? h.plot + 1 : '?') + ', ' + G.streetOf(h ? G.TMAP.plots[h.plot].y + 5 : 34) + ', under the stars until there’s a roof. No rush. Some rush.');
      return;
    }
    if (a === 'home') {
      if (!k) { UI.townScene = 'town'; UI.townAt = null; if (TOWNV.inst) TOWNV.inst.goScene('town', null); goto('hearth:'); if (HOUSE.inst) HOUSE.inst.ready.then((hh) => hh.arriveAt()); return; }
      const n = npcById(k), r = G.homeBuild(S, k, G.today());
      if (r.err) { toast(r.err + '.'); return; }
      S.log.unshift({ t: Date.now(), d: G.today(), b: 1, n: 'A cottage for ' + n.name, i: '🏡', x: 0, g: -r.cost });
      save(); buzz(2); Sfx.play('coin'); townRefresh(); render();
      talkAfter(n.name, 'A roof! A real one! Come in and see it. And if you’ve the gold, there’s room for more.');
      return;
    }
    if (a === 'visit') { visitHome(k); return; }
    if (a === 'trader') { goto('goods:coffers'); return; }
    if (a === 'gossip') {
      const r = G.townGossip(S);
      if (r.err) { toast(r.err + '.'); return; }
      S.log.unshift({ t: Date.now(), d: G.today(), b: 1, n: 'A drink for the gossip', i: '🍺', x: 0, g: -r.price });
      save(); Sfx.play('coin'); render();
      talkAfter(name, 'Ahh. Right. Whatever’s down in ' + r.name + ' can’t stand ' + G.ELEMENTS[r.el].n.toLowerCase() + '. ' + G.ELEMENTS[r.el].i + ' Don’t say who told you.');
      return;
    }
    if (who) talkTo(who);
  }
  // ---------- a companion's home: the hearth's view and tools, pointed at their house ----------
  let VISIT_PX = null;
  function HS() {
    if (!UI.visit) return S;
    if (!VISIT_PX || VISIT_PX.__home !== UI.visit) VISIT_PX = G.homeProxy(S, UI.visit);
    if (!VISIT_PX) { UI.visit = null; return S; }
    return VISIT_PX;
  }
  function visitHome(id) {
    const h = G.homeOf(S, id); if (!h || !h.built) return;
    talkClose();
    UI.visit = id; VISIT_PX = null; HOUSE.sig = '';
    UI.tab = 'hearth'; UI.sub.hearth = '';
    render(); $('#main').scrollTop = 0;
    if (HOUSE.inst) HOUSE.inst.ready.then((hh) => { hh.setStars(false); hh.arriveAt(); });
  }
  function visitEnd(toTown) {
    if (!UI.visit) return;
    const id = UI.visit, h = G.homeOf(S, id);
    if (UI.build) { UI.build = null; if (HOUSE.inst) { HOUSE.inst.setEdit(null); HOUSE.inst.setZoom(0); } }
    UI.visit = null; VISIT_PX = null; HOUSE.sig = '';
    if (HOUSE.inst) HOUSE.inst.setStars(S.settings.stars !== false);
    if (toTown) { UI.sub.hearth = 'town'; UI.townScene = 'town'; UI.townAt = h ? [G.TMAP.plots[h.plot].x + 4, G.TMAP.plots[h.plot].y + 5] : null; if (TOWNV.inst) TOWNV.inst.ready.then((t) => t.goScene('town', UI.townAt)); }
  }
  function viewVisit() {
    const n = npcById(UI.visit), h = G.homeOf(S, UI.visit);
    if (!n || !h) { UI.visit = null; return viewHearth(); }
    const w = G.homeWants(S, n.id), P = G.TMAP.plots[h.plot];
    let x = h3Slot();
    x += `<div class="visit-bar"><div><div class="rn">🏡 ${esc(n.name)}’s house</div><div class="rs">Plot ${h.plot + 1}, ${esc(G.streetOf(P.y + 5))}${h.settled ? ' · settled in' : ''}</div></div><button class="btn small" data-act="visit-back">Back to town</button></div>`;
    x += `<div class="omen" style="text-align:center"><span class="gl">◈ ${S.gold}</span> in the purse. Rooms and furniture here are paid from it.</div>`;
    x += `<div class="hd">What they want<small>${w.filter((z) => z.ok).length} of ${w.length}</small></div>${wantsHtml(n.id)}`;
    x += `<p class="lore" style="font-size:14.5px">${h.settled ? `${esc(n.name)} has settled in: ${esc(n.name.split(' ')[0])} fights a little harder at your side.` : `Tap ✎ to build. Once it has everything on the list, ${esc(n.name)} settles in: a thank-you in gold, and they fight a little harder at your side.`} What’s placed here stays here; things bought for this house aren’t in yours.</p>`;
    return x;
  }
  // Called from save(): anyone whose home now has what they asked for settles in
  function homeSettleUI() {
    G.homeSettle(S, G.today()).forEach((r) => {
      S.log.unshift({ t: Date.now(), d: G.today(), v: 1, n: r.name + ' settles in', i: '🏡', x: 0, g: r.gift });
      UI.goalDone.push({ kind: 'town', head: 'SETTLED IN', title: r.name + ' loves the place', note: 'Everything they asked for. They chip in ◈ ' + r.gift + ' and fight a little harder at your side from now on.' });
    });
  }

  // ================= DELVE =================
  const EL = (e) => (e && G.ELEMENTS[e] ? G.ELEMENTS[e].i + ' ' + G.ELEMENTS[e].n : '');
  const hoursLeft = (until) => { const h = (until - Date.now()) / 3600e3; return h >= 48 ? Math.round(h / 24) + ' days' : h >= 1 ? Math.floor(h) + ' h' : Math.max(1, Math.round(h * 60)) + ' min'; };
  const fmtAt = (hm) => { const p = hm.split(':').map(Number); return ((p[0] + 11) % 12 + 1) + (p[1] ? ':' + String(p[1]).padStart(2, '0') : '') + (p[0] < 12 ? ' am' : ' pm'); };
  // A run the phone started (fallback or away check) or one left half-watched: play it out now with what's known.
  function resolvePending() {
    const d = S.delve, p = d.pending;
    if (!p || (UI.run && UI.run.t === p.t)) return false;
    const inp = G.inputFor(S, { t: p.t, eq: p.eq || S.eq });
    const out = G.simRun(inp, p.answers || {}, false);
    d.pending = null;
    if (!out.res) return false;
    d.day = p.day;
    G.applyRun(S, out, { t: p.t, day: p.day, solo: !p.manual, buffs: inp.buffs, inp: inp, sig: G.runSig(inp) });
    d.last.log = out.log; d.last.why = p.why || (p.manual ? 'left' : 'fallback');
    return true;
  }
  function soloRun(why) {
    const d = S.delve, t = G.today();
    if (G.ranToday(S, t) || d.pending || G.delveOpens(S, t)) return;
    d.day = t; d.pending = { t: Date.now(), day: t, eq: Object.assign({}, S.eq), answers: {}, manual: false, why: why || 'fallback' };
    resolvePending(); save();
    toast(HE(S.hero.name + ' set out on his own.'));
    if (UI.tab === 'delve' || (UI.tab === 'quests' && UI.sub.quests === 'today')) { if (!UI.sheet) render(); }
  }
  function delveBand() {
    const L = S.delve.last;
    if (L && !L.seen) return `<div class="omen ${L.res === 'clear' ? '' : 'blood'}" data-act="delve-watch">${L.solo ? 'While you were out, ' : ''}${esc(S.hero.name)} ${L.res === 'clear' ? `cleared ${esc(L.name)}` : `fell in ${esc(L.name)}`}. Watch it ›</div>`;
    if (G.delveOpens(S)) return '';
    if (!G.ranToday(S, G.today())) return HE(`<div class="omen" data-act="goto" data-v="delve:">${esc(G.dungeonFor(S.delve.seed, S.delve.n).name.replace(/^the /, 'The '))} is waiting. He goes on his own at ${fmtAt(S.delve.autoAt)} if you don't send him.</div>`);
    return '';
  }
  function viewDelveRun() {
    const d = S.delve, I = G.intel(S), D = I.D, t = G.today(), inp = G.inputFor(S), hero = G.heroFrom(inp), L = d.last;
    const stages = D.events.concat([D.boss]);
    const best = I.best;
    const stageCls = (i) => { if (!best) return ''; const st = best.stages[i]; return st ? (st[1] === 'died' ? 'x' : 'ok') : ''; };
    let h = `<div class="dgn"><div class="dgn-i">${D.icon}</div><div class="dgn-b"><div class="dgn-k">DUNGEON ${d.n + 1}${D.lap ? ' · LAP ' + (D.lap + 1) : ''}</div><div class="dgn-n">${esc(D.name.replace(/^the /, 'The '))}</div>
      <div class="chips"><span class="chip">Deals ${EL(D.el)}</span><span class="chip ${I.weakKnown ? 'good' : ''}">Fears ${I.weakKnown ? EL(D.weak) : '?'}</span>${I.bossKnown ? `<span class="chip">Boss: ${esc(D.boss.name)}</span>` : ''}</div>
      <div class="spips">${stages.map((e, i) => `<i class="${stageCls(i)} ${e.kind === 'boss' ? 'boss' : ''}"></i>`).join('')}</div>
      <div class="dgn-s">${I.rec.length ? `${I.rec.length} attempt${I.rec.length > 1 ? 's' : ''} · best: ${best.res === 'clear' ? 'cleared' : best.bossHp ? `boss at ${Math.round(best.bossLeft / best.bossHp * 100)}%` : `stage ${best.at + 1} of ${best.of}`}` : 'Not yet attempted.'}</div></div></div>`;
    if (L && !L.seen) h += `<div class="banner ${L.res === 'clear' ? '' : 'bad'}" data-act="delve-watch"><div class="t">${L.solo ? 'While you were out' : 'Last run'}<small>${L.res === 'clear' ? `Cleared ${esc(L.name)} · +${L.gold} gold` : `Fell to ${esc(L.killer || 'the dark')}`}</small></div><button class="btn small prime">Watch</button></div>`;
    const lastRec = I.rec[I.rec.length - 1], same = lastRec && lastRec.res !== 'clear' && lastRec.sig && lastRec.sig === G.runSig(inp);
    const shut = G.delveOpens(S, t);
    if (shut) h += HE(`<div class="omen" style="text-align:center">The way down opens tomorrow: one new dungeon a day. The old roads, below, are open meanwhile.</div>`);
    else h += `<button class="btn wide prime big" data-act="delve-go">${I.rec.length ? 'Go again' : 'Set out'}</button>`;
    if (shut) { /* nothing more to say about going */ } else if (same) h += HE(`<div class="omen blood" style="text-align:center;margin-top:8px">Nothing's changed since he fell: same gear, buffs${inp.comp ? ', companion' : ''} and orders means the same result. Get a deed in, change his kit or bring someone.</div>`);
    else h += HE(`<div class="lore" style="text-align:center;margin:6px 0 2px">Go as often as you like; once it falls, the next opens the day after. ${G.ranToday(S, t) ? '' : `If you don't send him today, he goes on his own at ${fmtAt(d.autoAt)}.`}</div>`);
    // the hero as he'd go in now
    const sk = (k, v, c) => `<div class="hs"><b${c ? ` class="${c}"` : ''}>${v}</b><small>${k}</small></div>`;
    const K = G.KINDS[hero.kind];
    h += `<div class="hd">As ${S.look.sex === 'f' ? 'she' : 'he'} stands<small>${inp.buffs.length} buff${inp.buffs.length === 1 ? '' : 's'} active</small></div>
      <div class="dv-hero"><div class="sil-wrap hero3d" data-ready="1">${Art.silhouette(S)}</div><div class="hsheet">${sk('HP', hero.hpMax)}${sk('Attack', Math.round(hero.atk))}${sk('Defence', Math.round(hero.def))}${sk('Dodge', Math.round(hero.evade * 100) + '%')}${sk('MP', hero.mpMax)}${sk('Flasks', hero.flasks)}${sk('Spots secrets', hero.keen)}${sk('Spots traps', hero.wary)}</div></div>
      <div class="kv"><span>Weapon</span><b>${K.n}${hero.el ? ' · ' + EL(hero.el) : ''} <small class="dim">${esc(K.perk)}</small></b></div>
      ${(() => { const rs = G.EL_KEYS.filter((e) => hero.res[e]); return rs.length ? `<div class="kv"><span>Resists</span><b>${rs.map((e) => EL(e)).join(', ')} <small class="dim">${Math.round(G.ELEM_TUNE.res * 100)}% less from ${rs.length > 1 ? 'each' : 'it'}${rs.indexOf(D.el) >= 0 ? ', and it is what this place deals' : ''}</small></b></div>` : ''; })()}
      ${hero.el === D.el ? `<div class="omen blood">${S.look.sex === 'f' ? 'Her' : 'His'} weapon is ${G.ELEMENTS[D.el].n.toLowerCase()}, and so is everything down there. It will barely scratch them.</div>` : ''}
      <div class="btns"><button class="btn" data-act="goto" data-v="status:equip">Change gear</button><button class="btn" data-act="delve-auto">Auto-equip best</button></div>
      ${compRow(inp.comp, D)}`;
    if (inp.buffs.length) h += `<div class="bchips" data-act="goto" data-v="quests:today">${inp.buffs.map((b) => `<span>${G.BUFFS[b.type].i} ${esc(G.BUFFS[b.type].n)}</span>`).join('')}</div>`;
    if (Object.keys(inp.pen).some((k) => inp.pen[k])) h += `<div class="omen blood" data-act="goto" data-v="hearth:">Afflictions weaken him: ${G.STATS.filter((k) => inp.pen[k]).map((k) => '−' + inp.pen[k] + ' ' + k).join(', ')}.</div>`;
    // what each attempt was up against
    if (I.rec.length) {
      h += `<div class="hd">Attempts<small>same challenge every time</small></div>`;
      I.rec.slice().reverse().forEach((r, ri) => {
        const idx = I.rec.length - 1 - ri, open = UI.recOpen === idx;
        h += `<div class="row rec ${r.res === 'clear' ? 'won' : ''}" data-act="delve-rec" data-v="${idx}"><div class="ri">${r.res === 'clear' ? '🏆' : '💀'}</div><div class="rb"><div class="rn">${r.res === 'clear' ? 'Cleared' : r.bossHp ? 'Fell to the boss' : `Fell at stage ${r.at + 1} of ${r.of}`}${r.solo ? ' <span class="tag">SOLO</span>' : ''}</div>
          <div class="rs">${esc(r.d)} · ${r.hero.hp} HP · ${r.hero.atk} atk · ${r.buffs.length} buff${r.buffs.length === 1 ? '' : 's'}${r.comp ? ' · with ' + esc(r.comp.replace(/^\S+ /, '').replace(/ \(.*$/, '')) : ''}</div></div><div class="dim">${open ? '▾' : '▸'}</div></div>`;
        if (open) {
          h += `<div class="recd">${r.short ? `<p>${esc(r.short)}</p>` : `<p>${r.hpLeft} HP to spare.${r.loot ? ' Brought home: ' + r.loot.map(esc).join(', ') + '.' : ''}</p>`}
            <div class="kv"><span>Gear</span><b>${r.gear.filter(Boolean).map(esc).join(', ') || 'nothing'}</b></div>
            <div class="kv"><span>Hero</span><b>${r.hero.hp} HP · ${r.hero.atk} atk · ${r.hero.def} def · ${r.hero.ev}% evade · ${r.hero.fl} flasks${r.hero.el ? ' · ' + EL(r.hero.el) : ''}</b></div>
            <div class="kv"><span>Buffs</span><b>${r.buffs.length ? r.buffs.map(esc).join('<br>') : 'none'}</b></div>
            <div class="kv"><span>Companion</span><b>${r.comp ? esc(r.comp) : 'went alone'}</b></div>
            <div class="stg">${r.stages.map((st, i) => { const e = stages[i]; return `<div><span>${stageName(e)}</span><b class="${st[1] === 'died' ? 'x' : ''}">${stageOut(st)}</b></div>`; }).join('')}</div></div>`;
        }
      });
    }
    return h;
  }
  // At a glance: should he grind stats, go after a buff or two, or just go? Read off how he stands now against his last try.
  // Where his strength comes from tonight. Worked out a moment after the page is drawn (a few hundred quick runs), kept until something changes.
  const PW = { sig: null, html: '' };
  const PW_NAME = { stats: 'Stats', gear: 'Gear', buffs: 'Buffs', comp: 'Companion', relics: 'Relics' };
  function powerHtml(r) {
    const keys = G.SOURCES.filter((k) => r.pct[k] > 0);
    if (!keys.length) return '<div class="pw"><div class="pwt">Strength</div><div class="pwn">Nothing to measure yet. Clear a room or two first.</div></div>';
    return `<div class="pw"><div class="pwt">Where his strength comes from</div><div class="pwb">${keys.map((k) => `<i class="pw-${k}" style="width:${r.pct[k]}%"></i>`).join('')}</div>
      <div class="pwl">${keys.map((k) => `<span><i class="pw-${k}"></i>${k === 'comp' && r.comp ? esc(r.comp) : PW_NAME[k]} ${r.pct[k]}%</span>`).join('')}</div>
      ${r.overdue >= 0.1 ? `<div class="pwn bad">Overdue chores are costing him about ${r.overdue >= 1 ? r.overdue.toFixed(1) + ' dungeons' : Math.round(r.overdue * 100) + '% of a dungeon'} of depth.</div>` : ''}</div>`;
  }
  function powerBand() {
    let sig = null;
    try { sig = G.runSig(G.inputFor(S)); } catch (e) { return ''; }
    if (PW.sig === sig) return PW.html;
    setTimeout(() => {
      try { PW.html = powerHtml(G.powerShares(S, Date.now())); PW.sig = sig; } catch (e) { PW.html = ''; PW.sig = sig; }
      const el = $('#pw-slot'); if (el) el.outerHTML = PW.html;
    }, 60);
    return '<div class="pw" id="pw-slot"><div class="pwt">Where his strength comes from</div><div class="pwn">Working it out…</div></div>';
  }
  function delveGlance() {
    const I = G.intel(S), inp = G.inputFor(S), hero = G.heroFrom(inp), rec = I.rec, last = rec[rec.length - 1];
    let pick = 'go', why = 'Not tried yet. Go and see what he learns.';
    if (last) {
      const gain = Math.sqrt((hero.hpMax * hero.atk) / Math.max(1, last.hero.hp * last.hero.atk)) - 1;
      const extra = inp.buffs.length - last.buffs.length + (inp.comp && !last.comp ? 1 : 0);
      const left = last.bossHp ? last.bossLeft / last.bossHp : 1, near = last.bossHp && left <= 0.4;
      const same = last.sig && last.sig === G.runSig(inp);
      const pc = Math.round(gain * 100);
      if (same) { pick = near ? 'buffs' : 'grind'; why = near ? `Nothing's changed since he fell, but the boss had only ${Math.round(left * 100)}% left. One or two buffs might do it.` : `Nothing's changed since he fell. Train, tidy the hearth, or bring someone.`; }
      else if (gain >= 0.15 || extra >= 2) { pick = 'go'; why = `Stronger than last time (${pc >= 0 ? '+' : ''}${pc}%${extra > 0 ? `, ${extra} more buff${extra > 1 ? 's' : ''} or help` : ''}). Worth a go.`; }
      else if (near || gain >= 0.05 || extra >= 1) { pick = 'buffs'; why = near ? `Last time the boss had ${Math.round(left * 100)}% left. A buff or two could close it.` : `A little stronger than last time (${pc >= 0 ? '+' : ''}${pc}%). A buff or two first, then go.`; }
      else { pick = 'grind'; why = `About as strong as when he fell (${pc >= 0 ? '+' : ''}${pc}%)${last.bossHp ? '' : ', and he fell before the boss'}. Stats first.`; }
    }
    const lights = [['grind', '🏋️', 'Grind stats'], ['buffs', '✨', 'Chase a buff'], ['go', '⚔️', 'Just go']];
    const pips = rec.slice(-8).map((r) => `<i class="${r.res === 'clear' ? 'won' : ''}" title="${r.res === 'clear' ? 'cleared' : r.bossHp ? 'boss at ' + Math.round(r.bossLeft / r.bossHp * 100) + '%' : 'stage ' + (r.at + 1)}">${r.res === 'clear' ? '🏆' : r.bossHp ? Math.round((1 - r.bossLeft / r.bossHp) * 100) + '%' : '·'.repeat(1) + (r.at + 1)}</i>`).join('');
    return `<div class="glance"><div class="gl3">${lights.map((l) => `<div class="${l[0] === pick ? 'on' : ''}"><b>${l[1]}</b><span>${l[2]}</span></div>`).join('')}</div>
      <div class="gwhy">${esc(why)}</div>${rec.length ? `<div class="gpips"><small>${rec.length} attempt${rec.length > 1 ? 's' : ''}</small>${pips}</div>` : ''}</div>`;
  }
  function activeBuffsBlock() {
    const now = Date.now(), act = G.activeBuffs(S, now);
    let h = `<div class="hd">Buffs up now<small>${act.filter((b) => !b.bonus).length} of ${G.delveTune.maxBuffs}${act.some((b) => b.bonus) ? ' + bonus' : ''}</small></div>`;
    h += act.length ? act.map((b) => `<div class="row"><div class="ri">${G.BUFFS[b.type].i}</div><div class="rb"><div class="rn">${esc(G.BUFFS[b.type].n)}: ${esc(G.BUFFS[b.type].what(b.amt))}</div><div class="rs">from ${esc(b.from)} · ${hoursLeft(b.until)} left</div></div></div>`).join('')
      : '<div class="empty">None. Every deed leaves one behind for the next run; the quests list shows which.</div>';
    return h;
  }
  // One long page: how ready he is, the dungeon and his attempts, who goes, what's up, and his standing orders.
  // The floor plan as he knows it: the rooms to scale, the corridors, and at each fork what each way cost last time.
  function routeMap() {
    const d = S.delve, n = d.n, D = G.dungeonFor(d.seed, n), M = D.map, kn = d.known[n] || {}, seen = d.seen[n] || {};
    const K = 6, W = M.w * K, H = M.h * K, ICON = { enter: '⌂', fight: '⚔', lair: '⚔', chest: '🧰', fountain: '⛲', trap: '⚠', secret: '?', fork: '⑂', boss: '☠', goblin: '👺', toll: '🛑', wanderer: '🧑', shrine: '🕯', rest: '☾' };
    // 2.20: the plan only says what he has found there. A room he hasn't been in is a question mark.
    const been = { enter: 1, boss: 1 };
    (d.rec[n] || []).forEach((r) => (r.stages || []).forEach((st) => { been[st[0]] = 1; }));
    Object.keys(seen).forEach((id) => { been[id.replace(/o$/, '')] = 1; });
    D.events.forEach((e) => { if (e.kind === 'fork') e.ways.forEach((w) => { if (kn[w.id] != null) been[w.id] = 1; }); });
    const forks = D.events.filter((e) => e.kind === 'fork' && been[e.id]);
    const star = {};
    let lines = '';
    forks.forEach((f) => {
      const sd = M.forks[f.id] || { a: 'left', b: 'right', c: 'ahead' }, sn = seen[f.id] || {}, Up = (t) => t.charAt(0).toUpperCase() + t.slice(1);
      const cost = (v) => (v == null ? 'untried' : v >= 9999 ? 'beat him' : v < 0 ? 'mended ' + (-v) + ' HP' : v + ' HP');
      const all = f.ways.every((w) => kn[w.id] != null);
      if (all) { const best = f.ways.reduce((b, w) => ((kn[w.id] >= 9999 ? 1e9 : kn[w.id]) < (kn[b.id] >= 9999 ? 1e9 : kn[b.id]) ? w : b), f.ways[0]); star[best.id] = 1; }
      lines += `<div class="rl">⑂ ${f.ways.map((w) => `${Up(sd[w.id.slice(-1)])}: ${cost(kn[w.id])}${kn[w.id + '$'] ? ' (' + esc(kn[w.id + '$'].replace(/^It /, '').replace(/\.$/, '')) + ')' : ''}${star[w.id] ? ' ★' : ''}`).join(' · ')}${sn.easy ? ' · ' + esc(sn.easy) + ' eases the guard' : ''}</div>`;
    });
    const link = (l) => `<polyline points="${l.pts.map((p) => (p[0] * K) + ',' + (p[1] * K)).join(' ')}" class="rm-l"/>`;
    const rooms = M.rooms.map((r) => {
      const k = r.id, lit = star[k] ? ' star' : '', tried = kn[k] != null ? ' tried' : '', known = !!been[k];
      return `<rect x="${r.x0 * K}" y="${(r.y0 + 2) * K}" width="${r.w * K}" height="${r.d * K}" class="rm-r ${known ? r.kind : 'unknown'}${lit}${tried}"/><text x="${(r.x0 + r.w / 2) * K}" y="${(r.y0 + 2 + r.d / 2) * K + 3}" class="rm-t">${known ? (ICON[r.kind] || '') : '?'}</text>`;
    }).join('');
    return `<div class="hd">Floor plan<small>${esc(D.name)}</small></div><svg class="rmap" viewBox="0 0 ${W} ${H}">${M.links.map(link).join('')}${rooms}</svg>${lines || ''}`;
  }
  function viewDelve() {
    // 2.20.3: one part failing to draw shouldn't take the whole page with it
    return [delveGlance, powerBand, routeMap, viewDelveRun, sparBlock, boonBlock, activeBuffsBlock, viewOrders].map((f) => { try { return f(); } catch (e) { return snagCard(f.name, e); } }).join('');
  }
  // ---- companions ----
  function compRow(c, D) {
    const sel = S.delve.comp && npcById(S.delve.comp);
    if (!sel) return `<div class="row comp" data-act="delve-comp"><div class="ri">➕</div><div class="rb"><div class="rn">Going alone</div><div class="rs">Bring someone from the household</div></div><div class="dim">›</div></div>`;
    if (!c) { S.delve.comp = ''; return compRow(null, D); }
    const R0 = G.COMP_ROLES[c.role];
    const fear = c && c.role === 'mage' && c.el ? (c.el === D.weak && G.intel(S).weakKnown ? ' <span class="tag good">IT FEARS THIS</span>' : c.el === D.el ? ' <span class="tag bad">IMMUNE-ISH</span>' : '') : '';
    return `<div class="row comp" data-act="delve-comp"><canvas class="npcport" width="96" height="96" data-k="${esc(sel.id)}"></canvas><div class="rb"><div class="rn">${esc(sel.name)} <small class="dim">${c ? R0.i + ' ' + R0.n : ''}</small>${fear}</div>
      <div class="rs">${!c ? 'Can’t come.' : c.sulk ? 'Sulking: hasn’t been fed, won’t come.' : esc(R0.what(c)) + (c.bird ? (c.m < 1 ? ' · hungry, at ' + Math.round(c.m * 100) + '%' : '') : ' · at ' + Math.round(c.m * 100) + '%')}</div></div><div class="dim">›</div></div>`;
  }
  function openCompPick() {
    const res = S.npcs.filter((n) => n.status === 'resident').sort((a, b) => (a.comp ? 0 : a.kind === 'bird' ? 1 : 2) - (b.comp ? 0 : b.kind === 'bird' ? 1 : 2));
    const D = G.dungeonFor(S.delve.seed, S.delve.n), weakKnown = G.intel(S).weakKnown;
    let h = `<h3>Who goes with him?</h3><p class="lore" style="margin-top:-4px">One a run. Companions grow with him and their habits; the birds fight hardest fed; anyone else can tag along at ${Math.round(G.TAGALONG * 100)}%.</p>`;
    res.forEach((n) => {
      const c = G.compFor(Object.assign({}, S, { delve: Object.assign({}, S.delve, { comp: n.id }) }));
      if (!c) return;
      const RO = G.COMP_ROLES[c.role];
      const note = c.sulk ? 'Sulking: feed them first' : c.role === 'mage' && c.el === D.weak && weakKnown ? 'This dungeon fears ' + G.ELEMENTS[c.el].n.toLowerCase() + '!' : c.role === 'mage' && c.el === D.el ? 'Everything down there is ' + G.ELEMENTS[c.el].n.toLowerCase() + ' too' : '';
      h += `<div class="row comp ${S.delve.comp === n.id ? 'on' : ''}" data-m="comp-set" data-v="${esc(n.id)}"><canvas class="npcport" width="96" height="96" data-k="${esc(n.id)}"></canvas><div class="rb"><div class="rn">${esc(n.name)} <small class="dim">${RO.i} ${RO.n}${c.role === 'mage' ? ' · ' + EL(c.el) : ''}</small></div><div class="rs">${c.tag ? 'Tagging along: ' : ''}${esc(RO.what(c))}${c.bird ? (c.m < 1 && !c.sulk ? ' · hungry, at ' + Math.round(c.m * 100) + '%' : '') : ' · at ' + Math.round(c.m * 100) + '%'}${note ? ` · <b style="color:${c.sulk || c.el === D.el ? 'var(--blood2)' : 'var(--VIT)'}">${esc(note)}</b>` : ''}</div></div></div>`;
    });
    h += `<div class="row comp ${!S.delve.comp ? 'on' : ''}" data-m="comp-set" data-v=""><div class="ri">🚶</div><div class="rb"><div class="rn">Go alone</div><div class="rs">More glory, less help</div></div></div>`;
    const away = G.CALLING_ORDER.map((k) => S.npcs.find((n) => n.comp === k)).filter((n) => n && n.status !== 'resident');
    if (away.length) h += '<div class="lbl">Not here yet</div>' + away.map((n) => { const st = G.callingState(S, n.comp); return `<div class="row comp away"><div class="ri">${G.COMP_ROLES[n.comp].i}</div><div class="rb"><div class="rn">${esc(st.C.title)}</div><div class="rs">${esc(st.C.what)} · ${st.streak}/${st.need} weeks</div></div></div>`; }).join('');
    h += '<div class="btns"><button class="btn" data-m="close">Close</button></div>';
    UI.sheet = null;
    openSheet(h, 'comp');
    mountNpcPortraits();
  }
  function stageName(e) {
    if (!e) return '?';
    return { fight: '⚔ ' + (e.count > 1 ? e.count + ' ' : '') + e.name, chest: '🧰 Chest', fountain: '⛲ Fountain', trap: '⚠ Trap', secret: '🔍 Hidden something', fork: '⑂ A fork', boss: '☠ ' + e.name }[e.kind] || e.kind;
  }
  function stageOut(st) {
    const o = st[1];
    if (o === 'died') return 'died here';
    const lost = st[3] != null ? st[3] - st[2] : null;
    const w = { won: 'won', equipped: 'put it on', stashed: 'stashed it', healed: 'healed', poisoned: 'tainted!', spotted: 'spotted the taint', skipped: 'left it', safe: 'avoided', hurt: 'got hurt', found: 'found it', missed: 'missed it', left: 'went left', right: 'went right', ok: 'passed' }[o] || o;
    return w + (lost > 0 ? ` (−${lost} HP)` : '') + ' · ' + st[2] + ' HP';
  }
  function autoEquip() {
    const ids = G.bestLoadout(S, S.delve.n);
    G.SLOTS.forEach((sl) => { S.eq[sl] = ids[sl]; });
    save(); render(); buzz(0);
    toast('Kitted out for ' + G.dungeonFor(S.delve.seed, S.delve.n).name + '.');
  }
  // ---- buffs ----
  function openBuffPick(id) {
    const q = G.findQ(S, id);
    if (!q) return;
    const def = G.questBuff(Object.assign({}, q, { buff: null }), q.stat, q.diff - 1);
    const opt = (k, label) => `<div class="tl ${(q.buff || '') === k ? 'cur' : ''}" data-m="buff-set" data-id="${id}" data-v="${k}"><span class="tn">${k ? G.BUFFS[k].i : '↺'}</span><span class="tw">${label}</span></div>`;
    openSheet(`<h3>${esc(q.icon)} ${esc(q.name)}</h3><p class="lore">What doing this leaves behind for the next run. Stronger and longer the harder the quest. Not every quest needs one.</p><div class="tladder">
      ${opt('', 'Default: ' + (def.type ? G.BUFFS[def.type].n + ' (' + G.BUFFS[def.type].what(G.BUFFS[def.type].amt[q.diff - 1]) + ')' : 'no buff, just the XP (small or often-repeated deeds)'))}
      <div class="tl ${q.buff === 'none' ? 'cur' : ''}" data-m="buff-set" data-id="${id}" data-v="none"><span class="tn">∅</span><span class="tw">No buff: this one is just for the XP and the stat</span></div>
      ${G.BUFF_ORDER.map((k) => opt(k, G.BUFFS[k].n + ': ' + G.BUFFS[k].what(G.BUFFS[k].amt[q.diff - 1]))).join('')}</div>`, 'buff');
  }
  // ---- orders ----
  function viewOrders() {
    const d = S.delve, O = d.orders, n = d.n, seen = d.seen[n] || {}, ev = O.ev[n] || {}, known = d.known[n] || {};
    const seg = (k, cur, opts) => `<div class="dseg">${opts.map((o) => `<button class="${String(cur) === String(o[0]) ? 'on' : ''}" data-act="delve-order" data-k="${k}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
    const pot = O.potion ? (O.potion.m === 'below' ? 'b' + O.potion.p : O.potion.m) : 'ask';
    let h = `<div class="omen" style="text-align:center">Standing orders for when he's down there. Anything he hasn't been told, he asks about on a run you watch, and guesses on a run he takes alone.</div>`;
    h += `<div class="hd">Flasks</div>${seg('potion', pot, [['ask', 'Ask me'], ['b35', 'Below 35%'], ['b50', 'Below 50%'], ['boss', 'Boss only'], ['never', 'Never']])}`;
    h += `<div class="hd">Weapon arts<small>2× damage, 4 MP</small></div>${seg('arts', O.arts, [['all', 'Every fight'], ['boss', 'Boss only'], ['never', 'Never']])}`;
    h += `<div class="hd">He goes alone at</div>${seg('autoAt', d.autoAt, [['18:00', '6 pm'], ['19:00', '7 pm'], ['20:00', '8 pm'], ['21:00', '9 pm'], ['22:00', '10 pm']])}`;
    h += `<div class="hd">Watching a run</div>${seg('crawl', S.settings.crawl === false ? 'log' : 'scene', [['scene', 'Show the crawl'], ['log', 'Just the log']])}`;
    // leaving home sends him
    const A = d.away, info = N && N.awayInfo ? JSON.parse(N.awayInfo() || '{}') : null, perm = info && info.fine && info.bg;
    h += `<div class="hd">When you leave home<small>optional · uses location</small></div>
      <div class="set"><div class="l">${A.on ? (perm ? 'On' : 'On, but location is off') : 'Off'}<small>${A.on && perm ? (A.home ? `Home is set. More than ${A.r} m away and he goes, checked every couple of hours.` : 'No home set yet.') : 'Every couple of hours the phone checks whether you\u2019re out. If you are and he hasn\u2019t been today, he goes. Needs location set to \u201cAllow all the time\u201d.'}</small></div>
      <button class="btn small" data-act="away-toggle">${A.on ? 'Turn off' : 'Turn on'}</button></div>`;
    if (A.on) h += `${!perm ? '<button class="btn wide" data-act="away-perm" style="margin-top:8px">Allow location</button>' : ''}<div class="btns"><button class="btn" data-act="away-home">${A.home ? 'Move home here' : 'Set home here'}</button></div>${seg('awayR', A.r, [[200, '200 m'], [300, '300 m'], [500, '500 m'], [1000, '1 km']])}`;
    const keys = Object.keys(seen);
    h += `<div class="hd">In ${esc(G.dungeonFor(d.seed, n).name)}<small>${keys.length ? 'what he knows about' : 'nothing yet'}</small></div>`;
    if (!keys.length) h += '<div class="empty">He hasn’t been down yet. Choices turn up here once he has seen them.</div>';
    keys.forEach((id) => {
      const e = seen[id], cur = ev[id] || 'ask';
      if (e.kind === 'chesto') h += `<div class="ord"><div class="on">🧰 A chest<small>${e.known === 'tele' ? 'It throws him back to the start.' : e.known === 'mimic' ? 'A mimic.' : e.known === 'snap' ? 'A needle in the lock.' : 'He can’t tell what it holds.'}</small></div>${seg('ev:' + id, cur, [['ask', 'Ask'], ['open', 'Open it'], ['leave', 'Leave it']])}</div>`;
      else if (e.kind === 'chest') h += `<div class="ord"><div class="on">🧰 A chest holding ${esc(e.item.name)}<small>${esc(G.SLOT_NAME[e.item.slot])} · ${esc(RAR[e.item.tier].n)}${esc(G.itemExtra(e.item))}</small></div>${seg('ev:' + id, cur, [['ask', 'Ask'], ['equip', 'Put it on'], ['stash', 'Stash it']])}</div>`;
      else if (e.kind === 'fountain') h += `<div class="ord"><div class="on">⛲ A dark fountain<small>${known[id] ? (e.tainted ? 'Tainted. Don’t.' : 'Clean. It heals.') : 'Unknown water'}</small></div>${seg('ev:' + id, cur, [['ask', 'Ask'], ['drink', 'Drink'], ['skip', 'Leave it']])}</div>`;
      else if (e.kind === 'goblin') h += `<div class="ord"><div class="on">👺 A goblin trader<small>${esc(e.give)} for ${esc(e.get.name)} (${esc(RAR[e.get.tier].n)}${esc(G.itemExtra(e.get))})</small></div>${seg('ev:' + id, cur, [['ask', 'Ask'], ['trade', 'Trade'], ['decline', 'No deal']])}</div>`;
      else if (e.kind === 'toll') h += `<div class="ord"><div class="on">🛑 A toll warden<small>${e.price} gold to pass, or a fight</small></div>${seg('ev:' + id, cur, [['ask', 'Ask'], ['pay', 'Pay'], ['fight', 'Fight']])}</div>`;
      else if (e.kind === 'wanderer') h += `<div class="ord"><div class="on">🧑 A wounded stranger<small>a flask to help</small></div>${seg('ev:' + id, cur, [['ask', 'Ask'], ['help', 'Help'], ['pass', 'Walk on']])}</div>`;
      else if (e.kind === 'shrine') h += `<div class="ord"><div class="on">🕯 A shrine<small>${e.boon ? ({ mend: 'It mends.', might: 'It lends strength.', toll: 'It takes a flask and pays in gold.', bane: 'It takes its due. Don’t.' }[e.boon]) : 'Unknown'}</small></div>${seg('ev:' + id, cur, [['ask', 'Ask'], ['kneel', 'Kneel'], ['pass', 'Walk on']])}</div>`;
      else if (e.kind === 'fork') {
        const sd = e.sides || { a: 'left', b: 'right', c: 'ahead' }, Up = (t) => t.charAt(0).toUpperCase() + t.slice(1), note = (k) => (k == null ? 'not tried' : k >= 9999 ? 'beat him' : k < 0 ? `mended ${-k} HP` : `cost ${k} HP`);
        const allK = e.ways.every((w) => w.c != null), bestW = allK ? e.ways.reduce((b, w) => ((w.c >= 9999 ? 1e9 : w.c) < (b.c >= 9999 ? 1e9 : b.c) ? w : b), e.ways[0]) : null;
        h += `<div class="ord"><div class="on">⑂ A fork<small>${e.ways.map((w) => `${Up(sd[w.id.slice(-1)])}: ${esc(w.say)} (${note(w.c)}${w.note ? ', ' + esc(w.note.replace(/\.$/, '').toLowerCase()) : ''})${bestW === w ? ' ★' : ''}${w.snare ? ' · snare spotted' : ''}${w.glint ? ' · something glints' : ''}`).join(' · ')}${e.easy ? ' · ' + esc(e.easy) + ' eases the guard' : ''}</small></div>${seg('ev:' + id, cur, [['ask', 'Ask']].concat(e.ways.map((w) => [w.id.slice(-1), Up(sd[w.id.slice(-1)])])))}</div>`;
      }
    });
    return h;
  }
  function setOrder(k, v) {
    const d = S.delve, O = d.orders;
    if (k === 'potion') O.potion = v === 'ask' ? null : v === 'boss' ? { m: 'boss' } : v === 'never' ? { m: 'never' } : { m: 'below', p: Number(v.slice(1)) };
    else if (k === 'arts') O.arts = v;
    else if (k === 'autoAt') { d.autoAt = v; save(); if (N && N.delveArm) N.delveArm(); }
    else if (k === 'awayR') d.away.r = Number(v);
    else if (k === 'crawl') S.settings.crawl = v !== 'log';
    else if (k.indexOf('ev:') === 0) { const id = k.slice(3), m = O.ev[d.n] = O.ev[d.n] || {}; if (v === 'ask') delete m[id]; else m[id] = v; }
    save(); render(); buzz(0);
  }
  function awayToggle() {
    const A = S.delve.away;
    if (A.on) { A.on = false; A.home = null; save(); if (N && N.forgetHome) N.forgetHome(); render(); return; }
    if (!N || !N.awayInfo) { toast('Only works on the phone.'); return; }
    A.on = true; save(); render();
    const info = JSON.parse(N.awayInfo() || '{}');
    if (!info.fine || !info.bg) N.askLocation(); else if (!A.home) setHomeHere();
  }
  window.onAwayPerm = function (fine, bg) {
    const A = S.delve.away;
    if (fine && bg) { if (!A.home) setHomeHere(); else render(); }
    else { toast(fine ? 'Needs \u201cAllow all the time\u201d to check while the app is shut.' : 'No location, no away check. The 8 pm fallback still works.'); render(); }
  };
  function setHomeHere() {
    if (!N || !N.hereNow) return;
    toast('Finding you…');
    N.hereNow('home');
  }
  window.__here = function (cb, loc) {
    if (!loc) { toast('Couldn\u2019t get a fix. Try again near a window.'); return; }
    S.delve.away.home = true; // the spot itself stays on the phone, outside the save
    save(); render();
    toast('Home set' + (loc.acc ? ' (±' + Math.round(loc.acc) + ' m).' : '.'));
  };
  // ---------- collections ----------
  function collData() {
    const B = S.delve.beasts || {}, mobs = [];
    G.THEMES.forEach((T) => T.mobs.forEach((m) => mobs.push({ name: m[0], theme: T, b: B[m[0]] || null })));
    const strangers = G.WANDERERS.map((w) => ({ w: w, n: S.npcs.find((x) => x.id === 'w-' + w[0]) || null }));
    const comps = G.CALLING_ORDER.map((k) => ({ k: k, n: S.npcs.find((x) => x.comp === k) || null }));
    const relics = Object.keys(G.DECOR).filter((k) => G.DECOR[k].unlock);
    const props = Object.keys(G.FURN).filter((k) => G.FURN[k].c !== 'core');
    return { mobs: mobs, strangers: strangers, comps: comps, relics: relics, props: props,
      rows: [
        ['beasts', '🐺', 'Bestiary', mobs.filter((m) => m.b).length, mobs.length], ['bosses', '🏆', 'Bosses felled', S.delve.trophies.length, null],
        ['relics', '🏺', 'Relics', relics.filter((k) => S.decor.owned.indexOf(k) >= 0).length, relics.length], ['comps', '🤝', 'Companions', comps.filter((c) => c.n && c.n.status === 'resident').length, comps.length],
        ['strangers', '🚪', 'Strangers taken in', strangers.filter((x) => x.n && x.n.status === 'resident').length, strangers.length], ['props', '🪑', 'Props owned', props.filter((k) => G.furnOwned(S, k) > 0).length, props.length],
        ['targets', '🎯', 'Targets met', S.marks.filter((m) => m.done).length, S.marks.length || null], ['seasons', '🍂', 'Seasons played', S.seasons.length + 1, null],
        ['end', '🏁', 'The road to the end', G.contentState(S).list.filter((x) => x.ok).length, 5],
      ] };
  }
  function openColl(k) {
    const C = collData(); let h = '';
    if (k === 'beasts') h = '<h3>Bestiary</h3>' + G.THEMES.map((T) => `<div class="lbl">${esc(T.name.replace(/^the /, 'The '))}</div>` + C.mobs.filter((m) => m.theme === T).map((m) => `<div class="kv"><span>${m.b ? esc(m.name) : '? ? ?'}</span><b>${m.b ? (m.b.slain ? `beaten × ${m.b.slain}` : 'met, not beaten') : ''}</b></div>`).join('')).join('');
    else if (k === 'strangers') h = '<h3>Strangers</h3>' + C.strangers.map((x) => `<div class="kv"><span>${x.n ? esc(x.n.name) + ', ' + esc(x.w[3].toLowerCase()) : '? ? ?'}</span><b style="font:500 14px var(--gar)">${x.n ? (x.n.status === 'resident' ? 'lives here' : 'at the gate') : 'level ' + x.w[1]}</b></div>`).join('');
    else if (k === 'bosses') h = '<h3>Bosses felled</h3>' + (S.delve.trophies.slice().reverse().map((x) => `<div class="kv"><span>${esc(x.boss)}</span><b style="font:500 14px var(--gar)">${esc(x.name.replace(/^the /, ''))}</b></div>`).join('') || '<div class="empty">None yet.</div>');
    else if (k === 'seasons') { openSeason(); return; }
    else if (k === 'end') {
      const E = G.contentState(S);
      h = '<h3>The road to the end</h3><p class="lore">About a year of steady deeds. When all five are done, the Victor’s Statue is yours and New Game+ opens.</p>' +
        E.list.map((x) => `<div class="kv"><span>${x.ok ? '✓ ' : ''}${esc(x.text)}</span><b style="font:500 14px var(--gar)">${x.have} of ${x.of}</b></div>`).join('') +
        (S.legacy && S.legacy.length ? '<div class="lbl" style="margin-top:12px">Heroes before</div>' + S.legacy.map((x) => `<div class="kv"><span>${esc(x.name)}</span><b style="font:500 14px var(--gar)">level ${x.level} · ${x.dungeons} dungeons · ${esc(x.finished)}</b></div>`).join('') : '') +
        (E.on ? `<p class="lore" style="margin-top:12px">Everything was done on ${esc(E.on)}. From here it all comes round again, Reborn, and keeps climbing.</p><div class="btns"><button class="btn" data-m="close">Close</button><button class="btn prime" data-m="ngp-ask">New Game+</button></div>` : '');
    }
    else if (k === 'relics') { goto('status:relics'); return; }
    else if (k === 'comps') { openHousehold(); return; }
    else if (k === 'targets') { goto('quests:vows'); return; }
    else return;
    UI.sheet = null;
    openSheet(h + '<div class="btns"><button class="btn" data-m="close">Close</button></div>', 'coll');
  }
  function viewTrophies() {
    const nr = (S.delve.hist || []).length, C = collData();
    return `<div class="hd">Collections</div>` + C.rows.map((r) => `<div class="row" data-act="coll" data-v="${r[0]}"><div class="ri">${r[1]}</div><div class="rb"><div class="rn">${r[2]}</div>${r[4] ? `<div class="pb2"><i style="width:${Math.round((r[3] / r[4]) * 100)}%"></i></div>` : ''}</div><b class="cn">${r[3]}${r[4] ? '/' + r[4] : ''}</b></div>`).join('') +
      `<div class="hd">Run history</div><div class="set"><div class="l">Export runs for analysis<small>${nr ? nr + ' detailed run' + (nr > 1 ? 's' : '') + ' recorded' : 'Detailed records start with your next run'}, plus your stats, buffs and recent deeds</small></div><button class="btn small" data-act="export-runs">Export</button></div>`;
  }
  // ---- the run itself ----
  function startRun() {
    const d = S.delve, t = G.today();
    if (G.delveOpens(S, t)) { toast('The way down opens tomorrow.'); render(); return; }
    if (!G.canRun(S)) { if (resolvePending()) save(); }
    const now = Date.now();
    d.day = t;
    d.pending = { t: now, day: t, eq: Object.assign({}, S.eq), answers: {}, manual: true };
    save();
    UI.run = { t: now, inp: G.inputFor(S, { t: now }), answers: {}, out: null, shown: 0, live: true };
    UI.run.out = G.simRun(UI.run.inp, UI.run.answers, true);
    openRunPlayer();
  }
  // ---- 2.18 the old roads: fight a cleared dungeon again, turn by turn, for stars ----
  const starRow = (n, of) => `<span class="stars">${Array.from({ length: of || G.ROAD_STARS }, (_, i) => `<i class="${i < n ? 'on' : ''}">★</i>`).join('')}</span>`;
  function sparBlock() {
    const t = G.today(), st = G.sparState(S, t);
    if (!st.cleared) return '';
    if (UI.sparN == null || UI.sparN >= st.cleared) { UI.sparN = st.cleared - 1; for (let n = st.cleared - 1; n >= 0; n--) if (G.roadStars(S, n) < G.ROAD_STARS) { UI.sparN = n; break; } }
    const D = G.dungeonFor(S.delve.seed, UI.sparN), have = G.roadStars(S, UI.sparN), full = have >= G.ROAD_STARS;
    const pips = `<span class="tpips">${Array.from({ length: st.max }, (_, i) => `<i class="${i < st.wind ? 'on' : ''}"></i>`).join('')}</span>`;
    return `<div class="hd">The old roads<small>${st.stars}/${st.of} stars</small></div>
      <p class="lore" style="margin-top:0">Fight through a dungeon you have already cleared, turn by turn. Each run is rated out of five stars, and each star pays once. No XP, no loot, no progress: those still come from deeds.</p>
      <div class="kv"><span>Wind ${pips}</span><b>${st.wind}/${st.max}</b></div>
      <div class="set"><div class="l">${D.icon} ${esc(D.name.replace(/^the /, 'The '))}<small>Dungeon ${UI.sparN + 1} · ${starRow(have)} ${full ? 'nothing left to win here' : '◈ ' + G.starGold(D.gold) + ' a star'}</small></div><div class="stepper"><button data-act="spar-n" data-v="-1">−</button><span>${UI.sparN + 1}</span><button data-act="spar-n" data-v="1">+</button></div></div>
      <button class="btn wide" data-act="spar-go" ${st.ok ? '' : 'disabled'}>${st.ok ? `Take the road · ${st.cost} wind` : esc(st.why)}</button>`;
  }
  function startSpar() {
    const t = G.today(), now = Date.now();
    if (!G.sparStart(S, t)) { toast((G.sparState(S, t).why || 'Not now') + '.'); return; }
    save();
    const inp = G.sparInput(S, UI.sparN | 0, { t: now }), st = UI.duel = G.duelNew(inp, now % 2147483647, S.inv);
    const m = $('#modal'); m.className = ''; UI.sheet = 'duel';
    m.innerHTML = '<div class="duel"><div class="dscene" data-m="duel-hurry"></div><div class="dpanel"></div></div>';
    // the dungeon itself, as on a real run: he walks it, and the fight comes up when he meets something
    const el = $('#modal .dscene'), D = G.dungeonFor(S.delve.seed, st.n);
    st.scene = null;
    if (window.Crawl && window.LPC && window.House2D && S.settings.crawl !== false) {
      try {
        const c = inp.comp; let comp = null;
        if (c && !c.sulk) { const n = (S.npcs || []).find((x) => x.id === c.id); comp = Object.assign({}, c, n && n.kind !== 'bird' ? { look: G.normLook(n.look), gear: G.npcGear(n) } : {}); }
        const sc = new window.Crawl(el, { base: '2d/', D: D, seed: S.delve.seed, name: (S.hero && S.hero.name) || '', look: G.normLook(S.look), eq: Object.assign({}, inp.eq), el: inp.eq.weapon && inp.eq.weapon.el, comp: comp });
        st.scene = sc; st.busy = true;
        sc.ready.catch(() => null).then(() => { if (UI.duel !== st) return; if (!sc.rooms) { sc.dispose(); st.scene = null; el.remove(); st.busy = false; duelPaint(); return; } const t0 = sc.play({ k: 'enter', hp: st.hp, hpMax: st.H.hpMax }); setTimeout(() => duelMeet(st), Math.min(1500, t0)); });
      } catch (e) { st.scene = null; }
    }
    if (!st.scene) el.remove();
    duelPaint();
  }
  // He walks to the next fight; the moves come up when he gets there.
  function duelMeet(st) {
    if (UI.duel !== st) return;
    const f = st.enc[st.i]; let ms = 0;
    if (st.scene) { try { ms = st.scene.duelEnter(f.st, { n: f.name, tags: f.tags, c: f.count, boss: f.boss }, st.grp.map((e) => ({ id: e.id, hp: e.hp }))); } catch (e) { ms = 0; } }
    st.busy = true; st.walking = ms > 600; duelPaint();
    clearTimeout(st.bt);
    st.bt = setTimeout(() => { if (UI.duel === st) { st.busy = false; st.walking = false; duelPaint(); } }, ms + 150);   // 2.20: all of it, never cut short (a long road once let him be sent on mid-walk)
  }
  // a tap on the scene while he is walking: he gets there now
  function duelHurry() {
    const st = UI.duel; if (!st || !st.walking || !st.scene) return;
    clearTimeout(st.bt); try { st.scene.land(); } catch (e) { /* nothing to land */ }
    st.busy = false; st.walking = false; duelPaint();
  }
  // 2.21: the fight screen. Foes show what they'll do (and what's on them), he has six moves, and Gear opens the pack.
  const chips = (list) => list.filter(Boolean).map((c) => `<i class="dchip ${c[1] || ''}">${esc(c[0])}</i>`).join('');
  function duelPaint() {
    const st = UI.duel, m = $('#modal'); if (!st) return;
    const H = st.H, bar = (v, max, cls) => `<div class="dbar ${cls}"><i style="width:${Math.max(0, Math.min(100, 100 * v / max))}%"></i><span>${Math.max(0, Math.round(v))}/${Math.round(max)}</span></div>`;
    const foes = st.grp.map((e) => {
      const dead = e.hp <= 0, it = !dead && G.duelIntent(st, e), it2 = !dead && e.it2 && G.duelIntent(st, e, e.it2);
      return `<div class="dfoe ${dead ? 'dead' : ''} ${!dead && e.id === st.tgt ? 'tgt' : ''} ${e.boss ? 'boss' : ''}" data-m="duel-tgt" data-id="${e.id}"><div class="dn">${esc(e.name)}</div>${bar(e.hp, e.max, 'foe')}
        <div class="dit ${it ? it[2] : ''}">${dead ? 'down' : it ? it[0] + ' ' + esc(it[1]) + (it2 ? ' <b>+ ' + it2[0] + ' ' + esc(it2[1]) + '</b>' : '') : ''}</div>
        ${dead ? '' : `<div class="dchips">${chips([e.bleed > 0 && ['bleeding ' + e.bleed, 'bad'], e.blind > 0 && ['blinded ' + e.blind, 'good'], e.howl > 0 && ['emboldened ' + e.howl, 'warn'], (e.tags || []).length && [(e.tags || []).map((t) => G.TAGS[t] || t).join(' · '), 'tag']])}</div>`}</div>`;
    }).join('');
    const log = st.log.slice(-5).map((l) => `<div class="dl ${l.c}">${esc(l.s)}</div>`).join('');
    let foot;
    if (st.res) {
      if (!st.paid) { const R0 = G.duelStars(st); st.paid = G.roadsPay(S, G.today(), st.n, R0.mask, st.gold); st.rating = R0; save(); if (st.res === 'clear') Sfx.play('coin'); }
      const R0 = st.rating, P = st.paid;
      foot = `<div class="dres"><b>${st.res === 'clear' ? 'The road is walked.' : 'Beaten on an old road.'}</b>${starRow(R0.n)}
        ${R0.list.map((x, i) => `<div class="dstar ${x.ok ? 'ok' : ''}">${x.ok ? '★' : '☆'} ${esc(x.text)}${P.fresh & (1 << i) ? ' <em>new</em>' : ''}</div>`).join('')}
        <p class="lore" style="text-align:center;margin:8px 0 0">${P.gold ? `+${P.gold} gold for ${P.n} new star${P.n > 1 ? 's' : ''}. ` : st.res === 'clear' ? 'No new stars this time. ' : 'No harm done, and nothing won. '}${P.total}/${G.ROAD_STARS} held here${P.total >= G.ROAD_STARS ? ': nothing left to win.' : '.'}</p></div>
        <button class="btn wide prime" data-m="duel-done">Done</button>`;
    } else if (st.between) foot = `<button class="btn wide prime" data-m="duel-next">On to ${st.i + 1 >= st.enc.length - 1 ? esc(st.enc[st.enc.length - 1].name) : 'the next'} ›</button>`;
    else if (st.picking) {
      const L = G.duelGear(st);
      foot = `<div class="dgear"><div class="dgh">Change into… <small>it takes his turn</small><button class="x" data-m="duel-gear-x">✕</button></div>
        ${L.map((it) => { const cur = st.eq[it.slot], d = G.power(it) - (cur ? G.power(cur) : 0), K = it.slot === 'weapon' ? (G.KINDS[it.art] ? G.KINDS[it.art].n : 'Blade') : it.slot === 'off' && G.DUEL_OFF[it.art] ? G.DUEL_OFF[it.art].n : '';
          return `<div class="dgi" data-m="duel-swap" data-id="${it.id}"><div class="dgin" style="color:${RAR[it.tier].c}">${esc(it.name)}</div><div class="dgs">${esc(G.SLOT_NAME[it.slot])}${K ? ' · ' + esc(K) : ''}${G.elemText(it) ? ' · ' + esc(G.elemText(it)) : ''} · <i class="${d > 0 ? 'pup' : d < 0 ? 'pdn' : ''}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} power</i>${cur ? ' vs his ' + esc(cur.base.toLowerCase()) : ''}</div></div>`; }).join('') || '<p class="lore">Nothing in the pack worth the turn.</p>'}</div>`;
    } else {
      const mv = G.duelMoves(st);
      foot = `<div class="dacts">${mv.map((x) => `<button class="btn ${x.k === 'strike' ? 'prime' : ''} ${x.cd ? 'cool' : ''}" data-m="duel-act" data-v="${x.k}" ${x.ok ? '' : 'disabled'}><b>${esc(x.label)}</b><small>${esc(x.note)}</small></button>`).join('')}</div>
        ${UI.duelHelp ? `<div class="dhelp">${mv.map((x) => `<p><b>${esc(x.label)}</b>: ${esc(x.tip)}</p>`).join('')}<p><b>Their moves</b>: a wind-up, a charge or a take-off means a heavy blow next round: guard it, or stagger them out of it. A brace soaks most of a blow (blunt weapons break it). Fliers in the air take little from anything but a polearm or a staff. Casters hex, drain and mend: kill them first. Deeper roads know more of these.</p></div>` : ''}`;
    }
    const me = chips([st.guard && ['guarding', 'good'], !st.guard && st.counter && ['ready to counter', 'good'], st.parry && ['parry ready', 'good'], st.me && st.me.poison > 0 && ['poisoned ' + st.me.poison, 'bad'], st.me && st.me.hex > 0 && ['hexed ' + st.me.hex, 'bad']]);
    const html = `<div class="dtop"><span>${st.icon} ${esc(st.name.replace(/^the /, 'The '))}</span><span>${Math.min(st.i + 1, st.enc.length)}/${st.enc.length} · round ${st.rounds}/${st.par}</span><button class="x dq" data-m="duel-help" aria-label="How it works">?</button><button class="x" data-m="duel-quit">✕</button></div>
      <div class="dfoes">${foes}</div><div class="dlog">${log}</div>
      <div class="dhero"><div class="dn">${esc(st.hero)} <span class="dchips">${me}</span></div>${bar(st.hp, H.hpMax, 'hp')}${bar(st.mp, H.mpMax, 'mp')}<div class="dfl">${'🧪'.repeat(Math.max(0, st.flasks)) || 'no flasks'} <small>${esc((G.KINDS[H.kind] || G.KINDS.fists).n)}${H.el ? ' · ' + esc(G.ELEMENTS[H.el].n.toLowerCase()) : ''}${st.eq.off ? ' · ' + esc(st.eq.off.base.toLowerCase()) : ''}</small></div></div>
      <div class="dfoot ${st.busy && !st.res ? 'busy' : ''}">${foot}${st.walking && !st.res ? '<div class="dwalk">On the road… tap the picture to skip the walk</div>' : ''}</div>`;
    const pn = m.querySelector('.dpanel'); if (pn) pn.innerHTML = html;
  }
  function duelAct(k, arg) {
    const st = UI.duel; if (!st || st.busy) return;
    if (k === 'gear' && arg == null) { st.picking = true; duelPaint(); return; }
    st.picking = false;
    const r0 = st.rounds; G.duelAct(st, k, st.tgt, arg); if (st.rounds === r0) { duelPaint(); return; }
    buzz(0); Sfx.play(st.res === 'dead' ? 'bad' : 'tick');
    let ms = 0;
    if (st.scene && k === 'gear') { try { st.scene.reGear(st.eq); } catch (e) { /* the picture keeps the old kit */ } }
    if (st.scene) { try { ms = st.scene.duelRound(st.ev, st.hp); if (st.res || st.between) st.scene.duelEnd(st.res, !!st.res); } catch (e) { ms = 0; } }
    st.busy = ms > 0; duelPaint();
    clearTimeout(st.bt);
    if (ms > 0) st.bt = setTimeout(() => { if (UI.duel === st) { st.busy = false; duelPaint(); } }, ms + 150 + (st.res ? 900 : 0));
  }
  function duelClose() { const st = UI.duel; if (st && st.scene) st.scene.dispose(); UI.duel = null; closeModal(); render(); }
  function watchLast() {
    const L = S.delve.last;
    if (!L || !L.log) { goto('delve:'); return; }
    L.seen = true; save();
    UI.run = { t: L.t, replay: true, out: { log: L.log, res: L.res, gold: L.gold, short: null }, last: L, shown: 0 };
    openRunPlayer();
  }
  function openRunPlayer() {
    const m = $('#modal');
    m.className = '';
    m.innerHTML = '<div class="runp' + (S.settings.crawlBig ? ' big' : '') + '"><div class="rp-top"></div><div class="rp-scene" data-m="run-big"></div><div class="rp-log"></div><div class="rp-foot"></div></div>';
    UI.sheet = 'run';
    const R = UI.run;
    runScene();
    runPaint();
    // wait for the scene to load (but not forever: the log alone still tells it)
    const go = () => { if (UI.run === R && !R.started) { R.started = true; runTick(); } };
    if (R.scene) { Promise.race([R.scene.ready.catch(() => null), new Promise((res) => setTimeout(res, 2500))]).then(go); } else go();
  }
  // Who came along, for a replay: the save keeps only their name.
  function replayComp(name) {
    const n = (S.npcs || []).find((x) => x.name === name);
    if (!n) return null;
    if (n.kind === 'bird') return { id: n.id, name: n.name, bird: true, role: G.BIRD_ROLE[n.id] };
    return { id: n.id, name: n.name, role: n.comp && G.CALLINGS[n.comp] ? n.comp : G.COMP_ROLES[n.role] && !G.BIRD_ROLE[n.role] ? n.role : 'fighter', el: n.el || null };
  }
  // The crawl itself, drawn above the log (delve2d.js). Without it the log plays on its own, as before.
  function runScene() {
    const R = UI.run, el = $('#modal .rp-scene');
    if (!el) return;
    const D = R.out.dungeon || (R.last && R.last.n != null ? G.dungeonFor(S.delve.seed, R.last.n) : null);
    if (!window.Crawl || !window.LPC || !window.House2D || !D || S.settings.crawl === false) { el.remove(); return; }
    const c = R.inp ? R.inp.comp : R.last && R.last.comp ? replayComp(R.last.comp) : null;
    let comp = null;
    if (c && !c.sulk) {
      const n = (S.npcs || []).find((x) => x.id === c.id);
      comp = Object.assign({}, c, n && n.kind !== 'bird' ? { look: G.normLook(n.look), gear: G.npcGear(n) } : {});
    }
    const eq = R.inp ? Object.assign({}, R.inp.eq) : gearItems();
    try {
      R.scene = new window.Crawl(el, { base: '2d/', D: D, seed: S.delve.seed, name: (S.hero && S.hero.name) || '', look: G.normLook(S.look), eq: eq, el: eq.weapon && eq.weapon.el, comp: comp });
      R.scene.onHp = (v, max) => { if (UI.run !== R) return; const b = $('#modal .rp-bars .bar.hp'); if (!b || !max) return; b.querySelector('i').style.width = Math.max(0, v / max * 100) + '%'; b.querySelector('span').textContent = v + ' / ' + max + ' HP'; };
      R.scene.ready.catch(() => { if (R.scene) R.scene.dispose(); R.scene = null; el.remove(); });
    } catch (e) { R.scene = null; el.remove(); }
  }
  function runLine(l) { return `<div class="rl k-${l.k}">${esc(l.s)}</div>`; }
  function runPaint() {
    const R = UI.run, m = $('#modal .runp');
    if (!R || !m) return;
    const log = R.out.log, P0 = R.out.pause && R.shown >= log.length && !R.hold && R.out.pause.hp != null ? R.out.pause : null;
    // the bars show where the shown log has got to, or, at a question, where he stands as it's asked
    const last = P0 || log[Math.max(0, R.shown - 1)] || log[0];
    const D = R.out.dungeon || (R.last ? { name: R.last.name } : { name: '' });
    const cmp = R.inp && R.inp.comp && !R.inp.comp.sulk ? R.inp.comp : null;
    m.querySelector('.rp-top').innerHTML = `<div class="rp-n">${esc(D.name.replace(/^the /, 'The '))}${cmp ? `<small> with ${esc(cmp.name)}</small>` : ''}</div>
      <div class="rp-bars"><div class="bar hp"><i style="width:${last ? Math.max(0, last.hp / last.hpMax * 100) : 100}%"></i><span>${last ? last.hp + ' / ' + last.hpMax : ''} HP</span></div>
      <div class="bar mp"><i style="width:${last && last.mpMax ? Math.max(0, last.mp / last.mpMax * 100) : 100}%"></i><span>${last ? last.mp + ' / ' + last.mpMax : ''} MP</span></div><div class="fl">🧪 ${last ? last.fl : ''}</div></div>`;
    const lg = m.querySelector('.rp-log'), have = lg.children.length;
    if (have > R.shown) lg.innerHTML = '';
    for (let i = lg.children.length; i < R.shown; i++) lg.insertAdjacentHTML('beforeend', runLine(log[i]));
    if (lg.children.length !== have) lg.scrollTop = lg.scrollHeight;
    const foot = m.querySelector('.rp-foot');
    const atEnd = R.shown >= log.length && !R.hold;
    let fh;
    if (atEnd && R.out.pause) {
      const P = R.out.pause;
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      fh = `<div class="rp-q">${esc(P.prompt)}</div>${P.item ? cmpHtml(P.item, R.inp.eq[P.item.slot] || null, R.inp) : ''}<div class="rp-opts">${P.options.map((o, i) => `<button class="btn ${(P.was != null ? same(o.v, P.was) : P.def != null ? same(o.v, P.def) : i === 0) ? 'prime' : ''}" data-m="run-pick" data-v="${i}">${esc(o.label)}${P.was != null && same(o.v, P.was) ? ' (last time)' : ''}</button>`).join('')}</div><div class="rp-hint">It’s your call while you watch. He’ll do the same when you aren’t there. <b data-m="run-skip">Let him decide the rest ›</b></div>`;
    } else if (atEnd && R.out.res) {
      const fresh = R.out.res === 'clear' && !R.replay && !R.spar, onward = fresh && !G.delveOpens(S) ? G.dungeonFor(S.delve.seed, S.delve.n) : null;
      // 2.22: one new dungeon a day, so after a clear the way on is shut till tomorrow
      fh = runResult() + (onward ? `<div class="btns" style="margin-top:6px"><button class="btn" data-m="run-done">Done</button><button class="btn prime" data-m="run-again">Onward: ${esc(onward.name.replace(/^the /, 'The '))} ›</button></div>` : (fresh ? `<div class="lore" style="text-align:center;margin:4px 0 6px">The way down to ${esc(G.dungeonFor(S.delve.seed, S.delve.n).name)} opens tomorrow.</div>` : '') + '<button class="btn wide prime" data-m="run-done">Done</button>');
    } else fh = '<button class="btn wide" data-m="run-skip">Skip ›</button>';
    if (foot.dataset.h !== fh) { foot.innerHTML = fh; foot.dataset.h = fh; lg.scrollTop = lg.scrollHeight; }
  }
  function runResult() {
    const R = UI.run, o = R.out, L = R.last || S.delve.last || {};
    if (R.spar) return o.res === 'clear' ? `<div class="rp-res win"><b>${esc(L.boss || 'The boss')} falls again.</b><span>${L.gold ? '+' + L.gold + ' gold' : 'No gold: the day’s share from the old roads is spent'}</span><span class="dim">Nothing else comes home from an old road.${L.capped && L.gold ? ' That is the last of today’s share.' : ''}</span></div>`
      : `<div class="rp-res"><b>Beaten on an old road.</b><span>No harm done, and nothing won.</span><span class="dim">The wind is spent all the same.</span></div>`;
    if (o.res === 'clear') return `<div class="rp-res win"><b>${esc(L.boss || 'The boss')} falls.</b><span>+${L.gold} gold${L.loot && L.loot.length ? ' · ' + L.loot.map(esc).join(', ') : ''}</span><span class="dim">The next dungeon is open. It's worse. ${R.replay ? '' : (S.look.sex === 'f' ? 'Her' : 'His') + ' buffs are still up, if you want to push on.'}</span></div>`;
    const rec = (S.delve.rec[L.n] || []).slice(-1)[0];
    const kept = rec && rec.kept && rec.kept.length ? ` Still in the pack: ${rec.kept.map(esc).join(', ')}.` : '';
    if (S.look.sex === 'f') return `<div class="rp-res"><b>She didn't make it.</b><span>${esc((rec && rec.short) || '')}</span><span class="dim">Only what was stashed comes home until the boss falls.${kept} Try again when something's changed.</span></div>`;
    return `<div class="rp-res"><b>He didn't make it.</b><span>${esc((rec && rec.short) || '')}</span><span class="dim">Only what was stashed comes home until the boss falls.${kept} Try again when something's changed: a deed, better kit, someone to help.</span></div>`;
  }
  function runTick() {
    const R = UI.run;
    clearTimeout(runTick.t);
    if (!R || UI.sheet !== 'run') return;
    const log = R.out.log;
    if (R.shown < log.length) {
      // one beat: this line, plus any that belong with the next (a boss's tricks go with how the fight ended)
      let j = R.shown;
      while (j < log.length - 1 && log[j].join) j++;
      const group = log.slice(R.shown, j + 1), last = group[group.length - 1];
      R.hold = true; // the question or the result waits for the beat to play out
      const ms = R.scene && (R.played | 0) <= R.shown ? R.scene.play(group) : 0;
      R.played = j + 1;
      const wait = ms || (last.k === 'walk' ? 900 : last.k === 'boss' || last.k === 'death' || last.k === 'win' ? 2000 : 1500);
      // with the scene, a line shows in the log once its beat has played; without it, the log paces itself
      if (!R.scene) { R.shown = j + 1; if (last.k === 'death' || last.k === 'win') buzz(1); }
      runPaint();
      runTick.t = setTimeout(() => {
        if (UI.run !== R) return;
        if (R.scene) { R.shown = j + 1; if (last.k === 'death' || last.k === 'win') buzz(1); }
        runTick();
      }, wait);
      return;
    }
    R.hold = false;
    if (R.out.res && !R.replay && !R.applied) finishRun();
    runPaint();
  }
  function runSkip() {
    const R = UI.run;
    if (!R) return;
    clearTimeout(runTick.t);
    // 2.11: Skip hands the rest of the run to him: standing orders, then his own judgement
    if (!R.out.res && !R.replay) { R.answers.__auto = true; R.out = G.simRun(R.inp, R.answers, true); }
    if (R.scene) R.scene.fastForward(R.out.log.slice(Math.max(R.shown, R.played | 0)));
    R.shown = R.played = R.out.log.length; R.hold = false;
    if (R.out.res && !R.replay && !R.applied) finishRun();
    runPaint();
  }
  function runPick(i) {
    const R = UI.run, d = S.delve;
    if (!R || !R.out.pause) return;
    const P = R.out.pause, o = P.options[i];
    if (R.spar) { if (P.kind === 'potion') { if (o.v.now) R.answers[o.v.now] = true; else R.answers.potion = o.v; } else R.answers[P.id] = o.v; }
    else if (P.kind === 'potion') { if (o.v.now) R.answers[o.v.now] = true; else { R.answers.potion = o.v; d.orders.potion = o.v; } }
    else { R.answers[P.id] = o.v; (d.orders.ev[d.n] = d.orders.ev[d.n] || {})[P.id] = o.v; }
    if (d.pending && !R.spar) d.pending.answers = Object.assign({}, R.answers);
    save(); buzz(0);
    R.out = G.simRun(R.inp, R.answers, true);
    runTick();
  }
  function finishRun() {
    const R = UI.run, d = S.delve;
    R.applied = true;
    if (R.spar) {   // an old road: a little gold if he cleared it, and nothing else touched
      const pay = { gold: 0 };
      R.last = { n: R.inp.n, boss: R.out.dungeon && R.out.dungeon.boss ? R.out.dungeon.boss.name : '', gold: pay.gold, capped: pay.capped, loot: [] };
      save(); return;
    }
    d.pending = null;
    G.applyRun(S, R.out, { t: R.t, day: d.day, solo: false, buffs: R.inp.buffs, inp: R.inp, sig: G.runSig(R.inp) });
    d.last.log = R.out.log; d.last.seen = true;
    R.last = d.last;
    save();
  }
  function closeRun() {
    clearTimeout(runTick.t);
    if (UI.run && UI.run.scene) UI.run.scene.dispose();
    UI.run = null;
    closeModal();
    render();
  }

  // ---------- the herald: deeds Claude logs to the Grindstone calendar ----------
  function heraldInfo() {
    if (!N || !N.heraldInfo) return { perm: false, write: false, cals: [], none: true };
    try { const o = JSON.parse(N.heraldInfo()); o.cals = o.cals || []; return o; } catch (e) { return { perm: false, cals: [] }; }
  }
  // Java writes the credits; we save first so it reads exactly what's on screen, then reload what it wrote.
  function heraldPoll() {
    if (!N || !N.heraldSync || !S || !S.herald.on) return;
    save();
    let r = null;
    try { r = JSON.parse(N.heraldSync() || '{}'); } catch (e) { r = null; }
    if (!r || !r.changed) return;
    load();
    if (UI.sheet && UI.sheet !== 'notice') renderTop(); else render();
    const line = heraldLine([r]);
    if (line) { buzz(1); toast(`From your calendar: ${line}. +${r.xp} XP`); }
    else if (r.unclaimed) toast(`Word of ${r.unclaimed} deed${r.unclaimed > 1 ? 's' : ''} the herald can’t place. See Today.`);
    if (r.levels > 0) setTimeout(() => showLevelUp({ level: r.level, levels: r.levels }), 900);
    if (r.unclaimed) maybeInterpret();
  }
  window.heraldPoll = heraldPoll;
  window.__dbg = { get duel() { return UI.duel; }, get run() { return UI.run; } };   // for the tests to look at the scene

  // ---------- the interpreter: an optional AI model that places deeds the herald can't ----------
  // 2.26: one AI connection, any provider. Checked November 2026: the free tiers need no card; limits change, so the
  // notes say what matters (cost, whether they learn from what you send, where the key comes from).
  const PROVIDERS = {
    groq: { name: 'Groq', free: 1, base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', note: 'Free, no card. Fast, and doesn’t train on what you send. Key: console.groq.com/keys' },
    gemini: { name: 'Gemini', free: 1, base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.8-flash', note: 'Free (the Flash models), no card. On the free tier Google may use, and people may read, what you send. Key: aistudio.google.com/apikey' },
    openrouter: { name: 'OpenRouter', free: 1, base: 'https://openrouter.ai/api/v1', model: 'openrouter/free', note: 'Free models, no card: 50 requests a day across them. “openrouter/free” picks one for you. Key: openrouter.ai/keys' },
    github: { name: 'GitHub', free: 1, base: 'https://models.github.ai/inference', model: 'openai/gpt-4.1-mini', note: 'Free with a GitHub account. Make a token with the “models: read” permission at github.com/settings/tokens.' },
    mistral: { name: 'Mistral', free: 1, base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', note: 'Free plan, no card. It trains on what you send unless you opt out in Mistral’s Admin panel. Key: console.mistral.ai' },
    claude: { name: 'Claude', free: 0, base: 'https://api.anthropic.com/v1', model: 'claude-haiku-5-5', note: 'Paid: needs a payment method on your Anthropic account. A consult costs a fraction of a cent. Key: console.anthropic.com' },
    custom: { name: 'Other', free: 0, base: '', model: '', note: 'Any OpenAI-compatible endpoint.' },
    cerebras: { name: 'Cerebras', hide: 1, base: 'https://api.cerebras.ai/v1', model: 'gpt-oss-120b', note: 'Trial credits only now, and they want a card first.' },
  };
  const aiName = () => { const ii = interpInfo(); return ii && ii.on ? (PROVIDERS[ii.provider] || PROVIDERS.custom).name : 'Claude'; };
  const ICBS = {};
  function interpInfo() { try { return N && N.interpInfo ? JSON.parse(N.interpInfo()) : null; } catch (e) { return null; } }
  // Each report gets one try; anything it can't place (or if it's off, resting or broken) simply waits on Today.
  function maybeInterpret() {
    if (!S || !S.herald.unclaimed.length) return;
    const info = interpInfo();
    if (!info || !info.on || info.resting || S.settings.interp === false) return;
    const items = S.herald.unclaimed.filter((u) => !u.tried).slice(-8);
    if (!items.length) return;
    const now = Date.now(), cb = 'i' + now;
    items.forEach((u) => { u.tried = now; });
    save();
    const quests = S.quests.filter((q) => !q.archived).map((q) => ({ id: q.id, name: q.name }));
    ICBS[cb] = true;
    try { N.interpret(JSON.stringify({ reports: items.map((u) => ({ k: u.k, text: u.text })), quests: quests }), cb); } catch (e) { delete ICBS[cb]; }
  }
  window.__interpDone = function (cb, map) {
    if (!ICBS[cb]) return;
    delete ICBS[cb];
    if (!map || typeof map !== 'object') return;
    const t = G.today(), placed = [];
    Object.keys(map).forEach((k) => { const res = G.heraldClaim(S, k, Number(map[k]), true, t, Date.now()); if (res) placed.push(res); });
    if (!placed.length) return;
    save();
    if (UI.sheet && UI.sheet !== 'notice') renderTop(); else render();
    buzz(1);
    toast('The interpreter placed: ' + placed.map((p) => p.q.name + (p.got > 1 ? ' ×' + p.got : '')).join(' · '));
    const lv = placed.find((p) => p.r && p.r.levels > 0);
    if (lv) setTimeout(() => showLevelUp(lv.r), 700);
  };
  function openInterp() {
    const ii = interpInfo() || {};
    UI.interp = { provider: PROVIDERS[ii.provider] ? ii.provider : 'groq', base: ii.base || PROVIDERS.groq.base, model: ii.on ? ii.model : PROVIDERS.groq.model, has: !!ii.on, saved: ii.on ? ii.provider : null };
    renderInterp();
  }
  function readInterp() {
    const u = UI.interp;
    if ($('#interp-model')) u.model = $('#interp-model').value.trim();
    if ($('#interp-base')) u.base = $('#interp-base').value.trim();
    if ($('#interp-key')) u.key = $('#interp-key').value.trim();
  }
  function renderInterp(msg) {
    const u = UI.interp, P = PROVIDERS[u.provider];
    openSheet(`<h3>AI helper</h3>
      <p class="lore">Optional. One AI model, from whichever provider you like, for two jobs: picking your weeklies (the Oracle) and placing deeds the herald can’t match. If it’s off, slow or broken, nothing waits on it.</p>
      <div class="lbl">Provider</div><div class="pills">${Object.keys(PROVIDERS).filter((k) => !PROVIDERS[k].hide || k === u.provider).map((k) => `<button class="pill ${k === u.provider ? 'on' : ''}" data-m="interp-prov" data-v="${k}">${PROVIDERS[k].name}<small>${PROVIDERS[k].free ? 'free' : k === 'claude' ? 'paid' : ''}</small></button>`).join('')}</div>
      <p class="lore" style="margin-top:6px">${esc(P.note)}</p>
      ${u.provider === 'custom' ? `<div class="lbl">Endpoint<small>ends in /v1</small></div><input class="field" id="interp-base" value="${esc(u.base)}" placeholder="https://…/v1">` : ''}
      <div class="lbl">Model</div><input class="field" id="interp-model" value="${esc(u.model || '')}" placeholder="model name">
      <div class="lbl">API key<small>${u.has && u.saved === u.provider ? 'saved; leave blank to keep it' : 'kept on this phone, never in backups'}</small></div>
      <input class="field" id="interp-key" type="password" autocomplete="off" placeholder="${u.has && u.saved === u.provider ? '••••••••' : 'paste your ' + esc(P.name) + ' key'}" value="${esc(u.key || '')}">
      <div class="btns"><button class="btn prime" data-m="interp-save">Save &amp; test</button>${u.has ? '<button class="btn blood" data-m="interp-forget">Forget</button>' : ''}</div>
      <div id="interp-msg" class="lore" style="margin-top:8px">${msg || ''}</div>`, 'interp');
  }
  window.__interpTested = function (cb, why) {
    if (UI.sheet !== 'interp') { toast(why ? 'Interpreter test failed: ' + why : 'The interpreter works.'); return; }
    const m = $('#interp-msg');
    if (m) m.innerHTML = why ? `<span style="color:var(--blood2)">Didn’t work: ${esc(why)}</span>` : '<span style="color:var(--gold)">It works. The Oracle can pick your weeklies, and deeds the herald can’t place go to it first.</span>';
  };
  function heraldLine(list) {
    const by = {}, order = [];
    list.forEach((r) => (r.done || []).forEach((d) => { if (!d.c) return; if (!by[d.n]) { by[d.n] = 0; order.push(d.n); } by[d.n] += d.c; }));
    return order.map((n) => n + (by[n] > 1 ? ' ×' + by[n] : '')).join(' · ');
  }
  // Deeds credited while the app was shut.
  function showHeraldNews() {
    const news = S.herald.news;
    if (!news.length || UI.sheet) return;
    S.herald.news = [];
    save();
    const line = heraldLine(news), xp = news.reduce((a, n) => a + (n.xp | 0), 0), gold = news.reduce((a, n) => a + (n.gold | 0), 0);
    const un = S.herald.unclaimed.length;
    if (!line && !un) return;
    openDialog(`<div class="sig" style="width:44px;height:44px;margin:0 auto 6px">${Art.SIGIL}</div><h3>From your calendar</h3>
      ${line ? `<p>While you were away: <b>${esc(line)}</b>.</p><p class="lore" style="margin-top:4px">+${xp} XP · +${gold} gold</p>` : ''}
      ${un ? `<p class="lore" style="margin-top:6px">${un} report${un > 1 ? 's' : ''} await${un > 1 ? '' : 's'} a quest. They’re on Today.</p>` : ''}
      <div class="btns"><button class="btn prime" data-m="close">Well met</button></div>`, 'notice');
  }
  window.onHeraldPerm = function (ok) {
    if (!ok) { toast('Without the calendar, the herald hears nothing.'); render(); return; }
    heraldEnable();
  };
  function heraldEnable() {
    const info = heraldInfo();
    if (!info.perm || !info.write) { N.askCalendar(); return; }
    S.herald.on = true;
    if (!S.herald.since) S.herald.since = Date.now();
    if (!(S.herald.cal >= 0) || !info.cals.some((c) => c.id === S.herald.cal)) {
      const g = info.cals.find((c) => c.name.trim().toLowerCase() === 'grindstone');
      S.herald.cal = g ? g.id : -1; S.herald.calName = g ? g.name : '';
    }
    save();
    if (N.heraldArm) N.heraldArm();
    render();
    heraldPoll();
  }
  function heraldBand() {
    const u = S.herald.unclaimed;
    if (!u.length) return '';
    return `<div class="hd">Word from the herald<small>deeds it couldn’t place</small></div>` + u.slice(-6).reverse().map((x) =>
      `<div class="row herald"><div class="ri">📜</div><div class="rb"><div class="rn">“${esc(x.text)}”${x.n > 1 ? ' ×' + x.n : ''}</div><div class="rs">${when({ t: x.t, d: new Date(x.t).toLocaleDateString('en-CA') })} · from your calendar</div></div>
        <button class="btn small" data-act="herald-claim" data-k="${esc(x.k)}">Assign</button><button class="hx" data-act="herald-drop" data-k="${esc(x.k)}" aria-label="Dismiss">✕</button></div>`).join('');
  }
  function openClaim(k) {
    const u = S.herald.unclaimed.find((x) => x.k === k);
    if (!u) return;
    UI.claim = k;
    const t = G.today();
    const qs = S.quests.filter((q) => !q.archived && G.canComplete(q, t));
    openSheet(`<h3>Which deed was it?</h3><p class="lore">“${esc(u.text)}”${u.n > 1 ? ' ×' + u.n : ''}</p>
      <label class="chkline"><input type="checkbox" id="claim-learn" checked> Remember this wording next time</label>
      <div class="picklist">${qs.map((q) => `<button class="pick" data-m="claim-pick" data-id="${q.id}"><span>${esc(q.icon)}</span>${esc(q.name)}</button>`).join('') || '<div class="empty">Every quest is done for today.</div>'}</div>
      <div class="btns"><button class="btn" data-m="claim-new">Make it a one-off deed</button></div>`, 'claim');
  }
  function claimReport(k, qid, oneOff) {
    const learn = !oneOff && $('#claim-learn') && $('#claim-learn').checked;
    const res = G.heraldClaim(S, k, qid, learn, G.today(), Date.now());
    closeModal();
    if (!res) { render(); return; }
    save(); render();
    if (!res.got) toast(`${res.q.name} is already done for today.${learn ? ' Wording remembered.' : ''}`);
    else { buzz(1); toast(`${res.q.name}${res.got > 1 ? ' ×' + res.got : ''}: +${res.r.xp * res.got} XP${learn ? ' · wording remembered' : ''}`); }
    if (res.r && res.r.levels > 0) setTimeout(() => showLevelUp(res.r), 500);
  }
  function viewHeraldSettings() {
    const H0 = S.herald, info = heraldInfo();
    const head = '<div class="hd">Calendar<small>deeds from Claude, and back</small></div>';
    if (info.none) return head + '<p class="lore">This reads your phone’s calendar, so it only works in the app.</p>';
    const on = H0.on && info.perm;
    const cal = info.cals.find((c) => c.id === H0.cal);
    let out = head + `<div class="set"><div class="l">Listen for deeds<small>Tell Claude what you did, in any chat. It logs it to your Grindstone calendar, and the herald ticks it off here.</small></div><button class="toggle ${on ? 'on' : ''}" data-act="herald-toggle"></button></div>`;
    if (!on) return out;
    const opts = ['<option value="-1">Choose…</option>'].concat(info.cals.map((c) => `<option value="${c.id}" ${c.id === H0.cal ? 'selected' : ''}>${esc(c.name)}</option>`)).join('');
    out += `<div class="set"><div class="l">Calendar<small>${cal ? esc(cal.account) : 'No “Grindstone” calendar found. Make one at calendar.google.com (Other calendars, +, Create new calendar).'}</small></div><select class="field" id="herald-cal" style="width:150px;font-size:14px">${opts}</select></div>`;
    if (cal && !cal.sync) out += `<div class="set"><div class="l" style="color:var(--blood2)">This calendar isn’t syncing<small>New Google calendars often start with sync off, so nothing reaches the phone.</small></div><button class="btn small prime" data-act="herald-sync-on" data-v="${cal.id}">Turn on</button></div>`;
    out += `<div class="set"><div class="l">Write my ticks to it<small>${info.write ? 'Deeds you tick here go into the same calendar, so Claude can see them' : 'Needs permission to write to the calendar'}</small></div><button class="toggle ${S.settings.calWrite && info.write ? 'on' : ''}" data-act="cal-write"></button></div>`;
    out += `<div class="set"><div class="l">Tell me when deeds arrive<small>A quiet notification when the app’s closed</small></div><button class="toggle ${H0.notify ? 'on' : ''}" data-act="herald-notify"></button></div>`;
    out += `<div class="set"><div class="l">Last word<small>${H0.last ? 'Heard ' + when({ t: H0.last, d: new Date(H0.last).toLocaleDateString('en-CA') }) : 'Nothing heard yet'}</small></div><button class="btn small" data-act="herald-check">Listen now</button></div>`;
    const ii = interpInfo();
    if (ii) {
      const P = PROVIDERS[ii.provider] || PROVIDERS.custom;
      const st = !ii.on ? 'Off. Deeds the herald can’t place wait for you on Today.'
        : ii.resting ? 'Resting after an error: ' + esc(String(ii.err).slice(0, 90))
        : esc(P.name + ' · ' + ii.model) + (ii.okAt ? ' · last worked ' + when({ t: ii.okAt, d: new Date(ii.okAt).toLocaleDateString('en-CA') }) : '');
      out += ii.on ? `<div class="set"><div class="l">Let the AI helper place what the herald can’t<small>${st}</small></div><button class="toggle ${S.settings.interp !== false ? 'on' : ''}" data-act="interp-toggle"></button></div>` : `<div class="set"><div class="l">Interpreter<small>${st} Set up the AI helper (above) to use one.</small></div></div>`;
    }
    out += `<div class="set"><div class="l">Deed names for Claude<small>Copy these into the Grindstone skill if you add or rename quests</small></div><button class="btn small" data-act="herald-copy">Copy</button></div>`;
    return out;
  }

  // ---------- the Hearth (2D) ----------
  // One House2D lives for the whole session; its element is moved into the Hearth view on each render.
  const HOUSE = { el: null, inst: null, failed: false, sig: '', cheerT: 0 };
  window.__house = HOUSE;
  window.__wcam = () => refreshWidgetClip(); // for tests
  window.__delve = { soloRun: soloRun, ui: UI }; // for tests
  const gearItems = () => ({ weapon: G.equipped(S, 'weapon'), head: G.equipped(S, 'head'), body: G.equipped(S, 'body'), charm: G.equipped(S, 'charm') });

  // ---------- the hero's portrait (creator, status, kit, delve) ----------
  // The LPC sprite at a whole-number scale, stood in front of the house's own wall and floor.
  const HERO = { sheets: null, sig: '', busy: null, failed: false };
  window.__hero = HERO;
  const heroHost = () => (UI.sheet === 'creator' ? $('#cprev') : UI.sheet ? null : $('.hero3d'));
  function mountHeroes() {
    const el = heroHost();
    if (!el || HERO.failed || !window.LPC) return;
    const creator = UI.sheet === 'creator';
    const look = G.normLook(creator ? UI.look : S.look);
    const npc = creator && UI.npcEdit;
    const d = LPC.dress(look, npc ? G.npcGear(UI.npcEdit) : gearItems(), { kit: !npc });
    const sig = JSON.stringify(d);
    el.classList.add('h3hero');
    let c = el.querySelector('canvas.lpcport');
    if (!c) { c = document.createElement('canvas'); c.className = 'lpcport'; el.appendChild(c); }
    if (sig === HERO.sig && HERO.sheets) { drawPortrait(c, el); el.classList.add('live'); return; }
    HERO.sig = sig;
    const p = HERO.busy = LPC.build(d.spec, d.body, ['walk']).then((h) => {
      if (HERO.busy !== p) return;
      HERO.busy = null; HERO.sheets = h.sheets; mountHeroes();
    }).catch(() => { if (HERO.busy === p) { HERO.busy = null; HERO.failed = true; } });
  }
  function drawPortrait(c, el) {
    const r = el.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), Hh = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== W || c.height !== Hh) { c.width = W; c.height = Hh; }
    const g = c.getContext('2d');
    const k = Math.max(2, Math.floor(Math.min(Hh / 74, W / 52)));
    const e = G.estateFor3D(S);
    House2D.backdrop(g, W, Hh, k, e.t.walls | 0, e.t.floors | 0).then(() => {
      const items = UI.sheet === 'creator' && UI.npcEdit ? {} : gearItems();
      let best = -1;
      Object.keys(items).forEach((s) => { if (items[s] && items[s].tier > best) best = items[s].tier; });
      if (best >= 2) {
        const gr = g.createRadialGradient(W / 2, Hh * 0.55, 0, W / 2, Hh * 0.55, Math.min(W, Hh) * 0.5);
        gr.addColorStop(0, G.RARITY[best].c + '55'); gr.addColorStop(1, G.RARITY[best].c + '00');
        g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
      }
      g.imageSmoothingEnabled = false;
      const fx = Math.round(W / 2 - 32 * k), fy = Math.round(Hh - 8 * k - 60 * k);
      g.fillStyle = 'rgba(10,8,12,0.35)'; g.beginPath(); g.ellipse(W / 2, fy + 58 * k, 11 * k, 3 * k, 0, 0, Math.PI * 2); g.fill();
      g.drawImage(HERO.sheets.walk, 0, 128, 64, 64, fx, fy, 64 * k, 64 * k);
    });
  }

  const houseState = () => G.houseLevels(S, G.today());
  // 2.24: while visiting a companion's home the hearth shows their house, with them in it
  const hState = () => (UI.visit ? {} : houseState());
  const hEstate = () => (UI.visit ? G.homeEstate3D() : G.estateFor3D(S));
  // 2.26: plus whoever's visiting from the calendar (or lives here), kids and little ones included
  const hGuests = () => G.visitorsNow(S, G.today()).map((v) => ({ id: v.p.id, kind: 'human', guest: true, lives: !!v.lives, name: v.p.name, look: v.p.look, garb: v.p.garb, hat: v.p.hat, status: 'resident', home: null, ev: v.ev ? { k: v.ev.kind, icon: G.EV_ICON[v.ev.kind] || '📅' } : null }));
  const hNpcs = () => { if (!UI.visit) return S.npcs.concat(hGuests()); const n = npcById(UI.visit); return n ? [Object.assign({}, n, { home: null, status: 'resident' })] : []; };
  function houseSig() { return JSON.stringify([UI.visit || '', hState(), G.houseView(HS()), hNpcs(), S.look, gearItems(), hEstate()]); }
  function mountHouse() {
    const slot = $('#h3slot');
    if (!slot) { if (HOUSE.inst) { if (HOUSE.inst.preview) HOUSE.inst.endPreview(); HOUSE.inst.setActive(false); } if (HOUSE.el && HOUSE.el.parentNode) HOUSE.el.parentNode.removeChild(HOUSE.el); return; }
    if (HOUSE.failed) { slot.classList.add('failed'); const l = slot.querySelector('.h3-load'); if (l) l.textContent = 'The hearth cannot be conjured on this device.'; return; }
    if (!HOUSE.el) { HOUSE.el = document.createElement('div'); HOUSE.el.className = 'h3-stage'; }
    slot.insertBefore(HOUSE.el, slot.firstChild);
    if (HOUSE.el.classList.contains('ready')) slot.classList.add('ready');
    if (!HOUSE.inst) { createHouse(); return; }
    HOUSE.inst.setActive(true);
    syncHouse();
  }
  // The house without showing it (for the widget's clip): resolves with a ready House2D.
  function ensureHouse() {
    if (HOUSE.failed || !window.House2D) return Promise.reject(new Error('no hearth'));
    if (!HOUSE.el) { HOUSE.el = document.createElement('div'); HOUSE.el.className = 'h3-stage'; }
    if (!HOUSE.inst) createHouse();
    const h = HOUSE.inst;
    if (!h) return Promise.reject(new Error('no hearth'));
    return h.ready.then(() => (HOUSE.inst === h && h.hero ? h : Promise.reject(new Error('no hearth'))));
  }

  // ---------- the widget's clip ----------
  // The home-screen widget plays a short looping close-up rendered here.
  // Refreshed when the house changes or the clip's older than 20 minutes, never while you're looking at the Hearth.
  const WCAM = { busy: false, timer: 0 };
  function widgetInfo() { try { return N && N.widgetInfo ? JSON.parse(N.widgetInfo()) : null; } catch (e) { return null; } }
  const WIDGET_ON = false;   // 2.9: the hearth widget is shelved, so nothing is filmed for it
  function scheduleWidgetClip(delay) { if (!WIDGET_ON) return; clearTimeout(WCAM.timer); WCAM.timer = setTimeout(refreshWidgetClip, delay == null ? 6000 : delay); }
  // The clip is rendered from a hidden copy of the house, so it never disturbs the one on screen, and it can be refreshed whatever tab he's on.
  function captureWidgetClip() {
    if (HOUSE.failed || !window.House2D) return Promise.reject(new Error('no hearth'));
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:-9999px;top:0;width:540px;height:240px;overflow:hidden;visibility:hidden';
    document.body.appendChild(el);
    const done = (h) => { try { if (h) h.dispose(); } catch (e) { /* gone */ } if (el.parentNode) el.parentNode.removeChild(el); };
    return new Promise((res, rej) => {
      let h = null;
      try {
        h = new window.House2D(el, {
          base: '2d/', look: G.normLook(S.look), gear: gearItems(), state: hState(), mind: G.heroMind(S, G.today()), house: G.houseView(HS()), npcs: hNpcs(), estate: hEstate(),
          onError: (e) => { done(h); rej(e); },
        });
      } catch (e) { done(h); rej(e); return; }
      h.ready.then(() => { h.setActive(false); h.pickActivity(); return h.captureClip({ w: 540, h: 240 }); })
        .then((clip) => { done(h); res(clip); })
        .catch((e) => { done(h); rej(e); });
    });
  }
  const WIDGET_FRESH = 3 * 60000;
  function sendWidgetClip(clip, sig) {
    if (!clip) return 'the house had nothing to film';
    clip.sig = sig;
    // frames that are all the same picture make a widget that looks frozen
    const same = clip.frames.every((f) => f === clip.frames[0]);
    const json = JSON.stringify(clip);
    const why = N.widgetFramesWhy ? N.widgetFramesWhy(json) : (N.widgetFrames(json) ? 'ok' : 'the phone refused the clip');
    return why === 'ok' && same ? 'ok, but every frame came out the same' : why;
  }
  function refreshWidgetClip(force) {
    const info = widgetInfo();
    if (!info || !info.placed || HOUSE.failed) return Promise.resolve(!info ? 'not on a phone' : !info.placed ? 'no widget on the home screen' : 'the house failed to load');
    // a timer that fires while the app is away (or mid-capture) must not end the chain: try again shortly / when he's back
    if (document.hidden || WCAM.busy) { scheduleWidgetClip(60000); return Promise.resolve('busy'); }
    const sig = G.widgetSig(S, G.today());
    if (!force && info.sig === sig && info.age >= 0 && info.age < WIDGET_FRESH) { scheduleWidgetClip(Math.max(30000, WIDGET_FRESH - info.age + 5000)); return Promise.resolve('fresh'); }
    WCAM.busy = true;
    return captureWidgetClip()
      .then((clip) => sendWidgetClip(clip, sig))
      .catch((e) => 'filming failed: ' + String(e && e.message || e))
      .then((why) => { WCAM.busy = false; WCAM.last = why; scheduleWidgetClip(WIDGET_FRESH + 5000); return why; });
  }
  function widgetStatus() {
    const info = WIDGET_ON ? widgetInfo() : null;
    if (!info) return '';
    const ago = (ms) => ms < 0 ? 'never' : ms < 90000 ? 'just now' : ms < 3600000 ? Math.round(ms / 60000) + ' min ago' : ms < 172800000 ? Math.round(ms / 3600000) + ' h ago' : Math.round(ms / 86400000) + ' days ago';
    const bad = info.last && info.last !== 'ok';
    return `<div class="hd">Home-screen widget</div>
      <div class="set"><div class="l">${info.placed ? 'Clip filmed ' + ago(info.age) : 'No widget placed'}<small>${info.placed ? (info.n ? info.n + ' frames. ' : '') + (bad ? 'Last attempt (' + ago(info.lastAge) + ') failed: ' + esc(info.last) : 'It is re-filmed whenever you leave the app and something has changed.') : 'Long-press the home screen, Widgets, Grindstone.'}</small></div>
        ${info.placed ? '<button class="btn small" data-act="widget-now">Refresh</button>' : ''}</div>`;
  }
  // Relics are drawn from their SVGs at pixel size, so they sit in the pixel world.
  // 2.23: a statue is the hero's own figure, idle and facing out, in gold (the Victor's) or stone (an old hero's), on a plinth
  function statueImage(k) {
    const d = G.DECOR[k];
    const who = d.statue === 'gold' ? { look: S.look, gear: gearItems() } : (S.legacy || []).slice(-6)[d.legacy - 1];
    if (!who || !window.LPC) return null;
    const dr = window.LPC.dress(G.normLook(who.look || {}), who.gear || {}, { kit: false });
    return window.LPC.build(dr.spec, dr.body, ['idle']).then((h) => {
      const sh = h.sheets.idle, c = document.createElement('canvas'); c.width = 40; c.height = 62;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      // plinth
      g.fillStyle = d.statue === 'gold' ? '#7a5a1e' : '#5c5a58'; g.fillRect(4, 50, 32, 12);
      g.fillStyle = d.statue === 'gold' ? '#c9a24a' : '#9a9894'; g.fillRect(6, 48, 28, 4); g.fillRect(6, 52, 28, 1);
      // the figure: the down-facing idle frame, toned
      const t = document.createElement('canvas'); t.width = 64; t.height = 64;
      const tg = t.getContext('2d'); tg.drawImage(sh, 0, 2 * 64, 64, 64, 0, 0, 64, 64);
      const px = tg.getImageData(0, 0, 64, 64), a = px.data;
      for (let i = 0; i < a.length; i += 4) {
        if (!a[i + 3]) continue;
        const l = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / 255;
        if (d.statue === 'gold') { a[i] = 90 + 165 * l; a[i + 1] = 62 + 130 * l; a[i + 2] = 18 + 60 * l; } else { const v = 70 + 150 * l; a[i] = v; a[i + 1] = v - 2; a[i + 2] = v - 6; }
      }
      tg.putImageData(px, 0, 0);
      g.drawImage(t, 14, 6, 36, 58, 4, 0, 31, 50);   // the whole figure, feet on the plinth
      return c;
    }).catch(() => null);
  }
  window.__relicImage = (k) => relicImage(k);   // for the tests
  function relicImage(k) {
    const d = G.DECOR[k];
    if (d && d.statue) return statueImage(k);
    if (!d || !window.Home) return null;
    return new Promise((res) => {
      const svg = Home.decorSvg(k, S);
      const im = new Image();
      im.onload = () => {
        // 2.27: cropped to the drawing itself (every prop shared one big frame, so the small ones were specks), then sized
        // from its real size with a floor, so a flamingo is a flamingo and a hammock still a hammock
        const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1], vbw = vb ? +vb.split(/\s+/)[2] : 60, Z = 4;
        const big = document.createElement('canvas'); big.width = Math.round(vbw * Z); big.height = Math.round(big.width * (im.height / Math.max(1, im.width)) || big.width);
        const bg = big.getContext('2d'); bg.drawImage(im, 0, 0, big.width, big.height);
        let x0 = big.width, y0 = big.height, x1 = -1, y1 = -1;
        try {
          const px = bg.getImageData(0, 0, big.width, big.height).data;
          for (let y = 0; y < big.height; y++) for (let x = 0; x < big.width; x++) if (px[(y * big.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        } catch (e) { x0 = 0; y0 = 0; x1 = big.width - 1; y1 = big.height - 1; }
        if (x1 < x0) { res(null); return; }
        const aw = (x1 - x0 + 1) / Z, ah = (y1 - y0 + 1) / Z;   // in the drawing's own units
        let k = 0.85;
        if (Math.max(aw, ah) * k < 36) k = 36 / Math.max(aw, ah);
        if (ah * k > 62) k = 62 / ah;
        if (aw * k > 84) k = 84 / aw;
        const w = Math.max(8, Math.round(aw * k)), h = Math.max(8, Math.round(ah * k));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(big, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, w, h);
        res(c);
      };
      im.onerror = () => res(null);
      const s = /xmlns=/.test(svg) ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
  }
  function createHouse() {
    if (!window.House2D) { HOUSE.failed = true; mountHouse(); return; }
    HOUSE.sig = houseSig();
    HOUSE.cheerT = S.log.length ? S.log[0].t : 0;
    HOUSE.inst = new window.House2D(HOUSE.el, {
      base: '2d/', look: G.normLook(S.look), gear: gearItems(), state: hState(), mind: G.heroMind(S, G.today()), house: G.houseView(HS()), npcs: hNpcs(), estate: hEstate(),
      relicImage: relicImage,
      stars: S.settings.stars !== false, seen: S.seenTaps || (S.seenTaps = {}),
      onTap: houseTap,
      onBuildTap: buildTap,
      onReady: () => { HOUSE.el.classList.add('ready'); const sl = $('#h3slot'); if (sl) sl.classList.add('ready'); else if (HOUSE.inst) HOUSE.inst.setActive(false); },
      onError: () => { HOUSE.failed = true; if (HOUSE.inst) HOUSE.inst.dispose(); HOUSE.inst = null; mountHouse(); },
    });
    HOUSE.inst.setWeather(houseWeather(), new Date().getMonth() === 11);
    HOUSE.inst.ready.catch(() => {});
  }
  function syncHouse() {
    const h = HOUSE.inst;
    if (!h) return;
    const last = S.log.length ? S.log[0] : null;
    const cheer = last && last.q != null && last.t > HOUSE.cheerT;
    if (last) HOUSE.cheerT = Math.max(HOUSE.cheerT, last.t);
    h.setMind(G.heroMind(S, G.today()));
    if (h.setWeather) h.setWeather(houseWeather(), new Date().getMonth() === 11);
    const sig = houseSig();
    if (sig !== HOUSE.sig) {
      HOUSE.sig = sig;
      h.setEstate(hEstate());
      h.setState(hState());
      h.setHouse(G.houseView(HS()));
      h.setNpcs(hNpcs());
      h.setLook(G.normLook(S.look), gearItems()).catch(() => {});
    }
    if (cheer) h.ready.then(() => h.celebrate());
    h.ready.then(() => { if (HOUSE.inst === h) refreshBuild(); });
    // trying an upgrade on
    const P = UI.preview;
    h.ready.then(() => {
      if (HOUSE.inst !== h) return;
      const hp = h.preview;
      if (P && UI.preview === P && (!hp || hp.key !== P.key || hp.tier !== P.tier || hp.fin !== P.fin)) h.previewItem(P.key, P.tier, P.fin);
      else if (!UI.preview && hp) h.endPreview();
    });
  }
  function houseTap(id) {
    ghostUntil = performance.now() + 450;
    if (UI.sheet || UI.preview || UI.build) { if (UI.sheet && !document.querySelector('#modal .sheet, #modal .dlg')) UI.sheet = null; else { if (UI.build) toast('Tap Done to leave layout mode first'); else if (UI.preview) toast('Close the preview first'); return; } }
    buzz(0);
    if (!UI.visit && id && id !== 'hero' && id.indexOf('npc:') !== 0 && id.indexOf('pet:') !== 0) { if (!S.seenTaps) S.seenTaps = {}; if (!S.seenTaps[id]) { S.seenTaps[id] = 1; save(); if (HOUSE.inst) HOUSE.inst.o.seen = S.seenTaps; } }   // 2.27: its star goes
    if (UI.visit) { if (id.indexOf('npc:') === 0) { const n = npcById(id.slice(4)); if (n) talkTo('n:' + n.id, { inside: true }); } return; }
    try {
      if (id === 'hero') { goto('status:equip'); return; }
      if (id.indexOf('npc:') === 0) { const k = id.slice(4); if (personById(k)) { openPerson(k); return; } if (k === 'ruby') toast(BITES[Math.floor(Math.random() * BITES.length)].replace(/Ruby/g, G.birdName(S, 'ruby') || 'Ruby')); openNpc(k); return; }
      if (id.indexOf('pet:') === 0) { const pt = G.petOfItem(S, Number(id.slice(4))); if (pt) toast(pt.name + ' ' + G.PET_KINDS[pt.sp].i); return; }
      if (id.indexOf('relic:') === 0) { openRelic(id.slice(6)); return; }
      openThing(id);
    } catch (e) { toast('Couldn’t open ' + id + ': ' + String(e && e.message || e)); }
  }

  function openFeature(key, keep) {
    const t = G.today(), hs = H(), d = featDef(key), f = hs[key], a = G.AFFLICT[key];
    if (!d || !f) return;
    let h = `<h3>${a ? a.name : esc(f.word)}</h3><p class="lore">${a ? esc(a.lore) : 'Every five sessions on a linked quest does the place up a little more.'}</p>`;
    if (d.progress) h += `<div class="kv"><span>Rank</span><b>${f.stage} <small>${esc(f.word)}</small></b></div><div class="kv"><span>Sessions</span><b>${f.count}</b></div>`;
    else if (f.linked) {
      h += `<div class="kv"><span>State</span><b style="color:${STATE_C[f.state]}">${STATE_W[f.state]}</b></div><div class="kv"><span>${f.auto ? 'Last' : d.name}</span><b style="font:500 16px var(--gar)">${f.known ? daysText(f.days) : 'not yet logged'}</b></div>
        <div class="kv"><span>Due</span><b style="font:500 16px var(--gar)">after ${d.th[0]} day${d.th[0] === 1 ? '' : 's'}</b></div><div class="kv"><span>Overdue</span><b style="font:500 16px var(--gar)">after ${d.th[1]} days</b></div>`;
      if (a) h += `<div class="kv"><span>Penalty</span><b style="font:500 16px var(--gar);color:var(--blood2)">${Object.keys(a.pen).map((s) => `−${a.pen[s]} ${SI[s].name}`).join(', ')}</b></div>`;
    }
    let qs = [];
    if (f.auto) qs = S.quests.filter((q) => !q.archived && (key === 'gym' ? G.TRAINING[q.stat] : q.stat === 'INT'));
    else qs = S.quests.filter((q) => q.home === key && !q.archived);
    if (qs.length) h += '<div class="lbl">Purge it</div>' + qs.slice(0, 6).map((q) => {
      const can = G.canComplete(q, t);
      return `<div class="row" style="--c:var(--${q.stat})"><div class="ri">${esc(q.icon)}</div><div class="rb"><div class="rn">${esc(q.name)}</div><div class="rs">+${DIFF[q.diff - 1].xp}${q.type === 'habit' && q.cap ? ` · ${G.habitCount(q, t)}/${q.cap} today` : ''}</div></div>
        ${can ? `<button class="btn small prime" data-m="f-complete" data-id="${q.id}">Done</button>` : '<span class="dim" style="font-style:italic">done today</span>'}</div>`;
    }).join('');
    else if (!f.auto) h += `<p class="lore" style="margin-top:12px">No quest is linked to this yet.</p><div class="btns"><button class="btn prime" data-m="f-make" data-k="${key}">Create one</button></div>`;
    if (f.linked && !d.progress) h += `<div class="lbl">Already done it? Set when (no XP)</div><div class="stepper"><button data-m="seed" data-k="${key}" data-v="1">−</button><span style="min-width:110px;font:500 16px var(--gar)">${daysText(f.days)}</span><button data-m="seed" data-k="${key}" data-v="-1">+</button></div>`;
    const ek = estateFor(key);
    if (ek) { const ed = G.ESTATE[ek], et = G.estateTier(S, ek); h += `<div class="lbl">The estate</div><div class="row est" data-m="estate-open" data-k="${ek}"><div class="ri">${ed.icon}</div><div class="rb"><div class="rn">${esc(ed.name)}</div><div class="rs">${et < 0 ? 'Not built' : esc(ed.tiers[et])} · tap to upgrade</div></div><div class="dim" style="font-size:20px">›</div></div>`; }
    if (!keep) UI.sheet = null;
    openSheet(h, 'feature');
    UI.featureKey = key;
  }
  const FEATURE_QUEST = {
    lawn: ['Mow the lawn', '🌿', 'habit', 'DIS', 4, 1], fridge: ['Grocery shop', '🛒', 'habit', 'VIT', 3, 1], dishes: ['Do the dishes', '🍽️', 'daily', 'DIS', 2, 0],
    laundry: ['Do a load of washing', '🧺', 'habit', 'DIS', 2, 1], birds: ['Feed the birds', '🦜', 'daily', 'DIS', 2, 0], aviary: ['Clean the aviary', '🧹', 'habit', 'DIS', 3, 1],
    reno: ['Work on the house', '🔨', 'habit', 'DIS', 4, 1],
  };

  // ---------- tap anything in the house: what it is, the quests behind it, and what they'd earn now ----------
  const TRAIN = (q) => !!G.TRAINING[q.stat];
  const THINGS = {
    fridge: { icon: '🧊', name: 'The fridge', feats: ['fridge'], est: 'fridge', match: /grocer|shop|restock/i },
    stove: { icon: '🍳', name: 'The stove', est: 'stove', match: /meal|cook|vegie|veggie|breakfast|dinner/i },
    sink: { icon: '🚰', name: 'The sink', feats: ['dishes'], est: 'sink', match: /water|dish/i },
    ktable: { icon: '🍽️', name: 'The table', est: 'ktable', match: /log my meals|meal/i },
    couch: { icon: '🛋️', name: 'The couch', feats: ['reno'], est: 'couch' },
    armchair: { icon: '🪑', name: 'The armchair', est: 'armchair', match: /read/i },
    ctable: { icon: '🫖', name: 'The coffee table', est: 'ctable' },
    fireplace: { icon: '🔥', name: 'The hearth', feats: ['reno'], est: 'walls' },
    reno: { icon: '🔨', name: 'The restoration', feats: ['reno'], est: 'walls' },
    bed: { icon: '🛏️', name: 'The bed', est: 'bed', match: /stretch|mobility|sleep/i },
    wardrobe: { icon: '🚪', name: 'The wardrobe', feats: ['laundry'], est: 'wardrobe' },
    bedside: { icon: '🕯️', name: 'The bedside table', est: 'bedside', match: /read/i },
    laundry: { icon: '🧺', name: 'The laundry', feats: ['laundry'], est: 'wardrobe' },
    desk: { icon: '📜', name: 'The desk', feats: ['study'], est: 'desk', match: /email|inbox/i },
    bookshelf: { icon: '📚', name: 'The bookshelf', feats: ['study'], match: /read/i },
    bag: { icon: '🥊', name: 'The punching bag', feats: ['gym'], est: 'bag' },
    weights: { icon: '🏋️', name: 'The weights', feats: ['gym'], est: 'weights' },
    aviary: { icon: '🦜', name: 'The aviary', feats: ['birds', 'aviary'], est: 'aviary' },
    lawn: { icon: '🌿', name: 'The lawn', feats: ['lawn'], est: 'yard' },
    yard: { icon: '🌿', name: 'The yard', feats: ['lawn'], est: 'yard' },
    pool: { icon: '🏊', name: 'The pool', est: 'pool', match: /swim|pool/i },
    garage: { icon: '🏗️', name: 'The garage gym', feats: ['gym'], est: 'garage' },
    shed: { icon: '🔨', name: 'The shed', feats: ['reno'], est: 'shed' },
    garden: { icon: '🥕', name: 'The garden', est: 'garden', match: /garden|weed|vegie|veggie/i },
    grill: { icon: '🍖', name: 'The outdoor kitchen', est: 'grill', match: /bbq|barbecue|cook|meal/i },
    pond: { icon: '🐟', name: 'The pond', est: 'pond' },
    tower: { icon: '🗼', name: 'The watchtower', est: 'tower', match: /journal|plan|meditat/i },
  };
  function thingQuests(id) {
    const d = THINGS[id];
    if (!d) return [];
    const out = [];
    const push = (q) => { if (q && !q.archived && out.indexOf(q) < 0 && !(q.type === 'todo' && q.doneOn)) out.push(q); };
    (d.feats || []).forEach((f) => {
      if (f === 'gym') S.quests.filter(TRAIN).forEach(push);
      else if (f === 'study') S.quests.filter((q) => q.stat === 'INT').forEach(push);
      else S.quests.filter((q) => q.home === f).forEach(push);
    });
    if (d.match) S.quests.filter((q) => d.match.test(q.name) || (q.aliases || []).some((a) => d.match.test(a))).forEach(push);
    return out;
  }
  function lastText(d) {
    if (!d) return 'Not done yet';
    const n = G.daysBetween(d, G.today());
    return n <= 0 ? 'Done today' : n === 1 ? 'Last done yesterday' : n < 14 ? `Last done ${n} days ago` : n < 60 ? `Last done ${Math.round(n / 7)} weeks ago` : `Last done ${Math.round(n / 30)} months ago`;
  }
  function earnText(q, hs) {
    const d = DIFF[q.diff - 1];
    const bits = [`+${d.xp} XP`, `+${d.gold} gold`, `+${d.xp} ${SI[q.stat].short || q.stat}`];
    if (S.xp + d.xp >= G.need(S.level)) bits.push('a level');
    const f = q.home && hs[q.home];
    if (f && f.linked && f.state === 2 && G.AFFLICT[q.home]) bits.push('clears the overdue ' + G.AFFLICT[q.home].name.toLowerCase());
    else if (f && f.linked && f.state === 1) bits.push('stops it building');
    return bits.join(' · ');
  }
  // One broken section must never stop the window opening: each part is built on its own, and a part that fails says so.
  function openThing(id, keep) {
    const d = THINGS[id];
    if (!d) { toast('Nothing to show for ' + id); return; }
    let h = '';
    try { h = thingHtml(id, d); } catch (e) { h = `<h3>${d.icon} ${esc(d.name)}</h3><p class="lore">This one wouldn’t draw properly (${esc(String(e && e.message || e))}).</p>`; }
    if (!keep) UI.sheet = null;
    openSheet(h, 'thing');
    UI.thingId = id;
  }
  function thingHtml(id, d) {
    const part = (f) => { try { return f() || ''; } catch (e) { return `<p class="lore" style="color:var(--blood2)">(${esc(String(e && e.message || e))})</p>`; } };
    const t = G.today(), hs = H();
    const et = d.est ? G.estateTier(S, d.est) : null;
    let h = `<h3>${d.icon} ${esc(d.name)}</h3>`;
    if (d.est && et >= 0) h += part(() => `<p class="lore" style="margin-top:-4px">${esc(G.ESTATE[d.est].tiers[et])}</p>`);
    // the condition it shows
    (d.feats || []).forEach((k) => h += part(() => { let h = '';
      const f = hs[k], fd = featDef(k), a = G.AFFLICT[k];
      if (!f || !fd) return '';
      if (fd.progress) { if (f.linked) h += `<div class="kv"><span>${esc(fd.name)}</span><b style="font:500 16px var(--gar)">rank ${f.stage}, ${esc(f.word)}</b></div>`; return h; }
      if (!f.linked) return '';
      const when = !f.known ? 'not yet logged' : f.auto ? (k === 'gym' ? 'trained ' : 'studied ') + daysText(f.days) : `${fd.verb} ${daysText(f.days)}`;
      h += `<div class="kv"><span>${esc(fd.name)}</span><b style="color:${STATE_C[f.state]};font:600 15px var(--gar)">${STATE_W[f.state]} <small style="color:var(--mute);font-weight:400">· ${when}</small></b></div>`;
      if (f.state === 2 && a) h += `<div class="kv"><span>Costs you</span><b style="font:500 15px var(--gar);color:var(--blood2)">${Object.keys(a.pen).map((s) => `−${a.pen[s]} ${SI[s].name}`).join(', ')}</b></div>`;
      return h; }));
    const qs = (() => { try { return thingQuests(id); } catch (e) { h += part(() => { throw e; }); return []; } })();
    if (qs.length) {
      h += '<div class="lbl">Quests here</div>' + qs.slice(0, 6).map((q) => part(() => {
        const can = G.canComplete(q, t);
        return `<div class="row thing-q" style="--c:var(--${q.stat})"><div class="ri">${esc(q.icon)}</div><div class="rb"><div class="rn">${esc(q.name)}</div>
          <div class="tq-last">${esc(lastText(G.questLast(S, q) || (q.home && hs[q.home] && hs[q.home].known ? hs[q.home].last : null)))}${q.type === 'habit' && q.cap ? ` · ${G.habitCount(q, t)}/${q.cap} today` : ''}</div>
          <div class="tq-earn">${can ? 'Now: ' + earnText(q, hs) : 'Already done today'}</div></div>
          ${can ? `<button class="btn small prime" data-m="f-complete" data-id="${q.id}">Done</button>` : '<span class="dim" style="font-style:italic">✓</span>'}</div>`;
      })).join('');
    } else {
      const fk = (d.feats || []).find((k) => FEATURE_QUEST[k] && !(hs[k] && hs[k].linked));
      if (fk) h += `<p class="lore" style="margin-top:12px">No quest keeps this in order yet.</p><div class="btns"><button class="btn prime" data-m="f-make" data-k="${fk}">Create one</button></div>`;
      else h += '<p class="lore" style="margin-top:12px">No quest lives here. It’s just for enjoying.</p>';
    }
    h += part(() => { const seedK = (d.feats || []).find((k) => hs[k] && hs[k].linked && !featDef(k).progress && !hs[k].auto);
    return seedK ? `<div class="lbl">Already done it? Set when (no XP)</div><div class="stepper"><button data-m="seed" data-k="${seedK}" data-v="1">−</button><span style="min-width:110px;font:500 16px var(--gar)">${daysText(hs[seedK].days)}</span><button data-m="seed" data-k="${seedK}" data-v="-1">+</button></div>` : ''; });
    if (d.est) h += part(() => {
      const ed = G.ESTATE[d.est], n = G.estateNext(S, d.est);
      return `<div class="lbl">The estate</div><div class="row est" data-m="estate-open" data-k="${d.est}"><div class="ri">${ed.icon}</div><div class="rb"><div class="rn">${esc(ed.name)}</div><div class="rs">${et < 0 ? 'Not built' : esc(ed.tiers[et])}${n.max ? '' : ` · next: ${esc(n.name)}, ◈ ${n.cost}`}</div></div><div class="dim" style="font-size:20px">›</div></div>`;
    });
    return h;
  }

  // ================= BUILD: the house as Jake lays it out =================
  // Tap-tap editing: tap a thing to pick it up, tap where it goes. Rooms are two taps (opposite corners), doors one.
  const BUILD_TIPS = { move: 'Tap something to pick it up', room: 'Tap a room to resize, move, rename or sell it. Tap ＋Room (or any empty yard) to buy a new one', door: 'Tap a wall to put in a door, or brick one up' };
  const itemName = (it) => { const f = G.furnOf(it); return f ? f.n : 'thing'; };
  function startBuild() {
    if (UI.preview) { UI.preview = null; if (HOUSE.inst) HOUSE.inst.endPreview(); }
    UI.build = { tool: 'move', sel: null, place: null, draft: null, undo: [], msg: BUILD_TIPS.move, room: null, mark: null };
    render();
    if (HOUSE.inst) HOUSE.inst.ready.then((h) => { h.setZoom(Math.max(1, h._scale() - 1)); h.follow(); });
  }
  function endBuild() {
    UI.build = null;
    if (HOUSE.inst) { HOUSE.inst.setEdit(null); HOUSE.inst.setZoom(0); HOUSE.inst.follow(); }
    save(); render();
  }
  function buildBar() {
    const B = UI.build;
    if (!B) return '';
    const it = B.sel != null ? HS().house.items.find((x) => x.id === B.sel) : null, f = it && G.furnOf(it);
    const live = it ? G.houseLive(HS())[it.id] : true;
    const sel = it ? `<div class="bld-sel"><span class="bn">${f.i} ${esc(f.n)}${live ? '' : ' <small>(not yours yet)</small>'}</span>
      ${f.at !== 'wall' && f.w > 0 ? '<button data-act="b-flip" aria-label="Flip">⇋</button>' : ''}${it.k === 'fencebit' ? '<button data-act="b-rotate" aria-label="Rotate">↻</button>' : ''}<button data-act="b-store">Store</button><button data-act="b-desel" aria-label="Put down">✕</button></div>` : '';
    const tool = (k, n) => `<button class="${B.tool === k && !B.place ? 'on' : ''}" data-act="b-tool" data-v="${k}">${n}</button>`;
    return `<div class="bld-msg">${esc(B.msg || '')}</div>${sel}
      <div class="bld-tools">${tool('move', 'Move')}${tool('room', 'Rooms')}${tool('door', 'Doors')}<button class="${B.place ? 'on' : ''}" data-act="b-add">＋Item</button><button class="${HS().house.fenceOff ? 'on' : ''}" data-act="b-fence">${HS().house.fenceOff ? 'Show fence' : 'Hide fence'}</button><button class="${B.newRoom && B.newRoom.go ? 'on' : ''}" data-act="b-room">＋Room</button>
      <button data-act="b-undo" ${B.undo.length ? '' : 'disabled'} aria-label="Undo">↶</button><button class="prime" data-act="b-done">Done</button></div>`;
  }
  function refreshBuild() {
    const el = $('#bld');
    if (el) el.innerHTML = buildBar();
    const B = UI.build, h = HOUSE.inst;
    if (h) h.setEdit(B ? { tool: B.place ? 'place' : B.moving ? 'rmove' : B.tool, sel: B.sel, draft: B.draft, room: B.room, mark: B.mark } : null);
  }
  const snap = () => JSON.stringify({ rooms: HS().house.rooms, doors: HS().house.doors, items: HS().house.items, seq: HS().house.seq, gold: HS().gold, bought: HS().house.bought, fenceOff: HS().house.fenceOff });
  function buildDid(before, msg, cells) {
    const B = UI.build;
    B.undo.push(before); if (B.undo.length > 30) B.undo.shift();
    B.msg = msg;
    if (cells) B.mark = { cells: cells, bad: false, until: Date.now() + 600 };
    HS().npcs.forEach((n) => { if (n.home && n.home !== 'aviary' && !HS().house.rooms.some((r) => r.id === n.home)) n.home = n.kind === 'bird' ? 'aviary' : null; });
    save(); syncHouse(); refreshBuild(); buzz(0);
  }
  function buildNo(msg, cells) {
    const B = UI.build;
    B.msg = msg + '.';
    if (cells) B.mark = { cells: cells, bad: true, until: Date.now() + 800 };
    refreshBuild(); buzz(1);
  }
  const footCells = (x, y, w, h) => { const c = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) c.push([x + i, y + j]); return c; };
  // Where a thing lands if you tap a cell: its base row on the tap, centred across.
  function landAt(f, cx, cy) { return f.at === 'wall' ? [cx - Math.floor((f.w - 1) / 2), cy] : [cx - Math.floor((f.w - 1) / 2), cy - (f.h - 1)]; }
  function buildTap(hit) {
    const B = UI.build;
    if (!B || UI.sheet) return;
    ghostUntil = performance.now() + 450;
    B.mark = null;
    if (B.place) {
      const f = G.furnOf({ k: B.place.k, r: B.place.r });
      const [x, y] = landAt(f, hit.x, hit.y), before = snap();
      const err = G.housePut(HS(), B.place.k, B.place.r, x, y);
      if (err) { buildNo(err, footCells(x, y, f.w, f.at === 'wall' ? 2 : f.h)); return; }
      const it = HS().house.items[HS().house.items.length - 1];
      B.place = null; B.sel = it.id; B.tool = 'move';
      buildDid(before, `${f.n} placed. Tap somewhere else to move it.`, footCells(it.x, it.y, f.w, f.at === 'wall' ? 2 : f.h));
      return;
    }
    if (B.tool === 'move') {
      const cur = B.sel != null ? HS().house.items.find((x) => x.id === B.sel) : null;
      const hitIt = hit.item != null ? HS().house.items.find((x) => x.id === hit.item) : null;
      if (cur && hitIt && hitIt.id === cur.id) { B.sel = null; B.msg = 'Put down. ' + BUILD_TIPS.move + '.'; refreshBuild(); return; }
      const hf = hitIt && G.furnOf(hitIt), cf = cur && G.furnOf(cur);
      if (hitIt && (!cur || !(hf.flat && !cf.flat))) { B.sel = hitIt.id; B.msg = 'Now tap where the ' + hf.n.toLowerCase() + ' should go.'; refreshBuild(); buzz(0); return; }
      if (!cur) { B.msg = BUILD_TIPS.move + '.'; refreshBuild(); return; }
      const [x, y] = landAt(cf, hit.x, hit.y), before = snap();
      const err = G.houseMove(HS(), cur.id, x, y);
      if (err) { buildNo(err, footCells(x, y, cf.w, cf.at === 'wall' ? 2 : cf.h)); return; }
      buildDid(before, 'Moved. Tap again to keep shifting it, or ✕ to put it down.', footCells(cur.x, cur.y, cf.w, cf.at === 'wall' ? 2 : cf.h));
      return;
    }
    if (B.moving) {
      const id = B.moving, before = snap(), r0 = HS().house.rooms.find((x) => x.id === id);
      const res = G.roomMove(HS(), id, hit.x, hit.y);
      if (res.err) { const z = r0 ? G.roomDims(r0) : { w: 1, d: 1 }; buildNo(res.err, footCells(hit.x, hit.y, z.w, z.d + 3)); return; }
      B.room = id;
      buildDid(before, 'Moved. Tap again to shift it more, or tap Rooms to finish.' + (res.stored.length ? ' Put into storage: ' + res.stored.join(', ') + '.' : ''));
      return;
    }
    if (B.newRoom && B.newRoom.go) {
      const n = B.newRoom, P = G.landRect(HS(), hit.x), before = snap();
      // centre the footprint (floor plus its walls: two rows above, one below) on the tap, and keep it inside the fence
      const fw = n.w, fh = n.d + 3;
      const x0 = Math.max(P.x0, Math.min(P.x1 - fw + 1, hit.x - Math.floor((fw - 1) / 2))), y0 = Math.max(P.y0, Math.min(P.y1 - fh + 1, hit.y - Math.floor(fh / 2)));
      const pu = G.ROOM_PURPOSES[n.purpose] || G.ROOM_PURPOSES.none;
      const r = G.roomAdd(HS(), x0, y0, x0 + fw - 1, y0 + fh - 1, { purpose: n.purpose, name: n.purpose !== 'none' ? pu.n : undefined });
      if (r.err) { buildNo(r.err + '. Tap somewhere else, or ＋Room to change the size', footCells(x0, y0, fw, fh)); return; }
      // a way in: the middle of its bottom wall, else a side wall
      const mid = x0 + Math.floor((fw - 1) / 2);
      let door = G.doorToggle(HS(), mid, r.room.y1);
      if (door.err || !door.on) door = G.doorToggle(HS(), r.room.x0, r.room.y1 - 1);
      if (door.err || !door.on) door = G.doorToggle(HS(), r.room.x1, r.room.y1 - 1);
      B.newRoom = null; B.room = r.room.id; B.tool = 'room';
      buildDid(before, `Bought: ${n.w} × ${n.d} ${n.purpose !== 'none' ? pu.n.toLowerCase() : 'room'} for ${r.cost} gold${door && door.on ? ', door included' : '. It needs a door: Doors, then tap a wall'}. Tap it to rename, resize or move it; ↶ undoes.` + (r.stored.length ? ' Moved to storage: ' + r.stored.join(', ') + '.' : ''), footCells(x0, y0, fw, fh));
      return;
    }
    if (B.tool === 'room') {
      if (hit.room) { B.room = hit.room; refreshBuild(); openRoom(hit.room); return; }
      openRoomShop();
      return;
    }
    if (B.tool === 'door') {
      const before = snap(), r = G.doorToggle(HS(), hit.x, hit.y);
      if (r.err) { buildNo(r.err, [[hit.x, hit.y]]); return; }
      buildDid(before, r.on ? 'Door in.' : 'Bricked up.', r.cells);
    }
  }
  // ---------- the catalogue ----------
  function furnSpr(k, r) {
    if (k === 'relic') return null;
    const f = G.FURN[k];
    if (!f) return null;
    if (f.est) { const t = Math.max(0, G.estateTier(HS(), f.est)); return f.cage ? `${f.est}.${t}.b` : `${f.est}.${t}`; }
    return f.s.replace('*', 'summer');
  }
  function furnRow(k, r, n, buy) {
    const f = G.furnOf({ k: k, r: r });
    const spr = furnSpr(k, r);
    const owned = G.furnOwned(HS(), k, r), placed = HS().house.items.filter((it) => it.k === k && (k !== 'relic' || it.r === r)).length;
    const where = f.at === 'wall' ? 'on a wall' : f.at === 'in' ? 'indoors' : f.at === 'out' ? 'outside' : 'anywhere';
    const btn = buy ? (f.lv && HS().level < f.lv ? `<span class="dim" style="font:500 13px var(--gar);white-space:nowrap">🔒 Level ${f.lv}</span>` : `<button class="btn small prime" data-m="b-buy" data-k="${k}" ${HS().gold < f.g ? 'disabled' : ''}>◈ ${f.g}</button>`)
      : `<button class="btn small prime" data-m="b-put" data-k="${k}" data-r="${esc(r || '')}">Place</button>`;
    return `<div class="row furn"><canvas class="fth" width="56" height="56" ${spr ? `data-spr="${esc(spr)}"` : `data-relic="${esc(r)}"`}></canvas>
      <div class="rb"><div class="rn">${esc(f.n)}${!buy && n > 1 ? ` <small>×${n}</small>` : ''}</div><div class="rs">${where}${buy && owned ? ` · you have ${owned}${placed < owned ? `, ${owned - placed} stored` : ''}` : ''}</div></div>${btn}</div>`;
  }
  function openCatalogue() {
    const st = G.houseStored(HS());
    let h = `<h3>Furnish the hearth</h3><div class="btns" style="margin:0 0 6px"><button class="btn" data-m="hh-open">👥 Household and companions</button></div><p class="lore" style="margin-top:-4px">Buy something and place it, or put out what’s in storage. <span class="gl">◈ ${HS().gold}</span></p>`;
    if (st.length) h += '<div class="lbl">In storage</div>' + st.map((o) => furnRow(o.k, o.r, o.n, false)).join('');
    G.FURN_CATS.forEach((c) => {
      const ks = Object.keys(G.FURN).filter((k) => G.FURN[k].c === c[0] && G.FURN[k].g);
      if (ks.length) h += `<div class="lbl">${esc(c[1])}</div>` + ks.map((k) => furnRow(k, null, 0, true)).join('');
    });
    h += '<p class="lore" style="font-size:14px;text-align:center;margin-top:10px">Relics come from the merchant and from feats. Once they’re yours they turn up in storage here.</p><div class="btns"><button class="btn" data-m="close">Close</button></div>';
    UI.sheet = null;
    openSheet(h, 'furnish');
    paintThumbs();
  }
  function paintThumbs() {
    $$('#modal canvas.fth').forEach((c) => {
      if (c.dataset.spr) House2D.thumb(c, c.dataset.spr).catch(() => {});
      else if (c.dataset.relic) Promise.resolve(relicImage(c.dataset.relic)).then((im) => { if (!im) return; const g = c.getContext('2d'), k = Math.max(1, Math.floor(Math.min(c.width / im.width, c.height / im.height))); g.imageSmoothingEnabled = false; g.drawImage(im, Math.round((c.width - im.width * k) / 2), c.height - im.height * k, im.width * k, im.height * k); });
    });
  }
  // ---------- rooms ----------
  function openRoom(id, fresh) {
    const r = HS().house.rooms.find((x) => x.id === id);
    if (!r) return;
    const z = G.roomDims(r), price = G.roomPrice(z.w, z.d);
    const doors = HS().house.doors.some((d) => d[0] >= r.x0 && d[0] <= r.x1 && d[1] >= r.y0 && d[1] <= r.y1 && (d[0] === r.x0 || d[0] === r.x1 || d[1] <= r.y0 + 1 || d[1] === r.y1));
    const who = HS().npcs.filter((n) => n.home === id && n.status === 'resident');
    const styles = Object.keys(G.ROOM_STYLES).map((k) => { const st = G.ROOM_STYLES[k], ok = !st.wing || HS().estate.wings[st.wing]; return `<button class="pill ${r.style === k ? 'on' : ''}" data-m="rm-style" data-k="${esc(id)}" data-v="${k}" ${ok ? '' : 'disabled'}>${esc(st.name)}</button>`; }).join('');
    const purposes = Object.keys(G.ROOM_PURPOSES).map((k) => `<button class="pill ${r.purpose === k ? 'on' : ''}" data-m="rm-purpose" data-k="${esc(id)}" data-v="${k}">${G.ROOM_PURPOSES[k].i} ${esc(G.ROOM_PURPOSES[k].n)}</button>`).join('');
    const st = G.ROOM_STYLES[r.style];
    const step = (dim, label, val, min, max) => `<div class="rsz"><span>${label}</span><button class="pill" data-m="rm-size" data-k="${esc(id)}" data-d="${dim}" data-v="-1" ${val <= min ? 'disabled' : ''}>−</button><b>${val}</b><button class="pill" data-m="rm-size" data-k="${esc(id)}" data-d="${dim}" data-v="1" ${val >= max ? 'disabled' : ''}>＋</button></div>`;
    const sellBack = Math.floor((r.paid | 0) * G.SELL_BACK);
    UI.sheet = null;
    openSheet(`<h3>${fresh ? 'A new room' : esc(r.name)}</h3>
      <div class="lbl">Name</div><input class="field" id="rm-name" value="${esc(r.name)}" maxlength="24">
      <div class="lbl">What it’s for</div><div class="pills">${purposes}</div>
      <div class="lbl">Size <small>${z.w} × ${z.d} floor tiles · worth ◈ ${price}</small></div>
      <div class="rszs">${step('w', 'Wide', z.w, 1, G.ROOM_MAX)}${step('d', 'Deep', z.d, 1, G.ROOM_MAX)}</div>
      <p class="lore" style="font-size:14px">Growing it costs the difference in ◈. Shrinking gives half the difference back. Its top-left corner stays put; if it won’t fit, the tap says why.</p>
      <div class="lbl">Walls and floor</div><div class="pills">${styles}</div>${st && st.note ? `<p class="lore" style="font-size:14px">${esc(st.note)}.</p>` : ''}
      ${who.length ? `<p class="lore">Home to ${who.map((n) => esc(n.name)).join(' and ')}.</p>` : ''}
      ${doors ? '' : '<p class="lore" style="color:var(--gold2)">No way in yet. Use Doors and tap one of its walls.</p>'}
      <div class="btns"><button class="btn blood" data-m="rm-del" data-k="${esc(id)}">Sell it${sellBack ? ' · ◈ ' + sellBack : ''}</button>${UI.build ? `<button class="btn" data-m="rm-move" data-k="${esc(id)}">Move it</button>` : ''}<button class="btn prime" data-m="rm-save" data-k="${esc(id)}">Done</button></div>`, 'room');
  }
  // Buying a room: pick what it's for and how big, see the price, then tap the yard where it should stand.
  const ROOM_SIZES = [['Nook', 1, 1], ['Small', 3, 2], ['Medium', 5, 3], ['Large', 7, 4], ['Hall', 10, 6], ['Grand', 12, 12]];
  function openRoomShop() {
    const B = UI.build;
    if (!B) return;
    const n = B.newRoom || (B.newRoom = { w: 3, d: 2, purpose: 'none' });
    n.go = false;
    const price = G.roomPrice(n.w, n.d), short = price - HS().gold, full = HS().house.rooms.length >= G.roomLimit(HS());
    const sizes = ROOM_SIZES.map((z) => `<button class="pill ${n.w === z[1] && n.d === z[2] ? 'on' : ''}" data-m="nr-preset" data-w="${z[1]}" data-d="${z[2]}">${z[0]} <small>${z[1]}×${z[2]} · ◈ ${G.roomPrice(z[1], z[2])}</small></button>`).join('');
    const step = (dim, label, val) => `<div class="rsz"><span>${label}</span><button class="pill" data-m="nr-size" data-d="${dim}" data-v="-1" ${val <= 1 ? 'disabled' : ''}>−</button><b>${val}</b><button class="pill" data-m="nr-size" data-d="${dim}" data-v="1" ${val >= G.ROOM_MAX ? 'disabled' : ''}>＋</button></div>`;
    const purposes = Object.keys(G.ROOM_PURPOSES).map((k) => `<button class="pill ${n.purpose === k ? 'on' : ''}" data-m="nr-purpose" data-v="${k}">${G.ROOM_PURPOSES[k].i} ${esc(G.ROOM_PURPOSES[k].n)}</button>`).join('');
    openSheet(`<h3>Buy a room</h3>
      <p class="lore" style="margin-top:-4px">Any size from 1 × 1 to ${G.ROOM_MAX} × ${G.ROOM_MAX}. 10 gold, plus 5 for every floor tile. <span class="gl">◈ ${HS().gold}</span> in the purse.</p>
      <div class="lbl">Size</div><div class="pills">${sizes}</div>
      <div class="rszs">${step('w', 'Wide', n.w)}${step('d', 'Deep', n.d)}</div>
      <div class="lbl">What it’s for</div><div class="pills">${purposes}</div>
      <div class="kv"><span>${n.w} × ${n.d} floor</span><b class="${short > 0 ? 'bad' : ''}">◈ ${price}</b></div>
      <p class="lore" style="font-size:14px">${full ? G.roomLimit(HS()) + ' rooms is the limit' + (G.landNext(HS()).max ? '' : ' for this much land') + '. Sell one first.' : short > 0 ? `You need ${short} more gold for this size.` : `With its walls it takes up ${n.w} × ${n.d + 3} tiles of yard. Selling a room gives half back.`}</p>
      <div class="btns"><button class="btn" data-m="close">Not now</button><button class="btn prime" data-m="nr-go" ${short > 0 || full ? 'disabled' : ''}>Choose where it goes</button></div>`, 'roomshop');
  }
  function saveRoomName(id) { const el = $('#rm-name'); if (el) G.roomSet(HS(), id, { name: el.value }); }

  // ================= THE HOUSEHOLD =================
  const BITES = ['Ruby bit you. Obviously.', 'Ruby bit you. She looks pleased with herself.', 'Ruby bit you, then asked for a head scratch.', 'Chomp. That’s Ruby saying hello.'];
  const npcById = (id) => S.npcs.find((n) => n.id === id);
  const roomName = (id) => { if (id === 'aviary') return 'the aviary'; const r = S.house.rooms.find((x) => x.id === id); return r ? 'the ' + r.name.toLowerCase() : 'anywhere'; };
  // How a companion's calling stands, in a line and as pips.
  const untilText = (ms) => { const h = (ms - Date.now()) / 3600e3; return h >= 36 ? Math.round(h / 24) + ' days' : h >= 1 ? Math.round(h) + ' h' : Math.max(1, Math.round(h * 60)) + ' min'; };
  // The before/after check: what the deed log says about the habits, either side of the day 2.5 arrived.
  function openAdherence() {
    const A = G.adherence(S, S.since25, 6), names = { healer: 'Looking after yourself', scout: 'Endurance', fighter: 'Strength', mage: 'Study or reading' };
    const cell = (x, w) => (w ? `${x.perWeek} <small>(${x.met}/${w} wk on target)</small>` : '—');
    let h = `<h3>Before and after 2.5</h3><p class="lore" style="margin-top:-4px">From ${new Date(S.since25 + 'T00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}. Days a week each kind of deed got done: the six whole weeks before that week, and the six after it.</p>
      <div class="kv"><span></span><b>Before (${A.before.weeks} wk) · After (${A.after.weeks} wk)</b></div>`;
    G.CALLING_ORDER.forEach((k) => { h += `<div class="kv"><span>${names[k]} <small>target ${G.CALLINGS[k].days}/wk</small></span><b>${cell(A.before.kinds[k], A.before.weeks)} · ${cell(A.after.kinds[k], A.after.weeks)}</b></div>`; });
    h += `<p class="lore" style="font-size:14px">${A.ready ? 'Six weeks are in.' : `${6 - A.after.weeks} more week${6 - A.after.weeks === 1 ? '' : 's'} to go before this is a fair comparison.`} ${A.thin ? 'The before side is thin: the app only started keeping records just before 2.5, so treat it as a rough baseline (the Fitness Tracker goes back a little further).' : ''} Rosters change and school holidays start mid-December, so a shift in the numbers isn't all down to the app.</p>
      <div class="btns"><button class="btn prime" data-m="close">Done</button></div>`;
    openSheet(h, 'adh');
  }
  function callingPips(st) {
    return `<span class="cpips">${st.weeks.map((w) => `<i class="${w.met ? 'met' : w.held ? 'held' : w.now ? 'now' : ''}" title="${w.n}/${st.days}${w.held ? ', covered by the emergency skip' : ''}">${w.held ? '~' : w.now && !w.met ? w.n : ''}</i>`).join('')}</span>`;
  }
  function compBuffs(st) {
    const C = st.C, out = [];
    if (st.longUntil) out.push(`💪 ${C.long} · ${untilText(st.longUntil)}`);
    if (st.shorts.length) out.push(`✨ ${C.short}${st.shorts.length > 1 ? ' ×' + st.shorts.length : ''} · ${untilText(Math.min.apply(null, st.shorts))}`);
    return out;
  }
  function compLine(n) {
    const st = G.callingState(S, n.comp);
    if (n.status !== 'resident') return `${st.C.title} · ${st.thisWeek}/${st.days} days this week · ${st.streak}/${st.need} weeks`;
    const b = compBuffs(st);
    return `${st.C.title} · at ${Math.round(st.m * 100)}%${b.length ? ' · ' + b.length + ' buff' + (b.length > 1 ? 's' : '') : ''}`;
  }
  function npcLine(n) {
    if (n.comp) return compLine(n);
    if (n.kind === 'bird') {
      const kerm = npcById('kermit');
      if (n.id === 'ruby' && kerm && n.home !== 'aviary' && n.home === kerm.home) return 'Banished from ' + roomName(n.home) + ' by ' + kerm.name;
      return 'Lives in ' + roomName(n.home);
    }
    if (n.status === 'resident') return (n.about ? n.about + ' · ' : '') + (n.home ? 'Lives in ' + roomName(n.home) : 'Wanders the house');
    if (n.via.type === 'gold') return `Moves in for ◈ ${n.via.gold}`;
    const g = n.via.vow != null && S.goals.find((x) => x.id === n.via.vow);
    return g ? `Moves in when you reach “${g.title}”` : 'Waiting on a goal. Pick one in their card.';
  }
  // ---------- 2.27: putting quests away (hiding, holds) ----------
  const AWAY_OPTS = [[1, 'Today'], [7, 'A week'], [14, 'A fortnight'], [30, 'A month'], [91, 'A quarter']];
  const dayWord = (d) => new Date(d + 'T00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  function awayBlock(e) {
    if (e.id == null) return '';
    const q = G.findQ(S, e.id), t = G.today();
    if (!q) return '';
    if (G.isAway(q, t)) return `<div class="lbl">Put away</div><div class="away-on"><div><b>${q.away.why === 'hold' ? 'On hold' : 'Hidden'}</b> until ${esc(dayWord(G.addDays(q.away.back, -1)))}<small>back ${esc(dayWord(q.away.back))}${q.away.why === 'hold' ? ' · streaks protected' : ''}${q.away.note ? ' · ' + esc(q.away.note) : ''}</small></div><button class="btn small" data-m="aw-end">Bring it back</button></div>`;
    return `<div class="lbl">Put it away<small>off the list, no reminders, no neglect, until it’s back</small></div>
      <div class="pills">${AWAY_OPTS.map((o) => `<button class="pill" data-m="aw-set" data-v="${o[0]}">${o[1]}</button>`).join('')}<button class="pill" data-m="aw-date">A date…</button></div>
      ${UI.awDate ? `<div class="name-row" style="margin-top:6px"><input class="field" type="date" id="aw-d" min="${G.addDays(t, 1)}" value="${G.addDays(t, 7)}"><button class="btn small prime" data-m="aw-date-go">Until then</button></div>` : ''}
      <div class="set" style="margin-top:4px"><div class="l">Protect its streaks<small>injured, sick or away: the companions’ weeks and the training nudge wait too</small></div><button class="toggle ${UI.awHold ? 'on' : ''}" data-m="aw-hold"></button></div>`;
  }
  function awayApply(id, back) {
    const t = G.today(), q = G.findQ(S, id);
    if (!q || !(back > t)) return;
    G.awaySet(S, [id], back, !!UI.awHold, '', t);
    if (UI.edit && UI.edit.id === id) UI.edit.away = JSON.parse(JSON.stringify(q.away));
    UI.awDate = false;
    save(); render();
    toast(`${q.name} ${UI.awHold ? 'on hold' : 'hidden'} until ${dayWord(G.addDays(back, -1))}.`, () => { G.awayEnd(S, [id], t); q.away = null; save(); render(); if (UI.sheet === 'editor') renderEditor(); toast('Back on the list.'); });
  }
  function hiddenStrip(t) {
    const hid = G.awayList(S, t);
    if (!hid.length) return '';
    return `<div class="fold ${UI.showHidden ? 'open' : ''}" data-act="fold-hidden"><span>${hid.length} put away</span><i>${UI.showHidden ? '▴' : '▾'}</i></div>` +
      (UI.showHidden ? `<div class="resting">${hid.map((q) => `<span data-act="edit" data-id="${q.id}">${esc(q.icon)} ${esc(q.name)} · ${q.away.why === 'hold' ? 'held' : 'back'} ${esc(G.fmtDay(q.away.back))}</span>`).join('')}</div>` : '');
  }

  // ---------- 2.27: the offer to put it away after a go ----------
  function maybeHideOffer(id) {
    const q = G.findQ(S, id), t = G.today();
    if (!q || UI.sheet || UI.build) return;
    const sg = G.hideSuggest(S, q, t);
    if (!sg) return;
    UI.hideOffer = { id: id, days: sg.days, sg: sg };
    renderHideOffer();
  }
  function renderHideOffer() {
    const o = UI.hideOffer, q = G.findQ(S, o.id);
    if (!q) return;
    const why = o.sg.src === 'oracle' ? `The Oracle reckons it comes round about every ${o.sg.every} days${o.sg.firm ? ' (a hard limit)' : ''}${o.sg.why ? ': ' + esc(o.sg.why) : ''}.` : `You usually do it every ${o.sg.every} days.`;
    UI.sheet = null;
    openDialog(`<h3>Put it away for a while?</h3><p class="lore"><b>${esc(q.icon)} ${esc(q.name)}</b>. ${why} Hidden, it’s off the list and nothing nags until it’s back.</p>
      <div class="numpick" style="justify-content:center;margin:8px 0"><button data-m="ho-step" data-v="-7">−7</button><button data-m="ho-step" data-v="-1">−1</button><span>${o.days} days</span><button data-m="ho-step" data-v="1">+1</button><button data-m="ho-step" data-v="7">+7</button></div>
      <p class="lore" style="text-align:center;font-size:14px;margin:0">Back ${esc(dayWord(G.addDays(G.today(), o.days)))}</p>
      <div class="btns"><button class="btn" data-m="ho-once">Just this time</button><button class="btn prime" data-m="ho-every">After every go</button></div>
      <div class="btns" style="margin-top:4px"><button class="btn small" data-m="ho-later">Not now</button><button class="btn small" data-m="ho-never">Don’t ask about this one</button></div>`, 'hideoffer');
  }

  // ---------- 2.27: judging (difficulty, stat and rewards aren't his to set) ----------
  const JUDGED = { oracle: 'the Oracle', rules: 'the rules (no AI connected)', library: 'the library', hand: 'you, before 2.27' };
  function judgedBlock(e) {
    const D = DIFF[(e.diff | 0 || 2) - 1], src = e.id == null && !e.judged ? null : e.judged || 'hand';
    return `<div class="lbl">Judged<small>${src ? 'by ' + JUDGED[src] : 'when you save it: the Oracle (or the rules) sets these, not you'}</small></div>
      <div class="judged"><span class="pill on" style="--c:var(--${e.stat})">${SI[e.stat].name}</span><span class="pill on">${D.name} · +${D.xp} XP · ${D.gold} gold</span>${e.type === 'habit' ? `<span class="pill on">${e.cap ? 'up to ' + e.cap + ' a day' : 'no daily cap'}</span>` : ''}</div>
      ${e.judgedWhy ? `<p class="lore" style="font-size:14px;margin:4px 0 0">“${esc(e.judgedWhy)}”</p>` : ''}
      ${e.id != null ? `<div class="name-row" style="margin-top:6px"><input class="field" id="e-jwhy" placeholder="Something it missed? (e.g. it’s 2 hours)" maxlength="80"><button class="btn small" data-m="e-judge">${hasKey() ? 'Ask again' : 'Re-judge'}</button></div>` : ''}`;
  }
  function judgeQuest(id, note, quiet) {
    const q = G.findQ(S, id);
    if (!q) return;
    if (!hasKey()) {
      const j = G.judgeRules(q); Object.assign(q, { stat: j.stat, diff: j.diff, cap: q.type === 'habit' ? j.cap : q.cap, judged: j.src, judgedWhy: j.why }); G.normQuest(q); save();
      if (!quiet) { render(); if (UI.sheet === 'editor' && UI.edit && UI.edit.id === id) { Object.assign(UI.edit, { stat: q.stat, diff: q.diff, cap: q.cap, judged: q.judged, judgedWhy: q.judgedWhy }); renderEditor(); } toast(`Judged by the rules: ${DIFF[q.diff - 1].name} · ${SI[q.stat].name}.`); }
      return;
    }
    const P = G.judgePrompt('quest', Object.assign({}, q, { min: q.min, name: q.name + (note ? ' (player adds: ' + note + ')' : '') }), S, G.today());
    askAI(P.system, P.user, 300, (ok, out) => {
      const j = ok ? G.judgeParse('quest', out) : null, q2 = G.findQ(S, id);
      if (!q2) return;
      if (!j) { if (!quiet) toast('The Oracle couldn’t judge it' + (ok ? '.' : ': ' + out) + ' The rules’ guess stands.'); return; }
      Object.assign(q2, { stat: j.stat, diff: j.diff, cap: q2.type === 'habit' ? j.cap : q2.cap, judged: 'oracle', judgedWhy: j.why });
      G.normQuest(q2); save(); render();
      if (UI.sheet === 'editor' && UI.edit && UI.edit.id === id) { Object.assign(UI.edit, { stat: q2.stat, diff: q2.diff, cap: q2.cap, judged: 'oracle', judgedWhy: j.why }); renderEditor(); }
      toast(`The Oracle judges ${q2.name}: ${DIFF[j.diff - 1].name} · ${SI[j.stat].name}${q2.type === 'habit' ? ' · up to ' + q2.cap + ' a day' : ''}.${j.why ? ' “' + j.why + '”' : ''}`);
    });
  }
  // a goal or a target: gold and the coffer
  function judgeReward(kind, id) {
    if (!hasKey()) return;
    const t = G.today(), g = kind === 'mark' ? S.marks.find((x) => x.id === id) : S.goals.find((x) => x.id === id);
    if (!g) return;
    const o = kind === 'mark' ? { name: g.name, better: g.better, target: G.markFmt(g, g.target), best: G.markBest(g) == null ? 'none yet' : G.markFmt(g, G.markBest(g)), by: g.by }
      : { title: g.title, kind: g.kind, what: g.filter ? filterText(g.filter) : 'deeds', target: g.target, end: g.end };
    const P = G.judgePrompt(kind === 'mark' ? 'mark' : 'goal', o, S, t);
    askAI(P.system, P.user, 300, (ok, out) => {
      const j = ok ? G.judgeParse('goal', out) : null;
      const g2 = kind === 'mark' ? S.marks.find((x) => x.id === id) : S.goals.find((x) => x.id === id);
      if (!j || !g2 || g2.done) return;
      if (kind === 'mark') { g2.gold = j.gold; g2.chest = j.chest; } else { g2.reward.gold = j.gold; g2.reward.chest = j.chest; }
      g2.judged = 'oracle'; g2.judgedWhy = j.why;
      save(); render();
      toast(`The Oracle sets the bounty: ${j.gold} gold${j.chest ? ' and a coffer' : ''}.${j.why ? ' “' + j.why + '”' : ''}`);
    });
  }

  // ---------- 2.27: talking to the Oracle ----------
  function openOracleChat(prefill) {
    UI.ocPre = prefill || '';
    renderOracleChat();
    setTimeout(() => { const i = $('#oc-in'); if (i && !UI.ocBusy) { i.focus(); if (UI.ocPre) i.setSelectionRange(i.value.length, i.value.length); } }, 80);
  }
  function renderOracleChat() {
    const ii = interpInfo(), on = hasKey(), P = ii && ii.on ? PROVIDERS[ii.provider] || PROVIDERS.custom : null, t = G.today();
    const msgs = (S.oracleChat || []).slice(-20);
    const bubble = (m, mi) => m.r === 'me' ? `<div class="oc-me">${esc(m.text)}</div>`
      : `<div class="oc-or"><div>${esc(m.text)}</div>${(m.acts || []).map((a, ai) => `<div class="oc-act ${a.st || ''}"><span>${esc(G.actWords(S, a, t))}</span>${a.st ? `<small>${a.st === 'done' ? 'done' : 'left'}</small>` : `<button class="btn tiny prime" data-m="oc-do" data-i="${mi}" data-a="${ai}">Do it</button><button class="btn tiny" data-m="oc-no" data-i="${mi}" data-a="${ai}">No</button>`}</div>`).join('')}</div>`;
    const base = (S.oracleChat || []).length - msgs.length;
    UI.sheet = null;
    openSheet(`<h3>The Oracle</h3>
      ${on ? `<p class="lore" style="font-size:13.5px;margin-top:-4px">Tell it what’s going on: a rolled ankle, a busy week, something new to keep up. It suggests; nothing changes until you tap Do it. What you type, and a summary of your quests, goes to ${esc(P ? P.name : 'Claude')}.</p>` : '<p class="lore">Connect the AI helper first (Settings › AI helper). Groq is free and doesn’t keep what you send.</p>'}
      <div class="oc-log" id="oc-log">${msgs.map((m, i) => bubble(m, base + i)).join('') || (on ? '<p class="lore dim" style="text-align:center">“Speak, and be brief. I have weeklies to set.”</p>' : '')}${UI.ocBusy ? '<div class="oc-or dim">The Oracle ponders…</div>' : ''}</div>
      ${on ? `<textarea class="field" id="oc-in" rows="2" maxlength="600" placeholder="e.g. Rolled my ankle. No running for a bit." ${UI.ocBusy ? 'disabled' : ''}>${esc(UI.ocPre || '')}</textarea>
        <div class="btns">${msgs.length ? '<button class="btn small" data-m="oc-clear">Clear</button>' : ''}<button class="btn" data-m="close">Close</button><button class="btn prime" data-m="oc-send" ${UI.ocBusy ? 'disabled' : ''}>Send</button></div>`
        : '<div class="btns"><button class="btn" data-m="close">Close</button><button class="btn prime" data-act="interp-open">Set up</button></div>'}`, 'ochat');
    const lg = $('#oc-log'); if (lg) lg.scrollTop = lg.scrollHeight;
  }
  function oracleSend() {
    const el = $('#oc-in'), msg = el ? el.value.trim() : '';
    if (!msg || UI.ocBusy) return;
    const t = G.today();
    if (!Array.isArray(S.oracleChat)) S.oracleChat = [];
    const hist = S.oracleChat.slice();
    S.oracleChat.push({ r: 'me', text: msg.slice(0, 600), at: Date.now() });
    UI.ocBusy = true; UI.ocPre = '';
    save(); renderOracleChat();
    const P = G.chatPrompt(S, t, hist, msg);
    askAI(P.system, P.user, 900, (ok, out) => {
      UI.ocBusy = false;
      const r = ok ? G.chatParse(S, out, G.today()) : { say: 'The Oracle is silent: ' + out, actions: [] };
      S.oracleChat.push({ r: 'or', text: r.say, acts: r.actions, at: Date.now() });
      S.oracleChat = S.oracleChat.slice(-30);
      save();
      if (UI.sheet === 'ochat') renderOracleChat(); else toast('The Oracle answered. Tap the 🔮 chip to see it.');
    });
  }
  // the day's fresh lines, and how often things come round: one ask each, in the background
  function oracleChores() {
    if (!hasKey() || UI.ocChores) return;
    const t = G.today();
    const barks = S.settings.oracleBarks !== false && !(S.barks && S.barks.day === t);
    const hints = S.settings.oracleHints !== false && !(S.hintsAt && G.daysBetween(S.hintsAt, t) < 7);
    if (!barks && !hints) return;
    UI.ocChores = true;
    const next = () => {
      if (!hints) { UI.ocChores = false; return; }
      const P = G.hintsPrompt(S);
      askAI(P.system, P.user, 1500, (ok, out) => { UI.ocChores = false; if (ok) { G.hintsApply(S, G.hintsParse(S, out), G.today()); save(); } else S.hintsAt = t; });
    };
    if (!barks) { next(); return; }
    const P = G.barkPrompt(S, t);
    askAI(P.system, P.user, 1800, (ok, out) => { const L = ok ? G.barkParse(S, out, t) : null; S.barks = { day: t, lines: L || (S.barks && S.barks.lines) || {} }; save(); next(); });
  }
  // ---------- 2.26: people from the calendar ----------
  // Names in the calendar are offered once each; the people Jake designs turn up ahead of their events, as far ahead as
  // he says, and the big ones bring a to-do or two. Kids and little ones never delve: they just potter about.
  const LEAD_WORDS = { 0: 'On the day', 1: 'A day before', 3: '3 days before', 7: 'A week before', 14: 'A fortnight before' };
  const AGE_WORDS = { adult: 'Grown-up', kid: 'Kid', baby: 'Little one' };
  const personById = (id) => (S.people || []).find((p) => p.id === id) || null;
  const peopleCalsOn = () => Array.isArray(S.settings.peopleCals) && S.settings.peopleCals.length > 0;
  function peoplePull(quiet, force) {
    const t = G.today();
    let read = false;
    // a year of the calendar is a fair read; on resume, once every 20 minutes is plenty
    if (N && N.peopleEvents && peopleCalsOn() && (force || !(Date.now() - (S.calPeople.at || 0) < 20 * 60000))) {
      try {
        const evs = G.calDigest(JSON.parse(N.peopleEvents(S.settings.peopleCals.join(',')) || '[]'), t);
        if (JSON.stringify(S.calPeople.evs) !== JSON.stringify(evs)) S.calPeople = { at: Date.now(), evs: evs }; else S.calPeople.at = Date.now();
        read = true;
      } catch (e) { /* the calendar can wait */ }
    }
    if (force && !peopleCalsOn()) { S.calPeople = { at: 0, evs: [] }; read = true; }   // every calendar unpicked: nothing to go on
    const r = G.calTodos(S, t);
    if (read || r.added.length || r.gone) save();
    if (r.added.length && !quiet) toast('From your calendar: ' + r.added.map((x) => x.replace(/ \(.*\)$/, '')).join(' · '));
    return read;
  }
  function personLine(p, t) {
    t = t || G.today();
    const ev = G.nextEventFor(S, p, t), v = G.visitorsNow(S, t).find((x) => x.p === p);
    const bits = [];
    if (ev) { const w = G.evWords(ev, t); bits.push(w.icon + ' ' + w.what + ' ' + w.when); }
    else bits.push(p.cal.mode === 'always' ? 'Lives here' : 'Nothing coming up');
    if (v && !v.lives) bits.push('here now');
    else if (p.cal.mode === 'never') bits.push('stays away');
    return bits.join(' · ');
  }
  function turnsUpWords(p) {
    if (p.cal.mode === 'always') return 'Lives here';
    if (p.cal.mode === 'never') return 'Doesn’t turn up at the house';
    return (p.cal.lead ? LEAD_WORDS[p.cal.lead].replace(' before', '') + ' ahead of ' : 'On the day of ') + (p.cal.which === 'any' ? 'anything with them in the calendar' : 'birthdays and big days');
  }
  // the calendars names are read from (any or all of them)
  function openPeopleCals(flow) {
    let info = {};
    try { info = N && N.heraldInfo ? JSON.parse(N.heraldInfo()) : {}; } catch (e) { info = {}; }
    if (N && info.perm === false && N.askCalendar) { N.askCalendar(); toast('Allow the calendar, then tap again.'); return; }
    const cals = info.cals || [], on = (S.settings.peopleCals || []).map(String);
    UI.peopleFlow = !!flow;
    UI.sheet = null;
    openSheet(`<h3>People in your calendar</h3><p class="lore">Pick the calendars with birthdays and visits in them. Anyone named (“Paul’s birthday”, “Dinner with Sarah”, “Emma’s 5th birthday”) gets offered to you, once. Only titles are read, and nothing leaves the phone.</p>
      ${cals.length ? cals.map((c) => `<div class="row" data-m="pc-tog" data-id="${esc(String(c.id))}"><div class="rb"><div class="rn">${esc(c.name)}</div><div class="rs">${esc(c.account || '')}</div></div><button class="toggle ${on.indexOf(String(c.id)) >= 0 ? 'on' : ''}" data-m="pc-tog" data-id="${esc(String(c.id))}"></button></div>`).join('') : '<p class="lore">No calendars on this phone that the app can read.</p>'}
      <div class="btns">${flow ? '<button class="btn" data-m="pc-skip">Skip</button>' : ''}<button class="btn prime" data-m="pc-done">${flow ? 'Next' : 'Done'}</button></div>`, 'peoplecals');
  }
  function openPeopleFound(flow) {
    const t = G.today(), c = G.peopleCandidates(S, t);
    UI.peopleFlow = !!flow;
    if (!c.length) {
      if (flow) { UI.peopleFlow = false; closeModal(); render(); maybeWelcome(); return; }
      toast(peopleCalsOn() ? 'No one new in your calendar.' : 'Pick a calendar first.'); return;
    }
    UI.sheet = null;
    openSheet(`<h3>Who’s this?</h3><p class="lore">Names from your calendar. Design the ones you want around the house; they’ll turn up ahead of their days.</p>
      ${c.slice(0, 12).map((x) => { const w = G.evWords(x.ev, t); return `<div class="row pf"><div class="ri">${w.icon}</div><div class="rb"><div class="rn">${esc(x.name)}${x.age != null ? ` <small class="dim">${x.age < 1 ? 'a baby' : 'about ' + x.age}</small>` : ''}</div><div class="rs">${esc(w.what)} · ${esc(w.date)}${x.n > 1 ? ' · and ' + (x.n - 1) + ' more' : ''}</div>
        <div class="btns" style="margin-top:6px;justify-content:flex-start"><button class="btn small prime" data-m="pf-design" data-k="${esc(x.key)}">Design</button><button class="btn small" data-m="pf-later" data-k="${esc(x.key)}">Not now</button><button class="btn small" data-m="pf-no" data-k="${esc(x.key)}">Not a person</button></div></div></div>`; }).join('')}
      ${c.length > 12 ? `<p class="lore" style="font-size:14px">And ${c.length - 12} more after these.</p>` : ''}
      <div class="btns"><button class="btn" data-m="${flow ? 'pf-finish' : 'close'}">${flow ? 'That’s enough for now' : 'Close'}</button></div>`, 'peoplefound');
  }
  function openPersonEditor(id, cand) {
    const p = id ? personById(id) : null;
    const age = cand ? G.ageGuess(cand.age) : 'adult';
    UI.personEdit = p ? JSON.parse(JSON.stringify(p)) : { id: null, name: cand ? cand.name : G.randomName(), also: [], age: age, garb: 'plain', hat: 'none', about: '', cal: { mode: 'events', lead: 7, which: 'big', todos: true }, key: cand ? cand.key : null };
    UI.npcEdit = null;
    UI.look = Object.assign({}, p ? p.look : G.randomLook());
    if (UI.personEdit.age !== 'adult') UI.look.age = UI.personEdit.age; else delete UI.look.age;
    if (UI.look.age) UI.look.beard = 'none';
    UI.lookName = UI.personEdit.name;
    UI.lookFirst = false;
    UI.sheet = null;
    renderCreator();
  }
  function personControls() {
    const P = UI.personEdit, L = UI.look, kid = P.age !== 'adult';
    const sw = (k) => `<div class="swatches">${G.LOOKS[k].map((v) => `<button class="swatch ${L[k] === v ? 'on' : ''}" style="--sw:${v}" data-m="c-set" data-k="${k}" data-v="${v}" aria-label="${v}"></button>`).join('')}</div>`;
    const pillsOf = (map, cur, m) => `<div class="pills">${Object.keys(map).map((k) => `<button class="pill ${cur === k ? 'on' : ''}" data-m="${m}" data-v="${k}">${esc(map[k].name)}</button>`).join('')}</div>`;
    return `<div class="lbl">Shirt</div>${sw('outfit')}
      ${kid ? `<div class="lbl">Wearing</div><div class="pills">${['pants', 'skirt'].map((v) => `<button class="pill ${(L.legs || (L.sex === 'f' ? 'skirt' : 'pants')) === v ? 'on' : ''}" data-m="c-set" data-k="legs" data-v="${v}">${v === 'pants' ? 'Pants' : 'A skirt'}</button>`).join('')}</div>`
        : `<div class="lbl">Clothes</div>${pillsOf(G.GARB, P.garb, 'n-garb')}<div class="lbl">Hat</div>${pillsOf(G.HATS, P.hat, 'n-hat')}`}
      <div class="lbl">Who are they?</div><input class="field" id="p-about" value="${esc(P.about)}" maxlength="60" placeholder="e.g. My nephew">
      <div class="lbl">Also goes by<small>other names in your calendar, with commas</small></div><input class="field" id="p-also" value="${esc(P.also.join(', '))}" maxlength="120" placeholder="e.g. Paulie, Uncle Paul">
      <div class="lbl">At the house</div><div class="seg">${[['events', 'For their days'], ['always', 'Lives here'], ['never', 'Never']].map((o) => `<button class="${P.cal.mode === o[0] ? 'on' : ''}" data-m="p-mode" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>
      ${P.cal.mode === 'events' ? `<div class="lbl">Turns up</div><div class="pills">${G.PEOPLE_LEADS.map((d) => `<button class="pill ${P.cal.lead === d ? 'on' : ''}" data-m="p-lead" data-v="${d}">${LEAD_WORDS[d]}</button>`).join('')}</div>
        <div class="lbl">For</div><div class="pills"><button class="pill ${P.cal.which === 'big' ? 'on' : ''}" data-m="p-which" data-v="big">Birthdays and big days</button><button class="pill ${P.cal.which === 'any' ? 'on' : ''}" data-m="p-which" data-v="any">Anything with them</button></div>
        <p class="lore" style="font-size:14px;margin-top:4px">They stay until the day’s over, then head home. Visitors go home at night.</p>` : ''}
      <div class="set" style="margin-top:6px"><div class="l">To-dos for their big days<small>${kid ? 'organising the party, then the present' : 'a present, a card, getting the house ready'}</small></div><button class="toggle ${P.cal.todos ? 'on' : ''}" data-m="p-todos"></button></div>
      <div class="btns"><button class="btn" data-m="c-random">Randomise</button>${P.id ? '<button class="btn blood" data-m="p-remove">Remove</button>' : ''}<button class="btn" data-m="close">Cancel</button><button class="btn prime" data-m="p-save">${P.id ? 'Save' : 'Done'}</button></div>`;
  }
  function syncPersonInputs() {
    const P = UI.personEdit;
    if (!P) return;
    const ab = $('#p-about'), al = $('#p-also'), nm = $('#c-name');
    if (ab) P.about = ab.value.trim().slice(0, 60);
    if (al) P.also = al.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6);
    if (nm) UI.lookName = nm.value;
  }
  function savePerson() {
    syncPersonInputs();
    const P = UI.personEdit, t = G.today();
    if (!P) return;
    P.name = (UI.lookName || '').trim().slice(0, 24) || G.randomName();
    P.look = G.normLook(Object.assign({}, UI.look, P.age === 'adult' ? { age: null } : { age: P.age }));
    const was = P.id ? personById(P.id) : null;
    if (!was) {
      if (S.people.length >= 40) { toast('That’s a lot of people. Remove someone first.'); return; }
      P.id = 'p' + G.nextId(S); P.joined = t;
      S.people.push(P);
    } else Object.assign(was, { name: P.name, also: P.also, look: P.look, age: P.age, garb: P.garb, hat: P.hat, about: P.about, cal: P.cal });
    // the name they were offered under goes with them, if it's different
    if (P.key && G.nameKey(P.name) !== P.key) { const p = personById(P.id); if (!p.also.some((a) => G.nameKey(a) === P.key)) p.also.push(P.key.replace(/\b\w/g, (c) => c.toUpperCase())); }
    G.peopleNorm(S, t);
    const r = G.calTodos(S, t);
    const p = personById(P.id), ev = G.nextEventFor(S, p, t);
    UI.personEdit = null;
    save(); closeModal(); render();
    let msg;
    if (!ev || p.cal.mode !== 'events') msg = was ? 'Saved.' : p.name + (p.cal.mode === 'always' ? ' lives here now.' : ' is in the household.');
    else { const w = G.evWords(ev, t), d = G.daysBetween(t, ev.d); msg = d <= p.cal.lead ? p.name + ' has turned up: ' + w.what + ', ' + w.when + '.' : p.name + ' will turn up ' + (p.cal.lead ? LEAD_WORDS[p.cal.lead].toLowerCase() : 'on the day') + ': ' + w.what + ', ' + w.date + '.'; }
    toast(msg + (r.added.length ? ' Added: ' + r.added.map((x) => x.replace(/ \(.*\)$/, '')).join(' · ') : ''));
    if (UI.peopleFlow || (!was && G.peopleCandidates(S, t).length && UI.fromFound)) setTimeout(() => openPeopleFound(UI.peopleFlow), 350);
    UI.fromFound = false;
  }
  function openPerson(id) {
    const p = personById(id);
    if (!p) return;
    const t = G.today(), evs = G.evsFor(S, p).filter((e) => e.end >= t).slice(0, 4), v = G.visitorsNow(S, t).find((x) => x.p === p);
    let h = `<div class="npc-head"><canvas class="pport big" width="120" height="120" data-p="${esc(id)}"></canvas><div><h3 style="margin:0">${esc(p.name)}</h3><div class="rs">${esc([AGE_WORDS[p.age], p.about].filter(Boolean).join(' · '))}</div></div></div>`;
    if (evs.length) {
      const e = evs[0], w = G.evWords(e, t), d = G.daysBetween(t, e.d);
      h += `<div class="countdown"><div class="cd-ic">${w.icon}</div><div><div class="cd-n">${d <= 0 ? (e.end >= t && d < 0 ? 'On now' : 'Today') : d === 1 ? 'Tomorrow' : d + ' days'}</div><div class="rs">${esc(w.what)} · ${esc(w.date)}</div></div></div>`;
      if (evs.length > 1) h += `<div class="lbl">After that</div>${evs.slice(1).map((x) => { const ww = G.evWords(x, t); return `<div class="kv"><span>${ww.icon} ${esc(ww.what)}</span><b>${esc(ww.date)}</b></div>`; }).join('')}`;
    } else h += `<p class="lore">Nothing with ${esc(p.name)} in your calendar for the next year${peopleCalsOn() ? '' : ' (no calendar picked yet)'}.</p>`;
    { const line = G.barkFor(S, 'p:' + id, Date.now() / 3600e3); if (line && v) h += `<p class="lore" style="font-size:15px">“${esc(line)}”</p>`; }   // 2.27
    h += `<div class="kv"><span>At the house</span><b>${esc(turnsUpWords(p))}</b></div>${v && !v.lives && v.ev ? `<p class="lore" style="font-size:14px;color:var(--gold2)">Here now, staying until ${esc(G.fmtDay(v.ev.end))}.</p>` : ''}
      ${p.also.length ? `<div class="kv"><span>Also goes by</span><b>${esc(p.also.join(', '))}</b></div>` : ''}
      <div class="btns"><button class="btn" data-m="p-edit" data-k="${esc(id)}">Edit</button><button class="btn prime" data-m="close">Done</button></div>`;
    UI.sheet = null; openSheet(h, 'person'); UI.personId = id; mountPeoplePortraits();
  }
  const PPORT = {};
  function mountPeoplePortraits() {
    $$('canvas.pport').forEach((c) => {
      const p = personById(c.dataset.p);
      if (!p || !window.LPC) return;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      const d = LPC.dress(G.normLook(p.look), G.npcGear(p), { kit: false }), sig = JSON.stringify(d), W = c.width, kid = !!d.kid;
      const draw = (sh) => { g.clearRect(0, 0, W, W); const z = W / 96 * (kid ? 1.5 : 1.33); g.drawImage(sh.walk, 0, 128, 64, 64, W / 2 - 32 * z, (kid ? -26 : -8) * z / 1.33, 64 * z, 64 * z); };
      if (PPORT[p.id] && PPORT[p.id].sig === sig && PPORT[p.id].sheets) { draw(PPORT[p.id].sheets); return; }
      PPORT[p.id] = { sig: sig };
      LPC.build(d.spec, d.body, ['walk']).then((h) => { if (PPORT[p.id].sig !== sig) return; PPORT[p.id].sheets = h.sheets; draw(h.sheets); }).catch(() => {});
    });
  }
  function peopleHousehold() {
    const t = G.today(), ps = (S.people || []).slice().sort((a, b) => { const ea = G.nextEventFor(S, a, t), eb = G.nextEventFor(S, b, t); return (ea ? ea.d : '9') < (eb ? eb.d : '9') ? -1 : 1; });
    const cand = G.peopleCandidates(S, t).length;
    return `<div class="hd">From your calendar<small>they turn up for their days</small></div>
      ${ps.map((p) => `<div class="row npc" data-m="hh-person" data-k="${esc(p.id)}"><canvas class="pport" width="96" height="96" data-p="${esc(p.id)}"></canvas><div class="rb"><div class="rn">${esc(p.name)}${p.age !== 'adult' ? ` <small class="dim">${AGE_WORDS[p.age].toLowerCase()}</small>` : ''}</div><div class="rs">${esc(personLine(p, t))}</div></div><div class="dim" style="font-size:20px">›</div></div>`).join('')}
      ${ps.length ? '' : `<p class="lore" style="font-size:14px">${peopleCalsOn() ? 'No one yet.' : 'Pick the calendars with birthdays in them and anyone named gets offered to you.'}</p>`}
      <div class="btns">${cand ? `<button class="btn prime" data-m="hh-found">${cand} name${cand > 1 ? 's' : ''} to look at</button>` : ''}<button class="btn" data-m="hh-pcals">${peopleCalsOn() ? 'Calendars' : 'Pick calendars'}</button><button class="btn" data-m="hh-pnew">Add someone</button></div>
      <div class="hd">Pets<small>${esc(G.petsList(S).map((x) => x.name).join(', ') || 'none')}</small></div>
      <div class="btns" style="margin-top:0"><button class="btn" data-m="hh-pets">Pets</button></div>`;
  }

  // ---------- 2.26: pets ----------
  function openPets(first) {
    UI.pets = G.petsList(S).map((x) => Object.assign({}, x));
    UI.petsFirst = !!first;
    renderPets();
  }
  function syncPets() { $$('#modal input.pet-name').forEach((el) => { const x = UI.pets[+el.dataset.i]; if (x) x.name = el.value; }); }
  function renderPets() {
    const K = G.PET_KINDS, have = (sp) => UI.pets.some((x) => x.sp === sp);
    const h = `<h3>${UI.petsFirst ? 'Any animals at home?' : 'Pets'}</h3><p class="lore">Parrots get the run of the house (and the aviary); the others come with a home of their own, free. Their feeding becomes a chore.</p>
      ${UI.pets.map((x, i) => `<div class="row pet-row"><div class="ri">${K[x.sp].i}</div><div class="rb"><input class="field pet-name" data-i="${i}" value="${esc(x.name)}" maxlength="24" placeholder="${esc(K[x.sp].n)}"><div class="rs">${esc(K[x.sp].n)}${K[x.sp].blurb ? ' · ' + esc(K[x.sp].blurb) : ''}</div></div><button class="pet-x" data-m="pet-del" data-i="${i}" aria-label="Remove">✕</button></div>`).join('') || '<p class="lore" style="font-size:14px">None yet.</p>'}
      <div class="lbl">Add</div><div class="pills">${Object.keys(K).map((k) => `<button class="pill" data-m="pet-add" data-v="${k}" ${(K[k].parrot && have(k)) || UI.pets.length >= G.PET_MAX + 2 ? 'disabled' : ''}>${K[k].i} ${esc(K[k].n)}</button>`).join('')}</div>
      <div class="btns">${UI.petsFirst ? '' : '<button class="btn" data-m="close">Cancel</button>'}<button class="btn prime" data-m="pet-save">${UI.petsFirst ? (UI.pets.length ? 'Next' : 'No pets · next') : 'Save'}</button></div>`;
    UI.sheet = null;
    openSheet(h, 'pets');
  }
  // first run: hero, then pets, then the calendar, then the people in it
  function firstRunCalendar() {
    if (!N || !N.heraldInfo || !N.peopleEvents) { closeModal(); render(); maybeWelcome(); return; }
    UI.sheet = null;
    openSheet(`<h3>Your calendar</h3><p class="lore">Link the calendars with birthdays and visits in them, and anyone named can be designed and turn up at the house for their days: a week before a birthday, say. Kids too.</p>
      <p class="lore" style="font-size:14px">Your work roster and the herald (deeds logged from other apps) can be linked later, in Settings.</p>
      <div class="btns"><button class="btn" data-m="fr-skip">Not now</button><button class="btn prime" data-m="fr-cal">Pick calendars</button></div>`, 'frcal');
  }
  function openHousehold() {
    const comps = G.CALLING_ORDER.map((k) => S.npcs.find((n) => n.comp === k)).filter(Boolean);
    const res = S.npcs.filter((n) => n.status === 'resident' && !n.comp), wait = S.npcs.filter((n) => n.status === 'waiting' && !n.comp);
    const row = (n) => `<div class="row npc" data-m="hh-npc" data-k="${esc(n.id)}"><canvas class="npcport" width="96" height="96" data-k="${esc(n.id)}"></canvas>
      <div class="rb"><div class="rn">${esc(n.name)}</div><div class="rs">${esc(n.status === 'waiting' && n.id.indexOf('w-') === 0 ? n.about.split('.')[0] + ' · ' + n.role : npcLine(n))}${n.status === 'resident' && n.bond ? ' · ' + '♥'.repeat(Math.min(5, Math.ceil(n.bond / 3))) : ''}</div>${n.status === 'waiting' ? wantsHtml(n.id) : ''}</div>
      ${n.status === 'waiting' && n.via.type === 'gold' ? `<button class="btn small prime" data-m="npc-invite" data-k="${esc(n.id)}" ${S.gold < n.via.gold ? 'disabled' : ''}>◈ ${n.via.gold}</button>` : '<div class="dim" style="font-size:20px">›</div>'}</div>`;
    const crow = (n) => { const st = G.callingState(S, n.comp), here = n.status === 'resident';
      return `<div class="row npc comp ${here ? '' : 'away'}" data-m="hh-npc" data-k="${esc(n.id)}"><canvas class="npcport" width="96" height="96" data-k="${esc(n.id)}"></canvas>
        <div class="rb"><div class="rn">${here ? esc(n.name) : esc(st.C.title)} ${here ? `<small class="dim">${esc(st.C.title)}</small>` : '<small class="dim">not yet</small>'}</div>
        <div class="rs">${here ? esc(compBuffs(st).join(' · ') || 'At ' + Math.round(st.m * 100) + '%: no buffs up') : esc(st.C.what)}</div>${here ? '' : callingPips(st)}</div><div class="dim" style="font-size:20px">›</div></div>`; };
    let h = `<h3>Household</h3><div class="hd">Companions<small>they turn up when a habit sticks</small></div>${comps.map(crow).join('')}
      <div class="hd">The household<small>who lives at the hearth</small></div>${res.map(row).join('')}
      ${wait.length ? '<div class="hd">Waiting to move in</div>' + wait.map(row).join('') : ''}
      ${(() => { const nx = G.wandererNext(S); return nx ? `<p class="lore" style="font-size:14px">Strangers turn up at the gate as you level. The next is due at level ${nx[1]}.</p>` : ''; })()}
      <div class="btns"><button class="btn prime" data-m="hh-new">Design someone</button></div>
      ${peopleHousehold()}
      <div class="row" data-m="hh-adh"><div class="ri">📈</div><div class="rb"><div class="rn">Before and after 2.5</div><div class="rs">Days a week at each habit, the ${G.daysBetween(S.since25, G.today()) >= 42 ? 'six weeks either side' : 'weeks either side so far'}</div></div><div class="dim" style="font-size:20px">›</div></div>
      <div class="oracle-note">Companions turn up when a habit sticks and are the real help in the delve. People you design yourself move in now, for gold, or as the reward for a goal, and can tag along at ${Math.round(G.TAGALONG * 100)}%. ${(() => { const bs = S.npcs.filter((x) => x.kind === 'bird').map((x) => x.name); return bs.length ? 'Give ' + esc(G.joinNames(bs)) + ' a room of ' + (bs.length > 1 ? 'their' : 'its') + ' own with ✎ on the house.' : ''; })()}</div>`;
    UI.sheet = null;
    openSheet(h + '<div class="btns"><button class="btn" data-m="close">Close</button></div>', 'household');
    mountNpcPortraits(); mountPeoplePortraits();
  }
  // Little portraits: the birds from the atlas, people built from their LPC look.
  const NPCP = {};
  function mountNpcPortraits() {
    $$('canvas.npcport').forEach((c) => {
      const n = npcById(c.dataset.k);
      if (!n || !window.House2D) return;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      if (n.kind === 'bird') { House2D.thumb(c, n.id + '.perch0', 5).catch(() => {}); return; }
      if (n.comp && n.status !== 'resident' && !c.classList.contains('big') && UI.sheet !== 'creator') { g.clearRect(0, 0, c.width, c.height); g.font = '54px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = 0.5; g.fillText(G.COMP_ROLES[n.comp].i, 48, 52); g.globalAlpha = 1; return; }
      const d = LPC.dress(G.normLook(n.look), G.npcGear(n), { kit: false }), sig = JSON.stringify(d);
      const draw = (sh) => { g.clearRect(0, 0, c.width, c.height); g.drawImage(sh.walk, 0, 128, 64, 64, -16, -6, 128, 128); };
      if (NPCP[n.id] && NPCP[n.id].sig === sig && NPCP[n.id].sheets) { draw(NPCP[n.id].sheets); return; }
      NPCP[n.id] = { sig: sig };
      LPC.build(d.spec, d.body, ['walk']).then((h) => { if (NPCP[n.id].sig !== sig) return; NPCP[n.id].sheets = h.sheets; draw(h.sheets); }).catch(() => {});
    });
  }
  // 2.24: where they live in town, on their card
  function townHomeHtml(n) {
    const h = G.homeOf && G.homeOf(S, n.id);
    if (!h) return '';
    const P = G.TMAP.plots[h.plot], w = G.homeWants(S, n.id), where = 'Plot ' + (h.plot + 1) + ', ' + G.streetOf(P.y + 5);
    return `<div class="lbl">Their house in town</div><p class="lore" style="font-size:15px;margin-top:0">${esc(where)}: ${h.built ? (h.settled ? 'built, and they’ve settled in.' : 'built; ' + w.filter((x) => !x.ok).length + ' thing' + (w.filter((x) => !x.ok).length === 1 ? '' : 's') + ' still wanted.') : 'nothing on it yet. A cottage costs ◈ ' + G.homeCost(S) + '.'}</p>` +
      (h.built ? `<div class="btns" style="margin-top:0"><button class="btn small" data-m="npc-visit" data-k="${esc(n.id)}">Visit</button></div>` : '');
  }
  function openNpc(id) {
    const n = npcById(id);
    if (!n) return;
    const homes = [n.kind === 'bird' ? ['aviary', 'The aviary'] : ['', 'Anywhere']].concat(S.house.rooms.map((r) => [r.id, r.name]));
    const homePills = `<div class="pills">${homes.map((o) => `<button class="pill ${(n.home || '') === o[0] ? 'on' : ''}" data-m="npc-home" data-k="${esc(id)}" data-v="${esc(o[0])}">${esc(o[1])}</button>`).join('')}</div>`;
    let h = `<div class="npc-head"><canvas class="npcport big" width="120" height="120" data-k="${esc(id)}"></canvas><div><h3 style="margin:0">${esc(n.name)}</h3>`;
    if (n.comp) {
      const st = G.callingState(S, n.comp), C = st.C, RO = G.COMP_ROLES[n.comp], here = n.status === 'resident';
      h += `<div class="rs">${esc(C.title)}${here ? '' : ' · not here yet'}</div></div></div>`;
      h += `<div class="lbl">${here ? 'What keeps them sharp' : 'They turn up after'}</div><p class="lore" style="font-size:15.5px;margin-top:0">${esc(C.what)}.</p>
        <div class="kv"><span>This week</span><b>${st.thisWeek} of ${st.days} days</b></div><div class="kv"><span>Weeks running</span><b>${st.streak}${here ? '' : ' of ' + st.need} ${callingPips(st)}</b></div>
        ${st.grace ? `<div class="kv"><span>Emergency skip</span><b>${st.skips ? '1 left' : 'used'}</b></div><p class="lore" style="font-size:13.5px;margin-top:2px">Miss a week and the skip covers it: the run waits a week instead of starting over. It comes back when the run's done.${st.back ? ' Back at it: this week\u2019s first ' + esc(C.shortWhat.replace(/^any /, '')) + ' buff lasts twice as long.' : ''}</p>` : ''}`;
      if (here) {
        const b = compBuffs(st);
        h += `<div class="lbl">Buffs</div><p class="lore" style="font-size:15px;margin-top:0">${b.length ? b.map(esc).join('<br>') : 'None up right now.'}</p>
          <div class="kv"><span>Toward ${esc(C.long)}</span><b>${st.toward} of ${st.need} weeks</b></div>
          <p class="lore" style="font-size:14px">${esc(C.long)} (5 days) comes from answering the whole calling again: another ${st.need} weeks running. ${esc(C.short)} (${C.shortH} h, stacks to three) comes from ${esc(C.shortWhat)}. On their own they're at 60%; right now, ${Math.round(st.m * 100)}%.</p>
          <div class="lbl">In the delve</div><p class="lore" style="font-size:15px;margin-top:0">${RO.i} ${RO.n}${n.comp === 'mage' ? ' (' + EL(n.el) + ')' : ''}: ${esc(RO.what({ m: st.m, el: n.el }))}.${S.delve.comp === n.id ? ' Goes with him now.' : ` <a data-m="npc-delve" data-k="${esc(n.id)}">Take them delving ›</a>`}</p>
          <div class="lbl">Home</div>${homePills}${townHomeHtml(n)}`;
      } else h += `<p class="lore" style="font-size:14px">${RO.i} In the delve they'll be a ${RO.n.toLowerCase()}. You can dress them up while you wait.</p>`;
      h += `<div class="btns"><button class="btn" data-m="npc-edit" data-k="${esc(id)}">${here ? 'Edit' : 'Dress them'}</button><button class="btn prime" data-m="close">Done</button></div>`;
      UI.sheet = null; openSheet(h, 'npc'); UI.npcId = id; mountNpcPortraits();
      return;
    }
    if (n.kind === 'bird') {
      const B = G.BIRDS[id], hs = H(), fed = hs.birds, cage = hs.aviary;
      h += `<div class="rs">${esc(B.sp)}</div></div></div><p class="lore">${esc(B.blurb)}</p>`;
      if (fed && fed.linked) h += `<div class="kv"><span>Fed</span><b style="color:${STATE_C[fed.state]};font:600 15px var(--gar)">${fed.known ? daysText(fed.days) : 'not yet logged'}</b></div>`;
      if (cage && cage.linked && n.home === 'aviary') h += `<div class="kv"><span>Cage cleaned</span><b style="color:${STATE_C[cage.state]};font:600 15px var(--gar)">${cage.known ? daysText(cage.days) : 'not yet logged'}</b></div>`;
      h += `<div class="lbl">Home</div>${homePills}`;
      const kerm = npcById('kermit');
      if (id === 'ruby' && kerm && n.home !== 'aviary' && n.home === kerm.home) h += `<p class="lore" style="color:var(--gold2)">${esc(kerm.name)} won’t have her in there. She’ll sulk next door.</p>`;
      if (id === 'kermit' && kerm.home !== 'aviary' && npcById('ruby')) h += `<p class="lore" style="font-size:14px">He’ll defend it from ${esc(npcById('ruby').name)}. Give her somewhere else.</p>`;
      if (id === 'ruby' && !S.house.items.some((it) => it.k === 'nightcage')) h += '<p class="lore" style="font-size:14px">She’d love a night cage (✎ › Add).</p>';
      const bc = G.compFor(Object.assign({}, S, { delve: Object.assign({}, S.delve, { comp: id }) })), BR = G.COMP_ROLES[G.BIRD_ROLE[id]];
      h += `<div class="lbl">In the delve</div><p class="lore" style="font-size:15px;margin-top:0">${BR.i} ${BR.n}: ${esc(BR.what(bc || { m: 1 }))}.${bc && bc.sulk ? ' Right now ' + (id === 'ruby' ? 'she' : 'he') + '’s sulking and won’t come: feed ' + (id === 'ruby' ? 'her' : 'him') + '.' : bc && bc.m < 1 ? ' Hungry, so only at ' + Math.round(bc.m * 100) + '%.' : ''}</p>`;
      h += `<div class="btns"><button class="btn" data-m="npc-feed">Feeding and cleaning</button>${S.delve.comp === id ? '' : `<button class="btn" data-m="npc-delve" data-k="${esc(id)}">Take delving</button>`}<button class="btn prime" data-m="close">Done</button></div>`;
    } else {
      h += `<div class="rs">${esc(n.about || (n.status === 'resident' ? 'Lives here' : 'Not moved in yet'))}</div></div></div>`;
      if (n.status === 'waiting') h += `<p class="lore">${esc(npcLine(n))}.</p>` + (G.npcWants(S, id).length ? '<div class="lbl">For their home in town, once they’re in</div>' + wantsHtml(id) : '');
      if (n.status === 'resident' && n.bond) h += `<div class="kv"><span>Favours done for them</span><b>${n.bond}</b></div>`;
      if (n.status === 'waiting' && n.via.type === 'vow') {
        const open = S.goals.filter((g) => !g.done && G.goalState(g, G.today()) === 'open');
        h += `<div class="lbl">Moves in when you reach</div><select class="field" id="npc-vow" data-k="${esc(id)}"><option value="">Choose a goal…</option>${open.map((g) => `<option value="${g.id}" ${n.via.vow === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select>${open.length ? '' : '<p class="lore" style="font-size:14px">No open goals. Set one under Quests › Vows.</p>'}`;
      }
      if (n.status === 'resident') { const RO = G.COMP_ROLES[n.role] || G.COMP_ROLES.fighter; h += `<div class="lbl">If they come delving</div><p class="lore" style="font-size:15px;margin-top:0">${RO.i} ${RO.n}${n.role === 'mage' ? ' (' + EL(n.el) + ')' : ''}, tagging along at ${Math.round(G.TAGALONG * 100)}%: ${esc(RO.what({ m: G.TAGALONG, el: n.el }))}.${S.delve.comp === n.id ? ' Goes with him now.' : ` <a data-m="npc-delve" data-k="${esc(n.id)}">Take them ›</a>`}</p>`; }
      h += `<div class="lbl">Home</div>${homePills}${n.status === 'resident' ? townHomeHtml(n) : ''}
        <div class="btns"><button class="btn blood" data-m="npc-del" data-k="${esc(id)}">${n.status === 'resident' ? 'Move out' : 'Forget them'}</button><button class="btn" data-m="npc-edit" data-k="${esc(id)}">Edit</button>
        ${n.status === 'waiting' && n.via.type === 'gold' ? `<button class="btn prime" data-m="npc-invite" data-k="${esc(id)}" ${S.gold < n.via.gold ? 'disabled' : ''}>◈ ${n.via.gold}</button>` : `<button class="btn prime" data-m="close">Done</button>`}</div>`;
    }
    UI.sheet = null;
    openSheet(h, 'npc');
    UI.npcId = id;
    mountNpcPortraits();
  }
  function npcArrived(list) {
    list.forEach((n, i) => setTimeout(() => { if (HOUSE.inst) HOUSE.inst.ready.then((h) => h.welcome(n.id)); }, 900 + i * 1500));
  }
  // The editor: the hero's creator, with a name, clothes, and how they arrive.
  function openNpcEditor(id) {
    const n = id ? npcById(id) : null;
    UI.npcEdit = n ? JSON.parse(JSON.stringify(n)) : { id: null, kind: 'human', name: G.randomName(), look: G.randomLook(), garb: 'plain', hat: 'none', about: '', via: { type: 'now' }, home: null, status: 'resident', role: 'fighter', el: 'fire' };
    if (!UI.npcEdit.via.gold) UI.npcEdit.via.gold = 250;
    UI.look = Object.assign({}, UI.npcEdit.look);
    UI.lookName = UI.npcEdit.name;
    UI.lookFirst = false;
    UI.sheet = null;
    renderCreator();
  }
  function saveNpc() {
    const e = UI.npcEdit;
    if (!e) return;
    const ab = $('#n-about');
    e.about = ab ? ab.value.trim().slice(0, 60) : e.about;
    e.name = (UI.lookName || '').trim().slice(0, 24) || G.randomName();
    e.look = G.normLook(UI.look);
    const vs = $('#n-vow');
    if (vs) e.via.vow = vs.value ? Number(vs.value) : null;
    const was = e.id ? npcById(e.id) : null, prev = was ? was.status : null;
    const t = G.today();
    if (!was) {
      if (S.npcs.filter((x) => x.kind === 'human' && x.id.indexOf('w-') !== 0).length >= 8) { toast('Eight is a full house.'); return; }
      e.id = 'n' + G.nextId(S);
      e.status = e.via.type === 'now' ? 'resident' : 'waiting';
      e.joined = t;
      S.npcs.push(e);
    } else {
      Object.assign(was, { name: e.name, look: e.look, garb: e.garb, hat: e.hat, about: e.about, el: e.el, role: e.comp ? was.role : e.role });
      if (was.status === 'waiting') { was.via = e.via; if (e.via.type === 'now') { was.status = 'resident'; was.joined = t; } }
    }
    G.npcNorm(S, t);
    const n = npcById(e.id);
    UI.npcEdit = null;
    save(); closeModal(); render();
    if (n.status === 'resident' && prev !== 'resident') { toast(`${n.name} has moved in.`); npcArrived([n]); }
    else toast(was ? 'Saved.' : n.via.type === 'gold' ? `${n.name} will move in for ◈ ${n.via.gold}.` : n.via.vow != null ? `${n.name} is waiting on your goal.` : `${n.name} is waiting. Tie them to a goal in their card.`);
  }

  // ================= GOODS =================
  function viewCoffers() {
    return traderBlock() + `<div class="omen" style="text-align:center">The merchant eyes your purse: <span class="gl">◈ ${S.gold}</span></div>` +
      G.CHESTS.map((c) => `<div class="row"><div style="width:58px;flex:none" class="chest-stage"><div class="cs" style="width:58px">${Art.CHEST(c.k === 'gilded')}</div></div>
        <div class="rb"><div class="rn">${c.name}</div><div class="lore" style="font-size:14.5px">${c.blurb}</div></div>
        <button class="btn small ${S.gold >= c.cost ? 'prime' : ''}" data-act="buy-chest" data-k="${c.k}">◈ ${c.cost}</button></div>`).join('') +
      (S.chests > 0 ? `<div class="btns"><button class="btn prime" data-act="open-chest">Open your ${S.chests} coffer${S.chests > 1 ? 's' : ''}</button></div>` : '');
  }
  function relicStatus(k) {
    const d = G.DECOR[k];
    if (S.decor.owned.indexOf(k) >= 0) return { owned: true, text: 'Held' };
    if (d.statue) return { locked: true, text: 'Earned at the end' };
    if (d.unlock) { const m = G.MILESTONES[d.unlock]; return { locked: true, text: `Feat ${Math.min(m.n(S), m.goal)}/${m.goal}` }; }
    if (S.level < d.lv) return { locked: true, text: `Level ${d.lv}` };
    return { price: d.price, text: `◈ ${d.price}` };
  }
  function viewRelicShop() {
    const keys = Object.keys(G.DECOR).filter((k) => !G.DECOR[k].statue || S.decor.owned.indexOf(k) >= 0).sort((a, b) => (!!G.DECOR[a].unlock - !!G.DECOR[b].unlock) || (G.DECOR[a].price || 0) - (G.DECOR[b].price || 0));
    return `<div class="omen" style="text-align:center">Relics lend their strength while held. Some are sold; some must be earned.</div><div class="rgrid" style="margin-top:12px">${keys.map((k) => {
      const d = G.DECOR[k], st = relicStatus(k);
      return `<div class="rtile ${st.owned ? 'owned' : ''} ${st.locked ? 'locked' : ''}" data-act="relic" data-k="${k}"><div class="rp">${Home.decorSvg(k, S)}</div>
        <div class="rnm">${esc(d.name)}</div><div class="rst ${st.price && S.gold >= st.price ? 'afford' : ''}">${st.text}</div></div>`;
    }).join('')}</div>`;
  }
  function openRelic(k, keep) {
    const d = G.DECOR[k], st = relicStatus(k);
    let h = `<div style="text-align:center"><div class="dprev">${Home.decorSvg(k, S)}</div><h3 style="margin:8px 0 4px">${esc(d.name)}</h3>
      <div class="bonus">${bonusLine(d.bonus)}</div><p class="lore">${esc(d.blurb)}</p></div>`;
    if (st.owned) h += `<p class="lore" style="text-align:center;color:var(--VIT)">Held. Its strength is yours.</p><p class="lore" style="text-align:center;font-size:14px">${S.house.items.some((it) => it.k === 'relic' && it.r === k) ? 'It’s in the hearth. Move it with ✎ on the house.' : 'It’s in storage. Put it out with ✎ › Add on the house.'}</p>`;
    else if (d.unlock) { const m = G.MILESTONES[d.unlock]; h += `<div class="kv"><span>Feat</span><b style="font:500 16px var(--gar)">${esc(m.name)}</b></div><p class="lore" style="text-align:center">${esc(m.desc)}. ${Math.min(m.n(S), m.goal)} of ${m.goal}.</p>`; }
    else if (S.level < d.lv) h += `<p class="lore" style="text-align:center">The merchant will part with it at level ${d.lv}.</p>`;
    else h += `<div class="btns"><button class="btn prime" data-m="relic-buy" data-k="${k}" ${S.gold < d.price ? 'disabled' : ''}>Buy · ◈ ${d.price}</button></div>${S.gold < d.price ? `<p class="lore" style="text-align:center">${d.price - S.gold} gold short.</p>` : ''}`;
    if (!keep) UI.sheet = null;
    openSheet(h, 'relic');
  }
  function viewRewards() {
    const claimed = S.log.filter((e) => e.r).slice(0, 6);
    return `<div class="omen" style="text-align:center">Real-world indulgences, priced in gold you earned.</div>` +
      S.rewards.map((r) => `<div class="row"><div class="ri">${esc(r.icon)}</div><div class="rb" data-act="reward-edit" data-id="${r.id}"><div class="rn">${esc(r.name)}</div><div class="rs">tap to edit</div></div>
        <button class="btn small ${S.gold >= r.cost ? 'prime' : ''}" data-act="claim" data-id="${r.id}">◈ ${r.cost}</button></div>`).join('') +
      '<div class="btns"><button class="btn" data-act="reward-edit">New reward</button></div>' +
      (claimed.length ? '<div class="hd">Recently claimed</div>' + claimed.map((e) => `<div class="row"><div class="ri">${esc(e.i)}</div><div class="rb"><div class="rn">${esc(e.n)}</div><div class="rs">${when(e)}</div></div></div>`).join('') : '');
  }
  function claimReward(id) {
    const r = S.rewards.find((x) => x.id === id);
    if (!r) return;
    if (S.gold < r.cost) { toast(`${r.cost - S.gold} gold short.`); return; }
    confirmBox(esc(r.name), `Spend ${r.cost} gold on this?`, 'Claim', () => {
      S.gold -= r.cost;
      S.claimed = (S.claimed || 0) + 1;
      S.log.unshift({ t: Date.now(), d: G.today(), r: 1, n: r.name, i: r.icon, x: 0, g: -r.cost });
      save(); render(); buzz(1);
      toast('Enjoy it. You earned it.');
    });
  }
  function openRewardEditor(id) {
    const r = id != null ? S.rewards.find((x) => x.id === id) : null;
    UI.edit = r ? Object.assign({}, r) : { id: null, name: '', icon: '🎁', cost: 200 };
    UI.sheet = null;
    const e = UI.edit;
    openSheet(`<h3>${e.id == null ? 'New reward' : 'Edit reward'}</h3>
      <div class="name-row"><input class="field ic" id="r-icon" value="${esc(e.icon)}" maxlength="8"><input class="field" id="r-name" placeholder="e.g. Pizza night" value="${esc(e.name)}" maxlength="60"></div>
      <div class="lbl">Price in gold</div><input class="field" id="r-cost" type="number" inputmode="numeric" min="1" value="${e.cost}">
      <p class="lore" style="font-size:14.5px;margin-top:6px">A Medium quest pays 12 gold, a Hard one 20.</p>
      <div class="btns">${e.id != null ? '<button class="btn blood" data-m="r-delete">Delete</button>' : '<button class="btn" data-m="close">Cancel</button>'}<button class="btn prime" data-m="r-save">Save</button></div>`, 'reward');
  }

  // ================= RECORDS =================
  function when(e) {
    const t = G.today();
    if (e.d === t) return new Date(e.t).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    if (e.d === G.addDays(t, -1)) return 'yesterday';
    return new Date(e.t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }
  function viewDeeds() {
    return `<div class="omen" style="text-align:center">${S.total} deeds done · ${G.lifetimeXp(S)} experience earned</div>` +
      (S.log.slice(0, 60).map((e) => `<div class="row"><div class="ri">${esc(e.i || '•')}</div><div class="rb"><div class="rn">${esc(e.n)}</div>
        <div class="rs">${when(e)}${e.h ? ' · <span title="Logged via the herald">by the herald</span>' : ''}${e.r || e.b ? ` · <span style="color:var(--blood2)">−${-e.g} gold</span>` : e.v ? ` · <span class="gl">+${e.g} gold</span>` : ` · +${e.x} XP · ${SI[e.s] ? SI[e.s].short : ''}`}</div></div></div>`).join('') || '<div class="empty">The record is blank.</div>');
  }
  function viewFeats() {
    return '<div class="omen" style="text-align:center">Feats are earned, not bought. Each comes with something for the house.</div>' + Object.keys(G.DECOR).filter((k) => G.DECOR[k].unlock).map((k) => {
      const d = G.DECOR[k], m = G.MILESTONES[d.unlock], n = Math.min(m.n(S), m.goal), done = S.decor.owned.indexOf(k) >= 0;
      return `<div class="trial ${done ? 'done' : ''}" data-act="relic" data-k="${k}"><div class="tt2"><div class="tn">${esc(m.name)}</div><div class="tr">${esc(d.name)}</div></div>
        <div class="lore">${esc(m.desc)}.</div><div class="pb"><i style="width:${(n / m.goal) * 100}%"></i></div><div class="meta"><span>${done ? 'Earned' : `${n} / ${m.goal}`}</span><span>${bonusLine(d.bonus)}</span></div></div>`;
    }).join('');
  }
  function viewSettings() {
    const canNotify = !N || !N.canNotify || N.canNotify();
    const bound = hasKey();
    return `<div class="hd">Your character</div>
      <div class="set"><div class="l">${esc(S.hero.name)}<small>Name and looks (keeps your progress)</small></div><button class="btn small" data-act="creator">Change</button></div>
      ${widgetStatus()}
      <div class="hd">AI helper<small>optional</small></div>
      ${(() => { const ii = interpInfo(), P = ii && ii.on ? PROVIDERS[ii.provider] || PROVIDERS.custom : null; return `<div class="set"><div class="l">${P ? esc(P.name) + ' · ' + esc(ii.model) : 'Not connected'}<small>${P ? (P.free ? 'Free. ' : '') + 'The key stays on this phone, never in backups.' : 'Connect a free model (Groq, Gemini, OpenRouter, GitHub, Mistral) or Claude, and the Oracle can pick your weeklies.'}</small></div><button class="btn small ${P ? '' : 'prime'}" data-act="interp-open">${P ? 'Change' : 'Set up'}</button></div>`; })()}
      ${bound ? `<div class="btns"><button class="btn" data-act="oracle-test">Test it</button><button class="btn" data-act="oracle">Pick this week’s</button><button class="btn prime" data-act="oracle-chat">Talk to it</button></div>
        <div class="set"><div class="l">Fresh lines for everyone<small>one ask a day: the household, visitors and town folk say new things</small></div><button class="toggle ${S.settings.oracleBarks !== false ? 'on' : ''}" data-act="oracle-barks"></button></div>
        <div class="set"><div class="l">How often things come round<small>one ask a week, so it can offer to put things away after a go</small></div><button class="toggle ${S.settings.oracleHints !== false ? 'on' : ''}" data-act="oracle-hints"></button></div>
        <p class="lore" style="font-size:13.5px">It also judges new quests, goals and targets: difficulty, stat and rewards aren’t yours to set.</p>` : '<p class="lore" style="font-size:13.5px">Without it, new quests, goals and targets are judged by the rules (the library’s values, keywords and numbers).</p>'}
      <div class="hd">People and pets</div>
      <div class="set"><div class="l">Calendars with people in<small>${peopleCalsOn() ? S.settings.peopleCals.length + ' picked · ' + S.people.length + ' people' : 'Birthdays and visits: anyone named turns up at the house for their days'}</small></div><button class="btn small" data-act="people-cals">${peopleCalsOn() ? 'Change' : 'Pick'}</button></div>
      <div class="set"><div class="l">To-dos from the calendar<small>a present before a birthday, the house before a visit; for people you’ve designed</small></div><button class="toggle ${S.settings.calTodos !== false ? 'on' : ''}" data-act="cal-todos"></button></div>
      <div class="set"><div class="l">Pets<small>${esc(G.petsList(S).map((x) => x.name).join(', ') || 'None')}</small></div><button class="btn small" data-act="pets">Change</button></div>
      ${viewHeraldSettings()}
      <div class="hd">Training nudge</div>
      <div class="set"><div class="l">Nudge me when training lapses<small>A notification if no Strength or Endurance quest for a while</small></div><button class="toggle ${S.settings.nudge ? 'on' : ''}" data-act="nudge-toggle"></button></div>
      ${S.settings.nudge ? `<div class="set"><div class="l">After this many days</div><div class="stepper"><button data-act="nudge-days" data-v="-1">−</button><span>${S.settings.nudgeDays}</span><button data-act="nudge-days" data-v="1">+</button></div></div>` : ''}
      ${S.settings.nudge && !canNotify ? '<div class="set"><div class="l">Notifications are off<small>The nudge can’t reach you until they’re allowed</small></div><button class="btn small prime" data-act="ask-notify">Allow</button></div>' : ''}
      <div class="hd">Widget</div><p class="lore">Long-press an empty spot on your home screen, then Widgets, then Grindstone. Tap a quest on it to complete it.</p>
      ${remindSettings()}
      ${rosterSettings()}
      <div class="hd">Your week</div><div class="set"><div class="l">Bins, payday, the shop<small>${esc(lifeSummary())}</small></div><button class="btn small" data-act="life">Change</button></div>
      ${weatherSettings()}
      ${backupSettings()}
      <div class="hd blood">Start over</div>
      <div class="set"><div class="l">Wipe everything<small>Your character, gear, gold and quests</small></div><button class="btn small blood" data-act="reset">Reset</button></div>
      <div class="dim" style="text-align:center;font-style:italic;margin-top:22px">Grindstone ${N && N.version ? esc(N.version()) : 'web'}</div>
      <div class="dim" style="text-align:center;font-size:13px;margin-top:4px">Art: Liberated Pixel Cup contributors (Universal LPC and LPC Revised, CC-BY-SA / CC-BY / OGA-BY / GPL), Dungeon Crawl Stone Soup tiles (CC0).</div>`;
  }

  // ---------- rebirth (character) ----------
  // 2.1: one more go at his likeness, starting from bald, bearded and bespectacled. Nothing else changes.
  function openLikeness() {
    UI.look = Object.assign({}, S.look, { sex: 'm', hair: 'bald', beard: S.look.beard && S.look.beard !== 'none' ? S.look.beard : 'beard', extra: 'glasses' });
    UI.lookName = S.hero.name;
    UI.lookFirst = false; UI.lookRedo = true; UI.npcEdit = null;
    UI.sheet = null;
    renderCreator();
  }
  function syncNpcInputs() {
    const E = UI.npcEdit;
    if (!E) return;
    const ab = $('#n-about'), vs = $('#n-vow');
    if (ab) E.about = ab.value;
    if (vs) E.via.vow = vs.value ? Number(vs.value) : null;
  }
  function openCreator(first) {
    UI.npcEdit = null; UI.lookRedo = false;
    UI.look = Object.assign({}, S.look);
    UI.lookName = first && S.hero.name === 'Jake' ? G.randomName() : S.hero.name;
    UI.lookFirst = !!first;
    UI.sheet = null;
    renderCreator();
  }
  function renderCreator() {
    const L = UI.look;
    const ch = (k) => `<div class="pills">${G.LOOKS[k].map((v) => `<button class="pill ${L[k] === v ? 'on' : ''}" data-m="c-set" data-k="${k}" data-v="${v}">${(k === 'sex' && L.age ? { m: 'Boy', f: 'Girl' } : LOOK_LABELS[k])[v]}</button>`).join('')}</div>`;
    const chOf = (k, vals) => `<div class="pills">${vals.map((v) => `<button class="pill ${(L[k] || 'none') === v ? 'on' : ''}" data-m="c-set" data-k="${k}" data-v="${v}">${LOOK_LABELS[k][v]}</button>`).join('')}</div>`;
    const sw = (k) => `<div class="swatches">${G.LOOKS[k].map((v) => `<button class="swatch ${L[k] === v ? 'on' : ''}" style="--sw:${v}" data-m="c-set" data-k="${k}" data-v="${v}" aria-label="${v}"></button>`).join('')}</div>`;
    const E = UI.npcEdit, P = UI.personEdit;
    const title = P ? (P.id ? esc(P.name) : P.key ? 'Who’s ' + esc(P.name) + '?' : 'Someone new') : E ? (E.comp ? esc(G.CALLINGS[E.comp].title) : E.id ? esc(E.name) : 'Someone new') : UI.lookFirst ? 'Who are you?' : UI.lookRedo ? 'A better likeness' : 'Rebirth';
    const pillsOf = (map, cur, m) => `<div class="pills">${Object.keys(map).map((k) => `<button class="pill ${cur === k ? 'on' : ''}" data-m="${m}" data-v="${k}">${esc(map[k].name)}</button>`).join('')}</div>`;
    let extra;
    if (P) extra = personControls();
    else if (E) {
      const canArrive = !E.comp && (!E.id || E.status === 'waiting');
      const open = S.goals.filter((g) => !g.done && G.goalState(g, G.today()) === 'open');
      extra = `<div class="lbl">Shirt</div>${sw('outfit')}<div class="lbl">Clothes</div>${pillsOf(G.GARB, E.garb, 'n-garb')}<div class="lbl">Hat</div>${pillsOf(G.HATS, E.hat, 'n-hat')}
        <div class="lbl">Who are they?</div><input class="field" id="n-about" value="${esc(E.about)}" maxlength="60" placeholder="e.g. My sister">
        ${!E.comp ? `<div class="lbl">If they come delving</div><div class="pills">${G.NPC_ROLES.map((k) => `<button class="pill ${E.role === k ? 'on' : ''}" data-m="n-role" data-v="${k}">${G.COMP_ROLES[k].i} ${G.COMP_ROLES[k].n}</button>`).join('')}</div>${E.role === 'mage' ? `<div class="pills" style="margin-top:6px">${G.NPC_ELS.map((k) => `<button class="pill ${E.el === k ? 'on' : ''}" data-m="n-el" data-v="${k}">${EL(k)}</button>`).join('')}</div>` : ''}<p class="lore" style="font-size:14px;margin-top:4px">They can tag along at ${Math.round(G.TAGALONG * 100)}%: ${esc(G.COMP_ROLES[E.role || 'fighter'].what({ m: G.TAGALONG, el: E.el }))}. The four companions are the ones worth bringing.</p>` : ''}
        ${E.comp === 'mage' ? `<div class="lbl">Their magic</div><div class="pills">${G.NPC_ELS.map((k) => `<button class="pill ${E.el === k ? 'on' : ''}" data-m="n-el" data-v="${k}">${EL(k)}</button>`).join('')}</div><p class="lore" style="font-size:14px;margin-top:4px">Bring the mage whose element a dungeon fears.</p>` : ''}
        ${canArrive ? `<div class="lbl">How they arrive</div><div class="seg"><button class="${E.via.type === 'now' ? 'on' : ''}" data-m="n-via" data-v="now">Now</button><button class="${E.via.type === 'gold' ? 'on' : ''}" data-m="n-via" data-v="gold">For gold</button><button class="${E.via.type === 'vow' ? 'on' : ''}" data-m="n-via" data-v="vow">With a goal</button></div>
          ${E.via.type === 'gold' ? `<div class="stepper" style="margin-top:8px"><button data-m="n-gold" data-v="-50">−</button><span>◈ ${E.via.gold}</span><button data-m="n-gold" data-v="50">+</button></div>` : ''}
          ${E.via.type === 'vow' ? `<select class="field" id="n-vow" style="margin-top:8px"><option value="">Choose a goal…</option>${open.map((g) => `<option value="${g.id}" ${E.via.vow === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select><p class="lore" style="font-size:14px">${open.length ? 'They move in the moment you reach it.' : 'No open goals yet. Save them now, then pick them as the reward when you set one.'}</p>` : ''}` : ''}
        <div class="btns"><button class="btn" data-m="c-random">Randomise</button><button class="btn" data-m="close">Cancel</button><button class="btn prime" data-m="n-save">${E.id ? 'Save' : 'Done'}</button></div>`;
    } else {
      extra = `<div class="lbl">Clothes</div>${sw('outfit')}
        <div class="lore" style="margin-top:10px">${UI.lookRedo ? 'Your level, gear, gold and quests stay exactly as they are. You’re started bald, bearded and bespectacled; adjust to taste.' : 'What you wear is earned: rags to start, better kit as the coffers and the delve give it up.'}</div>
        <div class="btns"><button class="btn" data-m="c-random">Randomise</button><button class="btn prime" data-m="c-save">${UI.lookFirst ? 'Begin' : 'Save'}</button></div>`;
    }
    const controls = `<h3 style="text-align:center">${title}</h3>
      <div class="name-row"><input class="field" id="c-name" value="${esc(UI.lookName)}" maxlength="24" placeholder="Name"><button class="btn" data-m="c-roll" style="flex:none">Roll</button></div>
      ${P ? `<div class="lbl">Age</div><div class="pills">${['adult', 'kid', 'baby'].map((a) => `<button class="pill ${P.age === a ? 'on' : ''}" data-m="p-age" data-v="${a}">${AGE_WORDS[a]}</button>`).join('')}</div>` : ''}
      <div class="lbl">Body</div>${ch('sex')}<div class="lbl">Skin</div>${sw('skin')}<div class="lbl">Hair</div>${ch('hair')}<div class="lbl">Hair colour</div>${sw('hairColour')}${L.sex === 'f' || L.age ? '' : `<div class="lbl">Beard</div>${ch('beard')}`}
      <div class="lbl">Face</div>${chOf('extra', L.age ? ['none', 'glasses'] : ['none', 'glasses', 'eyepatch'])}${extra}`;
    const box = UI.sheet === 'creator' && $('#ccontrols');
    if (box) { box.innerHTML = controls; mountHeroes(); return; }
    openSheet(`<div class="creator-prev sil-wrap" id="cprev">${Art.silhouette({ look: L, inv: S.inv, eq: S.eq })}</div><div id="ccontrols">${controls}</div>`, 'creator');
    mountHeroes();
  }

  // ---------- backup ----------
  // Every run with what went into it (stats, penalties, buffs, gear, companion, boss HP) and what came out, plus the
  // context to read it against: current stats, active buffs, relics and the last 300 deeds. JSON, shared like a backup.
  function exportRuns() {
    const d = S.delve, R = (x) => Math.round(x * 100) / 100;
    const older = Object.keys(d.rec || {}).reduce((a, n) => a.concat((d.rec[n] || []).filter((r) => !r.inHist).map((r) => Object.assign({ dn: +n, old: true }, r, { stages: undefined }))), []);
    const out = {
      what: 'Grindstone delve history', version: (N && N.version ? N.version() : 'web'), exported: new Date().toISOString(),
      hero: { name: S.hero && S.hero.name, level: S.level, xp: S.xp, gold: S.gold, stats: G.STATS.reduce((o, k) => { o[k] = { val: G.statVal(S.stats[k]), raw: S.stats[k] }; return o; }, {}) },
      now: (() => { try { const I = G.inputFor(S); return { base: I.base, pen: I.pen, buffs: I.buffs, comp: I.comp ? { name: I.comp.name, role: I.comp.role, m: R(I.comp.m) } : null, hero: (() => { const H = G.heroFrom(I); return { hp: H.hpMax, atk: R(H.atk), def: R(H.def), evade: R(H.evade), mp: H.mpMax, flasks: H.flasks }; })() }; } catch (e) { return { error: String(e) }; } })(),
      delve: { seed: d.seed, at: d.n, runs: d.runs, trophies: d.trophies, known: d.known },
      runs: (d.hist || []).concat(older).sort((a, b) => a.t - b.t),
      relics: S.relics || null,
      deeds: (S.log || []).filter((l) => l.q).map((l) => ({ d: l.d, q: l.n, stat: l.s, xp: l.x })),
      days: S.days || {},   // 2.23: every day in brief, for good: [deeds, xp, gold, STR, END, VIT, DIS, INT]
    };
    const raw = JSON.stringify(out);
    if (N && N.share) { N.share(raw, 'Grindstone delve history ' + G.today()); return; }
    UI.sheet = null;
    openSheet(`<h3>Delve history</h3><textarea class="field" readonly>${esc(raw)}</textarea><div class="btns"><button class="btn" data-m="close">Done</button></div>`, 'export');
  }
  function exportSave() {
    const raw = JSON.stringify(S);
    if (N && N.share) { N.share(raw, 'Grindstone backup ' + G.today()); return; }
    UI.sheet = null;
    openSheet(`<h3>Your save</h3><textarea class="field" readonly>${esc(raw)}</textarea><div class="btns"><button class="btn" data-m="close">Done</button></div>`, 'export');
  }
  function importSave() {
    UI.sheet = null;
    openSheet(`<h3>Restore</h3><p class="lore" style="margin-bottom:10px">Paste the text you exported. This replaces everything.</p>
      <textarea class="field" id="imp" placeholder='{"v":1,...}'></textarea><div class="btns"><button class="btn" data-m="close">Cancel</button><button class="btn prime" data-m="do-import">Restore</button></div>`, 'import');
  }

  // ---------- queued notices ----------
  function flushQueue() {
    if (UI.sheet) return;
    if (UI.goalDone.length) {
      const g = UI.goalDone.shift();
      buzz(2);
      const m = $('#modal');
      m.className = 'centred';
      let body = '';
      if (g.kind === 'trial') body = `<div class="bk">WEEKLY DONE</div><div class="bt" style="margin-top:12px;font-size:22px">${esc(g.title)}</div><p class="lore" style="margin-top:8px">${g.gold} gold${g.chest ? ' and a coffer are' : ' is'} yours.${S.bonus && S.bonus.weekly && G.BUFFS[S.bonus.weekly.type] ? ` And for the next three days: ${G.BUFFS[S.bonus.weekly.type].i} ${esc(G.BUFFS[S.bonus.weekly.type].what(S.bonus.weekly.amt))}.` : ''}</p>`;
      else if (g.kind === 'town') body = `<div class="bk">${esc(g.head)}</div><div class="bt" style="margin-top:12px;font-size:22px">${esc(g.title)}</div><p class="lore" style="margin-top:8px">${esc(g.note)}</p>`;
      else if (g.kind === 'bonus') body = '<div class="bk">WEEKLIES DONE</div><div class="bt" style="margin-top:12px;font-size:22px">A coffer is yours.</div>';
      else if (g.kind === 'complete') {
        m.innerHTML = `<div class="scrim"></div><div class="band">${endBody()}<div class="btns"><button class="btn" data-m="ngp-cont">Keep going</button><button class="btn prime" data-m="ngp-ask">New Game+</button></div></div>`;
        UI.sheet = 'notice'; Sfx.play('level');
        return;
      }
      else body = `<div class="bk">GOAL REACHED</div><div class="bt" style="margin-top:12px;font-size:22px">${esc(g.title)}</div>
        ${g.reward.text ? `<p class="lore" style="margin-top:10px;font-size:17px">Your reward: <span style="color:var(--gold2)">${esc(g.reward.text)}</span>. Go and claim it.</p>` : ''}
        ${g.reward.gold || g.reward.chest ? `<p class="lore">${[g.reward.gold ? g.reward.gold + ' gold' : '', g.reward.chest ? 'a coffer' : ''].filter(Boolean).join(' and ')} granted.</p>` : ''}
        ${g.moved && g.moved.length ? `<p class="lore" style="font-size:17px">${esc(g.moved.join(' and '))} ${g.moved.length > 1 ? 'have' : 'has'} moved into the hearth.</p>` : ''}`;
      m.innerHTML = `<div class="scrim" data-m="close"></div><div class="band">${body}<div class="btns"><button class="btn prime" data-m="close">Onward</button></div></div>`;
      UI.sheet = 'notice';
      return;
    }
    if (UI.unlocks.length) {
      const k = UI.unlocks.shift(), d = G.DECOR[k], m = G.MILESTONES[d.unlock];
      buzz(2);
      openDialog(`<div class="rar" style="color:var(--gold)">FEAT ACHIEVED</div><h3 style="margin-top:8px">${esc(m.name)}</h3><div class="dprev" style="margin:6px auto">${Home.decorSvg(k, S)}</div>
        <p>Relic earned: <span style="color:var(--gold2)">${esc(d.name)}</span></p><div class="bonus">${bonusLine(d.bonus)}</div>
        <div class="btns"><button class="btn prime" data-m="close">Onward</button></div>`, 'notice');
    }
  }

  // ---------- modal plumbing ----------
  function openSheet(html, kind) {
    const m = $('#modal');
    const sheet = m.querySelector('.sheet');
    if (UI.sheet === kind && sheet) { sheet.innerHTML = html; return; }
    m.className = '';
    m.innerHTML = `<div class="scrim" data-m="close"></div><div class="sheet">${html}</div>`;
    UI.sheet = kind;
  }
  function openDialog(html, kind, locked) {
    const m = $('#modal');
    m.className = 'centred';
    m.innerHTML = `<div class="scrim" ${locked ? '' : 'data-m="close"'}></div><div class="dlg">${html}</div>`;
    UI.sheet = kind;
  }
  function closeModal() {
    const m = $('#modal');
    m.className = 'hidden';
    m.innerHTML = '';
    if (UI.run && UI.run.scene) { UI.run.scene.dispose(); UI.run.scene = null; }
    UI.sheet = null; UI.edit = null; UI.onOk = null;
    mountHeroes();
    if (UI.goalDone.length || UI.unlocks.length) setTimeout(flushQueue, 250);
  }
  function confirmBox(title, text, ok, fn, danger) {
    openDialog(`<h3>${title}</h3><p>${text}</p><div class="btns"><button class="btn" data-m="close">Cancel</button><button class="btn ${danger ? 'blood' : 'prime'}" data-m="ok">${ok}</button></div>`, 'confirm');
    UI.onOk = fn;
  }
  function toast(msg, undoFn) {
    const el = $('#toast');
    el.innerHTML = `<div class="toast"><span>${esc(msg)}</span>${undoFn ? '<button data-t="undo">UNDO</button>' : ''}</div>`;
    UI.undo = undoFn || null;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.innerHTML = ''; UI.undo = null; }, undoFn ? 5000 : 2800);
  }
  function floatText(el, txt) {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const f = document.createElement('div');
    f.className = 'float';
    f.textContent = txt;
    f.style.left = r.left + r.width / 2 + 'px';
    f.style.top = r.top - 6 + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  }
  function goto(v, fromTab) {
    const [tab, sub] = v.split(':');
    clearTimeout(toastTimer); $('#toast').innerHTML = ''; UI.undo = null;
    UI.tab = tab;
    if (sub) UI.sub[tab] = sub; else if (tab === 'hearth' && !fromTab) UI.sub.hearth = '';   // links to the hearth mean the house, not the town
    render();
    $('#main').scrollTop = 0;
  }

  // ---------- events ----------
  // Second line of defence for house taps (see hearth2d _bind): swallow the one stray click that follows a finger tap on the house,
  // so it can neither shut the window that tap just opened nor press a button inside it.
  let ghostUntil = 0;
  document.addEventListener('click', (ev) => {
    if (!ghostUntil) return;
    const live = performance.now() < ghostUntil;
    ghostUntil = 0;
    if (live && ev.target.closest && ev.target.closest('#modal')) { ev.stopPropagation(); ev.preventDefault(); }
  }, true);
  $('#toast').addEventListener('click', (ev) => {
    if (ev.target.closest('[data-t="undo"]') && UI.undo) { const f = UI.undo; UI.undo = null; $('#toast').innerHTML = ''; clearTimeout(toastTimer); f(); }
  });

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.closest('#modal')) return;
    const id = el.dataset.id != null ? Number(el.dataset.id) : null;
    switch (el.dataset.act) {
      case 'tab': goto(el.dataset.v + ':', true); break;
      case 'fold-done': UI.showDone = !UI.showDone; render(); break;
      case 'sub': UI.sub[UI.tab] = el.dataset.v; render(); $('#main').scrollTop = 0; break;
      case 'goto': goto(el.dataset.v); break;
      case 'complete': doComplete(id, el); break;
      case 'complete-min': doComplete(id, el, true); break;
      case 'undo': undoPrompt(id); break;
      case 'edit': openEditor(id); break;
      case 'eqslot': UI.eqSlot = el.dataset.v; render(); break;
      case 'item': openItem(id); break;
      case 'open-chest': openChest(); break;
      case 'pack-on': UI.pack = { on: true, ids: {} }; render(); break;
      case 'pack-off': UI.pack = { on: false, ids: {} }; render(); break;
      case 'pack-tag': { const it = G.itemById(S, id); if (!it) break; if (S.eq[it.slot] === it.id) { toast('He’s wearing that. Take it off first.'); break; } if (UI.pack.ids[id]) delete UI.pack.ids[id]; else UI.pack.ids[id] = true; render(); break; }
      case 'pack-commons': S.inv.forEach((i) => { if (i.tier === 0 && S.eq[i.slot] !== i.id) UI.pack.ids[i.id] = true; }); render(); break;
      case 'pack-sell': {
        const c = S.inv.filter((i) => UI.pack.ids[i.id] && S.eq[i.slot] !== i.id), v = c.reduce((a, i) => a + G.sellFor(S, i, G.today()), 0);
        if (!c.length) break;
        confirmBox(`Sell ${c.length} piece${c.length > 1 ? 's' : ''}?`, `${c.slice(0, 6).map((i) => i.name).join(', ')}${c.length > 6 ? ' and ' + (c.length - 6) + ' more' : ''}. ${v} gold. Nothing he is wearing.`, 'Sell', () => { S.inv = S.inv.filter((i) => c.indexOf(i) < 0); S.gold += v; G.townNote(S, 'sold', c.length); UI.pack = { on: false, ids: {} }; Sfx.play('coin'); save(); render(); toast(`+${v} gold`); }, true);
        break;
      }
      case 'sell-commons': {
        const c = S.inv.filter((i) => i.tier === 0 && G.SLOTS.every((k) => S.eq[k] !== i.id));
        const v = c.reduce((a, i) => a + G.sellFor(S, i, G.today()), 0);
        confirmBox('Sell the junk?', `${c.length} common items for ${v} gold.`, 'Sell', () => { S.inv = S.inv.filter((i) => c.indexOf(i) < 0); S.gold += v; G.townNote(S, 'sold', c.length); save(); render(); toast(`+${v} gold`); });
        break;
      }
      case 'relic': openRelic(el.dataset.k); break;
      case 'buy-chest': buyChest(el.dataset.k); break;
      case 'claim': claimReward(id); break;
      case 'reward-edit': openRewardEditor(id); break;
      case 'feature': openFeature(el.dataset.k); break;
      case 'h3-follow': if (HOUSE.inst) HOUSE.inst.follow(); break;
      case 't2-zoom': if (TOWNV.inst) TOWNV.inst.zoom(); break;
      case 't2-follow': if (TOWNV.inst) TOWNV.inst.follow(); break;
      case 't2-out': if (TOWNV.inst && UI.townScene && UI.townScene.indexOf('in:') === 0) townLeave(UI.townScene.slice(3)); break;
      case 'visit-back': visitEnd(true); render(); break;
      case 'h3-build': startBuild(); break;
      case 'h3-stars': S.settings.stars = S.settings.stars === false; save(); if (HOUSE.inst) HOUSE.inst.setStars(S.settings.stars); el.classList.toggle('on', S.settings.stars); toast(S.settings.stars ? 'Stars on: tap one to see its quests.' : 'Stars off.'); break;
      case 'b-tool': if (UI.build) { const B = UI.build; B.tool = el.dataset.v; B.place = null; B.draft = null; B.newRoom = null; B.sel = null; B.room = null; B.moving = null; B.msg = BUILD_TIPS[B.tool] + '.'; refreshBuild(); } break;
      case 'b-add': if (UI.build) openCatalogue(); break;
      case 'b-fence': if (UI.build) { const before = snap(); HS().house.fenceOff = !HS().house.fenceOff; buildDid(before, HS().house.fenceOff ? 'Perimeter fence hidden. Use ＋Item to place segments where you want them.' : 'Perimeter fence restored.'); } break;
      case 'b-room': if (UI.build) { UI.build.place = null; UI.build.sel = null; UI.build.moving = null; openRoomShop(); refreshBuild(); } break;
      case 'b-done': endBuild(); break;
      case 'b-desel': if (UI.build) { UI.build.sel = null; UI.build.msg = BUILD_TIPS.move + '.'; refreshBuild(); } break;
      case 'b-flip': if (UI.build && UI.build.sel != null) { const before = snap(); G.houseFlip(HS(), UI.build.sel); buildDid(before, 'Flipped.'); } break;
      case 'b-rotate': if (UI.build && UI.build.sel != null) { const before = snap(), it = HS().house.items.find((x) => x.id === UI.build.sel); if (it && it.k === 'fencebit') { it.turn = it.turn ? 0 : 1; buildDid(before, 'Fence segment rotated.'); } } break;
      case 'b-store': if (UI.build && UI.build.sel != null) { const it = HS().house.items.find((x) => x.id === UI.build.sel), before = snap(), nm = it ? itemName(it) : ''; G.houseStore(HS(), UI.build.sel); UI.build.sel = null; buildDid(before, `${nm} stored. Get it back with ＋ Add.`); } break;
      case 'b-undo': if (UI.build && UI.build.undo.length) { const o = JSON.parse(UI.build.undo.pop()); if (o.gold != null) { HS().gold = o.gold; delete o.gold; } Object.assign(HS().house, o); G.houseNorm(HS()); UI.build.sel = null; UI.build.draft = null; UI.build.msg = 'Undone.'; save(); syncHouse(); refreshBuild(); } break;
      case 'npc': openNpc(el.dataset.k); break;
      case 'npc-new': openNpcEditor(null); break;
      case 'adherence': openAdherence(); break;
      case 'npc-invite': { const n = npcById(el.dataset.k), err = G.npcInvite(S, el.dataset.k); if (err) { toast(err + '.'); break; } save(); render(); buzz(2); toast(`${n.name} has moved in.`); npcArrived([n]); break; }
      case 'h3-zoom': if (HOUSE.inst) HOUSE.inst.zoom(); break;
      case 'estate': openEstate(el.dataset.k); break;
      case 'land': openLand(); break;
      case 'life': UI.lifeDraft = null; openLife(); break;
      case 'life-skip': S.life.skip = true; save(); render(); break;
      case 'plan-swap': openPlanSwap(); break;
      case 'plan-n': { const k = el.dataset.k; S.settings.planN = S.settings.planN || {}; S.settings.planN[k] = Math.max(0, Math.min(12, G.planSize(S, k) + (+el.dataset.v))); if (S.plan && !S.plan.swaps) S.plan.key = ''; save(); render(); break; }
      case 'weather-toggle': S.settings.weather = !S.settings.weather; if (!S.settings.weather) delete S.weather; save(); weatherPull(true); render(); break;
      case 'town': openTown(el.dataset.k); break;
      case 'delve-go': startRun(); break;
      case 'spar-go': startSpar(); break;
      case 'spar-n': UI.sparN = Math.max(0, Math.min(S.delve.n - 1, (UI.sparN | 0) + (+el.dataset.v))); render(); break;
      case 'delve-watch': watchLast(); break;
      case 'delve-auto': autoEquip(); break;
      case 'delve-comp': openCompPick(); break;
      case 'delve-rec': UI.recOpen = UI.recOpen === Number(el.dataset.v) ? null : Number(el.dataset.v); render(); break;
      case 'delve-buff': openBuffPick(Number(el.dataset.id)); break;
      case 'hh-page': openHousehold(); break;
      case 'delve-order': setOrder(el.dataset.k, el.dataset.v); break;
      case 'away-toggle': awayToggle(); break;
      case 'away-perm': if (N && N.askLocation) N.askLocation(); break;
      case 'away-home': setHomeHere(); break;
      case 'estate-buy': buyEstateUI(el.dataset.k); break;
      case 'pv-step': if (UI.preview) { UI.preview = { key: UI.preview.key, tier: Math.max(0, Math.min(5, UI.preview.tier + Number(el.dataset.v))) }; render(); } break;
      case 'pv-done': { const k = UI.preview && UI.preview.key; UI.preview = null; render(); if (k) openEstate(k); break; }
      case 'pv-fin': if (UI.preview && UI.preview.fin !== undefined) { const L = finOpts(UI.preview.key), i = Math.max(0, L.findIndex((f) => f.k === UI.preview.fin)), j = Math.max(0, Math.min(L.length - 1, i + Number(el.dataset.v))); UI.preview = { key: UI.preview.key, tier: UI.preview.tier, fin: L[j].k }; render(); } break;
      case 'fin-buy': buyFinishUI(el.dataset.k, el.dataset.v); break;
      case 'fin-use': useFinishUI(el.dataset.k, el.dataset.v); break;
      case 'trial': showTrial(el.dataset.id); break;
      case 'wk-swap': swapWeekly(el.dataset.id); break;
      case 'vow': openVowEditor(id); break;
      case 'new-vow': openVowEditor(null); break;
      case 'mark': openMark(id); break;
      case 'mark-new': UI.mk = null; openMarkEditor(); break;
      case 'oracle': consultOracle(); break;
      case 'oracle-test': testOracle(); break;
      case 'key-save': { const k = ($('#key-in').value || '').trim(); if (!k) { toast('Paste a key first.'); break; } setKey(k); render(); toast('Connected.'); break; }
      case 'key-forget': confirmBox('Disconnect Claude?', 'Removes your API key from this phone.', 'Unbind', () => { setKey(''); render(); }, true); break;
      case 'creator': openCreator(false); break;
      case 'herald-toggle': if (S.herald.on && heraldInfo().perm) { S.herald.on = false; save(); if (N && N.heraldArm) N.heraldArm(); render(); } else heraldEnable(); break;
      case 'herald-notify': S.herald.notify = !S.herald.notify; save(); render(); break;
      case 'herald-check': { const before = S.herald.last; heraldPoll(); if (S.herald.last === before) toast('No new word. Calendars can take a minute to sync.'); render(); break; }
      case 'herald-sync-on': if (N && N.heraldEnableSync && N.heraldEnableSync(String(el.dataset.v))) toast('Sync on. Deeds will arrive shortly.'); else toast('Couldn’t switch it on. Try the Google Calendar app: Settings, Grindstone, Sync.'); render(); break;
      case 'herald-copy': { const txt = 'Grindstone deeds (use these names exactly):\n' + G.deedNames(S).map((n) => '- ' + n).join('\n'); if (N && N.copy) N.copy(txt); else if (navigator.clipboard) navigator.clipboard.writeText(txt); toast('Copied ' + G.deedNames(S).length + ' deed names.'); break; }
      case 'interp-open': openInterp(); break;
      case 'interp-toggle': S.settings.interp = S.settings.interp === false; save(); render(); break;
      case 'herald-claim': openClaim(el.dataset.k); break;
      case 'herald-drop': G.heraldDismiss(S, el.dataset.k); save(); render(); toast('Dismissed.'); break;
      case 'nudge-toggle': S.settings.nudge = !S.settings.nudge; save(); render(); if (S.settings.nudge && N && N.canNotify && !N.canNotify()) N.askNotify(); break;
      case 'lib-open': openLibrary(); break;
      case 'widget-now': toast('Filming the house…'); refreshWidgetClip(true).then((why) => { toast(why === 'ok' ? 'Widget refreshed. Check the home screen.' : 'Widget: ' + why); if (UI.tab === 'records') render(); }); break;
      case 'nudge-days': S.settings.nudgeDays = Math.max(2, Math.min(7, S.settings.nudgeDays + Number(el.dataset.v))); save(); render(); break;
      case 'ask-notify': if (N && N.askNotify) N.askNotify(); break;
      case 'export': exportSave(); break;
      case 'export-runs': exportRuns(); break;
      case 'import': importSave(); break;
      case 'roster-pick': openRosterPick(); break;
      case 'boon': openBoon(); break;
      case 'trader-buy': { const err = G.traderBuy(S, id, G.today()); if (err) { toast(err + '.'); break; } Sfx.play('coin'); save(); render(); toast('Bought. It’s in your pack.'); break; }
      case 'cal-write': S.settings.calWrite = !S.settings.calWrite; save(); render(); break;
      case 'sound-toggle': S.settings.sound = !S.settings.sound; save(); render(); Sfx.play('tick'); break;
      case 'season': openSeason(); break;
      case 'review': openReview(el.dataset.v === 'last'); break;
      case 'slip': openSlip(Number(el.dataset.id)); break;
      case 'coll': openColl(el.dataset.v); break;
      case 'long-hours': S.settings.longHours = Math.max(6, Math.min(14, (S.settings.longHours | 0) + Number(el.dataset.v))); save(); render(); break;
      case 'backup-toggle': S.settings.backup = !S.settings.backup; save(); render(); break;
      case 'backup-now': backupNow(false); break;
      case 'backup-pick': if (N && N.backupPick) N.backupPick('onBackupPicked'); else importSave(); break;
      case 'remind-toggle': S.settings.remind = !S.settings.remind; save(); render(); if (S.settings.remind && N && N.canNotify && !N.canNotify()) N.askNotify(); break;
      case 'overdue': openOverdue(); break;
      case 'people': UI.fromFound = true; openPeopleFound(false); break;
      case 'oracle-chat': openOracleChat(); break;
      case 'fold-hidden': UI.showHidden = !UI.showHidden; render(); break;
      case 'oracle-barks': S.settings.oracleBarks = S.settings.oracleBarks === false; save(); render(); break;
      case 'oracle-hints': S.settings.oracleHints = S.settings.oracleHints === false; save(); render(); break;
      case 'person': openPerson(el.dataset.id); break;
      case 'people-cals': openPeopleCals(false); break;
      case 'pets': openPets(false); break;
      case 'cal-todos': S.settings.calTodos = S.settings.calTodos === false; save(); render(); break;
      case 'overdue-toggle': S.settings.overdue = S.settings.overdue === false; save(); render(); break;
      case 'overdue-hour': S.settings.overdueHour = Math.max(6, Math.min(20, (S.settings.overdueHour | 0) + Number(el.dataset.v))); save(); render(); break;
      case 'remind-hour': S.settings.remindHour = Math.max(12, Math.min(22, (S.settings.remindHour | 0) + Number(el.dataset.v))); save(); render(); break;
      case 'reset': confirmBox('Start over?', 'Your character, gear, gold and quests will be gone. Export a backup first if you might want them.', 'Erase', () => {
        S = G.normalize(null, G.today()); S.uiV = 3; UI.pct = null; save(); goto('quests:today'); openCreator(true);
      }, true); break;
    }
  });

  document.addEventListener('change', (ev) => {
    if (ev.target.id === 'model-in') { S.settings.oracleModel = ev.target.value.trim() || DEFAULT_MODEL; save(); }
    if (ev.target.id === 'herald-cal') {
      const c = heraldInfo().cals.find((x) => String(x.id) === ev.target.value);
      S.herald.cal = c ? c.id : -1; S.herald.calName = c ? c.name : '';
      save(); heraldPoll(); render();
    }
  });

  $('#fab').addEventListener('click', () => openEditor(null));

  $('#modal').addEventListener('input', (ev) => {
    if (UI.edit && UI.sheet === 'editor') {
      if (ev.target.id === 'e-name') UI.edit.name = ev.target.value;
      if (ev.target.id === 'e-icon') UI.edit.icon = ev.target.value;
      if (ev.target.id === 'e-min') UI.edit.min = ev.target.value;
      if (ev.target.id === 'e-rest-n') { const n = parseInt(ev.target.value, 10); if (n >= 1) { UI.edit.rest = Math.min(365, n); UI.edit.restCustom = true; if (!UI.edit.cap) UI.edit.cap = 1; } }
      if (ev.target.id === 'e-rem-last') UI.edit.remLast = /^\d{4}-\d{2}-\d{2}$/.test(ev.target.value) && ev.target.value <= G.today() ? ev.target.value : null;
      if (ev.target.id === 'e-rem-n' && UI.edit.remind) { const n = parseInt(ev.target.value, 10); if (n >= 1) UI.edit.remind.d = Math.min(365, n); }
    }
    if (ev.target.id === 'c-name') UI.lookName = ev.target.value;
    if (ev.target.id === 'npc-vow') { const n = npcById(ev.target.dataset.k); if (n) { n.via.vow = ev.target.value ? Number(ev.target.value) : null; save(); } }
  });

  $('#modal').addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-m]');
    if (!el) return;
    const e = UI.edit, v = el.dataset.v, id = el.dataset.id != null ? Number(el.dataset.id) : null;
    switch (el.dataset.m) {
      case 'close': closeSheet(); break;
      case 'wk-swap': swapWeekly(el.dataset.id); break;
      case 'roster-set': S.settings.rosterCal = el.dataset.id || null; S.settings.rosterName = v || ''; if (!S.settings.rosterCal) S.roster = null; save(); rosterPull(); closeModal(); render(); toast(S.settings.rosterCal ? 'Roster linked.' : 'Roster unlinked.'); break;
      case 'e-core': e.core = !e.core; renderEditor(); break;
      case 'reveal-sell': { const it = G.itemById(S, id); if (!it) break; const v = G.sellFor(S, it, G.today()); S.inv = S.inv.filter((x) => x.id !== it.id); S.gold += v; G.townNote(S, 'sold', 1); Sfx.play('coin'); save(); closeModal(); render(); toast(`Sold for ${v} gold.`); break; }
      case 'boon-pick': if (G.perkPick(S, el.dataset.k)) { buzz(2); Sfx.play('level'); save(); closeModal(); render(); toast(G.PERKS[el.dataset.k].n + ' is his.'); if (G.perksDue(S)) setTimeout(openBoon, 900); } break;
      case 'review-last': openReview(true); break;
      case 'review-this': openReview(false); break;
      case 'mk-idea': { const i = JSON.parse(v); syncMark(); Object.assign(UI.mk, { name: i[0], unit: i[1], better: i[2], target: i[3] }); openMarkEditor(); break; }
      case 'mk-unit': syncMark(); UI.mk.unit = v; openMarkEditor(); break;
      case 'mk-better': syncMark(); UI.mk.better = v; openMarkEditor(); break;
      case 'mk-gold': syncMark(); UI.mk.gold = Math.max(0, Math.min(1000, UI.mk.gold + Number(v))); openMarkEditor(); break;
      case 'mk-chest': syncMark(); UI.mk.chest = !UI.mk.chest; openMarkEditor(); break;
      case 'mk-save': saveMark(); break;
      case 'mk-log': logMark(id); break;
      case 'mk-undo': { const m = S.marks.find((x) => x.id === id); if (m && m.log.length) { m.log.pop(); save(); render(); UI.sheet = null; openMark(id); } break; }
      case 'mk-del': confirmBox('Delete this target?', 'Its attempts go with it.', 'Delete', () => { S.marks = S.marks.filter((x) => x.id !== id); save(); closeModal(); render(); }, true); break;
      case 'b-put': { const k = el.dataset.k, r = el.dataset.r || null, f = G.furnOf({ k: k, r: r }); closeModal(); if (!UI.build) break; UI.build.place = { k: k, r: r }; UI.build.sel = null; UI.build.msg = `Tap where the ${f.n.toLowerCase()} goes${f.at === 'wall' ? ' (on a wall)' : ''}.`; refreshBuild(); break; }
      case 'b-buy': { const k = el.dataset.k, f = G.FURN[k], err = G.furnBuy(HS(), k); if (err) { toast(err + '.'); break; } save(); buzz(1); closeModal(); if (!UI.build) break; UI.build.place = { k: k, r: null }; UI.build.sel = null; UI.build.msg = `${f.n} bought. Tap where it goes${f.at === 'wall' ? ' (on a wall)' : ''}.`; refreshBuild(); break; }
      case 'rm-style': { const before = snap(), err = G.roomSet(HS(), el.dataset.k, { style: v }); if (err) { toast(err + '.'); break; } saveRoomName(el.dataset.k); if (UI.build) buildDid(before, 'Restyled.'); else { save(); syncHouse(); } openRoom(el.dataset.k); break; }
      case 'hh-open': openHousehold(); break;
      case 'hh-npc': UI.sheet = null; openNpc(el.dataset.k); break;
      case 'hh-person': UI.sheet = null; openPerson(el.dataset.k); break;
      case 'hh-found': UI.fromFound = true; openPeopleFound(false); break;
      case 'hh-pcals': openPeopleCals(false); break;
      case 'hh-pnew': openPersonEditor(null, null); break;
      case 'hh-pets': openPets(false); break;
      case 'p-edit': openPersonEditor(el.dataset.k, null); break;
      case 'p-age': syncPersonInputs(); UI.personEdit.age = v; if (v === 'adult') delete UI.look.age; else { UI.look.age = v; UI.look.beard = 'none'; if (UI.look.extra === 'eyepatch') UI.look.extra = 'none'; } renderCreator(); break;
      case 'p-mode': syncPersonInputs(); UI.personEdit.cal.mode = v; renderCreator(); break;
      case 'p-lead': syncPersonInputs(); UI.personEdit.cal.lead = Number(v); renderCreator(); break;
      case 'p-which': syncPersonInputs(); UI.personEdit.cal.which = v; renderCreator(); break;
      case 'p-todos': syncPersonInputs(); UI.personEdit.cal.todos = !UI.personEdit.cal.todos; renderCreator(); break;
      case 'p-save': savePerson(); break;
      case 'p-remove': { const P = UI.personEdit; confirmBox('Remove ' + P.name + '?', 'They won’t turn up any more, and their name won’t be offered again.', 'Remove', () => {
        S.people = S.people.filter((x) => x.id !== P.id); [P.name].concat(P.also).forEach((n) => { S.peopleNo[G.nameKey(n)] = 'no'; });
        UI.personEdit = null; save(); closeModal(); render(); toast(P.name + ' removed.'); }, true); break; }
      case 'pc-tog': { const id = String(el.dataset.id), on = (S.settings.peopleCals || []).map(String); S.settings.peopleCals = on.indexOf(id) >= 0 ? on.filter((x) => x !== id) : on.concat([id]); save(); openPeopleCals(UI.peopleFlow); break; }
      case 'pc-done': { const flow = UI.peopleFlow; peoplePull(true, true); render(); if (G.peopleCandidates(S, G.today()).length) openPeopleFound(flow); else { closeModal(); toast(peopleCalsOn() ? 'No names found yet. New ones will be offered as they turn up.' : 'No calendars picked.'); if (flow) { UI.peopleFlow = false; maybeWelcome(); } } break; }
      case 'pc-skip': case 'fr-skip': case 'pf-finish': UI.peopleFlow = false; closeModal(); render(); maybeWelcome(); break;
      case 'fr-cal': openPeopleCals(true); break;
      case 'pf-design': { const c = G.peopleCandidates(S, G.today()).find((x) => x.key === el.dataset.k); if (c) { UI.fromFound = true; openPersonEditor(null, c); } break; }
      case 'pf-later': S.peopleNo[el.dataset.k] = G.addDays(G.today(), 30); save(); openPeopleFound(UI.peopleFlow); break;
      case 'pf-no': S.peopleNo[el.dataset.k] = 'no'; save(); openPeopleFound(UI.peopleFlow); break;
      case 'pet-add': syncPets(); { const K = G.PET_KINDS[v]; UI.pets.push({ sp: v, name: K.parrot ? G.BIRDS[v].name : '' }); } renderPets(); break;
      case 'pet-del': syncPets(); UI.pets.splice(+el.dataset.i, 1); renderPets(); break;
      case 'pet-save': {
        syncPets();
        const first = UI.petsFirst, added = G.petsSet(S, UI.pets, G.today());
        UI.petsFirst = false; save(); closeModal(); render();
        if (added.length) toast(added.map((p) => p.name + (p.item ? (/s$/i.test(p.name) ? '’ ' : '’s ') + G.FURN[G.PET_KINDS[p.sp].furn].n.replace(/ \(.*\)$/, '').toLowerCase() + ' is in' : ' is home')).join(' · '));
        if (first) firstRunCalendar();
        break;
      }
      case 'hh-new': UI.sheet = null; openNpcEditor(null); break;
      case 'hh-adh': UI.sheet = null; openAdherence(); break;
      case 'rm-purpose': { const before = snap(), err = G.roomSet(HS(), el.dataset.k, { purpose: v }); if (err) { toast(err + '.'); break; } saveRoomName(el.dataset.k); if (UI.build) buildDid(before, 'Purpose set.'); else { save(); syncHouse(); } const nm = HS().house.rooms.find((x) => x.id === el.dataset.k); openRoom(el.dataset.k); void nm; break; }
      case 'nr-preset': if (UI.build && UI.build.newRoom) { UI.build.newRoom.w = Number(el.dataset.w); UI.build.newRoom.d = Number(el.dataset.d); buzz(0); openRoomShop(); } break;
      case 'nr-size': if (UI.build && UI.build.newRoom) { const n = UI.build.newRoom, k2 = el.dataset.d; n[k2] = Math.max(1, Math.min(G.ROOM_MAX, n[k2] + Number(v))); buzz(0); openRoomShop(); } break;
      case 'nr-purpose': if (UI.build && UI.build.newRoom) { UI.build.newRoom.purpose = v; openRoomShop(); } break;
      case 'nr-go': if (UI.build && UI.build.newRoom) { const B = UI.build; B.newRoom.go = true; B.tool = 'room'; B.place = null; B.sel = null; B.moving = null; closeModal(); B.msg = 'Tap the yard where the ' + B.newRoom.w + ' × ' + B.newRoom.d + ' room should stand.'; refreshBuild(); } break;
      case 'rm-size': {
        const id2 = el.dataset.k, r = HS().house.rooms.find((x) => x.id === id2);
        if (!r) break;
        saveRoomName(id2);
        const z = G.roomDims(r), nw = z.w + (el.dataset.d === 'w' ? Number(v) : 0), nd = z.d + (el.dataset.d === 'd' ? Number(v) : 0), before = snap();
        const res = G.roomResize(HS(), id2, nw, nd);
        if (res.err) { toast(res.err + '.'); break; }
        if (UI.build) buildDid(before, `Now ${nw} × ${nd}.` + (res.diff ? (res.diff > 0 ? ` Paid ${res.diff} gold.` : ` Got ${-res.diff} gold back.`) : '') + (res.stored.length ? ' Put into storage: ' + res.stored.join(', ') + '.' : ''));
        else { save(); syncHouse(); }
        buzz(0); openRoom(id2); break;
      }
      case 'rm-move': { saveRoomName(el.dataset.k); save(); closeModal(); if (UI.build) { UI.build.moving = el.dataset.k; UI.build.room = el.dataset.k; UI.build.msg = 'Tap where its top-left corner should go.'; refreshBuild(); } break; }
      case 'rm-save': saveRoomName(el.dataset.k); save(); closeModal(); if (UI.build) { UI.build.msg = 'Saved. ' + BUILD_TIPS[UI.build.tool] + '.'; syncHouse(); refreshBuild(); } break;
      case 'rm-del': { const id2 = el.dataset.k, r = HS().house.rooms.find((x) => x.id === id2); if (!r) break; const back = Math.floor((r.paid | 0) * G.SELL_BACK); confirmBox('Sell the ' + r.name.toLowerCase() + '?', 'Its walls and doors go, and you get ◈ ' + back + ' back (half of what it cost). Anything standing in it goes into storage. You can undo it.', 'Sell it', () => { const before = snap(), res = G.roomDel(HS(), id2); if (res.err) { toast(res.err + '.'); return; } if (UI.build) { UI.build.room = null; UI.build.moving = null; buildDid(before, 'Sold' + (res.refund ? ' for ' + res.refund + ' gold' : '') + '.' + (res.stored && res.stored.length ? ' Stored: ' + res.stored.join(', ') + '.' : '')); } else { save(); syncHouse(); } closeModal(); }, true); break; }
      case 'npc-home': { const n = npcById(el.dataset.k); if (!n) break; n.home = v || null; save(); render(); openNpc(n.id); break; }
      case 'npc-feed': closeModal(); openThing('aviary'); break;
      case 'npc-edit': openNpcEditor(el.dataset.k); break;
      case 'npc-visit': closeModal(); visitHome(el.dataset.k); break;
      case 'npc-invite': { const n = npcById(el.dataset.k), err = G.npcInvite(S, el.dataset.k); if (err) { toast(err + '.'); break; } save(); closeModal(); render(); buzz(2); toast(`${n.name} has moved in.`); npcArrived([n]); break; }
      case 'npc-del': { const n = npcById(el.dataset.k); if (!n) break; confirmBox(n.status === 'resident' ? `${n.name} moves out?` : `Forget ${n.name}?`, 'You can always design them again.', n.status === 'resident' ? 'Move out' : 'Forget', () => { S.npcs = S.npcs.filter((x) => x.id !== n.id); if (S.delve.comp === n.id) S.delve.comp = ''; save(); render(); }, true); break; }
      case 'n-via': UI.npcEdit.via.type = v; syncNpcInputs(); renderCreator(); break;
      case 'n-gold': UI.npcEdit.via.gold = Math.max(25, Math.min(5000, (UI.npcEdit.via.gold | 0) + Number(v))); syncNpcInputs(); renderCreator(); break;
      case 'n-garb': if (UI.personEdit) { syncPersonInputs(); UI.personEdit.garb = v; renderCreator(); break; } UI.npcEdit.garb = v; syncNpcInputs(); renderCreator(); break;
      case 'n-role': UI.npcEdit.role = v; syncNpcInputs(); renderCreator(); break;
      case 'n-el': UI.npcEdit.el = v; syncNpcInputs(); renderCreator(); break;
      case 'n-hat': if (UI.personEdit) { syncPersonInputs(); UI.personEdit.hat = v; renderCreator(); break; } UI.npcEdit.hat = v; syncNpcInputs(); renderCreator(); break;
      case 'n-save': saveNpc(); break;
      case 'ok': { const f = UI.onOk; closeModal(); if (f) f(); break; }
      case 'estate-open': openEstate(el.dataset.k); break;
      case 'run-skip': runSkip(); break;
      case 'run-big': { const r = $('#modal .runp'); if (r) { r.classList.toggle('big'); S.settings.crawlBig = r.classList.contains('big'); save(); } break; } // tap the scene: just watch (the log hides)
      case 'run-pick': runPick(Number(v)); break;
      case 'run-done': closeRun(); break;
      case 'run-again': clearTimeout(runTick.t); if (UI.run && UI.run.scene) UI.run.scene.dispose(); UI.run = null; closeModal(); startRun(); break;
      case 'comp-set': S.delve.comp = v || ''; save(); closeModal(); render(); buzz(0); { const n = v && npcById(v); toast(n ? `${n.name} is coming with him.` : 'He goes alone.'); } break;
      case 'npc-delve': { const n = npcById(el.dataset.k); if (!n) break; S.delve.comp = n.id; save(); closeModal(); render(); toast(`${n.name} will go into the delve with him.`); break; }
      case 'lib-open': UI.sheet = null; openLibrary(); break;
      case 'lib-own': UI.sheet = null; openEditor(null); break;
      case 'lib-cat': UI.lib.open = UI.lib.open === v ? null : v; openLibrary(); break;
      case 'lib-hidden': UI.lib.hidden = !UI.lib.hidden; openLibrary(); break;
      case 'lib-hide': { const d = libFind(el.dataset.k); if (d) { const i4 = S.libHidden.indexOf(d[0]); if (i4 >= 0) S.libHidden.splice(i4, 1); else S.libHidden.push(d[0]); save(); openLibrary(); } break; }
      case 'lib-add': { const d = libFind(el.dataset.k); if (d && !haveQuest(d[0])) { S.quests.push(Object.assign(G.newQuest(S, Object.assign({ name: d[0], icon: d[1], type: d[2], stat: d[3], diff: d[4] }, d[5] || {})), { judged: 'library' })); save(); buzz(0); toast('Added: ' + d[0]); openLibrary(); render(); } break; }
      case 'e-every': UI.edit.rest = Number(v) | 0; renderEditor(); break;
      case 'life-pick': lifePick(el.dataset.k, v); break;
      case 'life-save': lifeSave(); break;
      case 'e-rest': UI.edit.rest = Number(v) | 0; UI.edit.restCustom = false; if (UI.edit.rest && !UI.edit.cap) UI.edit.cap = 1; renderEditor(); break;
      case 'e-rest-custom': UI.edit.restCustom = true; if (!(UI.edit.rest > 0)) UI.edit.rest = 35; if (!UI.edit.cap) UI.edit.cap = 1; renderEditor(); break;
      case 'e-rest-step': UI.edit.restCustom = true; UI.edit.rest = Math.max(1, Math.min(365, (UI.edit.rest | 0) + Number(v))); if (!UI.edit.cap) UI.edit.cap = 1; renderEditor(); break;
      case 'e-buff': { const id3 = UI.edit && UI.edit.id; if (id3 != null) { UI.sheet = null; openBuffPick(id3); } break; }
      case 'buff-set': { const q = G.findQ(S, Number(el.dataset.id)); if (q) { q.buff = v || null; save(); } closeModal(); render(); break; }
      case 'estate-pv': startPreview(el.dataset.k, Number(v)); break;
      case 'fin-pv': startFinPreview(el.dataset.k, v || null); break;
      case 'land-buy': buyLandUI(); break;
      case 'duel-act': duelAct(v); break;
      case 'duel-swap': duelAct('gear', Number(el.dataset.id)); break;
      case 'duel-gear-x': if (UI.duel) { UI.duel.picking = false; duelPaint(); } break;
      case 'duel-help': UI.duelHelp = !UI.duelHelp; duelPaint(); break;
      case 'duel-tgt': if (UI.duel && !UI.duel.res) { const e = UI.duel.grp.find((x) => x.id === el.dataset.id); if (e && e.hp > 0) { UI.duel.tgt = e.id; duelPaint(); } } break;
      case 'duel-next': if (UI.duel && !UI.duel.busy) { G.duelNext(UI.duel); duelMeet(UI.duel); } break;
      case 'duel-done': duelClose(); break;
      case 'duel-hurry': duelHurry(); break;
      case 'duel-quit': if (UI.duel && UI.duel.res) duelClose(); else confirmBox('Leave the road?', 'The wind is spent either way, and nothing is won.', 'Leave', duelClose); break;
      case 'plan-swap-do': planSwapDo(el.dataset.id); break;
      case 'town-buy': townBuyUI(el.dataset.k); break;
      case 'town-pay': townPayUI(el.dataset.k); break;
      case 'ngp-ask': closeModal(); ngpAsk(); break;
      case 'ngp-go': ngpGo(); break;
      case 'ngp-cont': S.complete.cont = true; save(); closeModal(); render(); toast('On he goes. Everything from here comes round again, and keeps climbing.'); break;
      case 'town-toggle': townToggleUI(el.dataset.k); break;
      case 'estate-buy': buyEstateUI(el.dataset.k); break;
      case 'e-emoji': e.icon = v; renderEditor(); break;
      case 'e-type': if (e.type !== v) e.rest = 0; e.type = v; if (v === 'habit' && !e.cap) e.cap = 1; renderEditor(); break;
      case 'e-day': e.days[Number(v)] = e.days[Number(v)] ? 0 : 1; renderEditor(); break;
      case 'e-cap': e.cap = Math.max(0, Math.min(20, (e.cap | 0) + Number(v))); renderEditor(); break;
      case 'e-judge': { const nt = $('#e-jwhy') ? $('#e-jwhy').value.trim() : ''; if (UI.edit.id != null) judgeQuest(UI.edit.id, nt, false); if (hasKey()) toast('Asking the Oracle…'); break; }
      case 'e-longoff': e.longOff = !e.longOff; renderEditor(); break;
      case 'aw-set': awayApply(UI.edit.id, G.addDays(G.today(), Number(v))); renderEditor(); break;
      case 'aw-date': UI.awDate = !UI.awDate; renderEditor(); break;
      case 'aw-date-go': { const d = $('#aw-d') ? $('#aw-d').value : ''; if (!d || d <= G.today()) { toast('Pick a day after today.'); break; } awayApply(UI.edit.id, G.addDays(d, 1)); renderEditor(); break; }
      case 'aw-hold': UI.awHold = !UI.awHold; renderEditor(); break;
      case 'aw-end': { const q = G.findQ(S, UI.edit.id); G.awayEnd(S, [UI.edit.id], G.today()); if (q) UI.edit.away = q.away; save(); render(); renderEditor(); toast('Back on the list.'); break; }
      case 'ho-step': UI.hideOffer.days = Math.max(1, Math.min(365, UI.hideOffer.days + Number(v))); renderHideOffer(); break;
      case 'ho-once': { const o = UI.hideOffer, q = G.findQ(S, o.id); G.awaySet(S, [o.id], G.addDays(G.today(), o.days), false, '', G.today()); UI.hideOffer = null; save(); closeModal(); render(); if (q) toast(`${q.name} hidden until ${dayWord(G.addDays(G.today(), o.days - 1))}.`); break; }
      case 'ho-every': { const o = UI.hideOffer, q = G.findQ(S, o.id); if (q) { q.rest = o.days; if (q.type === 'habit' && !q.cap) q.cap = 1; G.normQuest(q); } UI.hideOffer = null; save(); closeModal(); render(); if (q) toast(`${q.name} now hides for ${o.days} days after each go.`); break; }
      case 'ho-later': { const q = G.findQ(S, UI.hideOffer.id); if (q) q.hideAskAt = G.today(); UI.hideOffer = null; save(); closeModal(); break; }
      case 'ho-never': { const q = G.findQ(S, UI.hideOffer.id); if (q) q.hideAsk = 'no'; UI.hideOffer = null; save(); closeModal(); toast('It won’t ask about that one again.'); break; }
      case 'oc-send': oracleSend(); break;
      case 'oc-clear': S.oracleChat = []; save(); renderOracleChat(); break;
      case 'oc-do': case 'oc-no': {
        const m = (S.oracleChat || [])[+el.dataset.i], a = m && m.acts && m.acts[+el.dataset.a];
        if (!a || a.st) break;
        if (el.dataset.m === 'oc-no') { a.st = 'no'; save(); renderOracleChat(); break; }
        const chk = G.actCheck(S, a, G.today());
        if (!chk) { a.st = 'no'; save(); renderOracleChat(); toast('That no longer fits (a quest has changed).'); break; }
        const res = G.actApply(S, chk, G.today());
        a.st = res ? 'done' : 'no';
        save(); render(); renderOracleChat();
        toast(res ? G.actWords(S, chk, G.today()).replace(/^Hold /, 'Held: ').replace(/^Hide /, 'Hidden: ').replace(/^Add /, 'Added ') : 'Couldn’t do that one.');
        if (res && res.id != null && chk.do === 'add') judgeQuest(res.id, '', false);
        break;
      }
      case 'e-home': e.home = v || null; renderEditor(); break;
      case 'e-rem': {
        if (e.remind) { delete e.remind; renderEditor(); break; }
        const q0 = e.id != null ? G.findQ(S, e.id) : null;
        if (G.remindCount(S) - (q0 && q0.remind ? 1 : 0) >= G.REMIND_MAX) { toast(G.REMIND_MAX + ' reminders is the limit. Turn one off first (Today › ⏰, or Settings).'); break; }
        const sg = q0 ? G.remindSuggest(S, q0) : null;
        e.remind = q0 && q0.remind ? Object.assign({}, q0.remind) : { d: sg ? sg.n : e.type === 'habit' && (e.rest | 0) > 1 ? e.rest | 0 : { daily: 3, habit: 7, todo: 3 }[e.type] || 3, rep: 0, from: G.today(), snz: null, ping: null };
        renderEditor(); break;
      }
      case 'e-rem-d': if (e.remind) { e.remind.d = Math.max(1, Math.min(365, e.remind.d + Number(v))); renderEditor(); } break;
      case 'e-rem-use': if (e.remind) { e.remind.d = Number(v); renderEditor(); } break;
      case 'e-rem-rep': if (e.remind) { e.remind.rep = Number(v); renderEditor(); } break;
      case 'od-edit': openEditor(Number(el.dataset.k)); break;
      case 'slip-yes': { const k = Number(el.dataset.k); if (remindOn(k, Number(v))) { closeModal(); render(); } break; }
      case 'slip-no': { G.remindDecline(S, Number(el.dataset.k), G.today()); save(); closeModal(); render(); toast('Fair enough. It won’t ask about that one for a couple of months.'); break; }
      case 'rv-remind': { if (remindOn(Number(el.dataset.k), Number(v))) openReview(UI.reviewBack); break; }
      case 'od-snz': { const k = Number(el.dataset.k), n = Number(v); if (G.remindSnooze(S, k, n, G.today())) { save(); render(); openOverdue(); toast('Snoozed for ' + dWord(n) + '.'); } break; }
      case 'od-do': { const k = Number(el.dataset.k); closeModal(); doComplete(k, null); break; }
      case 'e-save': saveEditor(); break;
      case 'e-archive': { const q = G.findQ(S, e.id); if (q) { q.archived = !q.archived; save(); toast(q.archived ? 'Archived. Find it under All.' : 'Restored.'); } closeModal(); render(); break; }
      case 'e-delete': { const qid = e.id; confirmBox('Delete this quest?', 'Gone for good. Archive it instead if you might want it back.', 'Delete', () => { S.quests = S.quests.filter((q) => q.id !== qid); save(); render(); }, true); break; }
      case 'equip': equip(id); closeModal(); render(); flashSil(); break;
      case 'equip-close': equip(id); closeModal(); render(); flashSil(); toast('Equipped.'); break;
      case 'claim-pick': claimReport(UI.claim, id); break;
      case 'interp-prov': {
        readInterp();
        const was = PROVIDERS[UI.interp.provider], P = PROVIDERS[v];
        if (!UI.interp.model || UI.interp.model === was.model) UI.interp.model = P.model;
        UI.interp.provider = v;
        if (v !== 'custom') UI.interp.base = P.base;
        renderInterp();
        break;
      }
      case 'interp-save': {
        readInterp();
        const u = UI.interp, base = u.provider === 'custom' ? u.base : PROVIDERS[u.provider].base;
        if (!/^https:\/\//.test(base)) { $('#interp-msg').textContent = 'The endpoint needs to start with https://'; break; }
        if (!u.model) { $('#interp-msg').textContent = 'Name a model first.'; break; }
        if ((!u.has || u.saved !== u.provider) && !u.key) { $('#interp-msg').textContent = 'Paste your ' + PROVIDERS[u.provider].name + ' key first.'; break; }
        N.interpSet(JSON.stringify({ provider: u.provider, base: base, model: u.model, key: u.key || '' }));
        u.has = true; u.key = ''; u.saved = u.provider;
        renderInterp('Testing…');
        N.interpTest('t' + Date.now());
        break;
      }
      case 'interp-forget': N.interpForget(); closeModal(); render(); toast('AI helper disconnected.'); break;
      case 'claim-new': {
        const u = S.herald.unclaimed.find((x) => x.k === UI.claim);
        if (!u) { closeModal(); break; }
        const nq = G.newQuest(S, { name: u.text.charAt(0).toUpperCase() + u.text.slice(1), icon: '📜', type: 'todo', stat: 'DIS', diff: 1 });
        S.quests.push(nq);
        claimReport(UI.claim, nq.id, true);
        break;
      }
      case 'unequip': { const it = G.itemById(S, id); if (it) { S.eq[it.slot] = null; save(); } closeModal(); render(); break; }
      case 'sell': { const it = G.itemById(S, id); if (it) { if (S.eq[it.slot] === it.id) S.eq[it.slot] = null; S.inv = S.inv.filter((i) => i.id !== id); G.townNote(S, 'sold', 1); S.gold += G.sellFor(S, it, G.today()); save(); toast(`Sold for ${G.sellValue(it)} gold.`); } closeModal(); render(); break; }
      case 'again': closeModal(); openChest(); break;
      case 'relic-buy': {
        const k = el.dataset.k, d = G.DECOR[k];
        if (!d || S.gold < d.price || S.decor.owned.indexOf(k) >= 0) break;
        S.gold -= d.price; S.decor.owned.push(k);
        const out = G.relicOut(S, k);
        save(); render(); buzz(1); closeModal();
        toast(`${d.name} acquired. ${Object.keys(d.bonus).map((s) => `+${d.bonus[s]} ${SI[s].name}`).join(', ')}.${out ? ' It’s in the hearth; move it with ✎.' : ' Find it a spot with ✎ on the hearth.'}`);
        break;
      }
      case 'r-save': {
        const name = ($('#r-name').value || '').trim(), icon = ($('#r-icon').value || '').trim() || '🎁', cost = Math.max(1, Math.round(Number($('#r-cost').value) || 0));
        if (!name) { toast('Name it first.'); break; }
        if (e.id == null) S.rewards.push({ id: G.nextId(S), name, icon, cost });
        else Object.assign(S.rewards.find((r) => r.id === e.id) || {}, { name, icon, cost });
        save(); closeModal(); render(); break;
      }
      case 'r-delete': S.rewards = S.rewards.filter((r) => r.id !== e.id); save(); closeModal(); render(); break;
      case 'do-import': {
        let parsed;
        try { parsed = JSON.parse($('#imp').value); } catch (err) { toast('That isn’t a Grindstone save.'); break; }
        if (!parsed || !Array.isArray(parsed.quests)) { toast('That isn’t a Grindstone save.'); break; }
        S = G.normalize(parsed, G.today()); S.uiV = 3; UI.pct = null; save(); closeModal(); goto('quests:today'); toast('Save restored.');
        break;
      }
      // hearth
      case 'f-complete': closeModal(); doComplete(id, null); break;
      case 'f-make': {
        const k = el.dataset.k, d = FEATURE_QUEST[k];
        if (!d) break;
        S.quests.push(G.newQuest(S, { name: d[0], icon: d[1], type: d[2], stat: d[3], diff: d[4], cap: d[5], home: k }));
        save(); render(); if (UI.sheet === 'thing') openThing(UI.thingId, true); else openFeature(k, true); toast(`“${d[0]}” added to your quests.`);
        break;
      }
      case 'seed': {
        const k = el.dataset.k, t = G.today(), cur = H()[k].days, next = Math.max(0, cur + Number(v));
        const logged = G.featureLast(S, k);
        if (logged && G.daysBetween(logged, t) < next) { toast(`You logged it ${daysText(G.daysBetween(logged, t))}. That’s the earliest.`); break; }
        S.homeSeed[k] = G.addDays(t, -next);
        save(); render(); if (UI.sheet === 'thing') openThing(UI.thingId, true); else openFeature(k, true);
        break;
      }
      // vows
      case 'v-kind': syncVowInputs(); e.kind = v; renderVowEditor(); break;
      case 'v-target': syncVowInputs(); e.target = Math.max(1, Math.min(99, e.target + Number(v))); renderVowEditor(); break;
      case 'v-win': syncVowInputs(); e.window = v; renderVowEditor(); break;
      case 'v-gold': syncVowInputs(); e.reward.gold = Math.max(0, Math.min(500, e.reward.gold + Number(v))); renderVowEditor(); break;
      case 'v-chest': syncVowInputs(); e.reward.chest = !e.reward.chest; renderVowEditor(); break;
      case 'v-rpick': syncVowInputs(); e.reward.text = v; renderVowEditor(); break;
      case 'v-save': saveVow(); break;
      case 'v-fulfil': { const g = S.goals.find((x) => x.id === e.id); if (g && !g.done) { g.done = G.today(); settle([g]); save(); } closeModal(); render(); break; }
      case 'v-delete': { const gid = e.id; confirmBox('Drop this goal?', 'It will be struck from the record.', 'Renounce', () => { S.goals = S.goals.filter((g) => g.id !== gid); save(); render(); }, true); break; }
      // creator
      case 'c-set': syncNpcInputs(); syncPersonInputs(); UI.look[el.dataset.k] = v; if (el.dataset.k === 'sex' && v === 'f') UI.look.beard = 'none'; renderCreator(); break;
      case 'c-random': syncNpcInputs(); syncPersonInputs(); UI.look = G.randomLook(); if (UI.personEdit && UI.personEdit.age !== 'adult') { UI.look.age = UI.personEdit.age; UI.look.beard = 'none'; if (UI.look.extra === 'eyepatch') UI.look.extra = 'none'; } renderCreator(); break;
      case 'c-roll': syncNpcInputs(); syncPersonInputs(); UI.lookName = G.randomName(); renderCreator(); break;
      case 'c-save': {
        const was = S.look.sex;
        S.look = G.normLook(UI.look);
        if (S.look.sex !== was) S.look.cls = S.look.sex === 'f' ? 'rogue' : 'knight'; // the old house's figure, until the house is rebuilt
        S.hero.name = (UI.lookName || '').trim().slice(0, 24) || G.randomName();
        S.lookSet = true; S.lookV = 1; delete S.lookAsk; UI.lookRedo = false;
        const first = UI.lookFirst;
        save(); closeModal(); render();
        if (first) openPets(true);   // 2.26: then pets, then the calendar
        break;
      }
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && UI.sheet === 'editor' && ev.target.id === 'e-name') { ev.preventDefault(); saveEditor(); }
  });

  // Called by Android
  // Closing a sheet, by ✕, the scrim or the back button.
  function closeSheet() {
    if (UI.sheet === 'creator' && UI.lookFirst) return;
    if (UI.sheet === 'pets' && UI.petsFirst) return;
    if (UI.sheet === 'creator' && UI.personEdit) { UI.personEdit = null; if (UI.peopleFlow) { openPeopleFound(true); return; } }
    if (UI.sheet === 'frcal' || (UI.peopleFlow && (UI.sheet === 'peoplecals' || UI.sheet === 'peoplefound'))) { UI.peopleFlow = false; closeModal(); render(); maybeWelcome(); return; }
    if (UI.sheet === 'creator' && UI.lookRedo) { S.lookV = 1; delete S.lookAsk; UI.lookRedo = false; save(); }
    if (UI.sheet === 'room' && UI.build && UI.build.room) { saveRoomName(UI.build.room); save(); }
    UI.npcEdit = null;
    closeModal();
    if (UI.build) { syncHouse(); refreshBuild(); }
  }
  window.handleBack = function () {
    if (UI.sheet === 'chest' || UI.sheet === 'oracle') return true;
    if (UI.sheet === 'creator' && UI.lookFirst) return true;
    if (UI.sheet === 'pets' && UI.petsFirst) return true;
    if (UI.sheet) { closeSheet(); return true; }
    if (UI.build) { endBuild(); return true; }
    if (!(UI.tab === 'quests' && UI.sub.quests === 'today')) { goto('quests:today'); return true; }
    return false;
  };
  window.onResume = function () {
    load();
    lastDay = G.today();
    rosterPull(); weatherPull(); maybeBackup(); houseDay(); peoplePull();
    setTimeout(oracleChores, 8000);   // 2.27
    if (UI.sheet && UI.sheet !== 'notice') { renderTop(); heraldPoll(); return; }
    render();
    heraldPoll();
    maybeInterpret();
    showHeraldNews();
    scheduleWidgetClip(4000);
  };
  window.gotoFromWidget = function (v) {
    if (UI.sheet && UI.sheet !== 'notice') return;
    if (UI.sheet) closeModal();
    if (v === 'overdue') { goto('quests:today'); openOverdue(); return; }   // 2.25: the overdue note
    goto(v);
  };
  setInterval(() => {
    const t = G.today();
    if (t !== lastDay) { lastDay = t; load(); if (!UI.sheet) render(); }
    if (!UI.run && S.delve && G.autoDue(S, new Date())) soloRun();
  }, 30000);

  function maybeWelcome() {
    if (S.welcomed || S.chests <= 0) return;
    openDialog(`<div class="sig" style="width:56px;height:56px;margin:0 auto 6px">${Art.SIGIL}</div><h3>Welcome home, ${esc(S.hero.name)}</h3>
      <p>Do real things and the house looks after itself: chores keep it tidy, habits bring people to live in it. What you earn kits him out for the delve below. Let the house slide and he goes down there the worse for it.</p>
      <p style="margin-top:8px">A coffer, to begin.</p><div class="btns"><button class="btn prime" data-m="again">Open it</button></div>`, 'welcome', true);
  }

  // ---------- go ----------
  load();
  rosterPull(); weatherPull(); maybeBackup(); houseDay(); peoplePull();
  render();
  setTimeout(oracleChores, 8000);   // 2.27
  if (!S.lookSet) openCreator(true);
  else if (S.created === G.today() && !S.petsSet && !S.welcomed) openPets(true);
  else if (S.lookAsk) openLikeness();
  else maybeWelcome();
  heraldPoll();
  maybeInterpret();
  showHeraldNews();
  scheduleWidgetClip(6000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && N && N.widgetInfo) scheduleWidgetClip(2500); });
})();
