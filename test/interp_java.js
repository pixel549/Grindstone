// 2.26: the AI connection on the JVM (InterpreterCore against test/mock_llm.py): the interpreter's matching, any
// provider's chat, and Claude's own Messages API, as the Oracle and the interpreter now share one connection.
const { execSync, spawn } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'itp-'));
const root = path.join(__dirname, '..');
const JSON_JAR = '/usr/share/java/json-android.jar';
const port = 18000 + Math.floor(Math.random() * 2000);
const mock = spawn('python3', [path.join(root, 'test/mock_llm.py'), String(port)], { stdio: 'ignore' });
let code = 0;
try {
  execSync('sleep 0.8');
  execSync(`javac -nowarn -cp "${JSON_JAR}" -d "${out}" "${root}/src/dev/jake/grindstone/InterpreterCore.java" "${root}/test/jt/dev/jake/grindstone/InterpTest.java"`, { stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(execSync(`java -cp "${out}:${JSON_JAR}" dev.jake.grindstone.InterpTest ${port}`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString());
} catch (e) {
  console.log((e.stdout || '').toString() + (e.stderr || '').toString().split('\n').filter((l) => !/JAVA_TOOL_OPTIONS/.test(l)).join('\n'));
  console.log('FAIL the AI connection');
  code = 1;
}
mock.kill();
process.exit(code);
