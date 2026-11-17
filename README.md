# Grindstone

A personal RPG life tracker for Android, with a home-screen widget.

Do real-life quests and earn XP and gold. Levelling up gives you chests, chests give you gear, and the gear shows up on your hero.

## Layout

| Path | What it is |
|---|---|
| `assets/core.js` | Game rules: XP, levels, streaks, loot tables, default quests |
| `assets/app.js`, `style.css`, `art.js` | The app UI (runs in a WebView) and the hero portrait art |
| `src/.../Game.java` | Java copy of the rules the widget needs. **Keep it in sync with `core.js`** |
| `src/.../QuestWidget.java` | The home-screen widget (tap a quest to complete it) |
| `src/.../Ticker.java` | Midnight refresh + the "you haven't trained in N days" nudge |
| `src/.../Herald.java`, `HeraldJob.java`, `HeraldCore.java` | The herald: reads deeds Claude logs to the "Grindstone" Google calendar and ticks the quests off |
| `src/.../QuestWidget.java`, `Omens.java`, `WidgetStore.java`, `FrameProvider.java` | The hearth widget: a looping close-up of the hero, and the three omens |
| `src/.../WidgetCam.java`, `assets/widgetcam.html` | Renders a fresh widget clip while the app is closed (best effort) |
| `src/.../QuestListWidget.java` | The old quest-list widget, still offered in the widget picker |
| `src/.../Interpreter.java`, `InterpreterCore.java` | Optional AI model that places deeds the herald can't |
| `src/.../MainActivity.java` | WebView host and the JS ↔ Android bridge (`window.Native`) |
| `assets/hearth2d.js`, `assets/lpchero.js` | The 2D Hearth and the LPC hero compositor |
| `assets/2d/` | Baked art: `world.png`/`world.json` (house) and `hero/` (LPC layers + palettes) |
| `tools2d/` | `bake_world.py`, `bake_hero.py`: rebuild `assets/2d/` from the LPC repos |
| `src3d/`, `tools3d/`, `legacy3d/` | The retired 3D Hearth (not shipped) |
| `grindstone.jks` | Signing key. **Keep it.** Updates must be signed with the same key or Android will refuse to install them over the top |

## Building

On Ubuntu/Debian:

```
sudo apt install aapt dalvik-exchange zipalign apksigner default-jdk
# android.jar for API 34, e.g. from github.com/Sable/android-platforms
ANDROID_JAR=/path/to/android-34.jar ./build.sh
```

The APK comes out at `build/Grindstone.apk`. Bump `versionCode` in `AndroidManifest.xml` for each update.

## The herald (deeds from Claude)

Claude can't reach the phone, but Google Calendar can. Claude logs each deed Jake reports as an event in a Google calendar called **Grindstone**; Google syncs it to the phone; `HeraldJob` wakes when the phone's calendar changes, reads the new events and completes the matching quests (widget and all).

- Event title = the deed. Several go in one title separated by `;`. Repeats: `Log my meals ×2`, `Water x3` or `3x Water`.
- Matching (`HeraldCore.match`): exact name, then each quest's aliases (editable in the quest editor), then word overlap with light stemming. If two quests fit about equally, or nothing fits, it lands under *Word from the herald* on Today for Jake to assign; the wording is learned.
- Only events from the last 3 days (and not before the herald was switched on, less 12 hours) count, each once. Repeating events are ignored.
- While the app is open, Java never writes under it: the page saves, then pulls with `Native.heraldSync()`.
- Setup: create the calendar at calendar.google.com, switch the herald on in Records → Settings (it asks for calendar access, finds the calendar and can switch its sync on), and give Claude the `grindstone-herald` skill.

`test/jt/.../HeraldTest.java` covers the matching and crediting; `test/herald_ui.js` the screens.

## The hearth widget

The app renders a short looping close-up of the hero in the house (12 to 24 JPEG frames, `House2D.captureClip`) and the widget plays it with a `ViewFlipper`. Frames live in `files/wframes/` and reach the launcher through `FrameProvider`. The clip is refreshed:

- by the app, a few seconds after it opens or the house changes (never while the Hearth tab is on screen), if the clip is over 20 minutes old or the house has changed;
- in the background by `WidgetCam` (a WebView on a private virtual display, nothing shown on screen) every few hours, and 10 minutes after the herald credits something. If that fails on a given phone, the widget simply keeps its last clip.

The three stats come from `Omens.compute` (a port of `G.widgetOmens`; `test/omens.js` + `OmensCheck.java` keep them identical). If anything's afflicted, or two things are building, it shows what's been left longest. Otherwise it shows what you've been doing: streak, most-repeated quests this week, chores done today.

## The interpreter

Optional. In Settings, under the Herald, add any OpenAI-compatible key (Groq by default: `openai/gpt-oss-20b`). Deeds the herald can't place get one try with it; whatever it can't place, or if it's unset, slow, rate-limited or broken, waits on Today as before. After a failure it rests for 30 minutes. The key lives in its own prefs file, kept out of backups. `test/mock_llm.py` + `InterpTest.java` cover good, chatty, broken and slow replies.

## The Hearth (2D, since 2.0)

`assets/hearth2d.js` draws a top-down pixel-art house (LPC style), cut away so you can see in: kitchen, lounge, bedroom,
study (the gym lives here until the garage is built), laundry, the back yard and, once bought, the side lot.

- **He lives there.** The hero wanders between spots (couch, desk, bookshelf, fridge, stove, sink, bed, washing line,
  aviary, punching bag, pool, shed, tower…). Anything neglected pulls him over to stand and fret at it; otherwise he
  potters and lounges, weighted by each spot's appeal. A* on a 32 px grid; pose and facing per spot (`SPOTS`).
- **He thinks in emoji.** A bubble every 6–11 seconds: what he should be doing (the chore's icon with ❗ or 💢 when it's
  building or afflicted, ❓ for the worst one elsewhere), what he's doing (the spot's icon), what he's done today (✨),
  dailies still due (⏳). The app passes `G.heroMind(s, t)`; nothing else needs to know about it.
- **The house shows it.** The lawn grows tufts, then tall grass and ferns; dishes pile up (flies at the end); laundry
  heaps by the basket; droppings in the aviary; Ruby and Kermit flap and squawk when they're hungry; cobwebs in the gym
  and study. The restoration adds a rug, paintings, plants and lamps, then candelabras. Season follows the calendar
  (Albany never gets the snow tiles), and it darkens after dusk with the fire glowing.
- **Tap anything.** The object's sheet (`openThing` in `app.js`): what it is (its estate tier), the condition it
  shows, every quest that lives there (`THINGS`: linked features plus name matches) with *last done …* and what doing
  it now would earn (XP, gold, stat, a level, lifting the affliction), a Done button, and the upgrade. Tap the hero
  for his kit, a relic for the relic, empty floor to send him there. Drag to look round, pinch or ⌕ to zoom, ◎ to follow.
- **Estate tiers** swap sprites (0–3 distinct, 4 gilded, 5 gilded and gem-studded, twinkling). Floors and walls per
  tier; the garage and shed are little open-fronted rooms whose walls and floors follow their tier.
- **The widget clip** (`captureClip`) is a close-up of him doing something facing us, thought bubble included.

Art: `tools2d/bake_world.py` crops LPC Revised (github.com/ElizaWy/LPC; CC-BY 3.0 / OGA-BY 3.0) into
`assets/2d/world.png` + `world.json`, and draws what LPC never had (punching bag, weights, aviary, the parrots, washing
line, esky, tower) in the same palette. Re-run it with `LPCR=/path/to/ElizaWy_LPC python3 tools2d/bake_world.py --sheet contact.png`.

### Building the house yourself (2.1)

The layout is Jake's: `S.house` holds `rooms` (rectangles: two rows of wall face, floor, a bottom wall row; styled
House, Timber, Brick, Stone, Tin and dirt, or Garage and Shed once those are built), `doors` (wall cells) and `items`
(a catalogue key from `FURN` in `core.js`, a cell, maybe flipped). New saves get 2.0's house; 2.0 saves carry their
placed relics across. ✎ on the Hearth opens build mode:

- **Move**: tap something to pick it up, tap where it goes (its base lands on your tap). ⇋ flips it, Store puts it away.
- **Rooms**: tap two opposite corners anywhere inside the fence. Tap an existing room to rename it, restyle it or knock
  it down. Anything that can't stay where new walls land goes into storage, and the toast says what.
- **Doors**: tap a wall to put a door in or brick it up; shared walls open on both sides. Not in corners.
- **＋ Add**: what's in storage, and furniture, wall hangings, ornaments, yard bits and bird gear for gold.
- ↶ undoes (thirty steps). Rules live in `core.js` (`whyNot`, `roomAdd`, `doorToggle`), so the app, the renderer and
  normalisation agree. Pieces that progress gives you (the restoration's rug and paintings, the posh yard's hedges and
  lamps, the pool and the rest of the expansions) wait unseen in their spots until you've earned them; in build mode
  they show as ghosts you can move. Building the garage or shed makes its room where it used to go, if there's space.

Every walk is A* that only crosses between rooms through doors. The hero's spots come from the furniture, so he'll
fret at the fridge wherever you put it. **Stars** (☆ toggles them) sit at the top right of anything that opens a sheet.

### The household (2.1)

Hearth → Household. **Ruby** (eclectus hen: bites when tapped, sleeps in her night cage if there is one) and
**Kermit** (eclectus cock) live in the aviary unless you give them a room. Their gear (perch, play gym, swing, ladder,
bell, foraging box, bath, food dish, night cage) gives them somewhere to go; they fly between perches, sit on the
furniture, squawk when hungry, play with the toys. Kermit guards his room: put Ruby in it and he'll drive her next door.

**People**: Design someone (the hero's creator plus clothes, a hat and who they are). They move in now, for gold, or
when you fulfil a vow (pick them in the vow editor, or tie them to a vow in their card). Residents wander, sit, nap,
think in emoji and come over to chat. Up to eight.

**Daily life (2.2).** People in the house talk to each other and to the hero (topic and reaction bubbles, and now and
then a pointed ❓ about whatever chore he's neglecting), wave in passing, cook, read, lift, swim and potter at the
furniture, and stand tutting (😬) at messes rather than tidying them, so the house still tells the truth. At meal times
(7, 12:15 and 6 pm) everyone heads for the table and the chairs pulled up to it; at bedtime they go to bed (a bed in
their own room or the spare bed, sold in ＋ Add; nobody climbs into his unless they live in his room) and sleep with
their head on the pillow. He goes to bed at 10:30 and dreams about the chores. Ruby bites whoever comes close; Kermit
shows off. Existing houses get two dining chairs pulled up to the table.

The 3D Hearth (KayKit + three.js) is retired; its source stays in `src3d/`, `tools3d/` and `legacy3d/`, not in the APK.

## The estate

Hearth → Estate. Everything in the house has six tiers (Busted, Plain, Decent, Fancy, Gilded, Absurd), bought with gold; 1.7 resets every save to Busted. Tiers 4 and up need levels 4, 8 and 12. Seven expansions (garage gym, pool, shed, bigger lot & garden, outdoor kitchen, koi pond, watchtower) unlock at a level and a price, then upgrade the same way; the last three need the bigger lot. Tap any tier to try it on in the Hearth before buying. Prices and names live in `ESTATE` in `core.js`; `hearth2d.js` lays out each tier's sprite (baked by `tools2d/bake_world.py`) and `House2D.setEstate()` redraws the house when it changes. The whole lot, with every expansion, costs about 87,000 gold.

## The delve

Delve tab. Beat a dungeon's boss and the next, harder one opens (seven themes, then deeper laps). Since 2.2 you can go as often as you like: runs are deterministic, so retrying with nothing changed just loses again (the page says so), and what carries him deeper is being stronger right now. Stack buffs on a good day and clear several in a row (Onward after a clear goes straight into the next); let them lapse and he hits a wall. If you haven't sent him by the fallback time (8 pm by default) he goes once on his own, or, if the away check is on, when the phone notices you've left home. `assets/delve.js` holds it all: `dungeonFor()` builds each dungeon from a seed and never changes it until the boss falls; `simRun()` plays a run out deterministically (same gear, buffs and orders, same result), pausing to ask on a watched run when it meets something it has no order for; `activeBuffs()` reads buffs off the log (each quest leaves one, by its house link or stat unless you pick another; one per quest, three of a kind, eight in all). Loot found down there only comes home when the boss falls.

**Companions (2.2, earned since 2.3).** One companion can go with him (`compFor`, `COMP_ROLES`): a **fighter** adds 30%
of his damage and takes 15% of the blows, a **healer** patches him up between fights, brings a flask and revives him
once, a **scout** spots traps and secrets (+4), adds evasion and stops ambushes, a **mage** hits two foes a round with
their element (worth bringing the one the boss fears). **Ruby** bites (and bleeds bosses, and bites him); **Kermit**
keeps lookout. The birds fight at full strength fed, 60% hungry, and sulk at home when the feeding's been neglected.

The four people turn up when a habit sticks (`CALLINGS` in `core.js`), each on a different kind of deed and a different
clock, so they arrive in stages:

| Companion | Turns up after | Short buff (stacks to 3) |
|---|---|---|
| Healer | vitality deeds on 6 days a week, 2 weeks running | Fresh poultice, 12 h after any vitality deed |
| Scout | endurance on 3 days a week, 3 weeks running | Light on her feet, 12 h after any endurance session |
| Sparring partner | strength on 2 days a week, 4 weeks running | Warmed up, 24 h after any strength session |
| Mage | study or reading on 4 days a week, 5 weeks running | Fresh ink, 24 h after any study or reading |

Once they're in, the long buff (5 days) takes the whole calling again: another full run of weeks on top of the one
that brought them (four more weeks of two strength sessions for the sparring partner, and so on), counted from the day
the run completes; their card shows how far along the next one is. They work at 60% on their own, +30% with the long
buff and +10% per short buff (up to 120%). Week tallies are Monday to Sunday, kept
in `s.callings` so they survive the log being trimmed; recent weeks are recounted from the log so undos count.
`callingsCheck()` runs after each deed and on every load (the widget and herald log deeds too). Anyone else in the
house can tag along (2.4) in the role you give them in the editor, at a flat 25% (`TAGALONG`): the bonuses that are
all-or-nothing (the healer's flask and revive, the scout's no-ambush, a first strike) need at least half strength, so a
tagalong only brings the scaled part. `test/companion_ui.js` covers it.

**Watching it (2.4).** A watched run plays out in a scene above the log (`assets/delve2d.js`, `Crawl`): a strip of
rooms in the dungeon's colours, one per stage, that the hero walks with whoever came along. Each log line becomes a beat
(the swings and hits of the fight it describes, flasks, the companion's part, the chest, fountain, trap, secret, the boss
rising, calling adds, breathing) and `play(line)` returns how long it takes, which is how long the player waits before
the next line; questions and the result wait for the last beat. Skip runs the rest straight through. The scene only
shows what `simRun()` decided (the lines carry `fx` metadata for it), so watching and skipping end in the same place.
Monsters are Universal LPC sheets composed and recoloured by `tools2d/bake_mobs.py` (skeletons, zombies, trolls,
minotaurs, robed casters, knights, imps, harpies, wolfmen) plus a few small beasts and props drawn by hand, into
`assets/2d/delve.png`; the hero's big weapon swings come from `bake_hero.py`. Settings `crawl: false` turns it off.
`test/crawl_ui.js` and `test/crawl_themes.js` cover it.

**Blow by blow (2.5).** Every hit, flask, blow taken and revive in a fight is a whole number, and `fight()` writes each
one down (`fx.ev`: `h` his hits, `c` the companion's, `bleed`, `drink`, `in` blows taken with the HP after, `rev`,
`enrage`, `adds`; `fx.foes` names the foes `g0…`, adds are `a0…`). The crawl plays exactly that stream and invents
nothing: a crowd drawn as a few sprites shares out the HP of the foes each stands for. A healer's quiet patch-up between
stages rides on the next line as `pre`. A boss's trick lines are `join`ed to the line that ends the fight, so they play
inside it. With the scene up, a line shows in the log once its beat has played. Tap the scene to just watch (the log
hides; tap again to bring it back). Cosmetic randomness is seeded from the run, and everything shown with a number
goes into `crawl.trace`, so `test/events.js` (sim: 50k+ checks that hits add to the totals and HP chains into the next
line) and `test/crawl_trace.js` (browser: the numbers on screen add up to the log, the HP over his head matches the run
at every blow and every beat, the same seed plays back identically) can check it. `test/crawl_story.js` saves a
watched-with-the-log-hidden storyboard and its answer key, for showing someone who's never seen it.

**Choices (2.5).** `tools/sim/decisions.js` makes every choice the delve asks both (all) ways, everything else held
fixed, for 1,000 heroes at the dungeon they're stuck on and the one they only just clear. 2.4's fork (the right path was
as good or better 98% of the time), chest (putting it on, 94%) and fountain (drinking, 97%) leaned too hard one way,
so: the left path's fight now guards a flask as well as more gold; a stashed find comes home even if he falls (once per
dungeon), while one he's wearing is lost with him; a fountain is now a real gamble (half are tainted, −30% HP against
+35%). The potion order "never drink" (always worst) is gone in favour of "below 50%". A weapon art saved for a boss
hits 3× (2× otherwise). Results: `tools/sim/out/decisions-2.5.json`.

When the app is shut, `Delve.java` starts the run by writing a `pending` note into the save (at the fallback alarm, a missed-alarm check on each tick, or the away check every couple of hours); the page plays it out next time it opens. Home's coordinates live in `away.xml`, never in the save or in backups. `test/delve_balance.js` prints which dungeons each kind of hero clears; `test/delve_ui.js` covers the screens.

### Floor plans and fine-tuning (2.6)
- **Dungeon maps.** `dungeonFor` now carries `map` (`mapFor` in delve.js): rooms of different sizes on a coarse grid, joined by corridors that bend, laid by a seeded self-avoiding walk. Every dungeon has a fork (two from dungeon 4), drawn as two rooms of their own that meet again. The event order and the sim are unchanged. `test/dungeon_map.js` checks overlap, connectivity, determinism.
- **Learning a route.** A run records what each way cost (`known[n]["k0a"]`, `["k0b"]`, 9999 = it beat him); the fork prompt and the Delve page's floor plan show it and star the cheaper way. A scout who can see the snare says so and leads him round it; a fighter takes 25% x strength off the guard's HP.
- **Crawl.** `delve2d.js` now plays on that map: each room keeps its own floor line, he walks the corridors between rooms (`_travel`), camera follows on both axes.
- Rooms can be bought, resized, moved, sold (`roomPrice` = 10 + 5 per tile, half back); props are sized to their sprite (`tools/footprints.js`); locked props don't show or block while editing. Widget now refreshes a roaming clip from a hidden house.
- Menus: Hearth and Delve are single screens; conditions are flies/stink/sparkles on the star tags; delve history is under Records, buff chips are on quest rows.

### One look, a quest library and more to earn (2.7)

- **One look.** The whole interface is pixel art now: Pixelify Sans for text (digits come from Jersey 15, because Pixelify's 5 reads as an S), flat panels with hard borders, no gradients or serif type. The widgets use Jersey 15 too (`res/font/jersey15.ttf`). Cinzel and Garamond are gone from `fonts.css`, which halves it.
- **Rooms.** Layout mode has a ＋Room button: pick a size (presets from 1 × 1 to 12 × 12, or the steppers), what it is for, then tap the yard. It comes with a door. 10 gold plus 5 a floor tile; selling gives half back.
- **The quest library** (`assets/library.js`): about 250 ordinary deeds in 16 groups. Add the ones that apply, hide the ones that do not. Nothing is added to a save until asked.
- **Quests that rest.** A habit can come round every 2, 3, 7, 14, 30, 90, 180 or 365 days. Once done it sits under Resting until it is due again.
- **Not every quest gives a buff.** Trivial deeds and anything done three or more times a day are XP only by default; any quest can be set to no buff.
- **Plainer names.** Study, Swim, Strength training, Do the dishes and so on. Old names stay as aliases so the herald still recognises calendar entries.
- **Upkeep in steps.** A chore looks spotless until it is due, then visibly behind, worse halfway to afflicted, and at its worst once afflicted. The lawn is due at 14 days and afflicted at 28.
- **More to earn.** About 50 cosmetic props gated by level, six animal homes that each come with an animal that potters about, and twelve strangers who turn up at the gate between levels 3 and 40 and move in for gold (`WANDERERS` in `core.js`).
- **Dungeons.** Themed props and wall hangings in every room, drifting motes by theme, a title card on entering a room, and a screen shake on heavy hits. All painted on the static layer or computed from the clock, so runs take no longer.
- **The widget.** The clip is re-filmed three minutes after a change instead of twenty; the loop is rebuilt when the app is left, every tick and by a 15-minute non-waking alarm (so it fires as the screen comes on). Records shows when the clip was last filmed, why the last attempt failed if it did, and a Refresh button.
- **Finger taps.** `test/touch_ui.js` and `test/v27_ui.js` drive the app with touch emulation; mouse-only tests missed the 2.6 tap bug.

### Weeklies, a rebalance and the rest (2.8)

- **Weeklies** replace the three trials (`weeklyPool`, `weeklySlots`, `weeklyReroll` in `core.js`). Three offers to start; another opens at levels 6, 12, 20 and 30 and with three people living in; eight at most. Any open offer can be swapped: free the first time each week, then 10, 20, 40... gold. A swapped-in offer counts from the moment it arrives. Offers past the third are extras (20% more to do, half as much again in gold, a coffer from the sixth); the coffer for "the first three" ignores them.
- **Where his strength comes from.** `tools/sim/shares.js` plays the game forward and takes the Shapley share of each source in how deep he gets. Before: gear 55-60%, stats 25-30%, buffs 4-8%, companion 7-11%. Now (`TUNE.ws/wg/hv/wa/we/fist`, `GEAR_TUNE.per`, buffs doubled, `a/b` re-fitted): stats 56-67%, gear 15-20%, buffs 7-12%, companion 9-14%, at 6 to 52 weeks, with the pace held at about one dungeon a week for an ordinary week (`tools/sim/rebal.js`). The Delve page shows the split for tonight's hero and what overdue chores are costing (`G.powerShares`).
- **One word for late chores.** "Afflictions" and their names are gone from the interface: a chore is up to date, due or overdue, and overdue ones cost stats in the delve. Today shows one strip of chips instead of a paragraph.
- **The bare minimum.** A quest can carry a minimum ("ten minutes, any lift"). The `min` button logs it for half the XP and gold; it counts in full for streaks, upkeep and callings.
- **Targets**: a number to beat by a date (`s.marks`). Attempts are logged as minutes:seconds or a number, graphed against the target; meeting it pays the reward once.
- **The roster.** Settings links the calendar the shifts land in (`Herald.roster`, `rosterDigest`, `dayKind`). A day with nine hours worked (adjustable) or a split shift spanning thirteen is long: only dailies marked "needed even on a long shift" stay on the list, the rest are let off (they still pay). All-day events count only if they say RDO or leave.
- **Backups.** Once a week the save is written to Downloads/Grindstone through MediaStore (`Backup.java`), which an uninstall leaves alone; six are kept. Restore from a file uses the phone's picker.
- **What's left today.** From 6 pm (adjustable) a quiet notification lists open dailies with a tick button for each of the first three (`Ticker.checkRemind`); it redraws as they are ticked.
- **Seasons.** Three months each, Albany's. XP earned climbs a ten-step track (600 XP a step) paying gold and coffers; at the turn it starts again and the old one is kept. Grass grows at the stated rate in spring and slower the rest of the year (mirrored in `Omens.java`); rain falls outside on wet days; lights go up in December.
- **Collections** (Records): bestiary, bosses, relics, companions, strangers, props, targets, seasons.
- **Week in review** (chip on Today): what stuck, what slipped, weeklies, delve, targets, and one thing for next week.
- **Pixel icons** (`pix.js`): every emoji in the page is redrawn at 16 px with hard edges and stepped colours.
- Not built: the delve's result as a notification. The run is worked out by the page, so the phone can only say he has set out (it already does).

### The list wears down, the widget is shelved, gear does things (2.9)

- **Today wears down.** Anything finished for the day, and any habit resting until it comes round again, drops off the list. A bar says how many are left; a fold at the bottom keeps the finished ones in reach (undo, or another go). `todayList` in `app.js`.
- **The hearth widget is shelved.** It froze on the A54. The receiver is disabled in the manifest, nothing is filmed for it (`WIDGET_ON`, `QuestWidget.ENABLED`), the code is kept. The list widget and the evening note stay. `test/widget_ui.js` no longer applies.
- **Frame rate.** The house is drawn at two canvas pixels to the world pixel on dense screens (was three: under half the pixels to fill, same picture) and at up to 60 frames a second (was 30). The page background is a small picture instead of a gradient. With the widget's filming gone, nothing renders a second house in the background any more.
- **Gear effects** (`GEAR_FX` in `core.js`). Rare and better pieces always carry one, uncommon sometimes: Opener, Bossbane, Cornered, Crowd-work on weapons; Quick-eyed, Clear-headed, Wary on helms; Braced, Thick, Hale on armour; Brimming, Lucky, Potent on charms. Old pieces of rare and up are given one. Gear is now 20-24% of his strength, stats 58-62%.
- **Wording.** Cosy in the house, household and everyday screens; gothic in the delve. Vows are Goals.
- **Calendar write-back.** A deed ticked in the app is written to the Grindstone calendar, marked so the herald never reads it back; undo removes it (`Herald.write/unwrite`).
- **Sound.** Square-wave blips for ticks, levels, coffers and swaps, made on the spot; silent while the phone is on silent or vibrate.
- A weekly slot that opens mid-week counts from the moment it opens. A (Nice!) follows any lone 69.

### The house asks, the trader calls, boons from the deep (2.10)

- **Requests** (`asksTick`, `asksSync` in `core.js`). Once a day at most, someone living in the house may ask for a real deed that is slipping (late upkeep first, else something not done for three days), by a day. Two open at most; letting one lapse costs nothing. Keeping one pays gold and a favour with whoever asked (every third favour, a coffer), and a human passes on what the next boss fears if that isn't known.
- **Move-in conditions** (`WANTS`, `npcWants`). Each stranger wants something of the house as well as the gold: a room of a purpose and size, a number of rooms, or floor in all. Shown as a checklist on their row and card.
- **The trader** (`traderTick`). Calls about two days in five at a house with deeds on four of the last seven days. Four pieces rolled for the hero's level at three times their sale value; anything sold while he is in fetches 30% more.
- **Boons** (`PERKS` in `delve.js`). One to choose from three after every third dungeon cleared, every fifth once eight are held. Mostly utility; they ride with the hero for good and are part of the run's signature.

### The pack, tagged selling, seven slots, choices while watching (2.11)

- **The pack** (Status › Pack): everything he owns in one list by slot, worn pieces marked. "Tag to sell" turns rows into tick boxes; worn pieces can't be tagged; Sell shows what is going and for how much. The old one-tap "sell commons" button is gone ("Tag spare commons" tags them for review instead).
- **Comparison** (`cmpHtml`): anywhere a piece is offered (a chest in the delve, a coffer, the trader, the pack) it is set against what is worn in that slot: stat by stat, effect, element, and a plain verdict.
- **Seven slots**: off hand, gloves and boots join weapon, helm, armour and talisman. The new three are minor: no stat points, one small effect by kind (`MINOR_FX`: gloves damage, boots dodge, shields defence, lanterns trap sense, tomes MP, parrying blades damage taken), an effect of the other sort only from epic up, no resistances. Not drawn on the sprite. `a`, `wg`, `wa` moved to keep stats at about 56-58% and gear at 21-26%.
- **Watching means choosing**: while a run is watched every choice is asked, with last time's answer marked. Skip (or "Let him decide the rest") hands the rest to standing orders and his own judgement, as does a run nobody watches.

### Coffer choices and pixel gear icons (2.12)

Opening a coffer offers Sell, Keep or Equip, with the comparison against what he wears. Gear icons are rasterised to a 24-px grid (`pixelIcon` in `pix.js`) so they sit with the rest of the art.

### More land, and the town (2.13)

**Land.** `LANDS` in `core.js`: six purchases after the bigger lot, each pushing the fence out (east, then south) from 32 × 25 tiles to 68 × 61. `s.estate.land` holds the count; `landOf(s)` gives the world size and every `houseGeom` call takes it. The first purchase takes down the fence between the plot and the side lot, so rooms can run across. Each step adds four to the room limit (`roomLimit`). `hearth2d.js` sizes the world from the geometry, draws only what is on screen, scatters trees on unbuilt land past the old fence, and the zoom button gains a last step that fits the whole estate.

**Town.** Hearth › Town, open at level 8 with three residents or twelve estate upgrades (`townGate`). `TOWN` in `core.js` lists eleven buildings. Two can be open at once (three with six owned). An open building lends something (`act`: a stat grows 15% faster, flasks heal more, gear sells for more) and runs a five-step challenge ladder (`goals`, measured by `meter`); each step met pays a permanent reward (`rw`) and sets a longer one. Closing a building drops the count on its current step (`townToggle` deletes `s.town.base[k]`). `townTick`, called from `save()`, opens the town, counts gold coming in and settles challenges. Foes and flasks are counted in `applyRun` only on a clear, so each dungeon counts once. `townPerks(s)` totals everything; `inputFor` passes the delve-side part as `inp.town`, read in `heroFrom`. Town rewards, like boons, are a permanent base and sit outside the five-source strength split.

Companion homes and a bigger party are the next round.

### Today's plan, the forecast, and two new library lists (2.14)

**The plan.** Quests › Today is now one list to clear plus everything else. The plan is the due dailies and a few picks (`planFor` in `core.js`): six on a day off, three on a work day, one on a long shift, four with no roster (changeable in Settings, `s.settings.planN`). Picks are scored by `planScore`: overdue upkeep, weeklies and household requests rank up; hard jobs rank down on work days; outdoor jobs (`isOut`: by name, or `q.out`) rank down in wet, windy or very hot weather and up on a fine day. Nothing is hidden: unpicked habits sit under "Also on offer". The plan is drawn once and holds still once anything on it is done; two swaps a day (`planSwap`). Clearing it pays a small bonus once a day (`planClaim`).

**The forecast.** `MainActivity.weather` fetches today's forecast from open-meteo.com (no key) a few times a day, using the home fix rounded to about a kilometre, or Albany if none is set. It lands in `s.weather` and also drives the rain over the house. Off switch in Settings.

**Library.** "Looking back on the day" (18 open-ended prompts) and "Breaking habits" (18 clean-day dailies).

### Which stat a job feeds, and the last smooth pictures (2.15)

Discipline was taking nearly every chore. `RESTAT` in `core.js` moves sweaty jobs (mowing, vacuuming, scrubbing, washing the car) to Endurance, heavy and building jobs to Strength, and paperwork and planning to Intellect. It applies to the library, the starting quests, and once to an existing save (`restatSave`, flag `s.statV`), which also moves the XP those quests have already earned as far back as the log goes. Relics and coffers are now rasterised to a pixel grid like the gear icons (`pixelIcon(svg, grid)` in `pix.js`).

### Dailies that come round every few days (2.16)

A daily can be set to every 2, 3, 4, 5 or 7 days in the quest editor (`q.rest` on a daily). Once done it is not due, and so off the list and not counted as missed, until that many days have passed (`dueOn` in `core.js`, mirrored in `Game.java`). Upkeep linked to such a daily allows the same slack before it shows as late.

### Wind and the old roads (2.17)

Something to play that cannot stand in for the work. Every deed gives one wind (`s.wind`, max 12; undo takes it back). On the Delve page, "The old roads" lets him walk any cleared dungeon again by hand for two wind (`sparStart`, `sparInput`: no buffs, no afflictions). A clear pays a quarter of that dungeon's gold, capped per day at 40 + 5 per level (`sparPay`, `s.spar`). Nothing else moves: no XP, stats, loot, records, orders or progress.

### The old roads, fought by hand (2.18)

`assets/duel.js` is a small turn-based fight engine for the old roads (pure rules, plain-data state). The foes and the man are the real ones (`sparInput`, `heroFrom`), with foe health thinned (`THIN`) and blows eased (`EASE`) so a run is a few dozen taps. Each turn he strikes, uses his art (once a fight, 4 MP), guards (takes far less, next blow +30%) or drinks; each foe shows its intent, and a wind-up means a heavy blow next round. A finished run is rated on five stars (`duelStars`: clear, half health, no flasks, within par, never caught unguarded). `roadsPay` pays 20% of the dungeon's gold for each star not yet held there (`s.roads[n]` is a bitmask), so a dungeon pays out its original gold once more in total and then nothing. This replaces 2.17's daily gold cap.

### The old roads in the dungeon, your week, and bonus buffs (2.19)

**Old roads.** The dungeon is drawn above the fight as on a real run (`Crawl.duelEnter`, `duelRound`, `duelEnd` in `delve2d.js` drive the same scene a round at a time). Foes are back to full health, each with its own pool; a strike hits only the foe you pick. An axe's art is a cleave through all of them, and the pack-hunter effect spills a quarter onto the next. `EASE` 0.65 was fitted so a just-cleared dungeon gives two or three stars or a loss, and five needs roughly two and a half to four times the stat XP. A star pays 60% of the dungeon's gold (five stars, three times its gold).

**Stats.** Each attribute on the Status page says what it does in the delve (`statDelve`), from the same numbers the delve uses.

**Your week.** `s.life`: bin day (and the night before or the morning), how often he's paid and the last payday, and the big shop day. `lifeTag` reads a quest's name (bins, pay, shop, or `sched` for anything booked ahead: dentist, GP, haircut, check-ups). `lifeOn` says whether today is its day; the plan only picks such jobs on their day and never picks a booked-ahead one. `questWeekCap` caps a weekly's target by the quest's own frequency, his week (the bins go out once) and the most he has done in a week lately; `weekliesFit` brings existing offers down to it.

**Bonus buffs.** All the day's dailies done (+1 flask, 24 h), every pick done (+9% damage, 24 h), and a weekly finished (a buff that fits what it trained, 72 h). They sit in slots of their own (`s.bonus`, `bonusTick`, `bonusWeekly`; merged in `activeBuffs`) and are taken back if an undo un-earns them the same day.

## Tweaking balance

Everything lives at the top of `core.js`: `DIFF` sets XP and gold per difficulty, `need()` sets the level curve, `RARITY` sets loot odds, and `CHESTS` sets shop prices. If you change `DIFF` or `need()`, change the matching numbers in `Game.java` too.

### Balance against real weeks (2.5)

`tools/sim/` plays the real game code forward day by day from a deed timeline (TZ=Australia/Perth):
`backtest.js` takes the real records in `tools/sim/data/` (the Fitness Tracker's first week, 2–8 Nov, and the
Findmyshift roster, 12 Oct to 17 Dec), then projects forward on that roster at four effort levels (`EFFORT` in
`lib.js`: strong, ordinary, lapsed, and the pace actually logged), with deeds placed only where the roster leaves a free
window, Monte Carlo over dungeon seeds and deed placement. The player it models opens his chests, puts half his gold
into coffers, wears the best kit on paper, tries every companion and pushes on while runs clear. `tune.js` scores a set
of numbers against the targets over 12 weeks (the roster tiled past 17 Dec); `CFG='<json>'` replays a backtest with
other numbers (`out/backtest-2.4-numbers.*` is 2.4's).

Targets (dungeons cleared in a week, after the first): ordinary 1.0, strong 1.35, lapsed ≤ 0.15, a roster-heavy
ordinary week ≥ 0.75 of a light one, the two ordinary weeks after a lapse ≥ 0.8, luck spreading depth after 12 weeks by
≤ 6, and a great week clearing a few but not a dozen. 2.4 missed by a mile: loot from dungeon n was made at level
2 + 3n, so one lucky clear chained into the next dozen (p90 week: 15+ dungeons; effort barely mattered). 2.5
(`delve.js` `TUNE` and `BUFFS`): loot at level 3 + 0.6n, difficulty 1 + 0.75n + 0.045n² (was 0.5n + 0.12n²), the
five strongest buffs count (was the latest eight, which any ordinary day filled), buff amounts ×0.85. Over 12 weeks,
100 runs (`out/tune-2.5-final.json`): ordinary 1.07, strong 1.34, lapsed 0.34, roster-heavy/light 1.16/1.04, after a
lapse 1.22, depth p10–p90 11–18, p90 best week 8 (strong 9). Misses: a lapsed week still clears about a third of an ordinary one (the birds and meals keep
the XP coming), and a strong week is worth about 1.25× an ordinary one: stats grow with the square root of XP, so
effort has diminishing returns; making strong weeks count for more means changing `statVal`, which moves the whole
game's pacing.

### Missed weeks (2.5)

Each calling's run of weeks carries one emergency skip (`CALLING_TUNE.grace`): a week that misses the target spends it
instead of resetting the run, but doesn't count, so the run takes a week longer; it comes back when the run completes.
The first deed of the kind after a missed week gives a short buff that lasts twice as long. Why: missing one opportunity
didn't materially affect habit formation (Lally et al. 2010, *Eur J Soc Psychol* 40:998); goals with a costly
"emergency reserve" beat both easy and hard goals for persistence, including after a failed subgoal (Sharif & Shu 2017,
*JMR* 54:495; 2021, *OBHDP* 163:17); broken streaks cut later engagement, less so when they can be repaired (Silverman &
Barasch 2023, *JCR* 49:1095); and of 54 interventions in a 61,000-person gym megastudy, a small bonus for coming back
after a missed workout did best (Milkman et al. 2021, *Nature* 600:478).

### Before and after

Hearth → household → "Before and after 2.5" compares days a week at each habit, the six whole weeks before 2.5 first
ran (`s.since25`) and the six after, from the calling records (kept 40 weeks, unlike the 300-entry log).
`tools/sim/adherence.js save.json` does the same from an export.

### Profiling the crawl

`Crawl.stats()` (in DevTools) gives draw cost and frame gaps over the last ~600 frames. WebView debugging is on only
while the phone has USB debugging on (`MainActivity`). `test/crawl_perf.js` measures it in Chrome with CPU throttling.

## Testing in a browser

Serve the assets folder and open it in Chrome: `cd assets && python3 -m http.server 8000`, then go to http://localhost:8000. Without the Android bridge, the app saves to localStorage instead. (Opening `index.html` straight from disk won't load the Hearth's art: it needs a server.)

On the phone, the page is served from the APK under `https://grindstone.local/` (see `MainActivity.asset()`), which is what lets the art load.

## The hero (2.0)

The hero is a Universal LPC sprite (github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator;
CC-BY-SA 3.0 / GPL 3.0 / OGA-BY), composited at runtime by `assets/lpchero.js` from the layers
`tools2d/bake_hero.py` copies into `assets/2d/hero/` (about 2.4 MB, 79 items, ten animations), recoloured with the LPC palettes.

- **Creator**: man or woman, skin, 15 hairstyles, hair colour, five beards, glasses or an eyepatch, shirt colour.
  Settings → Rebirth changes looks and name only; 2.1 asks once more on first launch, starting bald, bearded and bespectacled.
- **Gear shows.** No body armour is rags. Gambesons are leather over a shirt, coats are frock coats or a trench,
  hauberks are mail, cuirasses plate, brigandines legion armour, robes robes (a tabard on a man: LPC drew robes for
  women only). The tier picks the metal (iron, steel, silver, gold) or the cloth colour, and adds boots, bracers,
  gauntlets, pauldrons, plate legs and, at epic and legendary, a cape. Helms climb kettle → nasal → barbuta → armet →
  great helm; hoods and great helms hide the hair. Charms show at the neck.
- **Weapons and shields** appear in the portraits (Status, Equipment, the delve). In the house he goes unarmed.
- Jackets have no sitting frames, so a seated coat-wearer drops to his shirt (`FALLBACK` in lpchero.js).
- Delve text says "she" for a heroine (`G.pron`).

### Dungeon variety, one-target hits and recolouring (2.20)
- **Dungeons are no longer the same shape.** `dungeonFor` v2 and `mapFor` give each delve its own route: some don't split, some split two or
  three ways (`WAYS`), and each way leads somewhere different. New rooms: goblin trader (swaps one equipped piece for another), toll warden,
  wanderer, shrine, rest, lair, and chests that can be left alone, or teleport back to the start and respawn the foes (tele), mimic, or snap.
  The sim is deterministic as before; `rec.dungeon` and the bestiary record the new kinds. Existing saves' current dungeon reshuffles once.
- **Prompts arrive with the room.** An `arrive` line plays when the hero reaches a room, so the choice shows up where it is made, with a
  neutral prompt that doesn't spoil what is behind it. Chests are two-step (open it, then decide). The route map hides rooms not yet reached.
- **Hits land on one foe at a time** (axe and mage included); swarms now show up to three separate sprites.
- **Old roads walking fix.** `land()` settles the Crawl at every round, and the walk timer is uncapped, so spamming attacks can't desync the
  hero from the map (`test/probe_walls.js`).
- **`recolor.js`** recolours sprites by material family (wood, stone/metal, green, water, cloth): hue, saturation, brightness per
  family. Dark reds count as wood (mahogany); gold and brass count as wood too, so they take a finish.
  - *Dungeon looks*: every dungeon picks a floor and wall from its theme's pool (`LOOKPOOL`), a tint turn and brightness from `D.look`, and
    its own subset of props.
  - *Rarity*: rarity colours are a touch brighter, and the Crawl hero's sheets get `tierBoost` from the best piece worn (rare and up).

### Item text and furniture finishes (2.20.1)
- **Every effect a piece has is on its sheet, with numbers.** Elements and resistances were hidden: a sheet now says "⚡ 30% storm
  resistance: storm attacks do 30% less to him" or "❄️ Frost weapon: 60% more damage in dungeons weak to frost, half against frost foes"
  (`G.elemText`, from `ELEM_TUNE` in delve.js, which the fight also uses). Weapons say their kind and what it's good at. One `itemBody`
  draws the sheet, the coffer reveal and the trader rows alike.
- **The comparison box** works from the hero, not the item: `heroFrom` with and without the piece. It says "loses 30% storm
  resistance", "keeps storm resistance (his hood)" when another piece covers it, "already has it" for duplicates, the effects gained
  and lost with what they do, and an *In the delve* row with what actually moves (HP, attack, defence, dodge, MP, flasks, spotting).
  The verdict is "Mostly better/worse" when there's a trade-off. Minor effects read cleanly ("+2% damage reduction").
  The hero sheet says *Dodge* (not Evasion) and lists resistances.
- **Finishes replace 2.20.0's house-wide style setting.** Once a piece of the estate is at a level, its sheet has a Finishes grid: the same
  sprite recoloured (`G.FINISHES`, 12 of them in four grades coloured like rarity: Plain, Fine, Grand, Regal). Price is a share of what
  the next level costs (15%, 30%, 60%, 100%; from 2.20.3), so Regal costs the upgrade itself: somewhere for gold to go while the
  next level is locked. Tap to
  try it on in the hearth (the preview bar steps through them), buy, or switch between owned ones for free. Finishes belong to the level
  (`s.estate.fin[k] = { t, own, on }`): an upgrade brings new art and a fresh set. Walls, floors, the yard fence and wings take them too.
  The house draws finished sprites from cached recoloured copies (`House2D._src`).

### Hand-drawn symbols (2.20.2)
- Pixelify Sans has no ✦ ◈ ★ ☆ ✓ ✕ → ↻ ♪ and friends, so the phone drew them in a smooth fallback font, and the element emoji
  (⚡ 🔥 ❄️ ☠️ ✨) came out finer-grained than the lettering. `pix.js` now has a `GLY` table of hand-drawn bitmaps for them. One glyph
  pixel is one font pixel (0.095em), snapped to whole device pixels. Plain symbols are a CSS mask over the text colour, so a gained
  ✦ is green and a lost one red; the element icons have their own palettes. The character stays inside the span at no size, so
  copying and `innerText` still see it. Everything else emoji still goes through the 16-px redraw as before.

### Furniture levels locked by level and stat; a safety net for drawing (2.20.3)
- **Every level of a piece needs the hero's level and the stat it grows with** (`EST_STAT`, `estateReq`): `TIER_LEVEL` 1/2/4/7/11/16
  and `TIER_STAT` 0/20/80/220/500/1000. The sink grows with Discipline (the dishes), the desk and armchair with Intellect, the kitchen
  and bed with Vitality, the weights and walls with Strength, the yard, floors and bag with Endurance, and so on. Wings climb two hero
  levels a step behind their own unlock level. Balanced play meets both gates at about the same time; a neglected stat holds its rooms
  back. `estateNext` reports `lock` ('level', 'stat', 'gold', 'needs'); the list row says what it's waiting on ("80 DIS") and the
  ladder shows every level's needs, lit as they're met. Levels already owned are kept.
- **Finishes are priced off the next level**, so Regal costs what the upgrade would.
- **`snagCard`**: if a page or one part of the delve page throws while drawing, it shows the error and where, instead of leaving the
  old screen up and the tab looking dead.

### Delve pacing retuned (2.20.4)
- **The first month was too fast.** `tools/sim/tune.js` scored only the average week, so a fast first month (2.5 dungeons a week on
  an ordinary week, against a target of 1) and a slow third (0.7) averaged out to "on target". It now also scores weeks 2-4 (≤ 1.4) and
  weeks 9-12 (≥ 0.75), and the sim takes boons as they come (`lib.js` `delveNow`). Pre-2.20 code paced the same: this predates 2.20.
- **Difficulty** `diffOf(n) = 1 + a·n + b·n²`: a 1.1 → 2.0, b 0.036 → 0.01 (2.20.5 settles on 1.7 / 0.015, below). Result (60 runs): ordinary 1.04 a week, strong 1.34,
  lapsed 0.24, weeks 2-4 1.26, weeks 9-12 0.9, best ordinary week 1.65, recovery after a lapse 0.83. Not modelled: town buildings
  (a few % each) and relics.
- It applies to the dungeon you're on, so a save that ran ahead meets a wall until it catches up with the curve.

### Loot stops feeding depth (2.20.5)
- Jake's save (one week, level 7, dungeon 14) showed the real snowball: **loot rarity was set by dungeon number alone**
  (`lootTier = min(4, n/3)`), so every chest past dungeon 12 was a sure legendary, epic past 9, with special chests a tier up.
  He wore five legendaries at level 7. Now `min(3, n/5)`: the floor climbs every five dungeons and stops at epic; legendaries come
  from the roll, or a special chest past 15.
- **A chest pays once.** A piece stashed on a run that fell was banked again when the dungeon was cleared (two of the same boots,
  two of the same greatsword). `applyRun` now skips found pieces already kept from that dungeon.
- The sim retries after a fall when it changed his kit (up to three a day), as the real player does. Retuned with that and the new
  loot: a 1.7, b 0.015. Ordinary 1.02 a week, strong 1.37, weeks 2-4 1.34, weeks 9-12 0.86, lapsed 0.21, recovery 0.88.
- Jake's own save played forward on ordinary weeks: dungeon 14 falls about a week on, then 15-17 hold a couple of weeks while the
  curve catches up with his gear; around 18 after six weeks (level 13). Elements still swing single dungeons a lot (his resists
  cover rot and holy, so crypt, fen and sanctum fall easily): that's by design, and the main source of the remaining lumpiness.

### The old roads become a proper fight (2.21)
- **His moves** (`duel.js`): Strike, his weapon's **art**, his **off-hand skill**, Guard, Flask, **Gear**. Arts and skills cost MP and
  go on cooldown (`DUEL_ARTS`, `DUEL_OFF`):
  - arts: blade Rend (×1.8, bleeds 3 rounds), axe Cleave (×0.9 to all), blunt Shatter (×1.6, ignores a brace, staggers), polearm
    Impale (×1.4, ×2.8 on fliers, reaches the airborne, staggers), staff Nova (×1.1 to all, reaches), fists Haymaker (staggers);
  - off hand: shield Bash (×0.6, staggers), parrying dagger Parry (turns the next ordinary blow, ripostes ×0.8), lamp Flare (blinds
    all: 40% of blows miss for 2 rounds), book Mend (+25% HP).
  - A **stagger** cancels whatever the foe meant to do this round, a heavy blow included.
  - **Flasks** give 40% HP *and* 50% MP, and can be drunk at full health for the MP.
  - **Gear** swaps one piece from the pack and takes the turn (`duelGear` boils the pack down to the best per kind/element/
    resistance). It's the run's own copy: nothing changes his real kit.
- **Their moves**, always shown before he chooses, by what they are, and unlocked by depth (`DUEL_UNLOCK`): flurry (beasts, swarms;
  3×0.45) and brace (armoured, brutes; −60%) from road 3; charge (brutes; a heavy blow a guard only halves) and venom (undead, beasts;
  poison 3 rounds) from 5; hex (casters; his blows −30% for 2 rounds), drain (−4 MP) and mend (18%, 3 rounds between) from 7; howl
  (beasts; the pack +30% for 2 rounds) and fly (fliers; −60% from anything but reach, then a dive) from 10. From road 13 a boss in its
  second half acts twice a round.
- **Tuning** (`DUEL_TUNE`): foes hit at 0.65 + 0.02 × depth of the real thing, to 0.9; mobs at 85% health, bosses 70% (no buffs come
  down an old road); 25% health back between fights. `tools/sim/roads.js` plays heroes at weeks 2/4/8/12 against a middle road and
  the newest one with three bots. Naive (strike, guard, drink) clears middle roads early and almost nothing new. Casual (+ arts, the
  weakest first) clears the middle roads and some new ones. Smart (picks the weapon for each fight, staggers wind-ups, uses the off
  hand) clears every middle road and the newest one through week 8, 30% at week 12. Picking the right weapon for the fight is the
  biggest single difference.
- The screen: six moves with costs and cooldowns, foes' intents (a second one for a raging boss) and what's on them (bleeding,
  blinded, emboldened), his own (poisoned, hexed, parry ready), a ? panel explaining every move, and the gear picker. The fresh
  delves don't change: still automatic and predictable.

### Companion pathing and gear swaps on the old roads (2.21.1)
- **The companion was left behind.** On the way to a fight `duelEnter` set the companion to hold, so it stood still while he walked,
  then went straight for its spot through the walls once he arrived. If the round began first, a bird's swoop started from wherever it
  was stranded and flew back there afterwards. Now `_travel(to, true)` sends it along the same doors a step behind him (`COMP_LAG`),
  it walks to its fight spot (`C.home`) after he gets there, swoops start from that spot, and `land()` puts it back there if anything
  was cut short. The fresh delves are unchanged.
- **A gear swap redresses him.** `Crawl.reGear(eq)` rebuilds the hero's sheets in place when he changes gear mid-fight.
- **Hatchets and warhammers were invisible in a fight.** They used the LPC tool sprites, which only have walking frames, so they never
  showed standing or swinging. They now use the war-axe and mace sprites, which have slash frames.

### Thirteen dungeons, thirty-nine bosses, one new dungeon a day, and gold from deeds (2.22)
- **Why.** Jake's save (15 Nov, level 8): dungeons 4 to 16 cleared in four days, 12 of them in 36 hours, and the same seven bosses
  back with ", Reborn" every seven dungeons. 78% of his gold came from clears, 14% from old-road stars and trials, 9% from deeds,
  and his unworn pack was worth 21,000 gold at sell prices.
- **The bestiary.** Six new themes: the Brigands' Hold, the Witchwood, the Plague Ward, the Orc Warrens, the Black Keep and the
  Moonlit Manor, set between the first seven, so a lap is thirteen dungeons. Every theme has three bosses (`bosses: [...]`); a lap
  meets the next one, and only the fourth lap brings the first back, Reborn. Each boss has its own sprite (`vis`), and its trick
  reads in its own words (`mt`; otherwise it's worded for its element, not always "rot": `MECH_TEXT`, `BITE`). Each of the first
  seven themes gets one more kind of foe.
- **Fifty-three new foes and bosses from LPC parts** (`tools2d/bake_mobs.py`): bandits, cutthroats, thugs, sellswords, a corsair
  queen, hexers, hare-folk, wolf-wives, a woodwose, an erl-king, plague doctors, ratmen, a rat king, orcs, goblins, wartotaurs,
  men-at-arms, black knights, an executioner, vampires, a stitched creature, jack-o'-lanterns, an inquisitor and more. Robes only
  exist for women's bodies, so the men wear a long shirt over a plain skirt. The atlas drops the walk strip (never drawn) and crops
  each strip to its frames' union box, shelf-packed: 75 humanoids now fit in 2048 x 1426 (11.7 MB decoded), against 22 in
  1536 x 4912 (30 MB). A strip is `[x, y, frames, w, h, ox, oy, size]`.
- **Old saves.** Dungeon numbers keep their order, but from the one he's on the layouts are new, so `normDelve` forgets what he'd
  learned about those (ways, chests, orders and his attempts so far: `tv` 2). Trophies keep their names.
- **One new dungeon a day** (`delveOpens`). After a clear the way down opens the next day; he can retry the current dungeon as often as
  he likes until then, and the old roads stay open. The phone's own auto-delve (`Delve.java`) honours it too.
- **The sim's player was the problem, not just the curve.** The old sim player took the default at every choice. Jake chooses for
  himself, swaps companions and kit, and retries ten to twenty-five times a day. With his exact kit the old sim couldn't clear
  dungeon 12; a player who chooses well clears 12, 13 and 16 on the first go. `tools/sim/lib.js` `smartRun` now plays each choice
  greedily: try every option, play the rest out on defaults, keep the best. It also adds a 'keen' week (his volume: about 140 deeds,
  against 44 for ordinary and 69 for strong).
- **Curve** a 1.7 → 1.85. With the smart player and the daily gate (6 runs): ordinary 1.0 a week, strong 1.44, keen 1.65, lapsed 0.35.
  His own save played forward on keen weeks: dungeon 18 in about two weeks, then about one a week (around 24 after eight weeks).
- **Gold.** Deeds pay double (6/12/24/40/70). A clear pays 40 + 15n (was 50 + 25n), and gold picked up on the way pays 0.6x
  (`GOLD_K`). Old-road stars pay 0.2x the dungeon's gold each, so five stars pays what the clear did (was 3x: at a dungeon a week the
  roads would have out-earned everything). Selling a piece fetches a quarter of its worth (`itemValue`; trader prices are
  unchanged). In the sim, deeds now bring 66-70% of the gold that deeds and clears bring between them (roads and selling aren't
  modelled). Done by hand for Jake's keen week, with roads and sales added in, deeds come out about half.
- **Tests.** `test/bestiary_ui.js` (24th suite): the 13 themes, a sprite for every boss, the cropped atlas, laps and Reborn, the
  element wording, the brigand king drawn in the crawl, the gold numbers, the old-save migration and the daily gate. `companion_ui`
  expects no Onward after a clear; `v28_ui` expects the doubled deed gold; `v27_ui` gives the pedlar and the bard the rooms they've
  wanted since 2.19 (it had been failing quietly).

### Gold-tier gear waits, and the bars keep up (2.22.1)
- **Legendaries came far too early.** Jake had 27 by level 8. A cache, secret or trick chest lifted the loot floor by one, and from
  dungeon 15 that floor was legendary itself, so every one paid a legendary. Now:
  - `rollItem` never forces legendary (the floor stops at epic).
  - A legendary's weight comes from the level the piece is made at (`legWeight`): nothing before level 15, then rising to the
    usual 0.8 by level 30 and 1.2 past it.
  - Dungeon loot is made at level 3 + 0.6n, so the first legendaries turn up around dungeon 20 and only now and then before 30.
  - Coffers and the trader go by his own level.
  - Loot floors climb slower (common+ to 8, uncommon+ to 20, rare+ to 32, then epic+). The pieces he already has are untouched.
- **Curve** back to a 1.7 to make up for the leaner loot. 6 runs: ordinary 0.92 a week, strong 1.33, keen 1.65, lapsed 0.36.
- **HP and MP in the run screen.**
  - The flask question came mid-fight, before that fight had been shown, so it said "down to 132 of 470 HP" over bars that still
    read full. He's now asked only as a fight starts, when the scene has caught up. Mid-fight, with no standing order, he drinks
    below 35%.
  - The top bars follow the crawl blow by blow (`Crawl.onHp`) rather than jumping at the end of each fight.
  - The bars read "267 / 470 HP" and "51 / 55 MP".

### A year to a hero: the long curve, gold that matters late, 78 bosses, the end and New Game+ (2.23)
- **The yardstick is a year.** Jake wants each hero to last at least a year before the content runs out.
  - `tools/sim/year.js` plays a full year on one hero. The weeks are built from his real deeds
    (`tools/sim/data/jake_week.json`: 68 different deeds, 147 in his 8–14 Nov week), scaled 0.3x lapsed, 0.7x ordinary
    (about 100 a week) and 1x keen.
  - The sim hero learns each dungeon, five-stars each old road, sells what he won't wear, puts 15% of his gold into coffers and
    buys the cheapest open upgrade. The old 44-deed "ordinary" week came from before deeds got granular.
- **Pace.**
  - `diffOf` gains a knee at dungeon 52: `1 + 1.25n + 0.005n² + 0.045·max(0, n − 52)²`.
  - Ordinary (4 runs): 1.78 dungeons a week in the first half (one every four days), 1.51 in the second, about one a week in
    the last quarter. All 78 bosses by weeks 42–46.
  - Keen: 2.32, then 1.26. Lapsed: 0.85, then 0.65.
- **Levels.** `need(L) = 80 + 36(L − 1)` (was 40), so an ordinary year ends at level 50 (weeks 50–52); keen gets there around week 36.
  Unlocks spread out to match:
  - estate tiers at levels 1, 3, 8, 16, 28 and 40 (was 1, 2, 4, 7, 11, 16), with the wings opening from level 2 to 20
  - land every eight levels to 48
  - town buildings from level 8 to 40 (was 8 to 15)
  - wanderers to 48
- **Gold matters more as the year goes on.**
  - A met town challenge waits for the builders to be paid (`townPay`; `TOWN_PAY` 0.3x to 2.5x the building's price) before
    its reward is his.
  - Estate tiers 4 and 5 and the later land cost more.
  - Selling fetches a third of a piece's worth, so gear he won't wear pays for the town. A clear pays 40 + 18n.
  - Ordinary year: deeds bring 61k, clears 111k, roads 68k, sales 110k, and about 333k goes on the estate, land and town.
    Gold is what holds things up at the end.
  - Town challenges: a third building can be open from four owned and a fourth from eight (was a third at six). The last four
    buildings' challenges are shorter.
- **78 bosses.** Six per theme (39 new sprites from LPC parts, among them a lich, a green knight, a werewolf, a ghost bride, a
  clockwork knight and an archbishop). A boss comes back Reborn only after dungeon 78. The six laps have names: Deeper,
  Deepest, Forgotten, Abyssal, Last, then Endless.
- **The end.**
  - `contentState`: level 50, all 78 bosses, the estate at its top tier, all the land, every town building mastered.
    Records › The road to the end shows it.
  - The first time everything's done: a notice, and the Victor's Statue (the hero in gold, from his own sprite) in the yard.
  - Then the choice. **New Game+** (`newGamePlus`) starts a new hero but keeps the deeds and their history, rewards, settings,
    look, herald, roster, real-life details and the birds; the old hero joins `s.legacy` and stands in the new yard in stone.
    Or **keep going**, told plainly that everything from here comes round again, Reborn, and keeps scaling. New Game+ stays
    open from Records.
  - A copy of the old save goes to localStorage and the backup file first.
- **History that lasts.** The log keeps 300 entries, under a fortnight at his pace. Now `s.days[day]` holds
  `[deeds, xp, gold, STR, END, VIT, DIS, INT]` for good, and `s.qlast[quest]` holds each deed's last day: about 30 KB a year,
  backfilled from the log on load. The slipped-habits check and the history export use them.
- **A smaller save.**
  - A cleared dungeon keeps only its winning run.
  - Only the newest 15 history entries keep their full inputs; the history caps at 100.
  - Jake's 15 Nov save: 471 KB → about 300 KB.
- **Tests fail when they fail.** `test/run.sh` runs every suite and fails on any FAIL line or page error, not just a non-zero
  exit. `test/end_ui.js` (the 25th suite) covers the builders, the end, the statues and New Game+.

### The town, walked round: streets, interiors, people to talk to, companions' homes (2.24)
- **A map.** Hearth › Town opens on the town itself (`assets/town2d.js`, the `Town2D` engine), with the list of buildings
  under it. It's 44 × 46 tiles: Market Street (library, counting house, tavern, chapel), the square and Mill Lane (gym,
  baths, market, apothecary), Pond Row (dojo, running track, watch house, the pond), then Hearth Row and Cobble Row with
  sixteen house plots, and the south gate home. The layout, interiors and who's where live in `assets/town.js` (`G.TMAP`,
  `townLots`, `townPeople`), so node can test them.
  - Tap the ground to walk, a person to walk over and talk, a door to go in. Drag to look round; ⊕ zooms; ◎ finds him.
  - Each building he owns can be entered: one room with its keeper behind the counter, its furniture from the world atlas.
    Leave by the doorstep or the Leave button. Unbought lots are staked out with a SALE sign; tap one for its price and
    what it does.
  - The facades are LPC Revised's Brick House A and B and Paneled House A (Lanea Zimmerman and Eliza Wyatt, OGA-BY 3.0),
    recoloured per building with a hanging sign, baked by `tools2d/bake_town.py` into `assets/2d/town.png`. The watch house
    is the estate's tower.
- **Talking.** An old-style box at the bottom: a name plate, typed text, a page at a time, then choices (`G.townTalk`).
  - Keepers (eleven, named, each with their own lines): the current challenge and how it counts, paying the builders when
    it's met, opening or closing up, and the ladder.
  - Companions: a roof wanted, then what they want of their home, then small talk.
  - Wanderers looking for work wait in the square and say their price.
  - The trader stands by the market on the days he calls.
  - Townsfolk, new faces each day, more as the town grows, pass on hints (`G.townHints`): what the next boss does, who's
    coming at what level, the next lot to buy, how the open challenges count, a companion's wants, the trader's rules.
    Once they've said their piece they make small talk. One of them most days sells what the next dungeon can't stand for
    the price of a drink (◈ 10 + 2n), the same lore a kept request gives.
  - A gold ! marks anyone with something to say. A tap that finishes the text can't also pick a choice.
- **Companions' homes.** Everyone who lives with him (people, not the birds) gets a plot on Hearth Row or Cobble Row
  (`s.homes[id] = { plot, built, settled, house }`).
  - A cottage costs ◈ 250, then 150 more for each one already built, up to 2,500: one bedroom, a bed, a door.
  - He goes in from the map, and the hearth's own view and build tools work on their house. `G.homeProxy` hands the house
    tools a view of the save with their house, a plain estate and no relics; the gold is his. Their furniture and
    storage are their own.
  - What strangers wanted of his house (`WANTS`) is now what they want of their own, scaled for a cottage. The callings
    want a room each: healer a kitchen, scout a storeroom, fighter a gym, mage a study. Inviting no longer needs rooms in
    his house.
  - Once a home has everything on its list they settle in, once: half their price back as thanks (150 for the others), and
    they fight harder (a calling ×1.1; anyone else 0.35 instead of 0.25).
  - Only their homes can be built on. The public buildings are as they are.
- **Coming and going.** Going through a companion's door, or home through the south gate, puts him at the front door.
- `test/townmap_ui.js` covers the map, talking, going in and out, building a cottage and a room in it, settling in, the
  gate and a restart. `test/town_logic.js` checks every door can be reached with everything built, every keeper from the
  doorstep, and the homes' rules, without a browser. 27 suites in all.

### "It's been too long" reminders, and calendar deeds counted properly (2.25)
- **Per quest, off by default.** Each quest's card has a Remind me section: "if not done in N days", then just once,
  daily, every 2 or 3 days, or weekly. Stored as `q.remind = { d, rep, from, snz, ping }`; the rule is
  `G.remindState` (core.js), mirrored in `Overdue.java` for the phone. Keep the two the same: `test/remind_logic.js`
  and `test/overdue_java.js` check the same cases.
  - It counts from the last time it was done (`s.qlast`), or from when the reminder was turned on if it never has been.
    Logging it any way (the app, the widget, the evening note, the calendar herald) restarts the clock.
  - **Suggestions:** each quest now keeps its last dozen days (`s.qhist`). The card says how often he really does it
    (the median gap) and suggests that plus a quarter (at least a day): every 2 days → 3, weekly → 9. Turning it on
    starts at the suggestion; he can move off it, and the card offers it back.
  - **Cap:** 12 at once (`G.REMIND_MAX`). The card, the list and Settings all show "N of 12 on"; a thirteenth is refused
    with why.
- **One note a day, not a ping per task** (`Ticker.checkOverdue`, on the two-hourly tick).
  - It reads "Overdue: training 4d, mow lawn 9d, Cert IV 3d", longest gap first.
  - **Timing:** not before the hour set in Settings (9 am unless changed), not after 9:30 pm, and never within half an
    hour of a rostered shift. If a shift covers the hour, it waits for the first tick after.
  - **Tap it** for the app's overdue list.
  - **Snooze 1 day / 3 days** covers everything in the note. When a snooze runs out, the note says it again, even for a
    "just once" reminder.
  - **Where the note's record lives:** in the phone's own preferences (`rmPing`, `rmSnz`), never written into the save,
    so the open app's next save can't lose it. The app reads them through `Native.remindMarks()`, and the later date
    wins.
- **In the app:**
  - Today shows one ⏰ chip ("Mow the lawn 9d · Training 4d").
  - The chip opens Been too long. It lists what's overdue (✓ to log it, 1d or 3d to snooze), then what's snoozed, then
    what's being watched with days to go. Looking at the list clears the phone's note.
  - Settings › It's been too long turns the note on or off and sets its hour.
- **Fixed: deeds logged on the phone side** (calendar herald, widget, evening note) were short-changed.
  - **What was wrong:** `Game.java` still paid the old gold (3 to 35, not 6 to 70 since 2.22) and used the old level
    curve (80 + 40(L − 1), not 36). It also never reached `s.days`, `s.qlast`, the town's tallies, the counting house's
    cut or the wind.
  - **The fix:** it now pays the same, records `qlast` itself (so the note knows straight away), and marks each entry
    `nat: 1`. `G.settleNative` gives those entries the rest when the app next opens.
  - **One-off repair (`s.daysFix`):** every day the log fully covers is rebuilt from it into `s.days`, `s.qlast` and
    `s.qhist`. Gold already short-paid isn't refunded.

### Slips and the week (2.25.1)
- **A slip gets an offer.** Something with a rhythm (three or more recent days to judge by) that has gone well past it,
  and has no reminder, gets an offer on Today: one ⏰ chip, one quest at a time.
  - **When it counts as slipped:** at least the suggestion plus a day, and at least 1.75× its usual gap. Every 2 days
    → offered at 4; weekly → 13.
  - **The offer:** "Remind me at 3" turns one on at the suggestion, just once per slip. "Not this one" stops it asking
    about that quest for 60 days (`s.remindNo`).
  - **When it doesn't appear:** for to-dos, or once the 12 reminders are taken (`G.slipOffers`).
- **The week in review:**
  - Each slipped quest without a reminder has a ⏰ button that turns one on at the suggestion.
  - A new "Went overdue" list shows each reminder that was overdue during the week: on how many days, the longest it
    got, and whether it's still overdue or done since. It's worked out day by day by the same rule, from each quest's
    recent days (`G.overdueWeek`).

### Odd cycles, typed not tapped (2.25.2)
- **"Comes round" on a habit** has an Every… choice for any number of days from 1 to 365, e.g. a 35-day script that
  doesn't line up with anything else.
- **Typing or stepping the days:** the reminder's "If not done in" and the Every… choice both take a typed number, or
  −7/−1/+1/+7 taps. Getting from 7 to 35 used to take 28 taps. Reminders now go up to a year (they were capped at 90
  days).
- **A starting number with no history:** a habit that comes round every N days starts its reminder at N, and the card
  offers "Use N" if he's moved off it.
- **Starting part-way through a cycle (2.25.3):** with a reminder on, the card has a Last done date. If it was done
  before he set it up, he sets that day and the clock counts from it, not from today. It sets `s.qlast` and adds the day
  to `s.qhist`, but never moves either earlier than the log already has them. It isn't logged as a deed: no XP, no gold.

### People from the calendar, kids, pets, and any AI provider (2.26)
- **People from the calendar** (`people.js`). Settings › People and pets › Calendars with people in: pick any of the
  phone's calendars. `Native.peopleEvents(ids)` reads a year ahead (titles only; nothing leaves the phone) and
  `G.calDigest` keeps the events that name people:
  - **What reads as a person:** "Paul's birthday", "Emma's 5th birthday", "Jack turns 2", "Mum & Dad's anniversary",
    "Chris's farewell", "Baby shower - Emma", "Paul visiting", "Uncle Rob staying over", "Dinner with Sarah and Tom",
    "Coffee: Lesley" (`G.calParse`). Family words count as names; roster codes, "Team meeting", "Work Christmas party",
    "Dinner with the team" and the like don't. His own name and the pets' are never offered.
  - **Offered once each** (`G.peopleCandidates`): a Today chip (only for names with a big day; dinners wait in the
    list), then "Who's this?": Design, Not now (30 days), or Not a person (for good, `s.peopleNo`). A title's age
    ("5th birthday", "turns 1") starts them as a kid or a little one.
  - **Designing someone** reuses the creator: age (grown-up, kid, little one), looks, also-goes-by names, and when they
    turn up: for their days (on the day, or 1, 3, 7 or 14 days ahead; birthdays and big days, or anything with them),
    lives here, or never. Saved in `s.people` (up to 40), apart from the companions: they never delve, need no home in
    town, and don't count toward the eight.
  - **At the house** (`G.visitorsNow`): from the lead day through the event's last day, then they go. Visitors go home
    at night and come back by day; anyone who lives here stays. They note their event now and then (🎂 💐 🎉 🧳 ☕), and
    show in the At home strip and a Today chip. Their card counts down to the day.
  - **To-dos** (`G.calTodos`), for people he's designed, each made once (deleting one is final):
    - **A kid's birthday:** organise it (21 days out), then a present (10).
    - **A grown-up's birthday:** a present (10). **An anniversary:** something for it (7).
    - **A do:** get ready (5; 21 for a wedding). **A visit:** get the house ready (2).
    - An undone one goes once the day's been. Off per person, or in Settings.
- **Kids and little ones:** the LPC child body, head, shirt, pants and skirts, and five child hairs, baked by
  `bake_hero.py`. Their clothes only come walking, so standing still they wear the first walking frame
  (`lpchero.js`). Little ones are drawn at 0.7. Kids walk at 30, little ones toddle at 17 (grown-ups 40).
- **Pets step:** after the hero on a new game, and in Settings or the household any time after.
  - **Parrots:** the red and green parrots are Ruby and Kermit's birds (their art and manners), and can be renamed.
  - **Others:** a cat, dog, rabbit, chook, duck or frog comes with its home, free and put out (`s.pets`). Tapping the
    animal says its name.
  - **What follows the choice:** feeding ("Bird feeding", "Pet feeding", or "Feeding the animals"), the lore that names
    them, and whether there's an aviary to clean (`G.petsSet`, `G.petLabels`). Saving it unchanged changes nothing.
  - **First run:** hero → pets → calendar → the names in it → the welcome.
- **One AI helper, any provider.** The Oracle (picking weeklies) and the interpreter (placing deeds the herald can't
  match) share one connection, kept on the phone and never in backups. An old Claude key becomes it, once.
  - **Free, no card:** Groq (`openai/gpt-oss-120b`), Gemini (`gemini-3.8-flash`), OpenRouter (`openrouter/free`),
    GitHub Models (`openai/gpt-4.1-mini`) and Mistral (`mistral-small-latest`).
  - **Paid, or your own:** Claude (`claude-haiku-5-5`) and any OpenAI-compatible endpoint.
  - **The notes say which ones may train on what you send.** Cerebras is hidden: it needs a card now.
  - **How it asks:** `InterpreterCore.chat` speaks Claude's Messages API when the address is Anthropic's, and gives
    Gemini 2048 tokens of room to think inside its cap. `Native.aiAsk` is the Oracle's way in.
  - Switching provider needs that provider's key, so one provider's key is never sent to another.
- **Carried through New Game+:** the people, the names waved off, the calendar's events and to-dos, and the pets (with
  their homes put back).
- **Tests:** `people_logic`, `interp_java` (against `test/mock_llm.py`, Claude's API included) and `people_ui`.
