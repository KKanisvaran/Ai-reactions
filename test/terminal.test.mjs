import assert from 'node:assert/strict';
import { test } from 'node:test';
import { animateTerminal, terminalFrame } from '../scripts/terminal-animation.mjs';

test('terminal renderer gives each reaction distinct frames within its own fixed block', () => {
  const events = ['whip', 'whip_hard', 'encourage', 'reward', 'too_slow', 'chill', 'confused', 'facepalm'].map((reaction) => ({ reaction, intensity: 2 }));
  const unique = new Set();
  for (const event of events) {
    const early = terminalFrame(event, 0.4);
    const impact = terminalFrame(event, 0.6);
    assert.notEqual(early, impact);
    assert.equal(early.split('\n').length, 13);
    assert.ok(early.split('\n').every((line) => line.length === 60));
    assert.doesNotMatch(early, /\x1b/);
    unique.add(impact);
  }
  assert.equal(unique.size, 8);
  assert.match(terminalFrame(events[1], 0.6), /BATTE DE BASEBALL/);
  assert.match(terminalFrame(events[1], 0.6), /BONK/);
  assert.match(terminalFrame(events[2], 0.6), /\^_\^/);
  assert.match(terminalFrame(events[3], 0.6), /\^_\^/);
});

test('captured output stays static, without cursor control or a Windows window', async () => {
  let output = '';
  await animateTerminal({ reaction: 'whip_hard', intensity: 2 }, {
    isTTY: false, write: (text) => { output += text; },
  });
  assert.match(output, /BONK/);
  assert.doesNotMatch(output, /\x1b/);
  assert.equal(output.trimEnd().split('\n').length, 13);
});

test('interactive renderer animates only its reserved output block and ends by itself', { timeout: 10000 }, async () => {
  const chunks = [];
  await animateTerminal({ reaction: 'whip_hard', intensity: 1 }, {
    isTTY: true, columns: 80, rows: 24, write: (text) => { chunks.push(text); },
  });
  const frames = chunks.filter((chunk) => chunk.includes('BATTE DE BASEBALL'));
  assert.ok(frames.length > 10);
  assert.ok(new Set(frames).size > 5);
  const sequences = chunks.join('').match(/\x1b\[[0-9;?]*[A-Za-z]/g);
  assert.ok(sequences.every((sequence) => sequence === '\x1b[13F' || sequence === '\x1b[K'),
    'no screen clearing, alternate screen, raw input or keyboard escape modes');
});
