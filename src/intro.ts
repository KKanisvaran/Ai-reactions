import { setTimeout as delay } from 'node:timers/promises';
import { imagesAllowed, mascotAspect, mascotBlocks, mascotHeight, mascotSixel, parseGraphics, queryTerminal } from './mascot-render.ts';
import type { TerminalGraphics } from './mascot-render.ts';
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
const NOTE = ['Créé juste pour le plaisir,', 'en espérant vous faire sourire.'];
/** The splash needs room for its note, the mascot when it fits; the keyword list, 21 lines. */
const SPLASH_MIN = { cols: 30, rows: 13 };
const KEYWORDS_MIN = { cols: 54, rows: 22 };
/** Seconds the mascot takes to draw itself; the signature and the note follow below it. */
const DRAW = 1.6;
const IMAGE_AT = DRAW;
const SIGN_AT = DRAW + 0.2;
const NOTE_AT = SIGN_AT + 0.5;
const NOTE_SPEED = 30;
/** The splash closes on its own once the note is read; the first launch then lists the keywords. */
export const SPLASH_FOR = NOTE_AT + [...NOTE.join(' ')].length / NOTE_SPEED + 1.8;
/** Text lines under the mascot: a gap, the signature, the note (on one or two lines) and a margin. */
const BELOW = 5;
/** The real image stays small: at most this many lines tall. */
const MASCOT_LINES = 12;
/**
 * Half blocks need more lines to show the stripes: below 16, the tiger blurs
 * into a wolf, so it is left out rather than misdrawn.
 */
const BLOCK_LINES = { min: 16, max: 22 };
const amber = [232, 170, 72];
const navy = [70, 98, 160];

const fg = ([r, g, b]: number[]) => `\x1b[38;2;${r};${g};${b}m`;
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i]! - v) * k));
const RESET = '\x1b[0m';
const DIM = '\x1b[38;2;150;160;180m';
const TEXT = '\x1b[38;2;219;227;238m';
const AMBER = '\x1b[1;38;2;232;170;72m';

export const introKeywords = Object.values(reactionDefinitions).map(({ keyword, summary }) => ({ keyword, summary }));

const center = (text: string, width: number, cols: number) => `${' '.repeat(Math.max(0, Math.floor((cols - width) / 2)))}${text}`;

/** The mascot's box in cells: small, centered with the text below it. */
function mascotBox(cols: number, rows: number, graphics?: TerminalGraphics) {
  const cell = graphics?.sixel ? graphics.cell : undefined;
  // Pixels per cell: two stacked half blocks, or the real cell size for an image.
  const [cellWidth, cellHeight] = cell ? [cell.width, cell.height] : [1, 2];
  const widthFor = (lines: number) => Math.ceil(Math.min(lines * cellHeight, cell ? mascotHeight : Infinity) * mascotAspect / cellWidth);
  let lines = Math.min(cell ? MASCOT_LINES : BLOCK_LINES.max, rows - BELOW);
  while (lines > 0 && widthFor(lines) > cols - 2) lines--;
  if (lines < (cell ? 8 : BLOCK_LINES.min)) return undefined;
  const width = widthFor(lines);
  return {
    lines, width, left: Math.floor((cols - width) / 2), top: Math.floor((rows - lines - BELOW + 1) / 2),
    image: Boolean(cell), pixels: Math.min(lines * cellHeight, mascotHeight),
  };
}

/** The splash: the mascot, centered, then « by KK LAB » and the note typing itself below. */
function splashFrame(seconds: number, cols: number, rows: number, graphics?: TerminalGraphics): string[] {
  const box = mascotBox(cols, rows, graphics);
  const lines: string[] = Array.from({ length: box?.top ?? 0 }, () => '');
  // The mascot draws itself in half blocks; a Sixel image then takes its place.
  if (box?.image && seconds >= IMAGE_AT) for (let i = 0; i < box.lines; i++) lines.push('');
  else if (box) {
    for (const line of mascotBlocks(box.width, box.lines, Math.min(1, seconds / DRAW))) lines.push(`${' '.repeat(box.left)}${line}`);
  }
  lines.push('', seconds >= SIGN_AT ? center(`${DIM}by ${AMBER}KK LAB${RESET}`, 9, cols) : '');
  const note = [...NOTE.join(' ')].length <= cols - 2 ? [NOTE.join(' ')] : NOTE;
  let typed = Math.max(0, Math.floor((seconds - NOTE_AT) * NOTE_SPEED));
  for (const line of note) {
    const shown = [...line].slice(0, typed);
    typed -= shown.length + 1;
    lines.push(shown.length ? center(`${TEXT}${shown.join('')}${RESET}`, [...line].length, cols) : '');
  }
  return lines;
}

function titleLines(reveal: number): string[] {
  const rows = font.K!.map((_, row) => [...TITLE].map((letter) => font[letter]![row]).join(' '));
  const width = rows[0]!.length;
  const shown = Math.round(width * Math.min(1, Math.max(0, reveal)));
  return rows.map((row) => [...row].map((char, x) => x >= shown ? ' '
    : `${fg(mix(navy, amber, x / width))}${char}`).join('') + RESET);
}

/** First launch, after the splash: the chat keywords, until a key is pressed. */
function keywordsFrame(seconds: number): string[] {
  const panel = titleLines(seconds / 0.5);
  panel.push(seconds >= 0.5 ? `${DIM}ai-reactions · réactions animées pour IA en terminal${RESET}` : '', '');
  panel.push(seconds >= 0.6 ? `Tape un mot-clé dans le chat de ton IA :` : '');
  introKeywords.forEach(({ keyword, summary }, i) => {
    panel.push(seconds >= 0.7 + i * 0.09 ? `  ${fg(amber)}${keyword.padEnd(11)}${RESET}${DIM}${summary}${RESET}` : '');
  });
  const prompt = seconds >= 2 && Math.floor(seconds * 2) % 2 === 0 ? `${DIM}Appuie sur une touche pour continuer…${RESET}` : '';
  return [...panel, '', prompt].map((line) => line && ` ${line}`);
}

/**
 * Pure frame builder (tests and static output); `seconds` drives the reveal.
 * With a Sixel image, the mascot's lines stay blank: `introImage` draws it.
 */
export function introFrame(seconds: number, cols = 120, rows = 34, keywords = true, graphics?: TerminalGraphics): string[] {
  return keywords && seconds >= SPLASH_FOR ? keywordsFrame(seconds - SPLASH_FOR) : splashFrame(seconds, cols, rows, graphics);
}

let sixel: { pixels: number; image: string } | undefined;

/** The Sixel mascot for this frame, centered at the top, or undefined when it is drawn in half blocks. */
export function introImage(seconds: number, cols: number, rows: number, keywords: boolean, graphics?: TerminalGraphics): string | undefined {
  if (seconds < IMAGE_AT || (keywords && seconds >= SPLASH_FOR)) return undefined;
  const box = mascotBox(cols, rows, graphics);
  if (!box?.image) return undefined;
  if (sixel?.pixels !== box.pixels) sixel = { pixels: box.pixels, image: mascotSixel(box.pixels) };
  return `\x1b[${box.top + 1};${box.left + 1}H${sixel.image}`;
}

/** Plain text for captured output: no cursor control, no colors. */
export function introText(): string {
  return ['KK LAB · ai-reactions', NOTE.join(' '), 'Tape un mot-clé dans le chat de ton IA :',
    ...introKeywords.map(({ keyword, summary }) => `  ${keyword.padEnd(11)}${summary}`)].join('\n');
}

/**
 * The KK LAB mascot appears in large, with its note below, then closes on its
 * own. With `keywords`, the chat keywords follow until a key is pressed.
 */
export async function playIntro(stdout: IntroStream = process.stdout, stdin: IntroInput = process.stdin,
  { timeoutMs = 20000, keywords = true } = {}): Promise<void> {
  const cols = stdout.columns ?? 80, rows = stdout.rows ?? 24;
  if (!stdout.isTTY || !stdin.isTTY || cols < SPLASH_MIN.cols || rows < SPLASH_MIN.rows) {
    if (keywords) stdout.write(`${introText()}\n`);
    return;
  }
  // Too small for the keyword list: the splash alone, then the list as plain text.
  const list = keywords && cols >= KEYWORDS_MIN.cols && rows >= KEYWORDS_MIN.rows;
  const plainList = keywords && !list;
  keywords = list;
  let presses = 0, replies = '';
  // Terminal reports (focus, cursor position, device attributes, cell size) are not key presses.
  const onKey = (data: Buffer | string) => {
    const text = data.toString();
    if (/^(\x1b\[[0-9;?]*[A-Za-z~]|\x1b\[[IO])+$/.test(text)) replies += text;
    else presses++;
  };
  const wasRaw = Boolean(stdin.isRaw);
  stdout.write('\x1b[?1049h\x1b[?25l\x1b[2J');
  try {
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on('data', onKey);
    // A real image when the terminal can show one: Sixel, sized from its cells.
    let graphics: TerminalGraphics | undefined;
    if (imagesAllowed()) {
      stdout.write(queryTerminal);
      for (const asked = performance.now(); !(graphics = parseGraphics(replies)) && performance.now() - asked < 400;) await delay(20);
    }
    if (keywords) {
      try {
        const options = effectOptions();
        if (options.sound) void startSound({ reaction: 'hype', intensity: 1 }, options.volume).finished.catch(() => {});
      } catch { /* The intro stays silent with invalid audio settings. */ }
    }
    let start = performance.now();
    // Only changed lines are rewritten: the truecolor mascot is heavy for ConPTY.
    let previous: string[] = [], size = '', drawn = false;
    for (;;) {
      let seconds = (performance.now() - start) / 1000;
      // A key skips the splash; on the keyword list, it closes the intro.
      if (presses && keywords && seconds < SPLASH_FOR) { presses = 0; start -= (SPLASH_FOR - seconds) * 1000; seconds = SPLASH_FOR; }
      if (presses || seconds * 1000 >= (keywords ? SPLASH_FOR * 1000 + timeoutMs : SPLASH_FOR * 1000)) break;
      const width = stdout.columns ?? cols, height = stdout.rows ?? rows;
      const frame = introFrame(seconds, width, height, keywords, graphics);
      if (frame.length !== previous.length || size !== `${width}x${height}`) {
        stdout.write('\x1b[2J');
        previous = []; size = `${width}x${height}`; drawn = false;
      }
      const changes = frame.map((line, i) => line === previous[i] ? '' : `\x1b[${i + 1};1H${line}\x1b[K`).join('');
      if (changes) stdout.write(changes);
      const image = drawn ? undefined : introImage(seconds, width, height, keywords, graphics);
      if (image) { stdout.write(image); drawn = true; }
      previous = frame;
      await delay(40);
    }
  } finally {
    stdin.off('data', onKey);
    stdin.setRawMode?.(wasRaw);
    stdin.pause();
    stdout.write(`${RESET}\x1b[?25h\x1b[?1049l`);
  }
  if (plainList) stdout.write(`${introText()}\n`);
}
