import pty from 'node-pty';
import xterm from '@xterm/headless';
import { fileURLToPath } from 'node:url';

// Isolate ConPTY's worker handles in their own host, like the real launcher.
const terminal = new xterm.Terminal({ cols: 80, rows: 24, allowProposedApi: true });
const child = pty.spawn(process.execPath, [
  fileURLToPath(new URL('../../scripts/session.mjs', import.meta.url)),
  ...process.argv.slice(2),
], { cols: 80, rows: 24, name: 'xterm-256color', useConptyDll: true, env: process.env });
let output = '', started = false, ended = false;
terminal.onData((data) => { if (!ended) child.write(data); });
child.onData((data) => {
  process.stdout.write(data);
  output = (output + data).slice(-10000);
  terminal.write(data);
  if (!started && output.includes('SESSION_READY')) { started = true; child.write('go\r'); }
});
const deadline = setTimeout(() => { child.kill(); finish(2); }, 22000);
function finish(code) {
  if (ended) return;
  ended = true;
  clearTimeout(deadline);
  terminal.dispose();
  process.stdout.write('', () => process.exit(code));
}
child.onExit(({ exitCode }) => finish(exitCode));
