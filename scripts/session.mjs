import pty from 'node-pty';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { JournalReader } from '../dist/journal-reader.js';
import { reactionLogPath } from '../dist/local-output.js';
import { effectOptions } from '../dist/terminal-output.js';
import { SessionTerminal } from '../dist/session-terminal.js';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
if (args[0] === '--help') {
  console.log('Usage : ai-reactions codex [arguments] (ou claude, gemini)\n'
    + 'Dans le chat : ko1 = fouet ; ko2 = batte ; gret job = encouragement ; great job dude = récompense ;\n'
    + 'trop long = escargot ; chill = palmier lo-fi ; wtf = perplexe ; bruh = facepalm ;\n'
    + 'let\'s go = hype ; rip = pierre tombale ; susp = suspense ; ez = trop facile.\n'
    + 'Les réactions MCP sont animées dans ce terminal, puis l’écran de l’IA est restauré.');
} else if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Lancez ai-reactions codex directement dans un terminal interactif (sans capture ni pipeline).');
  process.exitCode = 1;
} else {
  await run(args.length ? args : ['codex']);
  // ConPTY can retain worker handles after onExit. The child has already
  // exited and the screen is restored; flush output before closing our host.
  process.stdout.write('', () => process.exit(process.exitCode ?? 0));
}

async function run(command) {
  let child, screen, stop = false, entered = false;
  let input, resize;
  const wasRaw = process.stdin.isRaw;
  try {
    const reader = new JournalReader(reactionLogPath());
    await reader.start();
    screen = new SessionTerminal(process.stdout, effectOptions());
    let executable = command[0], arguments_ = command.slice(1);
    if (process.platform === 'win32') {
      if (['codex', 'gemini', 'npm', 'npx'].includes(executable)) executable += '.cmd';
      // PowerShell resolves npm .cmd shims as well as native executables.
      // Every user argument is a single-quoted literal, never executable code.
      const quote = (value) => `'${value.replaceAll("'", "''")}'`;
      const script = `$ErrorActionPreference = 'Stop'; try { & ${quote(executable)} ${arguments_.map(quote).join(' ')}; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE } } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }`;
      executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      arguments_ = ['-NoLogo', '-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
    }
    child = pty.spawn(executable, arguments_, {
      name: 'xterm-256color', cols: process.stdout.columns, rows: process.stdout.rows,
      useConptyDll: true,
      cwd: process.cwd(), env: { ...process.env, TERM: 'xterm-256color' },
    });
    const exited = new Promise((resolve) => child.onExit(resolve));
    child.onData((data) => { void screen.write(data); });
    // Replies to terminal protocol queries, not synthetic user input.
    screen.terminal.onData((data) => { if (!stop) child.write(data); });
    input = (data) => { if (!stop) child.write(data.toString('utf8')); };
    resize = () => {
      if (stop) return;
      const cols = Math.max(1, process.stdout.columns), rows = Math.max(1, process.stdout.rows);
      screen.resize(cols, rows);
      try { child.resize(cols, rows); } catch { /* The child may just have exited. */ }
    };
    process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H');
    entered = true;
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.on('data', input);
    process.stdout.on('resize', resize);
    const watching = (async () => {
      while (!stop) {
        try {
          for (const event of await reader.next()) {
            if (stop) break;
            await screen.react(event);
          }
        } catch (error) {
          // Surface playback errors inside the same screen, then keep the AI alive.
          await screen.write(`\r\n[ai-reactions] ${error.message}\r\n`);
        }
        if (!stop) await delay(100);
      }
    })();
    const { exitCode } = await exited;
    stop = true;
    await watching;
    process.exitCode = exitCode;
  } catch (error) {
    stop = true;
    process.exitCode = 1;
    if (entered) process.stdout.write('\x1b[?1049l');
    entered = false;
    console.error(`Lancement impossible : ${error.message}`);
  } finally {
    stop = true;
    if (input) process.stdin.off('data', input);
    if (resize) process.stdout.off('resize', resize);
    process.stdin.setRawMode(Boolean(wasRaw));
    process.stdin.pause();
    await screen?.dispose();
    if (entered) process.stdout.write('\x1b[?2026l\x1b[0m\x1b[?1l\x1b[?2004l\x1b[?25h\x1b[?1049l');
  }
}
