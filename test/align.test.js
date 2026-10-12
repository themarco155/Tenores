import { test } from 'node:test';
import assert from 'node:assert/strict';
import { align, frameCost, downsample2, firstVoicedRun } from '../practice/align.js';
import { segmentNotes } from '../practice/segment.js';
import { MELODY, curve, ramp } from './helpers/melody.js';

const userAtRef = (path, r) => path.find(([, rr]) => rr >= r)[0];

test('frameCost ignora la octava y limita a 3', () => {
  assert.equal(frameCost(null, null), 0);
  assert.equal(frameCost(60, null), 1);
  assert.equal(frameCost(60, 60.5), 0.5);
  assert.equal(frameCost(48, 60), 0);
  assert.equal(frameCost(60, 67), 3);
});

test('downsample2 promedia pares y respeta null', () => {
  assert.deepEqual(downsample2([60, 62, null, 64, null, null, 65]), [61, 64, null, 65]);
});

test('firstVoicedRun busca 5 frames seguidos con voz', () => {
  assert.equal(firstVoicedRun([60, null, 60, 60, 60, 60, 60]), 2);
  assert.equal(firstVoicedRun([null, null]), 0);
});

test('curvas idénticas: los inicios de nota coinciden', () => {
  const ref = curve(MELODY);
  const path = align(ref, ref, { bandFrames: 100 });
  for (const n of segmentNotes(ref)) assert.ok(Math.abs(userAtRef(path, n.start) - n.start) <= 2);
});

test('recupera un retraso de 300 ms y un estiramiento del 10 %', () => {
  const ref = curve(MELODY);
  const stretched = Array.from({ length: Math.round(ref.length * 1.1) }, (_, k) => ref[Math.min(ref.length - 1, Math.floor(k / 1.1))]);
  const user = [...Array(30).fill(null), ...stretched, ...Array(50).fill(null)];
  const path = align(user, ref, { bandFrames: Math.max(100, Math.round(ref.length * 0.15)) });
  for (const n of segmentNotes(ref)) {
    const expected = 30 + Math.round(n.start * 1.1);
    const got = userAtRef(path, n.start);
    assert.ok(Math.abs(got - expected) <= 4, `nota en ${n.start}: esperado ${expected}, obtenido ${got}`);
  }
});

test('el camino recorre la referencia de principio a fin', () => {
  const ref = curve(MELODY);
  const path = align([...Array(20).fill(null), ...ref], ref, { bandFrames: 100 });
  assert.equal(path[0][1], 0);
  assert.equal(path[path.length - 1][1], ref.length - 1);
});

test('entradas vacías devuelven camino vacío', () => {
  assert.deepEqual(align([], curve(MELODY), { bandFrames: 100 }), []);
});

test('una nota final que cae no se comprime sobre pocos frames del usuario', () => {
  const ref = curve(MELODY);
  const user = [...ref.slice(0, 480), ...ramp(57, 56.6, 100)];
  const path = align(user, ref, { bandFrames: Math.max(100, Math.round(ref.length * 0.15)) });
  const used = new Set(path.filter(([, r]) => r >= 485 && r < 577).map(([u]) => u));
  assert.ok(used.size >= 70, `solo ${used.size} frames de usuario`);
});

test('toma cortada al 80 % (modo prueba): el camino no está vacío y acaba en el último frame del usuario', () => {
  const ref = curve(MELODY).slice(0, 580);
  const user = ref.slice(0, 480);
  const path = align(user, ref, { bandFrames: Math.max(100, Math.round(ref.length * 0.15)) });
  assert.ok(path.length > 0, 'camino vacío');
  const [lastU, lastR] = path[path.length - 1];
  assert.equal(lastU, user.length - 1);
  assert.ok(Math.abs(lastR - 479) <= 4, `termina en la referencia ${lastR}`);
  assert.equal(path[0][1], 0);
});

test('si la toma llega al final de la referencia, el camino termina en el último frame de referencia', () => {
  const ref = curve(MELODY).slice(0, 580);
  const user = [...ref.slice(0, 560), ...Array(10).fill(null)];
  const path = align(user, ref, { bandFrames: 100 });
  assert.equal(path[path.length - 1][1], ref.length - 1);
});

test('entrada del tamaño de Adeste en modo prueba: camino completo y en poco tiempo', () => {
  const ref = curve([].concat(...Array(25).fill(MELODY))); // 15 000 frames
  const user = [...ref, ...Array(Math.round(ref.length * 0.3)).fill(null)];
  const t0 = performance.now();
  const path = align(user, ref, { bandFrames: Math.max(100, Math.round(ref.length * 0.15)) });
  const ms = performance.now() - t0;
  assert.ok(path.length > 0, 'camino vacío');
  assert.equal(path[0][1], 0);
  assert.equal(path[path.length - 1][1], ref.length - 1);
  assert.ok(ms < 2000, `alineación en ${ms.toFixed(0)} ms`);
});
