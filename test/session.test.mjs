import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import xterm from '@xterm/headless';
import { SessionTerminal } from '../dist/session-terminal.js';

const options = { mode: 'terminal', sound: false, volume: 0.3 };
const write = (terminal, data) => new Promise((resolve) => terminal.write(data, resolve));
const text = (terminal) => Array.from({ length: terminal.rows }, (_, y) =>
  terminal.buffer.active.getLine(terminal.buffer.active.viewportY + y)?.translateToString(true) ?? '').join('\n');

test('same-terminal animation preserves live AI output, colors, Unicode and alternate screen', { timeout: 15000 }, async () => {
  let output = '';
  const stream = { isTTY: true, columns: 80, rows: 24, write: (data) => { output += data; } };
  const session = new SessionTerminal(stream, options);
  const physical = new xterm.Terminal({ cols: 80, rows: 24, allowProposedApi: true });
  try {
    await session.write('Normal screen\r\n\x1b[?1049h\x1b[H\x1b[31mAssistant prêt 界\x1b[0m');
    session.render();
    await write(physical, output);
    assert.match(text(physical), /Assistant prêt 界/);
    assert.equal(physical.buffer.active.getLine(0).getCell(0).getFgColor(), 1);
    output = '';
    const effect = session.react({ reaction: 'boop', intensity: 1 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await session.write('\r\nTravail terminé pendant animation');
    assert.match(output, /BOOP \/ SUR LE NEZ/);
    assert.doesNotMatch(output, /Travail terminé/);
    await effect;
    await write(physical, output);
    assert.match(text(physical), /Travail terminé pendant animation/);
    assert.doesNotMatch(text(physical), /BOOP \/ SUR LE NEZ/);
    output = '';
    await session.write('\x1b[?1049l');
    session.render();
    await write(physical, output);
    assert.match(text(physical), /Normal screen/);
  } finally { await session.dispose(); physical.dispose(); }
});

test('session terminal responds to terminal queries and adapts to resizing', async () => {
  const stream = { isTTY: true, columns: 80, rows: 24, write() {} };
  const session = new SessionTerminal(stream, options);
  let replies = '';
  session.terminal.onData((data) => { replies += data; });
  try {
    await session.write('\x1b[4;7H\x1b[6n');
    assert.equal(replies, '\x1b[4;7R');
    session.resize(100, 30);
    assert.equal(session.terminal.cols, 100);
    assert.equal(session.terminal.rows, 30);
  } finally { await session.dispose(); }
});

test('launcher rejects captured output without starting an AI', async () => {
  const child = spawn(process.execPath, ['scripts/session.mjs', 'nonexistent-ai-command'], {
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const [code] = await once(child, 'close');
  assert.equal(code, 1);
  assert.match(stderr, /terminal interactif/);
});
