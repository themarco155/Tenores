import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceFromUrl, mixDown, ReferenceBuildError } from '../practice/reference-builder.js';
import { sine, silence, concat } from './helpers/synth.js';

const fakeBuffer = (...channels) => ({ numberOfChannels: channels.length, length: channels[0].length, sampleRate: 48000, getChannelData: c => channels[c] });
const okFetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });

test('mixDown promedia los canales', () => {
  assert.deepEqual([...mixDown(fakeBuffer(Float32Array.of(1, 1), Float32Array.of(0, 0.5)))], [0.5, 0.75]);
});

test('descarga fallida o con error HTTP → error "download"', async () => {
  for (const fetchImpl of [async () => { throw new TypeError('cors'); }, async () => ({ ok: false })]) {
    await assert.rejects(referenceFromUrl('x', 'https://x.test/a.m4a', { fetchImpl, decode: async () => fakeBuffer(silence(1)) }),
      e => e instanceof ReferenceBuildError && e.code === 'download' && e.message === 'No se pudo descargar el audio. Revisa el enlace.');
  }
});

test('archivo que no es audio → error "decode"', async () => {
  await assert.rejects(referenceFromUrl('x', 'https://x.test/a.txt', { fetchImpl: okFetch, decode: async () => { throw new Error('EncodingError'); } }),
    e => e.code === 'decode' && e.message === 'El enlace no contiene un audio válido.');
});

test('audio sin notas → error "no_phrases"', async () => {
  await assert.rejects(referenceFromUrl('x', 'https://x.test/a.m4a', { fetchImpl: okFetch, decode: async () => fakeBuffer(silence(2)) }),
    e => e.code === 'no_phrases' && e.message === 'No se detectaron notas en el audio.');
});

test('audio con notas → referencia versión 1 y aviso de etapas', async () => {
  const stages = [];
  const audio = concat(sine(220, 1.5), silence(0.5), sine(246.94, 1.5));
  const ref = await referenceFromUrl('nueva', 'https://x.test/a.m4a', { fetchImpl: okFetch, decode: async () => fakeBuffer(audio), onStage: s => stages.push(s) });
  assert.deepEqual(stages, ['download', 'analyze']);
  assert.equal(ref.version, 1);
  assert.equal(ref.songId, 'nueva');
  assert.equal(ref.source, 'https://x.test/a.m4a');
  assert.equal(ref.phrases.length, 2);
});
