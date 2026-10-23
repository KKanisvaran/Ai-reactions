// The penguin's own life between two AI events: small things it does by
// itself, and how it answers when the user clicks it. Always kind: a click
// pets it, it never gets cross. Pure: everything moves with the seconds the
// caller passes in.
import { HORIZON } from './decor.ts';
import { PENGUIN_WIDTH, penguinPalette, penguinProps } from './penguin.ts';
import type { Pose } from './penguin.ts';

export type Activity =
  | 'look' | 'wave' | 'sing' | 'dance' | 'juggle' | 'think' | 'snack' | 'shiver' | 'stroll' | 'swim'
  // From the third sheet: hobbies, each with what it holds.
  | 'read' | 'feast' | 'tinker' | 'build' | 'paint' | 'ninja' | 'experiment' | 'game' | 'gift' | 'photo' | 'spy'
  | 'guitar' | 'love' | 'idea' | 'king' | 'garden' | 'balloon'
  | 'pleased' | 'hop' | 'greet' | 'wish' | 'splash';

/** What the user can click in the band. */
export type Target = 'penguin' | 'snowman' | 'sea' | 'sky';

/**
 * The swim, in seconds from its start: it waddles to the edge of the floe,
 * crouches, jumps, plunges, floats in its ring, swims back and climbs out.
 */
const SWIM = { out: 1.3, crouch: 1.6, jump: 2.35, plunge: 3, float: 13, back: 14.2, climb: 14.8, home: 16.6 };
/** How far it walks to the edge of the floe, and where it floats, in pixels from its place. */
const EDGE = 8, OFFSHORE = 32, ALONGSIDE = 26;
/** Pixels of sea it needs beyond its place, ring and ripples included. */
export const SWIM_ROOM = OFFSHORE + 2 + PENGUIN_WIDTH + 6;
/** Floating, everything below this row is under water. */
export const WATERLINE = HORIZON + 3;

/** Seconds each activity lasts. */
export const activityLength: Record<Activity, number> = {
  look: 2.4, wave: 3, sing: 5, dance: 5, juggle: 6, think: 4.5, snack: 4, shiver: 3, stroll: 5.4, swim: SWIM.home,
  pleased: 2.6, hop: 1.6, greet: 3, wish: 2.6, splash: 2.6,
  read: 5, feast: 4, tinker: 4, build: 4.5, paint: 5, ninja: 3.5, experiment: 4.5, game: 5, gift: 3.5, photo: 3.5, spy: 4.5,
  guitar: 5, love: 4, idea: 4, king: 4, garden: 4.5, balloon: 5,
};

/**
 * Activities that take it away from its place, and the second at which it
 * heads home: cut short, they jump there instead of leaving it stranded.
 */
export const homeward: Partial<Record<Activity, number>> = { stroll: 3.8, swim: SWIM.float };

/** What it may pick by itself when nothing happens; looking around is the most common. */
export const idleActivities: Activity[] = ['look', 'look', 'wave', 'sing', 'dance', 'juggle', 'think', 'snack', 'shiver', 'stroll', 'swim',
  'read', 'feast', 'tinker', 'build', 'paint', 'ninja', 'experiment', 'game', 'gift', 'photo', 'spy', 'guitar', 'love', 'idea', 'king', 'garden', 'balloon'];

/** Its answers to clicks in a row, happier each time. */
const petting: Activity[] = ['pleased', 'wave', 'hop', 'dance'];

export function answer(target: Target, clicks: number): Activity {
  if (target === 'snowman') return 'greet';
  if (target === 'sea') return 'splash';
  if (target === 'sky') return 'wish';
  return petting[Math.min(clicks, petting.length) - 1]!;
}

export interface Doing {
  name: Activity;
  /** Seconds since it started. */
  seconds: number;
  /** Started by a click: it then outranks everything else. */
  user?: boolean;
  /** Where the click landed, in band pixels. */
  x?: number;
  y?: number;
  /** Seconds since the user last petted it while it was busy far from its place. */
  petted?: number;
}

/** The pose, and how far the whole penguin moves from its place, in pixels. */
export interface Frame {
  pose: Pose;
  dx: number;
  dy: number;
  /** In the sea: what lies below the waterline, beyond the floe, is hidden. */
  water?: boolean;
  /** It wears its swim ring. */
  ring?: boolean;
}

const beat = (s: number, speed: number) => Math.floor(s * speed) % 2;
/** A little jump: 0 on the ground, up to `height` pixels at the top. */
const jump = (s: number, period: number, height: number) => -Math.round(Math.sin(Math.PI * ((s % period) / period)) * height);
/** 0 → 1 between `start` and `end` seconds. */
const progress = (s: number, start: number, end: number) => Math.min(1, Math.max(0, (s - start) / (end - start)));
/** Slow at both ends, like a real move. */
const ease = (p: number) => p * p * (3 - 2 * p);

/**
 * A waddle from `from` to `to` pixels at `speed` pixels a second: one pixel
 * at a time, rocking up on every other step.
 */
function waddle(s: number, from: number, to: number, speed: number, pose: Pose): Frame {
  const steps = Math.min(Math.abs(to - from), Math.floor(s * speed));
  const moving = steps < Math.abs(to - from);
  return { pose, dx: from + Math.sign(to - from) * steps, dy: moving && steps % 2 ? -1 : 0 };
}

function swimFrame(s: number): Frame {
  if (s < SWIM.out) return { ...waddle(s, 0, EDGE, EDGE / (SWIM.out - 0.1), 'right'), ring: true };
  // It gathers itself at the edge, eyes shut.
  if (s < SWIM.crouch) return { pose: 'closed', dx: EDGE, dy: 1, ring: true };
  if (s < SWIM.jump) {
    const p = progress(s, SWIM.crouch, SWIM.jump);
    const dy = Math.round(p * 2 - Math.sin(Math.PI * p) * 4);
    return { pose: 'happy', dx: EDGE + Math.round(p * (OFFSHORE - EDGE)), dy, water: p > 0.5, ring: true };
  }
  // Plouf: it sinks to its eyes, then bobs up into its ring.
  if (s < SWIM.plunge) {
    const p = progress(s, SWIM.jump, SWIM.plunge);
    return { pose: p < 0.6 ? 'closed' : 'pleased', dx: OFFSHORE, dy: 2 + Math.round(Math.sin(Math.PI * p) * 4), water: true, ring: true };
  }
  // It takes it easy: sunglasses on, drifting, rising and falling with the swell.
  if (s < SWIM.float) {
    const u = s - SWIM.plunge;
    const pose: Pose = u < 1.2 ? 'pleased' : u % 7 < 6.6 ? 'shades' : 'closed';
    const drift = Math.round(Math.sin(u * 0.55) * 2), swell = Math.sin(u * 1.7) > 0.55 ? 1 : 0;
    return { pose, dx: OFFSHORE + drift, dy: 2 + swell, water: true, ring: true };
  }
  if (s < SWIM.back) {
    const end = OFFSHORE + Math.round(Math.sin((SWIM.float - SWIM.plunge) * 0.55) * 2);
    const p = progress(s, SWIM.float, SWIM.back);
    return { pose: 'left', dx: Math.round(end + (ALONGSIDE - end) * ease(p)), dy: 2 + beat(s, 5), water: true, ring: true };
  }
  if (s < SWIM.climb) {
    const p = progress(s, SWIM.back, SWIM.climb);
    return { pose: 'happy', dx: Math.round(ALONGSIDE + (EDGE - ALONGSIDE) * p), dy: Math.round(2 * (1 - p) - Math.sin(Math.PI * p) * 4), water: p < 0.5, ring: true };
  }
  return { ...waddle(s - SWIM.climb, EDGE, 0, EDGE / (SWIM.home - SWIM.climb - 0.3), 'left'), ring: true };
}

function strollFrame(s: number): Frame {
  const reach = 6;
  if (s < 1) return waddle(s, 0, reach, reach / 0.9, 'right');
  if (s < 3.8) {
    // It looks at the sea, delighted, then back towards home.
    const u = s - 1;
    return { pose: u < 1 ? 'right' : u < 1.9 ? 'happy' : u < 2.1 ? 'closed' : 'left', dx: reach, dy: 0 };
  }
  return waddle(s - 3.8, reach, 0, reach / 0.9, s < 4.9 ? 'left' : 'neutral');
}

export function activityFrame({ name, seconds: s }: Doing): Frame {
  const still = (pose: Pose): Frame => ({ pose, dx: 0, dy: 0 });
  switch (name) {
    // A glance to each side, with a beat straight ahead between them.
    case 'look': return still(s < 0.9 ? 'left' : s < 1.2 ? 'neutral' : s < 2.1 ? 'right' : 'neutral');
    case 'stroll': return strollFrame(s);
    case 'swim': return swimFrame(s);
    // The flipper goes up and down: hello.
    case 'wave': return still(beat(s, 4) ? 'neutral' : 'waving');
    case 'sing': return still(beat(s, 2.5) ? 'pleased' : 'singing');
    case 'dance': {
      const step = Math.floor(s * 3) % 4;
      return { pose: step % 2 ? 'happy' : 'dancing', dx: step === 1 ? -1 : step === 3 ? 1 : 0, dy: step % 2 ? 0 : -1 };
    }
    case 'juggle': return still(beat(s, 2.5) ? 'juggling2' : 'juggling');
    case 'think': return still(s < 0.4 ? 'neutral' : 'thinking');
    case 'snack': return { pose: 'eating', dx: 0, dy: beat(s, 3) ? -1 : 0 };
    case 'shiver': return { pose: 'shivering', dx: beat(s, 12) ? 1 : 0, dy: 0 };
    case 'pleased': return { pose: 'pleased', dx: 0, dy: s < 0.25 ? -1 : 0 };
    case 'hop': return s < 0.3 ? still('surprised') : { pose: 'happy', dx: 0, dy: jump(s - 0.3, 0.65, 2) };
    case 'greet': return still(s < 0.8 ? 'left' : beat(s, 4) ? 'neutral' : 'waving');
    case 'wish': return still(s < 0.7 ? 'surprised' : 'pleased');
    case 'splash': return s < 1.4 ? still('right') : { pose: 'happy', dx: 0, dy: s < 1.7 ? -1 : 0 };
    case 'read': return still('reading');
    // A happy little bounce between two bites.
    case 'feast': return { pose: 'feasting', dx: 0, dy: beat(s, 1.5) ? -1 : 0 };
    case 'tinker': return still('tinkering');
    case 'build': return still('building');
    case 'paint': return still('painting');
    // It lands in its ninja stance.
    case 'ninja': return { pose: 'ninja', dx: 0, dy: s < 0.6 ? jump(s, 0.6, 2) : 0 };
    case 'experiment': return still('experimenting');
    case 'game': return still('gaming');
    case 'gift': return still('gift');
    case 'photo': return still('photographing');
    case 'spy': return still('binoculars');
    case 'guitar': return still('guitar');
    case 'love': return still('love');
    // It thinks, then the bulb lights up.
    case 'idea': return still(s < IDEA_AT ? 'thinking' : 'idea');
    case 'king': return still('king');
    case 'garden': return still('gardening');
    case 'balloon': return still('balloon');
  }
}
/** Seconds of thinking before the bulb lights up. */
const IDEA_AT = 1.2;

const HEART = ['SS.SS', 'SSSSS', '.SSS.', '..S..'];
// The decor's fish, in the penguin's colors.
const FISH = ['.PP.B', 'PPPPP', '.PP.B'];
// Its swim ring, red and white, around its waist (rows 13 to 15 of its box).
const RING = [
  '.KKSSWWSSSSSSSWWSSKK.',
  'KSSSSWWSSSSSSSWWSSSSK',
  '.KMMMPPMMMMMMMPPMMMK.',
];
const RING_TOP = 13;

/** Where the penguin stands and what is around it, in band pixels. */
export interface Place {
  canvas: string[][];
  /** Left edge of the penguin's 21-pixel box, where it stands. */
  left: number;
  snowman?: number | undefined;
  /** First row of the sea, below the horizon. */
  sea: number;
  /** Where the floe ends: the sea starts there. */
  floe: number;
}

/** Whether pixel (`x`, `y`) of a penguin in the sea is under water. */
export function underWater(frame: Frame, x: number, y: number, floe: number): boolean {
  return Boolean(frame.water) && y > WATERLINE && x >= floe - 1;
}

function dot(canvas: string[][], x: number, y: number, color: string): void {
  if (canvas[y]?.[x] !== undefined) canvas[y]![x] = color;
}

function sprite(canvas: string[][], rows: string[], x: number, y: number): void {
  rows.forEach((row, dy) => [...row].forEach((c, dx) => { if (c !== '.') dot(canvas, x + dx, y + dy, penguinPalette[c]!); }));
}

/** What the activity holds behind the penguin: a balloon, a bulb beside its head. */
export function drawBehind(doing: Doing, frame: Frame, { canvas, left }: Place): void {
  const s = doing.seconds, x = left + frame.dx, y = frame.dy;
  switch (doing.name) {
    // Its knot on the string the flipper holds, swaying with the air.
    case 'balloon': sprite(canvas, penguinProps.balloon, x + 18, y + (Math.sin(s * 2.2) > 0.3 ? 1 : 0)); break;
    case 'idea': if (s >= IDEA_AT) sprite(canvas, penguinProps.bulb, x + 18, y + (s < IDEA_AT + 0.2 ? 1 : 0)); break;
  }
}

/** What the activity adds around the penguin: notes, balls, a bubble, hearts… */
export function drawActivity(doing: Doing, frame: Frame, { canvas, left, snowman, sea, floe }: Place): void {
  const s = doing.seconds, x = left + frame.dx, y = frame.dy;
  const rise = (i: number, speed: number, span: number) => ((s * speed + i / 3) % 1) * span;
  if (frame.ring) {
    RING.forEach((row, dy) => [...row].forEach((c, dx) => {
      if (c !== '.' && !underWater(frame, x + dx, RING_TOP + y + dy, floe)) dot(canvas, x + dx, RING_TOP + y + dy, penguinPalette[c]!);
    }));
  }
  // Petted while far from its place: hearts rise where it is.
  if (doing.petted !== undefined && doing.petted < 1.6) {
    for (let i = 0; i < 2; i++) sprite(canvas, HEART, x + 14 + i * 6, Math.round(5 + y - doing.petted * 4 - i * 3));
  }
  switch (doing.name) {
    case 'swim': {
      const foam = (fx: number, color: string) => { if (fx >= floe) dot(canvas, fx, WATERLINE + 1, color); };
      // Plouf: drops fly out on both sides and fall back, foam spreads.
      const p = progress(s, SWIM.jump - 0.1, SWIM.plunge + 0.3);
      if (p > 0 && p < 1) {
        const center = left + OFFSHORE + 10;
        for (let i = 0; i < 8; i++) {
          const side = i - 3.5, height = 3 + (i % 3) * 2;
          dot(canvas, Math.round(center + side * (1.5 + p * 3)), Math.round(WATERLINE - Math.sin(Math.PI * p) * height), ['ffffff', 'c8d6e4', '6cbcfd'][i % 3]!);
        }
        if (p < 0.7) for (const dx of [-12, -11, 11, 12, 13]) foam(center + dx + Math.round(p * Math.sign(dx) * 3), 'ffffff');
      }
      // Ripples spread around the ring while it floats.
      if (s >= SWIM.plunge && s < SWIM.float) {
        for (let k = 0; k < 2; k++) {
          const off = Math.floor((((s - SWIM.plunge) * 2 + k * 2.5) % 5));
          const color = off < 2 ? 'c8d6e4' : '7aa6c8';
          foam(x - 1 - off, color); foam(x + PENGUIN_WIDTH + off, color);
        }
      }
      // A wake behind it as it swims back.
      if (s >= SWIM.float && s < SWIM.back) {
        for (let k = 0; k < 3; k++) foam(x + PENGUIN_WIDTH + k * 2 + beat(s, 6), k ? '7aa6c8' : 'c8d6e4');
      }
      break;
    }
    case 'sing':
      // Notes leave the beak and float up, swaying.
      for (let i = 0; i < 2; i++) {
        const up = rise(i, 0.6, 8);
        sprite(canvas, i ? penguinProps.note2 : penguinProps.note, x + 17 + i * 3 + Math.round(Math.sin(s * 3 + i * 2)), Math.round(7 - up) + y);
      }
      break;
    case 'guitar': {
      // The sheet's three notes rise from the strings, swaying.
      const notes = [penguinProps.guitarNote, penguinProps.guitarNote2, penguinProps.guitarNote3];
      notes.forEach((note, i) => {
        const u = (s * 0.5 + i / 3) % 1;
        sprite(canvas, note, x + 15 + i * 3 + Math.round(Math.sin(s * 2.5 + i * 2)), Math.round(9 - u * 9) + y);
      });
      break;
    }
    case 'love': sprite(canvas, penguinProps.loveHeart, x + 16 + Math.round(Math.sin(s * 3)), Math.round(4 - rise(0, 0.5, 4)) + y); break;
    case 'garden':
      // Drops fall from the spout onto the ice.
      for (let i = 0; i < 3; i++) dot(canvas, x + 30 + (i % 2), Math.floor(13 + rise(i, 1.5, 5)) + y, '6cbcfd');
      break;
    case 'dance':
      sprite(canvas, penguinProps.note, x + 21 + beat(s, 3), 2 + beat(s, 1.5));
      sprite(canvas, penguinProps.note2, x - 4 - beat(s, 3), 4 - beat(s, 1.5));
      break;
    case 'juggle':
      // Three balls on one arc over the head, from flipper to flipper.
      for (let i = 0; i < 3; i++) {
        const u = (s / 1.5 + i / 3) % 1;
        if (u > 0.8) continue;
        const p = u / 0.8;
        sprite(canvas, penguinProps.ball, x - 3 + Math.round(p * 24), Math.round(6 - Math.sin(Math.PI * p) * 7));
      }
      break;
    case 'think':
      if (s >= 0.6) sprite(canvas, penguinProps.bubble, x + 16, (s < 0.9 ? 1 : 0) + beat(s, 1));
      break;
    case 'snack':
      // Crumbs fall from the beak.
      for (let i = 0; i < 2; i++) dot(canvas, x + 11 + i * 2, Math.floor(9 + rise(i, 1.4, 9)) + y, penguinPalette.Y!);
      break;
    case 'pleased':
      for (let i = 0; i < 2; i++) sprite(canvas, HEART, x + 17 + i * 4, Math.round(6 - rise(i, 0.8, 7)));
      break;
    case 'greet':
      if (snowman !== undefined && s >= 0.8) sprite(canvas, HEART, snowman + 2, Math.round(7 - (s - 0.8) * 3));
      break;
    case 'wish': {
      // A shooting star crosses where the user clicked.
      const sx = Math.round((doing.x ?? x + 30) - s * 14), sy = Math.round((doing.y ?? 2) + s * 3);
      if (s < 1.6) ['ffffff', 'c8d6e4', '7aa6c8', '3a6eaf'].forEach((c, i) => dot(canvas, sx + i, sy - (i > 1 ? 1 : 0), c));
      break;
    }
    case 'splash': {
      // A fish jumps out where the user clicked, then splashes back.
      const fx = doing.x ?? x + 30, p = s / 1.3;
      if (p < 1) sprite(canvas, FISH, fx - 2 - Math.round(p * 4), sea + 1 - Math.round(Math.sin(Math.PI * p) * 7));
      else if (p < 1.4) for (const dx of [-3, 0, 3]) dot(canvas, fx + dx, sea, 'ffffff');
      break;
    }
  }
}
