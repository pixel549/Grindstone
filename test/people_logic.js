// 2.26: people from the calendar and pets, as logic: reading titles, the year of events, who's offered, who turns up
// when (and goes), the to-dos the big days bring (once each), kids, the pets step and what it does to the chores, and
// New Game+ carrying it all.
require('../assets/core.js');
require('../assets/people.js');
const fs = require('fs');
let fails = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const t = '2026-11-17';

// ---- titles ----
const P = (x) => G.calParse(x);
const want = [
  ["Paul's birthday", ['Paul'], 'birthday'], ['Paul’s Birthday 🎂', ['Paul'], 'birthday'], ["Emma's 5th birthday", ['Emma'], 'birthday', 5],
  ['Jack turns 2', ['Jack'], 'birthday', 2], ['Birthday: Sarah Jones', ['Sarah Jones'], 'birthday'], ['Happy birthday Kirsty!', ['Kirsty'], 'birthday'], ['Leo bday', ['Leo'], 'birthday'],
  ["Mum & Dad's anniversary", ['Mum', 'Dad'], 'anniversary'], ['Anniversary - Nan and Pop', ['Nan', 'Pop'], 'anniversary'],
  ["Chris's farewell", ['Chris'], 'party'], ['Baby shower - Emma', ['Emma'], 'party'], ["James's wedding", ['James'], 'party'], ['Wedding of Tom & Ana', ['Tom', 'Ana'], 'party'], ["Mia's netball game", ['Mia'], 'party'],
  ['Paul visiting', ['Paul'], 'visit'], ['Uncle Rob staying over', ['Uncle Rob'], 'visit'], ['Paul in town', ['Paul'], 'visit'],
  ['Dinner with Sarah and Tom', ['Sarah', 'Tom'], 'catchup'], ['Lunch w/ Aunty Sue', ['Aunty Sue'], 'catchup'], ['Catch up with Ben re Cert IV', ['Ben'], 'catchup'], ['Coffee: Lesley', ['Lesley'], 'catchup'],
];
want.forEach((w) => { const r = P(w[0]); ok(r && eq(r.names, w[1]) && r.kind === w[2] && (w[3] == null || r.age === w[3]), `“${w[0]}” reads as ${w[2]}: ${w[1].join(' + ')}${w[3] != null ? ' (' + w[3] + ')' : ''}`); });
['RC 1600-2130', 'O/N', 'Team meeting', 'Work Christmas party', 'Dinner with the team', "Mother's Day", 'Bins out', 'Script renewal', 'Christmas Day', 'Grindstone: swim', "Doctor's appointment", 'Holiday with family', 'Birthday party', 'Kids sports day']
  .forEach((x) => ok(P(x) === null, `“${x}” names no one`));
ok(P("Mia's netball game").what === 'netball game' && P("James's wedding").what === 'wedding', 'what the do is, is kept');

// ---- the year of events ----
const utc = (d) => Date.parse(d + 'T00:00:00Z'), loc = (d, h) => new Date(d + 'T' + h + ':00').getTime();
const raw = [
  { t: "Paul's birthday", s: utc('2026-11-24'), e: utc('2026-11-25'), a: true }, { t: "Emma's 5th birthday", s: utc('2026-12-10'), e: utc('2026-12-11'), a: true },
  { t: 'Dinner with Sarah', s: loc('2026-11-20', '18:00'), e: loc('2026-11-20', '21:00'), a: false }, { t: 'RC 1600-2130', s: loc('2026-11-18', '16:00'), e: loc('2026-11-18', '21:30'), a: false },
  { t: "Jake's birthday", s: utc('2027-03-01'), e: utc('2027-03-02'), a: true }, { t: "Paul's birthday", s: utc('2027-11-24'), e: utc('2027-11-25'), a: true },
  { t: 'Mum visiting', s: utc('2026-12-20'), e: utc('2026-12-27'), a: true }, { t: "Paul's birthday", s: utc('2026-11-24'), e: utc('2026-11-25'), a: true },
  { t: "Old Bob's birthday", s: utc('2026-10-01'), e: utc('2026-10-02'), a: true }, { t: 'Leo turns 1', s: utc('2026-11-20'), e: utc('2026-11-21'), a: true },
];
const evs = G.calDigest(raw, t);
ok(evs.length === 7, 'only the ones naming people, from yesterday on, each once: ' + evs.length);
const mum = evs.find((e) => e.names[0] === 'Mum');
ok(mum.d === '2026-12-20' && mum.end === '2026-12-26', 'an all-day visit spans its days (the end is exclusive, in UTC): ' + mum.d + '…' + mum.end);
ok(evs.find((e) => e.names[0] === 'Sarah').d === '2026-11-20', 'a timed one sits on its local day');
ok(evs.every((e, i) => !i || evs[i - 1].d <= e.d), 'in date order');

// ---- who's offered ----
let s = G.normalize(null, t);
s.hero.name = 'Jake';
s.calPeople = { at: 1, evs: evs };
let c = G.peopleCandidates(s, t);
ok(eq(c.map((x) => x.name), ['Leo', 'Paul', 'Emma', 'Mum', 'Sarah']), 'offered: big days first, then by date; never himself: ' + c.map((x) => x.name).join(', '));
ok(c.find((x) => x.name === 'Paul').n === 2 && c.find((x) => x.name === 'Emma').age === 5 && G.ageGuess(5) === 'kid' && G.ageGuess(1) === 'baby' && G.ageGuess(null) === 'adult', 'Paul has two events; Emma is about 5 (a kid), Leo 1 (a little one)');
s.peopleNo.sarah = 'no'; s.peopleNo.mum = G.addDays(t, 30);
ok(eq(G.peopleCandidates(s, t).map((x) => x.name), ['Leo', 'Paul', 'Emma']), '“not a person” and “not now” both hide a name');
s = G.normalize(JSON.parse(JSON.stringify(s)), G.addDays(t, 31));
ok(s.peopleNo.sarah === 'no' && !s.peopleNo.mum, '“not now” runs out after 30 days; “not a person” doesn’t');
s = G.normalize(JSON.parse(JSON.stringify(s)), t);
s.calPeople = { at: 1, evs: JSON.parse(JSON.stringify(evs)) };   // (normalising a month on dropped the ones that had been)
s.calPeople.evs.push({ d: '2026-11-30', end: '2026-11-30', t: 'Coffee with Kermit', names: ['Kermit'], kind: 'catchup', what: 'catchup' });
ok(!G.peopleCandidates(s, t).some((x) => x.name === 'Kermit'), 'a pet’s name isn’t a person');

// ---- people, and who turns up when ----
s.people.push(G.personNorm({ id: 'p1', name: 'Paul Smith', also: ['Paulie'], look: G.randomLook(), cal: { lead: 7 } }));
s.people.push(G.personNorm({ id: 'p2', name: 'Emma', age: 'kid', look: G.randomLook(), cal: { lead: 14 } }));
s.people.push(G.personNorm({ id: 'p3', name: 'Leo', age: 'baby', look: G.randomLook(), cal: { lead: 3 } }));
ok(G.personFor(s, 'Paul') === s.people[0] && G.personFor(s, 'paulie') === s.people[0] && G.personFor(s, 'Emma Jones') === s.people[1], 'a first name finds the full name, and the other names they go by count');
ok(s.people[1].look.age === 'kid' && s.people[2].look.age === 'baby' && !s.people[0].look.age, 'kids and little ones carry their age in their look (for the child body)');
const who = (d) => G.visitorsNow(s, d).map((v) => v.p.name).sort().join(',');
ok(who('2026-11-16') === '' && who('2026-11-17') === 'Leo,Paul Smith', 'Paul turns up a week before his birthday; Leo 3 days before his: ' + who(t));
ok(who('2026-11-24') === 'Paul Smith' && who('2026-11-25') === '', 'and they stay through the day, then go');
ok(who('2026-11-26') === 'Emma' && G.visitorsNow(s, '2026-11-26')[0].days === 14, 'Emma (a fortnight ahead) is there from the 26th');
s.people[0].cal.mode = 'always'; ok(who('2026-12-01').indexOf('Paul Smith') >= 0, '“lives here”: always there');
s.people[0].cal.mode = 'never'; ok(who('2026-11-20').indexOf('Paul') < 0, '“never”: never');
s.people[0].cal.mode = 'events';
s.calPeople.evs.push({ d: '2026-11-19', end: '2026-11-19', t: 'Lunch with Emma', names: ['Emma'], kind: 'catchup', what: 'catchup' });
ok(!G.visitorsNow(s, '2026-11-18').some((v) => v.p.name === 'Emma'), 'a lunch isn’t a big day');
s.people[1].cal.which = 'any';
ok(G.visitorsNow(s, '2026-11-18').some((v) => v.p.name === 'Emma'), 'unless they’re set to turn up for anything with them');
s.people[1].cal.which = 'big';
const w = G.evWords(s.calPeople.evs.find((e) => e.names[0] === 'Emma' && e.kind === 'birthday'), t);
ok(w.icon === '🎂' && w.what === 'Emma’s birthday (5)' && w.when === 'in 23 days' && w.date === '10 Dec', 'the words for an event: ' + JSON.stringify(w));

// ---- the to-dos ----
let r = G.calTodos(s, t);
ok(eq(r.added, ['Get Leo a present (20 Nov)', 'Organise Leo’s birthday (20 Nov)', 'Sort a present for Paul (24 Nov)'].sort()) || eq(r.added.slice().sort(), ['Get Leo a present (20 Nov)', 'Organise Leo’s birthday (20 Nov)', 'Sort a present for Paul (24 Nov)'].sort()), 'what’s due now: a kid’s party and present, a grown-up’s present: ' + r.added.join(' · '));
ok(!r.added.some((x) => /Emma/.test(x)), 'Emma’s birthday is 23 days off: not yet (21 for a kid’s party)');
ok(s.quests.filter((q) => q.cal).every((q) => q.type === 'todo'), 'they’re one-off to-dos');
ok(G.calTodos(s, t).added.length === 0, 'and only made once');
const pq = s.quests.find((q) => /Paul/.test(q.name));
s.quests = s.quests.filter((q) => q !== pq);
ok(G.calTodos(s, t).added.length === 0, 'deleting one is final: it isn’t made again');
r = G.calTodos(s, '2026-11-21');
ok(r.gone === 2 && !s.quests.some((q) => /Leo/.test(q.name)), 'Leo’s day has been: the undone ones go');
ok(r.added.some((x) => /Organise Emma/.test(x)) && !r.added.some((x) => /Emma a present/.test(x)), 'Emma’s party to-do comes three weeks out (the present at ten days)');
const eq1 = s.quests.find((q) => /Organise Emma/.test(q.name)); eq1.doneOn = '2026-11-20';
G.calTodos(s, '2026-12-11');
ok(s.quests.indexOf(eq1) >= 0, 'a done one stays (the usual 30 days for done to-dos)');
s.people[1].cal.todos = false;
const s2 = JSON.parse(JSON.stringify(s)); s2.calTodo = {}; s2.quests = s2.quests.filter((q) => !q.cal);
ok(!G.calTodos(s2, '2026-12-05').added.some((x) => /Emma/.test(x)), 'no to-dos for someone set not to have them');
s2.settings.calTodos = false; s2.calTodo = {};
ok(G.calTodos(s2, '2026-11-20').added.length === 0, 'and none at all with the setting off');
ok(G.todoPlans(s, { d: '2026-12-01', names: ['Paul'], kind: 'visit' })[0].name === 'Get the house ready for Paul (1 Dec)' && G.todoPlans(s, { d: '2026-12-01', names: ['Sarah'], kind: 'birthday' }).length === 0,
  'a visit brings getting the house ready; someone not designed brings nothing');

// ---- looks ----
ok(G.normLook({ age: 'kid', legs: 'skirt' }).age === 'kid' && G.normLook({ age: 'elder' }).age === undefined && G.normLook({ legs: 'kilt' }).legs === undefined, 'a look keeps a kid’s age and pants or skirt, nothing else');

// ---- pets ----
let p = G.normalize(null, t);
ok(eq(G.petsList(p).map((x) => x.name), ['Ruby', 'Kermit']), 'a new game starts with the two parrots on the list');
let added = G.petsSet(p, [{ sp: 'kermit', name: 'Kermit' }, { sp: 'cat', name: 'Mittens' }, { sp: 'dog', name: '' }], t);
ok(added.length === 2 && p.pets[1].name === 'Dog' && !p.npcs.some((x) => x.id === 'ruby') && p.npcs.find((x) => x.id === 'kermit'), 'the cat and dog are added (a dog with no name is Dog); no red parrot');
ok(p.house.items.some((i) => i.k === 'x_catbed' && i.id === p.pets[0].item) && p.house.items.some((i) => i.k === 'x_kennel'), 'each gets its home, free and put out');
ok(G.petOfItem(p, p.pets[0].item).name === 'Mittens', 'and the animal by its home is them');
ok(p.quests.some((q) => q.home === 'birds' && !q.archived && q.name === 'Feed the pets') && G.HOME.birds.name === 'Feeding the animals', 'feeding is for the pets now: ' + G.HOME.birds.name);
ok(/^Kermit, Mittens and Dog would like breakfast/.test(G.AFFLICT.birds.lore), 'the lore names them: ' + G.AFFLICT.birds.lore);
p = G.normalize(JSON.parse(JSON.stringify(p)), t);
ok(p.pets.length === 2 && p.pets[0].item, 'they keep through a reload');
let q0 = G.normalize(null, t);
G.petsSet(q0, [], t);
ok(!q0.npcs.some((x) => x.kind === 'bird') && !q0.quests.some((q) => (q.home === 'birds' || q.home === 'aviary') && !q.archived), 'no pets: no birds, and no feeding or aviary chores');
ok(G.AFFLICT.birds.lore.indexOf('Ruby') < 0 && G.AFFLICT.lawn.lore === 'The grass is getting long.', 'and the lore stops mentioning Ruby and Kermit');
const jake = fs.existsSync('/tmp/jake/save2.json') ? G.normalize(JSON.parse(fs.readFileSync('/tmp/jake/save2.json', 'utf8')), t) : null;   // his own save, when it's here
if (jake && jake.npcs.some((x) => x.id === 'ruby')) {
  const before = JSON.stringify(jake.quests.map((q) => q.name));
  G.petsSet(jake, G.petsList(jake), t);
  ok(JSON.stringify(jake.quests.map((q) => q.name)) === before && G.AFFLICT.birds.lore === 'Ruby and Kermit would like breakfast. They have mentioned it.', 'saving the pets step unchanged changes nothing in his save');
}
const named = G.normalize(null, t);
G.petsSet(named, [{ sp: 'ruby', name: 'Scarlet' }, { sp: 'kermit', name: 'Kermit' }], t);
ok(named.npcs.find((x) => x.id === 'ruby').name === 'Scarlet' && G.BIRD_NOW.ruby === 'Scarlet', 'a parrot can be called something else');

// ---- New Game+ ----
const g = G.normalize(null, t);
g.hero.name = 'Jake';
G.petsSet(g, [{ sp: 'cat', name: 'Mittens' }], t);
g.people.push(G.personNorm({ id: 'p9', name: 'Emma', age: 'kid', look: G.randomLook() }));
g.peopleNo.sarah = 'no';
const ng = G.newGamePlus(g, t);
ok(ng.people.length === 1 && ng.peopleNo.sarah === 'no' && ng.pets.length === 1 && ng.pets[0].item && ng.house.items.some((i) => i.k === 'x_catbed' && i.id === ng.pets[0].item), 'New Game+ keeps the people and the pets, and gives the cat its basket back');
ok(!ng.npcs.some((x) => x.kind === 'bird'), 'and no parrots turn up that weren’t there');

console.log(n + ' checks, ' + fails + ' failed');
if (fails) process.exit(1);
