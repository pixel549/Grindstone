// 2.25: the phone's copy of the overdue rule (Overdue.java), compiled and run on the JVM: the same cases as remind_logic.js.
const { execSync } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ovt-'));
const root = path.join(__dirname, '..');
try {
  execSync(`javac -nowarn -d "${out}" "${root}/src/dev/jake/grindstone/Overdue.java" "${root}/test/OverdueTest.java"`, { stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(execSync(`java -cp "${out}" dev.jake.grindstone.OverdueTest`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString());
} catch (e) {
  console.log((e.stdout || '').toString() + (e.stderr || '').toString().split('\n').filter((l) => !/JAVA_TOOL_OPTIONS/.test(l)).join('\n'));
  console.log('FAIL the Java rule');
  process.exit(1);
}
