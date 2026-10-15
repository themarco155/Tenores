import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleNotes, foldToTarget, targetScale, stepScale, timeToX, midiToY } from '../practice/live-track.js';

const REF = { hopMs: 10, notes: [{ start: 60, end: 79, midi: 60.1 }, { start: 79, end: 111, midi: 59.36 }, { start: 120, end: 150, midi: 57 }, { start: 600, end: 650, midi: 62 }] };

test('notas visibles: 1,5 s antes y 3 s después, marcando la actual', () => {
  const v = visibleNotes(REF, 0.9);
  assert.deepEqual(v.map(n => n.midi), [60.1, 59.36, 57]);
  assert.deepEqual(v.map(n => n.current), [false, true, false]);
  assert.deepEqual([v[1].start, v[1].end], [0.79, 1.11]);
  assert.equal(visibleNotes(REF, 4.0).length, 1, 'a 4 s solo queda la nota de 6 s');
});

test('las notas fuera del fragmento no se dibujan y la última se recorta', () => {
  const v = visibleNotes(REF, 0.9, 100);
  assert.deepEqual(v.map(n => n.midi), [60.1, 59.36]);
  assert.equal(v[1].end, 1.0);
});

test('plegado a la octava de la nota objetivo', () => {
  assert.equal(foldToTarget(45, 57), 57);
  assert.equal(foldToTarget(57.3, 57), 57.3);
  assert.equal(foldToTarget(56.8, null), 56.8, 'sin objetivo, tal cual');
  assert.equal(foldToTarget(null, 57), null);
});

test('escala: margen de 1, mínimo 7 semitonos, sin notas conserva la anterior y suaviza', () => {
  assert.deepEqual(targetScale([{ midi: 60 }, { midi: 62 }], null), { center: 61, span: 7 });
  assert.deepEqual(targetScale([{ midi: 50 }, { midi: 62 }], null), { center: 56, span: 14 });
  const prev = { center: 60, span: 7 };
  assert.equal(targetScale([], prev), prev);
  assert.deepEqual(stepScale(prev, { center: 70, span: 9 }, 0.2), { center: 62, span: 7.4 });
  assert.deepEqual(stepScale(null, prev), prev);
});

test('posiciones: "ahora" a un tercio y el centro de la escala a media altura', () => {
  assert.equal(timeToX(5, 5, 300), 100);
  assert.equal(timeToX(3.5, 5, 300), 0);
  assert.equal(timeToX(8, 5, 300), 300);
  assert.equal(midiToY(60, { center: 60, span: 7 }, 120), 60);
  assert.ok(midiToY(62, { center: 60, span: 7 }, 120) < 60, 'más agudo, más arriba');
});
