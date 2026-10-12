import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch } from '../practice/pitch.js';
import { hzToMidi, median } from '../practice/util.js';
import { sine, saw, noise, silence, concat } from './helpers/synth.js';

const voiced = midi => midi.filter(v => v != null);
const centsError = (midi, hz) => Math.abs(median(voiced(midi)) - hzToMidi(hz)) * 100;

for (const [hz, sr] of [[110, 48000], [220, 48000], [330, 48000], [440, 48000], [220, 44100], [330, 44100]]) {
  test(`seno de ${hz} Hz a ${sr} Hz → error < 5 cents`, () => {
    const { midi } = detectPitch(sine(hz, 1, sr), sr);
    assert.ok(voiced(midi).length > midi.length * 0.8, 'la mayoría de frames tienen voz');
    assert.ok(centsError(midi, hz) < 5, `error ${centsError(midi, hz).toFixed(2)} cents`);
  });
}

for (const hz of [110, 220]) {
  test(`diente de sierra de ${hz} Hz → error < 5 cents (sin errores de octava)`, () => {
    const { midi } = detectPitch(saw(hz, 1), 48000);
    assert.ok(centsError(midi, hz) < 5);
  });
}

test('produce un frame cada 10 ms', () => {
  const { hopMs, midi, rms } = detectPitch(sine(220, 1), 48000);
  assert.equal(hopMs, 10);
  assert.ok(midi.length >= 98 && midi.length <= 101, `frames: ${midi.length}`);
  assert.equal(rms.length, midi.length);
});

test('el silencio es null', () => {
  const { midi } = detectPitch(silence(1), 48000);
  assert.ok(midi.every(v => v === null));
});

test('el ruido blanco es mayoritariamente null', () => {
  const { midi } = detectPitch(noise(1), 48000);
  assert.ok(voiced(midi).length < midi.length * 0.2, `con voz: ${voiced(midi).length}`);
});

test('silencio seguido de tono: el silencio queda null', () => {
  const { midi } = detectPitch(concat(silence(0.5), sine(220, 0.5)), 48000);
  assert.ok(midi.slice(0, 40).every(v => v === null));
  assert.ok(voiced(midi.slice(55)).length > 35);
});
