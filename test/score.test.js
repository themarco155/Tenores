import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../practice/score.js';
import { sliceReference, referenceFromCurve } from '../practice/reference.js';
import { MELODY, curve, shift, stretch, runScore, melodyRef } from './helpers/melody.js';

test('curva idéntica → total ≥ 95, cobertura 1, válida', () => {
  const r = runScore(curve(MELODY));
  assert.equal(r.valid, true);
  assert.equal(r.coverage, 1);
  assert.ok(r.scores.total >= 95, `total ${r.scores.total}`);
  assert.ok(r.scores.pitch >= 95 && r.scores.rhythm >= 95 && r.scores.stability >= 95);
});

test('+50 cents → afinación ~62 (< 70) y ritmo intacto', () => {
  const r = runScore(shift(curve(MELODY), 0.5));
  assert.ok(r.scores.pitch < 70 && r.scores.pitch > 55, `afinación ${r.scores.pitch}`);
  assert.ok(r.scores.rhythm >= 90);
});

test('octava abajo → afinación 0', () => {
  const r = runScore(shift(curve(MELODY), -12));
  assert.equal(r.scores.pitch, 0);
});

test('estirada un 10 % en modo prueba → afinación y ritmo > 90', () => {
  const r = runScore(stretch(curve(MELODY), 1.1), 'test');
  assert.ok(r.scores.pitch > 90, `afinación ${r.scores.pitch}`);
  assert.ok(r.scores.rhythm > 90, `ritmo ${r.scores.rhythm}`);
});

test('frase 2 con 300 ms de retraso en modo guía → ritmo de esa frase bajo', () => {
  const user = curve([[57, 40], [59, 40], [60, 60], [62, 40], [null, 70], [64, 50], [62, 50], [60, 80], [null, 10], [59, 40], [57, 100], [null, 20]]);
  const r = runScore(user, 'guide');
  const [p1, p2, p3] = r.phrases;
  assert.ok(p1.rhythm >= 90 && p3.rhythm >= 90);
  assert.ok(p2.rhythm < 50, `ritmo frase 2: ${p2.rhythm}`);
});

test('frase 3 sin cantar → cobertura 0,72, sigue siendo válida', () => {
  const user = curve([[57, 40], [59, 40], [60, 60], [62, 40], [null, 40], [64, 50], [62, 50], [60, 80], [null, 200]]);
  const r = runScore(user);
  assert.equal(r.valid, true);
  assert.equal(r.coverage, 0.72);
  assert.equal(r.phrases[2].coverage, 0);
});

test('silencio → no válida', () => {
  const r = runScore(Array(600).fill(null));
  assert.equal(r.valid, false);
  assert.equal(r.scores.total, 0);
});

test('camino vacío → no válida y sin excepciones', () => {
  const slice = sliceReference(melodyRef(), 1, 3);
  const r = score(curve(MELODY), slice, [], 'test');
  assert.equal(r.valid, false);
  assert.equal(r.coverage, 0);
});

test('sin notas largas → estabilidad null y total sin NaN', () => {
  const short = curve([[60, 30], [62, 30], [64, 30], [null, 40], [62, 30], [60, 30], [null, 10]]);
  const ref = referenceFromCurve({ songId: 'corta', midi: short });
  const r = runScore(short, 'test', 1, ref.phrases.length, ref);
  assert.equal(r.scores.stability, null);
  assert.ok(r.scores.total >= 95, `total ${r.scores.total}`);
  assert.ok(r.phrases.every(p => p.stability === null));
});

test('frases en segundos absolutos y curvas para la gráfica', () => {
  // La grabación de un fragmento empieza en el inicio de ese fragmento (frame 220).
  const r = runScore(curve(MELODY).slice(220), 'test', 2, 3);
  assert.deepEqual(r.phrases.map(p => [p.index, p.start, p.end]), [[2, 2.2, 4], [3, 4.4, 5.8]]);
  assert.equal(r.curves.startSec, 2.2);
  assert.equal(r.curves.ref.length, r.curves.user.length);
  assert.equal(r.curves.hopMs, 10);
});

test('toma cortada al 80 % en modo prueba → válida y la última frase en parte sin cantar', () => {
  const r = runScore(curve(MELODY).slice(0, 480), 'test');
  assert.equal(r.valid, true);
  assert.ok(r.coverage >= 0.5 && r.coverage < 0.9, `cobertura ${r.coverage}`);
  const last = r.phrases[r.phrases.length - 1];
  assert.ok(last.coverage > 0 && last.coverage < 1, `cobertura última frase ${last.coverage}`);
  assert.ok(r.phrases[0].coverage === 1 && r.phrases[1].coverage === 1);
  assert.ok(r.tips.length <= 3);
});

test('toma cortada al 97 % en modo guía (canción larga) → válida y la última frase en parte sin cantar', () => {
  const long = curve([].concat(...Array(6).fill(MELODY)));
  const ref = referenceFromCurve({ songId: 'larga', midi: long });
  const full = sliceReference(ref, 1, ref.phrases.length).midi;
  const user = full.slice(0, Math.round(full.length * 0.97));
  assert.ok(full.length - user.length > 100, 'el corte debe superar la banda del modo guía');
  const r = runScore(user, 'guide', 1, ref.phrases.length, ref);
  assert.equal(r.valid, true);
  assert.ok(r.coverage >= 0.9, `cobertura ${r.coverage}`);
  const last = r.phrases[r.phrases.length - 1];
  assert.ok(last.coverage > 0 && last.coverage < 1, `cobertura última frase ${last.coverage}`);
  assert.ok(r.scores.rhythm >= 90, `ritmo ${r.scores.rhythm}`);
});

test('entrar tarde no baja la nota: el ritmo se informa pero no cuenta en el total', () => {
  const late = [...Array(40).fill(null), ...curve(MELODY)]; // 400 ms tarde en todo el canto, con guía
  const r = runScore(late, 'guide');
  assert.ok(r.scores.rhythm < 70, `ritmo ${r.scores.rhythm}`);
  assert.ok(r.scores.pitch >= 95 && r.scores.stability >= 95);
  assert.ok(r.scores.total >= 95, `total ${r.scores.total}`);
});
