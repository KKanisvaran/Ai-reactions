import { setTimeout as delay } from 'node:timers/promises';

// A deterministic interactive AI stand-in: it waits for a key, asks for a
// permission, then is interrupted, while its output keeps flowing.
if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('PTY required');
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdout.write('\x1b[?1049h\x1b[2J\x1b[HSESSION_READY\r\n');
await new Promise((resolve) => process.stdin.once('data', resolve));
let tick = 0;
const progress = setInterval(() => process.stdout.write(`\x1b[3;1HWORK_${++tick}`), 100);
try {
  process.stdout.write('\x1b[6;1HDo you want to proceed?');
  await delay(2500);
  process.stdout.write('\x1b[6;1H\x1b[2K\x1b[7;1HInterrupted by user');
  await delay(2500);
} finally {
  clearInterval(progress);
  process.stdin.setRawMode(false);
  process.stdin.pause();
}
process.stdout.write('\x1b[9;1HSESSION_DONE\r\n');
await delay(300);
