import { setTimeout as delay } from 'node:timers/promises';
import { connect } from '../../scripts/client.mjs';

// A deterministic interactive AI stand-in: real MCP, no paid model call.
if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('PTY required');
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdout.write('\x1b[?1049h\x1b[2J\x1b[HSESSION_READY\r\n');
await new Promise((resolve) => process.stdin.once('data', resolve));
const session = await connect({ effects: 'terminal' });
let tick = 0;
const progress = setInterval(() => process.stdout.write(`\x1b[3;1HWORK_${++tick}`), 100);
try {
  for (const name of ['whip', 'whip_hard', 'encourage', 'reward']) {
    const result = await session.client.callTool({ name, arguments: { intensity: 1 } });
    if (result.isError) throw new Error(JSON.stringify(result.content));
    await delay(3400);
  }
} finally {
  clearInterval(progress);
  await session.client.close();
  process.stdin.setRawMode(false);
  process.stdin.pause();
}
process.stdout.write('\x1b[5;1HSESSION_DONE\r\n');
await delay(300);
