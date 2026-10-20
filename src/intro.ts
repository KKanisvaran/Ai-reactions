import { setTimeout as delay } from 'node:timers/promises';
import { mascotPalette, mascotPixels } from './mascot.ts';
import { reactionDefinitions } from './reactions.ts';
import { effectOptions, startSound } from './terminal-output.ts';

interface IntroStream {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
  write(text: string): unknown;
}
interface IntroInput {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode?(mode: boolean): unknown;
  resume(): unknown;
  pause(): unknown;
  on(event: 'data', listener: (data: Buffer | string) => void): unknown;
  off(event: 'data', listener: (data: Buffer | string) => void): unknown;
}

const font: Record<string, string[]> = {
  K: ['██  ██', '██ ██ ', '████  ', '██ ██ ', '██  ██'],
  L: ['██    ', '██    ', '██    ', '██    ', '██████'],
  A: [' ████ ', '██  ██', '██████', '██  ██', '██  ██'],
  B: ['█████ ', '██  ██', '█████ ', '██  ██', '█████ '],
  ' ': ['  ', '  ', '  ', '  ', '  '],
};
const TITLE = 'KK LAB';
const MASCOT_WIDTH = mascotPixels[0]!.length;
const MASCOT_LINES = mascotPixels.length / 2;
const FULL = { cols: MASCOT_WIDTH + 46, rows: MASCOT_LINES + 2 };
const COMPACT = { cols: 46, rows: 20 };
const amber = [232, 170, 72];
const navy = [70, 98, 160];

const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
const fg = ([r, g, b]: number[]) => `\x1b[38;2;${r};${g};${b}m`;
const bg = ([r, g, b]: number[]) => `\x1b[48;2;${r};${g};${b}m`;
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i]! - v) * k));
const RESET = '\x1b[0m';
const DIM = '\x1b[38;2;150;160;180m';

export const introKeywords = Object.values(reactionDefinitions).map(({ keyword, summary }) => ({ keyword, summary }));

/** Truecolor half blocks: each text line shows two pixel rows of the tiger. */
function mascotLine(line: number): string {
  let out = '';
  for (let x = 0; x < MASCOT_WIDTH; x++) {
    const top = mascotPixels[line * 2]![x]!, bottom = mascotPixels[line * 2 + 1]![x]!;
    const color = (digit: string) => rgb(mascotPalette[parseInt(digit, 36)]!);
    if (top === '.' && bottom === '.') out += `${RESET} `;
    else if (bottom === '.') out += `${RESET}${fg(color(top))}▀`;
    else if (top === '.') out += `${RESET}${fg(color(bottom))}▄`;
    else out += `${fg(color(top))}${bg(color(bottom))}▀`;
  }
  return out + RESET;
}

function titleLines(reveal: number): string[] {
  const rows = font.K!.map((_, row) => [...TITLE].map((letter) => font[letter]![row]).join(' '));
  const width = rows[0]!.length;
  const shown = Math.round(width * Math.min(1, Math.max(0, reveal)));
  return rows.map((row) => [...row].map((char, x) => x >= shown ? ' '
    : `${fg(mix(navy, amber, x / width))}${char}`).join('') + RESET);
}

/** Pure frame builder (tests and static output); `seconds` drives the reveal. */
export function introFrame(seconds: number, cols = FULL.cols, rows = FULL.rows): string[] {
  const full = cols >= FULL.cols && rows >= FULL.rows;
  const panel: string[] = [];
  panel.push('', ...titleLines((seconds - 1) / 0.5));
  panel.push(seconds >= 1.5 ? `${DIM}ai-reactions · réactions animées pour IA en terminal${RESET}` : '', '');
  panel.push(seconds >= 1.6 ? `Tape un mot-clé dans le chat de ton IA :` : '', '');
  introKeywords.forEach(({ keyword, summary }, i) => {
    panel.push(seconds >= 1.7 + i * 0.09
      ? `  ${fg(amber)}${keyword.padEnd(11)}${RESET}${DIM}${summary}${RESET}` : '');
  });
  const prompt = seconds >= 3 && Math.floor(seconds * 2) % 2 === 0
    ? `${DIM}Appuie sur une touche pour continuer…${RESET}` : '';
  if (!full) return [...panel, '', prompt];
  const lines: string[] = [];
  for (let line = 0; line < MASCOT_LINES; line++) {
    const art = seconds >= line * 0.045 ? mascotLine(line) : ' '.repeat(MASCOT_WIDTH);
    lines.push(` ${art}    ${panel[line] ?? ''}`);
  }
  lines.push('', ` ${' '.repeat(MASCOT_WIDTH)}    ${prompt}`);
  return lines;
}

/** Plain text for captured output: no cursor control, no colors. */
export function introText(): string {
  return ['KK LAB · ai-reactions', 'Tape un mot-clé dans le chat de ton IA :',
    ...introKeywords.map(({ keyword, summary }) => `  ${keyword.padEnd(11)}${summary}`)].join('\n');
}

export async function playIntro(stdout: IntroStream = process.stdout, stdin: IntroInput = process.stdin,
  { timeoutMs = 20000 } = {}): Promise<void> {
  const cols = stdout.columns ?? 80, rows = stdout.rows ?? 24;
  if (!stdout.isTTY || !stdin.isTTY || cols < COMPACT.cols || rows < COMPACT.rows) {
    stdout.write(`${introText()}\n`);
    return;
  }
  let pressed = false;
  // Terminal reports (focus, cursor position, device attributes) are not key presses.
  const onKey = (data: Buffer | string) => {
    if (!/^(\x1b\[[0-9;?]*[A-Za-z~]|\x1b\[[IO])+$/.test(data.toString())) pressed = true;
  };
  const wasRaw = Boolean(stdin.isRaw);
  stdout.write('\x1b[?1049h\x1b[?25l\x1b[2J');
  try {
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on('data', onKey);
    try {
      const options = effectOptions();
      if (options.sound) void startSound({ reaction: 'hype', intensity: 1 }, options.volume).finished.catch(() => {});
    } catch { /* The intro stays silent with invalid audio settings. */ }
    const start = performance.now();
    // Only changed lines are rewritten: the truecolor tiger is heavy for ConPTY.
    let previous: string[] = [];
    while (!pressed && performance.now() - start < timeoutMs) {
      const frame = introFrame((performance.now() - start) / 1000, stdout.columns ?? cols, stdout.rows ?? rows);
      if (frame.length !== previous.length) { stdout.write('\x1b[2J'); previous = []; }
      const changes = frame.map((line, i) => line === previous[i] ? '' : `\x1b[${i + 1};1H${line}\x1b[K`).join('');
      if (changes) stdout.write(changes);
      previous = frame;
      await delay(40);
    }
  } finally {
    stdin.off('data', onKey);
    stdin.setRawMode?.(wasRaw);
    stdin.pause();
    stdout.write(`${RESET}\x1b[?25h\x1b[?1049l`);
  }
}
