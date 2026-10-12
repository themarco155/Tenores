import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentNotes, segmentPhrases } from '../practice/segment.js';
import { MELODY, curve } from './helpers/melody.js';

test('segmentNotes separa la melodía en sus 9 notas exactas', () => {
  assert.deepEqual(segmentNotes(curve(MELODY)), [
    { start: 0, end: 40, midi: 57 }, { start: 40, end: 80, midi: 59 },
    { start: 80, end: 140, midi: 60 }, { start: 140, end: 180, midi: 62 },
    { start: 220, end: 270, midi: 64 }, { start: 270, end: 320, midi: 62 },
    { start: 320, end: 400, midi: 60 },
    { start: 440, end: 480, midi: 59 }, { start: 480, end: 580, midi: 57 },
  ]);
});

test('un pico de 3 frames no crea una nota nueva', () => {
  assert.deepEqual(segmentNotes(curve([[60, 50], [65, 3], [60, 50]])), [{ start: 0, end: 103, midi: 60 }]);
});

test('el vibrato de ±0,2 semitonos es una sola nota', () => {
  const vib = Array.from({ length: 120 }, (_, k) => 60 + 0.2 * Math.sin(k / 3));
  const notes = segmentNotes(vib);
  assert.equal(notes.length, 1);
  assert.ok(Math.abs(notes[0].midi - 60) < 0.1);
});

test('los tramos con voz de menos de 60 ms aislados se descartan', () => {
  assert.deepEqual(segmentNotes(curve([[null, 10], [60, 4], [null, 10]])), []);
});

test('segmentPhrases agrupa por silencios ≥ 300 ms', () => {
  assert.deepEqual(segmentPhrases(segmentNotes(curve(MELODY))), [
    { index: 1, start: 0, end: 180, noteFrom: 0, noteTo: 3 },
    { index: 2, start: 220, end: 400, noteFrom: 4, noteTo: 6 },
    { index: 3, start: 440, end: 580, noteFrom: 7, noteTo: 8 },
  ]);
});

test('una frase de menos de 1 s se fusiona con la siguiente', () => {
  const phrases = segmentPhrases(segmentNotes(curve([[60, 50], [null, 40], [62, 150]])));
  assert.deepEqual(phrases, [{ index: 1, start: 0, end: 240, noteFrom: 0, noteTo: 1 }]);
});

test('una última frase corta se fusiona con la anterior', () => {
  const phrases = segmentPhrases(segmentNotes(curve([[60, 150], [null, 40], [62, 50]])));
  assert.deepEqual(phrases, [{ index: 1, start: 0, end: 240, noteFrom: 0, noteTo: 1 }]);
});

test('sin notas no hay frases', () => {
  assert.deepEqual(segmentPhrases([]), []);
});
