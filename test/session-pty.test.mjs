import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('real PTY launcher renders four MCP animations, forwards input and exits with its child', { timeout: 35000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-reactions-session-'));
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('./fixtures/pty-driver.mjs', import.meta.url)),
    process.execPath, fileURLToPath(new URL('./fixtures/session-ai.mjs', import.meta.url)),
  ], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, AI_REACTIONS_LOG: join(directory, 'events.jsonl'), AI_REACTIONS_SOUND: '0', AI_REACTIONS_INTRO: '0' },
  });
  let output = '', errors = '';
  const exited = once(child, 'close');
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { errors += data; });
  t.after(async () => {
    if (child.exitCode === null) child.kill();
    await rm(directory, { recursive: true, force: true });
  });
  const [exitCode] = await exited;
  assert.equal(exitCode, 0, errors + output.slice(-3000));
  assert.match(output, /SESSION_READY/, 'the child runs interactively');
  for (const label of ['BOOP / SUR LE NEZ', 'CAFE / PETIT ESPRESSO', 'ENCOURAGEMENT / BRAVO', 'RECOMPENSE / LEVEL UP']) {
    assert.ok(output.split(label).length > 10, `multiple animated frames for ${label}`);
  }
  assert.match(output, /SESSION_DONE/);
  assert.match(output, /WORK_1\d\d/, 'AI output continues during animations');
});
