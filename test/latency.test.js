import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureLatencyStorage, savedLatency, saveLatency, browserLatency, effectiveLatency, detectOnsets, measureLatency } from '../practice/latency.js';
import { sine } from './helpers/synth.js';

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

test('retraso del navegador: salida + base + 20 ms de entrada, o null si no lo informa', () => {
  assert.equal(browserLatency({ outputLatency: 0.15, baseLatency: 0.01 }), 180);
  assert.equal(browserLatency({ outputLatency: 0 }), null);
  assert.equal(browserLatency({}), null);
  assert.equal(browserLatency(null), null);
  assert.equal(browserLatency({ outputLatency: 2 }), 500, 'se limita a 500 ms');
});

test('retraso efectivo: calibrado > navegador > 100 ms', () => {
  configureLatencyStorage(memoryStorage());
  assert.deepEqual(effectiveLatency(null), { ms: 100, source: 'default' });
  assert.deepEqual(effectiveLatency({ outputLatency: 0.2 }), { ms: 220, source: 'browser' });
  saveLatency(234.6);
  assert.equal(savedLatency(), 235);
  assert.deepEqual(effectiveLatency({ outputLatency: 0.2 }), { ms: 235, source: 'calibrated' });
});

test('almacenamiento corrupto o bloqueado no rompe nada', () => {
  configureLatencyStorage(memoryStorage({ 'tenores.latency.v1': '{roto' }));
  assert.equal(savedLatency(), null);
  configureLatencyStorage({ getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } });
  saveLatency(200);
  assert.deepEqual(effectiveLatency(null), { ms: 100, source: 'default' });
});

test('detectOnsets encuentra los inicios de voz en su sitio', () => {
  const sr = 48000;
  const audio = new Float32Array(sr * 3);
  for (const ms of [1000, 1600, 2200]) audio.set(sine(220, 0.15, sr, 0.4), Math.round((ms / 1000) * sr));
  const onsets = detectOnsets(audio, sr);
  assert.equal(onsets.length, 3, JSON.stringify(onsets));
  [1000, 1600, 2200].forEach((ms, i) => assert.ok(Math.abs(onsets[i] - ms) <= 10, `${onsets[i]} ≈ ${ms}`));
  assert.deepEqual(detectOnsets(new Float32Array(sr), sr), [], 'silencio');
});

const CLICKS = [500, 1100, 1700, 2300, 2900, 3500];

test('measureLatency: mediana desde el 2.º clic', () => {
  const onsets = [520, ...CLICKS.slice(1).map((c, i) => c + [240, 250, 260, 250, 255][i])];
  assert.deepEqual(measureLatency(onsets, CLICKS), { ok: true, ms: 250 });
});

test('measureLatency: pocos datos, dispersión alta o fuera de rango → no vale', () => {
  assert.deepEqual(measureLatency([1350, 1950], CLICKS), { ok: false, reason: 'few' });
  const irregular = CLICKS.slice(1).map((c, i) => c + [100, 400, 120, 380, 250][i]);
  assert.deepEqual(measureLatency(irregular, CLICKS), { ok: false, reason: 'spread' });
  const early = CLICKS.slice(1).map(c => c - 80);
  assert.deepEqual(measureLatency(early, CLICKS), { ok: false, reason: 'range' });
});

test('measureLatency: con cable la voz puede llegar algo antes del clic; cuenta como 0 ms', () => {
  const early = CLICKS.slice(1).map((c, i) => c + [-30, -20, -40, -25, -35][i]);
  assert.deepEqual(measureLatency(early, CLICKS), { ok: true, ms: 0 });
});
