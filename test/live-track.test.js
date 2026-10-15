import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleNotes, foldToTarget, targetScale, stepScale, timeToX, midiToY, createTrail, drawTrack } from '../practice/live-track.js';

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

test('las notas de antes del fragmento tampoco se dibujan y la primera se recorta', () => {
  const v = visibleNotes(REF, 0.9, Infinity, 70);
  assert.deepEqual(v.map(n => n.midi), [60.1, 59.36, 57]);
  assert.ok(Math.abs(v[0].start - 0.7) < 1e-9, String(v[0].start));
  assert.deepEqual(visibleNotes(REF, 0.9, Infinity, 79).map(n => n.midi), [59.36, 57]);
});

test('rastro de la voz: entre notas se pliega a la última nota y solo guarda 1,5 s', () => {
  const trail = createTrail();
  trail.push(1.0, 45.2, 57, 'ok');
  trail.push(1.1, 45.1, null, 'none');
  assert.equal(trail.points[1].midi, 57.1, 'sin objetivo: octava de la nota anterior');
  trail.push(3.0, 45, 57, 'ok');
  assert.deepEqual(trail.points.map(p => p.te), [3.0]);
});

test('drawTrack funciona en navegadores sin roundRect', () => {
  const calls = [];
  const g = new Proxy({}, { get: (t, k) => (k === 'roundRect' ? undefined : k in t ? t[k] : (...a) => calls.push(k)), set: (t, k, v) => ((t[k] = v), true), has: (t, k) => k in t });
  const notes = visibleNotes(REF, 0.9);
  assert.doesNotThrow(() => drawTrack(g, { width: 300, height: 120, te: 0.9, notes, points: [{ te: 0.8, midi: 59, state: 'ok' }, { te: 0.9, midi: 59.4, state: 'ok' }], scale: { center: 59, span: 7 } }));
  assert.ok(!calls.includes('roundRect'));
  assert.ok(calls.includes('fillRect'));
});
