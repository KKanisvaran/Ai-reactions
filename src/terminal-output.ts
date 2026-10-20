import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnostic, LocalOutput } from './local-output.ts';
import type { ReactionEvent, ReactionOutput } from './reactions.ts';
import { synthesizeSound } from './sound.ts';
import { animateTerminal } from './terminal-animation.ts';
import type { TerminalStream } from './terminal-animation.ts';

export interface EffectOptions {
  mode: 'terminal' | 'text';
  sound: boolean;
  volume: number;
}

export function effectOptions(env: NodeJS.ProcessEnv = process.env, platform = process.platform): EffectOptions {
  const mode = env.AI_REACTIONS_EFFECTS ?? 'terminal';
  if (mode !== 'terminal' && mode !== 'text') {
    throw new Error('AI_REACTIONS_EFFECTS : terminal ou text attendu. Le mode fenêtre windows a été retiré.');
  }
  const sound = env.AI_REACTIONS_SOUND ?? '1';
  if (sound !== '0' && sound !== '1') throw new Error('AI_REACTIONS_SOUND : 0 ou 1 attendu.');
  const volumeText = env.AI_REACTIONS_VOLUME ?? '0.3';
  const volume = Number(volumeText);
  if (!volumeText.trim() || !Number.isFinite(volume) || volume < 0 || volume > 1)
    throw new Error('AI_REACTIONS_VOLUME doit être compris entre 0 et 1.');
  return { mode, sound: platform === 'win32' && sound === '1' && volume > 0, volume };
}

/** Audio only: no WPF, GUI, console window, keyboard or focus API. */
export function startWindowsSound(event: ReactionEvent, volume: number) {
  const wav = synthesizeSound(event.reaction, event.intensity, volume);
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const finished = new Promise<void>((resolve, reject) => {
    const executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const script = fileURLToPath(new URL('../windows/audio.ps1', import.meta.url));
    let output = '';
    const child = execFile(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script], {
      windowsHide: true, timeout: 10000, maxBuffer: 64 * 1024, encoding: 'utf8',
    }, (error, stdout, stderr) => {
      if (error || stdout.trim() !== 'READY') {
        const failure = new Error(`Audio Windows : ${stderr.trim() || error?.message || 'réponse inattendue'}`);
        rejectReady(failure); reject(failure);
      } else resolve();
    });
    child.stdout?.on('data', (chunk: string) => {
      output += chunk;
      if (output.includes('READY\n') || output.includes('READY\r\n')) resolveReady();
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end(wav.toString('base64'));
  });
  void ready.catch(() => {});
  void finished.catch(() => {});
  return { ready, finished };
}

export async function playTerminalEffect(event: ReactionEvent, options = effectOptions(), stream: TerminalStream = process.stdout) {
  if (options.mode === 'text') return;
  if (!options.sound) return animateTerminal(event, stream);
  const audio = startWindowsSound(event, options.volume);
  await audio.ready;
  await Promise.all([animateTerminal(event, stream), audio.finished]);
}

export class TerminalOutput implements ReactionOutput {
  private pending: Promise<void> = Promise.resolve();
  private queued = 0;
  private readonly local: ReactionOutput;
  private readonly run: (event: ReactionEvent) => Promise<unknown>;

  constructor(_options = effectOptions(), local: ReactionOutput = new LocalOutput(),
    run: (event: ReactionEvent) => Promise<unknown> = async (event) => {
      // The host owns its TUI even when stderr is a TTY: never move its cursor.
      diagnostic(`Réaction ${event.reaction} disponible dans le terminal du lanceur : npm run ai -- codex (ou visualiseur séparé : npm run watch).`);
    }) {
    this.local = local; this.run = run;
  }

  emit(event: ReactionEvent): Promise<void> {
    if (this.queued >= 4) return Promise.reject(new Error('File d’animations pleine ; attendez la fin des réactions en cours.'));
    this.queued++;
    const current = this.pending.then(async () => {
      await this.local.emit(event);
      await this.run(event);
    }).finally(() => { this.queued--; });
    this.pending = current.catch(() => {});
    return current;
  }
}

export function createOutput(options = effectOptions()): ReactionOutput {
  return options.mode === 'terminal' ? new TerminalOutput(options) : new LocalOutput();
}
