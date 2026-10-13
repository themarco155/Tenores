import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MELODY, curve, shift, ramp, runScore } from './helpers/melody.js';

const kinds = r => r.tips.map(t => t.kind);

test('curva idéntica con guía → felicita y sugiere ponerse a prueba', () => {
  const r = runScore(curve(MELODY), 'guide');
  assert.deepEqual(r.tips, [{ kind: 'praise', phrase: null, text: "¡Muy bien! Prueba el modo 'Ponerme a prueba'." }]);
});

test('curva idéntica a prueba → felicita sin sugerir el modo en el que ya está', () => {
  const r = runScore(curve(MELODY), 'test');
  assert.deepEqual(r.tips, [{ kind: 'praise', phrase: null, text: '¡Muy bien! Sigue así.' }]);
});

test('+50 cents → consejos pitch-bias que dicen "alto"', () => {
  const r = runScore(shift(curve(MELODY), 0.5));
  assert.equal(r.tips.length, 3);
  assert.ok(r.tips.every(t => t.kind === 'pitch-bias'));
  assert.match(r.tips[0].text, /^Frase \d \(\d:\d\d–\d:\d\d\): tiendes a quedarte ~50 cents alto\.$/);
});

test('octava abajo → consejo octave "debajo"', () => {
  const r = runScore(shift(curve(MELODY), -12));
  const tip = r.tips.find(t => t.kind === 'octave');
  assert.ok(tip);
  assert.match(tip.text, /octava por debajo/);
  assert.ok(!kinds(r).includes('pitch-bias'));
});

test('frase 2 retrasada 300 ms en guía → consejo entry "tarde" en la frase 2', () => {
  const user = curve([[57, 40], [59, 40], [60, 60], [62, 40], [null, 70], [64, 50], [62, 50], [60, 80], [null, 10], [59, 40], [57, 100], [null, 20]]);
  const tip = runScore(user, 'guide').tips.find(t => t.kind === 'entry');
  assert.ok(tip);
  assert.equal(tip.phrase, 2);
  assert.equal(tip.text, 'Entras 0,3 s tarde en la frase 2.');
});

test('dos notas largas que caen 40 cents → consejo drift "caes"', () => {
  const user = [
    ...curve([[57, 40], [59, 40], [60, 60], [62, 40], [null, 40], [64, 50], [62, 50]]),
    ...ramp(60, 59.6, 80),
    ...curve([[null, 40], [59, 40]]),
    ...ramp(57, 56.6, 100),
    ...curve([[null, 20]]),
  ];
  const tip = runScore(user).tips.find(t => t.kind === 'drift');
  assert.ok(tip);
  assert.match(tip.text, /^En las notas largas caes ~(25|30) cents al final\.$/);
});

test('frase 3 sin cantar → consejo missed en la frase 3', () => {
  const user = curve([[57, 40], [59, 40], [60, 60], [62, 40], [null, 40], [64, 50], [62, 50], [60, 80], [null, 200]]);
  const tip = runScore(user).tips.find(t => t.kind === 'missed');
  assert.ok(tip);
  assert.equal(tip.phrase, 3);
  assert.equal(tip.text, 'Frase 3: faltan notas; repásala con la guía.');
});

test('intento no válido → sin consejos', () => {
  assert.deepEqual(runScore(Array(600).fill(null)).tips, []);
});
