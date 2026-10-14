import { detectPitch } from './pitch.js';
import { sliceReference } from './reference.js';
import { align } from './align.js';
import { score } from './score.js';
import { bandFor } from './scoring-config.js';

export const ENGINE_VERSION = '1.1.0'; // 1.1.0: el ritmo deja de contar en la nota total

export function analyze({ samples, sampleRate, refData, mode, phraseFrom, phraseTo }) {
  const user = detectPitch(samples, sampleRate).midi;
  const slice = sliceReference(refData, phraseFrom, phraseTo);
  const path = align(user, slice.midi, { bandFrames: bandFor(mode, slice.midi.length) });
  const r = score(user, slice, path, mode);
  return {
    engineVersion: ENGINE_VERSION,
    songId: refData.songId,
    mode,
    phraseFrom: slice.phraseFrom,
    phraseTo: slice.phraseTo,
    isFull: slice.isFull,
    valid: r.valid,
    coverage: r.coverage,
    scores: r.scores,
    phrases: r.phrases,
    tips: r.tips,
    curves: r.curves,
  };
}
