import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { test } from 'node:test';
import { connect } from '../scripts/client.mjs';

async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'ai-reactions test '));
  const logPath = join(directory, 'events.jsonl');
  const session = await connect({ logPath, cwd: directory, effects: 'text', ...options });
  t.after(async () => {
    await session.client.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { ...session, directory, logPath };
}

test('real stdio SDK client discovers tools, calls all intensities and rejects bad input', { timeout: 20000 }, async (t) => {
  const { client, errors, diagnostics, logPath } = await fixture(t);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ['boop', 'chill', 'coffee', 'confused', 'encourage', 'ez', 'facepalm', 'hype', 'reward', 'rip', 'sus', 'too_slow']);
  for (const [name, keyword] of Object.entries({ boop: 'boop', coffee: 'café', encourage: 'bien joué', reward: 'gg', too_slow: 'trop long', chill: 'chill', confused: 'wtf', facepalm: 'bruh', hype: 'let\'s go', rip: 'rip', sus: 'susp', ez: 'ez' })) {
    assert.ok(tools.find((tool) => tool.name === name).description.includes(`« ${keyword} »`));
  }
  for (const tool of tools) {
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.equal(tool.inputSchema.properties.intensity.minimum, 1);
    assert.equal(tool.inputSchema.properties.intensity.maximum, 3);
    assert.equal(tool.annotations.readOnlyHint, false);
    assert.equal(tool.annotations.openWorldHint, false);
  }
  for (const name of ['boop', 'coffee', 'encourage', 'reward', 'too_slow', 'chill', 'confused', 'facepalm', 'hype', 'rip', 'sus', 'ez']) {
    for (const intensity of [1, 2, 3]) {
      const result = await client.callTool({ name, arguments: { intensity } });
      assert.notEqual(result.isError, true);
      assert.equal(result.structuredContent.reaction, name);
      assert.equal(result.structuredContent.intensity, intensity);
      assert.match(result.content[0].text, new RegExp(`${name.toUpperCase()} ${intensity}/3`));
    }
    for (const args of [{ intensity: 0 }, { intensity: 4 }, { intensity: 1.5 },
      { intensity: '2' }, { intensity: null }, { intensity: true }, { extra: 'no' }]) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, JSON.stringify(args));
    }
  }
  const defaultResult = await client.callTool({ name: 'boop', arguments: {} });
  assert.equal(defaultResult.structuredContent.intensity, 1);
  const events = (await readFile(logPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(events.length, 37, 'invalid calls must have no local effect');
  assert.equal(new Set(events.map((event) => event.id)).size, 37);
  await client.ping();
  assert.deepEqual(errors, [], 'stdout must contain only valid MCP messages');
  assert.match(diagnostics.join(''), /BOOP 3\/3/);
  assert.match(diagnostics.join(''), /ENCOURAGE 3\/3/);
});

test('write failure returns isError and the same server recovers', { timeout: 15000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-reactions failure '));
  const blocker = join(directory, 'blocker');
  await writeFile(blocker, 'not a directory');
  const session = await connect({ logPath: join(blocker, 'events.jsonl'), effects: 'text' });
  t.after(async () => {
    await session.client.close();
    await rm(directory, { recursive: true, force: true });
  });
  const failed = await session.client.callTool({ name: 'boop', arguments: { intensity: 2 } });
  assert.equal(failed.isError, true);
  assert.equal(failed.structuredContent, undefined);
  await rm(blocker);
  const recovered = await session.client.callTool({ name: 'encourage', arguments: {} });
  assert.notEqual(recovered.isError, true);
  assert.equal(recovered.structuredContent.intensity, 1);
  await session.client.ping();
  assert.deepEqual(session.errors, []);
});

test('development entry point works without a TypeScript runner dependency', { timeout: 15000 }, async (t) => {
  const { client } = await fixture(t, { source: true });
  const result = await client.callTool({ name: 'encourage', arguments: {} });
  assert.equal(result.structuredContent.intensity, 1);
});

test('multiple clients and concurrent calls persist complete local events', { timeout: 20000 }, async (t) => {
  const first = await fixture(t);
  const second = await connect({ logPath: first.logPath, effects: 'text' });
  t.after(() => second.client.close());
  const results = await Promise.all(Array.from({ length: 20 }, (_, index) =>
    (index % 2 ? first : second).client.callTool({
      name: index % 2 ? 'boop' : 'encourage', arguments: { intensity: index % 3 + 1 },
    })));
  assert.ok(results.every((result) => !result.isError));
  const events = (await readFile(first.logPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(events.length, 20);
  assert.equal(new Set(events.map((event) => event.id)).size, 20);
});

test('legacy MCP handshake, clean stdout and natural exit on stdin EOF', { timeout: 15000 }, async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../dist/index.js', import.meta.url))], {
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  const closed = once(child, 'close');
  let stdout = '';
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  async function request(message) {
    const response = once(lines, 'line', { signal: AbortSignal.timeout(4000) });
    child.stdin.write(`${JSON.stringify(message)}\n`);
    const [line] = await response;
    return JSON.parse(line);
  }
  try {
    const reply = await request({
      jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'legacy-test', version: '1' },
      },
    });
    assert.equal(reply.id, 1);
    assert.equal(reply.result.protocolVersion, '2025-11-25');
    assert.equal(reply.result.serverInfo.name, 'ai-reactions');
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    const invalid = await request({
      jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'boop', arguments: { intensity: '3' } },
    });
    assert.equal(invalid.result.isError, true, 'server validates even without SDK client checks');
    const unknown = await request({
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'nonexistent', arguments: {} },
    });
    assert.ok(unknown.error || unknown.result?.isError, 'unknown tools cannot succeed');
    const ping = await request({ jsonrpc: '2.0', id: 4, method: 'ping' });
    assert.equal(ping.id, 4);
    assert.ok(ping.result);
  } finally {
    child.stdin.end();
    const [code, signal] = await closed;
    assert.equal(code, 0);
    assert.equal(signal, null, 'server exits without any signal');
  }
  assert.match(stderr, /Prêt sur stdio/);
  const replies = stdout.trim().split('\n').map(JSON.parse);
  assert.deepEqual(replies.map((reply) => reply.id), [1, 2, 3, 4]);
});

test('invalid startup configuration fails with stderr only', { timeout: 10000 }, async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../dist/index.js', import.meta.url))], {
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    env: { ...process.env, AI_REACTIONS_LOG: 'relative.jsonl' },
  });
  const closed = once(child, 'close');
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdin.end();
  const [code] = await closed;
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /chemin absolu/);
});
