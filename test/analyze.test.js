import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { analyze, ENGINE_VERSION } from '../practice/analyze.js';
import { buildReference } from '../practice/reference.js';
import { MELODY, curve } from './helpers/melody.js';
import { synthFromCurve, resampleBy, silence } from './helpers/synth.js';
import { readWav } from './helpers/wav.js';

const UP_50_CENTS = 2 ** (50 / 1200);
const audio = synthFromCurve(curve(MELODY));
const refData = buildReference({ songId: 'sintetica', source: '', samples: audio, sampleRate: 48000 });

test('la referencia sintética tiene 3 frases', () => {
  assert.equal(refData.phrases.length, 3);
});

test('analizar la misma toma → total ≥ 95 y contrato completo', () => {
  const r = analyze({ samples: audio, sampleRate: 48000, refData, mode: 'test', phraseFrom: 1, phraseTo: 3 });
  console.log(`sintética total ${r.scores.total}`);
  assert.deepEqual(Object.keys(r).sort(), ['coverage', 'curves', 'engineVersion', 'isFull', 'mode', 'phraseFrom', 'phraseTo', 'phrases', 'scores', 'songId', 'tips', 'valid'].sort());
  assert.equal(r.engineVersion, ENGINE_VERSION);
  assert.equal(r.songId, 'sintetica');
  assert.equal(r.isFull, true);
  assert.equal(r.valid, true);
  assert.ok(r.scores.total >= 95, `total ${r.scores.total}`);
});

test('toma +50 cents → afinación < 70 y consejo "alto"', () => {
  const r = analyze({ samples: resampleBy(audio, UP_50_CENTS), sampleRate: 48000, refData, mode: 'test', phraseFrom: 1, phraseTo: 3 });
  console.log(`sintética +50c pitch ${r.scores.pitch}`);
  assert.ok(r.scores.pitch < 70, `afinación ${r.scores.pitch}`);
  assert.ok(r.tips.some(t => t.kind === 'pitch-bias' && t.text.includes('alto')));
});

test('toma de 0,3 s de silencio → no válida, sin excepción', () => {
  const r = analyze({ samples: silence(0.3), sampleRate: 48000, refData, mode: 'guide', phraseFrom: 1, phraseTo: 3 });
  assert.equal(r.valid, false);
});

test('rango de una frase (la toma empieza en el inicio de la frase)', () => {
  const start = refData.phrases[1].start * 480; // frames de 10 ms → muestras a 48 kHz
  const r = analyze({ samples: audio.subarray(start), sampleRate: 48000, refData, mode: 'test', phraseFrom: 2, phraseTo: 2 });
  assert.equal(r.valid, true);
  assert.equal(r.phraseFrom, 2);
  assert.equal(r.phraseTo, 2);
  assert.equal(r.isFull, false);
  assert.equal(r.phrases.length, 1);
});

const WAV = 'audios/Fum Fum Fum.wav';
test('Fum Fum Fum: contra sí misma ≥ 95 en < 3 s; +50 cents < 70', { skip: !existsSync(WAV) && 'falta el WAV' }, () => {
  const { samples, sampleRate } = readWav(WAV);
  const ref = buildReference({ songId: 'fum', source: WAV, samples, sampleRate });
  const t0 = performance.now();
  const same = analyze({ samples, sampleRate, refData: ref, mode: 'test', phraseFrom: 1, phraseTo: ref.phrases.length });
  const elapsed = performance.now() - t0;
  console.log(`Fum Fum Fum: ${ref.notes.length} notas, ${ref.phrases.length} frases, análisis en ${elapsed.toFixed(0)} ms, total ${same.scores.total}`);
  assert.ok(same.scores.total >= 95, `total ${same.scores.total}`);
  assert.ok(elapsed < 3000, `análisis en ${elapsed.toFixed(0)} ms`);
  const shifted = analyze({ samples: resampleBy(samples, UP_50_CENTS), sampleRate, refData: ref, mode: 'test', phraseFrom: 1, phraseTo: ref.phrases.length });
  console.log(`Fum +50c pitch ${shifted.scores.pitch}`);
  assert.ok(shifted.scores.pitch < 70, `afinación ${shifted.scores.pitch}`);
});
