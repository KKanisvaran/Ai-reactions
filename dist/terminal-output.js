import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnostic, LocalOutput } from "./local-output.js";
import { synthesizeSound } from "./sound.js";
import { animateTerminal } from "./terminal-animation.js";
export function effectOptions(env = process.env, platform = process.platform) {
    const mode = env.AI_REACTIONS_EFFECTS ?? 'terminal';
    if (mode !== 'terminal' && mode !== 'text') {
        throw new Error('AI_REACTIONS_EFFECTS : terminal ou text attendu. Le mode fenêtre windows a été retiré.');
    }
    const sound = env.AI_REACTIONS_SOUND ?? '1';
    if (sound !== '0' && sound !== '1')
        throw new Error('AI_REACTIONS_SOUND : 0 ou 1 attendu.');
    const volumeText = env.AI_REACTIONS_VOLUME ?? '0.3';
    const volume = Number(volumeText);
    if (!volumeText.trim() || !Number.isFinite(volume) || volume < 0 || volume > 1)
        throw new Error('AI_REACTIONS_VOLUME doit être compris entre 0 et 1.');
    return { mode, sound: ['win32', 'darwin', 'linux'].includes(platform) && sound === '1' && volume > 0, volume };
}
/** Audio only: no WPF, GUI, console window, keyboard or focus API. */
export function startWindowsSound(event, volume) {
    const wav = synthesizeSound(event.reaction, event.intensity, volume);
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const finished = new Promise((resolve, reject) => {
        const executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        const script = fileURLToPath(new URL('../windows/audio.ps1', import.meta.url));
        let output = '';
        const child = execFile(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script], {
            windowsHide: true, timeout: 10000, maxBuffer: 64 * 1024, encoding: 'utf8',
        }, (error, stdout, stderr) => {
            if (error || stdout.trim() !== 'READY') {
                const failure = new Error(`Audio Windows : ${stderr.trim() || error?.message || 'réponse inattendue'}`);
                rejectReady(failure);
                reject(failure);
            }
            else
                resolve();
        });
        child.stdout?.on('data', (chunk) => {
            output += chunk;
            if (output.includes('READY\n') || output.includes('READY\r\n'))
                resolveReady();
        });
        child.stdin?.on('error', () => { });
        child.stdin?.end(wav.toString('base64'));
    });
    void ready.catch(() => { });
    void finished.catch(() => { });
    return { ready, finished };
}
/** macOS (afplay) and Linux (paplay, then aplay); a missing player only mutes the effect. */
export function startUnixSound(event, volume, platform = process.platform) {
    const wav = synthesizeSound(event.reaction, event.intensity, volume);
    const file = join(tmpdir(), `ai-reactions-${randomUUID()}.wav`);
    const players = platform === 'darwin' ? [['afplay', file]] : [['paplay', file], ['aplay', '-q', file]];
    const play = (index) => new Promise((resolve) => {
        const [command, ...args] = players[index];
        const next = () => resolve(index + 1 < players.length ? play(index + 1) : undefined);
        const child = spawn(command, args, { stdio: 'ignore', timeout: 10000 });
        child.once('error', next);
        child.once('exit', (code) => { if (code === 0)
            resolve();
        else
            next(); });
    });
    const ready = writeFile(file, wav);
    const finished = ready.then(() => play(0)).finally(() => rm(file, { force: true }));
    void finished.catch(() => { });
    return { ready, finished };
}
export function startSound(event, volume) {
    return process.platform === 'win32' ? startWindowsSound(event, volume) : startUnixSound(event, volume);
}
export async function playTerminalEffect(event, options = effectOptions(), stream = process.stdout) {
    if (options.mode === 'text')
        return;
    if (!options.sound)
        return animateTerminal(event, stream);
    const audio = startSound(event, options.volume);
    await audio.ready;
    await Promise.all([animateTerminal(event, stream), audio.finished]);
}
export class TerminalOutput {
    pending = Promise.resolve();
    queued = 0;
    local;
    run;
    constructor(_options = effectOptions(), local = new LocalOutput(), run = async (event) => {
        // The host owns its TUI even when stderr is a TTY: never move its cursor.
        diagnostic(`Réaction ${event.reaction} disponible dans le terminal du lanceur : ai-reactions codex (ou visualiseur séparé : ai-reactions watch).`);
    }) {
        this.local = local;
        this.run = run;
    }
    emit(event) {
        if (this.queued >= 4)
            return Promise.reject(new Error('File d’animations pleine ; attendez la fin des réactions en cours.'));
        this.queued++;
        const current = this.pending.then(async () => {
            await this.local.emit(event);
            await this.run(event);
        }).finally(() => { this.queued--; });
        this.pending = current.catch(() => { });
        return current;
    }
}
export function createOutput(options = effectOptions()) {
    return options.mode === 'terminal' ? new TerminalOutput(options) : new LocalOutput();
}
