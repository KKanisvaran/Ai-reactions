import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReactionEngine } from '../dist/reactions.js';
import { reactionLogPath } from '../dist/local-output.js';

test('engine validates before emitting and varies each reaction by intensity', async () => {
  const events = [];
  const engine = new ReactionEngine({ emit: async (event) => { events.push(event); } });
  for (const name of ['boop', 'coffee', 'encourage', 'reward', 'too_slow', 'chill', 'confused', 'facepalm', 'hype', 'rip', 'sus', 'ez']) {
    const messages = new Set();
    for (const intensity of [1, 2, 3]) {
      const event = await engine.react(name, { intensity });
      assert.equal(event.intensity, intensity);
      assert.equal(event.reaction, name);
      messages.add(event.message);
    }
    assert.equal(messages.size, 3);
  }
  assert.equal(new Set(events.map((event) => event.id)).size, 36);
  for (const input of [{ intensity: 0 }, { intensity: 4 }, { intensity: 1.5 },
    { intensity: '2' }, { intensity: null }, { intensity: true },
    { intensity: NaN }, { intensity: Infinity }, { extra: 'no' }, null]) {
    await assert.rejects(engine.react('boop', input));
  }
  await assert.rejects(engine.react('constructor', {}));
  assert.equal(events.length, 36);
  assert.equal((await engine.react('encourage', {})).intensity, 1);
});

test('engine propagates output failure, without falsely reporting success', async () => {
  const engine = new ReactionEngine({ emit: async () => { throw new Error('disk failed'); } });
  await assert.rejects(engine.react('boop', {}), /disk failed/);
});

test('log path is independent of cwd and rejects relative overrides', () => {
  assert.match(reactionLogPath({}), /[\\/]\.ai-reactions[\\/]reactions\.jsonl$/);
  assert.throws(() => reactionLogPath({ AI_REACTIONS_LOG: '' }), /absolu/);
  assert.throws(() => reactionLogPath({ AI_REACTIONS_LOG: 'relative.jsonl' }), /absolu/);
});
