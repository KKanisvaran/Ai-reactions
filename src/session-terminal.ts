import xterm from '@xterm/headless';
import { AmbientMood, bandCells, bandHit, bandRows, paintCells, penguinFrame, readSignals } from './ambient.ts';
import type { BandCell } from './ambient.ts';
import { FRAME_MS, startFrames } from './frame-clock.ts';

/** The launcher's own terminal: its size, and whether it is still busy with what was sent. */
export interface TerminalStream {
  columns?: number;
  rows?: number;
  writableNeedDrain?: boolean;
  write(text: string): unknown;
}

const BUSY_ROWS = 15;
/** Unchanged cells between two changes are rewritten when cheaper than moving the cursor. */
const GAP = 6;

const cellFlags = (cell: xterm.IBufferCell) => (cell.isBold() ? 1 : 0) | (cell.isDim() ? 2 : 0) | (cell.isItalic() ? 4 : 0)
  | (cell.isUnderline() ? 8 : 0) | (cell.isInverse() ? 16 : 0) | (cell.isInvisible() ? 32 : 0) | (cell.isStrikethrough() ? 64 : 0);

/** A cell's full SGR style, from a reset. */
function cellStyle(cell: xterm.IBufferCell): string {
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
  return `\x1b[${codes.join(';')}m`;
}

// The outer terminal belongs to this launcher. The AI has a separate PTY and
// updates this bounded virtual screen; the penguin lives in the rows below it.
export class SessionTerminal {
  readonly terminal: xterm.Terminal;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly output: TerminalStream;
  private cursorVisible = true;
  // Ambient band below the AI: the penguin, fed by what the AI's screen shows.
  private readonly mood: AmbientMood | undefined;
  private band = 0;
  /** Stops the band's frames: 60 a second, only the changed cells sent. */
  private stopFrames: (() => void) | undefined;
  /** The AI wrote since the last frame: with the band, its screen is repainted on the band's frames. */
  private dirty = false;
  private lastOutput = -Infinity;
  private lastInput = -Infinity;
  private lastTick = -Infinity;
  private shownBand: BandCell[][] = [];
  /** How far the penguin is from its place, so a click finds it out at sea. */
  private penguinAway = 0;
  /** Read again for every cell of the AI's screen, sixty times a second. */
  private cell: xterm.IBufferCell | undefined;
  /** The AI rows as last painted, so unchanged rows are not sent again. */
  private shownRows: string[] = [];
  private readonly now: () => number;

  constructor(output: TerminalStream, { ambient = false, now = () => performance.now() } = {}) {
    this.now = now;
    this.output = output;
    const columns = output.columns ?? 80, rows = output.rows ?? 24;
    if (ambient) {
      this.mood = new AmbientMood(this.now());
      this.band = bandRows(columns, rows);
      this.mood.resize(columns);
      this.stopFrames = startFrames(() => this.frame());
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

  /** A click on the band, at cell (`column`, `row`) counted from its top left: the penguin answers. */
  click(column: number, row: number): void {
    const hit = bandHit(this.terminal.cols, column, row, this.penguinAway);
    if (!this.mood || !this.band || !hit) return;
    this.mood.poke(hit.target, this.now(), { x: hit.x, y: hit.y });
    this.renderBand();
  }

  /**
   * Scrolls the AI's history, kept by the virtual screen: the physical one is
   * an alternate screen without scrollback. Negative values go back in time.
   */
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
    if (this.closed) return;
    // The AI and the penguin share one frame: one write, one terminal refresh.
    if (this.stopFrames) { this.dirty = true; return; }
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; this.render(); }, FRAME_MS);
  }

  private frame(): void {
    // A terminal still busy with the last frame skips this one rather than fall behind.
    if (this.output.writableNeedDrain) return;
    if (this.dirty) this.render();
    else this.renderBand();
  }

  render(): void {
    if (this.closed) return;
    this.dirty = false;
    const terminal = this.terminal;
    const buffer = terminal.buffer.active;
    // Repaint the viewport only. Never relay the child's escape sequences to
    // the physical terminal: alternate buffers, queries and cursor movements
    // belong to the virtual screen, not to the animation or the parent shell.
    let frame = '\x1b[?2026h\x1b[?25l\x1b[0m\x1b[H';
    for (let y = 0; y < terminal.rows; y++) {
      const line = buffer.getLine(buffer.viewportY + y);
      let row = '', previous = '';
      let flags = -1, fgMode = -1, fg = -1, bgMode = -1, bg = -1;
      for (let x = 0; x < terminal.cols; x++) {
        const cell = line?.getCell(x, this.cell ??= buffer.getNullCell());
        if (!cell || cell.getWidth() === 0) continue;
        // Most cells share their neighbor's colors: the style is only rebuilt when they change.
        if (cellFlags(cell) !== flags || cell.getFgColorMode() !== fgMode || cell.getFgColor() !== fg
          || cell.getBgColorMode() !== bgMode || cell.getBgColor() !== bg) {
          [flags, fgMode, fg, bgMode, bg] = [cellFlags(cell), cell.getFgColorMode(), cell.getFgColor(), cell.getBgColorMode(), cell.getBgColor()];
          const style = cellStyle(cell);
          if (style !== previous) { row += style; previous = style; }
        }
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
    if (this.closed || !this.band) return;
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

  async dispose(): Promise<void> {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.stopFrames?.();
    this.terminal.dispose();
  }
}
