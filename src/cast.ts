// The penguin's friends, for its little stories: Gaspard the seagull, Bulle
// the fish, the shooting star, and the things they bring. Drawn here at the
// band's pixel scale, big enough to be recognized at a glance; the penguin
// itself always comes from its sheets.

/** The cast's colors, bright enough to read on the polar night. */
export const castPalette: Record<string, string> = {
  W: 'ffffff', w: 'd6e2ee', g: '9aa8ba', G: '5c6a80', K: '0a0d16',
  Y: 'ffd23f', y: 'e09a1a', O: 'ff8a2a', o: 'c85a14', R: 'ee4250', r: 'a02536', P: 'ffa6c4',
  B: '58b4ff', b: '2a78d0', C: 'bff0ff', T: 'b07040', t: '6a3e1e', V: '74d27a', v: '3a9446',
  S: 'fff3b0', N: '6a94c4', n: '4a74a8',
};

export type Sprite = string[];

/** Gaspard the seagull, facing left: wings up, wings down, and standing on the ice. */
export const gull = {
  up: [
    'K.............K',
    'gK...........Kg',
    '.gW.........Wg.',
    '..gWw.....wWg..',
    '...wWWw.wWWw...',
    '..wKWWWWWWWgg..',
    '.YYWWWWWWWw....',
  ],
  /** Wings spread flat: a glide. */
  down: [
    '...............',
    '...............',
    '...............',
    '...wKW.........',
    'KgYYWWWWWWWWggK',
    '.gwwWWWWWWWwwg.',
    '...............',
  ],
  stand: [
    '..wWW....',
    '.wKWWw...',
    'YYWWWW...',
    '..WWWWgg.',
    '..WWWgggK',
    '..WWWWggK',
    '...wWWw..',
    '...O..O..',
    '..OO.OO..',
  ],
  /** Head down: a bow, or pecking at a meal. */
  bow: [
    '.........',
    '.........',
    '...WWgg..',
    '.wWWWgggK',
    'wKWWWWggK',
    'YYwWWWw..',
    '...wWWw..',
    '...O..O..',
    '..OO.OO..',
  ],
};

/** Bulle the fish, orange with a white band, facing left; a flick of the tail. */
export const fish = {
  swim: [
    '...OOO.....',
    '.OOWOOOO.oo',
    'OKOWOOOOOoO',
    'OOOWOOOOOoO',
    '.OOWOOOO.oo',
    '...OOO.....',
  ],
  flick: [
    '...OOO.....',
    '.OOWOOOO...',
    'OKOWOOOOOoo',
    'OOOWOOOOOoo',
    '.OOWOOOO...',
    '...OOO.....',
  ],
  /** Smiling for the camera. */
  smile: [
    '...OOO.....',
    '.OOWOOOO.oo',
    'OKOWOOOOOoO',
    'OOOWOOOOOoO',
    'KOOWOOOO.oo',
    '.K.OOO.....',
  ],
};

/** The shooting star, and the sparkle it leaves where it lands. */
export const star = {
  head: ['..Y..', '.YWY.', 'YWWWY', '.YWY.', '..Y..'],
  sparkle: [['..S..', '..W..', 'SWWWS', '..W..', '..S..'], ['S...S', '.W.W.', '..W..', '.W.W.', 'S...S']],
};
/** The trail behind the star, brightest first. */
export const trailColors = ['fff3b0', 'ffd23f', 'e0a8ff', '8a7ad8', '4a5aa8'];

/** Nounours the polar bear: walking on the ice, facing left; sitting, facing us. */
export const bear = {
  walk: [
    '.....gww........',
    '....wWWWw.......',
    '...wWKWWWwwwwww.',
    'KwWWWWWWWWWWWWWw',
    '.wWWWWWWWWWWWWWW',
    '..wWWWWWWWWWWWWW',
    '...WWgggggggWWWg',
    '...WWg..WWg.WWg.',
    '...WW...WW..WW..',
    '..gWW..gWW.gWW..',
  ],
  step: [
    '.....gww........',
    '....wWWWw.......',
    '...wWKWWWwwwwww.',
    'KwWWWWWWWWWWWWWw',
    '.wWWWWWWWWWWWWWW',
    '..wWWWWWWWWWWWWW',
    '...WWgggggggWWWg',
    '....WWg.WWg..WWg',
    '....WW..WW...WW.',
    '...gWW.gWW..gWW.',
  ],
  sit: [
    '.gw......wg.',
    '.wWw....wWw.',
    '..WWWWWWWW..',
    '.WWKWWWWKWW.',
    '.WWWWKKWWWW.',
    '..WWWKKWWW..',
    '.wWWWWWWWWw.',
    'wWWWWWWWWWWw',
    'wWWwWWWWwWWw',
    'wWWWWWWWWWWw',
    '.wWWw..wWWw.',
  ],
};
/** Pistache the seal, lying on the ice, his nose up, facing left. */
export const seal: Sprite = [
  '..GG............',
  '.GKGG...........',
  'KGGGGG..........',
  '.wGGGGGGG.......',
  '..wwGGGGGGGGGG..',
  '...wwwwGGGGGGgG.',
  '....gg....gGGGgg',
];
/** Bernadette the whale's back above the sea, her eye on the left; her tail; her spout. */
export const whale = {
  back: [
    '........NNNNNNNN..........',
    '.....NNNnnnnnnnnNNN.......',
    '...NNnnnnnnnnnnnnnnNN.....',
    '.NNnKnnnnnnnnnnnnnnnnNN...',
    'NnnnnnnnnnnnnnnnnnnnnnnnN.',
  ],
  tail: ['N...N', 'NN.NN', '.NNN.', '..N..'],
  spout: [['.C.C.', 'C.W.C', '.CWC.', '..W..', '..W..'], ['C...C', '.CWC.', 'C.W.C', '..W..', '..W..']],
};
/** The colors of the northern lights, faint to bright. */
export const aurora = ['16525a', '1f8a6a', '35c99a', '7a5cc8', 'b47ae0'];

/** Gaspard's head alone, peeking out of somewhere. */
export const gullHead: Sprite = ['.wWW', 'wKWW', 'YYWW'];
/** A sleeper's « z ». */
export const zed: Sprite = ['www', '..w', '.w.', 'www'];
/** Gaspard's chick: a grey ball of fluff, its beak wide open. */
export const chick: Sprite = ['..gg..', '.gKgg.', 'YYgggg', '.ggggg', '..O.O.'];
/** The shell Bulle brings back, pink and white. */
export const shell: Sprite = ['..PW..', '.PWPW.', 'PWPWPW', '.rrrr.'];
/** Everything in one dark color: a shadow, a silhouette at night. */
export const shadow: Record<string, string> = Object.fromEntries('WwgGKYyOoRrPBbCTtVvS'.split('').map((c) => [c, '1c2c50']));
export const gift: Sprite =['.Y...Y.', '..YYY..', 'RRRYRRR', 'RRRYRRR', 'rrrYrrr', 'rrrYrrr'];
export const smallFish: Sprite = ['.OO.o', 'OKOOo', '.OO.o'];
export const heart: Sprite = ['RR.RR', 'RRRRR', '.RRR.', '..R..'];
export const note: Sprite = ['.BB', '.B.', '.B.', 'BB.', 'BB.'];
export const note2: Sprite = ['CCC', '..C', '..C', '.CC', '.CC'];

/** An igloo, built block by block from the bottom row up. */
export const igloo: Sprite = [
  '....wwwwww....',
  '..wWWwWWwWWw..',
  '.wWWwWWWWwWWw.',
  'wWwWWWWwWWWwWw',
  'wWWWWwYYwWWWWw',
  'wWwWWYSSYwWwWw',
  'wwwwwYSSYwwwww',
];
/** The flower that grows on the ice: a seed, a sprout, a bud, in bloom. */
export const flower: Sprite[] = [
  ['.....', '.....', '.....', '.....', '.....', '..t..'],
  ['.....', '.....', '.....', '..V..', '.VV..', '..v..'],
  ['.....', '..P..', '..V..', '.VV..', '..VV.', '..v..'],
  ['.P.P.', 'PPYPP', '.PPP.', '..V..', '.VV..', '..VV.', '..v..'],
];
/** A photo, with Bulle smiling in it. */
export const photo: Sprite = [
  'WWWWWWWWWWWWW',
  'WBBBBBBBBBBBW',
  'WBB.OOO.BBBBW',
  'WBOOWOOOOoBBW',
  'WBKOWOOOOoBBW',
  'WBBKOOO.BBBBW',
  'WbbbbbbbbbbbW',
  'WWWWWWWWWWWWW',
  'WWWWWWWWWWWWW',
];
/** A puff of smoke, then its wisps. */
export const smoke: Sprite[] = [
  ['..gww..', '.gwwwwg', 'gwwWwwg', 'gwwwwwg', '.gwwwg.', '..ggg..'],
  ['.g...g.', 'g.w.w..', '..g.g.g', '.w...w.', 'g..g...', '.......'],
];
/** An explosion's flash, white hot at its heart. */
export const boom: Sprite = [
  '....Y.Y....',
  '.Y..YOY..Y.',
  '..YOOWOOY..',
  '.YOWWWWWOY.',
  'YOWWWWWWWOY',
  '.YOWWWWWOY.',
  '..YOOWOOY..',
  '.Y..YOY..Y.',
  '....Y.Y....',
];
/** Splashes of paint, when a wing knocks the palette. */
export const paint = ['R', 'Y', 'B', 'V', 'P'];

/** The sprite facing the other way. */
export function mirror(rows: Sprite): Sprite {
  return rows.map((row) => [...row].reverse().join(''));
}

/** Draws a sprite into the canvas; '.' is transparent. */
export function put(canvas: string[][], rows: Sprite, x: number, y: number, palette = castPalette): void {
  rows.forEach((row, dy) => [...row].forEach((c, dx) => {
    if (c !== '.' && canvas[y + dy]?.[x + dx] !== undefined) canvas[y + dy]![x + dx] = palette[c]!;
  }));
}

/** One pixel, if it lies on the canvas. */
export function dot(canvas: string[][], x: number, y: number, color: string): void {
  if (canvas[y]?.[x] !== undefined) canvas[y]![x] = color;
}

/** The shooting star at (`x`, `y`), its trail behind it along (`dx`, `dy`) per pixel. */
export function shootingStar(canvas: string[][], x: number, y: number, dx: number, dy: number, length = 10): void {
  for (let i = length; i >= 1; i--) {
    const color = trailColors[Math.min(trailColors.length - 1, Math.floor((i - 1) / 2))]!;
    dot(canvas, Math.round(x + 2 - dx * i), Math.round(y + 2 - dy * i), color);
  }
  put(canvas, star.head, Math.round(x), Math.round(y));
}
