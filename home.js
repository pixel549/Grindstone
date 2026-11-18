/* Grindstone — the home base. A side-on cottage whose state mirrors your real chores,
 * with the hero wandering between rooms and reacting to what's going on. */
(function (root) {
  'use strict';
  const W = 1920, HT = 300, FL = 250;
  const ROOMS = [
    { k: 'yard', name: 'Yard', x0: 0, x1: 385 },
    { k: 'aviary', name: 'Aviary', x0: 385, x1: 560 },
    { k: 'kitchen', name: 'Kitchen', x0: 560, x1: 860 },
    { k: 'living', name: 'Lounge', x0: 860, x1: 1180 },
    { k: 'study', name: 'Study', x0: 1180, x1: 1400 },
    { k: 'bedroom', name: 'Bedroom', x0: 1400, x1: 1640 },
    { k: 'gym', name: 'Gym', x0: 1640, x1: 1920 },
  ];
  const shade = (h, f) => Art.shade(h, f);
  function seeded(n) { let s = n * 9301 + 49297; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

  // ---------- activities ----------
  const ACTS = {
    chill: { x: 238, pose: 'sit', y: -4, dir: 1, anim: 'chill', dur: [10, 18] },
    lawn: { x: 168, dir: 1, anim: 'hips', dur: [5, 8] },
    birds: { x: 418, dir: 1, anim: 'wave', dur: [6, 10] },
    fridge: { x: 684, dir: -1, anim: 'fridge', dur: [5, 8] },
    sink: { x: 772, dir: -1, anim: 'look', dur: [5, 8] },
    cook: { x: 790, dir: 1, anim: 'cook', dur: [8, 13] },
    couch: { x: 985, pose: 'sit', y: -14, anim: 'tv', dur: [10, 18] },
    reno: { x: 1136, dir: 1, anim: 'hammer', dur: [7, 11] },
    shelf: { x: 1264, dir: -1, anim: 'reach', dur: [4, 7] },
    desk: { x: 1318, pose: 'sit', y: -8, anim: 'read', dur: [9, 15] },
    bed: { x: 1499, pose: 'lie', y: -36, dir: 1, anim: 'sleep', dur: [8, 12] },
    laundry: { x: 1546, dir: 1, anim: 'rummage', dur: [5, 8] },
    lift: { x: 1728, anim: 'squat', dur: [8, 12] },
    bag: { x: 1852, dir: 1, anim: 'punch', dur: [6, 10] },
    wander: { x: 0, anim: 'look', dur: [3, 6] },
  };
  const REACT = { lawn: 'lawn', fridge: 'cook', dishes: 'sink', laundry: 'laundry', birds: 'birds', aviary: 'birds', reno: 'reno', gym: 'lift', study: 'desk' };
  const HAPPY = {
    lawn: 'Ahh. Fresh-cut grass.', fridge: 'Fridge is FULL. Feast time.', dishes: 'Sparkling.', laundry: 'Fresh shirt. Life is good.',
    birds: 'Happy birds, happy life.', aviary: 'Spotless. For now.', reno: 'Measure twice, cut once.', gym: 'Feel the burn.', study: 'Knowledge!',
  };

  function quip(act, H) {
    const st = (k) => (H[k] ? H[k].state : 0);
    const L = {
      chill: st('lawn') === 2 ? ['Nature’s winning.', 'Pretty sure I saw a snake.', 'It’s a meadow now. On purpose.'] : st('lawn') === 1 ? ['Grass is getting cheeky.', 'I should mow. Later.'] : ['Lovely bit of lawn.', 'This is the life.'],
      lawn: ['Look at those stripes.'],
      birds: (() => { const B = (root.G && root.G.BIRD_NOW) || { ruby: 'Ruby', kermit: 'Kermit' }, k = B.kermit, r = B.ruby, any = k || r;   // 2.26: whoever's actually there
        return st('birds') === 2 ? ['They’re plotting against me.'].concat(k ? [k + '’s giving me the look.'] : [], r ? [r + ' wants breakfast. Loudly.'] : []) : st('birds') === 1 ? ['Someone’s peckish.'] : st('aviary') === 2 && any ? ['That aviary needs a hose.'] : any ? ['Who’s a pretty bird?'].concat(k && r ? ['Morning, you two.'] : []) : ['Breakfast’s coming.']; })(),
      fridge: st('fridge') === 2 ? ['Mustard. Again.', 'Just me and this jar.', 'Hello? Food?'] : st('fridge') === 1 ? ['Running a bit low…'] : ['So many options.'],
      sink: st('dishes') === 2 ? ['It moved.', 'That’s a science project now.'] : st('dishes') === 1 ? ['I’ll do them later. Probably.'] : ['Sparkling.'],
      cook: ['Something’s cooking!', 'Chef’s kiss.'],
      couch: ['Just resting my eyes.', 'One more episode.'],
      reno: ['Where’d I put the hammer?', 'Measure twice, cut once.'],
      shelf: ['Now where was that book…'],
      desk: st('study') === 2 ? ['Brain’s on holiday.'] : ['Just one more chapter.', 'Knowledge!'],
      bed: ['Zzz…'],
      laundry: st('laundry') === 2 ? ['Smells… fine. Mostly.', 'I’m out of socks.'] : st('laundry') === 1 ? ['Washing’s piling up.'] : ['Fresh shirt. Life is good.'],
      lift: st('gym') === 2 ? ['Do I even lift?', 'The cobwebs are getting gains.'] : ['One more rep.', 'Feel the burn.'],
      bag: ['Take that, procrastination.'],
      wander: ['Hmm.', 'What was I doing?', 'Right then.'],
    }[act] || (DACTS[act] && DACTS[act].quips) || ['…'];
    return L[Math.floor(Math.random() * L.length)];
  }

  function weights(H, ctx) {
    const st = (k) => (H[k] ? H[k].state : 0);
    return [
      ['chill', st('lawn') === 2 ? 9 : st('lawn') === 1 ? 2.5 : ctx.day ? 2 : 0.6],
      ['lawn', H.lawn && H.lawn.linked && st('lawn') === 0 ? 1.2 : 0],
      ['birds', st('birds') === 2 ? 7 : st('birds') === 1 || st('aviary') === 2 ? 3 : 1.6],
      ['fridge', st('fridge') === 2 ? 8 : st('fridge') === 1 ? 3 : 0.6],
      ['cook', st('fridge') === 0 ? 2.5 : 0],
      ['sink', st('dishes') === 2 ? 5 : st('dishes') === 1 ? 2 : 0.4],
      ['couch', 3],
      ['reno', H.reno && H.reno.recent ? 4 : H.reno && H.reno.stage < 5 ? 0.8 : 0],
      ['shelf', 0.7],
      ['desk', H.study && H.study.today ? 5 : st('study') === 2 ? 0.3 : 1.4],
      ['bed', ctx.sleepy ? 16 : 0.3],
      ['laundry', st('laundry') === 2 ? 6 : st('laundry') === 1 ? 2.5 : 0.3],
      ['lift', H.gym && H.gym.today ? 5 : st('gym') === 2 ? 0.3 : 1.2],
      ['bag', H.gym && H.gym.today ? 2.5 : st('gym') === 2 ? 0.2 : 0.7],
      ['wander', 1.4],
    ].concat(Object.keys(DACTS).map((id) => { const a = DACTS[id]; return [id, a.w * (ctx.night && a.night ? a.night : 1)]; }));
  }

  // ---------- furniture ----------
  const SLOT_POS = { yardA: [150, FL], yardB: [286, FL], loungeF: [891, FL], loungeW: [905, 124], studyF: [1274, FL], studyW: [1360, 124], bedW: [1515, 126], gymF: [1665, FL], gymW: [1712, 124] };
  const leaf = (x) => `<path d="M${x},-11 v-6 q-4,-2 -5,-6 q4,1 5,6 q1,-5 5,-6 q-1,4 -5,6" fill="#5aa04a" stroke="#4a8a3a" stroke-width=".6"/>`;
  // 2.23: the statues (in the house they're drawn from the hero's own sprite; this is their picture in the relics list)
  const STATUE = (gold) => `<rect x="-14" y="-8" width="28" height="8" fill="${gold ? '#7a5a1e' : '#5c5a58'}"/><rect x="-12" y="-11" width="24" height="3" fill="${gold ? '#c9a24a' : '#9a9894'}"/><g fill="${gold ? '#d9b04a' : '#a8a6a2'}"><circle cx="0" cy="-58" r="6"/><rect x="-7" y="-51" width="14" height="22" rx="3"/><rect x="-11" y="-50" width="4" height="16" rx="2"/><rect x="7" y="-50" width="4" height="16" rx="2"/><rect x="-6" y="-30" width="5" height="19"/><rect x="1" y="-30" width="5" height="19"/></g>`;
  const DECOR_ART = {
    victor: () => STATUE(true),
    legacy1: () => STATUE(false), legacy2: () => STATUE(false), legacy3: () => STATUE(false), legacy4: () => STATUE(false), legacy5: () => STATUE(false), legacy6: () => STATUE(false),
    flamingo: () => '<path d="M0,0 V-14 M-2.5,0 L0,-7" stroke="#333" stroke-width="1"/><ellipse cx="0" cy="-17" rx="7" ry="4.5" fill="#f26aa0"/><path d="M4,-18 C8,-24 2,-30 4,-34" stroke="#f26aa0" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="4.5" cy="-34" r="2.3" fill="#f26aa0"/><path d="M6.5,-34.5 l3.5,1.8 -2.5,1Z" fill="#222"/>',
    plant: () => '<path d="M-8,0 L-10,-14 H10 L8,0Z" fill="#b0603a"/><g fill="#3f8a3e"><ellipse cx="-7" cy="-26" rx="6" ry="11" transform="rotate(-30 -7 -26)"/><ellipse cx="7" cy="-28" rx="6" ry="11" transform="rotate(28 7 -28)"/><ellipse cx="0" cy="-36" rx="5.5" ry="10" fill="#4f9a4a"/></g><path d="M0,-14 V-42 M-2,-16 L-8,-31 M2,-16 L8,-33" stroke="#2f6a2e" stroke-width="1"/>',
    floorlamp: (S, lit) => `${lit ? '<circle cx="0" cy="-54" r="30" fill="url(#hGlow)"/>' : ''}<rect x="-6" y="-3" width="12" height="3" rx="1" fill="#333"/><rect x="-1" y="-58" width="2" height="56" fill="#444"/><path d="M-9,-56 L-6,-70 H6 L9,-56Z" fill="${lit ? '#fff2c8' : '#e8d8b0'}"/>`,
    map: () => '<rect x="-23" y="-16" width="46" height="32" rx="2" fill="#d8c49a" stroke="#8a6a3a" stroke-width="1.5"/><path d="M-18,6 C-12,-2 -6,4 -2,-4 C2,-10 8,-6 12,-12 M-14,-8 C-10,-12 -6,-10 -4,-14" stroke="#6b8aa0" stroke-width="1.4" fill="none"/><path d="M8,4 l4,4 M12,4 l-4,4" stroke="#c0392b" stroke-width="1.6"/><circle cx="-12" cy="8" r="4" fill="none" stroke="#8a6a3a" stroke-width=".8"/><path d="M-12,4 V12 M-16,8 H-8" stroke="#8a6a3a" stroke-width=".6"/>',
    vegpatch: () => `<rect x="-22" y="-10" width="44" height="10" fill="#7a5233"/><rect x="-22" y="-12" width="44" height="3" fill="#5a3a22"/><rect x="-20" y="-11" width="40" height="2.5" fill="#3d2a1c"/>${[-15, -7, 1, 9, 16].map(leaf).join('')}<path d="M-11,-11 l-1,-5 M-11,-11 l1,-5" stroke="#5aa04a" stroke-width="1"/>`,
    mountedfish: () => '<path d="M-16,-11 H16 L21,0 L16,11 H-16 L-21,0Z" fill="#6b4a31"/><path d="M-14,0 C-8,-8 6,-8 10,0 C6,8 -8,8 -14,0Z" fill="#6a9a8a"/><path d="M10,0 L18,-6 L16,0 L18,6Z" fill="#5a8a7a"/><circle cx="-9" cy="-1.5" r="1.3" fill="#111"/><path d="M-14,0 l3,1.5" stroke="#2a3a3a" stroke-width="1"/>',
    firepit: (S, lit) => `${lit ? '<circle cx="0" cy="-12" r="38" fill="#ff9a3a" opacity=".18"/>' : ''}<ellipse cx="0" cy="-3" rx="20" ry="5" fill="#6b6b70"/><ellipse cx="0" cy="-4" rx="15" ry="3.5" fill="#2a1a10"/><path d="M-12,-5 L10,-10 M-10,-10 L12,-5" stroke="#5a3d28" stroke-width="3.5" stroke-linecap="round"/><g class="flame"><path d="M-7,-7 C-9,-16 -2,-18 0,-28 C2,-18 9,-16 7,-7Z" fill="#f2a33a"/><path d="M-3.5,-7 C-4,-12 0,-14 0,-20 C1,-14 4,-12 3.5,-7Z" fill="#ffe08a"/></g>`,
    shield: () => '<path d="M-15,-18 H15 V-2 C15,10 6,16 0,20 C-6,16 -15,10 -15,-2Z" fill="#2a4a8a"/><path d="M-15,-18 H0 V-2 H-15Z M0,-2 H15 C15,10 6,16 0,20Z" fill="#a82a2a"/><path d="M-15,-18 H15 V-2 C15,10 6,16 0,20 C-6,16 -15,10 -15,-2Z" fill="none" stroke="#c9a24a" stroke-width="2"/><path d="M0,-18 V20 M-15,-2 H15" stroke="#c9a24a" stroke-width="1.2"/>',
    armchair: () => '<rect x="-20" y="-24" width="8" height="20" rx="3" fill="#2f5a46"/><rect x="12" y="-24" width="8" height="20" rx="3" fill="#2f5a46"/><path d="M-16,-18 C-18,-40 -10,-46 0,-46 C10,-46 18,-40 16,-18Z" fill="#3a6b55"/><path d="M-16,-30 C-21,-36 -20,-42 -14,-42 M16,-30 C21,-36 20,-42 14,-42" stroke="#2f5a46" stroke-width="4" fill="none"/><rect x="-16" y="-17" width="32" height="11" rx="3" fill="#447a62"/><rect x="-18" y="-6" width="36" height="4" fill="#2f5a46"/><rect x="-16" y="-2" width="3" height="2" fill="#3b2a20"/><rect x="13" y="-2" width="3" height="2" fill="#3b2a20"/>',
    guitar: () => '<path d="M-6,0 L0,-12 L6,0 M0,-12 V-26" stroke="#333" stroke-width="1.5" fill="none"/><g class="gtr"><path d="M0,-48 V-26" stroke="#5a3d28" stroke-width="2.5"/><rect x="-2" y="-52" width="4" height="5" rx="1" fill="#3b2a20"/><circle cx="0" cy="-21" r="7" fill="#c07a3a"/><circle cx="0" cy="-11" r="8.5" fill="#c07a3a"/><circle cx="0" cy="-17" r="2.4" fill="#2a1a10"/><rect x="-3" y="-10" width="6" height="1.6" fill="#2a1a10"/></g>',
    record: () => '<rect x="-15" y="-24" width="30" height="24" fill="#6b4a31"/><rect x="-12" y="-20" width="24" height="16" fill="#5a3d28"/><circle cx="-5" cy="-12" r="4" fill="#3b2a20"/><circle cx="5" cy="-12" r="4" fill="#3b2a20"/><rect x="-15" y="-28" width="30" height="4" fill="#2a2a2e"/><g class="disc"><ellipse cx="-2" cy="-30" rx="10" ry="2.6" fill="#111"/><ellipse cx="-2" cy="-30" rx="3" ry=".9" fill="#c0392b"/></g><path d="M10,-28 L10,-33 L4,-31" stroke="#aaa" stroke-width="1" fill="none"/><g class="notes"><text x="-8" y="-38">♪</text><text x="4" y="-44">♫</text></g>',
    fishtank: () => '<rect x="-19" y="-16" width="38" height="16" fill="#3b2a20"/><path d="M-19,-8 H19" stroke="#2a1d14"/><rect x="-20" y="-44" width="40" height="28" rx="1.5" fill="#5aa0c8" opacity=".85"/><rect x="-19" y="-19" width="38" height="2.5" fill="#d8c8a0"/><path d="M-16,-17 q3,-9 5,0 M11,-17 q2,-11 5,0" stroke="#3a8a3a" stroke-width="1.6" fill="none"/><g class="fish f1"><path d="M-10,-33 c3,-3 7,-3 9,0 c-2,3 -6,3 -9,0z M-10,-33 l-3,-2.5 v5z" fill="#f28a2a"/></g><g class="fish f2"><path d="M2,-26 c2.5,-2.5 6,-2.5 7.5,0 c-1.5,2.5 -5,2.5 -7.5,0z M2,-26 l-2.5,-2 v4z" fill="#f2d24a"/></g><g class="fish f3"><path d="M-4,-38 c2,-2 5,-2 6,0 c-1,2 -4,2 -6,0z M-4,-38 l-2,-1.6 v3.2z" fill="#e85a8a"/></g><circle class="bub" cx="12" cy="-22" r="1.2" fill="#dff"/><rect x="-20" y="-44" width="40" height="28" rx="1.5" fill="none" stroke="#cfd6de" stroke-width="1.2"/><rect x="-20" y="-46" width="40" height="3" fill="#333"/>',
    telescope: () => '<path d="M0,-24 L-10,0 M0,-24 L10,0 M0,-24 L0,0" stroke="#5a3d28" stroke-width="1.8"/><g transform="translate(0,-27) rotate(-35)"><rect x="-14" y="-3.5" width="28" height="7" rx="2" fill="#c9a24a"/><rect x="12" y="-4.5" width="4" height="9" rx="1" fill="#8a6a2a"/><rect x="-17" y="-2" width="4" height="4" fill="#5a4a2a"/></g>',
    neon: () => '<rect x="-24" y="-11" width="48" height="22" rx="4" fill="#1a1420"/><g class="neon"><text x="0" y="5" text-anchor="middle" font-size="13" font-weight="800" font-family="sans-serif" fill="none" stroke="#ff5ac8" stroke-width="4" opacity=".3">GRIND</text><text x="0" y="5" text-anchor="middle" font-size="13" font-weight="800" font-family="sans-serif" fill="none" stroke="#ffb0e8" stroke-width="1.1">GRIND</text></g>',
    portrait: (S) => `<rect x="-17" y="-20" width="34" height="40" rx="2" fill="#c9a24a"/><rect x="-14" y="-17" width="28" height="34" fill="#3a2f45"/><svg x="-14" y="-17" width="28" height="34" viewBox="-17 -82 34 42">${Art.rig(S.look, Art.itemsOf(S))}</svg><rect x="-14" y="-17" width="28" height="34" fill="none" stroke="#8a6a2a" stroke-width="1"/>`,
    arcade: () => '<path d="M-15,0 V-56 L-12,-64 H12 L15,-56 V0Z" fill="#3a2a6a"/><path d="M-15,-50 L-12,-46 V-4 L-15,0 Z M15,-50 L12,-46 V-4 L15,0Z" fill="#e04a8a"/><rect x="-12" y="-63" width="24" height="7" fill="#f2c43a"/><text x="0" y="-57.6" font-size="4.6" text-anchor="middle" font-weight="900" fill="#3a2a6a" font-family="sans-serif">HI-SCORE</text><rect x="-11" y="-53" width="22" height="18" fill="#111"/><rect class="scr" x="-10" y="-52" width="20" height="16" fill="#2a8a5a"/><path d="M-15,-31 H15 L13,-25 H-13Z" fill="#2a1a4a"/><circle cx="-6" cy="-28" r="1.8" fill="#e04a3a"/><circle cx="4" cy="-28" r="1.4" fill="#3a8ae0"/><circle cx="8" cy="-28" r="1.4" fill="#f2c43a"/><rect x="-6" y="-14" width="12" height="6" fill="#2a1a4a"/>',
    gnome: () => '<path d="M-7,0 L-8,-12 Q0,-16 8,-12 L7,0Z" fill="#3a5a9a"/><circle cx="0" cy="-15" r="5" fill="#f0c8a0"/><path d="M-5,-14 Q0,-5 5,-14 Q3,-9 0,-8 Q-3,-9 -5,-14Z" fill="#f4f4f4"/><path d="M-6,-17 L0,-31 L6,-17Z" fill="#c8342a"/><circle cx="0" cy="-12.5" r="1.2" fill="#e08a7a"/>',
    bbq: () => '<path d="M-10,0 L-6,-16 M10,0 L6,-16 M0,0 L0,-16" stroke="#333" stroke-width="1.6"/><circle cx="-10" cy="-1" r="2" fill="#222"/><path d="M-14,-18 A14,10 0 0,0 14,-18 Z" fill="#222"/><path d="M-14,-19 A14,12 0 0,1 14,-19 Z" fill="#2a2a2e"/><rect x="-2" y="-33" width="4" height="3" fill="#888"/><g class="smk"><circle cx="-3" cy="-36" r="3" fill="#ddd"/><circle cx="3" cy="-36" r="3.5" fill="#ddd"/><circle cx="0" cy="-36" r="2.5" fill="#ddd"/></g>',
    hammock: () => '<path d="M-49,-44 L-36,-30 M49,-44 L36,-30" stroke="#d8c8a0" stroke-width="1"/><path d="M-36,-30 Q0,-8 36,-30 L36,-26 Q0,-2 -36,-26Z" fill="url(#hStripe)"/>',
    dummy: () => '<rect x="-2" y="-30" width="4" height="30" fill="#6b4a31"/><rect x="-10" y="-3" width="20" height="3" fill="#5a3d28"/><g class="wob"><rect x="-9" y="-46" width="18" height="22" rx="4" fill="#c8a868"/><path d="M-9,-38 H9 M-9,-31 H9" stroke="#a8884a" stroke-width="1"/><rect x="-13" y="-44" width="26" height="4" rx="2" fill="#c8a868"/><circle cx="0" cy="-51" r="6" fill="#d8b878"/><path d="M-3,-52 l2,2 M-1,-52 l-2,2 M1,-52 l2,2 M3,-52 l-2,2" stroke="#5a3a1a" stroke-width=".8"/></g>',
    banner: () => '<rect x="-17" y="-22" width="34" height="2.5" rx="1" fill="#c9a24a"/><path d="M-13,-20 H13 V18 L0,10 L-13,18Z" fill="#8a2a3a"/><path d="M-13,-17 H13" stroke="#c9a24a" stroke-width="1"/><circle cx="0" cy="-2" r="7" fill="none" stroke="#c9a24a" stroke-width="1.6"/><path d="M-5,4 L5,-8" stroke="#ece6da" stroke-width="1.8"/>',
    starchart: () => `<circle r="19" fill="#1a2350" stroke="#c9a24a" stroke-width="1.6"/><path d="M-10,-6 L-3,-10 L4,-4 L10,-9 M4,-4 L2,6 L-6,9" stroke="#8aa0e0" stroke-width=".6" fill="none"/>${[[-10, -6], [-3, -10], [4, -4], [10, -9], [2, 6], [-6, 9], [-13, 5], [12, 7], [-2, 14]].map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="1.1" fill="#fff"/>`).join('')}`,
    weaponrack: () => '<rect x="-24" y="-16" width="48" height="4" fill="#6b4a31"/><rect x="-24" y="10" width="48" height="4" fill="#6b4a31"/><path d="M-14,-24 V18 M-15.5,-24 L-14,-28 L-12.5,-24" stroke="#c4c8d0" stroke-width="3" fill="none"/><rect x="-18" y="6" width="8" height="2" fill="#c9a24a"/><path d="M0,-24 V20" stroke="#6b4a31" stroke-width="2"/><path d="M1,-23 C9,-25 11,-18 10,-12 C7,-15 4,-15 1,-15Z" fill="#c4c8d0"/><path d="M14,-28 V20" stroke="#6b4a31" stroke-width="1.8"/><path d="M11.5,-28 L14,-36 L16.5,-28Z" fill="#c4c8d0"/>',
  };
  const DECOR_ACT = {
    firepit: { dx: -24, pose: 'sit', y: 8, dir: 1, anim: 'warm', w: 1.4, night: 5, quips: ['Nothing beats a fire.', 'Marshmallow, anyone?'] },
    bbq: { dx: -26, dir: 1, anim: 'cook', w: 1.8, quips: ['Snags are nearly done.', 'Where are my tongs?'] },
    hammock: { dx: 40, pose: 'lie', y: -24, dir: 1, anim: 'nap', w: 2, quips: ['Five more minutes.', 'This is the life.'] },
    telescope: { dx: -20, dir: 1, anim: 'gaze', w: 0.6, night: 8, quips: ['Is that Jupiter?', 'The stars are out.'] },
    vegpatch: { dx: -30, dir: 1, anim: 'water', w: 1.5, quips: ['Grow, my pretties.', 'Tomatoes soon. Maybe.'] },
    armchair: { dx: 0, pose: 'sit', y: -4, anim: 'read', w: 2, quips: ['Just one more chapter.', 'Comfy.'] },
    guitar: { dx: 22, dir: -1, anim: 'strum', w: 2, quips: ['Three chords and the truth.', '♪ ♫ ♪'] },
    record: { dx: 30, anim: 'dance', w: 1.8, quips: ['Dance break!', 'This one slaps.'] },
    fishtank: { dx: -30, dir: 1, anim: 'look', w: 1.2, quips: ['Hello, fish.', 'I should name them.'] },
    arcade: { dx: -26, dir: 1, anim: 'play', w: 2, quips: ['New high score!', 'One more credit.'] },
    dummy: { dx: -24, dir: 1, anim: 'punch', w: 1.6, quips: ['Hiyah!', 'Take that.'] },
    portrait: { dx: 0, anim: 'admire', w: 0.5, quips: ['Handsome devil.', 'Good likeness.'] },
    weaponrack: { dx: 0, anim: 'admire', w: 0.5, quips: ['Nice collection.'] },
    starchart: { dx: 0, anim: 'admire', w: 0.4, quips: ['Hmm. Orion, I think.'] },
  };
  let DACTS = {};
  const getAct = (id) => ACTS[id] || DACTS[id] || ACTS.wander;

  function decorSvg(key, S) {
    const d = G.DECOR[key];
    if (!d || !DECOR_ART[key]) return '';
    const vb = key === 'hammock' ? '-54 -50 108 56' : d.type === 'wall' ? '-30 -28 60 56' : '-30 -74 60 78';
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="figure">${Art.DEFS}<defs><pattern id="hStripe" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#c8483e"/><rect width="3" height="6" fill="#f2ead8"/></pattern><radialGradient id="hGlow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>${key === 'hammock' ? '<rect x="-51" y="-46" width="3" height="52" fill="#6b4a31"/><rect x="48" y="-46" width="3" height="52" fill="#6b4a31"/>' : ''}${DECOR_ART[key](S, false)}</svg>`;
  }

  // ---------- scene art ----------
  function skyFor(hour) {
    if (hour >= 21 || hour < 5) return { top: '#0a0f2c', bot: '#1d2550', night: 0.42, moon: true };
    if (hour < 7) return { top: '#3d4c7d', bot: '#e9a37b', night: 0.18 };
    if (hour < 17) return { top: '#6aa5d9', bot: '#d3e9f3', night: 0 };
    if (hour < 19) return { top: '#5a6fa8', bot: '#f1b17a', night: 0.1 };
    return { top: '#232b5a', bot: '#7a5a7a', night: 0.3, moon: true };
  }

  function grassPath(x0, x1, hBase, step, seed, front) {
    const r = seeded(seed);
    let d = '';
    for (let x = x0; x < x1; x += step) {
      const h = hBase * (0.55 + r() * 0.9);
      const lean = (r() - 0.5) * (hBase > 20 ? 9 : 3);
      d += `M${x.toFixed(1)},${FL + 4} Q${(x + 1 + lean / 2).toFixed(1)},${(FL - h / 2).toFixed(1)} ${(x + 2 + lean).toFixed(1)},${(FL - h).toFixed(1)} L${(x + 3.6).toFixed(1)},${FL + 4}Z`;
    }
    return d;
  }

  function parrot(male, x, y, faceLeft) {
    const body = male ? '#3fae49' : '#c8283a', head = male ? '#4abb52' : '#d02e40', belly = male ? '#38a043' : '#3b46b0';
    const beak = male ? '#f29b38' : '#1d1d1f', tail = male ? '#2c8a39' : '#b21e30', tip = male ? '#e8c64a' : '#f0a23a';
    const flip = faceLeft ? `translate(${x},${y}) scale(-1,1)` : `translate(${x},${y})`;
    return `<g transform="${flip}"><g class="bird-b">
      <path d="M-3,-2 L-5,12 L-1,12 L1,-1 Z" fill="${tail}"/><path d="M-5,10 L-1,10 L-1,13 L-5,13Z" fill="${tip}"/>
      <ellipse cx="0" cy="-9" rx="7" ry="10" fill="${body}"/><ellipse cx="1.5" cy="-6" rx="4.5" ry="6.5" fill="${belly}"/>
      <path d="M-6,-14 C-9,-6 -6,0 -2,2 C-4,-4 -4,-10 -2,-14Z" fill="${shade(body, -0.25)}"/>${male ? '<path d="M-6.5,-12 L-4,-14 L-3.5,-10Z" fill="#d8343a"/>' : ''}
      <circle cx="1" cy="-20" r="6" fill="${head}"/><circle cx="3" cy="-21" r="1.5" fill="${male ? '#f2d24a' : '#3a6ad0'}"/><circle cx="3.2" cy="-21" r=".8" fill="#111"/>
      <path d="M5.5,-21.5 Q10.5,-21 9,-16 Q6.5,-16.8 5.5,-18.5Z" fill="${beak}"/>
      <path d="M-1,-1 L-1,2 M2,-1 L2,2" stroke="#6b6b6b" stroke-width="1"/></g></g>`;
  }

  function cobweb(x, y, flip) {
    const s = flip ? -1 : 1;
    return `<g transform="translate(${x},${y}) scale(${s},1)" stroke="#d9d9de" stroke-width=".55" fill="none" opacity=".75">
      <path d="M0,0 L26,0 M0,0 L0,26 M0,0 L22,13 M0,0 L13,22"/><path d="M7,0 Q6,3 0,7 M14,0 Q12,7 0,14 M21,0 Q18,11 0,21 M26,0 Q20,16 0,26"/></g>`;
  }

  function flies(x, y, id) {
    return `<g transform="translate(${x},${y})" class="flies"${id ? ` id="${id}"` : ''}><circle class="fly f1" r="1.2" fill="#111"/><circle class="fly f2" r="1.1" fill="#111"/><circle class="fly f3" r="1" fill="#111"/></g>`;
  }

  function build(S, H, hour) {
    const sky = skyFor(hour);
    const st = (k) => (H[k] ? H[k].state : 0);
    const lit = sky.night > 0.15;
    const reno = H.reno || { stage: 0 };
    const lawnH = [5, 15, 36][st('lawn')];
    let o = '';
    // defs
    o += `<defs>
      <linearGradient id="hSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.top}"/><stop offset="1" stop-color="${sky.bot}"/></linearGradient>
      <radialGradient id="hGlow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
      <pattern id="hMesh" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,0 L6,6 M6,0 L0,6" stroke="#cfd3d8" stroke-width=".45" opacity=".55"/></pattern>
      <pattern id="hTile" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#d8dcd2"/><path d="M0,0 H14 M0,0 V10" stroke="#aab0a4" stroke-width=".8"/></pattern>
      <pattern id="hStripe" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#c8483e"/><rect width="3" height="6" fill="#f2ead8"/></pattern>
      <pattern id="hBlock" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" fill="#4b4b51"/><path d="M0,0 H40 M0,10 H40 M20,0 V10 M0,10 V20" stroke="#3f3f45" stroke-width="1"/></pattern>
    </defs>`;
    // sky + exterior
    o += `<rect x="0" y="0" width="${W}" height="${FL}" fill="url(#hSky)"/>`;
    if (sky.night > 0.25) { const r = seeded(4); for (let i = 0; i < 40; i++) o += `<circle cx="${(r() * 560).toFixed(0)}" cy="${(r() * 120).toFixed(0)}" r="${(r() * 0.9 + 0.3).toFixed(1)}" fill="#fff" opacity="${(r() * 0.6 + 0.3).toFixed(2)}"/>`; }
    o += sky.moon ? '<circle cx="300" cy="48" r="13" fill="#ecebdc"/><circle cx="305" cy="45" r="3" fill="#d6d4c2"/><circle cx="296" cy="53" r="2" fill="#d6d4c2"/>'
      : '<circle cx="300" cy="48" r="16" fill="#ffd77a" opacity=".95"/><circle cx="300" cy="48" r="26" fill="#ffd77a" opacity=".15"/>';
    o += `<path d="M0,212 Q90,178 190,200 T385,196 L560,206 L560,${FL} L0,${FL}Z" fill="#35562d"/>`;
    // tree
    o += `<rect x="45" y="150" width="15" height="100" fill="#5a3d28"/><circle cx="52" cy="138" r="31" fill="#3f6b33"/><circle cx="29" cy="156" r="22" fill="#3f6b33"/><circle cx="77" cy="158" r="22" fill="#3f6b33"/><circle cx="44" cy="128" r="13" fill="#4f8a3e"/>`;
    // fence
    o += `<g fill="#8a6a4a">${Array.from({ length: 40 }, (_, i) => `<path d="M${i * 14 + 3},250 V208 L${i * 14 + 6},203 L${i * 14 + 9},208 V250Z"/>`).join('')}</g><rect x="0" y="214" width="560" height="4" fill="#7a5c40"/><rect x="0" y="232" width="560" height="4" fill="#7a5c40"/>`;
    // washing line
    o += '<rect x="99" y="150" width="3" height="100" fill="#6b4a31"/><rect x="199" y="150" width="3" height="100" fill="#6b4a31"/><path d="M101,156 Q150,166 201,156" stroke="#ddd" stroke-width=".8" fill="none"/>';
    if (H.laundry && H.laundry.linked && H.laundry.days <= 2) {
      o += '<path d="M116,159 h16 l3,6 -3,1 v16 h-16 v-16 l-3,-1Z" fill="#5a8ac0"/><path d="M142,162 h14 v24 h-5 l-2,-12 -2,12 h-5Z" fill="#3a3a48"/><path d="M166,161 h18 l3,7 -3,1 v14 h-18 v-14 l-3,-1Z" fill="#c8483e"/>';
    }
    // deckchair
    o += '<path d="M222,250 L246,224 M258,250 L234,226" stroke="#8a6a4a" stroke-width="2.5"/><path d="M224,210 L231,210 L240,231 L260,233 L260,238 L237,238 Z" fill="url(#hStripe)"/>';
    // mower
    o += '<g><path d="M332,210 L346,234" stroke="#333" stroke-width="2"/><rect x="340" y="231" width="28" height="12" rx="3" fill="#c0392b"/><circle cx="345" cy="245" r="4" fill="#222"/><circle cx="364" cy="245" r="4" fill="#222"/></g>';
    // lawn back layer
    o += `<rect x="0" y="246" width="560" height="54" fill="#4f7d3a"/><rect x="0" y="262" width="560" height="38" fill="#3d2a1c"/>`;
    o += `<path d="${grassPath(0, 560, lawnH * 0.8, 4, 11)}" fill="#47722f"/>`;

    // aviary
    const avDirt = st('aviary');
    o += `<rect x="385" y="247" width="175" height="5" fill="#8f8f8a"/>
      <rect x="392" y="118" width="158" height="132" fill="url(#hMesh)"/>
      <rect x="389" y="112" width="5" height="138" fill="#4a3526"/><rect x="468" y="112" width="4" height="138" fill="#4a3526"/><rect x="548" y="112" width="5" height="138" fill="#4a3526"/>
      <path d="M380,116 L560,104 L566,112 L386,124Z" fill="#8a8f96"/>
      <path d="M398,180 L545,176" stroke="#6b4a31" stroke-width="4" stroke-linecap="round"/><path d="M520,177 L532,166" stroke="#6b4a31" stroke-width="2.5"/>
      <path d="M512,118 V150" stroke="#b08a5a" stroke-width="1"/><circle cx="512" cy="152" r="3" fill="#e05a3a"/><circle cx="512" cy="158" r="3" fill="#f2c43a"/><circle cx="512" cy="164" r="3" fill="#3a8ae0"/>
      <ellipse cx="466" cy="246" rx="11" ry="3.5" fill="#6b6b70"/>${st('birds') === 0 ? '<ellipse cx="466" cy="244" rx="8" ry="2" fill="#e0a840"/><circle cx="462" cy="243" r="1.5" fill="#e04a3a"/><circle cx="469" cy="243" r="1.5" fill="#6ac04a"/>' : ''}`;
    { const r = seeded(21); const n = [2, 9, 22][avDirt]; for (let i = 0; i < n; i++) o += `<ellipse cx="${(400 + r() * 145).toFixed(0)}" cy="${(244 + r() * 5).toFixed(0)}" rx="${(1.5 + r() * 2).toFixed(1)}" ry="1" fill="#e8e6e0" opacity=".85"/>`;
      if (avDirt === 2) o += '<path d="M430,244 q4,-4 8,-1" stroke="#3fae49" stroke-width="1.5" fill="none"/><path d="M500,245 q4,-4 8,-1" stroke="#c8283a" stroke-width="1.5" fill="none"/>' + flies(430, 232); }
    o += `<g id="h-birds" class="birds s${st('birds')}">${parrot(true, 448, 176, false)}${parrot(false, 494, 175, true)}
      <g class="bfx"><text x="440" y="146" class="bang">!</text><text x="500" y="144" class="bang b2">!</text><text x="458" y="150" class="note">♪</text><text x="486" y="146" class="note n2">♫</text></g></g>`;

    // house shell
    o += `<path d="M546,68 L592,22 L${W + 40},22 L${W + 40},68 Z" fill="#4a2f24"/><path d="M570,36 H${W} M556,52 H${W}" stroke="#3a241b" stroke-width="1.5"/>
      <rect x="1250" y="2" width="22" height="26" fill="#5a3d33"/>`;
    const wallC = { kitchen: '#5d6b62', living: reno.stage >= 1 ? '#7a4b45' : '#5e504b', study: '#4f566a', bedroom: '#5a4e66' };
    ROOMS.slice(2).forEach((rm) => {
      if (rm.k === 'gym') { o += `<rect x="${rm.x0}" y="68" width="${rm.x1 - rm.x0}" height="${FL - 68}" fill="url(#hBlock)"/>`; return; }
      const c = wallC[rm.k];
      o += `<rect x="${rm.x0}" y="68" width="${rm.x1 - rm.x0}" height="${FL - 68}" fill="${c}"/><rect x="${rm.x0}" y="206" width="${rm.x1 - rm.x0}" height="44" fill="${shade(c, -0.2)}"/><rect x="${rm.x0}" y="204" width="${rm.x1 - rm.x0}" height="3" fill="${shade(c, -0.35)}"/>`;
    });
    if (reno.stage >= 1) o += `<g stroke="#00000014" stroke-width="6">${Array.from({ length: 16 }, (_, i) => `<path d="M${872 + i * 20},70 V204"/>`).join('')}</g>`;
    else o += '<path d="M1112,104 q20,-8 40,4 q10,18 -4,36 q-22,10 -36,-6 q-8,-18 0,-34Z" fill="#cbbfa8" opacity=".75"/><path d="M900,160 q14,-6 26,2 q4,12 -6,18 q-14,4 -20,-6Z" fill="#cbbfa8" opacity=".6"/>';
    // kitchen splashback
    o += `<rect x="684" y="168" width="176" height="40" fill="url(#hTile)"/>`;
    // ceiling, outer wall + doorway, floor
    o += `<rect x="556" y="62" width="${W - 556}" height="8" fill="#3b2a20"/><rect x="554" y="62" width="12" height="90" fill="#6b5040"/><rect x="566" y="152" width="6" height="98" fill="#5a3d28"/>
      <rect x="556" y="${FL}" width="${W - 556}" height="12" fill="#6b4a31"/><g stroke="#57391f" stroke-width="1">${Array.from({ length: 35 }, (_, i) => `<path d="M${576 + i * 40},${FL} v12"/>`).join('')}</g>
      <rect x="556" y="${FL + 12}" width="${W - 556}" height="${HT - FL - 12}" fill="#2e211a"/>`;
    [860, 1180, 1400, 1640].forEach((x) => { o += `<rect x="${x - 5}" y="68" width="10" height="84" fill="#3b2a20"/><rect x="${x - 6}" y="150" width="3" height="100" fill="#4a3526"/><rect x="${x + 3}" y="150" width="3" height="100" fill="#4a3526"/>`; });
    // windows
    const win = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#hSky)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#4a3526" stroke-width="4"/><path d="M${x + w / 2},${y} V${y + h} M${x},${y + h / 2} H${x + w}" stroke="#4a3526" stroke-width="2"/>`;
    o += win(704, 98, 56, 50) + win(1264, 96, 54, 48) + win(1424, 98, 48, 46);
    // clock (real time)
    { const d = new Date(), hA = ((d.getHours() % 12) + d.getMinutes() / 60) * 30, mA = d.getMinutes() * 6;
      o += `<circle cx="634" cy="116" r="11" fill="#f2ead8" stroke="#4a3526" stroke-width="2"/><path d="M634,116 L${(634 + 6 * Math.sin(hA * Math.PI / 180)).toFixed(1)},${(116 - 6 * Math.cos(hA * Math.PI / 180)).toFixed(1)} M634,116 L${(634 + 8.5 * Math.sin(mA * Math.PI / 180)).toFixed(1)},${(116 - 8.5 * Math.cos(mA * Math.PI / 180)).toFixed(1)}" stroke="#222" stroke-width="1.4" stroke-linecap="round"/>`; }

    // ---- kitchen ----
    const fridgeItems = [
      '<rect x="614" y="170" width="7" height="16" rx="2" fill="#f2f2f2" stroke="#9aa" stroke-width=".5"/><rect x="624" y="174" width="10" height="12" fill="#e8c64a"/><circle cx="642" cy="180" r="5" fill="#d8443a"/><circle cx="650" cy="181" r="4.5" fill="#6ab04a"/>' +
      '<rect x="614" y="196" width="14" height="14" fill="#f4f4ee" stroke="#ccc" stroke-width=".5"/><rect x="631" y="200" width="20" height="10" rx="2" fill="#e09a5a"/><ellipse cx="620" cy="228" rx="7" ry="4" fill="#5a9a3a"/><ellipse cx="636" cy="229" rx="7" ry="3.5" fill="#e07a3a"/><rect x="644" y="220" width="8" height="12" rx="1" fill="#7a3a8a"/>',
      '<rect x="616" y="174" width="8" height="12" rx="1.5" fill="#e8c64a"/><circle cx="642" cy="205" r="4.5" fill="#d8443a"/><rect x="620" y="222" width="10" height="10" fill="#f4f4ee" stroke="#ccc" stroke-width=".5"/>',
      '<rect x="630" y="200" width="7" height="10" rx="1.5" fill="#e8c64a"/><rect x="630" y="198" width="7" height="2.5" fill="#c9a23a"/>',
    ][st('fridge')];
    o += `<g data-hs="fridge"><rect x="606" y="158" width="54" height="92" rx="4" fill="#cfd4da"/><rect x="610" y="162" width="46" height="84" fill="#f4f8fa"/>
      <path d="M610,188 H656 M610,212 H656 M610,234 H656" stroke="#c6ccd2" stroke-width="1.5"/>${fridgeItems}
      <g id="h-fdoor"><rect x="606" y="158" width="54" height="92" rx="4" fill="#e6e9ee" stroke="#b9bec6"/><path d="M606,184 H660" stroke="#b9bec6"/><rect x="652" y="170" width="3" height="10" rx="1" fill="#9aa0aa"/><rect x="652" y="192" width="3" height="28" rx="1" fill="#9aa0aa"/>
      <rect x="616" y="196" width="10" height="8" fill="#e8584a" transform="rotate(-8 621 200)"/><circle cx="636" cy="212" r="3.5" fill="#4a8ae0"/></g></g>`;
    // counter, sink, dishes
    o += `<g data-hs="dishes"><rect x="688" y="214" width="102" height="36" fill="#7a5a3e"/><path d="M722,216 V248 M756,216 V248" stroke="#5a3d28" stroke-width="1.5"/><rect x="684" y="207" width="110" height="7" fill="#b9a58a"/>
      <rect x="724" y="207" width="36" height="3" fill="#8a8f96"/><path d="M752,207 V194 Q752,190 746,190 H743" stroke="#9aa0aa" stroke-width="2.5" fill="none"/>`;
    if (st('dishes') === 0) o += '<path d="M690,206 v-12 M696,206 v-12 M702,206 v-12 M708,206 v-12" stroke="#9aa0aa" stroke-width="1"/><ellipse cx="699" cy="196" rx="10" ry="2" fill="#f2f2f2" transform="rotate(-70 699 199)"/>';
    else if (st('dishes') === 1) o += '<ellipse cx="704" cy="205" rx="13" ry="2.5" fill="#f2f2f2" stroke="#bbb" stroke-width=".5"/><ellipse cx="704" cy="202" rx="12" ry="2.5" fill="#efe9dd" stroke="#bbb" stroke-width=".5"/><ellipse cx="703" cy="199" rx="11" ry="2.5" fill="#f2f2f2" stroke="#bbb" stroke-width=".5"/><rect x="712" y="194" width="8" height="10" rx="2" fill="#4a7ac0"/><path d="M698,197 l6,-10" stroke="#888" stroke-width="1.2"/>';
    else { o += '<g transform="rotate(-6 704 206)">'; for (let i = 0; i < 9; i++) o += `<ellipse cx="${704 + (i % 3) - 1}" cy="${205 - i * 3}" rx="${12 - (i % 2)}" ry="2.4" fill="${i % 2 ? '#efe9dd' : '#f2f2f2'}" stroke="#aaa" stroke-width=".5"/>`;
      o += '<rect x="694" y="168" width="20" height="9" rx="2" fill="#555"/><path d="M714,171 h8" stroke="#555" stroke-width="2"/><path d="M700,166 l4,-12 M706,167 l6,-11" stroke="#888" stroke-width="1.2"/></g><ellipse cx="716" cy="206" rx="5" ry="1.4" fill="#8a7a3a" opacity=".6"/>' + flies(704, 156); }
    o += '</g>';
    // stove + steam
    o += `<rect x="800" y="206" width="52" height="44" fill="#3a3a40"/><rect x="798" y="202" width="56" height="5" fill="#2a2a30"/><rect x="808" y="214" width="36" height="22" rx="2" fill="#1d1d22" stroke="#555" stroke-width="1"/>
      <circle cx="810" cy="209" r="1.8" fill="#888"/><circle cx="842" cy="209" r="1.8" fill="#888"/><rect x="812" y="195" width="26" height="7" rx="2" fill="#2b2b2f"/><path d="M838,197 h12" stroke="#2b2b2f" stroke-width="2.5"/>
      <g id="h-steam" class="steam"><circle cx="820" cy="190" r="3" fill="#fff"/><circle cx="828" cy="190" r="3.5" fill="#fff"/><circle cx="824" cy="190" r="2.5" fill="#fff"/></g>
      <rect x="800" y="138" width="52" height="4" fill="#4a3526"/><rect x="805" y="124" width="9" height="14" rx="2" fill="#c98a4a"/><rect x="818" y="128" width="8" height="10" rx="2" fill="#7a9a5a"/><rect x="830" y="126" width="9" height="12" rx="2" fill="#d8c8a8"/>`;

    // ---- lounge ----
    if (reno.stage >= 2) o += '<ellipse cx="985" cy="252" rx="74" ry="5" fill="#8a3a3a"/><ellipse cx="985" cy="252" rx="66" ry="3.5" fill="none" stroke="#d8a84a" stroke-width="1" stroke-dasharray="3 2"/>';
    if (reno.stage >= 3) o += '<rect x="952" y="102" width="64" height="46" fill="#c9a24a"/><rect x="956" y="106" width="56" height="38" fill="#7aa0c0"/><path d="M956,144 L976,122 L988,134 L998,118 L1012,144Z" fill="#4a6a3a"/><circle cx="1002" cy="114" r="4" fill="#f2e08a"/>';
    o += `<rect x="918" y="206" width="14" height="32" rx="5" fill="#5e3650"/><rect x="1038" y="206" width="14" height="32" rx="5" fill="#5e3650"/><rect x="928" y="194" width="114" height="30" rx="7" fill="#6b3f5a"/>
      <rect x="922" y="218" width="126" height="18" rx="4" fill="#7a4a68"/><path d="M985,220 V234" stroke="#5e3650" stroke-width="1.5"/><rect x="926" y="236" width="5" height="12" fill="#3b2a20"/><rect x="1039" y="236" width="5" height="12" fill="#3b2a20"/>`;
    if (reno.stage >= 4) o += '<rect x="1056" y="234" width="16" height="16" fill="#b0603a"/><path d="M1064,234 C1052,214 1058,206 1062,200 M1064,234 C1076,216 1072,206 1068,198 M1064,234 C1064,220 1064,208 1064,196" stroke="#4a8a3a" stroke-width="4" fill="none" stroke-linecap="round"/>';
    o += `<rect x="1080" y="226" width="66" height="24" fill="#4a3526"/><rect x="1084" y="184" width="58" height="40" rx="2" fill="#111"/><rect id="h-tv" x="1087" y="187" width="52" height="34" fill="#1a2030"/>
      <rect x="1080" y="140" width="66" height="4" fill="#4a3526"/>`;
    { const cups = Math.min(6, Math.floor((S.level || 1) / 5)); const cols = ['#b07a4a', '#c0c4cc', '#e8c64a', '#5596f0', '#ba72e8', '#f2a93b'];
      for (let i = 0; i < cups; i++) { const x = 1086 + i * 10; o += `<path d="M${x},${126} h7 l-1,6 h-5 Z" fill="${cols[i]}"/><rect x="${x + 2.5}" y="132" width="2" height="4" fill="${cols[i]}"/><rect x="${x + 1}" y="136" width="5" height="4" fill="${cols[i]}"/>`; }
      if (!cups) o += '<text x="1113" y="136" font-size="7" fill="#d8cfc0" text-anchor="middle" opacity=".7">trophies at Lv 5</text>'; }
    if (reno.stage < 5) o += `<g data-hs="reno"><path d="M1124,250 V236 h16 v14 Z" fill="#d8d0c0"/><path d="M1124,236 h16" stroke="#7a9ac0" stroke-width="3"/><path d="M1130,236 v6" stroke="#7a9ac0" stroke-width="2"/>
      <path d="M1153,250 L1162,166 L1171,250 M1155,232 H1169 M1157,212 H1167 M1159,192 H1165" stroke="#c9a24a" stroke-width="2.5" fill="none"/><rect x="1104" y="160" width="76" height="90" fill="transparent"/></g>`;
    else o += '<g data-hs="reno"><rect x="1104" y="160" width="76" height="90" fill="transparent"/></g>';

    // ---- study ----
    { const r = seeded(31); let books = ''; [150, 184, 218].forEach((y) => { let x = 1196; while (x < 1240) { const w = 4 + Math.floor(r() * 4), h = 20 + r() * 10; books += `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${['#8a3a3a', '#3a5a8a', '#4a6a3a', '#8a6a2a', '#5a3a6a', '#2f6b6b'][Math.floor(r() * 6)]}"/>`; x += w + 0.8; } });
      o += `<g data-hs="study"><rect x="1192" y="114" width="54" height="136" fill="#5a3d28"/><rect x="1196" y="118" width="46" height="128" fill="#3b2a20"/>${books}<path d="M1196,150 H1242 M1196,184 H1242 M1196,218 H1242" stroke="#5a3d28" stroke-width="3"/>
        <rect x="1306" y="196" width="24" height="40" rx="3" fill="#4a3526"/>
        <rect x="1296" y="208" width="96" height="6" fill="#6b4a31"/><rect x="1300" y="214" width="6" height="36" fill="#5a3d28"/><rect x="1382" y="214" width="6" height="36" fill="#5a3d28"/><rect x="1352" y="214" width="30" height="14" fill="#5a3d28"/>
        <rect x="1338" y="200" width="18" height="4" fill="#8a3a3a"/><rect x="1340" y="196" width="16" height="4" fill="#3a5a8a"/><rect x="1337" y="192" width="18" height="4" fill="#4a6a3a"/>
        <circle id="h-dlamp" cx="1375" cy="186" r="26" fill="url(#hGlow)" class="${lit || (H.study && H.study.today) ? 'on' : ''}"/>
        <rect x="1368" y="204" width="14" height="4" fill="#333"/><path d="M1375,204 L1369,190 L1376,182" stroke="#333" stroke-width="2" fill="none"/><path d="M1368,184 L1384,178 L1386,186 Z" fill="#c9a24a"/>`;
      if (st('study') === 2) o += cobweb(1196, 118) + cobweb(1392, 70, true) + '<rect x="1336" y="190" width="22" height="16" fill="#cfcfcf" opacity=".22"/>';
      o += '</g>'; }

    // ---- bedroom ----
    o += `<rect x="1414" y="196" width="9" height="54" fill="#5a3d28"/><rect x="1416" y="228" width="112" height="16" fill="#6b4a31"/><rect x="1420" y="244" width="5" height="6" fill="#3b2a20"/><rect x="1520" y="244" width="5" height="6" fill="#3b2a20"/>
      <rect x="1420" y="218" width="106" height="12" rx="3" fill="#e8e0d0"/><ellipse cx="1437" cy="215" rx="13" ry="5" fill="#f4efe6"/>
      <rect x="1532" y="226" width="18" height="24" fill="#5a3d28"/><rect x="1537" y="216" width="8" height="10" fill="#c9a24a"/><path d="M1534,216 L1548,216 L1545,208 L1537,208Z" fill="#e8d8b0"/>`;
    const blanket = (id, extra) => `<g id="${id}"${extra || ''}><rect x="1446" y="213" width="82" height="20" rx="4" fill="#6a4a8a"/><path d="M1446,219 H1528" stroke="#8a6aaa" stroke-width="2"/></g>`;
    o += blanket('h-blB');
    o += `<g data-hs="laundry"><path d="M1566,226 h40 l-3,24 h-34 Z" fill="#b08a5a"/><path d="M1568,232 h37 M1569,240 h35" stroke="#8a6a3a" stroke-width="1"/>`;
    if (st('laundry') === 0) o += '<rect x="1572" y="218" width="28" height="5" rx="1" fill="#5a8ac0"/><rect x="1573" y="213" width="26" height="5" rx="1" fill="#c8483e"/><rect x="1574" y="208" width="24" height="5" rx="1" fill="#e8e0d0"/>';
    else if (st('laundry') === 1) o += '<path d="M1562,228 q4,-14 16,-12 q8,-8 18,0 q12,-2 12,12Z" fill="#5a8ac0"/><path d="M1570,222 q8,-6 14,2 l-4,6Z" fill="#c8483e"/><path d="M1592,216 l10,-4 4,8Z" fill="#e8e0d0"/>';
    else o += '<path d="M1548,250 q2,-30 22,-40 q12,-18 30,-6 q20,4 22,26 q6,10 8,20Z" fill="#5a8ac0"/><path d="M1560,232 q10,-14 24,-6 l-8,10Z" fill="#c8483e"/><path d="M1588,214 l14,-6 6,10Z" fill="#e8e0d0"/><path d="M1598,236 q10,-10 20,0 l-6,6Z" fill="#4a6a3a"/><path d="M1537,206 q4,-6 9,-2 l-1,6Z" fill="#e8e0d0"/>' + flies(1590, 190);
    o += '<rect x="1548" y="190" width="90" height="60" fill="transparent"/></g>';

    // ---- gym ----
    o += `<g data-hs="gym"><rect x="1656" y="246" width="248" height="4" fill="#2a2a2e"/>
      <rect x="1694" y="196" width="5" height="36" fill="#777"/><rect x="1757" y="196" width="5" height="36" fill="#777"/><rect x="1688" y="224" width="80" height="8" rx="3" fill="#2a2a30"/><rect x="1692" y="232" width="4" height="18" fill="#555"/><rect x="1760" y="232" width="4" height="18" fill="#555"/>
      <g id="h-bar"><rect x="1678" y="196" width="100" height="2.5" fill="#bbb"/><rect x="1680" y="186" width="5" height="22" rx="1" fill="#333"/><rect x="1771" y="186" width="5" height="22" rx="1" fill="#333"/></g>
      <rect x="1790" y="170" width="4" height="80" fill="#555"/><rect x="1842" y="170" width="4" height="80" fill="#555"/><path d="M1794,190 H1842 M1794,220 H1842" stroke="#555" stroke-width="3"/>
      <circle cx="1806" cy="203" r="9" fill="#2a2a2e"/><circle cx="1830" cy="203" r="9" fill="#2a2a2e"/><circle cx="1806" cy="236" r="10" fill="#2a2a2e"/><circle cx="1830" cy="236" r="10" fill="#2a2a2e"/>
      <rect x="1800" y="94" width="38" height="50" fill="#c9a24a"/><text x="1819" y="116" font-size="10" font-weight="800" text-anchor="middle" fill="#1d1408">NO</text><text x="1819" y="130" font-size="8" font-weight="800" text-anchor="middle" fill="#1d1408">EXCUSES</text>
      <path d="M1880,70 V140" stroke="#777" stroke-width="1.5"/><g id="h-bag"><rect x="1868" y="140" width="24" height="74" rx="9" fill="#8a2a2a"/><rect x="1868" y="152" width="24" height="3" fill="#5a1a1a"/><rect x="1868" y="200" width="24" height="3" fill="#5a1a1a"/></g>`;
    if (H.gym && H.gym.today) o += '<path d="M1752,222 h14 l-2,12 h-10Z" fill="#f2f2f2"/>';
    if (st('gym') >= 1) o += cobweb(1646, 70) + cobweb(1914, 70, true) + cobweb(1795, 172);
    if (st('gym') === 2) o += '<rect x="1640" y="68" width="280" height="182" fill="#b8b8b8" opacity=".14"/><circle cx="1700" cy="247" r="4" fill="#9a9a9a"/><circle cx="1712" cy="248" r="3" fill="#9a9a9a"/><circle cx="1860" cy="247" r="4" fill="#9a9a9a"/>';
    o += '<rect x="1656" y="88" width="260" height="162" fill="transparent"/></g>';

    // lamps
    [710, 985, 1290, 1520, 1780].forEach((x, i) => {
      if (i === 1 && reno.stage >= 5) { o += `<path d="M${x},70 V84" stroke="#c9a24a" stroke-width="1.5"/><path d="M${x - 18},90 Q${x},100 ${x + 18},90 M${x - 18},90 v-4 M${x + 18},90 v-4 M${x},90 v-6" stroke="#c9a24a" stroke-width="2" fill="none"/><circle cx="${x - 18}" cy="84" r="2.5" fill="#ffe7a0"/><circle cx="${x + 18}" cy="84" r="2.5" fill="#ffe7a0"/><circle cx="${x}" cy="82" r="2.5" fill="#ffe7a0"/>`; return; }
      o += `<path d="M${x},70 V88" stroke="#222" stroke-width="1"/><path d="M${x - 9},96 L${x - 4},88 H${x + 4} L${x + 9},96Z" fill="#2b2b30"/>`;
    });
    o += `<rect data-hs="lawn" x="0" y="196" width="384" height="66" fill="transparent"/><rect data-hs="aviary" x="386" y="104" width="168" height="146" fill="transparent"/>`;
    // furniture
    const placed = (S.decor && S.decor.placed) || {};
    Object.keys(placed).forEach((sk) => {
      const key = placed[sk], pos = SLOT_POS[sk];
      if (!pos || !DECOR_ART[key]) return;
      o += `<g id="h-dc-${sk}" class="dc dc-${key}" data-hs="decor:${sk}" transform="translate(${pos[0]},${pos[1]})">${DECOR_ART[key](S, lit)}</g>`;
    });
    // lawn hotspot (behind hero)


    // ---- hero ----
    o += `<g id="h-hero" data-hs="hero"><g class="pose">${Art.rig(S.look, Art.itemsOf(S))}</g></g>`;

    // ---- front layer ----
    o += `<g class="sway" pointer-events="none"><path d="${grassPath(0, 560, lawnH, 5, 17)}" fill="#5c9142"/></g>`;
    if (st('lawn') === 2) { const r = seeded(5); let f = ''; for (let i = 0; i < 9; i++) { const x = 10 + r() * 540, h = 26 + r() * 22; f += `<path d="M${x},250 Q${x + 2},${250 - h / 2} ${x + 1},${250 - h}" stroke="#4a7a2e" stroke-width="1.3" fill="none"/><circle cx="${x + 1}" cy="${250 - h}" r="2.6" fill="${r() < 0.5 ? '#f2d24a' : '#f2f2f2'}"/>`; } o += `<g pointer-events="none">${f}</g>`; }
    o += blanket('h-blF', ' style="display:none" pointer-events="none"');
    o += '<g id="h-zzz" class="zzz" style="display:none" pointer-events="none"><text x="1440" y="196">z</text><text x="1448" y="186" class="z2">z</text><text x="1457" y="174" class="z3">Z</text></g>';
    // night
    if (sky.night > 0) {
      o += `<rect x="0" y="0" width="${W}" height="${HT}" fill="#0a0820" opacity="${sky.night}" pointer-events="none"/>`;
      if (lit) [710, 985, 1290, 1520, 1780].forEach((x) => { o += `<circle cx="${x}" cy="120" r="80" fill="url(#hGlow)" pointer-events="none"/>`; });
    }
    o += '<g id="h-bubble" style="display:none" pointer-events="none"><rect rx="7" fill="#fbf6ea" stroke="#2b2430" stroke-width="1"/><path fill="#fbf6ea" stroke="#2b2430" stroke-width="1"/><text font-size="10.5" fill="#241d2a" font-family="system-ui, sans-serif"></text></g>';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${HT}" class="scene">${Art.DEFS}${o}</svg>`;
  }

  // ---------- simulation ----------
  const sim = { x: null, dir: 1, mode: 'act', act: 'couch', tx: 0, until: 0, pose: 'sit', y: -14, speed: 52, bubbleUntil: 0, pending: null, last: 0 };
  let el = null, svg = null, raf = 0, k = 1, camX = 0, freeUntil = 0, camGoal = null, H = {}, ctx = {}, refs = {}, drag = null, opts = {};

  function pickAct() {
    const ws = weights(H, ctx).filter((w) => w[1] > 0 && w[0] !== sim.act);
    let total = ws.reduce((a, w) => a + w[1], 0), r = Math.random() * total;
    for (let i = 0; i < ws.length; i++) { r -= ws[i][1]; if (r < 0) return ws[i][0]; }
    return 'couch';
  }

  function go(act, now, say) {
    leave(sim.act);
    sim.act = act;
    sim.mode = 'walk';
    sim.pose = 'stand';
    sim.y = 0;
    sim.say = say || null;
    const a = getAct(act);
    sim.tx = act === 'wander' ? 30 + Math.random() * (W - 60) : a.x;
    sim.speed = Math.abs(sim.tx - sim.x) > 500 || say ? 120 : 52;
    setTool(null);
  }

  function arrive(now) {
    const a = getAct(sim.act);
    sim.mode = 'act';
    sim.pose = a.pose || 'stand';
    sim.y = a.y || 0;
    if (a.dir) sim.dir = a.dir;
    const night = ctx.sleepy && sim.act === 'bed';
    const d = night ? [60, 120] : a.dur || [7, 12];
    sim.until = now + d[0] + Math.random() * (d[1] - d[0]);
    enter(sim.act);
    if (sim.say) { say(sim.say, now, 3.8); sim.say = null; } else if (Math.random() < 0.55) say(quip(sim.act, H), now, 3.4);
  }

  const TOOLS = {
    hammer: '<rect x="-1" y="-1" width="2" height="11" fill="#7a5a3a"/><rect x="-4.5" y="8" width="9" height="4" rx="1" fill="#777"/>',
    spatula: '<rect x="-.8" y="-1" width="1.6" height="10" fill="#333"/><rect x="-3" y="8" width="6" height="4" rx="1" fill="#999"/>',
    can: '<rect x="-4" y="2" width="8" height="8" rx="1.5" fill="#4a8a5a"/><path d="M4,4 L10,1" stroke="#4a8a5a" stroke-width="1.6"/><path d="M-2,2 Q0,-2 2,2" stroke="#4a8a5a" stroke-width="1" fill="none"/>',
  };
  const PROPS = {
    book: '<path d="M-8,-33 L0,-31 L8,-33 L8,-25 L0,-23 L-8,-25 Z" fill="#f2ead8" stroke="#8a3a3a" stroke-width="1.2"/><path d="M0,-31 V-23" stroke="#8a3a3a" stroke-width=".8"/><path d="M-6,-30 h4 M-6,-28 h4 M2,-30 h4 M2,-28 h4" stroke="#aaa" stroke-width=".5"/>',
    drink: '<path d="M1.5,-36 h6 l-1,8 h-4 Z" fill="#e8a83a" opacity=".85"/><rect x="1.5" y="-37" width="6" height="2" fill="#fff"/><path d="M6,-37 l2,-5" stroke="#d8443a" stroke-width="1"/>',
    shades: '<rect x="-9" y="-60" width="7.5" height="4.5" rx="1.5" fill="#111"/><rect x="1.5" y="-60" width="7.5" height="4.5" rx="1.5" fill="#111"/><path d="M-1.5,-58.5 h3" stroke="#111" stroke-width="1"/>',
    barbell: '<rect x="-30" y="-47" width="60" height="2.5" fill="#bbb"/><rect x="-31" y="-56" width="5" height="20" rx="1" fill="#333"/><rect x="26" y="-56" width="5" height="20" rx="1" fill="#333"/>',
    sleep: '<path d="M-7.5,-57.5 Q-5,-55.5 -2.5,-57.5 M2.5,-57.5 Q5,-55.5 7.5,-57.5" stroke="#1b1418" stroke-width="1.2" fill="none"/>',
    guitar: '<g transform="translate(-1,-29) rotate(-38)"><rect x="-1.2" y="-24" width="2.4" height="18" fill="#5a3d28"/><circle cx="0" cy="-3" r="5" fill="#c07a3a"/><circle cx="0" cy="3.5" r="6.2" fill="#c07a3a"/><circle cx="0" cy="-.5" r="1.7" fill="#2a1a10"/></g>',
  };
  function setTool(tool, prop) {
    if (!refs.tool) return;
    refs.tool.innerHTML = tool ? TOOLS[tool] : '';
    if (refs.wpn) refs.wpn.style.display = tool || prop === 'barbell' || prop === 'book' || prop === 'guitar' ? 'none' : '';
    refs.prop.innerHTML = prop ? (Array.isArray(prop) ? prop.map((p) => PROPS[p]).join('') : PROPS[prop]) : '';
    if (refs.face) refs.face.style.display = prop === 'sleep' ? 'none' : '';
  }

  function enter(act) {
    if (!refs.hero) return;
    const a = getAct(act).anim;
    if (act === 'fridge' && refs.fdoor) refs.fdoor.classList.add('open');
    if (act === 'couch' && refs.tv) refs.tv.classList.add('on');
    if (act === 'cook' && refs.steam) refs.steam.classList.add('on');
    if (a === 'cook') setTool('spatula');
    if (a === 'hammer') setTool('hammer');
    if (a === 'water') setTool('can');
    if (a === 'read') { setTool(null, 'book'); if (act === 'desk' && refs.dlamp) refs.dlamp.classList.add('on'); }
    if (a === 'chill') setTool(null, ctx.day ? ['drink', 'shades'] : 'drink');
    if (a === 'squat') { setTool(null, 'barbell'); if (refs.bar) refs.bar.style.display = 'none'; }
    if (a === 'sleep') { setTool(null, 'sleep'); refs.blF.style.display = ''; refs.zzz.style.display = ''; }
    if (a === 'nap') setTool(null, 'sleep');
    if (a === 'strum') setTool(null, 'guitar');
    if (act.slice(0, 2) === 'd:' && refs.decor[act]) refs.decor[act].classList.add('active');
  }
  function leave(act) {
    if (!refs.hero) return;
    if (refs.fdoor) refs.fdoor.classList.remove('open');
    if (refs.tv) refs.tv.classList.remove('on');
    if (refs.steam) refs.steam.classList.remove('on');
    if (refs.bar) refs.bar.style.display = '';
    if (refs.blF) refs.blF.style.display = 'none';
    if (refs.zzz) refs.zzz.style.display = 'none';
    if (refs.dlamp && act === 'desk' && !ctx.lampOn) refs.dlamp.classList.remove('on');
    Object.keys(refs.decor || {}).forEach((k) => refs.decor[k].classList.remove('active'));
    setTool(null);
  }

  function say(text, now, secs) {
    if (!refs.bubble) return;
    const b = refs.bubble, t = b.querySelector('text');
    t.textContent = text;
    b.style.display = '';
    const w = Math.min(220, t.getComputedTextLength() + 16);
    b.querySelector('rect').setAttribute('width', w);
    b.querySelector('rect').setAttribute('height', 20);
    sim.bubbleW = w;
    sim.bubbleUntil = now + secs;
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!refs.hero) return;
    const now = ts / 1000;
    const dt = Math.min(0.05, sim.last ? now - sim.last : 0.016);
    sim.last = now;

    if (sim.pending) { const f = sim.pending; sim.pending = null; go(REACT[f] || 'wander', now, HAPPY[f]); }
    if (sim.mode === 'walk') {
      const dx = sim.tx - sim.x;
      if (Math.abs(dx) < 2) arrive(now);
      else { sim.dir = dx > 0 ? 1 : -1; sim.x += Math.sign(dx) * Math.min(Math.abs(dx), sim.speed * dt); }
    } else if (now > sim.until) {
      go(pickAct(), now);
    }

    // pose + animation
    const t = now, run = sim.speed > 60;
    let lL = '', lR = '', up = '', aL = 6, aR = -6, faceX = 0, rigT = '', armScale = '';
    const breath = Math.sin(t * 2.2) * 0.6;
    if (sim.mode === 'walk') {
      const f = run ? 15 : 9, p = Math.sin(t * f), lift = run ? 4 : 2.8;
      lL = `translate(0,${(-Math.max(0, p) * lift).toFixed(2)})`;
      lR = `translate(0,${(-Math.max(0, -p) * lift).toFixed(2)})`;
      up = `translate(0,${(-Math.abs(Math.sin(t * f)) * (run ? 2 : 1.3)).toFixed(2)})`;
      aL = 10 + p * (run ? 18 : 10); aR = -10 + p * (run ? 18 : 10); faceX = 2.4;
    } else {
      const a = getAct(sim.act).anim;
      up = `translate(0,${breath.toFixed(2)})`;
      if (sim.pose === 'sit') {
        const legs = 'translate(0,8) translate(0,-22) scale(1,.55) translate(0,22)';
        lL = legs; lR = legs; up = `translate(0,${(8 + breath).toFixed(2)})`;
      }
      if (sim.pose === 'lie') { rigT = 'rotate(-90)'; up = ''; }
      if (a === 'chill') { aR = 30; aL = 14; }
      else if (a === 'warm') { aL = -28; aR = 28; faceX = 1.5; }
      else if (a === 'gaze') { aR = -70; aL = 8; faceX = 2.4; }
      else if (a === 'water') { aR = -55 + Math.sin(t * 3) * 6; faceX = 2.4; }
      else if (a === 'strum') { aL = -12; aR = 22 + Math.sin(t * 14) * 10; }
      else if (a === 'play') { aL = -28 + Math.sin(t * 15) * 6; aR = 28 + Math.sin(t * 13 + 1) * 6; faceX = 2.4; }
      else if (a === 'admire') { aR = -20; aL = 10; }
      else if (a === 'dance') {
        const p = Math.sin(t * 7);
        lL = `translate(0,${(-Math.max(0, p) * 4).toFixed(2)})`; lR = `translate(0,${(-Math.max(0, -p) * 4).toFixed(2)})`;
        up = `translate(0,${(-Math.abs(p) * 3).toFixed(2)})`; aL = 90 + p * 70; aR = -90 + p * 70;
        sim.dir = Math.sin(t * 1.7) > 0 ? 1 : -1;
      }
      else if (a === 'hips') { aL = 32; aR = -32; }
      else if (a === 'wave') { aR = -140 + Math.sin(t * 9) * 22; faceX = 1.5; }
      else if (a === 'fridge') { aR = -52; faceX = 2.4; }
      else if (a === 'cook') { aR = -55 + Math.sin(t * 7) * 9; faceX = 2.4; }
      else if (a === 'hammer') { aR = -95 + Math.sin(t * 11) * 32; faceX = 2.4; }
      else if (a === 'reach') { aR = -150 + Math.sin(t * 2) * 8; faceX = 2; }
      else if (a === 'read') { aL = -36; aR = 36; }
      else if (a === 'rummage') { aL = 26 + Math.sin(t * 8) * 16; aR = -26 - Math.sin(t * 8 + 1.3) * 16; up = `translate(0,${(2 + Math.abs(Math.sin(t * 8)) * 1.5).toFixed(2)})`; faceX = 2; }
      else if (a === 'squat') {
        const s = (Math.sin(t * 2.6) + 1) / 2, sq = 1 - 0.3 * s;
        lL = `scale(1,${sq.toFixed(3)})`; lR = lL; up = `translate(0,${(22 * 0.3 * s).toFixed(2)})`;
        aL = 100; aR = -100;
      } else if (a === 'punch') {
        const ph = (t * 2.4) % 1, jab = ph < 0.22;
        aR = jab ? -96 : -34; aL = 34; faceX = 2.4;
        if (jab && !sim.jabbed && refs.bag) { sim.jabbed = true; refs.bag.classList.remove('hit'); void refs.bag.getBBox(); refs.bag.classList.add('hit'); }
        if (!jab) sim.jabbed = false;
      }
    }
    refs.lgL.setAttribute('transform', lL);
    refs.lgR.setAttribute('transform', lR);
    refs.up.setAttribute('transform', up);
    refs.arL.setAttribute('transform', `translate(${-refs.sx},-41) rotate(${aL.toFixed(1)})${armScale}`);
    refs.arR.setAttribute('transform', `translate(${refs.sx},-41) rotate(${aR.toFixed(1)})${armScale}`);
    if (refs.face) refs.face.setAttribute('transform', `translate(${faceX},0)`);
    refs.pose.setAttribute('transform', rigT);
    refs.hero.setAttribute('transform', `translate(${sim.x.toFixed(1)},${FL + sim.y}) scale(${sim.pose === 'lie' ? 1 : sim.dir},1)`);

    // bubble
    if (sim.bubbleUntil && now > sim.bubbleUntil) { refs.bubble.style.display = 'none'; sim.bubbleUntil = 0; }
    if (sim.bubbleUntil) {
      const bw = sim.bubbleW || 60;
      let hx = sim.pose === 'lie' ? sim.x - 58 : sim.x, hy = FL + sim.y - (sim.pose === 'sit' ? 98 : 106);
      if (sim.pose === 'lie') hy = FL - 82;
      const bx = Math.max(4, Math.min(W - bw - 4, hx - bw / 2));
      refs.bubble.querySelector('rect').setAttribute('x', bx.toFixed(1));
      refs.bubble.querySelector('rect').setAttribute('y', hy.toFixed(1));
      refs.bubble.querySelector('text').setAttribute('x', (bx + 8).toFixed(1));
      refs.bubble.querySelector('text').setAttribute('y', (hy + 13.5).toFixed(1));
      const tx = Math.max(bx + 8, Math.min(bx + bw - 8, hx));
      refs.bubble.querySelector('path').setAttribute('d', `M${(tx - 4).toFixed(1)},${(hy + 19.4).toFixed(1)} L${tx.toFixed(1)},${(hy + 26).toFixed(1)} L${(tx + 4).toFixed(1)},${(hy + 19.4).toFixed(1)}Z`);
    }

    // camera
    const viewW = el.clientWidth / k;
    const maxCam = Math.max(0, W - viewW);
    if (!drag) {
      if (camGoal != null) { camX += (camGoal - camX) * Math.min(1, dt * 5); if (Math.abs(camGoal - camX) < 1) camGoal = null; }
      else if (now > freeUntil) camX += (sim.x - viewW / 2 - camX) * Math.min(1, dt * 2.5);
    }
    camX = Math.max(0, Math.min(maxCam, camX));
    svg.style.transform = `translate3d(${(-camX * k).toFixed(1)}px,0,0)`;
  }

  // ---------- input ----------
  function onDown(e) { drag = { x0: e.clientX, cam0: camX, moved: false }; try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
  function onMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved) { camX = drag.cam0 - dx / k; camGoal = null; freeUntil = performance.now() / 1000 + 6; }
  }
  function onUp(e) {
    const d = drag; drag = null;
    if (!d || d.moved) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const hs = hit && hit.closest && hit.closest('[data-hs]');
    if (!hs) return;
    const key = hs.getAttribute('data-hs');
    if (key === 'hero') {
      const worst = Object.keys(H).filter((x) => H[x].linked && H[x].state === 2);
      const pickK = worst.length ? worst[Math.floor(Math.random() * worst.length)] : null;
      const actFor = { lawn: 'chill', fridge: 'fridge', dishes: 'sink', laundry: 'laundry', birds: 'birds', aviary: 'birds', gym: 'lift', study: 'desk' };
      say(pickK ? quip(actFor[pickK] || 'wander', H) : ['All good here, boss.', 'Living the dream.', 'Need something?'][Math.floor(Math.random() * 3)], performance.now() / 1000, 3.4);
      return;
    }
    if (opts.onFeature) opts.onFeature(key);
  }

  // ---------- public ----------
  function mount(container, S, homeState, o) {
    unmount();
    opts = o || {};
    H = homeState;
    const hour = new Date().getHours();
    ctx = { sleepy: hour >= 23 || hour < 5, day: hour >= 8 && hour < 18, lampOn: skyFor(hour).night > 0.15, night: hour >= 19 || hour < 5 };
    DACTS = {};
    const placed = (S.decor && S.decor.placed) || {};
    Object.keys(placed).forEach((sk) => {
      const a = DECOR_ACT[placed[sk]], pos = SLOT_POS[sk];
      if (a && pos) DACTS['d:' + sk] = Object.assign({}, a, { x: pos[0] + a.dx });
    });
    if (sim.act && sim.act.slice(0, 2) === 'd:' && !DACTS[sim.act]) { sim.act = 'wander'; sim.mode = 'act'; sim.until = 0; sim.pose = 'stand'; sim.y = 0; }
    el = container;
    el.innerHTML = build(S, H, hour);
    svg = el.querySelector('svg');
    const h = el.clientHeight || 290;
    k = h / HT;
    svg.style.height = h + 'px';
    svg.style.width = W * k + 'px';
    const q = (s) => el.querySelector(s);
    refs = {
      hero: q('#h-hero'), pose: q('#h-hero .pose'), lgL: q('#h-hero .lgL'), lgR: q('#h-hero .lgR'), up: q('#h-hero .up'),
      arL: q('#h-hero .arL'), arR: q('#h-hero .arR'), face: q('#h-hero .face'), prop: q('#h-hero .prop'), tool: q('#h-hero .tool'), wpn: q('#h-hero .wpn'),
      bubble: q('#h-bubble'), fdoor: q('#h-fdoor'), tv: q('#h-tv'), steam: q('#h-steam'), dlamp: q('#h-dlamp'), bar: q('#h-bar'), bag: q('#h-bag'),
      blF: q('#h-blF'), zzz: q('#h-zzz'), decor: {},
    };
    el.querySelectorAll('.dc').forEach((g) => { refs.decor['d:' + g.id.slice(5)] = g; });
    refs.sx = parseFloat(/translate\(([-\d.]+)/.exec(refs.arR.getAttribute('transform'))[1]);
    const now = performance.now() / 1000;
    if (sim.x == null) {
      let first = ctx.sleepy ? 'bed' : pickAct();
      if (first === 'wander') first = 'couch';
      sim.act = first; sim.x = getAct(first).x; sim.mode = 'walk'; sim.tx = sim.x;
      camX = Math.max(0, sim.x - el.clientWidth / k / 2);
    } else if (sim.mode === 'act') {
      enter(sim.act);
    }
    sim.bubbleUntil = 0;
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', () => { drag = null; });
    sim.last = 0;
    raf = requestAnimationFrame(frame);
  }

  function unmount() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (el) { el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); }
    el = null; svg = null; refs = {};
  }

  function focus(roomKey) {
    const r = ROOMS.find((x) => x.k === roomKey);
    if (!r || !el) return;
    const viewW = el.clientWidth / k;
    camGoal = Math.max(0, Math.min(W - viewW, (r.x0 + r.x1) / 2 - viewW / 2));
    freeUntil = performance.now() / 1000 + 8;
  }

  function react(feature) { if (feature) sim.pending = feature; }
  function pause() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function resume() { if (el && !raf) { sim.last = 0; raf = requestAnimationFrame(frame); } }

  // Testing hook: send the hero straight to an activity.
  function _go(act, teleport) { const now = performance.now() / 1000; go(act, now); if (teleport) sim.x = sim.tx; }

  root.Home = { mount, unmount, focus, react, pause, resume, ROOMS, _go, decorSvg, SLOT_POS };
})(typeof window !== 'undefined' ? window : globalThis);
