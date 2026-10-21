import assert from 'node:assert/strict';
import { test } from 'node:test';
import xterm from '@xterm/headless';
import { AmbientMood, ambientBand, ambientEnabled, bandRows, BAND_ROWS, looksBusy } from '../dist/ambient.js';
import { SessionTerminal } from '../dist/session-terminal.js';

const plain = (line) => line.replace(/\x1b\[[0-9;]*m/g, '');
const write = (terminal, data) => new Promise((resolve) => terminal.write(data, resolve));

test('busy markers of Codex, Claude Code and Gemini CLI are recognized', () => {
  assert.ok(looksBusy('• Working (12s • Esc to interrupt)'));
  assert.ok(looksBusy('✻ Pondering… (esc to interrupt)'));
  assert.ok(looksBusy('⠋ Thinking (esc to cancel, 4s)'));
  assert.ok(!looksBusy('> écris une fonction escape'));
  assert.equal(ambientEnabled({}), true);
  assert.equal(ambientEnabled({ AI_REACTIONS_AMBIENT: '0' }), false);
  assert.throws(() => ambientEnabled({ AI_REACTIONS_AMBIENT: 'yes' }));
  assert.equal(bandRows(80, 24), BAND_ROWS);
  assert.equal(bandRows(80, 16), 0);
});

test('mood goes from idle to working, long work, done, idle and quiet', () => {
  const mood = new AmbientMood(0, 1);
  assert.equal(mood.update(0, false).scene, 'idle');
  assert.equal(mood.update(1000, true).scene, 'idle', 'a short burst is not work');
  assert.equal(mood.update(2600, true).scene, 'working');
  assert.equal(mood.update(30_000, true).work, 29);
  assert.equal(mood.update(62_000, true).scene, 'long');
  mood.update(70_000, false);
  const done = mood.update(73_000, false);
  assert.equal(done.scene, 'done');
  assert.equal(done.work, 69);
  assert.equal(mood.update(79_500, false).scene, 'idle');
  assert.equal(mood.update(380_000, false).scene, 'quiet');
  assert.equal(mood.update(382_000, true).scene, 'quiet');
  assert.equal(mood.update(384_000, true).scene, 'working');
});

test('short work goes back to idle without a trophy, and visitors come by when idle', () => {
  const mood = new AmbientMood(0, 7);
  mood.update(0, true);
  mood.update(2000, true);
  mood.update(5000, false);
  assert.equal(mood.update(8500, false).scene, 'idle');
  let visitor;
  for (let now = 8500; now < 60_000 && !visitor; now += 500) visitor = mood.update(now, false).visitor;
  assert.ok(['butterfly', 'mouse', 'star'].includes(visitor));
});

test('band draws the tiger in every scene, at the requested width', () => {
  const frames = new Set();
  for (const scene of ['idle', 'working', 'long', 'done', 'quiet']) {
    for (const columns of [40, 80, 132]) {
      const lines = ambientBand({ scene, seconds: 1, clock: 1, work: 75, visit: 0 }, columns);
      assert.equal(lines.length, BAND_ROWS);
      for (const line of lines) assert.equal([...plain(line)].length, columns);
      assert.match(plain(lines[0]), /KK LAB/);
      assert.match(plain(lines[2]), /\(=..\..?=\)|\(=.[._].=\)/);
      frames.add(plain(lines.join('\n')));
    }
  }
  assert.equal(frames.size, 15);
  const done = ambientBand({ scene: 'done', seconds: 1, clock: 1, work: 75, visit: 0 }, 80).map(plain);
  assert.match(done[0], /terminé en 1 min 15/);
  assert.match(done[2], /GG/);
  const visit = ambientBand({ scene: 'idle', seconds: 1, clock: 1, work: 0, visitor: 'mouse', visit: 4 }, 80).map(plain);
  assert.match(visit[3], /<:3 \)~/);
});

test('session reserves the band below the AI and keeps the AI cursor', async () => {
  let output = '';
  const stream = { isTTY: true, columns: 80, rows: 24, write: (data) => { output += data; } };
  const session = new SessionTerminal(stream, { mode: 'terminal', sound: false, volume: 0.3 }, { ambient: true });
  const physical = new xterm.Terminal({ cols: 80, rows: 24, allowProposedApi: true });
  try {
    assert.equal(session.terminal.rows, 20);
    await session.write('\x1b[2J\x1b[HAssistant prêt\r\n> ');
    session.render();
    await write(physical, output);
    const buffer = physical.buffer.active;
    assert.match(buffer.getLine(0).translateToString(true), /Assistant prêt/);
    assert.match(buffer.getLine(20).translateToString(true), /KK LAB · au repos/);
    assert.match(buffer.getLine(22).translateToString(true), /\(=o\.o=\)|\(=-\.-=\)/);
    assert.deepEqual([buffer.cursorY, buffer.cursorX], [1, 2]);
    const written = output.length;
    session.renderBand();
    session.renderBand();
    assert.ok(output.length - written < 2000, 'an unchanged band is not repainted');
    session.resize(80, 18);
    assert.equal(session.terminal.rows, 18, 'small terminals give every row to the AI');
  } finally { await session.dispose(); physical.dispose(); }
});
