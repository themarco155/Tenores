import { detectPitch } from './pitch.js';
import { median } from './util.js';

// Indicador de afinación en vivo (modo con guía): utilidades puras.
export const LIVE = { lagMs: 100, toleranceMs: 120, windowMs: 260, tailMs: 180, minLevel: 0.01, okCents: 20, warnCents: 50, edgeFrames: 3 };
const NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

// Búfer circular de muestras: guarda las últimas `capacity` y devuelve las últimas `n` en orden.
export function createSampleRing(capacity) {
  const buf = new Float32Array(capacity);
  let write = 0, filled = 0;
  return {
    push(block) {
      for (let i = 0; i < block.length; i++) {
        buf[write] = block[i];
        write = (write + 1) % capacity;
      }
      filled = Math.min(capacity, filled + block.length);
    },
    latest(n) {
      const k = Math.min(n, filled);
      const out = new Float32Array(k);
      for (let i = 0; i < k; i++) out[i] = buf[(write - k + i + capacity) % capacity];
      return out;
    },
  };
}

export function noteName(midi) {
  const n = Math.round(midi);
  return `${NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}

// Nota de la referencia que suena `lagMs` antes del instante `seconds` de la canción (o null entre notas
// y a partir de `endFrame`, el final del fragmento elegido).
export function targetAt(ref, seconds, lagMs = LIVE.lagMs, endFrame = Infinity) {
  const frame = Math.round((seconds * 1000 - lagMs) / ref.hopMs);
  if (frame < 0 || frame >= endFrame) return null;
  const note = ref.notes.find(n => frame >= n.start && frame < n.end);
  return note ? note.midi : null;
}

// Como targetAt, pero en los cambios de nota (±toleranceMs) elige, entre las notas cercanas, la más parecida a lo
// que canta el tenor: unos milisegundos de desfase entre la guía y la voz no deben marcarse como error.
export function targetFor(ref, seconds, user, { lagMs = LIVE.lagMs, toleranceMs = LIVE.toleranceMs, endFrame = Infinity } = {}) {
  const now = targetAt(ref, seconds, lagMs, endFrame);
  if (now == null || user == null) return now;
  const center = Math.round((seconds * 1000 - lagMs) / ref.hopMs);
  const tol = Math.round(toleranceMs / ref.hopMs);
  const lo = center - tol, hi = Math.min(center + tol, endFrame - 1);
  const near = ref.notes.filter(n => n.start <= hi && n.end > lo && n.start < endFrame).map(n => n.midi);
  return near.reduce((best, m) => (Math.abs(deviationCents(user, m)) < Math.abs(deviationCents(user, best)) ? m : best), now);
}

// Nota cantada en el último fragmento de micrófono (midi) o null si hay silencio.
export function livePitch(samples, sampleRate, level) {
  if (level < LIVE.minLevel || !samples.length) return null;
  const { midi, hopMs } = detectPitch(samples, sampleRate);
  // Los últimos frames analizan ventanas que salen del fragmento (relleno con ceros): se descartan.
  const usable = midi.slice(0, Math.max(0, midi.length - LIVE.edgeFrames));
  return median(usable.slice(-Math.max(1, Math.round(LIVE.tailMs / hopMs))));
}

export function deviationCents(user, target) {
  if (user == null || target == null) return null;
  const d = (user - target) * 100;
  return Math.round(((d + 600) % 1200 + 1200) % 1200 - 600);
}

export function tuningState(cents) {
  if (cents == null) return { key: 'none', text: '' };
  const a = Math.abs(cents);
  if (a <= LIVE.okCents) return { key: 'ok', text: 'Afinado' };
  const dir = cents > 0 ? 'alto' : 'bajo';
  return a <= LIVE.warnCents ? { key: 'warn', text: `Un poco ${dir}` } : { key: 'bad', text: `Muy ${dir}` };
}
