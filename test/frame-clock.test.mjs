import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FRAME_MS, nextFrame, startFrames } from '../dist/frame-clock.js';
import { SessionTerminal } from '../dist/session-terminal.js';

test('frames keep to deadlines fixed in advance, and skip the ones missed', () => {
  assert.equal(Math.round(1000 / FRAME_MS), 60);
  // A timer that woke 6 ms late leaves less to wait: the average stays on 60 a second.
  let frame = nextFrame(FRAME_MS, FRAME_MS + 6);
  assert.equal(frame.deadline, 2 * FRAME_MS);
  assert.ok(Math.abs(frame.wait - (FRAME_MS - 6)) < 1e-9);
  // Far behind: one frame from now, never a burst to catch up.
  frame = nextFrame(0, 100);
  assert.equal(frame.deadline, 100 + FRAME_MS);
  assert.ok(Math.abs(frame.wait - FRAME_MS) < 1e-9);
});

test('the frame clock ticks, never faster than 60 times a second, until stopped', async () => {
  let ticks = 0;
  const stop = startFrames(() => { ticks++; });
  const keep = setInterval(() => {}, 100);
  await new Promise((resolve) => setTimeout(resolve, 500));
  stop();
  const seen = ticks;
  await new Promise((resolve) => setTimeout(resolve, 100));
  clearInterval(keep);
  // A busy machine may drop frames; it never runs ahead of them.
  assert.ok(seen >= 5 && seen <= 31, `${seen} ticks in 500 ms`);
  assert.equal(ticks, seen, 'no tick after stop');
});

test('a terminal behind on its output skips frames instead of piling them up', async () => {
  let painted = '';
  const stream = { isTTY: true, columns: 80, rows: 30, writableNeedDrain: true, write: (text) => { painted += text; } };
  let now = 0;
  const session = new SessionTerminal(stream, { ambient: true, now: () => now });
  const keep = setInterval(() => {}, 100);
  try {
    now = 5000;
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(painted, '', 'nothing sent while the terminal drains');
    stream.writableNeedDrain = false;
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.match(painted, /▀/, 'the band comes back once it has caught up');
  } finally { clearInterval(keep); await session.dispose(); }
});
