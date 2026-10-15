import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSampleRing, noteName, targetAt, targetFor, livePitch, deviationCents, tuningState } from '../practice/live-pitch.js';
import { sine, silence } from './helpers/synth.js';

test('búfer circular: últimas muestras en orden, también al dar la vuelta', () => {
  const ring = createSampleRing(5);
  ring.push(Float32Array.of(1, 2, 3));
  assert.deepEqual([...ring.latest(2)], [2, 3]);
  ring.push(Float32Array.of(4, 5, 6, 7));
  assert.deepEqual([...ring.latest(5)], [3, 4, 5, 6, 7]);
  assert.deepEqual([...ring.latest(10)], [3, 4, 5, 6, 7], 'nunca más de lo guardado');
  assert.equal(createSampleRing(4).latest(3).length, 0);
});

test('nombres de nota latinos con octava', () => {
  assert.equal(noteName(57), 'La3');
  assert.equal(noteName(60), 'Do4');
  assert.equal(noteName(59.36), 'Si3');
  assert.equal(noteName(61), 'Do#4');
  assert.equal(noteName(47.6), 'Do3');
});

const REF = { hopMs: 10, notes: [{ start: 60, end: 79, midi: 60.1 }, { start: 79, end: 111, midi: 59.36 }, { start: 120, end: 150, midi: 57 }] };

test('nota objetivo con 100 ms de retraso y fuera de notas', () => {
  assert.equal(targetAt(REF, 0.75), 60.1);   // frame 65
  assert.equal(targetAt(REF, 0.89), 59.36);  // frame 79: empieza la segunda nota
  assert.equal(targetAt(REF, 1.25), null);   // frame 115: entre notas
  assert.equal(targetAt(REF, 0.05), null);   // antes de empezar
  assert.equal(targetAt(REF, 0.85, 0), 59.36); // frame 85, sin retraso
});

test('desviación en cents con plegado de octava', () => {
  assert.equal(deviationCents(57.12, 57), 12);
  assert.equal(deviationCents(45, 57), 0, 'una octava abajo cuenta como afinado');
  assert.equal(deviationCents(57 - 5.9, 57), -590);
  assert.equal(deviationCents(57 + 6.1, 57), -590);
  assert.equal(deviationCents(null, 57), null);
  assert.equal(deviationCents(57, null), null);
});

test('estado según la desviación', () => {
  assert.deepEqual(tuningState(null), { key: 'none', text: '' });
  assert.deepEqual(tuningState(20), { key: 'ok', text: 'Afinado' });
  assert.deepEqual(tuningState(-21), { key: 'warn', text: 'Un poco bajo' });
  assert.deepEqual(tuningState(50), { key: 'warn', text: 'Un poco alto' });
  assert.deepEqual(tuningState(51), { key: 'bad', text: 'Muy alto' });
  assert.deepEqual(tuningState(-300), { key: 'bad', text: 'Muy bajo' });
});

test('nota en vivo: tono de 220 Hz → La3; silencio o nivel bajo → null', () => {
  const tone = sine(220, 0.2);
  const m = livePitch(tone, 48000, 0.3);
  assert.ok(Math.abs(m - 57) < 0.1, `midi ${m}`);
  assert.equal(livePitch(silence(0.2), 48000, 0.3), null);
  assert.equal(livePitch(tone, 48000, 0.005), null, 'nivel por debajo del mínimo');
  assert.equal(livePitch(new Float32Array(0), 48000, 0.3), null);
});

test('sin objetivo después del final del fragmento elegido', () => {
  assert.equal(targetAt(REF, 1.35), 57, 'sin límite, la nota siguiente');
  assert.equal(targetAt(REF, 1.35, 100, 111), null, 'frame 125 ≥ fin del fragmento (111)');
  assert.equal(targetAt(REF, 0.95, 100, 111), 59.36, 'dentro del fragmento');
});

test('en un cambio de nota se compara con la nota cercana más parecida a lo que se canta', () => {
  // t = 0.89 s → frame 79, justo donde empieza la segunda nota (59.36)
  assert.equal(targetFor(REF, 0.89, 60.1), 60.1, 'aún en la nota anterior: no es error');
  assert.equal(targetFor(REF, 0.89, 59.4), 59.36, 'ya en la nota nueva');
  assert.equal(targetFor(REF, 0.89, null), 59.36, 'sin voz: la nota de ese instante');
  assert.equal(targetFor(REF, 0.75, 59.36), 60.1, 'lejos del cambio (140 ms): solo la nota actual');
  assert.equal(targetFor(REF, 1.25, 57), null, 'entre frases sigue sin objetivo');
  assert.equal(targetFor(REF, 1.18, 57), 57, 'frame 108: la nota siguiente (120) está a menos de 120 ms');
  assert.equal(targetFor(REF, 1.18, 57, { endFrame: 111 }), 59.36, 'pero no si queda fuera del fragmento');
});
