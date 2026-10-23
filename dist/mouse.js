// The launcher turns on SGR mouse reports (CSI < button ; column ; row M|m) so
// the wheel scrolls the AI's history and a click reaches the penguin. This
// separates those reports from the keys meant for the AI.
/** Turns mouse reports on in the physical terminal, and off again. */
export const MOUSE_ON = '\x1b[?1000h\x1b[?1006h';
export const MOUSE_OFF = '\x1b[?1006l\x1b[?1000l';
const report = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
// A report cut at the end of a chunk: kept for the next one.
const partial = /\x1b(\[(<[\d;]*)?)?$/;
/** A press of the left button, whatever Shift, Alt or Ctrl add. */
export const leftClick = (report) => report.press && (report.button & ~(4 | 8 | 16)) === 0;
export class InputReader {
    rest = '';
    read(chunk) {
        let data = this.rest + chunk;
        const cut = data.match(partial);
        // A lone Escape key is not held back: only an unfinished report is.
        this.rest = cut && cut[0].length > 1 ? cut[0] : '';
        if (this.rest)
            data = data.slice(0, -this.rest.length);
        const reports = [];
        let wheel = 0;
        const keys = data.replace(report, (raw, button, column, row, final) => {
            const code = Number(button);
            // 64 and 65 are the wheel; 4, 8 and 16 add Shift, Alt and Ctrl.
            const base = code & ~(4 | 8 | 16);
            if (base === 64)
                wheel--;
            else if (base === 65)
                wheel++;
            reports.push({ raw, button: code, column: Number(column), row: Number(row), press: final === 'M' });
            return '';
        });
        return { keys, wheel, reports };
    }
}
