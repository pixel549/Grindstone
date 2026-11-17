// Works out each tiered prop's footprint (in cells) from its sprite, so a small table takes a small spot.
// node tools/footprints.js         prints the FOOT table for core.js
// node tools/footprints.js --check exits 1 if core.js is out of step with the sprites
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const spr = JSON.parse(fs.readFileSync(path.join(root, 'assets/2d/world.json')));
global.window = global; require(path.join(root, 'assets/core.js'));
const out = {};
Object.keys(G.FURN_RAW).forEach((k) => {
  const f = G.FURN_RAW[k];
  if (!f.est || f.at === 'wall' || f.fill) return;
  const top = spr[f.est + '.5' + (f.cage ? '.b' : '')];
  const row = [];
  for (let t = 0; t < 6; t++) {
    const r = spr[f.est + '.' + t + (f.cage ? '.b' : '')];
    row.push([Math.max(1, Math.ceil((r[2] - 4) / 32)), Math.max(1, Math.round(f.h * r[3] / top[3]))]);
  }
  out[k] = row;
});
const text = JSON.stringify(out).replace(/"([a-z]+)":/g, '$1:');
if (process.argv.includes('--check')) {
  const have = JSON.stringify(G.FOOT).replace(/"([a-z]+)":/g, '$1:');
  if (have !== text) { console.error('FOOT is stale. Run: node tools/footprints.js'); process.exit(1); }
  console.log('footprints ok (' + Object.keys(out).length + ' props)');
} else console.log(text);
