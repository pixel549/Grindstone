/* Grindstone — the delve. One run a day into a dungeon that only gets harder once its boss falls.
 * Everything here is deterministic: the same dungeon, gear, buffs and orders always play out the same way,
 * so a loss always tells you something. Only the scenery (flavour lines, and later the 3D rooms) changes per attempt. */
(function (root) {
  'use strict';
  const G = root.G;
  const STATS = G.STATS;

  // ---------- seeded randomness ----------
  function rngOf(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const R = Math.round;
  // the text is written for 'he'; a heroine gets it swapped
  const SHE = { He: 'She', he: 'she', His: 'Her', his: 'her', Him: 'Her', him: 'her' };
  const pron = (f, t) => (f && typeof t === 'string' ? t.replace(/\b(He|he|His|his|Him|him)\b/g, (w) => SHE[w]) : t);

  // ---------- elements, weapon kinds, enemy kinds ----------
  const ELEMENTS = {
    fire: { n: 'Fire', i: '🔥' }, frost: { n: 'Frost', i: '❄️' }, storm: { n: 'Storm', i: '⚡' }, rot: { n: 'Rot', i: '☠️' }, holy: { n: 'Holy', i: '✨' },
  };
  const EL_KEYS = Object.keys(ELEMENTS);
  // 2.20.1: what elements do, in one place, so the item text and the fight never disagree
  const ELEM_TUNE = { res: 0.3, weak: 1.6, same: 0.5 };
  const pct = (x) => Math.round(x * 100);
  // An item's element, said plainly. long: [title, explanation]; otherwise a few words for a list row.
  function elemText(it, long) {
    if (!it) return long ? null : '';
    const E = ELEMENTS[it.el || it.res]; if (!E) return long ? null : '';
    const n = E.n.toLowerCase();
    if (it.el) return long ? [E.i + ' ' + E.n + ' weapon', pct(ELEM_TUNE.weak - 1) + '% more damage in dungeons weak to ' + n + ', half damage against ' + n + ' foes'] : E.i + ' ' + n + ' weapon';
    return long ? [E.i + ' ' + pct(ELEM_TUNE.res) + '% ' + n + ' resistance', n.charAt(0).toUpperCase() + n.slice(1) + ' attacks do ' + pct(ELEM_TUNE.res) + '% less to him. Two pieces resisting ' + n + ' don’t add up'] : E.i + ' ' + pct(ELEM_TUNE.res) + '% ' + n + ' resist';
  }
  // What each weapon type is good at. Item.art is the weapon type.
  const KINDS = {
    blade: { n: 'Blade', perk: 'Bleeds', blurb: 'Hits beasts and brutes harder; glances off armour', verb: 'cut down', good: ['beast', 'brute'], bad: ['armoured'] },
    axe: { n: 'Axe', perk: 'Cleaves', blurb: 'Its weapon art cleaves every foe at once', verb: 'cleaved through', good: ['swarm'], bad: [] },
    blunt: { n: 'Blunt', perk: 'Crushes', blurb: 'Smashes through armour', verb: 'smashed', good: ['armoured'], bad: ['flier'] },
    polearm: { n: 'Polearm', perk: 'Reach', blurb: 'Strikes first; good against fliers', verb: 'skewered', good: ['flier'], bad: [] },
    staff: { n: 'Staff', perk: 'Spells', blurb: 'Casts with INT from range; costs MP', verb: 'blasted', good: ['flier', 'caster'], bad: [] },
    fists: { n: 'Fists', perk: '—', blurb: 'Better than nothing. Barely.', verb: 'punched out', good: [], bad: [] },
  };
  const TAGS = { swarm: 'Swarm', flier: 'Flier', armoured: 'Armoured', brute: 'Brute', beast: 'Beast', caster: 'Caster', undead: 'Undead' };

  // ---------- dungeons ----------
  // mobs: [name, tags, hp ×, atk ×, how many]
  // 2.22: thirteen of them (was seven), so a lap is thirteen dungeons. 2.23: six bosses each (was three): each lap meets the
  // next, so 78 dungeons go by before one comes back, Reborn (about a year at a dungeon every three or four days, then one a week). vis is how a boss looks in the crawl: a baked sprite and a
  // tint (delve2d.js MOBVIS does the same for the rank and file). mt, when set, is how its trick reads.
  const THEMES = [
    { k: 'crypt', name: 'the Sunken Crypt', el: 'rot', weak: 'holy', icon: '⚰️',
      mobs: [['Grave Whelps', ['swarm', 'undead'], 0.35, 0.45, 4], ['Bone Sentry', ['armoured', 'undead'], 1.3, 0.9, 1], ['Ossuary Rats', ['swarm', 'beast'], 0.25, 0.4, 5], ['Shroud Wisps', ['flier', 'caster'], 0.6, 1.0, 2], ['Crypt Knight', ['armoured', 'undead', 'brute'], 1.8, 1.1, 1], ['Ghouls', ['undead', 'brute'], 1.1, 1.0, 2]],
      bosses: [
        { names: ['Fichbret', 'Gaunt Aldous', 'Wretchel', 'Old Mother Cairn'], ep: ['the Cannibal', 'the Unburied', 'Who Gnaws', 'of the Last Bell'], tags: ['undead', 'brute'], mech: 'adds', add: 'Grave Whelps', rise: 'claws up out of a heap of bones', vis: ['zking'] },
        { names: ['Abbot Mordaunt', 'Prior Vell', 'the Bone Abbot'], ep: ['of the Ossuary', 'Who Counts the Dead', 'the Hollow Saint'], tags: ['undead', 'caster'], mech: 'poison', rise: 'sits up in a reliquary of skulls', vis: ['boneabbot'] },
        { names: ['Sexton Morrow', 'Old Digby', 'Mattock Jonas'], ep: ['the Gravedigger', 'Who Buries the Living', 'of the Open Pit'], tags: ['brute'], mech: 'enrage', rise: 'climbs out of a fresh grave, spade first', vis: ['gravedigger'] },
        { names: ['Bishop Rotgut', 'the Lich-Prior', 'Old Ossian'], ep: ['of the Last Rites', 'Who Will Not Stay Dead', 'the Ever-Praying'], tags: ['undead', 'caster'], mech: 'breath', mt: 'speaks a word of the grave every third round', rise: 'rises from a font of black water', vis: ['lich'] },
        { names: ['Gorm', 'the Ghoul King', 'Grisly Haddon'], ep: ['of the Feast Hall', 'Who Eats the Dead', 'the Gnawing'], tags: ['undead', 'brute'], mech: 'adds', add: 'Ghouls', rise: 'shoulders out of a mound of bones, chewing', vis: ['ghoulking'] },
        { names: ['the Widow Cairn', 'Mother Black', 'Lady Mourne'], ep: ['in Black', 'Who Keeps the Vigil', 'of the Empty Grave'], tags: ['caster'], mech: 'poison', mt: 'weeps, and her grief eats at him every round', rise: 'stands up from beside a fresh grave', vis: ['widow'] }],
      walk: ['Candles gutter in their niches.', 'Water drips through the ossuary.', 'A bell tolls somewhere below.', 'The dead here were not buried tidily.', 'Something scratches behind the walls.', 'The stairs are slick with grave-damp.'] },
    { k: 'hold', name: 'the Brigands’ Hold', el: 'fire', weak: 'storm', icon: '🗡️',
      mobs: [['Bandits', ['swarm'], 0.45, 0.6, 3], ['Cutthroats', ['swarm'], 0.55, 0.85, 2], ['Hired Thug', ['brute'], 1.6, 1.1, 1], ['Sellsword', ['armoured'], 1.4, 1.0, 1], ['Poisoner', ['caster'], 0.8, 1.3, 1], ['Watch Dogs', ['beast', 'swarm'], 0.35, 0.5, 3]],
      bosses: [
        { names: ['Black Garret', 'Duke Rook', 'Hal Ransom'], ep: ['the Bandit King', 'of the Long Knives', 'Who Takes a Tithe'], tags: ['brute', 'armoured'], mech: 'adds', add: 'Bandits', rise: 'kicks over the counting table and draws', vis: ['brigandking'] },
        { names: ['Red Meg', 'Scarlet Annis', 'One-Eyed Bel'], ep: ['the Corsair', 'of the Gallows Tide', 'Who Never Hangs'], tags: ['brute'], mech: 'enrage', rise: 'swings down from the rafters on a rope', vis: ['redmeg'] },
        { names: ['Master Quill', 'Silas Vane', 'Smiling Jack Penny'], ep: ['the Fence', 'Who Buys Anything', 'of the False Bottom'], tags: ['caster'], mech: 'poison', mt: 'has poisoned the blade, and it burns a little more every round', rise: 'steps out from behind a wall of stolen goods', vis: ['fence', '#6a5a7a'] },
        { names: ['Iron Jaw', 'Big Marrow', 'Harrow'], ep: ['the Warlord', 'Who Never Yields', 'of the Broken Gate'], tags: ['armoured', 'brute'], mech: 'enrage', rise: 'drags his halberd off the wall rack', vis: ['warlord'] },
        { names: ['Captain Vasque', 'Salt Annie', 'Lark'], ep: ['the Smuggler', 'of the Night Tide', 'Who Was Never Here'], tags: ['brute'], mech: 'adds', add: 'Cutthroats', rise: 'whistles, and the cutthroats come running', vis: ['smuggler'] },
        { names: ['Oldfang', 'Grey Hob', 'the Reaver'], ep: ['the Wolf-Headed', 'Who Howls at Noon', 'of the Burnt Farms'], tags: ['beast', 'brute'], mech: 'breath', mt: 'howls, and the walls shake every third round', rise: 'leaps down from the loft', vis: ['oldfang'] }],
      walk: ['Torches gutter in iron brackets.', 'Someone left a card game half played.', 'Stolen goods are stacked to the ceiling.', 'A ledger lists names and sums. His is not on it yet.', 'Dice rattle somewhere ahead, then stop.', 'The ale here has gone to vinegar.'] },
    { k: 'frost', name: 'the Frostmire', el: 'frost', weak: 'fire', icon: '❄️',
      mobs: [['Rime Wolves', ['beast', 'swarm'], 0.5, 0.6, 3], ['Frost Troll', ['brute', 'beast'], 2.0, 1.2, 1], ['Icebound Husks', ['undead', 'armoured'], 0.9, 0.7, 2], ['Snow Harpies', ['flier'], 0.5, 0.8, 3], ['Ice Reavers', ['armoured'], 1.3, 1.0, 2]],
      bosses: [
        { names: ['Hrimgar', 'Old Skarth', 'Grumhild'], ep: ['the Hollow-Eyed', 'of the White Hunger', 'the Thawless'], tags: ['brute', 'beast'], mech: 'breath', rise: 'unfolds from the glacier wall', vis: ['troll', '#6f9cc8'] },
        { names: ['Ysolde', 'Mother Glaze', 'the Rime Queen'], ep: ['the Thawless', 'of the Long Night', 'Who Freezes Tears'], tags: ['caster'], mech: 'breath', mt: 'calls down a blizzard every third round', rise: 'steps out of a pillar of ice', vis: ['winterwitch'] },
        { names: ['Fenra', 'Old Whitefang', 'the Pale Hunter'], ep: ['of the White Hunger', 'Who Runs the Ridge', 'the Starving'], tags: ['beast', 'brute'], mech: 'adds', add: 'Rime Wolves', rise: 'lopes out of the blizzard, the pack behind her', vis: ['whitewolf'] },
        { names: ['the Ice Bull', 'Hornhild', 'Old Rime'], ep: ['of the Glacier', 'Who Breaks the Thaw', 'the Frost-Horned'], tags: ['beast', 'brute'], mech: 'enrage', rise: 'charges out of a wall of ice', vis: ['icebull'] },
        { names: ['Jarl Ulfric', 'Jarl Svana', 'Frostbeard'], ep: ['of the Ice Hall', 'Who Rules the Winter', 'the Unthawed'], tags: ['armoured', 'brute'], mech: 'adds', add: 'Ice Reavers', rise: 'rises from his frozen throne', vis: ['jarl'] },
        { names: ['the Rime Revenant', 'Sir Hoar', 'Kald'], ep: ['Who Froze at His Post', 'of the White Watch', 'the Glass-Eyed'], tags: ['undead', 'armoured'], mech: 'poison', mt: 'lets the cold creep into him every round', rise: 'cracks out of a block of ice', vis: ['revenant'] }],
      walk: ['The ice groans underfoot.', 'His breath hangs in the air.', 'Frozen shapes stare out of the walls.', 'Wind howls through a crack overhead.', 'Icicles drop like daggers.', 'The cold gets into his joints.'] },
    { k: 'wood', name: 'the Witchwood', el: 'storm', weak: 'fire', icon: '🌲',
      mobs: [['Hexers', ['caster'], 0.8, 1.3, 2], ['Hare-folk', ['beast', 'swarm'], 0.4, 0.6, 3], ['Wolf-wives', ['beast'], 0.9, 1.0, 2], ['Woodwose', ['brute', 'beast'], 2.0, 1.1, 1], ['Will-o’-Wisps', ['flier', 'caster'], 0.5, 0.9, 3]],
      bosses: [
        { names: ['Mother Hagbane', 'Granny Thorn', 'Old Nan Moss'], ep: ['of the Crooked Hut', 'Who Bakes Bones', 'the Hexwife'], tags: ['caster'], mech: 'poison', mt: 'has hexed him, and the hex tightens every round', rise: 'hobbles out of the hut on her stick', vis: ['witchmother'] },
        { names: ['the Antlered Lady', 'Cerna', 'Hollin'], ep: ['of the Deep Wood', 'Who Hunts Hunters', 'the Horned'], tags: ['beast', 'brute'], mech: 'enrage', rise: 'steps out from between two trees that were not there', vis: ['antlered'] },
        { names: ['the Erl-King', 'King Alder', 'Oberic'], ep: ['of the Barrow Mound', 'Who Steals Children', 'the Thorn-Crowned'], tags: ['caster'], mech: 'adds', add: 'Will-o’-Wisps', rise: 'rises from a ring of toadstools', vis: ['erlking'] },
        { names: ['the Moon Wolf', 'Nightmane', 'Old Lupa'], ep: ['of the Silver Glade', 'Who Hunts by Moonlight', 'the Dark-Furred'], tags: ['beast', 'brute'], mech: 'adds', add: 'Wolf-wives', rise: 'steps out of a shaft of moonlight', vis: ['moonwolf'] },
        { names: ['the Hare Queen', 'Queen Thistle', 'Lady Longears'], ep: ['of the Warren Court', 'Who Runs the March', 'the Mad'], tags: ['beast', 'caster'], mech: 'poison', mt: 'has hexed him, and the hex tightens every round', rise: 'hops down from a toadstool throne', vis: ['harequeen'] },
        { names: ['the Green Knight', 'Sir Holly', 'the Verdant'], ep: ['of the Chapel Green', 'Who Grows Back', 'the Axe-Bearer'], tags: ['armoured', 'brute'], mech: 'enrage', rise: 'rides in out of the trees and dismounts', vis: ['greenknight'] }],
      walk: ['The trees lean in to listen.', 'A hut on chicken legs turns to watch him pass.', 'Lightning walks between the branches.', 'Someone has hung little bone charms from every bough.', 'The path he came by is gone.', 'A hare stops, stands up, and stares.'] },
    { k: 'fen', name: 'the Rotting Fen', el: 'rot', weak: 'fire', icon: '🦟',
      mobs: [['Bog Leeches', ['swarm', 'beast'], 0.25, 0.5, 6], ['Mire Hag', ['caster'], 0.9, 1.3, 1], ['Fly Swarm', ['swarm', 'flier'], 0.2, 0.35, 6], ['Reed Stalker', ['beast', 'brute'], 1.4, 1.0, 1], ['Bog Ratmen', ['beast', 'swarm'], 0.4, 0.6, 3]],
      bosses: [
        { names: ['Grumbelow', 'Nettlemaw', 'Old Gutsack'], ep: ['the Bloated', 'Who Waits', 'of the Sunken Path'], tags: ['brute', 'caster'], mech: 'poison', rise: 'heaves up out of the black water', vis: ['boar', '#5a3d2e'] },
        { names: ['Ssarakh', 'Mud-King Gul', 'Old Scale'], ep: ['of the Sunken Path', 'the Cold-Blooded', 'Who Swallows Whole'], tags: ['beast', 'brute'], mech: 'adds', add: 'Reed Stalker', rise: 'surges up out of the reeds', vis: ['lizardking'] },
        { names: ['Sister Sallow', 'Mother Murk', 'Wenna Bogwife'], ep: ['Who Waits', 'the Drowned Hag', 'of the Leech Pools'], tags: ['caster'], mech: 'breath', mt: 'spews marsh gas every third round', rise: 'rises dripping from the leech pool', vis: ['hexer', '#5f7a45'] },
        { names: ['the Marsh Queen', 'Queen Sseva', 'Lady Reed'], ep: ['of the Drowned Court', 'Who Sheds Her Skin', 'the Cold'], tags: ['beast', 'caster'], mech: 'adds', add: 'Bog Ratmen', rise: 'slides up out of the black pool', vis: ['marshqueen'] },
        { names: ['Bog-Gob', 'the Bog Troll', 'Muckle'], ep: ['Under the Bridge', 'Who Takes the Toll', 'the Mire-Fed'], tags: ['brute', 'beast'], mech: 'enrage', rise: 'heaves himself up out of the mud', vis: ['bogtroll'] },
        { names: ['the Mud-Drowned', 'Old Sump', 'Clay Tom'], ep: ['Who Sank', 'of the Sucking Bog', 'the Half-Buried'], tags: ['undead', 'brute'], mech: 'breath', mt: 'belches bog-gas every third round', rise: 'pulls himself out of the mud, piece by piece', vis: ['mudman', '#7a6a4a'] }],
      walk: ['The mud sucks at his boots.', 'Marsh lights drift just out of reach.', 'Something big slides under the water.', 'The reeds whisper his name. Probably the wind.', 'A dead tree creaks in no breeze.', 'The air tastes of rot.'] },
    { k: 'ward', name: 'the Plague Ward', el: 'rot', weak: 'fire', icon: '🧪',
      mobs: [['Plague Doctors', ['caster'], 0.9, 1.2, 2], ['Ratmen', ['beast', 'swarm'], 0.35, 0.55, 4], ['Bloated Dead', ['undead', 'brute'], 1.7, 1.0, 1], ['Orderlies', ['brute'], 1.1, 0.9, 2], ['Plague Flies', ['swarm', 'flier'], 0.2, 0.35, 6]],
      bosses: [
        { names: ['Doctor Vesalis', 'the Physician', 'Master Leech'], ep: ['Who Cures by Killing', 'of the Bone Saw', 'the Beaked'], tags: ['caster'], mech: 'poison', mt: 'has slipped something into him, and it works a little more every round', rise: 'snaps on a pair of gloves and turns from the slab', vis: ['thedoctor'] },
        { names: ['the Rat King', 'King Squall', 'Gnawbone'], ep: ['of a Thousand Tails', 'Who Spreads It', 'the Many'], tags: ['beast', 'caster'], mech: 'adds', add: 'Ratmen', rise: 'is carried in on a living tide of rats', vis: ['ratking'] },
        { names: ['Abbot Pustule', 'Brother Fester', 'the Pale Friar'], ep: ['the Bloated', 'of the Plague Pit', 'Who Blesses the Sick'], tags: ['brute', 'undead'], mech: 'enrage', rise: 'lurches up from the plague pit, praying', vis: ['abbot'] },
        { names: ['the Surgeon', 'Master Lancet', 'Doctor Graves'], ep: ['of the Cutting Room', 'Who Takes What He Needs', 'the Steady-Handed'], tags: ['caster'], mech: 'poison', mt: 'opened a vein, and it bleeds him every round', rise: 'sets down a bone saw and turns', vis: ['surgeon'] },
        { names: ['the Pig King', 'Lord Trotter', 'Swill'], ep: ['of the Slop Pits', 'Who Eats Anything', 'the Bloated'], tags: ['beast', 'brute'], mech: 'enrage', rise: 'heaves up off a throne of sacks', vis: ['pigking'] },
        { names: ['Sister Mercy', 'Mother Lye', 'Sister Agnes'], ep: ['of the Last Bed', 'Who Eases the Pain', 'the Quiet'], tags: ['caster'], mech: 'adds', add: 'Orderlies', rise: 'rings a little bell for the orderlies', vis: ['sistermercy'] }],
      walk: ['Every bed is full. None of them breathe.', 'The smell of vinegar and worse.', 'A bell rings for the cart. Bring out your dead.', 'Herbs hang from the rafters, doing nothing.', 'Chalk crosses on every door.', 'Something coughs in the next ward.'] },
    { k: 'forge', name: 'the Ashen Forge', el: 'fire', weak: 'frost', icon: '🔥',
      mobs: [['Ember Imps', ['swarm', 'flier'], 0.3, 0.6, 4], ['Slag Golem', ['armoured', 'brute'], 2.2, 1.0, 1], ['Cinder Hounds', ['beast'], 0.7, 0.9, 2], ['Forge Acolytes', ['caster'], 0.8, 1.2, 2], ['Forge Hands', ['brute'], 1.2, 1.0, 2]],
      bosses: [
        { names: ['Brazier-King Ost', 'Malleus', 'Old Clinker'], ep: ['the Unquenched', 'of the Red Anvil', 'Who Was Hammered'], tags: ['armoured', 'brute'], mech: 'enrage', rise: 'steps out of the furnace mouth', vis: ['minotaur', '#ff9a6a'] },
        { names: ['Master Kettleby', 'Bellows Bran', 'Old Tongs'], ep: ['the Bellows-Lunged', 'Who Never Cools', 'of the Last Ingot'], tags: ['brute', 'armoured'], mech: 'breath', mt: 'works the great bellows and blasts him every third round', rise: 'sets down one hammer and picks up a bigger one', vis: ['forgemaster'] },
        { names: ['the Smeltmother', 'Mother Crucible', 'Slagga'], ep: ['of the Pour', 'Who Melts the Brave', 'the Molten'], tags: ['caster'], mech: 'adds', add: 'Ember Imps', rise: 'rises from the crucible, still glowing', vis: ['paleabbess', '#ff7a3a'] },
        { names: ['the Brass Bull', 'Old Bellow', 'Taurus Ferrum'], ep: ['of the Great Furnace', 'Who Was Cast', 'the Red-Hot'], tags: ['armoured', 'beast'], mech: 'breath', mt: 'snorts fire every third round', rise: 'stamps out of the furnace, glowing', vis: ['brassbull'] },
        { names: ['Mother Anvil', 'Hilde Hammerhand', 'Old Ember'], ep: ['of the Last Forge', 'Who Shapes Steel', 'the Soot-Faced'], tags: ['brute'], mech: 'enrage', rise: 'wipes her hands and picks up the big hammer', vis: ['anvilmother'] },
        { names: ['the Ash King', 'King Cinder', 'Lord Clinker'], ep: ['of the Burnt Throne', 'Who Burned', 'the Smouldering'], tags: ['undead', 'armoured'], mech: 'adds', add: 'Ember Imps', rise: 'rises from a heap of ash', vis: ['ashking'] }],
      walk: ['The heat is a wall.', 'Molten iron crawls along a gutter.', 'Hammers ring with no one holding them.', 'Ash falls like grey snow.', 'His boots stick to the floor.', 'Something in the dark is still being forged.'] },
    { k: 'warren', name: 'the Orc Warrens', el: 'fire', weak: 'frost', icon: '🪓',
      mobs: [['Goblins', ['swarm'], 0.35, 0.5, 5], ['Orc Raiders', ['brute'], 1.2, 1.1, 2], ['Orc Spearwives', ['armoured'], 1.1, 1.0, 2], ['Wartotaur', ['brute', 'beast'], 2.2, 1.2, 1], ['Orc Shaman', ['caster'], 0.9, 1.3, 1]],
      bosses: [
        { names: ['Gorbag', 'Urzog Skullsplit', 'Grishna'], ep: ['the Warchief', 'of the Red Hand', 'Who Eats the Weak'], tags: ['brute', 'armoured'], mech: 'adds', add: 'Orc Raiders', rise: 'bellows, and the whole warren answers', vis: ['warchief'] },
        { names: ['King Snivvel', 'Grubnik the Great', 'Lord Nab'], ep: ['of the Shiny Pile', 'Who Counts Twice', 'the Magnificent'], tags: ['caster'], mech: 'poison', mt: 'nicked him with a dirty shiv, and it festers every round', rise: 'climbs down off a throne of stolen junk', vis: ['goblinking'] },
        { names: ['Brakka', 'Old Tusk', 'Hornbreaker'], ep: ['the Gorer', 'of the Bone Pit', 'Who Charges'], tags: ['beast', 'brute'], mech: 'enrage', rise: 'paws the ground and lowers a great pair of horns', vis: ['wartolord'] },
        { names: ['Queen Ugruk', 'Mother Tusk', 'Bloodhide'], ep: ['the Orc Queen', 'of the Red Hand', 'Who Rules the Warren'], tags: ['armoured', 'brute'], mech: 'adds', add: 'Orc Spearwives', rise: 'stands, and the warren goes quiet', vis: ['orcqueen'] },
        { names: ['Grizzleguts', 'Old Snot', 'Mother Gob'], ep: ['the Seer', 'Who Reads the Bones', 'of the Smoke Hut'], tags: ['caster'], mech: 'breath', mt: 'throws a bag of foul smoke every third round', rise: 'cackles out of a cloud of smoke', vis: ['goblinseer'] },
        { names: ['Grumm', 'the Troll King', 'Old Stonejaw'], ep: ['of the Deep Warren', 'Who Eats Orcs', 'the Unkillable'], tags: ['brute', 'beast'], mech: 'enrage', rise: 'ducks under the great arch', vis: ['trollking'] }],
      walk: ['The tunnels stink of smoke and meat.', 'Crude drawings of him, being eaten.', 'War drums, somewhere below.', 'Bones gnawed clean, sorted by size.', 'A goblin runs off squealing to tell someone.', 'Every doorway is too low for him and just right for them.'] },
    { k: 'vault', name: 'the Drowned Vault', el: 'frost', weak: 'storm', icon: '🌊',
      mobs: [['Brine Crabs', ['armoured', 'beast'], 0.8, 0.7, 3], ['Drowned Sailors', ['undead'], 0.8, 0.9, 3], ['Gull Fiends', ['flier', 'swarm'], 0.3, 0.5, 5], ['Kelp Witch', ['caster'], 1.0, 1.4, 1], ['Wreckers', ['brute'], 1.1, 1.0, 2]],
      bosses: [
        { names: ['Captain Weir', 'Old Tidelock', 'Bosun Grimm'], ep: ['the Drowned', 'of the Salt Throne', 'Who Pulls You Under'], tags: ['undead', 'brute'], mech: 'adds', add: 'Drowned Sailors', rise: 'surfaces from the flooded nave', vis: ['skelpirate'] },
        { names: ['Admiral Fathom', 'the Bellwether', 'Commodore Brine'], ep: ['Who Went Down With Her', 'of the Black Fleet', 'the Waterlogged'], tags: ['undead', 'armoured'], mech: 'breath', mt: 'fires a broadside every third round', rise: 'strides out of a wreck, cutlass first', vis: ['admiral'] },
        { names: ['Mother Wrack', 'the Sea Hag', 'Grandmother Tide'], ep: ['of the Kelp Halls', 'the Deep-Singer', 'Who Keeps the Drowned'], tags: ['caster'], mech: 'poison', mt: 'fills his lungs with brine, a little more every round', rise: 'rises out of the bilge on a column of kelp', vis: ['hexer', '#3a9a9a'] },
        { names: ['the Drowned King', 'King Fathom', 'Lord Tidewrack'], ep: ['of the Sunken Throne', 'Who Rules Below', 'the Salt-Crowned'], tags: ['undead', 'caster'], mech: 'adds', add: 'Drowned Sailors', rise: 'rises from the flooded throne room', vis: ['drownedking'] },
        { names: ['Dread Morwen', 'Captain Bones', 'Black Nell'], ep: ['of the Ghost Ship', 'Who Sails Without Wind', 'the Damned'], tags: ['undead', 'brute'], mech: 'enrage', rise: 'steps off a ship that isn’t there', vis: ['dreadcaptain'] },
        { names: ['the Deep One', 'Old Gill', 'Dagon’s Child'], ep: ['From Below', 'Who Remembers the Sea', 'the Gilled'], tags: ['beast', 'caster'], mech: 'poison', mt: 'fills his lungs with brine, a little more every round', rise: 'climbs up out of the cistern', vis: ['deepone'] }],
      walk: ['Sea water sloshes around his knees.', 'Barnacles crust the vault doors.', 'A drowned bell rings with the tide.', 'Gulls scream somewhere far above.', 'The walls weep salt.', 'He finds a ship in a room with no sea.'] },
    { k: 'keep', name: 'the Black Keep', el: 'frost', weak: 'holy', icon: '🏰',
      mobs: [['Men-at-Arms', ['armoured'], 0.9, 0.8, 3], ['Black Knight', ['armoured', 'brute'], 2.0, 1.2, 1], ['Squires', ['swarm'], 0.35, 0.5, 4], ['Chaplains', ['caster'], 0.8, 1.2, 2], ['Executioner', ['brute'], 1.8, 1.4, 1]],
      bosses: [
        { names: ['Sir Morcant', 'Castellan Grey', 'Lord Ashby'], ep: ['of the Iron Gate', 'Who Holds the Keep', 'the Unyielding'], tags: ['armoured', 'brute'], mech: 'adds', add: 'Men-at-Arms', rise: 'lowers a black visor and steps off the dais', vis: ['castellan'] },
        { names: ['Master Hood', 'Mortimer Block', 'Ned Ketch'], ep: ['the Headsman', 'Who Never Misses', 'of the Red Block'], tags: ['brute'], mech: 'enrage', rise: 'tests the axe’s edge with a thumb', vis: ['executioner', '#6a5060'] },
        { names: ['Prince Edric', 'Lord Ravenmoor', 'the Black Prince'], ep: ['the Oathbreaker', 'of the Burning Chapel', 'Who Would Be King'], tags: ['armoured', 'caster'], mech: 'breath', mt: 'brings down a cold black fire every third round', rise: 'rises from a stolen throne', vis: ['blackprince'] },
        { names: ['the Warden', 'Gaoler Brank', 'Master Keys'], ep: ['of the Black Cells', 'Who Holds the Keys', 'the Unbribable'], tags: ['armoured', 'brute'], mech: 'enrage', rise: 'locks the door behind him', vis: ['warden'] },
        { names: ['the Death Knight', 'Sir Mortain', 'Lord Ashgrave'], ep: ['of the Black Order', 'Who Rode at Dawn', 'the Unhorsed'], tags: ['undead', 'armoured'], mech: 'breath', mt: 'brings down a cold black fire every third round', rise: 'rises from a knight’s tomb in the chapel', vis: ['deathknight'] },
        { names: ['the Iron Queen', 'Queen Mordra', 'Lady Ravensfell'], ep: ['of the Black Throne', 'Who Would Rule', 'the Widowed'], tags: ['caster'], mech: 'adds', add: 'Men-at-Arms', rise: 'rises from the throne and calls her guard', vis: ['ironqueen'] }],
      walk: ['Black banners hang dead in still air.', 'Frost on the inside of the arrow slits.', 'Boots march somewhere overhead, in step.', 'The chapel has been turned to face the wrong way.', 'A gibbet creaks in the courtyard.', 'Every portrait has had its eyes scratched out.'] },
    { k: 'spire', name: 'the Stormspire', el: 'storm', weak: 'rot', icon: '⚡',
      mobs: [['Spark Kites', ['flier', 'swarm'], 0.3, 0.6, 4], ['Copper Warden', ['armoured'], 1.6, 1.0, 1], ['Storm Adepts', ['caster'], 0.9, 1.4, 2], ['Gargoyles', ['flier', 'armoured'], 1.0, 0.9, 2], ['Tower Guards', ['armoured'], 1.1, 0.9, 2]],
      bosses: [
        { names: ['Archon Volt', 'Thrumm', 'the Bellringer'], ep: ['of the Final Strike', 'the Overcharged', 'Who Hums'], tags: ['caster', 'armoured'], mech: 'breath', rise: 'descends in a column of lightning', vis: ['archon', '#3a5fb0'] },
        { names: ['Magister Coil', 'Lady Tempest', 'Volta'], ep: ['of the Copper Crown', 'Who Calls the Bolt', 'the Overcharged'], tags: ['caster'], mech: 'poison', mt: 'has charged the very air, and it crackles through him every round', rise: 'steps out of a crack of thunder', vis: ['winterwitch', '#7f8fff'] },
        { names: ['Gutterspout', 'the Grotesque', 'Old Lintel'], ep: ['of the High Ledge', 'Who Watches', 'the Stone-Winged'], tags: ['flier', 'armoured'], mech: 'enrage', rise: 'peels itself off the parapet', vis: ['gargoyle', '#5a5a66'] },
        { names: ['the Storm Lord', 'Magus Thrane', 'Old Thunder'], ep: ['of the Top Floor', 'Who Holds the Lightning', 'the Overcharged'], tags: ['caster'], mech: 'breath', mt: 'calls the lightning down every third round', rise: 'descends the spiral stair on a bolt', vis: ['stormlord'] },
        { names: ['the Clockwork Knight', 'Sir Gearwright', 'Tick'], ep: ['Who Never Tires', 'of the Great Clock', 'the Wound-Up'], tags: ['armoured', 'brute'], mech: 'enrage', rise: 'whirrs into life as he steps close', vis: ['clockknight'] },
        { names: ['Lady Thunder', 'Mistress Spark', 'Ione'], ep: ['of the Copper Crown', 'Who Rides the Storm', 'the Bright'], tags: ['caster'], mech: 'adds', add: 'Spark Kites', rise: 'steps down out of a thundercloud', vis: ['ladythunder'] }],
      walk: ['His hair stands on end.', 'Copper coils hum in the walls.', 'Thunder shakes dust from the stairs.', 'The tower sways. It is supposed to. Probably.', 'Sparks crawl along his sword.', 'The air smells of struck metal.'] },
    { k: 'manor', name: 'the Moonlit Manor', el: 'storm', weak: 'holy', icon: '🦇',
      mobs: [['Thralls', ['undead', 'swarm'], 0.45, 0.6, 4], ['Vampire Spawn', ['undead', 'flier'], 0.8, 1.0, 2], ['The Creature', ['brute', 'undead'], 2.3, 1.2, 1], ['Jack-o’-Lanterns', ['caster'], 0.7, 1.2, 2], ['Bat Swarm', ['swarm', 'flier'], 0.2, 0.35, 6]],
      bosses: [
        { names: ['Count Varga', 'Lord Strigoi', 'the Count'], ep: ['of the Moonlit Hall', 'Who Never Dines', 'the Undying'], tags: ['undead', 'caster'], mech: 'adds', add: 'Vampire Spawn', rise: 'unfolds from the shadows above the stair', vis: ['count'] },
        { names: ['Lady Crimson', 'Countess Sanguine', 'Lady Ilse'], ep: ['the Bloodied Bride', 'Who Bathes in It', 'of the Red Chamber'], tags: ['undead', 'caster'], mech: 'poison', mt: 'drinks from him, a little more every round', rise: 'rises from a bath that is not full of water', vis: ['ladyred'] },
        { names: ['the Creature', 'Adam', 'the Doctor’s Son'], ep: ['Unfinished', 'of the Lightning Tower', 'Who Was Stitched'], tags: ['brute', 'undead'], mech: 'enrage', rise: 'sits up on the slab as the lightning strikes', vis: ['creaturebig'] },
        { names: ['the Ghost Bride', 'Lady Ashworth', 'Miss Havers'], ep: ['Who Was Never Wed', 'of the Long Gallery', 'the Jilted'], tags: ['undead', 'caster'], mech: 'poison', mt: 'grips his heart, and it slows a little more every round', rise: 'drifts down the grand stair', vis: ['ghostbride'] },
        { names: ['the Werewolf', 'Lord Lycan', 'Old Hairy'], ep: ['of the Full Moon', 'Who Was the Master', 'the Turned'], tags: ['beast', 'brute'], mech: 'enrage', rise: 'bursts out of the master bedroom', vis: ['werewolf'] },
        { names: ['Hobbes', 'the Butler', 'Mister Graves'], ep: ['Who Did It', 'of the Silver Tray', 'the Ever-Loyal'], tags: ['caster'], mech: 'adds', add: 'Thralls', rise: 'clears his throat; dinner is served', vis: ['butler'] }],
      walk: ['Lightning shows a face at the window. Then none.', 'The clocks all stopped at midnight.', 'A dinner set for twelve. The food is still warm.', 'Organ music from a room with no organ.', 'Every mirror is covered with a sheet.', 'Something big walks the floor above.'] },
    { k: 'sanctum', name: 'the Gilded Sanctum', el: 'holy', weak: 'rot', icon: '⛪',
      mobs: [['Choir Wraiths', ['flier', 'caster', 'undead'], 0.6, 1.0, 3], ['Gilded Templar', ['armoured', 'brute'], 1.9, 1.2, 1], ['Censer Swarm', ['swarm'], 0.25, 0.5, 6], ['Penitents', ['undead'], 0.7, 0.8, 4], ['Zealots', ['caster'], 0.8, 1.1, 2]],
      bosses: [
        { names: ['Saint Orrery', 'Lord Halidom', 'Bishop Aurum'], ep: ['the Radiant', 'Who Judges', 'of the Gilded Lie'], tags: ['caster', 'armoured'], mech: 'enrage', rise: 'rises from the altar in a blaze of gold', vis: ['templarking', '#b8862a'] },
        { names: ['the Pale Abbess', 'Mother Agathe', 'Sister Lumen'], ep: ['of the Silent Order', 'Who Judges', 'the Unsmiling'], tags: ['caster'], mech: 'breath', mt: 'blinds him with holy light every third round', rise: 'lifts her veil, and the light comes out', vis: ['paleabbess'] },
        { names: ['High Inquisitor Thorne', 'Witchfinder Crane', 'Father Pyre'], ep: ['Who Finds the Guilty', 'of the Burning Rack', 'the Righteous'], tags: ['brute'], mech: 'adds', add: 'Penitents', rise: 'closes the book and calls the penitents', vis: ['inquisitor'] },
        { names: ['the Archbishop', 'Primate Aurel', 'Holy Father Lux'], ep: ['of the Golden Mitre', 'Who Sells Pardons', 'the Most High'], tags: ['caster'], mech: 'adds', add: 'Zealots', rise: 'rises from the cathedra and blesses his flock', vis: ['archbishop'] },
        { names: ['the Golden Paladin', 'Sir Aurex', 'Lord Gloriana'], ep: ['the Unblemished', 'of the Gilded Order', 'Who Cannot Fall'], tags: ['armoured', 'brute'], mech: 'enrage', rise: 'kneels, rises, and draws a golden blade', vis: ['goldpaladin'] },
        { names: ['the Martyr', 'Saint Ysolt', 'Sister Pyre'], ep: ['Who Burned for Them', 'of the Last Candle', 'the Unconsumed'], tags: ['caster', 'undead'], mech: 'breath', mt: 'blinds him with holy light every third round', rise: 'steps out of the altar flames', vis: ['martyr'] }],
      walk: ['A choir sings with no singers.', 'Gold leaf flakes from the pillars.', 'The pews are full of the kneeling dead.', 'Incense hangs thick and sweet.', 'Stained glass shows a saint eating someone.', 'His footsteps echo far too long.'] },
  ];
  // how a boss's trick reads when its archetype doesn't say (mt): a lingering hurt in its dungeon's element
  const MECH_TEXT = {
    breath: (el) => 'breathes ' + ELEMENTS[el].n.toLowerCase() + ' every third round',
    poison: (el) => ({ rot: 'oozes rot that eats at him every round', fire: 'sets him smouldering, a little more every round', frost: 'lets the frostbite creep in every round',
      storm: 'leaves static crawling over him every round', holy: 'sears him with its light every round' }[el] || 'wears him down every round'),
  };
  const BITE = { rot: 'The rot bites', fire: 'The burn bites', frost: 'The frost bites', storm: 'The static bites', holy: 'The light sears' };
  // Difficulty climbs with every dungeon cleared; each lap of the themes adds a little more.
  // a, b: how fast dungeons get harder. lootA + lootB*n: the level loot found in dungeon n is made at (what a clear
  // hands you). perType: how many buffs of one kind can stack. All here so tools/sim can sweep them.
  // 2.5 tuning (tools/sim/tune.js against the backtest; README "Balance"): dungeons get harder more evenly (was
  // a 0.5, b 0.12), loot is made nearer his own level (was 2 + 3n, which let one lucky clear chain into a dozen), and
  // the five strongest buffs count (was the latest eight).
  // 2.8 knobs for where his power comes from (tools/sim/shares.js): ws/wg = how much a point of STR (or INT) and a point
  // of weapon power add to a blow; hv = HP per point of VIT; wa/we = defence from armour and from END; fist = bare hands.
  // Before 2.8 (ws 1, wg 2, hv 5, wa 1.5, we 0.5, fist 0.6, gear a step every 5 levels) gear was 55-60% of how deep he got
  // and his stats 25-30%. Now stats are about 60%, gear 15-20%, buffs and companion about 10% each, at 6 to 52 weeks.
  // a/b moved with it (were 0.75, 0.045) to keep the pace: about one dungeon a week for an ordinary week.
  // 2.20.4/2.20.5: a 1.1 → 1.7, b 0.036 → 0.015. The old curve let power outrun the dungeons in the first month (2.5 a week on an
  // ordinary week, against a target of 1) and then caught up hard (0.7 a week by month three). Steeper early, gentler late, with the
  // loot floor lowered to match: tools/sim/tune.js (now with boons, retries after a fall, and early/late targets) gives ordinary 1.02,
  // strong 1.37, weeks 2-4 at 1.34, weeks 9-12 at 0.86, lapsed 0.21.
  // 2.22: a 1.7 → 1.85, tuned against a player who learns each dungeon (tools/sim/lib.js smartRun: every fork, chest and flask
  // call chosen by trying them, as Jake does over ten-plus retries a day) and one new dungeon a day (delveOpens). The old sim
  // player took the defaults, and the curve built for him let Jake clear 17 in eight days. Now (6 runs): ordinary 1.0 a week,
  // strong 1.44, keen (his own 140 deeds a week) 1.65, lapsed 0.35. His save played forward: dungeon 18 in about two weeks,
  // then near one a week.
  // 2.22.1: back to 1.7, as legendaries now wait for level 15 loot (core.js legWeight) and the floors climb slower. 6 runs:
  // ordinary 0.92, strong 1.33, keen 1.65, lapsed 0.36.
  const TUNE = { a: 1.25, b: 0.005, c: 0.045, knee: 52, lootA: 3, lootB: 0.6, perType: 3, maxBuffs: 5, pick: 'strong', ws: 3.5, wg: 0.45, hv: 12, wa: 0.4, we: 2, fist: 0.85 };   // 2.11: a, wg, wa moved with the three new slots
  // 2.23: a knee at dungeon 52 (about half a year in): gentle before it, so a dungeon falls every three or four days, then a
  // steeper climb (c) so the second half settles near one a week. Tuned over a whole year (tools/sim/year.js).
  const diffOf = (n) => 1 + TUNE.a * n + TUNE.b * n * n + TUNE.c * Math.max(0, n - TUNE.knee) * Math.max(0, n - TUNE.knee);
  const MOB_HP = 30, MOB_ATK = 6;
  // 2.22 gold: a clear was 78% of Jake's gold in his first week and deeds 9%. A clear now pays 40 + 15n (was 50 + 25n) and
  // what he picks up on the way (GOLD_K) three-fifths of what it did; deeds pay double (core.js DIFF). Deeds are the backbone.
  const GOLD_K = 0.6;

  // One dungeon per index, fixed until its boss falls (the scenery changes per attempt, the challenge doesn't).
  // 2.20: no two are cut from the same cloth. How many rooms, of what kinds and in what order, how many times (and into how
  // many ways) the path splits, what waits down each way, which chests are not what they seem: all rolled from the seed.
  // The words for a way hint at what's down it but never say, and nothing here says what a room holds until he is in it.
  const WAYS = {
    guard: ['A narrow stair, claw marks on every step', 'A side chapel, something moving inside', 'A tunnel littered with bones', 'A passage full of fresh tracks'],
    snare: ['A flooded passage', 'A crumbling ledge', 'A corridor that smells of oil', 'A hall of loose flagstones'],
    quiet: ['A low passage, quiet as a held breath', 'A dry side-room, almost cosy', 'A corridor swept clean by a draught'],
    cache: ['A dead end with a loose-looking wall', 'A cramped alcove', 'A passage that stops for no reason'],
    lair: ['A great door, scarred and heavy', 'A passage ringed with offerings', 'A cavern mouth with warm air breathing out of it'],
  };
  const WAY_ROOM = { guard: 'fight', lair: 'lair', snare: 'trap', quiet: 'rest', cache: 'secret' };
  function dungeonFor(seed, n) {
    const T = THEMES[n % THEMES.length], lap = Math.floor(n / THEMES.length), D = diffOf(n);
    const r = rngOf(hash(seed + ':' + n + ':v2'));
    // 2.23: six laps to a year, each with its own name; past the last boss everything is Endless (and Reborn)
    const name = (lap ? ['the Deeper ', 'the Deepest ', 'the Forgotten ', 'the Abyssal ', 'the Last ', 'the Endless '][Math.min(5, lap - 1)] + T.name.replace(/^the /, '') : T.name);
    const mob = (m, id) => ({ id: id, kind: 'fight', name: m[0], tags: m[1], hp: R(m[2] * MOB_HP * D), atk: m[3] * MOB_ATK * D, count: m[4], el: T.el });
    const cnt = {}, nid = (p) => { const k = cnt[p] | 0; cnt[p] = k + 1; return p + k; };
    // 2.20.5: was min(4, n/3), so every chest past dungeon 12 was a sure legendary and depth fed straight back into power. Now the
    // floor climbs every five dungeons and stops at epic; legendaries come from the roll (or a special chest, one tier up, past 15).
    // 2.22: the floor under what's found climbs slower (was a step every five dungeons, so from 15 a cache was always legendary),
    // and a cache, a secret or a trick chest lifts it by one but never past epic. Legendaries come from the level loot is made at
    // (core.js legWeight): from about dungeon 20, and only now and then before 30. Epics: about one find in eleven before 8, one in
    // four in a cache from 8, most cache finds from 20.
    const lootTier = n < 8 ? 0 : n < 20 ? 1 : n < 32 ? 2 : 3, baseGold = R(40 + 18 * n);
    // what the dungeon holds: a bag of rooms, shuffled
    const nBody = 5 + Math.min(3, Math.floor(n / 2)) + Math.floor(r() * 3);
    const fw = n < 2 ? [0.4, 0.45, 0.15, 0] : n < 5 ? [0.2, 0.45, 0.3, 0.05] : [0.12, 0.35, 0.38, 0.15];
    let nFork = 0; { const x = r(); let a = 0; for (let i = 0; i < fw.length; i++) { a += fw[i]; if (x < a) { nFork = i; break; } } }
    const nChest = 1 + (n >= 1 && r() < 0.8 ? 1 : 0) + (n >= 6 && r() < 0.35 ? 1 : 0);
    const nFight = Math.max(2, Math.round((nBody - nFork - nChest) * (0.35 + 0.15 * r())));
    const pool = ['fountain', 'trap', 'secret', 'shrine'].concat(n >= 1 ? ['goblin', 'wanderer'] : [], n >= 2 ? ['toll'] : []);
    const bag = [];
    for (let i = 0; i < nFight; i++) bag.push('fight');
    for (let i = 0; i < nChest; i++) bag.push('chest');
    for (let i = 0; i < nFork; i++) bag.push('fork');
    for (let g = 0; bag.length < nBody && g < 80; g++) { const k = pick(pool, r); if (bag.filter((x) => x === k).length < 2) bag.push(k); }
    while (bag.length < nBody) bag.push('fight');
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    const f0 = bag.indexOf('fight'); if (f0 > 0) { const t = bag[0]; bag[0] = bag[f0]; bag[f0] = t; }   // he always meets a fight first
    for (let i = 1; i < bag.length; i++) if (bag[i] === 'fork' && bag[i - 1] === 'fork') { let j = i + 1; while (j < bag.length && bag[j] === 'fork') j++; if (j < bag.length) { const t = bag[i]; bag[i] = bag[j]; bag[j] = t; } else bag[i] = 'fight'; }
    const ev = [];
    let lastMob = null, chestNo = 0;
    const fightEv = (id) => { const m = pick(T.mobs.filter((q) => q !== lastMob), r); lastMob = m; return mob(m, id); };
    const wayOf = (fid, i, kind) => {
      const id = fid + 'abc'[i], say = pick(WAYS[kind], r), m = pick(T.mobs, r);
      if (kind === 'guard') return { id: id, k: kind, say: say, fight: mob(m, id), gold: R(GOLD_K * (30 + 15 * n)), flask: 1 };
      if (kind === 'snare') return { id: id, k: kind, say: say, trap: { hurt: 0.15, sense: R(12 + 1.2 * n), what: 'a hidden snare' }, gold: R(GOLD_K * (28 + 14 * n)) };
      if (kind === 'quiet') return { id: id, k: kind, say: say, heal: 0.14 };
      if (kind === 'cache') return { id: id, k: kind, say: say, sense: R(12 + 1.2 * n), prize: pick(['flask', 'gold', 'item'], r), gold: R(GOLD_K * (30 + 14 * n)), loot: themedLoot(r, n, T, null, Math.min(3, lootTier + 1)) };
      return { id: id, k: 'lair', say: say, fight: Object.assign(mob(m, id), { hp: R(m[2] * MOB_HP * D * 1.7), atk: m[3] * MOB_ATK * D * 1.12, count: Math.max(1, m[4] - 1) }), gold: R(GOLD_K * (30 + 16 * n)), loot: themedLoot(r, n, T, null, Math.min(3, lootTier + 1)) };
    };
    bag.forEach((k) => {
      if (k === 'fight') ev.push(fightEv(nid('m')));
      else if (k === 'chest') {
        const id = nid('c'), first = chestNo++ === 0;
        const trick = n >= 1 && r() < 0.25 ? pick(['tele', 'tele', 'mimic', 'snap'], r) : null;
        const slot = first ? 'weapon' : pick(['head', 'body', 'charm', 'off', 'hands', 'feet'], r);
        ev.push({ id: id, kind: 'chest', loot: themedLoot(r, n, T, slot, trick === 'tele' || trick === 'mimic' ? Math.min(3, lootTier + 1) : lootTier), trick: trick, sense: R(13 + 1.2 * n),
          mimic: trick === 'mimic' ? { id: id + 'm', kind: 'fight', name: 'Mimic', tags: ['brute'], hp: R(1.7 * MOB_HP * D), atk: 1.15 * MOB_ATK * D, count: 1, el: T.el } : null });
      }
      else if (k === 'fountain') ev.push({ id: nid('f'), kind: 'fountain', tainted: r() < 0.5, heal: 0.35, hurt: 0.3, sense: R(13 + 1.1 * n) });
      else if (k === 'trap') ev.push({ id: nid('t'), kind: 'trap', hurt: 0.12, sense: R(12 + 1.2 * n), what: pick(['a tripwire', 'a pressure plate', 'a swinging blade', 'a rotten floor'], r) });
      else if (k === 'secret') ev.push({ id: nid('s'), kind: 'secret', sense: R(12 + 1.3 * n), prize: pick(['flask', 'gold', 'cache', 'lore'], r), loot: themedLoot(r, n, T, null, Math.min(3, lootTier + 1)) });
      else if (k === 'goblin') ev.push({ id: nid('g'), kind: 'goblin', up: r() });
      else if (k === 'toll') ev.push({ id: nid('w'), kind: 'toll', price: R(0.25 * baseGold), reward: R(0.15 * baseGold), fight: { id: 'w' + (cnt.w - 1) + 'f', kind: 'fight', name: 'Toll Warden', tags: ['armoured', 'brute'], hp: R(1.5 * MOB_HP * D), atk: MOB_ATK * D, count: 1, el: T.el } });
      else if (k === 'wanderer') ev.push({ id: nid('v'), kind: 'wanderer', reward: pick(['gold', 'gold', 'gear', 'lore'], r), gold: R(GOLD_K * (30 + 14 * n)), loot: themedLoot(r, n, T, null, lootTier) });
      else if (k === 'shrine') ev.push({ id: nid('h'), kind: 'shrine', boon: pick(['mend', 'might', 'bane', 'toll'], r) });
      else if (k === 'fork') {
        const fid = nid('k'), arity = r() < (n >= 3 ? 0.35 : 0.15) ? 3 : 2;
        const kinds = (n >= 1 ? ['guard', 'snare', 'quiet', 'cache', 'lair'] : ['guard', 'snare', 'quiet', 'cache']).slice();
        for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = kinds[i]; kinds[i] = kinds[j]; kinds[j] = t; }
        ev.push({ id: fid, kind: 'fork', ways: kinds.slice(0, arity).map((kk, i) => wayOf(fid, i, kk)) });
      }
    });
    const B = T.bosses[lap % T.bosses.length];
    const bn = pick(B.names, r), be0 = pick(B.ep, r), be = /^the /i.test(bn) && /^the /.test(be0) ? B.ep.find((x) => !/^the /.test(x)) || be0 : be0;   // not "the Rime Queen the Thawless"
    const boss = { id: 'boss', kind: 'boss', name: bn + ' ' + be + (lap >= T.bosses.length ? ', Reborn' : ''), tags: B.tags, mech: B.mech, el: T.el, vis: B.vis,
      mt: B.mech && MECH_TEXT[B.mech] ? B.mt || MECH_TEXT[B.mech](T.el) : null, bite: BITE[T.el],
      hp: R(6 * MOB_HP * D * (1 + 0.1 * lap)), atk: 1.6 * MOB_ATK * D, rise: B.rise,
      add: B.add ? (T.mobs.find((m) => m[0] === B.add) || T.mobs[0]) : null };
    if (boss.add) boss.add = { name: boss.add[0], tags: boss.add[1], hp: R(boss.add[2] * MOB_HP * D * 0.8), atk: boss.add[3] * MOB_ATK * D * 0.8, count: 3, el: T.el };
    const D0 = { n: n, theme: T.k, name: name, icon: T.icon, el: T.el, weak: T.weak, lap: lap, events: ev, boss: boss, walk: T.walk,
      gold: baseGold, spoilsTier: lootTier, look: { a: r(), b: r(), c: r(), d: r() } };
    D0.map = mapFor(D0, seed);
    return D0;
  }

  // ---------- the floor plan ----------
  // Rooms of different sizes on a coarse grid, joined by corridors that turn corners. The order of events is the same as
  // ever (the sim doesn't care where anything is), but the way is drawn as a place: it winds, the rooms differ, and at
  // each fork the ways are rooms of their own (two or three) that meet again further on. All in tiles; the crawl draws it.
  const MAP_PW = 18, MAP_PH = 12;
  const MAP_SIZE = { enter: [8, 10, 4, 6], fight: [8, 11, 4, 6], chest: [7, 9, 4, 5], fountain: [8, 10, 5, 6], trap: [8, 11, 4, 5], secret: [8, 10, 4, 5], fork: [7, 9, 4, 5], boss: [12, 13, 6, 6],
    goblin: [7, 9, 4, 5], toll: [7, 9, 4, 5], wanderer: [7, 9, 4, 5], shrine: [7, 9, 5, 6], rest: [7, 9, 4, 5], lair: [9, 11, 5, 6] };
  const SIDE = { '1,0': 'east', '-1,0': 'west', '0,1': 'south', '0,-1': 'north' };
  function mapFor(D, seed) {
    const r = rngOf(hash(seed + ':map:' + D.n + ':v2'));
    const nodes = [{ id: 'enter', kind: 'enter', st: -1 }];
    D.events.forEach((e, i) => nodes.push({ id: e.id, kind: e.kind, st: i, e: e, ways: e.ways || null }));
    nodes.push({ id: 'boss', kind: 'boss', st: D.events.length, e: D.boss });
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    // 1. cells: a self-avoiding walk. A fork takes the diamond ahead of it: a way each side (and one straight on, for three),
    //    meeting two cells on.
    const extra = nodes.reduce((a, nd) => a + (nd.ways ? nd.ways.length : 0), 0);
    let COLS = nodes.length + extra > 15 ? 8 : nodes.length + extra > 12 ? 7 : 6, ROWS = 4, calls = 0, used = {}, pos = [];
    const key = (c, q) => c + ',' + q, inG = (c, q) => c >= 0 && c < COLS && q >= 0 && q < ROWS, free = (c, q) => inG(c, q) && !used[key(c, q)];
    const dfs = (i, c, q) => {
      if (++calls > 12000) return false;
      used[key(c, q)] = 1; pos[i] = { c: c, q: q };
      if (i === nodes.length - 1) return true;
      const fork = nodes[i].kind === 'fork', three = fork && nodes[i].ways.length > 2;
      const dirs = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      for (let k = 0; k < 4; k++) {
        const dx = dirs[k][0], dy = dirs[k][1];
        if (fork) {
          const A = [c + dx + dy, q + dy + dx], B = [c + dx - dy, q + dy - dx], Q = [c + 2 * dx, q + 2 * dy], M = [c + dx, q + dy];
          if (!free(A[0], A[1]) || !free(B[0], B[1]) || !free(Q[0], Q[1]) || (three && !free(M[0], M[1]))) continue;
          used[key(A[0], A[1])] = 1; used[key(B[0], B[1])] = 1; if (three) used[key(M[0], M[1])] = 1;
          pos[i].A = { c: A[0], q: A[1] }; pos[i].B = { c: B[0], q: B[1] }; pos[i].M = three ? { c: M[0], q: M[1] } : null; pos[i].d = [dx, dy];
          if (dfs(i + 1, Q[0], Q[1])) return true;
          delete used[key(A[0], A[1])]; delete used[key(B[0], B[1])]; if (three) delete used[key(M[0], M[1])];
        } else if (free(c + dx, q + dy) && dfs(i + 1, c + dx, q + dy)) return true;
      }
      delete used[key(c, q)];
      return false;
    };
    let ok = false;
    for (let tries = 0; tries < 40 && !ok; tries++) {
      used = {}; pos = []; calls = 0;
      ok = dfs(0, Math.floor(r() * 2), Math.floor(r() * ROWS));
    }
    if (!ok) { // never expected: a straight line with the forks bulging out of it
      COLS = nodes.length * 2 + 2; ROWS = 3; pos = []; let c = 0;
      nodes.forEach((nd, i) => { pos[i] = { c: c, q: 1 }; if (nd.kind === 'fork') { pos[i].A = { c: c + 1, q: 2 }; pos[i].B = { c: c + 1, q: 0 }; pos[i].M = nd.ways.length > 2 ? { c: c + 1, q: 1 } : null; pos[i].d = [1, 0]; c += 2; } else c += 1; });
    }
    // 2. the rooms themselves, each somewhere in its cell
    const rooms = [], byId = {}, links = [];
    const mk = (id, kind, cell, st, e) => {
      const z = MAP_SIZE[kind] || MAP_SIZE.fight;
      const w = z[0] + Math.floor(r() * (z[1] - z[0] + 1)), d = z[2] + Math.floor(r() * (z[3] - z[2] + 1));
      const ox = Math.floor(r() * (MAP_PW - 3 - (w + 2) + 1)), oy = Math.floor(r() * (MAP_PH - 3 - (d + 3) + 1));
      const o = { id: id, kind: kind, st: st, c: cell.c, q: cell.q, x0: cell.c * MAP_PW + 1 + ox, y0: cell.q * MAP_PH + 1 + oy, w: w, d: d };
      o.cx = o.x0 + Math.floor(w / 2); o.cy = o.y0 + 2 + Math.floor(d / 2);
      if (e) o.e = e;
      rooms.push(o); byId[id] = o; return o;
    };
    nodes.forEach((nd, i) => {
      mk(nd.id, nd.kind, pos[i], nd.st, nd.e);
      if (nd.kind === 'fork') nd.ways.forEach((w, j) => mk(w.id, WAY_ROOM[w.k] || 'fight', [pos[i].A, pos[i].B, pos[i].M][j], nd.st, w.fight || w.trap || w));
    });
    // 3. corridors
    const link = (a, b) => {
      const A = byId[a], B = byId[b], pts = [];
      if (A.c !== B.c) { // sideways: out of the wall facing the other room, a bend half way, into the wall facing back
        const right = B.c > A.c, xa = right ? A.x0 + A.w : A.x0, xb = right ? B.x0 : B.x0 + B.w, mx = Math.round((xa + xb) / 2);
        pts.push([xa, A.cy], [mx, A.cy], [mx, B.cy], [xb, B.cy]);
      } else {
        const down = B.q > A.q, ya = down ? A.y0 + A.d + 2 : A.y0 + 2, yb = down ? B.y0 + 2 : B.y0 + B.d + 2, my = Math.round((ya + yb) / 2);
        pts.push([A.cx, ya], [A.cx, my], [B.cx, my], [B.cx, yb]);
      }
      links.push({ a: a, b: b, pts: pts });
    };
    nodes.forEach((nd, i) => {
      if (i === nodes.length - 1) return;
      const nx = nodes[i + 1].id;
      if (nd.kind === 'fork') nd.ways.forEach((w) => { link(nd.id, w.id); link(w.id, nx); });
      else link(nd.id, nx);
    });
    // 4. shift to the top-left and size it up
    let c0 = 1e9, q0 = 1e9, c1 = 0, q1 = 0;
    rooms.forEach((o) => { c0 = Math.min(c0, o.c); q0 = Math.min(q0, o.q); c1 = Math.max(c1, o.c); q1 = Math.max(q1, o.q); });
    const sx = c0 * MAP_PW, sy = q0 * MAP_PH;
    rooms.forEach((o) => { o.x0 -= sx; o.y0 -= sy; o.cx -= sx; o.cy -= sy; o.c -= c0; o.q -= q0; });
    links.forEach((l) => l.pts.forEach((p) => { p[0] -= sx; p[1] -= sy; }));
    // which side of the junction each way leaves by (for the words at a fork)
    const forks = {};
    nodes.forEach((nd, i) => {
      if (nd.kind !== 'fork') return;
      const d = pos[i].d || [1, 0];
      forks[nd.id] = { a: SIDE[d[1] + ',' + d[0]] || 'east', b: SIDE[-d[1] + ',' + -d[0]] || 'west', c: 'ahead' };
    });
    return { w: (c1 - c0 + 1) * MAP_PW, h: (q1 - q0 + 1) * MAP_PH, rooms: rooms, links: links, forks: forks };
  }

  // Loot found in a dungeon leans towards beating it: weapons of its weakness, armour against its element.
  function themedLoot(r, n, T, slot, tier) {
    const fake = { level: Math.round(TUNE.lootA + TUNE.lootB * n), seq: 0 };
    let it = null;
    for (let i = 0; i < 40; i++) { it = G.rollItem(fake, tier, r); if (!slot || it.slot === slot) break; }
    delete it.id;
    if (it.slot === 'weapon') { if (r() < 0.65) it.el = T.weak; }
    else if (!G.MINOR[it.slot] && r() < 0.7) it.res = T.el;
    it.found = true;
    return it;
  }

  // ---------- buffs (earned by doing things; timed) ----------
  const DUR = [24, 24, 48, 72, 96]; // hours, by quest difficulty
  const BUFFS = {
    edge: { n: 'Battle-ready', i: '⚔️', what: (a) => '+' + R(a * 100) + '% damage', amt: [0.086, 0.136, 0.17, 0.238, 0.306] },
    sure: { n: 'Sure-footed', i: '🥾', what: (a) => '+' + R(a * 100) + '% evasion', amt: [0.052, 0.086, 0.12, 0.154, 0.204] },
    fed: { n: 'Well fed', i: '🍲', what: (a) => '+' + R(a * 100) + '% max HP', amt: [0.068, 0.102, 0.136, 0.204, 0.256] },
    ready: { n: 'Prepared', i: '🧪', what: (a) => '+' + a + ' flask' + (a > 1 ? 's' : ''), amt: [1, 1, 1, 2, 2] },
    keen: { n: 'Keen-eyed', i: '👁️', what: (a) => '+' + a + ' to spot secrets, +' + a + ' MP', amt: [2, 3, 3, 5, 7] },
    gold: { n: 'Bargain hunter', i: '🪙', what: (a) => '+' + R(a * 100) + '% gold from a cleared run', amt: [0.043, 0.068, 0.085, 0.128, 0.17], hrs: 24 },
    ward: { n: 'Warded', i: '🛡️', what: (a) => '−' + R(a * 100) + '% elemental damage', amt: [0.102, 0.136, 0.17, 0.238, 0.306] },
    luck: { n: 'Lucky', i: '🍀', what: () => 'an extra spoil when a dungeon falls', amt: [1, 1, 1, 1, 1] },
    STR: { n: 'Mighty', i: '💪', what: (a) => '+' + a + ' STR', amt: [1, 2, 3, 3, 4] },
    END: { n: 'Tireless', i: '🫁', what: (a) => '+' + a + ' END', amt: [1, 2, 3, 3, 4] },
    VIT: { n: 'Hale', i: '❤️', what: (a) => '+' + a + ' VIT', amt: [1, 2, 3, 3, 4] },
    DIS: { n: 'Resolute', i: '🧭', what: (a) => '+' + a + ' DIS', amt: [1, 2, 3, 3, 4] },
    INT: { n: 'Sharp', i: '🧠', what: (a) => '+' + a + ' INT', amt: [1, 2, 3, 3, 4] },
  };
  const BUFF_ORDER = ['edge', 'sure', 'fed', 'ready', 'keen', 'gold', 'ward', 'luck', 'STR', 'END', 'VIT', 'DIS', 'INT'];
  const BY_HOME = { lawn: ['sure', 96], fridge: ['gold', 24], dishes: ['ready', 0], laundry: ['ward', 0], birds: ['luck', 0], aviary: ['luck', 0], reno: ['DIS', 0] };
  const BY_STAT = { STR: 'edge', END: 'sure', VIT: 'fed', DIS: 'DIS', INT: 'keen' };
  const MAX_BUFFS = 8;
  // The buff a quest gives (its own choice, else what its house link or stat suggests) and for how long.
  // Not everything gives one: unless he's chosen otherwise, trivial deeds and things done three or more times a day
  // are just for the XP and the stat (type comes back null). 'none' is a choice too.
  function questBuff(q, stat, di) {
    if (q && q.buff === 'none') return { type: null, hrs: 0 };
    let type = q && q.buff && BUFFS[q.buff] ? q.buff : null, hrs = 0;
    if (!type && q && q.home && BY_HOME[q.home]) { type = BY_HOME[q.home][0]; hrs = BY_HOME[q.home][1]; }
    if (!type && (di <= 0 || (q && q.type === 'habit' && (q.cap === 0 || q.cap >= 3)))) return { type: null, hrs: 0 };
    if (!type) type = BY_STAT[(q && q.stat) || stat] || 'edge';
    if (!hrs) hrs = BUFFS[type].hrs || DUR[di];
    return { type: type, hrs: hrs };
  }
  const diffIdx = (x) => { let b = 0; G.DIFF.forEach((d, i) => { if (Math.abs(d.xp - x) < Math.abs(G.DIFF[b].xp - x)) b = i; }); return b; };
  // Buffs active at time T, from the log: one per quest (the latest), at most three of a kind and eight in all.
  // pick 'new': the latest from each quest, newest first; 'strong': the strongest first (harder deeds give bigger
  // buffs, so a run of chores can't push a training buff off the list).
  function activeBuffs(s, T) {
    const cand = [], seenQ = {};
    for (let i = 0; i < s.log.length; i++) {
      const e = s.log[i];
      if (e.q == null || !e.t || e.t > T || seenQ[e.q]) continue;
      if (T - e.t > 96 * 3600e3) break;
      const q = G.findQ(s, e.q), di = diffIdx(e.x), qb = questBuff(q, e.s, di), until = e.t + qb.hrs * 3600e3;
      seenQ[e.q] = true;
      if (!qb.type || until <= T) continue;
      cand.push({ type: qb.type, amt: BUFFS[qb.type].amt[di], until: until, from: e.n, i: e.i, q: e.q, di: di, k: cand.length });
    }
    if (TUNE.pick === 'strong') cand.sort((a, b) => b.di - a.di || a.k - b.k);
    const out = [], perType = {};
    for (let i = 0; i < cand.length && out.length < TUNE.maxBuffs; i++) {
      const c = cand[i];
      if ((perType[c.type] | 0) >= TUNE.perType) continue;
      perType[c.type] = (perType[c.type] | 0) + 1;
      out.push({ type: c.type, amt: c.amt, until: c.until, from: c.from, i: c.i, q: c.q });
    }
    // 2.19: the bonus buffs (all dailies, every pick, a weekly) sit in slots of their own
    const bn = s.bonus || {};
    ['dailies', 'plan', 'weekly'].forEach((k) => { const b = bn[k]; if (b && BUFFS[b.type] && b.t <= T && b.until > T) out.push({ type: b.type, amt: b.amt, until: b.until, from: b.from, i: G.BONUS ? G.BONUS[k].i : '', bonus: k }); });
    return out;
  }
  function buffTotals(list) {
    const b = { dmg: 0, evade: 0, hp: 0, flask: 0, keen: 0, mp: 0, gold: 0, ward: 0, luck: 0 };
    STATS.forEach((k) => { b[k] = 0; });
    (list || []).forEach((x) => {
      const a = x.amt;
      if (x.type === 'edge') b.dmg += a; else if (x.type === 'sure') b.evade += a; else if (x.type === 'fed') b.hp += a;
      else if (x.type === 'ready') b.flask += a; else if (x.type === 'keen') { b.keen += a; b.mp += a; }
      else if (x.type === 'gold') b.gold += a; else if (x.type === 'ward') b.ward += a; else if (x.type === 'luck') b.luck += a;
      else if (b[x.type] != null) b[x.type] += a;
    });
    b.ward = Math.min(0.5, b.ward);
    return b;
  }
  const buffLabel = (x) => BUFFS[x.type].i + ' ' + BUFFS[x.type].n + ': ' + BUFFS[x.type].what(x.amt);

  // ---------- companions: someone from the household goes down with him ----------
  // m is how much they've got in them (birds sulk when they've not been fed).
  const COMP_ROLES = {
    fighter: { n: 'Fighter', i: '⚔️', what: (c) => 'Fights beside him (' + R(30 * c.m) + '% of his damage) and takes ' + R(15 * c.m) + '% of the blows' },
    healer: { n: 'Healer', i: '✚', what: (c) => 'Patches him up between fights (' + R(8 * c.m) + '% HP)' + (c.m >= 0.5 ? ', brings a flask, and pulls him back from death once' : '') },
    scout: { n: 'Scout', i: '🧭', what: (c) => '+' + R(4 * c.m) + ' to spot traps and secrets, calls out attacks (+' + R(6 * c.m) + '% evasion)' + (c.m >= 0.5 ? ', and nothing ambushes him' : '') },
    mage: { n: 'Mage', i: '✨', what: (c) => 'Casts ' + (ELEMENTS[c.el] ? ELEMENTS[c.el].n.toLowerCase() : 'magic') + ' at two foes a round (' + R(28 * c.m) + '% of his damage, more if it’s what they fear)' },
    biter: { n: 'Biter', i: '🦷', what: (c) => 'Bites whatever’s in front (' + R(22 * c.m) + '% of his damage) and leaves bosses bleeding' },
    lookout: { n: 'Lookout', i: '👀', what: (c) => '+' + R(3 * c.m) + ' to spot traps and secrets, +' + R(4 * c.m) + '% evasion, and screeches before anything can ambush him' },
  };
  const BIRD_ROLE = { ruby: 'biter', kermit: 'lookout' };
  const TAGALONG = 0.25;
  // Who's coming (s.delve.comp), and in what state. Birds come at full strength fed, at 60% hungry, and sulk at home when neglected.
  function compFor(s, T) {
    const id = s.delve && s.delve.comp;
    if (!id || !Array.isArray(s.npcs)) return null;
    const n = s.npcs.find((x) => x.id === id && x.status === 'resident');
    if (!n) return null;
    const isComp = !!(G.CALLINGS && G.CALLINGS[n.comp]);
    const c = { id: n.id, name: n.name, bird: n.kind === 'bird', role: n.kind === 'bird' ? BIRD_ROLE[n.id] : isComp ? n.comp : (COMP_ROLES[n.role] && !BIRD_ROLE[n.role] ? n.role : 'fighter'), el: n.el || null, m: 1 };
    if (isComp) { const st = G.callingState(s, n.comp, new Date(T || Date.now())); c.m = st.m; c.long = st.longUntil; c.shorts = st.shorts.length; }
    else if (!c.bird) { c.m = TAGALONG; c.tag = true; } // anyone can come; the companions are the ones worth bringing
    // 2.24: someone whose home in town has everything they asked for fights a little harder
    if (!c.bird && G.homeSettled && G.homeSettled(s, n.id)) { c.settled = true; c.m = c.tag ? TAGALONG + 0.1 : c.m * 1.1; }
    if (c.bird && G.homeState) {
      const h = G.homeState(s, G.today(new Date(T || Date.now()))).birds;
      if (h && h.linked && h.known) {
        if (h.state >= 2) { c.sulk = true; c.m = 0; } else if (h.state >= 1) c.m = 0.6;
      }
    }
    return c;
  }
  const compLabel = (c) => c ? COMP_ROLES[c.role].i + ' ' + c.name + ' (' + COMP_ROLES[c.role].n.toLowerCase() + (c.role === 'mage' && ELEMENTS[c.el] ? ', ' + ELEMENTS[c.el].n.toLowerCase() : '') + ')' : null;

  // ---------- the hero, as the dungeon sees him ----------
  const kindOf = (w) => (w && KINDS[w.art] ? w.art : w ? 'blade' : 'fists');
  // base: stats without gear (stat value + relics − afflictions). eq: slot → item. buffs: activeBuffs().
  function heroFrom(inp, eq) {
    eq = eq || inp.eq;
    const B = buffTotals(inp.buffs), st = {};
    STATS.forEach((k) => {
      let g = 0;
      G.SLOTS.forEach((sl) => { const it = eq[sl]; if (it && it.bonus && it.bonus[k]) g += it.bonus[k]; });
      st[k] = Math.max(1, (inp.base[k] || 10) + g + (B[k] || 0));
    });
    const w = eq.weapon, kind = kindOf(w), wp = w ? G.power(w) : 0;
    const pw = (sl) => (eq[sl] ? G.power(eq[sl]) : 0);
    const armour = pw('head') + pw('body');
    const mi = { dmg: 0, evade: 0, def: 0, sense: 0, mp: 0, guard: 0 };   // 2.11 minor slots: one small effect each
    ['off', 'hands', 'feet'].forEach((sl) => { const m = G.minorOf(eq[sl]); if (m) mi[m.k] += m.v; });
    const res = {};
    ['head', 'body', 'charm'].forEach((sl) => { const it = eq[sl]; if (it && it.res) res[it.res] = true; });
    const atkStat = kind === 'staff' ? st.INT : st.STR;
    const P = inp.perks || {}, pk = (k) => P[k] | 0;   // 2.10 boons
    const TW = inp.town || {}, tw = (k) => +TW[k] || 0;   // 2.13 the town
    const fx = {}; G.SLOTS.forEach((sl) => { const it = eq[sl]; if (it && it.fx && G.fxOf(it)) fx[it.fx] = true; });   // 2.9 gear effects
    const C = inp.comp && !inp.comp.sulk ? inp.comp : null, cm = C ? C.m : 0;
    const cSense = C && C.role === 'scout' ? R(4 * cm) : C && C.role === 'lookout' ? R(3 * cm) : 0, half = cm >= 0.5;
    return {
      comp: C, cSense: cSense,
      name: inp.name || 'He', st: st, kind: kind, el: w && w.el ? w.el : null,
      // anchored at 10 (where every stat starts), so a new hero is who he always was and each point earned counts for more
      fx: fx, hide: (1 - 0.05 * pk('hide')) * (1 - mi.guard / 100) * (1 - tw('hide') / 100), heal: 1 + tw('heal') / 100, mpRoom: tw('mpRoom'), regen: tw('regen') / 100,
      hpMax: R(Math.max(20, 80 + TUNE.hv * (st.VIT - 10) + 2 * inp.level) * (1 + B.hp) * (fx.hale ? 1.1 : 1) * (1 + 0.08 * pk('wind')) * (1 + tw('hp') / 100)),
      atk: Math.max(4, 13 + TUNE.ws * (atkStat - 10) + TUNE.wg * wp) * (kind === 'fists' ? TUNE.fist : 1) * (1 + B.dmg) * (1 + mi.dmg / 100) * (1 + tw('dmg') / 100),
      def: Math.max(0, armour * TUNE.wa + 5 + TUNE.we * (st.END - 10) + mi.def + tw('def')),
      evade: clamp((st.END - 10) * 0.012 + B.evade + (fx.keen ? 0.05 : 0) + 0.03 * pk('step') + mi.evade / 100 + tw('evade') / 100 + (C && C.role === 'scout' ? 0.06 * cm : C && C.role === 'lookout' ? 0.04 * cm : 0), 0, 0.5),
      mpMax: R((6 + 2 * st.INT + B.mp) * (fx.wise ? 1.2 : 1) * (1 + 0.2 * pk('focus')) * (1 + mi.mp / 100)),
      flasks: clamp(2 + Math.floor((st.DIS - 10) / 6), 2, 6) + B.flask + (C && C.role === 'healer' && half ? 1 : 0) + (fx.flask ? 1 : 0) + pk('flask') + tw('flask'),
      keen: st.INT + B.keen + cSense + (fx.scout ? 3 : 0) + 3 * pk('sense') + mi.sense + tw('sense'), wary: st.DIS + cSense + (fx.scout ? 3 : 0) + 3 * pk('sense') + mi.sense + tw('sense'), res: res, ward: B.ward, gold: B.gold + (fx.lucky ? 0.15 : 0) + 0.1 * pk('purse') + tw('clearGold') / 100, luck: B.luck,
    };
  }

  // ---------- the run ----------
  // inp: { name, level, base, eq, buffs, orders: { potion, arts, ev }, seed, n, attempt }
  // answers: choices made while watching (id → value). interactive: pause and ask about anything without an order.
  // Returns { pause } when it needs a choice, else the finished run. Re-running with the answer replays to the same point.
  function simRun(inp, answers, interactive) {
    answers = answers || {};
    const D = dungeonFor(inp.seed, inp.n), O = inp.orders || {}, evO = (O.ev && O.ev[inp.n]) || {};
    const flav = rngOf(hash(inp.seed + ':' + inp.n + ':walk:' + (inp.attempt | 0)));
    const eq = Object.assign({}, inp.eq);
    let H = heroFrom(inp, eq);
    const S = { hp: H.hpMax, mp: H.mpMax, flasks: H.flasks };
    const log = [], stages = [], found = [], seen = {}, stashed = [], traded = [], tookFight = {};
    let might = 0, tolls = 0;
    let gold = 0, learned = {}, pause = null, stageNo = 0, artSaid = false, revived = false, bitHim = false, drunkAll = 0;
    const C = H.comp, cm = C ? C.m : 0, cn = C ? C.name : '';
    // pre: HP that changed without a line of its own (a healer's quiet patch-up), carried on the next line so the
    // crawl can show it happen
    let pre = null;
    const say = (k, s, extra) => { log.push(Object.assign({ k: k, s: pron(inp.f, s), hp: Math.max(0, R(S.hp)), hpMax: H.hpMax, mp: R(S.mp), mpMax: H.mpMax, fl: S.flasks, st: stageNo }, pre ? { pre: pre } : {}, extra || {})); pre = null; };
    const nm = H.name;
    const watching = interactive && !answers.__auto;   // __auto: he pressed Skip, so orders and defaults take over
    const ask = (id, kind, prompt, options, extra) => { pause = Object.assign({ id: id, kind: kind, prompt: pron(inp.f, prompt), options: options, at: log.length }, extra || {}); return null; };
    // A choice: what you answered just now, else your standing order, else ask (when watching), else the default.
    const choose = (id, kind, prompt, options, def, extra) => {
      if (answers[id] != null) return answers[id];
      if (watching) return ask(id, kind, prompt, options, Object.assign({ was: evO[id] != null ? evO[id] : null, def: def }, extra || {}));   // 2.11: watching, the choice is always his to make
      if (evO[id] != null) return evO[id];
      return def;
    };
    const potionPolicy = () => answers.potion || (watching ? null : O.potion) || null;

    // ---- one fight ----
    // 2.5: every blow is a whole number and every blow is written down (ev), so the crawl can play exactly what
    // happened: the hits on screen add up to the totals in the log, and the HP bar matches at every beat.
    function fight(foe, isBoss) {
      const kind = KINDS[H.kind], grp = [], ev = [];
      const mightOn = might > 0; if (mightOn) might--;
      const n = foe.count || 1;
      for (let i = 0; i < n; i++) grp.push({ id: 'g' + i, hp: foe.hp, max: foe.hp, atk: foe.atk, tags: foe.tags, el: foe.el, name: foe.name });
      const boss = isBoss ? grp[0] : null;
      const hp0 = S.hp, mp0 = S.mp;
      let round = 0, dealt = 0, drank = 0, art = H.kind !== 'fists' && ((O.arts || 'all') === 'all' || ((O.arts || 'all') === 'boss' && isBoss)), adds = null, enraged = false, noted = [];
      const first = H.kind === 'polearm' || H.kind === 'staff' || (C && (C.role === 'scout' || C.role === 'lookout') && cm >= 0.5);
      let cDealt = 0, hDealt = 0, braced = false;
      // the companion's turn
      const compTurn = () => {
        if (!C || (C.role !== 'fighter' && C.role !== 'mage' && C.role !== 'biter')) return;
        const ts = living();
        if (!ts.length) return;
        const frac = C.role === 'fighter' ? 0.3 : C.role === 'mage' ? 0.34 : 0.22;
        const hits = [ts[0]];   // 2.20: one foe at a time
        hits.forEach((t) => {
          let m = 1;
          if (C.role === 'mage') { if (C.el && C.el === D.weak) m = ELEM_TUNE.weak; else if (C.el && C.el === t.el) m = ELEM_TUNE.same; }
          if (C.role === 'biter' && t.tags.indexOf('beast') >= 0) m *= 1.25;
          const d = Math.min(t.hp, Math.max(1, R(H.atk * frac * cm * m)));
          t.hp -= d; cDealt += d; if (t === boss) dealt += d;
          ev.push({ t: 'c', to: t.id, d: d, k: t.hp <= 0 ? 1 : 0 });
        });
        if (C.role === 'biter' && boss && boss.hp > 0) { const b = Math.min(boss.hp, Math.max(1, R(boss.max * 0.015 * cm))); boss.hp -= b; cDealt += b; dealt += b; ev.push({ t: 'bleed', to: boss.id, d: b, k: boss.hp <= 0 ? 1 : 0 }); }
      };
      const mult = (t) => {
        let m = 1;
        if (H.el && H.el === D.weak) m *= ELEM_TUNE.weak; else if (H.el && H.el === t.el) m *= ELEM_TUNE.same;
        if (kind.good.some((g) => t.tags.indexOf(g) >= 0)) m *= H.kind === 'blunt' ? 1.5 : H.kind === 'axe' ? 1 : 1.3;
        if (kind.bad.some((g) => t.tags.indexOf(g) >= 0)) m *= 0.75;
        if (t.tags.indexOf('flier') >= 0 && !first) m *= 0.8;
        return m;
      };
      const living = () => (adds ? adds.filter((e) => e.hp > 0) : []).concat(grp.filter((e) => e.hp > 0));
      while (living().length && S.hp > 0 && round < 80) {
        round++;
        ev.push({ t: 'r', n: round });
        // drink?
        const pol = potionPolicy(), frac = S.hp / H.hpMax;
        let drink = false;
        if (S.flasks > 0 && frac < 0.7) {
          const nowKey = 'now@' + stageNo + '.' + round;
          if (answers[nowKey]) drink = true;
          else if (pol) drink = pol.m === 'below' ? frac < pol.p / 100 : pol.m === 'boss' ? isBoss && frac < 0.4 : false;
          // 2.22: asked only as a fight starts. Asked mid-fight, the question came before the fight had been shown, and the bars
          // still said full health while it said he was down to a quarter. Mid-fight, with no standing order, he drinks below 35%.
          else if (watching && frac < 0.5 && round === 1) {
            if (!answers['asked@' + stageNo + '.' + round]) {
              ask('potion', 'potion', nm + ' is down to ' + R(S.hp) + ' of ' + H.hpMax + ' HP' + (isBoss ? ', facing ' + foe.name : ' as the fight starts') + ', with ' + S.flasks + ' flask' + (S.flasks > 1 ? 's' : '') + ' left.',
                [{ v: { now: nowKey }, label: 'Drink one now' }, { v: { m: 'below', p: 35 }, label: 'From now on, drink below 35% HP' }, { v: { m: 'below', p: 50 }, label: 'From now on, drink below 50% HP' }, { v: { m: 'boss' }, label: 'Save them for the boss' }],
                { round: round, hp: R(S.hp), hpMax: H.hpMax, mp: R(S.mp), mpMax: H.mpMax, fl: S.flasks });
              return null;
            }
          } else drink = frac < 0.35;
        }
        if (drink) { S.flasks--; drank++; drunkAll++; const h = Math.min(H.hpMax - S.hp, R(H.hpMax * (H.fx.tonic ? 0.5 : 0.4) * (H.heal || 1))); S.hp += h; ev.push({ t: 'drink', h: h, hp: S.hp, fl: S.flasks }); }
        else {
          // attack: adds first, then the rest
          const targets = living();
          let dmg = H.atk;
          if (mightOn) dmg *= 1.25;
          if (H.fx.opener && round === 1) dmg *= 1.6;
          if (H.fx.slayer && isBoss) dmg *= 1.2;
          if (H.fx.reaper && S.hp < H.hpMax / 2) dmg *= 1.25;
          if (H.fx.packs && targets.length > 1) dmg *= 1.2;
          if (H.kind === 'staff') { if (S.mp >= 2) S.mp -= 2; else dmg *= 0.5; }
          let usedArt = 0;
          if (art && S.mp >= 4) { S.mp -= 4; dmg *= isBoss ? 3 : 2; art = false; noted.push('art'); usedArt = 1; } // an art saved for a boss hits harder
          const cleave = H.kind === 'axe' && usedArt && targets.length > 1;   // 2.20: one foe per blow; an axe's art is the exception
          const hits = cleave ? targets : [targets[0]];
          hits.forEach((t) => { const d = Math.max(1, R(dmg * mult(t) * (cleave ? 0.6 : 1))); const real = Math.min(t.hp, d); t.hp -= real; hDealt += real; if (t === boss) dealt += real; ev.push({ t: 'h', to: t.id, d: real, k: t.hp <= 0 ? 1 : 0, art: usedArt, mp: R(S.mp) }); });
        }
        compTurn();
        // boss turns
        if (boss && boss.hp > 0) {
          if (!enraged && boss.hp <= boss.max / 2) {
            enraged = true;
            if (foe.mech === 'enrage') { boss.atk *= 1.5; noted.push('enrage'); ev.push({ t: 'enrage' }); }
            if (foe.mech === 'adds' && foe.add) { adds = []; for (let i = 0; i < foe.add.count; i++) adds.push({ id: 'a' + i, hp: foe.add.hp, max: foe.add.hp, atk: foe.add.atk, tags: foe.add.tags, el: foe.add.el, name: foe.add.name }); noted.push('adds'); ev.push({ t: 'adds', n: foe.add.name, tags: foe.add.tags, hp: foe.add.hp, ids: adds.map((a) => a.id) }); }
          }
        }
        // their turn
        if (!(round === 1 && first)) {
          let inc = 0, br = 0, ps = 0;
          const by = living();
          by.forEach((e) => {
            let a = e.atk;
            if (e === boss && foe.mech === 'breath' && round % 3 === 0) { inc += boss.atk * 2 * 40 / (40 + H.def / 2) * (1 - H.evade / 2) * elemTaken(e.el); br = 1; return; }
            inc += a * 40 / (40 + H.def) * (1 - H.evade) * elemTaken(e.el);
          });
          if (boss && boss.hp > 0 && foe.mech === 'poison') { ps = H.hpMax * 0.03 * elemTaken(foe.el); inc += ps; }
          if (C && C.role === 'fighter') inc *= 1 - 0.15 * cm;
          if (H.fx.thick) inc *= 0.9;
          inc *= H.hide;
          if (H.fx.bulwark && !braced) { inc *= 0.5; braced = true; }
          inc = R(inc);
          S.hp -= inc;
          ev.push({ t: 'in', d: inc, by: by.map((e) => e.id), br: br, ps: ps ? 1 : 0, hp: S.hp });
          if (S.hp <= 0 && living().length && tryRevive()) { noted.push('revive'); ev.push({ t: 'rev', hp: S.hp }); }
        }
      }
      return { won: S.hp > 0, hpLost: Math.max(0, R(hp0 - Math.max(0, S.hp))), mpLost: R(mp0 - S.mp), drank: drank, rounds: round, dealt: dealt, noted: noted, bossLeft: boss ? Math.max(0, boss.hp) : 0, cDealt: cDealt, hDealt: hDealt, ev: ev, hp0: hp0,
        foes: grp.map((g) => ({ id: g.id, hp: g.max })) };
    }
    // A healer drags him back up, once.
    function tryRevive() {
      if (!C || C.role !== 'healer' || revived || cm < 0.5) return false;
      revived = true;
      S.hp = R(H.hpMax * (0.15 + 0.15 * cm));
      return true;
    }
    function elemTaken(el) { let m = 1; if (el && H.res[el]) m *= 1 - ELEM_TUNE.res; if (el) m *= 1 - H.ward; return m; }
    const foeName = (f) => (f.count > 1 ? f.count + ' ' + f.name : 'the ' + f.name);
    const compBit = (r) => {
      if (!C || !r) return '';
      let t = '';
      if (r.cDealt > 0) t += ' ' + cn + (C.role === 'mage' ? '’s ' + (ELEMENTS[C.el] ? ELEMENTS[C.el].n.toLowerCase() : 'magic') + ' did ' : C.role === 'biter' ? ' bit for ' : ' added ') + r.cDealt + '.';
      if (r.noted.indexOf('revive') >= 0) t += ' He went down, and ' + cn + ' got him back on his feet.';
      if (C.role === 'biter' && !bitHim && r.cDealt > 0) { bitHim = true; t += ' (' + cn + ' also bit him. It’s how she shows affection.)'; }
      return t;
    };
    const fx = (f, r, boss) => ({ fx: { foe: { n: f.name, tags: f.tags, c: f.count || 1, el: f.el, boss: !!boss, hp: R((f.hp || 0) * (f.count || 1)) }, lost: r ? r.hpLost : 0, drank: r ? r.drank : 0, rounds: r ? r.rounds : 0, cd: r ? r.cDealt : 0, hd: r ? r.hDealt : 0, dl: r ? r.dealt : 0, ev: r ? r.ev : [], hp0: r ? r.hp0 : 0, foes: r ? r.foes : [], rev: !!(r && r.noted.indexOf('revive') >= 0), won: !!(r && r.won), adds: !!(r && r.noted.indexOf('adds') >= 0), rage: !!(r && r.noted.indexOf('enrage') >= 0) } });
    const fightLine = (f, r) => nm + ' ' + KINDS[H.kind].verb + ' ' + foeName(f) + ', losing ' + r.hpLost + ' HP' + (r.mpLost ? ' and ' + r.mpLost + ' MP' : '') + (r.drank ? ' (drank ' + (r.drank > 1 ? r.drank + ' flasks' : 'a flask') + ')' : '') + '.' + compBit(r);
    const walk = () => { if (flav() < 0.55) say('walk', pick(D.walk, flav)); };
    function trap(t, id) {
      if (H.wary >= t.sense) { say('trap', H.wary - H.cSense < t.sense && C ? cn + (C.bird ? ' screeched at ' : ' spotted ') + t.what + ', so ' + nm + ' stepped around it.' : nm + ' spotted ' + t.what + ' and stepped around it.', { trap: 'safe' }); return 'safe'; }
      const d = R(H.hpMax * t.hurt * (1 - H.evade));
      S.hp -= d;
      say('trap', nm + ' set off ' + t.what + ', losing ' + R(d) + ' HP.', { trap: 'hit' });
      return 'hurt';
    }

    const sulker = inp.comp && inp.comp.sulk ? inp.comp : null;
    say('enter', nm + ' descends into ' + D.name + (C ? ' with ' + cn : '') + '.' + (sulker ? ' ' + sulker.name + ' wouldn’t come: nobody’s fed ' + (sulker.id === 'ruby' ? 'her' : 'him') + '.' : ''));
    const all = D.events.concat([D.boss]);
    const letterOf = (w) => w.id.slice(-1), up = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const kn0 = (inp.known && inp.known[inp.n]) || {};
    // a chest that throws him back to the start: every fight he has won so far is to be won again
    function replay(upto) {
      for (let j = 0; j < upto; j++) {
        const q = all[j];
        let f = null, path = null;
        if (q.kind === 'fight') f = q;
        else if (q.kind === 'fork' && tookFight[q.id]) { path = tookFight[q.id]; const w = q.ways.find((x) => letterOf(x) === path); f = w && w.fight; }
        if (!f) continue;
        stageNo = j;
        const r = fight(f, false);
        if (!r) return 'pause';
        if (!r.won) { say('death', nm + ' fell to ' + foeName(f) + ' a second time.', Object.assign({ killer: f.name, redo: true, path: path, fork: q.kind === 'fork' ? q.id : undefined }, fx(f, r))); stages.push([f.id, 'died', 0]); return finish('died', f, r); }
        say('fight', nm + ' ' + KINDS[H.kind].verb + ' ' + foeName(f) + ' again, losing ' + r.hpLost + ' HP.' + compBit(r), Object.assign({ redo: true, path: path, fork: q.kind === 'fork' ? q.id : undefined }, fx(f, r)));
      }
      return null;
    }
    for (let i = 0; i < all.length; i++) {
      const e = all[i];
      stageNo = i;
      if (C && C.role === 'healer' && i > 0 && S.hp < H.hpMax) { const h = Math.min(H.hpMax - S.hp, R(H.hpMax * 0.08 * cm)); S.hp += h; if (h >= H.hpMax * 0.05 && flav() < 0.5) say('walk', cn + ' patches him up: +' + R(h) + ' HP.'); else if (h > 0) pre = { h: (pre ? pre.h : 0) + h, hp: S.hp }; }
      const hpIn = R(S.hp);
      let out = 'ok';
      if (e.kind !== 'boss') walk();
      // 2.20: he walks into the room first, then he is asked. (A choice that comes up before he gets there spoils the room.)
      const arrive = (txt, extra) => say('arrive', txt, Object.assign({ room: e.kind }, extra || {}));
      if (e.kind === 'fight') {
        const r = fight(e, false);
        if (!r) break;
        if (!r.won) { say('death', nm + ' fell to ' + foeName(e) + '.', Object.assign({ killer: e.name }, fx(e, r))); stages.push([e.id, 'died', 0]); return finish('died', e, r); }
        const firstArt = r.noted.indexOf('art') >= 0 && !artSaid;
        if (firstArt) artSaid = true;
        say('fight', (firstArt ? 'Opening with a weapon art, ' : '') + fightLine(e, r), fx(e, r));
        out = 'won';
      } else if (e.kind === 'chest') {
        const it = e.loot, cur = eq[it.slot], kt = kn0[e.id + '!'] || null, bad = e.trick && H.keen >= e.sense;
        arrive(nm + ' finds a chest.');
        seen[e.id + 'o'] = { kind: 'chesto', known: kt, bad: !!bad };
        let o = choose(e.id + 'o', 'open', 'Open it?' + (bad ? ' ' + nm + ' doesn’t like the look of the lock.' : '') + (kt ? ' He remembers what it did last time: ' + ({ tele: 'it threw him back to the start.', mimic: 'it was a mimic.', snap: 'a needle in the lock.' }[kt] || '') : ''),
          [{ v: 'open', label: 'Open it' }, { v: 'leave', label: 'Leave it shut' }], kt === 'tele' ? 'leave' : 'open', { chest: true });
        if (o == null) break;
        if (o !== 'leave') o = 'open';
        if (o === 'leave') { say('chest', nm + ' leaves the chest shut.', { leave: true }); out = 'left'; }
        else {
          if (e.trick === 'mimic') {
            learned[e.id + '!'] = 'mimic';
            say('chest', 'The chest has teeth. It’s a mimic!', { mimic: true });
            const r = fight(e.mimic, false);
            if (!r) break;
            if (!r.won) { say('death', nm + ' was eaten by a chest.', Object.assign({ killer: 'Mimic' }, fx(e.mimic, r))); stages.push([e.id, 'died', 0]); return finish('died', e.mimic, r); }
            say('fight', fightLine(e.mimic, r), fx(e.mimic, r));
          } else if (e.trick === 'snap') {
            learned[e.id + '!'] = 'snap';
            if (H.wary >= e.sense) say('chest', nm + ' spots a needle in the lock and picks around it.', { trick: 'safe' });
            else { const d = R(H.hpMax * 0.12 * (1 - H.evade)); S.hp -= d; say('chest', 'A needle snaps out of the lock: ' + nm + ' loses ' + d + ' HP.', { trick: 'hit', hurt: d }); }
          }
          if (S.hp > 0) {
            seen[e.id] = { kind: 'chest', item: it };
            const better = !cur || G.power(it) > G.power(cur);
            const c = choose(e.id, 'chest', nm + ' lifts out ' + it.name + ' (' + G.SLOT_NAME[it.slot].toLowerCase() + ', ' + G.RARITY[it.tier].n.toLowerCase() + itemExtra(it) + ').' + (cur ? ' He has ' + cur.name + ' on.' : ''),
              [{ v: 'equip', label: 'Put it on now (lost if he falls)' }, { v: 'stash', label: 'Stash it (kept even if he falls)' }], better ? 'equip' : 'stash', { item: it });
            if (c == null) break;
            found.push(it);
            if (c === 'equip') { eq[it.slot] = it; const keep = S.hp / H.hpMax; H = heroFrom(inp, eq); S.hp = Math.min(H.hpMax, R(keep * H.hpMax)); say('chest', nm + ' found ' + it.name + ' in a chest and put it on.', { item: it }); out = 'equipped'; }
            else { stashed.push(it); say('chest', nm + ' found ' + it.name + ' in a chest and stashed it, safe in his pack.', { item: it }); out = 'stashed'; }
            if (e.trick === 'tele') {
              learned[e.id + '!'] = 'tele';
              say('tele', 'The lid slams, the floor lurches, and ' + nm + ' is back at the entrance. Everything he killed has risen again.', { tele: true });
              const rr = replay(i);
              if (rr === 'pause') break;
              if (rr) return rr;
              stageNo = i;
            }
          }
        }
      } else if (e.kind === 'fountain') {
        arrive(nm + ' finds a fountain. The water is dark and very still.');
        seen[e.id] = { kind: 'fountain', tainted: kn0[e.id] ? e.tainted : null };
        if (e.tainted && H.keen >= e.sense) { say('fountain', nm + ' sniffs the fountain and thinks better of it. Tainted.', { ft: 'spotted' }); learned[e.id] = true; out = 'spotted'; }
        else {
          const c = choose(e.id, 'fountain', 'Drink from it?', [{ v: 'drink', label: 'Drink' }, { v: 'skip', label: 'Leave it' }], S.hp / H.hpMax < 0.85 ? 'drink' : 'skip');
          if (c == null) break;
          if (c === 'drink') {
            learned[e.id] = true;
            if (e.tainted) { const d = R(H.hpMax * e.hurt); S.hp -= d; say('fountain', nm + ' drinks from the fountain. It was tainted: he loses ' + R(d) + ' HP.', { ft: 'bad' }); out = 'poisoned'; }
            else { const h = Math.min(H.hpMax - S.hp, R(H.hpMax * e.heal)); S.hp += h; say('fountain', nm + ' drinks from a fountain that restores ' + R(h) + ' HP.', { ft: 'good' }); out = 'healed'; }
          } else { say('fountain', nm + ' leaves the fountain alone.', { ft: 'skip' }); out = 'skipped'; }
        }
      } else if (e.kind === 'trap') {
        out = trap(e, e.id);
      } else if (e.kind === 'secret') {
        if (H.keen >= e.sense) {
          out = 'found';
          if (e.prize === 'flask') { S.flasks++; say('secret', nm + ' notices a loose stone and finds a spare flask behind it.', { prize: 'flask' }); }
          else if (e.prize === 'gold') { const g = R(GOLD_K * (20 + 10 * inp.n)); gold += g; say('secret', nm + ' finds a hidden cache: ' + g + ' gold, if he makes it out.', { prize: 'gold' }); }
          else if (e.prize === 'cache') { found.push(e.loot); say('secret', nm + ' finds a hidden alcove with ' + e.loot.name + ' inside.', { item: e.loot, prize: 'cache' }); }
          else { learned.lore = true; say('secret', nm + ' finds a scrawled warning: the master of this place fears ' + ELEMENTS[D.weak].n.toLowerCase() + '.', { prize: 'lore' }); }
        } else { out = 'missed'; if (flav() < 0.5) say('walk', 'Something glints behind a wall. ' + nm + ' walks past it.'); }
      } else if (e.kind === 'goblin') {
        const slots = G.SLOTS.filter((sl) => eq[sl]);
        arrive(nm + ' comes upon a goblin sitting on a crate, counting something that isn’t his.', { goblin: true });
        if (!slots.length) { say('goblin', 'The goblin looks ' + nm + ' up and down, finds nothing worth having, and waves him on.', { ft: 'skip' }); out = 'nothing'; }
        else {
          const slot = slots[Math.floor(rngOf(hash(inp.seed + ':gobslot:' + inp.n + ':' + slots.join()))() * slots.length) % slots.length], cur = eq[slot], rr = rngOf(hash(inp.seed + ':gob:' + inp.n + ':' + slot));
          const offer = themedLoot(rr, inp.n, THEMES.find((x) => x.k === D.theme) || THEMES[0], slot, clamp((cur.tier | 0) + (e.up < 0.55 ? 1 : 0), 0, 4));
          seen[e.id] = { kind: 'goblin', give: cur.name, get: offer };
          const c = choose(e.id, 'goblin', 'The goblin wants ' + cur.name + ' (his ' + G.SLOT_NAME[slot].toLowerCase() + '). In its place: ' + offer.name + ' (' + G.RARITY[offer.tier].n.toLowerCase() + itemExtra(offer) + ').', [{ v: 'trade', label: 'Trade' }, { v: 'decline', label: 'No deal' }], G.power(offer) > G.power(cur) * 1.08 ? 'trade' : 'decline', { item: offer, give: cur });
          if (c == null) break;
          if (c === 'trade') {
            traded.push({ slot: slot, gave: cur, got: offer }); eq[slot] = offer;
            const keep = S.hp / H.hpMax; H = heroFrom(inp, eq); S.hp = Math.min(H.hpMax, R(keep * H.hpMax));
            say('goblin', nm + ' hands over ' + cur.name + ' and takes ' + offer.name + '. The goblin grins, showing every tooth.', { ft: 'good', item: offer, traded: slot }); out = 'traded';
          } else { say('goblin', nm + ' shakes his head. The goblin spits and goes back to counting.', { ft: 'skip' }); out = 'declined'; }
        }
      } else if (e.kind === 'toll') {
        arrive('A warden stands in the doorway, one hand out.', { toll: true });
        seen[e.id] = { kind: 'toll', price: e.price };
        const c = choose(e.id, 'toll', 'He wants ' + e.price + ' gold from the spoils to let ' + nm + ' pass. Or ' + nm + ' can fight him for it.', [{ v: 'pay', label: 'Pay ' + e.price + ' gold' }, { v: 'fight', label: 'Fight him (a flask and ' + e.reward + ' gold if he wins)' }], S.hp / H.hpMax < 0.6 ? 'pay' : 'fight');
        if (c == null) break;
        if (c === 'pay') { tolls += e.price; say('toll', nm + ' pays the warden ' + e.price + ' gold and is waved through.', { ft: 'skip', paid: e.price }); out = 'paid'; }
        else {
          const r = fight(e.fight, false);
          if (!r) break;
          if (!r.won) { say('death', nm + ' fell to the toll warden.', Object.assign({ killer: 'Toll Warden' }, fx(e.fight, r))); stages.push([e.id, 'died', 0]); return finish('died', e.fight, r); }
          gold += e.reward; S.flasks++;
          say('fight', fightLine(e.fight, r) + ' On the warden: ' + e.reward + ' gold and a flask.', fx(e.fight, r));
          out = 'won';
        }
      } else if (e.kind === 'wanderer') {
        arrive('A wounded adventurer slumps against the wall, watching ' + nm + ' come.', { wanderer: true });
        seen[e.id] = { kind: 'wanderer' };
        const c = choose(e.id, 'wanderer', 'They are bleeding badly. Spend a flask to patch them up?', [{ v: 'help', label: 'Help (a flask)' }, { v: 'pass', label: 'Walk on' }], S.flasks >= 3 ? 'help' : 'pass');
        if (c == null) break;
        if (c === 'help' && S.flasks > 0) {
          S.flasks--;
          if (e.reward === 'gold') { gold += e.gold; say('wanderer', nm + ' patches them up. They press ' + e.gold + ' gold into his hand: “Take it. I’ll not live to spend it.”', { ft: 'good', prize: 'gold' }); }
          else if (e.reward === 'gear') { found.push(e.loot); say('wanderer', nm + ' patches them up. They give him ' + e.loot.name + ' from their pack.', { ft: 'good', prize: 'item', item: e.loot }); }
          else { learned.lore = true; say('wanderer', nm + ' patches them up. “The master of this place fears ' + ELEMENTS[D.weak].n.toLowerCase() + '. Remember that.”', { ft: 'good', prize: 'lore' }); }
          out = 'helped';
        } else { say('wanderer', nm + (c === 'help' ? ' has no flask to spare, and walks on.' : ' walks on. They watch him go.'), { ft: 'skip' }); out = 'passed'; }
      } else if (e.kind === 'shrine') {
        arrive(nm + ' finds a small shrine, the candles still lit.', { shrine: true });
        seen[e.id] = { kind: 'shrine', boon: kn0[e.id] ? e.boon : null };
        const c = choose(e.id, 'shrine', 'Kneel at it?', [{ v: 'kneel', label: 'Kneel' }, { v: 'pass', label: 'Walk on' }], S.hp / H.hpMax < 0.7 ? 'kneel' : 'pass');
        if (c == null) break;
        if (c === 'kneel') {
          learned[e.id] = true;
          if (e.boon === 'mend') { const h = Math.min(H.hpMax - S.hp, R(H.hpMax * 0.35)); S.hp += h; S.mp = H.mpMax; say('shrine', nm + ' kneels. Warmth runs through him: +' + h + ' HP, and his head clears.', { ft: 'good', heal: h }); out = 'mended'; }
          else if (e.boon === 'might') { might = 2; say('shrine', nm + ' kneels. His arms feel like they belong to someone stronger. (+25% damage in the next two fights.)', { ft: 'good' }); out = 'might'; }
          else if (e.boon === 'toll') { const g = R(GOLD_K * (40 + 15 * inp.n)); gold += g; if (S.flasks > 0) S.flasks--; say('shrine', nm + ' kneels. Something takes a flask from his belt and leaves ' + g + ' gold in its place.', { ft: 'good', prize: 'gold' }); out = 'tithe'; }
          else { const d = R(H.hpMax * 0.15); S.hp -= d; say('shrine', nm + ' kneels. The candles gutter, and something takes its due: ' + d + ' HP.', { ft: 'bad', hurt: d }); out = 'cursed'; }
        } else { say('shrine', nm + ' leaves the shrine as he found it.', { ft: 'skip' }); out = 'passed'; }
      } else if (e.kind === 'fork') {
        // The way splits, into two or three. What is down each is learned by trying it; a scout sees a snare before it is
        // sprung, a keen eye sees something glinting, and a fighter takes the sting out of a guard. The words never say.
        const sd = (D.map && D.map.forks && D.map.forks[e.id]) || { a: 'left', b: 'right', c: 'ahead' }, kn = kn0;
        const easing = C && C.role === 'fighter' ? 0.25 * cm : 0;
        const spotter = (w) => H.wary >= w.trap.sense && C && H.wary - H.cSense < w.trap.sense;
        const hint = (w) => w.k === 'snare' && H.wary >= w.trap.sense ? (spotter(w) ? ' ' + cn + ' has spotted a snare here and will lead him round it.' : ' He can see a snare, and will step round it.') : w.k === 'cache' && H.keen >= w.sense ? ' Something glints in there.' : w.k === 'guard' && easing > 0 ? ' ' + cn + ' will take the edge off whatever is in there.' : '';
        const cost = (w) => { const v = kn[w.id]; return v == null ? '' : v >= 9999 ? ' It beat him last time.' : v < 0 ? ' Last time it mended ' + (-v) + ' HP.' : ' Last time it cost ' + v + ' HP.' + (kn[w.id + '$'] ? ' ' + kn[w.id + '$'] : ''); };
        arrive(nm + ' comes to a junction. The way splits.', { fork: e.id });
        seen[e.id] = { kind: 'fork', sides: sd, easy: easing > 0 ? C.name : null, ways: e.ways.map((w) => ({ id: w.id, say: w.say, c: kn[w.id] == null ? null : kn[w.id], note: kn[w.id + '$'] || null, snare: w.k === 'snare' && H.wary >= w.trap.sense ? (spotter(w) ? 'scout' : 'self') : null, glint: w.k === 'cache' && H.keen >= w.sense })) };
        const score = (w) => (kn[w.id] == null ? null : kn[w.id] >= 9999 ? 1e9 : kn[w.id]);
        const unk = e.ways.find((w) => score(w) == null);
        const best = unk ? letterOf(unk) : letterOf(e.ways.reduce((b, w) => (score(w) < score(b) ? w : b), e.ways[0]));
        const c = choose(e.id, 'fork', 'Which way?' + e.ways.map((w) => ' ' + up(sd[letterOf(w)]) + ': ' + w.say.toLowerCase() + '.' + hint(w) + cost(w)).join(''),
          e.ways.map((w) => ({ v: letterOf(w), label: up(sd[letterOf(w)]) + ': ' + w.say.split(',')[0] })), best);
        if (c == null) break;
        const w = e.ways.find((x) => letterOf(x) === c) || e.ways[0], side = sd[letterOf(w)], base = { path: letterOf(w), fork: e.id };
        const before = S.hp;
        out = letterOf(w);
        if (w.k === 'guard' || w.k === 'lair') {
          const foe = w.k === 'guard' && easing > 0 ? Object.assign({}, w.fight, { hp: Math.max(1, R(w.fight.hp * (1 - easing))) }) : w.fight;
          const r = fight(foe, false);
          if (!r) break;
          if (!r.won) { learned[w.id] = 9999; say('death', nm + ' took the ' + side + ' way and fell to ' + foeName(w.fight) + '.', Object.assign({ killer: w.fight.name }, base, fx(w.fight, r))); stages.push([e.id, 'died', 0]); return finish('died', w.fight, r); }
          tookFight[e.id] = letterOf(w);
          gold += w.gold; let prize = w.gold + ' gold';
          if (w.k === 'guard') { S.flasks += w.flask; prize += ' and a flask'; } else { found.push(w.loot); prize += ' and ' + w.loot.name; }
          learned[w.id] = r.hpLost; learned[w.id + '$'] = 'It paid ' + prize + '.';
          say('fork', nm + ' takes the ' + side + ' way and ' + KINDS[H.kind].verb + ' ' + foeName(w.fight) + ', losing ' + r.hpLost + ' HP. Behind them: ' + prize + '.', Object.assign({ prize: w.k === 'lair' ? 'item' : 'gold', item: w.k === 'lair' ? w.loot : undefined }, base, fx(w.fight, r)));
        } else if (w.k === 'snare') {
          say('fork', nm + ' takes the ' + side + ' way.', base);
          trap(w.trap);
          gold += w.gold;
          learned[w.id] = Math.max(0, R(before - S.hp)); learned[w.id + '$'] = 'It paid ' + w.gold + ' gold.';
          if (S.hp > 0) say('fork', 'Past the snare, ' + nm + ' finds ' + w.gold + ' gold.', Object.assign({ prize: 'gold' }, base));
        } else if (w.k === 'quiet') {
          const h = Math.min(H.hpMax - S.hp, R(H.hpMax * w.heal)); S.hp += h; S.mp = Math.min(H.mpMax, S.mp + 2);
          learned[w.id] = -h;
          say('fork', nm + ' takes the ' + side + ' way. It is quiet, and he catches his breath: +' + h + ' HP.', Object.assign({ ft: 'good', heal: h }, base));
        } else { // cache
          if (H.keen >= w.sense) {
            let prize;
            if (w.prize === 'flask') { S.flasks++; prize = 'a spare flask'; }
            else if (w.prize === 'gold') { gold += w.gold; prize = w.gold + ' gold'; }
            else { found.push(w.loot); prize = w.loot.name; }
            learned[w.id] = 0; learned[w.id + '$'] = 'It held ' + prize + '.';
            say('fork', nm + ' takes the ' + side + ' way and finds ' + prize + ' behind a loose stone.', Object.assign({ prize: w.prize === 'item' ? 'item' : w.prize, item: w.prize === 'item' ? w.loot : undefined }, base));
          } else { learned[w.id] = 0; learned[w.id + '$'] = 'It was a dead end, as far as he could tell.'; say('fork', nm + ' takes the ' + side + ' way. A dead end. If there is anything here, he can’t find it.', base); }
        }
      } else if (e.kind === 'boss') {
        say('boss', e.name + ' ' + e.rise + '.', { fx: { foe: { n: e.name, tags: e.tags, c: 1, el: e.el, boss: true }, rise: true } });
        const r = fight(e, true);
        if (!r) break;
        r.noted.forEach((x) => {
          if (x === 'adds') say('boss', e.name + ' calls ' + e.add.count + ' ' + e.add.name + ' to its side.', { mech: 'adds', join: true, add: { n: e.add.name, tags: e.add.tags, c: e.add.count } });
          if (x === 'enrage') say('boss', e.name + ' flies into a rage.', { mech: 'enrage', join: true });
        });
        if (e.mech === 'breath' && r.rounds >= 3) say('boss', e.name + ' ' + e.mt + '.', { mech: 'breath', join: true });
        if (e.mech === 'poison') say('boss', e.name + ' ' + e.mt + '.', { mech: 'poison', join: true });
        learned.boss = true;
        if (!r.won) { say('death', nm + (C ? ' and ' + cn : '') + ' dealt ' + r.dealt + ' damage to ' + e.name + ', but ' + (r.noted.indexOf('revive') >= 0 ? 'he went down a second time.' : 'he was defeated.'), Object.assign({ killer: e.name, bossLeft: r.bossLeft, bossMax: e.hp }, fx(e, r, true))); stages.push([e.id, 'died', 0]); return finish('died', e, r); }
        say('win', nm + ' struck down ' + e.name + (r.drank ? ' (drank ' + (r.drank > 1 ? r.drank + ' flasks' : 'a flask') + ')' : '') + ' with ' + R(S.hp) + ' HP to spare.' + compBit(r), fx(e, r, true));
        stages.push([e.id, 'won', R(S.hp)]);
        return finish('clear', e, r);
      }
      if (pause) break;
      if (S.hp <= 0 && tryRevive()) say('walk', nm + ' goes down, and ' + cn + ' hauls him back up.');
      if (S.hp <= 0) { say('death', nm + ' collapsed in ' + D.name + '.'); stages.push([e.id, 'died', 0]); return finish('died', e, { dealt: 0, bossLeft: 0 }); }
      stages.push([e.id, out, R(S.hp), hpIn]);
      // 2.13 the town: the chapel's mending and the library's MP, quietly, after every room
      if (S.hp > 0 && (H.regen || H.mpRoom)) {
        const h = Math.min(H.hpMax - S.hp, R(H.hpMax * H.regen));
        if (h > 0) { S.hp += h; pre = { h: (pre ? pre.h : 0) + h, hp: S.hp }; }
        if (H.mpRoom) S.mp = Math.min(H.mpMax, S.mp + H.mpRoom);
      }
    }
    return { pause: pause, log: log, dungeon: D };

    function finish(res, killer, r) {
      const total = all.length;
      const o = { res: res, log: log, dungeon: D, stages: stages, reached: stageNo, of: total, found: found, seen: seen, learned: learned, hero: H, eq: eq,
        hpLeft: Math.max(0, R(S.hp)), flasksLeft: S.flasks, drank: drunkAll, gold: 0, killer: res === 'died' ? killer.name : null, stashed: stashed, traded: traded };
      if (res === 'died' && killer.kind === 'boss') { o.bossLeft = r.bossLeft; o.bossHp = killer.hp; o.dealt = r.dealt; }
      if (res === 'clear') o.gold = R(Math.max(D.gold * 0.3, D.gold + gold - tolls) * (1 + H.gold));
      o.short = pron(inp.f, shortBy(o, D, H));
      return o;
    }
  }
  const itemExtra = (it) => (it.el ? ', ' + ELEMENTS[it.el].n.toLowerCase() + ' weapon' : '') + (it.res ? ', ' + pct(ELEM_TUNE.res) + '% ' + ELEMENTS[it.res].n.toLowerCase() + ' resistance' : '');
  // What a loss was short by, in plain words.
  function shortBy(o, D, H) {
    if (o.res === 'clear') return null;
    if (o.bossHp) {
      const pct = R((o.bossLeft / o.bossHp) * 100);
      let s = D.boss.name + ' had ' + o.bossLeft + ' of ' + o.bossHp + ' HP left (' + pct + '%).';
      if (o.dealt > 0) s += ' About ' + Math.max(5, R((o.bossLeft / o.dealt) * 100 / 5) * 5) + '% more damage would have done it.';
      return s;
    }
    return 'He didn\u2019t reach the boss: ' + o.killer + ' got him at stage ' + (o.reached + 1) + ' of ' + o.of + '.';
  }

  // ---------- the run from the app's side ----------
  function freshDelve() {
    return { v: 1, tv: 2, seed: (Math.random() * 4294967296) >>> 0, n: 0, day: null, pending: null, orders: { potion: null, arts: 'all', ev: {} }, seen: {}, known: {}, rec: {}, trophies: [], autoAt: '20:00', away: { on: false, home: null, r: 300 }, last: null, comp: '', runs: 0 };
  }
  function normDelve(s) {
    const d = s.delve && typeof s.delve === 'object' ? s.delve : freshDelve();
    // 2.22: thirteen themes, so the dungeon he's on (and those after) are laid out anew. What he'd learned about the old
    // layouts (ways, chests, standing orders, his attempts so far) would point at rooms that aren't there any more: forget it,
    // from his current one on.
    if ((d.tv | 0) < 2) {
      const cur = Math.max(0, d.n | 0);
      ['known', 'seen', 'kept', 'rec'].forEach((k) => { if (d[k] && typeof d[k] === 'object') Object.keys(d[k]).forEach((x) => { if (+x >= cur) delete d[k][x]; }); });
      if (d.orders && d.orders.ev) Object.keys(d.orders.ev).forEach((x) => { if (+x >= cur) delete d.orders.ev[x]; });
      d.tv = 2;
    }
    // 2.23: dungeons already cleared keep only their winning run; old history entries drop their inputs
    if (d.rec && typeof d.rec === 'object') Object.keys(d.rec).forEach((x) => { if (+x < (d.n | 0) && Array.isArray(d.rec[x]) && d.rec[x].length > 1) d.rec[x] = d.rec[x].slice(-1); });
    if (Array.isArray(d.hist)) d.hist.slice(0, -15).forEach((h) => { if (h.inp) { delete h.inp; h.lean = 1; } });
    const f = freshDelve();
    Object.keys(f).forEach((k) => { if (d[k] == null || typeof d[k] !== typeof f[k]) d[k] = f[k]; });
    d.orders = Object.assign({ potion: null, arts: 'all', ev: {} }, d.orders);
    if (!d.orders.ev || typeof d.orders.ev !== 'object') d.orders.ev = {};
    if (!/^\d\d:\d\d$/.test(d.autoAt)) d.autoAt = '20:00';
    d.n = Math.max(0, d.n | 0);
    d.away = Object.assign({ on: false, home: null, r: 300 }, d.away);
    d.away.home = !!d.away.home;
    d.curName = dungeonFor(d.seed, d.n).name; // for the phone's "he has set out" notification
    s.delve = d;
    return d;
  }
  // The hero as he stands right now (or with a given loadout / at a given time).
  function inputFor(s, opts) {
    opts = opts || {};
    const T = opts.t || Date.now();
    const H = G.homeState ? G.homeState(s, G.today(new Date(T))) : null;
    const pen = H && G.penalties ? G.penalties(s, H) : {};
    const base = {};
    STATS.forEach((k) => { base[k] = Math.max(1, G.statVal(s.stats[k]) + (G.relicBonus ? G.relicBonus(s, k) : 0) - (pen[k] || 0)); });
    const eq = {};
    const ids = opts.eq || s.eq;
    G.SLOTS.forEach((sl) => { const it = ids[sl] != null ? G.itemById(s, ids[sl]) : null; if (it) eq[sl] = it; });
    const d = s.delve;
    // 2.13 the town: what its buildings have given for good, and what the open ones lend
    const tw = s.town && G.townPerks ? G.townPerks(s) : null;
    let comp = compFor(s, T);
    if (comp && tw && tw.comp) comp = Object.assign({}, comp, { m: Math.round(comp.m * (1 + tw.comp / 100) * 1000) / 1000 });
    const town = {};
    if (tw) ['dmg', 'evade', 'hp', 'mpRoom', 'def', 'flask', 'heal', 'clearGold', 'hide', 'regen', 'sense'].forEach((k) => { if (tw[k]) town[k] = tw[k]; });
    return { town: town, name: s.hero && s.hero.name ? s.hero.name : 'He', f: !!(s.look && s.look.sex === 'f'), level: s.level, base: base, eq: eq, buffs: activeBuffs(s, T), orders: d.orders, seed: d.seed, n: d.n,
      attempt: (d.rec[d.n] || []).length, known: d.perks && d.perks.lore ? Object.assign({}, d.known, { [d.n]: Object.assign({ lore: true }, d.known[d.n] || {}) }) : d.known, pen: pen, comp: comp, perks: d.perks || {} };
  }
  // 2.2: go as often as you like. The fights are deterministic, so trying again with nothing changed gets the same result;
  // what moves him deeper is being stronger (gear, buffs, companion), and when the buffs lapse he hits the wall.
  const canRun = (s) => !s.delve.pending;
  // 2.22: the next dungeon opens the day after the last one fell (null: it's open)
  const delveOpens = (s, t) => (s.delve.opens && (t || G.today()) < s.delve.opens ? s.delve.opens : null);
  const ranToday = (s, t) => s.delve.day === t;
  // Everything that decides a run, so the app can say when nothing's changed since he fell.
  // 2.17 the old roads: the same man, a dungeon he's already cleared, no buffs and no afflictions. The scenery is new each time.
  function sparInput(s, n, T) {
    const inp = inputFor(s, T);
    return Object.assign({}, inp, { n: Math.max(0, Math.min(s.delve.n - 1, n | 0)), buffs: [], pen: {}, attempt: 1000 + ((s.spar && s.spar.runs) | 0) + (T && T.t ? T.t % 997 : 0), spar: true });
  }
  function runSig(inp) {
    return JSON.stringify([inp.town || 0, inp.perks || 0, inp.n, inp.level, inp.base, G.SLOTS.map((sl) => (inp.eq[sl] ? inp.eq[sl].id || inp.eq[sl].name : null)), inp.buffs.map((b) => b.type + b.amt).sort(), inp.comp ? [inp.comp.id, inp.comp.role, inp.comp.el, inp.comp.m, !!inp.comp.sulk] : null, inp.orders.potion, inp.orders.arts, inp.orders.ev[inp.n] || {}, inp.known[inp.n] || {}]);
  }
  // Bank the result: records, orders learned, loot and gold on a clear. Returns the record.
  function applyRun(s, out, meta) {
    const d = s.delve, n = d.n, D = out.dungeon;
    d.day = meta.day;
    d.seen[n] = Object.assign(d.seen[n] || {}, out.seen);
    d.known[n] = Object.assign(d.known[n] || {}, out.learned);
    const rec = {
      t: meta.t, d: meta.day, solo: !!meta.solo, res: out.res, at: out.reached, of: out.of, killer: out.killer, short: out.short,
      bossLeft: out.bossLeft, bossHp: out.bossHp, dealt: out.dealt, hpLeft: out.hpLeft,
      gear: G.SLOTS.map((sl) => (out.eq[sl] ? out.eq[sl].name : null)),
      hero: { hp: out.hero.hpMax, atk: R(out.hero.atk), def: R(out.hero.def), ev: R(out.hero.evade * 100), mp: out.hero.mpMax, fl: out.hero.flasks, el: out.hero.el, kind: out.hero.kind },
      buffs: (meta.buffs || []).map(buffLabel), stages: out.stages, gold: out.gold,
      comp: out.hero.comp ? compLabel(out.hero.comp) : null, sig: meta.sig || null,
    };
    // 2.7.1: everything that went in, so a run can be replayed with any one source switched off (see the analysis export)
    if (meta.inp) {
      const I = meta.inp;
      rec.inp = { level: I.level, base: I.base, pen: I.pen || {}, attempt: I.attempt, n: I.n, seed: I.seed,
        eq: G.SLOTS.reduce((o, sl) => { const it = I.eq[sl]; if (it) o[sl] = { name: it.name, art: it.art, tier: it.tier, el: it.el || null, res: it.res || null, bonus: it.bonus || null, power: G.power(it) }; return o; }, {}),
        buffs: (I.buffs || []).map((b) => ({ type: b.type, amt: b.amt, until: b.until || null })),
        comp: I.comp ? { id: I.comp.id, name: I.comp.name, role: I.comp.role, el: I.comp.el, m: I.comp.m, sulk: !!I.comp.sulk } : null,
        orders: I.orders || null };
      rec.st = out.hero.st;
      const R1 = (x) => Math.round(x * 10) / 10, foe = (f) => ({ id: f.id, name: f.name, hp: f.hp, atk: R1(f.atk), n: f.count || 1, el: f.el || null, tags: f.tags });
      rec.boss = { name: D.boss.name, hp: D.boss.hp, atk: R1(D.boss.atk), mech: D.boss.mech || null, el: D.boss.el || D.el, tags: D.boss.tags, left: out.bossLeft != null ? out.bossLeft : null, weak: D.weak };
      rec.dungeon = { name: D.name, theme: D.theme, n: n, el: D.el, weak: D.weak,
        rooms: D.events.map((e) => e.kind === 'fight' ? Object.assign({ k: 'fight' }, foe(e)) : e.kind === 'fork' ? { k: 'fork', id: e.id, ways: e.ways.map((w) => ({ id: w.id, k: w.k, fight: w.fight ? foe(w.fight) : null, trap: w.trap ? { trap: w.trap.what || 'trap', hurt: w.trap.hurt } : null })) }
          : e.kind === 'trap' ? { k: 'trap', id: e.id, hurt: e.hurt, sense: e.sense } : e.kind === 'secret' ? { k: 'secret', id: e.id, sense: e.sense } : { k: e.kind, id: e.id }) };
      rec.dealt = out.dealt != null ? out.dealt : null;
      rec.stagesHp = out.stages;  // [room id, result, HP going in, HP coming out]
    }
    // 2.8 bestiary: what he has met, and what he has beaten
    try {
      const B = d.beasts = d.beasts && typeof d.beasts === 'object' ? d.beasts : {}, byId = {};
      D.events.forEach((e) => { if (e.kind === 'fight') byId[e.id] = e; else if (e.kind === 'fork') e.ways.forEach((w) => { if (w.fight) byId[w.fight.id] = w.fight; }); else if (e.kind === 'toll') byId[e.fight.id] = e.fight; else if (e.kind === 'chest' && e.mimic) byId[e.mimic.id] = e.mimic; });
      (out.stages || []).forEach((st) => {
        const f = st[0] === 'boss' ? D.boss : byId[st[0]]; if (!f) return;
        const b = B[f.name] = B[f.name] || { seen: 0, slain: 0, theme: D.theme, boss: st[0] === 'boss' };
        b.seen += 1; if (st[1] === 'won') b.slain += 1;
      });
    } catch (e) { /* the book can miss a page */ }
    d.runs = (d.runs | 0) + 1;
    if (rec.inp) {  // the full detail lives only in the history list (about 2 KB a run), capped so the save stays small
      d.hist = (d.hist || []).concat([JSON.parse(JSON.stringify(Object.assign({ dn: n }, rec, { stages: undefined, sig: undefined })))]).slice(-100);
      // 2.23: only the newest 15 keep what went in (inp: the hero, his kit, his buffs); older ones keep the outcome
      d.hist.slice(0, -15).forEach((h) => { if (h.inp) { delete h.inp; h.lean = 1; } });
      delete rec.inp; delete rec.dungeon; delete rec.stagesHp; delete rec.st; rec.inHist = 1;
    }
    d.rec[n] = (d.rec[n] || []).concat([rec]).slice(-12);
    if (out.res === 'clear') d.rec[n] = d.rec[n].slice(-1);   // 2.23: once it falls, only the run that cleared it is kept
    if (out.res !== 'clear' && out.stashed && out.stashed.length) {
      d.kept = d.kept || {};
      const had = d.kept[n] || [], kept = [];
      out.stashed.forEach((it) => { if (had.indexOf(it.name) >= 0) return; const c = JSON.parse(JSON.stringify(it)); c.id = G.nextId(s); c.lvl = s.level; delete c.found; s.inv.push(c); had.push(it.name); kept.push(c.name); });
      d.kept[n] = had;
      if (kept.length) rec.kept = kept;
    }
    const keptNow = rec.kept || null;
    d.last = { kept: keptNow, t: meta.t, n: n, name: D.name, res: out.res, killer: out.killer, gold: out.gold, boss: D.boss.name, at: out.reached, of: out.of, solo: !!meta.solo, seen: false, comp: out.hero.comp ? out.hero.comp.name : null };
    if (out.res === 'clear') {
      const banked = [];
      // 2.20.5: a piece already banked from this dungeon (stashed on a run that fell) isn't banked a second time when it's cleared
      const had = (d.kept && d.kept[n]) || [];
      out.found.forEach((it) => { if (had.indexOf(it.name) >= 0) return; const c = JSON.parse(JSON.stringify(it)); c.id = G.nextId(s); c.lvl = s.level; delete c.found; s.inv.push(c); banked.push(c); });
      // 2.20 a goblin's trades only stand if he walks out: what he gave is gone from the pack, what he got is in it (and worn, if the other was)
      (out.traded || []).forEach((t) => {
        const gi = s.inv.findIndex((x) => x.id === t.gave.id);
        if (gi < 0) return;
        const wasWorn = s.eq && s.eq[t.slot] === t.gave.id;
        s.inv.splice(gi, 1);
        const c = JSON.parse(JSON.stringify(t.got)); c.id = G.nextId(s); c.lvl = s.level; delete c.found; s.inv.push(c); banked.push(c);
        if (wasWorn) s.eq[t.slot] = c.id; else if (s.eq && s.eq[t.slot] === t.gave.id) s.eq[t.slot] = null;
      });
      const spoils = 1 + (out.hero.luck > 0 ? 1 : 0);
      const r = rngOf(hash(d.seed + ':spoils:' + n));
      for (let i = 0; i < spoils; i++) { const it = G.rollItem(s, D.spoilsTier, r); if (r() < 0.3) { if (it.slot === 'weapon') it.el = pick(EL_KEYS, r); else it.res = pick(EL_KEYS, r); } s.inv.push(it); banked.push(it); }
      s.gold += out.gold;
      // 2.13 the town's counts: only the run that clears a dungeon counts, so each dungeon counts once
      if (G.townNote) {
        G.townNote(s, 'kills', (out.stages || []).reduce((a, st) => a + (st[1] === 'won' ? 1 : 0), 0));
        G.townNote(s, 'flasks', out.drank | 0);
        if (out.hero.comp) G.townNote(s, 'party', 1);
      }
      d.trophies.push({ n: n, boss: D.boss.name, theme: D.theme, name: D.name, d: meta.day });
      s.log.unshift({ t: meta.t, d: meta.day, v: 1, n: 'Cleared ' + D.name + ': ' + D.boss.name + ' falls', i: '⚔️', x: 0, g: out.gold });
      if (s.log.length > 300) s.log.length = 300;
      d.n = n + 1;
      // 2.22: one new dungeon a day. The way down to the next opens tomorrow; he can go at this one again as often as he likes
      // until it falls, and the old roads stay open. (Jake cleared eight in an evening: power had piled up behind one wall.)
      d.opens = meta.day && G.addDays ? G.addDays(meta.day, 1) : null;
      d.curName = dungeonFor(d.seed, d.n).name;
      d.last.loot = banked.map((it) => it.name);
      rec.loot = d.last.loot;
    }
    return rec;
  }
  // ---------- boons (2.10): one to choose after every third dungeon cleared, every fifth once eight are held ----------
  const PERKS = {
    flask: { n: 'Deep Draught', d: 'One more flask', max: 1 }, sense: { n: 'Dungeon Sense', d: 'Sharper at spotting snares and hidden doors', max: 3 },
    purse: { n: 'Grave-Robber', d: 'A tenth more gold from every clear', max: 3 }, hide: { n: 'Scar Tissue', d: 'Five in a hundred of every blow shrugged off', max: 3 },
    wind: { n: 'Second Wind', d: 'Eight in a hundred more health', max: 3 }, focus: { n: 'Cold Focus', d: 'A fifth more MP', max: 2 },
    step: { n: 'Light Step', d: 'Three in a hundred more chance to slip a blow', max: 3 }, lore: { n: 'Old Maps', d: 'What each boss fears is known before he sets out', max: 1 },
  };
  const perksEarned = (clears) => (clears <= 24 ? Math.floor(clears / 3) : 8 + Math.floor((clears - 24) / 5));
  const perksHeld = (d) => Object.keys(d.perks || {}).reduce((a, k) => a + (d.perks[k] | 0), 0);
  const perksDue = (s) => Math.max(0, perksEarned((s.delve.trophies || []).length) - perksHeld(s.delve));
  function perkOffer(s) {
    const d = s.delve, open = Object.keys(PERKS).filter((k) => ((d.perks || {})[k] | 0) < PERKS[k].max), r = rngOf(hash(d.seed + ':boon:' + perksHeld(d))), out = [];
    while (out.length < 3 && open.length) out.push(open.splice(Math.floor(r() * open.length), 1)[0]);
    return out;
  }
  function perkPick(s, k) {
    if (perksDue(s) <= 0 || perkOffer(s).indexOf(k) < 0) return false;
    s.delve.perks = s.delve.perks || {}; s.delve.perks[k] = (s.delve.perks[k] | 0) + 1;
    return true;
  }

  // ---------- where his strength comes from (2.8) ----------
  // How deep he would get tonight with each of his five sources switched on or off, shared out fairly between them
  // (the Shapley value). Also what the overdue chores are costing. A few hundred quick runs: call it off the main path.
  const SOURCES = ['stats', 'gear', 'buffs', 'comp', 'relics'];
  function powerShares(s, T) {
    const inp = inputFor(s, { t: T }), rel = {}, pen = inp.pen || {};
    STATS.forEach((k) => { rel[k] = G.relicBonus ? G.relicBonus(s, k) : 0; });
    const hero = (on, noPen) => {
      const v = Object.assign({}, inp, { attempt: 0, known: {} });
      v.base = {}; STATS.forEach((k) => { v.base[k] = Math.max(1, (on.stats ? G.statVal(s.stats[k]) : 10) + (on.relics ? rel[k] : 0) - (noPen ? 0 : pen[k] || 0)); });
      v.level = on.stats ? inp.level : 1; v.eq = on.gear ? inp.eq : {}; v.buffs = on.buffs ? inp.buffs : []; v.comp = on.comp ? inp.comp : null;
      return v;
    };
    const hi = s.delve.n + 10;
    const try1 = (v, n) => { const o = simRun(Object.assign({}, v, { n: n }), {}, false); return o.res === 'clear' ? 1 : Math.min(0.95, (o.reached / (o.of || 1)) * 0.9 + (o.bossHp ? 0.1 * (1 - (o.bossLeft || 0) / o.bossHp) : 0)); };
    const depth = (v) => { let lo = 0, up = hi; while (lo < up) { const m = Math.ceil((lo + up) / 2); if (try1(v, m) >= 1) lo = m; else up = m - 1; } return lo + (lo < hi ? try1(v, lo + 1) : 0); };
    const N = SOURCES.length, fact = [1, 1, 2, 6, 24, 120], cache = {};
    const F = (mask) => { if (cache[mask] == null) { const on = {}; SOURCES.forEach((k, i) => { on[k] = !!(mask & (1 << i)); }); cache[mask] = depth(hero(on)); } return cache[mask]; };
    const val = {}; let tot = 0;
    SOURCES.forEach((k, i) => {
      let sum = 0;
      for (let m = 0; m < (1 << N); m++) { if (m & (1 << i)) continue; let c = 0; for (let j = 0; j < N; j++) if (m & (1 << j)) c++; sum += (fact[c] * fact[N - c - 1] / fact[N]) * (F(m | (1 << i)) - F(m)); }
      val[k] = Math.max(0, sum); tot += val[k];
    });
    const pct = {}; SOURCES.forEach((k) => { pct[k] = tot > 0 ? Math.round((100 * val[k]) / tot) : 0; });
    const all = { stats: true, gear: true, buffs: true, comp: true, relics: true }, full = F((1 << N) - 1);
    const clean = Object.keys(pen).length ? depth(hero(all, true)) : full;
    return { pct: pct, depth: full, overdue: Math.max(0, Math.round((clean - full) * 10) / 10), has: { gear: Object.keys(inp.eq).length > 0, buffs: inp.buffs.length > 0, comp: !!inp.comp, relics: STATS.some((k) => rel[k] > 0) }, comp: inp.comp ? inp.comp.name : null };
  }

  // The best loadout on paper for a dungeon: power, plus its weakness and element, plus what the weapon type is good against.
  // Deliberately not a simulation (that would tell you whether you'll win).
  function bestLoadout(s, n) {
    const D = dungeonFor(s.delve.seed, n), tags = {};
    D.events.concat([D.boss]).forEach((e) => { const fs = e.kind === 'fork' ? e.ways.map((w) => w.fight).filter(Boolean) : e.kind === 'fight' || e.kind === 'boss' ? [e] : []; fs.forEach((f) => (f.tags || []).forEach((t) => { tags[t] = (tags[t] | 0) + 1; })); });
    const score = (it) => {
      let v = G.power(it);
      if (it.slot === 'weapon') {
        if (it.el === D.weak) v *= 1.6; else if (it.el === D.el) v *= 0.5;
        const K = KINDS[kindOf(it)];
        K.good.forEach((t) => { v *= 1 + 0.06 * (tags[t] | 0); });
        K.bad.forEach((t) => { v *= 1 - 0.04 * (tags[t] | 0); });
      } else if (it.res === D.el) v *= 1.4;
      return v;
    };
    const out = {};
    G.SLOTS.forEach((sl) => {
      let best = null, bv = -1;
      s.inv.forEach((it) => { if (it.slot !== sl) return; const v = score(it); if (v > bv) { bv = v; best = it; } });
      out[sl] = best ? best.id : null;
    });
    return out;
  }
  // Fallback time reached today, with no run yet?
  function autoDue(s, now) {
    const d = s.delve, t = G.today(now);
    if (ranToday(s, t) || d.pending || delveOpens(s, t)) return false;
    const p = d.autoAt.split(':').map(Number);
    return now.getHours() * 60 + now.getMinutes() >= p[0] * 60 + p[1];
  }
  // What the hero knows about the current dungeon: theme, element, what it fears (once learned), how far he's got.
  function intel(s) {
    const d = s.delve, n = d.n, D = dungeonFor(d.seed, n), rec = d.rec[n] || [], k = d.known[n] || {};
    const best = rec.reduce((b, r) => (b == null || r.at > b.at || (r.at === b.at && (r.bossLeft || 0) < (b.bossLeft || 1e9)) ? r : b), null);
    return { D: D, rec: rec, known: k, best: best, weakKnown: !!(k.boss || k.lore || (d.perks && d.perks.lore)), bossKnown: !!k.boss };
  }

  Object.assign(G, { elemText, ELEM_TUNE,
    ELEMENTS, EL_KEYS, KINDS, TAGS, THEMES, BUFFS, BUFF_ORDER, MAX_BUFFS,
    dungeonFor, simRun, heroFrom, activeBuffs, buffTotals, buffLabel, questBuff, inputFor, sparInput, canRun, delveOpens, ranToday, runSig, applyRun, powerShares, SOURCES, THEMES, PERKS, perksDue, perksHeld, perkOffer, perkPick, bestLoadout, autoDue, intel,
    COMP_ROLES, BIRD_ROLE, TAGALONG, compFor, compLabel,
    normDelve, freshDelve, pron, delveTune: TUNE, diffOf, delveRng: rngOf, delveHash: hash, kindOf, itemExtra,
  });
})(typeof window !== 'undefined' ? window : globalThis);
