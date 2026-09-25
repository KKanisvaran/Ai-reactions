import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.ts';
import { diagnostic, reactionLogPath } from './local-output.ts';
import { effectOptions } from './terminal-output.ts';

try {
  const path = reactionLogPath();
  const effects = effectOptions();
  serveStdio(() => createServer(), { onerror: (error) => diagnostic(error.message) });
  diagnostic(`Prêt sur stdio. Effets : ${effects.mode}. Journal local : ${path}`);
} catch (error) {
  diagnostic(error instanceof Error ? error.message : 'Erreur au démarrage.');
  process.exitCode = 1;
}
