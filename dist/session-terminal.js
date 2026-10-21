import xterm from '@xterm/headless';
import { AmbientMood, ambientBand, bandRows, looksBusy } from "./ambient.js";
import { playTerminalEffect } from "./terminal-output.js";
const BUSY_ROWS = 15;
// The outer terminal belongs to this launcher. The AI has a separate PTY and
// continues updating this bounded virtual screen while an animation is shown.
export class SessionTerminal {
    terminal;
    animating = false;
    closed = false;
    timer;
    pending = Promise.resolve();
    output;
    options;
    cursorVisible = true;
    // Ambient band below the AI: the tiger, fed by what the AI's screen shows.
    mood;
    band = 0;
    ticker;
    lastOutput = -Infinity;
    lastInput = -Infinity;
    shownBand = '';
    constructor(output, options, { ambient = false } = {}) {
        this.output = output;
        this.options = options;
        const columns = output.columns ?? 80, rows = output.rows ?? 24;
        if (ambient) {
            this.mood = new AmbientMood(performance.now());
            this.band = bandRows(columns, rows);
            this.ticker = setInterval(() => this.renderBand(), 150);
            this.ticker.unref?.();
        }
        this.terminal = new xterm.Terminal({
            cols: columns, rows: Math.max(1, rows - this.band),
            scrollback: 1000, allowProposedApi: true,
        });
        this.terminal.onWriteParsed(() => this.schedule());
        for (const final of ['h', 'l']) {
            this.terminal.parser.registerCsiHandler({ prefix: '?', final }, (params) => {
                if (params.includes(25))
                    this.cursorVisible = final === 'h';
                return false;
            });
        }
    }
    write(data) {
        if (data)
            this.lastOutput = performance.now();
        return new Promise((resolve) => this.terminal.write(data, resolve));
    }
    /** User keystrokes: their echo is not the AI working. */
    noteInput() {
        this.lastInput = performance.now();
    }
    resize(columns, rows) {
        if (this.mood)
            this.band = bandRows(columns, rows);
        this.terminal.resize(Math.max(1, columns), Math.max(1, rows - this.band));
        this.schedule();
    }
    schedule() {
        if (this.closed || this.animating || this.timer)
            return;
        this.timer = setTimeout(() => { this.timer = undefined; this.render(); }, 33);
    }
    render() {
        if (this.closed || this.animating)
            return;
        const terminal = this.terminal;
        const buffer = terminal.buffer.active;
        // Repaint the viewport only. Never relay the child's escape sequences to
        // the physical terminal: alternate buffers, queries and cursor movements
        // belong to the virtual screen, not to the animation or the parent shell.
        let frame = '\x1b[?2026h\x1b[?25l\x1b[0m\x1b[H';
        for (let y = 0; y < terminal.rows; y++) {
            frame += `\x1b[${y + 1};1H\x1b[0m\x1b[2K`;
            const line = buffer.getLine(buffer.viewportY + y);
            let previous = '';
            for (let x = 0; x < terminal.cols; x++) {
                const cell = line?.getCell(x);
                if (!cell || cell.getWidth() === 0)
                    continue;
                const codes = [0];
                if (cell.isBold())
                    codes.push(1);
                if (cell.isDim())
                    codes.push(2);
                if (cell.isItalic())
                    codes.push(3);
                if (cell.isUnderline())
                    codes.push(4);
                if (cell.isInverse())
                    codes.push(7);
                if (cell.isInvisible())
                    codes.push(8);
                if (cell.isStrikethrough())
                    codes.push(9);
                for (const fg of [true, false]) {
                    const color = fg ? cell.getFgColor() : cell.getBgColor();
                    if (fg ? cell.isFgRGB() : cell.isBgRGB())
                        codes.push(fg ? 38 : 48, 2, color >> 16 & 255, color >> 8 & 255, color & 255);
                    else if (fg ? cell.isFgPalette() : cell.isBgPalette())
                        codes.push(fg ? 38 : 48, 5, color);
                }
                const style = `\x1b[${codes.join(';')}m`;
                if (style !== previous) {
                    frame += style;
                    previous = style;
                }
                frame += cell.getChars() || ' ';
            }
        }
        frame += this.bandFrame();
        frame += this.cursorFrame();
        this.output.write(frame);
    }
    /** Repaints the band only, between two AI frames. */
    renderBand() {
        if (this.closed || this.animating || !this.band)
            return;
        const shown = this.shownBand, band = this.bandFrame();
        if (band !== shown)
            this.output.write(`\x1b[?2026h\x1b[?25l${band}${this.cursorFrame()}`);
    }
    bandFrame() {
        if (!this.mood || !this.band)
            return '';
        // The busy marker sits just above the AI's prompt: only the bottom rows
        // count, so a conversation quoting it does not keep the tiger at work.
        // AIs animate a spinner beside it, so a marker without output is stale.
        const buffer = this.terminal.buffer.active;
        let screen = '';
        for (let y = Math.max(0, this.terminal.rows - BUSY_ROWS); y < this.terminal.rows; y++)
            screen += `${buffer.getLine(buffer.viewportY + y)?.translateToString(true) ?? ''}\n`;
        const now = performance.now();
        const fresh = now - this.lastOutput;
        const busy = (fresh < 2000 && looksBusy(screen)) || (fresh < 1000 && now - this.lastInput > 1500);
        const lines = ambientBand(this.mood.update(now, busy), this.terminal.cols);
        this.shownBand = lines.map((line, i) => `\x1b[${this.terminal.rows + i + 1};1H\x1b[0m\x1b[2K${line}`).join('');
        return this.shownBand;
    }
    cursorFrame() {
        const buffer = this.terminal.buffer.active;
        const modes = this.terminal.modes;
        let frame = `\x1b[0m\x1b[${buffer.cursorY + 1};${buffer.cursorX + 1}H`;
        frame += `\x1b[?1${modes.applicationCursorKeysMode ? 'h' : 'l'}`;
        frame += `\x1b[?2004${modes.bracketedPasteMode ? 'h' : 'l'}`;
        frame += `\x1b[?25${this.cursorVisible ? 'h' : 'l'}\x1b[?2026l`;
        return frame;
    }
    react(event) {
        const task = this.pending.then(async () => {
            if (this.closed)
                return;
            this.animating = true;
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = undefined;
            }
            this.output.write('\x1b[?2026l\x1b[0m\x1b[?25l\x1b[2J\x1b[H');
            try {
                const output = this.output;
                await playTerminalEffect(event, this.options, {
                    isTTY: true,
                    get columns() { return output.columns ?? 80; },
                    get rows() { return output.rows ?? 24; },
                    write: (text) => output.write(text.replaceAll('\n', '\r\n')),
                });
            }
            finally {
                // The latest AI output is already in the virtual screen, including
                // anything emitted during playback. No process is paused or signaled.
                await this.write('');
                this.animating = false;
                this.render();
            }
        });
        this.pending = task.catch(() => { });
        return task;
    }
    async dispose() {
        this.closed = true;
        if (this.timer)
            clearTimeout(this.timer);
        if (this.ticker)
            clearInterval(this.ticker);
        await this.pending;
        this.terminal.dispose();
    }
}
