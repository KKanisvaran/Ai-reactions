import assert from 'node:assert/strict';
import { test } from 'node:test';
import xterm from '@xterm/headless';
import { AmbientMood, ambientBand, ambientEnabled, bandHit, bandRows, BAND_ROWS, blinking, looksBusy, penguinFrame, penguinPose, readSignals } from '../dist/ambient.js';
import { penguinPoses, PENGUIN_HEIGHT } from '../dist/penguin.js';
import { reactionDefinitions } from '../dist/reactions.js';
import { InputReader, leftClick } from '../dist/mouse.js';
import { SessionTerminal } from '../dist/session-terminal.js';

const plain = (line) => line.replace(/\x1b\[[0-9;]*m/g, '');
const write = (terminal, data) => new Promise((resolve) => terminal.write(data, resolve));
const calm = { busy: false };
const busy = { busy: true };

test('screen markers of Codex, Claude Code and Gemini CLI are recognized', () => {
  assert.ok(looksBusy('• Working (12s • Esc to interrupt)'));
  assert.ok(looksBusy('✻ Pondering… (esc to interrupt)'));
  assert.ok(looksBusy('⠋ Thinking (esc to cancel, 4s)'));
  assert.ok(!looksBusy('> écris une fonction escape'));
  assert.equal(readSignals('✻ Pondering… (esc to interrupt)', false).busy, false, 'a marker without fresh output is stale');
  assert.ok(readSignals(' Do you want to proceed?\n ❯ 1. Yes', false).asking);
  assert.ok(readSignals('Would you like to run the following command?', false).asking);
  assert.ok(readSignals('  ⎿  Interrupted by user', false).interrupted);
  assert.ok(readSignals('API Error: 529 overloaded', false).failed);
  assert.deepEqual(readSignals('> salut', true), { busy: false, asking: false, interrupted: false, failed: false });
  assert.equal(ambientEnabled({}), true);
  assert.equal(ambientEnabled({ AI_REACTIONS_AMBIENT: '0' }), false);
  assert.throws(() => ambientEnabled({ AI_REACTIONS_AMBIENT: 'yes' }));
  assert.equal(BAND_ROWS, 10, 'the penguin at its true size, never shrunk');
  assert.equal(bandRows(80, 40), BAND_ROWS);
  assert.equal(bandRows(80, 18), BAND_ROWS);
  assert.equal(bandRows(80, 17), 0, 'the AI keeps at least 8 lines');
  assert.equal(bandRows(30, 40), 0);
});

test('the penguin reacts on its own: work, coffee, snail, finish and chill', () => {
  const mood = new AmbientMood(0, 1);
  assert.equal(mood.update(0, calm).scene, 'idle');
  assert.equal(mood.update(1000, busy).scene, 'idle', 'a short burst is not work');
  assert.equal(mood.update(2600, busy).scene, 'working');
  assert.equal(mood.update(30_000, busy).work, 29);
  assert.equal(mood.update(47_000, busy).reaction?.name, 'coffee');
  assert.equal(mood.update(60_000, busy).reaction, undefined);
  assert.equal(mood.update(152_000, busy).reaction?.name, 'too_slow');
  mood.update(170_000, calm);
  const done = mood.update(173_000, calm);
  assert.equal(done.scene, 'idle');
  assert.equal(done.finished, true);
  assert.equal(done.work, 169);
  assert.deepEqual([done.reaction?.name, done.reaction?.intensity], ['reward', 2]);
  assert.equal(mood.update(474_000, calm).scene, 'quiet');
  assert.equal(mood.update(474_100, calm).reaction?.name, 'chill');
  const woken = mood.update(480_000, { busy: false, typed: true });
  assert.deepEqual([woken.scene, woken.reaction?.name], ['idle', 'boop'], 'typing after a long pause wakes the penguin');
});

test('short work gets no reward, quick wins are easy, and interruptions get a facepalm', () => {
  const short = new AmbientMood(0, 7);
  short.update(0, busy); short.update(2000, busy); short.update(5000, calm);
  assert.equal(short.update(8500, calm).reaction, undefined);
  let visitor;
  for (let now = 8500; now < 60_000 && !visitor; now += 500) visitor = short.update(now, calm).visitor;
  assert.ok(['bird', 'fish', 'star'].includes(visitor));

  const quick = new AmbientMood(0, 3);
  quick.update(0, busy); quick.update(2000, busy); quick.update(25_000, calm);
  assert.equal(quick.update(28_000, calm).reaction?.name, 'ez');

  const cut = new AmbientMood(0, 3);
  cut.update(0, busy); cut.update(2000, busy);
  assert.equal(cut.update(30_000, { busy: false, interrupted: true }).reaction?.name, 'facepalm');
  assert.equal(cut.update(40_000, { busy: false, interrupted: true }).reaction, undefined, 'no reward after an interruption');
});

test('a permission prompt is suspense, not the end of the work', () => {
  const mood = new AmbientMood(0, 5);
  mood.update(0, busy); mood.update(2000, busy);
  const asking = mood.update(20_000, { busy: false, asking: true });
  assert.deepEqual([asking.scene, asking.asking, asking.reaction?.name], ['working', true, 'sus']);
  assert.equal(mood.update(40_000, { busy: false, asking: true }).scene, 'working');
});

test('MCP reactions play in the band and outrank the tiger\'s own', () => {
  const mood = new AmbientMood(0, 2);
  assert.equal(mood.play('rip', 3, 1000), 7000);
  assert.deepEqual(mood.update(2000, calm).reaction, { name: 'rip', intensity: 3, seconds: 1 });
  mood.update(2100, busy); mood.update(4000, busy);
  assert.equal(mood.update(6000, busy).reaction?.name, 'rip');
  assert.equal(mood.update(8100, calm).reaction, undefined);
});

test('band draws the penguin, then every reaction beside it, at the requested width', () => {
  const frames = new Set();
  const base = { scene: 'idle', seconds: 1, clock: 5, work: 75, drawn: 1, visit: 0 };
  const views = [
    { ...base, drawn: 0.4, clock: 1 }, base, { ...base, scene: 'working' }, { ...base, scene: 'quiet' },
    { ...base, visitor: 'bird', visit: 4 }, { ...base, asking: true },
    ...Object.keys(reactionDefinitions).map((name) => ({ ...base, reaction: { name, intensity: 2, seconds: 1.3 } })),
  ];
  for (const view of views) {
    for (const columns of [40, 80, 132]) {
      const lines = ambientBand(view, columns);
      assert.equal(lines.length, BAND_ROWS);
      for (const line of lines) assert.equal([...plain(line)].length, columns);
      if (view.drawn === 1) assert.match(plain(lines[3]), /[▀▄]{10}/, 'the pixel penguin');
      assert.doesNotMatch(plain(lines.join('')), /KK LAB|IA/, 'only the mascot, no brand or status text');
      if (view.scene === 'working') assert.doesNotMatch(plain(lines.join('')), /[{}()=;<>[\]]/, 'no code characters while the AI works');
      if (view.reaction) {
        const { title, messages } = reactionDefinitions[view.reaction.name];
        const caption = `${title.toUpperCase()} · ${messages[1]}`, line = plain(lines[1]);
        if (columns >= 80) assert.ok(line.includes(caption), caption);
        else assert.ok(line.includes(caption.slice(0, 10)), caption);
      }
      // Scenes are pixel art: only the caption is text.
      lines.forEach((line, i) => { if (i !== 1) assert.match(plain(line), /^▀*$/, `line ${i}`); });
      frames.add(lines.join('\n'));
    }
  }
  assert.equal(frames.size, views.length * 3);
  // The night spreads from the left, then the penguin draws itself over it.
  const cells = (view) => plain(ambientBand(view, 80).join('')).split(/[▀▄]/).length;
  assert.ok(cells({ ...base, drawn: 0, clock: 0.3 }) < cells({ ...base, drawn: 0, clock: 1 }), 'the decor spreads at startup');
  assert.notEqual(ambientBand({ ...base, drawn: 0.3 }, 80).join(''), ambientBand(base, 80).join(''), 'the penguin draws itself');
});

test('the penguin takes the pose of each state from its sheet', () => {
  const base = { scene: 'idle', seconds: 1, clock: 5, work: 0, drawn: 1, visit: 0 };
  assert.equal(penguinPose(base), 'neutral');
  const blinks = [];
  for (let t = 0; t < 60; t += 0.02) if (blinking(t) && !blinking(t - 0.02)) blinks.push(t);
  assert.ok(blinks.length >= 12, 'it blinks');
  const gaps = new Set(blinks.slice(1).map((t, i) => Math.round((t - blinks[i]) * 10)));
  assert.ok(gaps.size >= 5, 'at uneven times, like real eyes');
  assert.equal(penguinPose({ ...base, clock: blinks[3] + 0.05 }), 'closed');
  assert.equal(penguinPose({ ...base, scene: 'working', seconds: 0.5 }), 'sliding');
  assert.equal(penguinPose({ ...base, scene: 'working', seconds: 5 }), 'focused');
  assert.equal(penguinPose({ ...base, scene: 'quiet', seconds: 30 }), 'fishing');
  assert.equal(penguinPose({ ...base, scene: 'quiet', seconds: 300 }), 'asleep');
  assert.equal(penguinPose({ ...base, finished: true }), 'happy');
  assert.equal(penguinPose({ ...base, visitor: 'fish', visit: 6 }), 'right');
  assert.ok(['left', 'right'].includes(penguinPose({ ...base, asking: true })));
  const idle = new Set(Array.from({ length: 30 }, (_, i) => penguinPose({ ...base, clock: 6.5 + i * 6 })));
  assert.ok(idle.size >= 3, 'idle, it looks around');
  const reaction = (name) => penguinPose({ ...base, reaction: { name, intensity: 1, seconds: 1 } });
  assert.deepEqual(['chill', 'facepalm', 'boop', 'reward', 'rip'].map(reaction), ['shades', 'facepalm', 'surprised', 'happy', 'closed']);
  const later = (name) => penguinPose({ ...base, reaction: { name, intensity: 1, seconds: 3 } });
  assert.deepEqual(['reward', 'boop', 'confused', 'too_slow'].map(later), ['hero', 'innocent', 'thinking', 'sweating'], 'poses from the second sheet');
});

test('every pose stands on the same feet, centered on the same belly', () => {
  assert.ok(Object.keys(penguinPoses).length >= 28);
  for (const [name, rows] of Object.entries(penguinPoses)) {
    assert.equal(rows.length, PENGUIN_HEIGHT, name);
    assert.equal(rows[0].length % 2, 1, `${name}: an odd width keeps the center column`);
    assert.ok(rows.every((row) => row.length === rows[0].length), name);
    assert.match(rows.at(-1), /K/, `${name}: feet on the bottom row`);
  }
});

test('left alone, the penguin keeps busy, never twice the same thing in a row', () => {
  const mood = new AmbientMood(0, 11);
  const done = [];
  for (let now = 0; now < 240_000; now += 250) {
    const name = mood.update(now, calm).doing?.name;
    if (name && name !== done.at(-1)) done.push(name);
  }
  assert.ok(new Set(done).size >= 4, done.join(' '));
  const base = { scene: 'idle', seconds: 20, clock: 20, work: 0, drawn: 1, visit: 0 };
  const frames = (name, length) => Array.from({ length: 24 }, (_, i) => penguinFrame({ ...base, doing: { name, seconds: (i * length) / 24 } }));
  assert.deepEqual([...new Set(frames('juggle', 3).map((frame) => frame.pose))].sort(), ['juggling', 'juggling2']);
  assert.ok(frames('dance', 3).some((frame) => frame.dy < 0), 'it hops while it dances');
  assert.ok(frames('shiver', 3).some((frame) => frame.dx !== 0), 'it shivers');
  const working = new AmbientMood(0, 4);
  let thinking = false;
  for (let now = 0; now < 60_000 && !thinking; now += 500) thinking = working.update(now, busy).doing?.name === 'think';
  assert.ok(thinking, 'a long piece of work makes it think');
});

test('now and then it jumps into the sea in its swim ring, floats, and swims back', () => {
  const base = { scene: 'idle', seconds: 20, clock: 20, work: 0, drawn: 1, visit: 0 };
  const at = (seconds) => penguinFrame({ ...base, doing: { name: 'swim', seconds } });
  const frames = Array.from({ length: 170 }, (_, i) => at(i / 10));
  assert.ok(frames.every((frame) => frame.ring), 'it wears its ring all along');
  assert.ok(frames.some((frame) => frame.dy < 0), 'it jumps');
  assert.ok(frames.some((frame) => frame.water && frame.pose === 'shades'), 'it takes it easy in the water');
  assert.ok(Math.max(...frames.map((frame) => frame.dx)) >= 30, 'out at sea');
  // Never more than two pixels from one tenth of a second to the next, but on the jumps.
  frames.slice(1).forEach((frame, i) => assert.ok(Math.abs(frame.dx - frames[i].dx) <= 4, `smooth at ${i / 10}s`));
  assert.deepEqual([frames.at(-1).dx, frames.at(-1).dy, Boolean(frames.at(-1).water)], [0, 0, false], 'back home, dry');
  // Under water, only its head and its ring show.
  const floating = ambientBand({ ...base, doing: { name: 'swim', seconds: 8 } }, 90).join('');
  const home = ambientBand({ ...base, doing: { name: 'swim', seconds: 0 } }, 90).join('');
  assert.notEqual(floating, home);

  // The AI starts working: it swims home first instead of vanishing.
  let mood, now, view;
  for (let seed = 1; seed < 20 && view?.doing?.name !== 'swim'; seed++) {
    mood = new AmbientMood(0, seed);
    for (now = 0; now < 290_000; now += 250) if ((view = mood.update(now, calm)).doing?.name === 'swim') break;
  }
  assert.equal(view.doing?.name, 'swim', 'it goes swimming by itself');
  now += 6000;
  mood.poke('sea', now);
  assert.equal(mood.update(now, calm).doing.petted, 0, 'a click out at sea pets it');
  for (let t = now; t < now + 2000; t += 250) view = mood.update(t, busy);
  assert.equal(view.doing?.name, 'swim', 'still on its way home');
  assert.ok(view.doing.seconds >= 13, 'heading home straight away');
  // Too narrow for the open sea: no swim.
  const narrow = new AmbientMood(0, 3);
  narrow.resize(50);
  for (let t = 0; t < 600_000; t += 250) assert.notEqual(narrow.update(t, calm).doing?.name, 'swim');
  // A click finds it where it floats.
  assert.equal(bandHit(90, 40, 6, 32).target, 'penguin');
  assert.equal(bandHit(90, 40, 6).target, 'sky');
});

test('a click pets the penguin: it answers kindly, happier at each click', () => {
  const mood = new AmbientMood(0, 9);
  mood.update(0, calm);
  const answers = [0, 1, 2, 3, 4].map((i) => { mood.poke('penguin', 1000 + i * 500); return mood.update(1000 + i * 500, calm).doing; });
  assert.deepEqual(answers.map((doing) => doing.name), ['pleased', 'wave', 'hop', 'dance', 'dance']);
  assert.ok(answers.every((doing) => doing.user));
  for (const doing of answers) assert.notEqual(penguinPose({ scene: 'idle', seconds: 1, clock: 1, work: 0, drawn: 1, visit: 0, doing }), 'grumpy');
  mood.poke('penguin', 20_000);
  assert.equal(mood.update(20_000, calm).doing.name, 'pleased', 'a new petting starts gently again');
  mood.poke('snowman', 30_000);
  assert.equal(mood.update(30_000, calm).doing.name, 'greet');
  mood.poke('sea', 40_000, { x: 60, y: 17 });
  assert.deepEqual(mood.update(40_000, calm).doing, { name: 'splash', seconds: 0, user: true, x: 60, y: 17 });

  // A click outranks a reaction, and wakes it up from a long pause.
  mood.play('rip', 1, 50_000);
  mood.poke('penguin', 50_500);
  assert.equal(penguinPose(mood.update(50_600, calm)), 'pleased');
  const sleepy = new AmbientMood(0, 2);
  sleepy.update(0, calm);
  assert.equal(sleepy.update(400_000, calm).scene, 'quiet');
  sleepy.poke('penguin', 400_100);
  assert.deepEqual([sleepy.update(400_200, calm).scene, sleepy.update(400_300, calm).doing.name], ['idle', 'wave']);
});

test('a click lands on the penguin, the snowman, the sea or the sky', () => {
  assert.equal(bandHit(80, 10, 5).target, 'penguin');
  assert.equal(bandHit(120, 4, 8).target, 'snowman');
  assert.equal(bandHit(120, 4, 1).target, 'sky');
  assert.equal(bandHit(80, 60, 9).target, 'sea');
  assert.equal(bandHit(80, 60, 0).target, 'sky');
  assert.deepEqual(bandHit(80, 60, 9), { target: 'sea', x: 60, y: 19 });
  assert.equal(bandHit(80, 60, BAND_ROWS), undefined);
});

test('session reserves the band below the AI and plays reactions there, without covering the AI', async () => {
  let output = '';
  const stream = { isTTY: true, columns: 80, rows: 30, write: (data) => { output += data; } };
  let clock = 0;
  const session = new SessionTerminal(stream, { mode: 'terminal', sound: false, volume: 0.3 }, { ambient: true, now: () => clock });
  const physical = new xterm.Terminal({ cols: 80, rows: 30, allowProposedApi: true });
  try {
    assert.equal(session.terminal.rows, 20);
    clock = 5000;
    await session.write('\x1b[2J\x1b[HAssistant prêt\r\n> ');
    session.render();
    await write(physical, output);
    const buffer = physical.buffer.active;
    assert.match(buffer.getLine(0).translateToString(true), /Assistant prêt/);
    assert.match(buffer.getLine(25).translateToString(true), /[▀▄]/);
    assert.deepEqual([buffer.cursorY, buffer.cursorX], [1, 2]);
    const written = output.length;
    session.renderBand();
    const once = output.length;
    session.renderBand();
    assert.equal(output.length, once, 'an unchanged band is not repainted');

    await session.react({ id: '1', timestamp: '', reaction: 'coffee', intensity: 1, message: '' });
    session.renderBand();
    await write(physical, output);
    assert.match(buffer.getLine(0).translateToString(true), /Assistant prêt/, 'the AI stays on screen');
    assert.match(buffer.getLine(21).translateToString(true), /CAFÉ · Un petit café !/);
    const before = output.length;
    clock += 600;
    session.renderBand();
    assert.ok(output.length - before < 4000, 'a new band frame only sends the cells that changed');
    assert.ok(!output.slice(written).includes('\x1b[2J'), 'the screen is never cleared');

    session.resize(80, 17);
    assert.equal(session.terminal.rows, 17, 'small terminals give every row to the AI');
  } finally { await session.dispose(); physical.dispose(); }
});

test('the mouse wheel scrolls the AI history, keys bring the live screen back', async () => {
  const input = new InputReader();
  const up = '\x1b[<64;10;5M';
  assert.deepEqual(input.read(`a${up}${up}b`), {
    keys: 'ab', wheel: -2, reports: [{ raw: up, button: 64, column: 10, row: 5, press: true }, { raw: up, button: 64, column: 10, row: 5, press: true }],
  });
  const click = input.read('\x1b[<0;3;4M\x1b[<0;3;4m');
  assert.equal(click.keys, '', 'clicks never reach the AI as text');
  assert.deepEqual(click.reports.map(leftClick), [true, false], 'a click counts once, on the press');
  assert.equal(leftClick(input.read('\x1b[<2;3;4M').reports[0]), false, 'the right button is not a click');
  assert.equal(input.read('\x1b[<81;1;1M').wheel, 1, 'Ctrl + wheel down');
  assert.deepEqual([input.read('x\x1b[<65;1').keys, input.read(';2M').wheel], ['x', 1], 'a report split across reads');
  assert.equal(input.read('\x1b').keys, '\x1b', 'the Escape key is never held back');
  assert.equal(input.read('\x1b[A').keys, '\x1b[A');

  const stream = { isTTY: true, columns: 80, rows: 30, write: () => {} };
  const session = new SessionTerminal(stream, { mode: 'terminal', sound: false, volume: 0.3 }, { ambient: true, now: () => 0 });
  try {
    await session.write(Array.from({ length: 60 }, (_, i) => `ligne ${i}`).join('\r\n'));
    assert.equal(session.scrolledBack, false);
    session.scroll(-6);
    assert.equal(session.scrolledBack, true);
    const buffer = session.terminal.buffer.active;
    assert.match(buffer.getLine(buffer.viewportY).translateToString(true), /ligne 34/);
    session.scroll(0);
    assert.equal(session.scrolledBack, false);
  } finally { await session.dispose(); }
});

test('a click on the band reaches the penguin', async () => {
  let painted = '';
  const stream = { isTTY: true, columns: 80, rows: 30, write: (text) => { painted += text; } };
  let now = 0;
  const session = new SessionTerminal(stream, { mode: 'terminal', sound: false, volume: 0.3 }, { ambient: true, now: () => now });
  try {
    now = 5000;
    session.renderBand();
    painted = '';
    session.click(10, 5);
    assert.ok(painted.length > 0, 'the penguin answers at once');
    now = 5100;
    painted = '';
    session.click(10, -1);
    assert.equal(painted, '', 'above the band is the AI, not the penguin');
  } finally { await session.dispose(); }
});
