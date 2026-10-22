// Ambient band: the penguin lives below the AI and reacts on its own to what
// the AI is doing. MCP reactions play here too, never over the AI.
// Everything here is pure and driven by the clock the caller passes in; the
// AI's screen is only read in memory, never logged.
import { SWIM_ROOM, activityFrame, activityLength, answer, drawActivity, homeward, idleActivities, underWater } from './companion.ts';
import type { Activity, Doing, Frame, Target } from './companion.ts';
import { DECOR_HEIGHT, HORIZON, SNOWMAN_WIDTH, backdrop, decorPixels } from './decor.ts';
import type { DecorVisitor } from './decor.ts';
import { PENGUIN_HEIGHT, PENGUIN_WIDTH, penguinPalette, penguinPoses } from './penguin.ts';
import type { Pose } from './penguin.ts';
import { reactionDefinitions } from './reactions.ts';
import type { ReactionName } from './reactions.ts';
import { drawAsk, drawScene, drawSleep } from './scenes.ts';
import type { Stage } from './scenes.ts';

/**
 * The band's height: the penguin's 20 pixel rows, two per line. It never
 * changes: like a picture on a web page, the penguin keeps its size and only
 * the decor around it follows the terminal's width.
 */
export const BAND_ROWS = DECOR_HEIGHT / 2;
export type Scene = 'idle' | 'working' | 'quiet';
export type Visitor = DecorVisitor;

/** What the AI's screen shows right now. */
export interface Signals {
  busy: boolean;
  /** A permission or confirmation prompt waits for the user. */
  asking?: boolean;
  interrupted?: boolean;
  failed?: boolean;
  /** The user just typed something. */
  typed?: boolean;
}

export interface Played {
  name: ReactionName;
  intensity: number;
  /** Seconds since the reaction started. */
  seconds: number;
}

export interface AmbientView {
  scene: Scene;
  /** Seconds since the scene started. */
  seconds: number;
  /** Seconds since the band started, for blinks and small loops. */
  clock: number;
  /** Seconds of AI work: live while working, final once done. */
  work: number;
  /** 0 → 1 while the penguin draws itself at startup. */
  drawn: number;
  asking?: boolean;
  /** Set for a few seconds after a long piece of work. */
  finished?: boolean;
  reaction?: Played;
  visitor?: Visitor;
  /** Seconds since the visitor appeared. */
  visit: number;
  /** Something the penguin does by itself, or in answer to a click. */
  doing?: Doing;
}

const START_WORK = 1500;
const STOP_WORK = 3000;
const DONE_AFTER = 15_000;
const FINISHED_FOR = 8000;
const COFFEE_AT = 45_000;
const SLOW_AT = 150_000;
const QUIET_AFTER = 300_000;
/** Seconds of fishing in a long pause, before the penguin falls asleep. */
const FISHING_FOR = 120;
const VISIT_FOR = 9000;
const DRAW_FOR = 2400;
const COOLDOWN = 20_000;
/** Clicks closer than this count as one petting session. */
const PETTING = 3000;
const visitors: Visitor[] = ['bird', 'fish', 'star'];

export function reactionDuration(intensity: number): number {
  return 4000 + 1500 * (Math.min(3, Math.max(1, intensity)) - 1);
}

// Codex and Claude Code show "esc to interrupt" while working, Gemini CLI "esc to cancel".
const busyMarker = /\besc to (interrupt|cancel)\b/i;
const askingMarker = /\b(do you want to (proceed|make this edit|create|run|allow)|would you like to (run|make|apply)|allow (this )?(command|execution|edit)|apply this change)\b/i;
const interruptedMarker = /\b(interrupted by user|conversation interrupted|request cancelled|operation cancelled)\b/i;
const failedMarker = /\b(api error|stream error|quota exceeded|rate limit(ed)? exceeded)\b/i;

export function looksBusy(screen: string): boolean {
  return busyMarker.test(screen);
}

/** Reads the bottom of the AI's screen; `fresh` says whether it wrote recently. */
export function readSignals(screen: string, fresh: boolean): Omit<Signals, 'typed'> {
  return {
    busy: fresh && busyMarker.test(screen),
    asking: askingMarker.test(screen),
    interrupted: interruptedMarker.test(screen),
    failed: failedMarker.test(screen),
  };
}

export function ambientEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.AI_REACTIONS_AMBIENT ?? '1';
  if (value !== '0' && value !== '1') throw new Error('AI_REACTIONS_AMBIENT : 0 ou 1 attendu.');
  return value === '1';
}

/** Rows reserved for the band, or 0 when the terminal is too small to spare them. */
export function bandRows(columns: number, rows: number): number {
  // The AI keeps at least 8 lines.
  return columns >= 40 && rows >= BAND_ROWS + 8 ? BAND_ROWS : 0;
}

/** Turns screen samples into calm scenes and the reactions that fit them. */
export class AmbientMood {
  private scene: Scene = 'idle';
  private since: number;
  private readonly start: number;
  private busySince: number | undefined;
  private calmSince: number | undefined;
  private lastActive: number;
  private workStart = 0;
  private work = 0;
  private finishedAt = -Infinity;
  private coffee = false;
  private slow = false;
  private cut = false;
  private flags = { asking: false, interrupted: false, failed: false };
  private reaction: { name: ReactionName; intensity: number; start: number; end: number; manual: boolean } | undefined;
  private readonly lastAuto = new Map<ReactionName, number>();
  private visitor: Visitor | undefined;
  private visitStart = 0;
  private nextVisit: number;
  private activity: { name: Activity; start: number; end: number; user: boolean; x?: number; y?: number; petted?: number } | undefined;
  private lastActivity: Activity | undefined;
  private nextActivity: number;
  private clicks: number[] = [];
  private seed: number;
  /** The band's width in cells: a swim needs open sea beyond the floe. */
  private columns = Infinity;

  constructor(now: number, seed = Math.floor(Math.random() * 0xffffffff)) {
    this.start = this.since = this.lastActive = now;
    this.calmSince = now;
    this.seed = seed >>> 0;
    this.nextVisit = now + 8000 + this.random() * 12_000;
    this.nextActivity = now + 5000 + this.random() * 4000;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  /** The band's width, in cells. */
  resize(columns: number): void {
    this.columns = columns;
  }

  private enter(scene: Scene, now: number): void {
    this.scene = scene;
    this.since = now;
    // What it was doing by itself belongs to the scene it leaves.
    if (this.activity && !this.activity.user && !this.hurryHome(now)) this.activity = undefined;
  }

  /** Away from its place, it comes back the way it went instead of vanishing there. */
  private hurryHome(now: number): boolean {
    const activity = this.activity, turn = activity && homeward[activity.name];
    if (!activity || turn === undefined) return false;
    const skip = Math.max(0, turn * 1000 - (now - activity.start));
    activity.start -= skip;
    activity.end -= skip;
    return true;
  }

  private begin(name: Activity, now: number, user = false, at?: { x: number; y: number }): void {
    this.activity = { name, start: now, end: now + activityLength[name] * 1000, user, ...at };
    this.lastActivity = name;
  }

  /** A click in the band: the penguin answers, a little happier at each click in a row. */
  poke(target: Target, now: number, at?: { x: number; y: number }): void {
    this.clicks = [...this.clicks.filter((time) => now - time < PETTING), now];
    this.lastActive = now;
    // Out at sea in its ring, a click pets it where it floats.
    if (this.activity?.name === 'swim' && (target === 'penguin' || target === 'sea')) {
      this.activity.petted = now;
      return;
    }
    if (this.scene === 'quiet') {
      // Woken up gently: it says hello.
      this.enter('idle', now);
      this.begin('wave', now, true);
      return;
    }
    this.begin(answer(target, target === 'penguin' ? this.clicks.length : 1), now, true, at);
  }

  /** An MCP reaction: it replaces whatever plays and returns its duration in ms. */
  play(name: ReactionName, intensity: number, now: number): number {
    const duration = reactionDuration(intensity);
    this.reaction = { name, intensity, start: now, end: now + duration, manual: true };
    if (!this.activity?.user) this.hurryHome(now);
    return duration;
  }

  /** The penguin's own reactions never cut an MCP one, nor repeat too often. */
  private auto(name: ReactionName, intensity: number, now: number): void {
    if (!this.activity?.user) this.hurryHome(now);
    if (this.reaction?.manual && now < this.reaction.end) return;
    if (now - (this.lastAuto.get(name) ?? -Infinity) < COOLDOWN) return;
    this.lastAuto.set(name, now);
    this.reaction = { name, intensity, start: now, end: now + reactionDuration(intensity), manual: false };
  }

  private finish(now: number): void {
    const seconds = this.work / 1000;
    if (seconds < 40) this.auto('ez', 1, now);
    else if (seconds < 120) this.auto(this.random() < 0.5 ? 'encourage' : 'hype', seconds < 80 ? 1 : 2, now);
    else this.auto('reward', seconds < 300 ? 2 : 3, now);
  }

  update(now: number, signals: Signals): AmbientView {
    // A pending permission prompt pauses the work: it is neither done nor idle.
    const active = signals.busy || Boolean(signals.asking);
    if (active) { this.calmSince = undefined; this.busySince ??= now; this.lastActive = now; }
    else { this.busySince = undefined; this.calmSince ??= now; }
    if (signals.typed) {
      if (this.scene === 'quiet') { this.enter('idle', now); this.auto('boop', 1, now); }
      this.lastActive = now;
    }
    const rose = (flag: 'asking' | 'interrupted' | 'failed') => {
      const value = Boolean(signals[flag]), risen = value && !this.flags[flag];
      this.flags[flag] = value;
      return risen;
    };
    if (rose('asking')) this.auto('sus', 1, now);
    if (rose('interrupted')) { this.cut = true; this.auto('facepalm', 1, now); }
    if (rose('failed')) { this.cut = true; this.auto('rip', 1, now); }

    const working = this.scene === 'working';
    if (!working && this.busySince !== undefined && now - this.busySince >= START_WORK) {
      this.workStart = this.busySince;
      this.coffee = this.slow = this.cut = false;
      this.enter('working', now);
    } else if (working && this.calmSince !== undefined && now - this.calmSince >= STOP_WORK) {
      this.work = this.calmSince - this.workStart;
      this.enter('idle', now);
      if (this.work >= DONE_AFTER && !this.cut) { this.finishedAt = now; this.finish(now); }
    } else if (working) {
      if (!this.coffee && now - this.workStart >= COFFEE_AT) { this.coffee = true; this.auto('coffee', 1, now); }
      if (!this.slow && now - this.workStart >= SLOW_AT) { this.slow = true; this.auto('too_slow', 1, now); }
    } else if (this.scene === 'idle' && now - this.lastActive >= QUIET_AFTER) {
      this.enter('quiet', now);
      this.auto('chill', 1, now);
    }
    if (this.reaction && now >= this.reaction.end) this.reaction = undefined;
    if (this.activity && now >= this.activity.end) {
      this.activity = undefined;
      this.nextActivity = now + 6000 + this.random() * 8000;
    }

    if (this.scene !== 'idle' || this.reaction) {
      if (this.visitor) this.nextVisit = now + 25_000 + this.random() * 25_000;
      this.visitor = undefined;
    } else if (this.visitor && now - this.visitStart >= VISIT_FOR) {
      this.visitor = undefined;
      this.nextVisit = now + 25_000 + this.random() * 25_000;
    } else if (!this.visitor && !this.activity && now >= this.nextVisit) {
      this.visitor = visitors[Math.floor(this.random() * visitors.length)];
      this.visitStart = now;
    }

    // Left alone, it keeps itself busy: a different little thing each time.
    if (!this.activity && now >= this.nextActivity) {
      const free = !this.reaction && !this.visitor && !this.flags.asking;
      if (free && this.scene === 'idle' && now - this.finishedAt >= FINISHED_FOR) {
        const sea = this.columns >= bandLayout(this.columns).penguin + SWIM_ROOM;
        const choices = idleActivities.filter((name) => name !== this.lastActivity && (name !== 'swim' || sea));
        this.begin(choices[Math.floor(this.random() * choices.length)]!, now);
      } else if (free && this.scene === 'working' && now - this.since >= 8000) {
        this.begin('think', now);
      } else if (free && this.scene === 'quiet' && now - this.since < (FISHING_FOR - 10) * 1000) {
        // A bite: it eats its catch, then fishes on.
        this.begin('snack', now);
      } else {
        this.nextActivity = now + 2000;
      }
    }

    const view: AmbientView = {
      scene: this.scene,
      seconds: (now - this.since) / 1000,
      clock: (now - this.start) / 1000,
      work: (this.scene === 'working' ? now - this.workStart : this.work) / 1000,
      drawn: Math.min(1, (now - this.start) / DRAW_FOR),
      visit: this.visitor ? (now - this.visitStart) / 1000 : 0,
    };
    if (this.flags.asking) view.asking = true;
    if (this.scene === 'idle' && now - this.finishedAt < FINISHED_FOR) view.finished = true;
    if (this.reaction) view.reaction = { name: this.reaction.name, intensity: this.reaction.intensity, seconds: (now - this.reaction.start) / 1000 };
    if (this.visitor) view.visitor = this.visitor;
    if (this.activity) {
      const { name, start, user, x, y, petted } = this.activity;
      view.doing = { name, seconds: (now - start) / 1000 };
      if (user) view.doing.user = true;
      if (x !== undefined && y !== undefined) Object.assign(view.doing, { x, y });
      if (petted !== undefined) view.doing.petted = (now - petted) / 1000;
    }
    return view;
  }
}

// ── Drawing ────────────────────────────────────────────────────────────────

// The penguin, pixel for pixel from its sheet: one pose per state, two pixels per cell.
// Startup: the outline is traced around the penguin, then it fills in.
const drawOrder = (() => {
  const base = penguinPoses.neutral;
  const solid = (x: number, y: number) => base[y]?.[x] !== undefined && base[y]![x] !== '.';
  const edge: [number, number][] = [], fill: [number, number][] = [];
  for (let y = 0; y < PENGUIN_HEIGHT; y++) for (let x = 0; x < PENGUIN_WIDTH; x++) {
    if (!solid(x, y)) continue;
    const outline = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
    (outline ? edge : fill).push([x, y]);
  }
  const angle = ([x, y]: [number, number]) => (Math.atan2(x - PENGUIN_WIDTH / 2 + 0.5, PENGUIN_HEIGHT / 2 - y) + 2 * Math.PI) % (2 * Math.PI);
  edge.sort((a, b) => angle(a) - angle(b));
  fill.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return [...edge, ...fill];
})();

/** What the penguin is busy with, when that outranks the rest: a click always does. */
export function activeDoing(view: AmbientView): Doing | undefined {
  if (!view.doing || view.drawn < 1) return undefined;
  if (view.doing.user) return view.doing;
  // On its way home, it finishes the trip before reacting.
  return (view.reaction || view.asking) && homeward[view.doing.name] === undefined ? undefined : view.doing;
}

/** The pose for what is happening now, with the small hops and sways that go with it. */
export function penguinFrame(view: AmbientView): Frame {
  const doing = activeDoing(view);
  if (doing) return activityFrame(doing);
  const still = (pose: Pose): Frame => ({ pose, dx: 0, dy: 0 });
  const reaction = view.reaction;
  if (!reaction) return still(scenePose(view));
  const s = reaction.seconds, step = Math.floor(s * 3) % 2;
  switch (reaction.name) {
    // It celebrates: two hops, then the cape.
    case 'reward': return s < 1.5 ? { pose: 'happy', dx: 0, dy: -Math.round(Math.abs(Math.sin(s * Math.PI * 1.4))) } : still('hero');
    case 'hype': return { pose: step ? 'happy' : 'dancing', dx: 0, dy: step ? 0 : -1 };
    case 'encourage': return still(Math.floor(s * 4) % 2 ? 'neutral' : 'waving');
    // Who, me? It was not asleep.
    case 'boop': return { pose: s < 1.2 ? 'surprised' : 'innocent', dx: 0, dy: s < 0.2 ? -1 : 0 };
    case 'sus': return still(s < 0.8 ? 'sweating' : Math.floor(view.clock * 1.5) % 2 ? 'left' : 'right');
    case 'rip': return still(s < 1.5 ? 'closed' : 'crying');
    case 'too_slow': return still(s < 1.5 ? 'closed' : 'sweating');
    case 'coffee': return still('pleased');
    case 'confused': return still('thinking');
    case 'facepalm': return still('facepalm');
    case 'chill': case 'ez': return still('shades');
  }
}

/** The penguin's pose for what is happening now. */
export function penguinPose(view: AmbientView): Pose {
  return penguinFrame(view).pose;
}

function scenePose(view: AmbientView): Pose {
  const t = view.clock;
  if (view.asking) return Math.floor(t) % 2 ? 'left' : 'right';
  // It slides to work, then stays focused on it, with a glance now and then.
  if (view.scene === 'working') {
    if (view.seconds < 1.2) return 'sliding';
    return t % 9 < 0.8 ? (Math.floor(t / 9) % 2 ? 'left' : 'right') : 'focused';
  }
  // A long pause: it goes fishing, then falls asleep.
  if (view.scene === 'quiet') return view.seconds < FISHING_FOR ? 'fishing' : 'asleep';
  if (view.finished) return 'happy';
  if (blinking(t)) return 'closed';
  if (view.visitor && view.visit > 5) return 'right';
  // Idle, it looks around for a moment every few seconds.
  const beat = Math.floor(t / 6);
  return beat > 0 && t % 6 < 1.6 ? fidgets[(Math.imul(beat, 0x9e3779b1) >>> 0) % fidgets.length]! : 'neutral';
}
const fidgets: Pose[] = ['left', 'right', 'happy', 'neutral', 'right', 'left', 'happy'];

/** A stable pseudo-random value in [0, 1) for each whole number. */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/**
 * One blink every four seconds, at an uneven moment within them and now and
 * then twice in a row: real eyes rather than a metronome.
 */
export function blinking(t: number): boolean {
  const BLINK = 0.14, window = Math.floor(t / 4), at = window * 4 + hash(window * 2) * 3.4;
  return (t >= at && t < at + BLINK) || (hash(window * 2 + 1) < 0.3 && t >= at + 0.3 && t < at + 0.3 + BLINK);
}

/** The pose's rows; wider poses overflow the penguin's box evenly on both sides. */
function penguinPixels(view: AmbientView, pose: Pose): string[] {
  const rows = penguinPoses[pose].map((row) => [...row]);
  if (view.drawn < 1) {
    const shown = Math.floor(view.drawn * drawOrder.length);
    const visible = new Set(drawOrder.slice(0, shown).map(([x, y]) => y * PENGUIN_WIDTH + x));
    const offset = (PENGUIN_WIDTH - rows[0]!.length) / 2;
    rows.forEach((row, y) => row.forEach((_, x) => { if (!visible.has(y * PENGUIN_WIDTH + x + offset)) row[x] = '.'; }));
  }
  return rows.map((row) => row.join(''));
}

const RESET = '\x1b[0m';
const rgb = (hex: string) => `${parseInt(hex.slice(0, 2), 16)};${parseInt(hex.slice(2, 4), 16)};${parseInt(hex.slice(4, 6), 16)}`;
const bold = (hex: string) => `\x1b[1;38;2;${rgb(hex)}m`;
const mixHex = (a: string, b: string) => [0, 2, 4]
  .map((i) => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0')).join('');
const tint = { title: bold('e8aa48'), text: `\x1b[38;2;${rgb('dbe3ee')}m` };

/**
 * The rest of the fishing rod, from the penguin's flipper up to its tip, and
 * the line down to a bobber in the sea beyond the floe.
 */
function fishingLine(canvas: string[][], left: number, clock: number): void {
  const set = (x: number, y: number, color: string) => { if (canvas[y]?.[x] !== undefined) canvas[y]![x] = color; };
  for (let i = 0; i <= 6; i++) set(left + 18 + i, 12 - i, penguinPalette.R!);
  const [tipX, tipY] = [left + 24, 6], [bobX, bobY] = [left + 30, 17 + Math.round(Math.sin(clock * 2) * 0.5)];
  for (let y = tipY + 1; y < bobY; y++) set(Math.round(tipX + (bobX - tipX) * (y - tipY) / (bobY - tipY)), y, 'c8d6e4');
  set(bobX, bobY, penguinPalette.O!);
}

/** One terminal cell of the band: its full SGR style and its character. */
export interface BandCell {
  style: string;
  char: string;
}

/** Where things stand in a band `columns` wide, in pixels from the left. */
export function bandLayout(columns: number): { snowman: number | undefined; penguin: number; floe: number } {
  // The snowman keeps the penguin company when there is room for both.
  const snowman = columns >= 100 ? 1 : undefined;
  const penguin = snowman === undefined ? 1 : snowman + SNOWMAN_WIDTH + 1;
  return { snowman, penguin, floe: penguin + PENGUIN_WIDTH + 6 };
}

/**
 * What a click on cell (`column`, `row`) of the band touches, both from 0, and
 * where in pixels; `away` is how far the penguin is from its place.
 */
export function bandHit(columns: number, column: number, row: number, away = 0): { target: Target; x: number; y: number } | undefined {
  if (row < 0 || row >= BAND_ROWS || column < 0 || column >= columns) return undefined;
  const { snowman, penguin: home } = bandLayout(columns), penguin = home + away, y = row * 2 + 1;
  if (column >= penguin - 1 && column <= penguin + PENGUIN_WIDTH) return { target: 'penguin', x: column, y };
  if (snowman !== undefined && column >= snowman && column < snowman + SNOWMAN_WIDTH && y >= DECOR_HEIGHT - 11) return { target: 'snowman', x: column, y };
  return { target: y > HORIZON ? 'sea' : 'sky', x: column, y };
}

/** The band: the penguin in its polar night, `columns` cells per line. */
export function bandCells(view: AmbientView, columns: number): BandCell[][] {
  const width = Math.max(1, columns), height = DECOR_HEIGHT;
  const text = Array.from({ length: BAND_ROWS }, () => new Array<{ char: string; style: string } | undefined>(width));
  // The caption sits on the second line, above the scene.
  const captionRow = 1;
  const write = (x: number, chars: string, style: string) => {
    for (const [i, char] of [...chars].entries()) if (x + i >= 0 && x + i < width) text[captionRow]![x + i] = { char, style };
  };

  const { snowman, penguin: tx, floe } = bandLayout(width);
  const penguinWidth = PENGUIN_WIDTH;
  const visit = view.visitor ? Math.min(1, view.visit / (VISIT_FOR / 1000)) : 0;
  const canvas = decorPixels(width, { clock: view.clock, floe, snowman, visitor: view.visitor, visit });
  const frame = penguinFrame(view), pixels = penguinPixels(view, frame.pose);
  const px = tx + frame.dx + (PENGUIN_WIDTH - pixels[0]!.length) / 2;
  pixels.forEach((line, y) => [...line].forEach((pixel, x) => {
    if (pixel === '.' || underWater(frame, px + x, y + frame.dy, floe)) return;
    if (canvas[y + frame.dy]?.[px + x] !== undefined) canvas[y + frame.dy]![px + x] = penguinPalette[pixel]!;
  }));
  if (view.drawn >= 1 && frame.pose === 'fishing') fishingLine(canvas, tx, view.clock);
  const doing = activeDoing(view);
  if (doing) drawActivity(doing, frame, { canvas, left: tx, snowman, sea: HORIZON + 1, floe });

  // Beside the penguin, under the caption, down to the level of its feet;
  // further out while it swims home.
  const x = tx + penguinWidth + 3 + Math.max(0, frame.dx), room = width - x - 1;
  const stage: Stage = { canvas, left: x, room, top: captionRow * 2 + 3, bottom: height - 2 };
  if (view.reaction) {
    const definition = reactionDefinitions[view.reaction.name];
    write(x, definition.title.toUpperCase(), tint.title);
    const caption = [...` · ${definition.messages[view.reaction.intensity - 1]}`], space = room - [...definition.title].length;
    write(x + [...definition.title].length, caption.length > space ? `${caption.slice(0, space - 1).join('')}…` : caption.join(''), tint.text);
    drawScene(view.reaction.name, view.reaction.seconds, stage);
  } else if (view.drawn >= 1 && view.scene === 'quiet' && view.seconds >= FISHING_FOR) {
    drawSleep(view.clock, stage);
  } else if (view.drawn >= 1 && view.asking) {
    drawAsk(stage);
  }

  // Two pixels per cell; text sits on the color behind it. The night spreads
  // from the left at startup.
  const shown = Math.ceil(width * Math.min(1, view.clock / 0.6));
  return text.map((line, row) => {
    // Text sits on the plain sky or sea of its line, so it stays readable.
    const behind = `\x1b[48;2;${rgb(mixHex(backdrop(row * 2), backdrop(row * 2 + 1)))}m`;
    return Array.from({ length: width }, (_, cx): BandCell => {
      const cell = line[cx];
      if (cx >= shown) return { style: '', char: ' ' };
      if (cell) return { style: `${cell.style}${behind}`, char: cell.char };
      return { style: `\x1b[38;2;${rgb(canvas[row * 2]![cx]!)};48;2;${rgb(canvas[row * 2 + 1]![cx]!)}m`, char: '▀' };
    });
  });
}

/** Cells as text, restyled only where the style changes, ending on a reset. */
export function paintCells(cells: BandCell[]): string {
  let out = '', previous: string | undefined;
  for (const { style, char } of cells) {
    if (style !== previous) { out += RESET + style; previous = style; }
    out += char;
  }
  return out + RESET;
}

/** The band as one string per line. */
export function ambientBand(view: AmbientView, columns: number): string[] {
  return bandCells(view, columns).map(paintCells);
}
