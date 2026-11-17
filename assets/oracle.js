/* Grindstone — 2.27: what the Oracle is asked, and how its answers are read. Pure: app.js does the asking (through the
 * one AI connection) and shows the results. Nothing it says changes the save without Jake confirming it, except the
 * judging of a new quest or goal (which replaces the rules' guess) and the day's barks.
 *  - Talking: he says what's going on ("rolled my ankle"); it answers briefly and proposes actions from a short list
 *    (hide or hold quests, bring them back, add a quest, set a reminder, hide one after each go). Each needs a tap.
 *  - Judging: a new quest's difficulty, stat and cap; a new goal's or target's gold and coffer. He can't set them.
 *  - Hints: how often each quest naturally comes round, for the "hide it for a while?" offer after a go.
 *  - Barks: a day's fresh lines for the household, visitors, the keepers and the townsfolk. */
(function (root) {
  'use strict';
  const G = root.G;
  if (!G) return;
  const { today, addDays, daysBetween } = G;
  const STATN = { STR: 'Strength', END: 'Endurance', VIT: 'Vitality', DIS: 'Discipline', INT: 'Intellect' };

  // The first {...} in a reply (models wrap JSON in prose or code fences), parsed, or null.
  function jsonIn(text) {
    const t = String(text || '');
    const a = t.indexOf('{');
    if (a < 0) return null;
    for (let b = t.lastIndexOf('}'); b > a; b = t.lastIndexOf('}', b - 1)) {
      try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* try a shorter span */ }
    }
    return null;
  }
  const isDay = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const clampI = (v, a, b) => Math.max(a, Math.min(b, Math.round(Number(v) || 0)));

  // ---------- what it's told about him (no names of people, no calendar titles: just the shape of his days) ----------
  function brief(s, t) {
    const since = addDays(t, -28), counts = {};
    s.log.forEach((e) => { if (e.q != null && e.d >= since) counts[e.q] = (counts[e.q] || 0) + 1; });
    const kinds = [];
    for (let i = 0; i < 7; i++) { const d = addDays(t, i), k = G.dayKind(s, d); kinds.push(d.slice(5) + ':' + (k || '?')); }
    return {
      today: t, weekday: 'Mon Tue Wed Thu Fri Sat Sun'.split(' ')[G.dayIdx(t)], level: s.level,
      // one line each, to keep it small: id|name|d(aily)/h(abit)/t(o-do)|stat|done in the last 28 days|extras
      quests_key: 'id|name|type|stat|done_28d|extras (last=last done, every=comes round every N days, remind=after N days, hidden=until date)',
      quests: s.quests.filter((q) => !q.archived && !(q.type === 'todo' && q.doneOn)).map((q) => {
        const x = [], last = s.qlast && s.qlast[q.id];
        if (last) x.push('last=' + last);
        if (q.rest > 1) x.push('every=' + q.rest);
        if (q.remind) x.push('remind=' + q.remind.d);
        if (G.isAway(q, t)) x.push('hidden=' + q.away.back + (q.away.why === 'hold' ? ' hold' : ''));
        return [q.id, q.name, q.type.charAt(0), q.stat, counts[q.id] || 0, x.join(' ')].join('|');
      }),
      work_next_7_days: s.settings.rosterCal ? kinds.join(' ') : 'no roster linked',
    };
  }

  // ---------- talking ----------
  const CHAT_SYSTEM = 'You are the Oracle in Grindstone, a life-tracking RPG on the player\'s phone. Speak briefly (under 70 words), warmly, a touch wry; Australian spelling. ' +
    'You can propose changes, but the player must confirm each one, so never say you have done them. Reply with JSON only: {"say": "...", "actions": [...]}. ' +
    'Actions (use only quest ids from the data; propose only what the message calls for; none is fine):\n' +
    '{"do":"hide","ids":[id,...],"days":N,"hold":true|false,"why":"short"}  put quests away for N days (1-365). hold:true for injury, illness or travel: it also protects their streaks.\n' +
    '{"do":"show","ids":[id,...]}  bring hidden quests back now.\n' +
    '{"do":"every","id":id,"days":N}  after each go, hide it for N days (2-365) so it only turns up when it can be done again.\n' +
    '{"do":"remind","id":id,"days":N}  a reminder if it goes N days (1-365) undone.\n' +
    '{"do":"add","name":"...","icon":"one emoji","type":"daily|habit|todo","every":N or null,"remind":N or null}  a new quest; the game judges its difficulty and rewards, not you.\n' +
    'For an injury or illness: be kind, suggest holding what it stops them doing (a sensible stretch of days), keep what they still can, and suggest seeing someone if it sounds serious. You are not a doctor. ' +
    'Never change gold, XP, stats or difficulty.';
  function chatPrompt(s, t, history, msg) {
    const h = (history || []).slice(-8).map((m) => (m.r === 'me' ? 'Player: ' : 'Oracle: ') + String(m.text || '').slice(0, 400)).join('\n');
    return { system: CHAT_SYSTEM, user: 'Player data:\n' + JSON.stringify(brief(s, t)) + (h ? '\n\nThe conversation so far:\n' + h : '') + '\n\nPlayer: ' + String(msg).slice(0, 600) };
  }
  // An action, checked against the save; null if it doesn't hold up.
  function actCheck(s, a, t) {
    if (!a || typeof a !== 'object') return null;
    const live = (id) => { const q = G.findQ(s, Number(id)); return q && !q.archived ? q : null; };
    if (a.do === 'hide') {
      const qs = (Array.isArray(a.ids) ? a.ids : [a.id]).map(live).filter(Boolean).filter((q, i, l) => l.indexOf(q) === i).slice(0, 12);
      const days = isDay(a.until) ? daysBetween(t, a.until) : clampI(a.days, 0, 365);
      if (!qs.length || days < 1) return null;
      return { do: 'hide', ids: qs.map((q) => q.id), days: days, hold: !!a.hold, why: String(a.why || '').slice(0, 60) };
    }
    if (a.do === 'show') {
      const qs = (Array.isArray(a.ids) ? a.ids : [a.id]).map(live).filter((q) => q && G.isAway(q, t));
      return qs.length ? { do: 'show', ids: qs.map((q) => q.id) } : null;
    }
    if (a.do === 'every') { const q = live(a.id); const d = clampI(a.days, 0, 365); return q && q.type !== 'todo' && d >= 2 ? { do: 'every', id: q.id, days: d } : null; }
    if (a.do === 'remind') { const q = live(a.id); const d = clampI(a.days, 0, 365); return q && d >= 1 ? { do: 'remind', id: q.id, days: d } : null; }
    if (a.do === 'add') {
      const name = String(a.name || '').trim().slice(0, 80);
      if (!name) return null;
      const type = ['daily', 'habit', 'todo'].indexOf(a.type) >= 0 ? a.type : 'habit';
      const icon = typeof a.icon === 'string' && a.icon.trim() ? Array.from(a.icon.trim()).slice(0, 2).join('') : '•';
      const every = type !== 'todo' && Number(a.every) >= 2 ? clampI(a.every, 2, 365) : 0, remind = Number(a.remind) >= 1 ? clampI(a.remind, 1, 365) : 0;
      return { do: 'add', name: name, icon: icon, type: type, every: every, remind: remind };
    }
    return null;
  }
  function chatParse(s, text, t) {
    t = t || today();
    const j = jsonIn(text);
    if (!j || typeof j !== 'object') return { say: String(text || '').trim().slice(0, 600) || 'The Oracle says nothing.', actions: [], raw: true };
    const acts = (Array.isArray(j.actions) ? j.actions : []).map((a) => actCheck(s, a, t)).filter(Boolean).slice(0, 6);
    return { say: String(j.say || '').trim().slice(0, 600) || (acts.length ? 'Here’s what I’d do.' : '…'), actions: acts };
  }
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const daysWord = (n) => (n % 7 === 0 && n <= 56 ? plural(n / 7, 'week') : plural(n, 'day'));
  // What an action would do, in words.
  function actWords(s, a, t) {
    t = t || today();
    const names = (ids) => G.joinNames ? G.joinNames(ids.map((id) => (G.findQ(s, id) || {}).name).filter(Boolean), 'and') : ids.join(', ');
    if (a.do === 'hide') return (a.hold ? 'Hold ' : 'Hide ') + names(a.ids) + ' for ' + daysWord(a.days) + ' (back ' + G.fmtDay(addDays(t, a.days)) + ')' + (a.hold ? ', streaks protected' : '');
    if (a.do === 'show') return 'Bring back ' + names(a.ids);
    if (a.do === 'every') return 'Hide ' + names([a.id]) + ' for ' + daysWord(a.days) + ' after each go';
    if (a.do === 'remind') return 'Remind you if ' + names([a.id]) + ' goes ' + daysWord(a.days) + ' undone';
    if (a.do === 'add') return 'Add “' + a.name + '” (' + a.type + (a.every ? ', every ' + daysWord(a.every) : '') + (a.remind ? ', reminder at ' + daysWord(a.remind) : '') + ')';
    return '';
  }
  // Do it. Returns the quest it made (for an add, to be judged) or true.
  function actApply(s, a, t) {
    t = t || today();
    if (a.do === 'hide') return G.awaySet(s, a.ids, addDays(t, a.days), a.hold, a.why, t).length > 0;
    if (a.do === 'show') return G.awayEnd(s, a.ids, t).length > 0;
    if (a.do === 'every') { const q = G.findQ(s, a.id); if (!q) return false; q.rest = a.days; if (q.type === 'habit' && !q.cap) q.cap = 1; G.normQuest(q); return true; }
    if (a.do === 'remind') { const q = G.findQ(s, a.id); if (!q) return false; q.remind = { d: a.days, rep: 0, from: t }; G.normQuest(q); return true; }
    if (a.do === 'add') {
      const j = G.judgeRules({ name: a.name, type: a.type, rest: a.every });
      const q = G.newQuest(s, { name: a.name, icon: a.icon, type: a.type, stat: j.stat, diff: j.diff, cap: a.type === 'habit' ? j.cap : 0, rest: a.every });
      q.judged = j.src;
      if (a.remind) q.remind = { d: a.remind, rep: 0, from: t };
      G.normQuest(q);
      s.quests.push(q);
      return q;
    }
    return false;
  }

  // ---------- judging ----------
  const JUDGE_SYSTEM = 'You judge new entries in Grindstone, a life-tracking RPG, so the player can\'t inflate them. Be fair and a little stingy; Australian spelling. Reply with JSON only.';
  const DIFF_SCALE = 'Difficulty 1-5 for one go: 1 trivial (under 10 minutes, no effort: a glass of water), 2 easy (15-30 minutes or light effort), 3 solid (30-60 minutes or real effort), 4 hard (1-2 hours or hard work), 5 heroic (half a day, or a major ordeal). ' +
    'Stats: STR strength training; END cardio and the outdoors; VIT health, food, sleep, self-care; DIS chores, admin, money, discipline; INT study, reading, learning, skills.';
  function judgePrompt(kind, o, s, t) {
    if (kind === 'quest') return { system: JUDGE_SYSTEM, user: DIFF_SCALE + '\nFor habits, also a daily cap (1-5): how many goes a day are sensible.\n' +
      'Reply {"diff":1-5,"stat":"STR|END|VIT|DIS|INT","cap":1-5,"why":"under 12 words"}.\nThe quest: ' + JSON.stringify({ name: o.name, type: o.type, every_days: o.rest || undefined, bare_minimum: o.min || undefined }) };
    // goals and targets: the gold and whether a coffer comes too
    const scale = 'Gold for comparison: an easy deed pays 12, a hard one 40, a weekly challenge 30-150. Rewards: gold 25-500, and a coffer (loot chest) only for something genuinely hard or long. ';
    const what = kind === 'mark' ? { target: o.name, better: o.better, aim: o.target, best_so_far: o.best, by: o.by || 'no date' }
      : { goal: o.title, measured: o.kind === 'manual' ? 'marked done by the player' : 'completing ' + o.what + ' ' + o.target + ' times', by: o.end || 'no date', today: t };
    return { system: JUDGE_SYSTEM, user: scale + 'Reply {"gold":25-500,"chest":true|false,"why":"under 12 words"}.\nThe ' + (kind === 'mark' ? 'target' : 'goal') + ': ' + JSON.stringify(what) };
  }
  function judgeParse(kind, text) {
    const j = jsonIn(text);
    if (!j) return null;
    if (kind === 'quest') {
      const stat = String(j.stat || '').toUpperCase();
      if (!STATN[stat] || !(Number(j.diff) >= 1)) return null;
      return { diff: clampI(j.diff, 1, 5), stat: stat, cap: clampI(j.cap || 1, 1, 5), why: String(j.why || '').slice(0, 80), src: 'oracle' };
    }
    if (!(Number(j.gold) > 0)) return null;
    return { gold: Math.round(clampI(j.gold, 25, 500) / 5) * 5, chest: !!j.chest, why: String(j.why || '').slice(0, 80), src: 'oracle' };
  }

  // ---------- how often things come round (for the hide offer) ----------
  function hintsPrompt(s) {
    const qs = s.quests.filter((q) => !q.archived && q.type !== 'todo' && !(q.rest > 1)).map((q) => ({ id: q.id, name: q.name, type: q.type }));
    return { system: JUDGE_SYSTEM, user: 'For each quest, if it naturally can\'t or needn\'t be done again for a while after doing it, give the usual gap in days (e.g. mowing ~14, a haircut ~42, a monthly bill 30) and whether that gap is firm (a hard limit, like a script that can\'t be refilled sooner). ' +
      'Leave out anything done daily or most days. Reply {"hints":[{"id":id,"days":N,"firm":true|false,"why":"under 8 words"}]}.\nQuests: ' + JSON.stringify(qs) };
  }
  function hintsParse(s, text) {
    const j = jsonIn(text), out = [];
    (j && Array.isArray(j.hints) ? j.hints : []).forEach((h) => {
      const q = G.findQ(s, Number(h && h.id));
      const d = clampI(h && h.days, 0, 365);
      if (!q || q.archived || q.type === 'todo' || d < 4) return;
      out.push({ id: q.id, days: d, firm: !!h.firm, why: String(h.why || '').slice(0, 60) });
    });
    return out;
  }
  function hintsApply(s, list, t) {
    list.forEach((h) => { const q = G.findQ(s, h.id); if (q) q.hint = { days: h.days, firm: h.firm, why: h.why, at: t || today() }; });
    s.hintsAt = t || today();
  }

  // ---------- barks ----------
  // Who speaks: keys and what the Oracle is told about each. Calendar people are named only by their first name and
  // their event; no titles leave the phone.
  function barkCast(s, t) {
    const cast = [];
    (s.npcs || []).filter((n) => n.kind === 'human' && n.status === 'resident').slice(0, 10).forEach((n) => cast.push({ key: 'n:' + n.id, who: n.name, about: n.comp ? G.CALLINGS[n.comp].title : (n.about || 'lives with the player') }));
    if (G.visitorsNow) G.visitorsNow(s, t).slice(0, 6).forEach((v) => cast.push({ key: 'p:' + v.p.id, who: v.p.name.split(' ')[0], about: (v.p.age === 'adult' ? '' : v.p.age === 'kid' ? 'a kid, ' : 'a toddler, ') + (v.ev ? G.evWords(v.ev, t).what + ' ' + G.evWords(v.ev, t).when : 'visiting') }));
    if (G.TOWN && s.town) Object.keys(G.TOWN).filter((k) => (s.town.own || {})[k]).slice(0, 11).forEach((k) => cast.push({ key: 'k:' + k, who: 'the ' + G.TOWN[k].name.toLowerCase() + ' keeper', about: 'runs the town ' + G.TOWN[k].name.toLowerCase() }));
    cast.push({ key: 'folk', who: 'townsfolk', about: 'passers-by in the market town' });
    return cast;
  }
  function barkPrompt(s, t) {
    const H = G.homeState ? G.homeState(s, t) : {}, cast = barkCast(s, t);
    const mood = Object.keys(G.AFFLICT || {}).filter((k) => H[k] && H[k].linked && H[k].state >= 1).map((k) => G.AFFLICT[k].name.toLowerCase());
    const ctx = { today: t, weekday: 'Mon Tue Wed Thu Fri Sat Sun'.split(' ')[G.dayIdx(t)], hero_level: s.level, dungeons_cleared: (s.delve && s.delve.n) | 0,
      house_needs: mood, days_since_training: G.trainGap ? G.trainGap(s, t) : null, on_hold: G.awayList ? G.awayList(s, t).filter((q) => q.away.why === 'hold').map((q) => q.name) : [] };
    return { system: 'You write short in-character lines ("barks") for a cosy pixel-art RPG about real-life habits. Australian voice and spelling, dry humour, kind. No swearing, no advice lectures, nothing about weight. Reply with JSON only.',
      user: 'Today: ' + JSON.stringify(ctx) + '\nWrite 4 fresh lines (each under 16 words) for each speaker, reflecting today where it fits (the house, what\'s on hold, events) but mostly just being themselves. ' +
        'Reply {"lines":{"<key>":["...", ...]}} using these keys.\nSpeakers: ' + JSON.stringify(cast) };
  }
  function barkParse(s, text, t) {
    const j = jsonIn(text), keys = barkCast(s, t || today()).map((c) => c.key), out = {};
    const L = j && j.lines && typeof j.lines === 'object' ? j.lines : null;
    if (!L) return null;
    keys.forEach((k) => {
      const a = (Array.isArray(L[k]) ? L[k] : []).map((x) => String(x || '').replace(/\s+/g, ' ').trim()).filter((x) => x.length >= 3 && x.length <= 140).slice(0, 6);
      if (a.length) out[k] = a;
    });
    return Object.keys(out).length ? out : null;
  }
  // A fresh line for a speaker, if today's (or yesterday's) batch has one; null to use the written ones.
  function barkFor(s, key, seed) {
    const B = s.barks;
    if (!B || !B.lines || !B.lines[key] || !isDay(B.day) || daysBetween(B.day, today()) > 1) return null;
    const a = B.lines[key];
    return a[Math.abs(Math.floor(seed || 0)) % a.length];
  }

  Object.assign(G, {
    oracleJsonIn: jsonIn, oracleBrief: brief, CHAT_SYSTEM: CHAT_SYSTEM, chatPrompt: chatPrompt, chatParse: chatParse, actCheck: actCheck, actWords: actWords, actApply: actApply,
    judgePrompt: judgePrompt, judgeParse: judgeParse, hintsPrompt: hintsPrompt, hintsParse: hintsParse, hintsApply: hintsApply,
    barkCast: barkCast, barkPrompt: barkPrompt, barkParse: barkParse, barkFor: barkFor, STAT_FULL: STATN,
  });
})(typeof window !== 'undefined' ? window : globalThis);
