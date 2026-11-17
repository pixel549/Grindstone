// 2.25: "it's been too long" reminders, without a browser: the rule (the same cases as OverdueTest.java), the cap,
// suggestions from his own history, and deeds logged by the phone (calendar, widget) settling in when the app opens.
require('../assets/core.js'); require('../assets/delve.js'); require('../assets/town.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const t0 = '2026-11-01';
let S = G.normalize(null, t0);
const mk = (name, type) => { const q = G.newQuest(S, { name: name, icon: '•', type: type || 'habit', stat: 'STR', diff: 2, days: [1, 1, 1, 1, 1, 1, 1], cap: 0 }); G.normQuest(q); S.quests.push(q); return q; };
const q = mk('Training');
const st = (t, m) => G.remindState(S, q, t, m);
const setR = (o) => { q.remind = Object.assign({ d: 3, rep: 0, from: t0, snz: null, ping: null }, o); G.normQuest(q); };
S.qlast = { [q.id]: '2026-11-15' };
// the same cases as test/OverdueTest.java
setR({}); ok(!st('2026-11-17').due && st('2026-11-17').gap === 2, '2 days undone, remind at 3: not yet');
ok(st('2026-11-18').due && st('2026-11-18').gap === 3, '3 days undone: due, gap 3');
setR({ ping: '2026-11-18' }); ok(!st('2026-11-19').due && st('2026-11-19').over, 'once: already in yesterday’s note (but still overdue in the app)');
setR({ ping: '2026-11-18', rep: 2 }); ok(st('2026-11-20').due && st('2026-11-20').gap === 5 && !st('2026-11-19').due, 'every 2 days: again two days later, not the next day');
setR({ ping: '2026-11-18', snz: '2026-11-21' }); ok(!st('2026-11-19').due && st('2026-11-19').snoozed, 'snoozed');
ok(st('2026-11-21').due && st('2026-11-21').gap === 6, 'snooze over: back in the note, even if once');
setR({ ping: '2026-11-21', snz: '2026-11-21' }); ok(!st('2026-11-22').due, 'and once more is once');
S.qlast[q.id] = '2026-11-20'; setR({ ping: '2026-11-18' }); ok(!st('2026-11-22').due && st('2026-11-23').due && st('2026-11-23').gap === 3, 'done since: the clock restarts and the old note doesn’t count');
delete S.qlast[q.id]; setR({ from: '2026-11-17' }); ok(st('2026-11-20').due && st('2026-11-20').gap === 3, 'never done: counts from when it was turned on');
setR({ from: '2026-11-17', ping: '2026-11-10' }); ok(st('2026-11-20').due, 'an old note from before it was turned on doesn’t count');
// the phone's marks win when later
S.qlast[q.id] = '2026-11-15'; setR({});
ok(!st('2026-11-19', { ping: { [q.id]: '2026-11-18' } }).due && st('2026-11-19', { snz: { [q.id]: '2026-11-22' } }).snoozed, 'the note’s own pings and snoozes count');
ok(G.overdueLine(G.overdueList(S, '2026-11-19')) === 'Overdue: Training 4d', 'the note’s line: ' + G.overdueLine(G.overdueList(S, '2026-11-19')));
// archived, finished to-dos
q.archived = true; ok(!st('2026-11-19'), 'archived: no reminder'); q.archived = false;
const td = mk('Cert IV', 'todo'); setR.call(null, {}); td.remind = { d: 3, rep: 0, from: '2026-11-14' }; G.normQuest(td);
ok(G.remindState(S, td, '2026-11-17').due, 'a to-do counts from when its reminder was set');
td.doneOn = '2026-11-17'; ok(!G.remindState(S, td, '2026-11-18') && G.remindCount(S) === 1, 'a finished to-do drops off, and out of the count');

// ---- the cap ----
S = G.normalize(null, t0);
const qs = []; for (let i = 0; i < 14; i++) qs.push(mk('Q' + i));
let err = null; qs.slice(0, 12).forEach((x) => { err = err || G.remindSet(S, x.id, true, 0, 0, t0); });
ok(!err && G.remindCount(S) === 12, 'twelve reminders on');
ok(/limit/.test(G.remindSet(S, qs[12].id, true, 0, 0, t0) || '') && !qs[12].remind, 'the thirteenth is refused');
ok(!G.remindSet(S, qs[0].id, true, 5, 2, t0) && qs[0].remind.d === 5 && qs[0].remind.rep === 2, 'changing one already on is fine at the cap');
G.remindSet(S, qs[1].id, false); ok(!G.remindSet(S, qs[12].id, true, 0, 0, t0), 'turn one off and another can go on');

// ---- suggestions, from the days he actually did it ----
S = G.normalize(null, t0);
const tr = mk('Swim');
let d = t0; for (let i = 0; i < 10; i++) { G.complete(S, tr.id, d, Date.parse(d + 'T09:00:00')); d = G.addDays(d, 2); }
let sg = G.remindSuggest(S, tr);
ok(sg && sg.every === 2 && sg.n === 3 && sg.times === 10, 'every 2 days → suggests 3 (' + JSON.stringify(sg) + ')');
const mow = mk('Mow the lawn'); d = t0; for (let i = 0; i < 5; i++) { G.complete(S, mow.id, d, Date.parse(d + 'T09:00:00')); d = G.addDays(d, 7); }
sg = G.remindSuggest(S, mow); ok(sg && sg.every === 7 && sg.n === 9, 'weekly → suggests 9 (' + (sg && sg.n) + ')');
const rare = mk('Rare'); G.complete(S, rare.id, t0, 1); ok(G.remindSuggest(S, rare) === null, 'not enough history: no suggestion');
ok(!G.remindSet(S, tr.id, true, 0, 0, t0) && tr.remind.d === 3, 'turned on with no number: the suggestion');
// undo takes the day back out of the history
const before = S.qhist[tr.id].length, last = S.qhist[tr.id][before - 1];
G.undo(S, tr.id, last); ok(S.qhist[tr.id].length === before - 1 && S.qlast[tr.id] !== last, 'undo takes the day back out');
ok(S.qhist[tr.id].length <= G.QHIST_MAX, 'history keeps the last ' + G.QHIST_MAX + ' days');

// ---- deeds the phone logged while the app was shut (Game.java marks them nat: 1) ----
S = G.normalize(null, t0);
const h = mk('Run'); h.stat = 'END'; h.diff = 3;
S.town = Object.assign(S.town || {}, { open: true, own: { bank: 1, track: 1 }, on: ['bank', 'track'] });
S = G.normalize(S, t0);
const tp = G.townPerks(S), D = G.DIFF[2], gold0 = S.gold, wind0 = S.wind | 0, cnt0 = (S.town.cnt.dEND | 0);
// what Game.java does: base gold, no town, no days
S.log.unshift({ t: 5, d: '2026-11-02', q: h.id, n: h.name, i: '•', x: D.xp, g: D.gold, s: 'END', k: 'x', nat: 1, h: 1 });
S.gold += D.gold; S.total += 1; S.qlast[h.id] = '2026-11-02';
S = G.normalize(S, '2026-11-03');
const e = S.log.find((x) => x.k === 'x'), want = tp.deedGold ? Math.round(D.gold * (1 + tp.deedGold / 100)) : D.gold;
ok(!e.nat && e.g === want && S.gold === gold0 + want, 'a calendar deed gets the counting house’s cut on opening (' + D.gold + ' → ' + want + ')');
ok(S.days['2026-11-02'] && S.days['2026-11-02'][0] === 1 && S.qhist[h.id].indexOf('2026-11-02') >= 0, 'and its day');
ok((S.wind | 0) === Math.min(12, wind0 + 1) && (S.town.cnt.dEND | 0) === cnt0 + 1, 'and the wind, and the track’s tally');
const g1 = S.gold; S = G.normalize(S, '2026-11-03'); ok(S.gold === g1 && S.days['2026-11-02'][0] === 1, 'settled once only');
{ // the phone's copy of the rewards must match the game's
  const J = require('fs').readFileSync(__dirname + '/../src/dev/jake/grindstone/Game.java', 'utf8');
  const jg = (J.match(/int\[\] GOLD = \{([^}]*)\}/) || [])[1], jx = (J.match(/int\[\] XP = \{([^}]*)\}/) || [])[1], jn = (J.match(/return 80 \+ (\d+) \* \(level - 1\)/) || [])[1];
  ok(jg && jg.replace(/\s/g, '') === G.DIFF.map((x) => x.gold).join() && jx.replace(/\s/g, '') === G.DIFF.map((x) => x.xp).join(), 'Game.java pays the same XP and gold as the game (' + jg + ')');
  ok(+jn === G.need(2) - 80, 'and uses the same level curve (80 + ' + jn + '(L − 1))');
}

// ---- the one-off repair: days and last-done from the log, for deeds that never reached them ----
S = G.normalize(null, t0);
const r2 = mk('Read'); r2.stat = 'INT';
S.log = [{ t: 3, d: '2026-11-05', q: r2.id, x: 10, g: 12, s: 'INT' }, { t: 2, d: '2026-11-04', q: r2.id, x: 10, g: 12, s: 'INT' }, { t: 1, d: '2026-11-03', q: r2.id, x: 10, g: 12, s: 'INT' }];
S.days = { '2026-11-03': [9, 0, 0, 0, 0, 0, 0, 0] }; S.qlast = {}; delete S.qhist; delete S.daysFix;
S = G.normalize(S, '2026-11-06');
ok(S.days['2026-11-05'][0] === 1 && S.days['2026-11-04'][0] === 1 && S.days['2026-11-03'][0] === 9, 'rebuilt days the log fully covers, left the oldest alone');
ok(S.qlast[r2.id] === '2026-11-05' && S.qhist[r2.id].length === 3 && S.daysFix === 1, 'last-done and history from the log');

// ---- 2.25.2: an odd cycle with no history: the reminder starts at the cycle ----
S = G.normalize(null, t0);
const scr = mk('Renew the 35-day script'); scr.rest = 35; G.normQuest(scr);
ok(!G.remindSet(S, scr.id, true, 0, 1, t0) && scr.remind.d === 35 && scr.remind.rep === 1, 'a habit that comes round every 35 days: the reminder starts at 35');
ok(!G.remindSet(S, scr.id, true, 200, 1, t0) && scr.remind.d === 200, 'and can go past 90 (up to a year)');
scr.qlast = null; S.qlast[scr.id] = '2026-10-01'; G.remindSet(S, scr.id, true, 35, 1, t0);
const pm = (d) => ({ ping: { [scr.id]: d } });
ok(!G.remindState(S, scr, '2026-11-04').due && G.remindState(S, scr, '2026-11-05').due, 'renewed 1 Oct: in the note on 5 Nov, not before');
ok(G.remindState(S, scr, '2026-11-06', pm('2026-11-05')).due && !G.remindState(S, scr, '2026-11-06', pm('2026-11-06')).due, 'then daily until it’s done, once a day');
S.qlast[scr.id] = '2026-11-06'; ok(!G.remindState(S, scr, '2026-11-07', pm('2026-11-06')).over && G.remindState(S, scr, '2026-12-11').due, 'renewed 6 Nov: quiet until 11 Dec');

// ---- slipping: an offer, set to the suggestion ----
S = G.normalize(null, t0);
const sw = mk('Swim laps'), lw = mk('Mow the lawn'), nw = mk('New thing');
const T = '2026-11-30';
S.qhist[sw.id] = []; for (let i = 26; i >= 8; i -= 2) S.qhist[sw.id].push(G.addDays(T, -i)); S.qlast[sw.id] = G.addDays(T, -8);   // every 2 days, 8 days ago
S.qhist[lw.id] = [G.addDays(T, -26), G.addDays(T, -19), G.addDays(T, -12)]; S.qlast[lw.id] = G.addDays(T, -12);           // weekly, 12 days ago: not slipped yet
S.qhist[nw.id] = [G.addDays(T, -20)]; S.qlast[nw.id] = G.addDays(T, -20);                                                  // no rhythm to judge by
let off = G.slipOffers(S, T);
ok(off.length === 1 && off[0].id === sw.id && off[0].n === 3 && off[0].gap === 8, 'swimming (every 2 days, 8 days ago) is offered a reminder at 3; the lawn (weekly, 12 days) isn’t yet; no rhythm, no offer');
ok(G.slipOffers(S, G.addDays(T, 1)).length === 2, 'the lawn at 13 days is');
G.remindDecline(S, sw.id, T); ok(!G.slipOffers(S, T).some((x) => x.id === sw.id), 'said no: not offered again');
ok(G.slipOffers(S, G.addDays(T, 60)).some((x) => x.id === sw.id), 'until two months have passed');
S = G.normalize(S, G.addDays(T, 61)); ok(!S.remindNo[sw.id], 'and the no is forgotten');
G.remindSet(S, sw.id, true, 3, 0, T); ok(!G.slipOffers(S, G.addDays(T, 1)).some((x) => x.id === sw.id), 'once it has a reminder, no offer');
// ---- the week in review: what went overdue, day by day ----
S = G.normalize(null, t0);
const wq = mk('Weights');
wq.remind = { d: 3, rep: 0, from: '2026-11-01' }; G.normQuest(wq);
S.qhist[wq.id] = ['2026-11-08', '2026-11-13']; S.qlast[wq.id] = '2026-11-13';
// week 9–15 Nov: 11 (gap 3), 12 (gap 4) overdue; done 13th; 14, 15 fine
let ow = G.overdueWeek(S, '2026-11-09', '2026-11-15', '2026-11-20');
ok(ow.length === 1 && ow[0].days === 2 && ow[0].max === 4 && !ow[0].still, 'overdue on the 11th and 12th (longest 4 days), done since: ' + JSON.stringify(ow.map((x) => [x.days, x.max, x.still])));
ow = G.overdueWeek(S, '2026-11-16', '2026-11-22', '2026-11-18');
ok(ow.length === 1 && ow[0].days === 3 && ow[0].max === 5 && ow[0].still, 'this week so far: overdue the 16th, 17th and today, still');
ok(G.overdueWeek(S, '2026-10-20', '2026-10-26', '2026-11-18').length === 0, 'before it was turned on: nothing');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
