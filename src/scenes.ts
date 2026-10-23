// Each reaction as a small pixel-art scene beside the penguin, drawn into the
// decor at its pixel scale and in the colors of its night. Pure: everything
// moves with the seconds the caller passes in.
import type { ReactionName } from './reactions.ts';

const colors: Record<string, string> = {
  W: 'ffffff', w: 'c8d6e4', g: '969eaa', d: '5a647d', K: '06080f',
  R: 'e04a5a', r: '9c2a3a', P: 'f6a8bc',
  Y: 'f8c84a', y: 'c8902a', O: 'fc7c22',
  B: '7a4a2a', b: '4c2c1a', C: 'ecd6b4', c: 'c8a47c',
  G: '6cc070', E: '3a8a4a',
  S: '7fd6ea', s: '3a6eaf',
};

const HEART = ['.RR.RR.', 'RPRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];
const SMALL_HEART = ['RR.RR', 'RRRRR', '.RRR.', '..R..'];
const MUG = ['wWWWWWw..', 'WBBBBBWww', 'WWWWWWW.w', 'wWWWWWW.w', 'wWWWWWWww', '.wWWWWw..', '..wwww...'];
const STEAM = [['.w..w', '..w..', '.w..w'], ['..w..', '.w..w', '..w..']];
const SNAIL = [
  '.........K.K', '..yyyy...C.C', '.yYYYYy..CC.', 'yYyyyYYy.CC.',
  'yYyYyYYyCCC.', 'yYYYyYYyCCC.', 'cCCCCCCCCCC.',
];
const CLOCK = [
  ['.wwwww.', 'wWWKWWw', 'wWWKWWw', 'wWWKWWw', 'wWWWWWw', 'wWWWWWw', '.wwwww.'],
  ['.wwwww.', 'wWWWWWw', 'wWWWWWw', 'wWWKKKw', 'wWWWWWw', 'wWWWWWw', '.wwwww.'],
];
const PALM = [
  '..GGG.GGG..', '.GEGGGGGEG.', 'GE..EBE..EG', 'E....B....E',
  '.....B.....', '.....cB....', '....cB.....', '..CCCCCCC..',
];
const NOTE = ['.SS.', '.S.S', '.S..', 'SS..', 'SS..'];
const HORN = ['..........yYY', 'YYYYYYYYYyYYY', 'Y........yYYY', 'YYYYYYYYYyYYY', '..........yYY'];
const ROCKET = [
  ['...rr........', '...WWWWWWWw..', 'YOOWWsSWWWWRR', '...WWWWWWWw..', '...rr........'],
  ['...rr........', '...WWWWWWWw..', 'OYYWWsSWWWWRR', '...WWWWWWWw..', '...rr........'],
];
const TROPHY = ['YYYYYYYYY', 'Y.YYWYY.Y', 'Y.YYWYY.Y', '.YYYYYYY.', '..YYYYY..', '...yYy...', '...yYy...', '.yyyyyyy.'];
const THUMB = ['...yy....', '..yCCy...', '..yCy....', 'yyyCCyyy.', 'yCyCCCCCy', 'yCyCCCCy.', 'yCyCCCCCy', 'yyyyyyyy.'];
const TOMB = ['..ggggg..', '.gwwwwwg.', 'gwwwdwwwg', 'gwwdddwwg', 'gwwwdwwwg', 'gwwwdwwwg', 'gwwwwwwwg', 'GEGGEGGEG'];
const CANDLE = [['.Y', 'OY', 'W.', 'W.'], ['Y.', 'YO', 'W.', 'W.']];
const LENS = ['.dddd...', 'dSSSSd..', 'dSWSSd..', 'dSSSSd..', '.dddd...', '....bB..', '.....bB.', '......bB'];
const EZ = ['YYYY.YYYY', 'Y.......Y', 'YYY....Y.', 'Y.....Y..', 'YYYY.YYYY'];
const SPARKLE = ['.W.', 'WYW', '.W.'];
const STAR = ['..Y..', '.YYY.', 'YYYYY', '.YYY.', '.Y.Y.'];
const Z = ['wwww', '..w.', '.w..', 'wwww'];
const ASK = ['YY.', '..Y', '.Y.', '...', '.Y.'];

/** Where a scene may draw: from `left`, `room` pixels wide, between rows `top` and `bottom`. */
export interface Stage {
  canvas: string[][];
  left: number;
  room: number;
  top: number;
  bottom: number;
}

function sprite({ canvas }: Stage, rows: string[], x: number, y: number): void {
  rows.forEach((row, dy) => [...row].forEach((c, dx) => {
    if (c !== '.' && canvas[y + dy]?.[x + dx] !== undefined) canvas[y + dy]![x + dx] = colors[c]!;
  }));
}

function dot({ canvas }: Stage, x: number, y: number, color: string): void {
  if (canvas[y]?.[x] !== undefined) canvas[y]![x] = colors[color]!;
}

/** A sprite standing on the stage's bottom row. */
const ground = (stage: Stage, rows: string[], x: number) => sprite(stage, rows, x, stage.bottom - rows.length + 1);
/** A loop from 0 to `span` - 1, `speed` steps per second. */
const cycle = (s: number, speed: number, span: number, phase = 0) => Math.floor(s * speed + phase) % Math.max(1, span);

export function drawScene(name: ReactionName, s: number, stage: Stage): void {
  const { left: x, room, top, bottom } = stage;
  const f = Math.floor(s * 4) % 2, height = bottom - top + 1;
  switch (name) {
    case 'boop': {
      // Little hearts float up from the penguin's beak, a big one beats.
      for (let i = 0; i < 3; i++) sprite(stage, SMALL_HEART, x + 1 + i * 7, bottom - 3 - cycle(s, 4, height - 3, i * 3));
      ground(stage, f ? HEART : HEART.slice(0, 5), x + 24);
      break;
    }
    case 'coffee':
      ground(stage, MUG, x + 2);
      sprite(stage, STEAM[f]!, x + 3, bottom - MUG.length - 3);
      for (let i = 0; i < 2; i++) sprite(stage, SPARKLE, x + 14 + i * 6, top + cycle(s, 2, height - 3, i * 2));
      break;
    case 'too_slow': {
      // The snail crawls on, leaving a trail of dots; the clock ticks.
      const sx = x + Math.max(0, Math.min(room - 22, Math.floor(s * 1.5)));
      for (let tx = x; tx < sx; tx += 2) dot(stage, tx, bottom, 'c');
      ground(stage, SNAIL, sx);
      ground(stage, CLOCK[Math.floor(s) % 2]!, x + Math.max(14, room - 9));
      break;
    }
    case 'chill':
      ground(stage, PALM, x + 1);
      for (let i = 0; i < 3; i++) sprite(stage, NOTE, x + 14 + i * 6, top + 1 + (f + i) % 2 * 2);
      break;
    case 'facepalm':
      // The sad trombone, its notes falling.
      sprite(stage, HORN, x + 1, top + 1 + f);
      for (let i = 0; i < 2; i++) sprite(stage, NOTE, x + 17 + i * 6, top + cycle(s, 2, height - 4, i * 2));
      break;
    case 'hype': {
      const rx = x + cycle(s, 10, Math.max(1, room - 14)), ry = top + Math.floor((height - 5) / 2);
      sprite(stage, ROCKET[f]!, rx, ry);
      for (let i = 1; i <= 3; i++) dot(stage, rx - i * 3, ry + 2, (i + f) % 2 ? 'Y' : 'O');
      break;
    }
    case 'reward':
      ground(stage, TROPHY, x + 2);
      for (let i = 0; i < 3; i++) sprite(stage, i % 2 ? SPARKLE : STAR, x + 14 + i * 7, top + cycle(s, 3, height - 5, i * 2));
      break;
    case 'encourage':
      ground(stage, THUMB, x + 2);
      for (let i = 0; i < 3; i++) sprite(stage, STAR, x + 14 + i * 7, top + 1 + (i + f) % 2 * 2);
      break;
    case 'rip':
      ground(stage, TOMB, x + 2);
      ground(stage, CANDLE[f]!, x + 13);
      break;
    case 'sus':
      // The magnifying glass sweeps the sea, looking for the culprit.
      sprite(stage, LENS, x + 2 + Math.round((Math.sin(s * 2) + 1) * 8), top + Math.floor((height - LENS.length) / 2));
      break;
    case 'ez':
      sprite(stage, EZ, x + 2, top + 1);
      sprite(stage, SPARKLE, x + 13, top + f * 3);
      sprite(stage, SPARKLE, x + 19, top + 4 - f * 3);
      break;
  }
}

/** Zs rising from the sleeping penguin. */
export function drawSleep(s: number, stage: Stage): void {
  for (let i = 0; i < 3; i++) sprite(stage, Z, stage.left + i * 6, stage.top + 4 - i * 2 + Math.floor(s + i) % 2);
}

/** A question mark: the AI waits for the user's go-ahead. */
export function drawAsk(stage: Stage): void {
  sprite(stage, ASK, stage.left, stage.top + 1);
}
