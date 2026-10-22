// The penguin's polar night, at its pixel scale and in the colors of its sheet:
// sky, stars, moon, mountains, sea, the ice floe and its snowman, a light
// snowfall and a few visitors. Pure: everything is drawn from the clock.

/** Pixel rows: the penguin's 20, its feet on the ice floe. */
export const DECOR_HEIGHT = 20;

const SKY = ['001244', '001244', '031a4c', '052154', '072b5f', '093168', '093168', '0b3a72', '0e427c', '0e427c',
  '0e427c', '0e427c', '0e427c', '0e427c', '0a4b82', '0c3e70'];
const SEA = '072951', SHIMMER = '0c3e70';
const MOUNTAIN = '167ebe', MOUNTAIN_SHADE = '1164a5', PEAK = '2888c4';
const STAR = '99d0ed', STAR_DIM = '58739e', FLAKE = 'e6f1fa';
const ICE = 'ffffff', ICE_SHADE = 'edffff', ICE_EDGE = '81c7f9', CRACK = '1c508c';
/** Sea level: the far shore's last row. */
export const HORIZON = 15;
/** The floe's surface: the penguin's feet stand on it. */
const FLOE = 18;

const colors: Record<string, string> = {
  W: 'fefffe', K: '06080f', O: 'f99562', R: '4c3c3b', L: 'c3d1de', M: '9bd0ee', m: '8db7de',
  G: 'f4f8fb', g: '9aa6b8', F: 'c8d6e4', B: '3a6eaf',
};
const SNOWMAN = [
  '...ggg...',
  '..gWWWg..',
  '..gKWKg..',
  '..gWWWOO.',
  '...gWLg..',
  'R.gWWWLgR',
  '.RgWKWLR.',
  '.gWWWWWLg',
  '.gWWKWWLg',
  '..gWWWLg.',
];
export const SNOWMAN_WIDTH = SNOWMAN[0]!.length;
const MOON = ['.MMM', 'MMm.', 'Mm..', 'MMm.', '.MMM'];
const GULL = [['G.....G', '.G...G.', '..GgG..'], ['.......', 'GGG.GGG', '..GgG..']];
const FISH = ['.FF.B', 'FFFFF', '.FF.B'];

export type DecorVisitor = 'bird' | 'fish' | 'star';
export interface DecorScene {
  /** Seconds since the band started. */
  clock: number;
  /** Where the floe ends, in pixels from the left. */
  floe: number;
  /** Left edge of the snowman, or undefined without one. */
  snowman?: number | undefined;
  visitor?: DecorVisitor | undefined;
  /** 0 → 1 as the visitor crosses the band. */
  visit?: number;
}

/** Behind text: the sky or sea of pixel row `y`, without its stars, flakes or visitors. */
export function backdrop(y: number): string {
  return y < SKY.length ? SKY[y]! : SEA;
}

/** A stable pseudo-random value in [0, 1) for an integer seed. */
function noise(seed: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/** The decor, `width` × DECOR_HEIGHT pixels as hex colors. */
export function decorPixels(width: number, scene: DecorScene): string[][] {
  const t = scene.clock;
  const height = DECOR_HEIGHT;
  // Stars twinkle in steps, twice a second; snow and sea glide a pixel at a time.
  const slow = Math.floor(t * 2) / 2;
  const canvas = Array.from({ length: height }, (_, y) => Array.from({ length: width }, () => backdrop(y)));
  const set = (x: number, y: number, color: string) => { if (x >= 0 && x < width && y >= 0 && y < height) canvas[y]![x] = color; };
  const sprite = (rows: string[], left: number, top: number) => rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') set(left + x, top + y, colors[c]!); }));

  // Stars: most hold still, each twinkles now and then.
  for (let i = 0; i < width / 9; i++) {
    const x = Math.floor(noise(i * 2 + 1) * width), y = Math.floor(noise(i * 2 + 2) * 8);
    const twinkle = (slow / (2 + noise(i + 99) * 4) + noise(i + 7)) % 1 < 0.12;
    set(x, y, twinkle ? 'ffffff' : i % 3 ? STAR_DIM : STAR);
  }
  sprite(MOON, width - 14, 1);

  // Mountains along the horizon: lit on the left, shaded on the right.
  for (let i = 0, center = -6; center < width + 12; i++, center += 12 + Math.floor(noise(i + 300) * 14)) {
    const peak = 3 + Math.floor(noise(i + 500) * 4);
    for (let x = center - peak - 1; x <= center + peak + 1; x++) {
      for (let y = HORIZON - 1 - peak + Math.abs(x - center); y < HORIZON - 1; y++) set(x, y, y === HORIZON - 1 - peak ? PEAK : x <= center ? MOUNTAIN : MOUNTAIN_SHADE);
    }
  }

  // The sea shimmers slowly.
  for (let y = HORIZON + 1; y < height; y++) {
    for (let i = 0; i < width / 9; i++) {
      const x = Math.floor(noise(y * 97 + i) * width + t * (0.6 + (y % 3) * 0.3)) % width;
      set(x, y, SHIMMER); set(x + 1, y, SHIMMER);
    }
  }
  // Small ice floes drift far out.
  for (let i = 0; i < width / 50; i++) {
    const x = scene.floe + 18 + Math.floor(noise(i + 700) * Math.max(1, width - scene.floe - 24)), size = 3 + Math.floor(noise(i + 800) * 4);
    for (let dx = 0; dx < size; dx++) { set(x + dx, FLOE, ICE_SHADE); set(x + dx, FLOE + 1, ICE_EDGE); }
  }

  // The ice floe, its rounded end and its crack.
  for (let x = 0; x < scene.floe + 2; x++) {
    if (x < scene.floe - 1) set(x, FLOE, ICE);
    if (x < scene.floe) set(x, FLOE + 1, ICE);
    if (x < scene.floe + 1) set(x, FLOE + 2, ICE_SHADE);
    set(x, FLOE + 3, ICE_EDGE);
  }
  set(scene.floe - 6, FLOE, CRACK); set(scene.floe - 5, FLOE + 1, CRACK); set(scene.floe - 5, FLOE + 2, CRACK);
  if (scene.snowman !== undefined) sprite(SNOWMAN, scene.snowman, FLOE + 1 - SNOWMAN.length);

  // A light snowfall.
  for (let i = 0; i < width / 26; i++) {
    const speed = 1.2 + noise(i + 900) * 1.5;
    const y = Math.floor((t * speed + noise(i + 950) * 20) % FLOE);
    const x = Math.floor(noise(i + 1000) * width + Math.sin(t * 0.7 + i) * 1.5);
    set(x, y, FLAKE);
  }

  // Visitors cross from the right edge towards the penguin.
  const progress = scene.visit ?? 0;
  if (scene.visitor === 'star') {
    const x = Math.round(width - progress * (width + 8)), y = 1 + Math.floor(progress * 4);
    ['ffffff', 'c8d6e4', '7aa6c8', '3a6eaf'].forEach((color, i) => set(x + i, y + (i > 1 ? 1 : 0), color));
  } else if (scene.visitor === 'bird') {
    const x = Math.round(width - 8 - progress * Math.max(0, width - 8 - scene.floe)), y = 4 + Math.round(Math.sin(t * 2));
    sprite(GULL[Math.floor(t * 4) % 2]!, x, y);
  } else if (scene.visitor === 'fish') {
    // Jumps out of the water, a little closer each time.
    const jump = (t % 2.2) / 2.2, x = Math.round(width - 10 - progress * Math.max(0, width - 20 - scene.floe));
    if (jump < 0.55) sprite(FISH, x - Math.round(jump * 8), HORIZON + 2 - Math.round(Math.sin(Math.PI * jump / 0.55) * 7));
    else if (jump < 0.7) { set(x - 5, HORIZON + 1, 'ffffff'); set(x - 3, HORIZON + 1, 'ffffff'); set(x - 4, HORIZON, 'c8d6e4'); }
  }
  return canvas;
}
