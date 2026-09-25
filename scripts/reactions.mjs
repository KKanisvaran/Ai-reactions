import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { reactionLogPath } from '../dist/local-output.js';

// Finite read: no watcher to stop, no key injection or signal required.
try {
  const path = reactionLogPath();
  const stream = createReadStream(path, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const recent = [];
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      recent.push(`${event.timestamp} ${event.message}`);
      if (recent.length > 20) recent.shift();
    } catch {
      // An append by another MCP process can be in progress; show complete events.
    }
  }
  console.log(`Journal : ${path}`);
  console.log(recent.length ? recent.join('\n') : 'Aucune réaction pour le moment.');
} catch (error) {
  if (error.code === 'ENOENT') console.log('Aucune réaction pour le moment. Lancez npm run demo.');
  else {
    console.error(`Lecture impossible : ${error.message}`);
    process.exitCode = 1;
  }
}
