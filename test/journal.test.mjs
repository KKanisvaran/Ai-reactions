import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, appendFile, writeFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { JournalReader } from '../dist/journal-reader.js';
import { connect } from '../scripts/client.mjs';

const event = (reaction = 'reward') => ({ id: randomUUID(), timestamp: new Date().toISOString(),
  reaction, intensity: 2, message: 'Récompense méritée !' });

test('journal viewer skips history and preserves partial UTF-8 lines across reads', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-reactions-reader-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'events.jsonl');
  await writeFile(path, `${JSON.stringify(event())}\n`);
  const reader = new JournalReader(path);
  await reader.start();
  assert.deepEqual(await reader.next(), []);
  const next = event('encourage');
  const bytes = Buffer.from(`${JSON.stringify(next)}\n`);
  const split = bytes.indexOf(Buffer.from('é')) + 1;
  await appendFile(path, bytes.subarray(0, split));
  assert.deepEqual(await reader.next(), []);
  await appendFile(path, bytes.subarray(split));
  assert.deepEqual(await reader.next(), [next]);
  assert.deepEqual(await reader.next(), []);
  await appendFile(path, `garbage\n${JSON.stringify({ ...event(), intensity: 4 })}\n${JSON.stringify({ ...event(), message: '\x1b[2J' })}\n${JSON.stringify({ ...event(), message: '\u009b2J' })}\n`);
  assert.deepEqual(await reader.next(), []);
  await rename(path, join(directory, 'old.jsonl'));
  const rotated = event('boop');
  await writeFile(path, `${JSON.stringify(rotated)}\n`);
  assert.deepEqual(await reader.next(), [rotated]);
  await writeFile(path, '');
  assert.deepEqual(await reader.next(), []);
  await appendFile(path, `${JSON.stringify(next)}\n`);
  assert.deepEqual(await reader.next(), [next]);
});

test('live CLI viewer receives all four real MCP tools and exits without a signal', { timeout: 15000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-reactions-watch-'));
  const path = join(directory, 'events.jsonl');
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/watch.mjs', import.meta.url)), '--seconds', '4'], {
    env: { ...process.env, AI_REACTIONS_LOG: path, AI_REACTIONS_SOUND: '0', AI_REACTIONS_EFFECTS: 'terminal' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  const closed = once(child, 'close');
  let stdout = '', stderr = '';
  const started = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.stdout.on('data', (chunk) => { stdout += chunk; if (stdout.includes('Écoute')) resolve(); });
  });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  t.after(async () => { await closed; await rm(directory, { recursive: true, force: true }); });
  await started;
  const { client, errors } = await connect({ logPath: path, effects: 'terminal' });
  try {
    for (const name of ['boop', 'coffee', 'encourage', 'reward']) {
      const result = await client.callTool({ name, arguments: { intensity: 2 } });
      assert.notEqual(result.isError, true);
      assert.match(result.content[0].text, /\+---/);
      assert.doesNotMatch(result.content[0].text, /\x1b/);
    }
    assert.deepEqual(errors, []);
  } finally { await client.close(); }
  const [code, signal] = await closed;
  assert.equal(code, 0, stderr);
  assert.equal(signal, null);
  assert.equal(stderr, '');
  for (const label of ['BOOP / SUR LE NEZ', 'CAFE / PETIT ESPRESSO', 'ENCOURAGEMENT / BRAVO', 'RECOMPENSE / LEVEL UP'])
    assert.ok(stdout.includes(label), label);
  assert.match(stdout, /Visualiseur terminé/);
  assert.doesNotMatch(stdout, /\x1b/);
});
