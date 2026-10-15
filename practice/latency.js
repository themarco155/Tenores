import { median } from './util.js';

// Retraso total de auriculares/altavoz + micrófono: calibración guardada, valor del navegador y valor efectivo.
const KEY = 'tenores.latency.v1';
export const LATENCY = { defaultMs: 100, inputMs: 20, maxMs: 500, clickCount: 6, clickIntervalMs: 600,
  windowBeforeMs: 100, windowAfterMs: 600, minOffsets: 3, maxSpreadMs: 60, earlyMs: 50 };

let storage = () => globalThis.localStorage;
export function configureLatencyStorage(store) { storage = () => store; }

const clamp = ms => Math.max(0, Math.min(LATENCY.maxMs, Math.round(ms)));

export function savedLatency() {
  try {
    const v = JSON.parse(storage()?.getItem(KEY) ?? 'null');
    return v && Number.isFinite(v.ms) ? clamp(v.ms) : null;
  } catch { return null; }
}

export function saveLatency(ms, now = new Date()) {
  try { storage()?.setItem(KEY, JSON.stringify({ ms: clamp(ms), at: now.toISOString() })); } catch { /* sin almacenamiento */ }
}

export function browserLatency(context) {
  const out = context?.outputLatency;
  if (!(out > 0)) return null;
  return clamp((out + (context.baseLatency || 0)) * 1000 + LATENCY.inputMs);
}

export function effectiveLatency(context) {
  const saved = savedLatency();
  if (saved != null) return { ms: saved, source: 'calibrated' };
  const auto = browserLatency(context);
  if (auto != null) return { ms: auto, source: 'browser' };
  return { ms: LATENCY.defaultMs, source: 'default' };
}

// Inicios de voz (ms): tramos de 10 ms cuya energía sube con fuerza respecto a los 30 ms anteriores.
export function detectOnsets(samples, sampleRate, { frameMs = 10, minLevel = 0.02, ratio = 4, refractoryMs = 250 } = {}) {
  const n = Math.round((sampleRate * frameMs) / 1000);
  const frames = Math.floor(samples.length / n);
  const rms = new Float32Array(frames);
  for (let k = 0; k < frames; k++) {
    let sum = 0;
    for (let i = k * n; i < (k + 1) * n; i++) sum += samples[i] * samples[i];
    rms[k] = Math.sqrt(sum / n);
  }
  const onsets = [];
  let last = -Infinity;
  for (let k = 3; k < frames; k++) {
    const before = (rms[k - 1] + rms[k - 2] + rms[k - 3]) / 3;
    const t = k * frameMs;
    if (rms[k] >= minLevel && rms[k] >= ratio * Math.max(before, 1e-4) && t - last >= refractoryMs) {
      onsets.push(t);
      last = t;
    }
  }
  return onsets;
}

// Retraso medido a partir de los inicios de voz y los clics (ambos en ms desde el inicio de la grabación).
export function measureLatency(onsetsMs, clicksMs) {
  const offsets = [];
  for (const c of clicksMs.slice(1)) {
    const o = onsetsMs.find(t => t >= c - LATENCY.windowBeforeMs && t <= c + LATENCY.windowAfterMs);
    if (o !== undefined) offsets.push(o - c);
  }
  if (offsets.length < LATENCY.minOffsets) return { ok: false, reason: 'few' };
  const med = median(offsets);
  const spread = median(offsets.map(x => Math.abs(x - med)));
  if (spread > LATENCY.maxSpreadMs) return { ok: false, reason: 'spread' };
  // Con cable, quien canta al ritmo de los clics puede adelantarse un poco: hasta 50 ms antes cuenta como 0.
  if (med < -LATENCY.earlyMs || med > LATENCY.maxMs) return { ok: false, reason: 'range' };
  return { ok: true, ms: Math.max(0, Math.round(med)) };
}
