import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPLASH_FOR, introFrame, introImage, introText, playIntro } from '../dist/intro.js';
import { imagesAllowed, mascotSixel, parseGraphics } from '../dist/mascot-render.js';

const plain = (line) => line.replace(/\x1b\[[0-9;]*m/g, '');
const art = (frame) => frame.map(plain).join('').split(/[▀▄]/).length - 1;
const note = 'J’ai créé ce projet par pur plaisir, en pensant à vous.';
const thanks = 'Merci du fond du cœur : vous me donnez la force de continuer.';
const wish = 'J’espère sincèrement qu’il vous plaira.';

test('intro shows the KK LAB mascot, large enough to read and centered, with its note below', () => {
  const splash = introFrame(SPLASH_FOR - 0.5, 120, 34).map(plain);
  const mascot = splash.findLastIndex((line) => /[▀▄]/.test(line));
  const first = splash.findIndex((line) => /[▀▄]/.test(line));
  assert.ok(mascot - first + 1 >= 16 && mascot - first + 1 <= 22, 'half blocks keep the stripes readable');
  assert.ok(Math.abs(first - (splash.length - 1 - mascot)) <= 6, 'centered vertically');
  assert.ok(splash.findIndex((line) => line.includes('by KK LAB')) > mascot);
  assert.ok(splash.findIndex((line) => line.includes(note)) > mascot);
  const line = (text) => splash.findIndex((row) => row.includes(text));
  assert.deepEqual([line(thanks), line(wish)], [line(note) + 1, line(note) + 2], 'one sentence per line when it fits');
  assert.ok(!splash.some((line) => line.includes('boop')));
  for (const [cols, rows] of [[120, 34], [80, 24], [60, 22], [200, 60]]) {
    for (const seconds of [0.5, SPLASH_FOR - 0.5, SPLASH_FOR + 3]) {
      const frame = introFrame(seconds, cols, rows).map(plain);
      assert.ok(frame.length <= rows, `${cols}x${rows}`);
      for (const line of frame) assert.ok([...line].length <= cols, `${cols}x${rows}: ${line}`);
    }
  }
  assert.ok(introFrame(SPLASH_FOR - 0.5, 50, 22).map(plain).join('\n').includes('qu’il vous plaira.'), 'the note wraps on narrow terminals');
  // The mascot draws itself (outline, then fill), then the signature and the note type in.
  assert.ok(art(introFrame(0.4)) < art(introFrame(1)));
  assert.ok(art(introFrame(1)) < art(introFrame(2)));
  assert.equal(art(introFrame(2)), art(introFrame(3)));
  assert.ok(!introFrame(1).map(plain).some((line) => line.includes('KK LAB') || line.includes('plaisir')));
  // Small terminals, like a VS Code panel, get the signature and the note, never a blurred mascot.
  const small = introFrame(SPLASH_FOR - 0.5, 80, 14).map(plain);
  assert.equal(art(small), 0);
  assert.ok(small.some((line) => line.includes('by KK LAB')) && small.some((line) => line.includes('en pensant à vous.')) && small.some((line) => line.includes(wish)));
});

test('the note types itself in order, slowly enough to read, then says how to skip', () => {
  const sentences = [note, thanks, wish];
  for (const [cols, rows] of [[120, 34], [80, 24], [50, 22]]) {
    let finished = -1;
    const noteOf = (frame) => frame.slice(frame.findIndex((line) => line.includes('by KK LAB')) + 1, -1).map((line) => line.trim());
    const whole = noteOf(introFrame(SPLASH_FOR - 0.1, cols, rows).map(plain));
    for (let t = 0; t < SPLASH_FOR; t += 0.05) {
      const frame = introFrame(t, cols, rows).map(plain);
      if (!frame.some((line) => line.includes('by KK LAB'))) continue;
      const lines = noteOf(frame);
      // A line only starts once the one before it is complete: nothing shows after the line being typed.
      const typing = lines.findIndex((line, i) => line !== whole[i]);
      if (typing >= 0) lines.slice(typing + 1).forEach((line) => assert.equal(line, '', `${cols}x${rows} at ${t.toFixed(2)}s: « ${line} » before « ${whole[typing]} » is done`));
      lines.forEach((line, i) => assert.ok(whole[i].startsWith(line), `${cols}x${rows} at ${t.toFixed(2)}s: « ${line} »`));
      if (finished < 0 && lines.join(' ').includes(wish)) finished = t;
    }
    assert.ok(finished > 0 && SPLASH_FOR - finished >= 4, `${cols}x${rows}: ${(SPLASH_FOR - finished).toFixed(1)} s left to read it`);
  }
  const typing = introFrame(SPLASH_FOR - 9, 120, 34).map(plain).join('\n');
  assert.ok(sentences.some((sentence) => !typing.includes(sentence)), 'still typing midway');
  assert.match(introFrame(SPLASH_FOR - 0.5, 120, 34).map(plain).join('\n'), /une touche pour passer/);
  assert.doesNotMatch(introFrame(4, 120, 34).map(plain).join('\n'), /une touche pour passer/, 'the hint waits for the note');
});

test('Sixel terminals get the real mascot image, centered and sized from their cells', () => {
  assert.equal(parseGraphics('\x1b[6;20;10t'), undefined, 'waits for the device attributes');
  assert.deepEqual(parseGraphics('\x1b[6;20;10t\x1b[?61;4;6;7;14;21;22;23;24;28;32;42c'), { sixel: true, cell: { height: 20, width: 10 } });
  assert.deepEqual(parseGraphics('\x1b[?1;2c'), { sixel: false });
  // ConPTY claims Sixel on Windows, but only Windows Terminal shows the image.
  assert.equal(imagesAllowed({ TERM_PROGRAM: 'vscode' }, 'win32'), false);
  assert.equal(imagesAllowed({ WT_SESSION: 'b7c1' }, 'win32'), true);
  assert.equal(imagesAllowed({ TERM_PROGRAM: 'vscode' }, 'darwin'), true);
  const graphics = { sixel: true, cell: { width: 10, height: 20 } };
  const frame = introFrame(SPLASH_FOR - 0.5, 120, 34, graphics).map(plain);
  assert.ok(!frame.some((line) => line.includes('▀')), 'no half blocks under the image');
  assert.ok(introFrame(0.8, 120, 34, graphics).some((line) => line.includes('▀')), 'it draws itself first');
  assert.ok(frame.findIndex((line) => line.includes(note)) >= 20, 'the note sits below the image');
  assert.equal(introImage(1, 120, 34, graphics), undefined, 'the image replaces the drawing once done');
  const image = introImage(2, 120, 34, graphics);
  assert.match(image, /^\x1b\[\d+;\d+H\x1bP0;1;0q"1;1;\d+;\d+/);
  assert.ok(image.endsWith('\x1b\\'));
  const [, row, column] = /^\x1b\[(\d+);(\d+)H/.exec(image).map(Number);
  assert.ok(row > 5, 'centered vertically');
  const [, width, height] = /"1;1;(\d+);(\d+)/.exec(image).map(Number);
  assert.ok(height <= 12 * 20 && width / height > 0.9 && width / height < 1);
  assert.ok(Math.abs(column - 1 + width / 20 - 60) <= 1, 'centered');
  // Without Sixel, or without a cell size, the mascot stays in half blocks.
  assert.equal(introImage(2, 120, 34, { sixel: true }), undefined);
  assert.equal(introImage(2, 120, 34, { sixel: false, cell: graphics.cell }), undefined);
  assert.ok(mascotSixel(60).length < mascotSixel(300).length);
  // Large cells (Windows display scaling) keep the mascot.
  for (const height of [16, 25, 32, 40]) {
    assert.ok(introImage(2, 120, 34, { sixel: true, cell: { width: height / 2, height } }), `${height} px cells`);
  }
});

test('captured intro output is plain text without cursor control or colors', async () => {
  let output = '';
  await playIntro({ isTTY: false, write: (text) => { output += text; } }, { isTTY: false });
  assert.equal(output, `${introText()}\n`);
  assert.doesNotMatch(output, /\x1b/);
  assert.match(output, /KK LAB/);
});
