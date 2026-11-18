// 2.27: putting quests away and holds, the long-day rule, the offer to hide after a go, judging (rules and the
// Oracle's answers, clamped), talking to the Oracle (its actions checked and applied), hints, barks, and the
// nightmare stage, as logic.
require('../assets/core.js');
require('../assets/library.js');
require('../assets/town.js');
require('../assets/people.js');
require('../assets/oracle.js');
let fails = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const t = '2026-11-17', A = (d) => G.addDays(t, d);
const fresh = () => { const s = G.normalize(null, t); s.hero.name = 'Jake'; return s; };
const Q = (s, name) => s.quests.find((q) => q.name === name);
const add = (s, o) => { const q = G.newQuest(s, Object.assign({ icon: '•', stat: 'END', diff: 2 }, o)); s.quests.push(q); return q; };

// ---- hiding and holds ----
let s = fresh();
const run = add(s, { name: 'Test run', type: 'habit', stat: 'END', cap: 1 });
const meds = add(s, { name: 'Pick up the meds', type: 'daily', stat: 'VIT' });
G.awaySet(s, [run.id], A(14), true, 'ankle', t);
G.awaySet(s, [meds.id], A(3), false, '', t);
ok(G.isAway(run, t) && G.isAway(run, A(13)) && !G.isAway(run, A(14)), 'hidden until the day it’s back');
ok(G.isHeld(run, t) && !G.isHeld(meds, t) && run.away.note === 'ankle', 'a hold is a hide that protects');
ok(G.excused(s, meds, t) && !G.planState(s, t).dailies.some((q) => q.id === meds.id), 'a hidden daily is let off and off the day’s count');
ok(G.awayList(s, t).map((q) => q.id).join() === meds.id + ',' + run.id, 'the put-away list, soonest back first');
ok(G.awaySet(s, [run.id], t, false, '', t).length === 0, 'it can’t be hidden until today (or earlier)');
ok(s.holdLog.length === 1 && s.holdLog[0].to === A(14) && s.trainQuiet === A(14), 'a hold is kept for the callings, and the training nudge’s quiet date is set');
ok(G.trainGap(s, A(5)) === null, 'no “days since training” while training’s on hold');
ok(G.trainGap(s, A(17)) === 3, '…and after, it counts from the day it came back: ' + G.trainGap(s, A(17)));
// the companions' weeks wait: a hold over most of a week neither counts nor breaks the run
s.callings = s.callings || {};
const ws = G.weekStart(t), wk = {};
wk[G.addDays(ws, -14)] = 0b0001011; wk[G.addDays(ws, -7)] = 0b0010101;   // two scout weeks met
s.callings.scout = { wk: wk };
s.holdLog = [{ q: run.id, stat: 'END', from: G.addDays(ws, 7), to: G.addDays(ws, 21) }];
const sc = G.callingState(s, 'scout', new Date(G.addDays(ws, 21) + 'T12:00'));
ok(sc.streak === 2, 'two weeks held: the scout’s run of 2 waits instead of breaking: ' + sc.streak);
s.holdLog = [];
const sc2 = G.callingState(s, 'scout', new Date(G.addDays(ws, 21) + 'T12:00'));
ok(sc2.streak === 0, 'without the hold the same weeks break it (the one skip covers only one)');
// done anyway: it's back
s = fresh();
const r2 = add(s, { name: 'Test run', type: 'habit', stat: 'END', cap: 1 });
G.awaySet(s, [r2.id], A(10), true, '', t);
G.complete(s, r2.id, A(2), Date.now());
ok(!G.isAway(r2, A(2)) && s.holdLog[0].to === A(2), 'doing it brings it back, and ends the hold');
G.awaySet(s, [r2.id], A(10), false, '', t); G.awayEnd(s, [r2.id], A(1));
ok(!G.isAway(r2, A(1)) && r2.away.back === A(1), 'bringing it back early');
// chores: hidden, the clock waits; back, it counts from then
s = fresh();
const dish = s.quests.find((q) => q.home === 'dishes');
const before = G.homeState(s, A(6)).dishes.state;
G.awaySet(s, [dish.id], A(8), false, '', t);
ok(before === 2 && G.homeState(s, A(6)).dishes.state === 0, 'a hidden chore isn’t neglected while it’s away');
ok(G.homeState(s, A(9)).dishes.days === 1, 'and back, it counts from its return');
// reminders and slips leave it be; the weeklies don't pick it
s = fresh();
const r3 = add(s, { name: 'Test swim', type: 'habit', stat: 'END', cap: 1 });
r3.remind = { d: 3, rep: 0, from: A(-10) }; G.normQuest(r3);
ok(G.overdueList(s, t, {}).some((x) => x.id === r3.id), 'overdue as it stands');
G.awaySet(s, [r3.id], A(5), false, '', t);
ok(!G.overdueList(s, t, {}).some((x) => x.id === r3.id), 'hidden: not overdue');
s.qhist = s.qhist || {}; s.qhist[r3.id] = [A(-30), A(-28), A(-26), A(-24)]; s.qlast = s.qlast || {}; s.qlast[r3.id] = A(-24); delete r3.remind;
ok(!G.slipOffers(s, t).some((x) => x.id === r3.id), 'and no slip offer');
// normalising keeps it, then lets an old one go
let s2 = G.normalize(JSON.parse(JSON.stringify(s)), t);
ok(G.isAway(Q(s2, 'Test swim'), t), 'kept through a reload');
s2 = G.normalize(JSON.parse(JSON.stringify(s)), A(70));
ok(!Q(s2, 'Test swim').away, 'and dropped 60 days after it came back');

// ---- the long-day rule ----
s = fresh();
s.settings.rosterCal = '5'; s.settings.longHours = 9;
s.roster = { at: 1, days: {} };
const longs = [A(-2), A(-5), A(-9), A(-12), A(-16)];
longs.forEach((d) => { s.roster.days[d] = { mins: 600, first: 360, last: 960, off: false }; });
s.roster.days[t] = { mins: 600, first: 360, last: 960, off: false };
const water = add(s, { name: 'Test water', type: 'daily', stat: 'VIT' }), floss = add(s, { name: 'Test floss', type: 'daily', stat: 'VIT' });
s.qhist[water.id] = longs.slice(0, 4).concat([A(-3)]).sort(); s.qhist[floss.id] = [A(-2)];
ok(G.longKeep(s, water, t) && G.longKeep(s, water, t).done === 4 && G.longKeep(s, water, t).of === 5, 'done on 4 of the last 5 long days: kept');
ok(!G.excused(s, water, t) && G.excused(s, floss, t), 'so it stays on today’s long-day list; the other is let off');
water.longOff = true;
ok(G.excused(s, water, t), 'unless he lets it off anyway');
ok(G.QHIST_MAX === 42 && G.remindSuggest(s, Object.assign({}, water, { id: water.id })) !== undefined, 'six weeks of history kept; suggestions still read the last dozen');

// ---- the offer to hide it after a go ----
s = fresh();
const mow = add(s, { name: 'Test mow', type: 'habit', stat: 'END', cap: 1 });
s.qhist[mow.id] = [A(-42), A(-28), A(-14), t];
let sg = G.hideSuggest(s, mow, t);
ok(sg && sg.every === 14 && sg.days === 12 && sg.src === 'history', 'every 14 days: offered 12 (back before it’s due)');
mow.hint = { days: 35, firm: true, why: 'script limit' };
sg = G.hideSuggest(s, mow, t);
ok(sg.days === 35 && sg.firm && sg.src === 'oracle', 'a firm hint (a script) hides for exactly that long');
mow.hideAskAt = t; ok(!G.hideSuggest(s, mow, A(10)), 'not now: quiet for a month');
delete mow.hideAskAt; mow.hideAsk = 'no'; ok(!G.hideSuggest(s, mow, t), 'don’t ask: never');
delete mow.hideAsk; mow.rest = 14; ok(!G.hideSuggest(s, mow, t), 'already hides after each go: nothing to offer');
const gym = add(s, { name: 'Test lift', type: 'habit', stat: 'STR', cap: 1 }); s.qhist[gym.id] = [A(-6), A(-4), A(-2), t];
ok(!G.hideSuggest(s, gym, t), 'every couple of days: not worth hiding');
const daily = add(s, { name: 'Test daily rest', type: 'daily', stat: 'DIS' }); daily.rest = 35; G.normQuest(daily);
ok(daily.rest === 35, 'a daily can now come round as rarely as a habit (35 days)');

// ---- judging ----
let j = G.judgeRules({ name: 'Swim', type: 'habit' });
ok(j.src === 'library' && j.stat === 'END' && j.diff === 4 && j.cap === 1, 'in the library: its values');
j = G.judgeRules({ name: 'Do 10 minutes of yoga', type: 'habit' });
ok(j.stat === 'VIT' && j.diff === 1 && j.cap === 3, 'keywords and minutes: ' + JSON.stringify(j));
j = G.judgeRules({ name: 'Run 12km', type: 'habit' });
ok(j.stat === 'END' && j.diff === 4, 'a long run is hard');
j = G.judgeRules({ name: 'Sort the tax paperwork', type: 'todo' });
ok(j.stat === 'DIS' && j.diff === 2 && j.cap === 0, 'otherwise a middling guess at discipline');
let gj = G.judgeGoalRules({ kind: 'count', target: 20, end: A(13) }, t);
ok(gj.gold === 240 && gj.chest, '20 in a fortnight: ' + gj.gold + ' gold and a coffer');
gj = G.judgeGoalRules({ kind: 'count', target: 5 }, t);
ok(gj.gold === 40 && !gj.chest, '5 with no date: 40 gold');
let jp = G.judgeParse('quest', 'Sure: {"diff": 9, "stat": "str", "cap": 0, "why": "x"}');
ok(jp && jp.diff === 5 && jp.stat === 'STR' && jp.cap === 1, 'the Oracle’s answer is clamped: ' + JSON.stringify(jp));
ok(G.judgeParse('quest', '{"diff": 3, "stat": "LUCK"}') === null && G.judgeParse('quest', 'no idea') === null, 'nonsense is ignored (the rules’ guess stands)');
jp = G.judgeParse('goal', '{"gold": 9999, "chest": true}');
ok(jp.gold === 500 && jp.chest, 'gold capped at 500');
ok(/difficulty 1-5|Difficulty 1-5/i.test(G.judgePrompt('quest', { name: 'Swim', type: 'habit' }).user), 'it’s told the scale');

// ---- talking to the Oracle ----
s = fresh();
const sw = add(s, { name: 'Test swim', type: 'habit', stat: 'END', cap: 1 }), rn = add(s, { name: 'Test run', type: 'habit', stat: 'END', cap: 1 });
const reply = 'Ouch. {"say":"Rest it.","actions":[{"do":"hide","ids":[' + sw.id + ',' + rn.id + ',99999],"days":14,"hold":true,"why":"ankle"},{"do":"hide","ids":[99999],"days":3},{"do":"add","name":"Ankle rehab","icon":"🦶🦶🦶","type":"daily","remind":400},{"do":"gold","n":1000},{"do":"every","id":' + sw.id + ',"days":1}]}';
const pr = G.chatParse(s, reply, t);
ok(pr.say === 'Rest it.' && pr.actions.length === 2, 'only the sound actions survive (unknown quests, gold, a 1-day “every” are dropped): ' + pr.actions.map((a) => a.do).join(','));
ok(pr.actions[0].ids.length === 2 && pr.actions[0].hold && pr.actions[0].days === 14, 'the hold: both quests, a fortnight, protected');
ok(pr.actions[1].remind === 365 && Array.from(pr.actions[1].icon).length === 2, 'the add: reminder clamped, icon trimmed');
ok(/^Hold Test swim and Test run for 2 weeks \(back 1 Dec\), streaks protected$/.test(G.actWords(s, pr.actions[0], t)), 'in words: ' + G.actWords(s, pr.actions[0], t));
ok(G.actApply(s, pr.actions[0], t) && G.isHeld(sw, t) && G.isHeld(rn, t), 'applied: both on hold');
const nq = G.actApply(s, pr.actions[1], t);
ok(nq && nq.name === 'Ankle rehab' && nq.judged && nq.remind.d === 365, 'the add makes the quest, judged by the rules until the Oracle answers');
ok(G.chatParse(s, 'I am but a humble oracle', t).actions.length === 0 && G.chatParse(s, 'I am but a humble oracle', t).raw, 'plain prose is shown as it is');
const cp = G.chatPrompt(s, t, [{ r: 'me', text: 'hi' }, { r: 'or', text: 'hello' }], 'rolled my ankle');
ok(/Player: hi/.test(cp.user) && /Oracle: hello/.test(cp.user) && /rolled my ankle/.test(cp.user) && /hidden=/.test(cp.user), 'the prompt carries the talk so far and what’s hidden');
ok(!/Jake/.test(cp.user), 'and not his name');

// ---- hints and barks ----
const hp = G.hintsParse(s, '{"hints":[{"id":' + sw.id + ',"days":14,"firm":false,"why":"pool"},{"id":99999,"days":5},{"id":' + rn.id + ',"days":1}]}');
ok(hp.length === 1 && hp[0].days === 14, 'hints: only real quests, only gaps worth hiding for');
G.hintsApply(s, hp, t);
ok(sw.hint.days === 14 && s.hintsAt === t, 'stored on the quest');
const cast = G.barkCast(s, t);
ok(cast.some((c) => c.key === 'folk'), 'the townsfolk always speak');
const bl = G.barkParse(s, '{"lines":{"folk":["Ice it, mate.", "x", "' + 'a'.repeat(200) + '"],"nobody":["hi there"]}}', t);
ok(bl && bl.folk.length === 1 && !bl.nobody, 'barks: the cast’s own keys, sensible lengths');
s.barks = { day: t, lines: bl };
ok(G.barkFor(s, 'folk', 3) === 'Ice it, mate.' && G.barkFor(s, 'k:gym', 1) === null, 'a fresh line when there is one');
s.barks.day = A(-3);
ok(G.barkFor(s, 'folk', 3) === null, 'and stale ones aren’t used');

// ---- the nightmare stage ----
s = fresh();
const hs = G.homeState(s, A(30));
ok(hs.dishes.state === 2 && hs.dishes.dire && hs.dishes.word === 'A new ecosystem', 'a month without dishes: ' + hs.dishes.word);
ok(G.houseLevels(s, A(30)).dire.dishes === true && G.heroMind(s, A(30)).chores.dishes.dire, 'the house is told');
const hs2 = G.homeState(s, A(3));
ok(!hs2.dishes.dire, 'a few days is only bad, not a nightmare');

// ---- the Oracle's rooms: persistent tiers, prerequisites and gold costs ----
s = fresh();
ok(s.oracleRooms && s.oracleRooms.tier.sanctum === 1 && s.oracleRooms.tier.archive === 0, 'a new save starts with the Sanctum and keeps later chambers unbuilt');
const activeQuest = G.newQuest(s, { name: 'Player-created active task', type: 'todo', stat: 'DIS', diff: 2 });
ok(!activeQuest.archived, 'a player-created task is active by default');
let room = G.oracleRoomState(s, 'archive');
ok(room.locked && /Reach level 10/.test(room.why), 'the Archive is level-gated');
s.level = 10; s.gold = 10000;
room = G.oracleRoomState(s, 'archive');
ok(room.locked && /Sanctum to tier 2/.test(room.why), 'the Archive also needs the Sanctum restored');
let buy = G.oracleRoomUpgrade(s, 'sanctum');
ok(!buy.err && buy.tier === 2 && s.gold === 10000 - buy.cost, 'restoring the Sanctum spends gold and advances its tier');
room = G.oracleRoomState(s, 'archive');
ok(!room.locked && room.ok, 'the Archive becomes available once its requirements are met');
buy = G.oracleRoomUpgrade(s, 'archive');
ok(!buy.err && s.oracleRooms.tier.archive === 1, 'the Archive can be built');
const roundTrip = G.normalize(JSON.parse(JSON.stringify(s)), t);
ok(roundTrip.oracleRooms.tier.archive === 1 && roundTrip.oracleRooms.tier.sanctum === 2, 'room tiers survive save normalisation');
ok(G.oracleRoomState(s, 'unknown') === null, 'unknown rooms are rejected');
console.log(n + ' checks, ' + fails + ' failed');
if (fails) process.exit(1);
