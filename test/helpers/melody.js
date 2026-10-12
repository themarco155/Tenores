import { referenceFromCurve, sliceReference } from '../../practice/reference.js';
import { align } from '../../practice/align.js';
import { score } from '../../practice/score.js';
import { bandFor } from '../../practice/scoring-config.js';

// Melodía de prueba: 3 frases separadas por silencios de 400 ms.
export const MELODY = [
  [57, 40], [59, 40], [60, 60], [62, 40], [null, 40],
  [64, 50], [62, 50], [60, 80], [null, 40],
  [59, 40], [57, 100], [null, 20],
];

export function curve(spec) {
  const out = [];
  for (const [m, n] of spec) for (let i = 0; i < n; i++) out.push(m);
  return out;
}

export const shift = (c, semis) => c.map(v => (v == null ? null : v + semis));

export function stretch(c, factor) {
  const n = Math.round(c.length * factor);
  return Array.from({ length: n }, (_, k) => c[Math.min(c.length - 1, Math.floor(k / factor))]);
}

export const ramp = (from, to, frames) => Array.from({ length: frames }, (_, k) => from + ((to - from) * k) / (frames - 1));

export const melodyRef = () => referenceFromCurve({ songId: 'test', midi: curve(MELODY) });

export function runScore(user, mode = 'test', phraseFrom = 1, phraseTo = 3, ref = melodyRef()) {
  const slice = sliceReference(ref, phraseFrom, phraseTo);
  const path = align(user, slice.midi, { bandFrames: bandFor(mode, slice.midi.length) });
  return score(user, slice, path, mode);
}
