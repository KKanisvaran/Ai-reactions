// Ambient band: a small KK LAB tiger lives below the AI and reacts to what it
// is doing, without keywords. Everything here is pure and driven by the clock
// the caller passes in; the AI's screen is only read in memory, never logged.

export const BAND_ROWS = 4;
export type Scene = 'idle' | 'working' | 'long' | 'done' | 'quiet';
export type Visitor = 'butterfly' | 'mouse' | 'star';

export interface AmbientView {
  scene: Scene;
  /** Seconds since the scene started. */
  seconds: number;
  /** Seconds since the band started, for blinks and small loops. */
  clock: number;
  /** Seconds of AI work: live while working, final once done. */
  work: number;
  visitor?: Visitor;
  /** Seconds since the visitor appeared. */
  visit: number;
}

const START_WORK = 1500;
const STOP_WORK = 3000;
const LONG_WORK = 60_000;
const DONE_AFTER = 15_000;
const DONE_FOR = 6000;
const QUIET_AFTER = 300_000;
const VISIT_FOR = 9000;
const visitors: Visitor[] = ['butterfly', 'mouse', 'star'];

// Codex and Claude Code show "esc to interrupt" while working, Gemini CLI "esc to cancel".
const busyMarker = /\besc to (interrupt|cancel)\b/i;
export function looksBusy(screen: string): boolean {
  return busyMarker.test(screen);
}

export function ambientEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.AI_REACTIONS_AMBIENT ?? '1';
  if (value !== '0' && value !== '1') throw new Error('AI_REACTIONS_AMBIENT : 0 ou 1 attendu.');
  return value === '1';
}

/** Rows reserved for the band, or 0 when the terminal is too small to spare them. */
export function bandRows(columns: number, rows: number): number {
  return columns >= 40 && rows >= 20 ? BAND_ROWS : 0;
}

/** Turns "is the AI busy right now?" samples into calm, readable scenes. */
export class AmbientMood {
  private scene: Scene = 'idle';
  private since: number;
  private readonly start: number;
  private busySince: number | undefined;
  private calmSince: number | undefined;
  private workStart = 0;
  private work = 0;
  private visitor: Visitor | undefined;
  private visitStart = 0;
  private nextVisit: number;
  private seed: number;

  constructor(now: number, seed = Math.floor(Math.random() * 0xffffffff)) {
    this.start = this.since = now;
    this.calmSince = now;
    this.seed = seed >>> 0;
    this.nextVisit = now + 20_000 + this.random() * 30_000;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  private enter(scene: Scene, now: number): void {
    this.scene = scene;
    this.since = now;
  }

  update(now: number, busy: boolean): AmbientView {
    if (busy) { this.calmSince = undefined; this.busySince ??= now; }
    else { this.busySince = undefined; this.calmSince ??= now; }
    const working = this.scene === 'working' || this.scene === 'long';
    if (!working && this.busySince !== undefined && now - this.busySince >= START_WORK) {
      this.workStart = this.busySince;
      this.enter('working', now);
    } else if (working && this.calmSince !== undefined && now - this.calmSince >= STOP_WORK) {
      this.work = this.calmSince - this.workStart;
      this.enter(this.work >= DONE_AFTER ? 'done' : 'idle', now);
    } else if (this.scene === 'working' && now - this.workStart >= LONG_WORK) {
      this.enter('long', now);
    } else if (this.scene === 'done' && now - this.since >= DONE_FOR) {
      this.enter('idle', now);
    } else if (this.scene === 'idle' && this.calmSince !== undefined && now - this.calmSince >= QUIET_AFTER) {
      this.enter('quiet', now);
    }

    if (this.scene !== 'idle') {
      if (this.visitor) this.nextVisit = now + 40_000 + this.random() * 50_000;
      this.visitor = undefined;
    } else if (this.visitor && now - this.visitStart >= VISIT_FOR) {
      this.visitor = undefined;
      this.nextVisit = now + 40_000 + this.random() * 50_000;
    } else if (!this.visitor && now >= this.nextVisit) {
      this.visitor = visitors[Math.floor(this.random() * visitors.length)];
      this.visitStart = now;
    }

    const live = this.scene === 'working' || this.scene === 'long';
    const view: AmbientView = {
      scene: this.scene,
      seconds: (now - this.since) / 1000,
      clock: (now - this.start) / 1000,
      work: (live ? now - this.workStart : this.work) / 1000,
      visit: this.visitor ? (now - this.visitStart) / 1000 : 0,
    };
    if (this.visitor) view.visitor = this.visitor;
    return view;
  }
}

const RESET = '\x1b[0m';
const color = { line: '38;2;90;100;125', label: '38;2;150;160;180', fur: '38;2;240;227;205',
  stripe: '38;2;85;122;178', amber: '1;38;2;232;170;72', visitor: '38;2;140;165;200' };
type Color = keyof typeof color;

function duration(seconds: number): string {
  const s = Math.floor(seconds);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
}

function status(view: AmbientView): string {
  switch (view.scene) {
    case 'working': return `l'IA bosse · ${duration(view.work)}`;
    case 'long': return `ça prend du temps · ${duration(view.work)}`;
    case 'done': return `terminé en ${duration(view.work)}`;
    case 'quiet': return 'pause chill';
    default: return 'au repos';
  }
}

/** The band, top separator first: `columns` visible cells per line. */
export function ambientBand(view: AmbientView, columns: number): string[] {
  const width = Math.max(1, columns);
  const grid = Array.from({ length: BAND_ROWS }, () => Array.from({ length: width }, () => ({ char: ' ', color: 'line' as Color })));
  function put(x: number, y: number, text: string, tint: Color) {
    for (const [i, char] of [...text].entries()) {
      const cell = grid[y]?.[x + i];
      if (cell) { cell.char = char; cell.color = tint; }
    }
  }

  const label = ` KK LAB · ${status(view)} `;
  put(0, 0, '─'.repeat(width), 'line');
  put(Math.max(0, width - [...label].length - 2), 0, label, 'label');

  // The tiger: ears, striped face, paws. Its face carries the mood.
  const x = 2;
  const blink = view.clock % 4 < 0.15;
  const near = view.visitor && view.visit > 5;
  let face = blink ? '-.-' : near ? 'O.O' : 'o.o';
  if (view.scene === 'working') face = blink ? '-_-' : 'o_o';
  if (view.scene === 'long') face = 'u.u';
  if (view.scene === 'done') face = '^.^';
  if (view.scene === 'quiet') face = '-.-';
  put(x, 1, view.scene === 'done' ? '\\/\\_/\\/' : ' /\\_/\\', 'fur');
  put(x, 2, '(', 'fur'); put(x + 1, 2, '=', 'stripe'); put(x + 2, 2, face, 'fur');
  put(x + 5, 2, '=', 'stripe'); put(x + 6, 2, ')', 'fur');
  const tap = view.scene === 'working' && Math.floor(view.clock * 6) % 2;
  put(x, 3, tap ? ' (")_")' : ' (")(")', 'fur');
  put(x + 7, 3, Math.floor(view.clock / 0.7) % 2 ? '~' : '-', 'stripe');

  const right = width - 1;
  if (view.scene === 'working' || view.scene === 'long') {
    // Code flowing out of the keyboard.
    const glyphs = '{};()</>=[]';
    for (let i = 0; i < 6; i++) {
      const travel = Math.max(1, right - 14);
      const px = 12 + Math.floor(view.clock * 8 + i * travel / 6) % travel;
      put(px, 1 + i % 3, glyphs[(i * 7 + Math.floor(view.clock * 2)) % glyphs.length]!, 'visitor');
    }
  }
  if (view.scene === 'long') {
    put(x + 9, 1 + Math.floor(view.clock * 1.5) % 2, Math.floor(view.clock) % 2 ? 'z Z' : 'Z z', 'label');
  }
  if (view.scene === 'done') {
    const twinkle = Math.floor(view.clock * 4) % 2;
    put(x + 10, 1, twinkle ? '*  .  *' : '.  *  .', 'amber');
    put(x + 10, 2, 'GG ! c’est fini', 'amber');
    put(x + 10, 3, twinkle ? '.  *  .' : '*  .  *', 'amber');
  }
  if (view.scene === 'quiet') {
    put(x + 10, 1 + Math.floor(view.clock) % 2, '♪', 'visitor');
    put(x + 14, 2 - Math.floor(view.clock) % 2, '♫', 'visitor');
    put(x + 10, 3, 'z z z', 'label');
  }
  if (view.visitor) {
    // Visitors cross from the right edge towards the tiger in VISIT_FOR seconds.
    const progress = Math.min(1, view.visit / (VISIT_FOR / 1000));
    const vx = Math.round(right - progress * Math.max(0, right - 12));
    if (view.visitor === 'butterfly') put(vx, 1 + Math.floor(view.clock * 3) % 2, Math.floor(view.clock * 5) % 2 ? 'ƸӜƷ' : '>Ӝ<', 'visitor');
    else if (view.visitor === 'mouse') put(vx, 3, '<:3 )~', 'visitor');
    else put(vx, 1, '*~~', 'amber');
  }

  return grid.map((line) => {
    let out = '', previous: Color | undefined;
    for (const cell of line) {
      if (cell.color !== previous) { out += `${RESET}\x1b[${color[cell.color]}m`; previous = cell.color; }
      out += cell.char;
    }
    return out + RESET;
  });
}
