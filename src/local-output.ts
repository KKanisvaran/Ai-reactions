import { appendFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import type { ReactionEvent, ReactionOutput } from './reactions.ts';

export function reactionLogPath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.AI_REACTIONS_LOG;
  if (configured !== undefined) {
    if (!isAbsolute(configured)) {
      throw new Error('AI_REACTIONS_LOG doit être un chemin absolu vers un fichier JSONL.');
    }
    return configured;
  }
  // Per-user location: a global npm install directory may be read-only.
  return join(homedir(), '.ai-reactions', 'reactions.jsonl');
}

/** stdout belongs exclusively to the MCP transport. */
export function diagnostic(message: string): void {
  process.stderr.write(`[ai-reactions] ${message}\n`);
}

export class LocalOutput implements ReactionOutput {
  private readonly path: string;
  private pending: Promise<void> = Promise.resolve();

  constructor(path = reactionLogPath()) {
    this.path = path;
  }

  emit(event: ReactionEvent): Promise<void> {
    // Serialize writes in this process; a failed write must not poison later calls.
    const current = this.pending.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      await appendFile(this.path, `${JSON.stringify(event)}\n`, 'utf8');
      diagnostic(event.message);
    });
    this.pending = current.catch(() => {});
    return current;
  }
}
