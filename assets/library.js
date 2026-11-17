/* The quest library: ordinary life, written down so nobody has to invent their own list.
 * Each entry: [name, icon, type, stat, difficulty 1-5, { cap, rest (comes round every N days), days, home }].
 * Pick what applies, hide what doesn't. Nothing here is added to a save until he asks for it. */
(function (root) {
  'use strict';
  const G = root.G;
  const H = (cap, rest, extra) => Object.assign({ cap: cap == null ? 1 : cap, rest: rest || 0 }, extra || {});
  const LIBRARY = [
    { k: 'train', n: 'Training', i: '🏋️', items: [
      ['Swim', '🏊', 'habit', 'END', 4, H()], ['Run', '🏃', 'habit', 'END', 4, H()], ['Strength training', '🏋️', 'habit', 'STR', 4, H()],
      ['Long walk', '🚶', 'habit', 'END', 2, H()], ['Bike ride', '🚴', 'habit', 'END', 3, H()], ['Hike', '🥾', 'habit', 'END', 4, H()],
      ['Bodyweight circuit', '🤸', 'habit', 'STR', 3, H()], ['Bag work or sparring', '🥊', 'habit', 'STR', 3, H()], ['Climbing', '🧗', 'habit', 'STR', 4, H()],
      ['Yoga or pilates', '🧘', 'habit', 'VIT', 2, H()], ['Stretch', '🧘', 'habit', 'VIT', 1, H()], ['Team sport or social game', '⚽', 'habit', 'END', 3, H()],
      ['Surf, paddle or kayak', '🏄', 'habit', 'END', 3, H()], ['10,000 steps', '👟', 'daily', 'END', 2], ['Take the stairs / walk instead of drive', '🪜', 'habit', 'END', 1, H(3)],
      ['Beach run-swim-run', '🌊', 'habit', 'END', 5, H()], ['Physio or rehab exercises', '🩹', 'daily', 'VIT', 2], ['Race, event or fitness test', '🏅', 'habit', 'END', 5, H(1, 30)],
    ] },
    { k: 'food', n: 'Food and drink', i: '🍳', items: [
      ['Drink enough water', '💧', 'daily', 'VIT', 1], ['Log my meals', '🍳', 'habit', 'VIT', 1, H(3)], ['Cook a proper meal', '🥦', 'habit', 'VIT', 2, H(2)],
      ['Eat breakfast', '🥣', 'daily', 'VIT', 1], ['Pack lunch instead of buying it', '🥪', 'habit', 'DIS', 2, H()], ['Meal prep for the week', '🍱', 'habit', 'DIS', 4, H(1, 7)],
      ['Grocery shop', '🛒', 'habit', 'VIT', 3, H(1, 3, { home: 'fridge' })], ['Plan the week’s meals', '📝', 'habit', 'DIS', 2, H(1, 7)], ['Five serves of veg', '🥕', 'daily', 'VIT', 2],
      ['Two pieces of fruit', '🍎', 'daily', 'VIT', 1], ['No takeaway today', '🚫', 'daily', 'DIS', 2], ['Alcohol-free day', '🧃', 'daily', 'VIT', 2],
      ['No sugary drinks today', '🥤', 'daily', 'VIT', 1], ['Try a new recipe', '👨‍🍳', 'habit', 'INT', 3, H(1, 7)], ['Bake something', '🍞', 'habit', 'INT', 2, H(1, 7)],
      ['Hit my protein target', '🍗', 'daily', 'STR', 2], ['Stop eating by 8pm', '🌙', 'daily', 'DIS', 2],
    ] },
    { k: 'body', n: 'Body and health', i: '❤️', items: [
      ['In bed by a sensible hour', '🛏️', 'daily', 'VIT', 2], ['Up with the first alarm', '⏰', 'daily', 'DIS', 2], ['Eight hours’ sleep', '😴', 'daily', 'VIT', 2],
      ['Brush and floss', '🪥', 'daily', 'VIT', 1], ['Skin care / sunscreen', '🧴', 'daily', 'VIT', 1], ['Take vitamins or medication', '💊', 'daily', 'VIT', 1],
      ['Shave / trim the beard', '🪒', 'habit', 'VIT', 1, H(1, 3)], ['Haircut', '💈', 'habit', 'VIT', 2, H(1, 30)], ['Cut my nails', '✂️', 'habit', 'VIT', 1, H(1, 14)],
      ['Weigh in / measurements', '⚖️', 'habit', 'DIS', 1, H(1, 7)], ['GP check-up', '🩺', 'habit', 'VIT', 3, H(1, 365)], ['Dentist', '🦷', 'habit', 'VIT', 3, H(1, 180)],
      ['Eye test', '👓', 'habit', 'VIT', 2, H(1, 365)], ['Skin check', '🔎', 'habit', 'VIT', 3, H(1, 365)], ['Book that appointment I keep putting off', '📞', 'todo', 'DIS', 2],
      ['Cold shower or ocean dip', '🧊', 'habit', 'VIT', 2, H()], ['Good posture / desk stretch break', '🪑', 'habit', 'VIT', 1, H(3)], ['Screen off an hour before bed', '📵', 'daily', 'DIS', 2],
    ] },
    { k: 'mind', n: 'Head and heart', i: '🧠', items: [
      ['Meditate or sit quietly', '🧘', 'habit', 'VIT', 2, H()], ['Journal', '📓', 'habit', 'INT', 2, H()], ['Plan tomorrow tonight', '🗒️', 'daily', 'DIS', 1],
      ['Weekly review and plan', '🗓️', 'habit', 'DIS', 3, H(1, 7)], ['Time outside in daylight', '☀️', 'daily', 'VIT', 1], ['An hour with no phone', '📴', 'habit', 'DIS', 2, H()],
      ['Something just for fun', '🎈', 'habit', 'VIT', 1, H()], ['Write down three good things', '✨', 'daily', 'VIT', 1], ['A proper day off', '🏖️', 'habit', 'VIT', 2, H(1, 7)],
      ['Tidy the head: brain-dump to paper', '🧹', 'habit', 'DIS', 1, H()], ['Stay off social media today', '🚷', 'daily', 'DIS', 2], ['Watch the sunrise or sunset', '🌅', 'habit', 'VIT', 1, H()],
    ] },
    // 2.14: the open-ended ones. Not jobs: questions to answer honestly at the end of the day.
    { k: 'reflect', n: 'Looking back on the day', i: '🪞', items: [
      ['Learn one new thing', '💡', 'habit', 'INT', 2, H()], ['Leave something better than I found it', '🧽', 'habit', 'DIS', 2, H()], ['Thank someone properly', '🙏', 'habit', 'VIT', 2, H()],
      ['Do the thing I was avoiding', '🐸', 'habit', 'DIS', 3, H()], ['Listen more than I talk', '👂', 'habit', 'INT', 2, H()], ['Own a mistake', '🫡', 'habit', 'DIS', 3, H()],
      ['Give a real compliment', '🌟', 'habit', 'VIT', 1, H()], ['Stay patient when it was hard to', '🧊', 'habit', 'DIS', 3, H()], ['Finish what I started', '🏁', 'habit', 'DIS', 3, H()],
      ['Do something a bit scary', '🎢', 'habit', 'VIT', 4, H()], ['Ask a good question', '❓', 'habit', 'INT', 2, H()], ['Say no to something I should say no to', '✋', 'habit', 'DIS', 3, H()],
      ['Check in on someone', '🫶', 'habit', 'VIT', 2, H()], ['Make someone laugh', '😄', 'habit', 'VIT', 1, H()], ['Go a bit further than asked', '➕', 'habit', 'DIS', 3, H()],
      ['Notice something I usually walk past', '👀', 'habit', 'INT', 1, H()], ['Change my mind about something', '🔄', 'habit', 'INT', 3, H(1, 7)], ['Let something small go', '🍃', 'habit', 'VIT', 2, H()],
    ] },
    // 2.14: things to not do. A clean day is a deed like any other; tick it off at the end of the day.
    { k: 'quit', n: 'Breaking habits', i: '⛓️', items: [
      ['No impulse buys today', '💸', 'daily', 'DIS', 2], ['No phone in bed', '📵', 'daily', 'DIS', 2], ['No junk food today', '🍟', 'daily', 'VIT', 2],
      ['No snacking between meals', '🍪', 'daily', 'DIS', 2], ['No energy drinks today', '⚡', 'daily', 'VIT', 1], ['No caffeine after 2pm', '☕', 'daily', 'VIT', 1],
      ['No doomscrolling', '🌀', 'daily', 'DIS', 2], ['No screens at the table', '🍽️', 'daily', 'DIS', 1], ['No games before the jobs are done', '🎮', 'daily', 'DIS', 2],
      ['No putting off the first job of the day', '🐌', 'daily', 'DIS', 2], ['No complaining today', '🤐', 'daily', 'DIS', 3], ['No skipping meals', '🍴', 'daily', 'VIT', 1],
      ['Smoke- and vape-free day', '🚭', 'daily', 'VIT', 3], ['No gambling today', '🎰', 'daily', 'DIS', 2], ['No late-night online shopping', '🛍️', 'daily', 'DIS', 1],
      ['No second helpings', '🥄', 'daily', 'DIS', 1], ['No biting my nails', '💅', 'daily', 'DIS', 1], ['No losing my temper', '🌋', 'daily', 'DIS', 3],
    ] },
    { k: 'daily', n: 'Home: most days', i: '🏠', items: [
      ['Do the dishes', '🍽️', 'daily', 'DIS', 2, { home: 'dishes' }], ['Make the bed', '🛏️', 'daily', 'DIS', 1], ['Ten-minute tidy', '🧺', 'daily', 'DIS', 1],
      ['Wipe the kitchen benches', '🧽', 'daily', 'DIS', 1], ['Take the rubbish out', '🗑️', 'habit', 'DIS', 1, H(1, 2)], ['Do a load of washing', '🧺', 'habit', 'DIS', 2, H(1, 0, { home: 'laundry' })],
      ['Hang out / bring in the washing', '👕', 'habit', 'DIS', 1, H()], ['Fold and put away clothes', '🧦', 'habit', 'DIS', 2, H()], ['Clear the table and surfaces', '🪑', 'daily', 'DIS', 1],
      ['Sweep the floors', '🧹', 'habit', 'DIS', 2, H(1, 2)], ['Open the house up and air it', '🪟', 'daily', 'VIT', 1], ['Unpack / run the dishwasher', '🫧', 'habit', 'DIS', 1, H()],
      ['Sort the mail', '📬', 'habit', 'DIS', 1, H(1, 2)], ['Reset the lounge before bed', '🛋️', 'daily', 'DIS', 1],
    ] },
    { k: 'weekly', n: 'Home: weekly', i: '🧹', items: [
      ['Vacuum', '🧹', 'habit', 'DIS', 2, H(1, 7)], ['Mop the floors', '🪣', 'habit', 'DIS', 3, H(1, 7)], ['Clean the bathroom', '🚿', 'habit', 'DIS', 3, H(1, 7)],
      ['Clean the toilet', '🚽', 'habit', 'DIS', 2, H(1, 7)], ['Change the sheets', '🛏️', 'habit', 'DIS', 2, H(1, 7)], ['Wash the towels', '🧖', 'habit', 'DIS', 1, H(1, 7)],
      ['Bins out for collection', '🚛', 'habit', 'DIS', 1, H(1, 7)], ['Wipe down the kitchen properly', '🧽', 'habit', 'DIS', 2, H(1, 7)], ['Clean the stovetop', '🍳', 'habit', 'DIS', 2, H(1, 7)],
      ['Clear out the fridge', '🧊', 'habit', 'DIS', 2, H(1, 7)], ['Dust', '🪶', 'habit', 'DIS', 2, H(1, 14)], ['Clean the mirrors and glass', '🪞', 'habit', 'DIS', 2, H(1, 14)],
      ['Tidy the bedroom properly', '🚪', 'habit', 'DIS', 2, H(1, 7)], ['Iron / sort work clothes for the week', '👔', 'habit', 'DIS', 2, H(1, 7)], ['Water the indoor plants', '🪴', 'habit', 'DIS', 1, H(1, 7)],
      ['Shared-house job (my turn)', '🤝', 'habit', 'DIS', 2, H(1, 7)],
    ] },
    { k: 'deep', n: 'Home: now and then', i: '🧰', items: [
      ['Clean the oven', '♨️', 'habit', 'DIS', 4, H(1, 90)], ['Clean the windows', '🪟', 'habit', 'DIS', 4, H(1, 90)], ['Wash the walls, doors and skirtings', '🧼', 'habit', 'DIS', 3, H(1, 90)],
      ['Clean the fridge inside and out', '🧊', 'habit', 'DIS', 3, H(1, 30)], ['Clean the microwave', '📦', 'habit', 'DIS', 1, H(1, 14)], ['Descale the kettle / clean the coffee machine', '☕', 'habit', 'DIS', 2, H(1, 30)],
      ['Clean the washing machine and filters', '🌀', 'habit', 'DIS', 2, H(1, 30)], ['Clean air-con / rangehood filters', '🌬️', 'habit', 'DIS', 3, H(1, 90)], ['Flip or rotate the mattress', '🛏️', 'habit', 'STR', 2, H(1, 90)],
      ['Wash the doona, pillows and bedding', '🛌', 'habit', 'DIS', 3, H(1, 90)], ['Declutter one drawer, shelf or cupboard', '🗄️', 'habit', 'DIS', 2, H(1, 7)], ['Sort the wardrobe and donate', '👚', 'habit', 'DIS', 3, H(1, 180)],
      ['Clear the pantry of expired food', '🥫', 'habit', 'DIS', 2, H(1, 90)], ['Test the smoke alarms', '🚨', 'habit', 'DIS', 2, H(1, 180)], ['Clean the gutters', '🍂', 'habit', 'STR', 4, H(1, 180)],
      ['Tip run / hard rubbish', '🚚', 'habit', 'STR', 4, H(1, 90)], ['Pest treatment (ants, spiders, mice)', '🐜', 'habit', 'DIS', 3, H(1, 180)], ['Work on the house', '🔨', 'habit', 'DIS', 4, H(1, 0, { home: 'reno' })],
      ['Fix that one small thing', '🪛', 'habit', 'DIS', 2, H()], ['Paint or patch a wall', '🖌️', 'habit', 'DIS', 4, H()], ['Tidy the shed or garage', '🧰', 'habit', 'DIS', 4, H(1, 90)],
      ['Sharpen the knives / service the tools', '🔪', 'habit', 'DIS', 2, H(1, 90)], ['Replace a globe, battery or filter', '💡', 'habit', 'DIS', 1, H()],
    ] },
    { k: 'yard', n: 'Yard and garden', i: '🌿', items: [
      ['Mow the lawn', '🌿', 'habit', 'DIS', 4, H(1, 7, { home: 'lawn' })], ['Whipper-snip the edges', '✂️', 'habit', 'DIS', 3, H(1, 14)], ['Weed the garden beds', '🌱', 'habit', 'DIS', 3, H(1, 14)],
      ['Water the garden', '🚿', 'habit', 'DIS', 1, H(1, 2)], ['Prune and trim', '🌳', 'habit', 'STR', 3, H(1, 30)], ['Rake leaves / sweep the paths', '🍂', 'habit', 'DIS', 2, H(1, 14)],
      ['Plant something', '🌻', 'habit', 'DIS', 2, H()], ['Tend the vegie patch', '🥕', 'habit', 'DIS', 2, H(1, 3)], ['Fertilise or mulch', '🪴', 'habit', 'DIS', 3, H(1, 90)],
      ['Turn the compost', '♻️', 'habit', 'DIS', 2, H(1, 14)], ['Clean the pool / check the water', '🏊', 'habit', 'DIS', 3, H(1, 7)], ['Clean the barbecue', '🍖', 'habit', 'DIS', 2, H(1, 30)],
      ['Pressure-wash the paving', '💦', 'habit', 'DIS', 4, H(1, 180)], ['Fix a fence, gate or reticulation', '🚪', 'habit', 'STR', 3, H()], ['Chop or stack firewood', '🪓', 'habit', 'STR', 3, H(1, 7)],
      ['Firebreak / clear around the house', '🔥', 'habit', 'STR', 5, H(1, 365)], ['Wash the outdoor furniture', '🪑', 'habit', 'DIS', 2, H(1, 90)],
    ] },
    { k: 'pets', n: 'Birds and other animals', i: '🦜', items: [
      ['Feed the birds', '🦜', 'daily', 'DIS', 2, { home: 'birds' }], ['Clean the aviary', '🧹', 'habit', 'DIS', 3, H(1, 7, { home: 'aviary' })], ['Fresh fruit and veg for the birds', '🍇', 'daily', 'DIS', 1],
      ['Out-of-cage time with the birds', '🪽', 'habit', 'VIT', 2, H()], ['Train or play with the birds', '🎾', 'habit', 'INT', 2, H()], ['Change the bird toys and perches around', '🪵', 'habit', 'DIS', 2, H(1, 14)],
      ['Scrub the food and water bowls', '🥣', 'habit', 'DIS', 1, H(1, 3)], ['Vet check', '🩺', 'habit', 'DIS', 3, H(1, 365)], ['Stock up on pet food', '🛍️', 'habit', 'DIS', 2, H(1, 30)],
      ['Walk the dog', '🐕', 'daily', 'END', 2], ['Feed the pets', '🥫', 'daily', 'DIS', 1], ['Clean the litter tray', '🐈', 'daily', 'DIS', 1],
      ['Brush or bath the pet', '🛁', 'habit', 'DIS', 2, H(1, 14)], ['Flea, tick and worm treatment', '💉', 'habit', 'DIS', 2, H(1, 30)], ['Clean the tank or enclosure', '🐠', 'habit', 'DIS', 3, H(1, 14)],
      ['Collect the eggs / feed the chooks', '🥚', 'daily', 'DIS', 1],
    ] },
    { k: 'car', n: 'Car and gear', i: '🚗', items: [
      ['Wash the car', '🚗', 'habit', 'DIS', 3, H(1, 30)], ['Vacuum and tidy the car', '🧹', 'habit', 'DIS', 2, H(1, 30)], ['Check tyres, oil and water', '🛞', 'habit', 'DIS', 2, H(1, 30)],
      ['Fuel up before it’s empty', '⛽', 'habit', 'DIS', 1, H(1, 3)], ['Car service', '🔧', 'habit', 'DIS', 4, H(1, 180)], ['Rego, licence or insurance renewed', '📄', 'habit', 'DIS', 3, H(1, 365)],
      ['Service the bike', '🚲', 'habit', 'DIS', 2, H(1, 90)], ['Rinse and dry the swim / beach gear', '🩱', 'habit', 'DIS', 1, H()], ['Clean and pack the gym bag', '🎒', 'habit', 'DIS', 1, H()],
      ['Service the mower and garden tools', '⚙️', 'habit', 'DIS', 3, H(1, 180)],
    ] },
    { k: 'money', n: 'Money and paperwork', i: '🧾', items: [
      ['Clear the inbox', '📧', 'habit', 'DIS', 1, H()], ['Pay the bills', '💳', 'habit', 'DIS', 2, H(1, 7)], ['Check the bank and budget', '📊', 'habit', 'DIS', 2, H(1, 7)],
      ['Track today’s spending', '🧮', 'daily', 'DIS', 1], ['No-spend day', '🐖', 'daily', 'DIS', 2], ['Move money into savings', '🏦', 'habit', 'DIS', 2, H(1, 14)],
      ['File the paperwork pile', '🗂️', 'habit', 'DIS', 2, H(1, 30)], ['Do my tax return', '🧾', 'habit', 'INT', 5, H(1, 365)], ['Review subscriptions and cancel one', '✂️', 'habit', 'DIS', 2, H(1, 90)],
      ['Compare insurance / power / phone plans', '🔍', 'habit', 'INT', 3, H(1, 365)], ['Mortgage or rent sorted', '🏠', 'habit', 'DIS', 1, H(1, 14)], ['Make the phone call I’ve been avoiding', '📞', 'habit', 'DIS', 3, H()],
      ['Life admin power hour', '⏳', 'habit', 'DIS', 3, H(1, 7)], ['Renew a card, licence or check before it lapses', '🪪', 'todo', 'DIS', 2], ['Back up the important documents', '💾', 'habit', 'DIS', 2, H(1, 90)],
      ['Update the will, super or beneficiaries', '📜', 'habit', 'INT', 4, H(1, 365)],
    ] },
    { k: 'work', n: 'Work and career', i: '💼', items: [
      ['On time and ready for shift', '⏱️', 'habit', 'DIS', 2, H()], ['Finish a shift well', '✅', 'habit', 'DIS', 3, H()], ['Pack the work bag the night before', '🎒', 'habit', 'DIS', 1, H()],
      ['Deep work block (no distractions)', '🎯', 'habit', 'INT', 3, H(2)], ['Clear the work to-do list', '📋', 'habit', 'DIS', 3, H()], ['Write up notes / handover properly', '📝', 'habit', 'DIS', 2, H()],
      ['Apply for a job', '📨', 'habit', 'INT', 4, H(2)], ['Update the résumé or selection criteria', '📄', 'habit', 'INT', 3, H(1, 30)], ['Search and shortlist jobs', '🔎', 'habit', 'INT', 2, H(1, 3)],
      ['Prepare for an interview', '🗣️', 'habit', 'INT', 4, H()], ['Follow up an application or contact', '✉️', 'habit', 'DIS', 2, H()], ['Professional learning (course, webinar, reading)', '🎓', 'habit', 'INT', 3, H()],
      ['Renew a ticket or check (First Aid, WWCC, registration)', '🪪', 'habit', 'DIS', 3, H(1, 365)], ['Catch up with a colleague or mentor', '☕', 'habit', 'INT', 2, H(1, 14)], ['Tidy the desk and files', '🗃️', 'habit', 'DIS', 1, H(1, 7)],
      ['Check the roster and plan the week around it', '🗓️', 'habit', 'DIS', 1, H(1, 7)], ['Ask for feedback', '💬', 'habit', 'INT', 3, H(1, 30)],
    ] },
    { k: 'study', n: 'Study and learning', i: '📚', items: [
      ['Study', '📚', 'habit', 'INT', 3, H(2)], ['Submit an assessment', '📤', 'habit', 'INT', 5, H()], ['Do the pre-reading', '📑', 'habit', 'INT', 2, H()],
      ['Read', '📖', 'habit', 'INT', 2, H()], ['Finish a book', '📕', 'habit', 'INT', 4, H()], ['Listen to a podcast or audiobook that teaches something', '🎧', 'habit', 'INT', 1, H()],
      ['Practise a language', '🗣️', 'habit', 'INT', 2, H()], ['Practise an instrument', '🎸', 'habit', 'INT', 2, H()], ['Chess: puzzles or a studied game', '♟️', 'habit', 'INT', 2, H()],
      ['Learn a new skill (tutorial or lesson)', '🧩', 'habit', 'INT', 3, H()], ['Write up what I learnt', '✍️', 'habit', 'INT', 2, H()], ['Revise old notes or flashcards', '🗂️', 'habit', 'INT', 2, H()],
      ['Watch a documentary or lecture', '🎬', 'habit', 'INT', 1, H()], ['Finish a unit or module', '🎓', 'habit', 'INT', 5, H()],
    ] },
    { k: 'make', n: 'Making things', i: '🎨', items: [
      ['Work on my project', '🛠️', 'habit', 'INT', 3, H()], ['Write (fiction, game design, anything)', '✒️', 'habit', 'INT', 3, H()], ['Code for an hour', '💻', 'habit', 'INT', 3, H()],
      ['Prep the next tabletop session', '🎲', 'habit', 'INT', 3, H(1, 7)], ['Run or play a tabletop session', '🐉', 'habit', 'INT', 3, H(1, 7)], ['Draw, paint or sketch', '🖍️', 'habit', 'INT', 2, H()],
      ['Build or woodwork', '🪚', 'habit', 'STR', 3, H()], ['Play or record music', '🎶', 'habit', 'INT', 2, H()], ['Photography outing', '📷', 'habit', 'INT', 2, H()],
      ['Ship something: publish, post or share it', '🚀', 'habit', 'INT', 5, H()], ['Fix a bug / close an issue', '🐞', 'habit', 'INT', 2, H(3)], ['Playtest and take notes', '🧪', 'habit', 'INT', 3, H()],
    ] },
    { k: 'people', n: 'People', i: '🫂', items: [
      ['Call or message family', '📱', 'habit', 'VIT', 2, H()], ['Catch up with a friend', '🍻', 'habit', 'VIT', 2, H()], ['Quality time with the kids / nieces / nephews', '🧒', 'habit', 'VIT', 3, H()],
      ['Game night (online counts)', '🎮', 'habit', 'VIT', 1, H()], ['Date night or proper time with my partner', '🕯️', 'habit', 'VIT', 3, H(1, 7)], ['Reply to the messages I’ve left on read', '💬', 'habit', 'DIS', 1, H()],
      ['Remember a birthday (card, call or gift)', '🎂', 'habit', 'DIS', 2, H()], ['Help someone out', '🤲', 'habit', 'VIT', 3, H()], ['Have people over', '🏡', 'habit', 'VIT', 3, H(1, 14)],
      ['Do something kind and say nothing', '🎁', 'habit', 'VIT', 2, H()], ['Sort things out with the housemate (bills, jobs, plans)', '🧾', 'habit', 'DIS', 2, H(1, 14)], ['Volunteer or pitch in locally', '🙌', 'habit', 'VIT', 4, H(1, 7)],
      ['Meet someone new / go to the thing', '👋', 'habit', 'VIT', 3, H()],
    ] },
    { k: 'out', n: 'Out and about', i: '🧭', items: [
      ['Run the errands', '🧾', 'habit', 'DIS', 2, H()], ['Post office / returns / parcels', '📦', 'habit', 'DIS', 1, H()], ['Chemist run', '💊', 'habit', 'DIS', 1, H(1, 14)],
      ['Hardware shop run', '🔩', 'habit', 'DIS', 2, H()], ['Library visit', '🏛️', 'habit', 'INT', 1, H(1, 14)], ['Go somewhere new', '🗺️', 'habit', 'VIT', 3, H(1, 14)],
      ['Day trip or camping', '⛺', 'habit', 'END', 4, H(1, 30)], ['Beach or bush walk', '🌊', 'habit', 'END', 2, H()], ['Go fishing', '🎣', 'habit', 'VIT', 2, H()],
      ['Plan a holiday or weekend away', '🧳', 'habit', 'INT', 2, H(1, 90)],
    ] },
    { k: 'digital', n: 'Digital tidy', i: '💾', items: [
      ['Back up the phone and computer', '💾', 'habit', 'DIS', 2, H(1, 30)], ['Clear the downloads and desktop', '🗑️', 'habit', 'DIS', 1, H(1, 14)], ['Sort and cull photos', '🖼️', 'habit', 'DIS', 2, H(1, 30)],
      ['Unsubscribe from five things', '📭', 'habit', 'DIS', 1, H(1, 30)], ['Update passwords / check the password manager', '🔑', 'habit', 'INT', 3, H(1, 180)], ['Install the updates', '⬇️', 'habit', 'DIS', 1, H(1, 30)],
      ['Close the browser tabs', '🗂️', 'habit', 'DIS', 1, H(1, 7)], ['Tidy the notes and to-do apps', '🧹', 'habit', 'DIS', 2, H(1, 30)], ['Screen time under my limit', '📉', 'daily', 'DIS', 2],
    ] },
  ];
  if (G.restatOf) LIBRARY.forEach((c) => c.items.forEach((i) => { i[3] = G.restatOf(i[0], i[3]); }));   // 2.15: see RESTAT in core.js
  G.LIBRARY = LIBRARY;
  G.libraryCount = () => LIBRARY.reduce((a, c) => a + c.items.length, 0);
})(typeof window !== 'undefined' ? window : globalThis);
