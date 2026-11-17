// The before/after check from an exported save (Settings → Export): days a week at each habit, six whole weeks
// before the week 2.5 arrived and six after. The same numbers the app shows under Hearth → household.
//   TZ=Australia/Perth node tools/sim/adherence.js save.json [pivot YYYY-MM-DD] [weeks]
'use strict';
const path = require('path'), fs = require('fs');
require(path.join(__dirname, '..', '..', 'assets', 'core.js'));
require(path.join(__dirname, '..', '..', 'assets', 'delve.js'));
const G = globalThis.G;
const [file, pivotArg, weeksArg] = process.argv.slice(2);
if (!file) { console.log('usage: node tools/sim/adherence.js save.json [pivot] [weeks]'); process.exit(1); }
const raw = fs.readFileSync(file, 'utf8');
const s = G.normalize(JSON.parse(raw.slice(raw.indexOf('{'))), G.today());
const pivot = pivotArg || s.since25 || G.today(), weeks = Number(weeksArg || 6);
const A = G.adherence(s, pivot, weeks, process.env.NOW ? new Date(process.env.NOW + 'T12:00:00') : new Date());
const names = { healer: 'Looking after yourself (VIT)', scout: 'Endurance (END)', fighter: 'Strength (STR)', mage: 'Study or reading (INT)' };
console.log('Pivot ' + pivot + ': ' + A.before.weeks + ' weeks before, ' + A.after.weeks + ' after' + (A.ready ? '' : ' (not six yet)') + (A.thin ? '; the before side is thin' : ''));
console.log('habit'.padEnd(32) + 'target  before (days/wk, weeks on target)   after');
G.CALLING_ORDER.forEach((k) => {
  const b = A.before.kinds[k], a = A.after.kinds[k];
  console.log(names[k].padEnd(32) + (G.CALLINGS[k].days + '/wk').padEnd(8) + String(b.perWeek == null ? '—' : b.perWeek + ' (' + b.met + '/' + A.before.weeks + ')').padEnd(36) + (a.perWeek == null ? '—' : a.perWeek + ' (' + a.met + '/' + A.after.weeks + ')'));
});
