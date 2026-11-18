/* Grindstone — 2.26: people from the calendar, and pets.
 * Calendar titles like "Paul's birthday", "Mum & Dad's anniversary", "Dinner with Sarah" or "Emma's 5th birthday" name
 * people. Each name is offered once; the ones Jake designs turn up at the house ahead of their events (as far ahead as
 * he says), and a few one-off to-dos follow the big ones ("Organise Emma's birthday"). Kids and little ones too: they
 * never delve, they just potter about. Pets are named at the start: the two parrots, and any other animals (each with a
 * free home of its own). Pure logic: the phone reads the calendar; app.js draws it. */
(function (root) {
  'use strict';
  const G = root.G;
  if (!G) return;
  const { today, addDays, daysBetween } = G;

  // ---------- reading titles ----------
  // Family words count as names (capitalised as they're usually written).
  const REL = {
    mum: 'Mum', mom: 'Mom', mother: 'Mum', dad: 'Dad', father: 'Dad', nan: 'Nan', nana: 'Nana', nanna: 'Nanna', pop: 'Pop', poppy: 'Poppy',
    grandma: 'Grandma', grandpa: 'Grandpa', gran: 'Gran', granny: 'Granny', grandad: 'Grandad', granddad: 'Granddad', aunty: 'Aunty', auntie: 'Auntie',
    aunt: 'Aunt', uncle: 'Uncle', sis: 'Sis', bro: 'Bro',
  };
  // Capitalised words that aren't people.
  const STOP = new Set(('work shift team staff meeting meetings school office class lesson doctor dr dentist physio gp vet appointment appt '
    + 'christmas xmas easter australia anzac new year years halloween mothers fathers valentines the a an my our your their his her family '
    + 'everyone friends mates boys girls kids church gym birthday birthdays party dinner lunch breakfast brunch coffee drinks catch up call '
    + 'zoom teams movie movies date night day trip holiday holidays leave rdo training course exam assessment cert iv tafe uni college resi '
    + 'roster sleepover bbq footy cricket netball soccer basketball swimming swim run race parkrun market markets shopping groceries '
    + 'monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri sat sun today tomorrow tonight '
    + 'january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec '
    + 'pick drop off reminder todo to-do deadline due bin bins rent bills me myself i us we them it this that someone somebody people others '
    + 'house home town city beach park pool library hospital clinic centre center hall club pub restaurant cafe bar').split(' '));
  const BDAY = '(?:birthday|bday|b-day|b[\'’]day|birthdays)';
  const PARTY = 'wedding|engagement(?: party)?|graduation|farewell|going[- ]away(?: party)?|hens?(?: night| party| do)?|bucks?(?: night| party| do)?|baby shower|christening|baptism|housewarming|party|recital|concert|assembly|presentation|award(?:s)? night|play|game|match|carnival|sports day|naming day|celebration|funeral|wake|memorial';
  const RX = [
    // birthdays
    [new RegExp('^(.+?)[\'’‘]?s?\\s+(\\d{1,3})(?:st|nd|rd|th)\\s+' + BDAY + '\\b', 'i'), 'birthday', 2],
    [new RegExp('^(.+?)[\'’‘]s\\s+' + BDAY + '\\b', 'i'), 'birthday'],
    [new RegExp('^(.+?)\\s+turns\\s+(\\d{1,3})\\b', 'i'), 'birthday', 2],
    [new RegExp('^(?:happy\\s+)?' + BDAY + '\\s*(?:[:\\-–—]|for|to)\\s*(.+)$', 'i'), 'birthday'],
    [new RegExp('^happy\\s+' + BDAY + '\\s+(.+)$', 'i'), 'birthday'],
    [new RegExp('^(.+?)\\s+' + BDAY + '$', 'i'), 'birthday'],
    // anniversaries
    [/^(.+?)['’‘]s?\s+(?:\d{1,3}(?:st|nd|rd|th)\s+)?(?:wedding\s+)?anniversary\b/i, 'anniversary'],
    [/^(?:wedding\s+)?anniversary\s*(?:[:\-–—]|for)\s*(.+)$/i, 'anniversary'],
    // their do
    [new RegExp('^(.+?)[\'’‘]s\\s+((?:[a-z]+\\s+)?(?:' + PARTY + '))\\b', 'i'), 'party', 0, 1, 2],
    [new RegExp('^(' + PARTY + ')\\s*(?:[:\\-–—]|for|of)\\s*(.+)$', 'i'), 'party', 0, 2, 1],
    // visits
    [/^(.+?)\s+(?:visiting|visits|staying(?: over)?|arrives?|arriving|coming(?: over| to stay| down| up)?|in town|flies in|flying in|here|visit)\b/i, 'visit'],
    [/^(?:visit|visitors?|guests?)\s*(?:[:\-–—]|from)\s*(.+)$/i, 'visit'],
    // seeing someone
    [/\b(?:with|w\/)\s+(.+)$/i, 'catchup'],
    [/^(?:catch[- ]?up|coffee|lunch|dinner|drinks|brunch|breakfast|call|facetime)\s*[:\-–—]\s*(.+)$/i, 'catchup'],
  ];
  const BIG = { birthday: 1, anniversary: 1, party: 1, visit: 1 };
  const EV_ICON = { birthday: '🎂', anniversary: '💐', party: '🎉', visit: '🧳', catchup: '☕' };
  const title1 = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  // "Paul", "Mum and Dad", "Sarah & Tom Smith" -> names, or [] if it doesn't read as people.
  function namesIn(frag) {
    frag = String(frag || '').replace(/[\u{1F000}-\u{1FFFF}☀-➿]/gu, ' ').replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/\s+[-–—|]\s+.*$/, '').replace(/\s+(?:re|about|regarding|at|@|in|on|from|to|for)\s+.*$/i, '').replace(/[!?.:;"“”]+/g, ' ').trim();
    if (!frag || frag.length > 60) return [];
    const parts = frag.split(/\s*(?:,|&|\+|\/|\band\b|\bn\b)\s*/i).map((x) => x.trim()).filter(Boolean);
    const out = [];
    for (let p of parts) {
      p = p.replace(/^(?:my|our|the|little|baby)\s+/i, '').replace(/['’‘]s$/i, '').trim();
      const ws = p.split(/\s+/);
      if (!ws.length || ws.length > 3) return [];
      if (ws.length === 1 && REL[ws[0].toLowerCase()]) { out.push(REL[ws[0].toLowerCase()]); continue; }
      // "Aunty Sue", "Uncle Rob"
      if (ws.length === 2 && REL[ws[0].toLowerCase()] && /^[A-Z]/.test(ws[1])) { out.push(REL[ws[0].toLowerCase()] + ' ' + ws[1]); continue; }
      if (STOP.has(ws[0].toLowerCase().replace(/['’‘]s$/, ''))) return [];
      if (!ws.every((w) => /^[A-ZÀ-ɏ][\p{L}'’\-]*$/u.test(w) && !STOP.has(w.toLowerCase()))) return [];
      if (ws.some((w) => w.length > 1 && w === w.toUpperCase() && w.length <= 4 && /[A-Z]{2}/.test(w))) return [];   // RC, O/N, RDO: roster codes
      out.push(ws.join(' '));
    }
    return out.slice(0, 4);
  }
  // A calendar title -> { names, kind, what, age } or null.
  function calParse(title) {
    const t = String(title || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 90) return null;
    for (const r of RX) {
      const m = t.match(r[0]);
      if (!m) continue;
      const frag = m[r[3] || 1], names = namesIn(frag);
      if (!names.length) continue;
      const o = { names: names, kind: r[1], what: r[1] };
      if (r[2]) { const a = +m[r[2]]; if (a >= 0 && a < 120) o.age = a; }
      if (r[1] === 'party') o.what = String(m[r[4] || 2] || m[1]).toLowerCase();
      return o;
    }
    return null;
  }
  const nameKey = (n) => String(n || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

  // Events from the phone ([{t, s, e, a}], all-day ones in UTC) -> the ones that name people, by day.
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const localDay = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
  function calDigest(evs, t) {
    t = t || today();
    const out = [], seen = {};
    (Array.isArray(evs) ? evs : []).forEach((e) => {
      if (!e || typeof e.t !== 'string' || typeof e.s !== 'number') return;
      const p = calParse(e.t);
      if (!p) return;
      const d = e.a ? utcDay(e.s) : localDay(e.s);
      let end = e.e > e.s ? (e.a ? utcDay(e.e - 1) : localDay(e.e - 1)) : d;
      if (end < d) end = d;
      if (daysBetween(d, end) > 21) end = addDays(d, 21);
      if (end < addDays(t, -1) || daysBetween(t, d) > 400) return;
      const k = d + '|' + p.kind + '|' + p.names.map(nameKey).join('+');
      if (seen[k]) return;
      seen[k] = 1;
      out.push(Object.assign({ d: d, end: end, t: e.t.slice(0, 80) }, p));
    });
    return out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)).slice(0, 600);
  }

  // ---------- people ----------
  const LEADS = [0, 1, 3, 7, 14];
  const MODES = ['events', 'always', 'never'];
  const AGES = ['adult', 'kid', 'baby'];
  function personNorm(p, s) {
    if (!p || typeof p !== 'object' || !p.id) return null;
    const o = { id: String(p.id).slice(0, 24), name: String(p.name || 'Someone').slice(0, 24) };
    o.also = (Array.isArray(p.also) ? p.also : []).map((x) => String(x).slice(0, 24).trim()).filter(Boolean).slice(0, 6);
    o.look = G.normLook(p.look || G.randomLook());
    const age = AGES.indexOf(p.age) >= 0 ? p.age : AGES.indexOf(o.look.age) >= 0 ? o.look.age : 'adult';
    o.age = age;
    if (age === 'adult') delete o.look.age; else o.look.age = age;
    o.garb = G.GARB[p.garb] ? p.garb : 'plain';
    o.hat = G.HATS[p.hat] ? p.hat : 'none';
    o.about = String(p.about || '').slice(0, 60);
    const c = p.cal && typeof p.cal === 'object' ? p.cal : {};
    o.cal = { mode: MODES.indexOf(c.mode) >= 0 ? c.mode : 'events', lead: LEADS.indexOf(c.lead) >= 0 ? c.lead : 7, which: c.which === 'any' ? 'any' : 'big', todos: c.todos !== false };
    o.joined = typeof p.joined === 'string' ? p.joined : today();
    return o;
  }
  function peopleNorm(s, t) {
    const ids = {};
    s.people = (Array.isArray(s.people) ? s.people : []).map((p) => personNorm(p, s)).filter((p) => p && !ids[p.id] && (ids[p.id] = 1)).slice(0, 40);
    if (!s.peopleNo || typeof s.peopleNo !== 'object') s.peopleNo = {};   // name key -> 'no' (not a person), or the day 'not now' ends
    Object.keys(s.peopleNo).forEach((k) => { const v = s.peopleNo[k]; if (v !== 'no' && !(typeof v === 'string' && v >= t)) delete s.peopleNo[k]; });
    if (!s.calPeople || typeof s.calPeople !== 'object' || !Array.isArray(s.calPeople.evs)) s.calPeople = { at: 0, evs: [] };
    s.calPeople.evs = s.calPeople.evs.filter((e) => e && e.end >= addDays(t, -1));
    if (!s.calTodo || typeof s.calTodo !== 'object') s.calTodo = {};
    Object.keys(s.calTodo).forEach((k) => { const v = s.calTodo[k]; if (!v || typeof v !== 'object' || !(v.d >= addDays(t, -60))) delete s.calTodo[k]; });
    petsNorm(s);
  }
  // Which person a name in the calendar means: their name or another they go by; a first name will do if only one fits.
  function personFor(s, name) {
    const k = nameKey(name);
    const exact = s.people.find((p) => nameKey(p.name) === k || p.also.some((a) => nameKey(a) === k));
    if (exact) return exact;
    const first = k.split(' ')[0];
    const loose = s.people.filter((p) => nameKey(p.name).split(' ')[0] === first && (k.indexOf(' ') > 0 || nameKey(p.name).indexOf(' ') > 0));
    return loose.length === 1 ? loose[0] : null;
  }
  const notPeople = (s) => {
    const no = new Set([nameKey(s.hero && s.hero.name)]);
    (s.npcs || []).forEach((n) => { if (n.kind === 'bird') no.add(nameKey(n.name)); });
    (s.pets || []).forEach((p) => no.add(nameKey(p.name)));
    return no;
  };
  // Names in the calendar that aren't anyone yet and haven't been waved off: [{ name, key, ev, n }]
  function peopleCandidates(s, t) {
    t = t || today();
    const no = notPeople(s), out = {}, order = [];
    s.calPeople.evs.forEach((e) => {
      if (e.end < t) return;
      e.names.forEach((nm) => {
        const k = nameKey(nm);
        if (no.has(k) || s.peopleNo[k] || personFor(s, nm)) return;
        if (!out[k]) { out[k] = { name: nm, key: k, ev: e, n: 0, age: null, big: false }; order.push(k); }
        if (BIG[e.kind] && !out[k].big) { out[k].big = true; out[k].ev = e; }   // shown by their first big day, if they have one
        out[k].n++;
        if (e.age != null && e.names.length === 1 && out[k].age == null) out[k].age = e.age - Math.max(0, Math.floor(daysBetween(t, e.d) / 365.25));
      });
    });
    return order.map((k) => out[k]).sort((a, b) => (b.big - a.big) || (a.ev.d < b.ev.d ? -1 : a.ev.d > b.ev.d ? 1 : 0));
  }
  const ageGuess = (a) => (a == null ? 'adult' : a < 3 ? 'baby' : a < 13 ? 'kid' : 'adult');
  const evsFor = (s, p) => s.calPeople.evs.filter((e) => e.names.some((nm) => personFor(s, nm) === p));
  // Their next event worth turning up for (by their settings), or null.
  function nextEventFor(s, p, t) {
    t = t || today();
    return evsFor(s, p).filter((e) => e.end >= t && (p.cal.which === 'any' || BIG[e.kind])).reduce((a, e) => (!a || e.d < a.d ? e : a), null);
  }
  // Who's at the house today: [{ p, ev, days }] (days until the event; negative while it's on).
  function visitorsNow(s, t) {
    t = t || today();
    const out = [];
    s.people.forEach((p) => {
      if (p.cal.mode === 'never') return;
      const ev = nextEventFor(s, p, t);
      if (p.cal.mode === 'always') { out.push({ p: p, ev: ev, days: ev ? daysBetween(t, ev.d) : null, lives: true }); return; }
      if (!ev) return;
      const days = daysBetween(t, ev.d);
      if (days <= p.cal.lead && t <= ev.end) out.push({ p: p, ev: ev, days: days });
    });
    return out.sort((a, b) => (a.days == null ? 999 : a.days) - (b.days == null ? 999 : b.days));   // soonest first
  }
  const fmtDay = (d) => { const x = new Date(d + 'T00:00'); return x.getDate() + ' ' + 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[x.getMonth()]; };
  const poss = (n) => n + (/s$/i.test(n) ? '’' : '’s');
  const joinNames = (ns, and) => (ns.length < 2 ? ns.join('') : ns.slice(0, -1).join(', ') + ' ' + (and || '&') + ' ' + ns[ns.length - 1]);
  function evWords(e, t) {
    t = t || today();
    const d = daysBetween(t, e.d), N = joinNames(e.names);
    const what = e.kind === 'birthday' ? poss(N) + ' birthday' + (e.age != null ? ' (' + e.age + ')' : '') : e.kind === 'anniversary' ? poss(N) + ' anniversary'
      : e.kind === 'party' ? poss(N) + ' ' + e.what : e.kind === 'visit' ? N + ' visiting' : 'Seeing ' + N;
    const when = d < 0 || (d === 0) ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' days';
    return { icon: EV_ICON[e.kind] || '📅', what: what, when: e.end >= t && d < 0 ? 'on now' : when, date: fmtDay(e.d) };
  }

  // ---------- the to-dos the calendar suggests ----------
  // Only for people Jake has designed, and only once each: deleting one is final.
  function todoPlans(s, e) {
    const ps = e.names.map((nm) => personFor(s, nm)).filter(Boolean);
    if (!ps.length || !ps.some((p) => p.cal.todos)) return [];
    const N = joinNames(e.names), kid = ps.some((p) => p.age !== 'adult'), dd = ' (' + fmtDay(e.d) + ')';
    if (e.kind === 'birthday') return kid
      ? [{ k: 'do', name: 'Organise ' + poss(N) + ' birthday' + dd, icon: '🎂', ahead: 21 }, { k: 'gift', name: 'Get ' + N + ' a present' + dd, icon: '🎁', ahead: 10 }]
      : [{ k: 'gift', name: 'Sort a present for ' + N + dd, icon: '🎁', ahead: 10 }];
    if (e.kind === 'anniversary') return [{ k: 'card', name: 'Something for ' + poss(N) + ' anniversary' + dd, icon: '💐', ahead: 7 }];
    if (e.kind === 'party') return [{ k: 'ready', name: 'Get ready for ' + poss(N) + ' ' + e.what + dd, icon: '🎉', ahead: /wedding/.test(e.what) ? 21 : 5 }];
    if (e.kind === 'visit') return [{ k: 'house', name: 'Get the house ready for ' + N + dd, icon: '🧹', ahead: 2 }];
    return [];
  }
  // Adds the ones that are due, takes away undone ones whose day has passed. Returns { added: [names], gone: n }.
  function calTodos(s, t) {
    t = t || today();
    const res = { added: [], gone: 0 };
    if (s.settings && s.settings.calTodos === false) return res;
    s.calPeople.evs.forEach((e) => {
      const days = daysBetween(t, e.d);
      if (days < 0) return;
      todoPlans(s, e).forEach((pl) => {
        const key = e.d + '|' + pl.k + '|' + e.names.map(nameKey).join('+');
        if (s.calTodo[key] || days > pl.ahead) return;
        const q = G.newQuest(s, { name: pl.name, icon: pl.icon, type: 'todo', stat: 'DIS', diff: 1 });
        q.cal = key;
        s.quests.push(q);
        s.calTodo[key] = { q: q.id, d: e.d };
        res.added.push(q.name);
      });
    });
    // the day's been and gone: an undone one just goes
    const before = s.quests.length;
    s.quests = s.quests.filter((q) => { if (!q.cal || q.doneOn) return true; const r = s.calTodo[q.cal]; return !(r && r.d < t); });
    res.gone = before - s.quests.length;
    return res;
  }

  // ---------- pets ----------
  // The parrots are Ruby and Kermit's birds (their art and their manners); the rest live in a home of their own.
  const PET_KINDS = {
    ruby: { n: 'Red parrot', i: '🦜', parrot: 1, blurb: 'An eclectus hen: red and purple, and sure of herself.' },
    kermit: { n: 'Green parrot', i: '🦜', parrot: 1, blurb: 'An eclectus cock: green, with a candy-corn beak.' },
    cat: { n: 'Cat', i: '🐈', furn: 'x_catbed' }, dog: { n: 'Dog', i: '🐕', furn: 'x_kennel' }, rabbit: { n: 'Rabbit', i: '🐇', furn: 'x_hutch' },
    chook: { n: 'Chook', i: '🐔', furn: 'x_coop' }, duck: { n: 'Duck', i: '🦆', furn: 'x_duckhouse' }, frog: { n: 'Frog', i: '🐸', furn: 'x_lilypot' },
  };
  const PET_MAX = 8;
  function petsNorm(s) {
    const ids = {};
    s.pets = (Array.isArray(s.pets) ? s.pets : []).filter((p) => p && PET_KINDS[p.sp] && !PET_KINDS[p.sp].parrot && p.id && !ids[p.id] && (ids[p.id] = 1))
      .map((p) => ({ id: String(p.id).slice(0, 24), sp: p.sp, name: String(p.name || PET_KINDS[p.sp].n).slice(0, 24), item: p.item | 0 || null })).slice(0, PET_MAX);
    petLabels(s);
  }
  const birdsOf = (s) => (s.npcs || []).filter((n) => n.kind === 'bird');
  const birdName = (s, id) => { const b = (s.npcs || []).find((n) => n.id === id); return b ? b.name : null; };
  // The words that name the animals follow whoever's actually there (one save at a time, so the shared labels can too).
  function petLabels(s) {
    G.BIRD_NOW = { ruby: birdName(s, 'ruby'), kermit: birdName(s, 'kermit') };
    const B = birdsOf(s).map((b) => b.name), P = (s.pets || []).map((p) => p.name), all = B.concat(P);
    const H = G.HOME && G.HOME.birds, A = G.AFFLICT && G.AFFLICT.birds, L = G.AFFLICT && G.AFFLICT.lawn;
    if (H) { H.name = !P.length ? 'Bird feeding' : B.length ? 'Feeding the animals' : 'Pet feeding'; H.icon = B.length || !P.length ? '🦜' : PET_KINDS[s.pets[0].sp].i; }
    if (A) { A.name = H ? H.name : A.name; A.lore = (all.length ? joinNames(all.length > 3 ? all.slice(0, 2).concat(['the rest']) : all, 'and') : 'The animals') + ' would like breakfast. ' + (all.length === 1 ? 'It’s been mentioned.' : 'They have mentioned it.'); }
    if (L) L.lore = 'The grass is getting long.' + (birdName(s, 'kermit') ? ' ' + birdName(s, 'kermit') + ' thinks it looks fine.' : '');
  }
  // Who lives here, for the pets step: [{ sp, name, id? }]
  function petsList(s) {
    return birdsOf(s).map((b) => ({ sp: b.id, name: b.name, id: b.id })).concat((s.pets || []).map((p) => ({ sp: p.sp, name: p.name, id: p.id })));
  }
  // The pets step's answer: [{ sp, name, id? }]. Parrots become the bird household; the rest get a home each, free.
  function petsSet(s, list, t) {
    t = t || today();
    list = (Array.isArray(list) ? list : []).filter((x) => x && PET_KINDS[x.sp]).slice(0, PET_MAX + 2);
    const parrots = {}, added = [];
    list.filter((x) => PET_KINDS[x.sp].parrot).forEach((x) => { if (!parrots[x.sp]) parrots[x.sp] = String(x.name || '').trim().slice(0, 24) || G.BIRDS[x.sp].name; });
    s.npcs = s.npcs.filter((n) => n.kind !== 'bird' || parrots[n.id]);
    Object.keys(parrots).forEach((k) => {
      const b = s.npcs.find((n) => n.id === k);
      if (b) b.name = parrots[k];
      else s.npcs.push({ id: k, kind: 'bird', name: parrots[k], home: 'aviary', status: 'resident', joined: t });
    });
    const keep = [];
    list.filter((x) => !PET_KINDS[x.sp].parrot).slice(0, PET_MAX).forEach((x) => {
      const was = x.id && (s.pets || []).find((p) => p.id === x.id && p.sp === x.sp);
      const name = String(x.name || '').trim().slice(0, 24) || PET_KINDS[x.sp].n;
      if (was) { was.name = name; keep.push(was); return; }
      const p = { id: 'pet' + G.nextId(s), sp: x.sp, name: name, item: null };
      // a home of its own, given
      const k = PET_KINDS[x.sp].furn;
      s.house.bought[k] = (s.house.bought[k] | 0) + 1;
      if (G.houseAuto(s, k, null, null)) p.item = s.house.seq;
      keep.push(p);
      added.push(p);
    });
    s.pets = keep;
    // the chores follow: no parrots, no aviary to clean or birds to feed (feeding goes to the pets, if there are any)
    const hasBirds = Object.keys(parrots).length > 0, any = hasBirds || keep.length > 0;
    s.quests.forEach((q) => {
      if (q.archived) return;
      if (q.home === 'aviary' && !hasBirds) q.archived = true;
      if (q.home === 'birds') {
        if (!any) q.archived = true;
        else if (keep.length && /^Feed/.test(q.name) && !/pets|animals/i.test(q.name)) q.name = 'Feed the pets';   // only when the old name stops fitting
        else if (!keep.length && q.name === 'Feed the pets') q.name = 'Feed the birds';
        else if (!keep.length && /^Feed & water /.test(q.name)) q.name = 'Feed & water ' + joinNames(Object.keys(parrots).map((k) => parrots[k]), 'and');
      }
    });
    if (any && !s.quests.some((q) => q.home === 'birds' && !q.archived)) {
      const q = G.newQuest(s, { name: hasBirds && !keep.length ? 'Feed the birds' : 'Feed the pets', icon: '🥣', type: 'daily', stat: 'DIS', diff: 1, home: 'birds' });
      s.quests.push(q);
    }
    s.petsSet = true;
    petLabels(s);
    return added;
  }
  const petOfItem = (s, item) => (s.pets || []).find((p) => p.item === item) || null;

  Object.assign(G, {
    calParse: calParse, namesIn: namesIn, nameKey: nameKey, calDigest: calDigest, peopleNorm: peopleNorm, personNorm: personNorm, personFor: personFor,
    peopleCandidates: peopleCandidates, ageGuess: ageGuess, evsFor: evsFor, nextEventFor: nextEventFor, visitorsNow: visitorsNow, evWords: evWords,
    todoPlans: todoPlans, calTodos: calTodos, PEOPLE_LEADS: LEADS, EV_ICON: EV_ICON, BIG_EVENTS: BIG, fmtDay: fmtDay, joinNames: joinNames,
    PET_KINDS: PET_KINDS, PET_MAX: PET_MAX, petsNorm: petsNorm, petsList: petsList, petsSet: petsSet, petLabels: petLabels, petOfItem: petOfItem, birdName: birdName,
  });
})(typeof window !== 'undefined' ? window : globalThis);
