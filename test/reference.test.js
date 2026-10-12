import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceFromCurve, buildReference, sliceReference } from '../practice/reference.js';
import { MELODY, curve } from './helpers/melody.js';
import { sine, silence, concat } from './helpers/synth.js';

const ref = () => referenceFromCurve({ songId: 'test', midi: curve(MELODY) });

test('referenceFromCurve produce el formato versión 1', () => {
  const r = ref();
  assert.equal(r.version, 1);
  assert.equal(r.songId, 'test');
  assert.equal(r.source, '');
  assert.equal(r.hopMs, 10);
  assert.equal(r.frameCount, 600);
  assert.equal(r.midi.length, 600);
  assert.equal(r.notes.length, 9);
  assert.equal(r.phrases.length, 3);
});

test('referenceFromCurve redondea a 2 decimales', () => {
  const r = referenceFromCurve({ songId: 'x', midi: Array(120).fill(57.12345) });
  assert.equal(r.midi[0], 57.12);
});

test('buildReference detecta dos tonos separados como dos frases', () => {
  const audio = concat(sine(220, 1.5), silence(0.5), sine(246.94, 1.5));
  const r = buildReference({ songId: 'dos', source: 'x.wav', samples: audio, sampleRate: 48000 });
  assert.equal(r.notes.length, 2);
  assert.ok(Math.abs(r.notes[0].midi - 57) < 0.05);
  assert.ok(Math.abs(r.notes[1].midi - 59) < 0.05);
  assert.equal(r.phrases.length, 2);
});

test('sliceReference de una sola frase rebasa tiempos y notas', () => {
  const s = sliceReference(ref(), 2, 2);
  assert.equal(s.offsetFrames, 220);
  assert.equal(s.startSec, 2.2);
  assert.equal(s.endSec, 4);
  assert.equal(s.midi.length, 180);
  assert.equal(s.isFull, false);
  assert.deepEqual(s.notes[0], { start: 0, end: 50, midi: 64 });
  assert.equal(s.notes.length, 3);
  assert.deepEqual(s.phrases, [{ index: 2, start: 0, end: 180, noteFrom: 0, noteTo: 2 }]);
});

test('sliceReference completo marca isFull', () => {
  const s = sliceReference(ref(), 1, 3);
  assert.equal(s.isFull, true);
  assert.equal(s.midi.length, 580);
  assert.equal(s.phrases.length, 3);
});

test('sliceReference acota rangos inválidos', () => {
  const inverted = sliceReference(ref(), 3, 1);
  assert.equal(inverted.phraseFrom, 3);
  assert.equal(inverted.phraseTo, 3);
  const outOfRange = sliceReference(ref(), 0, 99);
  assert.equal(outOfRange.phraseFrom, 1);
  assert.equal(outOfRange.phraseTo, 3);
});
