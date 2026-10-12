import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hzToMidi, midiToHz, median, mean, weightedMean, lin, round2, formatTime, medianFilter } from '../practice/util.js';

test('hzToMidi y midiToHz son inversas', () => {
  assert.equal(hzToMidi(440), 69);
  assert.equal(hzToMidi(220), 57);
  assert.ok(Math.abs(midiToHz(57) - 220) < 1e-9);
});

test('median ignora null y promedia los centrales', () => {
  assert.equal(median([3, null, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([null, NaN]), null);
});

test('mean y weightedMean', () => {
  assert.equal(mean([1, null, 3]), 2);
  assert.equal(mean([]), null);
  assert.equal(weightedMean([[100, 1], [0, 3]]), 25);
  assert.equal(weightedMean([[null, 1]]), null);
});

test('lin es 100 en ok, 0 en bad y lineal entre medias', () => {
  assert.equal(lin(10, 20, 100), 100);
  assert.equal(lin(60, 20, 100), 50);
  assert.equal(lin(120, 20, 100), 0);
});

test('round2 y formatTime', () => {
  assert.equal(round2(57.0349), 57.03);
  assert.equal(formatTime(84), '1:24');
  assert.equal(formatTime(5.4), '0:05');
});

test('medianFilter conserva null y elimina picos aislados', () => {
  assert.deepEqual(medianFilter([60, 60, 72, 60, 60, null, 62], 5), [60, 60, 60, 60, 61, null, 61]);
});
