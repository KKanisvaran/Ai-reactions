import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectOptions, TerminalOutput } from '../dist/terminal-output.js';
import { effectDuration, synthesizeSound } from '../dist/sound.js';

test('all effects use the terminal by default, with strict environment settings', () => {
  assert.deepEqual(effectOptions({}, 'win32'), { mode: 'terminal', sound: true, volume: 0.3 });
  assert.equal(effectOptions({}, 'linux').mode, 'terminal');
  assert.equal(effectOptions({}, 'linux').sound, true);
  assert.equal(effectOptions({}, 'darwin').sound, true);
  assert.equal(effectOptions({}, 'freebsd').sound, false);
  assert.equal(effectOptions({ AI_REACTIONS_VOLUME: '0' }, 'win32').sound, false);
  assert.equal(effectOptions({ AI_REACTIONS_SOUND: '0' }, 'win32').sound, false);
  for (const env of [{ AI_REACTIONS_EFFECTS: 'oops' }, { AI_REACTIONS_SOUND: 'true' },
    { AI_REACTIONS_VOLUME: 'NaN' }, { AI_REACTIONS_VOLUME: '1.1' }, { AI_REACTIONS_VOLUME: '' }]) {
    assert.throws(() => effectOptions(env, 'win32'));
  }
  assert.throws(() => effectOptions({ AI_REACTIONS_EFFECTS: 'windows' }, 'linux'));
});

test('all sounds are original non-silent, bounded PCM WAVs, scaled by volume', () => {
  const fingerprints = new Set();
  for (const name of ['whip', 'whip_hard', 'encourage', 'reward', 'too_slow', 'chill', 'confused', 'facepalm', 'hype', 'rip', 'sus', 'ez']) {
    for (const intensity of [1, 2, 3]) {
      const wav = synthesizeSound(name, intensity, 0.3);
      assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
      assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
      assert.equal(wav.readUInt32LE(4), wav.length - 8);
      assert.equal(wav.readUInt16LE(20), 1);
      assert.equal(wav.readUInt16LE(22), 1);
      assert.equal(wav.readUInt32LE(24), 22050);
      assert.equal(wav.length, 44 + Math.ceil(effectDuration(name, intensity) * 22.05) * 2);
      let peak = 0;
      for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
      assert.ok(peak > 1000 && peak <= 9831);
      fingerprints.add(wav.toString('base64'));
      assert.ok(synthesizeSound(name, intensity, 0).subarray(44).every((byte) => byte === 0));
    }
  }
  assert.equal(fingerprints.size, 36);
  assert.throws(() => synthesizeSound('whip', 4, 0.3));
});

test('animation queue bounds work, serializes calls and recovers after failure', async () => {
  const seen = [];
  const releases = [];
  const output = new TerminalOutput(effectOptions({}, 'win32'), {
    emit: async (event) => { seen.push(event.id); },
  }, () => new Promise((resolve, reject) => { releases.push({ resolve, reject }); }));
  const event = (id) => ({ id, reaction: 'whip', intensity: 1, timestamp: '', message: '' });
  const first = output.emit(event('one'));
  const failure = assert.rejects(first, /renderer unavailable/);
  const rest = ['two', 'three', 'four'].map((id) => output.emit(event(id)));
  await assert.rejects(output.emit(event('five')), /pleine/);
  await new Promise(setImmediate);
  assert.deepEqual(seen, ['one']);
  releases.shift().reject(new Error('renderer unavailable'));
  await failure;
  for (const task of rest) {
    await new Promise(setImmediate);
    releases.shift().resolve();
    await task;
  }
  assert.deepEqual(seen, ['one', 'two', 'three', 'four']);
});

test('journal failure prevents an unrecorded animation from being launched', async () => {
  let launched = false;
  const output = new TerminalOutput(effectOptions({}, 'win32'), {
    emit: async () => { throw new Error('no write access'); },
  }, async () => { launched = true; });
  await assert.rejects(output.emit({}), /no write access/);
  assert.equal(launched, false);
});
