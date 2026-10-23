import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('real PTY launcher: the penguin reacts on its own below the AI, input is forwarded and it exits with its child', { timeout: 55000 }, async (t) => {
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('./fixtures/pty-driver.mjs', import.meta.url)),
    process.execPath, fileURLToPath(new URL('./fixtures/session-ai.mjs', import.meta.url)),
  ], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, AI_REACTIONS_INTRO: '0' },
  });
  let output = '', errors = '';
  const exited = once(child, 'close');
  // Decoded as a stream: a multibyte character (« … ») may straddle two chunks.
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { errors += data; });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  const [exitCode] = await exited;
  assert.equal(exitCode, 0, errors + output.slice(-3000));
  assert.match(output, /SESSION_READY/, 'the child runs interactively');
  // A permission prompt, then an interruption: suspense, then a facepalm.
  const plain = output.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/[▀ ]+/g, ' ');
  for (const caption of ['Hmm… louche.', 'Bruh.']) assert.ok(output.includes(caption), `band caption ${caption}: ${plain}`);
  assert.match(output, /Interrupted by user/, 'the AI stays on screen');
  assert.match(output, /SESSION_DONE/);
  assert.match(output, /WORK_[4-9]\d/, 'AI output keeps flowing');
});
