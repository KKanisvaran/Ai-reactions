import { setTimeout as delay } from 'node:timers/promises';
import { JournalReader } from '../dist/journal-reader.js';
import { reactionLogPath } from '../dist/local-output.js';
import { effectOptions, playTerminalEffect } from '../dist/terminal-output.js';

try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--seconds'))
    throw new Error('Usage : npm run watch -- --seconds 300');
  const seconds = args.length ? Number(args[1]) : 60;
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600)
    throw new Error('--seconds doit être un entier entre 1 et 3600.');
  const options = effectOptions();
  const path = reactionLogPath();
  const reader = new JournalReader(path);
  await reader.start();
  console.log(`Écoute des nouvelles réactions pendant ${seconds}s : ${path}`);
  console.log('Les quatre effets sont animés ici. Arrêt automatique à la fin du délai.');
  const end = performance.now() + seconds * 1000;
  while (performance.now() < end) {
    for (const event of await reader.next()) {
      if (performance.now() >= end) break;
      try {
        await playTerminalEffect(event, options);
        console.log(event.message);
      } catch (error) {
        console.error(`Réaction ${event.reaction} : ${error.message}`);
      }
    }
    const remaining = end - performance.now();
    if (remaining > 0) await delay(Math.min(150, remaining));
  }
  console.log('Visualiseur terminé.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
