import assert from 'node:assert/strict';
import { test } from 'node:test';
import { introFrame, introKeywords, introText, playIntro } from '../dist/intro.js';
import { reactionDefinitions } from '../dist/reactions.js';

const plain = (line) => line.replace(/\x1b\[[0-9;]*m/g, '');

test('intro lists one keyword per reaction, with the KK LAB tiger when the terminal is large enough', () => {
  assert.equal(introKeywords.length, Object.keys(reactionDefinitions).length);
  const full = introFrame(5).map(plain);
  assert.equal(full.length, 24);
  assert.ok(full.some((line) => line.includes('▀')));
  for (const { keyword, summary } of introKeywords) {
    assert.ok(full.some((line) => line.includes(keyword) && line.includes(summary)), keyword);
  }
  const compact = introFrame(5, 60, 22).map(plain);
  assert.ok(!compact.some((line) => line.includes('▀')));
  assert.ok(compact.some((line) => line.includes('boop')));
  // The reveal is animated: nothing but the tiger's first lines at the start.
  assert.ok(!introFrame(0.2).map(plain).some((line) => line.includes('boop')));
});

test('captured intro output is plain text without cursor control or colors', async () => {
  let output = '';
  await playIntro({ isTTY: false, write: (text) => { output += text; } }, { isTTY: false });
  assert.equal(output, `${introText()}\n`);
  assert.doesNotMatch(output, /\x1b/);
  assert.match(output, /KK LAB/);
});
