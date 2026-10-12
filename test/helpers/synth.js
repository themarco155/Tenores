import { midiToHz } from '../../practice/util.js';

export function sine(hz, seconds, sr = 48000, amp = 0.5) {
  const out = new Float32Array(Math.round(seconds * sr));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr);
  return out;
}

export function saw(hz, seconds, sr = 48000, amp = 0.4) {
  const out = new Float32Array(Math.round(seconds * sr));
  for (let i = 0; i < out.length; i++) out[i] = amp * (2 * ((hz * i) / sr % 1) - 1);
  return out;
}

export function noise(seconds, sr = 48000, amp = 0.3) {
  const out = new Float32Array(Math.round(seconds * sr));
  let seed = 12345;
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    out[i] = amp * (seed / 1073741824 - 1);
  }
  return out;
}

export const silence = (seconds, sr = 48000) => new Float32Array(Math.round(seconds * sr));

export function concat(...parts) {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// Convierte una curva de frames de 10 ms (MIDI o null) en audio con fase continua.
export function synthFromCurve(curve, sr = 48000, amp = 0.4) {
  const per = Math.round(sr / 100);
  const out = new Float32Array(curve.length * per);
  let phase = 0;
  curve.forEach((m, k) => {
    if (m == null) { phase = 0; return; }
    const inc = (2 * Math.PI * midiToHz(m)) / sr;
    for (let i = 0; i < per; i++) { out[k * per + i] = amp * Math.sin(phase); phase += inc; }
  });
  return out;
}

// factor > 1 sube el tono (12·log2(factor) semitonos) y acorta la duración.
export function resampleBy(samples, factor) {
  const out = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < out.length; i++) {
    const p = i * factor, i0 = Math.floor(p), f = p - i0;
    const a = samples[i0], b = samples[Math.min(i0 + 1, samples.length - 1)];
    out[i] = a + (b - a) * f;
  }
  return out;
}
