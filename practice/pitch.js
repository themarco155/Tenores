import { hzToMidi, medianFilter } from './util.js';

export const PITCH = {
  hopMs: 10,
  targetRate: 16000,
  windowSize: 512,
  hopSize: 160,
  threshold: 0.15,
  minHz: 80,
  maxHz: 700,
  silenceDb: -45,
  absoluteFloor: 1e-4,
  maxAperiodicity: 0.35,
  medianSize: 5,
};

// Media móvil como paso bajo + interpolación lineal.
export function resample(samples, fromRate, toRate) {
  if (fromRate === toRate) return Float32Array.from(samples);
  const k = Math.max(1, Math.round(fromRate / toRate));
  let src = samples;
  if (k > 1) {
    src = new Float32Array(samples.length);
    let acc = 0;
    for (let i = 0; i < samples.length; i++) {
      acc += samples[i];
      if (i >= k) acc -= samples[i - k];
      src[i] = acc / Math.min(i + 1, k);
    }
  }
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio, i0 = Math.floor(pos), f = pos - i0;
    const a = src[i0], b = i0 + 1 < src.length ? src[i0 + 1] : a;
    out[i] = a + (b - a) * f;
  }
  return out;
}

function yinFrame(x, start, cfg, d) {
  const { W, tauMin, tauMax, sr } = cfg;
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) {
      const diff = x[start + j] - x[start + j + tau];
      sum += diff * diff;
    }
    running += sum;
    d[tau] = running > 0 ? (sum * tau) / running : 1;
  }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < PITCH.threshold) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    let best = tauMin;
    for (let t = tauMin + 1; t <= tauMax; t++) if (d[t] < d[best]) best = t;
    if (d[best] > PITCH.maxAperiodicity) return null;
    tau = best;
  }
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const den = a - 2 * b + c;
    if (den !== 0) better = tau + (a - c) / (2 * den);
  }
  return sr / better;
}

export function detectPitch(samples, sampleRate) {
  const sr = PITCH.targetRate;
  const x0 = resample(samples, sampleRate, sr);
  const W = PITCH.windowSize, hop = PITCH.hopSize;
  const tauMin = Math.floor(sr / PITCH.maxHz), tauMax = Math.ceil(sr / PITCH.minHz);
  const frames = Math.floor(x0.length / hop);
  const x = new Float32Array(frames * hop + W + tauMax + 1);
  x.set(x0);

  const rms = new Array(frames);
  for (let k = 0; k < frames; k++) {
    let s = 0;
    const st = k * hop;
    for (let j = 0; j < W; j++) s += x[st + j] * x[st + j];
    rms[k] = Math.sqrt(s / W);
  }
  const peak = rms.reduce((m, v) => Math.max(m, v), 0);
  const floor = Math.max(peak * 10 ** (PITCH.silenceDb / 20), PITCH.absoluteFloor);

  const d = new Float32Array(tauMax + 1);
  const cfg = { W, tauMin, tauMax, sr };
  const raw = new Array(frames).fill(null);
  for (let k = 0; k < frames; k++) {
    if (rms[k] < floor) continue;
    const hz = yinFrame(x, k * hop, cfg, d);
    if (hz && hz >= PITCH.minHz && hz <= PITCH.maxHz) raw[k] = hzToMidi(hz);
  }
  return { hopMs: PITCH.hopMs, midi: medianFilter(raw, PITCH.medianSize), rms };
}
