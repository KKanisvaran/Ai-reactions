// Draws the KK LAB mascot from its indexed image: a real image (Sixel) when the
// terminal supports it, truecolor half blocks otherwise.
import { inflateSync } from 'node:zlib';
import { MASCOT_HEIGHT, MASCOT_WIDTH, mascotIndices, mascotPalette } from './mascot-image.ts';

const TRANSPARENT = 255;
const palette = mascotPalette.map((hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)));
let source: Uint8Array | undefined;
const pixels = () => source ??= new Uint8Array(inflateSync(Buffer.from(mascotIndices, 'base64')));

export const mascotAspect = MASCOT_WIDTH / MASCOT_HEIGHT;
export const mascotHeight = MASCOT_HEIGHT;

/**
 * The mascot scaled down to `width` × `height` pixels, undefined where transparent.
 * Each pixel keeps the dominant color of its area rather than the average, so
 * stripes stay crisp instead of blurring into the fur.
 */
export function scaledMascot(width: number, height: number): (number[] | undefined)[][] {
  const image = pixels();
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    const x0 = Math.floor(x * MASCOT_WIDTH / width), x1 = Math.max(x0 + 1, Math.floor((x + 1) * MASCOT_WIDTH / width));
    const y0 = Math.floor(y * MASCOT_HEIGHT / height), y1 = Math.max(y0 + 1, Math.floor((y + 1) * MASCOT_HEIGHT / height));
    // Colors are grouped in coarse buckets; the fullest bucket gives its mean.
    const buckets = new Map<number, { count: number; sum: number[] }>();
    let shown = 0;
    for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
      const index = image[sy * MASCOT_WIDTH + sx]!;
      if (index === TRANSPARENT) continue;
      const color = palette[index]!;
      const key = (color[0]! >> 5) << 6 | (color[1]! >> 5) << 3 | (color[2]! >> 5);
      const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] };
      bucket.count++;
      for (let i = 0; i < 3; i++) bucket.sum[i]! += color[i]!;
      buckets.set(key, bucket);
      shown++;
    }
    if (shown * 2 < (x1 - x0) * (y1 - y0)) return undefined;
    let best = { count: 0, sum: [0, 0, 0] };
    for (const bucket of buckets.values()) if (bucket.count > best.count) best = bucket;
    return best.sum.map((v) => Math.round(v / best.count));
  }));
}

const RESET = '\x1b[0m';
const fg = ([r, g, b]: number[]) => `\x1b[38;2;${r};${g};${b}m`;
const bg = ([r, g, b]: number[]) => `\x1b[48;2;${r};${g};${b}m`;

/**
 * When each pixel appears, from 0 to 1, as if drawn by hand: the outline is
 * traced around the head first, then the fill spreads inwards.
 */
function drawingOrder(image: (number[] | undefined)[][]): number[][] {
  const height = image.length, width = image[0]?.length ?? 0;
  const solid = (x: number, y: number) => Boolean(image[y]?.[x]);
  const near = (x: number, y: number) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const;
  // The outside: transparent pixels reachable from the border, not the gaps in the fur.
  const outside = image.map((row) => row.map(() => false));
  const queue: (readonly [number, number])[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if ((x === 0 || y === 0 || x === width - 1 || y === height - 1) && !solid(x, y)) { outside[y]![x] = true; queue.push([x, y]); }
  }
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of near(x, y)) if (image[ny]?.[nx] === undefined && ny >= 0 && ny < height && nx >= 0 && nx < width && !outside[ny]![nx]) { outside[ny]![nx] = true; queue.push([nx, ny]); }
  }
  const order = image.map((row) => row.map(() => 1));
  const depth = image.map((row) => row.map(() => Infinity));
  let edge: [number, number][] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (solid(x, y) && near(x, y).some(([nx, ny]) => nx < 0 || ny < 0 || nx >= width || ny >= height || outside[ny]![nx])) { edge.push([x, y]); depth[y]![x] = 0; }
  }
  const angle = ([x, y]: [number, number]) => (Math.atan2(x - width / 2, height / 2 - y) + 2 * Math.PI) % (2 * Math.PI);
  [...edge].sort((a, b) => angle(a) - angle(b)).forEach(([x, y], i) => { order[y]![x] = 0.5 * i / edge.length; });
  let deepest = 1;
  while (edge.length) {
    const next: [number, number][] = [];
    for (const [x, y] of edge) for (const [nx, ny] of near(x, y)) {
      if (solid(nx, ny) && depth[ny]![nx] === Infinity) { depth[ny]![nx] = depth[y]![x]! + 1; deepest = depth[ny]![nx]!; next.push([nx, ny]); }
    }
    edge = next;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (solid(x, y) && depth[y]![x]! > 0) order[y]![x] = 0.5 + 0.5 * Math.min(1, depth[y]![x]! / deepest);
  }
  return order;
}

let drawing: { key: string; image: (number[] | undefined)[][]; order: number[][] } | undefined;

/**
 * Truecolor half blocks, `width` cells × `lines` lines, each line showing two
 * pixel rows; `progress` from 0 to 1 draws the mascot, always in its own colors.
 */
export function mascotBlocks(width: number, lines: number, progress = 1): string[] {
  const key = `${width}x${lines}`;
  if (drawing?.key !== key) {
    const image = scaledMascot(width, lines * 2);
    drawing = { key, image, order: drawingOrder(image) };
  }
  const { image, order } = drawing;
  const pixel = (x: number, y: number) => order[y]?.[x] !== undefined && order[y]![x]! <= progress ? image[y]![x] : undefined;
  return Array.from({ length: lines }, (_, line) => {
    let out = '';
    for (let x = 0; x < width; x++) {
      const top = pixel(x, line * 2), bottom = pixel(x, line * 2 + 1);
      if (!top && !bottom) out += `${RESET} `;
      else if (!bottom) out += `${RESET}${fg(top!)}▀`;
      else if (!top) out += `${RESET}${fg(bottom)}▄`;
      else out += `${fg(top)}${bg(bottom)}▀`;
    }
    return out + RESET;
  });
}

/** A Sixel image of the mascot, `height` pixels tall; transparent pixels keep the background. */
export function mascotSixel(height: number): string {
  const h = Math.max(1, Math.min(MASCOT_HEIGHT, Math.round(height)));
  const w = Math.max(1, Math.round(h * mascotAspect));
  const image = pixels();
  // Scaled down by averaging, then back to the mascot's own palette, so the
  // image keeps its colors. Nearest colors are cached on 15-bit keys.
  const indices = new Int16Array(w * h).fill(-1);
  const nearest = new Int16Array(1 << 15).fill(-1);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * MASCOT_HEIGHT / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * MASCOT_HEIGHT / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * MASCOT_WIDTH / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * MASCOT_WIDTH / w));
      let r = 0, g = 0, b = 0, shown = 0;
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const index = image[sy * MASCOT_WIDTH + sx]!;
        if (index === TRANSPARENT) continue;
        const color = palette[index]!;
        r += color[0]!; g += color[1]!; b += color[2]!; shown++;
      }
      if (shown * 2 < (x1 - x0) * (y1 - y0)) continue;
      r /= shown; g /= shown; b /= shown;
      const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
      if (nearest[key] === -1) {
        let best = 0, distance = Infinity;
        palette.forEach((entry, i) => {
          const d = (entry[0]! - r) ** 2 + (entry[1]! - g) ** 2 + (entry[2]! - b) ** 2;
          if (d < distance) { distance = d; best = i; }
        });
        nearest[key] = best;
      }
      indices[y * w + x] = nearest[key]!;
    }
  }
  const out = [`\x1bP0;1;0q"1;1;${w};${h}`];
  const used = new Set(indices);
  used.delete(-1);
  for (const index of used) out.push(`#${index};2;${palette[index]!.map((v) => Math.round(v * 100 / 255)).join(';')}`);
  // Six pixel rows per band: one run-length line per color, overlaid with '$'.
  for (let y0 = 0; y0 < h; y0 += 6) {
    const band = new Map<number, Uint8Array>();
    for (let k = 0; k < 6 && y0 + k < h; k++) for (let x = 0; x < w; x++) {
      const index = indices[(y0 + k) * w + x]!;
      if (index < 0) continue;
      let bits = band.get(index);
      if (!bits) band.set(index, bits = new Uint8Array(w));
      bits[x]! |= 1 << k;
    }
    const lines: string[] = [];
    for (const [index, bits] of band) {
      let line = `#${index}`, previous = 0, count = 0;
      const flush = () => {
        const char = String.fromCharCode(63 + previous);
        if (count) line += count > 3 ? `!${count}${char}` : char.repeat(count);
      };
      for (let x = 0; x < w; x++) {
        if (bits[x] === previous) count++;
        else { flush(); previous = bits[x]!; count = 1; }
      }
      if (previous) flush();
      lines.push(line);
    }
    out.push(lines.join('$'), '-');
  }
  out.push('\x1b\\');
  return out.join('');
}

/** What the terminal answered to `queryTerminal`: Sixel support and cell size in pixels. */
export interface TerminalGraphics { sixel: boolean; cell?: { width: number; height: number } }

/** Asks for the cell size, then the device attributes, which every terminal answers last. */
export const queryTerminal = '\x1b[16t\x1b[c';

/**
 * On Windows, ConPTY answers `queryTerminal` itself and claims Sixel, yet only
 * Windows Terminal receives the image: VS Code and others would show nothing.
 */
export function imagesAllowed(env: NodeJS.ProcessEnv = process.env, platform: string = process.platform): boolean {
  return platform !== 'win32' || Boolean(env.WT_SESSION);
}

/** Parses the replies to `queryTerminal`; undefined until the device attributes arrive. */
export function parseGraphics(replies: string): TerminalGraphics | undefined {
  const attributes = /\x1b\[\?([\d;]*)c/.exec(replies);
  if (!attributes) return undefined;
  const cell = /\x1b\[6;(\d+);(\d+)t/.exec(replies);
  const graphics: TerminalGraphics = { sixel: attributes[1]!.split(';').includes('4') };
  if (cell && +cell[1]! > 0 && +cell[2]! > 0) graphics.cell = { height: +cell[1]!, width: +cell[2]! };
  return graphics;
}
