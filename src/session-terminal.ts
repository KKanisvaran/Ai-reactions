import xterm from '@xterm/headless';
import { AmbientMood, bandCells, bandHit, bandRows, paintCells, penguinFrame, readSignals } from './ambient.ts';
import type { BandCell } from './ambient.ts';
import { playTerminalEffect, startSound } from './terminal-output.ts';
import type { EffectOptions } from './terminal-output.ts';
import type { ReactionEvent } from './reactions.ts';
import type { TerminalStream } from './terminal-animation.ts';

const BUSY_ROWS = 15;
/** Unchanged cells between two changes are rewritten when cheaper than moving the cursor. */
const GAP = 6;
/** The band's frame time: 30 frames a second, only the changed cells sent. */
const BAND_FRAME = 33;

// The outer terminal belongs to this launcher. The AI has a separate PTY and
// continues updating this bounded virtual screen while an animation is shown.
export class SessionTerminal {
  readonly terminal: xterm.Terminal;
  private animating = false;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: Promise<void> = Promise.resolve();
  private readonly output: TerminalStream;
  private readonly options: EffectOptions;
  private cursorVisible = true;
  // Ambient band below the AI: the penguin, fed by what the AI's screen shows.
  private readonly mood: AmbientMood | undefined;
  private band = 0;
  private ticker: ReturnType<typeof setInterval> | undefined;
  private lastOutput = -Infinity;
  private lastInput = -Infinity;
  private lastTick = -Infinity;
  private shownBand: BandCell[][] = [];
  /** How far the penguin is from its place, so a click finds it out at sea. */
  private penguinAway = 0;
  /** The AI rows as last painted, so unchanged rows are not sent again. */
  private shownRows: string[] = [];
  private readonly now: () => number;

  constructor(output: TerminalStream, options: EffectOptions, { ambient = false, now = () => performance.now() } = {}) {
    this.now = now;
    this.output = output;
    this.options = options;
    const columns = output.columns ?? 80, rows = output.rows ?? 24;
    if (ambient) {
      this.mood = new AmbientMood(this.now());
      this.band = bandRows(columns, rows);
      this.mood.resize(columns);
      this.ticker = setInterval(() => this.renderBand(), BAND_FRAME);
      this.ticker.unref?.();
    }
    this.terminal = new xterm.Terminal({
      cols: columns, rows: Math.max(1, rows - this.band),
      scrollback: 1000, allowProposedApi: true,
    });
    this.terminal.onWriteParsed(() => this.schedule());
    for (const final of ['h', 'l']) {
      this.terminal.parser.registerCsiHandler({ prefix: '?', final }, (params) => {
        if (params.includes(25)) this.cursorVisible = final === 'h';
        return false;
      });
    }
  }

  write(data: string): Promise<void> {
    if (data) this.lastOutput = this.now();
    return new Promise((resolve) => this.terminal.write(data, resolve));
  }

  /** User keystrokes: their echo is not the AI working. */
  noteInput(): void {
    this.lastInput = this.now();
  }

  resize(columns: number, rows: number): void {
    if (this.mood) { this.band = bandRows(columns, rows); this.mood.resize(columns); }
    this.terminal.resize(Math.max(1, columns), Math.max(1, rows - this.band));
    this.shownBand = [];
    this.shownRows = [];
    this.schedule();
  }

  /**
   * Scrolls the AI's history, kept by the virtual screen: the physical one is
   * an alternate screen without scrollback. Negative values go back in time.
   */
  /** A click on the band, at cell (`column`, `row`) counted from its top left: the penguin answers. */
  click(column: number, row: number): void {
    const hit = bandHit(this.terminal.cols, column, row, this.penguinAway);
    if (!this.mood || !this.band || !hit) return;
    this.mood.poke(hit.target, this.now(), { x: hit.x, y: hit.y });
    this.renderBand();
  }

  scroll(lines: number): void {
    if (lines) this.terminal.scrollLines(lines);
    else this.terminal.scrollToBottom();
    this.schedule();
  }

  /** Whether the AI's history is scrolled back from the live screen. */
  get scrolledBack(): boolean {
    const buffer = this.terminal.buffer.active;
    return buffer.viewportY < buffer.baseY;
  }

  private schedule(): void {
    if (this.closed || this.animating || this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; this.render(); }, 33);
  }

  render(): void {
    if (this.closed || this.animating) return;
    const terminal = this.terminal;
    const buffer = terminal.buffer.active;
    // Repaint the viewport only. Never relay the child's escape sequences to
    // the physical terminal: alternate buffers, queries and cursor movements
    // belong to the virtual screen, not to the animation or the parent shell.
    let frame = '\x1b[?2026h\x1b[?25l\x1b[0m\x1b[H';
    for (let y = 0; y < terminal.rows; y++) {
      const line = buffer.getLine(buffer.viewportY + y);
      let row = '', previous = '';
      for (let x = 0; x < terminal.cols; x++) {
        const cell = line?.getCell(x);
        if (!cell || cell.getWidth() === 0) continue;
        const codes = [0];
        if (cell.isBold()) codes.push(1);
        if (cell.isDim()) codes.push(2);
        if (cell.isItalic()) codes.push(3);
        if (cell.isUnderline()) codes.push(4);
        if (cell.isInverse()) codes.push(7);
        if (cell.isInvisible()) codes.push(8);
        if (cell.isStrikethrough()) codes.push(9);
        for (const fg of [true, false]) {
          const color = fg ? cell.getFgColor() : cell.getBgColor();
          if (fg ? cell.isFgRGB() : cell.isBgRGB())
            codes.push(fg ? 38 : 48, 2, color >> 16 & 255, color >> 8 & 255, color & 255);
          else if (fg ? cell.isFgPalette() : cell.isBgPalette()) codes.push(fg ? 38 : 48, 5, color);
        }
        const style = `\x1b[${codes.join(';')}m`;
        if (style !== previous) { row += style; previous = style; }
        row += cell.getChars() || ' ';
      }
      // Only the rows that changed: a spinner should not resend the whole screen.
      if (row !== this.shownRows[y]) frame += `\x1b[${y + 1};1H\x1b[0m\x1b[2K${row}`;
      this.shownRows[y] = row;
    }
    this.shownRows.length = terminal.rows;
    frame += this.bandFrame();
    frame += this.cursorFrame();
    this.output.write(frame);
  }

  /** Repaints the band only, between two AI frames. */
  renderBand(): void {
    if (this.closed || this.animating || !this.band) return;
    const band = this.bandFrame();
    if (band) this.output.write(`\x1b[?2026h\x1b[?25l${band}${this.cursorFrame()}`);
  }

  private bandFrame(): string {
    if (!this.mood || !this.band) return '';
    // The busy marker sits just above the AI's prompt: only the bottom rows
    // count, so a conversation quoting it does not keep the penguin at work.
    // AIs animate a spinner beside it, so a marker without output is stale.
    const buffer = this.terminal.buffer.active;
    let screen = '';
    for (let y = Math.max(0, this.terminal.rows - BUSY_ROWS); y < this.terminal.rows; y++)
      screen += `${buffer.getLine(buffer.baseY + y)?.translateToString(true) ?? ''}\n`;
    const now = this.now();
    const fresh = now - this.lastOutput;
    const signals = readSignals(screen, fresh < 2000);
    signals.busy ||= fresh < 1000 && now - this.lastInput > 1500;
    const typed = this.lastInput > this.lastTick;
    this.lastTick = now;
    const view = this.mood.update(now, { ...signals, typed });
    this.penguinAway = penguinFrame(view).dx;
    const cells = bandCells(view, this.terminal.cols);
    // Only the cells that changed since the last paint: snow and stars move a
    // few pixels at a time, and every byte goes through the terminal.
    let frame = '';
    cells.forEach((line, i) => {
      const before = this.shownBand[i];
      const same = (x: number) => before?.[x]?.style === line[x]!.style && before[x]!.char === line[x]!.char;
      for (let x = 0; x < line.length;) {
        if (same(x)) { x++; continue; }
        let end = x + 1;
        for (let gap = 0; end < line.length && gap <= GAP; end++) gap = same(end) ? gap + 1 : 0;
        while (end > x + 1 && same(end - 1)) end--;
        frame += `\x1b[${this.terminal.rows + i + 1};${x + 1}H${paintCells(line.slice(x, end))}`;
        x = end;
      }
    });
    this.shownBand = cells;
    return frame;
  }

  private cursorFrame(): string {
    const buffer = this.terminal.buffer.active;
    const modes = this.terminal.modes;
    let frame = `\x1b[0m\x1b[${buffer.cursorY + 1};${buffer.cursorX + 1}H`;
    frame += `\x1b[?1${modes.applicationCursorKeysMode ? 'h' : 'l'}`;
    frame += `\x1b[?2004${modes.bracketedPasteMode ? 'h' : 'l'}`;
    // Back in the history, the AI's cursor is somewhere below the view.
    frame += `\x1b[?25${this.cursorVisible && !this.scrolledBack ? 'h' : 'l'}\x1b[?2026l`;
    return frame;
  }

  react(event: ReactionEvent): Promise<void> {
    if (this.mood && this.band) return this.reactInBand(event);
    const task = this.pending.then(async () => {
      if (this.closed) return;
      this.animating = true;
      if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
      this.output.write('\x1b[?2026l\x1b[0m\x1b[?25l\x1b[2J\x1b[H');
      try {
        const output = this.output;
        await playTerminalEffect(event, this.options, {
          isTTY: true,
          get columns() { return output.columns ?? 80; },
          get rows() { return output.rows ?? 24; },
          write: (text) => output.write(text.replaceAll('\n', '\r\n')),
        });
      } finally {
        // The latest AI output is already in the virtual screen, including
        // anything emitted during playback. No process is paused or signaled.
        await this.write('');
        this.animating = false;
        this.shownBand = [];
        this.shownRows = [];
        this.render();
      }
    });
    this.pending = task.catch(() => {});
    return task;
  }

  /** The reaction plays in the band: the AI stays on screen, untouched. */
  private async reactInBand(event: ReactionEvent): Promise<void> {
    if (this.closed || this.options.mode === 'text') return;
    const duration = this.mood!.play(event.reaction, event.intensity, this.now());
    this.renderBand();
    if (!this.options.sound) return;
    const audio = startSound(event, this.options.volume);
    await audio.ready;
    await Promise.all([new Promise((resolve) => setTimeout(resolve, duration).unref?.()), audio.finished]);
  }

  async dispose(): Promise<void> {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.ticker) clearInterval(this.ticker);
    await this.pending;
    this.terminal.dispose();
  }
}
